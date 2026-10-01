'use client';
import {useEffect,useState} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'motion/react';
import {ArrowUpRight,ArrowUp,RotateCcw,Shuffle,Copy,Check,Download,Trash2,Trophy} from 'lucide-react';
import {MiniBoard} from './board';
import {terminal,type LabBoard} from '@/lib/match-controller';
import {botName,botColor} from '@/lib/play-options';
import {policyInfo} from '@/public/policy-catalog';
import type {Direction} from '@/public/engine';
const DIRECTIONS:Direction[]=['up','left','down','right'];
const ROTATION:Record<Direction,number>={up:0,right:90,down:180,left:270};
const average=(b:LabBoard)=>b.decisions?b.totalMs/b.decisions:null;
const ms=(value:number|null)=>value===null?'—':value<10?value.toFixed(1)+' ms':Math.round(value).toLocaleString()+' ms';
// Live readout of a bot's latest choice: rotating arrow, preference bars, latency and token cost.
export function DecisionPanel({board,onInspect}:{board:LabBoard;onInspect:()=>void}){
  const last=board.records[0],evidence=last?.evidence as {selected_candidate?:string}|undefined,jev=!!policyInfo(board.policy)?.jev;
  const probs=last?.probabilities,thinking=board.busy&&!terminal(board);
  return <section className="decision-panel" data-state={thinking?'thinking':last?'ready':'idle'} aria-label={botName(board.policy)+' last decision'}>
    <div className="decision-panel-head"><span className="mono-label">Last decision{last?' · move '+last.move:''}</span>{thinking&&<span className="thinking-dots" role="status">{jev?'Jev is choosing':'Computing'}<i/><i/><i/></span>}</div>
    <div className="decision-panel-body">
      <div className="decision-dial" aria-hidden="true"><ArrowUp style={{transform:`rotate(${last?ROTATION[last.direction]:0}deg)`,opacity:last?1:.25}}/></div>
      <div className="decision-bars">{probs?DIRECTIONS.map(d=>{const p=probs[d];const chosen=last?.direction===d;return <div key={d} className={chosen?'chosen':''}><span>{d}</span><i><b style={{width:`${Math.max(0,Math.min(1,p??0))*100}%`}}/></i><em>{p===undefined?'—':Math.round(p*100)+'%'}</em></div>;}):
        <p className="decision-note">{last?<><b className="decision-dir">{last.direction}</b>{jev?'No preference scores returned.':'Deterministic search; no preference scores.'}</>:'Press Run or Step to see a decision.'}</p>}</div>
    </div>
    <dl className="decision-facts">
      <div><dt>Latency</dt><dd>{last?ms(last.ms):'—'}</dd></div>
      <div><dt>Avg</dt><dd>{ms(average(board))}</dd></div>
      {jev&&<div><dt>Tokens</dt><dd>{last?.usage?`${last.usage.input_tokens.toLocaleString()} / ${last.usage.output_tokens.toLocaleString()}`:'—'}</dd></div>}
      {evidence?.selected_candidate&&<div><dt>Candidate</dt><dd>{evidence.selected_candidate}</dd></div>}
    </dl>
    {probs&&<p className="decision-caveat">Preference among candidates, not win odds.</p>}
    <button className="lab-last-choice" onClick={onInspect}><span>Full evidence, boards and timing</span><span>Inspect <ArrowUpRight size={14}/></span></button>
  </section>;
}
// Match-wide numbers shown live while a run is in progress.
export function MatchTelemetry({boards,mode}:{boards:LabBoard[];mode:'play'|'compare'}){
  const sum=(f:(b:LabBoard)=>number)=>boards.reduce((s,b)=>s+f(b),0);
  const decisions=sum(b=>b.decisions),avg=decisions?sum(b=>b.totalMs)/decisions:null,tokens=sum(b=>b.input+b.output);
  const ranked=[...boards].sort((a,b)=>b.game.score-a.game.score),lead=ranked.length>1?ranked[0].game.score-ranked[1].game.score:0;
  const stats:[string,string][]=[
    [mode==='play'?'Lead':'Leader',lead?`${botName(ranked[0].policy)} +${lead.toLocaleString()}`:'Tied'],
    ['Moves',sum(b=>b.game.moves).toLocaleString()],
    ['Highest tile',Math.max(...boards.flatMap(b=>b.game.board)).toLocaleString()],
    ['Jev calls',sum(b=>b.calls).toLocaleString()],
    ['Avg decision',ms(avg)],
    ['Tokens',tokens?tokens.toLocaleString():'—'],
    ['Finished',`${boards.filter(terminal).length}/${boards.length}`],
  ];
  return <section className="match-telemetry" aria-label="Live match metrics"><dl>{stats.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><p>Play continues after reaching 2048. Same seed → same opening board and spawn stream.</p></section>;
}
// Compact, sticky view of the opponent so phone players can see the race while playing.
export function RivalDock({board}:{board:LabBoard}){
  const last=board.records[0];
  return <div className="rival-dock" aria-label={botName(board.policy)+' live preview'}>
    <MiniBoard board={board.game.board} label={botName(board.policy)+' board preview'}/>
    <div className="rival-info"><span className="mono-label">Opponent</span><b>{botName(board.policy)}</b><small>{board.busy?'choosing…':last?'last: '+last.direction:'waiting'}</small></div>
    <strong>{board.game.score.toLocaleString()}</strong>
  </div>;
}
export const STACK=['Pinned Jev classifier','Anonymized candidates','Expectimax · Web Worker','N-tuple network','Seeded RNG','Next.js 16'];

// Big 3-2-1 over the arena before a fresh You vs Jev match.
export function Countdown({value}:{value:number|null}){
  return <AnimatePresence>{value!==null&&<motion.div key={value} className="countdown" role="status" aria-live="assertive"
    initial={{opacity:0,scale:1.8}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.6}} transition={{type:'spring',stiffness:420,damping:26}}>{value||'Go'}</motion.div>}</AnimatePresence>;
}
// Lightweight CSS confetti: a few dozen particles with randomized drift, no extra dependency.
function Confetti(){
  const reduce=useReducedMotion();const [pieces,setPieces]=useState<{x:number;dx:number;r:number;d:number;delay:number;c:string}[]>([]);
  useEffect(()=>setPieces(Array.from({length:42},(_,i)=>({x:Math.random()*100,dx:(Math.random()-.5)*160,r:Math.random()*720-360,d:.9+Math.random()*.9,delay:Math.random()*.25,c:['#f5c747','#f39a3e','#bd3e2e','#b72b59','#7745b5','#2865ad','#087c79'][i%7]}))),[]);
  if(reduce)return null;
  return <div className="confetti" aria-hidden="true">{pieces.map((p,i)=><i key={i} style={{left:p.x+'%',background:p.c,animationDuration:p.d+'s',animationDelay:p.delay+'s','--dx':p.dx+'px','--r':p.r+'deg'} as React.CSSProperties}/>)}</div>;
}
const tokensOf=(b:LabBoard)=>b.input+b.output;
// End-of-match card: headline, per-board stats, final boards and replay actions.
export function MatchResult({boards,mode,seed,onReplay,onNewSeed}:{boards:LabBoard[];mode:'play'|'compare';seed:string;onReplay:()=>void;onNewSeed:()=>void}){
  const [copied,setCopied]=useState(false);
  const ranked=[...boards].sort((a,b)=>b.game.score-a.game.score),top=ranked[0],margin=ranked.length>1?top.game.score-ranked[1].game.score:0;
  const human=boards.find(b=>b.policy==='human'),humanWon=!!human&&human===top&&margin>0;
  const headline=!margin?'A tie.':mode==='play'?(humanWon?`You beat ${botName(ranked[1].policy)} by ${margin.toLocaleString()}`:`${botName(top.policy)} wins by ${margin.toLocaleString()}`):`${botName(top.policy)} tops the field by ${margin.toLocaleString()}`;
  const summary=`Jev 2048 · seed "${seed}" · `+ranked.map(b=>`${botName(b.policy)} ${b.game.score.toLocaleString()} (max ${Math.max(...b.game.board)}, ${b.game.moves} moves)`).join(' vs ');
  async function copy(){try{await navigator.clipboard.writeText(summary);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch{}}
  return <motion.section className="lab-finish match-result" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{duration:.4,ease:[.2,.7,.2,1]}} aria-label="Match result">
    {(humanWon||boards.some(b=>Math.max(...b.game.board)>=2048))&&<Confetti/>}
    <div className="match-result-head"><span className="mono-label">Match complete · seed <b>{seed}</b></span><h2><Trophy size={22}/>{headline}</h2></div>
    <div className="match-result-grid">
      <div className="result-boards">{ranked.map(b=><figure key={b.id} style={{'--policy-color':botColor(b.policy)} as React.CSSProperties}><MiniBoard board={b.game.board} label={botName(b.policy)+' final board'}/><figcaption>{botName(b.policy)}</figcaption></figure>)}</div>
      <div className="lab-table-scroll"><table><thead><tr><th>Player</th><th>Score</th><th>Highest</th><th>Moves</th><th>Avg decision</th><th>Tokens</th></tr></thead>
        <tbody>{ranked.map((b,i)=><tr key={b.id} className={i===0&&margin?'selected':''}><th>{botName(b.policy)}</th><td>{b.game.score.toLocaleString()}</td><td>{Math.max(...b.game.board).toLocaleString()}</td><td>{b.game.moves}</td><td>{ms(average(b))}</td><td>{tokensOf(b)?tokensOf(b).toLocaleString():'—'}</td></tr>)}</tbody></table></div>
    </div>
    <div className="match-result-actions"><button className="ui-button button-primary" onClick={onReplay}><RotateCcw size={15}/>Replay this seed</button><button className="ui-button button-outline" onClick={onNewSeed}><Shuffle size={15}/>New seed</button><button className="ui-button button-ghost" onClick={copy}>{copied?<Check size={15}/>:<Copy size={15}/>}{copied?'Copied':'Copy result'}</button></div>
  </motion.section>;
}
// Per-browser log of finished runs, exportable as JSON for later analysis.
export type LogEntry={at:string;seed:string;mode:'play'|'compare';results:{policy:string;score:number;highest:number;moves:number;averageMs:number|null;calls:number;tokens:number}[]};
const LOG_KEY='jev-experiment-log';
export function readLog():LogEntry[]{try{return JSON.parse(localStorage.getItem(LOG_KEY)||'[]');}catch{return [];}}
export function appendLog(entry:LogEntry){const next=[entry,...readLog()].slice(0,25);try{localStorage.setItem(LOG_KEY,JSON.stringify(next));}catch{}return next;}
export function entryFrom(boards:LabBoard[],seed:string,mode:'play'|'compare'):LogEntry{return {at:new Date().toISOString(),seed,mode,results:boards.map(b=>({policy:b.policy,score:b.game.score,highest:Math.max(...b.game.board),moves:b.game.moves,averageMs:average(b),calls:b.calls,tokens:tokensOf(b)}))};}
export function ExperimentLog({entries,onClear}:{entries:LogEntry[];onClear:()=>void}){
  const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);
  if(!mounted)return null;
  function exportJson(){const url=URL.createObjectURL(new Blob([JSON.stringify(entries,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='jev-2048-experiment-log.json';a.click();URL.revokeObjectURL(url);}
  return <details className="batch-panel experiment-log"><summary>Experiment log <span>{entries.length} finished run{entries.length===1?'':'s'} · saved in this browser only</span></summary>
    {entries.length?<><div className="lab-table-scroll"><table><thead><tr><th>Finished</th><th>Seed</th><th>Mode</th><th>Results (score · highest · avg decision)</th></tr></thead>
      <tbody>{entries.map((e,i)=><tr key={e.at+i}><th>{new Date(e.at).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</th><td className="mono">{e.seed}</td><td>{e.mode==='play'?'You vs Jev':'Bots'}</td><td className="log-results">{[...e.results].sort((a,b)=>b.score-a.score).map(r=><span key={r.policy} style={{'--policy-color':botColor(r.policy)} as React.CSSProperties}>{botName(r.policy)} <b>{r.score.toLocaleString()}</b> · {r.highest} · {ms(r.averageMs)}</span>)}</td></tr>)}</tbody></table></div>
      <div className="match-result-actions"><button className="ui-button button-outline" onClick={exportJson}><Download size={15}/>Export JSON</button><button className="ui-button button-ghost" onClick={onClear}><Trash2 size={15}/>Clear log</button></div></>:
      <p>Finish a match and it appears here with its seed, scores and decision timing, so runs can be compared and repeated.</p>}
  </details>;
}
