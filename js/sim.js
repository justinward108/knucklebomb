/* Knucklebomb — shared match simulation.
   Runs unchanged in the browser (single-player) and in the Cloudflare
   Durable Object (online). No DOM, no timers, no Math.random: every random
   draw comes from S.rnd so a match is reproducible from its seed.
   v2: two-human support (S.humans per team), button-count inputs, snapshots, credits. */
/* =====================================================================
   SIMULATION — pure state + fixed-step update. No DOM, no rendering.
   Everything the match needs is in S; intents in, state out. This is the
   part that later runs on the online server unchanged.
   ===================================================================== */
const L=105, W=68, CX=L/2, CY=W/2, G=9.8, DT=1/60;
const GOAL_HW=2.6, GOAL_ZLO=0.9, GOAL_ZHI=3.1, BOX_R=9;
const RESTART_TIMER=30, CATCH_TIMER=15, MIN_PLAYERS=7, SINBIN=20;

const TEAMS=[
 {name:'Houston Deacons',short:'DEACONS',abbr:'HOU',kit:'#f3efe2',kit2:'#d6a422',shorts:'#d6a422',num:'#6e520b',gk:'#2f8a6c',gk2:'#123d31',coach:'#5a636f',style:7.5},
 {name:'Columbus Vanguard',short:'VANGUARD',abbr:'CLB',kit:'#1a1b21',kit2:'#cf2730',shorts:'#cf2730',num:'#f2f2f2',gk:'#7650c2',gk2:'#2d1f55',coach:'#24262b',style:5.0}
];
// [role, teamFrameX, y, shirt]
const FORM=[['GK',3,34,1],['DEF',19,10,2],['DEF',16,27,4],['DEF',16,41,5],['DEF',19,58,3],
 ['MID',34,12,7],['MID',32,28,6],['MID',32,40,8],['MID',34,56,11],['FWD',46,27,9],['FWD',46,41,10]];
const SKINS=['#8d5a3b','#c68a62','#e0b08a','#6b4430','#f0c9a6','#a46b47','#7a4b2e','#d9a07a'];
const DIFF={
 easy:  {acc:1.6, react:0.40,gkDelay:0.42,strip:0.16,intercept:0.28,gkSkill:0.78},
 normal:{acc:1.0, react:0.24,gkDelay:0.26,strip:0.24,intercept:0.42,gkSkill:1.0},
 hard:  {acc:0.72,react:0.13,gkDelay:0.15,strip:0.32,intercept:0.56,gkSkill:1.12}};
const MATE={acc:0.9,react:0.22,gkDelay:0.24,strip:0.34,intercept:0.45,gkSkill:1.0};

const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const tf=(team,x)=>team===0?x:L-x;
const atkX=team=>team===0?L:0, ownX=team=>team===0?0:L, dirX=team=>team===0?1:-1;
function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function gauss(S){const u=S.rnd()||1e-9,v=S.rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(6.283185*v);}
function segDist(p,a,b){const vx=b.x-a.x,vy=b.y-a.y,l2=vx*vx+vy*vy||1;const t=clamp(((p.x-a.x)*vx+(p.y-a.y)*vy)/l2,0,1);return Math.hypot(a.x+vx*t-p.x,a.y+vy*t-p.y);}
const onPitch=p=>p.alive&&p.bench<=0;
function aliveCount(S,team){let n=0;for(const p of S.players)if(p.team===team&&p.alive)n++;return n;}
function nearest(S,team,x,y,noGK,exclude){let best=null,bd=1e9;
 for(const p of S.players){if(p.team!==team||!onPitch(p)||(noGK&&p.role==='GK')||p.id===exclude)continue;const d=Math.hypot(p.x-x,p.y-y);if(d<bd){bd=d;best=p;}}
 if(!best&&noGK)return nearest(S,team,x,y,false,exclude);return best;}
function ev(S,name,arg){S.ev.push([name,arg]);}

