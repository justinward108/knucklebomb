/* Knucklebomb renderer — draws any S-shaped state (a local match or a decoded
   server snapshot). Angled broadcast camera, painter's sort by depth.
   v2: module; highlights the viewer's own player via render(S,dt,{you,radar,heat}). */
import{L,W,CX,CY,GOAL_HW,GOAL_ZLO,GOAL_ZHI,BOX_R,TEAMS,rng,clamp,onPitch,dirX}from'./sim.js';
/* =====================================================================
   RENDER — angled broadcast camera, painter's sort by depth.
   ===================================================================== */
const cv=document.getElementById('c'),g=cv.getContext('2d');
let VW=0,VH=0,DPR=1;
function resize(){DPR=Math.min(2,devicePixelRatio||1);VW=innerWidth;VH=innerHeight;cv.width=Math.round(VW*DPR);cv.height=Math.round(VH*DPR);}
addEventListener('resize',resize);resize();
const TH=33*Math.PI/180,CT=Math.cos(TH),ST=Math.sin(TH);
const cam={lx:CX,ly:CY,D:64,f:800,px:0,py:0,pz:0,ox:0,oy:0};
function updateCam(S,dt){
 const b=S.ball;let rx=b.x,ry=b.y;
 if(b.state==='held'){const p=S.players[b.holder];rx=p.x+dirX(p.team)*6;ry=p.y;}
 if(b.state==='dead'&&S.cut==null){}
 cam.f=Math.min(VH*1.8,VW*1.15);
 const hw=VW/2/cam.f*cam.D;
 let tx=L+12>2*hw?clamp(rx,hw-7,L-hw+7):CX;
 const ty=CY+(ry-CY)*0.3-2;
 const k=Math.min(1,dt*2.6);cam.lx+=(tx-cam.lx)*k;cam.ly+=(ty-cam.ly)*k;
 cam.px=cam.lx;cam.py=cam.ly-cam.D*CT;cam.pz=cam.D*ST;
 const sh=S.shake*S.shake*14;cam.ox=(Math.random()-0.5)*sh;cam.oy=(Math.random()-0.5)*sh;
}
function P(x,y,z){const dx=x-cam.px,dy=y-cam.py,dz=z-cam.pz;const zc=dy*CT-dz*ST;if(zc<0.5)return null;const yc=dy*ST+dz*CT,s=cam.f/zc;return{x:VW/2+dx*s+cam.ox,y:VH*0.54-yc*s+cam.oy,s};}
function poly(pts){g.beginPath();let ok=false;for(const q of pts){const r=P(q[0],q[1],q[2]||0);if(!r)continue;if(!ok){g.moveTo(r.x,r.y);ok=true;}else g.lineTo(r.x,r.y);}g.closePath();}
function line3(pts){g.beginPath();let ok=false;for(const q of pts){const r=P(q[0],q[1],q[2]||0);if(!r){ok=false;continue;}if(!ok){g.moveTo(r.x,r.y);ok=true;}else g.lineTo(r.x,r.y);}g.stroke();}

// static stadium dressing (positions fixed, deterministic)
let crowdHeat=0.3,YOU=-1;
const CROWD=[];(()=>{const r=rng(77),cols=['#2a2f3a','#3a3f4a','#4a4038','#2f3540','#5a5048','#1f242c'];
 for(let row=0;row<11;row++)for(let x=-14;x<=L+14;x+=0.95){const t=r();CROWD.push({x:x+r()*0.5,y:W+5.5+row*1.45,z:0.6+row*1.15,c:t<0.12?'#f3efe2':t<0.2?'#d6a422':t<0.3?'#cf2730':t<0.36?'#15161a':cols[Math.floor(r()*cols.length)],ph:r()*6.28});}
 for(const side of [0,1])for(let row=0;row<8;row++)for(let y=-4;y<=W+4;y+=1.1){const t=r();const x=side?L+7+row*1.45:-7-row*1.45;CROWD.push({x,y:y+r()*0.4,z:0.6+row*1.15,c:t<0.18?(side?'#cf2730':'#d6a422'):cols[Math.floor(r()*cols.length)],ph:r()*6.28});}})();
const ADS=['NIRVANA','QUENCH REGIONAL','NIRVANA','KNUCKLEBOMB','QUENCH REGIONAL','NIRVANA','KNUCKLEBOMB','QUENCH REGIONAL','NIRVANA'];

