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
-- 4) RFID/QR PASİF KKD TAKİBİ (Sprint 4)
-- ----------------------------------------------------------------------------
-- Geçiş noktalarında işçi rozeti + baret/yelek etiketleri okutulur; sistem
-- hangi KKD'nin mevcut olduğunu çözüp uyumluluk kaydı tutar. "code" alanı
-- tag-agnostiktir: bir QR string'i de RFID/RFD UID'i de olabilir → aynı şema
-- ileride RFID okuyucuyla da çalışır.
-- ============================================================================

-- 4a) İŞÇİLER — rozet kodu ile
create table if not exists public.workers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade, -- hesap sahibi (firma)
  full_name   text not null,
  code        text not null,            -- rozet QR/RFID UID
  site        text,                     -- şantiye/proje adı (örn. "Mostar - A Blok")
  active      boolean default true,
  created_at  timestamptz default now(),
  unique (user_id, code)
);
alter table public.workers enable row level security;
drop policy if exists "workers private to owner" on public.workers;
create policy "workers private to owner" on public.workers for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4b) EKİPMAN — etiketli KKD (baret/yelek/maske)
create table if not exists public.equipment (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  type               text not null check (type in ('helmet','vest','mask')),
  code               text not null,     -- KKD üzerindeki QR/RFID UID
  assigned_worker_id uuid references public.workers(id) on delete set null,
  active             boolean default true,
  created_at         timestamptz default now(),
  unique (user_id, code)
);
alter table public.equipment enable row level security;
drop policy if exists "equipment private to owner" on public.equipment;
create policy "equipment private to owner" on public.equipment for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4c) GEÇİŞ NOKTALARI
create table if not exists public.checkpoints (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,            -- örn. "Saha Girişi", "Yemekhane"
  site        text,
  created_at  timestamptz default now()
);
alter table public.checkpoints enable row level security;
drop policy if exists "checkpoints private to owner" on public.checkpoints;
create policy "checkpoints private to owner" on public.checkpoints for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4d) TARAMALAR — her geçişte uyumluluk kaydı
create table if not exists public.scans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  checkpoint_id uuid references public.checkpoints(id) on delete set null,
  worker_id     uuid references public.workers(id) on delete set null,
  worker_code   text,
  worker_name   text,
  ppe_present   jsonb default '{}'::jsonb,   -- {"helmet":true,"vest":false}
  required      jsonb default '{"helmet":true,"vest":true}'::jsonb,
  missing       text[] default '{}',         -- ['vest']
  compliant     boolean default false,
  source        text default 'qr',           -- 'qr' | 'rfid'
  created_at    timestamptz default now()
);
alter table public.scans enable row level security;
drop policy if exists "scans private to owner" on public.scans;
create policy "scans private to owner" on public.scans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists scans_user_created_idx on public.scans (user_id, created_at desc);

-- ============================================================================
-- Done. Verify in: Database → Tables — analyses, demo_requests, chat_messages,
-- workers, equipment, checkpoints, scans (hepsi RLS açık — kilit ikonu).
-- ============================================================================
