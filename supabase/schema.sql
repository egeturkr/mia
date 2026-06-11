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
-- 5) API KULLANIM / RATE-LIMIT / KOTA (Production Hardening — Faz 1)
-- ----------------------------------------------------------------------------
-- Sunucusuz fonksiyonlar (detect/analyze/scan) her isteği buraya yazar ve
-- pencere içi sayımla rate-limit + aylık kota uygular. Yalnızca service_role
-- erişir (RLS açık, politika YOK → anon/auth okuyamaz/yazamaz). Bu tablo AI
-- kredisi suistimalini önler ve Faz 5 faturalandırma kotalarının temelidir.
-- ============================================================================
create table if not exists public.api_usage (
  id            bigint generated always as identity primary key,
  subject       text not null,          -- 'user:<uuid>' veya 'ip:<sha256-önek>'
  subject_type  text not null,          -- 'user' | 'ip' | 'token'
  endpoint      text not null,          -- 'detect' | 'analyze' | 'scan'
  status        int,                    -- upstream/sonuç durum kodu (opsiyonel)
  created_at    timestamptz not null default now()
);
alter table public.api_usage enable row level security;
-- Politika eklenmedi: yalnızca service_role (RLS bypass) yazar/okur.

create index if not exists api_usage_window_idx on public.api_usage (endpoint, subject, created_at desc);
create index if not exists api_usage_created_idx on public.api_usage (created_at);

-- İsteğe bağlı bakım: 60 günden eski kayıtları temizlemek için zamanlanmış görev
-- (pg_cron veya Netlify scheduled function) eklenebilir:
--   delete from public.api_usage where created_at < now() - interval '60 days';

-- ============================================================================
-- 6) RIZA / KABUL AUDIT TRAIL (Legal & Compliance — Faz 2)
-- ----------------------------------------------------------------------------
-- KVKK açık rıza, kullanım şartları, gizlilik, görüntü işleme ve sınır ötesi
-- aktarım onaylarının DEĞİŞTİRİLEMEZ kaydı. Her kabul; doküman anahtarı + sürüm
-- + zaman + (varsa) kullanıcı/e-posta ile saklanır → uyum denetiminde kanıt.
-- ============================================================================
create table if not exists public.consents (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users(id) on delete set null, -- giriş yoksa null
  email         text,                  -- doğrulama öncesi kayıt için
  subject       text,                  -- 'user:<uuid>' | 'email:<e>' | 'ip:<hash>'
  document_key  text not null,         -- 'terms' | 'privacy' | 'kvkk' | 'image_processing' | 'cross_border'
  version       text not null,         -- kabul edilen doküman sürümü (örn. '1.0')
  user_agent    text,
  page          text,
  accepted_at   timestamptz not null default now()
);
alter table public.consents enable row level security;

-- Kabul kaydı eklenebilir (append-only): giriş yapan kendi adına, anonim/doğrulama
-- öncesi user_id NULL ile. Okuma yalnızca kendi kayıtların (service_role hepsini görür).
drop policy if exists "consents insert (self or anon)" on public.consents;
create policy "consents insert (self or anon)" on public.consents for insert
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "consents select own" on public.consents;
create policy "consents select own" on public.consents for select
  using (auth.uid() = user_id);

create index if not exists consents_user_doc_idx on public.consents (user_id, document_key, version);
create index if not exists consents_email_idx on public.consents (email);

-- ============================================================================
-- 7) ABONELİK / FATURALANDIRMA (Billing — Faz 5, sağlayıcıdan bağımsız)
-- ----------------------------------------------------------------------------
-- Plan + kota tek kullanıcı/hesap başına. Ödeme sağlayıcısı (iyzico/Stripe) sonra
-- takılır; provider_* alanları o zaman dolar. Abonesi olmayan kullanıcı 'free'
-- sayılır. Yazma yalnızca service_role (webhook) ile; kullanıcı kendi kaydını okur.
-- ============================================================================
create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references auth.users(id) on delete cascade,
  plan                     text not null default 'free',   -- 'free'|'giris'|'kamera_ai'|'pro'|'kurumsal'
  status                   text not null default 'active',  -- 'active'|'trialing'|'past_due'|'canceled'
  provider                 text,                            -- 'iyzico'|'stripe'|null
  provider_customer_id     text,
  provider_subscription_id text,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);
alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions select own" on public.subscriptions;
create policy "subscriptions select own" on public.subscriptions for select
  using (auth.uid() = user_id);
-- Yazma (insert/update) yalnızca service_role (RLS bypass) ile — ödeme webhook'u.

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

-- ============================================================================
-- 8) ÜCRETLİ PİLOT MODU (Faz 3) — pilot operasyon katmanı
-- ----------------------------------------------------------------------------
-- Mevcut analyses tablosuna DOKUNMAZ. Pilotlar mevcut analizlere ayrı bir
-- bağlantı tablosuyla (pilot_analysis_links) bağlanır → geri uyumlu.
-- Tüm pilot verisi user_id ile sahibine kilitli (org modeli Faz 5'te gelecek).
-- ============================================================================
create table if not exists public.pilot_projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company_name  text not null,
  site_name     text,
  contact_name  text,
  contact_email text,
  contact_phone text,
  start_date    date,
  end_date      date,
  pilot_price   numeric default 25000,
  currency      text default 'TRY',
  status        text not null default 'draft'
                check (status in ('draft','proposed','active','completed','converted','lost')),
  package_type  text not null default 'paid_pilot'
                check (package_type in ('paid_pilot','professional','pro_fusion','enterprise')),
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table public.pilot_projects enable row level security;
drop policy if exists "pilot_projects private to owner" on public.pilot_projects;
create policy "pilot_projects private to owner" on public.pilot_projects for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists pilot_projects_user_idx on public.pilot_projects (user_id, created_at desc);

create table if not exists public.pilot_checklists (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  pilot_id        uuid not null references public.pilot_projects(id) on delete cascade,
  checklist_key   text not null,
  checklist_label text not null,
  completed       boolean not null default false,
  completed_at    timestamptz,
  notes           text,
  unique (pilot_id, checklist_key)
);
alter table public.pilot_checklists enable row level security;
drop policy if exists "pilot_checklists private to owner" on public.pilot_checklists;
create policy "pilot_checklists private to owner" on public.pilot_checklists for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists pilot_checklists_pilot_idx on public.pilot_checklists (pilot_id);

create table if not exists public.pilot_weekly_reports (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  pilot_id             uuid not null references public.pilot_projects(id) on delete cascade,
  week_number          int not null check (week_number between 1 and 12),
  report_date          date default current_date,
  uploaded_video_count int default 0,
  total_violations     int default 0,
  high_risk_violations int default 0,
  average_safety_score numeric,
  manual_review_notes  text,
  customer_feedback    text,
  next_actions         text,
  created_at           timestamptz default now(),
  unique (pilot_id, week_number)
);
alter table public.pilot_weekly_reports enable row level security;
drop policy if exists "pilot_weekly_reports private to owner" on public.pilot_weekly_reports;
create policy "pilot_weekly_reports private to owner" on public.pilot_weekly_reports for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists pilot_weekly_reports_pilot_idx on public.pilot_weekly_reports (pilot_id, week_number);

create table if not exists public.pilot_analysis_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  pilot_id    uuid not null references public.pilot_projects(id) on delete cascade,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  created_at  timestamptz default now(),
  unique (pilot_id, analysis_id)
);
alter table public.pilot_analysis_links enable row level security;
drop policy if exists "pilot_analysis_links private to owner" on public.pilot_analysis_links;
create policy "pilot_analysis_links private to owner" on public.pilot_analysis_links for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists pilot_analysis_links_pilot_idx on public.pilot_analysis_links (pilot_id);

