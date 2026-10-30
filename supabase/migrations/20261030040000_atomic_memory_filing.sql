-- REVIEW REQUIRED. Apply only after catalog/history reconciliation and approval.
-- No existing migration is rerun. All changes are transactional.
begin;
alter table public.captures add column filing_version bigint not null default 0;
alter table public.captures add constraint captures_id_owner_unique unique(id,owner_id);
alter table public.filing_decisions add column request_id uuid;
alter table public.filing_decisions add column request_payload jsonb;
alter table public.filing_decisions add constraint filing_request_unique unique(owner_id,request_id);
alter table public.filing_decisions add constraint filing_capture_owner_fk
 foreign key(capture_id,owner_id) references public.captures(id,owner_id) on delete cascade not valid;
alter table public.filing_decisions validate constraint filing_capture_owner_fk;

create function public.bump_capture_filing_version() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
 new.filing_version := old.filing_version + 1;
 return new;
end $$;
revoke all on function public.bump_capture_filing_version() from public, anon, authenticated;
create trigger captures_filing_version before update on public.captures
 for each row execute function public.bump_capture_filing_version();

drop policy filing_decisions_insert on public.filing_decisions;
create policy filing_decisions_insert on public.filing_decisions for insert to authenticated
 with check(owner_id=(select auth.uid()) and exists(
  select 1 from public.captures c where c.id=filing_decisions.capture_id and c.owner_id=filing_decisions.owner_id
 ));

create function public.file_memory(
 p_capture_id uuid, p_expected_version bigint, p_request_id uuid,
 p_decision text, p_project_id uuid, p_title text,
 p_suggested_title text, p_suggested_project_id uuid, p_confirm_unfile boolean
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
 actor uuid := auth.uid();
 capture public.captures%rowtype;
 previous public.filing_decisions%rowtype;
 payload jsonb := pg_catalog.jsonb_build_object('capture',p_capture_id,'version',p_expected_version,
  'decision',p_decision,'project',p_project_id,'title',pg_catalog.btrim(p_title),
  'suggested_title',p_suggested_title,'suggested_project',p_suggested_project_id,'unfile',p_confirm_unfile);
 decision_id uuid;
 selected_id uuid;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_request_id is null or p_expected_version is null or p_expected_version<0
  or p_decision is null or p_decision not in ('file','inbox')
  or p_title is null or char_length(btrim(p_title)) not between 1 and 200
  or (p_decision='file' and p_project_id is null)
  or (p_decision='inbox' and p_project_id is not null) then
  raise exception 'Invalid filing request' using errcode='22023';
 end if;
 -- Serialize on the owned capture. RLS and explicit owner predicates both apply.
 select * into capture from public.captures where id=p_capture_id and owner_id=actor for update;
 if not found then raise exception 'Recording unavailable' using errcode='42501'; end if;
 -- Check after acquiring the lock so a concurrent retry sees the committed result.
 select * into previous from public.filing_decisions where owner_id=actor and request_id=p_request_id;
 if found then
  if previous.request_payload is distinct from payload then
   raise exception 'Request ID reused for a different filing' using errcode='22023';
  end if;
  return previous.id;
 end if;
 if capture.filing_version<>p_expected_version then
  raise exception 'Recording changed; refresh before filing' using errcode='40001';
 end if;
 if p_decision='inbox' and capture.project_id is not null and p_confirm_unfile is distinct from true then
  raise exception 'Confirm removing existing project' using errcode='22023';
 end if;
 for selected_id in select distinct ids.id from (values(p_project_id),(p_suggested_project_id)) ids(id)
  where ids.id is not null order by ids.id loop
  -- Prevent a project from moving workspaces between validation and commit.
  perform 1 from public.projects p where p.id=selected_id and p.owner_id=actor
   and p.workspace_id=capture.workspace_id for share;
  if not found then raise exception 'Project unavailable in this workspace' using errcode='42501'; end if;
 end loop;
 update public.captures set title=btrim(p_title),project_id=p_project_id,
  filing_status=case when p_decision='file' then 'filed' else 'inbox' end,
  suggested_title=p_suggested_title,suggested_project_id=p_suggested_project_id
 where id=p_capture_id and owner_id=actor;
 if not found then raise exception 'Capture update was not applied' using errcode='42501'; end if;
 insert into public.filing_decisions(owner_id,capture_id,project_id,title,decision,request_id,request_payload)
 values(actor,p_capture_id,p_project_id,btrim(p_title),p_decision,p_request_id,payload) returning id into decision_id;
 if decision_id is null then raise exception 'Decision insert was not applied' using errcode='42501'; end if;
 return decision_id;
end $$;
revoke all on function public.file_memory(uuid,bigint,uuid,text,uuid,text,text,uuid,boolean) from public,anon;
grant execute on function public.file_memory(uuid,bigint,uuid,text,uuid,text,text,uuid,boolean) to authenticated;
commit;
