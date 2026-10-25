import * as SH from './shared.js';
import { GameCore } from './core.js';
import { loadModels, prepare, faceForward, makeAgentModel } from './models.js';
(function(){
'use strict';
const V3 = THREE.Vector3;
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t;
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const angWrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
const $=s=>document.querySelector(s);

/* ============ Settings (settings.json equivalent) ============ */
const DEF={ver:1,mode:'ffa',kothLimit:60,assist:true,autofire:false,music:.45,sfx:.8,ui:.7,sens:1,touchSens:1,fov:80,invertY:false,quality:'high',uiScale:1,bloom:true,shake:true,hitFlash:true,stats:true,
  name:'代理人',bots:5,diff:'normal',time:5,scoreLimit:20};
let S=Object.assign({},DEF);let hadSaved=false;
try{const raw=localStorage.getItem('neongrid.settings');if(raw){const o=JSON.parse(raw);if(o&&o.ver===1){S=Object.assign({},DEF,o);hadSaved=true;}}}catch(e){}
const COARSE=matchMedia('(pointer:coarse)').matches&&!matchMedia('(pointer:fine)').matches;
if(!hadSaved&&COARSE){S.quality='low';S.stats=false;}
function saveSettings(){try{localStorage.setItem('neongrid.settings',JSON.stringify(S));}catch(e){}}
const sanitizeName=SH.sanitizeName;

/* ============ Renderer ============ */
const QUALITY={low:{pr:Math.min(.8,window.devicePixelRatio||1),rain:2200,lights:false},medium:{pr:1,rain:5000,lights:true},high:{pr:Math.min(window.devicePixelRatio||1,2),rain:9000,lights:true}};
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.0;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
$('#game').appendChild(renderer.domElement);
const MAXANISO=renderer.capabilities.getMaxAnisotropy();
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0xc9d9ea,0.0075);
const camera=new THREE.PerspectiveCamera(S.fov,innerWidth/innerHeight,0.05,500);
camera.rotation.order='YXZ';
const vmScene=new THREE.Scene();
const vmCam=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,0.01,10);
vmScene.add(vmCam);

/* ============ Canvas textures ============ */
function mk(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')];}
function tex(c,o={}){const t=new THREE.CanvasTexture(c);if(o.srgb!==false)t.encoding=THREE.sRGBEncoding;if(o.repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;}t.anisotropy=Math.min(8,MAXANISO);return t;}
function grain(g,w,h,amp,seed){const id=g.getImageData(0,0,w,h),d=id.data,r=rng(seed);for(let i=0;i<d.length;i+=4){const n=(r()-.5)*amp;d[i]+=n;d[i+1]+=n;d[i+2]+=n;}g.putImageData(id,0,0);}
function blotch(g,w,h,cells,alpha,seed,mode){const [c,cg]=mk(cells,cells),r=rng(seed),id=cg.createImageData(cells,cells);
  for(let i=0;i<id.data.length;i+=4){const v=r()*255;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=255;}cg.putImageData(id,0,0);
  g.save();g.globalAlpha=alpha;g.globalCompositeOperation=mode||'soft-light';g.imageSmoothingEnabled=true;g.drawImage(c,0,0,w,h);g.restore();}

function concreteTex(seed,base){const [c,g]=mk(512,512);g.fillStyle=base;g.fillRect(0,0,512,512);
  blotch(g,512,512,8,.55,seed);blotch(g,512,512,32,.35,seed+1);grain(g,512,512,26,seed+2);
  const r=rng(seed+3);for(let i=0;i<34;i++){const x=r()*512,w=4+r()*18,h=60+r()*220;const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(0,0,0,.28)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.save();g.translate(x,r()*300);g.fillRect(0,0,w,h);g.restore();}
  g.fillStyle='rgba(0,0,0,.45)';g.fillRect(0,255,512,2);g.fillRect(255,0,2,512);
  g.fillStyle='rgba(255,255,255,.05)';g.fillRect(0,257,512,1);
  for(let x=64;x<512;x+=128)for(let y=64;y<512;y+=128){g.fillStyle='rgba(0,0,0,.55)';g.beginPath();g.arc(x,y,3.5,0,7);g.fill();}
  return tex(c,{repeat:true});}
function panelTex(seed){const [c,g]=mk(512,512);g.fillStyle='#7d8694';g.fillRect(0,0,512,512);blotch(g,512,512,16,.3,seed);grain(g,512,512,14,seed+1);
  for(let x=0;x<512;x+=128)for(let y=0;y<512;y+=256){g.fillStyle='rgba(0,0,0,.6)';g.fillRect(x,y,128,2);g.fillRect(x,y,2,256);g.fillStyle='rgba(255,255,255,.08)';g.fillRect(x+2,y+2,126,1);
    g.fillStyle='rgba(0,0,0,.5)';for(const [a,b] of [[8,8],[118,8],[8,246],[118,246]]){g.beginPath();g.arc(x+a,y+b,2.5,0,7);g.fill();}}
  const r=rng(seed+5);for(let i=0;i<5;i++){g.fillStyle=r()<.5?'rgba(255,180,58,.5)':'rgba(46,242,255,.35)';g.fillRect(Math.floor(r()*4)*128+14,Math.floor(r()*2)*256+20+r()*180,30+r()*40,6);}
  return tex(c,{repeat:true});}
function grateTex(){const [c,g]=mk(256,256);g.fillStyle='#6a737f';g.fillRect(0,0,256,256);grain(g,256,256,12,9);
  for(let y=0;y<256;y+=16)for(let x=0;x<256;x+=16){g.fillStyle='#07090d';g.fillRect(x+2,y+5,12,6);g.fillStyle='rgba(255,255,255,.07)';g.fillRect(x+2,y+11,12,1);}
  return tex(c,{repeat:true});}
function crateTex(){const [c,g]=mk(256,256);g.fillStyle='#5f6670';g.fillRect(0,0,256,256);blotch(g,256,256,8,.4,21);grain(g,256,256,18,22);
  g.save();g.beginPath();g.rect(0,18,256,30);g.clip();for(let i=-2;i<14;i++){g.fillStyle=i%2?'#d89a2a':'#151515';g.beginPath();g.moveTo(i*24,18);g.lineTo(i*24+24,18);g.lineTo(i*24,48);g.lineTo(i*24-24,48);g.fill();}g.restore();
  g.strokeStyle='rgba(0,0,0,.6)';g.lineWidth=6;g.strokeRect(3,3,250,250);g.fillStyle='rgba(220,230,245,.55)';g.font='700 40px "Chakra Petch",sans-serif';g.fillText('NG-07',22,150);
  g.font='500 16px "Chakra Petch",sans-serif';g.fillText('RELAY CARGO',24,180);grain(g,256,256,10,23);return tex(c,{repeat:true});}
function circuitTex(){const [c,g]=mk(512,512);g.fillStyle='#000';g.fillRect(0,0,512,512);const r=rng(31);g.strokeStyle='#bffcff';g.lineCap='square';
  for(let i=0;i<70;i++){let x=Math.round(r()*32)*16,y=Math.round(r()*32)*16;g.lineWidth=r()<.2?3:1.5;g.globalAlpha=.25+r()*.6;g.beginPath();g.moveTo(x,y);
    for(let k=0;k<4;k++){if(r()<.5)x+=(r()<.5?-1:1)*16*(1+Math.floor(r()*5));else y+=(r()<.5?-1:1)*16*(1+Math.floor(r()*5));g.lineTo(x,y);}g.stroke();g.beginPath();g.arc(x,y,3,0,7);g.fillStyle='#bffcff';g.fill();}
  g.globalAlpha=1;return tex(c,{repeat:true});}
function windowsTex(seed,cols,rows){const [c,g]=mk(256,512);g.fillStyle='#000';g.fillRect(0,0,256,512);const r=rng(seed);const cw=256/cols,rh=512/rows;
  const pal=['#ffd59a','#9fe8ff','#ffb0e6','#fff1d6'];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){if(r()<.36){g.fillStyle=pal[Math.floor(r()*pal.length)];g.globalAlpha=.35+r()*.65;g.fillRect(x*cw+cw*.18,y*rh+rh*.2,cw*.64,rh*.55);}}
  g.globalAlpha=1;return tex(c,{repeat:true});}
function signTex(text,sub,color,w=512,h=256,font=150){const [c,g]=mk(w,h);g.fillStyle='rgba(4,8,18,.92)';g.fillRect(0,0,w,h);
  g.strokeStyle=color;g.lineWidth=5;g.shadowColor=color;g.shadowBlur=18;g.strokeRect(10,10,w-20,h-20);
  g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';g.font=`700 ${font}px "Noto Sans TC","Chakra Petch",sans-serif`;g.fillText(text,w/2,sub?h*.43:h/2);
  if(sub){g.shadowBlur=8;g.font=`600 ${Math.round(font*.26)}px "Chakra Petch","Noto Sans TC",sans-serif`;g.fillStyle='#e8f6ff';g.fillText(sub,w/2,h*.8);}
  return tex(c);}
function vSignTex(chars,color){const [c,g]=mk(128,512);g.fillStyle='rgba(4,8,18,.95)';g.fillRect(0,0,128,512);g.strokeStyle=color;g.lineWidth=4;g.shadowColor=color;g.shadowBlur=14;g.strokeRect(8,8,112,496);
  g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';g.font='900 92px "Noto Sans TC",sans-serif';const n=chars.length;for(let i=0;i<n;i++)g.fillText(chars[i],64,512*(i+.5)/n);return tex(c);}
function vendingTex(seed,hue){const [c,g]=mk(256,512);g.fillStyle='#0b1220';g.fillRect(0,0,256,512);const r=rng(seed);
  const gr=g.createLinearGradient(0,0,0,300);gr.addColorStop(0,hue);gr.addColorStop(1,'#0b1220');g.fillStyle=gr;g.globalAlpha=.55;g.fillRect(14,14,228,300);g.globalAlpha=1;
  for(let y=0;y<5;y++)for(let x=0;x<4;x++){g.fillStyle=`hsl(${Math.floor(r()*360)},80%,${55+r()*20}%)`;g.fillRect(28+x*52,30+y*56,30,40);g.fillStyle='rgba(255,255,255,.6)';g.fillRect(28+x*52,74+y*56,30,4);}
  g.fillStyle='#e9f5ff';g.font='700 34px "Chakra Petch",sans-serif';g.textAlign='center';g.fillText('DRINK',128,370);g.fillStyle='#04060b';g.fillRect(150,400,80,80);g.fillStyle=hue;g.fillRect(40,420,80,10);return tex(c);}
function floorTextures(){
  const S2=2048,m=S2/50,W=x=>(x+25)*m,Z=z=>(z+25)*m;
  const [c,g]=mk(S2,S2);g.fillStyle='#5a5f68';g.fillRect(0,0,S2,S2);blotch(g,S2,S2,12,.5,41);blotch(g,S2,S2,64,.3,42);blotch(g,S2,S2,256,.18,43);grain(g,S2,S2,20,44);
  g.fillStyle='rgba(0,0,0,.5)';for(let k=-25;k<=25;k+=5){g.fillRect(W(k)-1,0,2,S2);g.fillRect(0,Z(k)-1,S2,2);}
  const paint=(col,a)=>{g.strokeStyle=col;g.fillStyle=col;g.globalAlpha=a;};
  // ring around relay core
  paint('#2ef2ff',.42);g.lineWidth=.16*m;g.setLineDash([.9*m,.5*m]);g.beginPath();g.arc(W(0),Z(0),6.2*m,0,Math.PI*2);g.stroke();g.setLineDash([]);
  g.lineWidth=.1*m;g.beginPath();g.arc(W(0),Z(0),7*m,0,Math.PI*2);g.stroke();
  // lanes
  paint('#e8f0ff',.22);g.lineWidth=.14*m;g.setLineDash([2*m,1.5*m]);for(const x of [-8.6,8.6]){g.beginPath();g.moveTo(W(x),Z(-15));g.lineTo(W(x),Z(15));g.stroke();}g.setLineDash([]);
  // hazard at stair feet
  for(const [x,z] of [[-16,3],[16,3],[-16,-3],[16,-3]]){g.save();g.globalAlpha=.55;g.beginPath();g.rect(W(x-1),Z(z-.5),2*m,1*m);g.clip();for(let i=-4;i<10;i++){g.fillStyle=i%2?'#d89a2a':'#111';g.beginPath();const x0=W(x-1)+i*.4*m;g.moveTo(x0,Z(z-.5));g.lineTo(x0+.4*m,Z(z-.5));g.lineTo(x0-.6*m,Z(z+.5));g.lineTo(x0-1*m,Z(z+.5));g.fill();}g.restore();}
  // painted text
  g.globalAlpha=.3;g.fillStyle='#ff2fb4';g.font=`900 ${2.3*m}px "Noto Sans TC",sans-serif`;g.textAlign='center';g.textBaseline='middle';
  g.save();g.translate(W(0),Z(11.5));g.fillText('零號中繼站',0,0);g.restore();g.save();g.translate(W(0),Z(-11.5));g.rotate(Math.PI);g.fillText('零號中繼站',0,0);g.restore();
  g.globalAlpha=.25;g.fillStyle='#ffffff';g.font=`700 ${1.4*m}px "Chakra Petch",sans-serif`;g.fillText('R-07',W(-14),Z(-6));g.fillText('R-07',W(14),Z(6));
  g.globalAlpha=1;
  // wear on paint
  const r=rng(45);for(let i=0;i<9000;i++){g.fillStyle=`rgba(90,95,104,${.4+r()*.5})`;g.fillRect(r()*S2,r()*S2,2+r()*7,2+r()*5);}
  // puddles
  const [rc,rg]=mk(1024,1024);rg.fillStyle='#d2d2d2';rg.fillRect(0,0,1024,1024);grain(rg,1024,1024,40,46);blotch(rg,1024,1024,32,.4,47,'multiply');
  const pr=rng(48);const k2=1024/S2;
  for(let i=0;i<64;i++){const x=(pr()-.5)*46,z=(pr()-.5)*46,rx=(.6+pr()*2.6)*m,rz=rx*(.4+pr()*.7),rot=pr()*3;
    for(const [ctx,s,col] of [[g,1,'rgba(20,24,30,.3)'],[rg,k2,'#0c0c0c']]){ctx.save();ctx.translate(W(x)*s,Z(z)*s);ctx.rotate(rot);ctx.scale(1,rz/rx);
      const gr=ctx.createRadialGradient(0,0,0,0,0,rx*s);gr.addColorStop(0,col);gr.addColorStop(.7,col);gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,rx*s,0,7);ctx.fill();ctx.restore();}}
  const ft=tex(c);const rt=tex(rc,{srgb:false});return [ft,rt];
}
function glowSprite(col,soft){const [c,g]=mk(128,128);const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(soft?.25:.12,col);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);return tex(c);}
function starSprite(){const [c,g]=mk(128,128);g.translate(64,64);for(let i=0;i<6;i++){g.rotate(Math.PI/3);const gr=g.createLinearGradient(0,0,60,0);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.beginPath();g.moveTo(0,-6);g.lineTo(62,0);g.lineTo(0,6);g.fill();}
  const gr=g.createRadialGradient(0,0,0,0,0,30);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(-64,-64,128,128);return tex(c);}

/* ============ World ============ */
let colliders=[];
const lights=[];
const animated=[];   // {update(t,dt)}
let M={};let sun=null;
const neonCache={};
function neon(hex,k=2.6){const key=hex+'_'+k;if(!neonCache[key])neonCache[key]=new THREE.MeshBasicMaterial({color:new THREE.Color(hex).multiplyScalar(k),toneMapped:false});return neonCache[key];}
function worldUV(geo,w,h,d,s){const uv=geo.attributes.uv,dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];for(let f=0;f<6;f++)for(let i=0;i<4;i++){const k=f*4+i;uv.setXY(k,uv.getX(k)*dims[f][0]/s,uv.getY(k)*dims[f][1]/s);}}
function box(x0,x1,y0,y1,z0,z1,mat,o={}){const w=x1-x0,h=y1-y0,d=z1-z0;const geo=new THREE.BoxGeometry(w,h,d);if(o.uv!==false)worldUV(geo,w,h,d,o.uvs||4);
  const m=new THREE.Mesh(geo,mat);m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);if(o.shadow){m.castShadow=m.receiveShadow=true;}(o.parent||scene).add(m);
  return m;}
function tube(a,b,r,mat,seg=8){const len=a.distanceTo(b);const geo=new THREE.CylinderGeometry(r,r,len,seg,1);geo.rotateX(Math.PI/2);const m=new THREE.Mesh(geo,mat);m.position.copy(a).add(b).multiplyScalar(.5);m.lookAt(b);scene.add(m);return m;}
function nline(x0,y0,z0,x1,y1,z1,hex,r=.035,k){return tube(new V3(x0,y0,z0),new V3(x1,y1,z1),r,neon(hex,k));}
function plane(w,h,mat,x,y,z,ry=0,rx=0){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);m.position.set(x,y,z);m.rotation.set(rx,ry,0,'YXZ');scene.add(m);return m;}
function signMat(t,k=1.5){return new THREE.MeshBasicMaterial({map:t,color:new THREE.Color(k,k,k),toneMapped:false,transparent:true});}
const CYAN=0x2ef2ff,MAG=0xff2fb4,AMB=0xffb43a;
function addLight(hex,int,dist,x,y,z,core){const l=new THREE.PointLight(hex,int*.7,dist*1.2,2);l.position.set(x,y,z);l.userData.core=!!core;
  l.userData.col=hex;l.userData.uCol=hex===AMB?AMB:hex===MAG?0xff3020:0xff7a30;scene.add(l);lights.push(l);return l;}

let MDL={};  // public/models/*.glb, filled in boot(); a missing file stays null and the procedural model is used
/** arena*.glb leave flat Sign_1… planes on the side buildings; the game paints the neon text (glTF UVs → flipY off). */
const ARENA_SIGNS={
  city:{Sign_1:['鷺光電機','HERON ELECTRIC','#2ef2ff'],Sign_2:['霓虹保險','NEON SURETY','#ff2fb4'],Sign_3:['網咖','NET CAFE 24H','#ffb43a'],Sign_4:['雨巷拉麵','RAIN ALLEY RAMEN','#ff2fb4']},
  underground:{Sign_1:['高壓危險','HIGH VOLTAGE','#ff5a1a'],Sign_2:['反應爐 07','REACTOR 07','#ffb43a'],Sign_3:['冷卻迴路','COOLANT LOOP','#ff2a2a'],Sign_4:['電網核心','GRID CORE','#ffb43a']}};
