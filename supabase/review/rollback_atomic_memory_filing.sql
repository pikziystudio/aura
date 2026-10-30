-- REVIEW REQUIRED. Stop new app writes and deploy compatible app before rollback.
-- Keep filing_version/request columns and constraints to preserve audit information.
begin;
drop function public.file_memory(uuid,bigint,uuid,text,uuid,text,text,uuid,boolean);
drop trigger captures_filing_version on public.captures;
drop function public.bump_capture_filing_version();
commit;
