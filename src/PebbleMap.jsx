import { useState,useEffect,useRef,useMemo } from 'react';
import { FolderSearch, LoaderCircle } from 'lucide-react';
import { CATEGORIES,formatBytes,visibleItems } from './data';
function tone(hex,amount) {const c=hex.slice(1).match(/../g).map(n=>parseInt(n,16));return '#'+c.map(v=>Math.max(0,Math.min(255,Math.round(amount>0?v+(255-v)*amount:v*(1+amount)))).toString(16).padStart(2,'0')).join('');}
export default function PebbleMap({items,selected,onSelect,onEnter,query,busy,markers,palette}){
  const container=useRef(),worker=useRef(),sequence=useRef(0),[size,setSize]=useState({width:1100,height:630}),[cells,setCells]=useState([]),[layoutError,setLayoutError]=useState('');
  const visible=useMemo(()=>visibleItems(items),[items]);
  useEffect(()=>{const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;setSize({width:Math.round(width),height:Math.round(height)});});observer.observe(container.current);return()=>observer.disconnect();},[]);
  useEffect(()=>{
    const w=new Worker(new URL('./layout.worker.js',import.meta.url),{type:'module'});worker.current=w;
    w.onmessage=({data})=>{if(data.id!==sequence.current)return;if(data.error)setLayoutError(data.error);else{setCells(data.cells);setLayoutError('');}};
    return()=>w.terminate();
  },[]);
  useEffect(()=>{sequence.current++;if(visible.length)worker.current?.postMessage({id:sequence.current,items:visible,width:size.width,height:size.height});else setCells([]);},[visible,size]);
  const hasMatches=!query||visible.some(item=>item.name.toLowerCase().includes(query.toLowerCase()));
  function spotlight(event){const group=event.currentTarget;const svg=group.ownerSVGElement;const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const local=point.matrixTransform(svg.getScreenCTM().inverse());const light=group.querySelector('.mouse-light');light?.setAttribute('cx',local.x);light?.setAttribute('cy',local.y);}
  return <div ref={container} className="pebble-map" data-testid="pebble-map">
    <svg className="pebble-svg" viewBox={`0 0 ${size.width} ${size.height}`} aria-label="文件夹空间分布" role="group">
      <defs>
        <radialGradient id="spotlight"><stop offset="0" stopColor={palette?"#f9fcf9":"#eaffff"} stopOpacity=".86"/><stop offset=".36" stopColor={palette?"#e2ece5":"#b9fff0"} stopOpacity=".48"/><stop offset="1" stopColor={palette?"#e2ece5":"#b6f8f0"} stopOpacity="0"/></radialGradient>
        <filter id="edge-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
        {cells.map((cell,index)=>{const base=palette?.[cell.item.category]||CATEGORIES[cell.item.category]?.color||CATEGORIES.other.color;return <g key={cell.item.id}>
          <linearGradient id={`glass-${index}`} x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stopColor={tone(base,.17)} stopOpacity=".94"/><stop offset=".45" stopColor={base} stopOpacity=".91"/><stop offset="1" stopColor={tone(base,-.1)} stopOpacity=".95"/></linearGradient>
          <linearGradient id={`sheen-${index}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="white" stopOpacity=".4"/><stop offset=".35" stopColor="white" stopOpacity=".06"/><stop offset="1" stopColor="white" stopOpacity=".19"/></linearGradient>
          <clipPath id={`clip-${index}`}><path d={cell.path}/></clipPath>
        </g>;})}
      </defs>
      {cells.map((cell,index)=>{
        const item=cell.item,isSelected=selected===item.id,match=!query||item.name.toLowerCase().includes(query.toLowerCase());
        const marked=markers?.get(item.id)||item.items?.some(child=>markers?.has(child.id));
        const label=cell.area>size.width*size.height*.008 && cell.width>66 && cell.height>48;
        const font=Math.max(11,Math.min(39,Math.sqrt(cell.area)*.12,(cell.width-24)/Math.max(4,item.name.length)*1.5));
        return <g key={item.id} className={`pebble ${isSelected?'selected':''} ${match?'':'dimmed'}`} role="button" tabIndex={0} aria-label={`${item.name} ${formatBytes(item.bytes)}${marked?' · 含建议清理文件':''}`} aria-pressed={isSelected} data-name={item.name} data-cleanup-status={marked?'candidate':undefined} onClick={()=>onSelect(item)} onDoubleClick={()=>onEnter(item)} onPointerMove={spotlight} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();onEnter(item);}if(event.key===' '){event.preventDefault();onSelect(item);}}}>
          <title>{item.name} · {formatBytes(item.bytes)}{marked?' · 含建议清理文件，请查看 AI 建议':''}</title>
          <path className="pebble-body" d={cell.path} fill={`url(#glass-${index})`} stroke="white" strokeWidth="1.6"/>
          <path d={cell.path} fill={`url(#sheen-${index})`} pointerEvents="none"/>
          <circle className="mouse-light" cx={cell.center[0]+cell.width*.2} cy={cell.center[1]+cell.height*.15} r={Math.max(85,Math.min(cell.width,cell.height)*.6)} fill="url(#spotlight)" clipPath={`url(#clip-${index})`} pointerEvents="none"/>
          {isSelected&&<g pointerEvents="none"><path d={cell.path} fill="none" stroke="#c3fffa" strokeWidth="2.3"/><path className="orbit-glow" d={cell.path} pathLength="100" fill="none" stroke="#6dfff1" strokeWidth="7" strokeDasharray="13 87" strokeLinecap="round" filter="url(#edge-glow)"/><path className="orbit-line" d={cell.path} pathLength="100" fill="none" stroke="white" strokeWidth="3" strokeDasharray="11 89" strokeLinecap="round"/></g>}
          {label&&<text x={cell.center[0]} y={cell.center[1]} textAnchor="middle" dominantBaseline="central" fill="#162022" fontSize={font} fontWeight="600" pointerEvents="none"><tspan x={cell.center[0]} dy={(cell.area>12000||palette)?'-0.55em':'0'}>{item.name}</tspan>{(cell.area>12000||palette)&&<tspan x={cell.center[0]} dy="1.28em" fontSize={font*1.02}>{formatBytes(item.bytes)}</tspan>}</text>}
          {marked&&cell.area>1200&&<g className="cleanup-map-marker" transform={`translate(${cell.center[0]},${cell.center[1]-(cell.area>12000?font*1.8:20)})`} pointerEvents="none"><circle r="10" fill="#407d63" stroke="white" strokeWidth="1.7"/><path d="M-4 0L-1 3L5-4" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></g>}
        </g>;
      })}
    </svg>
    {!visible.length&&<div className="map-empty">{busy?<><LoaderCircle className="spin" size={32}/><span>正在扫描</span></>:<><FolderSearch size={36}/><span>空文件夹</span></>}</div>}
    {!hasMatches&&<div className="no-results">没有找到“{query}”</div>}
    {layoutError&&<div className="map-error" role="alert">空间图暂时无法显示，请重新扫描</div>}
  </div>;
}
