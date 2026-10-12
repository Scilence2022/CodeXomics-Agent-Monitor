import http from 'node:http';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import worker from '../worker/index.js';
import {FileBucket} from './storage.mjs';
import {importWorkspace} from './import-local.mjs';
import {sourceSignature} from './source-signature.mjs';
const port=Number(process.env.PORT||4178),host=process.env.HOST||'127.0.0.1';const root=process.env.MONITOR_DATA_DIR||'.data';const bucket=new FileBucket(root);
const env={BUCKET:bucket,MONITOR_INGEST_TOKEN:process.env.MONITOR_INGEST_TOKEN};const demo=process.argv.includes('--demo');
const server=http.createServer(async(req,res)=>{const abort=new AbortController();res.on('close',()=>abort.abort());try{
 const bytes=[];let count=0;for await(const chunk of req){count+=chunk.length;if(count>40*1024*1024){res.writeHead(413);res.end('Request too large');return;}bytes.push(chunk);}
 const body=Buffer.concat(bytes);const request=new Request(`http://${host}:${port}${req.url}`,{method:req.method,headers:req.headers,signal:abort.signal,...(body.length?{body,duplex:'half'}:{})});const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));
 if(response.body){const reader=response.body.getReader();while(!abort.signal.aborted){const {value,done}=await reader.read();if(done)break;if(!res.write(Buffer.from(value)))await new Promise(resolve=>res.once('drain',resolve));}await reader.cancel().catch(()=>{});}res.end();
 }catch(e){if(!res.headersSent)res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:e.message}));}});
let watchTimer,busy=false,lastSignature='';
async function signature(){return sourceSignature(process.env.ANNOTATION_WORKSPACE,process.env.DGR_TASK_FILE);}
async function synchronize(){if(busy)return;busy=true;try{const next=await signature();if(next!==lastSignature){await importWorkspace({workspace:process.env.ANNOTATION_WORKSPACE,dgrTaskFile:process.env.DGR_TASK_FILE,root,baseline:!lastSignature});lastSignature=next;console.log('Observed workspace synchronized');}}catch(e){console.error('Source sync failed:',e.message);}finally{busy=false;}}
if(process.env.ANNOTATION_WORKSPACE){await synchronize();watchTimer=setInterval(synchronize,5000);}
server.listen(port,host,()=>console.log(`Local: http://${host}:${port}/${demo?'?mode=demo':''}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(watchTimer);server.closeAllConnections();server.close(()=>process.exit(0));});
