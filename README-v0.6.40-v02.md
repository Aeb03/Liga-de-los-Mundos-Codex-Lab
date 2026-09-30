# Liga de los Mundos — v0.6.40-v02 — Habilidades básicas online

Estado: 🟡 LISTA PARA PROBAR — NO COMMIT / NO PUSH hasta validación de Adrián.

Base: 📌 checkpoint estable v0.6.39h3-v02.

## Alcance de este bloque
Se amplía el canal `ability` ya validado sin tocar Movimiento ni Fin de turno.

### Arfeli
- Corte con Espada — se conserva como referencia validada.
- Disparo con Arco — daño a distancia, alcance y línea de visión del motor local.
- Portación de Escudo — autoescudo, coste/límite y Maestría con Armas del motor local.

### Piplus
- Flecha de Precisión — daño a distancia, alcance y línea de visión del rework vigente.

## Arquitectura
- Las habilidades siguen usando `public.online_actions` con `action_type = ability`.
- El comando incluye actor, objetivo, efecto, estado previo y resultado esperado.
- Ambos clientes intentan ejecutar el mismo `executeAbility()` local validado.
- Hay reconciliación determinista e idempotencia para Realtime + polling.
- Android mantiene ejecución del toque táctico en `pointerup`.

## Fuera de alcance todavía
- Herida/Veneno y otros estados aplicados por habilidades.
- Empujes/atracciones.
- AoE.
- Invocaciones/trampas.
- Marca como acción online.
- Mecánicas especiales.

## Supabase
No requiere migración nueva si v0.6.39 ya fue preparada: `online_actions` ya admite `ability`.
No se modifica `online-config.js`.
