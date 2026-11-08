import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CLUBS,clubPair} from '../js/exhibition-clubs.js';
import {newMatch,tick,staticInfo,makeView,applySnapshot,snapshot,matchTeams,TEAMS,goalContains,CY,GOAL_HW,GOAL_ZLO,GOAL_ZHI} from '../js/sim.js';
const goalCentre=(GOAL_ZLO+GOAL_ZHI)/2;
assert(Math.abs(GOAL_ZHI-GOAL_ZLO-GOAL_HW*2)<1e-9,'Goal aperture is circular');
assert(goalContains(CY,goalCentre));
assert(goalContains(CY+GOAL_HW*0.6,goalCentre+GOAL_HW*0.6));
assert(!goalContains(CY+GOAL_HW*0.9,goalCentre+GOAL_HW*0.9),'Former rectangular corner cannot score');
assert(!goalContains(CY,GOAL_ZLO-0.01));
assert(!goalContains(CY,GOAL_ZHI+0.01));
assert.equal(CLUBS.length,54);assert.equal(new Set(CLUBS.map(c=>c.id)).size,54);
assert.throws(()=>clubPair('houston','houston'),/different/);assert.throws(()=>clubPair('missing','columbus'),/different/);
const original=JSON.stringify(TEAMS);
for(let i=0;i<CLUBS.length;i+=2){
  const pair=clubPair(CLUBS[i].id,CLUBS[i+1].id),state=newMatch({teams:pair,humans:[false,false],minutes:1,seed:700+i});
  assert.equal(matchTeams(state)[0].name,CLUBS[i].full_name);assert.equal(matchTeams(state)[1].name,CLUBS[i+1].full_name);
  pair[0].name='Changed caller';assert.equal(matchTeams(state)[0].name,CLUBS[i].full_name,'Matches snapshot their own clubs');
  for(let n=0;n<10000&&!state.over;n++){tick(state,null);assert(Number.isFinite(state.ball.x));}
  assert(state.over,'Every club must finish a full AI exhibition');
  const view=makeView(staticInfo(state));applySnapshot(view,snapshot(state));assert.deepEqual(matchTeams(view),matchTeams(state));assert.deepEqual(view.score,state.score);
}
assert.equal(JSON.stringify(TEAMS),original,'Choosing clubs must not mutate defaults or another match');
const legacy=newMatch({humans:[true,false],minutes:1,seed:77});assert.equal(matchTeams(legacy)[0].name,'Houston Deacons');
const oldInfo=staticInfo(legacy);delete oldInfo.teams;assert.equal(matchTeams(makeView(oldInfo))[1].name,'Columbus Vanguard');
const source=await readFile(new URL('../js/main.js',import.meta.url),'utf8');
assert.match(source,/mode=watch\?'watch':'local'/);assert.match(source,/mode==='local'\)\{const p=payout/);assert.match(source,/Watched exhibition · no player credit award/);
console.log('PASS: all 54 registered clubs, 27 complete AI exhibitions, club isolation, snapshot parity, legacy defaults, distinct-club validation and spectator reward boundary.');
