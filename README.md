# Vanguard-Cut

Editor de vídeo para creadores. Versión **1.0.0**. Es una PWA (HTML/JS/CSS) empaquetada con **Capacitor** para Android (10 o superior) y con **Electron** para escritorio.

## Qué hace
Importa un vídeo, lo recorta (inicio/final), añade un título, aplica filtros y ajustes de imagen y exporta a WebM (480p/720p/1080p; 9:16, 16:9 o 1:1). Todo se procesa en el dispositivo.

En Android, al exportar el vídeo se guarda en `Documentos/VanguardCut/` y se abre el menú *Compartir* para enviarlo a tu nube personal (Drive, Dropbox, etc.).

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
No es multipista; la exportación depende del soporte de `MediaRecorder` del WebView; no hay MP4 nativo.
