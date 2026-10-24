'use strict';
const ASPECTS = { '9:16': [9, 16], '16:9': [16, 9], '1:1': [1, 1], '4:5': [4, 5] };
const BASE_TRACKS = ['v1', 'ov', 'tx', 'au'];
const VC = {
  assets: {}, project: null, sel: null, t: 0, playing: false, pps: 60,
  inspTab: 'video', libTab: 'media',
  settings: { snap: true, safe: false, theme: 'dark' }
};
const bus = new EventTarget();
function emit(n, d) { bus.dispatchEvent(new CustomEvent(n, { detail: d })); }
function on(n, f) { bus.addEventListener(n, e => f(e.detail)); }

function newProject() {
  return {
    name: 'Nuevo proyecto', aspect: '9:16', fps: 30,
    tracks: [
      { id: 'v1', kind: 'video', name: 'Video', clips: [] },
      { id: 'ov', kind: 'overlay', name: 'Overlay', clips: [] },
      { id: 'tx', kind: 'text', name: 'Texto', clips: [] },
      { id: 'au', kind: 'audio', name: 'Audio', clips: [] }
    ]
  };
}

// ---------- utilidades de clips ----------
const clipDur = c => (c.out - c.in) / c.speed;
const clipEnd = c => c.start + clipDur(c);
const hasSource = c => c.kind === 'video' || c.kind === 'audio';
const isVisual = c => c.kind !== 'audio';
const trackGrp = k => (k === 'audio' ? 'audio' : k === 'text' ? 'text' : 'vis');
const clipGrp = c => (c.kind === 'audio' ? 'audio' : c.kind === 'text' ? 'text' : 'vis');
function allClips() {
  const out = [];
  for (const t of VC.project.tracks) for (const c of t.clips) out.push({ c, t });
  return out;
}
function findClip(id) {
  if (!id) return null;
  for (const t of VC.project.tracks) {
    const c = t.clips.find(c => c.id === id);
    if (c) return { c, t };
  }
  return null;
}
function totalDur() {
  let m = 0;
  for (const t of VC.project.tracks) for (const c of t.clips) m = Math.max(m, clipEnd(c));
  return m;
}
function newClip(o) {
  return Object.assign({
    id: uid(), kind: 'video', assetId: null, start: 0, in: 0, out: 1, speed: 1,
    vol: 1, fadeIn: 0, fadeOut: 0, opacity: 1, x: 0, y: 0, scale: 1, rot: 0, flip: false,
    fit: 'cover', filter: 'none', fx: 'none',
    adj: { b: 100, c: 100, s: 100, h: 0, blur: 0 },
    trans: { type: 'none', dur: 0.6 }
  }, o);
}
function addTrack(kind) {
  const P = VC.project;
  const names = { overlay: 'Overlay', text: 'Texto', audio: 'Audio', video: 'Video' };
  const same = P.tracks.filter(t => t.kind === kind);
  const t = { id: uid(), kind, name: names[kind] + ' ' + (same.length + 1), clips: [] };
  const idx = P.tracks.lastIndexOf(same[same.length - 1]);
  P.tracks.splice(idx + 1, 0, t);
  return t;
}
function laneFor(kind, start, dur, ignoreId) {
  const tracks = VC.project.tracks.filter(t => t.kind === kind && !t.locked);
  for (const t of tracks) {
    if (!t.clips.some(c => c.id !== ignoreId && c.start < start + dur - 1e-3 && clipEnd(c) > start + 1e-3)) return t;
  }
  return addTrack(kind);
}
function cleanupTracks() {
  VC.project.tracks = VC.project.tracks.filter(t => BASE_TRACKS.includes(t.id) || t.clips.length);
}

