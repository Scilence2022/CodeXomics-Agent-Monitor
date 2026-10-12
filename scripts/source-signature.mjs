import {readdir,stat} from 'node:fs/promises';
import path from 'node:path';
export async function sourceSignature(workspace,dgrTaskFile){const files=(await readdir(path.join(workspace,'reports'))).filter(n=>/^run-report-.*\.json$/.test(n)).map(n=>path.join(workspace,'reports',n));for(const n of await readdir(workspace))if(/\.gbk$/i.test(n))files.push(path.join(workspace,n));if(dgrTaskFile)files.push(dgrTaskFile);const rows=await Promise.all(files.map(async f=>{const s=await stat(f);return path.basename(f)+':'+s.size+':'+s.mtimeMs;}));return rows.sort().join('|');}
