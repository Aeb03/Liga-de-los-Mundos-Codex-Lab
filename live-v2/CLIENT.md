# Prueba de pantalla LIVE v2 (Lab)

Entrada independiente: `/live-v2/index.html`. Servir la raíz del repositorio mediante HTTP/HTTPS; no abrir el HTML como `file://`. La raíz offline `index.html` no carga este cliente.

El cliente usa exclusivamente `szueqtkjclsumoadnien`, su clave publicable y una sesión anónima almacenada bajo `live-v2-lab-auth`. Nunca incluye claves de servicio. Requiere acceso al SDK fijado en esm.sh y al Lab. No modifica la configuración de Auth ni la publicación Realtime.

## Flujo en dos celulares

1. Abrir la misma versión del repositorio en ambos navegadores. En el primero, crear sala y copiar su enlace; abrirlo en el segundo.
2. Cada controlador elige campeón y cuatro habilidades, y marca listo. Las habilidades se seleccionan pero no se ejecutan en esta vertical.
3. Tocar una casilla de la zona propia y confirmar posición. El creador inicia cuando ambos confirman; las posiciones rivales permanecen ocultas antes del inicio.
4. Durante el turno propio, tocar una casilla alcanzable para mostrar el recorrido, coste de PM y daño de placaje. Tocar otra modifica la selección. Tocar nuevamente la misma confirma el recorrido exacto. No hay botón de confirmar movimiento. Un recorrido mortal por placaje se impide.
5. Verificar movimiento y cambio de turno en ambos celulares. El contador se ajusta al reloj del servidor; el vencimiento lo resuelve el worker incluso sin clientes conectados.
6. Desconectar/reconectar y recargar: una acción sin respuesta conserva su ID y payload. Se consulta su resultado antes de repetirla; una confirmación vieja nunca retrocede el estado.

El transporte inicial consulta snapshots cada 1,2 segundos, con una única aplicación por versión. Las rutas son previsualizaciones locales y el servidor valida la acción. No hay ataques, habilidades, invocaciones ni animaciones añadidas. Se reutilizan imágenes existentes sin modificarlas.

## Validación

`node --test live-v2/*.test.mjs live-v2/server/*.test.mjs live-v2/client/*.test.mjs`

Las pruebas del cliente cubren respuesta perdida, aceptación recuperada sin repetir ni retroceder, recarga con reenvío idéntico, rechazo y reloj del servidor. CI añade PostgreSQL real. No equivalen a una prueba física en celulares.

En el entorno de desarrollo el navegador remoto rechazó el acceso a `http://localhost:8088/live-v2/index.html` con `net::ERR_BLOCKED_BY_CLIENT`; por ello la revisión visual y el flujo real completo en dos navegadores/celulares quedan pendientes. No se crearon usuarios ni salas para esa prueba fallida. Esta entrada requiere un servidor accesible a los celulares; publicar el PR no crea automáticamente ese alojamiento.
