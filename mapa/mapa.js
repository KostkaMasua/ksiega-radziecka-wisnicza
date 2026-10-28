// Mapa Nowego Wiśnicza 1847: teren NMT, kataster, bryły ratusza i kościoła, modele domów (GLB).
// Ładowana dopiero po otwarciu zakładki Mapa. Wymaga globalnego maplibregl i importmap dla 'three'.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
// ===== Bryły budynków: proceduralna rekonstrukcja wg rysunków Matejki (przed pożarem 1863) =====
// Układ współrzędnych wierzchołków: metry, x = wschód, y = południe (jak w Mercatorze), z = w górę.
const BRYLY = (() => {
  const TAU = Math.PI * 2;
  function rnd(id, k) { const x = Math.sin(id * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); }

  // ---------- tekstury rysowane na canvasie ----------
  function tex(draw, size = 256) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); draw(g, size);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const R = (a, b, s) => a + (b - a) * s;
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f)))); return `rgb(${c})`; }
  let seed = 7; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const T = {
    gont: tex((g, s) => { // gonty: rzędy zachodzących deszczułek, wypłowiałe na srebrnoszaro
      g.fillStyle = '#6d6455'; g.fillRect(0, 0, s, s);
      const rows = 12, rh = s / rows;
      for (let r = 0; r < rows; r++) { let x = (r % 2) * 7 - 12;
        while (x < s) { const w = 11 + rr() * 11, t = rr(); g.fillStyle = t < 0.5 ? shade('#9a8c76', 0.8 + rr() * 0.35) : shade('#8f8a80', 0.8 + rr() * 0.35); g.fillRect(x, r * rh, w - 1.2, rh - 1);
          g.fillStyle = 'rgba(30,24,16,.38)'; g.fillRect(x, r * rh + rh - 2.5, w, 2.5); g.fillStyle = 'rgba(255,250,235,.12)'; g.fillRect(x, r * rh, w - 1.2, 2); x += w; } }
      for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(70,80,50,${rr() * 0.12})`; g.beginPath(); g.ellipse(rr() * s, rr() * s, 10 + rr() * 25, 6 + rr() * 12, 0, 0, TAU); g.fill(); }
    }),
    bielone: tex((g, s) => { // zrąb bielony wapnem (fronty domów rynkowych na rysunkach Matejki)
      const n = 8, h = s / n;
      for (let i = 0; i < n; i++) { const gr = g.createLinearGradient(0, i * h, 0, i * h + h), bb = 0.93 + rr() * 0.07;
        gr.addColorStop(0, shade('#cfc4ad', bb)); gr.addColorStop(0.5, shade('#ebe3d0', bb)); gr.addColorStop(1, shade('#bfb39a', bb));
        g.fillStyle = gr; g.fillRect(0, i * h, s, h); g.fillStyle = 'rgba(90,75,55,.35)'; g.fillRect(0, i * h + h - 2, s, 2); }
      for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(110,90,60,${rr() * 0.08})`; g.fillRect(rr() * s, rr() * s, 2 + rr() * 8, 1 + rr() * 3); }
    }),
    drewno: tex((g, s) => { // zrąb z bali
      const n = 8, h = s / n;
      for (let i = 0; i < n; i++) { const gr = g.createLinearGradient(0, i * h, 0, i * h + h);
        const b = 0.85 + rr() * 0.3; gr.addColorStop(0, shade('#5e4430', b)); gr.addColorStop(0.45, shade('#8f6c4a', b)); gr.addColorStop(1, shade('#4c3626', b));
        g.fillStyle = gr; g.fillRect(0, i * h, s, h); g.fillStyle = 'rgba(30,20,10,.55)'; g.fillRect(0, i * h + h - 2, s, 2);
        for (let k = 0; k < 6; k++) { g.strokeStyle = 'rgba(40,28,16,.25)'; g.beginPath(); const y = i * h + 4 + rr() * (h - 8); g.moveTo(0, y); g.lineTo(s, y + rr() * 3 - 1.5); g.stroke(); } }
    }),
    deski: tex((g, s) => { // szczyt szalowany deskami
      const n = 10, w = s / n;
      for (let i = 0; i < n; i++) { g.fillStyle = shade('#7b5f45', 0.8 + rr() * 0.35); g.fillRect(i * w, 0, w, s); g.fillStyle = 'rgba(25,15,8,.6)'; g.fillRect(i * w, 0, 2, s); }
    }),
    tynk: tex((g, s) => {
      g.fillStyle = '#e4dac4'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${rr() < .5 ? '120,100,70' : '255,250,235'},${rr() * 0.08})`; g.fillRect(rr() * s, rr() * s, 2 + rr() * 6, 2 + rr() * 6); }
      const gr = g.createLinearGradient(0, s, 0, s * 0.6); gr.addColorStop(0, 'rgba(110,90,60,.22)'); gr.addColorStop(1, 'rgba(110,90,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }),
    kamien: tex((g, s) => {
      g.fillStyle = '#5c5850'; g.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 28) for (let x = -(y % 56); x < s; x += 34 + rr() * 20) {
        g.fillStyle = shade('#8f897d', 0.75 + rr() * 0.4); g.beginPath(); g.ellipse(x + 18, y + 14, 16 + rr() * 6, 11 + rr() * 3, rr() * .3, 0, TAU); g.fill(); }
    }),
    ciemne: tex((g, s) => { g.fillStyle = '#4a3828'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(20,12,6,${.2 + rr() * .3})`; g.beginPath(); const x = rr() * s; g.moveTo(x, 0); g.lineTo(x + rr() * 6 - 3, s); g.stroke(); } }),
    blacha: tex((g, s) => { g.fillStyle = '#56645a'; g.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 16) { g.fillStyle = 'rgba(20,30,25,.45)'; g.fillRect(x, 0, 2, s); } }),
  };
  const PLAIN = { okno: '#221d18', rama: '#c9b994', drzwi: '#4a3524' };
  const UVS = { bielone: 1 / 1.7, gont: 1 / 2.0, drewno: 1 / 1.7, deski: 1 / 2.0, tynk: 1 / 3.5, kamien: 1 / 2.2, ciemne: 1 / 1.2, blacha: 1 / 3 };

  // ---------- zapis geometrii ----------
  class Buf { constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.b = []; } }
  const MATS = ['gont', 'bielone', 'drewno', 'deski', 'tynk', 'kamien', 'ciemne', 'blacha', 'okno', 'rama', 'drzwi'];
  let B, CUR, TINT;
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function nrm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // wielokąt wypukły; kolejność wierzchołków dowolna co do strony – normalną kierujemy od środka bryły (ref)
  function poly(mat, pts, ref) {
    if (pts.length < 3) return;
    let n = [0, 0, 0];
    for (let i = 1; i + 1 < pts.length; i++) { const c = cross(sub(pts[i], pts[0]), sub(pts[i + 1], pts[0])); n = [n[0] + c[0], n[1] + c[1], n[2] + c[2]]; }
    if (Math.hypot(...n) < 1e-9) return; n = nrm(n);
    const cen = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length], [0, 0, 0]);
    if (ref && dot(n, sub(cen, ref)) < 0) { pts = pts.slice().reverse(); n = [-n[0], -n[1], -n[2]]; }
    let u = Math.abs(n[2]) > 0.97 ? [1, 0, 0] : nrm(cross([0, 0, 1], n)); const v = cross(n, u);
    const k = UVS[mat] || 1, buf = B[mat];
    for (let i = 1; i + 1 < pts.length; i++) for (const p of [pts[0], pts[i + 1], pts[i]]) {
      buf.p.push(p[0], p[1], p[2]); buf.n.push(n[0], n[1], n[2]); buf.uv.push(dot(p, u) * k, dot(p, v) * k);
      buf.c.push(TINT[0], TINT[1], TINT[2]); buf.b.push(CUR);
    }
  }
  // lokalna ramka budynku: środek, kierunek osi kalenicy
  function frame(x, y, ang, z0) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    // dane mają y na północ; w ramce wierzchołków y rośnie na południe
    return (lx, ly, lz) => [x + lx * ca - ly * sa, -(y + lx * sa + ly * ca), z0 + lz];
  }
  function box(F, mat, x0, x1, y0, y1, z0, z1, skipBottom = true) {
    const P = (x, y, z) => F(x, y, z), ref = F((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    poly(mat, [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], ref);
    poly(mat, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], ref);
    poly(mat, [P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1)], ref);
    poly(mat, [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], ref);
    poly(mat, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], ref);
    if (!skipBottom) poly(mat, [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)], ref);
  }
  // belka między dwoma punktami lokalnymi (słupy, zastrzały, oczepy)
  function beam(F, mat, a, b, t) {
    const d = sub(b, a), L = Math.hypot(...d); if (L < 1e-3) return;
    const ax = nrm(d); let p1 = Math.abs(ax[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    const s1 = nrm(cross(ax, p1)), s2 = nrm(cross(ax, s1)); const h = t / 2;
    const c = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([i, j]) => [s1[0] * i + s2[0] * j, s1[1] * i + s2[1] * j, s1[2] * i + s2[2] * j]);
    const A = c.map(o => F(a[0] + o[0], a[1] + o[1], a[2] + o[2])), Bq = c.map(o => F(b[0] + o[0], b[1] + o[1], b[2] + o[2]));
    const ref = F((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; poly(mat, [A[i], A[j], Bq[j], Bq[i]], ref); }
    poly(mat, A, ref); poly(mat, Bq, ref);
  }
  // otwór na ścianie: ściana w płaszczyźnie x=const (oś 'x') lub y=const (oś 'y'); out = znak normalnej
  function opening(F, mat, axis, at, out, c, z0, w, h, frameMat) {
    const e = 0.04 * out;
    const Q = (s, z, off) => axis === 'x' ? F(at + off, s, z) : F(s, at + off, z);
    const ref = axis === 'x' ? F(at - out, c, z0 + h / 2) : F(c, at - out, z0 + h / 2);
    if (frameMat) { const m = 0.09; poly(frameMat, [Q(c - w / 2 - m, z0 - m, e * 0.6), Q(c + w / 2 + m, z0 - m, e * 0.6), Q(c + w / 2 + m, z0 + h + m, e * 0.6), Q(c - w / 2 - m, z0 + h + m, e * 0.6)], ref); }
    poly(mat, [Q(c - w / 2, z0, e), Q(c + w / 2, z0, e), Q(c + w / 2, z0 + h, e), Q(c - w / 2, z0 + h, e)], ref);
  }
  function arch(F, mat, axis, at, out, c, z0, w, h) { // brama/arkada: prostokąt + półkole
    const e = 0.05 * out, r = w / 2, pts = [];
    const Q = (s, z) => axis === 'x' ? F(at + e, s, z) : F(s, at + e, z);
    pts.push(Q(c - r, z0)); pts.push(Q(c + r, z0));
    for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; pts.push(Q(c + r * Math.cos(a), z0 + h - r + r * Math.sin(a))); }
    const ref = axis === 'x' ? F(at - out, c, z0 + 1) : F(c, at - out, z0 + 1);
    poly(mat, pts, ref);
  }

  // ---------- dach: dwuspadowy / naczółkowy / czterospadowy ----------
  // x wzdłuż kalenicy, y w poprzek; f = 1 szczyt pełny, 0 < f < 1 naczółek, f = 0 dach czterospadowy
  function roof(F, o) {
    const { xm, xp, W, h, th, f, oyp, oym, gableMat, roofMat } = o;
    const tn = Math.tan(th), H = (W / 2) * tn, zr = h + H;
    const ze_p = h - oyp * tn, ze_m = h - oym * tn, wp = W / 2 + oyp, wm = W / 2 + oym;
    const zk_p = ze_p + f * (zr - ze_p), zk_m = ze_m + f * (zr - ze_m);
    const zk = Math.min(zk_p, zk_m), wkp = (zr - zk) / tn, wkm = wkp;
    const run = (zr - zk) / Math.tan(th + 0.08);
    const mid = (xp + xm) / 2, rP = Math.max(xp - run, mid + 0.01), rM = Math.min(xm + run, mid - 0.01);
    const ref = F((xm + xp) / 2, 0, h);
    const P = (x, y, z) => F(x, y, z);
    // połacie główne
    poly(roofMat, [P(xm, wp, ze_p), P(xp, wp, ze_p), P(xp, wkp, zk), P(rP, 0, zr), P(rM, 0, zr), P(xm, wkp, zk)], ref);
    poly(roofMat, [P(xm, -wm, ze_m), P(xp, -wm, ze_m), P(xp, -wkm, zk), P(rP, 0, zr), P(rM, 0, zr), P(xm, -wkm, zk)], ref);
    // naczółki / połacie szczytowe
    if (f < 0.999) { poly(roofMat, [P(xp, -wkm, zk), P(xp, wkp, zk), P(rP, 0, zr)], ref); poly(roofMat, [P(xm, -wkm, zk), P(xm, wkp, zk), P(rM, 0, zr)], ref); }
    // szczyty (deski / tynk) w płaszczyźnie okapu szczytowego
    if (f > 0.02) for (const x of [xp, xm]) poly(gableMat, [P(x, -wm, ze_m), P(x, wp, ze_p), P(x, wkp, zk), P(x, -wkm, zk)], ref);
    else { // przy pełnym czterospadowym domknij trójkąty pod okapem
      for (const x of [xp, xm]) poly(gableMat, [P(x, -wm, ze_m), P(x, wp, ze_p), P(x, 0, Math.min(ze_m, ze_p) + 0.01)], ref); }
    return { zr, ze: Math.min(ze_p, ze_m) };
  }

  // ---------- typowe budynki ----------
  // Źródła reguł: rysunki J. Matejki (Wiśnicz przed pożarem 1863); domy rynkowe szczytowe z obszernymi
  // podcieniami (Lipnica Murowana, Czchów, Zakliczyn); słupy „lipnickie” z romboidalnym przewężeniem
  // (proporcja ok. 1:16); dachy dwuspadowe i naczółkowe kryte gontem; ratusz 1616–1620 parterowy z wieżą.
  function slup(F, x, y, hp, arch) { // słup podcienia: podstawa, romb, trzon, siodło
    beam(F, 'ciemne', [x, y, 0], [x, y, hp * 0.3], 0.24);
    beam(F, 'ciemne', [x, y, hp * 0.3], [x, y, hp * 0.4], 0.15);
    beam(F, 'ciemne', [x, y, hp * 0.4], [x, y, hp * 0.47], 0.24);
    beam(F, 'ciemne', [x, y, hp * 0.47], [x, y, hp - 0.14], 0.2);
  }
  function podcien(F, axisX, at, a0, a1, hp, n, luki, mur) { // rząd słupów wzdłuż frontu
    const pos = []; for (let k = 0; k < n; k++) pos.push(a0 + (a1 - a0) * k / (n - 1));
    const P = (u, z) => axisX ? [at, u, z] : [u, at, z];
    for (const u of pos) { const [x, y] = P(u, 0);
      if (mur) beam(F, 'tynk', [x, y, 0], [x, y, hp], 0.62); else slup(F, x, y, hp);
      if (!mur) { const d = 0.45; beam(F, 'ciemne', P(u - d, hp - 0.08), P(u + d, hp - 0.08), 0.16); } }
    beam(F, mur ? 'tynk' : 'ciemne', P(a0 - 0.15, hp + 0.06), P(a1 + 0.15, hp + 0.06), mur ? 0.5 : 0.26);
    if (luki) for (let k = 0; k + 1 < n; k++) { // drewniane łuki między słupami (rys. „Domy podcieniowe”)
      const u0 = pos[k] + 0.12, u1 = pos[k + 1] - 0.12, r = (u1 - u0) / 2, c = (u0 + u1) / 2, zc = hp - Math.min(r * 0.9, 0.9) - 0.1; let prev = null;
      for (let j = 0; j <= 8; j++) { const t = Math.PI * j / 8, pt = P(c - r * Math.cos(t), zc + Math.sin(t) * Math.min(r * 0.9, 0.9) * (j === 4 ? 1.12 : 1));
        if (prev) beam(F, mur ? 'tynk' : 'ciemne', prev, pt, mur ? 0.3 : 0.12); prev = pt; } }
  }
  function okna(F, axis, at, sg, c0, c1, z, w, h, mat, okiennice, skip) {
    const len = c1 - c0, n = Math.max(0, Math.floor(len / 2.7));
    for (let k = 0; k < n; k++) { const c = c0 + (k + 0.5) * len / n; if (skip && Math.abs(c - skip) < 1.2) continue;
      opening(F, 'okno', axis, at, sg, c, z, w, h, 'rama');
      if (okiennice) for (const sd of [-1, 1]) opening(F, 'drzwi', axis, at, sg * 0.6, c + sd * (w / 2 + 0.22), z, 0.38, h, null); }
  }

  // jeden dom (lub segment pierzei) w ramce lokalnej: x = oś kalenicy, front: 0 (+x), 1 (-x), 2 (+y), 3 (-y)
  function dom1(o, ex) {
    const { x, y, ang, L, W, zmin, zmax, mur, front, rynek, sid } = o;
    const r = k => rnd(sid, k);
    const v = 0.9 + r(1) * 0.2; TINT = [v, v * (0.97 + r(2) * 0.05), v * (0.94 + r(3) * 0.06)];
    const zf = (zmin + Math.min(1.0, zmax - zmin)) * ex + 0.25, F = frame(x, y, ang, zf);
    box(F, 'kamien', -L / 2, L / 2, -W / 2, W / 2, zmin * ex - zf - 0.8, 0.0);
    const gableFront = front === 0 || front === 1, sg = front === 1 ? -1 : 1;
    const galeria = !mur && rynek && gableFront && o.area > 140 && r(11) < 0.45;
    let h = mur ? (o.area > 120 ? 6.4 : 4.4) : (3.0 + r(4) * 0.5 + (rynek ? 0.4 : 0));
    const h1 = h; if (galeria) h += 2.7;
    const wallMat = mur ? 'tynk' : ((rynek || r(12) < 0.35) ? 'bielone' : 'drewno');
    // podcień wycięty z obrysu (na mapie katastralnej podcień leży w obrysie domu)
    const p = rynek && gableFront ? Math.min(2.6 + r(8) * 1.0, L * 0.32) : 0;
    const wx0 = -L / 2 + (front === 1 ? p : 0), wx1 = L / 2 - (front === 0 ? p : 0);
    box(F, wallMat, wx0, wx1, -W / 2, W / 2, 0, h1);
    if (galeria) { // piętro z otwartą galerią arkadową (rys. „Domy drewniane w rynku”)
      box(F, 'deski', wx0, wx1, -W / 2, W / 2, h1, h1 + 1.0);
      box(F, 'bielone', wx0 + (front === 1 ? 1.4 : 0), wx1 - (front === 0 ? 1.4 : 0), -W / 2 + 1.2, W / 2 - 1.2, h1, h);
      const nA = Math.max(3, Math.round(W / 1.9)); for (let k = 0; k <= nA; k++) { const yy = -W / 2 + 0.15 + (W - 0.3) * k / nA; beam(F, 'ciemne', [sg * (L / 2 - p - 0.15), yy, h1 + 1.0], [sg * (L / 2 - p - 0.15), yy, h], 0.18); }
      for (const sy of [-1, 1]) for (let k = 0; k <= 4; k++) { const xx = wx0 + (wx1 - wx0) * k / 4; beam(F, 'ciemne', [xx, sy * (W / 2 - 0.15), h1 + 1.0], [xx, sy * (W / 2 - 0.15), h], 0.18); }
      podcien(F, true, sg * (L / 2 - p - 0.15), -W / 2 + 0.3, W / 2 - 0.3, h - 0.2, nA + 1, true, false);
    }
    if (mur) box(F, 'tynk', wx0 - 0.15, wx1 + 0.15, -W / 2 - 0.15, W / 2 + 0.15, h - 0.35, h - 0.05);
    // dach: wysoki, stromy, gont; naczółek albo pełny szczyt
    let th = (mur ? 50 + r(5) * 6 : 54 + r(5) * 8) * Math.PI / 180;
    const sq = L / W < 1.15;
    let f;
    if (galeria) { f = 0; th = 50 * Math.PI / 180; }
    else if (mur) f = sq ? 0 : (r(6) < 0.55 ? 1 : 0.78);
    else f = sq ? (r(6) < 0.5 ? 0 : 0.5) : (r(6) < 0.6 ? 0.62 + r(7) * 0.18 : 1);
    const o_ = mur ? 0.45 : 0.85, oe = mur ? 0.3 : 0.6;
    let xm = -L / 2 - oe, xp = L / 2 + oe, oyp = o_, oym = o_;
    const pe = !gableFront && rynek ? 2.8 : 0; // podcień pod okapem (domy kalenicowe)
    if (front === 2 && pe) oyp = 0; if (front === 3 && pe) oym = 0;
    const gableMat = mur ? 'tynk' : 'deski';
    const { zr, ze } = roof(F, { xm, xp, W, h, th, f, oyp, oym, gableMat, roofMat: 'gont' });
    const H = zr - h;
    if (!mur && f > 0.3 && !galeria) for (const sx of [1, -1]) { // daszek okapowy na szczycie + okienko strychowe
      const xg = sx > 0 ? xp : xm, zd = h + H * 0.28, half = (W / 2 + o_) - (zd - (h - o_ * Math.tan(th))) / Math.tan(th);
      if (half > 0.8) { const ref = F(0, 0, zd);
        poly('gont', [F(xg, -half, zd), F(xg, half, zd), F(xg + sx * 0.7, half, zd - 0.35), F(xg + sx * 0.7, -half, zd - 0.35)], ref);
        opening(F, 'okno', 'x', xg, sx, 0, zd + 0.5, 0.5, 0.55, null); } }
    // podcień szczytowy
    if (p) { const xo = sg * (L / 2 - 0.2), n = Math.max(3, Math.round(W / 2.3) + 1), hp = Math.max(2.4, Math.min(h1, ze + 0.2) - 0.1);
      if (!galeria) podcien(F, true, xo, -W / 2 + 0.2, W / 2 - 0.2, hp, n, rynek && r(9) < 0.5, false);
      else for (let k = 0; k < n; k++) slup(F, xo, -W / 2 + 0.2 + (W - 0.4) * k / (n - 1), h1);
      box(F, 'kamien', sg > 0 ? L / 2 - p : -L / 2, sg > 0 ? L / 2 : -L / 2 + p, -W / 2, W / 2, -0.4, 0.15);
      // drewniane rynny wysunięte nad ulicę (rys. Matejki „Deszcz”)
      for (const sy of [-1, 1]) beam(F, 'ciemne', [sg * (L / 2 - 1.5), sy * (W / 2 + 0.3), ze + 0.15], [sg * (L / 2 + 2.0), sy * (W / 2 + 0.3), ze + 0.35], 0.26);
    }
    if (pe) { const sy = front === 2 ? 1 : -1, zo = h - pe * Math.tan(15 * Math.PI / 180), ref = F(0, 0, h);
      poly('gont', [F(xm, sy * W / 2, h), F(xp, sy * W / 2, h), F(xp, sy * (W / 2 + pe), zo), F(xm, sy * (W / 2 + pe), zo)], ref);
      podcien(F, false, sy * (W / 2 + pe - 0.2), -L / 2 + 0.2, L / 2 - 0.2, zo - 0.1, Math.max(3, Math.round(L / 2.5) + 1), false, mur);
      box(F, 'kamien', -L / 2, L / 2, sy > 0 ? W / 2 : -W / 2 - pe, sy > 0 ? W / 2 + pe : -W / 2, -0.4, 0.15); }
    // okna, okiennice, drzwi, brama
    const wz = mur ? 1.1 : 0.95, ww = mur ? 0.9 : 0.68, wh = mur ? 1.3 : 0.78, ok = !mur;
    for (const sy of [1, -1]) { okna(F, 'y', sy * W / 2, sy, wx0, wx1, wz, ww, wh, null, ok, (front === (sy > 0 ? 2 : 3)) ? 0 : null);
      if (mur && h > 6) okna(F, 'y', sy * W / 2, sy, wx0, wx1, wz + 3.0, ww, wh, null, false, null); }
    for (const sx of [1, -1]) { const at = sx > 0 ? wx1 : wx0, isF = gableFront && sx === sg;
      okna(F, 'x', at, sx, -W / 2, W / 2, wz, ww, wh, null, ok, isF ? 0 : null); }
    if (front >= 0) { const ax = gableFront ? 'x' : 'y', at = gableFront ? (sg > 0 ? wx1 : wx0) : (front === 2 ? W / 2 : -W / 2), s2 = gableFront ? sg : (front === 2 ? 1 : -1);
      if (mur && o.area > 90) arch(F, 'okno', ax, at, s2, 0, 0, 2.6, 3.2); else opening(F, 'drzwi', ax, at, s2, 0, 0, 1.0, 2.05, 'rama'); }
    // komin
    if (mur || r(10) < 0.6) { const cx = (r(13) - 0.5) * L * 0.35; box(F, mur ? 'tynk' : 'kamien', cx - 0.4, cx + 0.4, -0.4, 0.4, zr - 1.6, zr + 1.1);
      box(F, mur ? 'tynk' : 'kamien', cx - 0.5, cx + 0.5, -0.5, 0.5, zr + 0.9, zr + 1.15); }
  }

  // podział długich pierzei na wąskie domy szczytowe (działki ok. 8–10 m frontu)
  function dom(d, i, ex) {
    const [x, y, ang, L, W, zmin, zmax, mur, front, porch, open, nopen, id, area] = d;
    const rynek = !!porch && open >= 24;
    const base = { zmin, zmax, mur, rynek, area };
    if (front < 0 || (!rynek && !(front >= 0 && (front < 2 ? W : L) > 16))) { dom1({ ...base, x, y, ang, L, W, front, sid: id }, ex); return; }
    // oś frontu i głębokość
    let a = ang, Ld = L, Wf = W, fr = front;
    if (front === 2 || front === 3) { a = ang + Math.PI / 2; Ld = W; Wf = L; fr = front === 2 ? 0 : 1; }
    const target = mur ? 10 : 8.5, n = Math.max(1, Math.round(Wf / target));
    if (!rynek && n === 1) { dom1({ ...base, x, y, ang, L, W, front, sid: id }, ex); return; }
    const ca = Math.cos(a), sa = Math.sin(a), w = Wf / n;
    for (let k = 0; k < n; k++) {
      const off = -Wf / 2 + w * (k + 0.5), sid = id * 17 + k;
      const dep = Ld * (0.82 + rnd(sid, 20) * 0.18), sh = (fr === 0 ? 1 : -1) * (Ld - dep) / 2;
      const cx = x + sh * ca - off * sa, cy = y + sh * sa + off * ca;
      if (rynek || mur === 0) dom1({ ...base, x: cx, y: cy, ang: a, L: dep, W: w - 0.05, front: fr, sid, area: dep * w }, ex);
      else dom1({ ...base, x: cx, y: cy, ang: a + Math.PI / 2, L: w - 0.05, W: dep, front: fr === 0 ? 2 : 3, sid, area: dep * w }, ex);
    }
  }

  // ratusz 1616–1620: parterowy, z wieżą zwieńczoną barokowym hełmem
  function ratusz(d, i, ex) {
    const [x, y, ang, L, W, zmin, zmax] = d; TINT = [1, 1, 1];
    const zf = (zmin + Math.min(1.0, zmax - zmin)) * ex + 0.25, F = frame(x, y, ang, zf), h = 5.6;
    box(F, 'kamien', -L / 2, L / 2, -W / 2, W / 2, zmin * ex - zf - 0.8, 0);
    box(F, 'tynk', -L / 2, L / 2, -W / 2, W / 2, 0, h);
    box(F, 'tynk', -L / 2 - 0.2, L / 2 + 0.2, -W / 2 - 0.2, W / 2 + 0.2, h - 0.4, h);
    for (const sy of [1, -1]) for (let k = 0; k < 5; k++) arch(F, 'okno', 'y', sy * W / 2, sy, -L / 2 + (k + 0.5) * L / 5, 0, 2.2, 3.4);
    for (const sx of [1, -1]) for (let k = 0; k < 3; k++) arch(F, 'okno', 'x', sx * L / 2, sx, -W / 2 + (k + 0.5) * W / 3, 0, 2.2, 3.4);
    roof(F, { xm: -L / 2 - 0.4, xp: L / 2 + 0.4, W, h, th: 42 * Math.PI / 180, f: 0, oyp: 0.4, oym: 0.4, gableMat: 'tynk', roofMat: 'gont' });
    const ts = 4.6, hT = 17;
    box(F, 'tynk', -ts / 2, ts / 2, -ts / 2, ts / 2, h, hT);
    box(F, 'tynk', -ts / 2 - 0.2, ts / 2 + 0.2, -ts / 2 - 0.2, ts / 2 + 0.2, hT - 0.5, hT);
    for (const sx of [1, -1]) { arch(F, 'okno', 'x', sx * ts / 2, sx, 0, hT - 4, 1.2, 2.4); arch(F, 'okno', 'y', sx * ts / 2, sx, 0, hT - 4, 1.2, 2.4); }
    extra.push({ pos: F(0, 0, hT), kind: 'helm', r: ts / 2 + 0.1 });
  }

  // ---------- kościół (dwie wieże i kopuła jak na szkicu Matejki „Rynek w Wiśniczu przed pożarem”) ----------
  const extra = [];
  function kosciol(d, i, ex) {
    const [x, y, ang, L, W, zmin, zmax, , front] = d;
    TINT = [1, 1, 1];
    const zf = (zmin + Math.min(1.2, zmax - zmin)) * ex + 0.3, F0 = frame(x, y, ang, zf);
    const F = front === 0 ? (a, b, c) => F0(-a, -b, c) : F0; // fasada od strony -x
    const nw = 12, hN = 13, xE = L / 2 - 6;
    box(F, 'kamien', -L / 2 - 0.3, xE + 0.3, -nw / 2 - 0.3, nw / 2 + 0.3, zmin * ex - zf - 1, 0.1);
    box(F, 'tynk', -L / 2 + 5, xE, -nw / 2, nw / 2, 0, hN);
    roof(F, { xm: -L / 2 + 5, xp: xE + 0.3, W: nw, h: hN, th: 50 * Math.PI / 180, f: 1, oyp: 0.5, oym: 0.5, gableMat: 'tynk', roofMat: 'gont' });
    // transept
    const xt = L * 0.12, tw = 8.5;
    box(F, 'kamien', xt - 4.6, xt + 4.6, -W / 2 - 0.3, W / 2 + 0.3, zmin * ex - zf - 1, 0.1);
    const Ft = (a, b, c) => F(xt + b, a, c);
    box(Ft, 'tynk', -W / 2, W / 2, -tw / 2, tw / 2, 0, hN - 1);
    roof(Ft, { xm: -W / 2 - 0.3, xp: W / 2 + 0.3, W: tw, h: hN - 1, th: 50 * Math.PI / 180, f: 1, oyp: 0.4, oym: 0.4, gableMat: 'tynk', roofMat: 'gont' });
    // prezbiterium z absydą (pół ośmioboku)
    const ar = 4.8, hA = 11, pts = [];
    for (let k = 0; k <= 4; k++) { const a = -Math.PI / 2 + Math.PI * k / 4; pts.push([xE + ar * Math.cos(a), ar * Math.sin(a)]); }
    const refA = F(xE + 1, 0, hA / 2);
    for (let k = 0; k < 4; k++) { const [a1, b1] = pts[k], [a2, b2] = pts[k + 1]; poly('tynk', [F(a1, b1, 0), F(a2, b2, 0), F(a2, b2, hA), F(a1, b1, hA)], refA);
      poly('gont', [F(a1 + (a1 - xE) * 0.08, b1 * 1.08, hA - 0.3), F(a2 + (a2 - xE) * 0.08, b2 * 1.08, hA - 0.3), F(xE, 0, hA + 4.6)], refA); }
    box(F, 'tynk', xE - 3, xE, -ar, ar, 0, hA);
    // okna nawy
    for (const sy of [1, -1]) for (let k = 0; k < 4; k++) arch(F, 'okno', 'y', sy * nw / 2, sy, -L / 2 + 9 + k * 6.5, 4.5, 1.8, 4.2);
    // fasada i wieże
    arch(F, 'okno', 'x', -L / 2 + 5, -1, 0, 0, 2.8, 4.5);
    const tsz = 5.6, hT = 25;
    for (const sy of [1, -1]) {
      const yc = sy * (nw / 2 - tsz / 2 + 2.6);
      box(F, 'tynk', -L / 2, -L / 2 + tsz, yc - tsz / 2, yc + tsz / 2, 0, hT);
      box(F, 'tynk', -L / 2 - 0.25, -L / 2 + tsz + 0.25, yc - tsz / 2 - 0.25, yc + tsz / 2 + 0.25, hT - 0.6, hT);
      for (const zz of [10, 17.5, 22]) arch(F, 'okno', 'x', -L / 2, -1, yc, zz, 1.1, 2.0);
      extra.push({ pos: F(-L / 2 + tsz / 2, yc, hT), kind: 'helm', r: tsz / 2 + 0.1 });
    }
    box(F, 'tynk', -L / 2, -L / 2 + 5, -nw / 2 + 2.6, nw / 2 - 2.6, 0, hN + 3);
    poly('tynk', [F(-L / 2, -nw / 2 + 2.6, hN + 3), F(-L / 2, nw / 2 - 2.6, hN + 3), F(-L / 2, 0, hN + 6.5)], F(-L / 2 + 2, 0, hN));
    // kopuła na skrzyżowaniu
    extra.push({ pos: F(xt, 0, hN + 5.5), kind: 'kopula', r: 4.3 });
  }

  function build(data, ex) {
    B = {}; for (const m of MATS) B[m] = new Buf(); extra.length = 0;
    data.b.forEach((d, i) => { CUR = i; if (d[14] === 2) kosciol(d, i, ex); else if (d[14] === 3) ratusz(d, i, ex); else dom(d, i, ex); });
    return B;
  }

  // ---------- warstwa MapLibre ----------
  function layer(map, data) {
    const origin = maplibregl.MercatorCoordinate.fromLngLat(data.origin, 0), s = origin.meterInMercatorCoordinateUnits();
    let renderer, scene, camera, meshes = [], ex = 1, sel = -1;   // teren w rzeczywistej wysokości (NMT 1 m), bez przewyższenia
    const mats = {};
    for (const m of MATS) mats[m] = new THREE.MeshLambertMaterial({ map: T[m] || null, color: PLAIN[m] || '#ffffff', vertexColors: true, side: THREE.DoubleSide });
    function rebuild() {
      for (const m of meshes) { scene.remove(m); m.geometry.dispose(); } meshes = [];
      for (const e of scene.children.filter(c => c.userData.extra)) scene.remove(e);
      const bufs = build(data, ex);
      for (const m of MATS) { const b = bufs[m]; if (!b.p.length) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
        g.userData.bid = new Int32Array(b.b); g.userData.c0 = new Float32Array(b.c); g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, mats[m]); mesh.frustumCulled = false; scene.add(mesh); meshes.push(mesh); }
      for (const e of extra) scene.add(helm(e));
      if (sel >= 0) highlight(sel, true);
    }
    function helm(e) { // hełm wieży (bania z latarnią) albo kopuła
      const grp = new THREE.Group(); grp.userData.extra = true; grp.position.set(...e.pos);
      const r = e.r, pts = [];
      if (e.kind === 'helm') { [[r, 0], [r * 0.95, 0.6], [r * 0.55, 1.6], [r * 0.85, 3.0], [r * 0.9, 3.8], [r * 0.6, 5.0], [r * 0.25, 5.6], [r * 0.32, 6.4], [r * 0.32, 7.6], [r * 0.12, 8.0], [r * 0.1, 9.6], [0.03, 10.4]].forEach(([a, b]) => pts.push(new THREE.Vector2(a, b))); }
      else { [[r, 0], [r, 3.2], [r * 0.98, 3.6], [r * 0.9, 5.0], [r * 0.7, 6.4], [r * 0.4, 7.3], [r * 0.18, 7.6], [r * 0.2, 9.0], [r * 0.08, 9.4], [0.03, 10.6]].forEach(([a, b]) => pts.push(new THREE.Vector2(a, b))); }
      const g = new THREE.LatheGeometry(pts, e.kind === 'helm' ? 8 : 16); g.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: T.blacha, side: THREE.DoubleSide })); m.frustumCulled = false; grp.add(m);
      if (e.kind === 'kopula') { const dr = new THREE.CylinderGeometry(r, r, 3.2, 8, 1, true); dr.rotateX(Math.PI / 2); dr.translate(0, 0, 1.6);
        const dm = new THREE.Mesh(dr, mats.tynk.clone()); dm.material.vertexColors = false; grp.add(dm); }
      const cr = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 2.2), new THREE.MeshLambertMaterial({ color: '#3a3a36' })); cr.position.z = (e.kind === 'helm' ? 10.4 : 10.6) + 1.0; grp.add(cr);
      const cb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.12), cr.material); cb.position.z = cr.position.z + 0.4; grp.add(cb);
      return grp;
    }
    function highlight(i, on) {
      for (const m of meshes) { const bid = m.geometry.userData.bid, col = m.geometry.attributes.color; let ch = false;
        for (let k = 0; k < bid.length; k++) if (bid[k] === i) { if (on) col.setXYZ(k, 1.35, 1.08, 0.78); else { const c0 = m.geometry.userData.c0; col.setXYZ(k, c0[3 * k], c0[3 * k + 1], c0[3 * k + 2]); } ch = true; }
        if (ch) col.needsUpdate = true; }
    }
    function TINT_OF(i) { const s = data.b[i][12] * 1.0, v = 0.88 + rnd(s, 1) * 0.24; return data.b[i][14] === 2 ? [1, 1, 1] : [v, v * (0.97 + rnd(s, 2) * 0.05), v * (0.94 + rnd(s, 3) * 0.06)]; }
    const L = {
      id: 'bryly', type: 'custom', renderingMode: '3d',
      onAdd(m, gl) {
        camera = new THREE.Camera(); scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight('#fff8ea', '#7a6e5a', 1.45));
        const sun = new THREE.DirectionalLight('#fff0d8', 2.1); sun.position.set(-0.55, -0.7, 0.75); scene.add(sun);
        renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true }); renderer.autoClear = false;
        rebuild();
      },
      render(gl, matrix) {
        const zoff = -(map.transform.elevation || 0);
        const mm = new THREE.Matrix4().fromArray(matrix);
        const l = new THREE.Matrix4().makeTranslation(origin.x, origin.y, zoff * s).scale(new THREE.Vector3(s, s, s));
        camera.projectionMatrix = mm.multiply(l); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        renderer.resetState(); renderer.render(scene, camera);
      }
    };
    L.setExaggeration = v => { ex = v; if (scene) { rebuild(); map.triggerRepaint(); } };
    L.select = i => { if (sel >= 0) highlight(sel, false); sel = i; if (i >= 0) highlight(i, true); map.triggerRepaint(); };
    L.pick = (px, py) => { // promień od kamery przez kliknięty piksel
      if (!camera) return -1;
      const c = map.getCanvas(), w = c.clientWidth, h = c.clientHeight;
      const nx = px / w * 2 - 1, ny = -(py / h) * 2 + 1;
      const inv = camera.projectionMatrixInverse;
      const a = new THREE.Vector4(nx, ny, -1, 1).applyMatrix4(inv), b = new THREE.Vector4(nx, ny, 1, 1).applyMatrix4(inv);
      const A = new THREE.Vector3(a.x / a.w, a.y / a.w, a.z / a.w), Bv = new THREE.Vector3(b.x / b.w, b.y / b.w, b.z / b.w);
      const rc = new THREE.Raycaster(A, Bv.clone().sub(A).normalize(), 0, A.distanceTo(Bv));
      const hit = rc.intersectObjects(meshes, false)[0];
      return hit ? hit.object.geometry.userData.bid[hit.face.a] : -1;
    };
    return L;
  }
  return { layer };
})();


