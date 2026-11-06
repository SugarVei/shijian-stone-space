const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),target=path.join(root,'.desktop-app');
fs.mkdirSync(target,{recursive:true});
function copyFolder(source,destination){
  fs.mkdirSync(destination,{recursive:true});
  for(const entry of fs.readdirSync(source,{withFileTypes:true})){
    const from=path.join(source,entry.name),to=path.join(destination,entry.name);
    if(entry.isDirectory())copyFolder(from,to);else fs.writeFileSync(to,fs.readFileSync(from));
  }
}
for(const name of ['dist','electron'])copyFolder(path.join(root,name),path.join(target,name));
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
fs.writeFileSync(path.join(target,'package.json'),JSON.stringify({name:'shijian-stone-space',productName:'石间',version,description:'石间 · 磁盘空间可视化',author:'Shijian',main:'electron/main.cjs'},null,2));
console.log('Desktop staging ready. Frontend bundled; no runtime npm modules required.');