function arenaSigns(root,table){for(const [name,[t,sub,col]] of Object.entries(table)){const o=root.getObjectByName(name);if(!o||!o.isMesh)continue;
  const tx=signTex(t,sub,col,768,274,140);tx.flipY=false;tx.needsUpdate=true;o.material=signMat(tx,1.3);o.castShadow=false;}}

/* Two looks over the same colliders: 'city' (arena.glb, or the procedural map) and 'underground' (arena_underground.glb).
 * The server picks one per match (net.m.arena), so everyone sees the same arena; a missing model falls back to city. */
const ARENA_THEMES={city:{map:null,extras:[]},underground:{map:null,extras:[]}};
let hemi=null;
/** Move everything added to the scene since index n0 into one group, so a theme can show/hide it. */
function collectSince(n0){const g=new THREE.Group();for(const o of scene.children.slice(n0)){scene.remove(o);g.add(o);}scene.add(g);return g;}
function arenaAvailable(name){return !!(ARENA_THEMES[name]&&ARENA_THEMES[name].map);}
function applyArena(name){if(!arenaAvailable(name))name='city';
  for(const [k,t] of Object.entries(ARENA_THEMES)){const on=k===name;if(t.map)t.map.visible=on;t.extras.forEach(g=>g.visible=on);}
  const U=name==='underground';if(rain)rain.visible=!U;
  scene.fog.color.set(U?0x140a06:0xc9d9ea);scene.fog.density=U?.012:.0075;
  if(hemi){hemi.color.set(U?0xffb27a:0xd6e8ff);hemi.groundColor.set(U?0x2a120a:0x6e6655);hemi.intensity=U?.6:1.25;}
  if(sun){sun.color.set(U?0xff9a5a:0xfff1dc);sun.intensity=U?1:2.4;}
  for(const l of lights)l.color.set(U?l.userData.uCol:l.userData.col);
  showZoneShape(name);}
let arenaShown='';const arenaColliders={};
/** Follow the server's arena: swap the look and the solid boxes used for prediction (they differ between arenas). */
function syncArena(){const a=(net.m&&net.m.arena)||'city';if(a===arenaShown)return;arenaShown=a;
  colliders=arenaColliders[a]||(arenaColliders[a]=SH.buildColliders(SH.buildMap(a)));applyArena(a);}

function buildEnvironment(){
  // reflection environment: stylised neon room for the PMREM
  const env=new THREE.Scene();
  const sky=new THREE.Mesh(new THREE.SphereGeometry(50,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,uniforms:{},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 p;void main(){float h=normalize(p).y;vec3 c=mix(vec3(.75,.82,.9),vec3(.25,.48,.85),smoothstep(-.05,.6,h));c=mix(vec3(.32,.3,.28),c,smoothstep(-.25,0.,h));gl_FragColor=vec4(c,1.);}'}));
  env.add(sky);
  const add=(hex,k,w,h,d,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color:new THREE.Color(hex).multiplyScalar(k)}));m.position.set(x,y,z);env.add(m);};
  add(0xfff4e0,6,8,8,8,-25,35,15);add(CYAN,1,20,.4,.4,0,10,-30);add(MAG,1,.4,.4,20,30,8,0);
  const pm=new THREE.PMREMGenerator(renderer);const rt=pm.fromScene(env,.03);pm.dispose();return rt.texture;
}

function buildWorld(){
  // image-based reflections removed: some GPUs produced black surfaces from the PMREM pass
  const [ft,frt]=floorTextures();
  M.floor=new THREE.MeshStandardMaterial({map:ft,roughnessMap:frt,roughness:1,metalness:.08});
  M.conc=new THREE.MeshStandardMaterial({map:concreteTex(3,'#9aa0a8'),color:0xffffff,roughness:.92,metalness:.05});
  M.concD=new THREE.MeshStandardMaterial({map:concreteTex(7,'#858b95'),color:0xffffff,roughness:.95,metalness:.04});
  M.metal=new THREE.MeshStandardMaterial({map:panelTex(11),color:0xffffff,roughness:.5,metalness:.35});
  M.grate=new THREE.MeshStandardMaterial({map:grateTex(),color:0xffffff,roughness:.6,metalness:.35});
  M.crate=new THREE.MeshStandardMaterial({map:crateTex(),roughness:.62,metalness:.25});
  M.dark=new THREE.MeshStandardMaterial({color:0x2a3240,roughness:.5,metalness:.35});
  M.tower=new THREE.MeshStandardMaterial({color:0x2b3646,roughness:.35,metalness:.45,emissive:CYAN,emissiveMap:circuitTex(),emissiveIntensity:1.25});
  M.bldg=new THREE.MeshStandardMaterial({map:concreteTex(17,'#8d929b'),color:0xffffff,roughness:.9,metalness:.1,emissive:0xffffff,emissiveMap:windowsTex(5,6,12),emissiveIntensity:.18});

  // every solid box comes from the shared map, so client and server collide identically;
  // public/models/arena.glb (when present) only replaces how the map looks
  const MAP=SH.buildMap();colliders=SH.buildColliders(MAP);
  const arena=MDL.arena&&MDL.arena.scene,under=MDL.arena_underground&&MDL.arena_underground.scene;
  if(arena){scene.add(prepare(arena));arenaSigns(arena,ARENA_SIGNS.city);ARENA_THEMES.city.map=arena;}
  if(under){scene.add(prepare(under));arenaSigns(under,ARENA_SIGNS.underground);ARENA_THEMES.underground.map=under;
    const ceil=under.getObjectByName('Ceiling_Decor');if(ceil)ceil.traverse(o=>{o.castShadow=false;});}  // the ceiling would shade the whole map from the sun
  if(!under){const n0=scene.children.length;  // no model: plain boxes of the underground layout, so what you see is what you hit
    for(const m of SH.buildMap('underground'))box(m[0],m[1],m[2],m[3],m[4],m[5],M[m[6]],{uvs:m[7],shadow:true});ARENA_THEMES.underground.map=collectSince(n0);}
  const nProc=scene.children.length;
  if(!arena){
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(50,50),M.floor);fl.rotation.x=-Math.PI/2;fl.receiveShadow=true;scene.add(fl);
  for(const m of MAP)box(m[0],m[1],m[2],m[3],m[4],m[5],M[m[6]],{uvs:m[7],shadow:true});
  for(const s of [-1,1]){nline(-24.4,8.9,s*24.4,24.4,8.9,s*24.4,s>0?MAG:CYAN,.05);}
  nline(-24.4,8.9,-24.4,-24.4,8.9,24.4,AMB,.05);nline(24.4,8.9,-24.4,24.4,8.9,24.4,AMB,.05);

  // central relay tower
  for(const x of [-3.02,3.02])for(const z of [-3.02,3.02])nline(x,0,z,x,3.3,z,CYAN,.045);
  for(const s of [-1,1]){nline(-3.16,3.4,s*3.16,3.16,3.4,s*3.16,MAG,.03);nline(s*3.16,3.4,-3.16,s*3.16,3.4,3.16,MAG,.03);}
  // relay sign faces
  const rs=signMat(signTex('零號中繼站','ZERO RELAY',  '#2ef2ff',512,192,110),1.25);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;plane(4,1.5,rs,Math.sin(a)*3.03,1.9,Math.cos(a)*3.03,a);}

  // bridges
  for(const s of [-1,1])for(const z of [[3.15,16],[-16,-3.15]])nline(s*1.27,3.22,z[0],s*1.27,3.22,z[1],CYAN,.03);
  // platforms
  nline(-17,3.12,16.02,17,3.12,16.02,CYAN,.04);nline(-17,3.12,-16.02,17,3.12,-16.02,CYAN,.04);
  for(const [a,b] of [[-14.5,-9],[-5,-1.25],[1.25,5],[9,14.5]])for(const s of [1,-1]){
    nline(a,4.52,s*16.06,b,4.52,s*16.06,s>0?MAG:CYAN,.025);}
  // stairs
  for(const sx of [-1,1])for(const sz of [-1,1]){const xo=sx*17.02;nline(xo,.3,sz*4,xo,3.8,sz*16,AMB,.03);}

  // dividers between alleys and centre
  for(const s of [-1,1]){
    nline(s*10,4.03,-12,s*10,4.03,-4,MAG,.04);nline(s*10,4.03,4,s*10,4.03,12,MAG,.04);}
  // side buildings
  box(-19.8,-19,3.2,3.35,-7,7,M.metal,{collide:false,uvs:2});box(19,19.8,3.2,3.35,-7,7,M.metal,{collide:false,uvs:2});
  nline(-19.8,3.18,-7,-19.8,3.18,7,MAG,.035);nline(19.8,3.18,-7,19.8,3.18,7,CYAN,.035);
  plane(1.4,5.6,signMat(vSignTex('雨巷拉麵','#ff2fb4'),1.4),-18.95,6.6,-5,Math.PI/2);
  plane(1.4,5.6,signMat(vSignTex('鷺光電機','#2ef2ff'),1.4),18.95,6.6,5,-Math.PI/2);
  plane(6,2.6,signMat(signTex('網咖','NET CAFE 24H','#ffb43a'),1.3),-18.95,6.9,3.2,Math.PI/2);
  plane(6,2.6,signMat(signTex('霓虹保險','NEON SURETY','#ff2fb4'),1.3),18.95,6.9,-3.2,-Math.PI/2);
  plane(5,2.2,signMat(signTex('雨夜','OPEN ALL NIGHT','#2ef2ff',512,220,120),1.2),-18.95,1.8,-1.5,Math.PI/2);

  // cover
  // dumpster lids glow
  nline(-14.5,1.32,-1,-12.5,1.32,-1,AMB,.02);nline(12.5,1.32,1,14.5,1.32,1,AMB,.02);
  ARENA_THEMES.city.map=collectSince(nProc);
  }

  // under-platform props
  let nCity=scene.children.length;
  const vt=[vendingTex(61,'#ff2fb4'),vendingTex(62,'#2ef2ff'),vendingTex(63,'#ffb43a')];
  let vi=0;for(const s of [1,-1])for(const x of [-11,-3.5,4,11.5]){plane(1,1.95,signMat(vt[vi++%3],1.1),x+.55,1.05,s>0?23.68:-23.68,s>0?Math.PI:0);}
  ARENA_THEMES.city.extras.push(collectSince(nCity));
  for(const s of [1,-1]){if(!arena){for(const yy of [2.75,2.95]){tube(new V3(-17,yy,s*(23.9-(yy-2.7)*3)),new V3(17,yy,s*(23.9-(yy-2.7)*3)),.09,M.metal);}
    nline(-16,3.05,s*20,16,3.05,s*20,s>0?MAG:CYAN,.03,1.8);}
    plane(5,1.8,signMat(signTex(s>0?'維修平台':'貨物通道',s>0?'DECK A':'DECK B',s>0?'#ff2fb4':'#2ef2ff',512,184,100),1.2),0,1.9,s>0?24.42:-24.42,s>0?Math.PI:0);}
  // big billboards on perimeter walls (city only)
  nCity=scene.children.length;
  plane(9,3.4,signMat(signTex('ODEN NET','訊號永不斷線','#2ef2ff',768,290,150),1.25),-24.4,6.6,15,Math.PI/2);
  plane(9,3.4,signMat(signTex('合成可樂','SYNTH COLA','#ff2fb4',768,290,150),1.25),24.4,6.6,-15,-Math.PI/2);
  plane(7,2.6,signMat(signTex('GRID-07','競技區','#ffb43a',640,240,140),1.2),12,6.4,-24.4,0);
  plane(7,2.6,signMat(signTex('資料即權力','DATA IS POWER','#2ef2ff',640,240,110),1.2),-12,6.4,24.4,Math.PI);
  ARENA_THEMES.city.extras.push(collectSince(nCity));
  // vents with steam

  // hanging cables
  const cab=new THREE.MeshStandardMaterial({color:0x07090d,roughness:.6,metalness:.3});
  const cables=[[-19,10,-6,-10,4.3,-11],[-19,10.5,6,-10,4.2,9],[19,10,-7,10,4.3,-10],[19,10.6,7,10,4.2,8],[-24.5,8.5,-18,-17,4.2,-16.5],[24.5,8.6,18,17,4.2,16.5],[-24.5,8.8,20,24.5,8.8,20],[-24.5,8.4,-21,24.5,8.6,-21]];
  for(const c of cables){const a=new V3(c[0],c[1],c[2]),b=new V3(c[3],c[4],c[5]);const mid=a.clone().add(b).multiplyScalar(.5);mid.y-=a.distanceTo(b)*.08;
    const curve=new THREE.QuadraticBezierCurve3(a,mid,b);const m=new THREE.Mesh(new THREE.TubeGeometry(curve,24,.035,5,false),cab);scene.add(m);}

  // landmark: data core + beam above tower
  const core=new THREE.Group();core.position.set(0,7.6,0);scene.add(core);
  const oct=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(1.5)),new THREE.LineBasicMaterial({color:new THREE.Color(MAG).multiplyScalar(2.4),toneMapped:false}));core.add(oct);
  const ico=new THREE.Mesh(new THREE.IcosahedronGeometry(.62,0),new THREE.MeshStandardMaterial({color:0x0b1830,emissive:CYAN,emissiveIntensity:2.2,metalness:.6,roughness:.2,flatShading:true}));core.add(ico);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.3,.025,6,64),neon(CYAN,2.2));ring.rotation.x=Math.PI/2;core.add(ring);
  animated.push({update:(t)=>{oct.rotation.y=t*.35;oct.rotation.x=Math.sin(t*.2)*.3;ico.rotation.y=-t*.6;ico.rotation.z=t*.25;ring.rotation.z=t*.15;core.position.y=7.6+Math.sin(t*.8)*.18;}});
  const beamMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uT:{value:0}},
    vertexShader:'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform float uT;varying vec2 vU;void main(){float a=(1.-vU.y)*.32;a*=.7+.3*sin(vU.y*40.-uT*3.);float e=1.-abs(vU.x-.5)*2.;gl_FragColor=vec4(vec3(.2,.95,1.)*a*(.4+.6*e),1.);}'});
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.5,.9,60,24,1,true),beamMat);beam.position.set(0,33.5,0);scene.add(beam);
  animated.push({update:(t)=>{beamMat.uniforms.uT.value=t;}});

  // lights
  addLight(CYAN,2.6,16,0,5.4,0,true);
  addLight(MAG,2.2,15,0,2.6,20,true);addLight(CYAN,2.2,15,0,2.6,-20,true);
  addLight(MAG,2,14,-17.5,5,-3,true);addLight(CYAN,2,14,17.5,5,3,true);
  addLight(AMB,1.6,13,-21,4,-19);addLight(CYAN,1.6,13,21,4,19);
  hemi=new THREE.HemisphereLight(0xd6e8ff,0x6e6655,1.25);scene.add(hemi);
  sun=new THREE.DirectionalLight(0xfff1dc,2.4);sun.position.set(-26,32,16);sun.castShadow=true;
  const sc=sun.shadow.camera;sc.left=-34;sc.right=34;sc.top=34;sc.bottom=-34;sc.near=1;sc.far=110;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0004;sun.shadow.normalBias=.03;
  scene.add(sun);scene.add(sun.target);

  nCity=scene.children.length;buildSkyline();ARENA_THEMES.city.extras.push(collectSince(nCity));
  applyArena('city');
}

function buildSkyline(){
  const sky=new THREE.Mesh(new THREE.SphereGeometry(320,48,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{},
    vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 p;void main(){vec3 d=normalize(p);float h=d.y;vec3 c=mix(vec3(.80,.87,.94),vec3(.22,.47,.86),smoothstep(0.,.55,h));vec3 sd=normalize(vec3(-.55,.62,.35));float s=max(dot(d,sd),0.);c+=vec3(1.,.93,.8)*(pow(s,600.)*4.+pow(s,12.)*.25);gl_FragColor=vec4(c,1.);}'}));
  scene.add(sky);
  const r=rng(77);const wt=[windowsTex(81,5,16),windowsTex(82,7,20),windowsTex(83,4,12)];
  const mats=wt.map((t,i)=>new THREE.MeshStandardMaterial({color:[0x8a97a8,0x9aa3ad,0x7c8ea6][i],roughness:.55,metalness:.5,emissive:0xffffff,emissiveMap:t,emissiveIntensity:.12}));
  const signs=[['夜城','#ff2fb4'],['電','#2ef2ff'],['NG','#ffb43a'],['零','#2ef2ff'],['雨','#ff2fb4']];
  for(let i=0;i<46;i++){const a=r()*Math.PI*2,d=36+r()*70,w=6+r()*12,dd=6+r()*12,h=16+r()*(d>70?80:50);
    const x=Math.cos(a)*d,z=Math.sin(a)*d;const m=box(x-w/2,x+w/2,0,h,z-dd/2,z+dd/2,mats[i%3],{collide:false,uvs:8});
    if(r()<.35){const sg=signs[i%signs.length];const sm=signMat(vSignTex(sg[0],sg[1]),1.6);const p=plane(2.2,2.2*4*Math.min(1,sg[0].length/2+.3),sm,x,h*.6,z,0);p.lookAt(0,h*.6,0);p.position.add(new V3(-x,0,-z).normalize().multiplyScalar(Math.max(w,dd)/2+.2));}
    if(r()<.5){const t=new THREE.Mesh(new THREE.BoxGeometry(w*.9,.15,.15),neon(r()<.5?CYAN:MAG,2));t.position.set(x,h+.1,z);t.lookAt(0,h,0);scene.add(t);}}
  // flying traffic
  const lightMat=[neon(0xffffff,3),neon(0xff3355,3),neon(AMB,3)];
  for(let i=0;i<14;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.6,.25,1.4),lightMat[i%3]);scene.add(m);const rad=55+r()*60,h=24+r()*30,sp=(r()<.5?-1:1)*(.04+r()*.05),ph=r()*7;
    animated.push({update:(t)=>{const a=ph+t*sp;m.position.set(Math.cos(a)*rad,h+Math.sin(t*.3+ph)*2,Math.sin(a)*rad);m.rotation.y=-a+(sp>0?0:Math.PI);}});}
}

