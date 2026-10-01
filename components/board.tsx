'use client';
import {useEffect,useRef,useState} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'motion/react';
import {slide,type Direction} from '@/public/engine';
import type {Decision} from '@/lib/types';
export const arrows:Record<Direction,string>={up:'↑',left:'←',down:'↓',right:'→'};
export function MiniBoard({board,highlight=-1,label='Board preview'}:{board:number[];highlight?:number;label?:string}){
  return <div className="mini-board" role="img" aria-label={label+': '+board.join(', ')}>{board.map((v,i)=><span key={i} className={`mini-tile tile-${v} ${i===highlight?'spawn-highlight':''}`}>{v||''}</span>)}</div>;
}
// Tiles keep their id across moves so the DOM node slides instead of remounting.
// Merging sources become ghosts under a new merged tile that pops in once the slide ends.
type Tile={id:number;value:number;index:number;kind:'static'|'ghost'|'merge'|'spawn'};
type Move=Pick<Decision,'id'|'before'|'after'|'direction'|'spawn'>;
let nextId=1;
const fresh=(board:number[]):Tile[]=>board.flatMap((value,index)=>value?[{id:nextId++,value,index,kind:'static' as const}]:[]);
function advance(previous:Tile[],board:number[],last:Move|null):Tile[]{
  if(!last||board.join()!==last.after.join())return fresh(board);
  const live=previous.filter(t=>t.kind!=='ghost'),at=new Map(live.map(t=>[t.index,t]));
  if(live.length!==last.before.filter(Boolean).length||last.before.some((v,i)=>v&&at.get(i)?.value!==v))return fresh(board);
  const tiles:Tile[]=[],merged=new Set<number>();
  for(const t of slide(last.before,last.direction).transitions){
    const id=at.get(t.from)!.id;
    if(!t.merged){tiles.push({id,value:t.value,index:t.to,kind:'static'});continue;}
    tiles.push({id,value:t.value,index:t.to,kind:'ghost'});
    if(!merged.has(t.to)){merged.add(t.to);tiles.push({id:nextId++,value:t.value*2,index:t.to,kind:'merge'});}
  }
  if(last.spawn.index>=0)tiles.push({id:nextId++,value:last.spawn.value,index:last.spawn.index,kind:'spawn'});
  return tiles;
}
const translate=(index:number)=>`translate(calc(${index%4} * (100% + var(--gap))),calc(${Math.floor(index/4)} * (100% + var(--gap))))`;
export default function Board({board,last,label,onMove,over=false}:{board:number[];last:Move|null;label:string;onMove?:(d:Direction)=>void;over?:boolean}){
  const key=(last?.id??'none')+'|'+board.join();
  const [view,setView]=useState(()=>({key,tiles:fresh(board)}));
  let tiles=view.tiles;
  if(view.key!==key){tiles=advance(view.tiles,board,last);setView({key,tiles});}
  const reduce=useReducedMotion(),merges=tiles.filter(t=>t.kind==='merge').length;
  // A short buzz on merges for the player's own board, where the device supports it.
  useEffect(()=>{if(onMove&&merges&&!reduce)navigator.vibrate?.(merges>1?[8,40,8]:8);},[view.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const start=useRef<{x:number;y:number}|null>(null);
  const swipe=(x:number,y:number)=>{if(!start.current||!onMove)return;const dx=x-start.current.x,dy=y-start.current.y;start.current=null;if(Math.max(Math.abs(dx),Math.abs(dy))<22)return;onMove(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');};
  return <div className={`game-board ${onMove?'touch-board':''}`} role="group" aria-label={label} data-board={label}
    onTouchStart={e=>{if(onMove)start.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}}
    onTouchEnd={e=>swipe(e.changedTouches[0].clientX,e.changedTouches[0].clientY)}
    onPointerDown={e=>{if(onMove&&e.pointerType==='mouse')start.current={x:e.clientX,y:e.clientY};}}
    onPointerUp={e=>{if(e.pointerType==='mouse')swipe(e.clientX,e.clientY);}}>
    <div className="board-inner">
      <div className="board-slots" aria-hidden="true">{Array.from({length:16},(_,i)=><span key={i}/>)}</div>
      {tiles.map(t=>{const ghost=t.kind==='ghost';return <div key={t.id} className={`game-tile ${ghost?'tile-ghost':t.kind==='merge'?'tile-merge':t.kind==='spawn'?'tile-spawn':''}`} style={{transform:translate(t.index)}}
        aria-hidden={ghost||undefined} aria-label={ghost?undefined:`Row ${Math.floor(t.index/4)+1}, column ${t.index%4+1}: ${t.value}`} data-value={ghost?undefined:t.value}>
        <div className={`tile-inner tile-${t.value}`} data-digits={String(t.value).length}>{t.value}</div>
      </div>;})}
    </div>
    {over&&<div className="board-over"><span>Game over</span><strong>{Math.max(...board).toLocaleString()} highest tile</strong></div>}
  </div>;
}
// A "+N" that floats up from a score whenever a move earns points.
export function ScoreGain({gain,id}:{gain:number;id?:string}){
  if(useReducedMotion())return null;
  return <span className="score-gain-anchor" aria-hidden="true"><AnimatePresence>{gain>0&&id&&<motion.span key={id} className="score-gain"
    initial={{opacity:0,y:4}} animate={{opacity:[0,1,1,0],y:-22}} exit={{opacity:0}} transition={{duration:.7,ease:'easeOut',times:[0,.15,.6,1]}}>+{gain.toLocaleString()}</motion.span>}</AnimatePresence></span>;
}
