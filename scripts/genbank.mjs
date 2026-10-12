import {createHash} from 'node:crypto';
const value=(text,key)=>{const m=text.match(new RegExp('^'+key+'\\s+(.+)$','m'));return m?.[1]?.trim()||'';};
export function parseGenBank(text){
 const original=Buffer.isBuffer(text)||text instanceof Uint8Array?Buffer.from(text):Buffer.from(text,'utf8');text=original.toString('utf8');
 if(!text.startsWith('LOCUS')||!text.includes('\nORIGIN'))throw Error('Expected a GenBank file with sequence');
 if((text.match(/^LOCUS\s/gm)||[]).length!==1)throw Error('This version requires one reference sequence per monitor namespace');
 const first=text.split(/\n\/\/\s*/)[0];const accession=value(first,'ACCESSION').split(/\s+/)[0]||value(first,'LOCUS').split(/\s+/)[0];
 const sequence=first.split(/\nORIGIN\s*\n/)[1]?.replace(/[^a-zA-Z]/g,'').toUpperCase();if(!sequence||!/^[ACGTRYKMSWBDHVN]+$/.test(sequence))throw Error('Invalid reference sequence');
 const featureText=first.split(/\nFEATURES[^\n]*\n/)[1]?.split(/\nORIGIN/)[0]||'';
 const sections=featureText.match(/^ {5}\S+[\s\S]*?(?=^ {5}\S+|(?![\s\S]))/gm)||[];const features=[],warnings=[];
 for(const chunk of sections){const lines=chunk.split('\n'),head=lines.shift().match(/^ {5}(\S+)\s+(.+)$/);if(!head)continue;
  const type=head[1];let location=head[2],qualifierText='',qualifying=false;
  for(const line of lines){if(line.trim().startsWith('/'))qualifying=true;if(qualifying)qualifierText+=line.trim()+'\n';else location+=line.trim();}
  location=location.replace(/\s+/g,'');
  const qualifiers={};const groups=qualifierText.match(/\/[A-Za-z_]+(?:=[\s\S]*?)?(?=\n\/[A-Za-z_]+|$)/g)||[];
  for(const entry of groups){const m=entry.match(/^\/([A-Za-z_]+)(?:=([\s\S]*))?$/);if(!m)continue;let v=(m[2]??'true').trim();if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1);v=v.replace(/\n/g,' ').replace(/\s+/g,' ');const old=qualifiers[m[1]];qualifiers[m[1]]=old===undefined?v:Array.isArray(old)?[...old,v]:[old,v];}
  if(/[^\d.,<>()a-z]/i.test(location)||/:|order\(/.test(location)){warnings.push(`${type}: unsupported location ${location}`);continue;}
  const positions=[...location.matchAll(/(\d+)(?:\.\.(\d+))?/g)].map(m=>({start:Number(m[1]),end:Number(m[2]||m[1])}));if(!positions.length)continue;
  const start=Math.min(...positions.map(p=>p.start)),end=Math.max(...positions.map(p=>p.end));if(start<1||end>sequence.length){warnings.push(`${type}: coordinates outside reference`);continue;}
  const strand=location.startsWith('complement(')?'-':'+';if(/complement\(/.test(location)&&strand==='+'){warnings.push(`${type}: mixed strand location unsupported`);continue;}
  const locusTag=(Array.isArray(qualifiers.locus_tag)?qualifiers.locus_tag[0]:qualifiers.locus_tag)||'';const id=locusTag||`feature_${type}_${start}_${end}_${strand==='+'?'p':'m'}`;
  features.push({id,type,seqid:accession,start,end,strand,segments:positions,location,locusTag,symbol:(Array.isArray(qualifiers.gene)?qualifiers.gene[0]:qualifiers.gene)||locusTag||id,product:(Array.isArray(qualifiers.product)?qualifiers.product[0]:qualifiers.product)||'',qualifiers});
 }
 const cds=features.filter(f=>f.type==='CDS');const counts=new Map();for(const f of cds)counts.set(f.id,(counts.get(f.id)||0)+1);for(const f of cds)if(counts.get(f.id)>1)f.id=f.id+'_'+f.start+'_'+f.end+'_'+(f.strand==='+'?'p':'m');const seen=new Set();for(const f of cds){if(seen.has(f.id))throw Error('Duplicate exact CDS features require an explicit stable mapping');seen.add(f.id);}
 return {accession,organism:value(first,'ORGANISM')||first.match(/^\s+ORGANISM\s+(.+)$/m)?.[1]||'',sequence,features,cds,warnings,sha256:createHash('sha256').update(original).digest('hex')};
}
export function toFasta(g){return `>${g.accession} reference sequence\n${g.sequence.match(/.{1,70}/g).join('\n')}\n`;}
const enc=v=>encodeURIComponent(v).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16));
export function toGff(g){
 if(g.warnings.length)throw Error('Unsupported locations: retain GenBank and FASTA; GFF3 disabled');
 const lines=['##gff-version 3',`##sequence-region ${g.accession} 1 ${g.sequence.length}`,'# Converted reference snapshot; not an independently verified annotation release'];
 const IDs=new Map();
 for(const f of g.features){const base=f.type==='CDS'?f.id:f.id+'_'+f.type;const count=IDs.get(base)||0;IDs.set(base,count+1);const id=count?base+'_'+count:base;let consumed=0;const codonOffset=Math.max(0,Number(f.qualifiers.codon_start||1)-1),ordered=f.strand==='-'?[...f.segments].reverse():f.segments;
  for(const p of ordered){const phase=f.type==='CDS'?String(consumed===0?codonOffset:(3-((consumed-codonOffset)%3+3)%3)%3):'.';const attr=['ID='+enc(id),'Name='+enc(f.symbol),...Object.entries(f.qualifiers).map(([k,v])=>`${enc(k)}=${Array.isArray(v)?v.map(enc).join(','):enc(v)}`)].join(';');lines.push([g.accession,'GenBank-reference',f.type,p.start,p.end,'.',f.strand,phase,attr].join('\t'));consumed+=p.end-p.start+1;}
 }
 return lines.join('\n')+'\n';
}
