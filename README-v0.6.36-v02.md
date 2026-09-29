# Liga de los Mundos — v0.6.36-v02 — Despliegue online sincronizado

Estado: 🧪 EXPERIMENTAL / 🟡 LISTA PARA PROBAR — NO COMMIT / NO PUSH hasta validación de Adrián.

## Base
Parte exclusivamente del checkpoint v0.6.35h7-v02 validado. No se modifica el motor de combate offline ni los reworks de campeones.

## Alcance de este bloque
- Mantiene selección online de campeón + exactamente 4 habilidades.
- Cuando ambos jugadores están LISTO, pasan al despliegue online.
- Cada cliente coloca únicamente su propia miniatura.
- Equipo A despliega en su zona canónica y Equipo B en la zona opuesta.
- Equipo B visualiza la Arena con cámara rotada 180°, pero las coordenadas reales son únicas y compartidas.
- En cada dispositivo, el equipo local se renderiza como TU EQUIPO / azul y el rival como rojo.
- La posición rival permanece oculta durante el despliegue.
- Cada posición confirmada se guarda en online_slots.
- Cuando ambos confirman, los dos clientes revelan las posiciones y pasan a Ronda 1 preparada.
- Movimiento, habilidades y Fin de turno siguen BLOQUEADOS intencionalmente.

## Arquitectura preparada para futuro
El adaptador online separa:
- team
- slotNumber
- controller
- playerId
- unidad/campeón

El MVP continúa siendo 1 jugador vs 1 jugador, pero la capa no identifica una unidad simplemente como "Jugador A/Jugador B". Esto deja camino para compañeros humanos/IA y tamaños de equipo mayores sin duplicar el motor.

## Migración Supabase requerida
Ejecutar una vez `supabase-online-v0636.sql` en SQL Editor. Agrega a `online_slots`:
- `deploy_x smallint`
- `deploy_y smallint`
- `deployment_ready boolean`

También agrega checks 0–11 para X/Y. No toca Project URL, Publishable Key, Realtime ni crea nuevas policies.

## Prueba prevista
1. Ejecutar `supabase-online-v0636.sql` una sola vez.
2. Servir el proyecto por `python -m http.server 8082 --bind 0.0.0.0`.
3. Abrir dispositivo A en localhost y dispositivo B con la IP LAN del celular.
4. Crear/unirse a la sala.
5. Elegir campeón + 4 habilidades en ambos y pulsar LISTO.
6. Verificar que ambos llegan a despliegue.
7. Confirmar que cada dispositivo ve SU zona de despliegue de su lado.
8. Elegir posiciones distintas y confirmar primero sólo uno: el otro NO debe ver la posición rival todavía.
9. Confirmar el segundo.
10. Verificar que ambos pasan a Ronda 1 y ven exactamente las mismas posiciones reales, pero con perspectiva propia.
11. Verificar que Movimiento / Habilidades / Fin turno siguen bloqueados.

## No incluido todavía
- Autoridad de turno online activa.
- Temporizador online sincronizado.
- Movimiento online.
- Fin de turno online.
- Habilidades online.
- Reconexión de combate / checksum / recuperación de desync.
