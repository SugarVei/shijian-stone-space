const {chromium,_electron}=require(process.env.STONE_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
process.env.PLAYWRIGHT_SCREENSHOT_NO_FONTS_READY='1';
const root=path.resolve(__dirname,'..');
async function run(){
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1586,height:992}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:5186');await page.locator('[data-name="Users"]').waitFor({state:'attached'});
    await page.getByRole('button',{name:'AI 清理',exact:true}).click();
    await page.getByRole('button',{name:'API 设置',exact:true}).click();
    assert.equal(await page.locator('input[type=password]').count(),0,'website never collects secrets');
    await page.getByRole('button',{name:'返回预览'}).click();
    await page.getByRole('button',{name:'演示分析'}).click();
    await page.locator('.cleanup-summary').waitFor();
    assert.equal(await page.locator('[data-cleanup-status=candidate]').count(),3);
    assert.equal(await page.locator('.cleanup-result').count(),3);
    assert.equal(await page.locator('.cleanup-result input:checked').count(),0,'nothing preselected');
    assert.equal(await page.getByRole('button',{name:'移入回收站',exact:true}).isDisabled(),true);
    await page.locator('.cleanup-result input').first().check();
    await page.screenshot({path:path.join(root,'.qa/cleanup-desktop.png')});
    await page.getByRole('button',{name:'移入回收站',exact:true}).click();
    await page.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await page.locator('.cleanup-result').count(),3);
    await page.getByRole('button',{name:'移入回收站',exact:true}).click();await page.getByRole('button',{name:'确认演示'}).click();
    await page.locator('.cleanup-message').waitFor();assert.equal(await page.locator('.cleanup-result').count(),2);
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'.qa/cleanup-mobile.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
    console.log('WEB CLEANUP PASS: preview privacy, AI suggestions, three marked stones, unchecked defaults, disabled delete, cancel and confirm, mobile layout, no runtime errors.');
  }finally{await browser.close();}
  const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'shijian-cleanup-ui-'));let app;
  try{
    await fs.mkdir(path.join(fixture,'Cache'));const target=path.join(fixture,'Cache','old.tmp');await fs.writeFile(target,Buffer.alloc(1000));const old=new Date(Date.now()-20*86400000);await fs.utimes(target,old,old);await fs.writeFile(path.join(fixture,'important.docx'),'keep');
    app=await _electron.launch({executablePath:process.env.STONE_EXECUTABLE||path.join(root,'node_modules/electron/dist/electron.exe'),args:[...(process.env.STONE_EXECUTABLE?[]:[root]),`--fixture-root=${fixture}`]});
    await app.evaluate(({dialog})=>{
      globalThis.fetch=async()=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'{"results":[{"id":"f0","recommendation":"candidate","confidence":0.99,"reason":"旧临时文件，确认应用已关闭后清理。"}]}'}}]})});
      dialog.showMessageBox=async()=>({response:0});
    });
    const page=await app.firstWindow();await page.locator('[data-name="Cache"]').waitFor({state:'attached'});await page.waitForFunction(()=>!document.querySelector('.scan-status'));
    await page.getByRole('button',{name:'AI 清理',exact:true}).click();await page.getByRole('button',{name:'开始分析'}).click();
    await page.getByLabel('DeepSeek API Key',{exact:true}).fill('test-fixture-only');await page.getByLabel('加密保存在此电脑').uncheck();await page.getByRole('button',{name:'保存设置'}).click();
    const publicConfig=await page.evaluate(()=>window.stoneDesktop.aiConfig());assert.equal(publicConfig.configured,true);assert.equal(Object.hasOwn(publicConfig,'apiKey'),false);
    await page.getByRole('button',{name:'开始分析'}).click();await page.locator('.cleanup-summary').waitFor();assert.equal(await page.locator('.cleanup-result').count(),1);
    await page.locator('.cleanup-result input').check();await page.getByRole('button',{name:'移入回收站',exact:true}).click();await page.locator('.cleanup-message').waitFor();assert.equal((await fs.stat(target)).size,1000,'native cancellation leaves file unchanged');
    await app.evaluate(({dialog,shell})=>{
      dialog.showMessageBox=async()=>({response:1});
      shell.trashItem=async target=>{const fs=process.getBuiltinModule('fs/promises');await fs.rename(target,target+'.test-recycled');};
    });
    await page.getByRole('button',{name:'移入回收站',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.cleanup-message')?.textContent.includes('已将 1 个文件'));
    assert.equal((await fs.stat(target+'.test-recycled')).size,1000);assert.equal(await fs.readFile(path.join(fixture,'important.docx'),'utf8'),'keep');
    console.log('DESKTOP CLEANUP PASS: real scan -> API settings -> mocked structured response -> marked file -> native cancellation -> confirmation -> recycling adapter. Only owned temporary fixtures used; document preserved.');
  }finally{if(app)await app.close();await fs.rm(fixture,{recursive:true,force:true});await fs.rm(fixture+'-profile',{recursive:true,force:true});}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
