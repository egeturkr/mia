-- ============================================================================
-- MIA — Supabase Schema Bootstrap
-- ----------------------------------------------------------------------------
-- Paste this whole file into:
--   Supabase Dashboard → SQL Editor → "+ New query" → paste → Run
-- It is idempotent (safe to run more than once).
-- ============================================================================

-- 1) ANALYSES — per-user video analysis history (powers /dashboard)
create table if not exists public.analyses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  video_name      text,
  safety_score    numeric,
  violations_count int default 0,
  safe_count       int default 0,
  frames_processed int default 0,
  processing_time  numeric,
  pdf_base64      text,
  detections_json text,
  created_at      timestamptz default now()
);

-- Mevcut kurulumlar için: kolon yoksa ekle (olay bazlı İhlal Raporu sayfası bunu kullanır).
alter table public.analyses add column if not exists detections_json text;

alter table public.analyses enable row level security;

drop policy if exists "analyses are private to their owner" on public.analyses;
create policy "analyses are private to their owner"
  on public.analyses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 2) DEMO_REQUESTS — public form on /demo-talep
create table if not exists public.demo_requests (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  company     text,
  email       text,
  phone       text,
  message     text,
  created_at  timestamptz default now()
);

alter table public.demo_requests enable row level security;

drop policy if exists "anyone can submit a demo request" on public.demo_requests;
create policy "anyone can submit a demo request"
  on public.demo_requests for insert
  with check (true);

-- (Reads stay locked down — only the service_role / dashboard can view them.)


-- 3) CHAT_MESSAGES — analytics for the support chat widget
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  message     text,
  lang        text,
  page        text,
  created_at  timestamptz default now()
);

alter table public.chat_messages enable row level security;

drop policy if exists "anyone can log a chat message" on public.chat_messages;
create policy "anyone can log a chat message"
  on public.chat_messages for insert
  with check (true);


-- ============================================================================
-- Done. Verify in: Database → Tables — you should now see analyses,
-- demo_requests, and chat_messages, all with RLS enabled (the small lock icon).
-- ============================================================================
