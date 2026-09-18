import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
const page=await browser.newPage();
await page.route('**/api/decision',async route=>{const p=route.request().postDataJSON();const {legalMoves}=await import('../public/engine.js');const legal=legalMoves(p.board);await route.fulfill({json:{direction:legal[0],probabilities:Object.fromEntries(legal.map(d=>[d,d===legal[0]?1:0])),ms:1,usage:{input_tokens:1,output_tokens:1},attempted:true}});});
await page.goto('http://127.0.0.1:2048');
await page.getByRole('tab',{name:'Compare',exact:true}).click();
await page.getByRole('combobox',{name:'Speed',exact:true}).selectOption('fast');
assert.equal(await page.locator('[data-policy=assisted] .no-motion').count(),1);
assert.equal(await page.locator('[data-policy=raw] .no-motion').count(),0);
assert.equal(await page.locator('[data-policy=search] .no-motion').count(),1);
await page.locator('#run').click();
await page.waitForFunction(()=>Number(document.querySelector('[data-testid=assisted-moves]').textContent)>=5);
await page.waitForFunction(()=>Number(document.querySelector('[data-testid=search-moves]').textContent)>=5);
await page.locator('#run').click();
assert.ok(Number(await page.getByTestId('raw-moves').textContent())>=1);
console.log('Browser passed: speed and animation scoped to assisted Jev; other boards continue. API mocked for pacing check.');
} finally {await browser.close();}