const KL={pole:['pole (grunt orny)','#f4ecdc'],laka:['łąka','#bed7aa'],pastwisko:['pastwisko','#d6e2b8'],ogrod:['ogród','#a0c896'],
  las:['las / zarośla','#9db89a'],nieuzytek:['nieużytek','#e6dfcf'],cmentarz:['cmentarz','#c9d3b8'],droga:['droga','#e6decd'],
  plac_ulica:['plac / ulica','#ded7c8'],woda:['woda','#6eaad7'],budynek_murowany:['budynek murowany','#d66e78'],budynek_drewniany:['budynek drewniany','#f0cd5a']};
const U=p=>new URL('mapa/'+p,document.baseURI).href;
const leg=document.getElementById('leg');
for(const k of ['pole','laka','ogrod','droga','woda','budynek_murowany','budynek_drewniany']){
  const s=document.createElement('span');s.innerHTML=`<i class="sw" style="background:${KL[k][1]}"></i>${KL[k][0]}`;leg.appendChild(s);}
const match=['match',['get','k']];for(const k in KL){match.push(k,KL[k][1]);}match.push('#f4ecdc');
const matchB=['match',['get','klasa'],'budynek_murowany','#d66e78','#f0cd5a'];
const HOME={center:[20.4618,49.9135],zoom:16.2,pitch:62,bearing:-28};

