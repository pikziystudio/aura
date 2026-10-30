-- READ ONLY. Run only against the dedicated Aura project after checking connection identity.
-- Do not paste connection strings, keys, user data or function bodies into a public PR.
begin read only;
select version, name from supabase_migrations.schema_migrations order by version;
select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','storage') and c.relkind='r' order by 1,2;
select schemaname,tablename,policyname,roles,cmd,qual,with_check
 from pg_policies where schemaname in ('public','storage') order by 1,2,3;
select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants
 where table_schema in ('public','storage') and grantee in ('PUBLIC','anon','authenticated') order by 1,2,3,4;
select n.nspname,p.proname,p.oid::regprocedure,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'execute') as anon_execute,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 2;
select extname,extnamespace::regnamespace from pg_extension order by extname;
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='aura-recordings';
select conname,conrelid::regclass,pg_get_constraintdef(oid),convalidated from pg_constraint
 where conrelid in ('public.captures'::regclass,'public.filing_decisions'::regclass,'public.tasks'::regclass,'public.project_aliases'::regclass);
commit;
