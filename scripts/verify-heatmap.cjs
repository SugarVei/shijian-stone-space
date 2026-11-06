const {chromium}=require(process.env.STONE_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const root=path.resolve(__dirname,'..');
const artifactDir=process.env.HEATMAP_ARTIFACT_DIR||path.join(os.tmpdir(),'shijian-heatmap-qa');
process.env.PLAYWRIGHT_SCREENSHOT_NO_FONTS_READY='1';
const URL=process.env.HEATMAP_URL||'http://127.0.0.1:5186';
async function ready(page){await page.goto(URL);await page.getByRole('tab',{name:'3D 热力柱',exact:true}).click();const iframe=await page.locator('.heatmap-frame iframe').elementHandle();await iframe.scrollIntoViewIfNeeded();const frame=await iframe.contentFrame();await frame.waitForFunction(()=>!!window.diskHeatmap||!!window.HEATMAP_LOAD_ERROR,null,{timeout:60000,polling:100}).catch(async error=>{console.error('LOAD DIAGNOSTICS',await frame.evaluate(()=>({url:location.href,title:document.title,valid:window.DATA_VALID,loadError:window.HEATMAP_LOAD_ERROR,status:document.querySelector('#stage-status')?.textContent,rendered:!!window.diskHeatmap,resources:performance.getEntriesByType('resource').map(r=>({name:r.name,duration:r.duration}))})));throw error;});assert.equal(await frame.evaluate(()=>window.HEATMAP_LOAD_ERROR||null),null,'CDN and WebGL must initialize');await settle(frame);return frame;}
async function settle(frame){await frame.waitForFunction(()=>window.diskHeatmap&&!window.diskHeatmap.snapshot().animating);}
const snapshot=frame=>frame.evaluate(()=>window.diskHeatmap.snapshot());
async function clickBar(page,frame,id){const state=await snapshot(frame),bar=state.bars.find(b=>b.id===id),rect=await page.locator('.heatmap-frame iframe').boundingBox();await page.mouse.click(rect.x+bar.screen.x,rect.y+bar.screen.y);await frame.waitForFunction(expected=>window.diskHeatmap.snapshot().selected===expected,id);await settle(frame);return bar;}
async function labelCheck(frame){return frame.evaluate(()=>{
  const stage=document.querySelector('#stage').getBoundingClientRect();const labels=[...document.querySelectorAll('.axis-label')].filter(el=>getComputedStyle(el).visibility!=='hidden').map(el=>({key:el.dataset.labelKey,type:el.classList.contains('disk')?'disk':'category',rect:el.getBoundingClientRect().toJSON()}));
  const overlaps=[];for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i].rect,b=labels[j].rect;if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([labels[i].key,labels[j].key]);}
  return {labels:labels.length,overlaps,overflow:labels.some(item=>item.rect.left<stage.left-1||item.rect.right>stage.right+1||item.rect.top<stage.top-1||item.rect.bottom>stage.bottom+1)};
});}
async function run(){
  await fs.mkdir(artifactDir,{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:1586,height:992}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    const frame=await ready(page);let state=await snapshot(frame);assert.equal(state.bars.length,15);
    assert.equal(await frame.locator('#total-used').innerText(),'1,176');assert.equal(await frame.locator('#fullest-percent').innerText(),'69.5%');assert.equal(await frame.locator('#largest-value').innerText(),'280');
    assert.equal(await page.locator('.drive-card').count(),3);assert.equal(await page.getByRole('textbox',{name:'搜索文件夹'}).count(),1);assert.equal(await page.getByRole('button',{name:'重新扫描',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'全屏预览'}).count(),1);assert.equal(await page.getByRole('button',{name:'进入文件夹',exact:true}).count(),0);
    assert.equal(await page.locator('.pebble-map').isVisible(),false);
    const beforeMetric=state.bars.find(b=>b.id==='C:-user');await frame.locator('#metric-percent').click();await frame.waitForTimeout(130);const middleMetric=await snapshot(frame);assert.equal(middleMetric.animating,true);assert.notEqual(middleMetric.bars.find(b=>b.id==='C:-user').height,beforeMetric.height);await settle(frame);state=await snapshot(frame);assert.equal(state.metric,'percent');assert.notEqual(state.bars.find(b=>b.id==='C:-user').color,beforeMetric.color);assert.ok(state.bars.find(b=>b.id==='C:-user').height>beforeMetric.height);
    const oldCamera=state.camera;await frame.locator('#top-view').click();await frame.waitForTimeout(130);const middleView=await snapshot(frame);assert.equal(middleView.animating,true);assert.notDeepEqual(middleView.camera,oldCamera);await settle(frame);state=await snapshot(frame);assert.ok(Math.abs(state.camera[0]-state.target[0])<.01);assert.ok(Math.abs(state.camera[2]-state.target[2])<.02);
    await frame.locator('#metric-gb').click();await settle(frame);
    for(const bar of state.bars){
      await frame.locator('#top-view').click();await settle(frame);const clicked=await clickBar(page,frame,bar.id);
      assert.equal(await frame.locator('#detail-gb').innerText(),String(clicked.gb));
      assert.equal(await frame.locator('#detail-disk-percent').innerText(),clicked.diskPercent.toFixed(2)+'%');assert.equal(await frame.locator('#detail-total-percent').innerText(),clicked.totalPercent.toFixed(2)+'%');
      assert.equal(await frame.locator('.history').first().innerText(),'—');
      await frame.locator('#reset-view').click();await settle(frame);assert.equal((await snapshot(frame)).view,'perspective');assert.equal((await snapshot(frame)).selected,null);
    }
    await frame.locator('#top-view').click();await settle(frame);state=await snapshot(frame);const hover=state.bars.find(b=>b.id==='D:-user'),iframeRect=await page.locator('.heatmap-frame iframe').boundingBox();await page.mouse.move(iframeRect.x+hover.screen.x,iframeRect.y+hover.screen.y);await frame.locator('#tooltip').waitFor({state:'visible'});assert.match(await frame.locator('#tooltip').innerText(),/280 GB/);
    await frame.locator('#perspective').click();await settle(frame);
    const canvas=await frame.locator('canvas').boundingBox(),cameraBefore=(await snapshot(frame)).camera;await page.mouse.move(canvas.x+canvas.width*.65,canvas.y+canvas.height*.65);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width*.65+100,canvas.y+canvas.height*.65+30,{steps:10});await page.mouse.up();await frame.waitForTimeout(400);assert.notDeepEqual((await snapshot(frame)).camera,cameraBefore,'drag orbits');
    const beforeZoom=await snapshot(frame);await page.mouse.wheel(0,-350);await frame.waitForTimeout(350);assert.notDeepEqual((await snapshot(frame)).camera,beforeZoom.camera,'wheel zooms');
    await frame.locator('#perspective').click();await settle(frame);await page.screenshot({path:path.join(artifactDir,'heatmap-desktop.png')});
    await page.getByRole('textbox',{name:'搜索文件夹'}).fill('不存在的分类');await frame.locator('#no-results').waitFor({state:'visible'});await page.getByRole('button',{name:'清除搜索'}).click();await frame.locator('#no-results').waitFor({state:'hidden'});
    await page.getByRole('button',{name:/D: 工作盘/}).click();await page.waitForFunction(()=>document.querySelector('.disk-heading').textContent.includes('D:'));assert.match(await page.locator('.disk-heading').innerText(),/640 GB/);
    await page.getByRole('button',{name:'AI 清理',exact:true}).click();await page.getByRole('button',{name:'演示分析'}).click();await page.locator('.cleanup-summary').waitFor();await page.getByRole('button',{name:'关闭 AI 清理'}).click();
    await page.close();
    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const phone=await mobile.newPage();phone.on('pageerror',error=>errors.push(error.message));phone.on('console',message=>{if(message.type()==='error')errors.push(message.text());});const phoneFrame=await ready(phone);await phone.locator('.heatmap-frame iframe').scrollIntoViewIfNeeded();
    for(const view of ['#perspective','#top-view']){await phoneFrame.locator(view).click();await settle(phoneFrame);const labels=await labelCheck(phoneFrame);assert.equal(labels.overflow,false,`mobile label overflow ${JSON.stringify(labels)}`);assert.deepEqual(labels.overlaps,[],`mobile label overlap ${JSON.stringify(labels)}`);assert.equal(labels.labels,8);}
    await phone.evaluate(()=>window.scrollTo(0,0));await phone.screenshot({path:path.join(artifactDir,'heatmap-mobile.png'),fullPage:true});assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await phoneFrame.locator('canvas').scrollIntoViewIfNeeded();
    const touchCanvas=await phoneFrame.locator('canvas').boundingBox(),cx=touchCanvas.x+touchCanvas.width/2,cy=touchCanvas.y+touchCanvas.height/2;const cdp=await mobile.newCDPSession(phone),beforePinch=await snapshot(phoneFrame);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:cx-35,y:cy},{id:2,x:cx+35,y:cy}]});for(let i=1;i<=5;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:cx-35-i*6,y:cy},{id:2,x:cx+35+i*6,y:cy}]});await phoneFrame.waitForTimeout(40);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await phoneFrame.waitForTimeout(300);assert.notDeepEqual((await snapshot(phoneFrame)).camera,beforePinch.camera,'two finger pinch changes camera distance');
    await phone.setViewportSize({width:320,height:740});
    for(const view of ['#perspective','#top-view']){await phoneFrame.locator(view).click();await settle(phoneFrame);const labels=await labelCheck(phoneFrame);assert.equal(labels.overflow,false);assert.deepEqual(labels.overlaps,[],'320px labels must remain separate');assert.equal(labels.labels,8);}
    await mobile.close();assert.deepEqual(errors,[]);
    console.log('HEATMAP PASS: all 15 bars raycast-clicked with exact GB and percentages; animated view/metric changes; reset; hover; orbit/wheel/pinch; desktop/mobile; labels nonoverlapping; original shell and AI retained; zero console errors.');
    const invalid=await browser.newPage();const source=await fs.readFile(path.join(root,'public/disk-heatmap.html'),'utf8');await invalid.route('**/invalid-heatmap.html',route=>route.fulfill({contentType:'text/html',body:source.replace('values: [123, 111','values: [124, 111')}));await invalid.goto('http://127.0.0.1:5186/invalid-heatmap.html');assert.match(await invalid.locator('[role=alert]').innerText(),/数据校验失败.*分类合计/);assert.equal(await invalid.locator('canvas').count(),0);await invalid.close();
    console.log('DATA ERROR PASS: an inconsistent disk category sum visibly fails before WebGL is initialized.');
  }finally{await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
