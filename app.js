/* ---------- Utilidades y campos ---------- */
const $ = id => document.getElementById(id);
const fmt = (n,d=2) => n.toLocaleString('es-AR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtIn = x => String(+x.toFixed(3)).replace('.',',');
const num = s => parseFloat(String(s).replace(',','.'));
const RAD = Math.PI/180;
const FIELDS = [
  ['t','Espesor (e)','mm'],['ri','Radio interior (Ri)','mm'],['th','Ángulo de plegado (θ)','°'],
  ['a1','Longitud ala 1 (A1)','mm'],['a2','Longitud ala 2 (A2)','mm'],
  ['f','Desarrollo total (F)','mm'],['d','Distancia al pliegue (d)','mm'],
  ['k','Factor K',''],['w','Ancho (opcional, solo vista 3D)','mm']
];
const RULES = {
  t:[x=>x>0,'El espesor debe ser mayor que 0.'], ri:[x=>x>=0,'El radio interior no puede ser negativo.'],
  th:[x=>x>0&&x<180,'El ángulo debe estar entre 0° y 180° (sin incluirlos).'],
  a1:[x=>x>0,'La longitud del ala 1 debe ser mayor que 0.'], a2:[x=>x>0,'La longitud del ala 2 debe ser mayor que 0.'],
  f:[x=>x>0,'El desarrollo debe ser mayor que 0.'], d:[x=>x>0,'La distancia al pliegue debe ser mayor que 0.'],
  k:[x=>x>=0&&x<=1,'El factor K debe estar entre 0 y 1.'], w:[x=>x>0,'El ancho debe ser mayor que 0.']
};
const BASE = ['t','ri','th','k'];          // siempre necesarios
const GL = ['a1','a2'], GF = ['f','d'];    // grupo "L" (alas) y grupo "F" (chapa desplegada)
const PH = {k:'ej. 0,33', w:'ej. 60'};
const GH = {t:2, ri:2, th:90, a1:50, a2:30, k:0.33, w:35};   // pieza de ejemplo (solo dibujo fantasma)
let ultimo = null;          // último grupo editado por la persona: 'L' o 'F' (es el que se toma como dato)
const salida = new Set();   // campos completados por el cálculo (se vacían al cambiar un dato)

/* ---------- Modelo: preparado para N pliegues ----------
   pieza = { t, k, mode, alas:[A1,A2,...An+1], pliegues:[{th,ri},...] }  */
function calcular(p){
  const out = {legs:[], bends:[], flat:0, err:[]};
  let sumA = p.alas.reduce((a,b)=>a+b,0), sumDed = 0;
  p.pliegues.forEach(b=>{
    const tn = Math.tan(b.th*RAD/2);
    const ba = RAD*b.th*(b.ri + p.k*p.t);
    const ossb = (b.ri+p.t)*tn, issb = b.ri*tn;
    const sb = p.mode==='ext' ? ossb : issb;
    const bd = 2*sb - ba;
    sumDed += bd;
    out.bends.push({th:b.th, ri:b.ri, re:b.ri+p.t, ba, ossb, issb, sb, bd});
  });
  out.flat = sumA - sumDed;
  let cur = 0;
  p.alas.forEach((A,i)=>{
    const sbPrev = i>0 ? out.bends[i-1].sb : 0;
    const sbNext = i<out.bends.length ? out.bends[i].sb : 0;
    const L = A - sbPrev - sbNext;
    if(L < -1e-9) out.err.push('El ala '+(i+1)+' es demasiado corta para este radio y ángulo (tramo recto negativo).');
    out.legs.push(L);
    cur += L;
    if(i<out.bends.length){
      const b = out.bends[i];
      b.s1 = cur; b.c = cur + b.ba/2; b.s2 = cur + b.ba;
      cur += b.ba;
    }
  });
  return out;
}

/* ---------- UI ---------- */
['k','w'].forEach(id=>{
  const [,lab,u]=FIELDS.find(f=>f[0]===id);
  $('fields').insertAdjacentHTML('beforeend',`<div class="row"><label for="${id}">${lab}</label><div class="inp"><input id="${id}" type="text" inputmode="decimal" autocomplete="off" placeholder="${PH[id]}"><span>${u}</span></div></div>`);
});
['a1','a2','t','ri','th','f','d'].forEach(id=>{ $(id).placeholder='0,0'; });

const pieza = v => ({t:v.t, k:v.k, mode:v.mode, alas:[v.a1,v.a2], pliegues:[{th:v.th, ri:v.ri}]});
function partes(v){
  const tn=Math.tan(v.th*RAD/2), ba=RAD*v.th*(v.ri+v.k*v.t), sb=(v.mode==='ext'?v.ri+v.t:v.ri)*tn;
  return {ba, sb, bd:2*sb-ba};
}
const lleno = id => $(id).value.trim()!=='';
function fuente(){
  if(ultimo) return ultimo;
  const L=lleno('a1')&&lleno('a2'), F=lleno('f')&&lleno('d');
  return L?'L':(F?'F':null);
}
function leer(){
  const q = n => document.querySelector('input[name='+n+']:checked').value;
  const src=fuente(), v={src, dp:q('dp'), mode:q('mode'), ref:+q('ref')};
  const req=[...BASE, ...(src==='L'?GL:(src==='F'?GF:[]))], errs=[], missing=[];
  FIELDS.forEach(([id,lab])=>{
    const el=$(id), box=el.closest('.dl')||el.closest('.inp'), raw=el.value.trim();
    const falta = raw==='' && (req.includes(id) || (src===null && (GL.includes(id)||GF.includes(id))));
    let bad=false; v[id]=NaN;
    if(raw!==''){
      const x=num(raw); v[id]=x;
      if(!isFinite(x)){ bad=true; errs.push('Revisá “'+lab+'”: ingresá un número.'); }
      else if(!RULES[id][0](x)){ bad=true; errs.push(RULES[id][1]); }
    }
    if(raw==='' && req.includes(id)) missing.push(lab);
    el.classList.toggle('bad',bad);
    if(box){ box.classList.toggle('bad',bad); box.classList.toggle('empty',falta); }
  });
  if(src===null) missing.push('las alas A1 y A2, o bien el desarrollo F y la distancia d');
  return {v,errs,missing};
}
// Distancia al pliegue medida desde el extremo de referencia (centro del arco o inicio del arco)
function dDe(c,v){
  const b=c.bends[0];
  const ini = v.ref===1 ? b.s1 : c.flat-b.s2, cen = v.ref===1 ? b.c : c.flat-b.c;
  return v.dp==='c' ? cen : ini;
}
// Directo (A1, A2 → desarrollo) o inverso (desarrollo + distancia al pliegue → A1, A2)
function resolver(v0){
  const v={...v0};
  if(v.src==='F'){
    const {ba,sb,bd}=partes(v);
    const Aref=v.d-(v.dp==='c'?ba/2:0)+sb, Aoth=v.f+bd-Aref;
    if(!(Aref>0)||!(Aoth>0)) return {errs:['Con esos datos una de las alas queda en 0 o negativa: revisá el desarrollo, la distancia al pliegue o el radio.']};
    v.a1=v.ref===1?Aref:Aoth; v.a2=v.ref===1?Aoth:Aref;
  }
  const c=calcular(pieza(v));
  return {v,c,errs:c.err};
}
const errHtml = a => a.map(e=>'<div>⚠ '+e+'</div>').join('');
function dibujar(v,c,ghost){
  const g=geometry(c,v);
  draw2D(g,c,v); draw3D(g,{...v,w:v.w>0?v.w:Math.max(v.a1,v.a2)*0.6}); drawFlat(c,v);
  ['d2','d3','dflat'].forEach(i=>$(i).classList.toggle('ghost',ghost));
}
const ocultar = () => { $('resultado').hidden = true; };
function limpiarSalidas(){ salida.forEach(id=>{ $(id).value=''; }); salida.clear(); }

// Se ejecuta con cada cambio de datos: indicadores, avisos y dibujo de vista previa (sin resultados)
function refrescar(invalida){
  const {v,errs,missing}=leer();
  ['a1','a2','f','d'].forEach(id=>{ $(id).closest('.dl').classList.toggle('calc',salida.has(id)); });
  [[GL,'F'],[GF,'L']].forEach(([g,otro])=>g.forEach(id=>{ $(id).placeholder = v.src===otro ? 'auto' : '0,0'; }));
  if(invalida) ocultar();
  const all=errs.slice(); let real=false, c=null, vv=v;
  if(!errs.length && !missing.length){
    const r=resolver(v);
    if(r.errs.length) all.push(...r.errs); else { real=true; c=r.c; vv=r.v; }
  }
  $('errs').innerHTML=errHtml(all);
  const n=missing.length;
  $('falta').className='falta'+(n||all.length?'':' ok');
  $('falta').textContent = n ? 'Faltan '+n+' dato'+(n>1?'s':'')+': completá las celdas que titilan.' : (all.length ? 'Corregí los valores marcados en rojo.' : 'Datos completos · tocá Calcular.');
  if(real) dibujar(vv,c,false);
  else { const vg={...GH,mode:v.mode,ref:v.ref,dp:v.dp}; dibujar(vg,calcular(pieza(vg)),true); }
}

// Barra de cálculo simulada
function animar(fin){
  const btn=$('calc'), bar=$('pbar'), fill=$('pfill'), lab=$('plab');
  const dur = matchMedia('(prefers-reduced-motion:reduce)').matches ? 250 : 1400;
  const pasos=['Leyendo datos','Calculando setback','Calculando arco de plegado','Armando resultado'];
  btn.disabled=true; bar.hidden=false; fill.style.width='0%'; const t0=performance.now();
  (function tick(now){
    const p=Math.min(1,(now-t0)/dur), e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
    fill.style.width=(e*100)+'%';
    lab.textContent=pasos[Math.min(3,Math.floor(e*4))]+'… '+Math.round(e*100)+'%';
    if(p<1) requestAnimationFrame(tick);
    else setTimeout(()=>{ fin(); btn.disabled=false; setTimeout(()=>{ bar.hidden=true; },500); },150);
  })(t0);
}

function mostrarResultados(){
  const {v,errs,missing}=leer(); if(errs.length||missing.length) return;
  const r=resolver(v); if(r.errs.length){ $('errs').innerHTML=errHtml(r.errs); return; }
  const vv=r.v, c=r.c, b=c.bends[0], ext=vv.mode==='ext', F=vv.src==='F', dOut=dDe(c,vv);
  // completar en el dibujo lo que se calculó
  const out = F ? {a1:vv.a1, a2:vv.a2} : {f:c.flat, d:dOut};
  salida.clear();
  Object.entries(out).forEach(([id,val])=>{ $(id).value=fmtIn(val); salida.add(id); });
  refrescar(false);
  const mm='<small>mm</small>', med=ext?'exteriores':'interiores', ini=vv.dp==='c'?'centro':'inicio';
  $('total').classList.toggle('dual',F);
  if(!F){
    $('heroLab').textContent='DESARROLLO TOTAL (mm)';
    $('total').innerHTML=fmt(c.flat)+mm;
    $('heroNote').textContent='Largo de chapa a cortar antes de plegar (medidas '+med+'). Pliegue a '+fmt(dOut)+' mm del extremo del ala '+vv.ref+' ('+ini+' del arco).';
  } else {
    $('heroLab').textContent='MEDIDAS DE LA L (mm)';
    $('total').innerHTML=fmt(vv.a1)+'<small>A1</small>'+fmt(vv.a2)+'<small>A2</small>';
    $('heroNote').textContent='Medidas '+med+' de la pieza plegada, para una chapa de '+fmt(c.flat)+' mm con el pliegue a '+fmt(vv.d)+' mm del extremo del ala '+vv.ref+' ('+ini+' del arco).';
  }
  $('kBD').textContent=fmt(b.bd)+' mm'; $('kBDl').textContent='Descuento de plegado (BD, '+(ext?'ext.':'int.')+')';
  $('kBA').textContent=fmt(b.ba)+' mm';
  $('kSB').textContent=fmt(b.sb)+' mm'; $('kSBl').textContent=ext?'Outside setback (OSSB)':'Inside setback (ISSB)';
  $('kL1').textContent=fmt(c.legs[0])+' mm'; $('kL2').textContent=fmt(c.legs[1])+' mm';
  $('kRi').textContent=fmt(b.ri)+' mm'; $('kRe').textContent=fmt(b.re)+' mm';
  const pos=x=>vv.ref===1?x:c.flat-x;
  $('kPos').textContent=fmt(dOut)+' mm';
  $('kPosl').textContent='Distancia al pliegue (d): hasta el '+ini+' del arco, desde el extremo del ala '+vv.ref;
  drawStrip(c,vv,pos);
  const R=$('resultado'); R.hidden=false; R.classList.remove('reveal'); void R.offsetWidth; R.classList.add('reveal');
  R.scrollIntoView({behavior:'smooth',block:'start'});
}

/* ---------- Geometría del perfil (coordenadas matemáticas, y hacia arriba) ---------- */
function geometry(c,v){
  const b = c.bends[0], T = v.t, R = v.ri, L1 = c.legs[0], L2 = c.legs[1];
  const p1 = -Math.PI/2, p2 = p1 + v.th*RAD;
  const C = [L1, T+R];
  const P = (r,p)=>[C[0]+r*Math.cos(p), C[1]+r*Math.sin(p)];
  const tg = [-Math.sin(p2), Math.cos(p2)];
  const N = 28, ao=[], ai=[];
  for(let i=0;i<=N;i++){ const p = p1+(p2-p1)*i/N; ao.push(P(R+T,p)); ai.push(P(R,p)); }
  const oe = ao[N], ie = ai[N];
  const poly = [[0,0], ...ao, [oe[0]+L2*tg[0], oe[1]+L2*tg[1]], [ie[0]+L2*tg[0], ie[1]+L2*tg[1]], ...ai.slice().reverse(), [0,T]];
  return {b,T,R,L1,L2,p1,p2,C,P,tg,poly,ao,ai,oe,ie};
}

/* ---------- Dibujo 2D ---------- */
function mapper(pts, W, H, padX, padY=padX){
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  pts.forEach(p=>{x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);});
  const s = Math.min((W-2*padX)/Math.max(x1-x0,1e-6), (H-2*padY)/Math.max(y1-y0,1e-6));
  const ox = (W-(x1-x0)*s)/2, oy = (H-(y1-y0)*s)/2;
  const S = p => [ox+(p[0]-x0)*s, H-(oy+(p[1]-y0)*s)];
  return {S,s};
}
const pt = p => p[0].toFixed(1)+','+p[1].toFixed(1);

