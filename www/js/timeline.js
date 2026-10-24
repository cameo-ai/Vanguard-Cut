'use strict';
// Línea de tiempo multipista: render, arrastre, recorte, zoom y cabezal.
const LABEL_W = 92;
let tlDrag = null;

function tickStep() {
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120];
  return steps.find(s => s * VC.pps >= 64) || 120;
}
function clipLabel(c) {
  if (c.kind === 'text') return (c.text.content || 'Texto').split('\n')[0];
  if (c.kind === 'emoji') return c.emoji;
  if (c.kind === 'shape') return 'Forma';
  const a = VC.assets[c.assetId];
  return a ? a.name : '';
}
function renderTimeline() {
  const root = $('#tlInner');
  if (!root || !VC.project) return;
  const pps = VC.pps;
  const scrollW = $('#tlScroll').clientWidth;
  const total = Math.max(totalDur() + 6, (scrollW - LABEL_W) / pps, 12);
  const width = LABEL_W + total * pps;
  root.style.width = width + 'px';
  const step = tickStep();
  let ticks = '';
  for (let t = 0; t <= total; t += step) {
    const m = Math.floor(t / 60), s = t % 60;
    ticks += `<div class="tick" style="left:${t * pps}px">${String(m).padStart(2, '0')}:${String(Math.floor(s)).padStart(2, '0')}${step < 1 && s % 1 ? '.5' : ''}</div>`;
  }
  let html = `<div class="tl-ruler" id="tlRuler"><div class="tl-corner"></div><div class="tl-ticks" style="width:${total * pps}px">${ticks}</div></div>`;
  for (const tr of VC.project.tracks) {
    const vis = tr.kind !== 'audio';
    const sound = tr.kind === 'video' || tr.kind === 'audio';
    html += `<div class="tl-row k-${tr.kind}${tr.locked ? ' locked' : ''}${tr.hidden ? ' hidden-t' : ''}" data-track="${tr.id}">
      <div class="tl-label"><span>${esc(tr.name)}</span><div class="btns">
        ${vis ? `<button data-tact="hide" class="${tr.hidden ? 'on' : ''}" title="Mostrar/ocultar">${ic(tr.hidden ? 'eyeoff' : 'eye', 14)}</button>` : ''}
        ${sound ? `<button data-tact="mute" class="${tr.muted ? 'on' : ''}" title="Silenciar pista">${ic(tr.muted ? 'volx' : 'vol', 14)}</button>` : ''}
        <button data-tact="lock" class="${tr.locked ? 'on' : ''}" title="Bloquear">${ic(tr.locked ? 'lock' : 'unlock', 14)}</button>
      </div></div>
      <div class="tl-lane" style="width:${total * pps}px">`;
    for (const c of tr.clips) {
      const d = clipDur(c);
      const a = VC.assets[c.assetId];
      const bg = a && a.thumb && (c.kind === 'video' || c.kind === 'image') ? `background-image:url(${a.thumb});` : '';
      html += `<div class="clip k-${c.kind}${tr.kind === 'overlay' ? ' ov' : ''}${c.id === VC.sel ? ' sel' : ''}" data-id="${c.id}" style="left:${c.start * pps}px;width:${Math.max(6, d * pps)}px;${bg}">
        <i class="h l"></i>${c.kind === 'audio' ? '<canvas class="wf"></canvas>' : ''}
        ${c.trans && c.trans.type !== 'none' ? `<b class="tr" style="width:${Math.min(d, c.trans.dur) * pps}px"></b>` : ''}
        <span class="cl">${esc(clipLabel(c))}</span><i class="h r"></i></div>`;
    }
    html += '</div></div>';
  }
  html += '<div class="playhead" id="playhead"></div>';
  root.innerHTML = html;
  drawWaveforms();
  updatePlayhead();
}
function drawWaveforms() {
  $$('.clip.k-audio').forEach(el => {
    const f = findClip(el.dataset.id);
    if (!f) return;
    const a = VC.assets[f.c.assetId];
    const cv = $('.wf', el);
    if (!a || !a.peaks || !cv) return;
    const w = Math.max(10, Math.round(el.clientWidth)), h = Math.max(10, Math.round(el.clientHeight));
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffffcc';
    const p0 = f.c.in * 20, p1 = f.c.out * 20;
    for (let x = 0; x < w; x += 2) {
      const idx = Math.floor(p0 + (x / w) * (p1 - p0));
      const v = (a.peaks[idx] || 0) / 100;
      const bh = Math.max(1, v * h * 0.9);
      g.fillRect(x, (h - bh) / 2, 1.4, bh);
    }
  });
}
function updatePlayhead() {
  const ph = $('#playhead');
  if (!ph) return;
  const x = LABEL_W + VC.t * VC.pps;
  ph.style.left = x + 'px';
  if (VC.playing) {
    const sc = $('#tlScroll');
    if (x > sc.scrollLeft + sc.clientWidth - 30 || x < sc.scrollLeft + LABEL_W) sc.scrollLeft = Math.max(0, x - LABEL_W - 40);
  }
}
function timeAtX(clientX) {
  const r = $('#tlInner').getBoundingClientRect();
  return Math.max(0, (clientX - r.left - LABEL_W) / VC.pps);
}
function snapTime(t, ignoreId, edgeEndOffset) {
  if (!VC.settings.snap) return t;
  const pts = [0, VC.t];
  for (const { c } of allClips()) if (c.id !== ignoreId) pts.push(c.start, clipEnd(c));
  const th = 9 / VC.pps;
  let best = t, bd = th;
  for (const p of pts) {
    const d = Math.abs(p - t);
    if (d < bd) { bd = d; best = p; }
    if (edgeEndOffset) { const d2 = Math.abs(p - (t + edgeEndOffset)); if (d2 < bd) { bd = d2; best = p - edgeEndOffset; } }
  }
  return best;
}
function overlapsOn(track, id, start, dur) {
  return track.clips.some(o => o.id !== id && o.start < start + dur - 1e-3 && clipEnd(o) > start + 1e-3);
}
function setZoom(p) {
  VC.pps = clamp(p, 12, 500);
  renderTimeline();
}

