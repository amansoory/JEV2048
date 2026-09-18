import {searchDecision} from './search-solver.js';
self.onmessage=event=>{try{self.postMessage({id:event.data.id,...searchDecision(event.data.board)});}catch{self.postMessage({id:event.data.id,error:'Search solver could not complete its decision.'});}};
