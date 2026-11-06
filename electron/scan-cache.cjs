const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {gzip,gunzip}=require('node:zlib');
const {promisify}=require('node:util');
const compress=promisify(gzip),decompress=promisify(gunzip);
const keyFor=value=>process.platform==='win32'?path.resolve(value).toLowerCase():path.resolve(value);
function createScanCache(userData){
  const directory=path.join(userData,'scan-cache-v1'),manifestFile=path.join(directory,'manifest.json');
  let manifest={version:1,drives:[],entries:{},preferredDrive:null},initialization=null,queue=Promise.resolve();
  const memory=new Map();
  const filename=target=>createHash('sha256').update(keyFor(target)).digest('hex')+'.json.gz';
  async function atomic(file,data){await fs.mkdir(directory,{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await fs.writeFile(temp,data);await fs.rename(temp,file);}
  function initialize(){if(!initialization)initialization=(async()=>{try{const parsed=JSON.parse(await fs.readFile(manifestFile,'utf8'));if(parsed.version===1&&Array.isArray(parsed.drives)&&parsed.entries&&typeof parsed.entries==='object')manifest=parsed;}catch{}})();return initialization;}
  function writeManifest(){return atomic(manifestFile,JSON.stringify(manifest));}
  function enqueue(work){const next=queue.then(work);queue=next.catch(()=>{});return next;}
  return {
    directory,
    async bootstrap(){
      await initialize();const drive=manifest.drives.find(item=>item.id===manifest.preferredDrive)||manifest.drives.find(item=>item.id==='C:')||manifest.drives[0];
      const scan=drive?await this.read(drive.root,drive):null;
      return {drives:manifest.drives,preferredDrive:drive?.id||null,scan};
    },
    async saveDrives(drives){await initialize();manifest.drives=drives.map(item=>({...item}));await enqueue(writeManifest);},
    async prefer(driveId){await initialize();if(manifest.preferredDrive===driveId)return;manifest.preferredDrive=driveId;await enqueue(writeManifest);},
    async read(target,drive){
      await initialize();const key=keyFor(target),entry=manifest.entries[key];
      if(!entry||!drive?.volumeSerial||entry.volumeSerial!==drive.volumeSerial)return null;
      if(memory.has(key))return {...memory.get(key),fromCache:true,hasChanges:!!entry.dirty};
      try{
        const file=path.join(directory,filename(target));if((await fs.stat(file)).size>16*1024*1024)return null;
        const data=JSON.parse((await decompress(await fs.readFile(file),{maxOutputLength:64*1024*1024})).toString('utf8'));
        if(data.version!==1||keyFor(data.scan?.path||'')!==key||!data.scan.complete||!Array.isArray(data.scan.children)||!Number.isFinite(data.scan.scannedAt))return null;
        memory.set(key,data.scan);return {...data.scan,fromCache:true,hasChanges:!!entry.dirty};
      }catch{return null;}
    },
    async save(scan,drive){
      if(!scan.complete||!drive?.volumeSerial)return;
      await initialize();const key=keyFor(scan.path),value={...scan,fromCache:false,hasChanges:false};
      memory.set(key,value);
      await enqueue(async()=>{
        await atomic(path.join(directory,filename(scan.path)),await compress(JSON.stringify({version:1,scan:value}),{level:1}));
        manifest.entries[key]={volumeSerial:drive.volumeSerial,scannedAt:scan.scannedAt,dirty:false};
        const keys=Object.keys(manifest.entries).sort((a,b)=>manifest.entries[b].scannedAt-manifest.entries[a].scannedAt);
        for(const expired of keys.slice(48)){delete manifest.entries[expired];memory.delete(expired);await fs.unlink(path.join(directory,filename(expired))).catch(()=>{});}
        await writeManifest();
      });
    },
    async markDirty(target){await initialize();const entry=manifest.entries[keyFor(target)];if(!entry||entry.dirty)return;entry.dirty=true;await enqueue(writeManifest);},
    async markDriveDirty(root){await initialize();const parent=keyFor(root);await enqueue(async()=>{for(const key of Object.keys(manifest.entries)){const relative=path.relative(parent,key);if(!relative||(!relative.startsWith('..')&&!path.isAbsolute(relative)))manifest.entries[key].dirty=true;}await writeManifest();});},
    async invalidateDrive(root){await initialize();const parent=keyFor(root);await enqueue(async()=>{for(const key of Object.keys(manifest.entries)){const relative=path.relative(parent,key);if(!relative||(!relative.startsWith('..')&&!path.isAbsolute(relative))){delete manifest.entries[key];memory.delete(key);}}await writeManifest();});},
    async flush(){await queue;}
  };
}
module.exports={createScanCache};
