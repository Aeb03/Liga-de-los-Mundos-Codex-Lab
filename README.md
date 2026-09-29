# Liga de los Mundos — v0.6.24-v02

Estado: 🟡 LISTA PARA PROBAR

Base exacta: ZIP maestro v0.6.19-v02 descargado el 28-09-2026.

Objetivo de esta versión: dejar UNA sola IA de combate.

Cambios incluidos:
- Eliminada la elección NORMAL / EXPERTO.
- Todas las unidades controladas por IA usan el perfil EXPERTO.
- Misma IA en 1v1 y 2v2.
- El aliado IA de 2v2 y los rivales IA usan el mismo motor táctico.
- Se conserva la aleatoriedad ponderada de loadouts, usando únicamente el criterio experto de coherencia interna.
- Se elimina la rama de decisión NORMAL del motor táctico activo.
- La pantalla de selección muestra “IA de combate — EXPERTA” como dato fijo, sin selector.
- Se actualizan los cache-busters de app.js y ai-tactical.js.
- Nuevo cache PWA 0624 para evitar que Chrome/Service Worker siga sirviendo la IA anterior.

No modifica habilidades, balance, estados globales, online, audio, arena ni assets gráficos.

Archivos del paquete:
- app.js
- ai-tactical.js
- index.html
- sw.js
- pwa-0624.js
- README.md
