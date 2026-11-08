// Server-simulated, unranked exhibitions over the existing Netlify API.
// One request at a time per player; no client score, result or credit is trusted.
import {makeView,applySnapshot} from './sim.js';
import {CLUBS} from './exhibition-clubs.js';
export function connectExhibition({code,create,team,minutes,home,away,on}){
 let closed=false,busy=false,timer=null,ready=false,view=null,latestInput=null,afterEvent=0,lastSend=0,started=false,finished=false,lastGood=performance.now(),retryDelay=100;
 const frames=[];let latestRecv=0;
 async function request(operation){
  const body={operation,code,...(operation==='create'?{team,minutes,home,away}:{}),...(operation==='state'?{input:latestInput,afterEvent}:{})};
  const response=await fetch('/api/knucklebomb-online',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const payload=await response.json();if(!response.ok||!payload.ok)throw Object.assign(Error(payload.error||'Exhibition connection failed.'),{status:response.status});return payload.data;
 }
 function receive(data){
  if(closed)return;
  lastGood=performance.now();retryDelay=100;
  if(!ready){ready=true;on.message({type:'hello',team:data.team,waiting:data.status==='waiting',clubName:CLUBS.find(c=>c.id===(data.team===0?data.home:data.away))?.full_name});}
  const firstInfo=Boolean(data.info&&!view);if(firstInfo)view=makeView(data.info);
  if(data.snapshot){frames.push(data.snapshot);if(frames.length>20)frames.shift();latestRecv=performance.now();
   if(firstInfo)on.info(data.info,data.team);
   if(!started)started=true;on.message({type:'status',text:''});
   const events=(data.events||[]).filter(e=>e.id>afterEvent);if(events.length)on.events(events.map(e=>e.event));afterEvent=Math.max(afterEvent,data.eventSequence||0);
   if(data.status==='complete')finished=true;
  }
  if(data.status==='closed'){closed=true;on.message({type:'error',text:'The exhibition was closed.'});}
 }
 async function pump(){
  if(closed||busy||finished)return;busy=true;lastSend=performance.now();
  try{receive(await request('state'));}
  catch(error){if([400,401,403,404,409].includes(error.status)||performance.now()-lastGood>=12000){closed=true;on.message({type:'status',text:error.message});on.closed();}else{retryDelay=500;on.message({type:'status',text:'Connection interrupted. Reconnecting…'});}}
  finally{busy=false;if(!closed&&!finished)timer=setTimeout(pump,retryDelay);}
 }
 (async()=>{busy=true;try{receive(await request(create?'create':'join'));}catch(error){closed=true;on.message({type:'error',text:error.message});}finally{busy=false;if(!closed&&!finished)timer=setTimeout(pump,100);}})();
 return {
  send(input){latestInput=input;if(!busy&&!closed&&!finished&&performance.now()-lastSend>100){clearTimeout(timer);pump();}},
  close(){if(closed)return;closed=true;clearTimeout(timer);request('leave').catch(()=>{});},
  view(){if(!view||!frames.length)return null;const last=frames.at(-1),target=last.t+(performance.now()-latestRecv)/1000-.15;let a=frames[0],b=null;for(let i=frames.length-1;i>=0;i--)if(frames[i].t<=target){a=frames[i];b=frames[i+1]||null;break;}if(finished)a=last,b=null;applySnapshot(view,a,b,b?Math.max(0,Math.min(1,(target-a.t)/Math.max(.001,b.t-a.t))):0);return view;}
 };
}
