/* Knucklebomb shell — menu, HUD, the three modes, and Rapture credits.
   menu   : an AI-vs-AI exhibition runs behind the menu
   local  : you vs the AI, simulated in this tab
   online : the MatchRoom Durable Object simulates; this tab sends inputs and draws snapshots
   v2 */
import{DT,TEAMS,MIN_PLAYERS,newMatch,tick,payout,aliveCount,onPitch,clamp}from'./sim.js';
import{render,timerColor}from'./render.js';
import{AU}from'./audio.js';
import{createInput}from'./input.js';
import{serverBase,onlineAvailable,connectRoom}from'./net.js';

const $=id=>document.getElementById(id);
const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};

/* ---------- identity + credits ---------- */
let pid=store.get('kb.pid');
if(!pid){pid=Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join('');store.set('kb.pid',pid);}
let balance=null;
const fmt=n=>n==null?'—':n.toLocaleString('en-US');
function showBalance(){$('bal').textContent=fmt(balance);}
async function api(path,opts){const base=serverBase();if(!base||!onlineAvailable())throw new Error('offline');const r=await fetch(base+path,opts);if(!r.ok)throw new Error(await r.text());return r.json();}
async function loadBalance(){
 try{balance=(await api(`/api/credits?pid=${pid}`)).credits;}
 catch{balance=Number(store.get('kb.localCredits')||0);}
 showBalance();
}
async function claimLocal(amount,summary){
 try{balance=(await api('/api/credits/claim',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pid,amount,summary})})).credits;}
 catch{balance=Number(store.get('kb.localCredits')||0)+amount;store.set('kb.localCredits',String(balance));}
 showBalance();
}
loadBalance();

/* ---------- state ---------- */
let mode='menu',paused=false,S=null,acc=0,last=0,myTeam=0,room=null,netInfo=null,sendT=0,endShown=false;
const choice={team:0,diff:'normal',minutes:5};
const input=createInput({
 isCarrier:()=>{const V=current();if(!V)return false;const me=V.humans[myTeam];return V.ball.state==='held'&&V.ball.holder===me;},
 onPause:()=>{if(mode==='local')setPause(!paused);},
 onMute:()=>AU.toggle(),
 active:()=>mode==='local'||mode==='online'
});
const demo=()=>newMatch({humans:[false,false],minutes:99,seed:(Math.random()*1e9)|0});
S=demo();
function current(){return mode==='online'?(room&&room.view()):S;}

/* ---------- menu wiring ---------- */
function segSetup(id,key,num){$(id).addEventListener('click',e=>{const bt=e.target.closest('button');if(!bt)return;for(const c of $(id).children)c.setAttribute('aria-pressed',String(c===bt));choice[key]=num?Number(bt.dataset.v):bt.dataset.v;});}
segSetup('diff','diff');segSetup('len','minutes',true);
for(const t of [0,1])$('pick'+t).onclick=()=>{choice.team=t;$('pick0').setAttribute('aria-pressed',String(t===0));$('pick1').setAttribute('aria-pressed',String(t===1));};
$('start').onclick=startLocal;$('again').onclick=()=>netInfo?toMenu():startLocal();$('toMenu').onclick=toMenu;$('quit').onclick=toMenu;$('resume').onclick=()=>setPause(false);
$('onlineBtn').onclick=()=>{
 if(!onlineAvailable()){$('onlinePanel').hidden=false;$('netStatus').textContent='Online play isn\'t switched on yet: it needs the Cloudflare game server. Play the AI for now. Credits are saved in this browser until then.';for(const id of ['create','join','joinCode'])$(id).disabled=true;return;}
 $('onlinePanel').hidden=!$('onlinePanel').hidden;
};
$('create').onclick=()=>{const code=Array.from(crypto.getRandomValues(new Uint8Array(5)),b=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%32]).join('');$('roomCode').textContent=code;openRoom(code,true);};
$('join').onclick=()=>{const code=$('joinCode').value.trim().toUpperCase();if(!/^[A-Z0-9]{4,6}$/.test(code)){$('netStatus').textContent='Codes are 5 letters and numbers.';return;}openRoom(code,false);};
$('joinCode').addEventListener('keydown',e=>{if(e.key==='Enter')$('join').click();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='local')setPause(true);});

