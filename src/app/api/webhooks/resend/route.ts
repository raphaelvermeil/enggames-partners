import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Webhook } from 'svix'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type ResendEvent = {
  type: string
  data?: { email_id?: string }
}

// Mark the email log with the given status, and reflect it on the company —
// but only if the company is still 'sent', so we never clobber a manual
// 'replied'/'rejected' that a user set afterwards.
async function markLogAndCompany(resendId: string, status: 'bounced' | 'complained') {
  const { data: rows } = await supabase
    .from('email_logs')
    .update({ status })
    .eq('resend_id', resendId)
    .select('company_id')

  const companyId = rows?.[0]?.company_id
  if (companyId) {
    await supabase
      .from('companies')
      .update({ status })
      .eq('id', companyId)
      .eq('status', 'sent')
  }
}

export async function POST(req: NextRequest) {
  // Read the raw body — Svix signs the exact bytes, so we must not re-serialize.
  const rawBody = await req.text()

  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let payload: ResendEvent
  try {
    const wh = new Webhook(secret)
    payload = wh.verify(rawBody, {
      'svix-id': req.headers.get('svix-id') ?? '',
      'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
      'svix-signature': req.headers.get('svix-signature') ?? '',
    }) as ResendEvent
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const resendId = payload.data?.email_id
  if (!resendId) return NextResponse.json({ received: true })

  switch (payload.type) {
    case 'email.delivered':
      await supabase
        .from('email_logs')
        .update({ delivered_at: new Date().toISOString() })
        .eq('resend_id', resendId)
        .is('delivered_at', null)
      break

    case 'email.opened':
      await supabase
        .from('email_logs')
        .update({ opened_at: new Date().toISOString() })
        .eq('resend_id', resendId)
        .is('opened_at', null)
      break

    case 'email.bounced':
      await markLogAndCompany(resendId, 'bounced')
      break

    case 'email.complained':
      await markLogAndCompany(resendId, 'complained')
      break
  }

  return NextResponse.json({ received: true })
}
