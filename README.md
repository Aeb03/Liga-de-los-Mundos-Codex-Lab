# Liga de los Mundos — v0.6.20-v02 — Bloque 2D

🧪 EXPERIMENTAL — NO VALIDADA.

Bloque 2D: adaptación de IA al rediseño de campeones.

Cambios:
- Elimina referencias de IA a habilidades antiguas (Marca como skill, Germinar como skill, Pilar/Fusión como skills, Cepo/Carga Explosiva, etc.).
- La IA usa las acciones propias nuevas de Coloso, Piplus, Onod, Korgan y Houngan.
- Evalúa áreas de Enredaderas y Granada.
- Evalúa Esporas desde Brotes y Despertar del Bosque.
- Soporte preparado para Derrumbe, Magnetismo, Gancho, Fijación, Interferencia, Reabsorción, Paso del Cazador, Transferencia de Dolor y Danza Vudú si forman parte del loadout.
- Usa Muñeco Vudú según el Vínculo vigente y Transferencia cuando corresponde.
- Movimiento del Muñeco mantiene compatibilidad con Danza Vudú.
- NORMAL y EXPERTO vuelven a almacenarse por unidad IA; EXPERTO toma decisiones tácticas/combinaciones más agresivas, sin cambiar reglas.
- Limpieza de restos visuales de la pasiva Berserker antigua.

Validación técnica:
- node --check app.js: OK
- Sin IDs antiguos dentro del bloque de IA.
- ZIP con app.js + README.md en raíz.

Siguiente paso:
playtest integral de Arfeli, Coloso, Piplus, Onod, Korgan y Houngan antes de marcar v0.6.20-v02 como validada.
