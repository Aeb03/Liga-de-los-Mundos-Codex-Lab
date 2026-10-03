# Escudo de Arfeli + Roca de Coloso

Base: PR 7, 32995c71181691cfc621c96dbb28274a3958ec13. Adrián validó Corte en dos celulares. Esta etapa no implementa cámara, audio, opciones ni paralaje: quedan para el final.

Reglas extraídas de `arfeli-rework-0626.js` y `coloso-rework-0627.js` en la base offline:

- Portación: 3 PA, 15 escudo, sólo Arfeli, una vez por turno. Maestría suma su bonus. Veneno se resuelve antes de añadir protección; muerte del lanzador cancela el efecto. Generador `sourceId` = unidad, no controlador. Expira al inicio del siguiente turno del generador; no al finalizar el turno ni al empezar el rival.
- Lanzar Roca: 3 PA, 8 daño normal, Manhattan 4; Monolito 5. Línea de visión usa exactamente el muestreo de `app.js:lineCells`, incluidos sus cruces de esquina. Obstáculos y campeones vivos intermedios bloquean. La oportunidad de crear Pilar se cierra al actuar. Pilares y transformación no se implementan en esta etapa. Escudos absorben y el resto reduce PV; daño mortal resuelve ganador.
- Corte sigue vigente. Todos usan el comando `ability` existente, con validación de loadout/actor/slot activo/versión/turno/deadline y la misma idempotencia/CAS. El cliente no suministra coste, daño ni escudo.

UI: elegir habilidad, primer toque a una casilla marcada presenta efecto/coste, segundo toque a la misma confirma. Escudo marca la casilla propia; Roca marca enemigos válidos. MOVER cancela. Recursos y usos reflejan sólo estado confirmado; reconexión o cambio de versión/turno cancela selección. Los demás botones siguen deshabilitados.

Pruebas: absorción 15 contra dos rocas de 8 (7 restante tras la primera, 1 PV perdido tras la segunda), límite/reset, expiración por generador, Maestría, veneno mortal, línea de visión equivalente a base, rango 4/5, rechazos atómicos, muerte, persistencia para ambos actores e idempotencia. `shield-rock-check.html` usa el núcleo real sin Auth/servidor para revisión visual. Prueba física final pendiente.

Sólo se despliega `live-v2-command` del Lab szueqtkjclsumoadnien. La función de expiración mantiene la misma lógica de expiración de escudos ya verificada. Sin SQL, usuarios, permisos, Realtime ni archivos offline modificados.
