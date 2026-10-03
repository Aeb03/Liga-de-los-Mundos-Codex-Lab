# Presentación LIVE v2 — arena, escala y HUD

Esta etapa reutiliza sin editar los PNG de Arena Central y los marcos de ronda, equipos y acciones que usa el offline. Conserva sus proporciones de nueve segmentos y el encuadre de suelo al 14%/72% de la plataforma. El tablero recibe más espacio que en la pantalla diagnóstica anterior; las miniaturas aumentan de 36×48 a 44×58 unidades SVG y se ordenan por profundidad.

La preparación y el transporte autoritativo permanecen iguales. Los datos del HUD provienen del snapshot confirmado; cada equipo puede mostrar varios slots. El panel inferior se puede plegar para despejar casillas. No se cargan scripts ni estilos globales del offline.

`visual-check.html` permite revisar mapa, ruta y HUD con un estado sintético local, claramente rotulado, sin crear sesiones ni salas. No valida conectividad y no reemplaza la prueba en celulares.

Las cuatro vistas y la interpolación por la ruta confirmada corresponden a la siguiente etapa. En esta entrega se conserva la vista down-right y la actualización instantánea de posición. No hay nuevos ataques, habilidades, cambios de reglas ni modificaciones en Supabase.

## Información de combate
El HUD muestra el orden vivo rotado desde el slot activo, su avatar, PV actuales/máximos, PA, PM y escudo total confirmado. Las cuatro habilidades seleccionadas aparecen deshabilitadas: todavía no se ejecutan. Las miniaturas llevan vida numérica y barra, más escudo y estados positivos recibidos. Esto no habilita herida ni veneno en el núcleo. El preview no descuenta recursos visualmente.
Las cuatro vistas y la animación siguen pendientes: actualmente la respuesta de comando contiene el recorrido, pero el snapshot del rival no incluye esos eventos; no se debe inventar otra ruta a partir de los dos extremos.

## Distribución de referencia aprobada
La captura de combate horizontal enviada por Adrián fija el objetivo: ronda/activo/reloj/orden dentro del mismo marco superior; equipos compactos en los laterales inferiores; ficha activa, cuatro habilidades y acciones en una barra horizontal inferior. Se conservan los PNG originales; se reutilizan los paneles horizontales y los slots de habilidad. En vertical se adapta el mismo contenido sin superponer controles.
Iconos, coste nominal y límite nominal (cuando existe) provienen de las seis definiciones efectivas de la base. Son referencias de presentación: no hay ejecución de habilidades ni contadores de usos inventados. El recorrido y la conexión se muestran en una franja de texto compacta.