const map=new maplibregl.Map({container:'map',hash:false,maxPitch:80,attributionControl:{compact:true},
  style:{version:8,
    sources:{
      dem:{type:'raster-dem',tiles:[U('teren/')+'{z}/{x}/{y}.png'],tileSize:256,encoding:'terrarium',minzoom:10,maxzoom:15,attribution:'NMT 1 m © GUGiK'},
      demh:{type:'raster-dem',tiles:[U('teren/')+'{z}/{x}/{y}.png'],tileSize:256,encoding:'terrarium',minzoom:10,maxzoom:15},
      obs:{type:'geojson',data:U('obszary.geojson')},
      bud:{type:'geojson',data:U('budynki.geojson'),attribution:'Kataster galicyjski 1847/1849 (skan RCIN), wektoryzacja'},
      gr:{type:'geojson',data:U('granica.geojson')},
      wa:{type:'geojson',data:U('warstwice.geojson')},
      skan:{type:'image',url:U('skan1847.webp'),coordinates:[[20.42585895250316,49.93122841607524],[20.476156523576297,49.93122841607524],[20.476156523576297,49.89768973167475],[20.42585895250316,49.89768973167475]]}
    },
    layers:[
      {id:'bg',type:'background',paint:{'background-color':'#ece6d6'}},
      {id:'obs-f',type:'fill',source:'obs',paint:{'fill-color':match,'fill-opacity':0.95}},
      {id:'skan',type:'raster',source:'skan',layout:{visibility:'none'},paint:{'raster-opacity':1,'raster-fade-duration':0}},
      {id:'hs',type:'hillshade',source:'demh',paint:{'hillshade-exaggeration':0.55,'hillshade-shadow-color':'#5b4a36','hillshade-highlight-color':'#fffaf0','hillshade-accent-color':'#7a6650'}},
      {id:'obs-l',type:'line',source:'obs',paint:{'line-color':'#6b6257','line-width':['interpolate',['linear'],['zoom'],13,0.2,17,0.9],'line-opacity':0.8}},
      {id:'wa',type:'line',source:'wa',paint:{'line-color':'#8a5a2b','line-width':['case',['==',['%',['get','h'],10],0],1.1,0.45],'line-opacity':0.55}},
      {id:'gr',type:'line',source:'gr',paint:{'line-color':'#7a1c1c','line-width':2.2,'line-dasharray':[4,1.5,1,1.5]}},
      {id:'bud-flat',type:'fill',source:'bud',paint:{'fill-color':matchB,'fill-opacity':['interpolate',['linear'],['zoom'],14,0.9,15.5,0.25],'fill-outline-color':'#4a2a20'}}
    ]},
  ...HOME});
