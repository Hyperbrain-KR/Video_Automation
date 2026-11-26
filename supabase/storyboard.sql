-- 스토리보드 테이블·이미지 저장소 (Supabase SQL Editor 에서 한 번 실행)
-- 보드: 로그인한 팀원은 모두 보기, 만든 사람만 수정·삭제
-- 댓글: 팀원 누구나 작성, 쓴 사람만 삭제
-- 이미지: 팀원은 모두 보기, 업로드·삭제는 각자 자기 폴더({user_id}/...)만

create table if not exists public.storyboards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  owner_name text not null default '',
  title text not null default '새 스토리보드',
  frames jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.storyboard_comments (
  id uuid primary key default gen_random_uuid(),
  storyboard_id uuid not null references public.storyboards (id) on delete cascade,
  frame_id text not null,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null default '',
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists storyboard_comments_board_idx on public.storyboard_comments (storyboard_id, created_at);

alter table public.storyboards enable row level security;
alter table public.storyboard_comments enable row level security;

drop policy if exists "팀원은 보드 보기" on public.storyboards;
create policy "팀원은 보드 보기" on public.storyboards
  for select to authenticated using (true);

drop policy if exists "본인 보드 만들기" on public.storyboards;
create policy "본인 보드 만들기" on public.storyboards
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "본인 보드 수정" on public.storyboards;
create policy "본인 보드 수정" on public.storyboards
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "본인 보드 삭제" on public.storyboards;
create policy "본인 보드 삭제" on public.storyboards
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "팀원은 댓글 보기" on public.storyboard_comments;
create policy "팀원은 댓글 보기" on public.storyboard_comments
  for select to authenticated using (true);

drop policy if exists "본인 이름으로 댓글 작성" on public.storyboard_comments;
create policy "본인 이름으로 댓글 작성" on public.storyboard_comments
  for insert to authenticated with check (author_id = auth.uid());

drop policy if exists "본인 댓글 삭제" on public.storyboard_comments;
create policy "본인 댓글 삭제" on public.storyboard_comments
  for delete to authenticated using (author_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('storyboard-images', 'storyboard-images', false)
on conflict (id) do nothing;

drop policy if exists "팀원은 스토리보드 이미지 보기" on storage.objects;
create policy "팀원은 스토리보드 이미지 보기" on storage.objects
  for select to authenticated using (bucket_id = 'storyboard-images');

drop policy if exists "본인 폴더에 스토리보드 이미지 올리기" on storage.objects;
create policy "본인 폴더에 스토리보드 이미지 올리기" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'storyboard-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "본인 스토리보드 이미지 삭제" on storage.objects;
create policy "본인 스토리보드 이미지 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'storyboard-images' and (storage.foldername(name))[1] = auth.uid()::text);
