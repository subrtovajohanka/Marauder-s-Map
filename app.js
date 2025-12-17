const stage = document.getElementById('stage');
const veil  = document.getElementById('veil');
const toast = document.getElementById('toast');
const phraseInput = document.getElementById('phrase');
const btn = document.getElementById('btn');
const btnOff = document.getElementById('btnOff');

const inkCanvas = document.getElementById('ink');
const fogCanvas = document.getElementById('fog');
const ictx = inkCanvas.getContext('2d');
const fctx = fogCanvas.getContext('2d');

function norm(s){
  return (s || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g," ");
}
const OATH_ON  = norm("jsem pripraven ke kazde spatnosti");
const OATH_OFF = norm("neplechu ukoncit");

function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>toast.classList.remove('show'), 2200);
}

function rand(a,b){ return a + Math.random()*(b-a); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// --- Retina canvas sizing ---
function fitCanvas(c){
  const r = stage.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2.2, window.devicePixelRatio || 1));
  c.width  = Math.floor(r.width * dpr);
  c.height = Math.floor(r.height * dpr);
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return { w: r.width, h: r.height };
}

let W=0,H=0;
let points=[], edges=[], people=[];
let revealed=false;

// “místnosti / popisky”
const labels = [
  "Zakázané schodiště","Knihovna","Velká síň","Dvořiště","Skrytá chodba",
  "Tichý kout","Věžní schody","Zapomenuté dveře","Nádvoří","Společenská místnost",
  "Starý kabinet","Průchod za obrazem","Kamenná galerie","Slepá ulička","Tajná komora?"
];

// “postavy”
const peopleNames = [
  "Toulavý student","Zvěd","Škodič","Noční hlídka",
  "Knihomol","Tichý běžec","Někdo podezřelý","Ztracený prefekt",
  "Šeptal","Rychlonožka"
];

function seedGraph(){
  points = [];
  edges = [];

  const margin = 54;
  const n = 52;

  for(let i=0;i<n;i++){
    points.push({ x: rand(margin, W-margin), y: rand(margin, H-margin) });
  }

  // Connect each point to nearest neighbors (corridor vibe)
  for(let i=0;i<points.length;i++){
    const A = points[i];
    const dists = points.map((p,idx)=>({idx, d: Math.hypot(p.x-A.x, p.y-A.y)}))
      .filter(o=>o.idx!==i)
      .sort((x,y)=>x.d-y.d)
      .slice(0, 3 + Math.floor(Math.random()*2));

    for(const o of dists){
      const j = o.idx;
      const key = i<j ? `${i}-${j}` : `${j}-${i}`;
      if(edges.some(e=>e.key===key)) continue;
      const B = points[j];
      if(o.d < 110 || o.d > 340) continue;

      edges.push({
        key, a:i, b:j,
        cx: (A.x+B.x)/2 + rand(-26,26),
        cy: (A.y+B.y)/2 + rand(-26,26),
        w: rand(1.0, 1.5)
      });
    }
  }
}

function drawInkBase(){
  ictx.clearRect(0,0,W,H);

  // vignette stain
  const vg = ictx.createRadialGradient(W*0.5,H*0.45, 50, W*0.5,H*0.45, Math.max(W,H)*0.8);
  vg.addColorStop(0, "rgba(43,26,18,0.00)");
  vg.addColorStop(1, "rgba(43,26,18,0.08)");
  ictx.fillStyle = vg;
  ictx.fillRect(0,0,W,H);

  // corridors (hand-drawn-ish)
  for(const e of edges){
    const A = points[e.a], B = points[e.b];
    ictx.lineWidth = e.w;
    ictx.strokeStyle = "rgba(43,26,18,0.52)";
    ictx.beginPath();
    ictx.moveTo(A.x + rand(-.6,.6), A.y + rand(-.6,.6));
    ictx.quadraticCurveTo(e.cx, e.cy, B.x + rand(-.6,.6), B.y + rand(-.6,.6));
    ictx.stroke();
  }

  // nodes
  ictx.fillStyle = "rgba(43,26,18,0.72)";
  for(const p of points){
    ictx.beginPath();
    ictx.arc(p.x, p.y, rand(1.2, 2.8), 0, Math.PI*2);
    ictx.fill();
  }

  // labels
  ictx.font = "12px ui-serif, Georgia, Times, serif";
  ictx.fillStyle = "rgba(43,26,18,0.72)";
  for(let i=0;i<labels.length;i++){
    const p = points[(i*3) % points.length];
    ictx.save();
    ictx.translate(p.x, p.y);
    ictx.rotate(rand(-0.09, 0.09));
    ictx.fillText(labels[i], 10, -10);
    ictx.restore();
  }

  // decorative compass-ish mark
  ictx.save();
  ictx.translate(W-90, 90);
  ictx.strokeStyle = "rgba(43,26,18,0.35)";
  ictx.lineWidth = 1.1;
  ictx.beginPath();
  ictx.arc(0,0,28,0,Math.PI*2);
  ictx.stroke();
  ictx.beginPath();
  ictx.moveTo(-34,0); ictx.lineTo(34,0);
  ictx.moveTo(0,-34); ictx.lineTo(0,34);
  ictx.stroke();
  ictx.restore();
}

