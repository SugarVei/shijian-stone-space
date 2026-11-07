import {useEffect,useRef,useState} from 'react';
import PebbleMap from './PebbleMap';
import {GB} from './data';
import './heatmap-frame.css';
export default function DiskHeatmap({mode='stones',query,activeDisk,selection,onData,onSelect}){
  const [data,setData]=useState(null);
  const frame=useRef(null),state=useRef({query,activeDisk});state.current={query,activeDisk};
  const send=()=>frame.current?.contentWindow?.postMessage({type:'disk-heatmap:state',...state.current},'*');
  useEffect(()=>{
    const receive=event=>{
      if(event.source!==frame.current?.contentWindow)return;
      if(event.data?.type==='disk-heatmap:ready'){
        const data=event.data.data;
        if(!Array.isArray(data?.disks)||!Array.isArray(data.categories)||data.disks.some(d=>!Array.isArray(d.values)||d.values.length!==data.categories.length||d.values.some(n=>!Number.isFinite(n)||n<0)||Math.abs(d.values.reduce((a,b)=>a+b,0)-d.usedGB)>1e-9))return;
        setData(data);onData(data);send();
      }
      if(event.data?.type==='disk-heatmap:select')onSelect(event.data.selection);
      if(event.data?.type==='disk-heatmap:request-state')send();
    };
    window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
  },[onData,onSelect]);
  useEffect(send,[query,activeDisk]);
  const disk=data?.disks.find(d=>d.id===activeDisk)||data?.disks[0];
  const palette=Object.fromEntries((data?.categories||[]).map(c=>[c.key,c.color]));
  const items=disk?data.categories.map((category,index)=>({id:disk.id+'-'+category.key,name:category.label,category:category.key,bytes:disk.values[index]*GB,kind:'category'})):[];
  const selectStone=item=>onSelect({diskId:disk.id,categoryKey:item.category});
  return <section className="visualization-shell" data-layout={mode} aria-label="磁盘空间可视化">
    <div className="stone-view" id="stones-panel" role="tabpanel" aria-labelledby="stones-tab" hidden={mode!=='stones'}>
      <PebbleMap items={items} palette={palette} selected={selection?selection.diskId+'-'+selection.categoryKey:null} onSelect={selectStone} onEnter={selectStone} query={query} busy={!data}/>
    </div>
    <div className="heatmap-frame" id="heatmap-panel" role="tabpanel" aria-labelledby="heatmap-tab" hidden={mode!=='heatmap'}><iframe ref={frame} src="./disk-heatmap.html" title="磁盘分类 3D 柱状热力图" onLoad={()=>{frame.current?.contentWindow?.postMessage({type:'disk-heatmap:init'},'*');send();}}/></div>
  </section>;
}
