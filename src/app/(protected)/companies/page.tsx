import { createClient } from '@/lib/supabase/server'
import CompaniesClient from './companies-client'
import type { Company, Campaign } from '@/types'

export default async function CompaniesPage() {
  const supabase = await createClient()
  const [{ data: companies }, { data: campaigns }] = await Promise.all([
    supabase.from('companies').select('*').order('created_at', { ascending: false }),
    supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
  ])

  return (
    <CompaniesClient
      initialCompanies={(companies ?? []) as Company[]}
      campaigns={(campaigns ?? []) as Campaign[]}
    />
  )
}
