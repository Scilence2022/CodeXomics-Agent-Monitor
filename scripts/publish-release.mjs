import {readFile} from 'node:fs/promises';
const base=process.env.MONITOR_URL,token=process.env.MONITOR_INGEST_TOKEN;if(!base||!token)throw Error('Set MONITOR_URL and MONITOR_INGEST_TOKEN');
const u=new URL(base);if(u.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(u.hostname))throw Error('Remote publication requires HTTPS');
const payload=JSON.parse(await readFile(process.argv[2],'utf8'));const headers={authorization:'Bearer '+token,...(process.env.SITES_SERVICE_TOKEN?{'OAI-Sites-Authorization':'Bearer '+process.env.SITES_SERVICE_TOKEN}:{})};
for(const f of payload.files){const bytes=await readFile(f.path);const r=await fetch(new URL(`/api/release-files/${payload.release.id}/${f.format}`,base),{method:'PUT',headers,body:bytes});if(!r.ok&&r.status!==409)throw Error('Upload failed '+r.status);delete f.path;f.uploaded=true;}
const response=await fetch(new URL('/api/releases',base),{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw Error(result.error);console.log('Published immutable release:',result.release.id);