function initTimeline() {
  const scroll = $('#tlScroll');
  scroll.addEventListener('pointerdown', e => {
    const lbl = e.target.closest('[data-tact]');
    if (lbl) {
      const tr = VC.project.tracks.find(t => t.id === lbl.closest('.tl-row').dataset.track);
      const a = lbl.dataset.tact;
      if (a === 'hide') tr.hidden = !tr.hidden; else if (a === 'mute') tr.muted = !tr.muted; else tr.locked = !tr.locked;
      commit();
      return;
    }
    const clipEl = e.target.closest('.clip');
    if (clipEl) { startClipDrag(e, clipEl); return; }
    if (e.target.closest('.tl-label') || e.target.closest('.tl-corner')) return;
    // regla o zona vacía: mover cabezal y arrastrar
    if (VC.playing) pause();
    if (!e.target.closest('#tlRuler')) { VC.sel = null; emit('select'); }
    seek(timeAtX(e.clientX));
    tlDrag = { type: 'scrub' };
    scroll.setPointerCapture && scroll.setPointerCapture(e.pointerId);
  });
  scroll.addEventListener('pointermove', e => {
    if (tlDrag && tlDrag.type === 'scrub') seek(timeAtX(e.clientX));
  });
  const end = () => { if (tlDrag && tlDrag.type === 'scrub') tlDrag = null; };
  scroll.addEventListener('pointerup', end);
  scroll.addEventListener('pointercancel', end);
  scroll.addEventListener('wheel', e => {
    if (e.ctrlKey) { e.preventDefault(); setZoom(VC.pps * (e.deltaY < 0 ? 1.15 : 0.87)); }
  }, { passive: false });
  $('#zoomIn').onclick = () => setZoom(VC.pps * 1.3);
  $('#zoomOut').onclick = () => setZoom(VC.pps / 1.3);
  $('#zoomFit').onclick = () => {
    const w = scroll.clientWidth - LABEL_W - 24;
    VC.pps = clamp(w / Math.max(totalDur(), 5), 12, 500);
    renderTimeline();
    scroll.scrollLeft = 0;
  };
  $('#splitBtn').onclick = splitSelected;
  $('#delBtn').onclick = deleteSelected;
  $('#dupBtn').onclick = duplicateSelected;
}

