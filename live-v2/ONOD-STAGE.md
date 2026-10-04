# Onod completo — Brotes y Simbiosis

Portación de `onod-rework-0629.js` del commit base `0b4983953a37fca0a60867f1007f78c67b263683`. Conserva 95 PV, 6 PA, 3 PM e iniciativa 4. Se eligen cuatro de las seis habilidades. Germinar y Marchitar son acciones propias fuera del loadout. No se modifica el offline ni sus imágenes.

| Acción | Coste | Regla efectiva |
|---|---:|---|
| Germinar | 1 PA | Casilla libre, alcance Manhattan 3 con LOS. Brote de 12 PV, máximo 2 creaciones por turno y 3 activos. Los Brotes ocupan casilla pero no bloquean LOS. No dispara Veneno. |
| Marchitar | 0 PA | Retira un Brote propio sin beneficio ni límite de distancia, una vez por turno. No dispara Veneno. |
| Espina Venenosa | 2 PA | Alcance 4 con LOS, 6 daño y Veneno 1 a combatiente superviviente; máximo 2 usos. También daña objetos enemigos sin aplicarles estados. |
| Enredaderas | 3 PA | Centro elegido a alcance 3 con LOS, incluso vacío o propio. Cruz: centro 6, cardinales 4. Combatientes enemigos supervivientes reciben −1 PM en su próximo turno, sin acumular una penalización inferior sobre otra mayor. |
| Savia Vital | 3 PA | Cura a Onod o aliado a alcance 3 con LOS: 8 PV, 12 junto a un Brote propio ortogonal; máximo 2 usos. |
| Esporas Tóxicas | 4 PA | Cualquier Brote propio activo, sin distancia ni LOS. No lo consume. En las ocho casillas que lo rodean, enemigos reciben 8 daño y combatientes supervivientes Veneno 1. |
| Despertar del Bosque | 4 PA | Se confirma sobre Onod. Cada Brote propio inflige 8 daño a enemigos ortogonalmente adyacentes; acumula 16/24 cuando coinciden 2/3 Brotes. No consume Brotes. |
| Reabsorción | 0 PA | Se confirma sobre Onod. Retira obligatoriamente TODOS los Brotes creados en turnos anteriores y gana 1 PA por cada uno; conserva los de este turno. Una vez por turno. Bloquea Germinar hasta el siguiente turno. Puede superar los 6 PA, hasta 9. Dispara Veneno por ser habilidad. |

**Simbiosis:** cuando Onod cura PV reales, todos sus Brotes ortogonales al objetivo recuperan hasta 4 PV. Cuando un enemigo pierde PV reales por Veneno al usar una habilidad, todos los Brotes de Onod ortogonales a ese enemigo recuperan esa cantidad, hasta 12. Escudo absorbido no cuenta; sobre-daño se limita a los PV realmente perdidos. También se activa si Veneno mata al enemigo. Herida, daño normal, reducción de Veneno al finalizar turno y Marca de Piplus no la activan.

Todos los costes y límites se validan antes de mutar. Veneno se resuelve al pagar la habilidad; si mata a Onod cancela los efectos, incluso Reabsorción. Brotes destruidos quedan en el historial de estado pero liberan la casilla. No cuentan para placaje ni para decidir el ganador.

## Interfaz y autoridad

Áreas de Enredaderas, Esporas y Despertar se obtienen del núcleo compartido. Despertar muestra la unión de áreas al seleccionarse; Enredaderas elige centro y las otras habilidades eligen objetivo. La primera pulsación previsualiza y la segunda confirma. Germinar/Marchitar están en el menú Simbiosis de la barra inferior. Los Brotes usan la imagen original `brote-onod.png` y muestran PV actuales/máximos.

El servicio aplica permisos de controlador, selección de cuatro habilidades, versión, turno y plazo. `onodAction` sigue el mismo contrato de idempotencia que las demás acciones propias. La ganancia temporal de PA mantiene `maxPa=6`; el siguiente turno restaura los recursos normalmente. Los estados anteriores sin `nextSproutId` siguen siendo válidos y calculan la secuencia cuando se necesita.

## Verificación

```sh
node --test live-v2/*.test.mjs live-v2/server/*.test.mjs live-v2/client/*.test.mjs
```

`onod.test.mjs` verifica seis habilidades, acciones propias, límites, objetivos inválidos, atomicidad, escudo, estados, Simbiosis, Veneno mortal, recursos, serialización, Brotes dañados por Piplus y previews. Ejecuta las funciones originales de geometría para todos los centros del tablero y compara áreas y superposiciones. `server.test.mjs` comprueba Piplus contra Onod a través del servicio, incluidos recuperación, permisos, selección, plazos y snapshots iguales.

`onod-check.html` es una escena visual sin conexión. Prueba física pendiente: abrir `motion.html?v=20261004-onod1` en ambos celulares, crear una sala nueva con Piplus y Onod, elegir cuatro habilidades y probar. Una segunda sala permite equipar Despertar/Reabsorción y comprobar Brotes antiguos vs nuevos. Verificar PV/PA/PM, Veneno, Brotes, posición y turno iguales en ambos dispositivos.

Sin cambios de esquema, Auth, RLS, cron ni Realtime. Actualización limitada al paquete de reglas de las dos funciones de Lab `szueqtkjclsumoadnien`; no se accede al proyecto real.
