import { createClient } from '@/lib/supabase/server'
import CompaniesClient from './companies-client'
import type { Company, Campaign } from '@/types'

export default async function CompaniesPage() {
  const supabase = await createClient()
  const [{ data: companies }, { data: campaigns }, { data: openedLogs }] = await Promise.all([
    supabase.from('companies').select('*').order('created_at', { ascending: false }),
    supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
    supabase.from('email_logs').select('company_id').not('opened_at', 'is', null),
  ])
  const openedCompanyIds = new Set((openedLogs ?? []).map(l => l.company_id))

  return (
    <CompaniesClient
      initialCompanies={(companies ?? []) as Company[]}
      campaigns={(campaigns ?? []) as Campaign[]}
      openedCompanyIds={openedCompanyIds}
    />
  )
}
