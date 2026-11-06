const fs=require('node:fs/promises');
const path=require('node:path');
const {validateConfig}=require('./ai-client.cjs');
function createSettings(app,safeStorage){
  const filename=path.join(app.getPath('userData'),'deepseek-config.bin');let current=null;
  return {
    async load(){
      if(current)return current;
      try{const encrypted=await fs.readFile(filename);current=validateConfig(JSON.parse(safeStorage.decryptString(encrypted)));return current;}catch{return null;}
    },
    async public(){const value=await this.load();return {configured:!!value,provider:'DeepSeek',model:value?.model||'deepseek-flash',encryptedStorage:safeStorage.isEncryptionAvailable()};},
    async save(input){
      const prior=await this.load();
      const value=validateConfig({model:input?.model||'deepseek-flash',apiKey:input?.apiKey||prior?.apiKey});
      if(input?.persist!==false){
        if(!safeStorage.isEncryptionAvailable())throw new Error('系统加密服务不可用，请选择仅本次使用');
        await fs.mkdir(path.dirname(filename),{recursive:true});
        await fs.writeFile(filename,safeStorage.encryptString(JSON.stringify(value)),{mode:0o600});
      }
      current=value;return this.public();
    }
  };
}
module.exports={createSettings};
