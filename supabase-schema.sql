-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Companies table
create type company_status as enum ('pending', 'drafted', 'sent', 'replied', 'rejected');

create table companies (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  website text,
  industry text,
  notes text,
  contact_email text not null,
  contact_name text,
  status company_status not null default 'pending',
  follow_up_at timestamptz,
  created_at timestamptz default now(),
  user_id uuid references auth.users not null
);

alter table companies enable row level security;
create policy "Users can manage their own companies"
  on companies for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Campaigns table
create table campaigns (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  prompt_template text not null,
  created_at timestamptz default now(),
  user_id uuid references auth.users not null
);

alter table campaigns enable row level security;
create policy "Users can manage their own campaigns"
  on campaigns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Email logs table
create type email_log_status as enum ('draft', 'sent', 'failed');

create table email_logs (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies on delete cascade not null,
  campaign_id uuid references campaigns on delete set null,
  generated_body text not null,
  status email_log_status not null default 'draft',
  resend_id text,
  sent_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz default now()
);

alter table email_logs enable row level security;
create policy "Users can manage email logs for their companies"
  on email_logs for all
  using (
    exists (
      select 1 from companies
      where companies.id = email_logs.company_id
      and companies.user_id = auth.uid()
    )
  );
