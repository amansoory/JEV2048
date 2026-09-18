import json,pathlib,hashlib,re,statistics
root=pathlib.Path(__file__).resolve().parents[1];sources=[]
def raw(path):
 p=(root/path).resolve();b=p.read_bytes();sources.append({'path':path,'sha256':hashlib.sha256(b).hexdigest()});return b.decode('utf-8-sig')
def load(path):return json.loads(raw(path))
matched=load('../jev-2048-models/matched-evaluation/five-seed-results.json');assert matched['complete']
rows=[]
for i,m in enumerate(matched['matches']):
 row={'seed':m['seed'],'label':f'Seed {i+1}'}
 for g in m['games']:
  assert g['status']=='game_over';key='expectimax' if g['policy']=='pure-expectimax' else 'ntuple';row[key]=g['summary']
 rows.append(row)
assert len(rows)==5
means={k:{'score':statistics.mean(r[k]['score'] for r in rows),'native_ms':statistics.mean(r[k]['decision_ms']['mean'] for r in rows)} for k in ['expectimax','ntuple']}
assert means['expectimax']['score']==45553.6 and means['ntuple']['score']==222849.6
pilot=load('artifacts/study-pilot-2026-09-18/statistics.json')['aggregate'];assert [x['score']['mean'] for x in pilot]==[796,1046,10770,34276,2576,89272]
report=raw('artifacts/study-pilot-2026-09-18/REPORT.md');assert 'Across 3559 assisted decisions' in report and '4 were highest-value ties' in report
native=raw('../jev-2048-models/TDL2048/validation-one-game.log');assert re.search(r'16384\s+1\s+381548\s+14537',native)
gates=load('artifacts/uncertainty-gated-dev-v1/results.json');counter=load('artifacts/uncertainty-gated-dev-v1/override-counterfactuals.json');counts=counter['summary']['by_horizon']['100']['groups'];assert counts=={'helpful':7,'harmful':10,'inconclusive':1452}
tail=load('artifacts/jev-tail-risk-shield-dev.json');corrected=load('artifacts/jev-tail-risk-shield-calibrated-dev-d28dc083-dc2e-4e01-b445-d9303bbc6841.json')
v1=load('../jev-2048-models/matched-evaluation/jev-blind-ten-disagreements.json');v2=load('../jev-2048-models/matched-evaluation/jev-blind-ten-disagreements-v2.json');assert v1['complete'] and v2['complete'];assert v2['summary']['noisy_or_tied_states']==10
rollouts=load('../jev-2048-models/matched-evaluation/ten-disagreements-four-rollouts-50moves.json');assert rollouts['complete'] and len(rollouts['states'])==10
out={'date':v2['date'][:10],'native_validation':{'score':381548,'highest':16384,'moves':14537,'n':1},'matched':rows,'matched_means':means,'matched_wins':sum(r['ntuple']['score']>r['expectimax']['score'] for r in rows),'pilot':pilot,'assisted_audit':{'decisions':3559,'agreements':3554,'disagreements':5,'equal_value_disagreements':4},'gated':gates,'overrides':{'horizon':100,'rollouts_per_override':4,'n':sum(counts.values()),'counts':counts},'tail_first':[g['summary'] for g in tail['games']],'tail_corrected':[g['summary'] for g in corrected['games']],'arbitration_v1':v1['summary'],'arbitration_v2':v2['summary'],'arbitration_states':[{'index':s['index'],'final':s['final'],'saved_outcome':s['saved_outcome']} for s in v2['states']],'sources':sources}
(root/'public/research-data.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print('Verified and extracted',len(sources),'saved sources. No study execution.')
