import type {PolicyId} from '@/public/policy-catalog';
export const PLAY_BOTS=[
 {id:'blind-board',name:'Jev',description:'Board and rules'},
 {id:'blind-feature',name:'Jev + board analysis',description:'Calculated board features'},
 {id:'blind-expectimax',name:'Jev + expectimax',description:'Search results'},
 {id:'blind-ntuple',name:'Jev + n-tuple',description:'Learned board values'},
 {id:'blind-dual',name:'Jev + both experts',description:'Expectimax search and n-tuple values'},
 {id:'search',name:'Expectimax',description:'Runs locally'},
 {id:'ntuple',name:'N-tuple',description:'Pretrained 2048 bot'},
] as const satisfies readonly {id:PolicyId;name:string;description:string}[];
export const PLAY_OPPONENTS=PLAY_BOTS.filter(b=>['blind-board','blind-feature','blind-dual'].includes(b.id));
export const WATCH_PRESETS={inputs:{name:'Compare Jev inputs',bots:['blind-board','blind-feature','blind-expectimax','blind-ntuple','blind-dual']},specialists:{name:'Compare specialists',bots:['search','ntuple','blind-dual']}} as const;
export type WatchPreset=keyof typeof WATCH_PRESETS|'custom';
export const botName=(id:string)=>PLAY_BOTS.find(b=>b.id===id)?.name??(id==='human'?'You':id);
export const statusText=(status:string)=>({'ready':'Ready','running':'Running','paused':'Paused','game over':'Game over','reached 2048':'Reached 2048','waiting for Jev':'Waiting for Jev','retrying':'Retrying request','waiting for N-tuple':'Loading n-tuple','model loading':'Loading n-tuple','service waking':'N-tuple service is waking up','timeout':'Request timed out. Try again.','rate limited':'Too many requests. Try again shortly.','unavailable':'Service unavailable. Try again.','quota reached':'Daily Jev limit reached','API failure':'Request failed','policy failure':'Request failed'} as Record<string,string>)[status]??status;

export const botColor=(id:string)=>({'blind-board':'#c34d28','blind-feature':'#ad285a','blind-expectimax':'#395eb2','blind-ntuple':'#237541','blind-dual':'#a54116',search:'#7746b5',ntuple:'#087c79',human:'#564265'} as Record<string,string>)[id]??'#564265';