function dim(out,S,p1,p2,n,off,txt){
  const a=S(p1), b=S(p2), nx=n[0], ny=-n[1];
  const a2=[a[0]+nx*off,a[1]+ny*off], b2=[b[0]+nx*off,b[1]+ny*off];
  out.push(`<line class="ext" x1="${a[0]+nx*4}" y1="${a[1]+ny*4}" x2="${a2[0]+nx*6}" y2="${a2[1]+ny*6}"/>`);
  out.push(`<line class="ext" x1="${b[0]+nx*4}" y1="${b[1]+ny*4}" x2="${b2[0]+nx*6}" y2="${b2[1]+ny*6}"/>`);
  out.push(`<line class="dimln" x1="${a2[0]}" y1="${a2[1]}" x2="${b2[0]}" y2="${b2[1]}" marker-start="url(#ar)" marker-end="url(#ar)"/>`);
  let ang = Math.atan2(b2[1]-a2[1], b2[0]-a2[0])*180/Math.PI;
  if(ang>90||ang<-90) ang+=180;
  if(txt===null) return [(a2[0]+b2[0])/2,(a2[1]+b2[1])/2];
  const mx=(a2[0]+b2[0])/2+nx*9, my=(a2[1]+b2[1])/2+ny*9;
  out.push(`<text class="halo dimtx" text-anchor="middle" dominant-baseline="middle" transform="translate(${mx} ${my}) rotate(${ang})">${txt}</text>`);
}
function place(id,p,dx=0,dy=0,W=680,H=420){
  const el=$(id); el.style.left=((p[0]+dx)/W*100)+'%'; el.style.top=((p[1]+dy)/H*100)+'%';
}

