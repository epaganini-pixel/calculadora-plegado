/* Calculadora de desarrollo de chapa · dos calculadoras independientes:
   1) alas → desarrollo   2) desarrollo → alas  */
const APP_V = 8;
if(window.APP_V!==APP_V) throw new Error('index.html y app.js son de versiones distintas');
const fmt = (n,d=2) => n.toLocaleString('es-AR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtIn = x => String(+x.toFixed(3)).replace('.',',');
const num = s => parseFloat(String(s).replace(',','.'));
const RAD = Math.PI/180;
let RQ = null;   // consulta dentro del panel activo (la usan las funciones de dibujo)
const LAB = {t:'Espesor (e)',ri:'Radio interior (Ri)',th:'Ángulo de plegado (θ)',a1:'Longitud ala 1 (A1)',a2:'Longitud ala 2 (A2)',
  f:'Desarrollo total (F)',d:'Distancia al pliegue (d)',aw:'Ancho total',ah:'Alto total',k:'Factor K',w:'Ancho 3D'};
const RULES = {
  t:[x=>x>0,'El espesor debe ser mayor que 0.'], ri:[x=>x>=0,'El radio interior no puede ser negativo.'],
  th:[x=>x>0&&x<180,'El ángulo debe estar entre 0° y 180° (sin incluirlos).'],
  a1:[x=>x>0,'La longitud del ala 1 debe ser mayor que 0.'], a2:[x=>x>0,'La longitud del ala 2 debe ser mayor que 0.'],
  aw:[x=>x>0,'El ancho total debe ser mayor que 0.'], ah:[x=>x>0,'El alto total debe ser mayor que 0.'],
  f:[x=>x>0,'El desarrollo debe ser mayor que 0.'], d:[x=>x>0,'La distancia al pliegue debe ser mayor que 0.'],
  k:[x=>x>=0&&x<=1,'El factor K debe estar entre 0 y 1.'], w:[x=>x>0,'El ancho debe ser mayor que 0.']
};
const GH = {t:2, ri:2, th:90, a1:50, a2:30, k:0.33, w:35};   // pieza de ejemplo (solo dibujo fantasma)

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
  const el=RQ(id); el.style.left=((p[0]+dx)/W*100)+'%'; el.style.top=((p[1]+dy)/H*100)+'%';
}

function draw2D(g,c,v){
  const W=680,H=420, ext=v.mode==='ext', {b,T,R,L1,L2,p1,p2,C,P,tg,poly} = g;
  const V = ext ? [L1+b.ossb,0] : [L1+b.issb,T];
  const nA = ext ? [0,-1] : [0,1];
  const nB = ext ? [Math.cos(p2),Math.sin(p2)] : [-Math.cos(p2),-Math.sin(p2)];
  const A0 = ext ? [0,0] : [0,T];
  const E2 = [V[0]+v.a2*tg[0], V[1]+v.a2*tg[1]];
  const tot = v.dm==='t';
  const {S,s} = mapper(tot ? poly : [...poly,V,E2], W, H, 125, 90);
  const o = [`<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:var(--dim)"/></marker></defs>`];
  // líneas virtuales hacia el vértice de medición
  const tA = ext ? [L1,0] : [L1,T];
  const tB = ext ? g.oe : g.ie;
  if(!tot){
  o.push(`<line class="virt" x1="${S(tA)[0]}" y1="${S(tA)[1]}" x2="${S(V)[0]}" y2="${S(V)[1]}"/>`);
  o.push(`<line class="virt" x1="${S(tB)[0]}" y1="${S(tB)[1]}" x2="${S(V)[0]}" y2="${S(V)[1]}"/>`);
  o.push(`<circle cx="${S(V)[0]}" cy="${S(V)[1]}" r="3" style="fill:var(--mut)"/>`);
  }
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
  o.push(`<text class="halo amb" x="${Q[0]+52}" y="${Q[1]+21}">Re ${fmt(R+T)}</text>`);
  place('dl-th',Q,0,-17); place('dl-ri',Q,0,17);
  // cotas editables
  RQ('dl-a1').hidden=tot; RQ('dl-a2').hidden=tot; RQ('dl-aw').hidden=!tot; RQ('dl-ah').hidden=!tot;
  if(tot){   // ancho y alto totales de la pieza (extremos reales)
    const xs=poly.map(p=>p[0]), ys=poly.map(p=>p[1]);
    const x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys);
    place('dl-aw',dim(o,S,[x0,y0],[x1,y0],[0,-1],34,null));
    place('dl-ah',dim(o,S,[x1,y0],[x1,y1],[1,0],34,null));
  } else {
    place('dl-a1',dim(o,S,A0,V,nA,34,null));
    place('dl-a2',dim(o,S,V,E2,nB,34,null));
  }
  place('dl-t',dim(o,S,[0,0],[0,T],[-1,0],22,null),-52,0);
  RQ('d2').innerHTML = o.join('');
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
  RQ('d3').innerHTML = o.join('');
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
  RQ('strip').innerHTML=o.join('');
  const t1=pos(b.s1), t2=pos(b.s2), lo=Math.min(t1,t2), hi=Math.max(t1,t2);
  RQ('stripNote').innerHTML = `Apoyá el <b>extremo de la ${refL}</b> en el cero y marcá la línea de plegado a <b>${fmt(pos(b.c))} mm</b> (centro del arco). Si preferís marcar el arco completo, hacelo entre <b>${fmt(lo)}</b> y <b>${fmt(hi)} mm</b>. Medida desde el otro extremo (${othL}): ${fmt(c.flat-pos(b.c))} mm.`;
}