-- ============================================================================
-- 9) HUKUK / KVKK / VERİ YÖNETİŞİMİ SERTLEŞTİRME (Faz 4)
-- ----------------------------------------------------------------------------
-- NOT: Bu yapılar operasyonel hazırlık içindir; KVKK uyum İDDİASI değildir.
-- Tüm hukuki metinler yetkili hukuk danışmanı incelemesi gerektirir.
-- ============================================================================

-- 9a) consents tablosuna ek bağlam kolonları (geri uyumlu — eski insert'ler çalışır)
alter table public.consents add column if not exists lang text;
alter table public.consents add column if not exists pilot_id uuid references public.pilot_projects(id) on delete set null;
alter table public.consents add column if not exists metadata jsonb;

-- 9b) HUKUKİ DOKÜMAN SÜRÜM KAYDI — js/legal.js DOC_REGISTRY ile senkron tutulur.
-- Yazma yalnızca service_role; herkes okuyabilir (sürüm bilgisi kamusal).
create table if not exists public.legal_document_versions (
  doc_key               text primary key,
  version               text not null,
  effective_date        date,
  requires_reacceptance boolean not null default false,
  review_status         text not null default 'pending_legal_review'
                        check (review_status in ('draft','pending_legal_review','lawyer_approved','retired')),
  notes                 text,
  updated_at            timestamptz default now()
);
alter table public.legal_document_versions enable row level security;
drop policy if exists "legal versions are public" on public.legal_document_versions;
create policy "legal versions are public" on public.legal_document_versions for select using (true);
-- Tohum (idempotent). review_status BİLİNÇLİ olarak 'pending_legal_review' — onay iddia edilmez.
insert into public.legal_document_versions (doc_key, version, effective_date) values
  ('terms', '1.0', '2026-06-10'),
  ('privacy', '1.0', '2026-06-10'),
  ('kvkk', '1.0', '2026-06-10'),
  ('image_processing', '1.0', '2026-06-10'),
  ('cross_border', '1.0', '2026-06-10'),
  ('ai_disclaimer', '1.0', '2026-06-10'),
  ('pilot_site_notice', '1.0', '2026-06-10'),
  ('data_retention', '1.0', '2026-06-10')
on conflict (doc_key) do nothing;

-- 9c) VERİ SAHİBİ TALEPLERİ — silme/dışa aktarma talepleri (manuel inceleme akışı)
create table if not exists public.data_subject_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  request_type    text not null check (request_type in
                    ('account_deletion','analysis_deletion','report_deletion','consent_export','personal_data_deletion')),
  status          text not null default 'submitted'
                  check (status in ('submitted','under_review','completed','rejected')),
  request_details text,
  admin_notes     text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  completed_at    timestamptz
);
alter table public.data_subject_requests enable row level security;
drop policy if exists "dsr insert own" on public.data_subject_requests;
create policy "dsr insert own" on public.data_subject_requests for insert
  with check (auth.uid() = user_id);
drop policy if exists "dsr select own" on public.data_subject_requests;
create policy "dsr select own" on public.data_subject_requests for select
  using (auth.uid() = user_id);
-- Durum güncelleme yalnızca service_role (manuel inceleme) — kullanıcı update/delete edemez.
create index if not exists dsr_user_idx on public.data_subject_requests (user_id, created_at desc);

-- 9d) PİLOT HUKUKİ HAZIRLIK DURUMU — pilot başına tek kayıt.
-- 'approved' yalnızca gerçek hukukçu onayı alındığında elle işaretlenir; sistem onay üretmez.
create table if not exists public.pilot_legal_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  pilot_id      uuid not null unique references public.pilot_projects(id) on delete cascade,
  status        text not null default 'not_started'
                check (status in ('not_started','in_progress','ready_for_review','approved','not_approved')),
  reviewer_name text,
  notes         text,
  updated_at    timestamptz default now()
);
alter table public.pilot_legal_reviews enable row level security;
drop policy if exists "pilot_legal_reviews private to owner" on public.pilot_legal_reviews;
create policy "pilot_legal_reviews private to owner" on public.pilot_legal_reviews for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- 10) ORGANİZASYON HESAPLARI + RBAC (Faz 5)
-- ----------------------------------------------------------------------------
-- GERİ UYUMLU: user_id sahipliği KORUNUR; mevcut politikalara DOKUNULMAZ.
-- Org erişimi, mevcut politikaların YANINA eklenen ek (permissive=OR) politikalarla
-- sağlanır. org_id kolonları NULLABLE — eski satırlar aynen çalışır. Backfill YOK.
-- Roller: owner > admin > safety_manager > viewer.
-- ============================================================================

-- 10a) Çekirdek tablolar
create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  industry      text,
  company_size  text,
  country       text,
  city          text,
  billing_email text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists public.organization_memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'viewer' check (role in ('owner','admin','safety_manager','viewer')),
  status     text not null default 'active' check (status in ('active','invited','removed')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at  timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (org_id, user_id)
);

