export const GB = 1024 ** 3;
export const CATEGORIES = {
  user: { label: '用户文件', color: '#8dae85' },
  system: { label: '系统', color: '#83a5c2' },
  apps: { label: '应用', color: '#d6ad6a' },
  data: { label: '系统数据', color: '#b196c7' },
  other: { label: '其他', color: '#b5aea3' },
};
export function formatBytes(bytes, compact = false) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  const i = Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024)) - 1);
  const value = bytes / 1024 ** (i + 1);
  return `${Number(value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2))}${compact ? '' : ' '}${units[i]}`;
}
const make = (name, size, category, position) => ({ name, bytes: size * GB, category, position, kind: 'directory' });
const rootItems = [make('Users',96,'user',[.29,.38]),make('Windows',72,'system',[.73,.73]),make('Program Files',48,'apps',[.78,.32]),make('ProgramData',24,'data',[.53,.16]),make('Games',18,'system',[.15,.76]),make('Cache',12,'user',[.4,.83]),make('Logs',6,'system',[.9,.11])];
const smallNames = ['Drivers','Intel','PerfLogs','Recovery','Temp','Fonts','Packages','Config','Tools','Media','Backup','Projects','Archive','Resources','Installers','OneDrive','Music','Videos','Public','Saved Games','AppCache','Reports','Thumbnails','Extensions','Library','Settings','Updates','LocalData','NVIDIA','Shared','History','Assets'];
smallNames.forEach((name,i) => {
  const edge=i%4,along=(Math.floor(i/4)+.5)/8;
  const position=edge===0?[along,.025]:edge===1?[.98,along]:edge===2?[1-along,.975]:[.02,1-along];
  rootItems.push(make(name,80/smallNames.length,['data','other','apps','user','system'][i%5],position));
});
function bind(items, parent) { return items.map(item => ({ ...item, id: `${parent}\\${item.name}`, path: `${parent}\\${item.name}` })); }
export const DEMO_DRIVES = [
  { id:'C:',name:'系统盘',root:'C:',total:512*GB,free:156*GB },
  { id:'D:',name:'工作盘',root:'D:',total:1024*GB,free:384*GB },
  { id:'F:',name:'资料盘',root:'F:',total:512*GB,free:332*GB },
];
export function demoScan(path) {
  const normalized = path.replace(/\\$/, '');
  let items;
  if (normalized === 'C:') items = rootItems;
  else if (normalized === 'D:') items = [make('工作项目',280,'user',[.25,.35]),make('素材库',160,'apps',[.75,.3]),make('设计归档',96,'data',[.65,.8]),make('开发工具',64,'system',[.2,.8]),make('其他',40,'other')];
  else if (normalized === 'F:') items = [make('照片',76,'user',[.25,.35]),make('视频',58,'system',[.75,.4]),make('文档',24,'apps',[.4,.8]),make('备份',16,'data'),make('其他',6,'other')];
  else if (normalized === 'C:\\Users') items = [make('Documents',36,'user',[.27,.3]),make('Downloads',32,'apps',[.75,.32]),make('Pictures',18,'system',[.65,.8]),make('其他',10,'data',[.2,.8])];
  else {
    const parent = findDemoItem(normalized);
    const size = (parent?.bytes || 16*GB)/GB;
    items = ['项目文件','工作资料','归档','其他'].map((name,i) => make(name,size*[.42,.29,.19,.1][i],['user','system','apps','data'][i]));
  }
  const children = bind(items, normalized);
  return { path:normalized,name:normalized.split('\\').pop(),bytes:children.reduce((sum,item)=>sum+item.bytes,0),children,files:12846,skipped:0,links:0,complete:true };
}
export function findDemoItem(path) {
  if (path.split('\\').length===2) return demoScan(path.slice(0,2)).children.find(item=>item.path===path);
  if (path.startsWith('C:\\Users\\')) return demoScan('C:\\Users').children.find(item=>item.path===path);
  return null;
}
export function visibleItems(children, max=70) {
  const sorted = children.filter(item=>item.bytes>0).sort((a,b)=>b.bytes-a.bytes);
  if (sorted.length <= max) return sorted;
  const main = sorted.slice(0,max-1), rest=sorted.slice(max-1);
  main.push({id:'__aggregate__',name:`其他 ${rest.length} 项`,bytes:rest.reduce((sum,item)=>sum+item.bytes,0),kind:'aggregate',category:'other',items:rest});
  return main;
}