map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');
map.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-right');
let BR=null, BD=null, MD=null;

// ===== Modele GLB budynków (wspólny układ: punkt 0 = narożnik NW działki 210) =====
// Punkt 0: PL-1992 E 604 996,76 / N 228 514,50, H 280,90 m; oś X modeli: azymut 92,02° w siatce PL-1992 = 93,14° względem północy geograficznej.
const MODELE={origin:[20.462943201888258,49.91471363672642],H0:280.90,azymut:93.14,wersja:'202610271000',
  lista:[
    {plik:'lekki',dz:'210',nazwa:'Zajazd'},
    {plik:'dom211_lekki',dz:'211',nazwa:'Dom piekarza'},
    {plik:'dom19a_lekki',dz:'19/a',nazwa:'Dom z przejazdem bramnym'},
    {plik:'dom18_lekki',dz:'18',nazwa:'Dom'},
    {plik:'dom17_lekki',dz:'17',nazwa:'Dom'},
    {plik:'dom16_lekki',dz:'16',nazwa:'Dom'},
    {plik:'dom15_lekki',dz:'15',nazwa:'Dom'},
    {plik:'dom14_lekki',dz:'14',nazwa:'Dom'}]};
// Model GLB: binarny plik .glb (GitHub Pages); gdy serwer go nie podaje, wersja tekstowa base64 (.txt).
function wczytajGLB(plik){
  return fetch(U('modele/'+plik+'.glb?v='+MODELE.wersja)).then(r=>{if(!r.ok)throw new Error(r.status);return r.arrayBuffer();})
    .catch(()=>fetch(U('modele/'+plik+'.txt?v='+MODELE.wersja)).then(r=>{if(!r.ok)throw new Error(r.status);return r.text();})
      .then(t=>{const bin=atob(t.trim()),u8=new Uint8Array(bin.length);for(let k=0;k<bin.length;k++)u8[k]=bin.charCodeAt(k);return u8.buffer;}));
}
function modeleWarstwa(map,o0ll){
  const o0=maplibregl.MercatorCoordinate.fromLngLat(o0ll,0), s=o0.meterInMercatorCoordinateUnits();
  const om=maplibregl.MercatorCoordinate.fromLngLat(MODELE.origin,0);
  const dE=(om.x-o0.x)/s, dN=-(om.y-o0.y)/s;           // przesunięcie punktu 0 modeli w metrach (wschód, północ)
  const a=MODELE.azymut*Math.PI/180;
  let renderer,scene,camera,root,ex=1,sel=-1; const wpisy=[];   // ex = 1: wysokości wprost z danych
  // układ sceny: x = wschód, y = północ, z = w górę; glTF: X wzdłuż azymutu, Y w górę, Z = X+90°
  function ustaw(){
    root.matrix.makeBasis(new THREE.Vector3(Math.sin(a),Math.cos(a),0),new THREE.Vector3(0,0,1),new THREE.Vector3(Math.cos(a),-Math.sin(a),0));
    root.matrix.setPosition(dE,dN,ex*MODELE.H0); root.matrixWorldNeedsUpdate=true;
    // przy przewyższeniu terenu każdy budynek podnosi się razem z gruntem pod nim (bryła nie jest rozciągana)
    for(const w of wpisy) if(w.obj) w.obj.position.y=(ex-1)*w.grunt;   // punkt 0 jest już na wysokości ex·H0
  }
  function podswietl(i,on){const w=wpisy[i]; if(!w||!w.obj) return;
    w.obj.traverse(o=>{if(o.isMesh&&o.material&&o.material.emissive){o.material.emissive.set(on?0x4a3418:0x000000);}});}
  const L={id:'modele',type:'custom',renderingMode:'3d',
    onAdd(m,gl){
      camera=new THREE.Camera(); scene=new THREE.Scene();
      renderer=new THREE.WebGLRenderer({canvas:m.getCanvas(),context:gl,antialias:true}); renderer.autoClear=false;
      renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.0;
      const pm=new THREE.PMREMGenerator(renderer); scene.environment=pm.fromScene(new RoomEnvironment(),0.04).texture; pm.dispose(); renderer.resetState();
      scene.add(new THREE.HemisphereLight(0xe3ecf2,0x8c7b62,0.55));
      const sun=new THREE.DirectionalLight(0xfff0da,2.4); sun.position.set(-0.5,-0.55,0.75); scene.add(sun);
      root=new THREE.Group(); root.matrixAutoUpdate=false; scene.add(root); ustaw();
      const loader=new GLTFLoader();
      MODELE.lista.forEach((d,i)=>{const w={...d,obj:null,grunt:0}; wpisy.push(w);
        wczytajGLB(d.plik).then(buf=>new Promise((ok,nie)=>{
          loader.parse(buf,'',g=>ok(g.scene),nie);})).then(obj=>{
            obj.traverse(o=>{if(o.isMesh){o.userData.idx=i; o.frustumCulled=false; if(o.material&&o.material.emissive) o.material=o.material.clone();}});
            w.grunt=new THREE.Box3().setFromObject(obj).min.y; w.obj=obj; root.add(obj); ustaw(); if(sel===i)podswietl(i,true); m.triggerRepaint();})
          .catch(e=>console.warn('Model '+d.dz+' nie wczytał się',e));
      });
    },
    render(gl,matrix){
      const zoff=-(map.transform.elevation||0);
      const mm=new THREE.Matrix4().fromArray(matrix);
      const l=new THREE.Matrix4().makeTranslation(o0.x,o0.y,zoff*s).scale(new THREE.Vector3(s,-s,s));   // północ w górę → oś Y Mercatora w dół
      camera.projectionMatrix=mm.multiply(l); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      renderer.resetState(); renderer.render(scene,camera);
    }};
  L.setExaggeration=v=>{ex=v;if(root){ustaw();map.triggerRepaint();}};
  L.select=i=>{if(sel>=0)podswietl(sel,false);sel=i;if(i>=0)podswietl(i,true);map.triggerRepaint();};
  L.wpis=i=>wpisy[i];
  L.pick=(px,py)=>{if(!camera)return -1;
    const c=map.getCanvas(),nx=px/c.clientWidth*2-1,ny=-(py/c.clientHeight)*2+1,inv=camera.projectionMatrixInverse;
    const A4=new THREE.Vector4(nx,ny,-1,1).applyMatrix4(inv),B4=new THREE.Vector4(nx,ny,1,1).applyMatrix4(inv);
    const A=new THREE.Vector3(A4.x/A4.w,A4.y/A4.w,A4.z/A4.w),B=new THREE.Vector3(B4.x/B4.w,B4.y/B4.w,B4.z/B4.w);
    const hit=new THREE.Raycaster(A,B.clone().sub(A).normalize(),0,A.distanceTo(B)).intersectObject(root,true)[0];
    return hit?hit.object.userData.idx:-1;};
  return L;
}
map.on('load',async()=>{map.setTerrain({source:'dem',exaggeration:1});
  BD=await fetch(U('budynki3d.json')).then(r=>r.json());
  BR=BRYLY.layer(map,BD); map.addLayer(BR);
  MD=modeleWarstwa(map,BD.origin); map.addLayer(MD);});

