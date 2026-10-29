create table public.project_aliases (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid not null,
 alias text not null check(length(trim(alias)) between 2 and 120),
 created_at timestamptz not null default now(),
 foreign key(project_id,owner_id) references public.projects(id,owner_id),
 unique(owner_id,project_id,alias)
);
create index project_aliases_owner_idx on public.project_aliases(owner_id);
alter table public.project_aliases enable row level security;
create policy project_aliases_select on public.project_aliases for select to authenticated using(owner_id=(select auth.uid()));
create policy project_aliases_insert on public.project_aliases for insert to authenticated with check(owner_id=(select auth.uid()));
create policy project_aliases_delete on public.project_aliases for delete to authenticated using(owner_id=(select auth.uid()));
grant select,insert,delete on public.project_aliases to authenticated;
alter table public.captures add column if not exists filing_status text not null default 'inbox' check(filing_status in ('inbox','filed'));
alter table public.captures add column if not exists suggested_title text;
alter table public.captures add column if not exists suggested_project_id uuid;
alter table public.captures add constraint captures_suggested_project_owner_fk foreign key(suggested_project_id,owner_id) references public.projects(id,owner_id);
create table public.filing_decisions(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 capture_id uuid not null references public.captures(id) on delete cascade,
 project_id uuid,
 title text not null,
 decision text not null check(decision in ('file','inbox')),
 created_at timestamptz not null default now(),
 foreign key(project_id,owner_id) references public.projects(id,owner_id)
);
create index filing_decisions_owner_idx on public.filing_decisions(owner_id);
alter table public.filing_decisions enable row level security;
create policy filing_decisions_select on public.filing_decisions for select to authenticated using(owner_id=(select auth.uid()));
create policy filing_decisions_insert on public.filing_decisions for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.captures c where c.id=capture_id and c.owner_id=owner_id));
grant select,insert on public.filing_decisions to authenticated;
