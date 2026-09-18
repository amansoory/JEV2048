'use client';
import {useEffect,useRef,useState} from 'react';
import {Gamepad2,BookOpen,ArrowUpRight,Play,Pause,RotateCcw,SkipForward,Sparkles,UserRound,Bot,ArrowUp,ArrowDown,ArrowLeft,ArrowRight,ChevronDown,LoaderCircle,VolumeX} from 'lucide-react';
import {Turnstile} from '@marsidev/react-turnstile';
import {Button} from './ui/button';
import {Tabs,TabsContent,TabsList,TabsTrigger} from './ui/tabs';
import Board,{arrows} from './board';
import ScoreChart from './score-chart';
import HowItWorks from './how-it-works';
import {newGame,move,gameOver,heuristic,legalMoves,type Direction} from '@/public/engine';
import {applyMove,player,updatePlayer,finished} from '@/lib/replay';
import {workerDecision} from '@/lib/search';
import type {Decision,Metrics,Player} from '@/lib/types';

type Mode='versus'|'watch'|'search';
type Speed='step'|'normal'|'fast';
const emptyMetrics=():Metrics=>({calls:0,input:0,output:0,unknown:0,ms:0,timed:0});
function initial(){const left=newGame('first-light'),right=newGame('first-light');return {left,right,leftView:player(left),rightView:player(right),mode:'versus' as Mode,speed:'normal' as Speed,running:false,busy:false,generation:0,match:'',error:'',records:[] as Decision[],metrics:emptyMetrics(),tab:'game',ready:false};}
export default function Arcade(){
  const searchWorker=useRef<Worker|null>(null);
  const state=useRef(initial()),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [,setVersion]=useState(0),[seed,setSeed]=useState('first-light');
  const [status,setStatus]=useState<{configured:boolean;ready:boolean;protected:boolean;verified:boolean}|null>(null);
  const refresh=()=>setVersion(n=>n+1);
  const stepRef=useRef<()=>Promise<void>>(async()=>{});
  const s=state.current;
  function stop(){s.running=false;if(timer.current)clearTimeout(timer.current);refresh();}
  function schedule(){
    if(timer.current)clearTimeout(timer.current);
    if(!s.running||s.busy)return;
    if(s.speed==='step'){stop();return;}
    if(s.speed==='fast'){const next=()=>{if(s.running)void stepRef.current();};if(gameOver(s.right.board))timer.current=setTimeout(next,0);else queueMicrotask(next);}else timer.current=setTimeout(()=>void stepRef.current(),800);
  }
  function reset(mode=s.mode){
    stop();s.generation++;s.match=crypto.randomUUID();s.mode=mode;
    s.left=newGame(seed);s.right=newGame(seed);s.leftView=player(s.left);s.rightView=player(s.right);s.metrics=emptyMetrics();s.error='';s.records=[];refresh();
  }
  function humanMove(direction:Direction){
    if(s.mode!=='versus'||s.tab!=='game')return;
    const record=applyMove(s.left,direction);if(record){s.leftView=updatePlayer(s.leftView,s.left,record);refresh();}
  }
  async function step(){
    if(s.busy||!s.match)return;
    const jevDone=gameOver(s.right.board),otherDone=gameOver(s.left.board);
    if(jevDone&&(s.mode==='versus'||otherDone)){stop();return;}
    if(!jevDone&&!s.ready){s.error='Jev is not ready. Check the connection notice above.';stop();return;}
    s.busy=true;s.error='';const generation=s.generation;refresh();
    try{
      if(!jevDone){
        const response=await fetch('/api/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({board:s.right.board,score:s.right.score,moves:s.right.moves,match:s.match})});
        const result=await response.json();
        if(generation!==s.generation)return;
        if(result.attempted){
          s.metrics.calls++;
          if(result.usage){s.metrics.input+=result.usage.input_tokens;s.metrics.output+=result.usage.output_tokens;}else s.metrics.unknown++;
          if(Number.isFinite(result.ms)){s.metrics.ms+=result.ms;s.metrics.timed++;}
        }
        if(response.status===401)void checkStatus();
        if(!response.ok)throw Error(result.error||'Jev is unavailable. Please retry.');
        if(!legalMoves(s.right.board).includes(result.direction))throw Error('Jev returned an illegal direction. No move was applied.');
        const record=applyMove(s.right,result.direction,{probabilities:result.probabilities,ms:result.ms,model:result.model,policy:result.policy});
        if(record){s.rightView=updatePlayer(s.rightView,s.right,record);s.records=[record,...s.records].slice(0,40);}
      }
      if(s.mode!=='versus'&&!gameOver(s.left.board)){
        const start=performance.now();let direction:Direction|null,ms:number;
        if(s.mode==='search'){if(!searchWorker.current)searchWorker.current=new Worker('/search-worker.js',{type:'module'});const result=await workerDecision(searchWorker.current,s.left.board);if(generation!==s.generation)return;direction=result.direction;ms=result.ms;}else{direction=heuristic(s.left.board);ms=performance.now()-start;}
        if(direction){const record=applyMove(s.left,direction,{ms});if(record)s.leftView=updatePlayer(s.leftView,s.left,record);}
      }
      if(gameOver(s.right.board)&&(s.mode==='versus'||gameOver(s.left.board)))s.running=false;
    }catch(error){if(generation===s.generation){s.error=error instanceof Error?error.message:'Jev could not finish this move. Please retry.';s.running=false;}}
    finally{s.busy=false;refresh();schedule();}
  }
  stepRef.current=step;
  async function checkStatus(){try{const response=await fetch('/api/status');const next=await response.json();setStatus(next);s.ready=next.ready&&next.verified;refresh();}catch{setStatus({configured:false,ready:false,protected:false,verified:false});}}
  useEffect(()=>{
    s.match=crypto.randomUUID();void checkStatus();
    const key=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement;
      if(target.closest('input,select,textarea,[contenteditable=true],[role=tab],[role=tablist]'))return;
      const direction=({ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'} as Record<string,Direction>)[e.key];
      if(direction&&s.mode==='versus'&&s.tab==='game'){e.preventDefault();humanMove(direction);}
    };
    document.addEventListener('keydown',key);
    return ()=>{searchWorker.current?.terminate();searchWorker.current=null;document.removeEventListener('keydown',key);s.generation++;s.running=false;if(timer.current)clearTimeout(timer.current);};
  },[]);
  const leftName=s.mode==='search'?'Search solver':s.mode==='watch'?'Heuristic':'You',last=s.records[0],allDone=finished(s.leftView,s.rightView);
  const botDone=gameOver(s.right.board)&&(s.mode==='versus'||gameOver(s.left.board));
  const connection=status===null?'Connecting':!status.ready?'Jev unavailable':!status.verified?'Human check needed':'Jev ready';
  const stateText=s.error?'Needs a retry':allDone?'Match complete':s.running?'Playing':s.busy?'Finishing move':'Paused';
  function controls(){return <div className="play-controls">
    <Button id="run" disabled={botDone||s.speed==='step'||(!s.ready&&!gameOver(s.right.board))} onClick={()=>{if(s.running)stop();else{s.running=true;void step();refresh();}}}>{s.running?<Pause/>:<Play/>}{s.running?'Pause':'Run'}</Button>
    <Button id="step" variant="outline" disabled={s.busy||s.running||botDone} onClick={()=>void step()}><SkipForward/>Step</Button>
    <label className="speed-control"><span className="sr-only">Speed</span><select aria-label="Speed" value={s.speed} onChange={e=>{s.speed=e.target.value as Speed;if(s.speed==='step')stop();else schedule();refresh();}}><option value="step">Step</option><option value="normal">Normal</option><option value="fast">Fast</option></select><ChevronDown/></label>
    <span className="control-divider"/>
    <Button id="restart" variant="ghost" onClick={()=>reset()}><RotateCcw/><span>Restart</span></Button>
  </div>;}
  return <main className="arcade-shell">
    <Tabs defaultValue="game" value={s.tab} onValueChange={value=>{s.tab=value;refresh();}}>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Jev Arcade home"><span className="brand-icon"><Gamepad2/></span><span>jev<span className="brand-light">arcade</span><sup>2048</sup></span></a>
        <TabsList aria-label="Explore Jev Arcade"><TabsTrigger value="game"><Gamepad2/>Play</TabsTrigger><TabsTrigger value="how"><BookOpen/>How it works</TabsTrigger></TabsList>
        <span className={`connection-badge ${s.ready?'is-ready':''}`} role="status"><i/>{connection}</span>
      </header>
      <TabsContent value="game">
        <section className="game-intro"><div><span className="eyebrow"><span className="tiny-cross">✳</span> A LITTLE GAME OF JUDGMENT</span><h1>Your move. <span>Jev’s move.</span></h1><p>Same starting line. A different way to play.</p></div><span className="intro-stamp">Merge. Think.<br/><b>Go again.</b><ArrowUpRight/></span></section>
        <div className="game-toolbar">
          <div className="mode-switch" role="group" aria-label="Game mode"><button aria-pressed={s.mode==='versus'} onClick={()=>reset('versus')}><UserRound/>You vs Jev</button><button aria-pressed={s.mode==='watch'} onClick={()=>reset('watch')}><Bot/>Jev vs Heuristic</button><button aria-pressed={s.mode==='search'} onClick={()=>reset('search')}><Bot/>Jev vs Search</button></div>
          {controls()}
        </div>
        {status?.protected&&!status.ready&&<div className="notice" role="status">The arcade is open for exploring. Live Jev play is waiting for its shared protection setup.</div>}
        {status?.ready&&!status.verified&&<div className="verification"><p>A quick human check unlocks live Jev play.</p>{process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY&&<Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} options={{action:'arcade',theme:'light'}} onSuccess={async token=>{const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(response.ok)await checkStatus();else{s.error='Human verification failed. Please refresh and retry.';refresh();}}}/>}</div>}
        <div className="arena">
          <section className="player-zone">
            <div className="player-heading"><div className="player-identity"><span className="avatar avatar-human">{s.mode==='versus'?<UserRound/>:<Bot/>}</span><div><h2>{leftName}</h2><span>{s.mode==='versus'?'HUMAN INSTINCT':s.mode==='search'?'EXPECTIMAX SEARCH':'FIXED RULES'}</span></div></div><div className="board-score"><span>SCORE</span><strong data-testid="left-score">{s.leftView.score.toLocaleString()}</strong></div></div>
            <Board board={s.leftView.board} last={s.leftView.last} label={leftName+' board'} over={gameOver(s.leftView.board)} onMove={s.mode==='versus'?humanMove:undefined}/>
            <div className="board-caption"><span>Best <b>{Math.max(...s.leftView.board)}</b><i/>Moves <b data-testid="left-moves">{s.leftView.moves}</b></span>{s.mode==='versus'?<div className="direction-controls">{(['left','up','down','right'] as Direction[]).map(d=><button key={d} aria-label={'Move '+d} onClick={()=>humanMove(d)}>{arrows[d]}</button>)}</div>:<span className="muted">{s.mode==='search'?'3-ply search':'Fixed heuristic'}</span>}</div>
          </section>
          <div className="versus-mark"><span>vs</span><i/></div>
          <section className="player-zone jev-zone">
            <div className="player-heading"><div className="player-identity"><span className="avatar avatar-jev"><Sparkles/></span><div><h2>Jev <span className="ai-pill">AI</span></h2><span>QUICK JUDGMENT</span></div></div><div className="board-score"><span>SCORE</span><strong data-testid="jev-score">{s.rightView.score.toLocaleString()}</strong></div></div>
            <Board board={s.rightView.board} last={s.rightView.last} label="Jev board" over={gameOver(s.rightView.board)}/>
            <div className="board-caption"><span>Best <b>{Math.max(...s.rightView.board)}</b><i/>Moves <b data-testid="jev-moves">{s.rightView.moves}</b></span><span className={`play-status ${s.running?'active':''}`}>{s.busy?<LoaderCircle className="spin"/>:<i/>}{stateText}</span></div>
          </section>
        </div>
        {allDone&&<div className="winner-banner" role="status"><Sparkles/><strong>{s.leftView.score===s.rightView.score?'A tie!':s.leftView.score>s.rightView.score?leftName+' wins this round.':'Jev wins this round.'}</strong><span>{s.leftView.score} to {s.rightView.score}. One match, one little experiment.</span></div>}
        <section className="decision-strip" aria-label="Latest Jev decision">
          <div className="decision-title"><span className="decision-arrow">{s.busy?<LoaderCircle className="spin"/>:last?arrows[last.direction]:<Sparkles/>}</span><div><span className="eyebrow">JEV’S LAST CALL</span><strong>{last?<><span className="capitalize">{last.direction}</span><small>{last.ms} ms</small></>:'Waiting for its first move'}</strong></div></div>
          <div className="probability-strip">{last?.probabilities?(['up','left','down','right'] as Direction[]).map(d=><div key={d} className={d===last.direction?'chosen':''}><span>{arrows[d]} {d}<b>{last.probabilities&&d in last.probabilities?Math.round(last.probabilities[d]*100)+'%':'not legal'}</b></span><meter min={0} max={1} value={last.probabilities?.[d]||0} aria-label={d+' move-choice probability'}/></div>):<span className="decision-empty">Press Step to see a real choice.<br/><small>Choice probabilities, not win odds.</small></span>}</div>
          <button className="inspect-link" onClick={()=>{s.tab='how';refresh();}}>Why this move? <ArrowUpRight/></button>
        </section>
        {s.error&&<div className="error-banner" role="alert"><span><b>Decision paused.</b> {s.error} No substitute moves.</span><Button id="retry" variant="outline" disabled={s.busy} onClick={()=>{s.running=s.speed!=='step';void step();}}>Retry</Button></div>}
        <div className="under-game"><p>{s.mode==='versus'?'Arrow keys, buttons or swipe to play. ':'Watch both styles play out. '}Fast adds no delay. Pause lets the current decision finish.</p><label>Seed <input aria-label="Seed" maxLength={80} value={seed} onChange={e=>setSeed(e.target.value)}/><span>applies on restart</span></label></div>
        <div className="match-metrics" aria-label="Match milestones">{[[leftName,s.leftView],['Jev',s.rightView]].map(([name,value])=>{const v=value as Player;return <div key={name as string}><strong>{name as string}</strong><span className={Math.max(...v.board)>=2048?'milestone reached':'milestone'}>{Math.max(...v.board)>=2048?'2048 reached':'2048 not reached'}</span><span>{gameOver(v.board)?'Final':'Current'} score <b>{v.score.toLocaleString()}</b></span><span>Highest <b>{Math.max(...v.board)}</b> · {v.moves} moves</span><span>Mean decision <b>{v.timedDecisions?(v.decisionMs/v.timedDecisions).toFixed(1)+' ms':'Unavailable'}</b></span></div>;})}</div>
        <div className="secondary">
          <ScoreChart left={s.leftView} right={s.rightView} leftName={leftName}/>
          <aside className="session-stats"><span className="eyebrow">THIS SESSION</span><h2>Little choices. <br/>Real numbers.</h2><dl><div><dt>Jev requests</dt><dd data-testid="calls">{s.metrics.calls}</dd></div><div><dt>Reported input tokens</dt><dd>{s.metrics.unknown?'Unavailable':s.metrics.input.toLocaleString()}</dd></div><div><dt>Average response</dt><dd>{s.metrics.timed?(s.metrics.ms/s.metrics.timed).toFixed(0)+' ms':'Unavailable'}</dd></div></dl><p>Same seed, independent random streams. Different moves change the empty cells, so tile positions can diverge.</p><button onClick={()=>{s.tab='how';refresh();}}>Explore the experiment <ArrowRight/></button></aside>
        </div>
        <div className="short-explainer"><span className="eyebrow">WHAT ARE WE TESTING?</span><p>A general decision model against rules built for 2048.<br/>Can hundreds of quick judgments compete with a game-specific policy? <button onClick={()=>{s.tab='how';refresh();}}>Take a closer look ↗</button></p></div>
      </TabsContent>
      <TabsContent value="how"><HowItWorks records={s.records}/></TabsContent>
    </Tabs>
    <footer className="site-footer"><span><Gamepad2/>Jev Arcade <i/>Built for a little curiosity.</span><a href="/licenses/nneonneo-MIT.txt" target="_blank" rel="noreferrer">Search: nneonneo adaptation · MIT</a></footer>
  </main>;
}
