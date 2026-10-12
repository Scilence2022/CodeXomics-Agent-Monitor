import {observedSnapshot} from './adapter.mjs';
import {FileBucket} from './storage.mjs';
import {sourceSignature} from './source-signature.mjs';
if(process.argv.includes('--stdin-config')){let input='';for await(const chunk of process.stdin)input+=chunk;const config=JSON.parse(input);for(const [key,value]of Object.entries(config))process.env[key]=value;}

const base=process.env.MONITOR_URL,token=process.env.MONITOR_INGEST_TOKEN,service=process.env.SITES_SERVICE_TOKEN;
if(!base||!token)throw Error('Set MONITOR_URL and MONITOR_INGEST_TOKEN');
const origin=new URL(base);if(origin.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(origin.hostname))throw Error('Remote ingestion requires HTTPS');
const headers={'content-type':'application/json',authorization:'Bearer '+token,...(service?{'OAI-Sites-Authorization':'Bearer '+service}:{})};
async function send(endpoint,payload){const r=await fetch(new URL(endpoint,base),{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});if(!r.ok){const e=await r.json().catch(()=>({error:'Request failed'}));throw Error(`${r.status}: ${e.error}`);}return r.json();}
let previousSignature='';
async function tick(){const nextSignature=await sourceSignature(process.env.ANNOTATION_WORKSPACE,process.env.DGR_TASK_FILE);if(nextSignature===previousSignature)return;const snapshot=await observedSnapshot({workspace:process.env.ANNOTATION_WORKSPACE,dgrTaskFile:process.env.DGR_TASK_FILE});await send('/api/ingest',snapshot);previousSignature=nextSignature;console.log('Observed snapshot synchronized');}
await tick();
if(process.argv.includes('--releases')){const bucket=new FileBucket(process.env.MONITOR_DATA_DIR||'.data');const s=await (await bucket.get('snapshot.json')).json();for(const release of [...s.releases].reverse()){const files=[];for(const format of release.files){const content=await (await bucket.get(`releases/${release.id}/${format}`)).text();const uploaded=await fetch(new URL(`/api/release-files/${release.id}/${format}`,base),{method:'PUT',headers:{...headers,'content-type':'text/plain'},body:content,signal:AbortSignal.timeout(120000)});if(!uploaded.ok&&uploaded.status!==409)throw Error('Artifact upload failed '+uploaded.status);files.push({format,uploaded:true});}try{await send('/api/releases',{release,files});console.log('Release synchronized:',release.id);}catch(e){if(!e.message.includes('immutable'))throw e;}}}
if(process.argv.includes('--watch')){let busy=false;setInterval(async()=>{if(busy)return;busy=true;try{await tick();}catch(e){console.error('Bridge:',e.message);}finally{busy=false;}},Number(process.env.MONITOR_INTERVAL_MS||10000));}
