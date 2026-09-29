# Liga de los Mundos — v0.6.27h2-v02 — Hotfix visual Monolito

🧪 EXPERIMENTAL LOCAL — NO PUSH

Los mecanismos de Colapso y Magnetismo de v0.6.27h1 quedan sin cambios.

Este hotfix corrige exclusivamente la representación visual del Monolito.

Cambio técnico:
- Deja de depender de cuatro imágenes superpuestas con clases de visibilidad.
- Usa el mismo set oficial de 4 PNG:
  down-right / down-left / up-right / up-left.
- En cada render selecciona UNA imagen real según facing + rotación de cámara.
- La imagen activa se fuerza visible con CSS propio.
- Al rotar la cámara, renderBattle vuelve a elegir la vista correspondiente.

No cambia:
- balance;
- habilidades;
- IA;
- estados;
- Colapso;
- Magnetismo;
- Monolito mecánico.

No hacer commit ni push todavía.
