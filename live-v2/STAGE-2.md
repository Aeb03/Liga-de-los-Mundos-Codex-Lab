# LIVE v2 — etapa 2: autoridad y sincronización

Implementación aislada, sin conexión a index.html y sin despliegue remoto.
Único destino futuro: Supabase Lab `szueqtkjclsumoadnien`.

## Ejecución

Pruebas Node: `node --test live-v2/*.test.mjs live-v2/server/*.test.mjs`.

Integración PostgreSQL: usar una base **local vacía** PostgreSQL 16+, crear los
roles `anon`, `authenticated` y `service_role`, aplicar la migración versionada
localmente y ejecutar `postgres-contract.test.sql`. Después, con PGHOST,
PGPORT, PGUSER, PGDATABASE y PGPASSWORD configurados para esa base:

`LIVE_V2_POSTGRES_TEST=1 node --test live-v2/*.test.mjs live-v2/server/*.test.mjs`

CI ejecuta ambos grupos en su contenedor efímero. La prueba de integración usa
el handler, servicio y repositorio reales contra las RPC PostgreSQL reales;
controla la autenticación y sustituye sólo el transporte PostgREST por SQL con
los mismos argumentos nombrados y el rol service_role. Cubre creación/unión,
selección/despliegue, privacidad, movimiento, aceptación/rechazo y recuperación,
cierre automático, concurrencia de comandos distintos, reintentos simultáneos
del mismo identificador y partidas independientes.

## Contrato

La identidad proviene de la sesión verificada. Equipo, slot y controlador están
separados; sólo se habilita combate 1v1, sin limitar el protocolo por celular.
Selección válida de cuatro habilidades, listo, despliegue oculto y confirmado,
inicio solicitado por el creador y movimiento/fin de turno del slot activo.
Zonas y obstáculos proceden de la base estable; no se alteran reglas offline.

El backend calcula con el núcleo. PostgreSQL bloquea la partida y confirma
versión/turno/fase/plazo, estado y comando en una transacción. Los identificadores
se vinculan a actor y contenido; los rechazos se guardan por una llamada separada
tras el rollback del cálculo/confirmación. Los resultados no pueden recuperarse
por otro controlador. RPC y tablas privadas tienen ACL backend-only.

Plazos externos: milisegundos enteros; almacenamiento: timestamptz. Un turno nuevo
recibe 30 segundos desde la confirmación de base; movimiento no renueva el plazo.
El worker escanea vencimientos; CAS evita avanzar dos veces con workers duplicados.
El coordinador aplica sólo versiones mayores, pero resuelve pendientes aunque
la respuesta sea antigua. No registrado permite reintentar las condiciones originales.
Rechazado permite reconocer el resultado y liberar el bloqueo.

## Pendiente antes de habilitar

Revisión y aprobación de este PR; validación del empaquetado y transporte Deno /
Supabase Auth / PostgREST; instalación del worker independiente; vistas y avisos
Realtime autorizados; integración UI y pruebas con celulares. No se afirma que
esas verificaciones remotas hayan ocurrido. No se publica la fila privada por
Realtime. La integración Node/PostgreSQL no reemplaza la futura prueba del entorno
Edge desplegado. Nada en este PR aplica migraciones ni despliega funciones.