function startClipDrag(e, el) {
  const id = el.dataset.id;
  const f = findClip(id);
  if (!f) return;
  if (VC.playing) pause();
  if (VC.sel !== id) { VC.sel = id; emit('select'); }
  if (f.t.locked) return;
  const mode = e.target.classList.contains('l') ? 'l' : e.target.classList.contains('r') ? 'r' : 'move';
  const c = f.c;
  tlDrag = {
    type: 'clip', id, mode, x0: e.clientX, moved: false,
    o: { start: c.start, in: c.in, out: c.out, track: f.t.id }
  };
  const move = ev => onClipDrag(ev);
  const up = () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
    const moved = tlDrag && tlDrag.moved;
    tlDrag = null;
    if (moved) commit();
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
  e.preventDefault();
}

function onClipDrag(e) {
  const d = tlDrag;
  if (!d || d.type !== 'clip') return;
  const dx = (e.clientX - d.x0) / VC.pps;
  if (!d.moved && Math.abs(e.clientX - d.x0) < 4 && d.mode !== 'move') { /* umbral de arrastre */ }
  if (!d.moved && Math.abs(e.clientX - d.x0) < 3) return;
  d.moved = true;
  const f = findClip(d.id);
  if (!f) return;
  const { c } = f;
  const o = d.o;
  const dur0 = (o.out - o.in) / c.speed;
  const asset = VC.assets[c.assetId];

  if (d.mode === 'move') {
    let ns = Math.max(0, snapTime(o.start + dx, c.id, dur0));
    // pista bajo el puntero
    let target = f.t;
    const lanes = $$('.tl-row');
    for (const row of lanes) {
      const r = row.getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY < r.bottom) {
        const tr = VC.project.tracks.find(t => t.id === row.dataset.track);
        if (tr && trackGrp(tr.kind) === clipGrp(c) && !tr.locked) target = tr;
      }
    }
    if (target.kind !== 'video' && overlapsOn(target, c.id, ns, dur0)) {
      if (target === f.t) return; // no permitir solaparse
      target = f.t;
      if (overlapsOn(target, c.id, ns, dur0)) return;
    }
    if (target !== f.t) { f.t.clips.splice(f.t.clips.indexOf(c), 1); target.clips.push(c); }
    c.start = ns;
  } else if (d.mode === 'l') {
    let ns = snapTime(o.start + dx, c.id);
    let dd = ns - o.start;
    if (o.start + dd < 0) dd = -o.start;
    if (hasSource(c) && o.in + dd * c.speed < 0) dd = -o.in / c.speed;
    const maxD = dur0 - 0.2;
    if (dd > maxD) dd = maxD;
    c.start = o.start + dd;
    if (hasSource(c)) c.in = o.in + dd * c.speed;
    else c.out = o.out - dd * c.speed;
  } else {
    let ne = snapTime(o.start + dur0 + dx, c.id);
    let newOut = o.in + (ne - o.start) * c.speed;
    if (hasSource(c) && asset) newOut = Math.min(newOut, asset.duration);
    c.out = Math.max(o.in + 0.2 * c.speed, newOut);
  }
  renderTimeline();
  seek(VC.t);
}
