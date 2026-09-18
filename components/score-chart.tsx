'use client';
import {useState} from 'react';
import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip} from 'recharts';
import type {Player} from '@/lib/types';
export default function ScoreChart({left,right,leftName}:{left:Player;right:Player;leftName:string}){
  const [inspect,setInspect]=useState(0);
  const maxMove=Math.max(left.moves,right.moves);
  const l=new Map(left.points.map(p=>[p.move,p.score])),r=new Map(right.points.map(p=>[p.move,p.score]));
  const data=Array.from({length:maxMove+1},(_,move)=>({move,left:l.get(move)??null,jev:r.get(move)??null}));
  const inspected=data[Math.min(inspect,maxMove)];
  return <section className="score-section" aria-label="Score over moves">
    <div className="section-heading"><div><span className="eyebrow">THE LONG GAME</span><h2>Every move adds up.</h2></div><div className="chart-legend"><span><i className="dot-purple"/>{leftName}</span><span><i className="dot-orange"/>Jev</span></div></div>
    <div className="chart-area">
      <ResponsiveContainer width="100%" height={210} minWidth={0}>
        <LineChart data={data} margin={{top:14,right:20,left:-8,bottom:18}} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="#e8e5df" strokeDasharray="3 5"/>
          <XAxis dataKey="move" type="number" domain={[0,Math.max(5,maxMove)]} allowDecimals={false} tick={{fontSize:11,fill:'#717169'}} tickLine={false} axisLine={false} label={{value:'Move number',position:'insideBottom',offset:-12,fill:'#717169',fontSize:11}}/>
          <YAxis domain={[0,(max:number)=>Math.max(32,max)]} tick={{fontSize:11,fill:'#717169'}} tickLine={false} axisLine={false} width={48}/>
          <Tooltip labelFormatter={v=>'Move '+v} contentStyle={{border:'1px solid #e4dfd6',borderRadius:12,fontSize:12}}/>
          <Line dataKey="left" name={leftName} type="linear" stroke="#7454c6" strokeWidth={2.5} dot={maxMove<12?{r:3}:false} activeDot={{r:5}} connectNulls={false} isAnimationActive={false}/>
          <Line dataKey="jev" name="Jev" type="linear" stroke="#dc502d" strokeWidth={2.5} dot={maxMove<12?{r:3}:false} activeDot={{r:5}} connectNulls={false} isAnimationActive={false}/>
        </LineChart>
      </ResponsiveContainer>
      {!maxMove&&<p className="chart-empty">Your story starts at zero.<br/><span>Make a move to draw the first point.</span></p>}
      <span className="axis-label">Score</span>
    </div>
    {maxMove>0&&<div className="chart-inspector"><label htmlFor="inspect-move">Explore move {Math.min(inspect,maxMove)}</label><input id="inspect-move" aria-label="Inspect chart move" type="range" min={0} max={maxMove} value={Math.min(inspect,maxMove)} onChange={e=>setInspect(Number(e.target.value))}/><output>{leftName}: {inspected?.left??'not played'} · Jev: {inspected?.jev??'not played'}</output></div>}
    <p className="fine-print">Aligned by move number, so you can compare at your own pace.</p>
  </section>;
}