/* ---------- Chapa desplegada (calculadora 2): F, d, e, Ri y θ editables ---------- */
function drawFlat(c,v){
  const W=680,H=270,X0=130,X1=630,y=70,h=30,b=c.bends[0],F=c.flat,k=(X1-X0)/F;
  const pos=x=>v.ref===1?x:F-x, X=x=>X0+pos(x)*k;
  const xa=Math.min(X(b.s1),X(b.s2)), xb=Math.max(X(b.s1),X(b.s2)), xc=X(b.c);
  const xm = v.dp==='c' ? xc : (v.ref===1 ? X(b.s1) : X(b.s2));
  const yt=34, yb=y+h+34, xe=X0-26;
  const mk='marker-start="url(#ar3)" marker-end="url(#ar3)"';
  const o=[`<defs><marker id="ar3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:var(--dim)"/></marker></defs>`];
  o.push(`<rect x="${X0}" y="${y}" width="${X1-X0}" height="${h}" class="part" rx="2"/>`);
  o.push(`<rect x="${xa}" y="${y}" width="${Math.max(xb-xa,1.5)}" height="${h}" style="fill:var(--amber);fill-opacity:.35"/>`);
  o.push(`<line class="bend" x1="${xa}" y1="${y-6}" x2="${xa}" y2="${y+h+6}"/><line class="bend" x1="${xb}" y1="${y-6}" x2="${xb}" y2="${y+h+6}"/>`);
  o.push(`<line class="neutral" x1="${xc}" y1="${y-10}" x2="${xc}" y2="${y+h+10}" style="stroke-width:1.6"/>`);
  o.push(`<text class="halo" x="${X0+6}" y="${y+h/2}" dominant-baseline="middle" style="font-weight:600">${v.ref===1?'A1':'A2'}</text>`);
  o.push(`<text class="halo" x="${X1-6}" y="${y+h/2}" text-anchor="end" dominant-baseline="middle" style="font-weight:600">${v.ref===1?'A2':'A1'}</text>`);
  // F (total)
  o.push(`<line class="ext" x1="${X0}" y1="${y-2}" x2="${X0}" y2="${yt-6}"/><line class="ext" x1="${X1}" y1="${y-2}" x2="${X1}" y2="${yt-6}"/>`);
  o.push(`<line class="dimln" x1="${X0}" y1="${yt}" x2="${X1}" y2="${yt}" ${mk}/>`);
  // d
  o.push(`<line class="ext" x1="${X0}" y1="${y+h+2}" x2="${X0}" y2="${yb+6}"/><line class="ext" x1="${xm}" y1="${y+h+8}" x2="${xm}" y2="${yb+6}"/>`);
  o.push(`<line class="dimln" x1="${X0}" y1="${yb}" x2="${xm}" y2="${yb}" ${mk}/>`);
  o.push(`<text x="${X0}" y="${yb+22}" style="fill:var(--muted);font-size:10px">▲ extremo de referencia (ala ${v.ref})</text>`);
  // e (espesor)
  o.push(`<line class="ext" x1="${X0-4}" y1="${y}" x2="${xe-6}" y2="${y}"/><line class="ext" x1="${X0-4}" y1="${y+h}" x2="${xe-6}" y2="${y+h}"/>`);
  o.push(`<line class="dimln" x1="${xe}" y1="${y}" x2="${xe}" y2="${y+h}" ${mk}/>`);
  // detalle del plegado (esquema) para Ri y θ
  const thv=num(RQ('bth').value), thOk=isFinite(thv)&&thv>0&&thv<180;
  const gi=geometry({legs:[40,40],bends:[{}]},{t:6,ri:16,th:thOk?thv:90});
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  gi.poly.forEach(p=>{x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);});
  const s2=Math.min(170/Math.max(x1-x0,1),68/Math.max(y1-y0,1)), ox=140+(170-(x1-x0)*s2)/2, oy=192+(68-(y1-y0)*s2)/2;
  const M=p=>[ox+(p[0]-x0)*s2, oy+(y1-p[1])*s2];
  o.push(`<text x="140" y="184" style="fill:var(--muted);font-size:10px">Detalle del plegado (esquema)</text>`);
  o.push(`<polygon class="part" points="${gi.poly.map(p=>pt(M(p))).join(' ')}"/>`);
  o.push(`<polyline class="bend" points="${gi.ai.map(p=>pt(M(p))).join(' ')}"/><polyline class="bend" points="${gi.ao.map(p=>pt(M(p))).join(' ')}"/>`);
  const am=(gi.p1+gi.p2)/2, aR=M(gi.P(gi.R,am)), aT=M(gi.P(gi.R+gi.T,am));
  o.push(`<line class="neutral" x1="388" y1="212" x2="${aR[0]}" y2="${aR[1]}" style="stroke-dasharray:none;stroke-width:.9"/>`);
  o.push(`<line class="neutral" x1="388" y1="246" x2="${aT[0]}" y2="${aT[1]}" style="stroke-dasharray:none;stroke-width:.9"/>`);
  RQ('dflat').innerHTML=o.join('');
  place('dl-f',[(X0+X1)/2,yt],0,0,W,H);
  place('dl-d',[Math.max((X0+xm)/2,X0+60),yb],0,0,W,H);
  place('dl-be',[xe-56,y+h/2],0,0,W,H);
  place('dl-bri',[440,212],0,0,W,H);
  place('dl-bth',[440,246],0,0,W,H);
}

