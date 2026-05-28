# MIA — Production Setup Guide

This document walks you through configuring the MIA SaaS platform end-to-end:
Supabase Auth, branded transactional email from `noreply@mia.com.tr`, and
deployment.

---

## 1. Stack

MIA is a static HTML/CSS/JS site that talks directly to **Supabase Auth** and
**Supabase Postgres** from the browser. There is no custom backend to host —
Supabase provides:

- User accounts + password hashing (bcrypt under the hood)
- Email confirmation, password reset, magic links
- Persistent sessions stored in `localStorage` with auto-refresh
- Row-level security on the `analyses`, `demo_requests`, and `chat_messages`
  tables

A Supabase project is already provisioned and wired into `js/app.js`.

---

## 2. Routes

| URL                  | File                | Purpose                          |
| -------------------- | ------------------- | -------------------------------- |
| `/`                  | `index.html`        | Landing page                     |
| `/sirket`            | `sirket.html`       | About / company                  |
| `/cozumler`          | `cozumler.html`     | Pricing                          |
| `/iletisim`          | `iletisim.html`     | Contact + founders               |
| `/detector`          | `detector.html`     | Safety Detector demo             |
| `/giris-yap`         | `giris-yap.html`    | **Sign in**                      |
| `/kaydol`            | `kaydol.html`       | **Sign up**                      |
| `/dogrulama`         | `dogrulama.html`    | Email confirmation landing       |
| `/sifre-sifirla`     | `sifre-sifirla.html`| Password reset (request + apply) |
| `/dashboard`         | `dashboard.html`    | Authenticated user dashboard     |
| `/demo`              | `demo.html`         | Video analysis (auth optional)   |
| `/demo-talep`        | `demo-talep.html`   | Public demo-request form         |

`login.html` still exists as a redirect to `/giris-yap` so old bookmarks work.
Pretty URLs (`/giris-yap` instead of `/giris-yap.html`) are configured in
`vercel.json` and `netlify.toml`.

---

## 3. Supabase configuration

Open your Supabase project dashboard
(<https://supabase.com/dashboard/project/qojtokomfcporcglrsdy>) and complete
the following.

### 3.1 Auth → URL Configuration

- **Site URL**: `https://mia.com.tr` (or your production origin)
- **Redirect URLs** — add all of these (one per line):
  - `https://mia.com.tr/dogrulama.html`
  - `https://mia.com.tr/dogrulama`
  - `https://mia.com.tr/sifre-sifirla.html`
  - `https://mia.com.tr/sifre-sifirla`
  - `http://localhost:5173/dogrulama.html` (or whatever port you use locally)
  - `http://localhost:5173/sifre-sifirla.html`

### 3.2 Auth → Providers → Email

- **Enable email signups**: ON
- **Confirm email**: ON (required so the confirmation link in section 3.4 fires)
- **Secure email change**: ON
- **Minimum password length**: 8

### 3.3 Auth → SMTP Settings (so emails come from `noreply@mia.com.tr`)

Switch from the default Supabase sender to your own SMTP credentials. The form
expects:

| Field             | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| Enable Custom SMTP| ON                                                         |
| Sender email      | `noreply@mia.com.tr`                                       |
| Sender name       | `MIA AI Safety Intelligence`                               |
| Host              | `smtp.resend.com` (or `smtp.sendgrid.net` / your provider) |
| Port              | `587`                                                      |
| Username          | provider-specific (e.g. `resend` for Resend)               |
| Password          | provider API key                                           |
| Admin email       | `info@mia.com.tr`                                          |

Whichever SMTP provider you pick, make sure the sending domain `mia.com.tr` has
its **SPF**, **DKIM**, and (optionally) **DMARC** DNS records configured at
your domain registrar — both Resend and SendGrid generate the exact records for
you. Without them, Gmail/Outlook will route MIA emails to spam.

### 3.4 Auth → Email Templates

For each template, paste the matching file from the `emails/` folder and set
the subject as listed.

| Supabase Template          | File                          | Subject                              |
| -------------------------- | ----------------------------- | ------------------------------------ |
| Confirm signup             | `emails/confirm-signup.html`  | `MIA Hesabınızı Doğrulayın`         |
| Reset Password             | `emails/reset-password.html`  | `MIA Şifre Sıfırlama`               |
| Magic Link                 | `emails/magic-link.html`      | `MIA Giriş Bağlantınız`             |
| Change Email Address       | `emails/change-email.html`    | `MIA E-posta Değişikliğini Onaylayın` |
| Invite user                | `emails/invite-user.html`     | `MIA Ekibine Davet`                  |

Each template uses Supabase's variable syntax (`{{ .ConfirmationURL }}`,
`{{ .Data.full_name }}`, `{{ .Email }}`, `{{ .NewEmail }}`). Do not edit those
braces.