function newMatch(opts){
 const S={opts,t:0,clock:opts.minutes*60,score:[0,0],players:[],phase:'play',freeze:0,pending:null,msg:null,
  effects:[],scorches:[],over:false,result:null,stats:{goals:[0,0],dets:[0,0],beheads:[0,0],fouls:[0,0],saves:[0,0]},
  rnd:rng(opts.seed||1),shake:0,cut:null,ev:[],humans:[-1,-1],lastPoss:[-1,-1],ctl:[{a:0,b:0,s:0,w:0},{a:0,b:0,s:0,w:0}]};
 const hm=opts.humans||[false,false];
 // a human's side plays with MATE teammates; an AI side plays at the chosen difficulty; demo = both normal
 S.tp=[0,1].map(t=>hm[t]?MATE:(hm[0]||hm[1])?DIFF[opts.diff||'normal']:DIFF.normal);
 S.ball={state:'dead',holder:-1,x:CX,y:CY,z:1,vx:0,vy:0,vz:0,timer:RESTART_TIMER,lastHolder:-1,lastTeam:-1,thrower:-1,kind:null,receiver:-1,grace:0,rolled:new Set(),protect:0};
 let id=0;
 for(const team of [0,1])FORM.forEach((f,slot)=>{S.players.push({id:id++,team,slot,role:f[0],num:f[3],x:tf(team,f[1]),y:f[2],vx:0,vy:0,
   face:team===0?0:Math.PI,alive:true,bench:0,stun:0,slow:0,cd:0,action:null,stamina:1,run:S.rnd()*6,hasChain:f[0]==='DEF',
   skin:SKINS[Math.floor(S.rnd()*SKINS.length)],ai:{think:0,wait:0,seen:0,hold:0}});});
 const first=S.rnd()<0.5?0:1;
 doRestart(S,first,RESTART_TIMER);
 S.msg={text:'KICKOFF',sub:`${TEAMS[first].short} BALL · ${RESTART_TIMER}-SECOND OPENING THROW`,t:2.2};
 setFreeze(S,2.2,null);
 for(const t of [0,1])if(hm[t])S.humans[t]=S.players.find(p=>p.team===t&&p.num===9).id;
 ev(S,'whistle');
 return S;
}
function placeFormation(S){for(const p of S.players){if(!onPitch(p))continue;const f=FORM[p.slot];p.x=tf(p.team,f[1]);p.y=f[2];p.vx=p.vy=0;p.action=null;p.stun=0;p.slow=0;p.face=p.team===0?0:Math.PI;}}
function doRestart(S,team,timer){
 placeFormation(S);
 let c=null;for(const p of S.players)if(p.team===team&&onPitch(p)&&p.role==='MID'&&(!c||Math.abs(p.y-CY)<Math.abs(c.y-CY)))c=p;
 if(!c)c=nearest(S,team,tf(team,24),CY,true);
 c.x=tf(team,24);c.y=CY;
 giveBall(S,c,timer,1.5);
 S.msg={text:`${TEAMS[team].short} BALL`,sub:`RESTART · ${timer}-SECOND THROW-IN`,t:1.6};
 setFreeze(S,1.2,null);
}
function setFreeze(S,t,pending){S.phase='freeze';S.freeze=t;S.pending=pending;}
function stepFreeze(S){
 S.freeze-=DT;if(S.freeze>0)return;
 const pd=S.pending;S.pending=null;S.phase='play';
 if(!pd)return;
 if(pd.type==='end'){endMatch(S,pd.reason,pd.loser);return;}
 if(S.clock<=0){endMatch(S,'time');return;}
 if(pd.type==='restart')doRestart(S,pd.team,pd.timer);
 else if(pd.type==='give'){const p=S.players[pd.id];if(!onPitch(p)){const q=nearest(S,p.team,p.x,p.y,true);giveBall(S,q,pd.timer,1.2);}else giveBall(S,p,pd.timer,1.2);}
}
function endMatch(S,reason,loser){
 S.over=true;S.phase='over';
 let winner=S.score[0]>S.score[1]?0:S.score[1]>S.score[0]?1:-1;
 if(reason==='forfeit')winner=1-loser;
 S.result={reason,winner,loser};ev(S,'whistle');ev(S,'whistle2');
}
function giveBall(S,p,timer,protect){
 p.ai.greedy=p.role!=='GK'&&S.rnd()<0.1;p.ai.nerve=p.ai.greedy?0.02+S.rnd()*0.4:0.7+S.rnd()*S.rnd()*2.2;p.ai.drive=5+S.rnd()*7;
 const b=S.ball;b.state='held';b.holder=p.id;b.timer=timer;b.lastHolder=p.id;b.lastTeam=p.team;b.protect=protect||0;
 b.x=p.x;b.y=p.y;b.z=1.15;b.vx=b.vy=b.vz=0;b.receiver=-1;b.kind=null;ev(S,'catch');
}