/* ---------- Plantillas ---------- */
function plantilla(p,inv){
  const radio=(n,items)=>'<div class="seg">'+items.map(([id,val,lab,chk])=>`<input type="radio" name="${p}-${n}" data-id="${id}" id="${p}-${id}" value="${val}"${chk?' checked':''}><label for="${p}-${id}">${lab}</label>`).join('')+'</div>';
  const dl=(id,lab,inp,cls='',ro=false)=>`<label class="dl ${cls}${ro?' calc':''}" data-id="dl-${id}"><b>${lab}</b><input data-id="${inp}" type="text" inputmode="decimal" autocomplete="off" placeholder="0,0"${ro?' readonly tabindex="-1"':''}></label>`;
  const opts=`<div class="opts">
    <div class="optg"><div class="sl">Factor K</div><div class="inp"><input data-id="k" type="text" inputmode="decimal" autocomplete="off" placeholder="ej. 0,33"><span></span></div></div>
    <div class="optg"><div class="sl">Ancho 3D (opcional)</div><div class="inp"><input data-id="w" type="text" inputmode="decimal" autocomplete="off" placeholder="ej. 60"><span>mm</span></div></div>
    <div class="optg"><div class="sl">Acotar la pieza con…</div>${radio('dm',[['dm-a','a','Alas A1 y A2',1],['dm-t','t','Ancho y alto totales',0]])}</div>
    <div class="optg" data-id="g-mode"><div class="sl">Las medidas de las alas son…</div>${radio('mode',[['m-ext','ext','Exteriores',1],['m-int','int','Interiores',0]])}</div>
    <div class="optg"><div class="sl">Pliegue medido desde…</div>${radio('ref',[['r-1','1','Extremo ala 1',1],['r-2','2','Extremo ala 2',0]])}</div>
    <div class="optg"><div class="sl">La distancia llega hasta…</div>${radio('dp',[['dp-c','c','Centro del arco',1],['dp-t','t','Inicio del arco',0]])}</div>
  </div>`;
  const entrada = inv ? `
    <h3 class="sec">Chapa desplegada · desarrollo y datos del plegado (mm)</h3>
    <div class="falta" data-id="falta" aria-live="polite"></div><div class="errs" data-id="errs" role="alert"></div>
    <div class="d2wrap"><svg data-id="dflat" class="ghost" viewBox="0 0 680 270" role="img" aria-label="Chapa desplegada"></svg>
      ${dl('f','F','f')}${dl('d','d','d')}${dl('be','e','bt')}${dl('bri','Ri','bri','am')}${dl('bth','θ°','bth','am')}</div>`
  : `
    <h3 class="sec">Pieza plegada · medidas de la L (mm)</h3>
    <div class="falta" data-id="falta" aria-live="polite"></div><div class="errs" data-id="errs" role="alert"></div>
    <div class="d2wrap"><svg data-id="d2" class="ghost" viewBox="0 0 680 420" role="img" aria-label="Perfil de la pieza plegada"></svg>
      ${dl('a1','A1','a1')}${dl('a2','A2','a2')}${dl('aw','Ancho','aw')}${dl('ah','Alto','ah')}${dl('t','e','t')}${dl('ri','Ri','ri','am')}${dl('th','θ°','th','am')}</div>`;
  const pieza2 = inv ? `
    <h3 class="sec" style="margin-top:22px">Pieza plegada · medidas finales (mm)</h3>
    <div class="d2wrap"><svg data-id="d2" viewBox="0 0 680 420" role="img" aria-label="Perfil de la pieza plegada"></svg>
      ${dl('a1','A1','a1','',true)}${dl('a2','A2','a2','',true)}${dl('aw','Ancho','aw','',true)}${dl('ah','Alto','ah','',true)}${dl('t','e','t','',true)}${dl('ri','Ri','ri','am',true)}${dl('th','θ°','th','am',true)}</div>` : '';
  return `
  <section class="panel">${opts}${entrada}
    <div class="calcbar"><button class="primary" data-id="calc" type="button">Calcular</button><button data-id="reset" type="button">Restablecer</button>
      <div class="pbar" data-id="pbar" hidden><div class="ptrack"><i data-id="pfill"></i></div><span class="plab mono" data-id="plab" aria-live="polite"></span></div></div>
  </section>
  <section class="panel hero" data-id="resultado" tabindex="-1" hidden>
    <div class="lab" data-id="heroLab"></div><div class="total mono" data-id="total"></div><div class="note" data-id="heroNote" style="margin:0"></div>
    <div class="kpis">
      <div class="kpi"><b data-id="kBD"></b><i data-id="kBDl">Descuento de plegado (BD)</i></div>
      <div class="kpi"><b data-id="kBA"></b><i>Desarrollo del arco (BA)</i></div>
      <div class="kpi hl"><b data-id="kPos"></b><i data-id="kPosl">Distancia al pliegue (d)</i></div>
      <div class="kpi"><b data-id="kSB"></b><i data-id="kSBl">Setback</i></div>
      <div class="kpi"><b data-id="kW"></b><i>Ancho total de la pieza</i></div>
      <div class="kpi"><b data-id="kH"></b><i>Alto total de la pieza</i></div>
      <div class="kpi"><b data-id="kA1"></b><i>Ala 1 (A1, al centro del pliegue)</i></div>
      <div class="kpi"><b data-id="kA2"></b><i>Ala 2 (A2, al centro del pliegue)</i></div>
      <div class="kpi"><b data-id="kL1"></b><i>Ala 1 recta</i></div>
      <div class="kpi"><b data-id="kL2"></b><i>Ala 2 recta</i></div>
      <div class="kpi"><b data-id="kRi"></b><i>Radio interior</i></div>
      <div class="kpi"><b data-id="kRe"></b><i>Radio exterior</i></div>
    </div>
    ${pieza2}
    <h3 class="sec" style="margin-top:22px">Cómo marcar la chapa</h3>
    <svg data-id="strip" viewBox="0 0 680 150" role="img" aria-label="Chapa desarrollada con la posición del plegado"></svg>
    <p class="note" data-id="stripNote"></p>
    <h3 class="sec" style="margin-top:22px">Vista 3D</h3>
    <svg data-id="d3" viewBox="0 0 680 420" role="img" aria-label="Vista 3D de la pieza"></svg>
  </section>`;
}

