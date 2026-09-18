import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});let calls=0;
 await page.route(/\/api\/(decision|ntuple|local-batch)/,r=>{calls++;return r.abort()});
 await page.goto('http://127.0.0.1:2048/play',{waitUntil:'networkidle'});
 await page.getByRole('tab',{name:'Watch the bots',exact:true}).click();
 assert.equal(await page.locator('.policy-picker input').count(),7);
 await page.getByRole('combobox',{name:'Choose bots',exact:true}).selectOption('inputs');
 for(const width of [1440,1280]){
  await page.setViewportSize({width,height:800});
  const boxes=await page.locator('.lab-board-wrap').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}}));
  assert.equal(boxes.length,5);assert.ok(boxes.every(b=>b.bottom<800&&b.left>=0&&b.right<=width));assert.ok(boxes.every(b=>Math.abs(b.top-boxes[0].top)<2));
  console.log(width,boxes);
 }
 await page.screenshot({path:'artifacts/comparison-five-desktop.png',fullPage:true});
 await page.locator('.policy-picker input').first().uncheck();assert.equal(await page.locator('.lab-player').count(),4);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'artifacts/comparison-mobile.png',fullPage:true});
 await page.goto('http://127.0.0.1:2048/research',{waitUntil:'networkidle'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'artifacts/research-restyled-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:900});await page.locator('#attribution').scrollIntoViewIfNeeded();await page.waitForTimeout(650);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(650);
 await page.screenshot({path:'artifacts/research-restyled-desktop.png',fullPage:true});
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');assert.equal(calls,0);
 console.log('PASS: five boards fit, direct selection, mobile width, research, reduced motion; no inference calls');
}finally{await browser.close()}

