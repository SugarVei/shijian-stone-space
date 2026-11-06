const fs = require('node:fs/promises');
const path = require('node:path');
const {cleanupPolicy}=require('./cleanup-policy.cjs');

function category(name) {
  if (/^(windows|system|recovery|\$)/i.test(name)) return 'system';
  if (/programdata|cache|logs|temp|appdata/i.test(name)) return 'data';
  if (/program files|games|steam|apps|software|软件/i.test(name)) return 'apps';
  if (/users|documents|pictures|downloads|desktop|文档|照片|下载|工作|项目/i.test(name)) return 'user';
  return 'other';
}

// Logical file bytes. Junctions/symlinks are never followed; unreadable entries are reported.
async function scanDirectory(root, { onProgress = () => {}, signal } = {}) {
  const resolved = path.resolve(root);
  const rootStat = await fs.lstat(resolved);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('请选择普通文件夹');
  let files = 0, skipped = 0, links = 0, total = 0, last = 0;
  const children = [];
  const cleanupCandidates=[];let cleanupCandidateCount=0;
  function recordCandidate(full,stat,owner){
    const policy=cleanupPolicy(full,stat);
    if(!policy.eligible)return;
    cleanupCandidateCount++;owner.cleanupCandidateCount=(owner.cleanupCandidateCount||0)+1;
    if(cleanupCandidates.length<160)cleanupCandidates.push({path:full,relativePath:path.relative(resolved,full),ownerId:owner.id,bytes:stat.size,mtimeMs:stat.mtimeMs,ino:String(stat.ino),dev:String(stat.dev),ageDays:policy.ageDays,localReason:policy.reason});
  }
  const check = () => { if (signal?.aborted) throw new Error('SCAN_CANCELLED'); };
  function snapshot(complete = false) {
    return { path: resolved, name: path.basename(resolved) || resolved, bytes: total, files, skipped, links, complete,
      children: children.map(item => ({ ...item })).sort((a, b) => b.bytes - a.bytes),cleanupCandidates:complete?cleanupCandidates:[],cleanupCandidateCount };
  }
  function publish(force = false) {
    if (force || Date.now() - last > 650) { last = Date.now(); onProgress(snapshot()); }
  }
  async function walk(folder, owner) {
    check();
    let entries;
    try { entries = await fs.readdir(folder,{withFileTypes:true}); } catch { skipped++; return; }
    const filesInFolder=entries.filter(entry=>entry.isFile());
    for(let start=0;start<filesInFolder.length;start+=12){
      check();
      await Promise.all(filesInFolder.slice(start,start+12).map(async entry=>{
        const full=path.join(folder,entry.name);
        try{const stat=await fs.lstat(full);if(stat.isSymbolicLink()){links++;return;}owner.bytes+=stat.size;total+=stat.size;owner.files++;files++;recordCandidate(full,stat,owner);}catch{skipped++;}
      }));publish();
    }
    for(const entry of entries){check();if(entry.isSymbolicLink()){links++;continue;}if(entry.isDirectory())await walk(path.join(folder,entry.name),owner);}
  }
  const entries = await fs.readdir(resolved, { withFileTypes: true });
  const tasks = [];
  for (const entry of entries) {
    check();
    if (entry.isSymbolicLink()) { links++; continue; }
    const full = path.join(resolved, entry.name);
    const item = { id: full, path: full, name: entry.name, kind: entry.isDirectory() ? 'directory' : 'file', category: category(entry.name), bytes: 0, files: 0 };
    if (entry.isDirectory()) { try{item.mtimeMs=(await fs.lstat(full)).mtimeMs;}catch{}children.push(item); tasks.push(() => walk(full, item)); }
    else if (entry.isFile()) {
      try { const stat = await fs.lstat(full); item.bytes = stat.size; item.files = 1; item.mtimeMs=stat.mtimeMs;total += stat.size; files++; children.push(item);recordCandidate(full,stat,item); } catch { skipped++; }
    }
  }
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, tasks.length) }, async () => {
    while (next < tasks.length) { check(); await tasks[next++](); publish(); }
  }));
  check();
  return {...snapshot(true),rootMtimeMs:rootStat.mtimeMs,scannedAt:Date.now()};
}
module.exports = { scanDirectory, category };
