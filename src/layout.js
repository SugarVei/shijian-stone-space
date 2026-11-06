import { voronoiMapSimulation } from 'd3-voronoi-map';
import { polygonCentroid, polygonArea } from 'd3-polygon';
function seeded(seed=713) { return () => { seed=(Math.imul(1664525,seed)+1013904223)|0;return (seed>>>0)/4294967296; }; }
export function layoutStones(items,width,height) {
  if (!items.length || width<2 || height<2) return [];
  const random=seeded();
  const sum=items.reduce((s,d)=>s+d.bytes,0);
  const data=items.map(item=>({...item,weight:Math.max(item.bytes/sum,.00001)}));
  let polygons;
  if(data.length===1) {
    const polygon=[[0,0],[width,0],[width,height],[0,height]]; polygon.item=data[0]; polygons=[polygon];
  } else {
    const simulation=voronoiMapSimulation(data).weight(d=>d.weight).clip([[0,0],[0,height],[width,height],[width,0]])
      .prng(random).initialPosition(d=>d.position?[d.position[0]*width,d.position[1]*height]:[random()*width,random()*height])
      .minWeightRatio(.00001).convergenceRatio(.008).maxIterationCount(150).stop();
    while(!simulation.state().ended) simulation.tick();
    polygons=simulation.state().polygons;
  }
  return polygons.map(polygon=>{
    const item=polygon.item||polygon.site.originalObject.data.originalData;
    const center=polygonCentroid(polygon);
    const area=Math.abs(polygonArea(polygon));
    const minX=Math.min(...polygon.map(p=>p[0])),maxX=Math.max(...polygon.map(p=>p[0]));
    const minY=Math.min(...polygon.map(p=>p[1])),maxY=Math.max(...polygon.map(p=>p[1]));
    return {item,center,area,width:maxX-minX,height:maxY-minY,path:roundedPath(polygon,center)};
  });
}
function roundedPath(polygon,center) {
  const points=polygon.map(p=>{const dx=p[0]-center[0],dy=p[1]-center[1],distance=Math.hypot(dx,dy);const f=Math.max(.8,1-2.2/distance);return[center[0]+dx*f,center[1]+dy*f];});
  const corners=points.map((p,i)=>{
    const prev=points[(i+points.length-1)%points.length], next=points[(i+1)%points.length];
    const before=Math.min(.4,115/Math.max(1,Math.hypot(prev[0]-p[0],prev[1]-p[1])));
    const after=Math.min(.4,115/Math.max(1,Math.hypot(next[0]-p[0],next[1]-p[1])));
    return {p,a:[p[0]+(prev[0]-p[0])*before,p[1]+(prev[1]-p[1])*before],b:[p[0]+(next[0]-p[0])*after,p[1]+(next[1]-p[1])*after]};
  });
  return corners.map(({p,a,b},i)=>`${i?'L':'M'}${a[0].toFixed(2)},${a[1].toFixed(2)}Q${p[0].toFixed(2)},${p[1].toFixed(2)} ${b[0].toFixed(2)},${b[1].toFixed(2)}`).join('')+'Z';
}