function showHud(on){for(const id of ['bug','chyron','keys'])$(id).hidden=!on;if(!on){$('hold').style.display='none';$('waiting').hidden=true;}
 $('sw0').style.background=`linear-gradient(90deg,${TEAMS[0].kit} 55%,${TEAMS[0].kit2} 55%)`;$('sw1').style.background=`linear-gradient(90deg,${TEAMS[1].kit} 55%,${TEAMS[1].kit2} 55%)`;}
function audioOn(){AU.init();if(AU.c&&AU.c.state==='suspended')AU.c.resume();}
function startLocal(){
 audioOn();if(room){room.close();room=null;}netInfo=null;
 myTeam=choice.team;
 S=newMatch({humans:[myTeam===0,myTeam===1],diff:choice.diff,minutes:choice.minutes,seed:(Math.random()*1e9)|0});
 mode='local';paused=false;endShown=false;input.reset();
 $('menu').hidden=true;$('end').hidden=true;$('pause').hidden=true;showHud(true);
}
function toMenu(){
 if(room){room.close();room=null;}netInfo=null;
 mode='menu';S=demo();$('menu').hidden=false;$('end').hidden=true;$('pause').hidden=true;showHud(false);$('roomCode').textContent='';loadBalance();
}
function setPause(v){paused=v;$('pause').hidden=!v;}

/* ---------- online ---------- */
function openRoom(code,create){
 audioOn();if(room)room.close();
 const tokKey='kb.tok.'+code,token=store.get(tokKey);
 $('netStatus').textContent=create?`Waiting for an opponent. Send them the code ${code}.`:'Joining…';
 room=connectRoom({code,create,team:choice.team,minutes:choice.minutes,pid,token,on:{
  message(m){
   if(m.type==='hello'){myTeam=m.team;store.set(tokKey,m.token);$('netStatus').textContent=m.waiting?`You are ${TEAMS[m.team].name}. Waiting for an opponent · code ${code}`:'Opponent found.';}
   else if(m.type==='status'){if(mode==='online'){$('waiting').hidden=!m.text;$('waiting').textContent=m.text||'';}else $('netStatus').textContent=m.text;}
   else if(m.type==='error'){$('netStatus').textContent=m.text;room&&room.close();room=null;}
   else if(m.type==='credits'){balance=m.balance;showBalance();renderPay(m.payout);}
  },
  info(info,team){netInfo=info;myTeam=team;mode='online';endShown=false;input.reset();$('menu').hidden=true;$('end').hidden=true;showHud(true);},
  events(evs){for(const [e,a] of evs)AU.play(e,a);},
  closed(){if(mode==='online'&&!endShown){$('waiting').hidden=false;$('waiting').textContent='CONNECTION LOST';setTimeout(toMenu,2500);}else if(mode==='menu')$('netStatus').textContent='Connection closed.';}
 }});
}

/* ---------- end of match ---------- */
function renderPay(p){
 if(!p){$('endPay').innerHTML='';return;}
 $('endPay').innerHTML=p.lines.map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')+
  `<tr><td>× ${p.mult} (${p.key==='online'?'online match':p.key+' AI'})</td><td></td></tr><tr class="total"><td>RAPTURE CREDITS EARNED</td><td>+${fmt(p.total)}</td></tr>`;
}
function showEnd(V){
 endShown=true;const r=V.result,T=TEAMS,you=myTeam;
 $('endEye').textContent=r.reason==='forfeit'?'MATCH ABANDONED · FORFEIT':r.reason==='left'?'OPPONENT LEFT':'FULL TIME';
 $('endScore').textContent=`${T[0].short} ${V.score[0]} · ${T[1].short} ${V.score[1]}`;
 $('endLine').textContent=r.reason==='left'?(r.loser===you?'You left the match.':`${T[r.loser].name} walked off. ${T[r.winner].name} take it.`):
  r.reason==='forfeit'?`${T[r.loser].name} fell below ${MIN_PLAYERS} men on the field. ${T[r.winner].name} take the match.`:
  r.winner<0?'A draw. Nobody is elevated tonight.':r.winner===you?`${T[you].name} win. The survivors kneel where they stand.`:`${T[r.winner].name} win. Your roster goes home.`;
 const st=V.stats,alive=[0,1].map(t=>V.players.filter(p=>p.team===t&&p.alive).length);
 $('endStats').innerHTML=`<tr><th></th><th>${T[0].abbr}</th><th>${T[1].abbr}</th></tr>`+
  [['GOALS',st.goals],['SAVES',st.saves],['DETONATIONS',st.dets],['LOST AT THE NET',st.beheads],['FOULS',st.fouls],['MEN STANDING',alive]].map(([k,v])=>`<tr><td>${k}</td><td>${v[0]}</td><td>${v[1]}</td></tr>`).join('');
 $('again').textContent=mode==='online'?'BACK TO MENU':'REMATCH';
 if(mode==='local'){const p=payout(V,you);renderPay(p);claimLocal(p.total,{score:V.score,diff:V.opts.diff,team:you});}
 else renderPay(null); // the server's credits message fills this in
 $('end').hidden=false;$('hold').style.display='none';$('waiting').hidden=true;
}

