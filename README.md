# Liga de los Mundos — v0.6.30h1-v02 — Hotfix Korgan

🧪 EXPERIMENTAL LOCAL — NO PUSH

Corrige los tres puntos detectados en la prueba de Korgan.

## 1. Alcance amarillo
Disparo de Caza:
- ahora marca en amarillo todas las casillas de la misma fila/columna hasta alcance 5;
- las casillas bloqueadas por LOS conservan el estado visual de bloqueado;
- el borde de objetivo sólo aparece sobre un enemigo realmente válido.

Gancho:
- ahora marca en amarillo todo el alcance Manhattan 3;
- el borde de objetivo sólo aparece sobre combatientes enemigos válidos.

## 2. Trampas propias visibles
Se agrega un hook visual tardío DESPUÉS de tactical-assets.
- Rival: la trampa sigue totalmente invisible.
- Equipo propio: Pinchos y Mina se muestran con su imagen táctica real y semitransparente.
- Se fuerza visibilidad del PNG para evitar que otra capa visual lo oculte.

## 3. No apilar trampas
Korgan ya no puede colocar una segunda trampa propia activa en una casilla que ya contiene una de sus trampas.
La validación también la usa la IA, evitando que ésta apile sus propias trampas.

No cambia balance ni daño de Korgan.
No hacer commit ni push todavía.
