window.PyStudioBackend={
 base:localStorage.getItem('pystudio_api')||'http://localhost:8000',
 async health(){const r=await fetch(this.base+'/api/health');return r.json()},
 async run(code,timeout=5){const r=await fetch(this.base+'/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,timeout})});return r.json()},
 async projects(){const r=await fetch(this.base+'/api/projects');return r.json()},
 async createProject(name,files){const r=await fetch(this.base+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,files})});return r.json()},
 async ai(prompt,code){const r=await fetch(this.base+'/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,code})});if(!r.ok)throw new Error('AI endpoint unavailable');return r.json()}
};
