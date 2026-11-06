const { chromium, _electron } = require(process.env.STONE_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
process.env.PLAYWRIGHT_SCREENSHOT_NO_FONTS_READY = '1';
const root=path.resolve(__dirname,'..');
async function clickStone(page,name,double=false) {
  const stone=page.locator(`.pebble[data-name="${name}"]`);
  await stone.waitFor({state:'attached'});
  const point=await stone.locator('text').evaluate(el=>{
    const p=el.ownerSVGElement.createSVGPoint();p.x=Number(el.getAttribute('x'));p.y=Number(el.getAttribute('y'));const screen=p.matrixTransform(el.ownerSVGElement.getScreenCTM());return {x:screen.x,y:screen.y};
  });
  if(double)await page.mouse.dblclick(point.x,point.y);else await page.mouse.click(point.x,point.y);
}
async function main(){
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try {
    const page=await browser.newPage({viewport:{width:1586,height:992}});const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:5186');
    await page.locator('.pebble[data-name="Users"]').waitFor({state:'attached'});
    await clickStone(page,'Users');
    assert.equal(await page.locator('.folder-heading h2').innerText(),'Users');
    const light=page.locator('.pebble[data-name="Users"] .mouse-light');
    const before=await light.getAttribute('cx');
    const rect=await page.locator('.pebble[data-name="Users"] text').boundingBox();
    await page.mouse.move(rect.x+rect.width/2+18,rect.y+rect.height/2+25);
    assert.notEqual(await light.getAttribute('cx'),before,'spotlight follows mouse');
    const orbit=page.locator('.orbit-line');
    const offset=await orbit.evaluate(el=>getComputedStyle(el).strokeDashoffset);
    await page.waitForTimeout(150);
    assert.notEqual(await orbit.evaluate(el=>getComputedStyle(el).strokeDashoffset),offset,'border actually animates');
    await page.screenshot({path:path.join(root,'docs/desktop-preview.png')});
    await page.getByRole('textbox',{name:'搜索文件夹'}).fill('not-a-folder');
    await page.locator('.no-results').waitFor();
    await page.getByRole('button',{name:'清除搜索'}).click();
    await clickStone(page,'Users',true);
    await page.locator('.pebble[data-name="Documents"]').waitFor({state:'attached'});
    assert.equal(await page.locator('.pebble').count(),4);
    await page.getByRole('button',{name:'返回上一级'}).click();
    await page.locator('.pebble[data-name="Users"]').waitFor({state:'attached'});
    await page.getByRole('button',{name:/D: 工作盘/}).click();
    await page.locator('.pebble[data-name="工作项目"]').waitFor({state:'attached'});
    assert.match(await page.locator('.disk-heading').innerText(),/D:/);
    await page.getByRole('button',{name:/C: 系统盘/}).click();
    await page.locator('.pebble[data-name="Users"]').waitFor({state:'attached'});
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(500);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no mobile horizontal overflow');
    await page.screenshot({path:path.join(root,'docs/mobile-preview.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('WEB PASS: pointer selection, folder drill-down/back, search/clear, drive switch, animated border, mouse spotlight, 1586×992 and 390×844, zero page errors.');
  } finally {await browser.close();}
  if(process.argv.includes('--desktop')){
    const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'shijian-e2e-'));
    let app;
    try {
      await fs.mkdir(path.join(fixture,'测试文件夹'));
      await fs.writeFile(path.join(fixture,'测试文件夹','data.bin'),Buffer.alloc(12345));
      await fs.writeFile(path.join(fixture,'root.txt'),Buffer.alloc(55));
      app=await _electron.launch({executablePath:process.env.STONE_EXECUTABLE||path.join(root,'node_modules/electron/dist/electron.exe'),args:[...(process.env.STONE_EXECUTABLE?[]:[root]),`--fixture-root=${fixture}`],timeout:60000});
      const window=await app.firstWindow();
      await window.locator('.pebble[data-name="测试文件夹"]').waitFor({state:'attached',timeout:30000});
      await window.waitForFunction(()=>!document.querySelector('.scan-status'));
      const bridge=await window.evaluate(async()=>({desktop:!!window.stoneDesktop,drives:await window.stoneDesktop.drives()}));
      assert.equal(bridge.desktop,true);assert.equal(bridge.drives[0].id,'T:');
      const boundary=await window.evaluate(async()=>{try{await window.stoneDesktop.scan('C:\\','invalid-path');return false;}catch{return true;}});
      assert.equal(boundary,true,'IPC rejects paths outside authorized roots');
      await clickStone(window,'测试文件夹');
      assert.match(await window.locator('.folder-size').innerText(),/12.1 KB/);
      await clickStone(window,'测试文件夹',true);
      await window.locator('.pebble[data-name="data.bin"]').waitFor({state:'attached'});
      await window.screenshot({path:path.join(root,'docs/desktop-live-test.png')});
      console.log('DESKTOP PASS: isolated preload bridge, actual worker filesystem scan, exact folder bytes, real folder drill-down, IPC path boundary.');
    } finally {if(app)await app.close();await fs.rm(fixture,{recursive:true,force:true});}
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
