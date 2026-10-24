'use strict';
// Motor: elementos multimedia, audio, dibujo de fotogramas y reproducción.
const E = {
  els: new Map(), actx: null, master: null, expDest: null,
  wall0: 0, t0: 0, pending: false, boxes: {}, exporting: false,
  tmp: document.createElement('canvas')
};

function audioCtx() {
  if (!E.actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    E.actx = new AC();
    E.master = E.actx.createGain();
    E.master.connect(E.actx.destination);
    E.expDest = E.actx.createMediaStreamDestination();
  }
  return E.actx;
}

function dims(aspect, short) {
  const [a, b] = ASPECTS[aspect];
  let w, h;
  if (a >= b) { h = short; w = Math.round(short * a / b); } else { w = short; h = Math.round(short * b / a); }
  return [w - (w % 2), h - (h % 2)];
}

function getEl(c) {
  let o = E.els.get(c.id);
  if (o) return o;
  const a = VC.assets[c.assetId];
  if (!a) return null;
  if (c.kind === 'image') {
    const img = new Image();
    img.onload = requestRender;
    img.src = a.url;
    o = { el: img, type: 'image' };
  } else {
    const el = document.createElement(c.kind === 'video' ? 'video' : 'audio');
    el.src = a.url; el.preload = 'auto'; el.playsInline = true;
    el.addEventListener('seeked', requestRender);
    el.addEventListener('loadeddata', requestRender);
    audioCtx();
    const src = E.actx.createMediaElementSource(el);
    const g = E.actx.createGain();
    src.connect(g); g.connect(E.master); g.connect(E.expDest);
    o = { el, gain: g, type: c.kind };
  }
  E.els.set(c.id, o);
  return o;
}
function disposeEl(id) {
  const o = E.els.get(id);
  if (!o) return;
  if (o.el.pause) { o.el.pause(); o.el.removeAttribute('src'); try { o.el.load(); } catch (e) { /* nada */ } }
  try { o.gain && o.gain.disconnect(); } catch (e) { /* nada */ }
  E.els.delete(id);
}
// Mantiene elementos solo para los clips cercanos al cursor (limita decodificadores en móvil).
function manage(t) {
  const ids = new Set();
  for (const { c } of allClips()) {
    ids.add(c.id);
    if (c.kind !== 'video' && c.kind !== 'audio' && c.kind !== 'image') continue;
    const near = t >= c.start - 1.5 && t <= clipEnd(c) + 1.5;
    if (near) getEl(c);
    else if (c.kind !== 'image') disposeEl(c.id);
  }
  for (const id of Array.from(E.els.keys())) if (!ids.has(id)) disposeEl(id);
}
function fadeGain(c, t) {
  const local = t - c.start, d = clipDur(c);
  let g = 1;
  if (c.fadeIn > 0) g = Math.min(g, local / c.fadeIn);
  if (c.fadeOut > 0) g = Math.min(g, (d - local) / c.fadeOut);
  return clamp(g, 0, 1);
}
function sync(t, playing) {
  manage(t);
  const tracks = VC.project.tracks;
  for (const tr of tracks) {
    for (const c of tr.clips) {
      if (c.kind !== 'video' && c.kind !== 'audio') continue;
      const o = E.els.get(c.id);
      if (!o) continue;
      const active = t >= c.start && t < clipEnd(c);
      if (!active) { if (!o.el.paused) o.el.pause(); continue; }
      const target = c.in + (t - c.start) * c.speed;
      o.gain.gain.value = tr.muted ? 0 : c.vol * fadeGain(c, t) * (c.mute ? 0 : 1);
      if (playing) {
        if (o.el.playbackRate !== c.speed) o.el.playbackRate = c.speed;
        const drift = Math.abs(o.el.currentTime - target);
        if (o.el.paused || drift > 0.35) {
          if (drift > 0.05) o.el.currentTime = target;
          o.el.play().catch(() => { /* requiere gesto del usuario */ });
        }
      } else {
        if (!o.el.paused) o.el.pause();
        if (Math.abs(o.el.currentTime - target) > 0.04) o.el.currentTime = target;
      }
    }
  }
}

