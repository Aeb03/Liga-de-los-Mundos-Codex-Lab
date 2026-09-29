# Liga de los Mundos — v0.6.34-v02 — Auditoría SFX habilidades

🟡 LISTA PARA PROBAR — NO COMMIT / NO PUSH hasta validación.

## Objetivo
Restaurar las rutas de los SFX específicos aprobados que se perdieron durante los reworks. No se inventan sonidos para habilidades nuevas y no se cambian mecánicas.

## SFX específicos activos

### Arfeli
- Corte con Espada -> `corte_espada.mp3`
- Dagas Danzantes -> `dagas_danzantes.mp3`
- Disparo con Arco -> `disparo_arco.mp3`
- Golpe de Martillo -> `golpe_martillo.mp3`
- `impulso.mp3` se conserva en assets por ser aprobado históricamente, pero la habilidad Impulso de Arfeli ya no existe y NO se enruta.

### Coloso
- Crear Pilar -> `creacion_pilar.mp3` (acción propia, ruteada en su ejecutor real)
- Fusión de Pilar / Monolito -> `fusion_pilar.mp3` (acción propia)
- Lanzar Roca -> `lanzar_roca.mp3`
- Golpe Sísmico -> `golpe_sismico.mp3`
- Absorción Rocosa -> `absorcion_rocosa.mp3`

### Piplus
- Marcar Objetivo -> `marca.mp3` (acción propia)
- Disparo Preciso -> `flecha_precision.mp3`
- Ruptura de Marca -> `ruptura_marca.mp3`
- Impulso -> `impulso.mp3` (también cubre el ejecutor interno actual)

### Onod
- Germinar -> `germinar.mp3` (acción propia)
- Espina Venenosa -> `espina_venenosa.mp3`
- Enredaderas -> `enredaderas.mp3`
- Savia Vital -> `savia_vital.mp3`
- Esporas Tóxicas -> `esporas_toxicas.mp3`

### Korgan
- Trampa de Pinchos -> `trampa_pinchos.mp3` al ACTIVARSE, no al colocarla.
- Mina Eléctrica -> `trampa_electrica.mp3` al ACTIVARSE, no al colocarla.
- Granada -> `granada.mp3`
- Disparo de Caza -> `disparo_caza.mp3`
- Gancho -> `gancho.mp3`

### Hougan
- Aguja Vudú -> `vinculo.mp3`
- Muñeco Vudú -> `efigie.mp3` (acción propia)
- Ritual del Dolor -> `ritual_dolor.mp3`
- Transferencia -> `transferencia.mp3`
- `dolor_reflejado.mp3` se conserva como asset histórico; Dolor Reflejado ya no existe y NO se reasigna.

## Habilidades nuevas sin SFX específico
No se reutilizan sonidos específicos de otras habilidades para Lanza de Arfeli, Colapso/Magnetismo/Reciclaje, Vectorial/Interferencia/Fijación, Reabsorción, Paso del Cazador, Maldición, Transferencia de Dolor o Danza Vudú. Los efectos genéricos existentes (escudo, curación, etc.) permanecen donde correspondan.

## Duplicación de curación
Savia Vital y Transferencia tienen SFX propio. Durante su ejecución se suprime temporalmente el `curacion.mp3` genérico para no superponer ambos sonidos.

## Importante
- No se cambió daño, PA, PM, alcance, IA ni reglas.
- No se modificaron los MP3.
- `audio-compat-0633.js` deja de cargarse: intentaba envolver funciones internas de los módulos que no eran globales. Las acciones propias ahora reproducen audio desde su ejecutor real.