function resetFog(){
  fctx.clearRect(0,0,W,H);

  // dark layer
  const g = fctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0, "rgba(0,0,0,0.88)");
  g.addColorStop(1, "rgba(0,0,0,0.80)");
  fctx.fillStyle = g;
  fctx.fillRect(0,0,W,H);

  // grime blotches
  for(let i=0;i<80;i++){
    const x = rand(0,W), y = rand(0,H);
    const r = rand(40,180);
    const gg = fctx.createRadialGradient(x,y,0,x,y,r);
    gg.addColorStop(0, "rgba(0,0,0,0.0)");
    gg.addColorStop(1, "rgba(0,0,0,0.22)");
    fctx.fillStyle = gg;
    fctx.beginPath();
    fctx.arc(x,y,r,0,Math.PI*2);
    fctx.fill();
  }

  // subtle scratch lines
  fctx.strokeStyle = "rgba(0,0,0,0.08)";
  fctx.lineWidth = 1;
  for(let i=0;i<40;i++){
    fctx.beginPath();
    fctx.moveTo(rand(-50,W+50), rand(0,H));
    fctx.lineTo(rand(-50,W+50), rand(0,H));
    fctx.stroke();
  }
}

function eraseFog(x,y, strength=1){
  const radius = 95 * strength;
  const g = fctx.createRadialGradient(x,y,0,x,y,radius);
  g.addColorStop(0, "rgba(0,0,0,0.95)");
  g.addColorStop(0.45, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0.0)");

  fctx.globalCompositeOperation = "destination-out";
  fctx.fillStyle = g;
  fctx.beginPath();
  fctx.arc(x,y,radius,0,Math.PI*2);
  fctx.fill();
  fctx.globalCompositeOperation = "source-over";
}

// People movement on corridors
function seedPeople(){
  people = [];
  const m = 8;
  for(let i=0;i<m;i++){
    const e = edges[Math.floor(Math.random()*edges.length)];
    people.push({
      name: pick(peopleNames),
      edge: e,
      t: Math.random(),
      dir: Math.random()<.5 ? 1 : -1,
      speed: rand(0.02, 0.055),
      wobble: rand(0.6, 1.4),
      phase: rand(0, 10)
    });
  }
}
function qPointOnEdge(e, t){
  const A = points[e.a], B = points[e.b];
  const x = (1-t)*(1-t)*A.x + 2*(1-t)*t*e.cx + t*t*B.x;
  const y = (1-t)*(1-t)*A.y + 2*(1-t)*t*e.cy + t*t*B.y;
  return {x,y};
}

