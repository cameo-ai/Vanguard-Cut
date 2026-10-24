'use strict';
// Extras: sonidos generados (sin conexión) y subtítulos SRT.

// ---------- WAV ----------
function wavBlob(samples, rate = 44100) {
  const n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); wr(8, 'WAVE'); wr(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  wr(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
  return new Blob([buf], { type: 'audio/wav' });
}
const SR = 44100;
function synth(dur, fn) {
  const n = Math.floor(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i);
  return out;
}
let _seed = 1;
const rnd = () => { _seed = (_seed * 16807) % 2147483647; return _seed / 1073741823.5 - 1; };

const SFX = [
  { id: 'whoosh', name: 'Whoosh', dur: 0.9, make() {
    let lp = 0;
    return synth(0.9, t => { const k = 0.03 + 0.5 * Math.sin(Math.PI * t / 0.9); lp += k * (rnd() - lp); return lp * Math.sin(Math.PI * t / 0.9) * 2.2; });
  } },
  { id: 'ding', name: 'Ding', dur: 1.4, make() {
    return synth(1.4, t => (Math.sin(2 * Math.PI * 880 * t) * 0.6 + Math.sin(2 * Math.PI * 1320 * t) * 0.3) * Math.exp(-t * 3.2));
  } },
  { id: 'pop', name: 'Pop', dur: 0.2, make() {
    return synth(0.2, t => Math.sin(2 * Math.PI * (150 + 500 * Math.exp(-t * 40)) * t) * Math.exp(-t * 22));
  } },
  { id: 'riser', name: 'Subida', dur: 2.5, make() {
    let ph = 0;
    return synth(2.5, t => { ph += 2 * Math.PI * (150 + 1100 * (t / 2.5) ** 2) / SR; return (Math.sin(ph) * 0.5 + rnd() * 0.12 * (t / 2.5)) * Math.min(1, t * 6) * (t / 2.5); });
  } },
  { id: 'impact', name: 'Golpe', dur: 1.2, make() {
    return synth(1.2, t => (Math.sin(2 * Math.PI * (45 + 90 * Math.exp(-t * 14)) * t) * 0.9 + rnd() * 0.4 * Math.exp(-t * 30)) * Math.exp(-t * 3.5));
  } },
  { id: 'beat', name: 'Ritmo 100 BPM', dur: 9.6, make() {
    const beat = 60 / 100;
    return synth(9.6, t => {
      const b = t / beat, ph = (b % 1) * beat, step = Math.floor(b) % 4;
      let s = 0;
      if (step === 0 || step === 2) s += Math.sin(2 * Math.PI * (50 + 110 * Math.exp(-ph * 30)) * ph) * Math.exp(-ph * 9) * 0.9;
      if (step === 1 || step === 3) s += rnd() * Math.exp(-ph * 16) * 0.5;
      const hp = ((b * 2) % 1) * beat / 2;
      s += rnd() * Math.exp(-hp * 60) * 0.18;
      return s;
    });
  } },
  { id: 'pad', name: 'Ambiente suave', dur: 12, make() {
    const ch = [[220, 277.18, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [196, 246.94, 293.66]];
    return synth(12, t => {
      const c = ch[Math.floor(t / 3) % 4];
      const lt = t % 3, env = Math.min(1, lt * 2) * Math.min(1, (3 - lt) * 2);
      let s = 0;
      for (const f of c) s += Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.004 * t) * 0.6;
      return s * 0.07 * env * (0.8 + 0.2 * Math.sin(t * 1.3));
    });
  } }
];
const sfxCache = {};
async function sfxFile(id) {
  const d = SFX.find(s => s.id === id);
  if (!sfxCache[id]) { _seed = 7; sfxCache[id] = wavBlob(d.make()); }
  return new File([sfxCache[id]], d.name + '.wav', { type: 'audio/wav' });
}
async function addSfx(id) {
  const file = await sfxFile(id);
  const existing = Object.values(VC.assets).find(a => a.type === 'audio' && a.name === file.name.replace(/\.wav$/, '') && a.gen);
  let aid = existing && existing.id;
  if (!aid) { const ids = await importFiles([file]); aid = ids[0]; if (aid) VC.assets[aid].gen = true; }
  if (aid) addMediaClip(aid, false);
}
let _prev = null;
async function previewSfx(id) {
  if (_prev) { _prev.pause(); _prev = null; }
  const f = await sfxFile(id);
  _prev = new Audio(URL.createObjectURL(f));
  _prev.play().catch(() => toast('Toca de nuevo para escuchar'));
}
function sfxPanelHTML() {
  return '<div class="section-label">Sonidos y música generados</div><p class="muted small">Se crean en tu dispositivo, sin conexión y sin derechos de autor.</p>' +
    SFX.map(s => `<div class="sfx"><div>${esc(s.name)}<br><small>${s.dur.toFixed(1)} s</small></div>
      <button class="icon-btn" data-sfx-play="${s.id}" title="Escuchar">${ic('play', 16)}</button>
      <button class="icon-btn" data-sfx-add="${s.id}" title="Añadir al vídeo">${ic('plus', 16)}</button></div>`).join('');
}

// ---------- Subtítulos SRT ----------
function srtTime(t) {
  t = Math.max(0, t);
  const ms = Math.round((t % 1) * 1000), s = Math.floor(t) % 60, m = Math.floor(t / 60) % 60, h = Math.floor(t / 3600);
  return [h, m, s].map(x => String(x).padStart(2, '0')).join(':') + ',' + String(ms === 1000 ? 999 : ms).padStart(3, '0');
}
function parseSrtTime(s) {
  const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4].padEnd(3, '0').slice(0, 3)) / 1000 : NaN;
}
function parseSrt(text) {
  const out = [];
  for (const blk of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = blk.split('\n').filter(l => l.trim() !== '');
    const i = lines.findIndex(l => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    const s = parseSrtTime(a), e = parseSrtTime(b);
    const content = lines.slice(i + 1).join('\n').replace(/<[^>]+>/g, '');
    if (isFinite(s) && isFinite(e) && e > s && content) out.push({ s, e, content });
  }
  return out;
}
const SUB_STYLE = () => ({ y: 0.32, sub: true, text: { content: 'Subtítulo', size: 54, bg: true, bgColor: '#000000b0', bold: true, anim: 'none' } });
function importSrt(text) {
  const cues = parseSrt(text);
  if (!cues.length) return toast('No se encontraron subtítulos en el archivo');
  for (const q of cues) {
    const st = SUB_STYLE();
    st.text.content = q.content;
    const c = newClip({ kind: 'text', start: q.s, in: 0, out: q.e - q.s, fit: 'contain', y: st.y, sub: true, text: Object.assign(textDefaults(), st.text) });
    laneFor('text', c.start, q.e - q.s).clips.push(c);
  }
  commit();
  toast(cues.length + ' subtítulos importados');
}
function subtitleClips() {
  return allClips().map(x => x.c).filter(c => c.sub).sort((a, b) => a.start - b.start);
}
function exportSrt() {
  const list = subtitleClips();
  if (!list.length) return toast('No hay subtítulos que exportar');
  const srt = list.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(clipEnd(c))}\n${c.text.content}\n`).join('\n');
  VCSave(new Blob([srt], { type: 'application/x-subrip' }), (VC.project.name.replace(/[^a-z0-9áéíóúñ\-_ ]+/gi, '-') || 'subtitulos') + '.srt');
}
function subsPanelHTML() {
  const list = subtitleClips();
  return `<div class="section-label">Subtítulos</div>
    <div class="row"><button class="secondary" data-act="srtImport">Importar .srt</button><button class="secondary" data-act="srtAdd">Añadir aquí</button></div>
    ${list.map(c => `<div class="sub-row"><span class="t" data-sub-go="${c.id}">${fmt(c.start).slice(0, -2)}</span><input type="text" data-sub="${c.id}" value="${esc(c.text.content.replace(/\n/g, ' '))}"><button class="icon-btn" data-sub-del="${c.id}" title="Quitar">${ic('x', 14)}</button></div>`).join('')}
    ${list.length ? '<button class="secondary full" data-act="srtExport" style="margin-top:8px">Exportar .srt</button>' : '<p class="muted small">Importa un archivo .srt o añade subtítulos a mano; se editan aquí mismo. Los subtítulos automáticos con IA llegarán en una versión posterior.</p>'}`;
}