function step(S,intents){
 if(S.over)return;
 S.t+=DT;
 for(const e of S.effects)e.t+=DT;S.effects=S.effects.filter(e=>e.t<e.dur);
 if(S.msg){S.msg.t-=DT;if(S.msg.t<=0)S.msg=null;}
 if(S.cut){S.cut.t+=DT;if(S.cut.t>S.cut.dur)S.cut=null;}
 S.shake=Math.max(0,S.shake-DT*1.6);
 if(S.phase==='freeze'){stepFreeze(S);return;}
 S.clock-=DT;
 if(S.clock<=0){S.clock=0;if(S.ball.state!=='air'){S.msg={text:'FULL TIME',sub:'',t:3};endMatch(S,'time');return;}}
 for(const p of S.players)updatePlayer(S,p,intents[p.id]);
 separate(S);
 updateBall(S);
}
const NOI={mx:0,my:0};
function updatePlayer(S,p,it){
 if(!p.alive)return;
 if(p.bench>0){p.bench-=DT;if(p.bench<=0){p.bench=0;p.x=tf(p.team,38);p.y=0.8;p.vx=p.vy=0;}return;}
 it=it||NOI;
 p.cd=Math.max(0,p.cd-DT);p.slow=Math.max(0,p.slow-DT);
 if(p.stun>0){p.stun-=DT;p.vx*=0.86;p.vy*=0.86;p.x+=p.vx*DT;p.y+=p.vy*DT;p.action=null;return;}
 const b=S.ball,carrier=b.state==='held'&&b.holder===p.id;
 let mx=it.mx||0,my=it.my||0;const m=Math.hypot(mx,my);if(m>1){mx/=m;my/=m;}
 let sp=p.role==='GK'?6.6:7.2;if(carrier)sp*=0.93;
 if(it.sprint&&p.stamina>0.05&&m>0.2){sp*=1.24;p.stamina=Math.max(0,p.stamina-DT*0.16);}else p.stamina=Math.min(1,p.stamina+DT*0.09);
 if(p.slow>0)sp*=0.5;if(p.action)sp*=p.action.type==='behead'?0.9:0.45;
 const k=Math.min(1,DT*9);p.vx+=(mx*sp-p.vx)*k;p.vy+=(my*sp-p.vy)*k;
 p.x=clamp(p.x+p.vx*DT,0.3,L-0.3);p.y=clamp(p.y+p.vy*DT,0.3,W-0.3);
 if(p.role==='GK'){const gx=ownX(p.team),dx=p.x-gx,dy=p.y-CY,d=Math.hypot(dx,dy),R=BOX_R+4;if(d>R){p.x=gx+dx/d*R;p.y=CY+dy/d*R;}}
 const spd=Math.hypot(p.vx,p.vy);
 if(spd>0.4)p.face=Math.atan2(p.vy,p.vx);
 else if(it.fx!==undefined)p.face=Math.atan2(it.fy,it.fx);
 p.run+=spd*DT*1.5;
 if(p.action){const a=p.action,prev=a.t;a.t+=DT;if(prev<a.at&&a.t>=a.at)resolveAction(S,p,a);if(p.action&&a.t>=a.dur)p.action=null;}
 if(it.act&&!p.action)startAction(S,p,it,carrier);
}
function startAction(S,p,it,carrier){
 switch(it.act){
  case 'pass':case 'throw':case 'shoot':if(carrier){p.action={type:'release',t:0,at:0.18,dur:0.24,it:{act:it.act,to:it.to,dx:it.dx,dy:it.dy,aim:it.aim,power:it.power}};}break;
  case 'chain':if(!carrier&&p.hasChain&&p.cd<=0){p.action={type:'chain',t:0,at:0.28,dur:0.55,ai:it.ai};p.cd=1.7;ev(S,'swing');break;}
  /* falls through: no chain means a glove tackle */
  case 'tackle':if(!carrier&&p.cd<=0&&p.role!=='GK'){p.action={type:'tackle',t:0,at:0.1,dur:0.3,ai:it.ai};p.cd=1.2;}break;
  case 'behead':if(!carrier&&p.role==='GK'&&p.cd<=0){p.action={type:'behead',t:0,at:0.14,dur:0.42,ai:true};p.cd=1.5;ev(S,'swing');}break;
 }
}
function facingOK(p,q){const dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy)||1;return (Math.cos(p.face)*dx+Math.sin(p.face)*dy)/d>0.05;}
function resolveAction(S,p,a){
 if(a.type==='release'){const b=S.ball;if(b.state!=='held'||b.holder!==p.id)return;const it=a.it;
  if(it.act==='pass')doPass(S,p,it.to);else if(it.act==='throw')doThrowDir(S,p,it.dx,it.dy);else doShot(S,p,it.aim||0,it.power==null?0.6:it.power);return;}
 const range={tackle:1.45,chain:2.8,behead:2.5}[a.type];
 const b=S.ball,c=b.state==='held'?S.players[b.holder]:null;
 if(c&&c.team!==p.team&&dist(p,c)<=range&&(a.type!=='tackle'||facingOK(p,c))){hitCarrier(S,p,c,a.type);return;}
 if(a.type==='behead')return;
 let q=null,qd=1e9;
 for(const o of S.players){if(o.team===p.team||!onPitch(o)||o.stun>0)continue;const d=dist(p,o);if(d<=range*0.85&&d<qd&&(a.type!=='tackle'||facingOK(p,o))){qd=d;q=o;}}
 if(!q)return;
 if(a.ai&&S.rnd()>0.16)return; // AI mostly pulls the blow when it misses the carrier
 foul(S,p,q);
}
function hitCarrier(S,p,c,type){
 const b=S.ball;
 if(b.protect>0)return;
 if(type==='behead'){kill(S,c,'behead',p);return;}
 if(type==='chain'){c.stun=1.3;S.shake=Math.max(S.shake,0.3);ev(S,'chain');if(S.rnd()<0.55)fumble(S,c,p);else S.msg={text:'HE HOLDS ON',sub:`#${c.num} DOWN WITH THE BALL · ${Math.ceil(S.ball.timer)}`,t:1.2};return;}
 if(S.rnd()<S.tp[p.team].strip){fumble(S,c,p);c.slow=0.7;ev(S,'thud');}else{c.slow=0.6;ev(S,'thud');}
}
function fumble(S,c,by){
 const b=S.ball,a=S.rnd()*6.283;
 b.state='air';b.x=c.x;b.y=c.y;b.z=1.1;b.vx=Math.cos(a)*2.5+(c.x-by.x)*0.6;b.vy=Math.sin(a)*2.5+(c.y-by.y)*0.6;b.vz=2.4;
 b.thrower=c.id;b.grace=0.4;b.kind='fumble';b.receiver=-1;b.rolled=new Set();b.holder=-1;
}
function kill(S,p,cause,by){
 p.alive=false;p.action=null;
 const b=S.ball,team=p.team,opp=1-team,n=aliveCount(S,team);
 b.state='dead';b.holder=-1;
 if(cause==='det'){S.stats.dets[team]++;S.effects.push({type:'boom',x:p.x,y:p.y,t:0,dur:1.5,seed:Math.floor(S.rnd()*1e6)});S.scorches.push({x:p.x,y:p.y,r:0.9+S.rnd()*0.5});S.shake=1;ev(S,'boom');}
 else{S.stats.beheads[team]++;S.effects.push({type:'slash',x:p.x,y:p.y,t:0,dur:0.8,dir:by.x<p.x?1:-1});S.shake=0.5;ev(S,'slash');}
 S.cut={t:0,dur:3.0,delay:0.9,text:`${TEAMS[team].short} DOWN TO ${n}`,sub:cause==='det'?`#${p.num} · THE TIMER REACHED ZERO IN HIS HANDS`:`#${p.num} · STOPPED BY THE GOALKEEPER`};
 S.msg={text:cause==='det'?'DETONATION':'STOPPED AT THE NET',sub:'',t:0.9};
 if(n<MIN_PLAYERS){setFreeze(S,3.0,{type:'end',reason:'forfeit',loser:team});S.cut.sub+=` · BELOW ${MIN_PLAYERS} · FORFEIT`;return;}
 const recv=cause==='behead'?by:nearest(S,opp,p.x,p.y,true);
 setFreeze(S,3.0,{type:'give',id:recv.id,timer:CATCH_TIMER});
}
function foul(S,off,vic){
 vic.stun=1.5;S.stats.fouls[off.team]++;ev(S,'whistle');
 off.bench=SINBIN;off.action=null;
 const b=S.ball,team=vic.team;
 let recv=(b.state==='held'&&S.players[b.holder].team===team)?S.players[b.holder]:nearest(S,team,vic.x,vic.y,true,vic.id)||vic;
 b.state='dead';
 setFreeze(S,1.6,{type:'give',id:recv.id,timer:CATCH_TIMER});
 S.msg={text:'FOUL',sub:`#${off.num} ${TEAMS[off.team].short} · CONTACT WITHOUT THE BALL · OFF ${SINBIN}s`,t:2.4};
}
function throwBall(S,p,tx,ty,tz,T,kind,receiver){
 const b=S.ball;b.state='air';b.holder=-1;b.x=p.x;b.y=p.y;b.z=1.5;
 b.vx=(tx-p.x)/T;b.vy=(ty-p.y)/T;b.vz=(tz-1.5+0.5*G*T*T)/T;
 b.thrower=p.id;b.kind=kind;b.receiver=receiver;b.grace=0.3;b.rolled=new Set();b.lastTeam=p.team;b.lastHolder=p.id;
 ev(S,'throw');
}
function doPass(S,p,toId){
 const q=S.players[toId];
 if(!q||!onPitch(q)){doThrowDir(S,p,Math.cos(p.face),Math.sin(p.face));return;}
 const d=dist(p,q),T=clamp(d/17,0.35,2.0),acc=S.tp[p.team].acc,sd=(0.3+d*0.03)*acc;
 throwBall(S,p,clamp(q.x+q.vx*T*0.9+gauss(S)*sd,0.5,L-0.5),clamp(q.y+q.vy*T*0.9+gauss(S)*sd,0.5,W-0.5),1.3,T,'pass',q.id);
}
function doThrowDir(S,p,dx,dy){
 const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;
 throwBall(S,p,clamp(p.x+dx*16,1,L-1),clamp(p.y+dy*16,1,W-1),0.4,1.05,'throw',-1);
}
function doShot(S,p,aim,power){
 const gx=atkX(p.team),d=Math.hypot(gx-p.x,CY-p.y),acc=S.tp[p.team].acc;
 let pres=99;for(const o of S.players)if(o.team!==p.team&&onPitch(o))pres=Math.min(pres,dist(o,p));
 const sd=(0.25+d*0.028)*acc*(pres<2.5?1.6:1)*(0.85+power*0.45);
 const ty=CY+clamp(aim,-1,1)*(GOAL_HW-0.5)+gauss(S)*sd, tz=2.0+gauss(S)*sd*0.45;
 const speed=20+power*10;
 throwBall(S,p,gx,ty,tz,Math.max(0.22,d/speed),'shot',-1);
}
function updateBall(S){
 const b=S.ball;
 if(b.state==='dead')return;
 if(b.state==='held'){
  const p=S.players[b.holder];
  b.x=p.x+Math.cos(p.face)*0.4;b.y=p.y+Math.sin(p.face)*0.4;b.z=1.15;
  if(b.protect>0)b.protect-=DT;
  const before=b.timer;b.timer-=DT;
  if(b.timer<=5&&b.timer>0&&Math.ceil(b.timer)!==Math.ceil(before))ev(S,'beep',Math.ceil(b.timer));
  if(b.timer<=0){b.timer=0;kill(S,p,'det');}
  return;
 }
 const px=b.x,py=b.y,pz=b.z;
 b.x+=b.vx*DT;b.y+=b.vy*DT;
 if(b.state==='air'){
  b.z+=b.vz*DT;b.vz-=G*DT;b.grace-=DT;
  if(b.z<=0){b.z=0;if(b.vz<-3){b.vz=-b.vz*0.32;b.vx*=0.62;b.vy*=0.62;b.rolled.clear();ev(S,'bounce');}else{b.state='loose';b.vz=0;}}
 }else{const f=Math.max(0,1-2.2*DT);b.vx*=f;b.vy*=f;}
 for(const gx of [0,L]){
  if((px-gx)*(b.x-gx)<0){const fr=(gx-px)/(b.x-px),y=py+(b.y-py)*fr,z=pz+(b.z-pz)*fr;
   if(Math.abs(y-CY)<=GOAL_HW&&z>=GOAL_ZLO&&z<=GOAL_ZHI){scoreGoal(S,gx===L?0:1);return;}}
 }
 if(b.x<-0.5||b.x>L+0.5||b.y<-0.5||b.y>W+0.5){outOfBounds(S);return;}
 tryCatch(S);
}
function tryCatch(S){
 const b=S.ball;
 for(const p of S.players){
  if(!onPitch(p)||p.stun>0)continue;
  if(p.id===b.thrower&&b.grace>0)continue;
  const dh=Math.hypot(p.x-b.x,p.y-b.y);
  if(b.state==='loose'){if(dh<0.8){catchBall(S,p);return;}continue;}
  const gk=p.role==='GK',reach=gk?1.6:1.0,maxZ=gk?3.3:2.3;
  if(dh>reach||b.z>maxZ||b.rolled.has(p.id))continue;
  b.rolled.add(p.id);
  const tp=S.tp[p.team];let ch;
  if(p.team===b.lastTeam)ch=p.id===b.receiver?0.97:0.85;
  else if(gk&&b.kind==='shot'){const sp=Math.hypot(b.vx,b.vy);ch=clamp(1.02-sp*0.021-(dh/reach)*0.4,0.06,0.88)*tp.gkSkill;}
  else ch=tp.intercept*(1-dh/reach*0.5);
  if(S.rnd()<ch){const wasShot=b.kind==='shot'&&gk&&p.team!==b.lastTeam;catchBall(S,p);if(wasShot){S.stats.saves[p.team]++;S.msg={text:'SAVE',sub:`#${p.num} ${TEAMS[p.team].short}`,t:1.1};ev(S,'save');}return;}
 }
}
function catchBall(S,p){const b=S.ball;giveBall(S,p,p.id===b.lastHolder?b.timer:CATCH_TIMER,0);}
function scoreGoal(S,team){
 S.score[team]++;S.stats.goals[team]++;S.ball.state='dead';ev(S,'goal');
 S.msg={text:'GOAL',sub:TEAMS[team].name.toUpperCase(),t:2.7,big:true};
 setFreeze(S,2.7,{type:'restart',team:1-team,timer:RESTART_TIMER});
}
function outOfBounds(S){
 const b=S.ball,team=b.lastTeam<0?0:1-b.lastTeam;
 const sx=clamp(b.x,0.6,L-0.6),sy=clamp(b.y,0.6,W-0.6),endline=b.x<-0.5||b.x>L+0.5;
 let recv=null;
 if(endline&&((b.x<0)===(ownX(team)===0))){recv=S.players.find(p=>p.team===team&&p.role==='GK'&&onPitch(p));if(recv){recv.x=ownX(team)+dirX(team)*3;recv.y=CY;}}
 if(!recv){recv=nearest(S,team,sx,sy,true);recv.x=sx;recv.y=sy;}
 recv.vx=recv.vy=0;b.state='dead';
 setFreeze(S,1.0,{type:'give',id:recv.id,timer:CATCH_TIMER});
 S.msg={text:'OUT OF PLAY',sub:`${TEAMS[team].short} BALL`,t:1.4};
}
function separate(S){
 const ps=S.players;
 for(let i=0;i<ps.length;i++){const a=ps[i];if(!onPitch(a))continue;
  for(let j=i+1;j<ps.length;j++){const c=ps[j];if(!onPitch(c))continue;
   const dx=c.x-a.x,dy=c.y-a.y,d=Math.hypot(dx,dy);
   if(d<0.85&&d>1e-4){const push=(0.85-d)*0.5;a.x-=dx/d*push;a.y-=dy/d*push;c.x+=dx/d*push;c.y+=dy/d*push;}}}
}