create table if not exists public.organization_invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  email       text not null,
  role        text not null default 'viewer' check (role in ('admin','safety_manager','viewer')),
  token       text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by  uuid references auth.users(id) on delete set null,
  status      text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at  timestamptz default now()
);

create table if not exists public.organization_sites (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  location   text,
  status     text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 10b) Yardımcı fonksiyonlar (SECURITY DEFINER — RLS özyinelemesini önler)
create or replace function public.is_org_member(p_org uuid, p_roles text[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active'
      and (p_roles is null or m.role = any(p_roles))
  );
$$;

create or replace function public.is_org_owner_direct(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organizations o where o.id = p_org and o.owner_user_id = auth.uid());
$$;

-- Davet kabulü: token + e-posta + süre doğrulaması TAMAMEN sunucuda.
create or replace function public.accept_org_invite(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv record; my_email text; org_name text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  select lower(email) into my_email from auth.users where id = auth.uid();
  select * into inv from public.organization_invitations where token = p_token limit 1;
  if inv is null then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  if inv.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'not_pending'); end if;
  if inv.expires_at < now() then
    update public.organization_invitations set status = 'expired' where id = inv.id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  if lower(inv.email) <> my_email then return jsonb_build_object('ok', false, 'error', 'email_mismatch'); end if;
  insert into public.organization_memberships (org_id, user_id, email, role, status, invited_by, joined_at)
  values (inv.org_id, auth.uid(), my_email, inv.role, 'active', inv.invited_by, now())
  on conflict (org_id, user_id) do update
    set status = 'active', role = excluded.role, joined_at = now(), updated_at = now();
  update public.organization_invitations set status = 'accepted', accepted_at = now() where id = inv.id;
  select name into org_name from public.organizations where id = inv.org_id;
  return jsonb_build_object('ok', true, 'org_id', inv.org_id, 'org_name', org_name, 'role', inv.role);
end;
$$;

-- 10c) Yeni tabloların RLS'i
alter table public.organizations enable row level security;
drop policy if exists "org select members" on public.organizations;
create policy "org select members" on public.organizations for select
  using (is_org_member(id) or owner_user_id = auth.uid());
drop policy if exists "org insert self" on public.organizations;
create policy "org insert self" on public.organizations for insert
  with check (owner_user_id = auth.uid());
drop policy if exists "org update admins" on public.organizations;
create policy "org update admins" on public.organizations for update
  using (is_org_member(id, array['owner','admin']));
drop policy if exists "org delete owner" on public.organizations;
create policy "org delete owner" on public.organizations for delete
  using (is_org_member(id, array['owner']) or owner_user_id = auth.uid());

alter table public.organization_memberships enable row level security;
drop policy if exists "memberships select" on public.organization_memberships;
create policy "memberships select" on public.organization_memberships for select
  using (user_id = auth.uid() or is_org_member(org_id));
drop policy if exists "memberships insert" on public.organization_memberships;
create policy "memberships insert" on public.organization_memberships for insert
  with check (
    (user_id = auth.uid() and is_org_owner_direct(org_id))      -- kurucu kendi owner kaydını açar
    or is_org_member(org_id, array['owner','admin'])            -- yönetici üye ekler
  );
drop policy if exists "memberships update" on public.organization_memberships;
create policy "memberships update" on public.organization_memberships for update
  using (
    is_org_member(org_id, array['owner'])
    or (is_org_member(org_id, array['admin']) and role not in ('owner','admin'))  -- admin, owner/admin'e dokunamaz
  );
drop policy if exists "memberships delete owner" on public.organization_memberships;
create policy "memberships delete owner" on public.organization_memberships for delete
  using (is_org_member(org_id, array['owner']) and user_id <> auth.uid());

alter table public.organization_invitations enable row level security;
drop policy if exists "invites select admins" on public.organization_invitations;
create policy "invites select admins" on public.organization_invitations for select
  using (is_org_member(org_id, array['owner','admin']));
drop policy if exists "invites insert" on public.organization_invitations;
create policy "invites insert" on public.organization_invitations for insert
  with check (
    is_org_member(org_id, array['owner'])
    or (is_org_member(org_id, array['admin']) and role in ('safety_manager','viewer'))  -- admin, admin davet edemez
  );
drop policy if exists "invites update admins" on public.organization_invitations;
create policy "invites update admins" on public.organization_invitations for update
  using (is_org_member(org_id, array['owner','admin']));

alter table public.organization_sites enable row level security;
drop policy if exists "sites select members" on public.organization_sites;
create policy "sites select members" on public.organization_sites for select
  using (is_org_member(org_id));
drop policy if exists "sites write admins" on public.organization_sites;
create policy "sites write admins" on public.organization_sites for all
  using (is_org_member(org_id, array['owner','admin']))
  with check (is_org_member(org_id, array['owner','admin']));

-- 10d) Veri tablolarına NULLABLE org_id / site_id (mevcut satırlar etkilenmez)
alter table public.analyses add column if not exists org_id uuid references public.organizations(id) on delete set null;
alter table public.analyses add column if not exists site_id uuid references public.organization_sites(id) on delete set null;
alter table public.workers add column if not exists org_id uuid references public.organizations(id) on delete set null;
alter table public.equipment add column if not exists org_id uuid references public.organizations(id) on delete set null;
alter table public.checkpoints add column if not exists org_id uuid references public.organizations(id) on delete set null;
alter table public.checkpoints add column if not exists site_id uuid references public.organization_sites(id) on delete set null;
alter table public.scans add column if not exists org_id uuid references public.organizations(id) on delete set null;
alter table public.scans add column if not exists site_id uuid references public.organization_sites(id) on delete set null;
alter table public.pilot_projects add column if not exists org_id uuid references public.organizations(id) on delete set null;
alter table public.pilot_projects add column if not exists site_id uuid references public.organization_sites(id) on delete set null;
alter table public.pilot_checklists add column if not exists org_id uuid references public.organizations(id) on delete set null;
alter table public.pilot_weekly_reports add column if not exists org_id uuid references public.organizations(id) on delete set null;
alter table public.pilot_analysis_links add column if not exists org_id uuid references public.organizations(id) on delete set null;

