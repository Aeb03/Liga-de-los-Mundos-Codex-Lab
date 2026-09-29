# Liga de los Mundos — v0.6.26-v02 — Rework Arfeli

🧪 EXPERIMENTAL LOCAL — NO PUSH

Base validada localmente:
- IA única Experta.
- Escudo global: expira al inicio del próximo turno del generador.
- Herida global.
- Veneno global.
- Preview AoE táctil global.
- Quemadura continúa pendiente de validación.

## Arfeli — ficha vigente de prueba
PV 100 · PA 6 · PM 3 · Iniciativa 5.

### Pasiva — Maestría con Armas
Al encadenar habilidades distintas en el mismo turno:
- primera habilidad: +0;
- segunda distinta: +1;
- tercera distinta: +2;
- y así sucesivamente.
La bonificación aumenta daño o Escudo según la habilidad.
Moverse no rompe la cadena.
Repetir una habilidad ya usada ese turno reinicia la cadena y esa habilidad recibe +0.
La cadena se reinicia al finalizar el turno.

### Habilidades
1. Corte con Espada — 2 PA · alcance 1 · 10 daño · máximo 2/turno.
2. Dagas Danzantes — 3 PA · alcance 1 · 10 daño + Herida 2 · máximo 1/turno.
3. Disparo con Arco — 3 PA · alcance 4 · 8 daño · requiere LOS.
4. Arte de la Lanza — 3 PA · alcance 2 · 10 daño + atracción 1 · requiere LOS.
5. Portación de Escudo — 3 PA · propio · 15 Escudo · máximo 1/turno.
6. Golpe de Martillo — 4 PA · alcance 3 · sin LOS · exige entidad enemiga.
   Arfeli salta a una casilla cardinal libre adyacente al objetivo ignorando obstáculos.
   Inflige 13 daño y, si el objetivo es un combatiente, -1 PM en su próximo turno.
   Una entidad inmóvil recibe daño pero no la penalización de PM.

Todos los valores mostrados por Colección de Campeones, selección de habilidades,
drawer de Habilidades y tooltip largo salen de la misma definición efectiva de Arfeli.

## IA
La IA Experta usa la misma ficha y valora:
- bonificación actual de Maestría;
- Herida 2 de Dagas;
- Escudo 15 + Maestría;
- Martillo como daño + reposicionamiento + -1 PM.

## Prueba manual antes de avanzar a Coloso
- Ver los 6 textos y la Pasiva en Campeones / Habilidades.
- Confirmar PM inicial 3.
- Corte: 10 y máximo 2.
- Dagas: 10 + Herida 2 y máximo 1.
- Arco: 8, alcance 4, LOS.
- Lanza: 10, alcance 2, atrae 1.
- Escudo: 15 y duración global ya validada.
- Martillo: objetivo enemigo real, alcance 3, sin LOS, salto y -1 PM.
- Maestría: +0 / +1 / +2; movimiento no corta; repetir reinicia.
- Arfeli IA actúa correctamente en 1v1 y 2v2.

No hacer git push. Cuando Arfeli quede validada se crea checkpoint LOCAL y recién después se trabaja Coloso.
