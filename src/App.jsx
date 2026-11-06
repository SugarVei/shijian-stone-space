import {useState,useEffect,useMemo,useDeferredValue,useCallback} from 'react';
import {Search,RefreshCw,HardDrive,Monitor,ChevronRight,ArrowLeft,Maximize2,Minus,X,Square,LoaderCircle,AlertCircle,Sparkles} from 'lucide-react';
import useDiskData,{desktop} from './useDiskData';
import {formatBytes,demoScan} from './data';
import Sidebar from './Sidebar';
import PebbleMap from './PebbleMap';
import {StorageBar,StorageLegend} from './StorageBar';
import useCleanup from './useCleanup';
import CleanupPanel from './CleanupPanel';
import DiskHeatmap from './DiskHeatmap';
import {GB} from './data';
const EMPTY=[];
function Brand(){return <span className="brand-stones" aria-hidden="true"><svg viewBox="0 0 92 36"><path d="M12 5Q17 0 21 9L29 25Q31 32 23 33H6Q-1 32 3 24Z" fill="#94b480"/><path d="M41 4L52 2Q58 3 59 10L61 27Q61 33 53 33L36 31Q30 30 32 23L34 11Q35 6 41 4Z" fill="#d6ad6a"/><path d="M75 2Q80 0 84 6L91 18Q94 23 89 28L78 34Q72 37 67 31L63 20Q62 15 67 10Z" fill="#83a5c2"/></svg></span>;}
export default function App(){
  const model=useDiskData(),[selectedId,setSelectedId]=useState('C:\\Users'),[selectedExtra,setSelectedExtra]=useState(null),[query,setQuery]=useState('');
  const deferredQuery=useDeferredValue(query),items=model.scan?.children||EMPTY;
  const cleanup=useCleanup(model);
  const [chartData,setChartData]=useState(null),[chartSelection,setChartSelection]=useState(null);
  const scanning=model.busy||model.updating;
  const selected=useMemo(()=>items.find(item=>item.id===selectedId)||selectedExtra||items[0]||null,[items,selectedId,selectedExtra]);
  const rootScan=model.canBack?(desktop?model.cache.current.get(model.drive?.root):demoScan(model.drive?.root||'C:')):model.scan;
  const websiteModel=useMemo(()=>{
    if(desktop)return model;
    const disks=chartData?.disks||[];
    const drives=disks.length?disks.map(d=>({id:d.id,name:d.name,root:d.id,total:d.totalGB*GB,free:d.freeGB*GB})):model.drives;
    const drive=drives.find(d=>d.id===model.drive?.id)||drives[0];const row=disks.find(d=>d.id===drive?.id);
    const categoryScans=Object.fromEntries(disks.map(row=>[row.id,{path:row.id,complete:true,children:chartData.categories.map((c,i)=>({id:row.id+'-'+c.key,name:c.label,category:c.key,bytes:row.values[i]*GB,kind:'category'}))}]));
    const scan=row?categoryScans[row.id]:null;
    return {...model,drives,drive,scan,categoryScans,palette:Object.fromEntries((chartData?.categories||[]).map(c=>[c.key,c.color])),isCategoryOverview:true,canBack:false,path:drive?.id||'C:',selectDrive:drive=>{setChartSelection(null);model.selectDrive(drive);}};
  },[model,chartData]);
  const chartSelect=useCallback(selection=>{setChartSelection(selection);const drive=model.drives.find(d=>d.id===selection.diskId);if(drive&&drive.id!==model.drive?.id)model.selectDrive(drive);},[model.drives,model.drive?.id]);
  const websiteSelection=useMemo(()=>{
    if(desktop||!chartData)return null;
    const disk=chartData.disks.find(d=>d.id===(chartSelection?.diskId||websiteModel.drive?.id));if(!disk)return null;
    const index=chartData.categories.findIndex(c=>c.key===chartSelection?.categoryKey);
    if(index>=0){const category=chartData.categories[index],gb=disk.values[index],total=chartData.disks.reduce((s,d)=>s+d.usedGB,0);return{id:disk.id+'-'+category.key,kind:'category',name:category.label,path:disk.id+' '+disk.name,bytes:gb*GB,category:category.key,diskPercent:gb/disk.totalGB*100,totalPercent:gb/total*100};}
    return{id:disk.id,kind:'disk',name:disk.id+' '+disk.name,path:'已用空间',bytes:disk.usedGB*GB,totalBytes:disk.totalGB*GB,freeBytes:disk.freeGB*GB,category:'other'};
  },[chartData,chartSelection,websiteModel.drive?.id]);
  useEffect(()=>{setSelectedExtra(null);setSelectedId('');setQuery('');},[model.path]);
  function select(item){setSelectedId(item.id);setSelectedExtra(item);}
  function enter(item){setSelectedExtra(null);model.enter(item);}
  function windowAction(action){if(desktop)desktop.windowAction(action);else if(action==='maximize'){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.();}}
  return <div className={`app ${desktop?'desktop':'web-preview'}`}>
    <header className="app-header"><button className="brand" onClick={model.goRoot} aria-label="石间，回到磁盘"><Brand/><span>石间</span></button>{!desktop&&<span className="preview-label" title="分类容量来自本次提供的 DATA，网站不执行本机实时扫描">设计预览</span>}
      <div className="header-tools"><div className="search-box"><Search size={21}/><input aria-label="搜索文件夹" placeholder="搜索" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button className="clear-search" aria-label="清除搜索" onClick={()=>setQuery('')}><X size={16}/></button>}</div><button className="icon-button refresh" aria-label={scanning?'停止扫描':'重新扫描'} title={scanning?'停止扫描':'重新扫描'} onClick={scanning?model.stop:model.refresh}>{scanning?<Square size={19}/>:<RefreshCw size={23}/>}</button></div>
      <div className="window-controls">{desktop&&<button aria-label="最小化" onClick={()=>windowAction('minimize')}><Minus size={19}/></button>}<button aria-label={desktop?'最大化':'全屏预览'} onClick={()=>windowAction('maximize')}>{desktop?<Square size={16}/>:<Maximize2 size={18}/>}</button>{desktop&&<button className="close-window" aria-label="关闭" onClick={()=>windowAction('close')}><X size={21}/></button>}</div>
    </header>
    <div className="workspace"><Sidebar model={websiteModel} selected={desktop?selected:websiteSelection} onSelect={select} cleanup={cleanup}/><main className="main-panel">
      <section className="capacity-section"><div className="disk-heading"><h1><HardDrive size={38} strokeWidth={1.4}/>{websiteModel.drive?.id||''} {websiteModel.drive?.name||'磁盘'}</h1><strong>{websiteModel.drive?`${formatBytes(websiteModel.drive.total-websiteModel.drive.free)} / ${formatBytes(websiteModel.drive.total)}`:'—'}</strong></div><StorageBar drive={websiteModel.drive} scan={desktop?rootScan:websiteModel.scan} palette={websiteModel.palette}/><StorageLegend palette={websiteModel.palette}/></section>
      <div className="map-toolbar"><div className="breadcrumbs">{model.canBack&&<button className="back-button" aria-label="返回上一级" onClick={model.goBack}><ArrowLeft size={20}/></button>}<button onClick={model.goRoot} aria-label="回到磁盘根目录"><Monitor size={23}/><span>{model.drive?.id||'C:'}</span></button>{model.canBack&&<><ChevronRight size={17}/><span className="current-path" title={model.path}>{model.path.replace(/^[A-Z]:\\?/i,'')}</span></>}</div>
      {(model.busy||model.updating)&&<div className="scan-status" role="status"><LoaderCircle size={14} className="spin"/><span>{model.updating?'后台刷新':'正在扫描'}{model.progressCount?` · ${model.progressCount.toLocaleString()} 个文件`:''}</span></div>}
      {!model.busy&&!model.updating&&model.scan?.scannedAt&&<button className={`snapshot-status ${model.scan.hasChanges?'changed':''}`} onClick={model.refresh} title={`上次完整扫描：${new Date(model.scan.scannedAt).toLocaleString()}。点击重新扫描；轻量变化检测无法确认关闭软件期间的所有深层变更。`}>{model.scan.hasChanges?'有变化 · 待刷新':model.scan.fromCache?'上次扫描':'更新于'} {new Date(model.scan.scannedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</button>}
      {model.scan?.cacheWriteFailed&&<span className="scan-warning">缓存未保存</span>}
      {!model.busy&&model.scan?.skipped>0&&<span className="scan-warning" title={`跳过 ${model.scan.skipped} 个无法访问的项目；另跳过 ${model.scan.links} 个链接。石头表示已读取文件的逻辑大小。`}><AlertCircle size={14}/>{model.scan.skipped} 项未读取</span>}
      {!model.busy&&model.scan&&!model.scan.complete&&<span className="scan-warning">扫描未完成</span>}
      <button className={`cleanup-trigger ${cleanup.open?'active':''}`} onClick={()=>cleanup.show()} aria-label="AI 清理"><Sparkles size={17}/><span>AI 清理</span>{cleanup.markers.size>0&&<i>{cleanup.report.results.filter(item=>item.status==='candidate').length}</i>}</button>
      </div>
      {model.error&&<div className="error-message" role="alert"><AlertCircle size={17}/><span>{model.error}</span><button onClick={model.refresh}>重试</button></div>}
      {desktop?<PebbleMap items={items} selected={selected?.id} onSelect={select} onEnter={enter} query={deferredQuery} busy={model.busy} markers={cleanup.markers}/>:<DiskHeatmap query={deferredQuery} activeDisk={model.drive?.id} selection={chartSelection} onData={setChartData} onSelect={chartSelect}/>}
    </main></div>
    <CleanupPanel cleanup={cleanup} scanBusy={model.busy||model.updating} onInspect={ownerId=>{const item=items.find(item=>item.id===ownerId);if(item)select(item);}}/>
  </div>;
}