function draw2D(g,c,v){
  const W=680,H=420, ext=v.mode==='ext', {b,T,R,L1,L2,p1,p2,C,P,tg,poly} = g;
  const V = ext ? [L1+b.ossb,0] : [L1+b.issb,T];
  const nA = ext ? [0,-1] : [0,1];
  const nB = ext ? [Math.cos(p2),Math.sin(p2)] : [-Math.cos(p2),-Math.sin(p2)];
  const A0 = ext ? [0,0] : [0,T];
  const E2 = [V[0]+v.a2*tg[0], V[1]+v.a2*tg[1]];
  const {S,s} = mapper([...poly,V,E2], W, H, 125, 90);
  const o = [`<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:var(--dim)"/></marker></defs>`];
  // líneas virtuales hacia el vértice de medición
  const tA = ext ? [L1,0] : [L1,T];
  const tB = ext ? g.oe : g.ie;
  o.push(`<line class="virt" x1="${S(tA)[0]}" y1="${S(tA)[1]}" x2="${S(V)[0]}" y2="${S(V)[1]}"/>`);
  o.push(`<line class="virt" x1="${S(tB)[0]}" y1="${S(tB)[1]}" x2="${S(V)[0]}" y2="${S(V)[1]}"/>`);
  o.push(`<circle cx="${S(V)[0]}" cy="${S(V)[1]}" r="3" style="fill:var(--mut)"/>`);
  // pieza
  o.push(`<polygon class="part" points="${poly.map(p=>pt(S(p))).join(' ')}"/>`);
  // eje neutro
  const nr = R + v.k*T, nn=[];
  for(let i=0;i<=28;i++){ nn.push(pt(S(P(nr,p1+(p2-p1)*i/28)))); }
  o.push(`<polyline class="neutral" points="${nn.join(' ')}"/>`);
  // líneas de plegado (tangentes): radiales en inicio y fin del arco
  const e = 7/s;
  [p1,p2].forEach(p=>{
    const a=S(P(Math.max(R-e,0),p)), d=S(P(R+T+e,p));
    o.push(`<line class="bend" x1="${a[0]}" y1="${a[1]}" x2="${d[0]}" y2="${d[1]}"/>`);
  });
  // arco interior y exterior resaltados
  o.push(`<polyline class="bend" points="${g.ai.map(p=>pt(S(p))).join(' ')}"/>`);
  o.push(`<polyline class="bend" points="${g.ao.map(p=>pt(S(p))).join(' ')}"/>`);
  // ángulo
  const cs=S(C), rr=Math.max(18,Math.min(R*s*0.65,70)), am=(p1+p2)/2;
  const ap=[]; for(let i=0;i<=24;i++){const p=p1+(p2-p1)*i/24; ap.push(`${(cs[0]+rr*Math.cos(p)).toFixed(1)},${(cs[1]-rr*Math.sin(p)).toFixed(1)}`);}
  o.push(`<polyline class="bend" style="stroke-width:1.2" points="${ap.join(' ')}"/>`);
  // Ri y θ: celdas en el lado cóncavo, con guías hacia el arco
  const sw=p2-p1, beta=am+Math.PI;
  let Q=[cs[0]+80*Math.cos(beta), cs[1]-80*Math.sin(beta)];
  Q=[Math.min(Math.max(Q[0],70),W-70), Math.min(Math.max(Q[1],50),H-60)];
  const aT=[cs[0]+rr*Math.cos(p1+sw*.7), cs[1]-rr*Math.sin(p1+sw*.7)], aR=S(P(R,p1+sw*.3));
  o.push(`<line class="neutral" x1="${Q[0]}" y1="${Q[1]-17}" x2="${aT[0]}" y2="${aT[1]}" style="stroke-dasharray:none;stroke-width:.9"/>`);
  o.push(`<line class="neutral" x1="${Q[0]}" y1="${Q[1]+17}" x2="${aR[0]}" y2="${aR[1]}" style="stroke-dasharray:none;stroke-width:.9"/>`);
  o.push(`<text class="halo amb" text-anchor="middle" x="${Q[0]}" y="${Q[1]+48}">Re ${fmt(R+T)}</text>`);
  place('dl-th',Q,0,-17); place('dl-ri',Q,0,17);
  // cotas editables
  place('dl-a1',dim(o,S,A0,V,nA,34,null));
  place('dl-a2',dim(o,S,V,E2,nB,34,null));
  place('dl-t',dim(o,S,[0,0],[0,T],[-1,0],22,null),-52,0);
  $('d2').innerHTML = o.join('');
}