/* =====================================================================
   AI — produces the same intents a human controller does.
   ===================================================================== */
function landing(b){
 if(b.state!=='air')return{x:b.x+b.vx*0.35,y:b.y+b.vy*0.35,t:0};
 const disc=b.vz*b.vz+2*G*(b.z-1.2);let t=disc<0?Math.max(0,b.vz/G):(b.vz+Math.sqrt(disc))/G;
 return{x:b.x+b.vx*t,y:b.y+b.vy*t,t};
}
function makeCtx(S){
 const b=S.ball,carrier=b.state==='held'?S.players[b.holder]:null;
 const poss=carrier?carrier.team:(b.state==='air'&&b.kind==='pass'?b.lastTeam:-1);
 const land=b.state==='held'?{x:b.x,y:b.y}:landing(b);
 const bp=carrier?{x:carrier.x,y:carrier.y}:land;
 const press=[[],[]],chaser=[-1,-1];
 for(const team of [0,1]){
  const l=S.players.filter(p=>p.team===team&&onPitch(p)&&p.role!=='GK'&&p.stun<=0&&p!==carrier).map(p=>({p,d:Math.hypot(p.x-bp.x,p.y-bp.y)})).sort((a,c)=>a.d-c.d);
  press[team]=[l[0]&&l[0].p.id,l[1]&&l[1].p.id];chaser[team]=l[0]?l[0].p.id:-1;
 }
 if(b.state==='air'&&b.receiver>=0)chaser[S.players[b.receiver].team]=b.receiver;
 return{b,carrier,poss,land,bp,press,chaser};
}
function computeIntents(S,inputs){
 const I={},ctx=makeCtx(S);
 for(const p of S.players){if(!onPitch(p))continue;
  const t=p.team;
  if(p.id===S.humans[t]){I[p.id]=inputToIntent(S,t,inputs&&inputs[t]);continue;}
  I[p.id]=p.role==='GK'?aiGK(S,p,ctx):aiField(S,p,ctx);}
 return I;
}
function steer(p,it,tx,ty,sprint,stop){
 const dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy);
 if(d<(stop||0.4)){it.mx=0;it.my=0;}else{const f=Math.min(1,d/2.5);it.mx=dx/d*f;it.my=dy/d*f;}
 it.sprint=!!sprint&&d>3;return it;
}
function home(S,p,ctx,mode){
 const f=FORM[p.slot],btx=tf(p.team,ctx.bp.x);
 let hx=f[1]+(btx-38)*(p.role==='DEF'?0.42:0.58);
 if(mode>0)hx+=p.role==='DEF'?7:p.role==='MID'?11:14;else if(mode<0)hx-=p.role==='FWD'?3:6;
 const lim={DEF:[7,68],MID:[14,86],FWD:[22,95]}[p.role];hx=clamp(hx,lim[0],lim[1]);
 if(mode<0)hx=Math.min(hx,btx+(p.role==='FWD'?18:p.role==='MID'?6:-2));
 if(mode>0&&p.role==='FWD')hx=clamp(Math.max(hx,btx+5),0,95);
 const hy=f[2]+(ctx.bp.y-CY)*0.32+Math.sin(S.t*0.35+p.id*1.7)*1.6;
 return{x:tf(p.team,hx),y:clamp(hy,2,W-2)};
}
function nearestOpp(S,p){let o=null,d=1e9;for(const q of S.players){if(q.team===p.team||!onPitch(q))continue;const e=dist(p,q);if(e<d){d=e;o=q;}}return o?{o,d}:null;}
function bestPass(S,p,allowBack){
 let best=null;const gx=atkX(p.team);
 for(const q of S.players){
  if(q.team!==p.team||q===p||!onPitch(q)||q.stun>0||q.role==='GK')continue;
  const d=dist(p,q);if(d<4||d>36)continue;
  const fwd=tf(p.team,q.x)-tf(p.team,p.x);if(!allowBack&&fwd<-12)continue;
  let lane=99,rec=99;
  for(const o of S.players){if(o.team===p.team||!onPitch(o))continue;rec=Math.min(rec,dist(o,q));lane=Math.min(lane,segDist(o,p,q));}
  let sc=fwd*0.045+Math.min(rec,8)*0.14+Math.min(lane,5)*0.18-d*0.012;
  if(lane<1.4)sc-=1.2;if(rec<1.8)sc-=0.8;if(Math.hypot(gx-q.x,CY-q.y)<24)sc+=0.4;
  if(!best||sc>best.score)best={q,score:sc,fwd,d};
 }
 return best;
}
function shootIntent(S,p,it){
 const gk=S.players.find(q=>q.team!==p.team&&q.role==='GK'&&onPitch(q));
 const side=gk?(gk.y>CY?-1:1):(S.rnd()<0.5?-1:1);
 it.act='shoot';it.aim=side*(0.55+S.rnd()*0.4);it.power=0.45+S.rnd()*0.45;return it;
}
function aiCarrier(S,p,ctx,it){
 const b=S.ball,tp=S.tp[p.team],gx=atkX(p.team),dir=dirX(p.team);
 const dG=Math.hypot(gx-p.x,CY-p.y),no=nearestOpp(S,p),pres=no?no.d:99,t=b.timer;
 const emergency=t<(p.ai.nerve||2.6);
 p.ai.think-=DT;
 if(b.protect<=0.6&&(p.ai.think<=0||dG<p.ai.drive)){
  p.ai.think=tp.react*(0.8+S.rnd()*0.6);
  const angleOK=Math.abs(p.y-CY)<Math.max(6,dG*0.85);
  const best=bestPass(S,p,false);
  if(dG<p.ai.drive&&angleOK)return shootIntent(S,p,it);
  if(dG<24&&angleOK&&(t<5||pres<3||S.rnd()<0.3))return shootIntent(S,p,it);
  if(emergency){
   if(dG<34&&angleOK)return shootIntent(S,p,it);
   if(best){it.act='pass';it.to=best.q.id;return it;}
   it.act='throw';it.dx=dir;it.dy=(CY-p.y)*0.02;return it;
  }
  if(!p.ai.greedy&&best&&pres<2.2&&best.score>0&&(t<9||S.rnd()<0.25)){it.act='pass';it.to=best.q.id;return it;}
  if(!p.ai.greedy&&best&&t<TEAMS[p.team].style&&best.score>0.3){it.act='pass';it.to=best.q.id;return it;}
  if(!p.ai.greedy&&best&&best.fwd>12&&best.score>0.9&&S.rnd()<0.3){it.act='pass';it.to=best.q.id;return it;}
 }
 // dribble toward goal, bending away from defenders ahead
 let vx=gx-p.x,vy=CY+clamp((p.y-CY)*0.5,-8,8)-p.y;const vl=Math.hypot(vx,vy)||1;vx/=vl;vy/=vl;
 for(const o of S.players){if(o.team===p.team||!onPitch(o))continue;const dx=p.x-o.x,dy=p.y-o.y,d=Math.hypot(dx,dy);
  if(d<7&&d>0.01&&(-dx*vx-dy*vy)>-0.3*d){vx+=dx/d*(2.2/d);vy+=dy/d*(2.2/d);}}
 const l=Math.hypot(vx,vy)||1;it.mx=vx/l;it.my=vy/l;it.sprint=p.stamina>0.3;
 return it;
}
function aiField(S,p,ctx){
 const it={mx:0,my:0,sprint:false,act:null,ai:true},b=ctx.b,tp=S.tp[p.team];
 if(ctx.carrier===p)return aiCarrier(S,p,ctx,it);
 const attacking=ctx.poss===p.team,mode=ctx.poss<0?0:attacking?1:-1;
 const h=home(S,p,ctx,mode);let tx=h.x,ty=h.y,sprint=false;
 if(b.state==='air'&&b.receiver===p.id){tx=ctx.land.x;ty=ctx.land.y;sprint=true;}
 else if((b.state==='air'||b.state==='loose')&&ctx.chaser[p.team]===p.id){tx=ctx.land.x;ty=ctx.land.y;sprint=true;}
 else if(ctx.carrier&&!attacking){
  const c=ctx.carrier,pr=ctx.press[p.team],d=dist(p,c);
  const tryHit=()=>{const reach=p.hasChain?2.5:1.3;
   if(d<reach){p.ai.wait+=DT;if(p.ai.wait>tp.react&&p.cd<=0&&b.protect<=0){it.act=p.hasChain?'chain':'tackle';p.ai.wait=0;}}else p.ai.wait=0;};
  if(pr[0]===p.id){tx=c.x+c.vx*0.25;ty=c.y+c.vy*0.25;sprint=true;tryHit();}
  else if(pr[1]===p.id){const og=ownX(p.team),ux=og-c.x,uy=CY-c.y,ul=Math.hypot(ux,uy)||1;tx=c.x+ux/ul*5;ty=c.y+uy/ul*5;sprint=true;tryHit();}
  else{let m=null,md=18;for(const o of S.players){if(o.team===p.team||!onPitch(o)||o===c)continue;const e=Math.hypot(o.x-h.x,o.y-h.y);if(e<md){md=e;m=o;}}
   if(m){const og=ownX(p.team),ux=og-m.x,uy=CY-m.y,ul=Math.hypot(ux,uy)||1;tx=h.x*0.35+(m.x+ux/ul*1.8)*0.65;ty=h.y*0.35+(m.y+uy/ul*1.8)*0.65;}}
 }else if(attacking){const no=nearestOpp(S,p);if(no&&no.d<5){tx+=(p.x-no.o.x)/no.d*3;ty+=(p.y-no.o.y)/no.d*3;}}
 return steer(p,it,tx,ty,sprint);
}
function aiGK(S,p,ctx){
 const it={mx:0,my:0,sprint:false,act:null,ai:true},b=ctx.b,tp=S.tp[p.team],og=ownX(p.team),dir=dirX(p.team);
 if(ctx.carrier===p){
  p.ai.hold+=DT;
  if(b.protect<=0.6&&(p.ai.hold>0.7+S.rnd()*0.6||b.timer<4)){p.ai.hold=0;const best=bestPass(S,p,true);
   if(best&&best.score>-0.8){it.act='pass';it.to=best.q.id;}else{it.act='throw';it.dx=dir;it.dy=0;}}
  return steer(p,it,og+dir*4,CY,false);
 }
 p.ai.hold=0;
 const ref=ctx.bp,vx=ref.x-og,vy=ref.y-CY,vl=Math.hypot(vx,vy)||1,adv=Math.min(4,vl*0.12);
 let tx=og+vx/vl*adv,ty=clamp(CY+vy/vl*adv*0.9,CY-GOAL_HW-1,CY+GOAL_HW+1),sprint=false;
 if(b.state==='air'&&b.kind==='shot'&&b.lastTeam!==p.team&&b.vx*dir<0){const tt=(og+dir*0.6-b.x)/b.vx;if(tt>0&&tt<2){ty=b.y+b.vy*tt;tx=og+dir*0.6;sprint=true;}}
 else if(b.state!=='held'&&Math.hypot(ctx.land.x-og,ctx.land.y-CY)<BOX_R){tx=ctx.land.x;ty=ctx.land.y;sprint=true;}
 const c=ctx.carrier;
 if(c&&c.team!==p.team&&Math.hypot(c.x-og,c.y-CY)<BOX_R+4){
  tx=c.x;ty=c.y;sprint=true;
  if(dist(p,c)<2.4){p.ai.seen+=DT;if(p.ai.seen>tp.gkDelay&&p.cd<=0&&b.protect<=0){it.act='behead';p.ai.seen=0;}}else p.ai.seen=0;
 }else p.ai.seen=0;
 return steer(p,it,tx,ty,sprint,0.25);
}

