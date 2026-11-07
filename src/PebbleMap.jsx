import { useState,useEffect,useRef,useMemo } from 'react';
import { FolderSearch, LoaderCircle } from 'lucide-react';
import { CATEGORIES,formatBytes,visibleItems } from './data';
function tone(hex,amount) {const c=hex.slice(1).match(/../g).map(n=>parseInt(n,16));return '#'+c.map(v=>Math.max(0,Math.min(255,Math.round(amount>0?v+(255-v)*amount:v*(1+amount)))).toString(16).padStart(2,'0')).join('');}
// A small static noise tile gives the stones a light frosted grain without per-frame filters.
let grainTile='';
function grain(){
  if(grainTile||typeof document==='undefined')return grainTile;
  try{const size=96,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d'),img=ctx.createImageData(size,size);
    for(let i=0;i<img.data.length;i+=4){const light=Math.random()>.5;const v=light?255:20;img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=Math.round(Math.random()*(light?46:30));}
    ctx.putImageData(img,0,0);grainTile=canvas.toDataURL('image/png');}catch{grainTile='';}
  return grainTile;
}
export default function PebbleMap({items,selected,onSelect,onEnter,query,busy,markers,palette}){
  const container=useRef(),worker=useRef(),sequence=useRef(0),[size,setSize]=useState({width:1100,height:630}),[cells,setCells]=useState([]),[layoutError,setLayoutError]=useState('');
  const visible=useMemo(()=>visibleItems(items),[items]);
  const tile=useMemo(grain,[]);
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
        <radialGradient id="spotlight"><stop offset="0" stopColor="#ffffff" stopOpacity=".42"/><stop offset=".45" stopColor="#ffffff" stopOpacity=".14"/><stop offset="1" stopColor="#ffffff" stopOpacity="0"/></radialGradient>
        {tile&&<pattern id="stone-grain" patternUnits="userSpaceOnUse" width="96" height="96"><image href={tile} width="96" height="96"/></pattern>}
        {cells.map((cell,index)=>{const base=palette?.[cell.item.category]||CATEGORIES[cell.item.category]?.color||CATEGORIES.other.color;return <g key={cell.item.id}>
          <linearGradient id={`glass-${index}`} x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stopColor={tone(base,.14)}/><stop offset=".55" stopColor={base}/><stop offset="1" stopColor={tone(base,-.07)}/></linearGradient>
          <clipPath id={`clip-${index}`}><path d={cell.path}/></clipPath>
        </g>;})}
      </defs>
      {cells.map((cell,index)=>{
        const item=cell.item,isSelected=selected===item.id,match=!query||item.name.toLowerCase().includes(query.toLowerCase());
        const marked=markers?.get(item.id)||item.items?.some(child=>markers?.has(child.id));
        const label=cell.area>size.width*size.height*.008 && cell.width>66 && cell.height>48;
        const twoLine=cell.area>12000||palette;
        const font=Math.max(12,Math.min(30,Math.sqrt(cell.area)*.1,(cell.width-24)/Math.max(4,item.name.length)*1.5));
        return <g key={item.id} className={`pebble ${isSelected?'selected':''} ${match?'':'dimmed'}`} role="button" tabIndex={0} aria-label={`${item.name} ${formatBytes(item.bytes)}${marked?' · 含建议清理文件':''}`} aria-pressed={isSelected} data-name={item.name} data-cleanup-status={marked?'candidate':undefined} onClick={()=>onSelect(item)} onDoubleClick={()=>onEnter(item)} onPointerMove={spotlight} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();onEnter(item);}if(event.key===' '){event.preventDefault();onSelect(item);}}}>
          <title>{item.name} · {formatBytes(item.bytes)}{marked?' · 含建议清理文件，请查看 AI 建议':''}</title>
          <path className="pebble-body" d={cell.path} fill={`url(#glass-${index})`} stroke="#ffffff" strokeWidth="2"/>
          {tile&&<path className="pebble-grain" d={cell.path} fill="url(#stone-grain)" pointerEvents="none"/>}
          <circle className="mouse-light" cx={cell.center[0]+cell.width*.2} cy={cell.center[1]+cell.height*.15} r={Math.max(80,Math.min(cell.width,cell.height)*.55)} fill="url(#spotlight)" clipPath={`url(#clip-${index})`} pointerEvents="none"/>
          {isSelected&&<g pointerEvents="none"><path className="selected-ring" d={cell.path} fill="none" stroke="#2f4a3f" strokeWidth="2.5" strokeLinejoin="round"/><path className="orbit-line" d={cell.path} pathLength="100" fill="none" stroke="#ffffff" strokeOpacity=".9" strokeWidth="2" strokeDasharray="9 91" strokeLinecap="round"/></g>}
          {label&&<text x={cell.center[0]} y={cell.center[1]} textAnchor="middle" dominantBaseline="central" fill="#1a1f22" fontSize={font} fontWeight="600" pointerEvents="none"><tspan x={cell.center[0]} dy={twoLine?'-0.6em':'0'}>{item.name}</tspan>{twoLine&&<tspan className="pebble-size" x={cell.center[0]} dy="1.3em" fontSize={Math.max(12,font*.78)} fontWeight="500">{formatBytes(item.bytes)}</tspan>}</text>}
          {marked&&cell.area>1200&&<g className="cleanup-map-marker" transform={`translate(${cell.center[0]},${cell.center[1]-(twoLine?font*1.9:20)})`} pointerEvents="none"><circle r="9" fill="#3e5f51" stroke="white" strokeWidth="1.5"/><path d="M-3.5 0L-1 2.5L4-3.5" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></g>}
        </g>;
      })}
    </svg>
    {!visible.length&&<div className="map-empty">{busy?<><LoaderCircle className="spin" size={28}/><span>正在扫描</span></>:<><FolderSearch size={28}/><span>空文件夹</span></>}</div>}
    {!hasMatches&&<div className="no-results">没有找到“{query}”</div>}
    {layoutError&&<div className="map-error" role="alert">空间图暂时无法显示，请重新扫描</div>}
  </div>;
}
