# Liga de los Mundos — v0.6.39h1-v02

Estado: 🟡 EXPERIMENTAL / LISTA PARA PROBAR.

Hotfix de sincronización de Corte con Espada:
- conserva Movimiento y Fin de turno de v0.6.38h5;
- la acción `ability` incorpora preestado de PV/Escudo del objetivo;
- el cliente remoto intenta reproducir con `executeAbility()`;
- si una condición transitoria local impide el replay exacto, restaura y aplica un fallback determinista del mismo resultado;
- resultado final de PA, usos, PV, Escudo y vivo/muerto se verifica en ambos clientes;
- procesamiento idempotente ante Realtime + polling.

No requiere migración Supabase adicional respecto de v0.6.39.
