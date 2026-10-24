'use strict';
// Biblioteca (izquierda) e inspector (derecha).
const TABS = {
  media: 'Medios', stock: 'Fondos', audio: 'Audio', text: 'Texto', elements: 'Elementos',
  transitions: 'Transiciones', filters: 'Filtros', brand: 'Marca'
};
const GRADIENTS = [
  ['#7c3aed', '#06b6d4'], ['#f97316', '#ec4899'], ['#0ea5e9', '#6366f1'], ['#10b981', '#facc15'],
  ['#111827', '#6b7280'], ['#ef4444', '#f59e0b'], ['#8b5cf6', '#ec4899'], ['#0f172a', '#1e40af'],
  ['#fb7185', '#fde68a'], ['#064e3b', '#34d399'], ['#000000', '#000000'], ['#ffffff', '#e5e7eb']
];
const EMOJIS = '😀 😂 😍 🔥 ✨ 💥 ❤️ 👍 👏 🎉 🚀 ⭐ 💡 🎬 📸 🎵 😎 🤯 🥳 💯 👀 🙌 ✅ ⚡'.split(' ');
const SHAPES = [['rect', 'Cuadrado'], ['round', 'Redondeado'], ['circle', 'Círculo'], ['triangle', 'Triángulo'], ['star', 'Estrella'], ['heart', 'Corazón']];
const FONTS = [
  ['Inter, system-ui, sans-serif', 'Moderna'], ['Georgia, serif', 'Serif'], ['"Courier New", monospace', 'Mono'],
  ['Impact, "Arial Black", sans-serif', 'Impacto'], ['"Comic Sans MS", cursive', 'Divertida']
];
const TEXT_TPL = [
  { name: 'Título', y: 0, text: { content: 'TÍTULO', size: 120, anim: 'pop' } },
  { name: 'Subtítulo', y: 0.32, text: { content: 'Tu subtítulo aquí', size: 56, bg: true, bgColor: '#000000a8', bold: false } },
  { name: 'Rótulo', y: 0.3, text: { content: 'Nombre Apellido', size: 52, bg: true, bgColor: '#7c3aed', anim: 'slide' } },
  { name: 'Neón', y: 0, text: { content: 'NEÓN', size: 110, color: '#ffd6f5', shadowColor: '#ff3dcb', anim: 'fade' } },
  { name: 'Contorno', y: 0, text: { content: 'CONTORNO', size: 100, stroke: 8, strokeColor: '#000000' } },
  { name: 'Amarillo', y: -0.3, text: { content: 'ALUCINANTE', size: 96, color: '#ffe14d', stroke: 7, strokeColor: '#000000', font: 'Impact, "Arial Black", sans-serif', anim: 'pop' } }
];
const TRANSITIONS = [['none', 'Ninguna'], ['fade', 'Fundido'], ['slideL', 'Desliza ←'], ['slideR', 'Desliza →'], ['slideU', 'Sube'], ['zoom', 'Zoom'], ['wipe', 'Cortina']];
const FILTER_LIST = [['none', 'Original'], ['warm', 'Cálido'], ['cool', 'Frío'], ['mono', 'B/N'], ['vivid', 'Intenso'], ['fade', 'Suave'], ['sepia', 'Sepia'], ['vintage', 'Vintage'], ['drama', 'Drama']];
const FX_LIST = [['none', 'Ninguno'], ['blur', 'Desenfoque'], ['vignette', 'Viñeta'], ['mirror', 'Espejo'], ['pixel', 'Pixelar']];

function getBrand() {
  try { return Object.assign({ logo: '', c1: '#7c3aed', c2: '#ffffff', font: FONTS[0][0] }, JSON.parse(localStorage.getItem('vc_brand') || '{}')); }
  catch (e) { return { logo: '', c1: '#7c3aed', c2: '#ffffff', font: FONTS[0][0] }; }
}
function setBrand(b) { try { localStorage.setItem('vc_brand', JSON.stringify(b)); } catch (e) { toast('No hay espacio para guardar la marca'); } }

