# Liga de los Mundos — v0.6.32-v02 — Hougan Bloque 2

🧪 EXPERIMENTAL LOCAL — NO PUSH

Base:
- Hougan Bloque 1 v0.6.31h1 validado.
- Vínculo aliado/enemigo.
- Muñeco 16/20 PV, 3 PM y cuatro vistas.
- Movimiento del Muñeco después del turno de Hougan validado.
- Aguja, Transferencia, Ritual y Maldición validados.

## Definición final — 6 habilidades
1. Aguja Vudú.
2. Transferencia.
3. Ritual del Dolor.
4. Maldición.
5. Transferencia de Dolor.
6. Danza Vudú.

Muñeco Vudú continúa como acción propia de 2 PA y NO ocupa slot.

## Transferencia de Dolor — 3 PA
Requiere:
- Vínculo actual;
- Muñeco correspondiente activo.

Mientras la relación siga siendo válida:
- todo daño dirigido a Hougan se divide 50/50;
- si el daño es impar, Hougan recibe la parte mayor;
- cada mitad pasa por el Escudo de su receptor;
- la parte del Muñeco activa su efecto usando únicamente PV REALES perdidos;
- si el Muñeco no soporta toda su mitad, el excedente NO regresa a Hougan.

Termina si:
- cambia o desaparece el Vínculo;
- el Muñeco deja de corresponder;
- el Muñeco es destruido.

## Danza Vudú — 3 PA
Requiere:
- Vínculo actual;
- Muñeco correspondiente activo.

No mueve inmediatamente.

Durante la fase de 3 PM del Muñeco DESPUÉS del turno de Hougan:
- cada casilla recorrida por el Muñeco hace que el Vinculado intente copiar exactamente esa dirección;
- si el Muñeco cambia de dirección, el Vinculado copia ese cambio;
- el movimiento copiado no gasta PM;
- aplica Herida por cada casilla efectivamente recorrida;
- activa trampas normalmente;
- si una casilla del Vinculado está bloqueada, sólo falla ESE paso;
- no hay daño de colisión;
- la Danza sigue con los pasos posteriores.

La Danza termina al finalizar esa fase de movimiento o si Vínculo/Muñeco dejan de coincidir.

## IA EXPERTA — Hougan completo
- Loadouts ponderados con 4 de sus 6 habilidades.
- Todos incluyen Aguja para poder construir Vínculo.
- Puede elegir Vínculo enemigo o aliado según modo ofensivo/apoyo.
- Crea/reemplaza el Muñeco mediante su acción propia.
- Valora Transferencia según curación real y efecto del Muñeco.
- Valora Ritual 14/20.
- Valora Maldición.
- Activa Transferencia de Dolor según riesgo, vida y tipo de Muñeco.
- Activa Danza sólo cuando existe una ruta con valor táctico.
- Durante la fase IA del Muñeco, una Danza activa evalúa rutas completas, cambios de dirección, Herida y únicamente trampas PROPIAS conocidas.
- Nunca consulta trampas rivales ocultas.

## Prueba sugerida
1. Confirmar que en Habilidades aparecen las 6 habilidades.
2. Transferencia de Dolor con daño par: ejemplo 10 -> 5 Hougan / 5 Muñeco antes de escudos.
3. Daño impar: ejemplo 9 -> 5 Hougan / 4 Muñeco.
4. Probar Escudo en Hougan y/o Muñeco: el efecto del Muñeco usa sólo PV reales.
5. Dejar al Muñeco con poca vida y enviarle más daño del que soporta: el excedente no vuelve a Hougan.
6. Cambiar Vínculo después de activar Transferencia de Dolor: debe terminar.
7. Destruir Muñeco: debe terminar.
8. Activar Danza y terminar turno.
9. Mover Muñeco 3 casillas rectas: Vinculado intenta copiar las 3.
10. Hacer un recorrido con cambio de dirección: debe copiar paso a paso.
11. Bloquear una de las casillas del Vinculado: ese paso falla, los posteriores siguen intentando.
12. Vinculado con Herida: daño por cada paso realmente copiado.
13. Hacer que el Vinculado copie un paso sobre una trampa: debe activarse.
14. Confirmar que Danza termina al cerrar la fase del Muñeco.
15. Probar IA Hougan en 1v1.
16. Probar IA Hougan como aliado y rival en 2v2.

Si este bloque queda bien, Hougan completo queda validado y pasamos a la revisión integrada de los 6 campeones.

NO HACER PUSH.
