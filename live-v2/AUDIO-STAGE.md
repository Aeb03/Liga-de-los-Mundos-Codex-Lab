# Paridad Offline → LIVE v2: audio y Opciones

Build: `20261005-audio1`.

Se reutilizan los MP3 aprobados, ganancias de `audio-config-0600.js`, el grafo WebAudio de `audio-engine-0600.js`, la música/ciclo de vida de `music-engine-0633.js` y el panel de `audio-options-0601.js`/CSS. Los motores adaptados viven en `live-v2/client`; las funciones de combate offline no se cargan.

- Opciones en lobby y engranaje compacto de cámara en arena. Master, música, SFX y mute persisten en `liga-audio-settings-v1`; defaults 1.00 / 0.40 / 0.92 / false.
- Primer gesto desbloquea audio. Los SFX se precargan, usan ganancias aprobadas, deduplicación y máximo de tres sonidos fuertes simultáneos.
- Lobby: mismo MP3 y loop 0.52–169.30 s. Arena: mismo MP3 y loop 0.36–156.88 s; fade 650 ms y duck 0.58. Resultado sin música. Visibilidad y pagehide pausan los motores.
- El servidor transforma eventos confirmados en cues públicos sin coordenadas ni metadatos ocultos. Ambos clientes reciben una historia acotada de 32 batches en `presentation.audio`.
- Trampas: colocación silenciosa; activación usa el archivo aprobado de pinchos o eléctrica. No se publican sonidos predictivos ni se instalan hooks offline.
- Curación, escudo, ruptura y KO salen de resultados reales. Ataques cancelados por muerte de Veneno no reproducen el sonido de ataque.
- Polling/respuestas duplicadas no repiten sonidos. Primera conexión, reconexión, regreso desde segundo plano y batches antiguos se descartan como historial.

Validación automática: mapas semánticos/privacidad, assets, buses/mute/desbloqueo, persistencia/defaults, escenas/loops/visibilidad y autoridad/idempotencia. Las pruebas PostgreSQL siguen dependiendo del entorno de integración y no se declaran ejecutadas localmente.

Pendiente de validación real en dos celulares: MP3 audibles, niveles, selección/lobby → arena, acciones de ambos jugadores, mute/volúmenes al recargar, fondo/retorno, trampa silenciosa y KO sin música de resultado. No constituye checkpoint estable hasta esa validación.
