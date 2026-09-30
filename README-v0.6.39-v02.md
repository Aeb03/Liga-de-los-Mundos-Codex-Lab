# Liga de los Mundos — v0.6.39-v02

Estado: EXPERIMENTAL / LISTA PARA PROBAR.

## Alcance
- Mantiene v0.6.38h5-v02 validada: despliegue, autoridad, movimiento, placaje, Fin de turno manual y por timeout.
- Primera habilidad online sincronizada: Arfeli — Corte con Espada.
- Reutiliza el mismo `executeAbility()` del combate local; no duplica reglas.
- Sincroniza PA, daño, usos por turno y Maestría con Armas.
- Las demás habilidades continúan bloqueadas online.
- `online_actions` admite ahora `action_type='ability'`.
- El entorno local reconoce también la red Tailscale 100.64.0.0/10 como desarrollo sin Service Worker viejo.

## Migración
Ejecutar `supabase-online-v0639.sql` una sola vez antes de probar.

## Prueba objetivo
1. Arfeli debe tener Corte con Espada en su loadout.
2. Durante su turno puede Mover, usar Corte o Finalizar turno.
3. Corte sólo puede seleccionar un rival adyacente válido.
4. Ambos clientes deben descontar el mismo PA y mostrar el mismo daño/PV.
5. Puede usarse hasta 2 veces por turno si alcanza el PA.
6. El rival permanece en modo observador.