/* ============ Rain & steam ============ */
let rain;
function buildRain(){const N=9000;const g=new THREE.BufferGeometry();const off=new Float32Array(N*2*3),end=new Float32Array(N*2),pos=new Float32Array(N*2*3);const r=rng(99);
  for(let i=0;i<N;i++){const a=r(),b=r(),c=r();for(let k=0;k<2;k++){off.set([a,b,c],(i*2+k)*3);end[i*2+k]=k;}}
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('aOff',new THREE.BufferAttribute(off,3));g.setAttribute('aEnd',new THREE.BufferAttribute(end,1));
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uT:{value:0},uC:{value:new V3()}},
    vertexShader:`attribute vec3 aOff;attribute float aEnd;uniform float uT;uniform vec3 uC;varying float vA;varying vec3 vW;
      void main(){float A=56.;vec3 p;p.x=uC.x+mod(aOff.x*A-uC.x,A)-A*.5;p.z=uC.z+mod(aOff.z*A-uC.z,A)-A*.5;
      p.y=mod(aOff.y*34.-uT*(20.+aOff.x*6.),34.)-2.;p.y+=aEnd*.75;p.x+=aEnd*.06;vW=p;
      vec4 mv=modelViewMatrix*vec4(p,1.);float d=-mv.z;vA=(1.-aEnd*.85)*smoothstep(46.,8.,d)*smoothstep(.4,2.,d);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying float vA;varying vec3 vW;void main(){
      if(vW.y<3.15&&abs(vW.x)<17.&&abs(vW.z)>16.)discard; if(vW.y<0.)discard;
      gl_FragColor=vec4(vec3(.5,.66,.86)*vA*.26,1.);}`});
  rain=new THREE.LineSegments(g,mat);rain.frustumCulled=false;scene.add(rain);}
function buildSteam(){const tx=glowSprite('rgba(170,190,220,.35)',true);const N=90;const g=new THREE.BufferGeometry();const p=new Float32Array(N*3);g.setAttribute('position',new THREE.BufferAttribute(p,3));
  const m=new THREE.PointsMaterial({map:tx,size:1.6,transparent:true,opacity:.16,depthWrite:false,color:0x9fb4d6});const pts=new THREE.Points(g,m);pts.frustumCulled=false;scene.add(pts);
  const src=[[-21.5,15.2],[21.5,-15.2],[-12,-14]];const st=[];for(let i=0;i<N;i++)st.push({s:i%3,ph:i/N*3});
  animated.push({update:(t)=>{for(let i=0;i<N;i++){const o=st[i],s=src[o.s];const life=(t*.35+o.ph)%1;p[i*3]=s[0]+Math.sin(i*1.7+t*.6)*life*.9;p[i*3+1]=.6+life*4.5;p[i*3+2]=s[1]+Math.cos(i*2.3+t*.5)*life*.9;}g.attributes.position.needsUpdate=true;}});}

/* ============ Game constants (weapons.json equivalent) ============ */
const WEAPONS=SH.WEAPONS,PATTERN=SH.PATTERN,P=SH.P;
const DIFF={easy:{react:.75,err:.085,turn:3.6,fireAng:.09,track:1.8},normal:{react:.45,err:.05,turn:5.2,fireAng:.06,track:1.2},hard:{react:.25,err:.026,turn:8,fireAng:.04,track:.8}};
const BOT_NAMES=['霓影','K-ROW','雨刃','VEX-9','幽頻','NULLA','赤弦'];
const BOT_COLORS=[0xff3fb8,0xffb43a,0x8cff5a,0xa77bff,0xff6a3d,0x9fd8ff,0xff4a5a];

const SPAWNS=SH.SPAWNS.map(a=>({p:new V3(a[0],a[1],a[2]),uses:0,last:-99}));

/* ============ Collision (shared rules) ============ */
function physics(a,wx,wz,jump,dt){SH.physics(a,colliders,wx,wz,jump,dt);}
function blockedAt(x,y,z,r,h){return SH.blockedAt(colliders,x,y,z,r,h);}
function supported(x,y,z){return SH.supported(colliders,x,y,z);}
function rayWorld(o,d,tmax,n){return SH.rayWorld(colliders,o,d,tmax,n);}
const rayBox=SH.rayBox;
function los(a,b){return SH.los(colliders,a,b);}
const _d=new V3();
/* ============ Agents ============ */
const agents=[];
let local=null;
function makeAgent(name,color,bot){
  const a={name,color,bot,pos:new V3(),vel:new V3(),yaw:0,pitch:0,onGround:false,airT:0,shield:P.shield,alive:false,respawnT:0,protect:0,score:0,deaths:0,
    wi:0,ws:WEAPONS.map(w=>({ammo:w.mag,reload:0})),cd:0,switchT:0,stepT:0,mesh:null,hitT:0,walk:0,lastAttacker:null,flashT:0,
    id:0,ack:0,landed:false,bumped:false,rtt:0,remote:false,buf:[],
    ai:{target:null,seeT:0,think:0,errX:0,errY:0,strafe:1,strafeT:0,path:[],goal:-1,stuckT:0,lastPos:new V3(),jumpT:0,hurtBy:null,hurtT:0,lookYaw:0}};
  if(bot||!local){}
  return a;}
function eyePos(a,out){return out.set(a.pos.x,a.pos.y+P.eye,a.pos.z);}
function aimDir(yaw,pitch,out){const cp=Math.cos(pitch);return out.set(-Math.sin(yaw)*cp,Math.sin(pitch),-Math.cos(yaw)*cp);}

/* --- character model --- */
const shieldMatProto=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{uColor:{value:new THREE.Color()},uA:{value:0},uT:{value:0},uHex:{value:0}},
  vertexShader:'varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){vP=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
  fragmentShader:'uniform vec3 uColor;uniform float uA,uT,uHex;varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){float f=pow(1.-abs(dot(vN,vV)),2.2);float ln=smoothstep(.86,1.,abs(sin(vP.y*16.-uT*3.)));float a=(f*1.4+ln*.35*uHex)*uA;gl_FragColor=vec4(uColor*a,1.);}'});
function nameTag(name,color){const [c,g]=mk(256,64);g.font='700 30px "Noto Sans TC","Chakra Petch",sans-serif';g.textAlign='center';g.textBaseline='middle';
  g.fillStyle='rgba(4,8,18,.6)';const w=Math.min(250,g.measureText(name).width+30);g.fillRect(128-w/2,10,w,44);g.fillStyle='#'+new THREE.Color(color).getHexString();g.fillRect(128-w/2,52,w,2);
  g.fillStyle='#fff';g.fillText(name,128,32);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex(c),transparent:true,depthWrite:false,fog:false}));s.scale.set(1.5,.375,1);return s;}
function agentExtras(a,g){
  const sh=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),shieldMatProto.clone());sh.material.uniforms.uColor.value=new THREE.Color(a.color);sh.scale.set(.62,1.08,.62);sh.position.y=.95;g.add(sh);
  const tag=nameTag(a.name,a.color);tag.position.y=2.3;g.add(tag);return {shield:sh,tag};}
/** agent.glb：每位玩家一份骨架，Idle/Run/Jump 依移動狀態切換，Fire 由射擊事件觸發，再加上瞄準俯仰。 */
function buildAgentModel(a){
  const g=new THREE.Group();const anim=makeAgentModel(MDL.agent,a.color);g.add(anim.model);
  g.userData=Object.assign({anim},agentExtras(a,g));scene.add(g);a.mesh=g;}
function buildAgentMesh(a){
  if(MDL.agent){buildAgentModel(a);return;}
  const g=new THREE.Group();
  const armor=new THREE.MeshStandardMaterial({color:0x2a3242,metalness:.35,roughness:.45});
  const plate=new THREE.MeshStandardMaterial({color:new THREE.Color(a.color).multiplyScalar(.85),metalness:.35,roughness:.38,emissive:a.color,emissiveIntensity:.18});
  const glow=neon(a.color,2.4);
  const add=(w,h,d,x,y,z,m,parent)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);(parent||g).add(o);return o;};
  const legs=[];for(const s of [-1,1]){const hip=new THREE.Group();hip.position.set(s*.13,.92,0);g.add(hip);
    add(.17,.5,.2,0,-.25,0,armor,hip);add(.15,.46,.17,0,-.68,.02,plate,hip);add(.19,.1,.3,0,-.88,-.04,armor,hip);add(.03,.3,.02,s*.09,-.6,-.09,glow,hip);legs.push(hip);}
  const torso=new THREE.Group();torso.position.y=.95;g.add(torso);
  add(.5,.24,.3,0,.12,0,armor,torso);add(.58,.36,.34,0,.42,0,plate,torso);add(.42,.04,.02,0,.46,-.18,glow,torso);add(.34,.4,.16,0,.4,.24,armor,torso);add(.05,.32,.02,0,.42,.33,glow,torso);
  for(const s of [-1,1]){add(.2,.14,.3,s*.36,.58,0,armor,torso);add(.12,.38,.13,s*.36,.3,-.08,plate,torso);}
  const head=new THREE.Group();head.position.y=.72;torso.add(head);
  add(.28,.28,.3,0,.14,0,armor,head);add(.24,.07,.02,0,.16,-.16,glow,head);add(.04,.12,.18,.16,.2,.04,plate,head);
  const gun=new THREE.Group();gun.position.set(.18,.32,-.3);torso.add(gun);add(.09,.11,.62,0,0,-.05,armor,gun);add(.03,.03,.5,0,.065,-.05,glow,gun);
  add(.12,.12,.12,-.2,0,-.25,plate,gun);
  const sh=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),shieldMatProto.clone());sh.material.uniforms.uColor.value=new THREE.Color(a.color);sh.scale.set(.62,1.08,.62);sh.position.y=.95;g.add(sh);
  const tag=nameTag(a.name,a.color);tag.position.y=2.3;g.add(tag);
  g.userData={legs,torso,head,shield:sh,tag,gun};
  g.traverse(o=>{if(o.isMesh&&o!==sh)o.castShadow=true;});scene.add(g);a.mesh=g;
}

/* ============ Effects ============ */
const FX={};
function buildFX(){
  // tracers
  const bg=new THREE.CylinderGeometry(1,1,1,6,1,true);bg.rotateX(Math.PI/2);bg.translate(0,0,.5);
  FX.beams=[];for(let i=0;i<48;i++){const m=new THREE.Mesh(bg,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));m.visible=false;m.frustumCulled=false;scene.add(m);FX.beams.push({m,t:0,life:.1});}
  FX.arcs=[];for(let i=0;i<30;i++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12*3),3));
    const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));l.visible=false;l.frustumCulled=false;scene.add(l);FX.arcs.push({l,t:0,life:.14});}
  // sparks
  const N=700;FX.sp={n:N,p:new Float32Array(N*3),c:new Float32Array(N*3),v:new Float32Array(N*3),life:new Float32Array(N),max:new Float32Array(N),col:new Float32Array(N*3),i:0};
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(FX.sp.p,3));sg.setAttribute('color',new THREE.BufferAttribute(FX.sp.c,3));
  FX.sparks=new THREE.Points(sg,new THREE.PointsMaterial({size:.09,map:glowSprite('rgba(255,255,255,.9)'),vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));FX.sparks.frustumCulled=false;scene.add(FX.sparks);
  // shards
  const SN=600;FX.sh={n:SN,pos:new Float32Array(SN*3),vel:new Float32Array(SN*3),rot:new Float32Array(SN*3),life:new Float32Array(SN),max:new Float32Array(SN),i:0};
  FX.shards=new THREE.InstancedMesh(new THREE.BoxGeometry(.09,.09,.09),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),SN);
  const col=new THREE.Color();for(let i=0;i<SN;i++){FX.shards.setMatrixAt(i,new THREE.Matrix4().makeScale(0,0,0));FX.shards.setColorAt(i,col.set(0xffffff));}
  FX.shards.frustumCulled=false;scene.add(FX.shards);
  // flashes
  const st=starSprite();FX.flashes=[];for(let i=0;i<16;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:st,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,toneMapped:false}));s.visible=false;scene.add(s);FX.flashes.push({s,t:0});}
  // scorch decals
  const dt=glowSprite('rgba(255,140,60,.8)');FX.decals=[];for(let i=0;i<60;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(.28,.28),new THREE.MeshBasicMaterial({map:dt,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2}));m.visible=false;scene.add(m);FX.decals.push({m,t:0});}
  FX.di=0;FX.bi=0;FX.ai=0;FX.fi=0;
  FX.muzzleLight=new THREE.PointLight(CYAN,0,7,2);scene.add(FX.muzzleLight);
}
const _c=new THREE.Color();
function spark(p,n,hex,speed=5,life=.45){const S=FX.sp;_c.set(hex);for(let k=0;k<n;k++){const i=S.i=(S.i+1)%S.n;S.p[i*3]=p.x;S.p[i*3+1]=p.y;S.p[i*3+2]=p.z;
  const u=Math.random()*2-1,th=Math.random()*6.283,s=Math.sqrt(1-u*u),sp=speed*(.3+Math.random()*.7);S.v[i*3]=s*Math.cos(th)*sp;S.v[i*3+1]=u*sp+1.5;S.v[i*3+2]=s*Math.sin(th)*sp;
  S.life[i]=S.max[i]=life*(.5+Math.random()*.5);S.col[i*3]=_c.r*2;S.col[i*3+1]=_c.g*2;S.col[i*3+2]=_c.b*2;}}
function shardBurst(p,hex){const S=FX.sh;_c.set(hex);for(let k=0;k<70;k++){const i=S.i=(S.i+1)%S.n;S.pos[i*3]=p.x+(Math.random()-.5)*.6;S.pos[i*3+1]=p.y+Math.random()*1.8;S.pos[i*3+2]=p.z+(Math.random()-.5)*.6;
  S.vel[i*3]=(Math.random()-.5)*4;S.vel[i*3+1]=Math.random()*3.5+.5;S.vel[i*3+2]=(Math.random()-.5)*4;S.rot[i*3]=Math.random()*6;S.rot[i*3+1]=Math.random()*6;S.rot[i*3+2]=Math.random()*6;
  S.life[i]=S.max[i]=1.1+Math.random()*.9;const m=Math.random()<.25?3:1.8;FX.shards.setColorAt(i,new THREE.Color(_c.r*m,_c.g*m,_c.b*m));}FX.shards.instanceColor.needsUpdate=true;}
function beam(a,b,hex,r,life=.09){const B=FX.beams[FX.bi=(FX.bi+1)%FX.beams.length];B.m.position.copy(a);B.m.lookAt(b);B.m.scale.set(r,r,a.distanceTo(b));B.m.material.color.set(hex).multiplyScalar(2.2);B.m.visible=true;B.t=B.life=life;}
function arcBolt(a,b,hex){const A=FX.arcs[FX.ai=(FX.ai+1)%FX.arcs.length];const arr=A.l.geometry.attributes.position.array;const n=12;
  for(let i=0;i<n;i++){const t=i/(n-1);const j=(i===0||i===n-1)?0:.22*Math.sin(t*Math.PI);arr[i*3]=lerp(a.x,b.x,t)+(Math.random()-.5)*j;arr[i*3+1]=lerp(a.y,b.y,t)+(Math.random()-.5)*j;arr[i*3+2]=lerp(a.z,b.z,t)+(Math.random()-.5)*j;}
  A.l.geometry.attributes.position.needsUpdate=true;A.l.material.color.set(hex).multiplyScalar(2.6);A.l.visible=true;A.t=A.life=.13;}
function flash(p,hex,s){const F=FX.flashes[FX.fi=(FX.fi+1)%FX.flashes.length];F.s.position.copy(p);F.s.material.color.set(hex).multiplyScalar(2);F.s.scale.setScalar(s);F.s.material.rotation=Math.random()*6;F.s.visible=true;F.t=.06;}
function decal(p,n,hex){const D=FX.decals[FX.di=(FX.di+1)%FX.decals.length];D.m.position.copy(p).addScaledVector(n,.01);D.m.lookAt(p.x+n.x,p.y+n.y,p.z+n.z);D.m.material.color.set(hex);D.m.visible=true;D.t=4;}
const _m4=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_s=new V3(),_p=new V3();
function updateFX(dt){
  for(const B of FX.beams)if(B.m.visible){B.t-=dt;if(B.t<=0)B.m.visible=false;else B.m.material.opacity=B.t/B.life;}
  for(const A of FX.arcs)if(A.l.visible){A.t-=dt;if(A.t<=0)A.l.visible=false;else A.l.material.opacity=A.t/A.life;}
  for(const F of FX.flashes)if(F.s.visible){F.t-=dt;if(F.t<=0)F.s.visible=false;}
  for(const D of FX.decals)if(D.m.visible){D.t-=dt;if(D.t<=0)D.m.visible=false;else D.m.material.opacity=Math.min(1,D.t/2);}
  const S=FX.sp;for(let i=0;i<S.n;i++){if(S.life[i]<=0){S.c[i*3]=S.c[i*3+1]=S.c[i*3+2]=0;continue;}S.life[i]-=dt;S.v[i*3+1]-=12*dt;
    S.p[i*3]+=S.v[i*3]*dt;S.p[i*3+1]+=S.v[i*3+1]*dt;S.p[i*3+2]+=S.v[i*3+2]*dt;if(S.p[i*3+1]<.02){S.p[i*3+1]=.02;S.v[i*3+1]*=-.3;}
    const f=Math.max(0,S.life[i]/S.max[i]);S.c[i*3]=S.col[i*3]*f;S.c[i*3+1]=S.col[i*3+1]*f;S.c[i*3+2]=S.col[i*3+2]*f;}
  FX.sparks.geometry.attributes.position.needsUpdate=true;FX.sparks.geometry.attributes.color.needsUpdate=true;
  const H=FX.sh;let any=false;for(let i=0;i<H.n;i++){if(H.life[i]<=0)continue;any=true;H.life[i]-=dt;
    H.vel[i*3+1]+=1.2*dt; // digital shards drift upward as they dissolve
    for(let k=0;k<3;k++){H.pos[i*3+k]+=H.vel[i*3+k]*dt;H.vel[i*3+k]*=1-1.6*dt;H.rot[i*3+k]+=dt*3;}
    const f=Math.max(0,H.life[i]/H.max[i]);_e.set(H.rot[i*3],H.rot[i*3+1],H.rot[i*3+2]);_q.setFromEuler(_e);_s.setScalar(f<.01?0:Math.min(1,f*1.6));_p.set(H.pos[i*3],H.pos[i*3+1],H.pos[i*3+2]);
    _m4.compose(_p,_q,_s);FX.shards.setMatrixAt(i,_m4);}
  if(any||FX.shWas)FX.shards.instanceMatrix.needsUpdate=true;FX.shWas=any;
  if(FX.muzzleLight.intensity>0)FX.muzzleLight.intensity=Math.max(0,FX.muzzleLight.intensity-dt*60);
}

