let pyodide=null;
const URL='https://cdn.jsdelivr.net/pyodide/v0.28.2/full/';
self.onmessage=async(e)=>{
 const m=e.data||{};
 try{
  if(m.type==='init'){
   self.postMessage({type:'status',value:'Downloading Python runtime…'});
   importScripts(URL+'pyodide.js');
   self.postMessage({type:'status',value:'Starting Python…'});
   pyodide=await loadPyodide({indexURL:URL});
   self.postMessage({type:'ready'}); return;
  }
  if(!pyodide) throw new Error('Python runtime is not ready');
  if(m.type==='run'){
   let out='',err='';
   pyodide.setStdout({batched:s=>out+=s+'\n'}); pyodide.setStderr({batched:s=>err+=s+'\n'});
   let result=await pyodide.runPythonAsync(m.code);
   self.postMessage({type:'result',id:m.id,stdout:out,stderr:err,result:result==null?'':String(result)}); return;
  }
  if(m.type==='debug'){
   let out='',err='',hit=null;
   pyodide.setStdout({batched:s=>out+=s+'\n'}); pyodide.setStderr({batched:s=>err+=s+'\n'});
   const bp=JSON.stringify(m.breakpoints||[]);
   const wrapped=`import sys\n__pystudio_bp=set(${bp})\n__pystudio_hit=None\ndef __pystudio_trace(frame,event,arg):\n global __pystudio_hit\n if event=='line' and frame.f_code.co_filename=='<string>' and frame.f_lineno in __pystudio_bp:\n  __pystudio_hit={'line':frame.f_lineno,'locals':{k:repr(v)[:300] for k,v in frame.f_locals.items() if not k.startswith('__')}}\n  raise RuntimeError('__PYSTUDIO_BREAK__')\n return __pystudio_trace\nsys.settrace(__pystudio_trace)\ntry:\n`+m.code.split('\n').map(x=>'    '+x).join('\n')+`\nfinally:\n sys.settrace(None)`;
   try{await pyodide.runPythonAsync(wrapped)}catch(x){if(!String(x).includes('__PYSTUDIO_BREAK__'))err+=String(x)}
   try{hit=pyodide.globals.get('__pystudio_hit').toJs()}catch{}
   self.postMessage({type:'debugResult',id:m.id,stdout:out,stderr:err,hit}); return;
  }
 }catch(x){self.postMessage({type:'error',id:m.id,message:String(x&&x.message||x)})}
};