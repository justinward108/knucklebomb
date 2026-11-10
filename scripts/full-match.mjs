// Start the platform's local knucklebomb-exhibition-harness.mjs with this game
// directory as its argument, then run: node scripts/full-match.mjs
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {L,CY,makeView,applySnapshot} from '../js/sim.js';

const origin='http://127.0.0.1:8897';
const endpoint=`${origin}/api/knucklebomb-online`;
const code=randomBytes(4).toString('hex').toUpperCase().replaceAll('0','G').replaceAll('1','H');

async function request(role,operation,fields={}){
 const response=await fetch(endpoint,{
  method:'POST',
  headers:{Origin:origin,Referer:`${origin}/?qa=${role}`,'Content-Type':'application/json'},
  body:JSON.stringify({operation,code,...fields}),
  signal:AbortSignal.timeout(5000)
 });
 const body=await response.json();
 assert(response.ok&&body.ok,`${role} ${operation}: ${response.status} ${body.error??''}`);
 return body.data;
}

function player(room){
 const view=makeView(room.info);
 const input={mx:0,my:0,a:0,b:0,s:0,w:0,n:0,pw:0.85,sp:0};
 return snapshot=>{
  applySnapshot(view,snapshot);
  const {ball,challenge,players}=view;
  const me=players[view.humans[room.team]];
  let target=ball;
  input.sp=0;
  if(challenge){
   target=players[challenge.ids[1-room.team]];
   if(challenge.wait<=0&&Math.hypot(target.x-me.x,target.y-me.y)<1.45)input.a++;
  }else if(ball.state==='held'&&ball.holder===me.id){
   target={x:room.team===0?L:0,y:CY};
   input.sp=1;
   if(view.phase==='play'&&(Math.hypot(target.x-me.x,target.y-me.y)<21||ball.timer<5))input.s++;
  }else if(ball.state==='held'&&players[ball.holder].team!==room.team){
   if(Math.hypot(ball.x-me.x,ball.y-me.y)<(me.hasChain?2.5:1.2))input.b++;
  }
  const dx=target.x-me.x,dy=target.y-me.y;
  const distance=Math.max(1,Math.hypot(dx,dy));
  input.mx=dx/distance;
  input.my=dy/distance;
  return input;
 };
}

let created=false;
let finished=false;
try{
 const waiting=await request('host','create',{team:0,home:'houston',away:'seattle',minutes:3});
 created=true;
 assert.equal(waiting.status,'waiting');
 let guest=await request('guest','join');
 let host=await request('host','state');
 assert.deepEqual([host.status,guest.status],['active','active']);
 assert.deepEqual([host.team,guest.team],[0,1]);
 const hostInput=player(host),guestInput=player(guest);
 const deadline=performance.now()+300_000;
 const shots=[0,0];
 let lastReportedMinute=3;
 while(guest.status==='active'&&performance.now()<deadline){
  const home=hostInput(host.snapshot),away=guestInput(guest.snapshot);
  shots[0]=home.s;
  shots[1]=away.s;
  host=await request('host','state',{input:home});
  guest=await request('guest','state',{input:away});
  const minutesLeft=Math.ceil(guest.snapshot.clk/60);
  if(minutesLeft<lastReportedMinute){
   console.log(`${Math.ceil(guest.snapshot.clk)} seconds left, ${guest.snapshot.sc.join('–')}`);
   lastReportedMinute=minutesLeft;
  }
  if(guest.status==='active')await delay(250);
 }
 assert.equal(guest.status,'complete','Match did not finish within five minutes');
 finished=true;
 assert.equal(guest.snapshot.res.reason,'time','Match must reach the final whistle');
 assert.equal(guest.snapshot.clk,0);
 assert(shots.every(count=>count>0),'Both players must attempt a shot');
 host=await request('host','state');
 assert.equal(host.status,'complete');
 assert.deepEqual(host.snapshot,guest.snapshot,'Both players must see the same final state');
 assert.deepEqual([host.creditAward,guest.creditAward],[0,0]);
 const [homeScore,awayScore]=host.snapshot.sc;
 assert.equal(host.snapshot.res.winner,homeScore===awayScore?-1:homeScore>awayScore?0:1);
 console.log(`PASS: both HTTP clients reached full time and agreed on ${homeScore}–${awayScore}.`);
}finally{
 if(created&&!finished)await request('host','leave').catch(()=>{});
}