// ---------- biblioteca ----------
function openSheet(id, open = true) {
  $('#' + id).classList.toggle('open', open);
}
function setLibTab(tab, openSheetOnMobile = true) {
  VC.libTab = tab;
  $$('#rail button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('#libTitle').textContent = TABS[tab];
  renderLibrary();
  if (openSheetOnMobile) openSheet('library');
}
function assetCard(a, withOverlay) {
  const th = a.type === 'audio' ? ic('music', 26) : '';
  return `<div class="asset" data-asset="${a.id}">
    <div class="th" style="${a.thumb ? `background-image:url(${a.thumb})` : ''}">${th}</div>
    <span class="dur">${a.type === 'image' ? 'IMG' : fmt(a.duration).slice(0, -2)}</span>
    <div class="acts">${withOverlay && a.type !== 'audio' ? `<button data-aact="ov" title="Añadir como overlay (imagen sobre imagen)">${ic('copy', 13)}</button>` : ''}<button data-aact="del" title="Quitar de la biblioteca">${ic('x', 13)}</button></div>
    <small>${esc(a.name)}</small></div>`;
}
function renderLibrary() {
  const body = $('#libBody');
  const tab = VC.libTab;
  const assets = Object.values(VC.assets);
  let h = '';
  if (tab === 'media') {
    h += `<button class="primary full" data-act="import">${ic('plus', 16)} Importar vídeo, foto o audio</button>
      <p class="muted small">Toca un medio para añadirlo al final del vídeo. El botón de copia lo añade como overlay en la posición del cursor.</p>`;
    const list = assets.filter(a => a.type !== 'audio');
    h += list.length ? `<div class="grid">${list.map(a => assetCard(a, true)).join('')}</div>` : '<div class="empty">Aún no hay medios. Todo se procesa en tu dispositivo.</div>';
  } else if (tab === 'audio') {
    h += `<button class="primary full" data-act="import">${ic('music', 16)} Importar audio</button>
      <p class="muted small">La música se coloca en la posición del cursor, en la pista de audio. También puedes importar un vídeo y usar solo su sonido.</p>`;
    const list = assets.filter(a => a.type === 'audio');
    h += list.length ? `<div class="grid">${list.map(a => assetCard(a, false)).join('')}</div>` : '<div class="empty">No hay audios importados.</div>';
    h += sfxPanelHTML();
  } else if (tab === 'stock') {
    h += '<p class="muted small">Fondos generados en tu dispositivo (sin conexión). Se añaden como imagen de 5 s.</p><div class="grid g3">';
    GRADIENTS.forEach((g, i) => { h += `<button class="fond" data-fond="${i}" style="background:linear-gradient(160deg,${g[0]},${g[1]})" title="Fondo ${i + 1}"></button>`; });
    h += '</div>';
  } else if (tab === 'text') {
    h += '<p class="muted small">Añade un texto en la posición del cursor y edítalo en Propiedades.</p><div class="grid">';
    TEXT_TPL.forEach((t, i) => { h += `<button class="tpl" data-tpl="${i}" style="font-weight:800;color:${t.text.color || '#fff'};${t.text.bg ? `background:${t.text.bgColor}` : ''}">${t.name}</button>`; });
    h += '</div>' + subsPanelHTML();
  } else if (tab === 'elements') {
    h += '<div class="section-label">Emojis</div><div class="grid g4">' + EMOJIS.map(e => `<button class="emoji-btn" data-emoji="${e}">${e}</button>`).join('') + '</div>';
    h += '<div class="section-label">Formas</div><label class="field"><span>Color</span><input type="color" id="shapeColor" value="#7c3aed"></label><div class="grid g3">';
    SHAPES.forEach(s => { h += `<button class="swatch" data-shape="${s[0]}"><i style="background:#7c3aed;${s[0] === 'circle' ? 'border-radius:50%' : ''}"></i>${s[1]}</button>`; });
    h += '</div>';
  } else if (tab === 'transitions') {
    const f = findClip(VC.sel);
    h += `<p class="muted small">Selecciona un clip de la pista Video y elige una transición de entrada. Si hay un clip antes, se solapan para fundir de verdad.</p>
      <label class="ctl"><span>Duración</span><output id="trDurOut">${(f ? f.c.trans.dur : 0.6).toFixed(1)} s</output><input type="range" id="trDur" min="0.2" max="2" step="0.1" value="${f ? f.c.trans.dur : 0.6}"></label><div class="grid">`;
    TRANSITIONS.forEach(t => { h += `<button class="swatch ${f && f.c.trans.type === t[0] ? 'on' : ''}" data-trans="${t[0]}"><i></i>${t[1]}</button>`; });
    h += '</div>';
  } else if (tab === 'filters') {
    const f = findClip(VC.sel);
    h += '<p class="muted small">Selecciona un clip y toca un filtro.</p><div class="grid g3">';
    FILTER_LIST.forEach(t => { h += `<button class="swatch ${f && f.c.filter === t[0] ? 'on' : ''}" data-filter="${t[0]}"><i style="filter:${FILTERS[t[0]] || 'none'}"></i>${t[1]}</button>`; });
    h += '</div><button class="secondary full" data-act="filterAll" style="margin-top:12px">Aplicar el filtro del clip a todos</button>';
  } else if (tab === 'brand') {
    const b = getBrand();
    h += `<div class="section-label">Logo</div>
      ${b.logo ? `<img src="${b.logo}" alt="Logo" style="max-width:100%;max-height:90px;background:#888;border-radius:8px;padding:6px">` : '<p class="muted small">Sube tu logo (PNG con fondo transparente).</p>'}
      <div class="row"><button class="secondary" data-act="logoUp">${b.logo ? 'Cambiar' : 'Subir logo'}</button>${b.logo ? '<button class="primary" data-act="logoAdd">Añadir al vídeo</button>' : ''}</div>
      <div class="section-label">Colores y fuente</div>
      <label class="field"><span>Color principal</span><input type="color" id="brC1" value="${b.c1}"></label>
      <label class="field"><span>Color de texto</span><input type="color" id="brC2" value="${b.c2}"></label>
      <label class="field"><span>Fuente</span><select id="brFont">${FONTS.map(f => `<option value="${esc(f[0])}" ${f[0] === b.font ? 'selected' : ''}>${f[1]}</option>`).join('')}</select></label>
      <button class="secondary full" data-act="brandApply">Aplicar al texto seleccionado</button>`;
  }
  body.innerHTML = h;
}

async function makeGradient(i) {
  const g = GRADIENTS[i];
  const cv = document.createElement('canvas');
  cv.width = 1080; cv.height = 1920;
  const x = cv.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 1080, 1920);
  gr.addColorStop(0, g[0]); gr.addColorStop(1, g[1]);
  x.fillStyle = gr; x.fillRect(0, 0, 1080, 1920);
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const ids = await importFiles([new File([blob], 'Fondo ' + (i + 1) + '.png', { type: 'image/png' })]);
  if (ids[0]) addMediaClip(ids[0], false);
}

