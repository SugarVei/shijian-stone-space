import {useState,useEffect,useMemo,useRef} from 'react';
import {desktop} from './useDiskData';
function demoReport(scan){
  const pool=[{name:'Cache',file:'renderer-old.cache',bytes:124000000,reason:'较旧的渲染缓存，确认相关应用已关闭且可以重新生成后清理。'},
    {name:'Logs',file:'previous-session.log',bytes:48000000,reason:'历史运行日志，确认不再需要排查问题后清理。'},
    {name:'Temp',file:'session-old.tmp',bytes:320000000,reason:'多日未修改的临时文件，确认没有任务仍在使用后清理。'}];
  const results=pool.flatMap((item,index)=>{const owner=scan.children.find(child=>child.name===item.name);return owner?[{id:`f${index}`,ownerId:owner.id,relativePath:`${item.name}\\${item.file}`,bytes:item.bytes,status:'candidate',confidence:.94,reason:item.reason}]:[];});
  return {id:'preview',scope:scan.path,provider:'DeepSeek',checkedFiles:scan.files,results,limited:false,skipped:0};
}
export default function useCleanup(model){
  const [open,setOpen]=useState(false),[settingsOpen,setSettingsOpen]=useState(false),[config,setConfig]=useState({configured:false,model:'deepseek-flash'});
  const [report,setReport]=useState(null),[analyzing,setAnalyzing]=useState(false),[trashing,setTrashing]=useState(false);
  const [checked,setChecked]=useState(new Set()),[error,setError]=useState(''),[message,setMessage]=useState(''),[ownerFilter,setOwnerFilter]=useState(null),[confirmPreview,setConfirmPreview]=useState(false);
  const generation=useRef(0);
  useEffect(()=>{if(desktop)desktop.aiConfig().then(setConfig).catch(()=>{});},[]);
  useEffect(()=>{generation.current++;desktop?.cancelAnalysis();setReport(null);setChecked(new Set());setAnalyzing(false);setOwnerFilter(null);setMessage('');setError('');},[model.path]);
  useEffect(()=>{if(model.busy||model.updating){generation.current++;desktop?.cancelAnalysis();setReport(null);setChecked(new Set());setAnalyzing(false);}},[model.busy,model.updating]);
  const markers=useMemo(()=>{
    const map=new Map();for(const item of report?.results||[]){if(item.status!=='candidate')continue;const prior=map.get(item.ownerId)||{count:0,bytes:0};map.set(item.ownerId,{count:prior.count+1,bytes:prior.bytes+item.bytes});}return map;
  },[report]);
  const selectedItems=(report?.results||[]).filter(item=>checked.has(item.id)&&item.status==='candidate');
  async function show(owner=null){setOwnerFilter(owner);setOpen(true);if(desktop)try{setConfig(await desktop.aiConfig());}catch{}}
  async function save(input){try{const value=await desktop.saveAIConfig(input);setConfig(value);setSettingsOpen(false);setError('');setMessage('API 设置已保存');}catch(error){throw new Error(error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/,''));}}
  async function analyze(){
    if(desktop&&!config.configured){setSettingsOpen(true);return;}
    if(model.busy||model.updating||!model.scan?.complete){setError('请等待扫描完成');return;}
    const id=++generation.current;setAnalyzing(true);setError('');setMessage('');setReport(null);setChecked(new Set());setOwnerFilter(null);
    try{const data=desktop?await desktop.analyzeCleanup(model.path):await new Promise(resolve=>setTimeout(()=>resolve(demoReport(model.scan)),850));if(id===generation.current)setReport(data);}
    catch(error){if(id===generation.current)setError(error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/,''));}
    finally{if(id===generation.current)setAnalyzing(false);}
  }
  function cancel(){generation.current++;desktop?.cancelAnalysis();setAnalyzing(false);setMessage('分析已取消');}
  function toggle(id){setChecked(prior=>{const next=new Set(prior);if(next.has(id))next.delete(id);else next.add(id);return next;});}
  async function trash(){
    if(!selectedItems.length)return;
    if(!desktop&&!confirmPreview){setConfirmPreview(true);return;}
    setConfirmPreview(false);setTrashing(true);setError('');setMessage('');
    try{
      if(!desktop){setReport(prior=>({...prior,results:prior.results.map(item=>checked.has(item.id)?{...item,status:'removed'}:item)}));setChecked(new Set());setMessage('预览完成：桌面版会将所选文件移入回收站');return;}
      const result=await desktop.trashCandidates(report.id,selectedItems.map(item=>item.id));
      if(result.cancelled){setMessage('已取消，文件保持原样');return;}
      if(result.removed.length){setReport(null);setChecked(new Set());await model.afterCleanup();}
      setMessage(`已将 ${result.removed.length} 个文件移入回收站${result.failed.length?`，${result.failed.length} 个文件未清理，请重新分析`:''}`);
    }catch(error){setError(error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/,''));}
    finally{setTrashing(false);}
  }
  return {open,show,close:()=>setOpen(false),settingsOpen,setSettingsOpen,config,save,report,analyzing,trashing,checked,toggle,error,message,analyze,cancel,trash,markers,ownerFilter,setOwnerFilter,selectedItems,confirmPreview,setConfirmPreview};
}
