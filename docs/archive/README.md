# Async desplegado — archivo técnico

Proyecto exclusivo: szueqtkjclsumoadnien.
Código original congelado: 739b6d14bc7a92ac0c25be2499ccb4b58db1ad9c.
Esta rama deriva de ese commit y conserva sus 9 archivos SQL y todo el experimento. async-codex-lab no se modifica.

async-deployed-20261003.json contiene las 11 migraciones realmente aplicadas (version, name, statements), las definiciones PostgreSQL actuales de las 14 funciones async, propietarios y ACL, columnas/defaults/identidad, constraints, índices, políticas RLS, configuración RLS y publicación Realtime. No había triggers propios. No contiene filas de juego, usuarios, tokens ni identidad del autor de migraciones.

## Drift confirmado

Los primeros 7 SQL corresponden a las primeras 7 migraciones aplicadas, pero sus versiones/nombres y texto no deben asumirse idénticos. El JSON guarda los statements reales completos.

El archivo 008 crea async_snapshot_active_unit, pero solo documenta en comentarios el cambio de async_promote_timeouts. En la base se aplicaron DOS migraciones: fix_timeout_snapshot_path_v2 y fix_timeout_promoter_dynamic_path_v3; la segunda reemplaza realmente la RPC para llamar async_snapshot_active_unit(m.timeout_snapshot).

El archivo 009 crea async_finish_active_unit, pero solo documenta en comentarios el cambio de async_finish_turn. En la base se aplicaron DOS migraciones: fix_finish_turn_dynamic_path y fix_finish_turn_authority_path_v2; la segunda reemplaza realmente la RPC para llamar async_snapshot_active_unit(p_snapshot).

Por eso los 9 SQL del repositorio no reconstruyen por sí solos el estado real de las 11 migraciones. Para estudio/reconstrucción en un entorno aislado, usar los statements reales por version, contrastando después las definiciones/ACL/RLS del catálogo archivado. No ejecutar este archivo histórico sobre el Lab preparado ni sobre el proyecto real. No se probó una restauración.

El archivo es referencia del async, no arquitectura ni migración de LIVE v2.