function initLibrary() {
  $('#rail').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    const same = VC.libTab === b.dataset.tab && $('#library').classList.contains('open');
    if (same) { openSheet('library', false); return; }
    setLibTab(b.dataset.tab);
  });
  $('#libBody').addEventListener('click', e => {
    const t = e.target;
    const act = t.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'import') $('#fileInput').click();
      else if (a === 'logoUp') $('#logoInput').click();
      else if (a === 'srtImport') $('#srtInput').click();
      else if (a === 'srtExport') exportSrt();
      else if (a === 'srtAdd') { const st = SUB_STYLE(); st.dur = 2.5; addTextClip(st); }
      else if (a === 'logoAdd') addLogo();
      else if (a === 'brandApply') applyBrandToSel();
      else if (a === 'filterAll') {
        const f = findClip(VC.sel);
        if (!f) return toast('Selecciona un clip con el filtro que quieres copiar');
        allClips().forEach(({ c }) => { if (c.kind === 'video' || c.kind === 'image') { c.filter = f.c.filter; } });
        commit();
      }
      return;
    }
    const sp = t.closest('[data-sfx-play]'); if (sp) { previewSfx(sp.dataset.sfxPlay); return; }
    const sa = t.closest('[data-sfx-add]'); if (sa) { addSfx(sa.dataset.sfxAdd); return; }
    const sg = t.closest('[data-sub-go]');
    if (sg) { const f = findClip(sg.dataset.subGo); if (f) { VC.sel = f.c.id; emit('select'); seek(f.c.start + 0.05); } return; }
    const sd = t.closest('[data-sub-del]');
    if (sd) { VC.sel = sd.dataset.subDel; deleteSelected(); return; }
    const card = t.closest('[data-asset]');
    if (card) {
      const aa = t.closest('[data-aact]');
      const id = card.dataset.asset;
      if (aa && aa.dataset.aact === 'del') { if (confirm('¿Quitar este medio y sus clips del proyecto?')) removeAsset(id); }
      else addMediaClip(id, !!(aa && aa.dataset.aact === 'ov'));
      if (matchMedia('(max-width:900px)').matches) openSheet('library', false);
      return;
    }
    const fond = t.closest('[data-fond]'); if (fond) { makeGradient(+fond.dataset.fond); return; }
    const tpl = t.closest('[data-tpl]');
    if (tpl) {
      const base = TEXT_TPL[+tpl.dataset.tpl], br = getBrand();
      const copy = JSON.parse(JSON.stringify(base));
      if (copy.name === 'Rótulo') copy.text.bgColor = br.c1;
      addTextClip(copy);
      return;
    }
    const em = t.closest('[data-emoji]'); if (em) { addEmojiClip(em.dataset.emoji); return; }
    const sh = t.closest('[data-shape]'); if (sh) { addShapeClip(sh.dataset.shape, $('#shapeColor').value); return; }
    const tr = t.closest('[data-trans]'); if (tr) { applyTransition(tr.dataset.trans); renderLibrary(); return; }
    const fl = t.closest('[data-filter]');
    if (fl) {
      const f = findClip(VC.sel);
      if (!f || !isVisual(f.c) || f.c.kind === 'text') return toast('Selecciona un clip de vídeo o imagen');
      f.c.filter = fl.dataset.filter; commit(); return;
    }
  });
  $('#libBody').addEventListener('input', e => {
    if (e.target.id === 'trDur') {
      const f = findClip(VC.sel);
      $('#trDurOut').textContent = (+e.target.value).toFixed(1) + ' s';
      if (f) f.c.trans.dur = +e.target.value;
    }
  });
  $('#libBody').addEventListener('change', e => {
    if (e.target.dataset.sub) {
      const f = findClip(e.target.dataset.sub);
      if (f) { f.c.text.content = e.target.value; commit(); }
      return;
    }
    const id = e.target.id;
    if (id === 'trDur') commit();
    if (id === 'brC1' || id === 'brC2' || id === 'brFont') {
      const b = getBrand();
      b.c1 = $('#brC1').value; b.c2 = $('#brC2').value; b.font = $('#brFont').value;
      setBrand(b);
    }
  });
  $('#srtInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) importSrt(await file.text());
  });
  $('#logoInput').addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { const b = getBrand(); b.logo = r.result; setBrand(b); renderLibrary(); };
    r.readAsDataURL(file);
  });
}
async function addLogo() {
  const b = getBrand();
  if (!b.logo) return;
  const blob = await (await fetch(b.logo)).blob();
  const ids = await importFiles([new File([blob], 'Logo.png', { type: blob.type || 'image/png' })]);
  if (!ids[0]) return;
  const total = Math.max(totalDur(), 3);
  const c = newClip({ kind: 'image', assetId: ids[0], start: 0, in: 0, out: total, fit: 'contain', scale: 0.22, x: 0.36, y: -0.4, opacity: 0.95 });
  laneFor('overlay', 0, total).clips.push(c);
  VC.sel = c.id; commit(); emit('select');
}
function applyBrandToSel() {
  const f = findClip(VC.sel);
  if (!f || f.c.kind !== 'text') return toast('Selecciona un texto en la línea de tiempo');
  const b = getBrand();
  f.c.text.font = b.font; f.c.text.color = b.c2;
  if (f.c.text.bg) f.c.text.bgColor = b.c1;
  commit();
}

