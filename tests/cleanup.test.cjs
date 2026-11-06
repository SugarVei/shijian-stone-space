const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {scanDirectory}=require('../electron/scanner.cjs');
const {cleanupPolicy}=require('../electron/cleanup-policy.cjs');
const {parseDecisions,analyzeCandidates,publicMetadata}=require('../electron/ai-client.cjs');
const {createCleanupService}=require('../electron/cleanup-service.cjs');
const old=Date.now()-15*86400000;
test('policy rejects system files, credentials, documents, recent files, links and entire directories',()=>{
  const stat={mtimeMs:old,nlink:1,isDirectory:()=>false,isSymbolicLink:()=>false};
  for(const file of ['C:\\Windows\\old.log','C:\\ProgramData\\backup.tmp','C:\\Users\\a\\.ssh\\old.tmp','C:\\Users\\a\\.env','D:\\工作\\report.docx','D:\\code.js'])assert.equal(cleanupPolicy(file,stat).eligible,false,file);
  assert.equal(cleanupPolicy('D:\\Cache\\old.tmp',stat).eligible,true);
  assert.equal(cleanupPolicy('D:\\Cache\\new.tmp',{...stat,mtimeMs:Date.now()}).eligible,false);
  assert.equal(cleanupPolicy('D:\\Cache\\link.tmp',{...stat,nlink:2}).eligible,false);
  assert.equal(cleanupPolicy('D:\\Cache\\folder.tmp',{...stat,isDirectory:()=>true}).eligible,false);
});
test('untrusted model output cannot invent paths or make low-confidence items deletable',async()=>{
  const files=[{relativePath:'Users/alice/Cache/old.tmp',bytes:10}];
  const result=parseDecisions(JSON.stringify({results:[{id:'f999',recommendation:'candidate',confidence:1,reason:'bad'},{id:'f0',recommendation:'candidate',confidence:.3,reason:'maybe'}]}),files);
  assert.equal(result.length,1);assert.equal(result[0].status,'review');
  assert.equal(publicMetadata(files)[0].relativePath,'Users/<用户>/Cache/old.tmp');
  assert.equal(parseDecisions('{"results":[]}',files)[0].status,'keep');
  await assert.rejects(analyzeCandidates({apiKey:'test-only',model:'deepseek-flash'},files,{fetchImpl:async()=>({ok:false,status:401})}),/密钥无效/);
  let body;
  const successful=await analyzeCandidates({apiKey:'test-only',model:'deepseek-flash'},files,{fetchImpl:async(url,options)=>{assert.equal(url,'https://api.deepseek.com/chat/completions');body=JSON.parse(options.body);return{ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'{"results":[{"id":"f0","recommendation":"candidate","confidence":0.95,"reason":"旧临时文件，请确认不用"}]}'}}]})};}});
  assert.equal(successful[0].status,'candidate');assert.equal(body.response_format.type,'json_object');assert.equal(JSON.stringify(body).includes('test-only'),false);
});
test('only manually confirmed unchanged analyzed files can be recycled; cancel and stale snapshots preserve files',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'shijian-cleanup-'));
  try{
    const file=path.join(root,'old.tmp'),safe=path.join(root,'important.docx');
    await fs.writeFile(file,Buffer.alloc(123));await fs.utimes(file,new Date(old),new Date(old));await fs.writeFile(safe,'keep');
    let scan=await scanDirectory(root),accept=false,trashCalls=0;
    assert.equal(scan.cleanupCandidates.length,1);assert.equal(scan.cleanupCandidates[0].bytes,123);
    const service=createCleanupService({getScan:()=>scan,getConfig:async()=>({apiKey:'fake',model:'deepseek-flash'}),validateScope:async()=>root,confirmTrash:async()=>accept,trashItem:async target=>{trashCalls++;await fs.rename(target,path.join(root,'recycled-test-file'));},onChanged:()=>{},analyzer:async(_config,files)=>files.map((item,index)=>({...item,id:`f${index}`,status:'candidate',confidence:1,reason:'test'}))});
    const report=await service.analyze(root);
    await assert.rejects(service.trash(report.id,['C:\\Windows\\file']),/只能清理/);
    const cancelled=await service.trash(report.id,['f0']);assert.equal(cancelled.cancelled,true);assert.equal(trashCalls,0);
    accept=true;await fs.appendFile(file,'changed');
    await assert.rejects(service.trash(report.id,['f0']),/文件已变化/);assert.equal(trashCalls,0);
    const stale=await service.analyze(root);assert.equal(stale.results.length,0,'changed cached candidates are not sent to AI');
    scan=await scanDirectory(root);assert.equal(scan.cleanupCandidates.length,0,'changed temp is recent');
    await fs.utimes(file,new Date(old),new Date(old));scan=await scanDirectory(root);
    const narrower=createCleanupService({getScan:()=>scan,getConfig:async()=>({apiKey:'fake',model:'deepseek-flash'}),validateScope:async()=>path.join(root,'subfolder'),confirmTrash:async()=>true,trashItem:async()=>{throw new Error('must not run');},onChanged:()=>{},analyzer:async(_config,files)=>{assert.equal(files.length,0,'unchanged cached files outside scope are excluded');return [];}});
    await narrower.analyze(path.join(root,'subfolder'));
    const fresh=await service.analyze(root);const result=await service.trash(fresh.id,['f0']);
    assert.deepEqual(result.removed,['f0']);assert.equal(trashCalls,1);assert.equal(await fs.readFile(safe,'utf8'),'keep');
    await assert.rejects(service.trash(fresh.id,['f0']),/已过期/);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
