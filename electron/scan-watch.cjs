const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
function createScanWatch({ignoredRoot,onChange,watch=fs.watch}){
  let watcher=null,generation=0;
  return {
    close(){generation++;watcher?.close();watcher=null;},
    start(scope,scan,requestId){
      this.close();const current=++generation;let notified=false;
      const changed=()=>{if(current!==generation||notified)return;notified=true;onChange({scope,requestId});};
      try{watcher=watch(scope,{recursive:true},(_event,filename)=>{
        if(!filename){changed();return;}
        const full=path.resolve(scope,String(filename));
        const relative=path.relative(ignoredRoot,full);
        if(!relative||(!relative.startsWith('..')&&!path.isAbsolute(relative)))return;
        changed();
      });watcher.on('error',()=>{if(current===generation)changed();});}catch{}
      // A lightweight check catches root/first-level changes made while the app was closed.
      // Deep changes while closed still require a manual refresh; this is always labelled a snapshot.
      (async()=>{
        if(!scan?.rootMtimeMs)return;
        try{if((await fsp.stat(scope)).mtimeMs!==scan.rootMtimeMs){changed();return;}
          for(const item of scan.children.slice(0,200)){
            if(current!==generation||notified)return;
            if(!Number.isFinite(item.mtimeMs))continue;
            try{const stat=await fsp.lstat(item.path);if(stat.mtimeMs!==item.mtimeMs||(item.kind==='file'&&stat.size!==item.bytes)){changed();return;}}catch{changed();return;}
          }
        }catch{changed();}
      })();
    }
  };
}
module.exports={createScanWatch};
