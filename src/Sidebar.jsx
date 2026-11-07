import { HardDrive,Folder,FolderOpen,ChevronRight,File,ArrowUpRight,Trash2,MousePointerClick } from 'lucide-react';
import { StorageBar } from './StorageBar';
import { CATEGORIES,formatBytes,demoScan } from './data';
import {desktop} from './useDiskData';
function share(part,total){return total>0?Math.min(100,part/total*100):0;}
export default function Sidebar({model,selected,onSelect,cleanup}){
  const details=selected?.kind==='directory' ? (desktop?model.cache.current.get(selected.path):demoScan(selected.path)):null;
  const rows=selected?.kind==='aggregate'?selected.items:details?.children;
  const color=selected?(model.palette?.[selected.category]||CATEGORIES[selected.category]?.color||CATEGORIES.other.color):null;
  const parentBytes=model.scan?.bytes;
  const parentName=model.canBack?model.path.split('\\').pop():model.drive?.id;
  const showShare=(selected?.kind==='directory'||selected?.kind==='file'||selected?.kind==='aggregate')&&parentBytes>0&&selected.bytes<=parentBytes;
  async function open(){try{if(desktop)await desktop.openFolder(selected.path);else model.enter(selected);}catch(error){model.setError(error.message);}}
  return <aside className="sidebar">
    <section className="drive-section" aria-label="磁盘列表">
      <h2 className="side-label">磁盘</h2>
      <nav className="drive-list" aria-label="磁盘">{model.drives.map(drive=>{const used=drive.total-drive.free;return <button key={drive.id} className={`drive-card ${model.drive?.id===drive.id?'active':''}`} onClick={()=>model.selectDrive(drive)} aria-pressed={model.drive?.id===drive.id}>
        <HardDrive className="drive-icon" size={18} strokeWidth={1.6}/>
        <span className="drive-information">
          <span className="drive-line"><strong>{drive.id} {drive.name}</strong><span className="drive-percent">{Math.round(share(used,drive.total))}%</span></span>
          <span className="drive-usage">{formatBytes(used)} / {formatBytes(drive.total)}</span>
          <StorageBar drive={drive} small palette={model.palette} scan={desktop?model.cache.current.get(drive.root)||(!model.canBack&&model.drive?.id===drive.id?model.scan:null):model.isCategoryOverview?model.categoryScans[drive.id]:demoScan(drive.root)}/>
        </span>
      </button>;})}</nav>
    </section>
    <section className="folder-details" aria-label="选中文件夹详情">
      <h2 className="side-label">选中项</h2>
      {selected?<>
        <div className="folder-heading"><span className="folder-swatch" style={{background:color}} aria-hidden="true"/><div><h2>{selected.name}</h2><p title={selected.path}>{selected.path}</p></div></div>
        <div className="folder-size">{formatBytes(selected.bytes)}</div>
        {showShare&&<div className="share-line"><div className="share-track"><span style={{width:`${share(selected.bytes,parentBytes)}%`,background:color}}/></div><span>占 {parentName} 的 {share(selected.bytes,parentBytes).toFixed(1)}%</span></div>}
        {cleanup.markers.has(selected.id)&&<button className="folder-cleanup-badge" onClick={()=>cleanup.show(selected.id)}><Trash2 size={14}/>{cleanup.markers.get(selected.id).count} 项建议清理<ChevronRight size={14}/></button>}
        {selected.kind==='category'?<dl className="category-proportions"><div><dt>占该盘容量</dt><dd>{selected.diskPercent.toFixed(2)}%</dd></div><div><dt>占全部已用</dt><dd>{selected.totalPercent.toFixed(2)}%</dd></div></dl>
        :selected.kind==='disk'?<dl className="category-proportions"><div><dt>总容量</dt><dd>{formatBytes(selected.totalBytes)}</dd></div><div><dt>可用空间</dt><dd>{formatBytes(selected.freeBytes)}</dd></div></dl>
        :rows?.length>0?<div className="folder-rows-wrap"><h3 className="side-label">最大的子项</h3><div className="folder-rows">{rows.slice(0,7).map(item=><button className="folder-row" key={item.id} onClick={()=>onSelect(item)} onDoubleClick={()=>model.enter(item)}><i style={{background:model.palette?.[item.category]||CATEGORIES[item.category]?.color||CATEGORIES.other.color}}/><span>{item.name}</span><b>{formatBytes(item.bytes)}</b><ChevronRight className="row-chevron" size={14}/></button>)}</div></div>
        :<div className="file-count">{selected.kind==='file'?<File size={16}/>:<Folder size={16}/>}<span>{selected.kind==='file'?'文件':`${(selected.files||0).toLocaleString()} 个文件`}</span></div>}
        <div className="folder-actions">
          {selected.kind==='directory'&&<><button className="action-primary" aria-label="进入文件夹" title="进入文件夹" onClick={()=>model.enter(selected)}><ArrowUpRight size={16}/><span>进入</span></button><button aria-label={desktop?'在资源管理器中打开':'打开文件夹'} title={desktop?'在资源管理器中打开':'打开文件夹'} onClick={open}><FolderOpen size={16}/><span>打开</span></button></>}
          <button className="folder-delete" aria-label="查看清理建议" title={cleanup.markers.has(selected.id)?'查看清理建议':'请先进行 AI 分析'} onClick={()=>cleanup.show(selected.kind==='category'||selected.kind==='disk'?null:selected.id)}><Trash2 size={16}/><span>清理</span></button>
        </div>
      </>:<div className="details-empty"><MousePointerClick size={20}/><span>选择一块石头查看详情</span></div>}
    </section>
  </aside>;
}
