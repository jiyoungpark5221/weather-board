-- setup.sql – Supabase SQL Editor 에서 직접 실행 (여러 번 실행해도 안전)
-- 교육용 가상 데이터만 사용한다.

-- 1) 표 만들기 : 지역 · 구분 규칙을 DB 가 직접 막는다
create table if not exists public.wx_tasks (
  id         bigint generated always as identity primary key,
  title      text not null check (char_length(btrim(title)) between 1 and 100),
  region     text not null check (region in ('세종', '대전', '태안', '보령')),
  kind       text not null check (kind in ('야외', '고소', '실내')),
  owner      text not null check (char_length(btrim(owner)) between 1 and 30),
  created_at timestamptz not null default now()
);

-- 2) 권한 : 공개용 키(anon)는 읽기 · 추가만 가능 (수정 · 삭제 불가)
alter table public.wx_tasks enable row level security;

revoke all on public.wx_tasks from anon;
grant select, insert on public.wx_tasks to anon;

drop policy if exists "wx_tasks_read" on public.wx_tasks;
create policy "wx_tasks_read" on public.wx_tasks
  for select to anon using (true);

drop policy if exists "wx_tasks_add" on public.wx_tasks;
create policy "wx_tasks_add" on public.wx_tasks
  for insert to anon with check (true);

-- 3) 처음 보이는 가상 일정 6건 (표가 비어 있을 때만 넣음)
insert into public.wx_tasks (title, region, kind, owner)
select * from (values
  ('다중이용시설 안전점검', '세종', '야외', '김안전'),
  ('시민 안전체험 행사 운영', '보령', '야외', '이행사'),
  ('옥상 태양광 설비 점검', '태안', '고소', '박설비'),
  ('하천 수위계 확인', '대전', '야외', '최현장'),
  ('청사 외벽 간판 보수', '세종', '고소', '정시설'),
  ('비상연락 훈련', '대전', '실내', '한상황')
) as v(title, region, kind, owner)
where not exists (select 1 from public.wx_tasks);
