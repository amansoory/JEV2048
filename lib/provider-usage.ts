// Keep deployment routes independent of historical local credential loaders.
// Identical validation to the frozen baseline; prompts and responses are unchanged.
export function usageOf(result:any){const u=result?.usage;return u&&[u.input_tokens,u.output_tokens].every(v=>Number.isSafeInteger(v)&&v>=0)?u:null;}
