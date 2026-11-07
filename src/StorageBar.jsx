import { CATEGORIES, formatBytes } from './data';
// Same apportioning as before: measured category bytes, scaled down if they exceed used space;
// any unmeasured used space is shown as "其他".
function portionsFor(drive,scan){
  const used=drive.total-drive.free;
  const amounts=Object.keys(CATEGORIES).map(key=>({key,bytes:scan?.children.filter(item=>item.category===key).reduce((sum,item)=>sum+item.bytes,0)||0}));
  const measured=amounts.reduce((sum,item)=>sum+item.bytes,0);
  const scale=measured>used?used/measured:1;
  return {used,measured,portions:amounts.map(item=>({...item,fraction:(item.bytes*scale+(item.key==='other'?Math.max(0,used-measured):0))/drive.total}))};
}
export function StorageBar({drive,scan,small=false,palette}) {
  if(!drive)return null;
  const {used,measured,portions}=portionsFor(drive,scan);
  return <div className={`storage-bar ${small?'mini':''}`} role="img" aria-label={`已用 ${formatBytes(used)}，总容量 ${formatBytes(drive.total)}，可用 ${formatBytes(drive.free)}`}>
    {portions.map(item=><span key={item.key} className="storage-segment" style={{flexBasis:`${item.fraction*100}%`,background:palette?.[item.key]||CATEGORIES[item.key].color}} title={`${CATEGORIES[item.key].label}${measured>0?' · '+formatBytes(item.bytes):''}`}/>)}
    <span className="storage-free" style={{flexBasis:`${drive.free/drive.total*100}%`}} title={`可用 · ${formatBytes(drive.free)}`}/>
  </div>;
}
export function StorageLegend({drive,scan,palette}){
  const measured=drive&&scan?.children?.length?portionsFor(drive,scan):null;
  const bytes=key=>measured?.portions.find(item=>item.key===key)?.fraction*drive.total;
  return <ul className="storage-legend" aria-label="分类图例">
    {Object.entries(CATEGORIES).filter(([key])=>!measured||bytes(key)>0).map(([key,item])=><li key={key}><i style={{background:palette?.[key]||item.color}}/><span>{item.label}</span>{measured&&<b>{formatBytes(bytes(key))}</b>}</li>)}
    {drive&&<li><i className="free-dot"/><span>可用</span><b>{formatBytes(drive.free)}</b></li>}
  </ul>;
}