const $=id=>document.getElementById(id);
function setBase(skan){
  $('b-skan').setAttribute('aria-pressed',skan);$('b-styl').setAttribute('aria-pressed',!skan);
  map.setLayoutProperty('skan','visibility',skan?'visible':'none');
  map.setPaintProperty('obs-f','fill-opacity',skan?0:0.95);
  map.setPaintProperty('obs-l','line-opacity',skan?0.0:0.8);
  map.setPaintProperty('hs','hillshade-exaggeration',skan?0.35:0.55);
}
$('b-skan').onclick=()=>setBase(true);$('b-styl').onclick=()=>setBase(false);
$('bh').onchange=e=>{if(BR)map.setLayoutProperty('bryly','visibility',e.target.checked?'visible':'none');if(MD)map.setLayoutProperty('modele','visibility',e.target.checked?'visible':'none');map.setPaintProperty('bud-flat','fill-opacity',e.target.checked?['interpolate',['linear'],['zoom'],14,0.9,15.5,0.25]:0.95);};
$('wa').onchange=e=>map.setLayoutProperty('wa','visibility',e.target.checked?'visible':'none');
$('v3d').onclick=()=>map.easeTo({pitch:62,bearing:map.getBearing()||-28,duration:900});
$('v2d').onclick=()=>map.easeTo({pitch:0,bearing:0,duration:900});
$('vall').onclick=()=>map.fitBounds([[20.4259,49.8977],[20.4762,49.9312]],{pitch:45,bearing:-15,padding:40,duration:1200});
$('tg').onclick=()=>{const p=$('panel');const m=p.classList.toggle('min');$('tg').textContent=m?'Rozwiń':'Zwiń';$('tg').setAttribute('aria-expanded',!m);};
$('cx').onclick=()=>{$('card').hidden=true;if(BR)BR.select(-1);if(MD)MD.select(-1);};

