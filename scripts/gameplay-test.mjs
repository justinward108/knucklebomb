import assert from 'node:assert/strict';
import {newMatch,tick,DT,selectedPassTarget,snapshot,staticInfo,makeView,applySnapshot,startChallenge} from '../js/sim.js';
const idle=()=>({mx:0,my:0,a:0,b:0,s:0,w:0,n:0,pw:0});
const match=(humans=[true,true])=>{const s=newMatch({humans,minutes:5,seed:47});s.phase='play';s.freeze=0;s.pending=null;return s;};
function score(s,team=0){Object.assign(s.ball,{state:'air',holder:-1,x:team?0.1:104.9,y:34,z:2,vx:team?-30:30,vy:0,vz:0,grace:1});tick(s,[idle(),idle()]);assert.equal(s.score[team],1);}
function challenge(s){score(s);for(let i=0;i<170;i++)tick(s,[idle(),idle()]);assert.equal(s.phase,'challenge');return s.challenge.ids;}
for(const defendingTeam of [0,1]){
 const s=match();startChallenge(s);s.challenge.wait=0;const ids=s.challenge.ids;
 s.players[ids[0]].x=51.9;s.players[ids[1]].x=53.1;
 const inputs=[idle(),idle()];inputs[defendingTeam].sp=1;inputs[1-defendingTeam].a=1;
 for(let i=0;i<12;i++)tick(s,inputs);
 assert.deepEqual(s.challenge.hp,[3,3],'Facing block should stop damage');assert.equal(s.challenge.blocks[defendingTeam],1);
 const view=makeView(staticInfo(s));applySnapshot(view,snapshot(s));assert(view.players[ids[defendingTeam]].guard,'Guard must survive snapshots');
 // Releasing the guard allows a later punch to land.
 inputs[defendingTeam].sp=0;
 for(let i=0;i<80;i++)tick(s,inputs);inputs[1-defendingTeam].a=2;
 for(let i=0;i<12;i++)tick(s,inputs);
 assert.equal(s.challenge.hp[defendingTeam],2);
 const back=match();startChallenge(back);back.challenge.wait=0;
 const fighters=back.challenge.ids;back.players[fighters[0]].x=51.9;back.players[fighters[1]].x=53.1;
 back.players[fighters[defendingTeam]].face=defendingTeam===0?Math.PI:0;
 for(let i=0;i<12;i++)tick(back,[defendingTeam===0?{...idle(),sp:1}:{...idle(),a:1},defendingTeam===1?{...idle(),sp:1}:{...idle(),a:1}]);
 assert.equal(back.challenge.hp[defendingTeam],2,'A guard must face the incoming punch');
}
{
 const s=match();startChallenge(s);s.challenge.wait=0;
 const inputs=[{...idle(),sp:1,a:1},{...idle(),sp:1,a:1}];
 for(let i=0;i<120;i++)tick(s,inputs);
 assert.deepEqual(s.challenge.hp,[3,3],'Holding block must prevent punching');
 assert.equal(s.ball.state,'dead','Walking to the ball must not award possession');
}
for(const team of [0,1]){
 const s=match(),ids=challenge(s),fixed=s.players.filter(p=>!ids.includes(p.id)).map(p=>[p.id,p.x,p.y]);
 assert.deepEqual(s.humans,ids);
 const clock=s.clock,timer=s.ball.timer;
 for(let i=0;i<100;i++)tick(s,[idle(),idle()]);
 assert.equal(s.ball.state,'dead');assert.equal(s.clock,clock);assert.equal(s.ball.timer,timer);
 assert.deepEqual(s.challenge.hp,[3,3]);
 const view=makeView(staticInfo(s));applySnapshot(view,snapshot(s));assert.deepEqual(view.challenge.ids,ids);
 assert.deepEqual(view.challenge.hp,[3,3]);
 // Standing at the centre cannot win possession. Only landed punches count.
 s.players[ids[0]].x=51.9;s.players[ids[1]].x=53.1;
 s.players[ids[team]].hasChain=true;
 for(let i=0;i<200&&s.challenge;i++){const inputs=[idle(),idle()];inputs[team].b=1+Math.floor(i/80);tick(s,inputs);}
 assert.equal(s.phase,'play');assert.equal(s.ball.holder,ids[team]);assert.equal(s.ball.timer,30);
 assert.deepEqual(s.stats.fouls,[0,0]);assert(s.players.every(p=>p.alive));
 for(const [id,x,y] of fixed)assert.deepEqual([s.players[id].x,s.players[id].y],[x,y]);
 tick(s,[idle(),idle()]);assert(s.clock<clock);assert(s.ball.timer<30);
}
{
 const s=match([false,false]);challenge(s);for(let i=0;i<1200&&s.challenge;i++)tick(s,null);
 assert.equal(s.phase,'play');assert.equal(s.ball.state,'held');
}
{
 const s=match(),p=s.players[9];s.humans[0]=p.id;
 Object.assign(s.ball,{state:'held',holder:p.id,lastHolder:p.id,lastTeam:0,timer:15,protect:0});
 const before=selectedPassTarget(s,p,1,0),inp={...idle(),mx:1,n:1};tick(s,[inp,idle()]);
 const locked=selectedPassTarget(s,p,-1,0);assert(locked);assert.notEqual(locked.id,before?.id);
 assert.equal(locked.id,s.targets[0]);
 const view=makeView(staticInfo(s));applySnapshot(view,snapshot(s));assert.equal(selectedPassTarget(view,view.players[p.id],-1,0).id,locked.id);
 inp.a=1;tick(s,[inp,idle()]);assert.equal(p.action.it.to,locked.id);
 for(let i=0;i<16;i++)tick(s,[inp,idle()]);assert.equal(s.ball.state,'air');assert.equal(s.ball.receiver,locked.id);
 // A removed/benched target cannot remain selectable.
 locked.alive=false;assert.notEqual(selectedPassTarget(s,p,1,0)?.id,locked.id);
}
{
 const s=match(),p=s.players[s.ball.holder];s.ball.timer=DT/2;s.ball.protect=0;
 tick(s,[idle(),idle()]);assert.equal(p.alive,false);assert(s.cut.sub.includes('NEW BALL TO'));
 const receiver=s.pending.id;for(let i=0;i<182;i++)tick(s,[idle(),idle()]);
 assert.equal(s.ball.holder,receiver);assert.equal(s.ball.state,'held');
}
{
 // Match end at the goal celebration must not create an extra challenge.
 const s=match();s.clock=0.01;score(s);for(let i=0;i<170;i++)tick(s,[idle(),idle()]);
 assert(s.over);assert.equal(s.challenge,null);
}
{
 // Long seeded AI runs catch stalls/invalid holders across repeated restarts.
 for(let seed=1;seed<=8;seed++){
  const s=newMatch({humans:[false,false],minutes:1,seed});
  for(let i=0;i<10000&&!s.over;i++){tick(s,null);assert(Number.isFinite(s.ball.x));if(s.ball.state==='held')assert(s.players[s.ball.holder].alive);}
  assert(s.over,`seed ${seed} did not finish`);
 }
}
console.log('PASS: restart fights, either winner, no fight fouls or deaths, locked passing, snapshots, replacement, full time, and eight complete AI matches.');
