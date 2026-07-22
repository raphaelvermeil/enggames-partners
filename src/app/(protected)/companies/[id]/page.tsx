import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import CompanyDetail from './company-detail'
import type { Company, EmailLog, Campaign } from '@/types'

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: company }, { data: logs }, { data: campaigns }] = await Promise.all([
    supabase.from('companies').select('*').eq('id', id).single(),
    supabase.from('email_logs').select('*').eq('company_id', id).order('created_at', { ascending: false }),
    supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
  ])

  if (!company) notFound()

  return (
    <CompanyDetail
      company={company as Company}
      initialLogs={(logs ?? []) as EmailLog[]}
      initialCampaigns={(campaigns ?? []) as Campaign[]}
    />
  )
}
