# Corrección de conexión al crear salas

El 4 de octubre de 2026 se reprodujo el aviso `signal is aborted without reason` al crear salas. El cliente cancela la petición a los 12 segundos. Los registros del Lab mostraron más de 60.000 errores SQLSTATE 40001 en `live_v2_confirm_command` durante la investigación.

La RPC usaba `40001` para un rechazo CAS `VERSION_CONFLICT`. Este es un conflicto de aplicación con argumentos obsoletos, no una serialización transitoria. PostgREST 14 reintenta indefinidamente ese SQLSTATE: https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b

La migración `20261004160000_live_v2_conflict_error.sql` conserva la definición existente y reemplaza únicamente ese RAISE por una excepción estándar P0001. Firma, SECURITY DEFINER, search_path, permisos, historial y validaciones CAS quedan conservados. No cambia Auth, datos, cron, extensiones, Realtime ni reglas de combate. Se aplicó sólo en szueqtkjclsumoadnien.

La prueba SQL ejecuta un comando con versión obsoleta y exige SQLSTATE P0001 + VERSION_CONFLICT; CI aplica la migración antes de las pruebas PostgreSQL. La prueba del adaptador deja de inventar SQLSTATE 40001. El cliente y los tiempos de espera permanecen iguales para comprobar la causa de fondo.

Tras aplicar la migración, el navegador pudo crear una sala y mostrar `Conectado al Lab` con ambos slots de preparación.
