# LIVE v2 — 2v2, dos campeones por jugador

Base estable validada por Adrián: `checkpoint/live-v2-1v1-stable-20261005`, commit `3630528e00d4fc7efcc6d702bb7a20ee19a27066`, build `20261006-feedback3`.

Build experimental: `20261006-2v2a`. Dos jugadores/celulares; A controla A1/A2 y B controla B1/B2. El formato 1v1 sigue disponible y es el predeterminado. No se habilitan cuatro controladores en esta etapa.

- Preparación: cuatro habilidades y Listo independientes por campeón. El selector permite volver a cada campeón; tras marcar Listo avanza al siguiente pendiente.
- Despliegue: posiciones y confirmaciones individuales; el selector avanza al siguiente sin confirmar. Todos deben confirmar antes del inicio; posiciones del rival siguen privadas hasta combate.
- Combate: iniciativa de los cuatro campeones, sorteo explícito de todos los grupos empatados, PA/PM y estados independientes. El HUD y las acciones siguen al campeón activo, no al selector de preparación.
- Un KO elimina ese turno; el combate continúa hasta que no quede ningún campeón vivo de un equipo. Abandonar termina la partida para todo el equipo.
- HUD, Registro, audio, VFX y resultado reutilizan la etapa validada. Resultado informa 1v1 o 2v2 y muestra los cuatro campeones.
- RPC nueva de creación para 2v2; creación vieja conserva compatibilidad. La unión asigna ambos slots B en una transacción y evita ocupar los dos equipos con la misma sesión. Permisos de RPC exclusivos de service_role; autenticación sigue en la función Edge. RLS permanece cerrada al cliente.

Verificación: 229 pruebas automáticas aprobadas, 2 de integración PostgreSQL omitidas localmente. Nuevas pruebas: cuatro iniciativas/empates, equipo equilibrado, KO parcial/total, saltar turnos muertos, ronda, curación a compañero, recursos propios, preparación/despliegue de cuatro, autoridad del slot activo, abandono de equipo, HUD y modo del resultado. Prueba SQL en LAB2 con rollback: creación/unión/reintento, rechazo de tercer participante, rechazo de ocupar ambos equipos y compatibilidad 1v1.

La partida completa entre dos celulares queda pendiente de validación por Adrián. Reconexión avanzada y limpieza de salas siguen pendientes; el checkpoint no implica que esas tareas estén completadas.
