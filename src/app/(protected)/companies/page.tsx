import { createClient } from '@/lib/supabase/server'
import CompaniesClient from './companies-client'
import type { Company } from '@/types'

export default async function CompaniesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false })

  return <CompaniesClient initialCompanies={(data ?? []) as Company[]} />
}
