import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { logId } = await req.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: log } = await supabase.from('email_logs').select('*, companies(*)').eq('id', logId).single()
  if (!log) return NextResponse.json({ error: 'Log not found' }, { status: 404 })

  const company = log.companies as { name: string; contact_email: string; contact_name: string | null }

  try {
    const { data: sent } = await resend.emails.send({
      from: 'EngGames Partners <onboarding@resend.dev>',
      to: company.contact_email,
      subject: `Sponsorship Opportunity — EngGames Engineering Competition`,
      text: log.generated_body,
    })

    const now = new Date().toISOString()
    await supabase.from('email_logs').update({ status: 'sent', sent_at: now, resend_id: sent?.id ?? null }).eq('id', logId)
    await supabase.from('companies').update({ status: 'sent' }).eq('id', log.company_id)

    return NextResponse.json({ success: true })
  } catch (error) {
    await supabase.from('email_logs').update({ status: 'failed' }).eq('id', logId)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
