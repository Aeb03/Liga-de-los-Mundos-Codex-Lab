# Cuentas, perfiles y amigos — 20261006-social1

Conserva el acceso anónimo y las salas existentes. Perfil y amigos está disponible en lobby y preparación. Cuenta confirmada obligatoria para funciones sociales. El registro vincula la sesión anónima actual a correo/contraseña, sin cambiar su identidad. El inicio de sesión/cierre de sesión requiere terminar la sala actual.

Perfiles con nombre de 3–24 caracteres y código único; solicitudes por código exacto, aceptación, rechazo, cancelación y eliminación. Invitaciones del creador a amigos aceptados para un puesto libre, con vencimiento de 30 minutos. Aceptación y entrada a la sala son atómicas. Reintentos no duplican entradas. Los enlaces siguen disponibles y no reservan puestos: una invitación puede perder su puesto si otro jugador entra antes.

Tablas privadas con RLS sin acceso directo. API pública SECURITY INVOKER delega a función privada que valida auth.uid contra auth.users: sólo cuentas no anónimas con correo confirmado. Ningún actor suministrado por el navegador determina permisos. No se exponen correos ni contraseñas a amigos. Eliminación administrativa de auth.users elimina perfil, amistades e invitaciones por CASCADE; coordinar cierre de salas y revocación de sesiones antes de eliminar cuentas.

## Configuración externa pendiente

En LAB2 (nqikacbnbwrlcofuceql), Auth: activar correo/contraseña, mantener confirmación de correo; configurar Site URL y Redirect URLs con https://aeb03.github.io/Liga-de-los-Mundos-Codex-Lab/live-v2/motion.html. Configurar SMTP con proveedor y remitente verificado. No hay acceso de configuración Auth/SMTP en el conector disponible. No desactivar confirmación para evadir este requisito. APK deep links pendientes de su empaquetado.

No se envían correos de prueba ni se crean cuentas persistentes durante QA. social-test.sql se ejecuta en transacción con rollback: perfil, deduplicación, amistad obligatoria, permisos de creador/destinatario, aceptación repetida, rechazo de anónimos, eliminación en cascada. 237 tests Node pasan, 2 integración Postgres omitidos.

Pendiente de esta etapa: correo real de confirmación/recuperación y uso entre dos cuentas en celulares una vez configurado SMTP. Asignación flexible por puesto e IA pertenece a la siguiente etapa, no implementada aquí.
