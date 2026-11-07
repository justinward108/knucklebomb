// Local guided drills: scenario setup and objectives around the real match simulation.
import {newMatch,tick,giveBall,startChallenge,DT} from './sim.js';

export const DRILLS=[
 {id:'pass',title:'Pick your receiver',help:'Find #7. E / LB / TARGET cycles the gold marker. J / Space / A / PASS throws to that teammate.',goal:'Complete a pass to #7.'},
 {id:'shoot',title:'Charge and shoot',help:'Hold K / B / SHOOT to charge. Steer up/down to aim, then release. Beat the goalkeeper; a save or miss means try again.',goal:'Score with a charged shot.'},
 {id:'knuckles',title:'Close in with knuckles',help:'Move toward the carrier. Face them and tap J / A / KNUCKLES inside the small ring. A legal hit slows the carrier even if they keep the ball.',goal:'Land a legal knuckle hit on the carrier.'},
 {id:'chain',title:'Use a defender’s chain',help:'You are a defender. Move within the outer ring, then tap K / B / CHAIN. Chains reach farther than knuckles. Only hit the carrier.',goal:'Land a legal chain hit on the carrier.'},
 {id:'restart',title:'Block, then fight for possession',help:'Face your opponent and hold Shift / RT / BLOCK to stop a punch. Release, then tap J / K / A / B / KNUCKLES to counter. Land three hits to win the ball. The practice opponent leaves longer gaps between punches.',goal:'Block a punch, then win the restart fight.'}
];

export function createPractice(index=0,team=0,attempt=0){
 const drill=DRILLS[index];if(!drill)throw new RangeError('Unknown practice drill');
 const S=newMatch({humans:[team===0,team===1],minutes:10,diff:'normal',seed:500+index*37+attempt,practice:true});
 Object.assign(S,{phase:'play',freeze:0,pending:null,msg:null,cut:null,ev:[]});
 for(const p of S.players){p.bench=999;p.vx=p.vy=0;p.action=null;}
 const player=S.players.find(p=>p.team===team&&p.role===(drill.id==='chain'?'DEF':'FWD'));
 const target=S.players.find(p=>p.team===(drill.id==='pass'?team:1-team)&&p.num===(drill.id==='pass'?7:6));
 const place=(p,x,y)=>{p.bench=0;p.x=team===0?x:105-x;p.y=y;p.face=p.team===0?0:Math.PI;};
 place(player,48,34);S.humans[team]=player.id;
 if(drill.id==='pass'){
  place(target,61,26);place(S.players.find(p=>p.team===team&&p.num===6),61,34);
  // Keep an opposing recipient available for the normal detonation replacement rule.
  place(S.players.find(p=>p.team!==team&&p.role==='DEF'),20,60);giveBall(S,player,30,0);
 }else if(drill.id==='shoot'){
  place(player,87,34);const keeper=S.players.find(p=>p.team!==team&&p.role==='GK');place(keeper,102,34);giveBall(S,player,30,0);
 }else if(drill.id==='restart'){
  place(target,57.5,34);startChallenge(S);
 }else{place(target,drill.id==='chain'?53:52,34);giveBall(S,target,30,0);}
 S.ev=[];
 return {S,index,team,attempt,drill,player:player.id,target:target.id,status:'active',feedback:drill.goal,elapsed:0,shot:false};
}

export function stepPractice(P,input){
 if(P.status!=='active')return;
 const {S,team,drill}=P;
 tick(S,[team===0?input:null,team===1?input:null],intents=>{
  for(const p of S.players){
   if(p.id===S.humans[team])continue;
   if(drill.id==='shoot'&&p.role==='GK')continue;
   if(drill.id==='restart'&&S.challenge?.ids.includes(p.id)){
    if(intents[p.id])intents[p.id].sprint=false;
    continue;
   }
   intents[p.id]={mx:0,my:0};
  }
  return intents;
 });
 if(drill.id==='restart'&&S.challenge){const opponent=S.players[S.challenge.ids[1-team]];if(opponent.action&&opponent.action!==P.lastOpponentAction){P.lastOpponentAction=opponent.action;opponent.cd+=0.8;};}
 P.elapsed+=DT;
 if(drill.id==='restart'&&S.challenge){
  if(S.challenge.blocks[team]>0)P.blocked=true;
  P.feedback=S.challenge.wait>0?'WAIT FOR THE WHISTLE · Get ready for the restart fight.':`${P.blocked?'BLOCK COMPLETE · Release block and counter':'HOLD BLOCK · Face the incoming punch'} · You ${S.challenge.hp[team]}/3 · Opponent ${S.challenge.hp[1-team]}/3`;
 }
 const ball=S.ball,target=S.players[P.target];
 if(ball.state==='air'&&ball.lastTeam===team)P.thrown=true;
 if(ball.kind==='pass'&&ball.receiver===P.target)P.pass=true;
 if(ball.kind==='shot'&&ball.lastTeam===team)P.shot=true;
 let won=false;
 if(drill.id==='pass')won=P.pass&&ball.state==='held'&&ball.holder===P.target&&ball.lastTeam===team;
 if(drill.id==='shoot')won=P.shot&&S.score[team]>0;
 if(drill.id==='knuckles')won=target.slow>0;
 if(drill.id==='chain')won=target.stun>0;
 if(drill.id==='restart')won=P.blocked&&!S.challenge&&ball.state==='held'&&S.players[ball.holder].team===team;
 if(won){P.status='success';P.feedback='Nicely done. '+drill.goal+' You can repeat this drill or continue.';return;}
 let reason='';
 if(S.stats.fouls[team]>0)reason='That hit a player without the ball. Only attack the carrier.';
 else if(!S.players[P.player].alive||!target.alive)reason='The timer ran out. Release the ball before zero.';
 else if(drill.id==='restart'&&!S.challenge)reason=ball.state==='held'&&S.players[ball.holder].team===team?'You won the fight. Repeat the drill and block one punch before winning.':'Your opponent won the fight. Block a punch, release your guard, then counter.';
 else if(drill.id==='shoot'&&P.shot&&ball.state!=='air')reason=S.stats.saves[1-team]?'The goalkeeper saved it. Try aiming toward a corner.':'The shot missed. Try a different aim or charge.';
 else if(drill.id==='pass'&&ball.state==='held'&&ball.holder!==P.player&&ball.holder!==P.target)reason='That reached a different teammate. Cycle the marker to #7 before passing.';
 else if(drill.id==='pass'&&P.thrown&&ball.state==='loose')reason='The pass was not collected. Reset and aim the marker at #7 again.';
 else if(S.phase==='freeze'||S.over)reason='The ball went out of play. Reset and try again.';
 else if(P.elapsed>45)reason='Take another run at it. Move into position and use the action shown above.';
 if(reason){P.status='retry';P.feedback=reason+' Choose Retry drill when ready.';}
}
