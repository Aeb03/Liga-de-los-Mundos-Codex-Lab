# Presentación LIVE v2 — arena, escala y HUD

Esta etapa reutiliza sin editar los PNG de Arena Central y los marcos de ronda, equipos y acciones que usa el offline. Conserva sus proporciones de nueve segmentos y el encuadre de suelo al 14%/72% de la plataforma. El tablero recibe más espacio que en la pantalla diagnóstica anterior; las miniaturas aumentan de 36×48 a 44×58 unidades SVG y se ordenan por profundidad.

La preparación y el transporte autoritativo permanecen iguales. Los datos del HUD provienen del snapshot confirmado; cada equipo puede mostrar varios slots. El panel inferior se puede plegar para despejar casillas. No se cargan scripts ni estilos globales del offline.

`visual-check.html` permite revisar mapa, ruta y HUD con un estado sintético local, claramente rotulado, sin crear sesiones ni salas. No valida conectividad y no reemplaza la prueba en celulares.

Las cuatro vistas y la interpolación por la ruta confirmada corresponden a la siguiente etapa. En esta entrega se conserva la vista down-right y la actualización instantánea de posición. No hay nuevos ataques, habilidades, cambios de reglas ni modificaciones en Supabase.
