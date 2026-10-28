/* =====================================================================
   AUDIO — synthesized, starts on first click.
   ===================================================================== */
export const AU={c:null,m:null,crowd:null,muted:false,noise:null,
 init(){if(this.c)return;try{const C=new(window.AudioContext||window.webkitAudioContext)();this.c=C;this.m=C.createGain();this.m.gain.value=0.7;this.m.connect(C.destination);
  const len=C.sampleRate*2,buf=C.createBuffer(1,len,C.sampleRate),d=buf.getChannelData(0);let last=0;for(let i=0;i<len;i++){const w=Math.random()*2-1;last=(last+0.04*w)/1.04;d[i]=last*3.2;}this.noise=buf;
  const src=C.createBufferSource();src.buffer=buf;src.loop=true;const bp=C.createBiquadFilter();bp.type='bandpass';bp.frequency.value=620;bp.Q.value=0.5;this.crowd=C.createGain();this.crowd.gain.value=0.0;src.connect(bp);bp.connect(this.crowd);this.crowd.connect(this.m);src.start();}catch(e){this.c=null;}},
 toggle(){this.muted=!this.muted;if(this.m)this.m.gain.value=this.muted?0:0.7;},
 tension(x){if(!this.c)return;this.crowd.gain.setTargetAtTime(0.18+x*0.35,this.c.currentTime,0.25);},
 swell(a){if(!this.c)return;const g=this.crowd.gain,t=this.c.currentTime;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(a,t+0.15);g.setTargetAtTime(0.2,t+1.2,0.8);},
 tone(f,dur,type,vol,slide){if(!this.c)return;const C=this.c,o=C.createOscillator(),g=C.createGain(),t=C.currentTime;o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+dur);g.gain.setValueAtTime(vol||0.1,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(this.m);o.start(t);o.stop(t+dur+0.02);},
 burst(dur,freq,vol){if(!this.c)return;const C=this.c,s=C.createBufferSource(),f=C.createBiquadFilter(),g=C.createGain(),t=C.currentTime;s.buffer=this.noise;f.type='lowpass';f.frequency.setValueAtTime(freq,t);f.frequency.exponentialRampToValueAtTime(60,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);s.connect(f);f.connect(g);g.connect(this.m);s.start(t,Math.random());s.stop(t+dur+0.05);},
 whistle(){if(!this.c)return;const C=this.c,o=C.createOscillator(),l=C.createOscillator(),lg=C.createGain(),g=C.createGain(),t=C.currentTime;o.frequency.value=2900;l.frequency.value=34;lg.gain.value=90;l.connect(lg);lg.connect(o.frequency);g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.09,t+0.02);g.gain.setValueAtTime(0.09,t+0.38);g.gain.exponentialRampToValueAtTime(0.0001,t+0.48);o.connect(g);g.connect(this.m);o.start(t);l.start(t);o.stop(t+0.5);l.stop(t+0.5);},
 play(name,arg){switch(name){
  case 'beep':this.tone(700+(6-arg)*140,0.09,'square',0.06);break;
  case 'boom':this.burst(1.6,2400,1.0);this.tone(90,1.0,'sine',0.5,28);this.swell(0.9);break;
  case 'slash':this.burst(0.25,5000,0.35);this.tone(300,0.3,'sawtooth',0.06,80);this.swell(0.8);break;
  case 'goal':this.swell(1.1);this.whistle();break;
  case 'whistle':this.whistle();break;case 'whistle2':setTimeout(()=>this.whistle(),550);break;
  case 'chain':this.burst(0.22,900,0.55);this.tone(140,0.15,'triangle',0.2,60);break;
  case 'thud':this.burst(0.12,700,0.3);break;case 'swing':this.burst(0.18,3000,0.08);break;
  case 'throw':this.burst(0.12,2500,0.06);break;case 'catch':this.tone(220,0.06,'triangle',0.06);break;
  case 'save':this.swell(0.7);break;case 'bounce':this.tone(160,0.05,'triangle',0.05);break;}}
};
