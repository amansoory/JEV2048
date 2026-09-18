import {execFileSync} from 'node:child_process';import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';import {journal} from './core.mjs';
const root=mkdtempSync('artifacts/study-integration-'),args=['--import','./study/mock-provider.mjs','study/run.mjs','--seeds','1','--concurrency','6','--phase','tuning','--out',root,'--rpm','100000','--tps','1000000000'];
execFileSync(process.execPath,args,{env:{...process.env,STUDY_TEST_INTERRUPT:'1'},stdio:'pipe'});
const before=journal(root+'/results.jsonl');assert.ok(before.some(r=>r.terminal_status==='interrupted'));
execFileSync(process.execPath,[...args,'--resume'],{stdio:'pipe'});
const results=JSON.parse(readFileSync(root+'/statistics.json'));assert.equal(results.incomplete.length,0);assert.ok(results.aggregate.every(r=>r.n===1));
const completed=readFileSync(root+'/results.jsonl','utf8');execFileSync(process.execPath,[...args,'--resume'],{stdio:'pipe'});assert.equal(readFileSync(root+'/results.jsonl','utf8'),completed);
const manifest=JSON.parse(readFileSync(root+'/manifest.json'));manifest.hashes['decision-policies.js']='changed';writeFileSync(root+'/manifest.json',JSON.stringify(manifest));assert.throws(()=>execFileSync(process.execPath,[...args,'--resume'],{stdio:'pipe'}));
console.log(JSON.stringify({root,interruption:true,resume:true,completeGames:6,skipCompleted:true,rejectChangedPolicy:true,provider:'mock, no paid calls'}));
