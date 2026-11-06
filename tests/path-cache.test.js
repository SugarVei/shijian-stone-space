import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PathCache} from '../src/pathCache.js';
test('Windows cache hits survive realpath casing, slash spelling and trailing separators',()=>{
  const cache=new PathCache(),value={bytes:123};cache.set('C:\\temp\\Folder',value);
  assert.equal(cache.get('C:\\Temp\\Folder'),value);assert.equal(cache.get('c:/TEMP/folder/'),value);
  cache.set('D:\\',value);assert.equal(cache.get('d:'),value);
  cache.delete('C:/TEMP/Folder');assert.equal(cache.has('C:\\temp\\Folder'),false);
});
