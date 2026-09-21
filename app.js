(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const defaults={"main.py":"# Welcome to PyStudio\nname = 'Python'\nnumbers = [1, 2, 3, 4, 5]\nsquares = [n*n for n in numbers]\nprint(f'Hello, {name}!')\nprint('Squares:', squares)\n","utils.py":"def average(values):\n    return sum(values) / len(values)\n","README.md":"# My Python Project\n\nA Python project built with PyStudio.\n"};
let files=JSON.parse(localStorage.getItem('pystudio-files')||'null')||defaults;
let current='main.py', py=null, worker=null, workerReady=false, pending=new Map(), seq=0, bps=new Set(), lastGlobals={};
const settingsDefault={theme:'dark',accent:'violet',font:'Fira Code',size:15,ai:true,viz:true,wrap:false,autosave:true,aiEndpoint:''};
const cfg=()=>Object.assign({},settingsDefault,JSON.parse(localStorage.getItem('pystudio-settings')||'{}'));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){files[current]=$('#code').value;localStorage.setItem('pystudio-files',JSON.stringify(files));$('#saveState').textContent='Saved';setTimeout(()=>$('#saveState').textContent='',1200);renderTree()}
function dirty(){files[current]=$('#code').value;$('#saveState').textContent='Unsaved';if(cfg().autosave){clearTimeout(window.__save);window.__save=setTimeout(save,600)}}
function apply(s){document.body.className=[s.theme==='light'?'light':'',s.accent==='violet'?'':s.accent].filter(Boolean).join(' ');if(s.theme==='system'&&matchMedia('(prefers-color-scheme:light)').matches)document.body.classList.add('light');$('#code').style.fontFamily=s.font;$('#code').style.fontSize=s.size+'px';$('#fontValue').textContent=s.size;$('#code').classList.toggle('wrap',!!s.wrap)}
function renderTree(){const names=Object.keys(files).sort();$('#tree').innerHTML=names.map(f=>`<div class="file ${f===current?'active':''}" data-file="${esc(f)}">📄 ${esc(f)}<small>${f.endsWith('.py')?'Python source':f.endsWith('.md')?'Markdown':'Project file'}</small></div>`).join('');$$('#tree .file').forEach(x=>x.onclick=()=>openFile(x.dataset.file))}
function openFile(f){if(!(f in files))return;files[current]=$('#code').value;current=f;$('#code').value=files[f];$('#fileName').textContent=f;$('#tabs').innerHTML=`<div class="tab">${f.endsWith('.py')?'🐍':'📄'} ${esc(f)}</div>`;renderTree();update();scan();outline();renderBreakpoints()}
function update(){const lines=$('#code').value.split('\n').length;$('#gutter').textContent=Array.from({length:lines},(_,i)=>String(i+1)).join('\n');pos();renderBreakpoints()}
function pos(){const v=$('#code').value.slice(0,$('#code').selectionStart).split('\n');$('#cursor').textContent=`Ln ${v.length}, Col ${v.at(-1).length+1}`}
$('#code').addEventListener('input',()=>{update();dirty();outline();if(cfg().ai)hint()});$('#code').addEventListener('click',pos);$('#code').addEventListener('keyup',pos);$('#code').addEventListener('scroll',()=>{$('#gutter').scrollTop=$('#code').scrollTop});
$('#gutter').addEventListener('click',e=>{const r=$('#gutter').getBoundingClientRect();const line=Math.floor((e.clientY-r.top+$('#code').scrollTop-13)/($('#code').computedLineHeight||24))+1;if(line>0){bps.has(line)?bps.delete(line):bps.add(line);renderBreakpoints()}});
$('#code').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const t=e.target,s=t.selectionStart,en=t.selectionEnd;t.value=t.value.slice(0,s)+'    '+t.value.slice(en);t.selectionStart=t.selectionEnd=s+4;update();dirty()}if(e.ctrlKey&&e.key.toLowerCase()==='s'){e.preventDefault();save()}if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();run()}if(e.ctrlKey&&e.key===' '){e.preventDefault();complete()}if(e.ctrlKey&&e.key.toLowerCase()==='p'){e.preventDefault();openCommands()}});
const words=['def','return','if','elif','else','for','while','in','import','from','as','class','try','except','finally','with','lambda','yield','async','await','True','False','None','and','or','not','print','len','range','str','int','float','list','dict','set','tuple','sum','min','max','sorted','enumerate','zip','open','input','abs','round','type','isinstance','super','property'];
function complete(){const t=$('#code'),q=t.value.slice(0,t.selectionStart).match(/[A-Za-z_]\w*$/)?.[0]||'',a=words.filter(x=>x.startsWith(q)).slice(0,12);$('#autocomplete').innerHTML=a.map(x=>`<div data-word="${x}"><b>${x}</b><small>Python</small></div>`).join('');$('#autocomplete').classList.toggle('hidden',!a.length);$$('#autocomplete [data-word]').forEach(x=>x.onclick=()=>insert(x.dataset.word))}
function insert(w){const t=$('#code'),s=t.selectionStart,m=t.value.slice(0,s).match(/[A-Za-z_]\w*$/),st=s-(m?m[0].length:0);t.value=t.value.slice(0,st)+w+t.value.slice(s);t.selectionStart=t.selectionEnd=st+w.length;$('#autocomplete').classList.add('hidden');update();dirty();t.focus()}
$('#code').addEventListener('blur',()=>setTimeout(()=>$('#autocomplete').classList.add('hidden'),200));
async function initPython(){if(workerReady||py)return;$('#runtime').textContent='Python: starting…';try{worker=new Worker('worker.js');worker.onmessage=onWorker;worker.onerror=()=>{worker?.terminate();worker=null;fallbackPython()};worker.postMessage({type:'init'})}catch{fallbackPython()}}
let runtimeLoadPromise=null;
async function loadPyodideBrowser(){
  if(window.loadPyodide) return window.loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.28.2/full/'});
  if(runtimeLoadPromise) return runtimeLoadPromise;
  runtimeLoadPromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/pyodide/v0.28.2/full/pyodide.js';
    s.async=true;
    s.onload=()=>window.loadPyodide?resolve(window.loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.28.2/full/'})):reject(new Error('Pyodide loader missing'));
    s.onerror=()=>reject(new Error('Could not download Pyodide. Check internet access.'));
    document.head.appendChild(s);
  });
  return runtimeLoadPromise;
}
async function fallbackPython(){
  try{
    $('#runtime').textContent='Python: downloading runtime…';
    py=await loadPyodideBrowser();
    $('#runtime').textContent='Python: ready ✓'; workerReady=true; $('#status').textContent='● Ready';
  }catch(e){
    $('#runtime').textContent='Python: unavailable';
    $('#status').textContent='● Python unavailable — use Server Python or reconnect';
    console.error(e);
  }
}
async function serverRun(code){
  if(!window.PyStudioBackend) throw new Error('Server bridge unavailable');
  return window.PyStudioBackend.run(code,10);
}
function onWorker(e){const m=e.data;if(m.type==='status'){$('#runtime').textContent=m.value}if(m.type==='ready'){workerReady=true;$('#runtime').textContent='Python: ready ✓';$('#status').textContent='● Ready'}if(m.type==='result'||m.type==='debugResult'||m.type==='error'){const p=pending.get(m.id);if(p){pending.delete(m.id);m.type==='error'?p.reject(new Error(m.message)):p.resolve(m)}}}
function workerCall(msg){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});worker.postMessage(Object.assign({},msg,{id}))})}
async function execute(code){
  if(worker&&workerReady)return workerCall({type:'run',code});
  if(!py) await fallbackPython();
  if(py){
    let out='',err='';
    py.setStdout({batched:s=>out+=s+'\n'}); py.setStderr({batched:s=>err+=s+'\n'});
    let result=await py.runPythonAsync(code);
    return {stdout:out,stderr:err,result:result==null?'':String(result)};
  }
  try{return await serverRun(code)}
  catch(e){throw new Error('Python runtime is unavailable. Open this project with internet access for browser Python, or run the included backend server.')}
}
async function run(){if(!current.endsWith('.py')){setOutput('Only Python files can be run.');return}save();$('#status').textContent='● Running…';$('#output').textContent='';try{const r=await execute($('#code').value);lastGlobals={};setOutput((r.stdout||'')+(r.stderr||'')+(r.result?`\n${r.result}`:''));$('#status').textContent=r.stderr?'● Finished with errors':'● Finished';scan();$('#visualize').click();}catch(e){setOutput(String(e.stack||e));$('#status').textContent='● Error';scan(String(e))}}
function setOutput(s){$('#output').textContent=s||'(no output)';$('#output').scrollTop=$('#output').scrollHeight}
$('#run').onclick=run;$('#saveFile').onclick=save;$('#clear').onclick=()=>setOutput('');
function syntaxCheck(code){const problems=[];const lines=code.split('\n');lines.forEach((l,i)=>{if(/\bTODO\b/.test(l))problems.push([i+1,'TODO marker']);if(/^\s*print\s+[^('"].*/.test(l))problems.push([i+1,'Possible Python 2 print syntax']);if(/except\s*:\s*$/.test(l))problems.push([i+1,'Bare except catches every exception']);});return problems}
function scan(err=''){let p=syntaxCheck($('#code').value);if(err)p.unshift([0,err]);$('#problemList').innerHTML=p.length?p.map(x=>`<div class="problem"><b>${x[0]?'Line '+x[0]:'Python error'}</b><br>${esc(x[1])}</div>`).join(''):'<div class="empty">No detected problems.</div>';$('#count').textContent=p.length}
$('#scan').onclick=()=>scan();
function outline(){const out=[];$('#code').value.split('\n').forEach((l,i)=>{let m=l.match(/^\s*(def|class)\s+([A-Za-z_]\w*)/);if(m)out.push(`<div class="file">▸ ${m[2]}<small>${m[1]} · line ${i+1}</small></div>`)});$('#outlineContent').innerHTML=out.join('')||'<div class="empty">No functions or classes.</div>'}
function renderBreakpoints(){$('#bps').innerHTML=bps.size?[...bps].sort((a,b)=>a-b).map(n=>`<div class="var"><b>Line ${n}</b> <button data-bp="${n}">Remove</button></div>`).join(''):'Click line numbers to add breakpoints.';$$('[data-bp]').forEach(b=>b.onclick=()=>{bps.delete(+b.dataset.bp);renderBreakpoints()})}
async function debugRun(){if(!current.endsWith('.py'))return;$('#debugStatus').textContent='Running…';try{if(worker&&workerReady){const r=await workerCall({type:'debug',code:$('#code').value,breakpoints:[...bps]});setOutput((r.stdout||'')+(r.stderr||''));showDebug(r.hit);$('#debugStatus').textContent=r.hit?`Paused at line ${r.hit.line}`:'Finished'}else{await run();$('#debugStatus').textContent='Debug requires the worker runtime; normal run completed.'}}catch(e){$('#debugStatus').textContent='Error';setOutput(String(e))}}
function showDebug(hit){if(!hit){$('#vars').innerHTML='<div class="empty">No breakpoint was hit.</div>';return}const loc=hit.locals||{};$('#vars').innerHTML=Object.entries(loc).map(([k,v])=>`<div class="var"><b>${esc(k)}</b><br><code>${esc(v)}</code></div>`).join('')}
$('#debugRun').onclick=debugRun;
async function visualize(){if(!cfg().viz){$('#visualContent').innerHTML='<div class="empty">Visualization is disabled in Settings.</div>';return}try{const r=await execute(`import json\n__pystudio_values={}\nfor __n in list(globals()):\n    if not __n.startswith('__'):\n        try:\n            __v=globals()[__n]\n            if not callable(__v) and __n not in ['json']:\n                __pystudio_values[__n]=repr(__v)[:500]\n        except Exception: pass\nprint(json.dumps(__pystudio_values))`);const txt=(r.stdout||'').trim().split('\n').pop();const vals=JSON.parse(txt||'{}');$('#visualContent').innerHTML=Object.entries(vals).map(([k,v])=>`<div class="var"><b>${esc(k)}</b><br><code>${esc(v)}</code></div>`).join('')||'<div class="empty">No variables.</div>'}catch(e){$('#visualContent').innerHTML=`<div class="problem">${esc(e)}</div>`}}
$('#visualize').onclick=()=>{$('[data-view="visual"]').click();visualize()};$('#refresh').onclick=visualize;
function hint(){const c=$('#code').value;let msg='';if(/range\(len\(/.test(c))msg='Consider enumerate(...) when you need indexes and values.';else if(/import \*/.test(c))msg='Avoid wildcard imports; import only what you use.';else if(/except\s*:\s*$/.test(c))msg='Catch a specific exception type.';if(msg){$('#hint').textContent=msg;$('#aiHint').classList.remove('hidden')}else $('#aiHint').classList.add('hidden')}
$('#reject').onclick=()=>$('#aiHint').classList.add('hidden');$('#accept').onclick=()=>{$('#aiHint').classList.add('hidden');$('#status').textContent='● Suggestion reviewed'};
$('#format').onclick=()=>{const before=$('#code').value;const formatted=before.split('\n').map(x=>x.replace(/[ \t]+$/g,'')).join('\n');$('#code').value=formatted;update();dirty();$('#status').textContent=before===formatted?'● Already formatted':'● Trimmed whitespace'};
$('#find').onclick=()=>{const q=prompt('Find text');if(!q)return;const i=$('#code').value.indexOf(q);if(i<0){alert('Not found');return}$('#code').focus();$('#code').selectionStart=i;$('#code').selectionEnd=i+q.length;pos()};
$$('.inspectTabs button').forEach(b=>b.onclick=()=>{$$('.inspectTabs button').forEach(x=>x.classList.remove('selected'));$$('.view').forEach(x=>x.classList.add('hidden'));b.classList.add('selected');$('#'+b.dataset.view).classList.remove('hidden')});
$$('.act[data-pane]').forEach(b=>b.onclick=()=>{$$('.act').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.pane').forEach(x=>x.classList.add('hidden'));$('#'+b.dataset.pane).classList.remove('hidden')});
$('#newFile').onclick=()=>{const f=prompt('New file name','script.py');if(!f||!/^[-\w./]+\.(py|txt|md|json|csv|ipynb)$/.test(f))return alert('Use a supported file name.');if(files[f]!=null)return alert('File already exists.');files[f]='';openFile(f);save()};
$('#newFolder').onclick=()=>{const f=prompt('Folder name (virtual workspace)','src');if(f){const marker=f.replace(/\/$/,'')+'/.gitkeep';if(!files[marker])files[marker]='';save();renderTree()}};
$('#openFile').onclick=()=>$('#fileInput').click();$('#upload').onclick=()=>$('#fileInput').click();$('#fileInput').onchange=e=>[...e.target.files].forEach(f=>{const r=new FileReader;r.onload=()=>{files[f.name]=r.result;openFile(f.name);save()};r.readAsText(f)});
$('#downloadProject').onclick=()=>{const blob=new Blob([JSON.stringify(files,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='pystudio-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
$('#searchBox').oninput=e=>{const q=e.target.value.toLowerCase();let o='';if(q)for(const[f,c]of Object.entries(files))c.split('\n').forEach((l,i)=>{if(l.toLowerCase().includes(q))o+=`<div class="file" data-search="${esc(f)}">${esc(f)}:${i+1}<small>${esc(l.trim())}</small></div>`});$('#searchResults').innerHTML=o||'<div class="empty">No matches.</div>';$$('[data-search]').forEach(x=>x.onclick=()=>openFile(x.dataset.search))};
$('#terminalInput').onkeydown=async e=>{if(e.key!=='Enter')return;const v=e.target.value.trim();e.target.value='';if(!v)return;if(v==='clear'){setOutput('');return}if(v==='help'){setOutput('Commands: help, clear, files, run');return}if(v==='files'){setOutput(Object.keys(files).join('\n'));return}if(v==='run'){await run();return}setOutput(`Unknown command: ${v}\nType help for commands.`)};
let cells=[{type:'code',code:'x = 10\nprint(x * 2)'}];function renderCells(){$('#cells').innerHTML=cells.map((c,i)=>`<div class="cell"><b>${c.type==='code'?'▣':'▤'} Cell ${i+1}</b><textarea data-cell="${i}">${esc(c.code)}</textarea><button data-run-cell="${i}">▶ Run</button></div>`).join('');$$('[data-cell]').forEach(t=>t.oninput=()=>cells[+t.dataset.cell].code=t.value);$$('[data-run-cell]').forEach(b=>b.onclick=async()=>{const r=await execute(cells[+b.dataset.runCell].code);setOutput((r.stdout||'')+(r.stderr||'')+(r.result?`\n${r.result}`:''))})}$('#addCell').onclick=()=>{cells.push({type:'code',code:'# new cell'});renderCells()};$('#addMarkdown').onclick=()=>{cells.push({type:'markdown',code:'## Markdown'});renderCells()};$('#runAll').onclick=async()=>{for(const c of cells){if(c.type==='code'){const r=await execute(c.code);setOutput((r.stdout||'')+(r.stderr||''))}}};
async function askAI(mode){const prompt=$('#aiPrompt').value||mode||'Analyze this code';const endpoint=cfg().aiEndpoint;if(endpoint){try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,code:$('#code').value,mode})});const j=await r.json();$('#aiResult').textContent=j.text||j.response||JSON.stringify(j,null,2);return}catch(e){$('#aiResult').textContent='Configured AI endpoint failed: '+e.message;return}}const p=syntaxCheck($('#code').value);let text=`Local analysis for ${current}\n\n`;if(p.length)text+='Potential issues:\n'+p.map(x=>`• ${x[0]?'Line '+x[0]+': ':''}${x[1]}`).join('\n')+'\n\n';else text+='No issues were detected by the built-in checks.\n\n';text+=`Lines: ${$('#code').value.split('\n').length}\nCharacters: ${$('#code').value.length}\nFunctions/classes: ${($('#code').value.match(/^\s*(def|class)\s+/gm)||[]).length}\n\nThis is an offline analyzer, not a language model.`;$('#aiResult').textContent=text}
$('#ask').onclick=()=>askAI('analyze');$$('.aiTools button').forEach(b=>b.onclick=()=>askAI(b.textContent));
const commands=[['Run Python',run],['Save Project',save],['Scan Problems',()=>scan()],['Open Settings',()=>$('#settings').click()],['Visualize Variables',visualize],['Coding Assistant',()=>$('.act[data-pane="ai"]').click()]];
function openCommands(){$('#commandPalette').classList.remove('hidden');$('#commandInput').value='';renderCommands('');$('#commandInput').focus()}function renderCommands(q){$('#commands').innerHTML=commands.filter(x=>x[0].toLowerCase().includes(q.toLowerCase())).map((x,i)=>`<div class="command" data-cmd="${i}">${esc(x[0])}</div>`).join('');$$('.command').forEach(x=>x.onclick=()=>{commands[+x.dataset.cmd][1]();$('#commandPalette').classList.add('hidden')})}$('#commandInput').oninput=e=>renderCommands(e.target.value);$('#commandInput').onkeydown=e=>{if(e.key==='Escape')$('#commandPalette').classList.add('hidden')};$('#commandPalette').onclick=e=>{if(e.target===e.currentTarget)e.currentTarget.classList.add('hidden')};
$('#settings').onclick=()=>$('#settingsModal').classList.remove('hidden');$('#closeSettings').onclick=()=>$('#settingsModal').classList.add('hidden');$('#settingsModal').onclick=e=>{if(e.target===e.currentTarget)e.currentTarget.classList.add('hidden')};$('#reset').onclick=()=>{localStorage.removeItem('pystudio-settings');loadSettings()};
function loadSettings(){const s=cfg();apply(s);$('#theme').value=s.theme;$('#accent').value=s.accent;$('#font').value=s.font;$('#fontSize').value=s.size;$('#aiOn').checked=s.ai;$('#vizOn').checked=s.viz;$('#wrap').checked=s.wrap;$('#autosave').checked=s.autosave;$('#aiEndpoint').value=s.aiEndpoint}
['theme','accent','font','fontSize','aiOn','vizOn','wrap','autosave','aiEndpoint'].forEach(id=>$('#'+id).addEventListener('input',()=>{const s={theme:$('#theme').value,accent:$('#accent').value,font:$('#font').value,size:+$('#fontSize').value,ai:$('#aiOn').checked,viz:$('#vizOn').checked,wrap:$('#wrap').checked,autosave:$('#autosave').checked,aiEndpoint:$('#aiEndpoint').value.trim()};localStorage.setItem('pystudio-settings',JSON.stringify(s));apply(s)}));
$('#mobileMenu').onclick=()=>$('.sidebar').classList.toggle('open');
function init(){loadSettings();$('#code').value=files[current];$('#fileName').textContent=current;$('#tabs').innerHTML='<div class="tab">🐍 main.py</div>';renderTree();update();scan();outline();renderCells();renderBreakpoints();$('#runtime').textContent='Python: starting in background…';setTimeout(initPython,50)}
init();
})();