/* ============ Viewmodel ============ */
const VM={};
function buildViewmodel(){
  vmScene.add(new THREE.HemisphereLight(0xdfeeff,0x5a5048,1.3));
  const k=new THREE.DirectionalLight(0xffffff,.9);k.position.set(-1,2,1.5);vmScene.add(k);
  const c1=new THREE.PointLight(CYAN,1.6,2.5,2);c1.position.set(.7,.3,.1);vmCam.add(c1);
  const c2=new THREE.PointLight(MAG,1.4,2.5,2);c2.position.set(-.5,-.2,-.6);vmCam.add(c2);
  VM.light=new THREE.PointLight(0xffffff,0,2,2);VM.light.position.set(.2,-.1,-.8);vmCam.add(VM.light);
  const body=new THREE.MeshStandardMaterial({color:0x2a3240,metalness:.45,roughness:.4});
  const plate=new THREE.MeshStandardMaterial({color:0x6b7889,metalness:.5,roughness:.32});
  const rub=new THREE.MeshStandardMaterial({color:0x0d1117,metalness:.2,roughness:.75});
  const add=(p,w,h,d,x,y,z,m,rx=0)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.rotation.x=rx;p.add(o);return o;};
  const screenCanvas=()=>{const [c,g]=mk(128,64);const t=tex(c);const m=new THREE.MeshBasicMaterial({map:t,toneMapped:false,color:new THREE.Color(1.6,1.6,1.6)});return {c,g,t,m};};
  VM.root=new THREE.Group();vmCam.add(VM.root);
  // rifle
  const R=new THREE.Group();const rc=neon(CYAN,2.6);
  add(R,.07,.09,.44,0,0,-.05,body);add(R,.078,.042,.32,0,.064,-.02,plate);add(R,.064,.064,.3,0,.004,-.38,plate);
  const bar=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.12,10),body);bar.rotation.x=Math.PI/2;bar.position.set(0,.004,-.58);R.add(bar);
  for(const z of [-.29,-.36,-.43]){const t=new THREE.Mesh(new THREE.TorusGeometry(.04,.0055,6,20),rc);t.position.set(0,.004,z);R.add(t);}
  add(R,.05,.15,.075,0,-.105,-.09,body,.22);add(R,.052,.02,.077,0,-.035,-.09,rc,.22);
  add(R,.046,.12,.05,0,-.09,.1,rub,-.3);add(R,.052,.075,.17,0,-.01,.22,body);add(R,.005,.012,.3,.04,.02,-.1,rc);add(R,.005,.012,.3,-.04,.02,-.1,rc);
  add(R,.032,.03,.06,0,.1,.03,plate);add(R,.01,.01,.004,0,.1,-.002,neon(0xff3355,3));
  VM.rScreen=screenCanvas();const rs=new THREE.Mesh(new THREE.PlaneGeometry(.075,.0375),VM.rScreen.m);rs.position.set(-.0405,.03,-.04);rs.rotation.y=-Math.PI/2;R.add(rs);
  VM.rMuzzle=new THREE.Object3D();VM.rMuzzle.position.set(0,.004,-.66);R.add(VM.rMuzzle);
  // arc scatter
  const A=new THREE.Group();const mc=neon(MAG,2.6);
  add(A,.11,.12,.36,0,0,-.06,body);add(A,.135,.135,.07,0,.005,-.27,plate);add(A,.06,.13,.06,0,-.1,.08,rub,-.25);add(A,.08,.09,.16,0,-.005,.19,body);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3+Math.PI/2;const px=Math.cos(a)*.042,py=Math.sin(a)*.042;add(A,.018,.018,.11,px,py+.005,-.35,plate);add(A,.02,.02,.02,px,py+.005,-.41,mc);}
  for(const z of [-.18,-.11,-.04]){const t=new THREE.Mesh(new THREE.TorusGeometry(.072,.009,6,22),mc);t.position.set(0,.005,z);A.add(t);}
  VM.cells=[];VM.cellOn=neon(MAG,2.8);VM.cellOff=new THREE.MeshStandardMaterial({color:0x221522,roughness:.5,metalness:.4});
  for(let i=0;i<6;i++)VM.cells.push(add(A,.02,.026,.026,0,.075,-.15+i*.034,VM.cellOn));
  add(A,.05,.01,.2,0,.064,-.065,plate);
  VM.aMuzzle=new THREE.Object3D();VM.aMuzzle.position.set(0,.005,-.43);A.add(VM.aMuzzle);
  // rail sniper
  const Lg=new THREE.Group();const lc=neon(AMB,2.6);
  add(Lg,.06,.08,.6,0,0,-.12,body);add(Lg,.07,.035,.4,0,.055,-.05,plate);
  const lb=new THREE.Mesh(new THREE.CylinderGeometry(.013,.018,.34,10),body);lb.rotation.x=Math.PI/2;lb.position.set(0,0,-.58);Lg.add(lb);
  add(Lg,.008,.01,.46,.026,-.012,-.36,lc);add(Lg,.008,.01,.46,-.026,-.012,-.36,lc);
  const scope=new THREE.Mesh(new THREE.CylinderGeometry(.022,.024,.22,12),plate);scope.rotation.x=Math.PI/2;scope.position.set(0,.105,-.03);Lg.add(scope);
  add(Lg,.03,.03,.004,0,.105,-.142,lc);add(Lg,.02,.03,.03,0,.075,-.03,body);
  add(Lg,.05,.14,.06,0,-.1,.05,rub,-.25);add(Lg,.055,.085,.2,0,-.012,.25,body);
  VM.rods=[];for(let i=0;i<4;i++)VM.rods.push(add(Lg,.006,.016,.05,-.033,.03-i*.0001,-.16+i*.03,lc));
  VM.lMuzzle=new THREE.Object3D();VM.lMuzzle.position.set(0,0,-.78);Lg.add(VM.lMuzzle);
  // hands
  const glove=new THREE.MeshStandardMaterial({color:0x12161e,roughness:.7,metalness:.15});
  for(const G of [R,A,Lg]){add(G,.07,.085,.11,.005,-.075,.11,glove,-.3);const fh=add(G,.075,.07,.12,-.012,-.052,G===R?-.33:G===A?-.2:-.4,glove,.1);fh.rotation.z=.2;
    add(G,.085,.09,.3,.04,-.13,.28,new THREE.MeshStandardMaterial({color:0x1d2533,roughness:.5,metalness:.5}),-.35);}
  // public/models/gun_*.glb replace a procedural gun whole (hands included); the model origin is the right-hand grip
  const GUN_POS=new V3(0,-.065,-.09),gunDst=[R,A,Lg];
  [MDL.gun_pulse,MDL.gun_arc,MDL.gun_rail].forEach((gm,i)=>{if(!gm)return;
    const m=faceForward(prepare(gm.scene,{shadow:false}));m.position.copy(GUN_POS);const G=new THREE.Group();G.add(m);gunDst[i]=G;
    const mz=m.getObjectByName('Muzzle')||G,named=(p,n)=>Array.from({length:n},(_,k)=>m.getObjectByName(p+(k+1))).filter(o=>o&&o.isMesh);
    if(i===0){VM.rMuzzle=mz;const scr=m.getObjectByName('Screen');if(scr&&scr.isMesh){VM.rScreen.t.flipY=false;VM.rScreen.t.needsUpdate=true;scr.material=VM.rScreen.m;}}
    else if(i===1){VM.aMuzzle=mz;const c=named('Cell_',6);if(c.length)VM.cells=c;}
    else{VM.lMuzzle=mz;const r=named('Rod_',4);if(r.length)VM.rods=r;}});
  const flashTex=starSprite();
  VM.flash=new THREE.Sprite(new THREE.SpriteMaterial({map:flashTex,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,toneMapped:false}));VM.flash.visible=false;VM.flash.scale.setScalar(.22);VM.rMuzzle.add(VM.flash);{const w=new THREE.Mesh(new THREE.BoxGeometry(.001,.001,.001),VM.cellOff);w.position.set(0,-5,0);gunDst[1].add(w);}
  VM.guns=gunDst;VM.holder=new THREE.Group();VM.root.add(VM.holder);for(const G of gunDst)VM.holder.add(G);
  VM.base=new V3(.17,-.175,-.36);VM.kick=0;VM.swayX=0;VM.swayY=0;VM.bob=0;VM.flashT=0;VM.lastAmmo=-1;
}
function drawScreen(n,max,reloading){const s=VM.rScreen,g=s.g;g.fillStyle='#02060c';g.fillRect(0,0,128,64);g.fillStyle=reloading?'#ffb43a':(n<=max*.25?'#ffb43a':'#2ef2ff');
  g.font='700 40px "Chakra Petch",monospace';g.textAlign='center';g.textBaseline='middle';g.fillText(reloading?'--':String(n).padStart(2,'0'),64,30);
  g.fillRect(10,56,108*(n/max),4);s.t.needsUpdate=true;}

function updateMesh(a,dt){
  const m=a.mesh;if(!m)return;m.visible=a.alive;if(!a.alive)return;const u=m.userData;
  m.position.copy(a.pos);m.rotation.y=a.yaw;
  const sp=Math.hypot(a.vel.x,a.vel.z);
  if(u.anim){const run=sp>.6;u.anim.setBase(!a.onGround?'Jump':run?'Run':'Idle',run?clamp(sp/P.speed,.6,1.5):1);u.anim.mixer.update(dt);u.anim.aim(a.pitch);}
  else{a.walk+=dt*sp*1.7;const sw=Math.sin(a.walk)*Math.min(1,sp/4)*.75;
  if(a.onGround){u.legs[0].rotation.x=sw;u.legs[1].rotation.x=-sw;}else{u.legs[0].rotation.x=.45;u.legs[1].rotation.x=-.35;}
  u.torso.position.y=.95+Math.abs(Math.cos(a.walk))*.035*Math.min(1,sp/4);u.torso.rotation.x=a.pitch*.35;u.head.rotation.x=a.pitch*.4;u.gun.rotation.x=a.pitch*.3;}
  const su=u.shield.material.uniforms;su.uT.value=gameTime;su.uA.value=Math.max(a.hitT>0?a.hitT*3.2:0,a.protect>0?.6:0);su.uHex.value=a.protect>0?1:.3;u.shield.visible=su.uA.value>.01;
  u.tag.visible=state!=='attract'&&a.pos.distanceTo(camera.position)<38;
}

/* ============ Audio ============ */
const AU={ctx:null,bus:{},idx:0,next:0,mode:'menu'};
function audioInit(){
  if(AU.ctx){if(AU.ctx.state==='suspended')AU.ctx.resume();return;}
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=AU.ctx=new C();
  const comp=c.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=4;comp.connect(c.destination);
  AU.master=c.createGain();AU.master.gain.value=.9;AU.master.connect(comp);
  for(const k of ['music','sfx','ui']){AU.bus[k]=c.createGain();AU.bus[k].connect(AU.master);}
  const len=c.sampleRate*2,buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;AU.noise=buf;
  AU.dly=c.createDelay(1);AU.dly.delayTime.value=60/98*.75;const fb=c.createGain();fb.gain.value=.34;const dl=c.createBiquadFilter();dl.type='lowpass';dl.frequency.value=2200;
  AU.arp=c.createGain();AU.arp.gain.value=1;AU.arp.connect(AU.bus.music);AU.arp.connect(AU.dly);AU.dly.connect(dl);dl.connect(fb);fb.connect(AU.dly);dl.connect(AU.bus.music);
  const rs=c.createBufferSource();rs.buffer=buf;rs.loop=true;const hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=600;const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=4200;
  const rg=c.createGain();rg.gain.value=.018;rs.connect(hp);hp.connect(lp);lp.connect(rg);rg.connect(AU.bus.sfx);rs.start();
  applyVolumes();AU.next=c.currentTime+.1;setInterval(musicTick,25);
}
function applyVolumes(){if(!AU.ctx)return;AU.bus.music.gain.value=S.music*.6;AU.bus.sfx.gain.value=S.sfx;AU.bus.ui.gain.value=S.ui*.8;}
function tone(type,f0,f1,dur,vol,dest,t0,filt){const c=AU.ctx,t=t0||c.currentTime;const o=c.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+dur);
  const g=c.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);let n=o;if(filt){const f=c.createBiquadFilter();f.type=filt[0];f.frequency.value=filt[1];if(filt[2])f.Q.value=filt[2];o.connect(f);n=f;}
  n.connect(g);g.connect(dest);o.start(t);o.stop(t+dur+.03);}
function nz(dur,vol,dest,type,freq,q,t0){const c=AU.ctx,t=t0||c.currentTime;const s=c.createBufferSource();s.buffer=AU.noise;const f=c.createBiquadFilter();f.type=type;f.frequency.value=freq;if(q)f.Q.value=q;
  const g=c.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(f);f.connect(g);g.connect(dest);s.start(t,Math.random()*1.5);s.stop(t+dur+.03);}
const _sr=new V3(),_sd=new V3();
function dest(pos){const c=AU.ctx;if(!pos)return AU.bus.sfx;const d=pos.distanceTo(camera.position);if(d>60)return null;const g=c.createGain();g.gain.value=1/(1+d*.11);
  if(c.createStereoPanner){const p=c.createStereoPanner();_sd.subVectors(pos,camera.position).normalize();_sr.setFromMatrixColumn(camera.matrixWorld,0);p.pan.value=clamp(_sd.dot(_sr),-1,1)*.8;g.connect(p);p.connect(AU.bus.sfx);}else g.connect(AU.bus.sfx);return g;}
function sfx(name,pos){
  if(!AU.ctx||AU.ctx.state!=='running')return;const d=dest(pos);if(!d)return;const c=AU.ctx,t=c.currentTime;
  switch(name){
    case 'pulse':tone('square',1500,170,.09,.16,d,t,['lowpass',3400]);tone('sawtooth',420,90,.13,.14,d);nz(.05,.18,d,'highpass',3200);break;
    case 'arc':nz(.32,.45,d,'bandpass',1700,.7);tone('sawtooth',95,28,.32,.42,d,t,['lowpass',900]);for(let i=0;i<6;i++)tone('square',2200+Math.random()*3000,null,.018,.08,d,t+i*.035);break;
    case 'reload':nz(.04,.25,d,'highpass',2500);tone('triangle',260,900,.45,.07,d,t+.1);nz(.04,.25,d,'highpass',2200,null,t+WEAPONS[local?local.wi:0].reload-.12);break;
    case 'switch':nz(.05,.2,d,'highpass',1800);tone('sine',600,950,.07,.08,d);break;
    case 'empty':tone('square',2400,null,.03,.05,d);break;
    case 'hit':tone('sine',1750,1750,.06,.2,AU.bus.ui);break;
    case 'kill':tone('sine',1750,1750,.06,.2,AU.bus.ui);tone('triangle',880,1760,.18,.16,AU.bus.ui,t+.05);break;
    case 'hurt':tone('sine',170,55,.2,.45,d);nz(.16,.22,d,'lowpass',700);break;
    case 'elim':for(let i=0;i<5;i++)tone('square',1500/(1+i*.45),null,.07,.07,d,t+i*.05,['lowpass',2600]);nz(.4,.12,d,'bandpass',4000,2);break;
    case 'spawn':tone('sine',220,1300,.5,.15,d);tone('triangle',660,1980,.4,.05,d,t+.12);break;
    case 'step':nz(.07,pos?.22:.12,d,'lowpass',380+Math.random()*260);break;
    case 'land':nz(.1,.22,d,'lowpass',300);tone('sine',90,45,.1,.25,d);break;
    case 'beep':tone('sine',660,null,.16,.25,AU.bus.ui);break;
    case 'go':tone('sine',990,null,.45,.25,AU.bus.ui);tone('sine',1485,null,.45,.1,AU.bus.ui);break;
    case 'ui':tone('triangle',1200,1500,.05,.08,AU.bus.ui);break;
    case 'uih':tone('sine',2100,null,.025,.025,AU.bus.ui);break;
    case 'rail':tone('sawtooth',260,38,.5,.32,d,t,['lowpass',1600]);nz(.32,.4,d,'bandpass',900,.6);tone('sine',2400,260,.3,.1,d);break;
    case 'pickup':tone('triangle',660,1320,.16,.14,AU.bus.ui);tone('sine',990,1980,.22,.08,AU.bus.ui,t+.08);break;
    case 'say':tone('sine',1320,null,.06,.07,AU.bus.ui);break;
    case 'end':for(let i=0;i<4;i++)tone('triangle',[523,659,784,1046][i],null,.4,.12,AU.bus.ui,t+i*.11);break;
  }}
const BPM=98,STEP=60/BPM/4,PROG=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]],mtof=m=>440*Math.pow(2,(m-69)/12);
function musicTick(){const c=AU.ctx;if(!c||c.state!=='running')return;if(AU.next<c.currentTime)AU.next=c.currentTime+.05;
  while(AU.next<c.currentTime+.15){musicStep(AU.idx,AU.next);AU.next+=STEP;AU.idx=(AU.idx+1)%64;}}
function musicStep(i,t){const s=i%16,ch=PROG[Math.floor(i/16)],m=AU.bus.music,full=AU.mode==='match',c=AU.ctx;
  if(s===0){for(const n of ch)for(const det of [-7,7]){const o=c.createOscillator();o.type='sawtooth';o.frequency.value=mtof(n);o.detune.value=det;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=900;
    const g=c.createGain();g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.022,t+.7);g.gain.linearRampToValueAtTime(.0001,t+STEP*16);o.connect(f);f.connect(g);g.connect(m);o.start(t);o.stop(t+STEP*16+.05);}}
  if(s%2===0)tone('sawtooth',mtof(ch[0]-24+(s%4===2?12:0)),null,STEP*1.8,.13,m,t,['lowpass',520,4]);
  if(full||s%2===0)tone('square',mtof(ch[i%3]+12+(((s>>2)&1)?12:0)),null,STEP*.85,.035,AU.arp,t,['lowpass',2100]);
  if(full){if(s%4===0)tone('sine',130,38,.22,.5,m,t);if(s===4||s===12)nz(.16,.22,m,'bandpass',1900,.8,t);if(s%2===1)nz(.04,.07,m,'highpass',7000,null,t);}}

