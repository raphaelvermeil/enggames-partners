# EnGames Partners — Sponsorship Email Automation Platform

## Project Overview

A web platform for the EnGames engineering competition organising team to automate outreach to potential sponsors. The platform allows the team to manage a list of companies, generate personalised sponsorship pitch emails using AI, send them in bulk, and track the status of each outreach.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 15 (App Router) | UI and server-side logic |
| Database + Auth | Supabase | Postgres database, authentication, realtime |
| AI | Claude API (Anthropic SDK) | Personalised email generation |
| Email Sending | Resend | Transactional email delivery |
| Styling | Tailwind CSS + shadcn/ui | Fast, clean component library |

---

## Database Schema

### `companies`
| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `name` | text | Company name |
| `website` | text | Company website URL |
| `industry` | text | Industry/sector |
| `notes` | text | Manual notes about the company |
| `contact_email` | text | Email address to send to |
| `contact_name` | text | Name of the contact person |
| `status` | enum | `pending`, `drafted`, `sent`, `replied`, `rejected` |
| `created_at` | timestamp | Creation date |
| `user_id` | uuid | FK to auth.users |

### `campaigns`
| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `name` | text | Campaign name (e.g. "Winter 2026 Outreach") |
| `prompt_template` | text | Base prompt/context sent to AI for this campaign |
| `created_at` | timestamp | Creation date |
| `user_id` | uuid | FK to auth.users |

### `email_logs`
| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `company_id` | uuid | FK to companies |
| `campaign_id` | uuid | FK to campaigns |
| `generated_body` | text | AI-generated email content |
| `status` | enum | `draft`, `sent`, `failed` |
| `sent_at` | timestamp | When the email was sent |
| `created_at` | timestamp | Creation date |

---

## MVP — Phase 1

The goal of the MVP is to deliver end-to-end value: import companies, generate AI emails, review them, send them, and see their status.

### Features

#### 1. Authentication
- Email/password login via Supabase Auth
- Protected routes — all pages require login
- Simple login/logout flow (no signup, team uses shared credentials or invites)

#### 2. Companies List
- View all companies in a table with name, email, status badge
- Add a company manually (name, email, website, notes)
- CSV import — upload a spreadsheet of companies in bulk
- Delete a company

#### 3. AI Email Generation
- Select a company and click "Generate Email"
- Claude API uses company name, website, industry, and notes as context
- Generates a personalised sponsorship pitch email
- Result is saved as a `draft` in `email_logs`

#### 4. Review & Edit Draft
- View the generated email before sending
- Editable text area to tweak the content
- Option to regenerate with a different tone

#### 5. Send Email
- Send the reviewed email via Resend
- Company status updates to `sent`
- Log entry records `sent_at`

#### 6. Status Dashboard
- Overview table showing each company and their current status
- Filter by status (pending, drafted, sent, replied, rejected)
- Basic stats: total companies, total sent, pending count

---

## Phase 2 — Enhanced Features

- **Bulk send**: Select multiple companies, generate + send all emails in one action with a progress indicator
- **Campaigns**: Create reusable campaigns with a shared prompt/context (e.g. different pitches for tech vs. finance companies)
- **Email open tracking**: Use Resend webhooks to detect when an email is opened
- **Reply tracking**: Mark companies as `replied` manually or via webhook
- **Follow-up emails**: Schedule a follow-up for companies that haven't replied after X days

---

## Phase 3 — Advanced Features

- **Auto website scraping**: Fetch and parse a company's website to extract context (what they do, their values, recent news) and feed it to Claude for richer personalisation
- **Contact discovery**: Given a company website, attempt to find a sponsorship or partnerships contact email
- **Analytics dashboard**: Charts showing outreach performance over time (sent, reply rate, conversion)
- **Multi-user support**: Team members each have their own login, with shared company data

---

## Key User Flows

### Onboarding a batch of companies
1. Login → Companies page
2. Click "Import CSV" → upload spreadsheet with columns: name, email, website, industry, notes
3. Companies appear in the list with status `pending`

### Generating and sending an email
1. Click a company → Company detail page
2. Click "Generate Email" → Claude drafts a personalised pitch
3. Review and optionally edit the draft
4. Click "Send" → email delivered via Resend, status updated to `sent`

### Bulk outreach
1. Select multiple companies from the list
2. Click "Bulk Generate & Send"
3. Review a summary of what will be sent
4. Confirm → emails sent in sequence with live progress

---

## Environment Variables Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Resend
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Development Phases & Order of Work

1. Supabase schema setup (tables, RLS policies, auth)
2. Next.js project setup (Tailwind, shadcn/ui, Supabase client)
3. Auth flow (login page, session handling, protected routes)
4. Companies CRUD (list, add, import CSV, delete)
5. AI email generation (Claude API integration, prompt design)
6. Email sending (Resend integration)
7. Status tracking and dashboard
8. Bulk send
9. Campaigns system
10. Website scraping and contact discovery
