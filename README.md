# Liga de los Mundos — v0.6.31h1-v02 — Hotfix Hougan Bloque 1

🧪 EXPERIMENTAL LOCAL — NO PUSH

Corrección puntual del Bloque 1 de Hougan.

## Corregido
El Muñeco Vudú vuelve a tener su fase de movimiento normal DESPUÉS del turno de Hougan:

- 3 PM;
- movimiento ortogonal;
- puede dividir sus 3 PM;
- aparece el botón `Finalizar movimiento`;
- si consume sus PM, la fase termina;
- funciona tanto si el Muñeco está ACTIVO como si está INACTIVO por cambio de Vínculo.

La versión anterior anulaba esta fase por una interpretación incorrecta del diseño.

## Danza Vudú
Danza Vudú NO reemplazará el movimiento normal del Muñeco.

En el Bloque 2, Danza se montará sobre esta misma fase:
- el Muñeco seguirá moviéndose con sus 3 PM después del turno de Hougan;
- si Danza está activa y el Muñeco corresponde al Vínculo actual, cada paso del Muñeco hará que el Vinculado intente copiar esa misma dirección.

No cambia ninguna otra regla del Bloque 1.
No hacer commit ni push todavía.
