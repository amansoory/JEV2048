import {TypeSafeClient} from '@typesafe-ai/sdk';
import {askJev as baseline} from './jev-baseline.js';
import {revisedRequest} from './policies.js';
import {ACTIVE_POLICY} from './policy-selection.js';
export {apiKey,validateAnswer,usageOf,outcomeFeatures} from './jev-baseline.js';
export async function askJev(board,key,context={}){const policy=context.policy??ACTIVE_POLICY;if(policy==='existing')return baseline(board,key,context);if(!['immediate','lookahead'].includes(policy))throw Error('Unknown policy');const client=new TypeSafeClient({apiKey:key,baseURL:'https://api.typesafe.ai',defaultModel:'jev-latest',retry:{maxRetries:0},timeout:15000,logLevel:'off'});return client.systemOne(revisedRequest(board,context,policy));}
