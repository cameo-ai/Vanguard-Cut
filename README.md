# Vanguard-Cut

Editor de vídeo para creadores. Versión **1.0.0**. Es una PWA (HTML/JS/CSS) empaquetada con **Capacitor** para Android (10 o superior) y con **Electron** para escritorio.

## Qué hace (v2.0.0)
- **Línea de tiempo multipista:** Video, Overlay (imagen sobre imagen, emojis, formas), Texto y Audio; varias pistas extra se crean solas. Arrastrar, recortar por los bordes, dividir (`S`), duplicar, eliminar, imán, zoom, deshacer/rehacer (`Ctrl+Z`/`Ctrl+Y`).
- **Medios:** vídeo, foto y audio (con forma de onda). Todo se procesa y guarda en el dispositivo.
- **Transiciones** (fundido, deslizar, zoom, cortina), **filtros**, ajustes de color, velocidad, opacidad, rotación, efectos (desenfoque, viñeta, espejo, pixelar).
- **Texto** con plantillas y animaciones, **subtítulos** (importar/editar/exportar .srt), **emojis y formas**, **sonidos y música generados** sin conexión, **marca** (logo, colores, fuente).
- **Proyecto guardado automáticamente** y formatos 9:16, 16:9, 1:1 y 4:5.
- **Exportación** 480p/720p/1080p (4K experimental), 24/30/60 fps, MP4 (H.264) si el dispositivo lo permite o WebM. Va en tiempo real: dura lo mismo que el vídeo.

En Android, al exportar se guarda en `Documentos/VanguardCut/` y se abre *Compartir* para enviarlo a tu nube personal.

## Estructura
- `www/` — la aplicación web (se edita aquí).
- `android/` — proyecto Android generado por Capacitor (ID `com.fer.vanguardcut`, minSdk 29).
- `electron/` — ventana de escritorio.
- `.github/workflows/` — compilación automática en la nube.

## Obtener el APK (sin instalar nada)
1. Sube un cambio a `main` (o ve a **Actions → Android APK → Run workflow**).
2. Al terminar, descarga `Vanguard-Cut-apk` en la sección *Artifacts* y pasa `app-debug.apk` al móvil.
3. Para generar una versión publicada: `git tag v1.0.0 && git push --tags`; el APK aparecerá en **Releases**.

> El APK está firmado con la clave de depuración de Android (válida para uso personal). Si más adelante quieres una clave propia o publicar en Google Play, se cambia en el workflow.

## Escritorio
- Probar: `npm install && npm run desktop`
- Instalador: `npm run desktop:build` (o con una etiqueta `v*` se genera en Actions para Windows y Linux).

## Desarrollo
- Vista web: `npm run web` → http://localhost:8080
- Tras editar `www/`: `npm run android:sync`
- Compilar local (necesita Android Studio y JDK 21): `npm run android:open`

## Limitaciones conocidas
- La exportación es en tiempo real y necesita la app abierta y en primer plano.
- Los WebM grabados por el navegador no llevan la duración en la cabecera (se reproducen bien, pero algunas redes los rechazan): usa MP4 cuando esté disponible.
- Subtítulos automáticos con IA, descarga desde enlaces (TikTok, YouTube…), publicación directa en redes y cuentas/sincronización quedan para versiones posteriores (necesitan un servidor).
- Stock de vídeos en línea: no incluido (requiere una clave de API).
