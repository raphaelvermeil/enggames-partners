# EngGames Partners

A sponsorship outreach tool for the EngGames organising team. It keeps track of the companies you want as sponsors, writes a pitch email for each one (with Claude, or from a fill-in template), sends the emails through Resend, and shows you which ones were delivered, opened, bounced, or answered.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, Storage) · Anthropic Claude · Resend · Tailwind CSS + shadcn/ui

---

## Table of contents

- [Features](#features)
- [How it works](#how-it-works)
- [Using the app](#using-the-app)
- [Setup](#setup)
- [Project structure](#project-structure)
- [Data model](#data-model)

---

## Features

| Feature | What it does |
|---|---|
| **Authentication** | Email/password login with Supabase Auth. Every page except `/login` requires a session. |
| **Companies** | Add, edit, and delete sponsor prospects. Filter the list by status and see at a glance which companies opened your email. |
| **CSV import** | Upload a spreadsheet to add many companies at once. |
| **AI email generation** | Claude writes a personalised pitch from the company's name, industry, website, contact, and notes. You can read and edit the prompt before it runs, and switch between four tones. |
| **Campaigns** | Saved outreach configurations. A campaign is either an **AI prompt** or a **fill-in template**, and can have its own subject line and a PDF attachment such as a sponsorship deck. |
| **Template variables** | `[company]`, `[contact]`, `[industry]`, `[website]`, `[email]` get filled in for each company, in subject lines and template bodies. |
| **Review & edit drafts** | Every generated email is saved as a draft that you can edit before sending. |
| **Sending** | Emails go out through Resend, as HTML with a plain-text fallback, and include the campaign's PDF if it has one. |
| **Bulk send** | Select several companies, pick a campaign, and generate and send all of them in one go with live per-company progress. |
| **Delivery tracking** | A Resend webhook records delivered and opened events, and flags bounces and spam complaints. |
| **Status tracking** | Each company moves through `pending → drafted → sent → replied / rejected`, or to `bounced` / `complained`. |
| **Follow-ups** | Set a follow-up date on a company. When the date arrives, the company shows up on the dashboard. |
| **Dashboard** | Counts by status, companies due for follow-up, and recently added companies. |

---

## How it works

### Overall flow

```
 Companies ──► Generate draft ──► Review / edit ──► Send (Resend) ──► Webhook updates
  (manual        (Claude or          (email_logs        (status = sent)    (delivered, opened,
   or CSV)        template)           status = draft)                       bounced, complained)
```

Every email is stored as a row in `email_logs`. A company can have several logs, for example a first pitch, a regenerated draft, and a follow-up. The company's own `status` is a summary that the app updates as the logs change.

### Company statuses

| Status | Set when |
|---|---|
| `pending` | The company is created or imported, or someone clicks **Reopen** on a rejected company. |
| `drafted` | A draft email has been generated for it. |
| `sent` | A draft was sent successfully through Resend. |
| `replied` | Someone clicks **Mark as Replied** (only shown while the status is `sent`). |
| `rejected` | Someone clicks **Mark as Rejected**. |
| `bounced` | Resend reports the email bounced. |
| `complained` | The recipient marked the email as spam. |

Bounce and complaint events only change a company that is still `sent`. A `replied` or `rejected` status you set by hand is never overwritten by a late webhook.

### Email generation: two campaign types

**AI Prompt campaigns** (and the default prompt with no campaign)
1. The app builds a context block from the company's fields: name, industry, website, contact person, and notes.
2. The context is added after the prompt, followed by an instruction to write only the email body.
3. `POST /api/generate-email` sends this to Claude (`claude-sonnet-4-6`, max 1024 tokens).
4. The reply is saved as a `draft` in `email_logs`. If the campaign has a subject template, its variables are filled in and saved as the draft's subject.

**Fill-in Template campaigns**
1. The campaign body is a finished email containing `[variables]`.
2. `fillTemplate()` in [src/lib/template.ts](src/lib/template.ts) replaces each variable with the company's value. Claude is not called.
3. The result is saved as a `draft` like any other.

When a company field is empty, the variable gets a natural fallback so the sentence still reads well:

| Variable | Value | Fallback if empty |
|---|---|---|
| `[company]` | Company name | "your company" |
| `[contact]` | Contact name | "there" (so "Hi [contact]," becomes "Hi there,") |
| `[industry]` | Industry | "your industry" |
| `[website]` | Website | "your website" |
| `[email]` | Contact email | *(empty)* |

Unknown tags like `[foo]` are left as they are.

### Sending

`POST /api/send-email` takes a draft's `logId` and:
1. Loads the draft, its company, and its campaign's attachment, if there is one.
2. Converts the body into simple HTML paragraphs and keeps the original as plain text.
3. Sends the email through Resend from `EMAIL_FROM`. The subject is the draft's subject, or **"Sponsorship Opportunity — EngGames Engineering Competition"** if it has none.
4. If sending succeeds, the log is marked `sent` with `sent_at` and the Resend message ID, and the company is marked `sent`. If it fails, the log is marked `failed`.

### Tracking (Resend webhook)

`POST /api/webhooks/resend` checks the Svix signature using `RESEND_WEBHOOK_SECRET`, then matches the event to a log through `resend_id`:

| Resend event | Effect |
|---|---|
| `email.delivered` | Sets `delivered_at` on the log (first time only) |
| `email.opened` | Sets `opened_at` on the log (first time only), which shows the **Opened** badge in the UI |
| `email.bounced` | Log → `bounced`. Company → `bounced` if it is still `sent` |
| `email.complained` | Log → `complained`. Company → `complained` if it is still `sent` |

The webhook runs without a user session, so it connects with the Supabase **service role key**.

### PDF attachments

When you attach a PDF to a campaign, it is uploaded to the Supabase Storage bucket `campaign-attachments`, and the campaign stores the file's public URL. Resend downloads the file from that URL at send time. If you replace or remove the attachment while editing a campaign, the old file is deleted from storage.

---

## Using the app

### 1. Sign in

Go to `/login` and sign in with your team account. The app has no public sign-up page, so accounts are created in the Supabase dashboard (**Authentication → Users → Add user**).

> Each user only sees the companies and campaigns they created (Row Level Security is set per user).

### 2. Add companies

**One at a time:** go to **Companies → Add Company** and fill in the name and contact email (required), plus contact name, website, industry, and notes.

> **Tip:** The **Notes** field is the best way to improve AI emails. Write what the company does, any connection you have with them, or why they would be a good fit, and Claude will use it.

**From a CSV:** click **Import CSV** and choose a file. The first row must contain the column headers. These names are recognised:

| Field | Accepted column headers |
|---|---|
| Name | `name`, `Name` |
| Contact email | `email`, `contact_email`, `Email` |
| Contact name | `contact_name`, `contact`, `Contact` |
| Website | `website`, `Website` |
| Industry | `industry`, `Industry` |
| Notes | `notes`, `Notes` |

Example:

```csv
name,email,contact_name,website,industry,notes
Acme Robotics,partners@acme.com,Jane Doe,https://acme.com,Robotics,Sponsored a hackathon last year
Globex,hello@globex.com,,https://globex.com,Energy,
```

Imported companies start as `pending`.

### 3. Create a campaign (optional)

Go to **Campaigns → New Campaign**:

- **Name**: for example "Winter 2026 Tech Outreach".
- **Type**:
  - **AI Prompt**: instructions for Claude. You don't need to include company details, because they are added automatically.
  - **Fill-in Template**: the exact email to send, using `[variables]`.
- **Subject Line** (optional): can use variables, for example `Sponsoring EngGames — [company]?`. Leave it blank to use the default subject.
- **PDF Attachment** (optional): a sponsorship package or deck that is attached to every email sent with this campaign.

You can edit or delete a campaign at any time. Drafts already created from a campaign keep the content they were generated with.

### 4. Generate and send one email

1. On **Companies**, click **View** next to a company.
2. Click **Generate Email**. A dialog opens:
   - **Campaign:** choose **None** to use the default pitch, or pick a campaign. A 📎 note appears if the campaign includes a PDF.
   - **AI prompt:** you can edit the full prompt, or click a tone button (**Professional**, **Friendly**, **Concise**, **Bold**) to load a preset.
   - **Template campaign:** the dialog shows the finished email with variables filled in, which you can edit directly.
3. Click **Generate** (AI) or **Create Draft** (template). The draft appears under **Email History**.
4. Click **Edit** on the draft to change it, then **Save**.
5. Click **Send Draft Email**.

To try a different version, click **Regenerate Email**. This creates a new draft and leaves the old ones in place.

### 5. Bulk send

1. On **Companies**, tick the checkboxes next to the companies you want (you can filter by status first, for example `pending`).
2. Click **Bulk Send (N)**.
3. Pick **Default prompt** or a campaign, then confirm.
4. A progress dialog shows each company moving through **Queued → Generating… → Sending… → Done / Failed**. If one company fails, the rest still go through.

> ⚠️ Bulk send has **no review step**. Drafts are sent as soon as they are generated. To check the wording first, use the single-company flow on one company, or use a fill-in template so you know exactly what will be sent.

### 6. Track responses

- The **Opened** column on the Companies page and Dashboard shows which companies opened your email.
- On a company's page, each sent email shows its status: *Not opened yet*, *Opened (date)*, *Bounced*, or *Marked as spam*.
- When someone answers, open their company and click **Mark as Replied**, or **Mark as Rejected** if they decline. **Reopen** sets a rejected company back to `pending`.
- To edit a company's details, use **Edit** on the Company Info card.

### 7. Schedule follow-ups

On a company with status `drafted` or `sent`, pick a date under **Schedule follow-up**. Once that date has passed, the company appears in **Due for Follow-up** on the Dashboard, unless it has since replied, been rejected, bounced, or complained. Click **Clear** to remove the follow-up date.

---

## Setup

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- An [Anthropic API key](https://console.anthropic.com)
- A [Resend](https://resend.com) account with a verified sending domain

### 1. Install

```bash
npm install
```

### 2. Database

In the Supabase SQL editor, run [supabase-schema.sql](supabase-schema.sql). It creates the `companies`, `campaigns`, and `email_logs` tables, their enums, and the Row Level Security policies.

### 3. Storage (for PDF attachments)

In Supabase, go to **Storage** and create a **public** bucket named `campaign-attachments`. Then add storage policies that let authenticated users **upload** and **delete** objects in it. The bucket has to be public because Resend downloads attachments from their public URL.

### 4. Environment variables

Create `.env.local` in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...          # server-only, used by the Resend webhook

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Resend
RESEND_API_KEY=re_...
EMAIL_FROM="EngGames <partners@yourdomain.com>"   # must be on a domain verified in Resend
RESEND_WEBHOOK_SECRET=whsec_...        # from the Resend webhook settings
```

### 5. Resend webhook

In Resend, go to **Webhooks → Add endpoint**:
- URL: `https://<your-domain>/api/webhooks/resend`
- Events: `email.delivered`, `email.opened`, `email.bounced`, `email.complained`
- Copy the signing secret into `RESEND_WEBHOOK_SECRET`.

Open tracking must also be turned on for your domain in Resend. To receive webhooks while developing locally, expose your dev server with a tunnel such as `ngrok http 3000`.

### 6. Create a user and run

Create a user in Supabase (**Authentication → Users**), then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). It redirects to `/login`, and then to `/dashboard` once you sign in.

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

---

## Project structure

```
src/
├── app/
│   ├── (protected)/              # Pages that require login (shared nav bar layout)
│   │   ├── dashboard/            # Stats, follow-ups due, recent companies
│   │   ├── companies/            # List, filter, add, CSV import, bulk send
│   │   │   └── [id]/             # Company detail: generate, edit, send, track
│   │   └── campaigns/            # Create / edit / delete campaigns + PDF upload
│   ├── api/
│   │   ├── generate-email/       # Claude generation → draft in email_logs
│   │   ├── send-email/           # Sends a draft through Resend
│   │   └── webhooks/resend/      # Delivery / open / bounce / complaint events
│   └── login/                    # Sign-in page
├── components/                   # Nav bar + shadcn/ui components
├── lib/
│   ├── supabase/                 # Browser and server Supabase clients
│   └── template.ts               # [variable] substitution for templates & subjects
├── proxy.ts                      # Auth guard: redirects to /login when signed out
└── types/                        # Shared TypeScript types
```

---

## Data model

See [supabase-schema.sql](supabase-schema.sql) for the full definitions.

- **`companies`**: prospects (name, contact email/name, website, industry, notes), plus `status` and `follow_up_at`.
- **`campaigns`**: `type` (`prompt` | `template`), `prompt_template` (the AI prompt or the template body), `subject_template`, and an optional `attachment_url` / `attachment_name`.
- **`email_logs`**: one row per draft or sent email: `generated_body`, `subject`, `status` (`draft` | `sent` | `failed` | `bounced` | `complained`), `resend_id`, and the timestamps `sent_at` / `delivered_at` / `opened_at`.

Deleting a company also deletes its email logs. Deleting a campaign keeps its logs and clears their `campaign_id`.
