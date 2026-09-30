# Liga de los Mundos — v0.6.41-v02

Estado: EXPERIMENTAL / lista para probar. NO push hasta validación de Adrián.

Base: checkpoint estable v0.6.40h1-v02.

## Bloque online ampliado
Se mantiene el canal `ability` ya validado y se agregan tres casos nuevos:

- Arfeli — Dagas Danzantes: daño + Herida 2, respetando Maestría con Armas.
- Onod — Savia Vital: curación directa a sí mismo/aliado; usa el valor efectivo del rework (8, o 12 junto a Brote cuando esa situación exista).
- Korgan — Disparo de Caza: daño a distancia con sus validaciones reales de fila/columna y LoS.

Siguen disponibles las habilidades ya validadas de v0.6.40h1:
- Arfeli: Corte con Espada, Disparo con Arco, Portación de Escudo.
- Piplus: Flecha de Precisión.

## Sincronización
- `ability` conserva estado previo + resultado esperado.
- Se amplía la reconciliación para curación y estado Herida.
- Realtime + polling siguen siendo idempotentes.
- El cambio de turno online ahora reutiliza los efectos globales de fin/inicio de turno necesarios para Herida y expiración de Escudos, sin alterar el flujo base.
- Movimiento y Fin de turno no se modifican.
- No requiere migración Supabase nueva.
- No se modifica `online-config.js`.

## Sigue fuera de este bloque
- AoE.
- Empujes/atracciones.
- Invocaciones/objetos tácticos.
- Trampas.
- Mecánicas especiales complejas.
