/* ---------- Datos ---------- */
const DEF = {f:76.18, t:2, ri:2, th:90, a1:50, a2:30, k:0.33, w:60};
const FIELDS = [
  ['f','Desarrollo conocido','mm'],['t','Espesor (e)','mm'],['ri','Radio interior (Ri)','mm'],['th','Ángulo de plegado (θ)','°'],
  ['a1','Longitud ala 1','mm'],['a2','Longitud ala 2','mm'],['k','Factor K',''],['w','Ancho (solo vista 3D)','mm']
];
const $ = id => document.getElementById(id);
const fmt = (n,d=2) => n.toLocaleString('es-AR',{minimumFractionDigits:d,maximumFractionDigits:d});
const num = s => parseFloat(String(s).replace(',','.'));
const RAD = Math.PI/180;

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
const fEl = $('fields');
const SIDE=['f','k','w'];
FIELDS.filter(f=>SIDE.includes(f[0])).forEach(([id,lab,u])=>{
  fEl.insertAdjacentHTML('beforeend',`<div class="row"><label for="${id}">${lab}</label><div class="inp"><input id="${id}" type="text" inputmode="decimal" autocomplete="off"><span>${u}</span></div></div>`);
});
function setDefaults(){
  FIELDS.forEach(([id])=>{ $(id).value = String(DEF[id]).replace('.',','); });
  $('m-ext').checked = true; $('r-1').checked = true; $('s-flat').checked = true;
}
function leer(){
  const v = {}, errs = [];
  const rules = {
    f:[x=>x>0,'El desarrollo debe ser mayor que 0.'],
    t:[x=>x>0,'El espesor debe ser mayor que 0.'],
    ri:[x=>x>=0,'El radio interior no puede ser negativo.'],
    th:[x=>x>0&&x<180,'El ángulo debe estar entre 0° y 180° (sin incluirlos).'],
    a1:[x=>x>0,'La longitud del ala 1 debe ser mayor que 0.'],
    a2:[x=>x>0,'La longitud del ala 2 debe ser mayor que 0.'],
    k:[x=>x>=0&&x<=1,'El factor K debe estar entre 0 y 1.'],
    w:[x=>x>0,'El ancho debe ser mayor que 0.']
  };
  const solve = document.querySelector('input[name=solve]:checked').value;
  v.solve = solve;
  FIELDS.forEach(([id])=>{
    const x = num($(id).value); v[id]=x;
    if(id===solve || (id==='f' && solve==='flat')){
      $(id).classList.remove('bad'); const d0=$(id).closest('.dl'); if(d0) d0.classList.remove('bad'); return;
    }
    const bad = !isFinite(x) || !rules[id][0](x);
    $(id).classList.toggle('bad', bad); const dl=$(id).closest('.dl'); if(dl) dl.classList.toggle('bad',bad);
    if(bad) errs.push(isFinite(x) ? rules[id][1] : 'Revisá el campo “'+FIELDS.find(f=>f[0]===id)[1]+'”: ingresá un número.');
  });
  v.mode = document.querySelector('input[name=mode]:checked').value;
  v.ref = +document.querySelector('input[name=ref]:checked').value;
  return {v, errs};
}

function bdOf(v){
  const tn=Math.tan(v.th*RAD/2), ba=RAD*v.th*(v.ri+v.k*v.t), sb=(v.mode==='ext'?v.ri+v.t:v.ri)*tn;
  return 2*sb-ba;
}
function limpiar(){
  ['total'].forEach(i=>$(i).innerHTML='—<small>mm</small>');
  ['kBD','kBA','kPos','kSB','kL1','kL2','kRi','kRe','kF','kA'].forEach(i=>$(i).textContent='—');
  ['strip','d3'].forEach(i=>$(i).innerHTML='');
  $('d2').style.opacity='.3';
  $('stripNote').textContent='';
}

function update(){
  const {v, errs} = leer();
  const solve = v.solve;
  ['a1','a2'].forEach(id=>{ const ro=id===solve; $(id).readOnly=ro; $(id).closest('.dl').classList.toggle('calc',ro); });
  $('f').closest('.row').style.display = solve==='flat' ? 'none' : '';
  if(!errs.length && solve!=='flat'){
    const tgt = v.f + bdOf(v) - (solve==='a1' ? v.a2 : v.a1);
    if(!(tgt>0)) errs.push('Con ese desarrollo, el ala a calcular queda en 0 o negativa: revisá el desarrollo o la otra ala.');
    else { v[solve]=tgt; $(solve).value = String(+tgt.toFixed(3)).replace('.',','); }
  }
  let c = null;
  if(!errs.length){
    const pieza = {t:v.t, k:v.k, mode:v.mode, alas:[v.a1,v.a2], pliegues:[{th:v.th, ri:v.ri}]};
    c = calcular(pieza); c.pieza = pieza;
    c.err.forEach(e=>errs.push(e));
  }
  $('errs').innerHTML = errs.map(e=>'<div>⚠ '+e+'</div>').join('');
  if(errs.length){ limpiar(); return; }
  const b = c.bends[0];
  const ext = v.mode==='ext';
  $('d2').style.opacity='1';
  const mm = '<small>mm</small>', med = ext?'exteriores':'interiores';
  if(solve==='flat'){
    $('heroLab').textContent = 'DESARROLLO TOTAL (mm)';
    $('total').innerHTML = fmt(c.flat)+mm;
    $('heroNote').textContent = 'Largo de chapa a cortar antes de plegar (medidas '+med+').';
  } else {
    const n = solve==='a1' ? '1' : '2', o = solve==='a1' ? '2' : '1';
    $('heroLab').textContent = 'ALA '+n+' (mm) · MEDIDA TOTAL';
    $('total').innerHTML = fmt(v[solve])+mm;
    $('heroNote').textContent = 'Medida '+med+' del ala '+n+' para un desarrollo de '+fmt(c.flat)+' mm, con el ala '+o+' de '+fmt(v[solve==='a1'?'a2':'a1'])+' mm.';
  }
  $('kF').textContent = fmt(c.flat)+' mm';
  $('kA').textContent = fmt(v.a1+v.a2)+' mm';
  $('kBD').textContent = fmt(b.bd)+' mm';
  $('kBDl').textContent = 'Descuento de plegado (BD, '+(ext?'ext.':'int.')+')';
  $('kBA').textContent = fmt(b.ba)+' mm';
  $('kSB').textContent = fmt(b.sb)+' mm';
  $('kSBl').textContent = ext?'Outside setback (OSSB)':'Inside setback (ISSB)';
  $('kL1').textContent = fmt(c.legs[0])+' mm';
  $('kL2').textContent = fmt(c.legs[1])+' mm';
  $('kRi').textContent = fmt(b.ri)+' mm';
  $('kRe').textContent = fmt(b.re)+' mm';
  const pos = x => v.ref===1 ? x : c.flat - x;
  $('kPos').textContent = fmt(pos(b.c))+' mm';
  drawStrip(c,v,pos);
  const g = geometry(c,v);
  draw2D(g,c,v);
  draw3D(g,v);
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
function place(id,p,dx=0,dy=0){
  const el=$(id); el.style.left=((p[0]+dx)/680*100)+'%'; el.style.top=((p[1]+dy)/420*100)+'%';
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

/* ---------- Eventos ---------- */
document.addEventListener('input', update);
$('reset').addEventListener('click', ()=>{ setDefaults(); update(); });
setDefaults(); update();
