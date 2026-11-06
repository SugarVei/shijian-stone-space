const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage } = require('electron');
const { Worker } = require('node:worker_threads');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {createSettings}=require('./ai-settings.cjs');
const {createCleanupService}=require('./cleanup-service.cjs');
const {createScanCache}=require('./scan-cache.cjs');
const {createScanWatch}=require('./scan-watch.cjs');
let win, worker, driveCache = [], scanWatch, scanCache,loadGeneration=0;
const completedScans=new Map();
const fixture = process.argv.find(arg => arg.startsWith('--fixture-root='))?.slice(15);
if(fixture)app.setPath('userData',path.resolve(fixture+'-profile'));
const devUrl = process.env.STONE_DEV_URL === 'http://127.0.0.1:5186' ? process.env.STONE_DEV_URL : null;
const localUrl = pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
function validSender(event) {
  const url = event.senderFrame?.url;
  if (!url || event.sender !== win?.webContents || !(url === localUrl || (devUrl && url.startsWith(devUrl + '/')))) throw new Error('无效页面');
}
function stopWork(){if(worker){worker.terminate();worker=null;}scanWatch?.close();}
function cancel() { loadGeneration++;stopWork(); }
async function drives() {
  if (fixture) { const stats = await fs.statfs(fixture);driveCache = [{ id: 'T:', name: '测试磁盘', root: path.resolve(fixture),volumeSerial:'fixture:'+path.resolve(fixture), total: Number(stats.blocks * stats.bsize), free: Number(stats.bavail * stats.bsize) }];await scanCache?.saveDrives(driveCache).catch(()=>{});return driveCache; }
  const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; @(Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 -or $_.DriveType -eq 2 } | Select-Object DeviceID,VolumeName,VolumeSerialNumber,Size,FreeSpace) | ConvertTo-Json -Compress"], { windowsHide: true, encoding: 'utf8', timeout: 20000 });
  const data = JSON.parse(stdout.replace(/^\uFEFF/, ''));
  driveCache = (Array.isArray(data) ? data : [data]).filter(item => Number(item.Size) > 0).map(item => ({ id: item.DeviceID, name: item.VolumeName || (item.DeviceID === 'C:' ? '系统盘' : '本地磁盘'),volumeSerial:item.VolumeSerialNumber||null,root:item.DeviceID+'\\',total:Number(item.Size),free:Number(item.FreeSpace) }));
  await scanCache?.saveDrives(driveCache).catch(()=>{});return driveCache;
}
function driveFor(target){return driveCache.find(drive=>{const relative=path.relative(drive.root,target);return !relative||(!relative.startsWith('..')&&!path.isAbsolute(relative));});}
async function validatePath(input) {
  if (typeof input !== 'string' || input.includes('\0')) throw new Error('无效路径');
  const resolved = await fs.realpath(input);
  if (!driveCache.some(drive => { const relative = path.relative(drive.root, resolved); return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)); })) throw new Error('路径不在可用磁盘中');
  if (!(await fs.stat(resolved)).isDirectory()) throw new Error('请选择文件夹');
  return resolved;
}
app.setAppUserModelId('studio.shijian.diskspace');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    scanCache=createScanCache(app.getPath('userData'));
    scanWatch=createScanWatch({ignoredRoot:app.getPath('userData'),onChange:({scope,requestId})=>{
      const prior=completedScans.get(scope);if(prior)completedScans.set(scope,{...prior,hasChanges:true});
      scanCache.markDirty(scope).catch(()=>{});
      if(win&&!win.isDestroyed())win.webContents.send('stone:progress',{type:'cache-dirty',requestId,data:{path:scope,hasChanges:true}});
    }});
    async function loadScan(input,requestId,force=false){
      if(typeof requestId!=='string'||requestId.length>100)throw new Error('无效请求');
      const generation=++loadGeneration,target=await validatePath(input),drive=driveFor(target);
      const cached=await scanCache.read(target,drive);
      if(generation!==loadGeneration)return {cancelled:true};
      stopWork();scanCache.prefer(drive.id).catch(()=>{});
      if(cached&&!force){completedScans.set(target,cached);scanWatch.start(target,cached,requestId);return {cached,started:false};}
      const active=new Worker(path.join(__dirname,'scan-worker.cjs'),{workerData:{path:target}});worker=active;
      active.on('message',async payload=>{
        if(worker!==active||!win||win.isDestroyed())return;
        if(payload.type==='done'){
          payload.data={...payload.data,fromCache:false,hasChanges:false};
          completedScans.set(target,payload.data);while(completedScans.size>48)completedScans.delete(completedScans.keys().next().value);
          try{await scanCache.save(payload.data,drive);}catch{payload.data.cacheWriteFailed=true;}
          if(worker!==active||!win||win.isDestroyed())return;
          scanWatch.start(target,payload.data,requestId);
        }
        win.webContents.send('stone:progress',{...payload,requestId,background:!!cached});
        if(payload.type!=='progress'){worker=null;active.terminate();}
      });
      active.on('error',error=>{if(worker===active&&win&&!win.isDestroyed()){win.webContents.send('stone:progress',{type:'error',message:error.message,requestId});worker=null;}});
      return {cached,started:true};
    }
    const settings=createSettings(app,safeStorage);
    const cleanup=createCleanupService({
      getScan:scope=>completedScans.get(scope),getConfig:()=>settings.load(),validateScope:validatePath,
      confirmTrash:async files=>{
        const total=files.reduce((sum,file)=>sum+file.bytes,0);
        const answer=await dialog.showMessageBox(win,{type:'warning',title:'移入回收站',message:`将选中的 ${files.length} 个文件移入回收站？`,detail:files.slice(0,10).map(file=>file.relativePath).join('\n')+(files.length>10?`\n…另 ${files.length-10} 个文件`:'')+`\n\n合计 ${(total/1024/1024).toFixed(1)} MB。AI 建议可能有误，请确认这些文件已不再需要。`,buttons:['取消','移入回收站'],defaultId:0,cancelId:0,noLink:true});
        return answer.response===1;
      },trashItem:target=>shell.trashItem(target),onChanged:async scope=>{scanWatch.close();completedScans.clear();const drive=driveFor(scope);if(drive)await scanCache.markDriveDirty(drive.root).catch(()=>{});}
    });
    win = new BrowserWindow({ width: 1500, height: 980, minWidth: 900, minHeight: 640, title: '石间', frame: false, backgroundColor: '#ffffff', icon: path.join(__dirname, '../dist/icon.svg'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    win.setMenuBarVisibility(false);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    ipcMain.handle('stone:drives', async event => { validSender(event); return drives(); });
    ipcMain.handle('stone:bootstrap',async event=>{validSender(event);const saved=await scanCache.bootstrap();if(!driveCache.length)driveCache=saved.drives;if(saved.scan)completedScans.set(saved.scan.path,saved.scan);return saved;});
    ipcMain.handle('stone:load',async(event,input,requestId,force)=>{validSender(event);return loadScan(input,requestId,force===true);});
    ipcMain.handle('stone:scan',async(event,input,requestId)=>{validSender(event);return loadScan(input,requestId,true);});
    ipcMain.handle('stone:cancel', event => { validSender(event); cancel(); return true; });
    ipcMain.handle('stone:ai-config',async event=>{validSender(event);return settings.public();});
    ipcMain.handle('stone:ai-save',async(event,input)=>{validSender(event);return settings.save(input);});
    ipcMain.handle('stone:ai-analyze',async(event,scope)=>{validSender(event);return cleanup.analyze(scope);});
    ipcMain.handle('stone:ai-cancel',event=>{validSender(event);cleanup.cancel();return true;});
    ipcMain.handle('stone:trash',async(event,reportId,ids)=>{validSender(event);return cleanup.trash(reportId,ids);});
    ipcMain.handle('stone:open', async (event, input) => { validSender(event); const target = await validatePath(input); const error = await shell.openPath(target); if (error) throw new Error(error); return true; });
    ipcMain.handle('stone:window', (event, action) => { validSender(event); if (action === 'minimize') win.minimize(); if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize(); if (action === 'close') win.close(); });
    win.loadURL(devUrl || localUrl);
    win.on('closed', () => { cancel();cleanup.cancel(); win = null; });
  });
  app.on('window-all-closed', () => { cancel(); app.quit(); });
}
