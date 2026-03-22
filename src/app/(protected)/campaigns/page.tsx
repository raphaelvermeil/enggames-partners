import { createClient } from '@/lib/supabase/server'
import CampaignsClient from './campaigns-client'
import type { Campaign } from '@/types'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  return <CampaignsClient initialCampaigns={(data ?? []) as Campaign[]} />
}
