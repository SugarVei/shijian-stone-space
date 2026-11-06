import { HardDrive,Folder,FolderOpen,ChevronRight,File,ArrowUpRight,Trash2 } from 'lucide-react';
import { StorageBar } from './StorageBar';
import { CATEGORIES,formatBytes,demoScan } from './data';
import {desktop} from './useDiskData';
export default function Sidebar({model,selected,onSelect,cleanup}){
  const details=selected?.kind==='directory' ? (desktop?model.cache.current.get(selected.path):demoScan(selected.path)):null;
  const rows=selected?.kind==='aggregate'?selected.items:details?.children;
  async function open(){try{if(desktop)await desktop.openFolder(selected.path);else model.enter(selected);}catch(error){model.setError(error.message);}}
  return <aside className="sidebar">
    <nav className="drive-list" aria-label="磁盘">{model.drives.map(drive=><button key={drive.id} className={`drive-card ${model.drive?.id===drive.id?'active':''}`} onClick={()=>model.selectDrive(drive)} aria-pressed={model.drive?.id===drive.id}>
      <HardDrive className="drive-icon" size={35} strokeWidth={1.45}/><div className="drive-information"><strong>{drive.id} {drive.name}</strong><span>{formatBytes(drive.total-drive.free)} / {formatBytes(drive.total)}</span><StorageBar drive={drive} small palette={model.palette} scan={desktop?model.cache.current.get(drive.root)||(!model.canBack&&model.drive?.id===drive.id?model.scan:null):model.isCategoryOverview?model.categoryScans[drive.id]:demoScan(drive.root)}/></div>
    </button>)}</nav>
    <section className="folder-details" aria-label="选中文件夹详情">
      {selected?<>
        <div className="folder-heading"><Folder size={37} strokeWidth={1.5} style={{color:model.palette?.[selected.category]||CATEGORIES[selected.category]?.color}}/><div><h2>{selected.name}</h2><p title={selected.path}>{selected.path}</p></div></div>
        <div className="folder-size">{formatBytes(selected.bytes)}</div>
        {cleanup.markers.has(selected.id)&&<button className="folder-cleanup-badge" onClick={()=>cleanup.show(selected.id)}><Trash2 size={14}/>{cleanup.markers.get(selected.id).count} 项建议清理<ChevronRight size={14}/></button>}
        {selected.kind==='category'?<div className="category-proportions"><div><span>占该盘容量</span><strong>{selected.diskPercent.toFixed(2)}%</strong></div><div><span>占全部已用</span><strong>{selected.totalPercent.toFixed(2)}%</strong></div></div>:selected.kind==='disk'?<div className="category-proportions"><div><span>总容量</span><strong>{formatBytes(selected.totalBytes)}</strong></div><div><span>可用空间</span><strong>{formatBytes(selected.freeBytes)}</strong></div></div>:rows?.length>0?<div className="folder-rows">{rows.slice(0,7).map(item=><button className="folder-row" key={item.id} onClick={()=>onSelect(item)} onDoubleClick={()=>model.enter(item)}><Folder size={22} strokeWidth={1.35} style={{color:CATEGORIES[item.category]?.color,fill:`${CATEGORIES[item.category]?.color}55`}}/><span>{item.name}</span><b>{formatBytes(item.bytes)}</b><ChevronRight className="row-chevron" size={15}/></button>)}</div>:<div className="file-count">{selected.kind==='file'?<File size={16}/>:<Folder size={16}/>}<span>{selected.kind==='file'?'文件':`${(selected.files||0).toLocaleString()} 个文件`}</span></div>}
        <div className="folder-actions">{selected.kind==='directory'&&<><button aria-label="进入文件夹" title="进入文件夹" onClick={()=>model.enter(selected)}><ArrowUpRight size={22}/></button><button aria-label={desktop?'在资源管理器中打开':'打开文件夹'} title={desktop?'在资源管理器中打开':'打开文件夹'} onClick={open}><FolderOpen size={23}/></button></>}<button className="folder-delete" aria-label="查看清理建议" title={cleanup.markers.has(selected.id)?'查看清理建议':'请先进行 AI 分析'} onClick={()=>cleanup.show(selected.kind==='category'||selected.kind==='disk'?null:selected.id)}><Trash2 size={20}/></button></div>
      </>:<div className="details-empty"><Folder size={32}/></div>}
    </section>
  </aside>;
}
