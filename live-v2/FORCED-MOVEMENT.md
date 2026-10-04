# Lanza y Golpe Sísmico — Lab

Esta entrega continúa sobre el PR de alcance y efecto. No cambia archivos del offline, SQL, Auth, Cron ni Realtime.

| Habilidad | Regla efectiva | Desplazamiento bloqueado |
|---|---|---|
| Arte de la Lanza | Arfeli; 3 PA; 10 daño + Maestría; Manhattan 2 con LOS; atrae 1 casilla | 2 daño normal al objetivo; 1 al ocupante |
| Golpe Sísmico | Coloso; 3 PA; 10 daño; ocho casillas adyacentes; empuja 1 casilla | 4 daño normal al objetivo; 2 al ocupante |

Fuentes fijadas a `0b4983953a37fca0a60867f1007f78c67b263683`: `arfeli-rework-0626.js` (`spear`), `coloso-rework-0627.js` (`colosoQuakeOrigin`, `quakePush`), `app.js` (`forcedDirection`) y `balance-playtest.js` (`forcedMove`). Sísmico afecta un objetivo, no una cruz. En empates diagonales el eje X determina el desplazamiento ortogonal. Corte y Dagas conservan su geometría LIVE previamente aprobada.

Daño inicial → si sobrevive, intento de desplazamiento → colisión o paso real → Herida por ese paso. Escudos absorben daño de habilidad, colisión y Herida. Sin paso no se cobra Herida. No se gastan PM ni se cobra placaje. Veneno puede cancelar el efecto al matar al actor tras pagar PA. Muertes y ganador se resuelven dentro de la misma confirmación.

El cliente previsualiza usando una simulación pura del mismo núcleo: objetivo naranja, destino violeta con flecha, colisión, Herida y muerte. El primer toque no aplica nada; el segundo confirma al servidor. Los movimientos forzados del rival se publican en el historial de recorridos existente y no se repiten al reintentar el comando.

Quedan diferidos Pilares, proyección y réplicas de Sísmico en Monolito, trampas e invocaciones. Sísmico en Monolito se rechaza explícitamente. No se modifica la cámara, audio, parallax ni el tamaño aprobado del HUD.

## Verificación

`node --test live-v2/*.test.mjs live-v2/server/*.test.mjs live-v2/client/*.test.mjs`

Pruebas de alcance/LOS, diagonales, bordes, ocupación, colisión, escudo, Maestría, Veneno, Herida, muerte y ausencia de mutación; sincronización y reintentos en el servicio autoritativo. CI ejecuta además los dos contratos PostgreSQL reales. `forced-check.html` permite comprobar sin conexión: Dagas → mover Arfeli a (4,5) → Lanza sobre Coloso → fin de turno → Sísmico sobre Arfeli. La prueba con dos celulares físicos sigue pendiente.