function drawWorld(S){
 // night sky + stadium bowl glow
 const sky=g.createLinearGradient(0,0,0,VH);sky.addColorStop(0,'#05070b');sky.addColorStop(0.5,'#0b1018');sky.addColorStop(1,'#0a0d12');g.fillStyle=sky;g.fillRect(0,0,VW,VH);
 // far stand + end stands
 g.fillStyle='#141922';poly([[-24,W+5],[L+24,W+5],[L+24,W+21,13.5],[-24,W+21,13.5]]);g.fill();
 g.fillStyle='#10141b';poly([[-6,-8],[-6,W+8],[-20,W+8,10],[-20,-8,10]]);g.fill();poly([[L+6,-8],[L+6,W+8],[L+20,W+8,10],[L+20,-8,10]]);g.fill();
 const bob=S.t*4;
 for(const c of CROWD){const r=P(c.x,c.y,c.z+Math.max(0,Math.sin(bob+c.ph))*0.12*crowdHeat);if(!r||r.x<-10||r.x>VW+10)continue;const sz=Math.max(1,r.s*0.42);g.fillStyle=c.c;g.fillRect(r.x-sz/2,r.y-sz,sz,sz);}
 // flags along the top of the far stand — sixty-four-star flags
 for(let x=-10;x<=L+10;x+=11){const a=P(x,W+21,13.5),b2=P(x,W+21,17.5);if(!a||!b2)continue;g.strokeStyle='#8a8f98';g.lineWidth=1;g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b2.x,b2.y);g.stroke();
  const fw=a.s*2.6,fh=a.s*1.5,wave=Math.sin(S.t*2+x)*a.s*0.15;for(let i=0;i<7;i++){g.fillStyle=i%2?'#f2f2f2':'#b3202a';g.fillRect(b2.x,b2.y+i*fh/7+wave*(i/7),fw,fh/7+0.5);}g.fillStyle='#1d2f6b';g.fillRect(b2.x,b2.y,fw*0.45,fh*0.57);
  if(fw>18){g.fillStyle='#fff';for(let i=0;i<16;i++)g.fillRect(b2.x+2+(i%4)*fw*0.1,b2.y+2+Math.floor(i/4)*fh*0.12,1,1);}}
 // floodlights
 for(const fl of [[-16,W+26,30],[L+16,W+26,30]]){const r=P(fl[0],fl[1],fl[2]);if(!r)continue;const rad=r.s*14;const gr=g.createRadialGradient(r.x,r.y,0,r.x,r.y,rad);gr.addColorStop(0,'rgba(255,250,230,.85)');gr.addColorStop(0.15,'rgba(255,240,200,.25)');gr.addColorStop(1,'rgba(255,240,200,0)');g.fillStyle=gr;g.fillRect(r.x-rad,r.y-rad,rad*2,rad*2);
  g.fillStyle='#f8f3de';g.fillRect(r.x-r.s*2,r.y-r.s*0.6,r.s*4,r.s*1.2);}
 // apron + pitch stripes
 g.fillStyle='#163a22';poly([[-6,-7],[L+6,-7],[L+6,W+5],[-6,W+5]]);g.fill();
 for(let i=0;i<14;i++){g.fillStyle=i%2?'#2f7a3a':'#2a7034';poly([[i*7.5,0],[(i+1)*7.5,0],[(i+1)*7.5,W],[i*7.5,W]]);g.fill();}
 // floodlit centre wash
 const c0=P(CX,CY,0);if(c0){const rr=c0.s*60;const gr=g.createRadialGradient(c0.x,c0.y,0,c0.x,c0.y,rr);gr.addColorStop(0,'rgba(255,255,230,.10)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(c0.x-rr,c0.y-rr,rr*2,rr*2);}
 // ad boards on the far touchline
 for(let i=0;i<ADS.length;i++){const x0=-4+i*12.6,x1=x0+12;g.fillStyle=i%2?'#0e1a2e':'#2a0f12';poly([[x0,W+1.8,0],[x1,W+1.8,0],[x1,W+1.8,1.0],[x0,W+1.8,1.0]]);g.fill();
  const m=P((x0+x1)/2,W+1.8,0.5);if(m&&m.s>4){g.fillStyle=ADS[i]==='NIRVANA'?'#7fd3ff':ADS[i]==='KNUCKLEBOMB'?'#ffcc33':'#ff7a6b';g.font=`800 ${Math.max(7,m.s*0.62)}px 'Big Shoulders Display',Impact,sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(ADS[i],m.x,m.y);}}
 // lines
 g.strokeStyle='rgba(240,245,240,.78)';g.lineWidth=2;
 line3([[0,0],[L,0],[L,W],[0,W],[0,0]]);line3([[CX,0],[CX,W]]);
 const circ=(cx,cy,r,a0,a1)=>{const pts=[];for(let i=0;i<=40;i++){const a=a0+(a1-a0)*i/40;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);}line3(pts);};
 circ(CX,CY,9.15,0,Math.PI*2);circ(0,CY,BOX_R,-Math.PI/2,Math.PI/2);circ(L,CY,BOX_R,Math.PI/2,Math.PI*1.5);
 g.setLineDash([6,6]);circ(0,CY,BOX_R+4,-Math.PI/2,Math.PI/2);circ(L,CY,BOX_R+4,Math.PI/2,Math.PI*1.5);g.setLineDash([]);
 // scorch marks where men were lost
 for(const s of S.scorches){const r=P(s.x,s.y,0);if(!r)continue;g.fillStyle='rgba(12,10,8,.55)';g.beginPath();g.ellipse(r.x,r.y,r.s*s.r*1.6,r.s*s.r*0.75,0,0,Math.PI*2);g.fill();}
}
function drawGoal(gx){
 const out=gx===0?-1.3:1.3;
 g.fillStyle='rgba(255,255,255,.10)';poly([[gx,CY-GOAL_HW,GOAL_ZLO],[gx,CY+GOAL_HW,GOAL_ZLO],[gx,CY+GOAL_HW,GOAL_ZHI],[gx,CY-GOAL_HW,GOAL_ZHI]]);g.fill();
 g.fillStyle='rgba(255,255,255,.06)';poly([[gx+out,CY-GOAL_HW,GOAL_ZLO],[gx+out,CY+GOAL_HW,GOAL_ZLO],[gx+out,CY+GOAL_HW,GOAL_ZHI],[gx+out,CY-GOAL_HW,GOAL_ZHI]]);g.fill();
 g.strokeStyle='rgba(255,255,255,.25)';g.lineWidth=1;
 for(let i=1;i<6;i++){const y=CY-GOAL_HW+i*GOAL_HW*2/6;line3([[gx,y,GOAL_ZLO],[gx,y,GOAL_ZHI]]);}
 line3([[gx,CY-GOAL_HW,GOAL_ZHI],[gx+out,CY-GOAL_HW,GOAL_ZHI],[gx+out,CY+GOAL_HW,GOAL_ZHI],[gx,CY+GOAL_HW,GOAL_ZHI]]);
 g.strokeStyle='#f4f4f0';g.lineWidth=3.5;
 line3([[gx,CY-GOAL_HW,0],[gx,CY-GOAL_HW,GOAL_ZHI],[gx,CY+GOAL_HW,GOAL_ZHI],[gx,CY+GOAL_HW,0]]);
 g.lineWidth=2.5;line3([[gx,CY-GOAL_HW,GOAL_ZLO],[gx,CY+GOAL_HW,GOAL_ZLO]]);
}
export function timerColor(t){return t>10?'#ffd34d':t>5?'#ff9a2e':'#ff3b30';}
function drawPlayer(S,p,isHuman){
 const F=P(p.x,p.y,0),H=P(p.x,p.y,1.85);if(!F||!H)return;
 const h=F.y-H.y,s=F.s,T=TEAMS[p.team],gk=p.role==='GK';
 const kit=gk?T.gk:T.kit,trim=gk?T.gk2:T.kit2,fx=F.x,fy=F.y;
 g.fillStyle='rgba(0,0,0,.38)';g.beginPath();g.ellipse(fx,fy,0.55*s,0.22*s,0,0,Math.PI*2);g.fill();
 if(isHuman){g.strokeStyle='#58e6ff';g.lineWidth=2.5;g.beginPath();g.ellipse(fx,fy,0.9*s,0.36*s,0,0,Math.PI*2);g.stroke();}
 if(p.stun>0){g.fillStyle=kit;g.fillRect(fx-h*0.42,fy-h*0.13,h*0.7,h*0.14);g.fillStyle=trim;g.fillRect(fx-h*0.42,fy-h*0.13,h*0.12,h*0.14);g.fillStyle=p.skin;g.beginPath();g.arc(fx+h*0.36,fy-h*0.07,h*0.075,0,6.283);g.fill();return;}
 const side=Math.cos(p.face)>=0?1:-1,spd=Math.hypot(p.vx,p.vy),sw=Math.sin(p.run*4)*Math.min(1,spd/5)*h*0.15;
 const lean=p.action&&p.action.type==='tackle'?side*h*0.1:0;
 const hipY=fy-h*0.47;g.lineCap='round';
 g.strokeStyle=gk?'#222':T.shorts;g.lineWidth=Math.max(1.6,h*0.085);
 g.beginPath();g.moveTo(fx-h*0.05,hipY);g.lineTo(fx-h*0.05+sw,fy-h*0.02);g.moveTo(fx+h*0.05,hipY);g.lineTo(fx+h*0.05-sw,fy-h*0.02);g.stroke();
 g.fillStyle=T.shorts;g.fillRect(fx-h*0.13,hipY-h*0.08,h*0.26,h*0.12);
 const ty=fy-h*0.83,th=h*0.38,tx=fx-h*0.15+lean;
 g.fillStyle=kit;g.fillRect(tx,ty,h*0.30,th);
 g.fillStyle=trim;g.fillRect(tx,ty+th*0.42,h*0.30,th*0.14);
 g.fillRect(tx-h*0.04,ty-h*0.01,h*0.1,h*0.08);g.fillRect(tx+h*0.24,ty-h*0.01,h*0.1,h*0.08); // shoulder armour
 const carrier=S.ball.state==='held'&&S.ball.holder===p.id;
 g.strokeStyle=kit;g.lineWidth=Math.max(1.4,h*0.07);g.beginPath();
 const shL=[tx+h*0.02,ty+h*0.04],shR=[tx+h*0.28,ty+h*0.04];let hL,hR;
 if(carrier&&p.action&&p.action.type==='release'){hL=[fx-side*h*0.05,ty-h*0.12];hR=[fx-side*h*0.12,ty-h*0.18];}
 else if(carrier){hL=[fx+lean+side*h*0.16,ty+h*0.2];hR=[fx+lean+side*h*0.22,ty+h*0.18];}
 else if(p.action&&p.action.type==='behead'){const k=p.action.t/p.action.dur;hL=[fx+side*h*(0.1+k*0.4),ty-h*0.1+k*h*0.2];hR=[fx+side*h*(0.15+k*0.4),ty-h*0.05+k*h*0.2];}
 else{hL=[shL[0]-h*0.04-sw*0.6,ty+h*0.32];hR=[shR[0]+h*0.04+sw*0.6,ty+h*0.32];}
 g.moveTo(shL[0],shL[1]);g.lineTo(hL[0],hL[1]);g.moveTo(shR[0],shR[1]);g.lineTo(hR[0],hR[1]);g.stroke();
 if(!gk){g.fillStyle='#2b2b2b';for(const hh of [hL,hR]){g.beginPath();g.arc(hh[0],hh[1],Math.max(1.5,h*0.045),0,6.283);g.fill();}} // spiked gloves
 g.fillStyle=p.skin;g.beginPath();g.arc(fx+lean,ty-h*0.07,h*0.085,0,6.283);g.fill();
 g.fillStyle=trim;g.beginPath();g.arc(fx+lean,ty-h*0.085,h*0.088,Math.PI,0);g.fill(); // helmet
 if(h>26){g.fillStyle=gk?'#fff':T.num;g.font=`800 ${Math.round(h*0.17)}px 'Big Shoulders Display',Impact,sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(p.num,fx+lean,ty+th*0.24);}
 if(p.hasChain){
  let bx,by;
  if(p.action&&p.action.type==='chain'){const a=p.action.t/p.action.dur*Math.PI*2.2*side;bx=hR[0]+Math.cos(a)*h*0.75;by=hR[1]-h*0.1+Math.sin(a)*h*0.3;}
  else{bx=hR[0]+side*h*0.05;by=hR[1]+h*0.22;}
  g.strokeStyle='#9aa0a8';g.lineWidth=Math.max(1,h*0.025);g.beginPath();g.moveTo(hR[0],hR[1]);g.lineTo(bx,by);g.stroke();
  g.fillStyle='#3d4148';g.beginPath();g.arc(bx,by,Math.max(2,h*0.07),0,6.283);g.fill();g.fillStyle='#8e949c';g.beginPath();g.arc(bx-h*0.02,by-h*0.02,Math.max(0.8,h*0.025),0,6.283);g.fill();
 }
 if(p.action&&p.action.type==='behead'){const k=p.action.t/p.action.dur;g.strokeStyle=`rgba(255,255,255,${0.8*(1-k)})`;g.lineWidth=3;g.beginPath();g.arc(fx,ty,h*0.6,side>0?-1.2:Math.PI-0.6,side>0?0.6:Math.PI+1.2);g.stroke();}
 if(isHuman){g.fillStyle='#58e6ff';g.beginPath();const ay=ty-h*0.3;g.moveTo(fx-6,ay-8);g.lineTo(fx+6,ay-8);g.lineTo(fx,ay);g.closePath();g.fill();}
}
function drawBall(S){
 const b=S.ball;if(b.state==='dead')return;
 const r=P(b.x,b.y,b.z);if(!r)return;
 const rad=Math.max(3.5,r.s*0.26),col=timerColor(b.timer);
 g.fillStyle='#24272d';g.beginPath();g.arc(r.x,r.y,rad,0,6.283);g.fill();
 const blink=b.state==='held'&&b.timer<5?(Math.sin(S.t*20)>0?1:0.4):1;
 g.save();g.shadowColor=col;g.shadowBlur=12*blink;g.strokeStyle=col;g.globalAlpha=b.state==='held'?blink:0.55;g.lineWidth=Math.max(1.5,rad*0.35);g.beginPath();g.arc(r.x,r.y,rad*0.85,0,6.283);g.stroke();g.restore();
}
function drawBallShadow(S){const b=S.ball;if(b.state==='dead'||b.state==='held')return;const r=P(b.x,b.y,0);if(!r)return;g.fillStyle='rgba(0,0,0,.4)';g.beginPath();g.ellipse(r.x,r.y,r.s*0.3,r.s*0.12,0,0,6.283);g.fill();}
function drawTimerLabel(S){
 const b=S.ball;if(b.state==='dead')return;
 let r;if(b.state==='held'){const p=S.players[b.holder];r=P(p.x,p.y,2.55);}else r=P(b.x,b.y,b.z+0.7);
 if(!r)return;
 const n=Math.max(0,Math.ceil(b.timer)),col=timerColor(b.timer),sz=Math.max(15,Math.min(46,r.s*0.95));
 g.font=`900 ${sz}px 'Big Shoulders Display',Impact,sans-serif`;g.textAlign='center';g.textBaseline='bottom';
 g.lineWidth=4;g.strokeStyle='rgba(0,0,0,.7)';g.globalAlpha=b.state==='held'?1:0.6;g.strokeText(n,r.x,r.y);g.fillStyle=col;g.fillText(n,r.x,r.y);g.globalAlpha=1;
}
function drawEffects(S){
 for(const e of S.effects){const k=e.t/e.dur;
  if(e.type==='boom'){const c=P(e.x,e.y,1.0),gnd=P(e.x,e.y,0);if(!c)continue;
   if(k<0.12){g.fillStyle=`rgba(255,250,235,${0.6*(1-k/0.12)})`;g.fillRect(0,0,VW,VH);}
   const rad=c.s*(0.8+k*5.5);const gr=g.createRadialGradient(c.x,c.y,0,c.x,c.y,rad);
   gr.addColorStop(0,`rgba(255,255,240,${1-k})`);gr.addColorStop(0.3,`rgba(255,200,90,${0.9*(1-k)})`);gr.addColorStop(0.65,`rgba(240,80,30,${0.6*(1-k)})`);gr.addColorStop(1,'rgba(60,20,10,0)');
   g.fillStyle=gr;g.beginPath();g.arc(c.x,c.y,rad,0,6.283);g.fill();
   if(gnd){g.strokeStyle=`rgba(255,230,180,${0.7*(1-k)})`;g.lineWidth=3;g.beginPath();g.ellipse(gnd.x,gnd.y,gnd.s*(1+k*9),gnd.s*(0.4+k*3.6),0,0,6.283);g.stroke();}
   const r=rng(e.seed);for(let i=0;i<34;i++){const a=r()*6.283,sp=(2+r()*7)*c.s,lift=r()*4*c.s;const x=c.x+Math.cos(a)*sp*k,y=c.y+Math.sin(a)*sp*k*0.5-lift*k+k*k*c.s*5;g.fillStyle=r()<0.5?`rgba(255,${150+Math.floor(r()*100)},60,${1-k})`:`rgba(40,40,40,${0.8*(1-k)})`;const sz=Math.max(1.5,c.s*0.18*(1-k));g.fillRect(x,y,sz,sz);}
   const sm=P(e.x,e.y,2+k*6);if(sm){g.fillStyle=`rgba(40,38,36,${0.45*(1-k)})`;g.beginPath();g.arc(sm.x,sm.y,sm.s*(1+k*3),0,6.283);g.fill();}
  }else if(e.type==='slash'){const c=P(e.x,e.y,1.6);if(!c)continue;g.strokeStyle=`rgba(255,255,255,${1-k})`;g.lineWidth=Math.max(2,c.s*0.25*(1-k));g.beginPath();g.moveTo(c.x-e.dir*c.s*1.6,c.y-c.s*0.5);g.lineTo(c.x+e.dir*c.s*1.6,c.y+c.s*0.3);g.stroke();
   if(k<0.1){g.fillStyle=`rgba(255,255,255,${0.35*(1-k/0.1)})`;g.fillRect(0,0,VW,VH);}}
 }
}
function drawSideline(S){
 // coaches in suits on the far touchline; one referee who follows play
 const b=S.ball;const ents=[];
 for(const team of [0,1]){const x=team===0?CX-14:CX+14;const r=P(x,W+0.9,0),hd=P(x,W+0.9,1.8);if(!r||!hd)continue;const h=r.y-hd.y;
  const near=b.state==='held'&&Math.abs(b.x-x)<30;const wave=near?Math.sin(S.t*9+team)*h*0.2:0;
  g.fillStyle=TEAMS[team].coach;g.fillRect(r.x-h*0.14,r.y-h*0.82,h*0.28,h*0.82);g.fillStyle='#e8e2d4';g.fillRect(r.x-h*0.03,r.y-h*0.8,h*0.06,h*0.2);
  g.strokeStyle=TEAMS[team].coach;g.lineWidth=Math.max(1.4,h*0.07);g.beginPath();g.moveTo(r.x+h*0.12,r.y-h*0.75);g.lineTo(r.x+h*0.25,r.y-h*1.0-wave);g.stroke();
  g.fillStyle='#c9a080';g.beginPath();g.arc(r.x,r.y-h*0.9,h*0.085,0,6.283);g.fill();}
}
const REF={x:CX,y:CY-8};
function drawRef(S){
 const r=P(REF.x,REF.y,0),hd=P(REF.x,REF.y,1.8);if(!r||!hd)return;const h=r.y-hd.y;
 g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.ellipse(r.x,r.y,0.5*r.s,0.2*r.s,0,0,6.283);g.fill();
 g.strokeStyle='#111';g.lineWidth=Math.max(1.5,h*0.08);g.beginPath();g.moveTo(r.x-h*0.05,r.y-h*0.47);g.lineTo(r.x-h*0.05,r.y);g.moveTo(r.x+h*0.05,r.y-h*0.47);g.lineTo(r.x+h*0.05,r.y);g.stroke();
 for(let i=0;i<5;i++){g.fillStyle=i%2?'#111':'#d8d8d8';g.fillRect(r.x-h*0.15+i*h*0.06,r.y-h*0.83,h*0.06,h*0.38);}
 g.fillStyle='#b98a66';g.beginPath();g.arc(r.x,r.y-h*0.9,h*0.08,0,6.283);g.fill();
}
function drawCrowdCut(S){
 const c=S.cut;if(!c||c.t<c.delay)return;
 const k=(c.t-c.delay),a=Math.min(1,k*6)*Math.min(1,(c.dur-c.t)*4);
 g.save();g.globalAlpha=a;
 const bg=g.createLinearGradient(0,0,0,VH);bg.addColorStop(0,'#1a1410');bg.addColorStop(1,'#0b0908');g.fillStyle=bg;g.fillRect(0,0,VW,VH);
 const r=rng(9);
 for(let row=0;row<9;row++){const y=VH*0.18+row*VH*0.11,sz=VH*(0.035+row*0.012);for(let x=-sz;x<VW+sz;x+=sz*1.25){const bob=Math.sin(S.t*6+x*0.05+row)*sz*0.12*(row%2?1:-1);const t=r();
  g.fillStyle=t<0.15?'#f3efe2':t<0.25?'#d6a422':t<0.35?'#cf2730':['#3b3330','#4a403a','#2e2826','#57493f'][Math.floor(r()*4)];g.fillRect(x-sz*0.4,y+sz*0.35+bob,sz*0.8,sz*1.2);
  g.fillStyle=['#8d5a3b','#c68a62','#e0b08a','#6b4430','#f0c9a6'][Math.floor(r()*5)];g.beginPath();g.arc(x,y+bob,sz*0.33,0,6.283);g.fill();
  if(r()<0.12){g.strokeStyle=g.fillStyle;g.lineWidth=sz*0.18;g.beginPath();g.moveTo(x+sz*0.3,y+sz*0.5+bob);g.lineTo(x+sz*0.55,y-sz*0.5+bob);g.stroke();}}}
 const vg=g.createRadialGradient(VW/2,VH/2,VH*0.2,VW/2,VH/2,VH*0.9);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.7)');g.fillStyle=vg;g.fillRect(0,0,VW,VH);
 g.fillStyle='rgba(8,11,16,.92)';const bw=Math.min(VW-32,720),bx=(VW-bw)/2,by=VH*0.72;g.fillRect(bx,by,bw,86);g.fillStyle='#d1232b';g.fillRect(bx,by+82,bw,4);
 g.fillStyle='#f3efe4';g.textAlign='left';g.textBaseline='top';g.font=`900 ${Math.min(44,bw/14)}px 'Big Shoulders Display',Impact,sans-serif`;g.fillText(c.text,bx+18,by+10);
 g.fillStyle='#8e98a6';g.font=`700 ${Math.min(15,bw/40)}px 'Barlow Semi Condensed',Arial,sans-serif`;g.fillText(c.sub,bx+18,by+56);
 g.restore();
}
function drawRadar(S){
 const w=Math.min(220,VW*0.26),h=w*W/L,x0=VW-w-14,y0=VH-h-14;
 g.fillStyle='rgba(8,11,16,.78)';g.fillRect(x0-6,y0-6,w+12,h+12);g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=1;g.strokeRect(x0,y0,w,h);
 g.beginPath();g.moveTo(x0+w/2,y0);g.lineTo(x0+w/2,y0+h);g.stroke();
 const X=x=>x0+x/L*w,Y=y=>y0+h-y/W*h;
 for(const p of S.players){if(!onPitch(p))continue;g.fillStyle=p.role==='GK'?TEAMS[p.team].gk:(p.team===0?TEAMS[0].kit2:TEAMS[1].kit2);g.beginPath();g.arc(X(p.x),Y(p.y),p.id===YOU?3.6:2.4,0,6.283);g.fill();
  if(p.id===YOU){g.strokeStyle='#58e6ff';g.lineWidth=1.5;g.stroke();}}
 const b=S.ball;if(b.state!=='dead'){g.fillStyle='#fff';g.fillRect(X(b.x)-1.5,Y(b.y)-1.5,3,3);}
}
export function render(S,dt,o){
 YOU=o.you;crowdHeat=o.heat;
 g.setTransform(DPR,0,0,DPR,0,0);
 updateCam(S,dt);
 drawWorld(S);
 drawBallShadow(S);
 const ents=[];
 for(const p of S.players)if(onPitch(p))ents.push({y:p.y,f:()=>drawPlayer(S,p,p.id===YOU)});
 ents.push({y:CY+GOAL_HW+0.01,f:()=>{drawGoal(0);drawGoal(L);}});
 ents.push({y:REF.y,f:()=>drawRef(S)});
 const b=S.ball;if(b.state!=='dead')ents.push({y:b.y-0.01,f:()=>drawBall(S)});
 ents.sort((a,c)=>c.y-a.y);
 drawSideline(S);
 for(const e of ents)e.f();
 drawEffects(S);drawTimerLabel(S);
 drawCrowdCut(S);
 if(o.radar)drawRadar(S);
}
