-- Supabase Lab: pgcrypto digest() lives in the extensions schema.
alter function public.async_hash(jsonb) set search_path=public,extensions,pg_temp;
