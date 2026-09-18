import {TypeSafeClient} from '@typesafe-ai/sdk';
let calls=0;
TypeSafeClient.prototype.systemOne=async function({state}){calls++;if(process.env.STUDY_TEST_INTERRUPT&&calls===7)process.emit('SIGINT');const legal=state.legal_directions,direction=legal[(state.move_number*7)%legal.length];return {model:'mock-only',usage:{input_tokens:100,output_tokens:10},answers:{direction:{type:'choice',choice:direction,probabilities:Object.fromEntries(legal.map(d=>[d,d===direction?1:0]))}}};};
