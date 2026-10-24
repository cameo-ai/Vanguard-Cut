'use strict';
const isMobile = () => matchMedia('(max-width:900px)').matches;

function refreshTop() {
  $('#undoBtn').disabled = !canUndo();
  $('#redoBtn').disabled = !canRedo();
  $('#aspect').value = VC.project.aspect;
  if (document.activeElement !== $('#projName')) $('#projName').value = VC.project.name;
  $('#emptyHint').hidden = totalDur() > 0 || Object.keys(VC.project.tracks.flatMap(t => t.clips)).length > 0;
}
function refreshTime() {
  $('#curTime').textContent = fmt(VC.t);
  $('#totTime').textContent = fmt(totalDur());
  updatePlayhead();
}
function setTheme(t) {
  VC.settings.theme = t;
  document.documentElement.dataset.theme = t;
  const b = $('#themeBtn');
  b.innerHTML = ic(t === 'dark' ? 'moon' : 'sun', 18);
  const m = $('meta[name=theme-color]');
  if (m) m.content = t === 'dark' ? '#0d0d12' : '#f4f3fa';
  saveSettings();
}

function initStage() {
  const box = $('#stageBox');
  let drag = null;
  box.addEventListener('pointerdown', e => {
    if (VC.playing || E.exporting) return;
    const r = box.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    const ids = Object.keys(E.boxes);
    let hit = null;
    for (let i = ids.length - 1; i >= 0; i--) {
      const b = E.boxes[ids[i]];
      if (Math.abs(px - b.cx) <= b.w / 2 && Math.abs(py - b.cy) <= b.h / 2) { hit = ids[i]; break; }
    }
    if (hit && hit !== VC.sel) { VC.sel = hit; emit('select'); }
    const f = findClip(VC.sel);
    if (!f || !E.boxes[VC.sel] || f.t.locked) return;
    const b = E.boxes[VC.sel];
    if (!(Math.abs(px - b.cx) <= b.w / 2 + 0.03 && Math.abs(py - b.cy) <= b.h / 2 + 0.03)) return;
    drag = { x: e.clientX, y: e.clientY, cx: f.c.x, cy: f.c.y, w: r.width, h: r.height, moved: false };
    box.setPointerCapture(e.pointerId);
  });
  box.addEventListener('pointermove', e => {
    if (!drag) return;
    const f = findClip(VC.sel);
    if (!f) return;
    drag.moved = true;
    f.c.x = clamp(drag.cx + (e.clientX - drag.x) / drag.w, -1.5, 1.5);
    f.c.y = clamp(drag.cy + (e.clientY - drag.y) / drag.h, -1.5, 1.5);
    requestRender();
  });
  const up = () => { if (drag && drag.moved) { renderInspector(); commit(); } drag = null; };
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', up);
  new ResizeObserver(() => { fitStage(); drawPreview(); }).observe($('#stageWrap'));
}

