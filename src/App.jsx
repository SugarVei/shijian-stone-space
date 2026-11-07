import {useState,useEffect,useMemo,useDeferredValue,useCallback} from 'react';
import {Search,RefreshCw,HardDrive,ChevronRight,ArrowLeft,Maximize2,Minus,X,Square,LoaderCircle,AlertCircle,Sparkles,Gem,ChartNoAxesColumnIncreasing} from 'lucide-react';
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
const LOGO=`${import.meta.env.BASE_URL}brand/logo-pebbles.webp`;
function Brand(){return <span className="brand-mark"><img src={LOGO} alt="" width="105" height="25" draggable="false"/></span>;}
function percent(part,total){return total>0?Math.round(part/total*100):0;}
export default function App(){
  const model=useDiskData(),[selectedId,setSelectedId]=useState('C:\\Users'),[selectedExtra,setSelectedExtra]=useState(null),[query,setQuery]=useState('');
  const deferredQuery=useDeferredValue(query),items=model.scan?.children||EMPTY;
  const cleanup=useCleanup(model);
  const [chartData,setChartData]=useState(null),[chartSelection,setChartSelection]=useState(null),[viewMode,setViewMode]=useState('stones');
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
  const drive=websiteModel.drive,used=drive?drive.total-drive.free:0;
  const candidateCount=cleanup.report?.results.filter(item=>item.status==='candidate').length||0;
  const subPath=model.canBack?model.path.replace(/^[A-Z]:\\?/i,''):'';
  return <div className={`app ${desktop?'desktop':'web-preview'}`}>
    <header className="app-header">
      <button className="brand" onClick={model.goRoot} aria-label="石间，回到磁盘"><Brand/><span className="brand-name">石间</span></button>
      {!desktop&&<span className="preview-label" title="分类容量来自固定的示例数据，网页不扫描本机磁盘">示例数据</span>}
      <div className="header-tools">
        <div className="search-box"><Search size={16}/><input aria-label="搜索文件夹" placeholder={desktop?'搜索当前文件夹':'搜索分类'} value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button className="clear-search" aria-label="清除搜索" onClick={()=>setQuery('')}><X size={14}/></button>}</div>
        <button className="tool-button refresh" aria-label={scanning?'停止扫描':'重新扫描'} title={scanning?'停止扫描':'重新扫描'} onClick={scanning?model.stop:model.refresh}>{scanning?<Square size={14}/>:<RefreshCw size={16}/>}</button>
        <button className={`tool-button cleanup-trigger ${cleanup.open?'active':''}`} onClick={()=>cleanup.show()} aria-label="AI 清理" aria-expanded={cleanup.open}><Sparkles size={16}/><span>AI 清理</span>{cleanup.markers.size>0&&<i>{candidateCount}</i>}</button>
      </div>
      <div className="window-controls">{desktop&&<button aria-label="最小化" onClick={()=>windowAction('minimize')}><Minus size={16}/></button>}<button aria-label={desktop?'最大化':'全屏预览'} onClick={()=>windowAction('maximize')}>{desktop?<Square size={13}/>:<Maximize2 size={15}/>}</button>{desktop&&<button className="close-window" aria-label="关闭" onClick={()=>windowAction('close')}><X size={17}/></button>}</div>
    </header>
    <div className="workspace"><Sidebar model={websiteModel} selected={desktop?selected:websiteSelection} onSelect={select} cleanup={cleanup}/><main className="main-panel">
      <section className="overview" aria-label="磁盘容量">
        <div className="disk-heading">
          <h1><HardDrive size={22} strokeWidth={1.6}/><span>{drive?.id||''} {drive?.name||'磁盘'}</span></h1>
          {drive&&<span className="used-percent">已用 {percent(used,drive.total)}%</span>}
          <dl className="capacity-stats">
            <div><dt>已用</dt><dd>{drive?formatBytes(used):'—'}</dd></div>
            <div><dt>可用</dt><dd>{drive?formatBytes(drive.free):'—'}</dd></div>
            <div><dt>总容量</dt><dd>{drive?formatBytes(drive.total):'—'}</dd></div>
          </dl>
        </div>
        <StorageBar drive={drive} scan={desktop?rootScan:websiteModel.scan} palette={websiteModel.palette}/>
        <StorageLegend drive={drive} scan={desktop?rootScan:websiteModel.scan} palette={websiteModel.palette}/>
      </section>
      <div className="map-toolbar">
        <nav className="breadcrumbs" aria-label="当前位置">
          {model.canBack&&<button className="back-button" aria-label="返回上一级" title="返回上一级" onClick={model.goBack}><ArrowLeft size={16}/></button>}
          <button className="crumb-root" onClick={model.goRoot} aria-label="回到磁盘根目录" title="回到磁盘根目录">{model.drive?.id||'C:'}</button>
          {subPath&&<><ChevronRight size={14} className="crumb-sep"/><span className="current-path" title={model.path}>{subPath}</span></>}
        </nav>
        <div className="toolbar-status">
          {scanning&&<span className="scan-status" role="status"><LoaderCircle size={14} className="spin"/><span>{model.updating?'后台刷新':'正在扫描'}{model.progressCount?` · ${model.progressCount.toLocaleString()} 个文件`:''}</span></span>}
          {!scanning&&model.scan?.scannedAt&&<button className={`snapshot-status ${model.scan.hasChanges?'changed':''}`} onClick={model.refresh} title={`上次完整扫描：${new Date(model.scan.scannedAt).toLocaleString()}。点击重新扫描；轻量变化检测无法确认关闭软件期间的所有深层变更。`}>{model.scan.hasChanges?'有变化 · 待刷新':model.scan.fromCache?'上次扫描':'更新于'} {new Date(model.scan.scannedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</button>}
          {model.scan?.cacheWriteFailed&&<span className="scan-warning">缓存未保存</span>}
          {!model.busy&&model.scan?.skipped>0&&<span className="scan-warning" title={`跳过 ${model.scan.skipped} 个无法访问的项目；另跳过 ${model.scan.links} 个链接。石头表示已读取文件的逻辑大小。`}><AlertCircle size={14}/>{model.scan.skipped} 项未读取</span>}
          {!model.busy&&model.scan&&!model.scan.complete&&<span className="scan-warning">扫描未完成</span>}
        </div>
        {!desktop&&<div className="view-tabs" role="tablist" aria-label="布局">
          <button id="stones-tab" role="tab" aria-selected={viewMode==='stones'} aria-controls="stones-panel" onClick={()=>setViewMode('stones')}><Gem size={14}/>石头布局</button>
          <button id="heatmap-tab" role="tab" aria-selected={viewMode==='heatmap'} aria-controls="heatmap-panel" onClick={()=>setViewMode('heatmap')}><ChartNoAxesColumnIncreasing size={14}/>3D 热力柱</button>
        </div>}
      </div>
      {model.error&&<div className="error-message" role="alert"><AlertCircle size={16}/><span>{model.error}</span><button onClick={model.refresh}>重试</button></div>}
      {desktop?<PebbleMap items={items} selected={selected?.id} onSelect={select} onEnter={enter} query={deferredQuery} busy={model.busy} markers={cleanup.markers}/>:<DiskHeatmap mode={viewMode} query={deferredQuery} activeDisk={model.drive?.id} selection={chartSelection} onData={setChartData} onSelect={chartSelect}/>}
    </main></div>
    <CleanupPanel cleanup={cleanup} scanBusy={model.busy||model.updating} onInspect={ownerId=>{const item=items.find(item=>item.id===ownerId);if(item)select(item);}}/>
  </div>;
}
