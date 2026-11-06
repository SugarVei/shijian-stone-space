import { useState, useEffect, useRef, useCallback } from 'react';
import { DEMO_DRIVES, demoScan } from './data';
import {PathCache,pathKey} from './pathCache';
export const desktop=window.stoneDesktop;
export default function useDiskData() {
  const [drives,setDrives]=useState(desktop?[]:DEMO_DRIVES);
  const [driveId,setDriveId]=useState('C:');
  const [path,setPath]=useState(desktop?'':'C:');
  const [scan,setScan]=useState(desktop?null:demoScan('C:'));
  const [busy,setBusy]=useState(false),[updating,setUpdating]=useState(false),[progressCount,setProgressCount]=useState(0),[error,setError]=useState('');
  const cache=useRef(new PathCache()), request=useRef(''), history=useRef([]),lastEvent=useRef(''),dirtyPaths=useRef(new Set());
  const [canBack,setCanBack]=useState(false);
  const load=useCallback(async(target,force=false)=>{
    if(!target) return;
    const id=String(Date.now())+'-'+Math.random();request.current=id;
    setPath(target);setError('');setProgressCount(0);
    if(!desktop){setScan(demoScan(target));if(force){setBusy(true);setTimeout(()=>{if(request.current===id)setBusy(false);},650);}return;}
    const retained=cache.current.get(target);
    setScan(retained?{...retained,fromCache:true}:null);setBusy(!retained);setUpdating(!!retained&&force);
    try{
      const result=await desktop.loadScan(target,id,force);
      if(request.current!==id||result.cancelled||lastEvent.current===id)return;
      if(result.cached){const snapshot={...result.cached,hasChanges:result.cached.hasChanges||dirtyPaths.current.has(pathKey(result.cached.path))};cache.current.set(snapshot.path,snapshot);setScan(snapshot);setBusy(false);setUpdating(result.started);}
      else{setScan(null);setBusy(result.started);setUpdating(false);}
    }catch(error){if(request.current===id){setBusy(false);setUpdating(false);setError(error.message);}}
  },[]);
  useEffect(()=>{
    if(!desktop)return;
    let alive=true;
    const off=desktop.onScan(payload=>{
      if(payload.requestId!==request.current)return;
      if(payload.type==='cache-dirty'){
        dirtyPaths.current.add(pathKey(payload.data.path));
        const prior=cache.current.get(payload.data.path);if(prior)cache.current.set(payload.data.path,{...prior,hasChanges:true});
        setScan(prior=>prior?.path===payload.data.path?{...prior,hasChanges:true}:prior);return;
      }
      lastEvent.current=payload.requestId;
      if(payload.type==='error'){setError(payload.message);setBusy(false);setUpdating(false);return;}
      setProgressCount(payload.data.files);
      if(payload.type==='progress'&&payload.background){setUpdating(true);setBusy(false);return;}
      setScan(payload.data);
      if(payload.type==='done'){dirtyPaths.current.delete(pathKey(payload.data.path));cache.current.set(payload.data.path,payload.data);setBusy(false);setUpdating(false);}
    });
    (async()=>{
      let saved=null;
      try{
        saved=await desktop.bootstrap();if(!alive)return;
        if(saved.drives.length){setDrives(saved.drives);setDriveId(saved.preferredDrive||saved.drives[0].id);}
        if(saved.scan){cache.current.set(saved.scan.path,saved.scan);setPath(saved.scan.path);setScan(saved.scan);}
      }catch{}
      try{
        const list=await desktop.drives();if(!alive)return;setDrives(list);
        if(request.current)return;
        const drive=list.find(item=>item.id===saved?.preferredDrive)||list.find(item=>item.id==='C:')||list[0];
        if(drive){setDriveId(drive.id);await load(drive.root);}else{setScan(null);setError('没有找到可用磁盘');}
      }catch(error){if(alive)setError(saved?.scan?'暂时无法更新磁盘容量，当前显示上次快照':error.message);}
    })();
    return()=>{alive=false;off();desktop.cancel();};
  },[load]);
  function selectDrive(drive){history.current=[];setCanBack(false);setDriveId(drive.id);load(drive.root);}
  function enter(item){if(item.kind!=='directory')return;history.current.push(path);setCanBack(true);load(item.path);}
  function goBack(){const previous=history.current.pop();if(previous){setCanBack(history.current.length>0);load(previous);}}
  function goRoot(){const drive=drives.find(d=>d.id===driveId);if(drive){history.current=[];setCanBack(false);load(drive.root);}}
  function stop(){request.current='';desktop?.cancel();setBusy(false);setUpdating(false);}
  async function afterCleanup(){cache.current.clear();if(desktop){try{setDrives(await desktop.drives());}catch{}}await load(path,true);}
  return {drives,drive:drives.find(d=>d.id===driveId),path,scan,busy,updating,progressCount,error,setError,selectDrive,enter,goBack,goRoot,canBack,refresh:()=>load(path,true),stop,cache,afterCleanup};
}
