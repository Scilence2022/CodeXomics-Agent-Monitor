import {readFileSync} from 'node:fs';
const dir=new URL('./',import.meta.url);
export const page=readFileSync(new URL('index.html',dir),'utf8').replace('/* INLINE_CSS */',()=>readFileSync(new URL('style.css',dir),'utf8')).replace('/* INLINE_JS */',()=>readFileSync(new URL('app.js',dir),'utf8'));
