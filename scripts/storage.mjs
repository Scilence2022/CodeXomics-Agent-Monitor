import {readFile,writeFile,mkdir,rename,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export class FileBucket {
 constructor(root){this.root=path.resolve(root);this.lock=Promise.resolve();}
 filename(key){if(!/^[A-Za-z0-9_.:/-]+$/.test(key)||key.includes('..'))throw Error('Unsafe storage key');return path.join(this.root,key);}
 async metadata(key){try{return JSON.parse(await readFile(this.filename(key)+'.metadata.json','utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 async get(key){try{const bytes=await readFile(this.filename(key)),etag=hash(bytes),meta=await this.metadata(key);return {etag,size:bytes.length,customMetadata:meta?.etag===etag?meta.customMetadata:{},body:bytes,json:async()=>JSON.parse(bytes),text:async()=>bytes.toString()};}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 async head(key){try{const [s,m]=await Promise.all([stat(this.filename(key)),this.metadata(key)]);if(m&&m.size===s.size&&m.mtimeMs===s.mtimeMs)return m;const bytes=await readFile(this.filename(key));return {etag:hash(bytes),size:bytes.length,customMetadata:{}};}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 async put(key,value,options={}){const operation=this.lock.then(async()=>{const current=await this.head(key),rawCondition=options.onlyIf,cond=rawCondition instanceof Headers?{etagMatches:rawCondition.get('if-match'),etagDoesNotMatch:rawCondition.get('if-none-match')}:rawCondition;if(cond?.etagMatches&&current?.etag!==cond.etagMatches)return null;if(cond?.etagDoesNotMatch==='*'&&current)return null;const target=this.filename(key);await mkdir(path.dirname(target),{recursive:true});const temporary=target+'.tmp-'+randomUUID();await writeFile(temporary,value);await rename(temporary,target);const s=await stat(target);const meta={etag:hash(value),size:s.size,mtimeMs:s.mtimeMs,customMetadata:options.customMetadata||{}};const metaTmp=target+'.metadata.tmp-'+randomUUID();await writeFile(metaTmp,JSON.stringify(meta));await rename(metaTmp,target+'.metadata.json');return meta;});this.lock=operation.catch(()=>{});return operation;}
}
