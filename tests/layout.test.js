import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutStones} from '../src/layout.js';
import {demoScan} from '../src/data.js';
test('weighted map covers container with finite reproducible proportional cells',()=>{
  const items=demoScan('C:').children;
  const cells=layoutStones(items,1100,620);
  assert.equal(cells.length,items.length);
  assert.ok(cells.every(c=>c.item.id&&Number.isFinite(c.area)&&c.area>0&&!c.path.includes('NaN')));
  assert.ok(Math.abs(cells.reduce((s,c)=>s+c.area,0)-1100*620)<1);
  const total=items.reduce((s,c)=>s+c.bytes,0);
  const error=cells.reduce((s,c)=>s+Math.abs(c.area/(1100*620)-c.item.bytes/total),0);
  assert.ok(error<.08,`area error ${error}`);
  assert.equal(JSON.stringify(cells),JSON.stringify(layoutStones(items,1100,620)));
});
test('single folder and empty folder',()=>{assert.equal(layoutStones([],100,100).length,0);assert.equal(layoutStones([{id:'x',bytes:5,name:'x'}],100,100)[0].area,10000);});
