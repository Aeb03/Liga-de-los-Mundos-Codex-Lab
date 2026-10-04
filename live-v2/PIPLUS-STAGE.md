# Piplus completo en LIVE v2

Porta `piplus-rework-0628.js` del commit base `0b4983953a37fca0a60867f1007f78c67b263683`, junto con daño, Herida y movimiento forzado de `balance-playtest.js`. No modifica archivos del offline ni corrige la transparencia de sus vistas.

Piplus conserva 90 PV, 6 PA, 3 PM e iniciativa 6. Se seleccionan cuatro de sus seis habilidades; Marca es una acción propia disponible fuera de esa selección.

| Acción | Coste | Regla |
|---|---:|---|
| Marcar Objetivo | 0 PA | Enemigo campeón vivo, alcance Manhattan 4 y LOS, una vez por turno. Persiste al cambiar de turno. No dispara Veneno. |
| Disparo Preciso | 3 PA | Alcance 4, LOS; 8 de daño, 10 contra el marcado. Puede dañar Pilares enemigos. |
| Vector de Empuje | 3 PA | Alcance 3, LOS; 6 de daño y empuje de 1 casilla, 2 contra el marcado. Dirección fija, eje X al empatar. |
| Impulso | 2 PA | Destino cardinal libre a distancia 1 o 2, sin LOS ni gasto de PM, una vez por turno. Cruza obstáculos y ocupación intermedia. Primero empuja 1 casilla al enemigo situado exactamente detrás. |
| Interferencia | 2 PA | Marcado a alcance 4, LOS; penalización de 1 PM en su siguiente inicio de turno, una vez por rival y turno. No acumula por encima de otra penalización mayor. |
| Ruptura | 4 PA | Marcado a alcance 4, LOS; 14 de daño, elimina Marca y Fijación e impide volver a marcar ese turno. |
| Fijación | 2 PA | Marcado a alcance 4 con LOS. La siguiente habilidad ofensiva contra él ignora LOS y consume Fijación. No amplía alcance; expira al cerrar el turno. Impulso no la consume. |

Daño normal absorbe escudo. Vector y el empuje previo de Impulso aplican Herida por paso efectivo y colisión de 2 por paso bloqueado al desplazado, la mitad al bloqueador. Impulso aterriza directamente y aplica Herida por distancia lógica; no cobra placaje. Si el empuje previo termina el combate, no se ejecuta el desplazamiento. Veneno se resuelve al pagar habilidades y puede cancelar sus efectos si mata al usuario.

El cliente muestra los objetivos y destinos consultados al núcleo, Marca y Fijación en el HUD, y la previsualización exacta de daño/desplazamientos. Confirmar requiere tocar otra vez el objetivo o destino elegido. La autoridad verifica controlador, turno, versión, plazo y selección de habilidades. Los reintentos recuperan el resultado sin duplicar costes, marcas, daño ni animación.

## Verificación

```sh
node --test live-v2/*.test.mjs live-v2/server/*.test.mjs live-v2/client/*.test.mjs
```

`piplus.test.mjs` cubre reglas, atomicidad, restauración, escudos, Herida, Veneno mortal, LOS, límites, empujes, final de combate y animación. Ejecuta además las funciones originales de validación de destinos y enemigo posterior contra todos los puntos del tablero. `server.test.mjs` comprueba Marca e Impulso a través del servicio autoritativo, selección, permisos, plazos, idempotencia y snapshots iguales de ambos miembros.

`piplus-check.html` es una escena local sin sala ni red para inspeccionar Marca, Fijación e Impulso. La prueba física pendiente usa `motion.html?v=20261004-piplus1`, creando una sala nueva con Piplus y un rival. Equipar cuatro habilidades; después crear otra sala con las dos restantes. Comprobar que ambos celulares muestran los mismos PV, PA, PM, posiciones, estados y turno. La revisión automática no sustituye esa prueba física.

Sin cambios de esquema, Auth, RLS, cron ni Realtime. El despliegue actualiza solamente el paquete de reglas compartido de las funciones de comando y vencimiento en Supabase Lab `szueqtkjclsumoadnien`.