// ---------- historial ----------
const H = { stack: [], i: -1 };
const snapshot = () => JSON.stringify(VC.project);
function commit() {
  cleanupTracks();
  const s = snapshot();
  if (H.stack[H.i] === s) { emit('change'); return; }
  H.stack = H.stack.slice(0, H.i + 1);
  H.stack.push(s);
  if (H.stack.length > 100) H.stack.shift();
  H.i = H.stack.length - 1;
  scheduleSave();
  emit('change');
}
function resetHistory() { H.stack = [snapshot()]; H.i = 0; }
function restore() {
  VC.project = JSON.parse(H.stack[H.i]);
  if (VC.sel && !findClip(VC.sel)) VC.sel = null;
  scheduleSave();
  emit('change');
}
function undo() { if (H.i > 0) { H.i--; restore(); } }
function redo() { if (H.i < H.stack.length - 1) { H.i++; restore(); } }
const canUndo = () => H.i > 0;
const canRedo = () => H.i < H.stack.length - 1;

function setSaveState(t) { const el = $('#saveState'); if (el) el.textContent = t; }
function scheduleSave() {
  setSaveState('Guardando…');
  clearTimeout(scheduleSave._t);
  scheduleSave._t = setTimeout(() => {
    try { localStorage.setItem('vc_project', snapshot()); setSaveState('Guardado en este dispositivo'); }
    catch (e) { setSaveState('No se pudo guardar'); }
  }, 400);
}
function saveSettings() { try { localStorage.setItem('vc_settings', JSON.stringify(VC.settings)); } catch (e) { /* sin almacenamiento */ } }

// ---------- almacenamiento de medios (IndexedDB) ----------
const IDB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('vanguard-cut', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('assets', { keyPath: 'id' });
      r.onsuccess = () => { IDB.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  store(mode) { return IDB.db.transaction('assets', mode).objectStore('assets'); },
  put(rec) {
    return new Promise(res => {
      if (!IDB.db) return res(false);
      try { const q = IDB.store('readwrite').put(rec); q.onsuccess = () => res(true); q.onerror = () => res(false); }
      catch (e) { res(false); }
    });
  },
  all() {
    return new Promise(res => {
      if (!IDB.db) return res([]);
      try { const q = IDB.store('readonly').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); }
      catch (e) { res([]); }
    });
  },
  del(id) {
    return new Promise(res => {
      if (!IDB.db) return res();
      try { const q = IDB.store('readwrite').delete(id); q.onsuccess = q.onerror = () => res(); } catch (e) { res(); }
    });
  },
  clear() {
    return new Promise(res => {
      if (!IDB.db) return res();
      try { const q = IDB.store('readwrite').clear(); q.onsuccess = q.onerror = () => res(); } catch (e) { res(); }
    });
  }
};