/* ---------- Vista 3D (proyección oblicua) ---------- */
function draw3D(g,v){
  const W=680,H=420, poly=g.poly, w=v.w;
  const d = [0.55*w, 0.42*w];
  const all = [...poly, ...poly.map(p=>[p[0]+d[0],p[1]+d[1]])];
  const {S} = mapper(all,W,H,40);
  const sh = p => [p[0]+d[0],p[1]+d[1]];
  let area=0; poly.forEach((p,i)=>{const q=poly[(i+1)%poly.length]; area+=p[0]*q[1]-q[0]*p[1];});
  const sg = area>=0?1:-1, o=[];
  const light=[-0.5,0.85], ll=Math.hypot(...light);
  const quads=[];
  poly.forEach((p,i)=>{
    const q=poly[(i+1)%poly.length], ex=q[0]-p[0], ey=q[1]-p[1], len=Math.hypot(ex,ey);
    if(len<1e-9) return;
    const n=[sg*ey/len,-sg*ex/len];
    if(n[0]*d[0]+n[1]*d[1] <= 1e-9) return;
    const k=Math.max(0,Math.min(1,0.5+0.5*(n[0]*light[0]+n[1]*light[1])/ll));
    quads.push(`<polygon points="${[p,q,sh(q),sh(p)].map(a=>pt(S(a))).join(' ')}" style="fill:hsl(38 10% ${34+k*36}%);stroke:none"/>`);
  });
  o.push(...quads);
  o.push(`<polygon points="${poly.map(p=>pt(S(p))).join(' ')}" style="fill:hsl(38 12% 80%);stroke:var(--text);stroke-width:1.3;stroke-linejoin:round"/>`);
  // líneas de plegado sobre la cara frontal
  [g.p1,g.p2].forEach(p=>{
    const a=g.P(g.R,p), b=g.P(g.R+g.T,p);
    o.push(`<line class="bend" x1="${S(a)[0]}" y1="${S(a)[1]}" x2="${S(b)[0]}" y2="${S(b)[1]}"/>`);
  });
  o.push(`<text class="halo" x="14" y="${H-14}" style="fill:var(--mut)">Ancho ${fmt(w)} mm · vista oblicua, sin escala en profundidad</text>`);
  $('d3').innerHTML = o.join('');
}