create index if not exists analyses_org_idx on public.analyses (org_id, created_at desc);
create index if not exists scans_org_idx on public.scans (org_id, created_at desc);
create index if not exists pilot_projects_org_idx on public.pilot_projects (org_id);
create index if not exists memberships_user_idx on public.organization_memberships (user_id, status);
create index if not exists memberships_org_idx on public.organization_memberships (org_id, status);
create index if not exists invitations_org_idx on public.organization_invitations (org_id, status);

-- 10e) Veri tablolarına EK org politikaları (mevcut user_id politikaları AYNEN durur; OR birleşir)
-- Kalıp: okuma=tüm aktif üyeler · yazma=owner/admin/safety_manager · silme=owner/admin.
drop policy if exists "org members read analyses" on public.analyses;
create policy "org members read analyses" on public.analyses for select
  using (org_id is not null and is_org_member(org_id));
drop policy if exists "org staff insert analyses" on public.analyses;
create policy "org staff insert analyses" on public.analyses for insert
  with check (org_id is not null and auth.uid() = user_id and is_org_member(org_id, array['owner','admin','safety_manager']));
drop policy if exists "org staff update analyses" on public.analyses;
create policy "org staff update analyses" on public.analyses for update
  using (org_id is not null and is_org_member(org_id, array['owner','admin','safety_manager']));
drop policy if exists "org admins delete analyses" on public.analyses;
create policy "org admins delete analyses" on public.analyses for delete
  using (org_id is not null and is_org_member(org_id, array['owner','admin']));

drop policy if exists "org members read scans" on public.scans;
create policy "org members read scans" on public.scans for select
  using (org_id is not null and is_org_member(org_id));
drop policy if exists "org staff write scans" on public.scans;
create policy "org staff write scans" on public.scans for insert
  with check (org_id is not null and is_org_member(org_id, array['owner','admin','safety_manager']));

drop policy if exists "org members read pilots" on public.pilot_projects;
create policy "org members read pilots" on public.pilot_projects for select
  using (org_id is not null and is_org_member(org_id));
drop policy if exists "org admins write pilots" on public.pilot_projects;
create policy "org admins write pilots" on public.pilot_projects for all
  using (org_id is not null and is_org_member(org_id, array['owner','admin']))
  with check (org_id is not null and auth.uid() = user_id and is_org_member(org_id, array['owner','admin']));

drop policy if exists "org members read pilot checklists" on public.pilot_checklists;
create policy "org members read pilot checklists" on public.pilot_checklists for select
  using (org_id is not null and is_org_member(org_id));
drop policy if exists "org admins write pilot checklists" on public.pilot_checklists;
create policy "org admins write pilot checklists" on public.pilot_checklists for all
  using (org_id is not null and is_org_member(org_id, array['owner','admin']))
  with check (org_id is not null and is_org_member(org_id, array['owner','admin']));

drop policy if exists "org members read weekly reports" on public.pilot_weekly_reports;
create policy "org members read weekly reports" on public.pilot_weekly_reports for select
  using (org_id is not null and is_org_member(org_id));
drop policy if exists "org staff write weekly reports" on public.pilot_weekly_reports;
create policy "org staff write weekly reports" on public.pilot_weekly_reports for all
  using (org_id is not null and is_org_member(org_id, array['owner','admin','safety_manager']))
  with check (org_id is not null and is_org_member(org_id, array['owner','admin','safety_manager']));

drop policy if exists "org members read pilot links" on public.pilot_analysis_links;
create policy "org members read pilot links" on public.pilot_analysis_links for select
  using (org_id is not null and is_org_member(org_id));
drop policy if exists "org staff write pilot links" on public.pilot_analysis_links;
create policy "org staff write pilot links" on public.pilot_analysis_links for all
  using (org_id is not null and is_org_member(org_id, array['owner','admin','safety_manager']))
  with check (org_id is not null and is_org_member(org_id, array['owner','admin','safety_manager']));

-- ============================================================================
-- 11) FATURALANDIRMA & ABONELİK (Faz 6)
-- ----------------------------------------------------------------------------
-- Manuel ödeme (erken müşteri) + sağlayıcı-hazır abonelik. KURAL: aboneliği
-- AKTİF yapmak (kota açmak) yalnızca service_role'dedir — müşteri kendi kendine
-- kota açamaz. payment_records'taki 'manual_confirmed' bir BEYANDIR; kota vermez.
-- ============================================================================

-- 11a) subscriptions genişletmesi (org-aware; user_id unique kısıtı kaldırılır,
-- yerine kısmi unique indexler: kullanıcı başına 1 kişisel + org başına 1 abonelik)
alter table public.subscriptions add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.subscriptions add column if not exists cancel_at_period_end boolean default false;
alter table public.subscriptions add column if not exists trial_end timestamptz;
alter table public.subscriptions add column if not exists quota_overrides jsonb;
alter table public.subscriptions drop constraint if exists subscriptions_user_id_key;
create unique index if not exists subs_user_personal_key on public.subscriptions (user_id) where org_id is null;
create unique index if not exists subs_org_key on public.subscriptions (org_id) where org_id is not null;

drop policy if exists "subscriptions org members read" on public.subscriptions;
create policy "subscriptions org members read" on public.subscriptions for select
  using (org_id is not null and is_org_member(org_id));
-- Plan seçim NİYETİ: owner/admin yalnızca pasif (unpaid/trialing) kayıt açabilir.
-- Aktifleştirme (active/manual_active/pilot_active) SADECE service_role.
drop policy if exists "subscriptions intent insert" on public.subscriptions;
create policy "subscriptions intent insert" on public.subscriptions for insert
  with check (
    user_id = auth.uid() and status in ('unpaid','trialing')
    and (org_id is null or is_org_member(org_id, array['owner','admin']))
  );