/* ---------- Una calculadora (modo 'directo' o 'inverso') ---------- */
const pieza = v => ({t:v.t, k:v.k, mode:v.mode, alas:[v.a1,v.a2], pliegues:[{th:v.th, ri:v.ri}]});
function partes(v){
  const tn=Math.tan(v.th*RAD/2), ba=RAD*v.th*(v.ri+v.k*v.t), sb=(v.mode==='ext'?v.ri+v.t:v.ri)*tn;
  return {ba, sb, bd:2*sb-ba};
}
// Ancho y alto totales (extremos reales) → A1 y A2 (θ = ángulo de plegado)
function desdeTotales(v){
  const T=v.t, R=v.ri, th=v.th*RAD, s=Math.sin(th), c=Math.cos(th);
  let L1, L2;
  if(c>=-1e-9){ L2=(v.ah-T-R+R*c)/s; L1=v.aw-(R+T)*s-L2*c; }
  else {
    L2=(v.ah-T-R+(R+T)*c)/s; L1=v.aw-R-T;
    if(L1+R*s+L2*c < -1e-9) return {err:'Con ese ángulo el ala 2 vuelve por detrás del ala 1: usá las medidas de las alas.'};
  }
  if(!(L1>=-1e-9) || !(L2>=-1e-9)) return {err:'Con ese ancho y alto no entra el radio de plegado: revisá las medidas, el espesor o el radio.'};
  return {L1:Math.max(L1,0), L2:Math.max(L2,0)};
}
function bbox(g){
  const xs=g.poly.map(p=>p[0]), ys=g.poly.map(p=>p[1]);
  return {w:Math.max(...xs)-Math.min(...xs), h:Math.max(...ys)-Math.min(...ys)};
}
const errHtml = a => a.map(e=>'<div>⚠ '+e+'</div>').join('');

