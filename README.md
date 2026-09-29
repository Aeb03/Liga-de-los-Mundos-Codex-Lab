# Liga de los Mundos — v0.6.29-v02 — Rework Onod

🧪 EXPERIMENTAL LOCAL — NO PUSH

Base local validada:
- Motor global: Escudo, Herida, Veneno y preview AoE táctil.
- Arfeli validada.
- Coloso validado.
- Piplus validado.
- IA única Experta.

## Onod
PV 95 · PA 6 · PM 3 · Iniciativa 4.

### Pasiva — Simbiosis
- Si Onod cura PV reales a un objetivo, TODOS los Brotes propios ortogonalmente adyacentes al objetivo curado recuperan 4 PV, hasta 12.
- Si un enemigo recibe daño REAL de Veneno mientras está ortogonalmente adyacente a Brotes propios, TODOS esos Brotes recuperan PV iguales al daño real de Veneno.
- El daño absorbido completamente por Escudo no cuenta como daño real para Simbiosis.

### Acciones propias
- Germinar — 1 PA · alcance 3 + LOS · crea Brote de 12 PV.
  Máximo 2 usos/turno. Máximo 3 Brotes activos.
- Marchitar — 0 PA · máximo 1/turno.
  Retira cualquier Brote propio sin beneficio.

Los Brotes ocupan casilla pero no bloquean línea de visión.

### 6 habilidades
1. Espina Venenosa — 2 PA · alcance 4 · 6 daño + Veneno 1 · máximo 2/turno.
2. Enredaderas — 3 PA · alcance 3.
   Cruz de 5 casillas: centro 6, cardinales 4; combatientes alcanzados -1 PM próximo turno.
   Usa preview global móvil.
3. Savia Vital — 3 PA · alcance 3 · cura 8 / 12 si el objetivo está cardinal a Brote propio · máximo 2/turno.
4. Esporas Tóxicas — 4 PA.
   Elegí CUALQUIER Brote propio, sin distancia desde Onod.
   El Brote no se consume. Los 8 espacios alrededor reciben preview; enemigos: 8 daño + Veneno 1.
5. Despertar del Bosque — 4 PA.
   Activa TODOS los Brotes simultáneamente, sin consumirlos.
   Cada Brote hace 8 a enemigos cardinales; daño acumulable 8/16/24.
   Al seleccionar la habilidad se previsualiza la unión de todas las áreas.
6. Reabsorción — 0 PA · máximo 1/turno.
   Absorbe TODOS los Brotes propios de turnos anteriores.
   Cada uno desaparece y otorga +1 PA.
   Los Brotes creados en el turno actual no se absorben.
   Después, Germinar queda bloqueado por el resto del turno.

## IA
- Germinar y Marchitar pasan a planes propios de IA.
- La IA puede usar hasta 2 Germinaciones respetando el máximo de 3 Brotes.
- Enredaderas valora los 5 espacios y -1 PM.
- Esporas evalúa las 8 casillas alrededor del Brote.
- Despertar calcula correctamente el apilado de Brotes.
- Reabsorción valora el PA ganado contra el costo de desmontar la red de Brotes.

## Prueba antes de avanzar a Korgan
1. Leer Pasiva + 6 habilidades en Habilidades.
2. Germinar: 1 PA, alcance 3, 12 PV, máximo 2/turno y 3 activos.
3. Marchitar: 0 PA, 1/turno, sin beneficio.
4. Simbiosis por curación: todos los Brotes cardinales curan 4.
5. Simbiosis por Veneno: sólo daño REAL de Veneno; Brotes cardinales curan esa cantidad.
6. Espina: 6 + Veneno 1, máximo 2.
7. Enredaderas: preview móvil; 6 centro / 4 laterales / -1 PM.
8. Savia: 8 / 12, máximo 2.
9. Esporas: seleccionar cualquier Brote, preview de 8 casillas, 8 + Veneno 1, no consume.
10. Despertar: preview simultáneo, 8/16/24, no consume Brotes.
11. Reabsorción: sólo Brotes viejos, absorbe TODOS, +1 PA c/u, bloquea Germinar.
12. Onod IA en 1v1 y 2v2.

NO HACER PUSH. Cuando Onod quede validado, crear checkpoint LOCAL.
