import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {FileBucket} from './storage.mjs';
import {observedSnapshot} from './adapter.mjs';
import {parseGenBank,toFasta,toGff} from './genbank.mjs';
import worker from '../worker/index.js';
export async function importWorkspace({workspace,dgrTaskFile,root='.data',baseline=false}){
 const snapshot=await observedSnapshot({workspace,dgrTaskFile});const token=randomBytes(32).toString('hex'),bucket=new FileBucket(root),env={BUCKET:bucket,MONITOR_INGEST_TOKEN:token};
 const response=await worker.fetch(new Request('http://localhost/api/ingest',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(snapshot)}),env);const imported=await response.json();if(!response.ok)throw Error(imported.error);
 if(baseline){const names=await readdir(workspace),name=names.find(n=>/\.gbk$/i.test(n));const content=await readFile(path.join(workspace,name));const g=parseGenBank(content);const id='REF-'+g.accession+'-'+g.sha256.slice(0,12)+'-v1';const existing=await bucket.get('snapshot.json');const old=await existing.json();
  if(!old.releases.some(r=>r.id===id)){const files=[{format:'gbk',content},{format:'fasta',content:toFasta(g)}];if(!g.warnings.length)files.push({format:'gff3',content:toGff(g)});
   for(const f of files){const uploaded=await worker.fetch(new Request(`http://localhost/api/release-files/${id}/${f.format}`,{method:'PUT',headers:{authorization:'Bearer '+token},body:f.content}),env);if(!uploaded.ok&&uploaded.status!==409)throw Error((await uploaded.json()).error);delete f.content;f.uploaded=true;}
   const r=await worker.fetch(new Request('http://localhost/api/releases',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({release:{id,label:'Current reference annotation snapshot',kind:'reference',publishedAt:new Date().toISOString(),reviewedIds:[],changedIds:[],description:'Full input GenBank reference. Agent proposals are not applied. Independent review coverage has not been established.'},files})}),env);if(!r.ok)throw Error((await r.json()).error);
  }
 }
 return imported;
}
if(process.argv[1]?.endsWith('import-local.mjs')){const workspace=process.env.ANNOTATION_WORKSPACE||process.argv[2],dgrTaskFile=process.env.DGR_TASK_FILE||process.argv[3];try{console.log(JSON.stringify(await importWorkspace({workspace,dgrTaskFile,root:process.env.MONITOR_DATA_DIR||'.data',baseline:true})));}catch(e){console.error(e.message);process.exitCode=1;}}
