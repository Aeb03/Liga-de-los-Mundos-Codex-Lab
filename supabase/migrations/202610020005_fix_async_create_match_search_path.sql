-- Supabase Lab: pgcrypto is installed in the extensions schema.
alter function public.async_create_match(uuid) set search_path=public,extensions,pg_temp;
