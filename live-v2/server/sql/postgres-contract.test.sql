begin;
select set_config('request.jwt.claim.role','service_role',false);
select to_regprocedure('public.live_v2_create_room(uuid,jsonb)') is not null as create_exists \gset
select to_regprocedure('public.live_v2_prepare_command(uuid,uuid,uuid,text)') is not null as prepare_exists \gset
select to_regprocedure('public.live_v2_confirm_command(uuid,uuid,uuid,text,bigint,bigint,text,text,bigint,timestamptz,jsonb,jsonb,text,boolean)') is not null as confirm_exists \gset
select to_regprocedure('public.live_v2_reject_command(uuid,uuid,uuid,text,bigint,bigint,text)') is not null as reject_exists \gset
select to_regprocedure('public.live_v2_claim_expired(integer)') is not null as expiry_exists \gset
\if :{?create_exists}
\else
  \quit 1
\endif
\if :{?prepare_exists}
\else
  \quit 1
\endif
\if :{?confirm_exists}
\else
  \quit 1
\endif
\if :{?reject_exists}
\else
  \quit 1
\endif
\if :{?expiry_exists}
\else
  \quit 1
\endif
rollback;
