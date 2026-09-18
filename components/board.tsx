'use client';
import {useEffect,useRef,useState} from 'react';
import {motion,useReducedMotion} from 'motion/react';
import {slide,type Direction} from '@/public/engine';
import type {Decision} from '@/lib/types';
export const arrows:Record<Direction,string>={up:'↑',left:'←',down:'↓',right:'→'};
export function MiniBoard({board,highlight=-1,label='Board preview'}:{board:number[];highlight?:number;label?:string}){
  return <div className="mini-board" role="img" aria-label={label+': '+board.join(', ')}>{board.map((v,i)=><span key={i} className={`mini-tile tile-${v} ${i===highlight?'spawn-highlight':''}`}>{v||''}</span>)}</div>;
}
export default function Board({board,last,label,onMove,over=false}:{board:number[];last:Decision|null;label:string;onMove?:(d:Direction)=>void;over?:boolean}){
  const [sliding,setSliding]=useState(false);const reduce=useReducedMotion();
  const touch=useRef<{x:number;y:number}|null>(null);
  useEffect(()=>{if(!last||reduce){setSliding(false);return;}setSliding(true);const t=setTimeout(()=>setSliding(false),130);return ()=>clearTimeout(t);},[last?.id,reduce]);
  const transitions=last?slide(last.before,last.direction).transitions:[];
  const merged=new Set(transitions.filter(t=>t.merged).map(t=>t.to));
  const position=(index:number)=>({left:`calc(${index%4} * (100% + var(--gap)) / 4)`,top:`calc(${Math.floor(index/4)} * (100% + var(--gap)) / 4)`});
  return <div className={`game-board ${onMove?'touch-board':''}`} role="group" aria-label={label} data-board={label}
    onTouchStart={e=>{if(!onMove)return;touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}}
    onTouchEnd={e=>{if(!touch.current||!onMove)return;const dx=e.changedTouches[0].clientX-touch.current.x,dy=e.changedTouches[0].clientY-touch.current.y;touch.current=null;if(Math.max(Math.abs(dx),Math.abs(dy))<22)return;onMove(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');}}>
    <div className="board-inner">
      <div className="board-slots" aria-hidden="true">{Array.from({length:16},(_,i)=><span key={i}/>)}</div>
      {sliding&&last?transitions.map(t=><motion.div key={last.id+'-'+t.from} aria-hidden className={`game-tile tile-${t.value}`} initial={position(t.from)} animate={position(t.to)} transition={{duration:.12,ease:'easeOut'}}>{t.value}</motion.div>):
        board.map((v,i)=>v?<div key={`${last?.id||'initial'}-${i}`} className={`game-tile tile-${v} ${last?.spawn.index===i?'tile-spawn':merged.has(i)?'tile-merge':''}`} style={position(i)} aria-label={`Row ${Math.floor(i/4)+1}, column ${i%4+1}: ${v}`} data-value={v}>{v}</div>:null)}
    </div>
    {over&&<div className="board-over"><span>Board complete</span><strong>{Math.max(...board).toLocaleString()} highest tile</strong></div>}
  </div>;
}