/* ---------- Chapa desarrollada y posición del plegado ---------- */
function drawStrip(c,v,pos){
  const b=c.bends[0], F=c.flat, X0=40, X1=640, k=(X1-X0)/F, y=52, h=30;
  const X = x => X0 + pos(x)*k;
  const xa=Math.min(X(b.s1),X(b.s2)), xb=Math.max(X(b.s1),X(b.s2)), xc=X(b.c);
  const refL = v.ref===1 ? 'ala 1' : 'ala 2', othL = v.ref===1 ? 'ala 2' : 'ala 1';
  const o=[`<defs><marker id="ar2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:var(--dim)"/></marker></defs>`];
  o.push(`<rect x="${X0}" y="${y}" width="${X1-X0}" height="${h}" class="part" rx="2"/>`);
  o.push(`<rect x="${xa}" y="${y}" width="${Math.max(xb-xa,1.5)}" height="${h}" style="fill:var(--amber);fill-opacity:.35"/>`);
  o.push(`<line class="bend" x1="${xa}" y1="${y-8}" x2="${xa}" y2="${y+h+8}"/><line class="bend" x1="${xb}" y1="${y-8}" x2="${xb}" y2="${y+h+8}"/>`);
  o.push(`<line class="neutral" x1="${xc}" y1="${y-14}" x2="${xc}" y2="${y+h+14}" style="stroke-width:2"/>`);
  o.push(`<text class="halo amb" x="${xc}" y="${y-20}" text-anchor="middle">LÍNEA DE PLEGADO (centro)</text>`);
  o.push(`<text class="halo" x="${X0}" y="${y+h/2}" dx="6" dominant-baseline="middle" style="fill:var(--text);font-weight:600">${v.ref===1?'A1':'A2'}</text>`);
  o.push(`<text class="halo" x="${X1}" y="${y+h/2}" dx="-6" text-anchor="end" dominant-baseline="middle" style="font-weight:600">${v.ref===1?'A2':'A1'}</text>`);
  o.push(`<text x="${X0}" y="${y+h+60}" style="fill:var(--mut)" font-size="11">▲ extremo de referencia (${refL})</text>`);
  // cota desde el extremo de referencia hasta el centro
  const dy=y+h+30;
  o.push(`<line class="dimln" x1="${X0}" y1="${dy}" x2="${xc}" y2="${dy}" marker-start="url(#ar2)" marker-end="url(#ar2)"/>`);
  o.push(`<line class="ext" x1="${X0}" y1="${y+h}" x2="${X0}" y2="${dy+6}"/><line class="ext" x1="${xc}" y1="${y+h+14}" x2="${xc}" y2="${dy+6}"/>`);
  o.push(`<text class="halo dimtx" x="${(X0+xc)/2}" y="${dy-6}" text-anchor="middle">${fmt(pos(b.c))} mm</text>`);
  o.push(`<text class="halo" x="${X1}" y="${dy+34}" text-anchor="end" style="fill:var(--mut)" font-size="11">largo total ${fmt(F)} mm</text>`);
  $('strip').innerHTML=o.join('');
  const t1=pos(b.s1), t2=pos(b.s2), lo=Math.min(t1,t2), hi=Math.max(t1,t2);
  $('stripNote').innerHTML = `Apoyá el <b>extremo de la ${refL}</b> en el cero y marcá la línea de plegado a <b>${fmt(pos(b.c))} mm</b> (centro del arco). Si preferís marcar el arco completo, hacelo entre <b>${fmt(lo)}</b> y <b>${fmt(hi)} mm</b>. Medida desde el otro extremo (${othL}): ${fmt(c.flat-pos(b.c))} mm.`;
}