function crear(root, modo){
  const inv = modo==='inverso', p = inv?'b':'a';
  root.innerHTML = plantilla(p,inv);
  const r = id => root.querySelector('[data-id="'+id+'"]');
  const IN = inv ? {t:'bt',ri:'bri',th:'bth',f:'f',d:'d',k:'k',w:'w'} : {t:'t',ri:'ri',th:'th',a1:'a1',a2:'a2',aw:'aw',ah:'ah',k:'k',w:'w'};

  function leer(){
    const q = n => root.querySelector('input[name="'+p+'-'+n+'"]:checked').value;
    const v={mode:q('mode'), ref:+q('ref'), dp:q('dp'), dm:q('dm'), src:inv?'F':'L'}, errs=[], missing=[];
    const act=['t','ri','th','k','w',...(inv?['f','d']:(v.dm==='t'?['aw','ah']:['a1','a2']))];
    const REQ=act.filter(k=>k!=='w');
    Object.keys(IN).forEach(key=>{
      const el=r(IN[key]), box=el.closest('.dl')||el.closest('.inp'), raw=el.value.trim();
      if(!act.includes(key)){ el.classList.remove('bad'); box.classList.remove('bad','empty'); v[key]=NaN; return; }
      let bad=false; v[key]=NaN;
      if(raw!==''){
        const x=num(raw); v[key]=x;
        if(!isFinite(x)){ bad=true; errs.push('Revisá “'+LAB[key]+'”: ingresá un número.'); }
        else if(!RULES[key][0](x)){ bad=true; errs.push(RULES[key][1]); }
      }
      const falta = raw==='' && REQ.includes(key);
      if(falta) missing.push(LAB[key]);
      el.classList.toggle('bad',bad); box.classList.toggle('bad',bad); box.classList.toggle('empty',falta);
    });
    return {v,errs,missing};
  }
  // directo: A1, A2 → desarrollo · inverso: desarrollo + distancia al pliegue → A1, A2
  function resolver(v0){
    const v={...v0};
    if(!inv && v.dm==='t'){
      const x=desdeTotales(v); if(x.err) return {errs:[x.err]};
      v.mode='ext'; const sbx=partes(v).sb; v.a1=x.L1+sbx; v.a2=x.L2+sbx;
    }
    if(inv){
      const {ba,sb,bd}=partes(v);
      const Aref=v.d-(v.dp==='c'?ba/2:0)+sb, Aoth=v.f+bd-Aref;
      if(!(Aref>0)||!(Aoth>0)) return {errs:['Con esos datos una de las alas queda en 0 o negativa: revisá el desarrollo, la distancia al pliegue o el radio.']};
      v.a1=v.ref===1?Aref:Aoth; v.a2=v.ref===1?Aoth:Aref;
    }
    const c=calcular(pieza(v));
    return {v,c,errs:c.err};
  }
  function dDe(c,v){
    const b=c.bends[0], ini=v.ref===1?b.s1:c.flat-b.s2, cen=v.ref===1?b.c:c.flat-b.c;
    return v.dp==='c'?cen:ini;
  }
  const ocultar = () => { r('resultado').hidden = true; };
  function pintar(v,c,ghost){
    RQ=r;
    if(inv){ drawFlat(c,v); r('dflat').classList.toggle('ghost',ghost); }
    else { draw2D(geometry(c,v),c,v); r('d2').classList.toggle('ghost',ghost); }
  }
  function refrescar(invalida){
    RQ=r;
    const {v,errs,missing}=leer();
    if(invalida) ocultar();
    if(!inv) r('g-mode').hidden = v.dm==='t';
    const all=errs.slice(); let real=false, c=null, vv=v;
    if(!errs.length && !missing.length){
      const rs=resolver(v);
      if(rs.errs.length) all.push(...rs.errs); else { real=true; c=rs.c; vv=rs.v; }
    }
    r('errs').innerHTML=errHtml(all);
    const n=missing.length, f=r('falta');
    f.className='falta'+(n||all.length?'':' ok');
    f.textContent = n ? 'Faltan '+n+' dato'+(n>1?'s':'')+': completá las celdas que titilan.' : (all.length ? 'Corregí los valores marcados en rojo.' : 'Datos completos · tocá Calcular.');
    if(real) pintar(vv,c,false);
    else { const vg={...GH,mode:v.mode,ref:v.ref,dp:v.dp,dm:v.dm}; pintar(vg,calcular(pieza(vg)),true); }
  }
  function animar(fin){
    const btn=r('calc'), bar=r('pbar'), fill=r('pfill'), lab=r('plab');
    const dur = matchMedia('(prefers-reduced-motion:reduce)').matches ? 250 : 1400;
    const pasos=['Leyendo datos','Calculando setback','Calculando arco de plegado','Armando resultado'];
    btn.disabled=true; bar.hidden=false; fill.style.width='0%'; const t0=performance.now();
    (function tick(now){
      const q=Math.min(1,(now-t0)/dur), e=q<.5?2*q*q:1-Math.pow(-2*q+2,2)/2;
      fill.style.width=(e*100)+'%';
      lab.textContent=pasos[Math.min(3,Math.floor(e*4))]+'… '+Math.round(e*100)+'%';
      if(q<1) requestAnimationFrame(tick);
      else setTimeout(()=>{ fin(); btn.disabled=false; setTimeout(()=>{ bar.hidden=true; },500); },150);
    })(t0);
  }
  function mostrar(){
    RQ=r;
    const {v,errs,missing}=leer(); if(errs.length||missing.length) return;
    const rs=resolver(v); if(rs.errs.length){ r('errs').innerHTML=errHtml(rs.errs); return; }
    const vv=rs.v, c=rs.c, b=c.bends[0], ext=vv.mode==='ext', dOut=dDe(c,vv), g=geometry(c,vv), bb=bbox(g);
    pintar(vv,c,false);
    if(inv){   // pieza final de solo lectura
      [['a1',vv.a1],['a2',vv.a2],['aw',bb.w],['ah',bb.h],['t',vv.t],['ri',vv.ri],['th',vv.th]].forEach(([id,val])=>{ r(id).value=fmtIn(val); });
      draw2D(g,c,vv); r('d2').classList.remove('ghost');
    }
    draw3D(g,{...vv,w:vv.w>0?vv.w:Math.max(vv.a1,vv.a2)*0.6});
    const mm='<small>mm</small>', med=(!inv&&vv.dm==='t')?'totales: ancho y alto':(ext?'exteriores':'interiores'), ini=vv.dp==='c'?'centro':'inicio', T=r('total');
    T.classList.toggle('dual',inv);
    if(!inv){
      r('heroLab').textContent='DESARROLLO TOTAL (mm)';
      T.innerHTML=fmt(c.flat)+mm;
      r('heroNote').textContent='Largo de chapa a cortar antes de plegar (medidas '+med+'). Pliegue a '+fmt(dOut)+' mm del extremo del ala '+vv.ref+' ('+ini+' del arco).';
    } else {
      r('heroLab').textContent='MEDIDAS FINALES DE LA L (mm)';
      T.innerHTML = vv.dm==='t' ? fmt(bb.w)+'<small>ancho</small>'+fmt(bb.h)+'<small>alto</small>' : fmt(vv.a1)+'<small>A1</small>'+fmt(vv.a2)+'<small>A2</small>';
      r('heroNote').textContent='Medidas '+med+' de la pieza plegada, para una chapa de '+fmt(c.flat)+' mm con el pliegue a '+fmt(vv.d)+' mm del extremo del ala '+vv.ref+' ('+ini+' del arco).';
    }
    r('kBD').textContent=fmt(b.bd)+' mm'; r('kBDl').textContent='Descuento de plegado (BD, '+(ext?'ext.':'int.')+')';
    r('kBA').textContent=fmt(b.ba)+' mm';
    r('kSB').textContent=fmt(b.sb)+' mm'; r('kSBl').textContent=ext?'Outside setback (OSSB)':'Inside setback (ISSB)';
    r('kL1').textContent=fmt(c.legs[0])+' mm'; r('kL2').textContent=fmt(c.legs[1])+' mm';
    r('kRi').textContent=fmt(b.ri)+' mm'; r('kRe').textContent=fmt(b.re)+' mm';
    r('kW').textContent=fmt(bb.w)+' mm'; r('kH').textContent=fmt(bb.h)+' mm';
    r('kA1').textContent=fmt(vv.a1)+' mm'; r('kA2').textContent=fmt(vv.a2)+' mm';
    r('kPos').textContent=fmt(dOut)+' mm';
    r('kPosl').textContent='Distancia al pliegue (d): hasta el '+ini+' del arco, desde el extremo del ala '+vv.ref;
    drawStrip(c,vv,x=>vv.ref===1?x:c.flat-x);
    const Rs=r('resultado'); Rs.hidden=false; Rs.classList.remove('reveal'); void Rs.offsetWidth; Rs.classList.add('reveal');
    Rs.scrollIntoView({behavior:'smooth',block:'start'});
  }

  root.addEventListener('input', ()=>refrescar(true));
  root.addEventListener('keydown', e=>{ if(e.key==='Enter' && e.target.type==='text'){ e.preventDefault(); r('calc').click(); } });
  r('calc').addEventListener('click', ()=>{
    RQ=r;
    const {v,errs,missing}=leer();
    if(errs.length||missing.length){
      refrescar(false);
      if(missing.length){
        const em=[...root.querySelectorAll('.empty')];
        em.forEach(e=>{ e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); });
        const f=em.map(e=>e.querySelector('input')).find(Boolean); if(f) f.focus();
        r('errs').innerHTML+='<div>Faltan: '+missing.join(', ')+'.</div>';
      }
      return;
    }
    const rs=resolver(v);
    if(rs.errs.length){ r('errs').innerHTML=errHtml(rs.errs); return; }
    animar(mostrar);
  });
  r('reset').addEventListener('click', ()=>{
    root.querySelectorAll('input[type=text]').forEach(i=>{ i.value=''; });
    ['m-ext','r-1','dp-c','dm-a'].forEach(id=>{ r(id).checked=true; });
    ocultar(); refrescar(false);
  });
  refrescar(false);
}

/* ---------- Pestañas e inicio ---------- */
crear(document.getElementById('pa'),'directo');
crear(document.getElementById('pb'),'inverso');
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>{ x.classList.toggle('on',x===t); x.setAttribute('aria-selected',x===t); });
  ['pa','pb'].forEach(id=>{ document.getElementById(id).hidden = id!==t.dataset.t; });
}));
