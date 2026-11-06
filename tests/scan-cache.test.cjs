const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {EventEmitter}=require('node:events');
const {createScanCache}=require('../electron/scan-cache.cjs');
const {createScanWatch}=require('../electron/scan-watch.cjs');
test('complete snapshots persist across restarts, preserve dirty state and reject replacement volumes and damaged data',async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'shijian-cache-'));
  try{
    const drive={id:'T:',root:temp,volumeSerial:'volume-1',total:999,free:100};
    const snapshot={path:temp,complete:true,scannedAt:Date.now(),children:[{name:'file',bytes:123}],bytes:123};
    const cache=createScanCache(path.join(temp,'profile'));
    await cache.saveDrives([drive]);await cache.prefer(drive.id);await cache.save(snapshot,drive);
    const restarted=createScanCache(path.join(temp,'profile')),boot=await restarted.bootstrap();
    assert.equal(boot.scan.bytes,123);assert.equal(boot.scan.fromCache,true);assert.equal(boot.preferredDrive,'T:');
    assert.equal(await restarted.read(temp,{...drive,volumeSerial:'volume-2'}),null);
    await restarted.markDirty(temp);
    assert.equal((await createScanCache(path.join(temp,'profile')).bootstrap()).scan.hasChanges,true);
    await restarted.invalidateDrive(temp);assert.equal((await restarted.bootstrap()).scan,null);
    await restarted.save({...snapshot,complete:false},drive);assert.equal(await restarted.read(temp,drive),null,'partial scans are not saved');
    await restarted.save(snapshot,drive);
    const files=await fs.readdir(restarted.directory);const file=files.find(name=>name.endsWith('.json.gz'));await fs.writeFile(path.join(restarted.directory,file),'broken');
    assert.equal((await createScanCache(path.join(temp,'profile')).bootstrap()).scan,null);
  }finally{await fs.rm(temp,{recursive:true,force:true});}
});
test('watcher ignores application cache writes, coalesces changes and closes cleanly',()=>{
  let listener,closed=0,changed=0;const scope=path.resolve('test-root'),ignored=path.join(scope,'app-data');
  const watcher=createScanWatch({ignoredRoot:ignored,onChange:()=>changed++,watch:(_scope,options,callback)=>{assert.equal(options.recursive,true);listener=callback;const handle=new EventEmitter();handle.close=()=>closed++;return handle;}});
  watcher.start(scope,{},'request-1');listener('change','app-data/scan-cache-v1/manifest.json');assert.equal(changed,0);
  listener('change','documents/file.txt');listener('rename','documents/other.txt');assert.equal(changed,1);
  watcher.close();assert.equal(closed,1);listener('change','x');assert.equal(changed,1);
});
