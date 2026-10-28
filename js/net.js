/* Knucklebomb network client — talks to the MatchRoom Durable Object.
   Sends inputs at 20Hz (and immediately on any button press); renders server snapshots
   100ms in the past, blending between the two that bracket that moment.
   v1 */
import{SERVER}from'./config.js';
import{makeView,applySnapshot}from'./sim.js';

export function serverBase(){
 if(SERVER)return SERVER.replace(/\/$/,'');
 if(location.protocol==='http:'||location.protocol==='https:')return location.origin;
 return null;
}
export function onlineAvailable(){
 const b=serverBase();if(!b)return false;
 if(SERVER)return true;
 // with no SERVER configured, only a page served by the Worker itself (workers.dev, wrangler dev) has the API
 return /(^localhost$)|(^127\.0\.0\.1$)|(\.workers\.dev$)/.test(location.hostname);
}

export function connectRoom({code,create,team,minutes,pid,token,on}){
 const base=serverBase().replace(/^http/,'ws');
 const q=new URLSearchParams({pid,minutes:String(minutes),team:String(team)});
 if(create)q.set('create','1');if(token)q.set('token',token);
 const ws=new WebSocket(`${base}/api/room/${code}?${q}`);
 const buf=[];let view=null,info=null,latestRecv=0,closed=false;
 ws.onmessage=e=>{
  let m;try{m=JSON.parse(e.data);}catch{return;}
  if(m.type==='s'){buf.push(m.s);latestRecv=performance.now();if(buf.length>40)buf.splice(0,buf.length-40);if(m.s.ev.length)on.events(m.s.ev);return;}
  if(m.type==='info'){info=m.info;view=makeView(info);buf.length=0;on.info(m.info,m.team);return;}
  on.message(m);
 };
 ws.onclose=()=>{if(!closed)on.closed();};
 ws.onerror=()=>{};
 return{
  send(input){if(ws.readyState===1)ws.send(JSON.stringify({type:'in',i:input}));},
  close(){closed=true;try{ws.close();}catch{}},
  /** Fill and return the interpolated view for "now". */
  view(){
   if(!view||!buf.length)return null;
   const last=buf[buf.length-1];
   const est=last.t+(performance.now()-latestRecv)/1000,target=est-0.1;
   let a=buf[0],b=null;
   for(let i=buf.length-1;i>=0;i--){if(buf[i].t<=target){a=buf[i];b=buf[i+1]||null;break;}}
   const alpha=b?Math.min(1,Math.max(0,(target-a.t)/Math.max(0.001,b.t-a.t))):0;
   applySnapshot(view,a,b,alpha);
   return view;
  }
 };
}