/* ============ Post-processing ============ */
let composer=null,bloomPass=null,finalPass=null,fxaaPass=null;
const FinalShader={uniforms:{tDiffuse:{value:null},uT:{value:0},uFlash:{value:0},uProt:{value:0},uDead:{value:0},uVig:{value:.28},uCA:{value:.0035}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform float uT,uFlash,uProt,uDead,uVig,uCA;varying vec2 vUv;
  void main(){vec2 d=vUv-.5;float r2=dot(d,d);float ca=uCA*(1.+uFlash*2.);vec3 c;
    c.r=texture2D(tDiffuse,vUv+d*ca).r;c.g=texture2D(tDiffuse,vUv).g;c.b=texture2D(tDiffuse,vUv-d*ca).b;
    float l=dot(c,vec3(.299,.587,.114));c=mix(c,vec3(l)*vec3(.72,.86,1.05),uDead*.8);
    float edge=smoothstep(.05,.42,r2*1.6);c+=vec3(.9,.08,.22)*uFlash*edge*.55;c+=vec3(.05,.55,.65)*uProt*edge*.35;
    c*=1.-uVig*smoothstep(.12,.8,r2*1.7);c=clamp(c,0.,1.);c=pow(c,vec3(1./2.2));
    float n=fract(sin(dot(vUv*(uT+1.),vec2(12.9898,78.233)))*43758.5453);c+=(n-.5)*.016;gl_FragColor=vec4(c,1.);}`};
let VM_VISIBLE=false;
function buildComposer(){
  if(!(THREE.EffectComposer&&THREE.RenderPass&&THREE.ShaderPass&&THREE.UnrealBloomPass&&THREE.Pass)){composer=null;renderer.outputEncoding=THREE.sRGBEncoding;return;}
  const pr=renderer.getPixelRatio();
  const rt=new THREE.WebGLRenderTarget(Math.floor(innerWidth*pr),Math.floor(innerHeight*pr),{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,type:renderer.capabilities.isWebGL2?THREE.HalfFloatType:THREE.UnsignedByteType});
  composer=new THREE.EffectComposer(renderer,rt);
  composer.addPass(new THREE.RenderPass(scene,camera));
  class VMPass extends THREE.Pass{constructor(){super();this.needsSwap=false;}render(r,w,read){if(!VM_VISIBLE)return;const ac=r.autoClear;r.autoClear=false;r.setRenderTarget(this.renderToScreen?null:read);r.clearDepth();r.render(vmScene,vmCam);r.autoClear=ac;}}
  composer.addPass(new VMPass());
  bloomPass=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.4,.45,.97);composer.addPass(bloomPass);
  finalPass=new THREE.ShaderPass(FinalShader);composer.addPass(finalPass);
  if(THREE.FXAAShader){fxaaPass=new THREE.ShaderPass(THREE.FXAAShader);composer.addPass(fxaaPass);}
}
function applyQuality(){const q=QUALITY[S.quality]||QUALITY.high;renderer.setPixelRatio(q.pr);renderer.setSize(innerWidth,innerHeight);
  if(composer){composer.setPixelRatio(q.pr);composer.setSize(innerWidth,innerHeight);if(fxaaPass)fxaaPass.material.uniforms.resolution.value.set(1/(innerWidth*q.pr),1/(innerHeight*q.pr));bloomPass.enabled=S.bloom;}
  if(rain)rain.geometry.setDrawRange(0,q.rain*2);
  for(const l of lights)l.visible=q.lights||l.userData.core;
  if(sun){sun.castShadow=S.quality!=='low';sun.shadow.mapSize.set(S.quality==='high'?2048:1024,S.quality==='high'?2048:1024);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}
  camera.aspect=vmCam.aspect=innerWidth/innerHeight;camera.fov=S.fov;camera.updateProjectionMatrix();vmCam.updateProjectionMatrix();
  document.documentElement.style.setProperty('--ui',S.uiScale);}
function render(){
  if(composer){finalPass.uniforms.uT.value=gameTime%100;finalPass.uniforms.uFlash.value=S.hitFlash?ui.flash:0;
    finalPass.uniforms.uProt.value=(local&&local.alive&&local.protect>0&&inMatch())?.6+.4*Math.sin(gameTime*4):0;finalPass.uniforms.uDead.value=ui.dead;composer.render();}
  else{renderer.autoClear=true;renderer.render(scene,camera);if(VM_VISIBLE){renderer.autoClear=false;renderer.clearDepth();renderer.render(vmScene,vmCam);renderer.autoClear=true;}}
}

/* ============ Camera & viewmodel ============ */
let bobPh=0,menuCamT=0;
function updateCamera(dt){
  if(state==='attract'||state==='boot'){menuCamT+=dt;const t=menuCamT*.045+.6;const R=19+Math.sin(menuCamT*.07)*3;
    camera.position.set(Math.sin(t)*R,6.5+Math.sin(menuCamT*.11)*1.6,Math.cos(t)*R);camera.lookAt(Math.sin(t+1.2)*3,3.2,Math.cos(t+1.2)*3);return;}
  if(!local)return;const a=local;
  if(a.alive){const sp=Math.hypot(a.vel.x,a.vel.z);if(a.onGround&&sp>.5)bobPh+=dt*sp*1.9;const bob=S.shake?Math.sin(bobPh*2)*.03*Math.min(1,sp/6):0;
    const bp=state==='online'?net.rpos:a.pos;camera.position.set(bp.x,bp.y+P.eye+bob,bp.z);camera.rotation.set(a.pitch,a.yaw,0);ui.dead=Math.max(0,ui.dead-dt*3);}
  else{ui.dead=Math.min(1,ui.dead+dt*2);camera.position.y=lerp(camera.position.y,a.pos.y+3.2,dt*1.5);
    if(ui.killer&&ui.killer.alive){const dx=ui.killer.pos.x-camera.position.x,dz=ui.killer.pos.z-camera.position.z,dy=ui.killer.pos.y+1-camera.position.y;
      a.yaw+=angWrap(Math.atan2(-dx,-dz)-a.yaw)*Math.min(1,dt*3);a.pitch=lerp(a.pitch,Math.atan2(dy,Math.hypot(dx,dz)),Math.min(1,dt*3));}
    camera.rotation.set(a.pitch,a.yaw,0);}
  if(shake>0){shake=Math.max(0,shake-dt*2.8);const s=shake*shake*.035;camera.rotation.x+=(Math.random()-.5)*s;camera.rotation.y+=(Math.random()-.5)*s;camera.rotation.z=(Math.random()-.5)*s*.6;}
}
function updateViewmodel(dt){
  if(!local)return;const a=local,w=WEAPONS[a.wi],st=a.ws[a.wi];
  VM.guns.forEach((g,i)=>g.visible=a.wi===i);
  VM.kick=lerp(VM.kick,0,Math.min(1,dt*12));VM.swayX=lerp(VM.swayX,clamp(-input.lmdx*.0006,-.05,.05),Math.min(1,dt*9));VM.swayY=lerp(VM.swayY,clamp(input.lmdy*.0006,-.04,.04),Math.min(1,dt*9));
  const sp=Math.hypot(a.vel.x,a.vel.z)*(a.onGround?1:.2);VM.land=Math.max(0,(VM.land||0)-dt*3);
  const bx=Math.sin(bobPh)*.012*Math.min(1,sp/6),by=-Math.abs(Math.cos(bobPh))*.012*Math.min(1,sp/6);
  let ry=0,rz=0,dy=0;
  if(st.reload>0){const p=1-st.reload/w.reload,r=Math.sin(p*Math.PI);rz=.55*r;ry=.25*r;dy=-.09*r;}
  if(a.switchT>0)dy-=.32*(a.switchT/.35);
  if(!a.alive)dy-=.6;
  const h=VM.holder;h.position.set(VM.base.x+VM.swayX+bx,VM.base.y+VM.swayY+by+dy-VM.land*.03+Math.sin(gameTime*1.6)*.003,VM.base.z+VM.kick*.07);
  h.rotation.set(VM.kick*.12+VM.swayY*.8,VM.swayX*1.2+ry,rz+VM.swayX*.6);
  // muzzle flash
  const mz=[VM.rMuzzle,VM.aMuzzle,VM.lMuzzle][a.wi];if(VM.flash.parent!==mz)mz.add(VM.flash);
  VM.flashT-=dt;VM.flash.visible=VM.flashT>0;if(VM.flash.visible){VM.flash.material.color.set(w.color).multiplyScalar(2.5);VM.flash.material.rotation=Math.random()*6;VM.flash.scale.setScalar([.2,.32,.3][a.wi]);}
  VM.light.intensity=Math.max(0,VM.light.intensity-dt*50);
  // ammo readouts on the guns
  const key=a.wi+':'+st.ammo+':'+(st.reload>0);if(key!==VM.lastAmmo){VM.lastAmmo=key;if(a.wi===0)drawScreen(st.ammo,w.mag,st.reload>0);else if(a.wi===1)VM.cells.forEach((c,i)=>c.material=i<st.ammo?VM.cellOn:VM.cellOff);else VM.rods.forEach((c,i)=>c.material=i<st.ammo?neon(AMB,2.6):VM.cellOff);}
}

/* ============ Touch controls ============ */
const touch={on:false,auto:false,mx:0,mz:0,fire:false,jump:false,stickId:null,ox:0,oy:0};
const ctl={reload:false,sw:-1};
function enableTouch(){if(touch.on)return;touch.on=true;document.body.classList.add('touch');$('#touchNote').classList.remove('hidden');$('#lockNote').classList.add('hidden');}
function goFull(){if(!touch.on)return;const d=document.documentElement;try{const p=d.requestFullscreen?d.requestFullscreen({navigationUI:'hide'}):null;
  if(p&&p.then)p.then(()=>{try{const q=screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape');if(q&&q.catch)q.catch(()=>{});}catch(e){}}).catch(()=>{});}catch(e){}}
function setupTouch(){
  addEventListener('touchstart',()=>enableTouch(),{once:true,passive:true});
  const L=$('#tzone-l'),stick=$('#stick'),knob=stick.firstElementChild;
  L.addEventListener('pointerdown',e=>{if(touch.stickId!==null)return;e.preventDefault();touch.stickId=e.pointerId;touch.ox=e.clientX;touch.oy=e.clientY;
    stick.style.left=e.clientX+'px';stick.style.top=e.clientY+'px';stick.classList.add('on');try{L.setPointerCapture(e.pointerId);}catch(err){}});
  L.addEventListener('pointermove',e=>{if(e.pointerId!==touch.stickId)return;let dx=e.clientX-touch.ox,dy=e.clientY-touch.oy;const R0=56,l=Math.hypot(dx,dy);
    if(l>R0){dx*=R0/l;dy*=R0/l;}touch.mx=dx/R0;touch.mz=-dy/R0;knob.style.transform=`translate(${dx}px,${dy}px)`;});
  const endS=e=>{if(e.pointerId!==touch.stickId)return;touch.stickId=null;touch.mx=touch.mz=0;knob.style.transform='';stick.classList.remove('on');};
  L.addEventListener('pointerup',endS);L.addEventListener('pointercancel',endS);
  const look=(el,down,up)=>{el.addEventListener('pointerdown',e=>{e.preventDefault();try{el.setPointerCapture(e.pointerId);}catch(err){}el._id=e.pointerId;el._x=e.clientX;el._y=e.clientY;el.classList.add('down');down&&down();});
    el.addEventListener('pointermove',e=>{if(e.pointerId!==el._id||paused)return;const dx=e.clientX-el._x,dy=e.clientY-el._y,acc=1+Math.min(1.6,Math.hypot(dx,dy)/28),k=.0068*S.touchSens*acc;input.tdx+=dx*k;input.tdy+=dy*k*.75;el._x=e.clientX;el._y=e.clientY;});
    const end=e=>{if(e.pointerId!==el._id)return;el._id=null;el.classList.remove('down');up&&up();};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);};
  look($('#tzone-r'));look($('#t-fire'),()=>{touch.fire=true;},()=>{touch.fire=false;});
  const hold=(id,fn)=>{const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.classList.add('down');fn(true);});const up=()=>{el.classList.remove('down');fn(false);};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('pointerleave',up);};
  const tap=(id,fn)=>{$(id).addEventListener('pointerdown',e=>{e.preventDefault();fn();});};
  hold('#t-jump',v=>touch.jump=v);tap('#t-reload',()=>actReload());tap('#t-swap',()=>actSwap());
  tap('#t-menu',()=>pauseGame());tap('#t-board',()=>showBoard($('#board').classList.contains('hidden')));tap('#t-chat',()=>toggleChat());
}

/* ============ Session basics ============ */
let state='boot',paused=false,gameTime=0,cdShown=-1;
const _o=new V3(),_f=new V3(),_hit=new V3(),_nrm=new V3(),_mz=new V3(),_tc=new V3(),_tv=new V3();
const inMatch=()=>state==='online';
const isLive=()=>state==='online'&&net.m.s!=='results';
function muzzleWorld(a,out){if(a===local){return out.set(.17,-.15,-.8).applyMatrix4(camera.matrixWorld);}
  const an=a.mesh&&a.mesh.userData.anim;if(an&&an.muzzle&&a.mesh.visible){a.mesh.updateMatrixWorld(true);return an.muzzle.getWorldPosition(out);}
  aimDir(a.yaw,a.pitch,_f);return out.set(a.pos.x+Math.cos(a.yaw)*.2,a.pos.y+1.28,a.pos.z-Math.sin(a.yaw)*.2).addScaledVector(_f,.7);}

/* ============ Pickups & relay zone visuals ============ */
const PK={items:[],zone:null};
function buildPickupsFX(){
  const padMat=new THREE.MeshStandardMaterial({color:0x2a3240,roughness:.5,metalness:.4});
  for(const p of SH.PICKUPS){
    const g=new THREE.Group();g.position.set(p.x,p.y,p.z);scene.add(g);
    const col=p.type==='shield'?CYAN:AMB,pm=p.type==='shield'?MDL.pickup_shield:MDL.pickup_boost;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.56,.02,6,40),neon(col,2.4));ring.rotation.x=Math.PI/2;ring.position.y=.07;g.add(ring);
    const core=new THREE.Group();g.add(core);let baseY=1,glowY=0;
    // pickup_*.glb: Base stays on the pad, Core floats and spins (same animation as the procedural core)
    const model=pm&&prepare(pm.scene.clone(true)),mcore=model&&model.getObjectByName('Core');
    if(mcore){g.add(model);core.add(mcore);baseY=0;glowY=mcore.position.y;}
    else{const pad=new THREE.Mesh(new THREE.CylinderGeometry(.6,.66,.06,28),padMat);pad.position.y=.03;pad.receiveShadow=true;g.add(pad);
    if(p.type==='shield'){const m=new THREE.Mesh(new THREE.OctahedronGeometry(.3,0),new THREE.MeshStandardMaterial({color:0x0b2a33,emissive:CYAN,emissiveIntensity:1.8,metalness:.3,roughness:.2,flatShading:true}));m.scale.y=1.4;core.add(m);
      const h=new THREE.Mesh(new THREE.TorusGeometry(.42,.015,6,6),neon(CYAN,2.6));core.add(h);}
    else{for(const k of [0,1]){const c=new THREE.Group();c.position.y=k*.26-.13;core.add(c);
      for(const s of [-1,1]){const b=new THREE.Mesh(new THREE.BoxGeometry(.34,.07,.07),neon(AMB,2.8));b.position.x=s*.12;b.rotation.z=s*.6;c.add(b);}}}}
    core.position.y=baseY;
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowSprite('rgba(255,255,255,.5)',true),color:new THREE.Color(col),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:.55}));
    glow.scale.setScalar(1.6);glow.position.y=glowY;core.add(glow);
    PK.items.push({g,core,ring,baseY,on:true});
  }
  const zg=new THREE.Group();zg.position.y=3.52;scene.add(zg);
  const zmat=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false});
  const fmat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.14,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  const cmat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.06,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  /** Outline + fill of the relay deck (points in x,z) and a light column above it. */
  const zoneShape=(pts,colSeg,colRot)=>{const g=new THREE.Group();
    pts.forEach(([a,b],i)=>{const [c,d]=pts[(i+1)%pts.length];
      const t=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,Math.hypot(c-a,d-b),6),zmat);t.rotation.z=Math.PI/2;t.position.set((a+c)/2,.03,(b+d)/2);t.rotation.y=Math.atan2(-(d-b),c-a);g.add(t);});
    const sh=new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,-z)));const fill=new THREE.Mesh(new THREE.ShapeGeometry(sh),fmat);fill.rotation.x=-Math.PI/2;fill.position.y=.02;g.add(fill);
    const col=new THREE.Mesh(new THREE.CylinderGeometry(3.1*1.35,3.1*1.35,4,colSeg,1,true),cmat);col.rotation.y=colRot;col.position.y=2;g.add(col);
    zg.add(g);return g;};
  const half=3.1;
  // city: square tower top; underground: the reactor's cross-shaped octagon deck (shared.js buildMap('underground'), inset 5 cm)
  const s=3.15*Math.SQRT1_2-.05,r=3.1,w=1.25,deck=[[r,-w],[r,w],[s,w],[s,s],[w,s],[w,r],[-w,r],[-w,s],[-s,s],[-s,w],[-r,w],[-r,-w],[-s,-w],[-s,-s],[-w,-s],[-w,-r],[w,-r],[w,-s],[s,-s],[s,-w]];
  const shapes={city:zoneShape([[-half,-half],[half,-half],[half,half],[-half,half]],4,Math.PI/4),underground:zoneShape(deck,8,Math.PI/8)};
  zg.visible=false;PK.zone={g:zg,zmat,fmat,col:{material:cmat},shapes};
  showZoneShape(arenaShown||'city');
}
function showZoneShape(name){if(!PK.zone)return;for(const [k,g] of Object.entries(PK.zone.shapes))g.visible=k===(PK.zone.shapes[name]?name:'city');}
function updatePickupsFX(t){
  PK.items.forEach((it,i)=>{const on=!!net.pk[i];it.core.visible=on;it.ring.material=neon(on?(SH.PICKUPS[i].type==='shield'?CYAN:AMB):0x55606e,on?2.4:1);
    if(on){it.core.rotation.y=t*1.6;it.core.position.y=it.baseY+Math.sin(t*2+i)*.1;}});
  const Z=PK.zone,show=net.m.mode==='koth'&&(net.m.s==='playing'||net.m.s==='countdown');Z.g.visible=show;if(!show)return;
  const [owner,cont]=net.zone;let col=new THREE.Color(0xdfe8f2),k=1.6;
  if(cont){col.set(MAG);k=1.6+Math.sin(t*5)*.6;}else if(owner){const a=agentById(owner);if(a)col.set(a.color);k=2.4;}
  Z.zmat.color.copy(col).multiplyScalar(k);Z.fmat.color.copy(col);Z.col.material.color.copy(col);
}

/* ============ Input ============ */
const input={keys:{},fire:false,mdx:0,mdy:0,lmdx:0,lmdy:0,tdx:0,tdy:0};
let unlocked=false,everLocked=false,shake=0;
const canvas=renderer.domElement;
const isLocked=()=>document.pointerLockElement===canvas;
function addShake(v){if(S.shake)shake=Math.min(1,shake+v);}
function lockPointer(){if(touch.on)return;if(!canvas.requestPointerLock){unlocked=true;$('#lockNote').classList.remove('hidden');return;}
  try{const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>onLockError());}catch(e){onLockError();}}
function onLockError(){if(everLocked){if(paused){$('#pause-lead').textContent='瀏覽器需要約一秒冷卻，請再按一次「繼續對戰」。';}return;}
  unlocked=true;$('#lockNote').classList.remove('hidden');if(paused)resumeGame(true);}
document.addEventListener('pointerlockerror',onLockError);
document.addEventListener('pointerlockchange',()=>{if(isLocked()){everLocked=true;unlocked=false;$('#lockNote').classList.add('hidden');$('#clickNote').classList.add('hidden');if(paused)resumeGame(true);}
  else if(inMatch()&&!paused&&!unlocked&&!touch.on&&!net.noPause)pauseGame();net.noPause=false;});
addEventListener('mousemove',e=>{if(touch.on)return;if(isLocked()||(unlocked&&inMatch()&&!paused)){input.mdx+=e.movementX||0;input.mdy+=e.movementY||0;}});
addEventListener('mousedown',e=>{if(touch.on||!inMatch()||paused)return;if(e.button===0&&(isLocked()||unlocked))input.fire=true;});
addEventListener('mouseup',e=>{if(e.button===0)input.fire=false;});
canvas.addEventListener('click',()=>{if(inMatch()&&!touch.on&&!paused&&!isLocked()&&!unlocked&&!navStack.length)lockPointer();});
addEventListener('wheel',e=>{if(inMatch()&&!paused&&local)actSwap((local.wi+(e.deltaY>0?1:2))%3);},{passive:true});
addEventListener('blur',()=>{input.keys={};input.fire=false;});
let chatOpen=false;
function toggleChat(v){chatOpen=v===undefined?!chatOpen:!!v;$('#chat').classList.toggle('hidden',!chatOpen||!inMatch());}
function say(i){netSend({t:'say',i});toggleChat(false);}
function actReload(){if(inMatch())ctl.reload=true;}
function actSwap(i){if(!inMatch()||!local)return;if(i===undefined)i=(local.wi+1)%WEAPONS.length;ctl.sw=i;}
addEventListener('keydown',e=>{
  if(e.code==='Enter'&&lobby.where==='pending'&&!e.repeat){acceptOffer();e.preventDefault();return;}
  if(['Tab','Space','ArrowUp','ArrowDown'].includes(e.code)&&inMatch())e.preventDefault();
  if(e.code==='Escape'){if(chatOpen){toggleChat(false);return;}
    if(inMatch()&&!paused&&(unlocked||touch.on||!isLocked())){if(!net.resOpen)pauseGame();return;}
    if(navStack.length>1||(navStack.length===1&&!paused&&!net.resOpen))goBack();return;}
  if(!inMatch()||paused)return;
  if(chatOpen&&/^Digit[1-6]$/.test(e.code)){say(+e.code.slice(5)-1);return;}
  input.keys[e.code]=true;
  if(e.code==='KeyR')actReload();if(e.code==='Digit1')actSwap(0);if(e.code==='Digit2')actSwap(1);if(e.code==='Digit3')actSwap(2);
  if(e.code==='KeyT'&&!e.repeat)toggleChat();
  if(e.code==='Tab')showBoard(true);});
addEventListener('keyup',e=>{input.keys[e.code]=false;if(e.code==='Tab')showBoard(false);});

/* ============ UI ============ */
const ui={flash:0,dead:0,hm:0,killer:null,fps:60,fpsAcc:0,fpsN:0,fpsT:0,boardT:0,dd:[],prev:{}};
const navStack=[];
const OVERLAYS=['setup','online','queue','lb','settings','help','pause','results'];
function openOverlay(id){for(const o of OVERLAYS)$('#'+o).classList.add('hidden');$('#'+id).classList.remove('hidden');navStack.push(id);
  if(id==='lb')loadLeaderboard();
  const f=$('#'+id+' .btn, #'+id+' input, #'+id+' button');if(f&&!touch.on)setTimeout(()=>f.focus({preventScroll:true}),30);}
function goBack(){navStack.pop();for(const o of OVERLAYS)$('#'+o).classList.add('hidden');const p=navStack[navStack.length-1];if(p)$('#'+p).classList.remove('hidden');sfx('ui');}
function closeAll(){navStack.length=0;for(const o of OVERLAYS)$('#'+o).classList.add('hidden');}
function setText(id,v){if(ui.prev[id]!==v){ui.prev[id]=v;document.getElementById(id).textContent=v;}}
function hitMarker(kill){const el=$('#hitm');el.classList.toggle('kill',kill);ui.hm=kill?.45:.22;}
function dmgIndicator(src){let d=ui.dd.find(x=>x.t<=0);if(!d){if(ui.dd.length>=4)d=ui.dd[0];else{const el=document.createElement('div');el.className='dd';$('#dmgdirs').appendChild(el);d={el,t:0,p:new V3()};ui.dd.push(d);}}d.p.copy(src);d.t=1.1;}
const hexCol=c=>'#'+new THREE.Color(c).getHexString();
function feedLine(build,cls,ms=6500){const f=$('#feed');const el=document.createElement('div');el.className='kf'+(cls?' '+cls:'');build(el);f.prepend(el);while(f.children.length>5)f.lastChild.remove();setTimeout(()=>el.remove(),ms);}
function nameSpan(ag){const s=document.createElement('span');s.textContent=ag?ag.name:'系統';s.style.color=hexCol(ag?ag.color:0xffffff);return s;}
function killFeed(a,t,w){feedLine(el=>{const wt=document.createElement('span');wt.className='w';wt.textContent=w?w.short:'墜落';
  if(a&&a!==t){el.appendChild(nameSpan(a));el.appendChild(wt);}el.appendChild(nameSpan(t));},(a===local||t===local)?'me':'');}
function sysFeed(text){feedLine(el=>{el.textContent=text;},'sys',5000);}
function showBoard(v){$('#board').classList.toggle('hidden',!v);if(v)refreshBoard();}
function ranked(){return agents.slice().sort((x,y)=>y.score-x.score||x.deaths-y.deaths);}
const fmtTime=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const STATE_TXT={waiting:'暖身中',countdown:'即將開戰',playing:'對戰中',results:'結算中'};
const modeName=()=>(SH.MODES[net.m.mode]||SH.MODES.ffa).name;
const arenaName=()=>(SH.ARENAS[net.m.arena]||SH.ARENAS.city).name;
function matchLabel(){const m=net.m;return m.s==='playing'?`${modeName()}，先達 ${m.limit} 分，剩餘 ${fmtTime(m.t)}`:STATE_TXT[m.s]||'';}
function refreshBoard(){const tb=$('#bd-body');tb.textContent='';
  for(const a of ranked()){const tr=document.createElement('tr');if(a===local)tr.className='me';
    const td0=document.createElement('td');const ch=document.createElement('i');ch.className='chip';ch.style.background=hexCol(a.color);td0.appendChild(ch);td0.appendChild(document.createTextNode(a.name+(a===local?'（你）':'')));tr.appendChild(td0);
    for(const v of [a.score,a.kills||0,a.deaths,a.bot?'機器人':(net.kind==='local'?'本機':(a.rtt||0)+' ms')]){const td=document.createElement('td');td.textContent=v;tr.appendChild(td);}tb.appendChild(tr);}
  $('#bd-title').textContent=net.kind==='ws'?'連線對戰':'單人練習';$('#bd-sub').textContent=matchLabel();}
function updateHUD(dt){
  if(!local)return;const a=local,w=WEAPONS[a.wi],st=a.ws[a.wi],m=net.m,s=m.s;
  setText('timer',s==='waiting'?'暖身':s==='results'?'結算':fmtTime(m.t));$('#timer').classList.toggle('low',s==='playing'&&m.t<30);
  setText('tb-limit',s==='waiting'?(net.kind==='ws'?'暖身中，等待開戰':'準備中'):s==='countdown'?`${modeName()}・${arenaName()}，${Math.ceil(m.t)} 秒後開戰`:s==='playing'?`${modeName()}・${arenaName()}：先達 ${m.limit} 分`:'本場結束');
  setText('sc-you',String(a.score));const lead=ranked().find(x=>x!==a);if(lead){setText('sc-lead',String(lead.score));setText('lead-name',lead.name);}
  const sh=Math.ceil(a.shield);setText('shNum',String(a.alive?sh:0));
  if(ui.prev.seg!==sh+':'+a.alive){ui.prev.seg=sh+':'+a.alive;const segs=$('#segs').children;for(let i=0;i<10;i++)segs[i].classList.toggle('on',a.alive&&sh>i*10);$('#shieldP').classList.toggle('low',sh<=30);}
  setText('wName',w.name);setText('ammo',String(st.ammo));setText('mag','/ '+w.mag);$('#ammo').classList.toggle('low',st.ammo<=Math.ceil(w.mag*.25));
  $('#rbarI').style.width=st.reload>0?((1-st.reload/w.reload)*100).toFixed(1)+'%':'0%';
  setText('wHint',st.reload>0?'換彈中':(st.ammo===0?'按 R 換彈':(st.ammo<=w.mag*.25?'彈藥偏低':'')));
  if(ui.prev.slot!==a.wi){ui.prev.slot=a.wi;document.querySelectorAll('.slots span').forEach(x=>x.classList.toggle('on',+x.dataset.s===a.wi));}
  const sp=Math.hypot(a.vel.x,a.vel.z),rail=w.id==='rail';const gap=(rail?3:5)+VM.kick*(rail?4:9)+sp*(rail?.9:.6)+(a.onGround?0:6);const xh=$('#xhair').children;
  xh[0].style.top=(-gap-9)+'px';xh[1].style.top=gap+'px';xh[2].style.left=(-gap-9)+'px';xh[3].style.left=gap+'px';
  const ring=w.pellets?Math.tan(w.spreadDeg*Math.PI/180)/Math.tan(camera.fov*Math.PI/360)*innerHeight/2:0;
  for(let i=0;i<4;i++)xh[i].style.opacity=w.pellets?.35:1;$('#xringc').setAttribute('r',ring.toFixed(1));$('#xring').style.display=w.pellets?'block':'none';
  $('#xhair').style.opacity=a.alive?1:0;
  ui.hm-=dt;$('#hitm').style.opacity=Math.max(0,Math.min(1,ui.hm*6));
  for(const d of ui.dd){d.t-=dt;if(d.t<=0){d.el.style.opacity=0;continue;}const dx=d.p.x-a.pos.x,dz=d.p.z-a.pos.z;const fx=-Math.sin(a.yaw),fz=-Math.cos(a.yaw),rx=Math.cos(a.yaw),rz=-Math.sin(a.yaw);
    d.el.style.transform=`rotate(${Math.atan2(dx*rx+dz*rz,dx*fx+dz*fz)}rad)`;d.el.style.opacity=Math.min(1,d.t*1.5);}
  $('#protect').classList.toggle('hidden',!(a.alive&&a.protect>0&&isLive()));
  $('#deadP').classList.toggle('hidden',a.alive||!isLive());if(!a.alive)setText('rsT',Math.max(0,a.respawnT).toFixed(1));
  // relay zone status
  const zoneOn=m.mode==='koth'&&s==='playing';$('#zone').classList.toggle('hidden',!zoneOn);
  if(zoneOn){const [owner,cont]=net.zone,o=owner?agentById(owner):null;
    setText('zone',cont?'中繼站爭奪中':owner===net.id?'你正在佔領中繼站':o?`${o.name} 佔領中繼站`:`中繼站無人佔領，前往${net.m.arena==='underground'?'反應爐頂':'塔頂'}`);
    $('#zone').style.setProperty('--zc',cont?'var(--magenta)':o?hexCol(o.color):'#9fb3c8');}
  $('#boostTag').classList.toggle('hidden',!(a.alive&&a.boostT>0));if(a.boostT>0)setText('boostTag',`加速 ${a.boostT.toFixed(1)} 秒`);
  ui.boardT-=dt;if(ui.boardT<=0&&!$('#board').classList.contains('hidden')){ui.boardT=.5;refreshBoard();}
  $('#stats').classList.toggle('hidden',!S.stats);
  if(S.stats&&ui.fpsT<=0){ui.fpsT=.5;$('#stats').innerHTML=net.kind==='ws'?`<b>${Math.round(ui.fps)}</b> FPS<br>延遲 <b>${net.rtt} ms</b><br>連線 <b>線上 ${agents.length}/${SH.MAX_PLAYERS}</b>`:`<b>${Math.round(ui.fps)}</b> FPS<br>延遲 <b>本機</b><br>模式 <b>單人練習</b>`;}
}

/* --- menus --- */
function buildTitle(){const t=$('#title');t.textContent='';'NEON GRID'.split('').forEach((ch,i)=>{const s=document.createElement('span');s.textContent=ch===' '?'\u00a0':ch;s.style.animationDelay=(.15+i*.09)+'s';t.appendChild(s);});}
function bindRange(id,key,fmt,onch){const el=$('#'+id),out=el.parentElement.querySelector('output');const upd=()=>{const p=(el.value-el.min)/(el.max-el.min)*100;el.style.setProperty('--p',p+'%');if(out)out.textContent=fmt(+el.value);};
  el.value=S[key];upd();el.addEventListener('input',()=>{S[key]=+el.value;upd();saveSettings();onch&&onch();});return {el,key,upd};}
function bindSeg(id,key,parse,onch){const el=$('#'+id);const upd=()=>el.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(parse(b.dataset.v)===S[key])));
  el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S[key]=parse(b.dataset.v);upd();saveSettings();sfx('ui');onch&&onch();});upd();return upd;}
function bindTgl(id,key,onch){const el=$('#'+id);const upd=()=>el.setAttribute('aria-pressed',String(!!S[key]));el.addEventListener('click',()=>{S[key]=!S[key];upd();saveSettings();sfx('ui');onch&&onch();});upd();return upd;}
function invite(){const url=location.origin+location.pathname,data={title:'NEON GRID 霓虹競技場',text:'一起來打 NEON GRID！手機電腦都能玩。',url};
  if(navigator.share){navigator.share(data).catch(()=>{});return;}
  (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>showNotice('已複製遊戲網址，貼給朋友就能一起玩。')).catch(()=>showNotice(url));}
let lbData=null,lbTab='today';
function renderLeaderboard(){const head=$('#lb-head'),body=$('#lb-body');head.textContent='';body.textContent='';
  document.querySelectorAll('#lb-tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===lbTab)));
  if(!lbData)return;const rows=lbTab==='today'?lbData.today:lbData.all;
  const cols=lbTab==='today'?[['name','暱稱'],['kills','淘汰'],['wins','勝場'],['matches','場數']]:[['name','暱稱'],['kills','淘汰'],['wins','勝場'],['matches','場數'],['best','最長連殺']];
  const tr=document.createElement('tr');for(const c of [['#','名次'],...cols]){const th=document.createElement('th');th.textContent=c[1];tr.appendChild(th);}head.appendChild(tr);
  rows.forEach((r,i)=>{const tr=document.createElement('tr');if(r.name===S.name)tr.className='me';for(const v of [i+1,...cols.map(c=>r[c[0]])]){const td=document.createElement('td');td.textContent=v;tr.appendChild(td);}body.appendChild(tr);});
  $('#lb-note').textContent=rows.length?(lbTab==='today'?`日期：${lbData.day}`:''):'還沒有紀錄。完成一場連線對戰就會上榜。';}
function loadLeaderboard(){lbData=null;renderLeaderboard();$('#lb-note').textContent='讀取中…';
  if(!location.host){$('#lb-note').textContent='排行榜只在部署後的連線版網址提供。';return;}
  fetch('/leaderboard',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(d=>{lbData=d;renderLeaderboard();}).catch(()=>{$('#lb-note').textContent='無法讀取排行榜，請稍後再試。';});}
function pollStatus(){if(!location.host)return;fetch('/status',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(s=>{if(!s)return;
  $('#on-count').innerHTML='';const b=document.createElement('span');b.className=s.humans?'live':'';b.textContent=s.humans?`線上 ${s.humans} 人，${STATE_TXT[s.state]||''}`:'目前沒人，開場有機器人陪打';$('#on-count').appendChild(b);}).catch(()=>{});}
const binders=[];
function bindUI(){
  buildTitle();const segs=$('#segs');for(let i=0;i<10;i++)segs.appendChild(document.createElement('i'));
  const pct=v=>Math.round(v*100)+'%';
  binders.push(bindRange('s-music','music',pct,applyVolumes),bindRange('s-sfx','sfx',pct,applyVolumes),bindRange('s-ui','ui',pct,applyVolumes),
    bindRange('s-sens','sens',v=>v.toFixed(2)),bindRange('s-tsens','touchSens',v=>v.toFixed(2)),bindRange('s-fov','fov',v=>v+'°',applyQuality),bindRange('s-uiscale','uiScale',pct,applyQuality),bindRange('in-bots','bots',v=>String(v)));
  const modeRows=()=>{$('#row-score').classList.toggle('hidden',S.mode!=='ffa');$('#row-kscore').classList.toggle('hidden',S.mode!=='koth');};
  const segU=[bindSeg('s-quality','quality',v=>v,applyQuality),bindSeg('seg-diff','diff',v=>v),bindSeg('seg-time','time',v=>+v),bindSeg('seg-score','scoreLimit',v=>+v),
    bindSeg('seg-kscore','kothLimit',v=>+v),bindSeg('seg-mode','mode',v=>v,modeRows)];modeRows();
  const tg=[bindTgl('s-invert','invertY'),bindTgl('s-bloom','bloom',applyQuality),bindTgl('s-shake','shake'),bindTgl('s-flash','hitFlash'),bindTgl('s-stats','stats'),bindTgl('s-assist','assist'),bindTgl('s-autofire','autofire')];
  const nm=$('#in-name'),on=$('#on-name');nm.value=on.value=S.name;
  nm.addEventListener('input',()=>{S.name=nm.value.slice(0,16);on.value=nm.value;saveSettings();});on.addEventListener('input',()=>{S.name=on.value.slice(0,16);nm.value=on.value;saveSettings();});
  $('#s-reset').addEventListener('click',()=>{const keep={name:S.name,bots:S.bots,diff:S.diff,time:S.time,scoreLimit:S.scoreLimit,kothLimit:S.kothLimit,mode:S.mode};S=Object.assign({},DEF,keep);saveSettings();
    for(const b of binders){b.el.value=S[b.key];b.upd();}segU.forEach(f=>f());tg.forEach(f=>f());modeRows();applyQuality();applyVolumes();sfx('ui');});
  document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(g){audioInit();sfx('ui');openOverlay(g.dataset.go);return;}if(e.target.closest('[data-back]')){goBack();}});
  document.querySelectorAll('.navbtn').forEach(b=>b.addEventListener('mouseenter',()=>sfx('uih')));
  $('#btn-start').addEventListener('click',()=>{S.name=sanitizeName(nm.value);nm.value=on.value=S.name;saveSettings();startSolo();});
  $('#btn-resume').addEventListener('click',()=>resumeGame(false));
  $('#btn-quit').addEventListener('click',()=>leaveMatch());
  $('#btn-again').addEventListener('click',()=>startSolo());
  $('#btn-menu').addEventListener('click',()=>leaveMatch());
  $('#btn-connect').addEventListener('click',()=>{audioInit();S.name=sanitizeName(on.value);on.value=nm.value=S.name;saveSettings();lobbyConnect();});
  $('#btn-q-solo').addEventListener('click',()=>{closeAll();startSolo();});
  $('#btn-q-leave').addEventListener('click',()=>{lobbyQuit();closeAll();});
  $('#qb-join').addEventListener('click',()=>acceptOffer());
  $('#qb-skip').addEventListener('click',()=>lobbyQuit());
  $('#btn-invite').addEventListener('click',()=>{sfx('ui');invite();});$('#btn-invite2').addEventListener('click',()=>invite());
  $('#lb-tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;lbTab=b.dataset.v;renderLeaderboard();sfx('ui');});
  const chat=$('#chat');SH.QUICK_CHAT.forEach((t,i)=>{const b=document.createElement('button');b.innerHTML=`<b>${i+1}</b>`;b.appendChild(document.createTextNode(t));
    b.addEventListener('pointerdown',e=>{e.preventDefault();say(i);});chat.appendChild(b);});
  addEventListener('pointerdown',()=>audioInit(),{once:true});
  setupTouch();if(COARSE)enableTouch();
}

/* ============ Flow ============ */
function clearAgents(){for(const a of agents)if(a.mesh)scene.remove(a.mesh);agents.length=0;local=null;me=null;net.remotes.clear();}
function setIngame(on){document.body.classList.toggle('ingame',on);document.body.classList.toggle('playing',on&&!paused);}
function startAttract(){clearAgents();state='attract';paused=false;VM_VISIBLE=false;AU.mode='menu';setIngame(false);$('#clickNote').classList.add('hidden');startLocal('attract');}
function toMenu(){if(isLocked()){net.noPause=true;document.exitPointerLock();}closeAll();showBoard(false);toggleChat(false);net.resOpen=false;
  $('#hud').classList.add('hidden');$('#menu').classList.remove('hidden');$('#cmsg').textContent='';startAttract();ui.dead=0;ui.flash=0;updateQueueUI();pollStatus();}
function startSolo(){audioInit();closeAll();$('#menu').classList.add('hidden');startLocal('solo');}
function leaveMatch(){if(net.kind==='ws'){lobbySend({t:'leave'});lobbyQuit();}toMenu();}
function pauseGame(){if(!inMatch()||paused)return;paused=true;input.keys={};input.fire=false;touch.fire=false;showBoard(false);toggleChat(false);closeAll();openOverlay('pause');setIngame(true);
  const ws=net.kind==='ws';$('#pause-lead').textContent=ws?'連線對戰不會暫停，你的角色仍在場上。':'單人練習會在選單開啟時暫停。';$('#btn-quit').textContent=ws?'離開連線對戰':'離開練習';
  if(isLocked()){net.noPause=true;document.exitPointerLock();}}
function resumeGame(fromLock){if(!paused)return;if(!fromLock&&!unlocked&&!touch.on){lockPointer();return;}paused=false;closeAll();setIngame(true);}

/* ============ Sessions: local core (solo / menu backdrop) or WebSocket (online) ============ */
const lobby={ws:null,where:'none',id:0,q:null,offerT:0};
const net={kind:null,core:null,conn:null,inbox:[],vclock:0,coreAcc:0,id:0,m:{s:'waiting',t:0,limit:20,mode:'ffa',id:0},remotes:new Map(),names:new Map(),
  pending:[],out:[],seq:0,acc:0,prev:new V3(),rpos:new V3(),corr:new V3(),off:null,rtt:0,noPause:false,resOpen:false,lastS:'',pk:SH.PICKUPS.map(()=>1),zone:[0,0]};
let me=null;
const _old=new V3();
function netSend(o){if(net.kind==='ws')lobbySend(o);else if(net.core&&net.conn)net.core.message(net.conn,JSON.stringify(o));}
function lobbySend(o){if(lobby.ws&&lobby.ws.readyState===1)lobby.ws.send(JSON.stringify(o));}
let soloRuns=0;
function startLocal(kind){
  net.core=null;net.conn=null;net.vclock=0;net.coreAcc=0;
  const now=()=>net.vclock;
  const opts=kind==='attract'?{attract:true,fillTo:6,idleTimeout:Infinity,queue:false,now}
    :{maxPlayers:1+S.bots,fillTo:1+S.bots,diff:S.diff,time:S.time*60,scores:{ffa:S.scoreLimit,koth:S.kothLimit},modes:[S.mode],queue:false,idleTimeout:Infinity,oneShot:true,countdown:3.5,now,
      arenas:[SH.ARENA_ORDER[soloRuns++%SH.ARENA_ORDER.length]]};  // solo is a single match, so rotate the arena per practice run
  const core=new GameCore(opts),inbox=[];
  net.core=core;net.inbox=inbox;net.kind=kind==='attract'?'attract':'local';
  net.conn=core.connect({send:s=>inbox.push(s),close(){}},kind==='attract');
  if(kind==='solo')core.message(net.conn,JSON.stringify({t:'hello',ver:SH.VERSION,name:sanitizeName(S.name)}));
  flushLocal();
}
function flushLocal(){const box=net.inbox;while(box.length){let m;try{m=JSON.parse(box.shift());}catch(e){continue;}onGameMsg(m);}}
function tickLocal(dt){if(!net.core)return;net.vclock+=dt;net.coreAcc+=dt;let n=0;while(net.coreAcc>=.05&&n<4){net.coreAcc-=.05;n++;net.core.tick();}if(n>=4)net.coreAcc=0;flushLocal();}
function onGameMsg(m){
  switch(m.t){
    case 'enter':beginMatch(m);break;
    case 'spec':beginSpectate(m);break;
    case 's':if(state==='online'||state==='attract')onSnapshot(m);break;
    case 'pi':netSend({t:'po',c:m.c});break;
  }
}
/* --- online lobby (WebSocket) --- */
function netStatus(msg,err){const el=$('#on-status');el.textContent=msg;el.style.color=err?'var(--amber)':'';if(err&&$('#online').classList.contains('hidden'))showNotice(msg);}
let noticeT=0;function showNotice(msg){const n=$('#notice');n.textContent=msg;n.classList.remove('hidden');clearTimeout(noticeT);noticeT=setTimeout(()=>n.classList.add('hidden'),4500);}
function lobbyConnect(){
  if(lobby.ws&&lobby.ws.readyState<2){netStatus('已在連線中…');return;}
  if(!location.host){netStatus('這個頁面沒有連線伺服器。請從部署到 Cloudflare 的網址開啟。',true);return;}
  let ws;try{ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`);}catch(e){netStatus('無法建立連線。請從部署到 Cloudflare 的網址開啟。',true);return;}
  lobby.ws=ws;lobby.where='connecting';netStatus('連線中…');
  const to=setTimeout(()=>{if(ws.readyState!==1){try{ws.close();}catch(e){}netStatus('無法連線到伺服器。請確認網址正確，或稍後再試。',true);}},8000);
  ws.onopen=()=>{clearTimeout(to);netStatus('已連線，正在安排位置…');ws.send(JSON.stringify({t:'hello',ver:SH.VERSION,name:sanitizeName(S.name)}));};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch(err){return;}onLobbyMsg(m);};
  ws.onclose=()=>{clearTimeout(to);if(lobby.ws!==ws)return;const was=lobby.where;lobby.ws=null;lobby.where='none';hideBanner();
    if(net.kind==='ws'){toMenu();showNotice('與伺服器的連線中斷。');}
    else if(was==='queue'||was==='pending'){$('#queue').classList.add('hidden');showNotice('排隊連線已中斷。');}
    else if(was==='connecting')netStatus('無法連線到伺服器。若剛部署完成，請稍候再試；也可能是今天的免費額度已用完。',true);};
}
function lobbyQuit(){if(lobby.where==='queue'||lobby.where==='pending')lobbySend({t:'decline'});const ws=lobby.ws;lobby.where='none';lobby.ws=null;hideBanner();if(ws)setTimeout(()=>{try{ws.close(1000);}catch(e){}},80);}
function acceptOffer(){if(lobby.where!=='pending')return;lobbySend({t:'accept'});showBanner('正在加入連線對戰…',false);}
function showBanner(text,offer){$('#qb-text').textContent=text;$('#qb-join').classList.toggle('hidden',!offer);$('#qb-skip').classList.toggle('hidden',!offer);
  $('#qbanner').classList.toggle('offer',!!offer);$('#qbanner').classList.remove('hidden');}
