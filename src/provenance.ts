/** Local evidence, not ASMP admission or custody. Node runtime; no dependencies. */
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, openSync, writeFileSync, closeSync, fsyncSync, linkSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
export const ID = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/;
export const HASH = /^sha256:[0-9a-f]{64}$/;
export const TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/;
export function assertId(id: string): void { if (!ID.test(id)) throw new Error('INVALID_ID'); }
// Millisecond clock, padded to the ASMP six-digit format; NOT microsecond precision.
export function timestamp(): string { return new Date().toISOString().replace(/(\.\d{3})Z$/, '$1000Z'); }
function compare(a: string, b: string): number {
  const x = Array.from(a, c => c.codePointAt(0)!); const y = Array.from(b, c => c.codePointAt(0)!);
  for (let i=0;i<Math.min(x.length,y.length);i++) if(x[i]!==y[i]) return x[i]-y[i];
  return x.length-y.length;
}
/** ASMP framing and NFC rules, restricted to JS safe integers. Unicode version is recorded. */
export function canonical(value: unknown): string {
  const active = new Set<object>(); let nodes = 0;
  function str(s: string): string {
    if (!s.isWellFormed()) throw new Error('INVALID_UNICODE');
    return s.normalize('NFC');
  }
  function walk(v: any, depth: number): string {
    if (++nodes > 100000 || depth > 128) throw new Error('INPUT_LIMIT');
    if (v === null || typeof v === 'boolean') return String(v);
    if (typeof v === 'string') return JSON.stringify(str(v));
    if (typeof v === 'number') { if (!Number.isSafeInteger(v)) throw new Error('INVALID_NUMBER'); return String(v === 0 ? 0 : v); }
    if (!v || typeof v !== 'object' || active.has(v)) throw new Error('INVALID_TYPE');
    if (!Array.isArray(v) && Object.getPrototypeOf(v)!==Object.prototype && Object.getPrototypeOf(v)!==null) throw new Error('INVALID_TYPE');
    if (Reflect.ownKeys(v).some(k => typeof k === 'symbol')) throw new Error('INVALID_TYPE');
    active.add(v);
    try {
      if (Array.isArray(v)) {
        if (Object.keys(v).length !== v.length) throw new Error('INVALID_ARRAY');
        return '[' + Array.from(v, x=>walk(x,depth+1)).join(',') + ']';
      }
      const keys = new Map<string,string>();
      for (const k of Object.keys(v)) { const n=str(k); if(keys.has(n)) throw new Error('NORMALIZATION_COLLISION'); keys.set(n,k); }
      return '{'+Array.from(keys.keys()).sort(compare).map(k=>JSON.stringify(k)+':'+walk(v[keys.get(k)!],depth+1)).join(',')+'}';
    } finally { active.delete(v); }
  }
  const result=walk(value,0); if(Buffer.byteLength(result)>10*1024*1024) throw new Error('INPUT_LIMIT'); return result;
}
export function hash(tag: string, value: unknown): string {
  if (!/^contradictor\.[a-z-]+\.v1$/.test(tag)) throw new Error('UNKNOWN_HASH_DOMAIN');
  return 'sha256:'+createHash('sha256').update(tag+'\n','utf8').update(canonical(value),'utf8').digest('hex');
}
export function immutable<T>(v:T): T {
  const copy=JSON.parse(canonical(v));
  function freeze(x:any): any { if(x && typeof x==='object') {Object.values(x).forEach(freeze); Object.freeze(x);} return x; }
  return freeze(copy);
}
export type ExecutionState = 'not_run'|'passed'|'failed'|'inconclusive'|'unsupported'|'error';
export interface EvidenceRef { evidence_id:string; content_hash:string; kind:'runtime_test'; }
export interface ProbeExecutionRecord {
  schema_version:'contradictor.execution.v1'; probe_run_id:string; probe_id:string;
  probe_version:string; probe_definition_hash:string; probe_definition:unknown;
  tool_id:string; tool_build:string; adapter_id:string; adapter_version:string;
  started_at:string; completed_at:string;
  baseline_input_hash:string|null; transformed_input_hash:string|null;
  baseline_observation_hash:string|null; transformed_observation_hash:string|null;
  execution_state:Exclude<ExecutionState,'not_run'>;
  relation_result:'pass'|'fail'|'inconclusive'; result_version:'1.0.0'; result:unknown;
  evidence_refs:EvidenceRef[]; environment:Record<string,string>; record_hash:string;
}
export interface ExecutionStore {
  putEvidence(value:unknown): EvidenceRef; readEvidence(ref:EvidenceRef):unknown;
  append(record:ProbeExecutionRecord):ProbeExecutionRecord;
  get(id:string):ProbeExecutionRecord|undefined;
}
export function sealRecord(body:Omit<ProbeExecutionRecord,'record_hash'>):ProbeExecutionRecord {
  const record=immutable({...body,record_hash:hash('contradictor.record.v1',body)}); validateRecord(record); return record;
}
export function validateRecord(r:ProbeExecutionRecord):void {
  for(const id of [r.probe_run_id,r.probe_id,r.tool_id,r.adapter_id]) assertId(id);
  if(r.schema_version!=='contradictor.execution.v1'||r.result_version!=='1.0.0'||!TIME.test(r.started_at)||!TIME.test(r.completed_at)||r.completed_at<r.started_at) throw new Error('INVALID_RECORD');
  if(!['passed','failed','inconclusive','unsupported','error'].includes(r.execution_state)) throw new Error('INVALID_RECORD');
  if(r.relation_result!==(r.execution_state==='passed'?'pass':r.execution_state==='failed'?'fail':'inconclusive')) throw new Error('INVALID_RESULT');
  if(!r.evidence_refs.length) throw new Error('NO_EVIDENCE');
  for(const ref of r.evidence_refs) {assertId(ref.evidence_id);if(!HASH.test(ref.content_hash)||ref.kind!=='runtime_test') throw new Error('INVALID_EVIDENCE');}
  if(hash('contradictor.probe.v1',r.probe_definition)!==r.probe_definition_hash) throw new Error('DEFINITION_MISMATCH');
  for(const key of ['baseline_input_hash','transformed_input_hash','baseline_observation_hash','transformed_observation_hash'] as const) if(r[key]!==null&&!HASH.test(r[key]!)) throw new Error('INVALID_HASH');
  const {record_hash,...body}=r;
  if(record_hash!==hash('contradictor.record.v1',body)) throw new Error('RECORD_HASH_MISMATCH');
}
/** Reconstruct material record fields from captured call evidence. */
export function validateEvidence(r:ProbeExecutionRecord,read:(ref:EvidenceRef)=>unknown):void {
  const values=r.evidence_refs.map(read) as any[];
  const ev=values[0];
  if(!ev||ev.probe_run_id!==r.probe_run_id||canonical(ev.result)!==canonical(r.result)||ev.execution_state!==r.execution_state||canonical(ev.definition)!==canonical(r.probe_definition))throw new Error('EVIDENCE_RECORD_MISMATCH');
  if(ev.descriptor.tool_id!==r.tool_id||ev.descriptor.tool_build!==r.tool_build||ev.descriptor.adapter_id!==r.adapter_id||ev.descriptor.adapter_version!==r.adapter_version)throw new Error('EVIDENCE_IDENTITY_MISMATCH');
  const inputs=ev.steps.filter((s:any)=>s.operation==='submit').map((s:any)=>s.arguments[0]);
  // Invalid/error observations may be captured in evidence but are excluded from usable pairs.
  const outputs=ev.steps.filter((s:any)=>s.operation!=='newSession'&&s.output&&(!s.error||s.error.startsWith('UNUSABLE_OBSERVATION:'))).map((s:any)=>s.output);
  for(const [key,tag,value] of [
    ['baseline_input_hash','input',inputs[0]],['transformed_input_hash','input',inputs[1]],
    ['baseline_observation_hash','observation',outputs[0]],['transformed_observation_hash','observation',outputs[1]],
  ] as const)if(r[key] !== (value===undefined?null:hash('contradictor.'+tag+'.v1',value)))throw new Error('EVIDENCE_PAIR_MISMATCH');
}
export class MemoryExecutionStore implements ExecutionStore {
  private evidence=new Map<string,unknown>(); private records=new Map<string,ProbeExecutionRecord>();
  putEvidence(v:unknown):EvidenceRef {const content_hash=hash('contradictor.evidence.v1',v);const ref={evidence_id:'E-'+content_hash.slice(7),content_hash,kind:'runtime_test' as const};this.evidence.set(ref.evidence_id,immutable(v));return immutable(ref);}
  readEvidence(ref:EvidenceRef):unknown {const v=this.evidence.get(ref.evidence_id);if(v===undefined||hash('contradictor.evidence.v1',v)!==ref.content_hash) throw new Error('EVIDENCE_MISMATCH');return v;}
  append(r:ProbeExecutionRecord):ProbeExecutionRecord {validateRecord(r);validateEvidence(r,x=>this.readEvidence(x));const old=this.get(r.probe_run_id);if(old&&old.record_hash!==r.record_hash) throw new Error('IDEMPOTENCY_CONFLICT');if(!old)this.records.set(r.probe_run_id,immutable(r));return this.get(r.probe_run_id)!;}
  get(id:string):ProbeExecutionRecord|undefined {assertId(id);return this.records.get(id);}
}
/** Publish whole fsynced content via no-clobber hard link. Records are published after evidence.
 * A crash before record publication leaves harmless orphan evidence, never an accepted partial record.
 * No automatic retry of tool side effects; same execution ID replay is supported only after publication. */