// ---------- dibujo ----------
const FILTERS = {
  none: '', warm: 'sepia(.25) saturate(1.25) hue-rotate(-10deg)', mono: 'grayscale(1)',
  vivid: 'saturate(1.6) contrast(1.1)', fade: 'contrast(.85) brightness(1.1) saturate(.8)',
  cool: 'hue-rotate(15deg) saturate(1.1)', sepia: 'sepia(.9)',
  vintage: 'sepia(.4) contrast(.9) brightness(1.05) saturate(.9)', drama: 'contrast(1.3) saturate(1.15) brightness(.92)'
};
function filterStr(c, s) {
  const a = c.adj, p = [];
  const base = FILTERS[c.filter] || '';
  if (a.b !== 100) p.push(`brightness(${a.b / 100})`);
  if (a.c !== 100) p.push(`contrast(${a.c / 100})`);
  if (a.s !== 100) p.push(`saturate(${a.s / 100})`);
  if (a.h) p.push(`hue-rotate(${a.h}deg)`);
  const blur = (a.blur || 0) + (c.fx === 'blur' ? 8 : 0);
  if (blur) p.push(`blur(${blur * s}px)`);
  return (base + ' ' + p.join(' ')).trim() || 'none';
}
const ease = p => 1 - Math.pow(1 - clamp(p, 0, 1), 3);

function renderFrame(ctx, w, h, t, rec) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const rank = { video: 0, overlay: 1, text: 2 };
  const list = [];
  VC.project.tracks.forEach((tr, i) => {
    if (tr.hidden || tr.kind === 'audio') return;
    for (const c of tr.clips) if (t >= c.start && t < clipEnd(c)) list.push({ c, k: rank[tr.kind] * 100 + i });
  });
  list.sort((a, b) => a.k - b.k);
  const s = Math.min(w, h) / 1080;
  if (rec) E.boxes = {};
  for (const { c } of list) drawClip(ctx, w, h, s, c, t, rec);
  ctx.restore();
}

