import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import CompanyDetail from './company-detail'
import type { Company, EmailLog } from '@/types'

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: company }, { data: logs }] = await Promise.all([
    supabase.from('companies').select('*').eq('id', id).single(),
    supabase.from('email_logs').select('*').eq('company_id', id).order('created_at', { ascending: false }),
  ])

  if (!company) notFound()

  return <CompanyDetail company={company as Company} initialLogs={(logs ?? []) as EmailLog[]} />
}