function hideBanner(){$('#qbanner').classList.add('hidden');}
function updateQueueUI(){
  if(lobby.where==='pending'||net.kind==='ws')return;
  if(lobby.where!=='queue'||!lobby.q){hideBanner();return;}
  const q=lobby.q;$('#q-pos').textContent=q.pos;$('#q-total').textContent=`／ ${q.total} 人排隊`;
  $('#q-info').textContent=`場上 ${q.arena}/${q.max} 人，${STATE_TXT[q.m.s]||''}${q.m.s==='playing'?'，剩 '+fmtTime(q.m.t):''}。`;
  if($('#queue').classList.contains('hidden'))showBanner(`連線排隊中：第 ${q.pos} 位，共 ${q.total} 人`,false);else hideBanner();
}
function onLobbyMsg(m){
  switch(m.t){
    case 'welcome':lobby.id=m.id;break;
    case 'err':{const t={version:'遊戲版本和伺服器不同，請重新整理頁面。',queuefull:'排隊人數已滿，請稍後再試。'}[m.code]||'伺服器拒絕了連線。';netStatus(t,true);break;}
    case 'q':{const first=lobby.where!=='queue';lobby.where='queue';lobby.q=m;if(first&&!inMatch()){closeAll();openOverlay('queue');}updateQueueUI();break;}
    case 'offer':lobby.where='pending';lobby.offerT=performance.now()/1000+m.sec;if(!$('#queue').classList.contains('hidden'))closeAll();sfx('go');showBanner('',true);break;
    case 'missed':lobby.where='queue';showNotice('你錯過了加入時間，已重新排到隊尾。');updateQueueUI();break;
    case 'left':lobby.where='idle';break;
    case 'enter':lobby.where='arena';net.kind='ws';net.core=null;net.conn=null;beginMatch(m);break;
    case 'rotated':lobby.where='queue';if(net.kind==='ws')toMenu();$('#q-lead').textContent='本場結束，換排隊的玩家上場，你已排回隊伍。可以先玩單人練習。';closeAll();openOverlay('queue');break;
    case 'pi':lobbySend({t:'po',c:m.c});break;
    case 's':if(net.kind==='ws'&&state==='online')onSnapshot(m);break;
  }
}
function lobbyFrame(){if(lobby.where==='pending'){const left=Math.max(0,Math.ceil(lobby.offerT-performance.now()/1000));$('#qb-text').textContent=`輪到你了！${left} 秒內按「加入」${touch.on?'':'或 Enter'}進入連線對戰`;}}