function guessType(file) {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (['mp4', 'webm', 'mov', 'mkv', 'm4v', '3gp', 'avi'].includes(ext)) return 'video';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'].includes(ext)) return 'audio';
  return null;
}
function thumbOf(src, w, h) {
  const cv = document.createElement('canvas');
  const tw = 200, th = Math.max(1, Math.round(200 * h / (w || 1)));
  cv.width = tw; cv.height = Math.min(th, 360);
  try { cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height); return cv.toDataURL('image/jpeg', 0.6); }
  catch (e) { return ''; }
}
function probe(a) {
  return new Promise(res => {
    let settled = false;
    const done = v => { if (!settled) { settled = true; res(v); } };
    setTimeout(() => done(null), 15000);
    if (a.type === 'image') {
      const i = new Image();
      i.onload = () => done({ w: i.naturalWidth, h: i.naturalHeight, duration: 5, thumb: thumbOf(i, i.naturalWidth, i.naturalHeight) });
      i.onerror = () => done(null);
      i.src = a.url;
      return;
    }
    const el = document.createElement(a.type === 'video' ? 'video' : 'audio');
    el.preload = 'metadata'; el.muted = true; el.playsInline = true;
    const afterMeta = () => {
      const dur = el.duration;
      if (a.type === 'audio') return done({ duration: dur });
      el.onseeked = () => {
        el.onseeked = null;
        done({ w: el.videoWidth, h: el.videoHeight, duration: dur, thumb: thumbOf(el, el.videoWidth, el.videoHeight) });
      };
      el.currentTime = Math.min(0.1, dur / 2);
    };
    el.onloadedmetadata = () => {
      if (el.duration === Infinity) { // WebM de MediaRecorder sin duración
        el.ondurationchange = () => { if (isFinite(el.duration)) { el.ondurationchange = null; afterMeta(); } };
        el.currentTime = 1e7;
      } else afterMeta();
    };
    el.onerror = () => done(null);
    el.src = a.url;
  });
}
async function computePeaks(a) {
  try {
    if (a.blob.size > 90e6) return;
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const buf = await new Ctx(1, 1, 44100).decodeAudioData(await a.blob.arrayBuffer());
    const ch = buf.getChannelData(0);
    const per = Math.floor(buf.sampleRate / 20);
    const n = Math.ceil(ch.length / per);
    const peaks = new Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0;
      const end = Math.min(ch.length, (i + 1) * per);
      for (let j = i * per; j < end; j += 8) { const v = Math.abs(ch[j]); if (v > m) m = v; }
      peaks[i] = Math.round(m * 100);
    }
    a.peaks = peaks;
    IDB.put({ id: a.id, name: a.name, type: a.type, blob: a.blob, duration: a.duration, w: a.w, h: a.h, thumb: a.thumb, peaks });
    emit('peaks');
  } catch (e) { /* códec no decodificable: sin forma de onda */ }
}
async function importFiles(files) {
  const ids = [];
  for (const file of files) {
    const type = guessType(file);
    if (!type) { toast('Formato no compatible: ' + file.name); continue; }
    const a = { id: uid(), name: file.name.replace(/\.[^.]+$/, ''), type, blob: file, url: URL.createObjectURL(file) };
    const info = await probe(a);
    if (!info || !isFinite(info.duration)) { URL.revokeObjectURL(a.url); toast('No se pudo leer ' + file.name); continue; }
    Object.assign(a, info);
    VC.assets[a.id] = a;
    ids.push(a.id);
    IDB.put({ id: a.id, name: a.name, type, blob: file, duration: a.duration, w: a.w, h: a.h, thumb: a.thumb });
    emit('assets');
    if (type !== 'image') computePeaks(a);
  }
  return ids;
}
async function removeAsset(id) {
  for (const t of VC.project.tracks) t.clips = t.clips.filter(c => c.assetId !== id);
  const a = VC.assets[id];
  if (a) URL.revokeObjectURL(a.url);
  delete VC.assets[id];
  await IDB.del(id);
  if (VC.sel && !findClip(VC.sel)) VC.sel = null;
  commit();
  emit('assets');
}

async function loadSaved() {
  try { await IDB.open(); } catch (e) { /* sin IndexedDB */ }
  for (const r of await IDB.all()) VC.assets[r.id] = Object.assign({}, r, { url: URL.createObjectURL(r.blob) });
  try { const s = JSON.parse(localStorage.getItem('vc_settings') || 'null'); if (s) Object.assign(VC.settings, s); } catch (e) { /* ignorar */ }
  try { const s = localStorage.getItem('vc_project'); if (s) VC.project = JSON.parse(s); } catch (e) { /* ignorar */ }
  if (!VC.project || !Array.isArray(VC.project.tracks)) VC.project = newProject();
  for (const t of VC.project.tracks) t.clips = t.clips.filter(c => !c.assetId || VC.assets[c.assetId]);
  for (const id of BASE_TRACKS) {
    if (!VC.project.tracks.some(t => t.id === id)) { VC.project = newProject(); break; }
  }
  resetHistory();
}