function drawClip(ctx, w, h, s, c, t, rec) {
  const local = t - c.start;
  let alpha = c.opacity, ox = 0, oy = 0, sc = 1, wipe = 1;
  const tr = c.trans;
  if (tr && tr.type !== 'none' && local < tr.dur) {
    const p = ease(local / tr.dur);
    switch (tr.type) {
      case 'fade': alpha *= p; break;
      case 'slideL': ox = (1 - p) * w; break;
      case 'slideR': ox = -(1 - p) * w; break;
      case 'slideU': oy = (1 - p) * h; break;
      case 'zoom': sc = 1.4 - 0.4 * p; alpha *= p; break;
      case 'wipe': wipe = p; break;
    }
  }
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  if (wipe < 1) { ctx.beginPath(); ctx.rect(0, 0, w * wipe, h); ctx.clip(); }
  ctx.translate(w / 2 + c.x * w + ox, h / 2 + c.y * h + oy);
  ctx.rotate(c.rot * Math.PI / 180);
  const k = c.scale * sc;
  ctx.scale(c.flip ? -k : k, k);
  let bw = 0, bh = 0;

  if (c.kind === 'video' || c.kind === 'image') {
    const o = E.els.get(c.id);
    const el = o && o.el;
    const ready = el && (c.kind === 'image' ? el.complete && el.naturalWidth : el.readyState >= 2 && el.videoWidth);
    const a = VC.assets[c.assetId];
    const sw = ready ? (c.kind === 'image' ? el.naturalWidth : el.videoWidth) : (a && a.w) || 16;
    const sh = ready ? (c.kind === 'image' ? el.naturalHeight : el.videoHeight) : (a && a.h) || 9;
    const f = (c.fit === 'cover' ? Math.max : Math.min)(w / sw, h / sh);
    const dw = sw * f, dh = sh * f;
    bw = dw * k; bh = dh * k;
    if (ready) {
      ctx.filter = filterStr(c, s);
      if (c.fx === 'pixel') {
        const tw = Math.max(8, Math.round(dw / (28 * s))), th = Math.max(8, Math.round(dh / (28 * s)));
        E.tmp.width = tw; E.tmp.height = th;
        E.tmp.getContext('2d').drawImage(el, 0, 0, tw, th);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(E.tmp, -dw / 2, -dh / 2, dw, dh);
        ctx.imageSmoothingEnabled = true;
      } else {
        if (c.fx === 'mirror') ctx.scale(-1, 1);
        ctx.drawImage(el, -dw / 2, -dh / 2, dw, dh);
      }
      ctx.filter = 'none';
      if (c.fx === 'vignette') {
        const r = Math.hypot(dw, dh) / 2;
        const g = ctx.createRadialGradient(0, 0, r * 0.35, 0, 0, r);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.75)');
        ctx.fillStyle = g; ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
      }
    } else {
      ctx.fillStyle = '#111'; ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
    }
  } else if (c.kind === 'text') {
    const p = clamp(local / 0.5, 0, 1), e = ease(p);
    const T = c.text;
    if (T.anim === 'fade') ctx.globalAlpha *= e;
    else if (T.anim === 'slide') ctx.translate(0, (1 - e) * 80 * s);
    else if (T.anim === 'pop') { const z = 0.5 + 0.5 * e + Math.sin(e * Math.PI) * 0.12; ctx.scale(z, z); ctx.globalAlpha *= e; }
    const b = drawText(ctx, w, s, T);
    bw = b.w * k; bh = b.h * k;
  } else if (c.kind === 'emoji') {
    const size = c.size * s;
    ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.emoji, 0, 0);
    bw = bh = size * 1.2 * k;
  } else if (c.kind === 'shape') {
    const size = c.size * s;
    ctx.fillStyle = c.color;
    ctx.beginPath();
    drawShapePath(ctx, c.shape, size);
    ctx.fill();
    bw = bh = size * k;
  }
  ctx.restore();
  if (rec) E.boxes[c.id] = { cx: (w / 2 + c.x * w + ox) / w, cy: (h / 2 + c.y * h + oy) / h, w: bw / w, h: bh / h, rot: c.rot };
}

function drawShapePath(ctx, shape, size) {
  const r = size / 2;
  if (shape === 'circle') ctx.arc(0, 0, r, 0, Math.PI * 2);
  else if (shape === 'triangle') { ctx.moveTo(0, -r); ctx.lineTo(r, r * 0.8); ctx.lineTo(-r, r * 0.8); ctx.closePath(); }
  else if (shape === 'star') {
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * Math.PI / 5;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
  } else if (shape === 'heart') {
    ctx.moveTo(0, r * 0.9);
    ctx.bezierCurveTo(-r * 1.3, r * 0.1, -r * 0.7, -r * 0.9, 0, -r * 0.3);
    ctx.bezierCurveTo(r * 0.7, -r * 0.9, r * 1.3, r * 0.1, 0, r * 0.9);
    ctx.closePath();
  } else if (shape === 'round') {
    const x = -r, y = -r * 0.6, ww = size, hh = size * 0.6, rr = size * 0.12;
    ctx.moveTo(x + rr, y); ctx.arcTo(x + ww, y, x + ww, y + hh, rr); ctx.arcTo(x + ww, y + hh, x, y + hh, rr);
    ctx.arcTo(x, y + hh, x, y, rr); ctx.arcTo(x, y, x + ww, y, rr); ctx.closePath();
  } else ctx.rect(-r, -r, size, size);
}

