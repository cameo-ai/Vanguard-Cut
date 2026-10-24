// Puente nativo: en Android (Capacitor) guarda el archivo en Documentos/VanguardCut y abre "Compartir"
// para enviarlo a tu nube personal. En navegador/Electron usa la descarga normal.
(function () {
  function isNative() { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); }
  function blobToBase64(blob) {
    return new Promise(function (ok, fail) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).split(',')[1]); };
      r.onerror = fail;
      r.readAsDataURL(blob);
    });
  }
  function say(t) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = t; el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 3800);
  }
  // Guarda un Blob: nativo → Filesystem + Share; web → <a download>
  window.VCSave = async function (blob, name) {
    if (!isNative()) {
      var u = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      return;
    }
    var P = Capacitor.Plugins || {};
    try {
      var res = await P.Filesystem.writeFile({ path: 'VanguardCut/' + name, data: await blobToBase64(blob), directory: 'DOCUMENTS', recursive: true });
      say('Guardado en Documentos/VanguardCut/' + name);
      if (P.Share) await P.Share.share({ title: name, url: res.uri, dialogTitle: 'Enviar a mi nube' });
    } catch (e) {
      if (!/cancel/i.test(String(e && e.message))) say('No se pudo guardar: ' + (e && e.message || e));
    }
  };
  if (!isNative()) return;
  document.addEventListener('click', async function (ev) {
    var a = ev.target.closest && ev.target.closest('#downloadLink');
    if (!a || !a.href) return;
    ev.preventDefault();
    var blob = await (await fetch(a.href)).blob();
    window.VCSave(blob, a.download || 'vanguard-cut.webm');
  }, true);
})();