/* =====================================================================
   HUMAN CONTROL — inputs are button COUNTERS, not held flags, so a quick
   tap survives network batching: the server sees "a went 4→5" and acts once.
   inp = {mx,my,sp, a:passOrTackle#, b:chain#, s:shotsReleased#, pw:lastShotPower, w:switch#}
   ===================================================================== */
const NOINPUT={mx:0,my:0};
function inputToIntent(S,team,inp){
 const p=S.players[S.humans[team]];
 if(!inp||!p)return{mx:0,my:0};
 const c=S.ctl[team];
 const aE=inp.a!==c.a,bE=inp.b!==c.b,sE=inp.s!==c.s,wE=inp.w!==c.w;
 c.a=inp.a;c.b=inp.b;c.s=inp.s;c.w=inp.w;
 const mx=clamp(+inp.mx||0,-1,1),my=clamp(+inp.my||0,-1,1);
 const it={mx,my,sprint:!!inp.sp,act:null,ai:false};
 if(wE){switchHuman(S,team,true);return it;}
 const b=S.ball,carrier=b.state==='held'&&b.holder===p.id;
 if(carrier){
  if(aE){const t=humanPassTarget(S,p,mx,my);
   if(t){it.act='pass';it.to=t.id;}
   else{const f=Math.hypot(mx,my)>0.2?[mx,my]:[Math.cos(p.face),Math.sin(p.face)];it.act='throw';it.dx=f[0];it.dy=f[1];}}
  else if(sE){it.act='shoot';it.aim=my;it.power=clamp(+inp.pw||0,0,1);}
 }else{if(aE)it.act='tackle';else if(bE)it.act='chain';}
 return it;
}
function humanPassTarget(S,p,mx,my){
 let dx=mx,dy=my;if(Math.hypot(dx,dy)<0.2){dx=Math.cos(p.face);dy=Math.sin(p.face);}const dl=Math.hypot(dx,dy);dx/=dl;dy/=dl;
 let best=null,bs=-1e9;
 for(const q of S.players){if(q.team!==p.team||q===p||!onPitch(q)||q.role==='GK')continue;const vx=q.x-p.x,vy=q.y-p.y,d=Math.hypot(vx,vy);if(d<2||d>42)continue;
  const cos=(vx*dx+vy*dy)/d;if(cos<0.55)continue;let rec=99;for(const o of S.players)if(o.team!==p.team&&onPitch(o))rec=Math.min(rec,dist(o,q));
  const sc=cos*2-d*0.02+Math.min(rec,6)*0.12;if(sc>bs){bs=sc;best=q;}}
 return best;
}
function switchHuman(S,team,manual){
 const b=S.ball,ref=b.state==='held'?S.players[b.holder]:b;
 let best=null,bd=1e9;
 for(const p of S.players){if(p.team!==team||!onPitch(p)||p.role==='GK'||(manual&&p.id===S.humans[team]))continue;const d=Math.hypot(p.x-ref.x,p.y-ref.y);if(d<bd){bd=d;best=p;}}
 if(best)S.humans[team]=best.id;
}
function autoSwitch(S){
 const b=S.ball,poss=b.state==='held'?S.players[b.holder].team:-1;
 for(const team of [0,1]){
  if(S.humans[team]<0)continue;
  const cur=S.players[S.humans[team]];
  let done=false;
  if(b.state==='held'){const c=S.players[b.holder];if(c.team===team&&c.role!=='GK'){S.humans[team]=c.id;done=true;}}
  if(!done&&b.state==='air'&&b.lastTeam===team&&b.receiver>=0){const r=S.players[b.receiver];if(r.team===team&&r.role!=='GK'&&onPitch(r)){S.humans[team]=r.id;done=true;}}
  if(!done&&(!onPitch(cur)||(poss>=0&&poss!==team&&S.lastPoss[team]===team)))switchHuman(S,team,false);
  S.lastPoss[team]=poss;
 }
}
/** One fixed step of a match. inputs = [team0Input|null, team1Input|null]. */
function tick(S,inputs){autoSwitch(S);step(S,computeIntents(S,inputs));}

