![Hydra Nexus — Extend your Hydra experience](../../assets/promo/overview.jpg)

[English](../../README.md) · [Português (Brasil)](pt-BR.md) · [Español](es.md) · [Русский](ru.md) · [العربية](ar.md) · [Français](fr.md) · [Deutsch](de.md) · [Türkçe](tr.md) · [Polski](pl.md)

# Hydra Nexus

Hydra Nexus es una extensión comunitaria de Hydra Launcher para Windows. Añade gestión del almacenamiento, copias de partidas y logros locales, cuentas de Steam por juego, actividad, pestañas, notas y fondos propios. Activa las herramientas que necesites en Plugins. Sigue el idioma de Hydra y utiliza controles nativos compatibles con tu tema. Requiere una instalación previa de Hydra Launcher.

**[Descargar instalador](https://github.com/M0KA40/Hydra-Nexus/releases/latest/download/Hydra_Nexus.bat)** · [Notas de versión](../../docs/releases/2.0.0/es.md) · [Informar de un problema](https://github.com/M0KA40/Hydra-Nexus/issues/new/choose)

## Steam launch settings

![Steam launch settings](../../assets/features/steam.webp)

Asigna a cada juego una cuenta de Steam guardada y un modo de inicio. Default / standalone no pide a Nexus que inicie Steam ni cambie de cuenta; una sesión abierta permanece intacta. Steam online usa una cuenta personal conectada. Steam offline fuerza el modo sin conexión de la cuenta elegida, incluidas las compartidas. Solo aparecen cuentas ya guardadas. Desactiva la pregunta de selección de cuenta al iniciar Steam para permitir el cambio automático.

**Dónde usarlo:** Library → game page → Steam button beside Play

## Game Storage Manager

![Game Storage Manager](../../assets/features/storage.webp)

Consulta juegos instalados por unidad, espacio libre y tamaño medido. Busca y ordena por tamaño o último uso. Abre una carpeta o mueve juegos tras revisar destino y espacio. Las copias se verifican antes de actualizar rutas y eliminar originales. Se indican carpetas inciertas y mediciones parciales. No se modifican registros de otros lanzadores ni accesos directos.

**Dónde usarlo:** Settings → below Big Picture → Game Storage Manager

## Play Activity

![Play Activity](../../assets/features/activity.webp)

Revisa sesiones, tiempo y última fecha de juego. Los resúmenes semanales y mensuales muestran juegos, días activos y logros fechados disponibles. Controla avisos con la campana o desactiva resúmenes y avisos manteniendo el seguimiento. El historial detallado comienza con Nexus; los totales antiguos no reconstruyen sesiones anteriores.

**Dónde usarlo:** Sidebar → Play activity; per-game graph beside playtime

## Game Backup

![Game Backup](../../assets/features/backup.png)

Guarda puntos de recuperación separados para partidas y logros locales. Restaura, abre la carpeta o extrae una copia verificada sin reemplazar partidas actuales. Añade carpetas o detén nuevas copias de un juego conservando su historial. Para la nube, elige una carpeta sincronizada por Google Drive para ordenadores; Drive sincroniza sin iniciar sesión de Google en Nexus. Cierra los juegos antes de restaurar. Restaurar logros locales no desbloquea logros de cuentas Steam/Epic.

**Dónde usarlo:** Sidebar → Backup; game Options → General → Backup

## Extract Path

![Extract Path](../../assets/features/extract.webp)

Descarga archivos en una unidad y extrae el juego en otra. Activa la extracción automática y elige Extract path. Nexus recuerda el último destino aceptado y el de cada descarga en cola, creando una carpeta por juego. Los archivos permanecen en el destino de descarga para reanudar/compartir, salvo que actives por separado su eliminación tras extraer.

**Dónde usarlo:** Download settings → automatic extraction → Extract path

## Download Finish Actions

![Download Finish Actions](../../assets/features/finish.webp)

Elige aviso, suspensión o apagado del PC cuando termine toda la cola y las extracciones activadas. Hay 60 segundos para cancelar acciones de energía. Nuevas descargas reanudan la espera; cerrar Hydra cancela. Activar el plugin exige reiniciar Hydra y nunca arma automáticamente una acción.

**Dónde usarlo:** Downloads → beside Cancel → Download Finish Actions

## Invisible Mode

![Invisible Mode](../../assets/features/invisible.webp)

Controla el uso compartido de actividad en Hydra conservando progreso local e imágenes. Activar el plugin enciende Invisible Mode; luego puedes cambiarlo en el menú de cuenta. La actividad privada sigue local al desactivarlo hasta reanudar explícitamente su envío. La presencia puede tardar y los avisos también dependen de los servidores de Hydra.

**Dónde usarlo:** Account menu → below Friends → Invisible Mode

## Game Tabs

![Game Tabs](../../assets/features/tabs.webp)

Abre varias páginas de juegos en pestañas de la misma ventana. Se conservan resultados, filtros y desplazamiento del catálogo. Haz clic derecho en Catálogo o Biblioteca y elige Open in New Tab; cambia en la barra y cierra con ×. Las pestañas pertenecen a la sesión actual y no se recuperan tras reiniciar completamente.

**Dónde usarlo:** Catalogue or Library → right-click → Open in New Tab

## Custom backgrounds

[![](../../assets/media/custom-background-preview.jpg)](../../assets/media/custom-background.mp4)

Elige una imagen o vídeo local como fondo. Ajusta oscuridad y desenfoque, pausa opcionalmente el vídeo cuando Hydra esté inactivo y restaura el fondo del tema con Reset. La reproducción depende del códec; se recomienda H.264 MP4 o WebM.

**Dónde usarlo:** Hydra Nexus Settings → Themes → Choose image or video

## Otras herramientas

- Game Notes — texto y enlaces por juego, ventana independiente, siempre visible y atajo para enfocarla.
- Nexus Mods — abre la página de mods correspondiente o una búsqueda si no hay coincidencia fiable.
- PC Compatibility — compara especificaciones confirmadas con requisitos mínimos publicados; no predice FPS.
- Updater — busca versiones, verifica el instalador y actualiza/reinicia Hydra.

## Idiomas de la interfaz

| Idioma | Nombre nativo | Interfaz de Nexus |
| --- | --- | --- |
| en | English | ✓ Compatible |
| pt-BR | Português (Brasil) | ✓ Compatible |
| es | Español | ✓ Compatible |
| ru | Русский | ✓ Compatible |
| ar | العربية | ✓ Compatible |
| fr | Français | ✓ Compatible |
| de | Deutsch | ✓ Compatible |
| tr | Türkçe | ✓ Compatible |
| pl | Polski | ✓ Compatible |

## Instalación y actualización

1. Descarga Hydra_Nexus.bat desde Releases.
2. Cierra Hydra por completo, incluido el icono de la bandeja.
3. Ejecuta el BAT y elige Install / Update / Repair.
4. Abre Hydra → Settings → Hydra Nexus → Plugins.

El instalador no necesita Node.js o Python por separado. Se mantienen ajustes, notas, historial y copias. Si una actualización de Hydra reemplaza los cambios, reaplica una versión compatible. Proyecto independiente de Hydra Launcher, Valve, Google y Nexus Mods. Incluye versiones y pasos de reproducción al informar de errores.

## Más información

[Privacy](../../docs/privacy.md) · [Troubleshooting](../../docs/troubleshooting.md) · [Changelog](../../CHANGELOG.md) · [Contributing](../../CONTRIBUTING.md) · [MIT](../../LICENSE) · [Third-party notices](../../THIRD_PARTY_NOTICES.md)

## Compilar desde el código

```sh
python build.py
```
