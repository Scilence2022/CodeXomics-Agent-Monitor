import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
const html=await readFile('web/index.html','utf8'),css=await readFile('web/style.css','utf8'),js=await readFile('web/app.js','utf8');
const page=html.replace('/* INLINE_CSS */',()=>css).replace('/* INLINE_JS */',()=>js);
const code=(await readFile('worker/index.js','utf8')).replace("import { page } from '../web/page.mjs';",()=>`const page = ${JSON.stringify(page)};`);
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});await writeFile('dist/server/index.js',code);await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json'));console.log('Built self-contained Worker and hosting manifest');
