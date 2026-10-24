# Decisiones y estado

- **Estado:** v2.0.0 (rama `v2`): editor multipista. La v1.0.0 sigue en `main`.
- **Android con Capacitor, no Electron:** Electron solo genera apps de escritorio. Electron se usa para Windows/Linux.
- **APK, no AAB:** uso personal, sin Google Play. Firma de depuración.
- **minSdk 29 (Android 10).**
- **Compilación en GitHub Actions:** no se necesita Android Studio.
- **Nube personal:** mediante el menú Compartir de Android (sin integrar un proveedor concreto).
- **Repositorio:** privado por defecto; idioma: español.
- **v2 sin servidor:** todo en el dispositivo (IndexedDB para proyecto y medios). IA, enlaces de redes y publicación quedan fuera hasta definir un servidor.
- **Transiciones por solape:** el clip entrante se solapa con el anterior (así se funden de verdad).
- **Exportación en tiempo real** con canvas + MediaRecorder; MP4 solo si el dispositivo graba H.264.
- **Pendiente:** probar en un móvil real (exportación, guardado en Documentos, rendimiento con vídeos largos).
