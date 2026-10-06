# Paridad Offline → LIVE v2: VFX, Registro y resultado

Build: `20261006-feedback2`. Base: checkpoint de audio validado en celular por Adrián.

## Implementación

- Primitivas y CSS de `visual-effects.js`/`visual-effects.css` reutilizados: flotantes, impacto, proyectil, escudo/ruptura, área, estado aplicado/activado, desplazamiento, aparición/desaparición, transferencia, trampa activada, Marca/Vínculo, transformación, pulso y KO. No se cargan los hooks mecánicos offline.
- El servidor transforma sólo eventos aceptados en descriptores públicos. Historia de 16 batches, máximo 96 efectos por acción. Las áreas usan las funciones geométricas del core, incluso sus casillas vacías.
- Trampas colocadas/desarmadas no generan datos en el historial público. La activación revela sólo su efecto ya disparado; nunca se copia un evento crudo ni una trampa oculta al cliente rival.
- Los puntos se proyectan con `getScreenCTM` del tablero y su rotación: conservan paneo, zoom y giro. Root no intercepta pulsaciones, tiene máximo de 72 nodos y limpieza al cambiar partida/ocultar app. El modo de movimiento reducido conserva feedback textual.
- Registro: últimas ocho entradas aceptadas, compartidas por ambos clientes y recuperables del snapshot. Plegable y arrastrable; posición y plegado usan el HUD existente. Texto escapado antes de renderizar.
- Resultado: Victoria/Derrota según equipo del usuario, PV/KO de cada campeón, modo y ronda. Abandono previo al combate muestra Partida finalizada. Volver al Lobby usa el flujo existente; no se inventa un protocolo de revancha.
- KO final conserva la arena 1.2 s para el feedback; después abre resultado sin música. Un snapshot ya terminado se abre directamente, sin repetir animaciones anteriores.
- El jugador que abandona ve el resultado confirmado y puede volver al lobby después.

## Verificación

224 tests automáticos PASS; dos pruebas PostgreSQL requieren el entorno de integración y quedan omitidas localmente. Cobertura nueva: daño efectivo/escudo/KO, no mutación del core por feedback, privacidad de trampas, geometría AoE completa, relaciones/estados, reconexión/deduplicación, resultado por perspectiva, HTML escapado, límite de historia e idempotencia.

`feedback-check.html` es una revisión visual LOCAL, sin salas ni conexión: daño/escudo, Enredaderas, Victoria, Derrota y Registro. No equivale a una partida real online.

Pendiente de prueba real en dos celulares: ubicación/ritmo de VFX con cámara, mismos impactos/números en ambos jugadores, Registro plegado/arrastre, KO y resultado correcto para cada equipo, abandono y vuelta al lobby.