// ---------- operaciones de edición ----------
function addMediaClip(assetId, asOverlay) {
  const a = VC.assets[assetId];
  if (!a) return;
  const dur = a.type === 'image' ? 5 : a.duration;
  const c = newClip({ kind: a.type, assetId, in: 0, out: dur });
  if (a.type === 'audio') {
    c.start = VC.t;
    laneFor('audio', c.start, dur).clips.push(c);
  } else if (asOverlay) {
    c.start = VC.t; c.fit = 'contain'; c.scale = 0.5;
    laneFor('overlay', c.start, dur).clips.push(c);
  } else {
    const v1 = VC.project.tracks.find(t => t.id === 'v1');
    c.start = v1.clips.reduce((m, x) => Math.max(m, clipEnd(x)), 0);
    v1.clips.push(c);
  }
  VC.sel = c.id;
  commit();
  emit('select');
}
const textDefaults = () => ({
  content: 'Tu texto', font: 'Inter, system-ui, sans-serif', size: 90, color: '#ffffff', bold: true,
  stroke: 0, strokeColor: '#000000', bg: false, bgColor: '#000000a0', shadow: true, shadowColor: '#000000cc', anim: 'none'
});
function addTextClip(tpl) {
  const T = Object.assign(textDefaults(), tpl.text || {});
  const dur = tpl.dur || 3;
  const c = newClip({ kind: 'text', start: VC.t, in: 0, out: dur, fit: 'contain', y: tpl.y ?? 0, text: T, sub: !!tpl.sub });
  laneFor('text', c.start, dur).clips.push(c);
  VC.sel = c.id;
  commit();
  emit('select');
}
function addEmojiClip(emoji) {
  const c = newClip({ kind: 'emoji', start: VC.t, in: 0, out: 3, emoji, size: 260 });
  laneFor('overlay', c.start, 3).clips.push(c);
  VC.sel = c.id; commit(); emit('select');
}
function addShapeClip(shape, color) {
  const c = newClip({ kind: 'shape', start: VC.t, in: 0, out: 3, shape, color, size: 380 });
  laneFor('overlay', c.start, 3).clips.push(c);
  VC.sel = c.id; commit(); emit('select');
}
function splitSelected() {
  const f = findClip(VC.sel);
  if (!f) { toast('Selecciona un clip para dividirlo'); return; }
  const { c, t } = f;
  const at = VC.t;
  if (at <= c.start + 0.1 || at >= clipEnd(c) - 0.1) { toast('Coloca el cursor dentro del clip'); return; }
  const c2 = JSON.parse(JSON.stringify(c));
  c2.id = uid();
  const cut = c.in + (at - c.start) * c.speed;
  c2.in = cut; c2.start = at; c2.trans = { type: 'none', dur: c.trans.dur }; c2.fadeIn = 0;
  c.out = cut; c.fadeOut = 0;
  t.clips.splice(t.clips.indexOf(c) + 1, 0, c2);
  VC.sel = c2.id;
  commit(); emit('select');
}
function deleteSelected() {
  const f = findClip(VC.sel);
  if (!f) return;
  if (f.t.locked) { toast('La pista está bloqueada'); return; }
  const { c, t } = f;
  const d = clipDur(c), s = c.start;
  t.clips.splice(t.clips.indexOf(c), 1);
  if (t.kind === 'video') for (const o of t.clips) if (o.start >= s) o.start = Math.max(0, o.start - d); // sin huecos
  VC.sel = null;
  commit(); emit('select');
}
function duplicateSelected() {
  const f = findClip(VC.sel);
  if (!f) return;
  const c2 = JSON.parse(JSON.stringify(f.c));
  c2.id = uid(); c2.start = clipEnd(f.c); c2.trans = { type: 'none', dur: f.c.trans.dur };
  const lane = f.t.kind === 'video' ? f.t : laneFor(f.t.kind, c2.start, clipDur(c2));
  lane.clips.push(c2);
  VC.sel = c2.id; commit(); emit('select');
}
function applyTransition(type) {
  const f = findClip(VC.sel);
  if (!f || (f.c.kind !== 'video' && f.c.kind !== 'image')) { toast('Selecciona un clip de vídeo o imagen'); return; }
  const { c, t } = f;
  c.trans.type = type;
  if (type !== 'none' && t.kind === 'video') {
    const prev = t.clips.filter(p => p !== c && clipEnd(p) <= c.start + 0.05 && clipEnd(p) > c.start - 0.15)
      .sort((a, b) => clipEnd(b) - clipEnd(a))[0];
    if (prev && c.start >= clipEnd(prev) - 0.01) {
      const d = Math.min(c.trans.dur, clipDur(prev) - 0.1, clipDur(c) - 0.1);
      if (d > 0.05) {
        const old = c.start;
        for (const o of t.clips) if (o.start >= old - 1e-6) o.start = Math.max(0, o.start - d);
      }
    }
  }
  commit();
}
