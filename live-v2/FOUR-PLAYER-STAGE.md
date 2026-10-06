# 2v2 con cuatro celulares y Hougan soporte

Build: `20261006-four1`. Base validada por Adrián: `checkpoint/live-v2-2v2-two-players-stable-20261006`, commit `2a394679b4af618d366bb301a65bab6b61b0f7ab`.

Tres formatos: 1v1 / 2v2 con dos controladores (dos campeones cada uno) / 2v2 con cuatro controladores (un campeón cada uno). El creador ocupa A1; A2, B1 y B2 se incorporan por invitación individual o eligiendo puesto desde el enlace general. La unión se bloquea por fila y no permite duplicar controlador ni apropiarse de un puesto ocupado. Recuperar el mismo puesto es idempotente. No hay lectura pública del combate para invitados ajenos.

Las seis habilidades de Hougan ya estaban integradas en la base. Esta etapa añade las selecciones rápidas Soporte (Aguja, Transferencia, Transferencia de Dolor, Danza Vudú) y Ofensivo (Aguja, Transferencia, Ritual, Maldición), sin modificar reglas de balance. Muñeco Vudú permanece en sus controles propios: 2 PA; aliado 20 PV; enemigo 16 PV; 3 PM después de Hougan. El aliado recupera la mitad, redondeada hacia arriba, de los PV reales que pierde el Muñeco. Aguja aliada cura 6 PV y vincula. Danza conserva los PM del Vinculado.

Abandono de un jugador en combate concede victoria al otro equipo incluso cuando queda un compañero conectado. Finaliza toda la partida, conforme al flujo existente de abandono; no se introduce sustitución de jugadores.

234 pruebas automáticas aprobadas; 2 pruebas PostgreSQL omitidas localmente. Cobertura nueva: Aguja/Muñeco aliados con cuatro campeones y escudos, Transferencia con curación simultánea de Hougan y aliado, Transferencia de Dolor, Danza sobre compañero de otro controlador, autoridad individual y abandono de equipo. SQL LAB2 con rollback: cuatro actores únicos, reintentos sin duplicación, rechazo de puesto ocupado y rechazo de segundo puesto por el mismo actor.

La prueba completa entre cuatro celulares, incluyendo Hougan soporte, queda pendiente de validación por Adrián. Reconexión avanzada y TTL siguen pendientes del plan anterior.
