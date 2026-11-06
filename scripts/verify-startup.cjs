const {_electron}=require(process.env.STONE_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const root=path.resolve(__dirname,'..');
process.env.PLAYWRIGHT_SCREENSHOT_NO_FONTS_READY='1';
async function run(){
  const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'shijian-startup-'));let app;
  const launch=()=>_electron.launch({executablePath:process.env.STONE_EXECUTABLE||path.join(root,'node_modules/electron/dist/electron.exe'),args:[...(process.env.STONE_EXECUTABLE?[]:[root]),`--fixture-root=${fixture}`]});
  try{
    await fs.mkdir(path.join(fixture,'Documents'));await fs.mkdir(path.join(fixture,'Archive'));
    for(let batch=0;batch<5;batch++)await Promise.all(Array.from({length:100},(_,i)=>fs.writeFile(path.join(fixture,batch%2?'Archive':'Documents',`file-${batch}-${i}.bin`),Buffer.alloc(1024))));
    const cold=Date.now();app=await launch();let page=await app.firstWindow();
    await page.locator('[data-name="Documents"]').waitFor({state:'attached'});await page.waitForFunction(()=>!document.querySelector('.scan-status')&&!!document.querySelector('.snapshot-status'));
    const coldMs=Date.now()-cold;
    const first=await page.evaluate(()=>window.stoneDesktop.bootstrap());assert.equal(first.scan.complete,true);assert.equal(first.scan.bytes,500*1024);
    await app.close();app=null;
    const warm=Date.now();app=await launch();page=await app.firstWindow();
    await page.locator('[data-name="Documents"]').waitFor({state:'attached'});await page.waitForFunction(()=>document.querySelector('.snapshot-status')?.textContent.includes('上次扫描'));
    const warmMs=Date.now()-warm;
    const lookup=Date.now();const result=await page.evaluate(target=>window.stoneDesktop.loadScan(target,'test-cached-load',false),fixture);const cacheLookupMs=Date.now()-lookup;
    assert.equal(result.started,false,'warm start does not spawn a recursive scan');assert.equal(result.cached.scannedAt,first.scan.scannedAt);
    await page.getByRole('button',{name:'回到磁盘根目录'}).click();
    await page.waitForTimeout(200);await fs.appendFile(path.join(fixture,'Documents','file-0-0.bin'),Buffer.alloc(256));
    await page.waitForFunction(()=>document.querySelector('.snapshot-status')?.textContent.includes('有变化'));
    await page.locator('[data-name="Documents"]').waitFor({state:'attached'});
    await page.screenshot({path:path.join(root,'.qa/startup-cached.png')});
    await page.getByRole('button',{name:'重新扫描',exact:true}).click();
    const refreshCells=await page.locator('.pebble').count();
    if(!refreshCells)console.log(JSON.stringify({refreshDiagnostic:await page.evaluate(()=>({text:document.querySelector('.main-panel')?.innerText,map:document.querySelector('.pebble-map')?.innerText})),cachePath:result.cached.path,requestedPath:fixture}));
    assert.ok(refreshCells>0,'cached map stays visible during manual refresh');
    await page.waitForFunction(()=>!document.querySelector('.scan-status')&&document.querySelector('.snapshot-status')?.textContent.includes('更新于'));
    const fresh=await page.evaluate(()=>window.stoneDesktop.bootstrap());assert.equal(fresh.scan.bytes,500*1024+256);assert.ok(fresh.scan.scannedAt>first.scan.scannedAt);
    console.log(JSON.stringify({pass:true,coldOpenMs:coldMs,warmOpenMs:warmMs,cacheLookupMs,recursiveScanOnWarmLoad:result.started,files:500,changeDetection:true,manualRefresh:true}));
  }finally{if(app)await app.close();await fs.rm(fixture,{recursive:true,force:true});await fs.rm(fixture+'-profile',{recursive:true,force:true});}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