// ---------- inspector ----------
const FMT = {
  pct: v => Math.round(v * 100) + '%', x: v => v.toFixed(2) + '×', deg: v => Math.round(v) + '°',
  s: v => (+v).toFixed(1) + ' s', raw: v => Math.round(v) + '', num: v => Math.round(v) + ' px', pctN: v => Math.round(v) + '%'
};
function getPath(o, p) { return p.split('.').reduce((a, k) => a[k], o); }
function setPath(o, p, v) { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; }
function range(label, k, v, min, max, step, f) {
  return `<label class="ctl"><span>${label}</span><output>${FMT[f](v)}</output><input type="range" data-k="${k}" data-f="${f}" min="${min}" max="${max}" step="${step}" value="${v}"></label>`;
}
function seg(k, opts, cur) {
  return `<div class="seg">${opts.map(o => `<button data-set="${k}=${o[0]}" class="${cur === o[0] ? 'on' : ''}">${o[1]}</button>`).join('')}</div>`;
}
function renderInspector() {
  const body = $('#inspBody');
  const f = findClip(VC.sel);
  $$('#inspTabs button').forEach(b => b.classList.toggle('active', b.dataset.itab === VC.inspTab));
  if (!f) { body.innerHTML = '<div class="empty">Selecciona un clip de la línea de tiempo para editarlo.</div>'; return; }
  const c = f.c, tab = VC.inspTab;
  const vis = isVisual(c);
  let h = '';
  if (tab === 'video') {
    if (!vis) h = '<div class="empty">Este clip es solo audio. Usa la pestaña Audio.</div>';
    else {
      h += `<details open><summary>Transformar</summary>
        ${range('Posición X', 'x', c.x, -1, 1, 0.01, 'pct')}${range('Posición Y', 'y', c.y, -1, 1, 0.01, 'pct')}
        ${range('Escala', 'scale', c.scale, 0.1, 4, 0.01, 'x')}${range('Rotación', 'rot', c.rot, -180, 180, 1, 'deg')}
        <label class="check"><input type="checkbox" data-k="flip"> Voltear horizontalmente</label>
        ${c.kind === 'video' || c.kind === 'image' ? seg('fit', [['cover', 'Rellenar'], ['contain', 'Ajustar']], c.fit) : ''}</details>`;
      if (c.kind === 'video') h += `<details open><summary>Velocidad</summary>${range('Velocidad', 'speed', c.speed, 0.25, 4, 0.05, 'x')}</details>`;
      if (c.kind === 'video' || c.kind === 'image') {
        h += `<details open><summary>Efectos</summary><div class="grid g3">${FX_LIST.map(x => `<button class="swatch ${c.fx === x[0] ? 'on' : ''}" data-set="fx=${x[0]}"><i></i>${x[1]}</button>`).join('')}</div></details>`;
      }
      h += `<details open><summary>Opacidad</summary>${range('Opacidad', 'opacity', c.opacity, 0, 1, 0.01, 'pct')}</details>`;
      if (c.kind === 'emoji' || c.kind === 'shape') h += `<details open><summary>Tamaño</summary>${range('Tamaño', 'size', c.size, 40, 900, 5, 'num')}${c.kind === 'shape' ? `<label class="field"><span>Color</span><input type="color" data-k="color"></label>` : ''}</details>`;
      if (c.kind === 'video' || c.kind === 'image') {
        h += `<details><summary>Transición de entrada</summary>${seg('trans.type', TRANSITIONS.map(t => [t[0], t[1]]), c.trans.type)}${range('Duración', 'trans.dur', c.trans.dur, 0.2, 2, 0.1, 's')}</details>`;
      }
    }
  } else if (tab === 'audio') {
    if (c.kind !== 'video' && c.kind !== 'audio') h = '<div class="empty">Este clip no tiene audio.</div>';
    else {
      h += `<details open><summary>Volumen</summary>${range('Volumen', 'vol', c.vol, 0, 2, 0.01, 'pct')}
        ${c.kind === 'video' ? '<label class="check"><input type="checkbox" data-k="mute"> Silenciar el audio de este clip</label>' : ''}</details>
        <details open><summary>Fundidos</summary>${range('Entrada', 'fadeIn', c.fadeIn, 0, 5, 0.1, 's')}${range('Salida', 'fadeOut', c.fadeOut, 0, 5, 0.1, 's')}</details>`;
      if (c.kind === 'audio') h += `<details open><summary>Velocidad</summary>${range('Velocidad', 'speed', c.speed, 0.5, 2, 0.05, 'x')}</details>`;
    }
  } else if (tab === 'text') {
    if (c.kind !== 'text') h = '<div class="empty">Selecciona un clip de texto.</div>';
    else {
      const T = c.text;
      h += `<label class="field"><span>Contenido</span><textarea data-k="text.content" data-str="1">${esc(T.content)}</textarea></label>
        <label class="field"><span>Fuente</span><select data-k="text.font" data-str="1">${FONTS.map(f => `<option value="${esc(f[0])}" ${f[0] === T.font ? 'selected' : ''}>${f[1]}</option>`).join('')}</select></label>
        ${range('Tamaño', 'text.size', T.size, 20, 300, 1, 'num')}
        <label class="field"><span>Color</span><input type="color" data-k="text.color"></label>
        <label class="check"><input type="checkbox" data-k="text.bold"> Negrita</label>
        <label class="check"><input type="checkbox" data-k="text.shadow"> Sombra</label>
        ${range('Contorno', 'text.stroke', T.stroke, 0, 20, 1, 'raw')}
        <label class="field"><span>Color del contorno</span><input type="color" data-k="text.strokeColor"></label>
        <label class="check"><input type="checkbox" data-k="text.bg"> Caja de fondo</label>
        <label class="field"><span>Color de la caja</span><input type="color" data-k="text.bgColor"></label>
        <div class="section-label">Animación de entrada</div>${seg('text.anim', [['none', 'Ninguna'], ['fade', 'Fundido'], ['slide', 'Subir'], ['pop', 'Pop']], T.anim)}`;
    }
  } else if (tab === 'adjust') {
    if (!vis || c.kind === 'text' || c.kind === 'emoji' || c.kind === 'shape') h = '<div class="empty">Los ajustes de color se aplican a vídeo e imagen.</div>';
    else {
      h += `<details open><summary>Filtro</summary><div class="grid g3">${FILTER_LIST.map(t => `<button class="swatch ${c.filter === t[0] ? 'on' : ''}" data-set="filter=${t[0]}"><i style="filter:${FILTERS[t[0]] || 'none'}"></i>${t[1]}</button>`).join('')}</div></details>
        <details open><summary>Color</summary>${range('Brillo', 'adj.b', c.adj.b, 0, 200, 1, 'pctN')}${range('Contraste', 'adj.c', c.adj.c, 0, 200, 1, 'pctN')}
        ${range('Saturación', 'adj.s', c.adj.s, 0, 200, 1, 'pctN')}${range('Tono', 'adj.h', c.adj.h, -180, 180, 1, 'deg')}${range('Desenfoque', 'adj.blur', c.adj.blur, 0, 20, 1, 'raw')}
        <button class="secondary full" data-set="reset=adj">Restablecer ajustes</button></details>`;
    }
  }
  body.innerHTML = h;
  // valores de color y casillas (no se pueden fijar bien con innerHTML)
  $$('[data-k]', body).forEach(el => {
    const v = getPath(c, el.dataset.k);
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'color') el.value = /^#[0-9a-f]{6}/i.test(v) ? v.slice(0, 7) : '#000000';
  });
}

