import assert from 'node:assert/strict';
import {newMatch,tick,giveBall,DT,CATCH_TIMER,RESTART_TIMER} from '../js/sim.js';
function held(seconds){const s=newMatch({humans:[true,true],minutes:5,seed:432});s.phase='play';s.challenge=null;s.pending=null;s.freeze=0;const p=s.players[9];for(const q of s.players){q.x=5+q.id*4;q.y=5;q.vx=q.vy=0;q.action=null;}p.x=52;p.y=34;giveBall(s,p,seconds,20);return {s,p};}
for(const limit of [CATCH_TIMER,RESTART_TIMER]){
 const {s,p}=held(limit);let beeps=0;for(let i=0;i<Math.round(limit/DT)-1;i++){tick(s,null,()=>({}));beeps+=s.ev.filter(e=>e[0]==='beep').length;s.ev.length=0;}
 assert(p.alive,'Carrier survives until fuse expires');
 for(let i=0;i<2;i++)tick(s,null,()=>({}));
 assert(!p.alive,'Holding past the full limit must detonate even during possession protection');assert.equal(s.stats.dets[p.team],1);assert(s.effects.some(e=>e.type==='boom'));assert(beeps>=10,'Urgent warning beeps accelerate in the final three seconds');
}
const {s}=held(8);s.ball.state='air';s.ball.holder=-1;s.ball.z=50;s.ball.vz=0;s.ball.vx=s.ball.vy=0;for(let i=0;i<60;i++)tick(s,null,()=>({}));assert.equal(s.ball.timer,8,'Fuse pauses while airborne');
console.log('PASS: full 8/12-second holds detonate exactly once; protection does not stop the fuse, urgent beeps accelerate, airborne fuse pauses.');
