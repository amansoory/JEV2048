import {AsyncLocalStorage} from 'node:async_hooks';
const spans=new AsyncLocalStorage<{jev_http_wait_ms?:number}>();
export async function timedJevFetch(input:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1]){const t=performance.now();try{return await globalThis.fetch(input,init);}finally{const span=spans.getStore();if(span)span.jev_http_wait_ms=performance.now()-t;}}
export async function measureJev<T>(run:()=>Promise<T>){const span:{jev_http_wait_ms?:number}={};const result=await spans.run(span,run);return {result,span};}