### 3.5 Database tables

The browser code expects three tables (already present in the project). Their
SQL definitions for reference:

```sql
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_name text,
  safety_score numeric,
  violations_count int default 0,
  safe_count int default 0,
  frames_processed int default 0,
  processing_time numeric,
  pdf_base64 text,
  created_at timestamptz default now()
);
alter table public.analyses enable row level security;
create policy "analyses are private to their owner"
  on public.analyses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  name text, company text, email text, phone text, message text,
  created_at timestamptz default now()
);
alter table public.demo_requests enable row level security;
create policy "anyone can submit a demo request"
  on public.demo_requests for insert with check (true);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  message text, lang text, page text,
  created_at timestamptz default now()
);
alter table public.chat_messages enable row level security;
create policy "anyone can log a chat message"
  on public.chat_messages for insert with check (true);
```

---

## 4. Corporate mailboxes

These accounts are used by the platform and should be provisioned at your
domain mail host (Google Workspace, Microsoft 365, Zoho, etc.):

| Address                | Purpose                                          |
| ---------------------- | ------------------------------------------------ |
| `noreply@mia.com.tr`   | Sender for all automated system emails           |
| `info@mia.com.tr`      | Main public contact / `mailto:` on the site      |
| `deniz@mia.com.tr`     | Founder address (Deniz Öge)                      |
| `ege@mia.com.tr`       | Founder address (Ege Türker)                     |
| `gokberk@mia.com.tr`   | Founder address (Gökberk Şahin)                  |

`noreply@` can be a real inbox that auto-replies, or a routing alias that
forwards anything that lands there to `info@`. The other four should be normal
inboxes the team can read.

---

## 5. Local development

```bash
# from the repo root
python3 -m http.server 5173
# open http://localhost:5173
```

Or use any other static server (`npx serve`, `live-server`, etc.). No build
step is required.

When testing the email flow locally, make sure `http://localhost:5173/...`
URLs are listed in Supabase → Auth → URL Configuration → Redirect URLs.

To point at a different Supabase project locally, add this snippet at the top
of any page (or to a `js/local.js` you include conditionally):

```html
<script>
  window.MIA_SUPABASE_URL = "https://your-project.supabase.co";
  window.MIA_SUPABASE_KEY = "your-anon-key";
</script>
<script src="js/app.js"></script>
```

---

## 6. Deployment

The site is a static bundle — any static host works.

### Vercel
```bash
npm i -g vercel
vercel
```
`vercel.json` already configures clean URLs, security headers, and redirects.

### Netlify
Drag-and-drop the folder at <https://app.netlify.com/drop> or:
```bash
npm i -g netlify-cli
netlify deploy --prod
```
`netlify.toml` handles redirects + headers.

### Custom domain
Point `mia.com.tr` (and `www.mia.com.tr`) at your host and update **Site URL**
in Supabase to match (section 3.1).

---

## 7. Smoke test (after deploy)

1. Open `/kaydol`, register with a real address, submit.
2. Confirm you see the success panel ("Hesap oluşturuldu!").
3. Check that inbox — the email should be from `noreply@mia.com.tr`, branded
   dark-and-gold, and contain a working "Hesabımı Doğrula" button.
4. Click the button → land on `/dogrulama` → auto-redirect to `/dashboard`.
5. Logout from the navbar, hit `/giris-yap`, sign in, land on `/dashboard`.
6. Try `/sifre-sifirla`, request a reset, click the link, set a new password.
7. Sign in with the new password.

If any of those fail, check Supabase → Auth → Logs.

---

## 8. Security notes

- Passwords are hashed by Supabase Auth (bcrypt). The browser only ever sees
  plaintext to send over TLS to Supabase; nothing is stored client-side.
- Sessions live in `localStorage` under the key `mia.auth`, with auto-refresh
  on, so the user stays signed in across reloads and tabs.
- Row-level security is enabled so users only see their own `analyses` rows.
- Recommended hardening once you have a custom domain:
  - Enable **MFA** in Supabase → Auth → Settings.
  - Enable **CAPTCHA** on signup/login (Supabase supports hCaptcha + Turnstile).
  - Rotate the anon key annually; redeploy with the new value.
- The Supabase **anon key** is safe to ship to the browser (it's bound to RLS).
  The **service role key** is not — never put it in any `.html` or `js/` file.