function drawPeople(dt, time){
  drawInkBase();

  for(const p of people){
    p.t += p.dir * p.speed * dt;
    if(p.t > 1){ p.t = 1; p.dir *= -1; p.edge = pick(edges); }
    if(p.t < 0){ p.t = 0; p.dir *= -1; p.edge = pick(edges); }

    const pos = qPointOnEdge(p.edge, p.t);
    const bob = Math.sin((time*2.2 + p.phase) * p.wobble) * 1.2;

    // dot
    ictx.fillStyle = "rgba(43,26,18,0.90)";
    ictx.beginPath();
    ictx.arc(pos.x, pos.y + bob, 2.5, 0, Math.PI*2);
    ictx.fill();

    // footsteps
    ictx.strokeStyle = "rgba(43,26,18,0.22)";
    ictx.lineWidth = 1;
    for(let k=1;k<=3;k++){
      const t2 = Math.max(0, Math.min(1, p.t - p.dir * k*0.035));
      const pos2 = qPointOnEdge(p.edge, t2);
      ictx.beginPath();
      ictx.arc(pos2.x, pos2.y, 1.25, 0, Math.PI*2);
      ictx.stroke();
    }

    // label
    ictx.font = "12px ui-serif, Georgia, Times, serif";
    ictx.fillStyle = "rgba(43,26,18,0.78)";
    ictx.save();
    ictx.translate(pos.x + 9, pos.y - 10);
    ictx.rotate(rand(-0.02, 0.02));
    ictx.fillText(p.name, 0, 0);
    ictx.restore();
  }
}

// Torch
function setTorch(x,y){
  const rx = Math.max(0, Math.min(100, (x/W)*100));
  const ry = Math.max(0, Math.min(100, (y/H)*100));
  stage.style.setProperty('--mx', rx + '%');
  stage.style.setProperty('--my', ry + '%');
}
function pointerPos(evt){
  const r = stage.getBoundingClientRect();
  const x = (evt.clientX ?? (evt.touches && evt.touches[0].clientX) ?? 0) - r.left;
  const y = (evt.clientY ?? (evt.touches && evt.touches[0].clientY) ?? 0) - r.top;
  return { x: Math.max(0, Math.min(W, x)), y: Math.max(0, Math.min(H, y)) };
}

let dragging=false;
function onMove(evt){
  const p = pointerPos(evt);
  setTorch(p.x, p.y);
  if(revealed && dragging) eraseFog(p.x, p.y, 1.0);
}
function onDown(evt){
  dragging=true;
  const p = pointerPos(evt);
  setTorch(p.x, p.y);
  if(revealed) eraseFog(p.x, p.y, 1.15);
}
function onUp(){ dragging=false; }

// State
function startReveal(){
  if(revealed) return;
  revealed = true;

  stage.classList.add('active');
  veil.classList.add('hidden');

  resetFog();
  eraseFog(W*0.52, H*0.45, 1.2);
  eraseFog(W*0.38, H*0.58, 1.0);

  showToast("Přísaha přijata. Odhaluj plánku kurzorem. 🗺️");
}
function endReveal(){
  revealed = false;

  stage.classList.remove('active');
  veil.classList.remove('hidden');

  phraseInput.value = "";
  resetFog();
  drawInkBase();

  showToast("Neplecha ukončena.");
}

// Phrase handler
function tryPhrase(){
  const v = norm(phraseInput.value);

  if(v === OATH_ON){
    startReveal();
  } else if(v === OATH_OFF){
    endReveal();
  } else {
    showToast("Zkus přesně: „jsem připraven ke každé špatnosti“ (nebo „neplechu ukončit“) 😄");
  }
}

// Render loop
let last = performance.now();
let raf=null;
function loop(now){
  const dt = Math.min(0.05, (now-last)/1000);
  last = now;

  if(revealed){
    drawPeople(dt, now/1000);
  }

  raf = requestAnimationFrame(loop);
}

// Init
function init(){
  ({w:W,h:H} = fitCanvas(inkCanvas));
  fitCanvas(fogCanvas);

  seedGraph();
  seedPeople();

  drawInkBase();
  resetFog();

  cancelAnimationFrame(raf);
  last = performance.now();
  raf = requestAnimationFrame(loop);

  setTorch(W*0.5, H*0.45);
}

btn.addEventListener('click', tryPhrase);
btnOff.addEventListener('click', ()=>{
  phraseInput.value = "neplechu ukončit";
  tryPhrase();
});
phraseInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') tryPhrase(); });

stage.addEventListener('mousemove', onMove);
stage.addEventListener('mousedown', onDown);
window.addEventListener('mouseup', onUp);

stage.addEventListener('touchstart', (e)=>onDown(e), {passive:true});
stage.addEventListener('touchmove',  (e)=>onMove(e), {passive:true});
stage.addEventListener('touchend',   ()=>onUp());

window.addEventListener('resize', init);
init();
