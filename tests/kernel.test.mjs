import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {runPython} from './helpers/python.mjs';
import {buildUniversalProbes,runProbe,runAllProbes,Contradictor,readyForHumanValidation,toManifestEnvelope,generateUniversalRows,canonical,hash,timestamp,MemoryExecutionStore,FileExecutionStore,validateRecord,buildFullFindingsMarkdown} from '../src/contradictor.ts';
export const manifest={toolName:'Fixture',buildVersion:'test-1',categories:['Alpha','Beta'],knownRiskAreas:[],inputSurfaces:['text'],probePolicy:{negation:true,monotonicity:true,replacementSubmissions:true}};
const probes=buildUniversalProbes(manifest),p=n=>probes[n-1];
const obs=(extra={})=>({status:'ranked',rankedItems:[{label:'Alpha',rank:1}],renderedText:'Alpha',observedAt:timestamp(),...extra});
function adapter(outputs=[],caps=['ranked']) {
 let n=0,calls=[];
 const a={descriptor:{tool_id:'Fixture',tool_build:'test-1',adapter_id:'FixtureAdapter',adapter_version:'1.0.0',capabilities:caps},calls,
async newSession(s){calls.push(['newSession',s]);},async submit(s){calls.push(['submit',s]);const v=outputs[n++]??obs();return typeof v==='function'?v(s):v;},
async readLiveState(){calls.push(['read']);return outputs[n++]??obs();},async approve(){calls.push(['approve']);return outputs[n++]??obs();},async readExportedArtifact(){calls.push(['export']);return outputs[n++]??obs();}};
 return a;
}
test('U1 explicit insufficiency passes; ranked/error/unknown/contradiction do not',async()=>{
 for(const status of ['insufficient_evidence','no_supported_friction']) assert.equal((await runProbe(p(1),adapter([obs({status,rankedItems:[]})]))).execution_state,'passed');
 for(const status of ['ranked','error','unknown','contradiction_flagged']) assert.notEqual((await runProbe(p(1),adapter([obs({status})]))).execution_state,'passed');
});
test('U2 target moving to rank 2 remains failure',async()=>{
 const row=await runProbe(p(2),adapter([obs(),obs({rankedItems:[{label:'Beta',rank:1},{label:'Alpha',rank:2}]})]));assert.equal(row.execution_state,'failed');
});
test('U2 negation flag passes and errors never pass',async()=>{
 assert.equal((await runProbe(p(2),adapter([obs(),obs({status:'contradiction_flagged'})]))).execution_state,'passed');
 assert.equal((await runProbe(p(2),adapter([obs(),obs({status:'error'})]))).execution_state,'error');
});
test('U2 baseline and domain policy are mandatory',async()=>{
 assert.equal((await runProbe(p(2),adapter([obs({rankedItems:[]}),obs()]))).execution_state,'inconclusive');
 const ps=buildUniversalProbes({...manifest,probePolicy:{}});assert.equal((await runProbe(ps[1],adapter())).execution_state,'inconclusive');
});
test('Input relation isolates baseline/transformed sessions',async()=>{const a=adapter([obs(),obs({status:'contradiction_flagged'})]);await runProbe(p(2),a);assert.equal(a.calls.filter(c=>c[0]==='newSession').length,2);assert.notEqual(a.calls[0][1],a.calls[2][1]);});
test('U3 empty ranks never pass vacuously',async()=>{assert.equal((await runProbe(p(3),adapter([obs({rankedItems:[]}),obs({rankedItems:[]})]))).execution_state,'inconclusive');});
test('U4/U5/U11 require review rather than invented oracle',async()=>{for(const n of [4,5,11])assert.equal((await runProbe(p(n),adapter())).execution_state,'inconclusive');});
test('U6 safe literal script is not injection; instrumented execution fails',async()=>{
 const a=extra=>adapter([obs(extra)],['rendering']);
 assert.equal((await runProbe(p(6),a({renderedText:'<script>',rendering:{scriptExecuted:false,markupInterpreted:false,renderingBroken:false}}))).execution_state,'passed');
 assert.equal((await runProbe(p(6),a({rendering:{scriptExecuted:true,markupInterpreted:false,renderingBroken:false}}))).execution_state,'failed');
 assert.equal((await runProbe(p(6),a({rendering:{}}))).execution_state,'inconclusive');assert.equal(p(6).invariantClass,'Input Robustness');
});
test('U7 taxonomy label is not leakage; unique current marker is',async()=>{
 const clean=adapter([s=>obs({currentResultText:s}),obs({currentResultText:'Beta',renderedText:'Alpha Beta taxonomy'})],['current-result']);assert.equal((await runProbe(p(7),clean)).execution_state,'passed');
 let first;const leak=adapter([s=>{first=s;return obs({currentResultText:s});},()=>obs({currentResultText:first})],['current-result']);assert.equal((await runProbe(p(7),leak)).execution_state,'failed');
 assert.equal((await runProbe(p(7),adapter([],['current-result']))).execution_state,'inconclusive');
});
test('U8 missing/colliding/distinct filenames',async()=>{for(const [a,b,state] of [[undefined,undefined,'inconclusive'],['x','x','failed'],['x','y','passed']]){const out=x=>x===undefined?obs():obs({exportFilename:x});assert.equal((await runProbe(p(8),adapter([obs(),out(a),obs(),out(b)],['export']))).execution_state,state);}});
test('Missing export capability blocks before any tool call and leaves evidence',async()=>{const a=adapter(),store=new MemoryExecutionStore();const r=await runProbe(p(8),a,{store});assert.equal(r.execution_state,'unsupported');assert.equal(a.calls.length,0);assert.equal(r.execution_record.evidence_refs.length,1);assert.ok(store.readEvidence(r.execution_record.evidence_refs[0]));});
test('U9 cannot pass if approval started already clear',async()=>{assert.equal((await runProbe(p(9),adapter([obs({pendingReviewIndicator:false})],['review']))).execution_state,'inconclusive');});
test('U10 compares ordered structured fields and rejects missing/extra/stale data',async()=>{
 const snapshot={schema:'fixture.v1',data:{subject:'S1',status:'ranked',ranks:['A','B'],review:false,diagnosis:'X'}};
 const live=obs({semanticSnapshot:snapshot});
 for(const [exported,state] of [[live,'passed'],[obs(),'inconclusive'],[obs({semanticSnapshot:{...snapshot,data:{...snapshot.data,ranks:['B','A']}}}),'failed'],[obs({semanticSnapshot:{...snapshot,data:{...snapshot.data,extra:'stale'}}}),'failed']])assert.equal((await runProbe(p(10),adapter([obs(),live,exported],['export','semantic-export']))).execution_state,state);
});
test('U12 requires marker positive control and distinct subjects',async()=>{
 const good=adapter([s=>obs({currentResultText:s,subjectId:'S1'}),obs({currentResultText:'B',subjectId:'S2'})],['current-result','subject']);assert.equal((await runProbe(p(12),good)).execution_state,'passed');
 assert.equal((await runProbe(p(12),adapter([],['current-result','subject']))).execution_state,'inconclusive');
});
test('U13 opt-in monotonicity detects degraded rank',async()=>{assert.equal((await runProbe(p(13),adapter([obs(),obs({rankedItems:[{label:'Alpha',rank:2}]})]))).execution_state,'failed');});
test('Adapter exception is recorded as error, not Codex-ready product bug',async()=>{const a=adapter([()=>{throw new Error('tool disconnected');}]);const r=await runProbe(p(1),a);assert.equal(r.execution_state,'error');assert.notEqual(r.codexReady,'Yes');assert.equal(r.severity,'');});
test('Nonranking base adapter needs no fake ranking/review/export fields',async()=>{assert.equal((await runProbe(p(1),adapter([{status:'insufficient_evidence',observedAt:timestamp()}],[]))).execution_state,'passed');});
test('Immutable execution, action evidence and version identity',async()=>{
 const store=new MemoryExecutionStore();const r=await runProbe(p(1),adapter([obs({status:'insufficient_evidence',rankedItems:[]})]),{store});const rec=r.execution_record;
 validateRecord(rec);assert.equal(rec.probe_id,'U1');assert.ok(rec.probe_definition_hash.startsWith('sha256:'));assert.ok(rec.baseline_input_hash);assert.ok(rec.baseline_observation_hash);assert.match(rec.started_at,/\.\d{6}Z$/);
 assert.throws(()=>rec.result.pass=false);assert.throws(()=>r.execution_state='failed');const ev=store.readEvidence(rec.evidence_refs[0]);assert.equal(ev.steps.length,2);assert.equal(ev.steps[1].operation,'submit');
 assert.throws(()=>validateRecord({...rec,tool_build:'tampered'}),/MISMATCH/);
});
test('Completed same-ID replay returns original record without second side effect',async()=>{
 const store=new MemoryExecutionStore(),a=adapter([obs({status:'insufficient_evidence',rankedItems:[]})]);const opts={store,probe_run_id:'PR-Replay'};const first=await runProbe(p(1),a,opts),count=a.calls.length;const second=await runProbe(p(1),a,opts);assert.equal(a.calls.length,count);assert.deepEqual(first,second);
 await assert.rejects(runProbe({...p(1),expected:'changed'},a,opts),/IDEMPOTENCY_CONFLICT/);
});
test('No-evidence or altered record is rejected',async()=>{const r=(await runProbe(p(1),adapter())).execution_record;assert.throws(()=>validateRecord({...r,evidence_refs:[]}),/NO_EVIDENCE/);});
test('File store reopens independently; content tamper blocks reads',async()=>{
 const root=mkdtempSync(join(tmpdir(),'contradictor-'));try{const store=new FileExecutionStore(root);const r=await runProbe(p(1),adapter(),{store,probe_run_id:'PR-Disk'});assert.deepEqual(new FileExecutionStore(root).get('PR-Disk'),r.execution_record);
 const child=spawnSync(process.execPath,['--input-type=module','-e',`import {FileExecutionStore} from ${JSON.stringify(new URL('../src/provenance.ts',import.meta.url).href)};console.log(new FileExecutionStore(${JSON.stringify(root)}).get('PR-Disk').record_hash)`],{encoding:'utf8'});assert.equal(child.status,0,child.stderr);assert.equal(child.stdout.trim(),r.execution_record.record_hash);
 const file=join(root,'evidence',readdirSync(join(root,'evidence'))[0]);writeFileSync(file,'{}');assert.throws(()=>store.get('PR-Disk'),/EVIDENCE_MISMATCH/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('Canonical normalization, numeric-key sorting and domain separation',()=>{
 assert.equal(canonical({'2':'b','10':'a',e:'e\u0301'}),'{"10":"a","2":"b","e":"é"}');assert.equal(hash('contradictor.input.v1','e\u0301'),hash('contradictor.input.v1','é'));assert.notEqual(hash('contradictor.input.v1','x'),hash('contradictor.observation.v1','x'));
 for(const bad of [NaN,Infinity,1.2,2**53,undefined,'\ud800',{'é':1,'e\u0301':2},Array(2)])assert.throws(()=>canonical(bad));const cyc={};cyc.x=cyc;assert.throws(()=>canonical(cyc));
});
test('Hash framing agrees with independent Python for supported fixtures',()=>{
 const value={'\u{10000}':'astral','\ue000':'bmp','10':'ten','2':'two',e:'e\u0301',n:123};
 const output=runPython(['-c',`import json,hashlib,unicodedata,sys\nv=json.loads(sys.argv[1]);v={unicodedata.normalize('NFC',k):unicodedata.normalize('NFC',x) if isinstance(x,str) else x for k,x in v.items()}\nb=json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()\nprint('sha256:'+hashlib.sha256(b'contradictor.input.v1\\n'+b).hexdigest())`,JSON.stringify(value)]);assert.equal(hash('contradictor.input.v1',value),output.trim());
});
test('Invalid explicit Python configuration fails clearly without fallback',()=>{
 assert.throws(()=>runPython(['-c','print(1)'],{...process.env,PYTHON:join(import.meta.dirname,'missing-python-executable')}),/Python 3 is required; no working interpreter found/);
});
test('Python script failures retain stderr and cannot masquerade as a passing cross-check',()=>{
 assert.throws(()=>runPython(['-c','raise RuntimeError("ORACLE_FAILURE")']),/Python cross-check execution failed:.*ORACLE_FAILURE/s);
});
test('Empty/planned/manual rows cannot clear gate; valid required execution can',async()=>{
 assert.equal(readyForHumanValidation([]),false);assert.equal(readyForHumanValidation(generateUniversalRows()),false);const r=await runProbe(p(1),adapter([obs({status:'insufficient_evidence',rankedItems:[]})]));assert.equal(readyForHumanValidation([r]),true);assert.equal(readyForHumanValidation([r],['missing']),false);
 const c=new Contradictor();c.addFinding({...r});assert.equal(c.clearForPeerTest,false);assert.throws(()=>c.removeRow(0),/APPEND_ONLY/);assert.equal(toManifestEnvelope('x','y',[]).classification_state,'not_run');assert.equal(toManifestEnvelope('x','y',[r]).classification_state,'clear_for_peer_test');
});
test('Seed/run does not leave duplicate planned library rows; getter cannot erase history',async()=>{const c=new Contradictor().seedUniversal();await c.runUniversalProbes(adapter([],[]),manifest);assert.equal(c.rows.length,13);assert.ok(c.rows.every(r=>r.row_origin==='executed'));c.rows.splice(0);assert.equal(c.rows.length,13);assert.equal(c.clearForPeerTest,false);});
test('Serial runner and deterministic report projection',async()=>{const a=adapter([obs(),obs()]);const rows=await runAllProbes(a,manifest,[p(1),p(1)]);assert.equal(a.calls.map(c=>c[0]).join(','),'newSession,submit,newSession,submit');assert.equal(buildFullFindingsMarkdown(rows),buildFullFindingsMarkdown(rows));});
test('Built-in definition and captured manifest cannot mutate after binding',()=>{assert.throws(()=>p(1).assertion=()=>({pass:true,evidence:'forged'}));const m={...manifest,probePolicy:{negation:true}};const bound=buildUniversalProbes(m);m.probePolicy.negation=false;assert.equal(bound[1].definitionContext.probePolicy.negation,true);});
test('Evidence reconstruction rejects a rehashed but mismatched record',async()=>{const {sealRecord}=await import('../src/provenance.ts');const store=new MemoryExecutionStore();const r=(await runProbe(p(1),adapter(),{store})).execution_record;const {record_hash,...body}=r;const altered=sealRecord({...body,baseline_input_hash:hash('contradictor.input.v1','forged')});assert.throws(()=>store.append(altered),/EVIDENCE_PAIR_MISMATCH/);});
test('Malformed normalized observation cannot become a pass',async()=>{const r=await runProbe(p(1),adapter([{status:'insufficient_evidence',observedAt:'yesterday',rankedItems:[]} ]));assert.equal(r.execution_state,'error');});
test('U10 snapshot order/content differences include review and subject identity',()=>{const snap=data=>obs({semanticSnapshot:{schema:'fixture.v1',data}});assert.equal(p(10).relation(snap({subject:'A',review:false}),snap({subject:'B',review:false})).pass,false);assert.equal(p(10).relation(snap({subject:'A',review:false}),snap({subject:'A',review:true})).pass,false);});