/* =====================================================================
   SNAPSHOTS — what the server sends; decode gives the renderer an S-shaped view.
   ===================================================================== */
const ACT=['','tackle','chain','behead','release'],BST=['dead','held','air','loose'];
const r2=v=>Math.round(v*100)/100;
function staticInfo(S){return{opts:S.opts,players:S.players.map(p=>[p.team,p.slot,p.role,p.num,p.skin,p.hasChain?1:0])};}
function snapshot(S,events){
 const P=[];
 for(const p of S.players){const a=p.action;P.push(r2(p.x),r2(p.y),r2(p.vx),r2(p.vy),r2(p.face),(p.alive?1:0)|(p.bench>0?2:0)|(p.stun>0?4:0),a?ACT.indexOf(a.type):0,a?r2(a.t):0,a?r2(a.dur):0);}
 const b=S.ball;
 return{t:r2(S.t),ph:S.phase,clk:r2(S.clock),sc:S.score,hu:S.humans,sh:r2(S.shake),p:P,
  b:[BST.indexOf(b.state),b.holder,r2(b.x),r2(b.y),r2(b.z),r2(b.timer)],
  msg:S.msg?[S.msg.text,S.msg.sub||'',r2(S.msg.t)]:null,
  cut:S.cut?[r2(S.cut.t),S.cut.dur,S.cut.delay,S.cut.text,S.cut.sub]:null,
  fx:S.effects.map(e=>[e.type,r2(e.x),r2(e.y),r2(e.t),e.dur,e.seed||0,e.dir||0]),
  sco:S.scorches.map(s=>[r2(s.x),r2(s.y),r2(s.r)]),
  st:S.stats,ov:S.over,res:S.result,ev:events||[]};
}
function makeView(info){
 return{opts:info.opts,t:0,phase:'play',clock:0,score:[0,0],humans:[-1,-1],shake:0,msg:null,cut:null,effects:[],scorches:[],stats:null,over:false,result:null,
  players:info.players.map((q,id)=>({id,team:q[0],slot:q[1],role:q[2],num:q[3],skin:q[4],hasChain:!!q[5],x:0,y:0,vx:0,vy:0,face:0,alive:true,bench:0,stun:0,action:null,run:id*0.7})),
  ball:{state:'dead',holder:-1,x:CX,y:CY,z:0,timer:0}};
}
/** Write snapshot `a` (and, when given, a blend toward `b` by alpha) into view V. */
function applySnapshot(V,a,b,alpha){
 const k=b?alpha:0,lerp=(x,y)=>x+(y-x)*k,lerpA=(x,y)=>{let d=y-x;while(d>Math.PI)d-=6.2832;while(d<-Math.PI)d+=6.2832;return x+d*k;};
 const A=a.p,B=b?b.p:a.p;
 for(let i=0;i<V.players.length;i++){const p=V.players[i],o=i*9;
  p.x=lerp(A[o],B[o]);p.y=lerp(A[o+1],B[o+1]);p.vx=A[o+2];p.vy=A[o+3];p.face=lerpA(A[o+4],B[o+4]);
  const f=A[o+5];p.alive=!!(f&1);p.bench=f&2?1:0;p.stun=f&4?1:0;
  p.action=A[o+6]?{type:ACT[A[o+6]],t:A[o+7],dur:A[o+8]}:null;}
 const ba=a.b,bb=b?b.b:a.b,ball=V.ball;
 ball.state=BST[ba[0]];ball.holder=ba[1];ball.timer=ba[5];
 const same=ba[0]===bb[0];ball.x=same?lerp(ba[2],bb[2]):ba[2];ball.y=same?lerp(ba[3],bb[3]):ba[3];ball.z=same?lerp(ba[4],bb[4]):ba[4];
 V.t=a.t;V.phase=a.ph;V.clock=a.clk;V.score=a.sc;V.humans=a.hu;V.shake=a.sh;
 V.msg=a.msg?{text:a.msg[0],sub:a.msg[1],t:a.msg[2]}:null;
 V.cut=a.cut?{t:a.cut[0],dur:a.cut[1],delay:a.cut[2],text:a.cut[3],sub:a.cut[4]}:null;
 V.effects=a.fx.map(e=>({type:e[0],x:e[1],y:e[2],t:e[3],dur:e[4],seed:e[5],dir:e[6]}));
 V.scorches=a.sco.map(s=>({x:s[0],y:s[1],r:s[2]}));
 V.stats=a.st;V.over=a.ov;V.result=a.res;
}