export class FileExecutionStore implements ExecutionStore {
  root:string;
  constructor(root:string) {this.root=root;mkdirSync(join(root,'evidence'),{recursive:true});mkdirSync(join(root,'records'),{recursive:true});}
  private publish(path:string,v:unknown):void {
    const bytes=canonical(v);const tmp=path+'.tmp-'+process.pid+'-'+Math.random().toString(16).slice(2);
    const fd=openSync(tmp,'wx',0o600);
    try {writeFileSync(fd,bytes);fsyncSync(fd);} finally {closeSync(fd);}
    try {linkSync(tmp,path);} catch(e:any) {if(e.code!=='EEXIST')throw e;if(readFileSync(path,'utf8')!==bytes)throw new Error('IMMUTABLE_CONFLICT');} finally {unlinkSync(tmp);}
    // Directory fsync is POSIX-only durability for the hard-link entry; Windows/NTFS
    // rejects fsync on a directory fd with EPERM by design, so it is skipped there.
    // File content above is still fsynced on every platform.
    if(process.platform!=='win32'){const dir=openSync(dirname(path),'r');try{fsyncSync(dir);}finally{closeSync(dir);}}
  }
  putEvidence(v:unknown):EvidenceRef {const content_hash=hash('contradictor.evidence.v1',v);const ref={evidence_id:'E-'+content_hash.slice(7),content_hash,kind:'runtime_test' as const};this.publish(join(this.root,'evidence',ref.evidence_id+'.json'),v);return immutable(ref);}
  readEvidence(ref:EvidenceRef):unknown {assertId(ref.evidence_id);const v=JSON.parse(readFileSync(join(this.root,'evidence',ref.evidence_id+'.json'),'utf8'));if(hash('contradictor.evidence.v1',v)!==ref.content_hash)throw new Error('EVIDENCE_MISMATCH');return immutable(v);}
  append(r:ProbeExecutionRecord):ProbeExecutionRecord {validateRecord(r);validateEvidence(r,x=>this.readEvidence(x));this.publish(join(this.root,'records',r.probe_run_id+'.json'),r);return this.get(r.probe_run_id)!;}
  get(id:string):ProbeExecutionRecord|undefined {assertId(id);let text:string;try{text=readFileSync(join(this.root,'records',id+'.json'),'utf8');}catch(e:any){if(e.code==='ENOENT')return undefined;throw e;}const r=JSON.parse(text);validateRecord(r);if(r.probe_run_id!==id)throw new Error('IDENTITY_MISMATCH');validateEvidence(r,x=>this.readEvidence(x));return immutable(r);}
}