const fmt=n=>Number(n).toLocaleString('pl-PL');
function show(title,rows,empty){
  $('ct').textContent=title;
  $('cd').innerHTML=rows.map(([a,b])=>`<dt>${a}</dt><dd>${b}</dd>`).join('');
  $('ce').textContent=empty;$('card').hidden=false;
}
const TYP=['budynek drewniany','budynek murowany'];
function kartaBud(i){const d=BD.b[i];const [,,,L,W,zmin,zmax,mur,front,porch,open,,id,area,sp]=d;
  const opis=sp===2?'Kościół (wg rysunków Matejki: dwie wieże, kopuła)':(mur?'Dom murowany':'Dom drewniany')+(porch?' z podcieniem od rynku':'');
  show(opis,[['Powierzchnia',fmt(area)+' m²'],['Wymiary',`${L.toFixed(1).replace('.',',')} × ${W.toFixed(1).replace('.',',')} m`],['Teren pod budynkiem',`${Math.round(zmin)}–${Math.round(zmax)} m n.p.m.`],['Id obszaru',id>0?id:'z rysunku katastru']],
  'Mieszkańców tej działki nie przypisano jeszcze do wpisów w bazie. Gdy powiązanie powstanie, pojawią się tu osoby i odsyłacze do wpisów.');}