/* =====================================================================
   RAPTURE CREDITS — the same formula on client (vs AI) and server (online).
   ===================================================================== */
const CREDIT_MULT={easy:0.5,normal:1,hard:1.5,online:2};
function payout(S,team){
 const r=S.result;if(!r)return{total:0,lines:[]};
 const won=r.winner===team,draw=r.winner<0,forfeited=(r.reason==='forfeit'||r.reason==='left')&&r.loser===team;
 const lines=[[won?'Win':draw?'Draw':forfeited?'Forfeit':'Loss',won?100:draw?40:forfeited?0:10],
  [`Goals ×${S.score[team]}`,S.score[team]*15],[`Men standing ×${aliveCount(S,team)}`,aliveCount(S,team)*5]];
 const key=S.opts.online?'online':(S.opts.diff||'normal'),mult=CREDIT_MULT[key];
 const total=Math.round(lines.reduce((s,l)=>s+l[1],0)*mult);
 return{total,mult,key,lines};
}

export{L,W,CX,CY,DT,GOAL_HW,GOAL_ZLO,GOAL_ZHI,BOX_R,MIN_PLAYERS,TEAMS,rng,clamp,onPitch,aliveCount,dirX,
 newMatch,tick,snapshot,staticInfo,makeView,applySnapshot,payout,NOINPUT};