/* --- match presentation (shared by solo and online) --- */
function applyRoster(list){
  const ids=new Set();
  for(const r of list){net.names.set(r.id,r);ids.add(r.id);if(r.id===net.id){if(me){me.color=r.color;me.name=r.name;}continue;}
    if(!net.remotes.has(r.id)){const a=makeAgent(r.name,r.color,!!r.bot);a.id=r.id;a.remote=true;a.buf=[];a.alive=false;buildAgentMesh(a);a.mesh.visible=false;net.remotes.set(r.id,a);}}
  for(const [id,a] of net.remotes)if(!ids.has(id)){if(a.mesh)scene.remove(a.mesh);net.remotes.delete(id);}
  agents.length=0;if(me)agents.push(me);for(const a of net.remotes.values())agents.push(a);
}
function resetNetState(m){net.pending=[];net.out=[];net.seq=0;net.acc=0;net.off=null;net.corr.set(0,0,0);net.m=m.m;net.resOpen=false;net.lastS=m.m.s;net.pk=SH.PICKUPS.map(()=>1);net.zone=[0,0];cdShown=-1;}
function beginSpectate(m){clearAgents();net.id=0;resetNetState(m);applyRoster(m.roster);}
function beginMatch(m){
  if(isLocked())net.noPause=true;
  clearAgents();closeAll();showBoard(false);toggleChat(false);if(net.kind==='ws')hideBanner();
  $('#menu').classList.add('hidden');$('#hud').classList.remove('hidden');$('#feed').textContent='';$('#cmsg').textContent='';
  net.id=m.id;const mine=m.roster.find(r=>r.id===m.id)||{color:CYAN,name:S.name};
  me=makeAgent(mine.name,mine.color,false);me.id=m.id;local=me;
  me.pos.set(m.you.pos.x,m.you.pos.y,m.you.pos.z);me.yaw=m.you.yaw;me.alive=m.you.alive;
  resetNetState(m);net.prev.copy(me.pos);net.rpos.copy(me.pos);applyRoster(m.roster);
  state='online';paused=false;ui.prev={};ui.dead=0;ui.flash=0;ui.killer=null;VM_VISIBLE=true;VM.lastAmmo=-1;AU.mode='match';dyn.pr=0;
  setIngame(true);setText('you-name',me.name);
  sysFeed(net.kind==='ws'?'已加入連線對戰':`單人練習：${modeName()}・${arenaName()}`);goFull();
  if(!touch.on&&!unlocked){lockPointer();setTimeout(()=>{if(inMatch()&&!isLocked()&&!unlocked&&!paused&&!net.resOpen)$('#clickNote').classList.remove('hidden');},700);}
}
function makeInput(){
  let f=0,s=0,b=0;
  if(!paused&&!net.resOpen){const k=input.keys;f=(k.KeyW||k.ArrowUp?1:0)-(k.KeyS||k.ArrowDown?1:0)+touch.mz;s=(k.KeyD?1:0)-(k.KeyA?1:0)+touch.mx;
    if(input.fire||touch.fire||touch.auto)b|=SH.BITS.FIRE;if(k.Space||touch.jump)b|=SH.BITS.JUMP;}
  if(ctl.reload){b|=SH.BITS.RELOAD;ctl.reload=false;}
  if(ctl.sw>=0)b|=[SH.BITS.SW0,SH.BITS.SW1,SH.BITS.SW2][ctl.sw];ctl.sw=-1;
  return SH.sanitizeInput({s:++net.seq,mx:Math.round(s*100)/100,mz:Math.round(f*100)/100,y:SH.r4(me.yaw),p:SH.r4(me.pitch),b});
}
function shotFX(shooter,w,mz,ends,mine){
  for(const q of ends){_hit.set(q.x,q.y,q.z);
    if(w.pellets)arcBolt(mz,_hit,w.color);
    else if(w.id==='rail'){beam(mz,_hit,AMB,.035,.32);beam(mz,_hit,0xffffff,.012,.32);}
    else{beam(mz,_hit,mine?CYAN:shooter.color,.016);beam(mz,_hit,0xffffff,.005);}
    if(q.hit){const t=agentById(q.hit);spark(_hit,mine?3:(w.pellets?4:7),mine?0xffffff:(t?t.color:0xffffff),4,.35);}
    else if(q.n){spark(_hit,w.pellets?3:6,w.color,3.5,.4);decal(_hit,q.n,w.color);}}
}
function predictedShotFX(a){
  const w=WEAPONS[a.wi];eyePos(a,_o);muzzleWorld(a,_mz);const ps=[...net.remotes.values()],ends=[];
  for(const d of SH.shotDirs(a)){const r=SH.traceShot(colliders,ps,a,_o,d,w.range);ends.push({x:_o.x+d.x*r.t,y:_o.y+d.y*r.t,z:_o.z+d.z*r.t,hit:r.hit?r.hit.id:0,n:r.n});}
  shotFX(a,w,_mz,ends,true);
  VM.kick=Math.min(1.4,VM.kick+(w.pellets?1.3:w.id==='rail'?1.4:.55));VM.flashT=.05;VM.light.color.set(w.color);VM.light.intensity=4;
  FX.muzzleLight.color.set(w.color);FX.muzzleLight.position.copy(_mz);FX.muzzleLight.intensity=3;addShake(w.pellets?.5:w.id==='rail'?.6:.12);
  a.pitch=Math.min(1.5,a.pitch+(w.pellets?.03:w.id==='rail'?.05:.006));sfx(w.id);
}
/** Touch aim assist: slow the turn over a target, pull gently while the player is acting, optional auto-fire. */
function touchAssist(a,dt){
  touch.auto=false;if(!touch.on||!a.alive||paused)return;
  const w=WEAPONS[a.wi];eyePos(a,_o);aimDir(a.yaw,a.pitch,_f);let best=null;
  for(const r of net.remotes.values()){if(!r.alive)continue;_tv.set(r.pos.x-_o.x,r.pos.y+1.1-_o.y,r.pos.z-_o.z);const d=_tv.length();if(d>w.range||d<.6)continue;
    const ang=Math.acos(clamp(_tv.dot(_f)/d,-1,1));if(ang>Math.max(.09,1.3/d)||(best&&ang>=best.ang))continue;
    _tc.copy(_o).add(_tv);if(!los(_o,_tc))continue;best={r,d,ang};}
  if(!best)return;
  if(S.assist){input.tdx*=.55;input.tdy*=.55;
    if(input.tdx||input.tdy||touch.mx||touch.mz||touch.fire){const r=best.r,dx=r.pos.x-_o.x,dz=r.pos.z-_o.z,dy=r.pos.y+1.1-_o.y;
      const k=Math.min(1,dt*2.4);a.yaw+=angWrap(Math.atan2(-dx,-dz)-a.yaw)*k*.6;a.pitch+=(Math.atan2(dy,Math.hypot(dx,dz))-a.pitch)*k*.45;}}
  if(S.autofire&&best.ang<Math.atan2(.36,best.d))touch.auto=true;
}
function stepRemotes(dt){
  const rt=performance.now()/1000-(net.off||0)-.1;
  for(const r of net.remotes.values()){
    r.hitT-=dt;const B=r.buf;if(!B.length)continue;
    let A=B[0],C=B[B.length-1];
    if(rt<=A.t){C=A;}else if(rt>=C.t){A=C;}else{for(let i=0;i<B.length-1;i++)if(B[i].t<=rt&&B[i+1].t>=rt){A=B[i];C=B[i+1];break;}}
    const k=C.t>A.t?(rt-A.t)/(C.t-A.t):1;
    r.pos.set(lerp(A.x,C.x,k),lerp(A.y,C.y,k),lerp(A.z,C.z,k));r.yaw=A.yaw+angWrap(C.yaw-A.yaw)*k;r.pitch=lerp(A.pitch,C.pitch,k);
    if(state==='online'&&r.alive&&r.onGround){const sp=Math.hypot(r.vel.x,r.vel.z);if(sp>2){r.stepT-=dt*sp/6;if(r.stepT<=0){r.stepT=.38;sfx('step',r.pos);}}}
    if(r.spawnFx){r.spawnFx=false;_tc.set(r.pos.x,r.pos.y+1,r.pos.z);spark(_tc,18,r.color,3,.6);}
  }
}
function stepMatch(dt){
  const a=me;if(!a)return;
  touchAssist(a,dt);
  const ls=.0022*S.sens,iv=S.invertY?-1:1;a.yaw-=input.mdx*ls+input.tdx;a.pitch=clamp(a.pitch-(input.mdy*ls+input.tdy)*iv,-1.52,1.52);
  input.lmdx=input.mdx+input.tdx/ls;input.lmdy=input.mdy+input.tdy/ls;input.mdx=input.mdy=input.tdx=input.tdy=0;
  net.acc+=dt;let n=0;const live=net.m.s!=='results';
  while(net.acc>=SH.TICK&&n<8){net.acc-=SH.TICK;n++;net.prev.copy(a.pos);
    const y=a.yaw,inp=makeInput();const fired=SH.stepPlayer(a,inp,SH.TICK,colliders,SH.canFire(net.m.s));a.yaw=y;
    if(fired)predictedShotFX(a);
    if(a.landed){a.landed=false;sfx('land');VM.land=.6;}
    if(a.alive&&a.onGround){const sp=Math.hypot(a.vel.x,a.vel.z);if(sp>2){a.stepT-=SH.TICK*sp/6;if(a.stepT<=0){a.stepT=.38;sfx('step');}}}
    net.pending.push(inp);if(net.pending.length>240)net.pending.shift();
    net.out.push(inp);if(net.out.length>=SH.SEND_EVERY){netSend({t:'in',i:net.out});net.out=[];}}
  if(n>=8)net.acc=0;
  net.corr.multiplyScalar(Math.exp(-dt*12));
  net.rpos.copy(net.prev).lerp(a.pos,clamp(net.acc/SH.TICK,0,1)).add(net.corr);
  stepRemotes(dt);
}
const IX=SH.IDX;
function reconcile(row){
  const a=me,wasAlive=a.alive;_old.copy(a.pos);
  a.pos.set(row[IX.x],row[IX.y],row[IX.z]);a.vel.set(row[IX.vx],row[IX.vy],row[IX.vz]);a.onGround=!!(row[IX.flags]&1);a.alive=!!(row[IX.flags]&2);
  a.shield=row[IX.shield];a.wi=row[IX.wi];a.protect=row[IX.protect];a.respawnT=row[IX.respawnT];a.score=row[IX.score];a.deaths=row[IX.deaths];a.rtt=net.rtt=row[IX.rtt];
  a.cd=row[IX.cd];a.switchT=row[IX.switchT];for(let k=0;k<3;k++){a.ws[k].ammo=row[IX.ammo0+k*2];a.ws[k].reload=row[IX.ammo0+k*2+1];}
  a.airT=row[IX.airT];a.boostT=row[IX.boostT];a.kills=row[IX.kills];
  const ack=row[IX.ack];net.pending=net.pending.filter(i=>i.s>ack);
  const y=a.yaw,p=a.pitch,live=net.m.s!=='results';
  for(const i of net.pending)SH.stepPlayer(a,i,SH.TICK,colliders,SH.canFire(net.m.s));
  a.yaw=y;a.pitch=p;a.landed=false;
  if(!wasAlive&&a.alive){a.yaw=row[IX.yaw];a.pitch=0;net.corr.set(0,0,0);net.prev.copy(a.pos);sfx('spawn');VM.lastAmmo=-1;ui.killer=null;return;}
  _old.sub(a.pos);net.prev.sub(_old);net.corr.add(_old);if(net.corr.length()>2.5)net.corr.set(0,0,0);
}
function agentById(id){return id&&id===net.id?me:net.remotes.get(id);}
function onEvent(e){
  const quiet=state!=='online';
  switch(e.k){
    case 'ros':applyRoster(e.l);break;
    case 'join':if(!quiet&&e.id!==net.id){const r=net.names.get(e.id);if(r)sysFeed(r.name+(r.bot?'（機器人）':'')+' 加入');}break;
    case 'part':if(!quiet){const r=net.names.get(e.id);if(r)sysFeed(r.name+' 離開');}break;
    case 'sp':{const a=net.remotes.get(e.id);if(a){a.buf=[];a.spawnFx=true;}break;}
    case 'sh':{if(e.a===net.id)break;const a=net.remotes.get(e.a);if(!a)break;const w=WEAPONS[e.w]||WEAPONS[0];if(a.mesh&&a.mesh.userData.anim)a.mesh.userData.anim.oneShot('Fire');muzzleWorld(a,_mz);flash(_mz,w.color,w.pellets?.9:w.id==='rail'?1:.55);
      shotFX(a,w,_mz,e.e.map(q=>({x:q[0],y:q[1],z:q[2],hit:q[3],n:q.length>4?{x:q[4],y:q[5],z:q[6]}:null})),false);if(!quiet)sfx(w.id,_mz);break;}
    case 'hit':{const a=agentById(e.a),v=agentById(e.v);
      if(e.a===net.id&&e.d>0){hitMarker(!!e.kill);sfx(e.kill?'kill':'hit');}
      if(e.v===net.id&&e.d>0){if(a)dmgIndicator(a.pos);ui.flash=Math.min(1,ui.flash+.55);addShake(.35);sfx('hurt');}
      if(v&&v!==me)v.hitT=e.d>0?.3:.12;break;}
    case 'kill':{const a=agentById(e.a),v=agentById(e.v),w=WEAPONS[e.w]||WEAPONS[0];
      if(!quiet)killFeed(a||{name:'?',color:0xffffff},v||{name:'?',color:0xffffff},w);
      if(!quiet&&a&&e.s>=3)sysFeed(`${a.name} 連續淘汰 ${e.s} 人`);
      if(v){const p=v===me?net.rpos:v.pos;shardBurst(p,v.color);_tc.set(p.x,p.y+1,p.z);spark(_tc,26,v.color,6,.7);if(!quiet)sfx('elim',v===me?null:_tc);if(v!==me){v.alive=false;if(v.mesh)v.mesh.visible=false;}}
      if(v===me){ui.killer=a&&a!==me?a:null;$('#killer').textContent=a?a.name:'系統';}break;}
    case 'pk':if(!quiet&&e.on===0&&e.a===net.id){sfx('pickup');const t=SH.PICKUPS[e.i].type;sysFeed(t==='shield'?'護盾 +50':'加速 6 秒');}break;
    case 'say':if(!quiet){const a=agentById(e.a);feedLine(el=>{el.appendChild(nameSpan(a));el.appendChild(document.createTextNode('：'+SH.QUICK_CHAT[e.i]));},'say',6000);sfx('say');}break;
    case 'm':net.m=e.m;break;
    case 'res':showResults(e);break;
  }
}
function onSnapshot(m){
  const now=performance.now()/1000,st=m.tk*.05,sample=now-st;
  if(net.off===null||sample<net.off)net.off=sample;else net.off+=(sample-net.off)*.02;
  net.m=m.m;if(m.pk)net.pk=m.pk;if(m.z)net.zone=m.z;
  for(const e of m.ev)onEvent(e);
  for(const row of m.pl){const id=row[IX.id];if(me&&id===net.id){reconcile(row);continue;}
    const a=net.remotes.get(id);if(!a)continue;const al=!!(row[IX.flags]&2);
    if(al&&!a.alive)a.buf=[];
    a.buf.push({t:st,x:row[IX.x],y:row[IX.y],z:row[IX.z],yaw:row[IX.yaw],pitch:row[IX.pitch]});if(a.buf.length>12)a.buf.shift();
    a.vel.set(row[IX.vx],row[IX.vy],row[IX.vz]);a.onGround=!!(row[IX.flags]&1);a.alive=al;a.bot=!!(row[IX.flags]&4);a.shield=row[IX.shield];a.wi=row[IX.wi];a.protect=row[IX.protect];
    a.score=row[IX.score];a.deaths=row[IX.deaths];a.rtt=row[IX.rtt];a.kills=row[IX.kills];
    const rl=al&&row[IX.ammo0+a.wi*2+1]>0;if(rl&&!a.reloading&&a.mesh&&a.mesh.userData.anim)a.mesh.userData.anim.oneShot('Reload');a.reloading=rl;  // agent.glb reload clip
    if(a.buf.length===1)a.pos.set(row[IX.x],row[IX.y],row[IX.z]);}
  if(state!=='online')return;
  const s=m.m.s,el=$('#cmsg');
  if(s==='countdown'){const n=Math.ceil(m.m.t);if(n!==cdShown){cdShown=n;if(n<=5&&n>0){el.className='';el.textContent=n;sfx('beep');}}}
  else if(s==='playing'&&net.lastS==='countdown'){el.className='word';el.textContent=modeName();sfx('go');setTimeout(()=>{if(el.textContent===modeName())el.textContent='';},1100);}
  else if(s!=='playing'&&s!=='countdown'&&el.textContent)el.textContent='';
  if(s==='playing'&&net.lastS!=='playing')$('#feed').textContent='';
  if(s!=='results'&&net.resOpen){net.resOpen=false;closeAll();if(!touch.on&&!isLocked()&&!unlocked)$('#clickNote').classList.remove('hidden');}
  net.lastS=s;
}
function showResults(e){
  const body=$('#res-body');body.textContent='';let rank=0,prev=null;
  e.rank.forEach((r,i)=>{if(!prev||r.score!==prev.score||r.deaths!==prev.deaths)rank=i+1;prev=r;const tr=document.createElement('tr');if(r.id===net.id)tr.className='me';
    for(const v of [rank,r.name+(r.id===net.id?'（你）':r.bot?'（機器人）':''),r.score,r.kills,r.deaths]){const td=document.createElement('td');td.textContent=v;tr.appendChild(td);}body.appendChild(tr);});
  const R=e.rank,top=(f,ok=()=>true)=>R.filter(ok).reduce((b,r)=>!b||f(r)>f(b)?r:b,null),H=[];
  const k=top(r=>r.kills);if(k&&k.kills>0)H.push(['最多淘汰',k.name,k.kills+' 次']);
  const ac=top(r=>r.hits/r.shots,r=>r.shots>=10);if(ac)H.push(['命中率最高',ac.name,Math.round(ac.hits/ac.shots*100)+'%']);
  const st=top(r=>r.best);if(st&&st.best>=2)H.push(['最長連續淘汰',st.name,st.best+' 人']);
  if(e.mode==='koth'){const h=top(r=>r.hold);if(h&&h.hold>0)H.push(['佔領最久',h.name,h.hold+' 秒']);}
  const hl=$('#res-hl');hl.textContent='';for(const [t,n,v] of H){const d=document.createElement('div');const s1=document.createElement('small');s1.textContent=t;const b=document.createElement('b');b.textContent=n;const s2=document.createElement('span');s2.textContent=v;d.append(s1,b,s2);hl.appendChild(d);}
  const winners=R.filter(r=>R[0]&&r.score===R[0].score&&r.deaths===R[0].deaths);
  $('#res-title').textContent=!winners.length?'結算':winners.length>1?'並列第一':(winners[0].id===net.id?'你獲勝':winners[0].name+' 獲勝');
  const why={time:'時間到',score:'已達分數上限',players:'場上人數不足'}[e.reason]||'';const mode=(SH.MODES[e.mode]||SH.MODES.ffa).name;
  const ws=net.kind==='ws';
  $('#res-sub').textContent=ws?`連線第 ${e.matchId} 場（${mode}）結束，${why}。下一場會自動開始，有人排隊時排隊的玩家先上場。`:`${mode}結束，${why}。`;
  $('#btn-again').classList.toggle('hidden',ws);$('#btn-menu').textContent=ws?'離開連線對戰':'返回主選單';
  showBoard(false);toggleChat(false);paused=false;closeAll();openOverlay('results');net.resOpen=true;sfx('end');
  if(isLocked()){net.noPause=true;document.exitPointerLock();}
}

