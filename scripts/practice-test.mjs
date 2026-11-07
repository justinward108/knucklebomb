import assert from 'node:assert/strict';
import {createPractice,stepPractice,DRILLS} from '../js/practice.js';
import {payout} from '../js/sim.js';
const idle=()=>({mx:0,my:0,a:0,b:0,s:0,w:0,n:0,pw:0});
function run(p,input,n=180){for(let i=0;i<n&&p.status==='active';i++)stepPractice(p,input);}
for(const team of [0,1]){
 const dx=team===0?1:-1;
 {
  const p=createPractice(0,team),i=idle();i.n=1;stepPractice(p,i);i.a=1;run(p,i);
  assert.equal(p.status,'success','Targeted pass must be completed');
  const time=p.S.t;stepPractice(p,i);assert.equal(p.S.t,time,'Success must pause the drill');
 }
 {
  const p=createPractice(0,team),i={...idle(),a:1};run(p,i);assert.equal(p.status,'retry','Wrong receiver must not pass');
 }
 {
  for(let attempt=1;attempt<8;attempt++){
   const p=createPractice(0,team,attempt),i={...idle(),n:1};stepPractice(p,i);i.a=1;run(p,i,300);
   assert.notEqual(p.status,'active','A missed pass must promptly offer retry');
  }
 }
 {
  let success=false;
  for(let attempt=0;attempt<12;attempt++){const p=createPractice(1,team,attempt);run(p,{...idle(),s:1,pw:0.8,my:0.7},200);success ||= p.status==='success';}
  assert(success,'Shooting must be possible with real accuracy and goalkeeper rules');
 }
 for(const index of [2,3]){
  const p=createPractice(index,team),i=idle();
  // Move within the actual action range, then stop and strike.
  run(p,{...i,mx:dx},index===2?36:40);
  i[index===2?'a':'b']=1;run(p,i,40);assert.equal(p.status,'success',DRILLS[index].id+' must register a legal hit');
 }
 {
  const p=createPractice(4,team);
  let punches=0;
  for(let frame=0;frame<1200&&p.status==='active';frame++){
   const me=p.S.players[p.S.humans[team]],op=p.S.players[p.S.challenge?.ids[1-team]??p.target];
   const distance=Math.abs(me.x-op.x);
   if(p.S.challenge?.wait<=0&&distance<=1.45&&me.cd<=0&&me.stun<=0&&!me.action)punches++;
   stepPractice(p,{...idle(),mx:distance>1.2?Math.sign(op.x-me.x):0,a:punches,sp:p.blocked?0:1});
  }
  assert.equal(p.status,'success','Punching must win the teaching fight');
  const loss=createPractice(4,team);run(loss,idle(),1200);assert.equal(loss.status,'retry','Losing should offer a retry');
 }
 {
  const p=createPractice(0,team);run(p,idle(),1900);assert.equal(p.status,'retry','Timer expiration must be recoverable');
  const fresh=createPractice(0,team,1);assert.equal(fresh.status,'active');assert(fresh.S.players[fresh.player].alive);assert.equal(fresh.S.ctl[team].a,0);
  fresh.S.result={winner:team,reason:'time'};assert.equal(payout(fresh.S,team).total,0,'Practice must award no credits');
 }
}
assert.throws(()=>createPractice(5),RangeError);
console.log('PASS: all five practice drills for both teams, wrong receiver, retry, paused success, recoverable death, and zero practice credits.');
