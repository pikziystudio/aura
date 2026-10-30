\set ON_ERROR_STOP on
create function public.assert_true(ok boolean,label text) returns void language plpgsql as $$begin
 if ok is distinct from true then raise exception 'FAIL: %',label; end if;
end$$;
create function public.expect_error(command text,expected text) returns void language plpgsql as $$begin
 begin execute command;
 exception when others then
  if sqlstate=expected then return;end if;
  raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;
 end;
 raise exception 'Expected error % for %',expected,command;
end$$;
insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
insert into public.workspaces(id,owner_id,name) values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','A'),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','B'),
 ('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','Other workspace');
insert into public.projects(id,owner_id,workspace_id,name) values
 ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','A project'),
 ('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','B project'),
 ('20000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','Other project');
insert into public.captures(id,owner_id,workspace_id,title,raw_transcript,corrected_transcript,file_storage_path)
select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Original','Raw synthetic','Human synthetic','00000000-0000-4000-8000-000000000001/audio.webm'
from generate_series(1,4)n;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.assert_true((select count(*)=2 from public.workspaces),'own workspaces visible only');
select public.expect_error($q$insert into public.projects(owner_id,workspace_id,name) values('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','spoof')$q$,'42501');
select public.expect_error($q$select public.file_memory('30000000-0000-4000-8000-000000000001',0,'40000000-0000-4000-8000-000000000001','file','20000000-0000-4000-8000-000000000002','Test',null,null,false)$q$,'42501');
select public.expect_error($q$select public.file_memory('30000000-0000-4000-8000-000000000001',0,'40000000-0000-4000-8000-000000000001','file','20000000-0000-4000-8000-000000000003','Test',null,null,false)$q$,'42501');
select public.file_memory('30000000-0000-4000-8000-000000000001',0,'40000000-0000-4000-8000-000000000001','file','20000000-0000-4000-8000-000000000001','Reviewed',null,null,false);
select public.file_memory('30000000-0000-4000-8000-000000000001',0,'40000000-0000-4000-8000-000000000001','file','20000000-0000-4000-8000-000000000001','Reviewed',null,null,false);
select public.assert_true((select count(*)=1 from public.filing_decisions),'retry is idempotent');
select public.assert_true((select filing_version=1 and title='Reviewed' and raw_transcript='Raw synthetic' and corrected_transcript='Human synthetic' and file_storage_path like '%/audio.webm' from public.captures where id='30000000-0000-4000-8000-000000000001'),'version increment and provenance');
select public.expect_error($q$select public.file_memory('30000000-0000-4000-8000-000000000001',0,'40000000-0000-4000-8000-000000000009','inbox',null,'stale',null,null,true)$q$,'40001');
select public.expect_error($q$select public.file_memory('30000000-0000-4000-8000-000000000001',1,'40000000-0000-4000-8000-000000000009','inbox',null,'remove',null,null,false)$q$,'22023');
select public.expect_error($q$select public.file_memory('30000000-0000-4000-8000-000000000001',0,'40000000-0000-4000-8000-000000000001','file','20000000-0000-4000-8000-000000000001','different payload',null,null,false)$q$,'22023');
select public.file_memory('30000000-0000-4000-8000-000000000001',1,'40000000-0000-4000-8000-000000000009','inbox',null,'Inbox',null,null,true);
insert into public.project_aliases(owner_id,project_id,alias) values('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Synthetic alias');
insert into storage.objects(bucket_id,name) values('aura-recordings','00000000-0000-4000-8000-000000000001/test.webm');
select public.expect_error($q$insert into storage.objects(bucket_id,name) values('aura-recordings','00000000-0000-4000-8000-000000000002/forged.webm')$q$,'42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
select public.assert_true((select count(*)=0 from public.captures),'B cannot read A captures');
select public.assert_true((select count(*)=0 from public.project_aliases),'B cannot read A aliases');
select public.assert_true((select count(*)=0 from public.filing_decisions),'B cannot read A history');
select public.assert_true((select count(*)=0 from storage.objects),'B cannot list A audio');
with changed as (update public.captures set title='spoof' where id='30000000-0000-4000-8000-000000000001' returning id)
select public.assert_true((select count(*)=0 from changed),'B cannot update A capture');
with removed as (delete from storage.objects returning id)
select public.assert_true((select count(*)=0 from removed),'B cannot delete A audio');
select public.expect_error($q$select public.file_memory('30000000-0000-4000-8000-000000000001',2,'40000000-0000-4000-8000-000000000003','inbox',null,'spoof',null,null,true)$q$,'42501');
select public.expect_error($q$insert into public.filing_decisions(owner_id,capture_id,title,decision) values('00000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','spoof','inbox')$q$,'42501');
reset role;
create function public.fail_history() returns trigger language plpgsql as $$begin raise exception 'injected history failure';end$$;
create trigger fail_history before insert on public.filing_decisions for each row execute function public.fail_history();
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.expect_error($q$select public.file_memory('30000000-0000-4000-8000-000000000002',0,'40000000-0000-4000-8000-000000000002','file','20000000-0000-4000-8000-000000000001','Must rollback',null,null,false)$q$,'P0001');
select public.assert_true((select title='Original' and filing_version=0 from public.captures where id='30000000-0000-4000-8000-000000000002'),'history failure rolls back capture/version');
reset role;
drop trigger fail_history on public.filing_decisions;
-- Supabase may grant anon table privileges by default. Test RLS even with those grants.
grant select,insert,update,delete on public.workspaces,public.projects,public.captures,public.tasks,public.project_aliases,public.filing_decisions to anon;
set role anon;
select public.assert_true((select count(*)=0 from public.captures),'anon table grants do not bypass RLS');
select public.expect_error($q$insert into public.workspaces(owner_id,name) values('00000000-0000-4000-8000-000000000001','spoof')$q$,'42501');
select public.expect_error($q$select public.file_memory('30000000-0000-4000-8000-000000000001',2,'40000000-0000-4000-8000-000000000003','inbox',null,'spoof',null,null,true)$q$,'42501');
select public.assert_true((select count(*)=0 from storage.objects),'anon cannot list private objects');
reset role;
select public.assert_true((select not public and file_size_limit=52428800 from storage.buckets where id='aura-recordings'),'bucket private and size constrained');
select public.assert_true((select not prosecdef from pg_proc where oid='public.file_memory(uuid,bigint,uuid,text,uuid,text,text,uuid,boolean)'::regprocedure),'RPC is not security definer');
select public.assert_true(not has_function_privilege('anon','public.file_memory(uuid,bigint,uuid,text,uuid,text,text,uuid,boolean)','execute'),'anon cannot execute RPC');
\echo Security and atomicity assertions passed
-- Direct edits also advance the version, protecting against ABA filing edits.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
update public.captures set title='Temporary' where id='30000000-0000-4000-8000-000000000002';
update public.captures set title='Original' where id='30000000-0000-4000-8000-000000000002';
select public.assert_true((select filing_version=2 from public.captures where id='30000000-0000-4000-8000-000000000002'),'ABA edits advance version');
select public.expect_error($q$select public.file_memory('30000000-0000-4000-8000-000000000002',0,'40000000-0000-4000-8000-000000000099','inbox',null,'Original',null,null,false)$q$,'40001');
reset role;

-- Deployed triggers that suppress writes must not create a partial filing.
create function public.skip_write() returns trigger language plpgsql as $$begin return null;end$$;
create trigger aaa_skip_capture before update on public.captures for each row execute function public.skip_write();
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.expect_error($q$select public.file_memory('30000000-0000-4000-8000-000000000002',2,'40000000-0000-4000-8000-000000000098','inbox',null,'Suppressed',null,null,false)$q$,'42501');
reset role;
drop trigger aaa_skip_capture on public.captures;
create trigger aaa_skip_history before insert on public.filing_decisions for each row execute function public.skip_write();
set role authenticated;
select public.expect_error($q$select public.file_memory('30000000-0000-4000-8000-000000000002',2,'40000000-0000-4000-8000-000000000098','inbox',null,'Suppressed',null,null,false)$q$,'42501');
select public.assert_true((select title='Original' and filing_version=2 from public.captures where id='30000000-0000-4000-8000-000000000002'),'suppressed history rolls back capture');
reset role;
drop trigger aaa_skip_history on public.filing_decisions;