/* ============ Main loop ============ */
const dyn={pr:0,t:0};
function setPR(pr){renderer.setPixelRatio(pr);renderer.setSize(innerWidth,innerHeight);if(composer){composer.setPixelRatio(pr);composer.setSize(innerWidth,innerHeight);if(fxaaPass)fxaaPass.material.uniforms.resolution.value.set(1/(innerWidth*pr),1/(innerHeight*pr));}}
/** Phones: lower the render resolution when frame rate drops, raise it again when there is headroom. */
function adaptRes(dt){if(!touch.on||!inMatch())return;dyn.t+=dt;if(dyn.t<2)return;dyn.t=0;const q=QUALITY[S.quality]||QUALITY.low;if(!dyn.pr)dyn.pr=renderer.getPixelRatio();
  if(ui.fps<40&&dyn.pr>.5){dyn.pr=Math.max(.5,dyn.pr-.1);setPR(dyn.pr);}else if(ui.fps>57&&dyn.pr<q.pr){dyn.pr=Math.min(q.pr,dyn.pr+.05);setPR(dyn.pr);}}
let last=performance.now(),statusT=0;
function step(dt){
  gameTime+=dt;lobbyFrame();syncArena();
  if(net.kind==='attract'||(net.kind==='local'&&!paused))tickLocal(dt);
  if(state==='online'){if(net.kind==='local'&&paused){input.mdx=input.mdy=input.tdx=input.tdy=0;}else stepMatch(dt);}
  else if(state==='attract')stepRemotes(dt);
  for(const a of agents)updateMesh(a,dt);
  for(const o of animated)o.update(gameTime,dt);
  updatePickupsFX(gameTime);
  updateFX(dt);ui.flash=Math.max(0,ui.flash-dt*2.2);
  updateCamera(dt);camera.updateMatrixWorld();
  if(inMatch()){updateViewmodel(dt);updateHUD(dt);}
  statusT-=dt;if(state==='attract'&&statusT<=0&&!$('#menu').classList.contains('hidden')){statusT=15;pollStatus();}
}
function frame(now){requestAnimationFrame(frame);let dt=(now-last)/1000;last=now;if(dt>.1)dt=.1;if(dt<=0)return;
  ui.fpsAcc+=dt;ui.fpsN++;ui.fpsT-=dt;if(ui.fpsAcc>.5){ui.fps=ui.fpsN/ui.fpsAcc;ui.fpsAcc=0;ui.fpsN=0;}
  step(dt);adaptRes(dt);render();}
addEventListener('resize',applyQuality);

/* ============ Boot ============ */
async function boot(){
  const bar=$('#bootbar');const tick=p=>{bar.style.width=p+'%';return new Promise(r=>setTimeout(r,16));};
  try{await Promise.race([Promise.all([document.fonts.load('700 64px "Chakra Petch"'),document.fonts.load('900 64px "Noto Sans TC"'),document.fonts.load('700 30px "Noto Sans TC"')]),new Promise(r=>setTimeout(r,2500))]);}catch(e){}
  await tick(5);MDL=await loadModels(p=>{bar.style.width=(5+p*10)+'%';});
  await tick(15);buildWorld();await tick(55);buildSteam();buildFX();buildViewmodel();buildPickupsFX();await tick(75);
  buildComposer();applyQuality();bindUI();await tick(90);
  startAttract();
  {const pool=[...FX.beams.map(x=>x.m),...FX.arcs.map(x=>x.l),...FX.flashes.map(x=>x.s),...FX.decals.map(x=>x.m),VM.flash];pool.forEach(o=>o.visible=true);PK.zone.g.visible=true;
   const tmp=makeAgent('warm',0xffffff,true);buildAgentMesh(tmp);renderer.compile(scene,camera);renderer.compile(vmScene,vmCam);scene.remove(tmp.mesh);pool.forEach(o=>o.visible=false);PK.zone.g.visible=false;}
  await tick(100);
  requestAnimationFrame(frame);$('#menu').classList.remove('hidden');setTimeout(()=>$('#boot').classList.add('done'),150);setTimeout(()=>$('#boot').remove(),1200);
  pollStatus();setTimeout(pollStatus,2000);
  window.__NG={get agents(){return agents;},get state(){return state;},net,lobby,input,touch,scene,startSolo,pollStatus,tick(n,dt=1/60){for(let i=0;i<n;i++)step(dt);render();}};
}
boot();
})();
