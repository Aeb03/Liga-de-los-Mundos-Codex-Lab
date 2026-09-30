# Liga de los Mundos — v0.6.38h1-v02 EXPERIMENTAL

Hotfix sobre v0.6.38-v02.

## Correcciones
- La tarjeta de autoridad online deja de cubrir la Arena: ahora se integra de forma compacta dentro del HUD inferior.
- Mover y Fin de turno quedan visibles en su columna habitual durante TU TURNO.
- En TURNO RIVAL esos controles se muestran bloqueados sin tapar el tablero.
- Al llegar el temporizador compartido a 0 s, el cliente con autoridad solicita automáticamente Fin de turno.
- Sólo el controlador activo dispara el timeout; `turn_seq` mantiene la protección contra doble avance.

## Sin cambios
- No requiere migración nueva de Supabase.
- Habilidades online siguen bloqueadas.
- Se conservan despliegue, autoridad, acciones por comandos y detección de desincronización de v0.6.38.
