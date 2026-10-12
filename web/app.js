const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v==null?'Not recorded':new Intl.NumberFormat('en-US').format(v);
const date=v=>v?new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const stateLabel=s=>({unprocessed:'Unprocessed',queued:'Queued',researching:'Researching',synthesizing:'Synthesizing',validating:'Validating',completed:'Completed',failed:'Failed',cancelled:'Cancelled',not_reviewed:'Not reviewed',pending:'Pending review',accepted:'Accepted',edited:'Edited',rejected:'Rejected',no_change:'No change',insufficient_evidence:'Insufficient evidence',published:'Published'}[s]||s);
const isActive=g=>['researching','synthesizing','validating'].includes(g.jobStatus);
const cls=s=>['researching','synthesizing','validating'].includes(s)?'active':s;
const badge=s=>`<span class="badge ${esc(cls(s))}">${esc(stateLabel(s))}</span>`;
const params=new URLSearchParams(location.search);
let mode=params.get('mode')==='demo'?'demo':'observed',snapshot=null,tab=params.get('tab')||'activity',selected=params.get('gene')||null,pageIndex=0,stream=null,pollTimer=null,detailCache=new Map();
const headings={activity:['Agent activity','A living record of genome maintenance'],genome:['Genome & genes','Every gene, every maintenance decision'],runs:['Run history','A traceable history of research runs'],releases:['Releases & downloads','Versioned genomes, ready to inspect']};
function api(path){return path+(path.includes('?')?'&':'?')+'mode='+mode;}
function updateUrl(){const p=new URLSearchParams();if(mode==='demo')p.set('mode','demo');if(tab!=='activity')p.set('tab',tab);if(selected)p.set('gene',selected);history.replaceState(null,'','/?'+p.toString());}
function setTab(value){tab=headings[value]?value:'activity';for(const name of Object.keys(headings)){$('panel-'+name).hidden=name!==tab;document.querySelector(`[data-tab="${name}"]`).classList.toggle('selected',name===tab);} $('section-name').textContent=headings[tab][0];$('page-title').textContent=headings[tab][1];updateUrl();}
function connection(text,kind=''){const e=$('connection');e.textContent=text;e.className='connection '+kind;}
function error(message){$('error-banner').hidden=!message;$('error-banner').textContent=message||'';}
function empty(text){return `<div class="empty-state">${esc(text)}</div>`;}
function bindGeneLinks(root){root.querySelectorAll('[data-gene]').forEach(b=>b.addEventListener('click',()=>selectGene(b.dataset.gene)));}
function selectGene(id){selected=id;setTab('genome');renderGenes();renderDetail();updateUrl();}
function apply(data){
 if(data.dataStatus!==(mode==='demo'?'simulated':'observed'))throw Error('Data mode mismatch; snapshot rejected');
 snapshot=data;error('');render();
}
function render(){
 const s=snapshot,stats=s.stats||{};const release=s.releases?.find(r=>r.id===s.latestReleaseId);
 $('genome-subtitle').textContent=`${s.genome.organism||s.genome.name} · ${s.genome.accession||s.genome.id} · ${num(s.genome.length)} bp · ${num(s.genes.length)} eligible CDS features`;
 const banner=$('data-banner');banner.className='notice '+(mode==='demo'?'demo':s.genes.length?'':'empty');
 banner.textContent=mode==='demo'?'SIMULATED DEMONSTRATION — no real agent executions or biological findings. Download files are synthetic and explicitly labeled.':s.genes.length?'OBSERVED DATA · '+s.source+' · Research completion does not establish curator approval or annotation correctness.':'No observed source is connected. Use the local importer or authenticated bridge. Demo mode is separate.';
 if(mode!=='demo'&&s.genome.unmappedRecords)banner.textContent+=` ${num(s.genome.unmappedRecords)} task entries could not be mapped to an exact eligible feature; their outcomes were not guessed.`;
 $('mode-toggle').textContent=mode==='demo'?'Switch to observed data':'Switch to demo';
 $('metric-completed').textContent=`${num(stats.completed||0)} / ${num(stats.eligible||0)}`;$('metric-active').textContent=num(stats.active||0);$('metric-pending').textContent=num(stats.pending||0);$('metric-published').textContent=num(release?.changedFeatures||0);
 $('coverage-label').textContent=`${((stats.coverage||0)*100).toFixed(1)}% in the latest feature states`;
 $('coverage-value').textContent=((stats.coverage||0)*100).toFixed(1)+'%';$('coverage-bar').style.width=(stats.coverage||0)*100+'%';
 $('state-counts').innerHTML=[['Active',stats.active],['Queued',stats.queued],['Research completed',stats.completed],['Failed',stats.failed],['No justified change',stats.byReview?.no_change],['Insufficient evidence',stats.byReview?.insufficient_evidence],['Unprocessed',stats.byJob?.unprocessed]].map(([k,v])=>`<div><span>${k}</span><strong>${num(v||0)}</strong></div>`).join('');
 $('last-updated').textContent=`Snapshot ${date(s.updatedAt)} · ${s.dataStatus.toUpperCase()}`;
 $('export-snapshot').href=api('/api/export');
 renderAgents();renderFeed();renderMap();renderGenes();renderDetail();renderRuns();renderReleases();
 $('release-summary').innerHTML=release?`<strong>${esc(release.id)}</strong><p>${esc(release.description)}</p><p>${num(release.reviewedFeatures)} reviewed · ${num(release.changedFeatures)} changed</p><button class="button secondary" id="release-mini-link">Inspect release →</button>`:empty('No released annotation snapshot is available. Research proposals remain separate.');
 $('release-mini-link')?.addEventListener('click',()=>setTab('releases'));
}
function renderAgents(){
 const active=snapshot.genes.filter(isActive);$('active-label').textContent=`${num(active.length)} active feature investigations`;
 $('agents').innerHTML=active.length?active.slice(0,12).map(g=>`<article class="agent-card"><div class="agent-head"><span class="dot"></span>${esc(g.agent||'Research agent')}</div><button class="gene-link" data-gene="${esc(g.id)}">${esc(g.symbol||g.locusTag)}</button><div class="stage">${esc(g.step||stateLabel(g.jobStatus))}</div><div class="meter" role="progressbar" aria-label="Reported task progress for ${esc(g.id)}" aria-valuenow="${g.progress}" aria-valuemin="0" aria-valuemax="100"><div style="width:${g.progress}%"></div></div><div class="agent-meta"><span>${esc(g.locusTag)}</span><span>${g.progress}% reported</span></div></article>`).join(''):empty(mode==='demo'?'Demo agents have finished proposal preparation and are awaiting review.':'No active task is present in the latest exported state. This does not mean all genes are reviewed.');
 bindGeneLinks($('agents'));
}
function renderFeed(){
 const events=snapshot.activity||[];$('activity-feed').innerHTML=events.length?events.slice(0,14).map(e=>{const g=snapshot.genes.find(g=>g.id===e.geneId);return `<div class="feed-row"><div class="feed-time">${esc(date(e.at))}</div><div class="feed-content"><button class="gene-link" data-gene="${esc(e.geneId)}">${esc(g?.symbol||e.geneId)}</button> <span class="muted">${esc(e.agent)}</span><br>${esc(e.stage)}</div>${badge(e.status)}</div>`;}).join(''):empty('No activity events have been exported.');bindGeneLinks($('activity-feed'));
}
function renderMap(){
 // Aggregate dense genomes into position bins; drill-down uses an exact feature ID.
 const genes=snapshot.genes,binCount=Math.min(240,genes.length),bins=Array.from({length:binCount},()=>[]);
 for(const g of genes){const bin=Math.min(binCount-1,Math.floor((g.start-1)/snapshot.genome.length*binCount));if(bin>=0)bins[bin].push(g);}
 $('genome-map').innerHTML=binCount?`<div class="map-grid">${bins.map((list,i)=>{const g=list.find(isActive)||list.find(g=>g.reviewStatus==='pending')||list.find(g=>g.reviewStatus==='published')||list.find(g=>g.jobStatus==='failed')||list[0];const color=g?(isActive(g)?'active':g.reviewStatus==='pending'?'pending':g.reviewStatus==='published'?'published':g.jobStatus==='failed'?'failed':''):'';const label=`Region ${i+1}, ${list.length} eligible CDS features${g?', representative '+g.symbol+', '+stateLabel(g.jobStatus):''}`;return `<button class="map-cell ${color} ${list.some(g=>g.id===selected)?'selected':''}" ${g?`data-gene="${esc(g.id)}"`: 'disabled'} aria-label="${esc(label)}" title="${esc(label)}"></button>`;}).join('')}</div><div class="map-scale"><span>1 bp</span><span>${num(snapshot.genome.length)} bp</span></div>`:empty('Import a reference census to display genome maintenance coverage.');bindGeneLinks($('genome-map'));
}
function filteredGenes(){const search=$('gene-search').value.trim().toLowerCase(),job=$('job-filter').value,review=$('review-filter').value;return snapshot.genes.filter(g=>(!search||[g.symbol,g.locusTag,g.product,g.id].join(' ').toLowerCase().includes(search))&&(!job||(job==='active'?isActive(g):g.jobStatus===job))&&(!review||g.reviewStatus===review));}
function renderGenes(){if(!snapshot)return;const all=filteredGenes(),size=35,max=Math.max(0,Math.ceil(all.length/size)-1);pageIndex=Math.min(pageIndex,max);const rows=all.slice(pageIndex*size,(pageIndex+1)*size);
 $('gene-rows').innerHTML=rows.length?rows.map(g=>`<tr><td><button class="gene-link" data-gene="${esc(g.id)}">${esc(g.symbol||g.locusTag)}</button><small>${esc(g.locusTag||g.id)}</small></td><td>${num(g.start)}–${num(g.end)}<small>${esc(g.strand)} strand</small></td><td>${badge(g.jobStatus)}</td><td>${badge(g.reviewStatus)}</td></tr>`).join(''):'<tr><td colspan="4">No genes match these filters.</td></tr>';
 $('gene-page-label').textContent=`${num(all.length)} matching records · page ${pageIndex+1} of ${max+1}`;$('previous').disabled=pageIndex===0;$('next').disabled=pageIndex>=max;bindGeneLinks($('gene-rows'));
}
function qualifier(value){if(!value)return 'Not available';return typeof value==='string'?value:JSON.stringify(value,null,2);}
function renderDetail(){
 let g=snapshot.genes.find(g=>g.id===selected);if(g){const key=mode+':'+g.id+':'+g.updatedAt;const cached=detailCache.get(key);if(cached)g=cached;else{const captured=g.id;if(detailCache.size>80)detailCache.clear();detailCache.set(key,g);fetch(api('/api/genes/'+encodeURIComponent(g.id))).then(r=>{if(!r.ok)throw Error('Gene details unavailable');return r.json();}).then(data=>{detailCache.set(key,data);if(selected===captured)renderDetail();}).catch(e=>error(e.message));}}if(!g){$('gene-detail').innerHTML='<p class="muted">Select a gene to inspect its research and annotation state.</p>';return;}
 const links=(g.references||[]).filter(s=>s.title||s.pmid||s.doi).map(s=>{const url=/^https?:\/\//.test(s.url||'')?s.url:s.pmid?'https://pubmed.ncbi.nlm.nih.gov/'+encodeURIComponent(s.pmid)+'/':s.doi?'https://doi.org/'+encodeURIComponent(s.doi):null;return `<li>${url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(s.title||s.pmid||s.doi)}</a>`:esc(s.title)}</li>`;}).join('');
 $('gene-detail').innerHTML=`<div class="detail-top"><h2>${esc(g.symbol||g.locusTag)}</h2>${badge(g.reviewStatus)}</div><p class="small muted">${esc(g.locusTag)} · ${esc(g.id)}</p><dl><dt>Coordinates</dt><dd>${esc(g.seqid)}:${num(g.start)}–${num(g.end)} (${esc(g.strand)})</dd><dt>Location</dt><dd>${esc(g.location||'Simple interval')}</dd><dt>Research</dt><dd>${esc(stateLabel(g.jobStatus))} · ${g.progress}% reported</dd><dt>Stage</dt><dd>${esc(g.step||'No task recorded')}</dd><dt>Task</dt><dd>${esc(g.taskId||'Not assigned')}</dd><dt>ChangeSet</dt><dd>${esc(g.changeSetId||'Not recorded')}</dd><dt>Sources</dt><dd>${num(g.referenceCount||0)}</dd><dt>DGR tokens</dt><dd>${num(g.tokens)}</dd><dt>Duration</dt><dd>${g.runtimeSeconds==null?'Not recorded':(g.runtimeSeconds/60).toFixed(1)+' min'}</dd><dt>Release</dt><dd>${esc(g.releaseId||g.publishedReleaseId||'Not published')}</dd></dl><div class="detail-label">Current reference qualifier</div><div class="qualifiers">${esc(g.before?.product||g.product||'Not provided')}</div><details class="small"><summary>Full exported reference qualifiers</summary><pre class="qualifiers">${esc(qualifier(g.before))}</pre></details><div class="detail-label">Candidate change · requires review</div><div class="qualifiers proposal">${esc(qualifier(g.proposal))}</div><div class="detail-label">Curator decision</div><p class="small">${esc(g.reviewDecision||'No independent approval record was exported.')}</p><div class="detail-label">Supporting sources</div>${links?`<ol class="sources">${links}</ol>`:'<p class="small muted">No source-level citations were exported for this record.</p>'}<button class="button secondary" id="copy-gene-link">Copy stable link</button>`;
 $('copy-gene-link').addEventListener('click',async e=>{try{await navigator.clipboard.writeText(location.href);e.target.textContent='Link copied';}catch{e.target.textContent='Copy the address from your browser';}});
}
function renderRuns(){const runs=snapshot.runs||[];$('run-rows').innerHTML=runs.length?runs.map(r=>`<tr><td>${esc(r.label||r.id)}<small>${esc(r.id)}</small></td><td>${num(r.selected)}</td><td>${num(r.completed)}</td><td>${num(r.failed)}</td><td>${num(r.tokens)}</td><td>${r.costCny==null?'Not recorded':'CNY '+Number(r.costCny).toFixed(2)}</td><td>${esc(date(r.finishedAt))}</td></tr>`).join(''):'<tr><td colspan="7">No run history available.</td></tr>';}
function renderReleases(){const releases=snapshot.releases||[];$('release-list').innerHTML=releases.length?releases.map(r=>`<article class="release-card"><div class="release-top"><div><span class="eyebrow">${r.id===snapshot.latestReleaseId?'LATEST FROZEN SNAPSHOT':'ARCHIVED SNAPSHOT'}</span><div class="release-id">${esc(r.id)}</div></div><span class="badge ${r.dataStatus==='simulated'?'pending':r.kind==='reference'?'':'published'}">${r.dataStatus==='simulated'?'SIMULATED':r.kind==='reference'?'Reference snapshot · review not established':'Reviewed release'}</span></div><p>${esc(r.description||r.label)}</p><div class="release-stats"><span>Published ${esc(date(r.publishedAt))}</span><span>${num(r.reviewedFeatures)} reviewed features</span><span>${num(r.changedFeatures)} changed records</span></div><div class="release-files">${r.files.map(f=>`<a class="button ${f==='gbk'?'primary':'secondary'}" href="${esc(api('/api/releases/'+encodeURIComponent(r.id)+'/files/'+f))}" download>${({gbk:'Full GenBank',gff3:'Full GFF3',fasta:'Reference FASTA',evidence:'Evidence manifest',changesets:'ChangeSets'})[f]||esc(f)} ↓</a>`).join('')}</div>${r.artifacts?.length?`<div class="hash-list">${r.artifacts.map(f=>`<div>${esc(f.format.toUpperCase())} · ${num(f.bytes)} bytes · SHA-256 <code>${esc(f.sha256)}</code></div>`).join('')}</div>`:''}</article>`).join(''):empty('No immutable annotation release is available. An importer can publish an unchanged reference snapshot; reviewed updates require an explicit release package with curator decisions.');}
async function fetchSnapshot(){const response=await fetch(api('/api/snapshot'));if(!response.ok)throw Error('Snapshot request failed ('+response.status+')');apply(await response.json());}
function stop(){stream?.close();stream=null;clearInterval(pollTimer);pollTimer=null;}
function connect(){
 stop();stream=new EventSource(api('/api/events'));
 stream.onopen=()=>{clearInterval(pollTimer);pollTimer=null;connection(mode==='demo'?'Demo stream':'Observed snapshot stream','online');};
 stream.addEventListener('snapshot',e=>{try{apply(JSON.parse(e.data));connection(mode==='demo'?'Demo stream':'Observed snapshot stream','online');}catch(err){error(err.message);}});
 stream.addEventListener('source-error',()=>{error('Source temporarily unavailable. Last known state is retained.');connection('Source unavailable','offline');});
 stream.onerror=()=>{connection('Reconnecting · polling','offline');if(!pollTimer)pollTimer=setInterval(()=>fetchSnapshot().then(()=>connection('Polling source','online')).catch(e=>{error(e.message);connection('Source unavailable','offline');}),5000);};
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
$('latest-download').addEventListener('click',e=>{e.preventDefault();setTab('releases');});
$('mode-toggle').addEventListener('click',async()=>{stop();mode=mode==='demo'?'observed':'demo';selected=null;pageIndex=0;updateUrl();connection('Connecting');try{await fetchSnapshot();connect();}catch(e){error(e.message);connection('Source unavailable','offline');}});
for(const id of ['gene-search','job-filter','review-filter'])$(id).addEventListener(id==='gene-search'?'input':'change',()=>{pageIndex=0;renderGenes();});
$('previous').addEventListener('click',()=>{pageIndex--;renderGenes();});$('next').addEventListener('click',()=>{pageIndex++;renderGenes();});
setTab(tab);fetchSnapshot().then(connect).catch(e=>{error(e.message);connection('Source unavailable','offline');});
window.addEventListener('pagehide',stop);
