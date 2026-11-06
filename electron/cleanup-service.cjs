const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {cleanupPolicy,sameSnapshot}=require('./cleanup-policy.cjs');
const {analyzeCandidates}=require('./ai-client.cjs');
function createCleanupService({getScan,getConfig,validateScope,confirmTrash,trashItem,onChanged,analyzer=analyzeCandidates}){
  const reports=new Map();let controller=null,trashing=false;
  async function validateFile(file,scope){
    const canonical=await fs.realpath(file.path);
    const relative=path.relative(scope,canonical);
    if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('候选文件不在当前分析目录中');
    const norm=value=>process.platform==='win32'?value.toLowerCase():value;
    if(norm(path.resolve(canonical))!==norm(path.resolve(file.path)))throw new Error('路径已变化或包含链接，请重新分析');
    const stat=await fs.lstat(canonical);
    if(!sameSnapshot(stat,file)||!cleanupPolicy(canonical,stat).eligible)throw new Error('文件已变化或不再满足清理条件，请重新分析');
    return canonical;
  }
  return {
    cancel(){controller?.abort();controller=null;},
    async analyze(input){
      const scope=await validateScope(input),scan=getScan(scope);
      if(!scan?.complete)throw new Error('请等待此文件夹扫描完成后再分析');
      const config=await getConfig();if(!config)throw new Error('请先在 API 设置中保存 DeepSeek 密钥');
      const files=[];
      // Cached suggestions are never trusted as current filesystem state.
      for(const file of scan.cleanupCandidates||[]){try{await validateFile(file,scope);const stat=await fs.lstat(file.path);const rule=cleanupPolicy(file.path,stat);files.push({...file,ageDays:rule.ageDays});}catch{}}
      controller?.abort();const active=new AbortController();controller=active;
      const timeout=setTimeout(()=>active.abort(),90000);
      let decisions;
      try{decisions=await analyzer(config,files,{signal:active.signal});if(active.signal.aborted)throw new Error('分析已取消');}
      catch(error){if(active.signal.aborted)throw new Error('分析已取消或超时，请重试');throw error;}
      finally{clearTimeout(timeout);if(controller===active)controller=null;}
      const id=randomUUID();reports.set(id,{scope,files:new Map(decisions.map(file=>[file.id,file])),created:Date.now()});
      while(reports.size>8)reports.delete(reports.keys().next().value);
      return {id,scope,provider:'DeepSeek',model:config.model,checkedFiles:scan.files,basedOnCachedScan:!!scan.fromCache,scannedAt:scan.scannedAt,skipped:scan.skipped,screenedCandidates:scan.cleanupCandidateCount||0,limited:(scan.cleanupCandidateCount||0)>(scan.cleanupCandidates?.length||0),
        results:decisions.map(file=>({id:file.id,relativePath:file.relativePath,ownerId:file.ownerId,bytes:file.bytes,status:file.status,reason:file.reason,confidence:file.confidence}))};
    },
    async trash(reportId,ids){
      if(trashing)throw new Error('正在处理上一批文件，请稍候');
      const report=reports.get(reportId);
      if(!report||Date.now()-report.created>30*60*1000)throw new Error('分析结果已过期，请重新分析');
      if(!Array.isArray(ids)||!ids.length||ids.length>160||new Set(ids).size!==ids.length)throw new Error('请选择要清理的项目');
      const files=ids.map(id=>report.files.get(id));
      if(files.some(file=>!file||file.status!=='candidate'))throw new Error('只能清理已标记的候选文件');
      trashing=true;
      try{
        await validateScope(report.scope);
        for(const file of files)await validateFile(file,report.scope);
        const accepted=await confirmTrash(files.map(file=>({name:path.basename(file.path),relativePath:file.relativePath,bytes:file.bytes})));
        if(!accepted)return {cancelled:true,removed:[],failed:[]};
        const removed=[],failed=[];
        for(const file of files){
          try{const target=await validateFile(file,report.scope);await trashItem(target);report.files.delete(file.id);removed.push(file.id);}
          catch{failed.push({id:file.id,message:'文件可能被占用、已变化或无访问权限，未清理'});}
        }
        if(removed.length){await onChanged(report.scope);reports.delete(reportId);}
        return {cancelled:false,removed,failed};
      }finally{trashing=false;}
    }
  };
}
module.exports={createCleanupService};