/* ---------- Chapa desplegada editable (F y d) ---------- */
function drawFlat(c,v){
  const W=680,H=160,X0=60,X1=620,y=68,h=30,b=c.bends[0],F=c.flat,k=(X1-X0)/F;
  const pos=x=>v.ref===1?x:F-x, X=x=>X0+pos(x)*k;
  const xa=Math.min(X(b.s1),X(b.s2)), xb=Math.max(X(b.s1),X(b.s2)), xc=X(b.c);
  const xm = v.dp==='c' ? xc : (v.ref===1 ? X(b.s1) : X(b.s2));
  const yt=32, yb=y+h+32;
  const o=[`<defs><marker id="ar3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:var(--dim)"/></marker></defs>`];
  o.push(`<rect x="${X0}" y="${y}" width="${X1-X0}" height="${h}" class="part" rx="2"/>`);
  o.push(`<rect x="${xa}" y="${y}" width="${Math.max(xb-xa,1.5)}" height="${h}" style="fill:var(--amber);fill-opacity:.35"/>`);
  o.push(`<line class="bend" x1="${xa}" y1="${y-6}" x2="${xa}" y2="${y+h+6}"/><line class="bend" x1="${xb}" y1="${y-6}" x2="${xb}" y2="${y+h+6}"/>`);
  o.push(`<line class="neutral" x1="${xc}" y1="${y-10}" x2="${xc}" y2="${y+h+10}" style="stroke-width:1.6"/>`);
  o.push(`<text class="halo" x="${X0+6}" y="${y+h/2}" dominant-baseline="middle" style="font-weight:600">${v.ref===1?'A1':'A2'}</text>`);
  o.push(`<text class="halo" x="${X1-6}" y="${y+h/2}" text-anchor="end" dominant-baseline="middle" style="font-weight:600">${v.ref===1?'A2':'A1'}</text>`);
  // cota total F
  o.push(`<line class="ext" x1="${X0}" y1="${y-2}" x2="${X0}" y2="${yt-6}"/><line class="ext" x1="${X1}" y1="${y-2}" x2="${X1}" y2="${yt-6}"/>`);
  o.push(`<line class="dimln" x1="${X0}" y1="${yt}" x2="${X1}" y2="${yt}" marker-start="url(#ar3)" marker-end="url(#ar3)"/>`);
  // cota d (desde el extremo de referencia hasta la marca del pliegue)
  o.push(`<line class="ext" x1="${X0}" y1="${y+h+2}" x2="${X0}" y2="${yb+6}"/><line class="ext" x1="${xm}" y1="${y+h+8}" x2="${xm}" y2="${yb+6}"/>`);
  o.push(`<line class="dimln" x1="${X0}" y1="${yb}" x2="${xm}" y2="${yb}" marker-start="url(#ar3)" marker-end="url(#ar3)"/>`);
  o.push(`<text x="${X0}" y="${H-4}" style="fill:var(--muted)" font-size="11">▲ extremo de referencia (ala ${v.ref})</text>`);
  $('dflat').innerHTML=o.join('');
  place('dl-f',[(X0+X1)/2,yt],0,0,W,H);
  place('dl-d',[Math.max((X0+xm)/2,X0+60),yb],0,0,W,H);
}

