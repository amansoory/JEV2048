export const DIRECTIONS = ['up', 'left', 'down', 'right'];
export function slide(board, direction) {
  if (!DIRECTIONS.includes(direction)) throw new Error('Invalid direction');
  const next = board.slice();
  let score = 0;
  const merges = [], transitions = [];
  for (let line = 0; line < 4; line++) {
    const ids = Array.from({length:4}, (_, i) => direction === 'left' ? line*4+i : direction === 'right' ? line*4+3-i : direction === 'up' ? i*4+line : (3-i)*4+line);
    const values = ids.map(i=>board[i]).filter(Boolean);
    const sources = ids.filter(i=>board[i]);
    const merged = [];
    for (let i=0; i<values.length; i++) {
      const to=ids[merged.length];
      if (values[i] === values[i+1]) {
        transitions.push({from:sources[i],to,value:values[i],merged:true},{from:sources[i+1],to,value:values[i+1],merged:true});
        merged.push(values[i]*2); merges.push(values[i]*2); score += values[i]*2; i++;
      } else {transitions.push({from:sources[i],to,value:values[i],merged:false});merged.push(values[i]);}
    }
    ids.forEach((id,i)=>next[id]=merged[i] || 0);
  }
  return {board:next, score, changed:next.some((v,i)=>v!==board[i]),merges,transitions};
}
export const legalMoves = board => DIRECTIONS.filter(d=>slide(board,d).changed);
export const gameOver = board => legalMoves(board).length === 0;
export function seededRandom(seed) {
  let value = 2166136261;
  for (const ch of String(seed)) value = Math.imul(value ^ ch.charCodeAt(0),16777619);
  return () => { value += 0x6D2B79F5; let t=value; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
}
export function spawn(board, random) {
  const empty = board.flatMap((v,i)=>v===0 ? [i] : []);
  if (!empty.length) return board.slice();
  const next=board.slice(); next[empty[Math.floor(random()*empty.length)]]=random()<0.9 ? 2 : 4;
  return next;
}
export function newGame(seed) {
  const random=seededRandom(seed);
  return {board:spawn(spawn(Array(16).fill(0),random),random),score:0,moves:0,random};
}
export function move(game,direction) {
  const result=slide(game.board,direction);
  if (!result.changed) return false;
  game.board=spawn(result.board,game.random); game.score+=result.score; game.moves++;
  return true;
}
export function heuristic(board) {
  const ranked=legalMoves(board).map(direction=> {
    const result=slide(board,direction), b=result.board;
    const empty=b.filter(v=>!v).length;
    const max=Math.max(...b);
    const corner=[0,3,12,15].some(i=>b[i]===max) ? Math.log2(max)*3 : 0;
    let roughness=0;
    for(let r=0;r<4;r++) for(let c=0;c<4;c++) {
      const i=r*4+c;
      for(const j of [c<3?i+1:-1,r<3?i+4:-1]) if(j>=0 && b[i] && b[j]) roughness+=Math.abs(Math.log2(b[i])-Math.log2(b[j]));
    }
    return {direction,value:empty*12+corner+result.score*0.1-roughness};
  });
  ranked.sort((a,b)=>b.value-a.value);
  return ranked[0]?.direction ?? null;
}
