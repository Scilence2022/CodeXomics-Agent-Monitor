import { page } from '../web/page.mjs';

export const JOB_STATES = ['unprocessed','queued','researching','synthesizing','validating','completed','failed','cancelled'];
export const REVIEW_STATES = ['not_reviewed','pending','accepted','edited','rejected','no_change','insufficient_evidence','published'];
const json=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
const safeId=v=>typeof v==='string'&&/^[A-Za-z0-9_.:-]{1,180}$/.test(v);
const time=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const LIMIT=24*1024*1024;
const FILE_LIMIT=40*1024*1024;
const snapshotCache=new WeakMap();
const escapeGff=v=>encodeURIComponent(String(v)).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16));
export async function digest(value){const bytes=typeof value==='string'?new TextEncoder().encode(value):value;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function validateSnapshot(input){
 if(!input||input.schemaVersion!==1||!['observed','simulated'].includes(input.dataStatus))throw Error('Expected schemaVersion 1 and explicit dataStatus');
 if(!time(input.updatedAt)||!safeId(input.genome?.id)||!Number.isInteger(input.genome.length)||input.genome.length<1)throw Error('Invalid genome or timestamp');
 if(!Array.isArray(input.genes)||input.genes.length>100000||!Array.isArray(input.runs)||input.runs.length>5000)throw Error('Invalid census or runs');
 const ids=new Set();
 for(const g of input.genes){
  if(!safeId(g.id)||ids.has(g.id))throw Error('Invalid or duplicate feature ID');ids.add(g.id);
  if(!JOB_STATES.includes(g.jobStatus)||!REVIEW_STATES.includes(g.reviewStatus))throw Error('Invalid job or review state');
  if(!Number.isInteger(g.start)||!Number.isInteger(g.end)||g.start<1||g.end<g.start||g.end>input.genome.length)throw Error('Invalid feature coordinates');
  if(!Number.isFinite(g.progress)||g.progress<0||g.progress>100)throw Error('Invalid progress');
  if(g.reviewStatus==='published'&&!safeId(g.releaseId))throw Error('Published records require an exact release ID');
  if(g.references&&!Array.isArray(g.references))throw Error('References must be an array');
 }
 if(input.genome.eligibleFeatures!==input.genes.length)throw Error('Coverage denominator must equal the feature census');
 // Input is exported using an allowlist; source paths, prompts and credentials never enter the snapshot.
 return input;
}
export function summarize(s){
 const byJob=Object.fromEntries(JOB_STATES.map(x=>[x,0])),byReview=Object.fromEntries(REVIEW_STATES.map(x=>[x,0]));
 for(const g of s.genes){byJob[g.jobStatus]++;byReview[g.reviewStatus]++;}
 const active=byJob.researching+byJob.synthesizing+byJob.validating;
 const completed=byJob.completed;
 return {eligible:s.genes.length,completed,active,queued:byJob.queued,pending:byReview.pending,published:byReview.published,failed:byJob.failed,coverage:s.genes.length?completed/s.genes.length:0,byJob,byReview};
}
export function demoSnapshot(now=Date.now()){
 const tick=Math.floor(now/7000)%4,stages=['researching','synthesizing','validating','completed'];
 const genes=Array.from({length:48},(_,i)=>({id:`SIM_G${String(i+1).padStart(4,'0')}`,locusTag:`SIM_G${String(i+1).padStart(4,'0')}`,symbol:`sim${i+1}`,seqid:'MG_SIM',start:i*1000+1,end:i*1000+850,strand:i%3?'+':'-',product:'Simulated annotation for interface testing',jobStatus:i<24?'completed':i<27?stages[tick]:i===28?'failed':'queued',reviewStatus:i<12?'published':i<18?'pending':i<21?'no_change':i<24?'insufficient_evidence':i<27&&tick===3?'pending':'not_reviewed',progress:i<24?100:i<27?[25,55,85,100][tick]:0,releaseId:i<12?'SIM-2026.10.001':null,agent:i<27?'DGR demo agent':'',taskId:`SIM_TASK_${i+1}`,step:i<24?'Completed':i<27?['Evidence retrieval','Evidence synthesis','Proposal validation','Awaiting curator review'][tick]:i===28?'Simulated retrieval failure':'Awaiting assignment',updatedAt:new Date(now).toISOString(),runtimeSeconds:i<24?480:null,tokens:i<24?12000+i*400:0,costCny:i<24?0.2:null,referenceCount:i<24?4:0,references:[],before:{product:'Simulated starting annotation'},proposal:i<18?{product:'Simulated candidate qualifier'}:null,reviewDecision:i<12?'Simulated acceptance recorded in frozen demo release':null}));
 return {schemaVersion:1,dataStatus:'simulated',source:'Demonstration only — no real agents or biological findings',updatedAt:new Date(now).toISOString(),genome:{id:'MG-SIM',name:'Synthetic demonstration genome',accession:'MG_SIM',organism:'Synthetic demo',length:48000,eligibleFeatures:48,scope:'Protein-coding feature maintenance; synthetic census'},genes,runs:[{id:'SIM_RUN_002',label:'Current simulated sweep',startedAt:new Date(now-600000).toISOString(),finishedAt:null,selected:48,completed:genes.filter(g=>g.jobStatus==='completed').length,failed:1,tokens:320000,costCny:6.2,dataStatus:'simulated'},{id:'SIM_RUN_001',label:'Frozen demo release sweep',startedAt:'2026-10-01T00:00:00Z',finishedAt:'2026-10-01T02:00:00Z',selected:12,completed:12,failed:0,tokens:190000,costCny:3.8,dataStatus:'simulated'}],activity:genes.slice(24,29).map((g,i)=>({id:`SIM_EV_${i}_${tick}`,at:new Date(now-i*5000).toISOString(),geneId:g.id,agent:g.agent||'Scheduler',stage:g.step,status:g.jobStatus})),releases:[{id:'SIM-2026.10.001',label:'Frozen simulated release',dataStatus:'simulated',publishedAt:'2026-10-01T02:00:00Z',reviewedFeatures:12,changedFeatures:12,kind:'simulated',files:['gbk','gff3','fasta'],description:'All 48 synthetic features; 12 mock reviewed records. No biological data.'}],latestReleaseId:'SIM-2026.10.001',capabilities:{ingest:false,liveSource:false}};
}
export function demoArtifact(format){
 const genes=demoSnapshot(0).genes,sequence='ACGT'.repeat(12000);
 if(format==='fasta')return `>MG_SIM SIMULATED_PLACEHOLDER_NOT_OBSERVED\n${sequence.match(/.{1,70}/g).join('\n')}\n`;
 if(format==='gff3')return '##gff-version 3\n# SIMULATED_PLACEHOLDER_NOT_OBSERVED\n##sequence-region MG_SIM 1 48000\n'+genes.map(g=>`MG_SIM\tCodeXomics-Demo\tCDS\t${g.start}\t${g.end}\t.\t${g.strand}\t0\tID=${g.id};Name=${g.symbol};product=${escapeGff(g.product)};simulation=true`).join('\n')+'\n';
 return `LOCUS       MG_SIM                 48000 bp    DNA     linear   SYN 01-OCT-2026\nDEFINITION  SIMULATED PLACEHOLDER NOT OBSERVED. Interface test only.\nACCESSION   MG_SIM\nFEATURES             Location/Qualifiers\n`+genes.map(g=>`     CDS             ${g.strand==='-'?'complement('+g.start+'..'+g.end+')':g.start+'..'+g.end}\n                     /locus_tag="${g.id}"\n                     /product="${g.product}"\n                     /note="SIMULATED_PLACEHOLDER_NOT_OBSERVED"\n`).join('')+'ORIGIN\n'+(sequence.toLowerCase().match(/.{1,60}/g)||[]).map((line,i)=>String(i*60+1).padStart(9)+' '+line.match(/.{1,10}/g).join(' ')).join('\n')+'\n//\n';
}
async function load(env){if(!env.BUCKET)return null;const cached=snapshotCache.get(env.BUCKET);if(cached&&env.BUCKET.head){const meta=await env.BUCKET.head('snapshot.json');if(meta?.etag===cached.etag)return cached;}const object=await env.BUCKET.get('snapshot.json');if(!object)return null;const loaded={snapshot:validateSnapshot(await object.json()),etag:object.etag};snapshotCache.set(env.BUCKET,loaded);return loaded;}
function publicSnapshot(s){return {...s,genes:s.genes.map(g=>({...g,before:{product:g.before?.product||g.product},proposal:g.proposal?{summary:'Candidate qualifiers available in gene details'}:null}))};}
async function authorized(request,env){
 if(!env.MONITOR_INGEST_TOKEN)return false;
 const value=request.headers.get('authorization')||'';
 if(!value.startsWith('Bearer '))return false;
 const [a,b]=await Promise.all([digest(value.slice(7)),digest(env.MONITOR_INGEST_TOKEN)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
async function body(request){if(Number(request.headers.get('content-length'))>LIMIT)throw Error('Request exceeds 24 MB');const value=await request.text();if(new TextEncoder().encode(value).length>LIMIT)throw Error('Request exceeds 24 MB');return JSON.parse(value);}
async function versionedSnapshot(env){
 const value=await load(env);const snapshot=value?.snapshot||{schemaVersion:1,dataStatus:'observed',source:'No source connected',updatedAt:new Date().toISOString(),genome:{id:'unconfigured',name:'Connect a genome workspace',organism:'',accession:'',length:1,eligibleFeatures:0},genes:[],runs:[],activity:[],releases:[],latestReleaseId:null};
 return {...snapshot,stats:summarize(snapshot),revision:value?.etag||'empty',capabilities:{ingest:!!env.MONITOR_INGEST_TOKEN,liveSource:!!value}};
}
export default {async fetch(request,env={},ctx={}){
 const url=new URL(request.url),path=url.pathname,demo=url.searchParams.get('mode')==='demo';
 try{
  if(path==='/'&&request.method==='GET')return new Response(page,{headers:{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','referrer-policy':'same-origin','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"}});
  if(path==='/favicon.ico')return new Response(null,{status:204});
  if(path==='/api/health')return json({ok:true,storage:!!env.BUCKET,ingestConfigured:!!env.MONITOR_INGEST_TOKEN});
  if(path==='/api/snapshot'&&request.method==='GET'){const s=demo?demoSnapshot():await versionedSnapshot(env);return json({...publicSnapshot(s),stats:summarize(s),revision:demo?'demo-'+Math.floor(Date.now()/7000):s.revision});}
  if(path==='/api/events'&&request.method==='GET'){
   let interval,timer,last='',busy=false,closed=false;const enc=new TextEncoder();
   const stream=new ReadableStream({start(controller){
    const close=()=>{if(closed)return;closed=true;clearInterval(interval);clearTimeout(timer);try{controller.close();}catch{}};
    const emit=async()=>{if(busy||closed)return;busy=true;try{const s=demo?{...demoSnapshot(),revision:'demo-'+Math.floor(Date.now()/7000)}:await versionedSnapshot(env);if(s.revision!==last){last=s.revision;controller.enqueue(enc.encode(`id: ${last}\nevent: snapshot\ndata: ${JSON.stringify({...publicSnapshot(s),stats:summarize(s)})}\n\n`));}else controller.enqueue(enc.encode(': heartbeat\n\n'));}catch{try{controller.enqueue(enc.encode('event: source-error\ndata: {"message":"Snapshot unavailable; retaining last known state"}\n\n'));}catch{close();}}finally{busy=false;}};
    interval=setInterval(emit,3000);timer=setTimeout(close,55000);request.signal.addEventListener('abort',close,{once:true});void emit();
   },cancel(){closed=true;clearInterval(interval);clearTimeout(timer);}});
   return new Response(stream,{headers:{'content-type':'text/event-stream','cache-control':'no-cache','x-accel-buffering':'no'}});
  }
  const geneRoute=path.match(/^\/api\/genes\/([^/]+)$/);
  if(geneRoute&&request.method==='GET'){const s=demo?demoSnapshot():await versionedSnapshot(env);const gene=s.genes.find(g=>g.id===decodeURIComponent(geneRoute[1]));return gene?json(gene):json({error:'Unknown feature'},404);}
  const upload=path.match(/^\/api\/release-files\/([^/]+)\/([^/]+)$/);
  if(upload&&request.method==='PUT'){
   if(!await authorized(request,env))return json({error:'Unauthorized'},401);
   if(!env.BUCKET)return json({error:'Persistent storage unavailable'},503);
   const [,id,format]=upload;if(!safeId(id)||!['gbk','gff3','fasta','evidence','changesets'].includes(format))throw Error('Invalid artifact identity');
   if(Number(request.headers.get('content-length'))>FILE_LIMIT)return json({error:'Artifact exceeds 40 MB'},413);
   const reader=request.body?.getReader();if(!reader)throw Error('Empty upload');let total=0;const chunks=[];while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>FILE_LIMIT){await reader.cancel();return json({error:'Artifact exceeds 40 MB'},413);}chunks.push(value);}
   const bytes=new Uint8Array(total);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
   const sha256=await digest(bytes);const result=await env.BUCKET.put(`releases/${id}/${format}`,bytes,{onlyIf:new Headers({'If-None-Match':'*'}),customMetadata:{sha256}});
   if(!result)return json({error:'Artifact already exists; immutable release IDs cannot be overwritten'},409);
   return json({ok:true,format,bytes:total,sha256},201);
  }
  if(path==='/api/ingest'&&request.method==='POST'){
   if(!await authorized(request,env))return json({error:'Ingest is disabled or unauthorized'},401);
   if(!env.BUCKET)return json({error:'Persistent storage unavailable'},503);
   const incoming=validateSnapshot(await body(request));
   if(incoming.dataStatus!=='observed')return json({error:'Demo data cannot enter the observed snapshot'},400);
   const current=await load(env);if(current&&current.snapshot.genome.id!==incoming.genome.id)return json({error:'Genome identity changed; use a separate storage namespace'},409);if(current&&Date.parse(incoming.updatedAt)<Date.parse(current.snapshot.updatedAt))return json({error:'Stale snapshot rejected'},409);
   const {releases:ignoredReleases,latestReleaseId:ignoredLatest,capabilities:ignoredCaps,...data}=incoming;
   const snapshot={...data,releases:current?.snapshot.releases||[],latestReleaseId:current?.snapshot.latestReleaseId||null};
   // Preserve published release membership; research completion never implies approval.
   for(const g of snapshot.genes){const old=current?.snapshot.genes.find(x=>x.id===g.id);if(old?.reviewStatus==='published'){g.publishedReleaseId=old.releaseId;if(g.reviewStatus==='not_reviewed'&&g.taskId===old.taskId){g.reviewStatus='published';g.releaseId=old.releaseId;}}if(g.reviewStatus==='published'&&!snapshot.releases.some(r=>r.id===g.releaseId))throw Error('Published status has no stored release');}
   const result=await env.BUCKET.put('snapshot.json',JSON.stringify(snapshot),current?{onlyIf:{etagMatches:current.etag}}:{onlyIf:new Headers({'If-None-Match':'*'})});
   if(!result)return json({error:'Concurrent update; reload and retry'},409);
   return json({ok:true,revision:result.etag,genes:snapshot.genes.length});
  }
  if(path==='/api/releases'&&request.method==='POST'){
   if(!await authorized(request,env))return json({error:'Unauthorized'},401);
   if(!env.BUCKET)return json({error:'Persistent storage unavailable'},503);
   const payload=await body(request),r=payload.release,files=payload.files;
   if(!safeId(r?.id)||!['reference','reviewed'].includes(r.kind)||!time(r.publishedAt)||!Array.isArray(files)||!files.length||files.length>5)throw Error('Invalid release package');
   const current=await load(env);if(!current)throw Error('Import a census before publishing a release');
   if(current.snapshot.releases?.some(x=>x.id===r.id))return json({error:'Release IDs are immutable'},409);
   const formats=new Set();let allBytes=0;const descriptors=[];
   for(const f of files){if(!['gbk','gff3','fasta','evidence','changesets'].includes(f.format)||formats.has(f.format)||(!f.uploaded&&typeof f.content!=='string'))throw Error('Invalid file');formats.add(f.format);if(f.uploaded){const metadata=await env.BUCKET.head(`releases/${r.id}/${f.format}`);if(!metadata)throw Error('Staged artifact missing');if(metadata.size>FILE_LIMIT)throw Error('Artifact too large');let sha256=metadata.customMetadata?.sha256;if(!sha256){const object=await env.BUCKET.get(`releases/${r.id}/${f.format}`);sha256=await digest(new Uint8Array(await new Response(object.body).arrayBuffer()));}descriptors.push({format:f.format,bytes:metadata.size,sha256});}else{allBytes+=new TextEncoder().encode(f.content).length;if(allBytes>LIMIT)throw Error('Use staged uploads for large releases');descriptors.push({format:f.format,bytes:new TextEncoder().encode(f.content).length,sha256:await digest(f.content)});}}
   if(!formats.has('gbk')&&!formats.has('gff3'))throw Error('A release must include a full annotation file');
   const reviewedIds=r.reviewedIds||[],changedIds=r.changedIds||[];
   if(!Array.isArray(reviewedIds)||!Array.isArray(changedIds)||new Set(reviewedIds).size!==reviewedIds.length||new Set(changedIds).size!==changedIds.length)throw Error('Invalid reviewed feature list');
   if(r.kind==='reference'&&(reviewedIds.length||changedIds.length))throw Error('A reference snapshot does not establish review');
   for(const id of reviewedIds){const g=current.snapshot.genes.find(x=>x.id===id);if(!g||!['accepted','edited','no_change'].includes(g.reviewStatus))throw Error('Reviewed release requires exported curator decisions');}
   for(const id of changedIds)if(!reviewedIds.includes(id))throw Error('Changed records must be reviewed');
   const manifest={id:r.id,label:String(r.label||r.id).slice(0,200),kind:r.kind,dataStatus:'observed',publishedAt:r.publishedAt,reviewedFeatures:reviewedIds.length,changedFeatures:changedIds.length,reviewedIds,changedIds,files:[...formats],artifacts:descriptors,description:String(r.description||'').slice(0,1000),genomeId:current.snapshot.genome.id};
   for(const f of files){if(f.uploaded)continue;const result=await env.BUCKET.put(`releases/${r.id}/${f.format}`,f.content,{onlyIf:new Headers({'If-None-Match':'*'})});if(!result)return json({error:'Release files already exist; use a new ID'},409);}
   const snapshot=structuredClone(current.snapshot);snapshot.releases=[manifest,...(snapshot.releases||[])];snapshot.latestReleaseId=r.id;
   if(r.kind==='reviewed')for(const g of snapshot.genes)if(reviewedIds.includes(g.id)){g.reviewStatus='published';g.releaseId=r.id;}
   const saved=await env.BUCKET.put('snapshot.json',JSON.stringify(snapshot),{onlyIf:{etagMatches:current.etag}});
   if(!saved)return json({error:'Concurrent update; files staged but release not visible. Retry with a fresh ID.'},409);
   return json({ok:true,release:manifest},201);
  }
  const download=path.match(/^\/api\/releases\/([^/]+)\/files\/([^/]+)$/);
  if(download&&request.method==='GET'){
   const [,id,format]=download;if(!safeId(id)||!['gbk','gff3','fasta','evidence','changesets'].includes(format))return json({error:'Unknown file'},404);
   let content,sha;
   if(demo&&id==='SIM-2026.10.001'&&['gbk','gff3','fasta'].includes(format)){content=demoArtifact(format);sha=await digest(content);}
   else {const current=await load(env);const r=current?.snapshot.releases?.find(x=>x.id===id);if(!r||!r.files.includes(format))return json({error:'No published file'},404);const file=await env.BUCKET.get(`releases/${id}/${format}`);if(!file)return json({error:'Release artifact missing'},503);content=file.body;sha=r.artifacts.find(x=>x.format===format)?.sha256;}
   const ext={gbk:'gbk',gff3:'gff3',fasta:'fasta',evidence:'json',changesets:'json'}[format];return new Response(content,{headers:{'content-type':'text/plain; charset=utf-8','content-disposition':`attachment; filename="${id}.${ext}"`,'cache-control':'private, max-age=3600','x-content-sha256':sha||'','x-content-type-options':'nosniff'}});
  }
  if(path==='/api/export'&&request.method==='GET'){const s=demo?demoSnapshot():await versionedSnapshot(env);return json(s,200,{'content-disposition':`attachment; filename="${demo?'SIMULATED':'observed'}-monitor-snapshot.json"`});}
  return json({error:'Not found'},404);
 }catch(error){return json({error:error.message||'Request failed'},400);}
}};
