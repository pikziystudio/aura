-- AURA initial schema v1: private single-user workspace foundations
-- REVIEW BEFORE APPLYING. Must be tested on a disposable development database.
create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  kind text not null default 'personal' check (kind in ('personal','business')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workspaces_owner_idx on public.workspaces(owner_id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  description text,
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,owner_id)
);
create index if not exists projects_owner_workspace_idx on public.projects(owner_id,workspace_id);

create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid,
  title text,
  kind text not null default 'thought' check (kind in ('thought','meeting','note','prompt','import')),
  raw_transcript text,
  summary text,
  file_storage_path text,
  duration_seconds integer check(duration_seconds is null or duration_seconds >= 0),
  processing_status text not null default 'pending' check(processing_status in ('pending','processing','complete','failed')),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(project_id,owner_id) references public.projects(id,owner_id)
);
create index if not exists captures_owner_time_idx on public.captures(owner_id,captured_at desc);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid,
  source_capture_id uuid references public.captures(id) on delete set null,
  title text not null,
  notes text,
  status text not null default 'proposed' check(status in ('proposed','todo','in_progress','done','cancelled')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(project_id,owner_id) references public.projects(id,owner_id)
);
create index if not exists tasks_owner_status_idx on public.tasks(owner_id,status);

-- Every accessible row must belong to the signed-in user, and referenced workspace/project
-- must have the same owner. Protect this through database constraints and RLS.
create unique index if not exists workspaces_id_owner_uq on public.workspaces(id,owner_id);
alter table public.projects
  add constraint projects_workspace_owner_fk
  foreign key (workspace_id,owner_id) references public.workspaces(id,owner_id);
alter table public.captures
  add constraint captures_workspace_owner_fk
  foreign key (workspace_id,owner_id) references public.workspaces(id,owner_id);
alter table public.tasks
  add constraint tasks_workspace_owner_fk
  foreign key (workspace_id,owner_id) references public.workspaces(id,owner_id);

alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
alter table public.captures enable row level security;
alter table public.tasks enable row level security;

create policy workspaces_select on public.workspaces for select to authenticated using ((select auth.uid())=owner_id);
create policy workspaces_insert on public.workspaces for insert to authenticated with check ((select auth.uid())=owner_id);
create policy workspaces_update on public.workspaces for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy workspaces_delete on public.workspaces for delete to authenticated using ((select auth.uid())=owner_id);

create policy projects_select on public.projects for select to authenticated using ((select auth.uid())=owner_id);
create policy projects_insert on public.projects for insert to authenticated with check ((select auth.uid())=owner_id);
create policy projects_update on public.projects for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy projects_delete on public.projects for delete to authenticated using ((select auth.uid())=owner_id);

create policy captures_select on public.captures for select to authenticated using ((select auth.uid())=owner_id);
create policy captures_insert on public.captures for insert to authenticated with check ((select auth.uid())=owner_id);
create policy captures_update on public.captures for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy captures_delete on public.captures for delete to authenticated using ((select auth.uid())=owner_id);

create policy tasks_select on public.tasks for select to authenticated using ((select auth.uid())=owner_id);
create policy tasks_insert on public.tasks for insert to authenticated with check ((select auth.uid())=owner_id);
create policy tasks_update on public.tasks for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy tasks_delete on public.tasks for delete to authenticated using ((select auth.uid())=owner_id);

grant select, insert, update, delete on public.workspaces,public.projects,public.captures,public.tasks to authenticated;
-- No rights are granted to anon. Actual Supabase Data API exposure must also be checked.
