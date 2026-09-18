import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {newGame,move,legalMoves,gameOver,heuristic} from './public/engine.js';
import {apiKey,askJev,validateAnswer,usageOf} from './jev.js';

export function createApp({getKey=apiKey, decide=askJev}={}) {
  const sessions=new Map();
  let jevBusy=false;
  const view=s=>({id:s.id,seed:s.seed,mode:s.mode,board:s.game.board,score:s.game.score,moves:s.game.moves,highest:Math.max(...s.game.board),over:gameOver(s.game.board),legal:legalMoves(s.game.board),calls:s.calls,inputTokens:s.inputTokens,outputTokens:s.outputTokens,unknownUsage:s.unknownUsage,decisionMs:Math.round(s.decisionMs),last:s.last,error:s.error});
  const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  return http.createServer(async(req,res)=>{
    try {
      const host=req.headers.host;
      if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host||'')) return json(res,403,{error:'Local access only'});
      if(req.headers.origin && req.headers.origin!==`http://${host}`) return json(res,403,{error:'Cross-origin requests refused'});
      const path=new URL(req.url,`http://${host}`).pathname;
      if(req.method==='GET' && path==='/api/status') return json(res,200,{configured:!!getKey()});
      if(req.method==='POST') {
        if(!req.headers['content-type']?.startsWith('application/json')) return json(res,415,{error:'JSON required'});
        let body=''; for await(const chunk of req) {body+=chunk; if(body.length>4096) return json(res,413,{error:'Request too large'});}
        let data; try {data=JSON.parse(body);} catch {return json(res,400,{error:'Invalid JSON'});}
        if(path==='/api/games') {
          if(typeof data.seed!=='string'||data.seed.length>100||!['jev','spectate','heuristic'].includes(data.mode)) return json(res,400,{error:'Invalid seed or mode'});
          const previous=sessions.get(data.previousId);
          if(previous) {previous.invalidated=true;sessions.delete(previous.id);}
          if(sessions.size>=200) {const old=[...sessions.values()].find(s=>!s.busy); if(old) sessions.delete(old.id); else return json(res,503,{error:'Too many active games'});}
          const s={id:randomUUID(),seed:data.seed,mode:data.mode,game:newGame(data.seed),calls:0,inputTokens:0,outputTokens:0,unknownUsage:0,decisionMs:0,last:null,error:null,busy:false,invalidated:false};
          sessions.set(s.id,s); return json(res,200,view(s));
        }
        if(path==='/api/step') {
          const s=sessions.get(data.id); if(!s) return json(res,404,{error:'Game expired; restart'});
          if(s.busy) return json(res,409,{error:'Decision already in progress'});
          if(gameOver(s.game.board)) return json(res,200,view(s));
          if(['jev','spectate'].includes(s.mode)&&jevBusy) return json(res,409,{error:'A Jev decision is still finishing. Please Retry.'});
          const key=['jev','spectate'].includes(s.mode)?getKey():null;
          if(['jev','spectate'].includes(s.mode)&&!key) {s.error='Missing TYPESAFE_API_KEY in .env.local. No fallback move applied.';return json(res,503,view(s));}
          s.busy=true; s.error=null; const start=performance.now(); let usageRecorded=false;
          try {
            let direction, probabilities=null, confidence=null, model=null;
            if(['jev','spectate'].includes(s.mode)) {
              s.calls++; jevBusy=true;
              const result=await decide(s.game.board.slice(),key,{score:s.game.score,moveNumber:s.game.moves});
              const usage=usageOf(result); if(usage) {s.inputTokens+=usage.input_tokens;s.outputTokens+=usage.output_tokens;} else s.unknownUsage++;
              usageRecorded=true;
              const answer=validateAnswer(result,legalMoves(s.game.board));
              direction=answer.choice; probabilities=answer.probabilities; confidence=answer.confidence; model=result.model;
            } else direction=heuristic(s.game.board);
            if(s.invalidated) return json(res,409,{error:'Decision discarded because the game was restarted.'});
            if(!legalMoves(s.game.board).includes(direction)) throw new Error('Illegal move');
            const before=s.game.board.slice(); move(s.game,direction);
            s.last={source:['jev','spectate'].includes(s.mode)?'Jev API':'Deterministic heuristic',direction,probabilities,confidence,model,before,ms:Math.round(performance.now()-start)};
          } catch(err) {
            if(['jev','spectate'].includes(s.mode)&&!usageRecorded) s.unknownUsage++;
            s.error=err.message==='Invalid Jev answer; no move applied.'?err.message:`Jev request failed${Number.isInteger(err.status)?` (HTTP ${err.status})`:''}. No fallback move applied. Press Retry.`;
          } finally {s.decisionMs+=performance.now()-start;s.busy=false;if(['jev','spectate'].includes(s.mode))jevBusy=false;}
          return json(res,s.error?502:200,view(s));
        }
        return json(res,404,{error:'Not found'});
      }
      const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/engine.js':['engine.js','text/javascript'],'/style.css':['style.css','text/css']};
      if(req.method!=='GET'||!files[path]) return json(res,404,{error:'Not found'});
      const [name,type]=files[path];
      const content=await readFile(new URL(`public/${name}`,import.meta.url));
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(content);
    } catch {json(res,500,{error:'Local server error'});}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT||2048);
  createApp().listen(port,'127.0.0.1',()=>console.log(`You vs Jev: http://127.0.0.1:${port}`));
}