/* ---------- HUD ---------- */
let lastMsgKey='';
function updateHUD(V){
 if(mode==='menu'||!V)return;
 for(const t of [0,1]){$('ab'+t).textContent=TEAMS[t].abbr;$('sc'+t).textContent=V.score[t];$('ct'+t).textContent=V.players.filter(p=>p.team===t&&onPitch(p)).length+' ON';}
 const c=Math.ceil(V.clock);$('clk').textContent=`${String(Math.floor(c/60)).padStart(2,'0')}:${String(c%60).padStart(2,'0')}`;
 $('chyron').textContent=`KNUCKLEBOMB — ${mode==='online'?'ONLINE':'EXHIBITION'} — ${TEAMS[0].short} ${V.score[0]}, ${TEAMS[1].short} ${V.score[1]}`;
 const m=V.msg,key=m?m.text+m.sub:'';
 if(key!==lastMsgKey){lastMsgKey=key;if(m){$('bt').textContent=m.text;$('bs').textContent=m.sub||'';$('bs').hidden=!m.sub;$('bt').style.color=m.text==='GOAL'?'#ffd34d':m.text==='DETONATION'||m.text==='FOUL'?'#ff5a4e':'#f3efe4';}}
 $('banner').style.opacity=m&&!(V.cut&&V.cut.t>V.cut.delay)?1:0;
 const b=V.ball,mine=b.state==='held'&&b.holder===V.humans[myTeam];
 $('hold').style.display=mine?'flex':'none';
 if(mine){$('hn').textContent=b.timer.toFixed(1);$('hn').style.color=timerColor(b.timer);$('hb').style.width=Math.min(100,b.timer/(b.timer>15?30:15)*100)+'%';$('hb').style.background=timerColor(b.timer);$('pb').style.width=input.charge()*100+'%';}
}

/* ---------- loop ---------- */
let heat=0.3;
function frame(ts){
 const dt=Math.min(0.1,last?(ts-last)/1000:0);last=ts;
 input.poll(dt);
 if(mode==='menu'||(mode==='local'&&!paused)){
  acc+=dt;let n=0;
  const inp=mode==='local'?input.read():null;
  while(acc>=DT&&n<8){
   tick(S,mode==='local'?[myTeam===0?inp:null,myTeam===1?inp:null]:null);
   acc-=DT;n++;
   for(const [e,a] of S.ev)if(mode==='local')AU.play(e,a);S.ev.length=0;
   if(S.over){if(mode==='local'){if(!endShown)showEnd(S);}else S=demo();break;}
  }
  if(n>=8)acc=0;
 }
 if(mode==='online'&&room){
  sendT+=dt;if(input.takeChanged()||sendT>=0.05){sendT=0;room.send(input.read());}
 }
 const V=current();
 if(V){
  if(mode==='online'){for(const p of V.players)p.run+=Math.hypot(p.vx,p.vy)*dt*1.5;if(V.over&&!endShown)showEnd(V);}
  const b=V.ball,tension=b.state==='held'?clamp((6-b.timer)/6,0,1):0;heat+=((0.3+tension*1.4)-heat)*Math.min(1,dt*3);
  if(mode!=='menu')AU.tension(tension*(paused?0:1));
  render(V,dt,{you:mode==='menu'?-1:V.humans[myTeam],radar:mode!=='menu',heat});
  updateHUD(V);
 }
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__kb={get S(){return S;},get mode(){return mode;},get view(){return current();}};
