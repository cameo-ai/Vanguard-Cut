'use strict';
// Exportación: compone todas las pistas en un canvas y graba vídeo + audio mezclado.
const EXP = { cancelled: false, running: false, formats: [] };

function detectFormats() {
  if (!window.MediaRecorder) return [];
  const cands = [
    ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'MP4 (H.264)', 'mp4'],
    ['video/mp4;codecs=avc1,mp4a.40.2', 'MP4 (H.264)', 'mp4'],
    ['video/mp4;codecs=avc3.42E01E,mp4a.40.2', 'MP4 (H.264)', 'mp4'],
    ['video/webm;codecs=vp9,opus', 'WebM (VP9)', 'webm'],
    ['video/webm;codecs=vp8,opus', 'WebM (VP8)', 'webm'],
    ['video/webm', 'WebM', 'webm']
  ];
  const seen = new Set();
  return cands.filter(c => {
    if (!MediaRecorder.isTypeSupported(c[0])) return false;
    if (seen.has(c[2] + c[1].slice(0, 3))) return false;
    seen.add(c[2] + c[1].slice(0, 3));
    return true;
  }).map(c => ({ mime: c[0], label: c[1], ext: c[2] }));
}

function openExport() {
  if (EXP.running) return;
  if (!totalDur()) { toast('Añade un clip antes de exportar'); return; }
  pause();
  $('#exProgWrap').hidden = true;
  $('#downloadLink').classList.add('hidden');
  $('#exStart').hidden = false;
  $('#exCancel').textContent = 'Cancelar';
  $('#exMsg').textContent = `Duración: ${fmt(totalDur())}. La exportación va en tiempo real: mantén la app abierta y en primer plano.`;
  EXP.formats = detectFormats();
  const sel = $('#exFormat');
  sel.innerHTML = EXP.formats.map((f, i) => `<option value="${i}">${f.label}</option>`).join('');
  if (!EXP.formats.length) { $('#exMsg').textContent = 'Este navegador no puede grabar vídeo. Prueba con Chrome o Edge.'; $('#exStart').hidden = true; }
  $('#exportModal').hidden = false;
}

async function runExport() {
  const total = totalDur();
  const fmtSel = EXP.formats[+$('#exFormat').value];
  if (!fmtSel || !total) return;
  const short = +$('#exRes').value, fps = +$('#exFps').value, q = $('#exQual').value;
  const [w, h] = dims(VC.project.aspect, short);
  const factor = { low: 0.05, mid: 0.09, high: 0.15 }[q];
  const bitrate = Math.round(w * h * fps * factor);

  EXP.cancelled = false; EXP.running = true; E.exporting = true;
  const prevT = VC.t;
  $('#exStart').hidden = true;
  $('#exCancel').textContent = 'Cancelar exportación';
  $('#exProgWrap').hidden = false;
  $('#exBar').style.width = '0%';
  $('#exProgLbl').textContent = 'Preparando…';
  $('#downloadLink').classList.add('hidden');
  updateSelBox();

  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const actx = audioCtx();
  try { await actx.resume(); } catch (e) { /* ignorar */ }
  E.master.gain.value = 0;

  const vstream = cv.captureStream(fps);
  const stream = new MediaStream([...vstream.getVideoTracks(), ...E.expDest.stream.getAudioTracks()]);
  let rec;
  try { rec = new MediaRecorder(stream, { mimeType: fmtSel.mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: 128000 }); }
  catch (e) { toast('No se pudo iniciar la exportación'); return endExport(prevT); }
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };

  // Preparar elementos de multimedia en el instante 0
  VC.t = 0;
  sync(0, false);
  const t0ready = performance.now();
  await new Promise(res => {
    const chk = () => {
      const pend = Array.from(E.els.values()).some(o => o.type === 'video' && o.el.readyState < 2);
      if (!pend || performance.now() - t0ready > 4000) res(); else setTimeout(chk, 60);
    };
    chk();
  });
  renderFrame(ctx, w, h, 0, false);

  rec.onstop = () => {
    if (EXP.cancelled) return endExport(prevT);
    const blob = new Blob(chunks, { type: fmtSel.mime.split(';')[0] });
    const link = $('#downloadLink');
    if (link.dataset.url) URL.revokeObjectURL(link.dataset.url);
    const url = URL.createObjectURL(blob);
    link.dataset.url = url;
    link.href = url;
    link.download = (VC.project.name.trim().replace(/[^a-z0-9áéíóúñ\-_ ]+/gi, '-') || 'vanguard-cut') + '.' + fmtSel.ext;
    link.classList.remove('hidden');
    $('#exMsg').textContent = `Vídeo listo · ${(blob.size / 1048576).toFixed(1)} MB · ${w}×${h}`;
    $('#exBar').style.width = '100%';
    $('#exProgLbl').textContent = 'Exportación completada';
    endExport(prevT, true);
  };

  rec.start(500);
  const start = performance.now();
  const step = () => {
    if (EXP.cancelled) { try { rec.stop(); } catch (e) { endExport(prevT); } return; }
    const t = (performance.now() - start) / 1000;
    if (t >= total) {
      renderFrame(ctx, w, h, total - 0.001, false);
      setTimeout(() => { try { rec.stop(); } catch (e) { /* ya parado */ } }, 300);
      return;
    }
    VC.t = t;
    sync(t, true);
    renderFrame(ctx, w, h, t, false);
    const pct = Math.round(t / total * 100);
    $('#exBar').style.width = pct + '%';
    $('#exProgLbl').textContent = `Exportando… ${pct}% (${fmt(t)} / ${fmt(total)})`;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function endExport(prevT, ok) {
  EXP.running = false; E.exporting = false;
  if (E.master) E.master.gain.value = VC.muted ? 0 : 1;
  VC.t = prevT;
  sync(prevT, false);
  requestRender();
  emit('tick');
  if (!ok) {
    $('#exStart').hidden = false;
    $('#exCancel').textContent = 'Cerrar';
    $('#exProgLbl').textContent = EXP.cancelled ? 'Exportación cancelada' : 'No se completó la exportación';
  } else {
    $('#exCancel').textContent = 'Cerrar';
  }
}

function initExport() {
  $('#exportBtn').onclick = openExport;
  $('#exStart').onclick = runExport;
  $('#exCancel').onclick = () => {
    if (EXP.running) { EXP.cancelled = true; return; }
    $('#exportModal').hidden = true;
  };
}
