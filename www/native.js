// Puente nativo: en Android (Capacitor) guarda el vídeo en el teléfono y abre "Compartir"
// para enviarlo a tu nube personal. En navegador/Electron no hace nada.
(function () {
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  var P = cap.Plugins || {};
  function blobToBase64(blob) {
    return new Promise(function (ok, fail) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).split(',')[1]); };
      r.onerror = fail;
      r.readAsDataURL(blob);
    });
  }
  document.addEventListener('click', async function (ev) {
    var a = ev.target.closest && ev.target.closest('#downloadLink');
    if (!a || !a.href) return;
    ev.preventDefault();
    var toast = document.getElementById('toast');
    function say(t) { if (toast) { toast.textContent = t; toast.classList.add('show'); setTimeout(function () { toast.classList.remove('show'); }, 3500); } }
    try {
      var blob = await (await fetch(a.href)).blob();
      var name = a.download || 'vanguard-cut.webm';
      var res = await P.Filesystem.writeFile({
        path: 'VanguardCut/' + name,
        data: await blobToBase64(blob),
        directory: 'DOCUMENTS',
        recursive: true
      });
      say('Guardado en Documentos/VanguardCut/' + name);
      if (P.Share) await P.Share.share({ title: name, url: res.uri, dialogTitle: 'Enviar a mi nube' });
    } catch (e) {
      if (!/cancel/i.test(String(e && e.message))) say('No se pudo guardar el vídeo: ' + (e && e.message || e));
    }
  }, true);
})();
