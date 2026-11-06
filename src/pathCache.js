export const pathKey=value=>typeof value==='string'?value.replace(/\//g,'\\').replace(/[\\]+$/,'').toLowerCase():value;
// Windows paths remain the same cache key when realpath changes drive/directory casing.
export class PathCache extends Map{
  set(key,value){return super.set(pathKey(key),value);}
  get(key){return super.get(pathKey(key));}
  has(key){return super.has(pathKey(key));}
  delete(key){return super.delete(pathKey(key));}
}
