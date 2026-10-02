# Online asíncrono 1v1 (Lab)

## Flujo jugable

Ya no se requiere aprovisionamiento administrativo. Desde **Jugar → ONLINE ASÍNCRONO**:

1. A pulsa **CREAR PARTIDA**. `async_create_match` crea la partida y su membresía y devuelve el código.
2. B escribe el código y pulsa **UNIRSE**. `async_join_match` asigna equipo, slot y `turn_position` bajo lock.
3. Cada jugador elige campeón, exactamente cuatro habilidades y una casilla válida de su zona; `async_prepare_member` guarda y bloquea esa preparación en la interfaz.
4. Cuando ambos están listos, el creador ejecuta localmente `LigaAsyncEngine.buildInitial`. Este reutiliza `makeUnit`, el despliegue, el orden por iniciativa y `onlineTurnReset` del motor real. No se fabrica el combate en SQL.
5. `async_initialize_match` bloquea la partida, comprueba que el roster del snapshot coincide exactamente con miembros/campeones/slots, calcula el hash y concede 12 horas al miembro cuya unidad ocupa el turno activo.
6. El propietario pulsa **INICIAR TURNO**, juega localmente durante el deadline servidor de 30 segundos y confirma el snapshot completo. El siguiente miembro puede continuar horas después.

Crear, unirse, preparar, inicializar y jugar se puede realizar sólo desde los dos navegadores; no hay pasos administrativos entre creación y combate.

## Arquitectura

`async_matches.snapshot` es la única fuente de verdad. Cada confirmación reemplaza el snapshot completo, incrementa `state_version` y mueve `active_member_id` según `turn_position`; `async_audit` sólo diagnostica. `async_members` modela equipos y slots: la UI es 1v1, mientras el esquema y el cálculo de autoridad admiten más miembros.

El navegador hidrata `B`, el estado del motor existente. Movimiento, habilidades, KO, cambio de ronda, invocaciones, trampas, vínculos y estados siguen ejecutándose en el mismo motor. Al confirmar, `nextTurn()` aplica el final e inicio reales; la fase del muñeco se completa antes de ceder autoridad. La orientación de equipos y los controladores se canonicalizan al serializar y se reconstruyen según el jugador al hidratar, evitando que el dispositivo B contamine el snapshot con su perspectiva.

Al iniciar se prepara con ese motor el snapshot de “ninguna acción + fin de turno”. El RPC lo liga al hash y versión base. Si vencen 30 segundos, `async_promote_timeouts` lo promueve bajo lock sin duplicar reglas en SQL. Si ese estado termina el combate, queda `finished`, no se entrega otro turno.

## Seguridad y concurrencia

Todos los RPC requieren `auth.uid()`. RLS sólo permite lecturas a miembros y no existen escrituras directas para clientes. Las funciones mutantes revocan ejecución a `PUBLIC`/`anon` y la conceden a `authenticated`.

Creación, unión, preparación, inicialización, inicio y confirmación usan `request_id` estable. Los cambios críticos bloquean la fila; inicio/confirmación comparan versión y hash. Los deadlines se crean y verifican con `clock_timestamp()` de PostgreSQL. Una confirmación pendiente se conserva en `sessionStorage`, por lo que una respuesta HTTP perdida se reenvía con el mismo request y snapshot en lugar de avanzar otra vez el motor.

La validación v1 garantiza forma, roster, autoridad, versión, hash y transición. No demuestra que un navegador deliberadamente modificado haya respetado cada regla; para competición debe ejecutarse o validarse el motor en infraestructura confiable.

## Despliegue exclusivo en el Lab

1. Verificar que el proyecto enlazado sea **Liga-de-los-Mundos-Codex-Lab**, nunca producción.
2. Habilitar Anonymous Sign-Ins en Supabase Auth.
3. Aplicar, en orden:
   * `supabase/migrations/202610020001_async_turns.sql`
   * `supabase/migrations/202610020002_async_lobby.sql`
4. Configurar el `online-config.js` local (ignorado por Git) con Project URL y Publishable Key.
5. Servir la aplicación por HTTPS o localhost para disponer de Web Crypto.
6. Recomendado: añadir un cron/Edge Function que promueva partidas vencidas. La apertura de una partida ya llama `async_promote_timeouts`, pero sin worker el cambio sólo se materializa cuando un miembro vuelve a abrirla.

Las credenciales no estuvieron disponibles durante esta implementación. Las migraciones no se aplicaron ni se ejecutaron contra un Supabase remoto.

## Primera prueba con dos celulares

1. Desplegar ambas migraciones en el Supabase Lab y habilitar usuarios anónimos.
2. Publicar este commit con `online-config.js` apuntando exclusivamente al Lab.
3. En A: abrir **Jugar → ONLINE ASÍNCRONO → CREAR PARTIDA** y copiar el código mostrado.
4. En B: abrir el mismo sitio en un navegador/perfil distinto, entrar en **ONLINE ASÍNCRONO**, escribir el código y pulsar **UNIRSE**.
5. En ambos: elegir campeón, cuatro habilidades y despliegue; pulsar **CONFIRMAR PREPARACIÓN**.
6. Esperar la inicialización automática. El campeón con mayor iniciativa (desempate estable por equipo/slot) verá **TU TURNO**.
7. Pulsar **INICIAR TURNO**, realizar acciones y usar **Fin turno** o **CONFIRMAR TURNO**. El otro navegador pasa a **TU TURNO** al actualizar/pollear.
8. Cerrar el navegador que espera, volver más tarde con la misma sesión autenticada y abrir la partida desde la lista.
9. Probar doble toque en Inicio/Confirmar y recarga durante los 30 segundos: no debe duplicar transición ni reiniciar deadline.
10. Probar timeout dejando vencer los 30 segundos; al reabrir, debe promoverse el snapshot preparado. Para 12 horas, esperar o ajustar `claim_deadline` sólo en un entorno de test.

## Dependencias remotas y límites

* Requiere aplicar las dos migraciones, configurar URL/key y habilitar autenticación anónima en el Supabase Lab.
* La identidad anónima persiste en el almacenamiento del navegador. Para retomar desde otro dispositivo físico como la misma persona debe incorporarse login transferible; abrir otro dispositivo anónimo representa otro jugador.
* Sin cron, los deadlines siguen siendo autoritativos pero la promoción material se ejecuta cuando un miembro abre la partida.
* No se realizó una prueba end-to-end remota ni en celulares en esta sesión por ausencia de credenciales.
