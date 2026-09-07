do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'quiz_questions'
  ) then
    execute 'alter publication supabase_realtime add table public.quiz_questions';
  end if;
end;
$$;
