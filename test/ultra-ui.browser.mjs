import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {newGame,move,legalMoves} from '../public/engine.js';
const browser=await chromium.launch({channel:'msedge',headless:true}),pending=[];
const wait=async f=>{for(let n=0;n<150;n++){if(await f())return;await new Promise(r=>setTimeout(r,40));}throw Error('Ultra fixture timeout');};
try{const page=await browser.newPage({viewport:{width:1440,height:900}});let calls=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/status',r=>r.fulfill({json:{native:true,ultraLocal:true,ready:true,verified:true,protected:false}}));
await page.route('**/api/decision',r=>r.abort());await page.route('**/api/ntuple',r=>r.abort());
await page.route('**/api/local-batch',async r=>{calls++;pending.push(r);});
await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:2048')+'/play',{waitUntil:'networkidle'});
await page.getByRole('tab',{name:'Watch the bots',exact:true}).click();
await page.locator('.policy-picker label').filter({hasText:'Jev + both experts'}).locator('input').uncheck();
assert.equal(await page.locator('.lab-player').count(),2);await page.getByLabel('Speed',{exact:true}).selectOption('ultra');await page.locator('#run').click();await wait(()=>pending.length===2);assert.equal(calls,2);
for(const route of pending.splice(0)){const input=route.request().postDataJSON();assert.equal(input.moves,0);const g=newGame(input.seed);assert.deepEqual(g.board,input.board);const records=[];for(let i=0;i<3;i++){const direction=legalMoves(g.board)[0];move(g,direction);records.push({direction,ms:.01,model:'Offline Ultra UI fixture'});}const final={board:g.board,score:g.score,moves:g.moves,highest:Math.max(...g.board)};await route.fulfill({json:{session:input.session,generation:input.generation,sequence:input.sequence,records,snapshots:[final],final,elapsedMs:1,computeMs:.03,finished:false}});}
await wait(async()=>await page.getByTestId('search-moves').textContent()==='3'&&await page.getByTestId('ntuple-moves').textContent()==='3');await page.locator('#run').click();assert.equal(await page.locator('#run').innerText(),'Run');const count=calls;await page.waitForTimeout(250);assert.equal(calls,count);await page.locator('#restart').click();assert.equal(await page.getByTestId('search-moves').textContent(),'0');assert.equal(await page.getByTestId('ntuple-moves').textContent(),'0');
for(const route of pending.splice(0))await route.abort().catch(()=>{});
assert.deepEqual(errors,[]);console.log('PASS: local-only Ultra selection, two independent fixture batches, Pause and Restart. No provider calls or complete games.');
}finally{await browser.close();}