function drawText(ctx, w, s, T) {
  const size = T.size * s;
  ctx.font = `${T.bold ? 800 : 500} ${size}px ${T.font}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const maxW = w * 0.86;
  const lines = [];
  for (const para of String(T.content || '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
  }
  const lh = size * 1.2, total = lines.length * lh;
  let widest = 0;
  for (const l of lines) widest = Math.max(widest, ctx.measureText(l).width);
  const y0 = -total / 2 + lh / 2;
  if (T.bg) {
    const pad = size * 0.3, bx = -widest / 2 - pad, by = -total / 2 - pad * 0.5, bw = widest + pad * 2, bh = total + pad;
    ctx.fillStyle = T.bgColor;
    ctx.beginPath();
    const r = size * 0.18;
    ctx.moveTo(bx + r, by); ctx.arcTo(bx + bw, by, bx + bw, by + bh, r); ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
    ctx.arcTo(bx, by + bh, bx, by, r); ctx.arcTo(bx, by, bx + bw, by, r); ctx.closePath(); ctx.fill();
  }
  if (T.shadow) { ctx.shadowColor = T.shadowColor; ctx.shadowBlur = size * 0.22; ctx.shadowOffsetY = size * 0.04; }
  lines.forEach((l, i) => {
    const y = y0 + i * lh;
    if (T.stroke > 0) {
      ctx.lineWidth = T.stroke * s * 2; ctx.lineJoin = 'round'; ctx.strokeStyle = T.strokeColor;
      ctx.strokeText(l, 0, y);
    }
    ctx.fillStyle = T.color; ctx.fillText(l, 0, y);
  });
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  return { w: widest + size * 0.6, h: total + size * 0.4 };
}

// ---------- vista previa y reproducción ----------
function requestRender() {
  if (E.pending) return;
  E.pending = true;
  requestAnimationFrame(() => { E.pending = false; drawPreview(); });
}
function drawPreview() {
  const cv = $('#stageCanvas');
  if (!cv || !VC.project) return;
  const [w, h] = dims(VC.project.aspect, 540);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; fitStage(); }
  renderFrame(cv.getContext('2d'), w, h, VC.t, true);
  updateSelBox();
}
function fitStage() {
  const wrap = $('#stageWrap'), box = $('#stageBox'), cv = $('#stageCanvas');
  if (!wrap || !cv.width) return;
  const r = wrap.getBoundingClientRect();
  const sc = Math.min((r.width - 16) / cv.width, (r.height - 16) / cv.height);
  if (!(sc > 0)) return;
  box.style.width = Math.floor(cv.width * sc) + 'px';
  box.style.height = Math.floor(cv.height * sc) + 'px';
}
function updateSelBox() {
  const el = $('#selBox');
  const b = VC.sel && E.boxes[VC.sel];
  if (!b || VC.playing || E.exporting) { el.hidden = true; return; }
  el.hidden = false;
  el.style.left = (b.cx - b.w / 2) * 100 + '%';
  el.style.top = (b.cy - b.h / 2) * 100 + '%';
  el.style.width = b.w * 100 + '%';
  el.style.height = b.h * 100 + '%';
  el.style.transform = `rotate(${b.rot}deg)`;
}
function play() {
  if (VC.playing) return;
  const total = totalDur();
  if (!total) { toast('Importa un vídeo para empezar'); return; }
  if (VC.t >= total - 0.05) VC.t = 0;
  audioCtx().resume();
  VC.playing = true;
  E.wall0 = performance.now(); E.t0 = VC.t;
  loop();
  emit('play');
}
function pause() {
  if (!VC.playing) return;
  VC.playing = false;
  sync(VC.t, false);
  requestRender();
  emit('play');
}
function loop() {
  if (!VC.playing) return;
  const t = E.t0 + (performance.now() - E.wall0) / 1000;
  const total = totalDur();
  if (t >= total) { VC.t = total; pause(); emit('tick'); return; }
  VC.t = t;
  sync(t, true);
  drawPreview();
  emit('tick');
  requestAnimationFrame(loop);
}
function seek(t) {
  VC.t = clamp(t, 0, Math.max(totalDur(), 0));
  if (VC.playing) { E.t0 = VC.t; E.wall0 = performance.now(); }
  sync(VC.t, VC.playing);
  requestRender();
  emit('tick');
}
