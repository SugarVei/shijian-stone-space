const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../public/disk-heatmap.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const {data,validate}=vm.runInNewContext(script+';({data:JSON.parse(JSON.stringify(DATA)),validate:validateData});',{window:{}});
test('heatmap DATA exactly matches all fifteen supplied figures and all capacity sums',()=>{
  const rows=JSON.parse(JSON.stringify(data.disks));
  assert.deepEqual(rows.map(row=>row.values),[[123,111,63,41.5,17.5],[280,64,160,96,40],[76,58,24,16,6]]);
  assert.deepEqual(rows.map(row=>row.values.reduce((a,b)=>a+b,0)),[356,640,180]);
  assert.deepEqual(rows.map(row=>[row.totalGB,row.usedGB,row.freeGB]),[[512,356,156],[1024,640,384],[512,180,332]]);
  assert.equal(rows.reduce((sum,row)=>sum+row.usedGB,0),1176);assert.equal((rows[0].usedGB/rows[0].totalGB*100).toFixed(1),'69.5');
  assert.equal(validate(data),true);
});
test('invalid category or capacity sums cause an explicit error instead of normalization',()=>{
  const invalid=JSON.parse(JSON.stringify(data));invalid.disks[0].values[0]++;
  assert.throws(()=>validate(invalid),/分类合计.*不等于/);
  const invalidCapacity=JSON.parse(JSON.stringify(data));invalidCapacity.disks[1].freeGB++;
  assert.throws(()=>validate(invalidCapacity),/总容量/);
});
