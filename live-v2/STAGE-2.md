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

Las zonas de despliegue no son nuevas: se extrajeron de `PLAYER_DEPLOY` y `ENEMY_DEPLOY` de la base (`A`: 0,3; 1,3; 0,4; 2,5; 1,6; 2,6; `B`: 11,3; 10,3; 11,4; 9,5; 10,6; 9,6) y los obstáculos efectivos son 5,4; 6,4; 5,7; 6,7. No se definieron zonas para A2–A3/B2–B3: habilitarlas queda pendiente de reglas aprobadas.

La verificación PostgreSQL local queda separada de la suite Node. Ejecutar la migración dentro de una transacción en un PostgreSQL/Supabase local y probar dos sesiones concurrentes contra `live_v2.confirm_command`. Este entorno no incluye `psql`/`postgres`, por lo que esa verificación y todas las verificaciones remotas permanecen pendientes; no se afirma que hayan pasado.

El adaptador HTTP autentica sesiones y prepara creación, unión, snapshot, recuperación y comandos vía RPC; la confirmación calculada usa `SupabaseRepository.confirm`. Antes de desplegar debe empaquetarse el núcleo ESM para Deno y conectarse esa fase de cálculo al endpoint `command`; por diseño el stub no se despliega hasta esa revisión.

La migración expone las RPC `live_v2_create_room`, `live_v2_join_room`, `live_v2_snapshot`, `live_v2_recover_command`, `live_v2_prepare_command`, `live_v2_confirm_command`, `live_v2_reject_command`, `live_v2_backend_match` y `live_v2_claim_expired`. El cierre automático usa `p_automatic`, conserva CAS de versión/turno y omite únicamente las restricciones de miembro/plazo que impedirían al worker cerrar el turno ya vencido.
