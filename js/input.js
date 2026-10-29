/* Knucklebomb input — keyboard + gamepad + multi-touch virtual controls → button-counter input (see sim.js HUMAN CONTROL).
   K / gamepad B / touch SHOOT: if you hold the ball it charges a shot (release to throw); otherwise it swings the chain.
   v2 */
const GAMEKEYS=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyJ','KeyK','KeyQ','KeyL','ShiftLeft','ShiftRight']);

export function createInput({isCarrier,onPause,onMute,active}){
 const keys=new Set();
 const st={a:0,b:0,s:0,w:0,pw:0,charging:false,charge:0,changed:false};
 let pad={mx:0,my:0,a:false,b:false,x:false,rt:false,start:false};
 let touch={mx:0,my:0,sp:false};
 const pressA=()=>{st.a++;st.changed=true;};
 const pressB=()=>{if(isCarrier()){st.charging=true;st.charge=0;}else{st.b++;st.changed=true;}};
 const releaseB=()=>{if(st.charging){st.s++;st.pw=Math.min(1,st.charge/0.7);st.charging=false;st.charge=0;st.changed=true;}};
 const pressW=()=>{st.w++;st.changed=true;};
 addEventListener('keydown',e=>{
  if(!active())return;
  if(GAMEKEYS.has(e.code))e.preventDefault();
  if(e.repeat)return;
  keys.add(e.code);
  if(e.code==='KeyJ'||e.code==='Space')pressA();
  else if(e.code==='KeyK')pressB();
  else if(e.code==='KeyQ'||e.code==='KeyL')pressW();
  else if(e.code==='KeyP'||e.code==='Escape')onPause();
  else if(e.code==='KeyM')onMute();
 });
 addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyK')releaseB();});
 addEventListener('blur',()=>{keys.clear();touch.mx=0;touch.my=0;touch.sp=false;releaseB();});

 /* ---------- multi-touch virtual joystick & action buttons ---------- */
 function bindTouchControls(){
  const root=document.getElementById('touchControls');
  const stickZone=document.getElementById('touchStick');
  const stickNub=document.getElementById('touchNub');
  if(!root||!stickZone||!stickNub)return;
  let stickId=null,cx=0,cy=0,maxR=48;
  const updateStick=(clientX,clientY)=>{
   const dx=clientX-cx,dy=clientY-cy;
   const dist=Math.hypot(dx,dy);
   const clamped=Math.min(maxR,dist);
   const ang=Math.atan2(dy,dx);
   const nx=dist>6?(clamped/maxR)*Math.cos(ang):0;
   const ny=dist>6?-(clamped/maxR)*Math.sin(ang):0;
   touch.mx=nx;touch.my=ny;st.changed=true;
   stickNub.style.transform=`translate(${Math.cos(ang)*clamped}px,${Math.sin(ang)*clamped}px)`;
  };
  const resetStick=()=>{stickId=null;touch.mx=0;touch.my=0;st.changed=true;stickNub.style.transform='translate(0px,0px)';};
  stickZone.addEventListener('pointerdown',e=>{
   if(!active())return;
   e.preventDefault();
   stickZone.setPointerCapture(e.pointerId);
   stickId=e.pointerId;
   const r=stickZone.getBoundingClientRect();
   cx=r.left+r.width/2;cy=r.top+r.height/2;maxR=Math.max(36,r.width*0.38);
   updateStick(e.clientX,e.clientY);
  });
  stickZone.addEventListener('pointermove',e=>{if(e.pointerId===stickId)updateStick(e.clientX,e.clientY);});
  stickZone.addEventListener('pointerup',e=>{if(e.pointerId===stickId)resetStick();});
  stickZone.addEventListener('pointercancel',e=>{if(e.pointerId===stickId)resetStick();});

  const bindBtn=(id,downFn,upFn)=>{
   const el=document.getElementById(id);
   if(!el)return;
   el.addEventListener('pointerdown',e=>{if(!active())return;e.preventDefault();el.setPointerCapture(e.pointerId);el.dataset.active='1';downFn();});
   const end=e=>{if(el.dataset.active==='1'){delete el.dataset.active;if(upFn)upFn();}};
   el.addEventListener('pointerup',end);
   el.addEventListener('pointercancel',end);
  };
  bindBtn('touchPass',()=>pressA());
  bindBtn('touchShoot',()=>pressB(),()=>releaseB());
  bindBtn('touchSwitch',()=>pressW());
  bindBtn('touchSprint',()=>{touch.sp=true;st.changed=true;},()=>{touch.sp=false;st.changed=true;});
  bindBtn('touchPause',()=>onPause());
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindTouchControls);
 else bindTouchControls();

 const down=c=>keys.has(c);
 function poll(dt){
  const gp=navigator.getGamepads?[...navigator.getGamepads()].find(g=>g):null;
  const prev=pad;
  if(gp){const dz=v=>Math.abs(v)<0.18?0:v,bt=i=>!!(gp.buttons[i]&&gp.buttons[i].pressed);
   pad={mx:dz(gp.axes[0]||0)+(bt(15)?1:0)-(bt(14)?1:0),my:-dz(gp.axes[1]||0)+(bt(12)?1:0)-(bt(13)?1:0),a:bt(0),b:bt(1),x:bt(2)||bt(3),rt:bt(7)||bt(5),start:bt(9)};}
  else pad={mx:0,my:0,a:false,b:false,x:false,rt:false,start:false};
  if(active()){
   if(pad.a&&!prev.a)pressA();if(pad.b&&!prev.b)pressB();if(!pad.b&&prev.b)releaseB();if(pad.x&&!prev.x)pressW();if(pad.start&&!prev.start)onPause();
  }
  if(st.charging){st.charge+=dt;if(st.charge>=1.2)releaseB();}
 }
 function read(){
  const mx=(down('KeyD')||down('ArrowRight')?1:0)-(down('KeyA')||down('ArrowLeft')?1:0)+pad.mx+touch.mx;
  const my=(down('KeyW')||down('ArrowUp')?1:0)-(down('KeyS')||down('ArrowDown')?1:0)+pad.my+touch.my;
  return{mx:Math.max(-1,Math.min(1,mx)),my:Math.max(-1,Math.min(1,my)),sp:down('ShiftLeft')||down('ShiftRight')||pad.rt||touch.sp?1:0,a:st.a,b:st.b,s:st.s,pw:Math.round(st.pw*100)/100,w:st.w};
 }
 function takeChanged(){const c=st.changed;st.changed=false;return c;}
 function reset(){keys.clear();touch.mx=0;touch.my=0;touch.sp=false;Object.assign(st,{a:0,b:0,s:0,w:0,pw:0,charging:false,charge:0,changed:false});}
 return{poll,read,takeChanged,reset,charge:()=>st.charging?Math.min(1,st.charge/0.7):0};
}
