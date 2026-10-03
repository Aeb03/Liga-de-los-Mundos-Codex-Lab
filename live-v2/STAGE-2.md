# Etapa 2 — autoridad y sincronización (revisión)

Nada de este directorio está conectado a la UI ni desplegado. La migración es sólo versionada; el destino futuro autorizado es el Lab `szueqtkjclsumoadnien`.

## Contrato
Cada intención incluye `id`, `matchId`, `type`, `expectedVersion` y, en combate, `expectedTurn`/`slotId`. La identidad procede de la sesión, nunca del cuerpo. Las versiones crecen al confirmar. El repositorio serializa comandos por partida, conserva idempotencia por huella y hace CAS; la función SQL repite versión/turno bajo bloqueo si el cálculo Edge ocurrió antes de la transacción. No hay políticas de escritura cliente.

Preparación bloquea listo al cambiar selección; despliegue oculta coordenadas rivales y desconfirma al mover; sólo el creador solicita el inicio. En combate sólo manda el controlador del slot activo. El plazo es servidor +30 s; acciones a plazo cumplido se rechazan. `expireTurn` es backend, compite por versión/turno y registra demora. Debe invocarlo un cron/worker durable: una Edge Function no mantiene timers.

`SyncCoordinator` unifica respuesta/Realtime/poll, nunca retrocede versión, descarta preview al desconectar y bloquea mientras un comando carece de confirmación. Reconexión recupera snapshot autorizado y reconsulta/reintenta el mismo ID.

## Pruebas locales
`node --test live-v2/*.test.mjs live-v2/server/*.test.mjs`

Cubren fases, permisos, ocultamiento, inicio, idempotencia, conflicto, CAS, reloj/cierre autónomo, movimiento del núcleo, desconexión, pendientes, orden de respuestas y slots estables. No hubo verificaciones remotas ni pruebas con celulares.

## Pendiente tras revisión
Aplicar la migración al Lab, implementar autenticación/SupabaseRepository real en el adaptador, desplegar Edge Function, instalar cron/worker de vencimientos y validar RLS/Realtime en staging. Realtime debe publicar vistas autorizadas, nunca la fila privada completa durante despliegue.