function initInspector() {
  const body = $('#inspBody');
  $('#inspTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-itab]');
    if (!b) return;
    VC.inspTab = b.dataset.itab;
    renderInspector();
  });
  body.addEventListener('input', e => {
    const el = e.target;
    const k = el.dataset.k;
    const f = findClip(VC.sel);
    if (!k || !f) return;
    if (el.type === 'checkbox') return;
    let v;
    if (el.type === 'range') v = +el.value; else v = el.value;
    if (el.type === 'color' && /bgColor$/.test(k)) v = el.value + 'a8';
    setPath(f.c, k, v);
    if (el.type === 'range') { const out = el.previousElementSibling; if (out) out.textContent = FMT[el.dataset.f](v); }
    if (k === 'speed' || k === 'text.content') renderTimeline();
    requestRender();
  });
  body.addEventListener('change', e => {
    const el = e.target, k = el.dataset.k, f = findClip(VC.sel);
    if (!k || !f) return;
    if (el.type === 'checkbox') setPath(f.c, k, el.checked);
    commit();
  });
  body.addEventListener('click', e => {
    const b = e.target.closest('[data-set]');
    if (!b) return;
    const f = findClip(VC.sel);
    if (!f) return;
    const [k, v] = b.dataset.set.split('=');
    if (k === 'reset') f.c.adj = { b: 100, c: 100, s: 100, h: 0, blur: 0 };
    else setPath(f.c, k, v);
    if (k === 'trans.type') { applyTransition(v); return; }
    commit();
  });
}