function initTop() {
  $('#undoBtn').onclick = undo;
  $('#redoBtn').onclick = redo;
  $('#themeBtn').onclick = () => setTheme(VC.settings.theme === 'dark' ? 'light' : 'dark');
  $('#settingsBtn').onclick = () => { $('#setSafe').checked = VC.settings.safe; $('#setSnap').checked = VC.settings.snap; $('#settingsModal').hidden = false; };
  $('#setSafe').onchange = e => { VC.settings.safe = e.target.checked; $('#safeZone').hidden = !e.target.checked; saveSettings(); };
  $('#setSnap').onchange = e => { VC.settings.snap = e.target.checked; saveSettings(); };
  $('#aspect').onchange = e => { VC.project.aspect = e.target.value; commit(); fitStage(); drawPreview(); };
  $('#projName').onchange = e => { VC.project.name = e.target.value.trim() || 'Nuevo proyecto'; commit(); };
  $('#newProj').onclick = () => {
    if (!confirm('¿Empezar un proyecto nuevo? El actual se pierde (los medios importados se conservan).')) return;
    pause(); VC.project = newProject(); VC.sel = null; VC.t = 0; resetHistory(); scheduleSave();
    $('#settingsModal').hidden = true; emit('change'); emit('select');
  };
  $('#wipeAll').onclick = async () => {
    if (!confirm('Se borrarán proyecto, medios y marca guardados en este dispositivo. ¿Continuar?')) return;
    try { localStorage.clear(); } catch (e) { /* nada */ }
    await IDB.clear();
    location.reload();
  };
  $$('[data-close]').forEach(b => b.addEventListener('click', () => {
    const el = $('#' + b.dataset.close);
    if (el.classList.contains('modal')) el.hidden = true; else el.classList.remove('open');
  }));
  $$('.modal').forEach(m => m.addEventListener('pointerdown', e => { if (e.target === m && m.id !== 'exportModal') m.hidden = true; }));
  const pick = () => $('#fileInput').click();
  $('#emptyImport').onclick = pick;
  $('#fileInput').onchange = async e => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    if (!files.length) return;
    toast('Importando…');
    const ids = await importFiles(files);
    if (ids.length) {
      const first = VC.assets[ids[0]];
      if (!totalDur() && first.type !== 'audio') ids.forEach(id => { if (VC.assets[id].type !== 'audio') addMediaClip(id, false); });
      else if (first.type === 'audio') addMediaClip(ids[0], false);
      toast(ids.length > 1 ? ids.length + ' medios importados' : 'Medio importado');
    }
  };
}

function initTransport() {
  $('#playBtn').onclick = () => (VC.playing ? pause() : play());
  $('#toStart').onclick = () => seek(0);
  $('#toEnd').onclick = () => seek(totalDur());
  $('#muteBtn').onclick = () => {
    VC.muted = !VC.muted;
    audioCtx(); E.master.gain.value = VC.muted ? 0 : 1;
    $('#muteBtn').innerHTML = ic(VC.muted ? 'volx' : 'vol', 18);
  };
  $('#fullBtn').onclick = () => { const b = $('#stageBox'); (b.requestFullscreen || b.webkitRequestFullscreen || (() => toast('Pantalla completa no disponible'))).call(b); };
  $('#inspBtn').onclick = () => {
    if (!VC.sel) toast('Selecciona un clip en la línea de tiempo');
    openSheet('inspector', !$('#inspector').classList.contains('open'));
  };
}

function initKeys() {
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;
    if (!$('#exportModal').hidden || !$('#settingsModal').hidden) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); duplicateSelected(); }
    else if (k === ' ') { e.preventDefault(); VC.playing ? pause() : play(); }
    else if (k === 's') splitSelected();
    else if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSelected(); }
    else if (k === 'arrowleft') seek(VC.t - (e.shiftKey ? 1 : 0.1));
    else if (k === 'arrowright') seek(VC.t + (e.shiftKey ? 1 : 0.1));
    else if (k === 'home') seek(0);
    else if (k === 'end') seek(totalDur());
  });
}

async function boot() {
  await loadSaved();
  hydrateIcons();
  setTheme(VC.settings.theme);
  $('#safeZone').hidden = !VC.settings.safe;
  initTop(); initTransport(); initStage(); initTimeline(); initLibrary(); initInspector(); initExport(); initKeys();

  on('change', () => {
    renderTimeline(); renderInspector();
    if (['transitions', 'filters', 'text'].includes(VC.libTab)) renderLibrary();
    refreshTop();
    seek(VC.t);
    refreshTime();
  });
  on('select', () => {
    renderTimeline(); renderInspector();
    if (['transitions', 'filters', 'text'].includes(VC.libTab)) renderLibrary();
    if (isMobile() && VC.sel) openSheet('library', false);
    requestRender();
  });
  on('assets', () => { if (['media', 'audio'].includes(VC.libTab)) renderLibrary(); renderTimeline(); });
  on('peaks', () => drawWaveforms());
  on('tick', refreshTime);
  on('play', () => {
    $('#playBtn').innerHTML = ic(VC.playing ? 'pause' : 'play', 22);
    updateSelBox();
  });

  setLibTab('media', false);
  renderTimeline(); renderInspector(); refreshTop(); fitStage(); seek(0); refreshTime();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { /* sin SW */ });
}
window.addEventListener('DOMContentLoaded', boot);