/* ---------- Eventos ---------- */
document.addEventListener('input', e=>{
  const id=e.target.id;
  if(GL.includes(id)) ultimo='L'; else if(GF.includes(id)) ultimo='F';
  salida.delete(id);      // lo que se escribe a mano deja de ser un resultado
  limpiarSalidas();       // los demás resultados quedaron viejos
  refrescar(true);
});
document.addEventListener('keydown', e=>{ if(e.key==='Enter' && e.target.type==='text'){ e.preventDefault(); $('calc').click(); } });
$('calc').addEventListener('click', ()=>{
  const {v,errs,missing}=leer();
  if(errs.length||missing.length){
    refrescar(false);
    if(missing.length){
      const em=[...document.querySelectorAll('.empty')];
      em.forEach(e=>{ e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); });
      const f=em.map(e=>e.querySelector('input')).find(Boolean); if(f) f.focus();
      $('errs').innerHTML+='<div>Faltan: '+missing.join(', ')+'.</div>';
    }
    return;
  }
  const r=resolver(v);
  if(r.errs.length){ $('errs').innerHTML=errHtml(r.errs); return; }
  animar(mostrarResultados);
});
$('reset').addEventListener('click', ()=>{
  FIELDS.forEach(([id])=>{ $(id).value=''; });
  ['m-ext','r-1','dp-c'].forEach(i=>{ $(i).checked=true; });
  ultimo=null; salida.clear(); ocultar(); refrescar(false);
});
refrescar(false);