-- 11b) Fatura müşterisi (vergi/iletişim bilgileri)
create table if not exists public.billing_customers (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references public.organizations(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  provider      text not null default 'manual' check (provider in ('manual','iyzico','stripe')),
  provider_customer_id text,
  billing_email text,
  company_name  text,
  tax_number    text,
  tax_office    text,
  billing_address text,
  country       text default 'TR',
  currency      text default 'TRY',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table public.billing_customers enable row level security;
drop policy if exists "billing_customers manage" on public.billing_customers;
create policy "billing_customers manage" on public.billing_customers for all
  using ((org_id is null and user_id = auth.uid()) or (org_id is not null and is_org_member(org_id, array['owner','admin'])))
  with check ((org_id is null and user_id = auth.uid()) or (org_id is not null and is_org_member(org_id, array['owner','admin'])));

-- 11c) Ödeme kayıtları
create table if not exists public.payment_records (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid references public.organizations(id) on delete set null,
  user_id             uuid references auth.users(id) on delete set null,
  subscription_id     uuid references public.subscriptions(id) on delete set null,
  pilot_id            uuid references public.pilot_projects(id) on delete set null,
  provider            text not null default 'manual' check (provider in ('manual','iyzico','stripe')),
  provider_payment_id text,
  amount              numeric not null,
  currency            text not null default 'TRY',
  status              text not null default 'pending'
                      check (status in ('pending','paid','failed','refunded','manual_confirmed')),
  payment_method      text default 'bank_transfer'
                      check (payment_method in ('bank_transfer','credit_card','iyzico','stripe','manual')),
  paid_at             timestamptz,
  metadata            jsonb,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
alter table public.payment_records enable row level security;
drop policy if exists "payment_records read" on public.payment_records;
create policy "payment_records read" on public.payment_records for select
  using (user_id = auth.uid() or (org_id is not null and is_org_member(org_id)));
drop policy if exists "payment_records insert" on public.payment_records;
create policy "payment_records insert" on public.payment_records for insert
  with check (
    user_id = auth.uid()
    and (org_id is null or is_org_member(org_id, array['owner','admin']))
    and status in ('pending','manual_confirmed')      -- 'paid' YALNIZ sağlayıcı webhook'u yazar
    and provider = 'manual'
  );
drop policy if exists "payment_records update own manual" on public.payment_records;
create policy "payment_records update own manual" on public.payment_records for update
  using (provider = 'manual' and (user_id = auth.uid() or (org_id is not null and is_org_member(org_id, array['owner','admin']))));
create index if not exists payment_records_org_idx on public.payment_records (org_id, created_at desc);
create index if not exists payment_records_pilot_idx on public.payment_records (pilot_id);
create unique index if not exists payment_records_provider_evt on public.payment_records (provider, provider_payment_id) where provider_payment_id is not null;

-- 11d) Faturalar (yalnızca MIA/servis düzenler; kullanıcı görüntüler)
create table if not exists public.invoices (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid references public.organizations(id) on delete set null,
  user_id           uuid references auth.users(id) on delete set null,
  subscription_id   uuid references public.subscriptions(id) on delete set null,
  payment_record_id uuid references public.payment_records(id) on delete set null,
  invoice_number    text unique,
  amount            numeric not null,
  currency          text not null default 'TRY',
  status            text not null default 'draft' check (status in ('draft','issued','paid','void')),
  invoice_url       text,
  issued_at         timestamptz,
  due_at            timestamptz,
  paid_at           timestamptz,
  metadata          jsonb,
  created_at        timestamptz default now()
);
alter table public.invoices enable row level security;
drop policy if exists "invoices read" on public.invoices;
create policy "invoices read" on public.invoices for select
  using (user_id = auth.uid() or (org_id is not null and is_org_member(org_id, array['owner','admin'])));
-- Yazma yalnız service_role.

-- 11e) Webhook idempotency — işlenmiş olay kaydı (yalnız service_role; politika yok)
create table if not exists public.billing_events (
  id         bigint generated always as identity primary key,
  provider   text not null,
  event_id   text not null,
  payload    jsonb,
  created_at timestamptz default now(),
  unique (provider, event_id)
);
alter table public.billing_events enable row level security;

-- 11f) Pilot ödeme durumu
alter table public.pilot_projects add column if not exists payment_status text default 'unpaid'
  check (payment_status in ('unpaid','pending','manual_confirmed','refunded','converted'));
alter table public.pilot_projects add column if not exists payment_record_id uuid references public.payment_records(id) on delete set null;

-- 11g) api_usage org bağlamı (org bazlı kota sayımı)
alter table public.api_usage add column if not exists org_id uuid;
create index if not exists api_usage_org_idx on public.api_usage (org_id, created_at desc);

-- ============================================================================
-- 12) MÜŞTERİ OPERASYONLARI / SATIŞ HATTI (Faz 8 — iç CRM, kamuya KAPALI)
-- ----------------------------------------------------------------------------
-- Hafif iç CRM: hedef firma → keşif → demo → ücretli pilot → abonelik takibi.
-- Erişim: kayıt sahibi VEYA org owner/admin (yazma); org üyeleri okuma;
-- viewer düzenleyemez (yazma politikalarının dışında). Sahte veri YOK.
-- ============================================================================

-- Ortak yazma kalıbı için not: owner_user_id = auth.uid() veya org owner/admin.

