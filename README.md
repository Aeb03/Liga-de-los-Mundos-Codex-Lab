# Liga de los Mundos — v0.6.25h2-v02

🧪 EXPERIMENTAL LOCAL — Preview global de áreas táctil

Base: v0.6.25h1-v02.

Objetivo:
dejar una única mecánica global para habilidades de área, reutilizable por todos los campeones presentes y futuros.

Interacción:
1. Seleccionar una habilidad de área.
2. El alcance permitido continúa mostrándose con el sistema normal amarillo.
3. Tocar o arrastrar sobre una casilla válida desplaza en tiempo real el área afectada.
4. El área afectada se muestra en magenta, claramente separada del amarillo de alcance.
5. Al soltar el dedo, el área queda fijada pero la habilidad NO se ejecuta.
6. Se puede volver a arrastrar para cambiar la posición.
7. Un segundo toque sobre el centro fijado ejecuta la habilidad directamente.
8. No existe cartel ni botón de Confirmar.

Arquitectura:
- Una habilidad se conecta al motor declarativamente con `aoePreview:{pattern:'...'}`.
- Patrones globales disponibles: center, cross1, adjacent8, centerPlus8.
- Se pueden registrar patrones futuros con `LDMCombatCore.aoe.registerPattern(...)`.
- El sistema respeta `canUseAbility`, alcance, LOS y demás reglas válidas de la habilidad.
- Mientras se apunta un AoE, el arrastre del tablero queda reservado al selector para evitar mover la cámara accidentalmente.

Prueba de esta etapa:
- `Esporas Tóxicas` de Onod está conectada a `cross1` sólo como caso vivo de validación.
- Su daño, coste, alcance y efecto NO fueron modificados.

No modifica:
- balance de campeones;
- IA;
- estados;
- escudos;
- audio;
- online;
- gráficos generales.

No hacer push. Validar localmente antes de continuar.
