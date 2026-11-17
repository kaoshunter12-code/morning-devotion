-- Supabase 대시보드 > SQL Editor 에 붙여 넣고 실행하세요.
-- 모든 내용은 앱에서 암호화된 뒤 저장되므로, 이 표에는 알아볼 수 없는 문자열만 들어갑니다.

create table if not exists public.records (
  user_id    uuid   not null default auth.uid() references auth.users on delete cascade,
  kind       text   not null check (kind in ('entry', 'verse', 'check')),
  key        text   not null,
  iv         text   not null,
  data       text   not null,
  updated_at bigint not null,
  primary key (user_id, kind, key)
);

-- RLS: 각자 자기 열쇠로만 자기 방을 열 수 있게 합니다.
alter table public.records enable row level security;

create policy "own rows: select" on public.records for select using (auth.uid() = user_id);
create policy "own rows: insert" on public.records for insert with check (auth.uid() = user_id);
create policy "own rows: update" on public.records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on public.records for delete using (auth.uid() = user_id);