create table if not exists public.customer_accounts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references public.organizations(id) on delete set null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  company_name  text not null,
  industry      text,
  segment       text default 'construction' check (segment in
                ('construction','contractor','infrastructure','industrial','logistics','osgb','other')),
  company_size  text,
  city          text,
  country       text default 'TR',
  website       text,
  linkedin_url  text,
  source        text default 'other' check (source in
                ('founder_network','mostar_referral','linkedin','osgb','inbound','event','cold_outreach','other')),
  status        text not null default 'target' check (status in
                ('target','contacted','discovery_scheduled','discovery_completed','demo_sent',
                 'pilot_proposed','pilot_active','customer','lost')),
  priority      text default 'medium' check (priority in ('low','medium','high')),
  linked_pilot_id uuid references public.pilot_projects(id) on delete set null,
  notes         text,
  metadata      jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists public.customer_contacts (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customer_accounts(id) on delete cascade,
  org_id        uuid references public.organizations(id) on delete set null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  full_name     text not null,
  role_title    text,
  email         text,
  phone         text,
  linkedin_url  text,
  decision_role text default 'other' check (decision_role in
                ('champion','budget_owner','decision_maker','influencer','legal','procurement','technical','other')),
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists public.sales_opportunities (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customer_accounts(id) on delete cascade,
  org_id        uuid references public.organizations(id) on delete set null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_name text not null,
  stage         text not null default 'lead' check (stage in
                ('lead','discovery','demo','pilot_proposed','paid_pilot','negotiation','won','lost')),
  expected_value numeric,
  currency      text default 'TRY',
  expected_close_date date,
  probability   int check (probability between 0 and 100),
  linked_pilot_id uuid references public.pilot_projects(id) on delete set null,
  linked_subscription_id uuid references public.subscriptions(id) on delete set null,
  next_step     text,
  next_follow_up_date date,
  lost_reason   text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists public.customer_interactions (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.customer_accounts(id) on delete cascade,
  opportunity_id uuid references public.sales_opportunities(id) on delete set null,
  org_id         uuid references public.organizations(id) on delete set null,
  owner_user_id  uuid not null references auth.users(id) on delete cascade,
  interaction_type text not null default 'note' check (interaction_type in
                 ('call','email','meeting','demo','site_visit','whatsapp','note')),
  interaction_date date default current_date,
  summary        text,
  outcome        text,
  next_action    text,
  next_follow_up_date date,
  created_at     timestamptz default now()
);

create table if not exists public.sales_tasks (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid references public.customer_accounts(id) on delete cascade,
  opportunity_id uuid references public.sales_opportunities(id) on delete set null,
  org_id         uuid references public.organizations(id) on delete set null,
  owner_user_id  uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  due_date       date,
  status         text not null default 'open' check (status in ('open','completed','cancelled')),
  priority       text default 'medium' check (priority in ('low','medium','high')),
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists public.case_study_candidates (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customer_accounts(id) on delete cascade,
  pilot_id      uuid references public.pilot_projects(id) on delete set null,
  org_id        uuid references public.organizations(id) on delete set null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'not_started' check (status in
                ('not_started','candidate','permission_requested','approved','published','rejected')),
  headline      text,
  key_metrics   text,
  permission_notes text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- RLS: okuma = sahibi veya org üyesi · yazma = sahibi veya org owner/admin
-- (etkileşimler: safety_manager da NOT ekleyebilir).
do $$
declare t text;
begin
  foreach t in array array['customer_accounts','customer_contacts','sales_opportunities',
                           'customer_interactions','sales_tasks','case_study_candidates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "crm read" on public.%I', t);
    execute format('create policy "crm read" on public.%I for select using
      (owner_user_id = auth.uid() or (org_id is not null and is_org_member(org_id)))', t);
    execute format('drop policy if exists "crm write" on public.%I', t);
    if t = 'customer_interactions' then
      execute format('create policy "crm write" on public.%I for all using
        (owner_user_id = auth.uid() or (org_id is not null and is_org_member(org_id, array[''owner'',''admin'',''safety_manager''])))
        with check
        (owner_user_id = auth.uid() and (org_id is null or is_org_member(org_id, array[''owner'',''admin'',''safety_manager''])))', t);
    else
      execute format('create policy "crm write" on public.%I for all using
        (owner_user_id = auth.uid() or (org_id is not null and is_org_member(org_id, array[''owner'',''admin''])))
        with check
        (owner_user_id = auth.uid() and (org_id is null or is_org_member(org_id, array[''owner'',''admin''])))', t);
    end if;
  end loop;
end $$;

create index if not exists customer_accounts_owner_idx on public.customer_accounts (owner_user_id, status);
create index if not exists customer_contacts_cust_idx on public.customer_contacts (customer_id);
create index if not exists sales_opps_cust_idx on public.sales_opportunities (customer_id, stage);
create index if not exists interactions_cust_idx on public.customer_interactions (customer_id, interaction_date desc);
create index if not exists sales_tasks_owner_idx on public.sales_tasks (owner_user_id, status, due_date);

-- Gelen demo taleplerini CRM'de görebilecek MIA ekibi (service_role yönetir; politika YOK).
create table if not exists public.crm_admins (
  user_email text primary key,
  created_at timestamptz default now()
);
alter table public.crm_admins enable row level security;
insert into public.crm_admins (user_email) values
  ('dennizoge@gmail.com')
on conflict (user_email) do nothing;

create or replace function public.is_crm_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crm_admins c
                 where lower(c.user_email) = lower(coalesce(auth.email(), '')));
$$;

-- demo_requests: yalnız CRM admin'leri OKUYABİLİR (anon insert politikası aynen durur).
drop policy if exists "crm admins read demo requests" on public.demo_requests;
create policy "crm admins read demo requests" on public.demo_requests for select
  using (is_crm_admin());

-- ============================================================================
-- 13) RAPOR DOĞRULANABİLİRLİĞİ & DIŞA AKTARMA GEÇMİŞİ (Faz 9)
-- ----------------------------------------------------------------------------
-- Her PDF/CSV/paylaşım olayı kaydedilir; report_id + bütünlük hash'i metadata'da.
-- Bu tablo hem "rapor kimliği kaydı" hem "export geçmişi"dir (ayrı analysis_reports
-- tablosu yerine bilinçli sadelik — mevcut analyses akışına dokunulmaz).
-- ============================================================================
create table if not exists public.report_exports (
  id          uuid primary key default gen_random_uuid(),
  analysis_id uuid references public.analyses(id) on delete set null,
  report_id   text,                      -- MIA-RPT-YYYYMMDD-XXXXXX
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid references public.organizations(id) on delete set null,
  export_type text not null check (export_type in ('pdf','csv','shared_link','json')),
  exported_at timestamptz default now(),
  metadata    jsonb                      -- {hash, model_version, validation_status, title...}
);
alter table public.report_exports enable row level security;
drop policy if exists "report_exports read" on public.report_exports;
create policy "report_exports read" on public.report_exports for select
  using (user_id = auth.uid() or (org_id is not null and is_org_member(org_id)));
drop policy if exists "report_exports insert" on public.report_exports;
create policy "report_exports insert" on public.report_exports for insert
  with check (user_id = auth.uid());
create index if not exists report_exports_user_idx on public.report_exports (user_id, exported_at desc);
create index if not exists report_exports_analysis_idx on public.report_exports (analysis_id);

-- ============================================================================
-- 14) İZLEME / HATA TAKİBİ / SAĞLIK (Faz 10)
-- ----------------------------------------------------------------------------
-- Loglara KAMU erişimi yok. Okuma: yalnız crm_admins (iç ekip). Yazma: service_role
-- (+ system_events'e kimlikli kullanıcı yalnızca KENDİ frontend olayını yazabilir).
-- Sır/token/ham video İÇERMEZ — yalnız özet + ID'ler.
-- ============================================================================
create table if not exists public.system_events (
  id            bigint generated always as identity primary key,
  event_type    text not null,
  severity      text not null default 'info' check (severity in ('info','warning','error','critical')),
  source        text not null default 'frontend' check (source in
                ('frontend','api','ai_pipeline','billing','report','auth','security','cron')),
  user_id       uuid references auth.users(id) on delete set null,
  org_id        uuid,
  route         text,
  function_name text,
  message       text,
  metadata      jsonb,
  created_at    timestamptz default now()
);
alter table public.system_events enable row level security;
drop policy if exists "events admin read" on public.system_events;
create policy "events admin read" on public.system_events for select using (is_crm_admin());
drop policy if exists "events self insert" on public.system_events;
create policy "events self insert" on public.system_events for insert
  with check (auth.uid() = user_id and source = 'frontend' and severity = 'info');
create index if not exists system_events_time_idx on public.system_events (created_at desc);
create index if not exists system_events_type_idx on public.system_events (event_type, created_at desc);

create table if not exists public.system_errors (
  id            bigint generated always as identity primary key,
  source        text not null default 'api',
  severity      text not null default 'error' check (severity in ('warning','error','critical')),
  error_code    text,
  message       text,
  stack_hash    text,
  user_id       uuid references auth.users(id) on delete set null,
  org_id        uuid,
  route         text,
  function_name text,
  request_id    text,
  metadata      jsonb,
  resolved      boolean default false,
  resolved_at   timestamptz,
  created_at    timestamptz default now()
);
alter table public.system_errors enable row level security;
drop policy if exists "errors admin read" on public.system_errors;
create policy "errors admin read" on public.system_errors for select using (is_crm_admin());
drop policy if exists "errors admin resolve" on public.system_errors;
create policy "errors admin resolve" on public.system_errors for update using (is_crm_admin());
create index if not exists system_errors_time_idx on public.system_errors (created_at desc);

create table if not exists public.health_checks (
  id         bigint generated always as identity primary key,
  check_name text not null,
  status     text not null check (status in ('healthy','degraded','down','unknown')),
  latency_ms int,
  message    text,
  metadata   jsonb,
  checked_at timestamptz default now()
);
alter table public.health_checks enable row level security;
drop policy if exists "health admin read" on public.health_checks;
create policy "health admin read" on public.health_checks for select using (is_crm_admin());
create index if not exists health_checks_time_idx on public.health_checks (checked_at desc);

-- ============================================================================
-- 15) GERÇEK ZAMANLI KAMERA AI (Faz 12)
-- ----------------------------------------------------------------------------
-- Mimari: RTSP akışını AYRI bir worker servisi işler (Netlify functions uzun
-- süreli akış tutamaz). Uygulama kamera kayıtlarını yönetir; worker service_role
-- ile camera_events/heartbeat yazar. RTSP KİMLİK BİLGİLERİ BU TABLOYA GİRMEZ —
-- yalnız worker host'unun yerel config'inde tutulur (stream_url_masked salt görüntü).
-- Yüklenen-video analizi (analyses) AYNEN korunur; bu ayrı bir modüldür.
-- ============================================================================
create table if not exists public.cameras (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  site_id           uuid references public.organization_sites(id) on delete set null,
  name              text not null,
  location_label    text,
  camera_type       text not null default 'rtsp'
                    check (camera_type in ('rtsp','onvif','browser_webcam','test_stream')),
  stream_url_masked text,            -- örn. rtsp://***:***@192.168.1.*** (salt görüntü)
  status            text not null default 'inactive'
                    check (status in ('inactive','testing','active','error','paused','archived')),
  health_status     text not null default 'unknown'
                    check (health_status in ('unknown','online','offline','degraded')),
  last_frame_at     timestamptz,
  last_detection_at timestamptz,
  sampling_fps      numeric default 0.2,    -- 5 sn'de 1 kare (maliyet varsayılanı)
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
alter table public.cameras enable row level security;
drop policy if exists "cameras read members" on public.cameras;
create policy "cameras read members" on public.cameras for select
  using (is_org_member(org_id));
drop policy if exists "cameras manage admins" on public.cameras;
create policy "cameras manage admins" on public.cameras for all
  using (is_org_member(org_id, array['owner','admin']))
  with check (is_org_member(org_id, array['owner','admin']));
create index if not exists cameras_org_idx on public.cameras (org_id, status);

create table if not exists public.camera_events (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  site_id          uuid,
  camera_id        uuid not null references public.cameras(id) on delete cascade,
  event_type       text not null check (event_type in
                   ('ppe_violation','no_helmet','no_vest','no_mask','restricted_area',
                    'unsafe_behavior','camera_offline','worker_error')),
  risk_level       text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  confidence       numeric,
  frame_timestamp  timestamptz not null default now(),
  snapshot_path    text,
  detections_json  jsonb,
  model_name       text,
  model_version    text,
  validation_status text,
  status           text not null default 'open' check (status in ('open','reviewed','dismissed','resolved')),
  reviewed_by      uuid references auth.users(id) on delete set null,
  reviewed_at      timestamptz,
  notes            text,
  created_at       timestamptz default now()
);
alter table public.camera_events enable row level security;
drop policy if exists "camera_events read members" on public.camera_events;
create policy "camera_events read members" on public.camera_events for select
  using (is_org_member(org_id));
-- İnceleme (review/dismiss): safety_manager ve üstü. INSERT yalnız service_role (worker).
drop policy if exists "camera_events review staff" on public.camera_events;
create policy "camera_events review staff" on public.camera_events for update
  using (is_org_member(org_id, array['owner','admin','safety_manager']));
create index if not exists camera_events_org_time_idx on public.camera_events (org_id, created_at desc);
create index if not exists camera_events_cam_idx on public.camera_events (camera_id, created_at desc);

create table if not exists public.camera_health_logs (
  id         bigint generated always as identity primary key,
  org_id     uuid not null,
  camera_id  uuid not null references public.cameras(id) on delete cascade,
  status     text not null,
  latency_ms int,
  message    text,
  metadata   jsonb,
  checked_at timestamptz default now()
);
alter table public.camera_health_logs enable row level security;
drop policy if exists "camera_health read members" on public.camera_health_logs;
create policy "camera_health read members" on public.camera_health_logs for select
  using (is_org_member(org_id));
create index if not exists camera_health_cam_idx on public.camera_health_logs (camera_id, checked_at desc);

create table if not exists public.camera_worker_sessions (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid,
  camera_id         uuid references public.cameras(id) on delete cascade,
  worker_id         text not null,
  status            text not null default 'starting'
                    check (status in ('starting','running','stopped','error')),
  started_at        timestamptz default now(),
  stopped_at        timestamptz,
  last_heartbeat_at timestamptz default now(),
  error_message     text,
  metadata          jsonb
);
alter table public.camera_worker_sessions enable row level security;
drop policy if exists "worker_sessions read members" on public.camera_worker_sessions;
create policy "worker_sessions read members" on public.camera_worker_sessions for select
  using (org_id is null or is_org_member(org_id));
-- Yazma yalnız service_role (worker).
create index if not exists worker_sessions_hb_idx on public.camera_worker_sessions (last_heartbeat_at desc);

-- ============================================================================
-- 16) KKD TESPİT PROFİLLERİ + KAMERA OLAYI EKİPMAN ALANLARI (Faz 13)
-- ----------------------------------------------------------------------------
-- Firmalar hangi ekipmanın taranacağını seçer (baret/yelek/maske vb.).
-- Worker yalnız profilde ETKİN ekipman ihlali üretir. Yalnız model tarafından
-- gerçekten desteklenen sınıflar etkinleştirilebilir (js/ppe-registry.js).
-- camera_events'e ekipman alanları ADDITIVE eklenir — mevcut veri bozulmaz.
-- ============================================================================
create table if not exists public.ppe_detection_profiles (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  site_id            uuid references public.organization_sites(id) on delete set null,
  name               text not null default 'Varsayılan profil',
  description        text,
  is_default         boolean not null default false,
  required_equipment jsonb not null default '{"helmet":true,"safety_vest":true,"mask":false}'::jsonb,
  enabled_classes    jsonb,             -- model sınıf listesi (registry'den türetilir)
  risk_rules         jsonb,             -- { "helmet":"high", "safety_vest":"high", ... }
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
alter table public.ppe_detection_profiles enable row level security;
drop policy if exists "ppe_profiles read members" on public.ppe_detection_profiles;
create policy "ppe_profiles read members" on public.ppe_detection_profiles for select
  using (is_org_member(org_id));
-- Yapılandırma: owner/admin/safety_manager (İSG uzmanı tarama kapsamını belirleyebilir).
drop policy if exists "ppe_profiles manage staff" on public.ppe_detection_profiles;
create policy "ppe_profiles manage staff" on public.ppe_detection_profiles for all
  using (is_org_member(org_id, array['owner','admin','safety_manager']))
  with check (is_org_member(org_id, array['owner','admin','safety_manager']));
-- Org başına tek varsayılan profil (site'siz):
create unique index if not exists ppe_profiles_default_idx
  on public.ppe_detection_profiles (org_id) where (is_default and site_id is null);
create index if not exists ppe_profiles_org_idx on public.ppe_detection_profiles (org_id);

-- camera_events ekipman alanları (additive — eski satırlarda null kalır):
alter table public.camera_events add column if not exists person_track_id    text;
alter table public.camera_events add column if not exists missing_equipment  jsonb;
alter table public.camera_events add column if not exists detected_equipment jsonb;
alter table public.camera_events add column if not exists required_equipment jsonb;
alter table public.camera_events add column if not exists snapshot_url       text;

-- ============================================================================
-- 17) SUNUCU TARAFI KAMERA LİMİTİ (Faz 14 — QA bulgusu kapatma)
-- ----------------------------------------------------------------------------
-- Faz 13 QA: kamera ADET limiti yalnız client-side idi. Bu trigger limiti
-- veritabanında zorlar — frontend atlansa bile plan limiti aşılamaz.
-- Plan kaynağı: subscriptions (org aboneliği, aktif durumlar); yoksa 'free'.
-- Limitler js/plans.js cameras alanıyla SENKRON: free=1(demo), giris=0,
-- kamera_ai=10, pro=30, kurumsal=sınırsız. Mevcut satırlara dokunmaz (yalnız INSERT).
-- ============================================================================
create or replace function public.mia_camera_plan_limit(p_org uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case coalesce(
    (select s.plan from public.subscriptions s
      where s.org_id = p_org
        and s.status in ('active','trialing','manual_active','pilot_active')
      order by s.updated_at desc nulls last limit 1), 'free')
    when 'free'      then 1
    when 'giris'     then 0
    when 'kamera_ai' then 10
    when 'pro'       then 30
    when 'kurumsal'  then null   -- sınırsız
    else 0                       -- bilinmeyen plan: muhafazakâr (kapalı)
  end;
$$;

create or replace function public.mia_enforce_camera_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limit integer;
  v_count integer;
begin
  v_limit := public.mia_camera_plan_limit(new.org_id);
  if v_limit is null then
    return new;                  -- kurumsal: sınırsız
  end if;
  select count(*) into v_count from public.cameras
    where org_id = new.org_id and status <> 'archived';
  if v_count >= v_limit then
    raise exception 'camera_limit_reached: plan en çok % kamera izin veriyor', v_limit
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

do $$
begin
  execute 'drop trigger if exists trg_mia_camera_limit on public.cameras';
  execute 'create trigger trg_mia_camera_limit before insert on public.cameras '
       || 'for each row execute function public.mia_enforce_camera_limit()';
end $$;

-- ============================================================================
-- Done. Tablolar: analyses, demo_requests, chat_messages, workers, equipment,
-- checkpoints, scans, api_usage, consents, subscriptions, pilot_projects,
-- pilot_checklists, pilot_weekly_reports, pilot_analysis_links,
-- legal_document_versions, data_subject_requests, pilot_legal_reviews,
-- organizations, organization_memberships, organization_invitations,
-- organization_sites, billing_customers, payment_records, invoices,
-- billing_events, customer_accounts, customer_contacts, sales_opportunities,
-- customer_interactions, sales_tasks, case_study_candidates, crm_admins,
-- report_exports, system_events, system_errors, health_checks, cameras,
-- camera_events, camera_health_logs, camera_worker_sessions,
-- ppe_detection_profiles (hepsi RLS açık).
-- ============================================================================
