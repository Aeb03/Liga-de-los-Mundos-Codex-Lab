# Liga de los Mundos — v0.6.28-v02 — Rework Piplus

🧪 EXPERIMENTAL LOCAL — NO PUSH

Base local ya validada:
- Motor global: Escudo, Herida, Veneno y preview AoE táctil.
- Arfeli validada.
- Coloso validado, incluido Monolito/Colapso/Magnetismo.
- IA única Experta.

## Piplus
PV 90 · PA 6 · PM 3 · Iniciativa 6.

### Pasiva — Sistema de Marca
Piplus mantiene un único enemigo Marcado.

Acción propia:
- Marcar Objetivo — 0 PA · alcance 4 · requiere LOS · máximo 1/turno · sin daño.
- Marcar otro enemigo reemplaza la Marca anterior.
- Ruptura de Marca consume la Marca e impide volver a Marcar durante el resto del turno.

### 6 habilidades
1. Flecha de Precisión — 3 PA · alcance 4 · 8 daño / 10 si está Marcado.
2. Vector — 3 PA · alcance 3 · 6 daño + empuje 1 / empuje 2 si está Marcado.
3. Impulso — 2 PA · máximo 1/turno.
   Piplus se mueve 1–2 casillas en línea sin gastar PM.
   Puede atravesar obstáculos; el destino debe ser libre/válido.
   Si parte adyacente a un enemigo y se mueve directamente alejándose, primero empuja al enemigo 1 y luego se mueve.
4. Interferencia — 2 PA · alcance 4 · sólo Marcado · -1 PM próximo turno.
   Cada rival máximo 1 Interferencia por turno de Piplus.
5. Ruptura de Marca — 4 PA · alcance 4 · sólo Marcado · 14 daño.
   Consume Marca y bloquea Marcar Objetivo el resto del turno.
6. Fijación de Objetivo — 2 PA · alcance 4 · sólo Marcado.
   La próxima habilidad ofensiva contra ese objetivo durante el turno ignora LOS.
   Después se consume; la Marca permanece. Expira al final del turno si no se usa.

## IA
- Loadouts actualizados: ya no usa Disparo Marcador ni Pulso Reparador.
- Marcar Objetivo se evalúa como acción propia de 0 PA.
- Impulso IA es sólo de Piplus y usa el nuevo cruce de obstáculos.
- Precisión/Vector/Ruptura/Interferencia usan valores y reglas nuevas.
- Especial atención a turnos vacíos: la IA puede moverse para buscar rango, Marcar y reevaluar.

## Prueba antes de avanzar a Onod
1. Leer Pasiva + las 6 habilidades en Habilidades.
2. Marcar Objetivo: 0 PA, alcance 4, LOS, 1/turno, sin daño.
3. Precisión: 8 / 10 Marcado.
4. Vector: 6 + empuje 1 / 2 Marcado.
5. Impulso: 1–2 en línea, cruza obstáculos, no usa PM, 1/turno.
6. Impulso alejándose de enemigo adyacente: empuja 1 primero.
7. Interferencia: -1 PM y no repetir sobre el mismo rival ese turno.
8. Ruptura: 14, consume Marca y bloquea volver a Marcar.
9. Fijación: siguiente ofensiva contra Marcado ignora LOS y luego se consume.
10. IA Piplus en 1v1 y 2v2: no debe dejar pasar turnos con acciones legales.

NO HACER PUSH. Cuando Piplus quede validado, crear checkpoint LOCAL.
