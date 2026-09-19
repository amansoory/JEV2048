import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {Redis} from '@upstash/redis';
import {acquire,turnstileConfigured,redisConfigured,makeSession} from '../lib/protection';
import {GET} from '../app/api/status/route';
import {POST} from '../app/api/session/route';
test('optional public protection preserves locks, limits and configured providers',async()=>{
 const names=['VERCEL','TYPESAFE_API_KEY','SESSION_SECRET','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','TURNSTILE_SECRET_KEY','NEXT_PUBLIC_TURNSTILE_SITE_KEY','PUBLIC_DAILY_JEV_CALLS'];
 const saved=names.map(n=>process.env[n]),fromEnv=Redis.fromEnv;
 const req=(ip='192.0.2.1',cookie?:string)=>new NextRequest('https://example.com/api/decision',{headers:{host:'example.com',origin:'https://example.com','x-vercel-forwarded-for':ip,...(cookie?{cookie:'jev-session='+cookie}:{})}});
 try{
  names.forEach(n=>delete process.env[n]);process.env.VERCEL='1';process.env.TYPESAFE_API_KEY='fixture';process.env.SESSION_SECRET='fixture-session-secret';
  assert.equal(turnstileConfigured(),false);assert.equal(redisConfigured(),false);
  const status=await (await GET(req())).json();assert.equal(status.ready,true);assert.equal(status.verified,true);
  assert.equal((await POST(req())).status,200);
  const first=await acquire(req(),'first');assert.equal(first.error,undefined);
  assert.equal((await acquire(req(),'first')).code,'rate_limit');assert.equal((await acquire(req(),'other')).code,'rate_limit');
  await first.release();const next=await acquire(req(),'first');assert.equal(next.error,undefined);await next.release();
  const locks=[];for(let i=0;i<8;i++){const lock=await acquire(req('192.0.2.'+(i+10)),'capacity','native');assert.equal(lock.error,undefined);locks.push(lock);}
  assert.equal((await acquire(req('192.0.2.99'),'capacity','native')).code,'rate_limit');for(const lock of locks)await lock.release();
  process.env.PUBLIC_DAILY_JEV_CALLS='0';assert.equal((await acquire(req(),'quota')).code,'quota_exhausted');delete process.env.PUBLIC_DAILY_JEV_CALLS;
  process.env.TURNSTILE_SECRET_KEY='fixture';process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY='fixture';
  assert.equal((await acquire(req(),'verify')).code,'verification_required');
  assert.equal((await (await GET(req())).json()).verified,false);
  const verified=await acquire(req('192.0.2.1',makeSession()),'verify');assert.equal(verified.error,undefined);await verified.release();
  delete process.env.TURNSTILE_SECRET_KEY;delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  process.env.UPSTASH_REDIS_REST_URL='https://fixture.invalid';process.env.UPSTASH_REDIS_REST_TOKEN='fixture';
  let calls=0;Redis.fromEnv=(()=>({eval:async()=>{calls++;return 0;}})) as unknown as typeof Redis.fromEnv;
  const shared=await acquire(req(),'redis');assert.equal(shared.error,undefined);await shared.release();assert.equal(calls,2);
  Redis.fromEnv=(()=>({eval:async()=>{throw Error('Redis unavailable');}})) as unknown as typeof Redis.fromEnv;
  await assert.rejects(acquire(req(),'redis-error'),/Redis unavailable/);
 }finally{Redis.fromEnv=fromEnv;names.forEach((n,i)=>{if(saved[i]===undefined)delete process.env[n];else process.env[n]=saved[i];});}
});
