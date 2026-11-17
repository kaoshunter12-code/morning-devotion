-- Supabase 대시보드 > SQL Editor 에 붙여 넣고 실행하세요.
-- 우체통 방식: 학교 PC가 아이폰의 자물쇠(공개키)로 잠근 편지를 넣고,
-- 아이폰이 꺼내 열어 보관한 뒤 지웁니다. 서버에는 열 수 없는 암호문만 잠깐 머뭅니다.

-- 아이폰의 자물쇠(공개키). 공개키라서 비밀이 아닙니다.
create table if not exists public.inbox_keys (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  public_key jsonb not null,
  updated_at timestamptz not null default now()
);

-- 아직 아이폰이 받지 않은 편지
create table if not exists public.inbox (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  wrapped_key text not null,
  iv          text not null,
  data        text not null,
  created_at  timestamptz not null default now()
);

-- RLS: 각자 자기 열쇠로만 자기 방을 열 수 있게 합니다.
alter table public.inbox_keys enable row level security;
alter table public.inbox enable row level security;

create policy "own key" on public.inbox_keys for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own inbox: select" on public.inbox for select using (auth.uid() = user_id);
create policy "own inbox: insert" on public.inbox for insert with check (auth.uid() = user_id);
create policy "own inbox: delete" on public.inbox for delete using (auth.uid() = user_id);