map.on('click',e=>{
  if(MD&&map.getLayoutProperty('modele','visibility')!=='none'){const i=MD.pick(e.point.x,e.point.y);if(i>=0){if(BR)BR.select(-1);MD.select(i);const w=MD.wpis(i);
    show(w.nazwa+' · działka '+w.dz,[['Działka',w.dz],['Stan','z 1847 r.']],'Mieszkańców tej działki nie przypisano jeszcze do wpisów w bazie. Gdy powiązanie powstanie, pojawią się tu osoby i odsyłacze do wpisów.');return;}}
  if(MD)MD.select(-1);
  if(BR&&map.getLayoutProperty('bryly','visibility')!=='none'){const i=BR.pick(e.point.x,e.point.y);if(i>=0){BR.select(i);kartaBud(i);return;}}
  if(BR)BR.select(-1);
  const f=map.queryRenderedFeatures(e.point,{layers:['obs-f']})[0]; if(!f) return;
  show(KL[f.properties.k]?KL[f.properties.k][0]:'Działka',[['Powierzchnia',fmt(f.properties.p)+' m²'],['Morgi (1 mórg = 5755 m²)',(f.properties.p/5754.64).toFixed(2).replace('.',',')]],
  'Numer tej działki nie jest jeszcze opisany. Po uzupełnieniu numeracji pojawią się tu wpisy z ksiąg, które jej dotyczą.');});
for(const l of ['obs-f']){map.on('mouseenter',l,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',l,()=>map.getCanvas().style.cursor='');}

window.WisniczMapa={map,resize:()=>map.resize()};
