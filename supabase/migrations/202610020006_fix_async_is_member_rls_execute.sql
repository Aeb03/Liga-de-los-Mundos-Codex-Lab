-- RLS policies call this helper as authenticated users.
grant execute on function public.async_is_member(uuid) to authenticated;
