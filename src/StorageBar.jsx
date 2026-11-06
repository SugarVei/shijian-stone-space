import { CATEGORIES, formatBytes } from './data';
export function StorageBar({drive,scan,small=false,palette}) {
  if(!drive)return null;
  const used=drive.total-drive.free;
  const amounts=Object.keys(CATEGORIES).map(key=>({key,bytes:scan?.children.filter(item=>item.category===key).reduce((sum,item)=>sum+item.bytes,0)||0}));
  const measured=amounts.reduce((sum,item)=>sum+item.bytes,0);
  const scale=measured>used?used/measured:1;
  const portions=amounts.map(item=>({...item,fraction:(item.bytes*scale+(item.key==='other'?Math.max(0,used-measured):0))/drive.total}));
  return <div className={`storage-bar ${small?'mini':''}`} role="img" aria-label={`已用 ${formatBytes(used)}，总容量 ${formatBytes(drive.total)}，可用 ${formatBytes(drive.free)}`}>
    {portions.map(item=><span key={item.key} className="storage-segment" style={{flexBasis:`${item.fraction*100}%`,background:palette?.[item.key]||CATEGORIES[item.key].color}} title={`${CATEGORIES[item.key].label}${measured>0?' · '+formatBytes(item.bytes):''}`}/>)}
    <span className="storage-free" style={{flexBasis:`${drive.free/drive.total*100}%`}}>{!small&&formatBytes(drive.free)}</span>
  </div>;
}
export function StorageLegend({palette}){return <div className="storage-legend">{Object.entries(CATEGORIES).map(([key,item])=><span key={key}><i style={{background:palette?.[key]||item.color}}/>{item.label}</span>)}<span><i className="free-dot"/>可用</span></div>;}
