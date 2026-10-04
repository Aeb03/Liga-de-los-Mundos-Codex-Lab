# Alcance y casilla afectada

Base: PR 9, de0738e3059630cca32365d8bf2e5376029446e9. Adrián informó buenas pruebas y detectó que faltaba mostrar todo el alcance de las habilidades. Este cambio sólo modifica presentación LIVE v2.

La selección muestra todas las casillas del alcance, incluso vacías, en azul. Roca distingue dentro del alcance la LOS bloqueada con gris y borde discontinuo, conservando el muestreo del núcleo. Los enemigos válidos conservan una marca diferente. Después del primer toque se muestra la casilla efectivamente afectada en naranja; el segundo toque sigue confirmando por el comando existente. MOVER cancela las marcas. No se habilita seleccionar una casilla vacía como objetivo.

Corte y Dagas muestran las cuatro casillas ortogonales que acepta el núcleo actual; Escudo sólo la propia; Roca usa Manhattan 4 (5 en Monolito). La consulta abilityOverlay es pura, usa las definiciones y LOS existentes y no autoriza ni resuelve comandos. Las marcas se ocultan fuera del turno propio, con una acción pendiente y sin selección. No se cambian PA, daños, Herida, reglas o protocolo.

Referencia offline fijada en 0b498395: app.js abilityRangeState/renderBattle separan skill-range, range-blocked y target. battle-visual-polish-v2.css define azul de alcance y borde discontinuo para LOS bloqueada. Roca se compara casilla por casilla con las funciones offline. Nota técnica: app.js inRange para rango 1 usa adj8 (ocho vecinas), mientras LIVE v2 ya valida cuatro ortogonales; esta corrección visual refleja la autoridad vigente y no modifica esa regla. Esa diferencia debe revisarse separadamente si se busca equivalencia completa.

Las cuatro habilidades habilitadas son de objetivo único: el efecto mostrado es una casilla. No se inventan cruces, radios ni áreas para habilidades todavía deshabilitadas. La geometría de cada área se incorporará junto con la resolución autoritativa de la habilidad correspondiente.

Pruebas: alcance vacío y límites, Escudo propio, Roca 4/5, LOS bloqueada, objetivo válido, efecto exacto, consulta sin mutación, estados pendientes/rivales, cancelación y comparación offline fijada. range-check.html permite comprobar alcance, obstáculo y segundo toque sin Auth ni sala usando el núcleo real.

Sólo publicación frontend en live-v2-preview. No se requiere despliegue Edge ni cambios Supabase, SQL, usuarios, permisos o Realtime. Offline y texturas intactos.
