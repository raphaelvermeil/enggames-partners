import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const payload = await req.json()

  if (payload.type !== 'email.opened') {
    return NextResponse.json({ received: true })
  }

  const resendId: string | undefined = payload.data?.email_id
  if (!resendId) return NextResponse.json({ received: true })

  await supabase
    .from('email_logs')
    .update({ opened_at: new Date().toISOString() })
    .eq('resend_id', resendId)
    .is('opened_at', null)

  return NextResponse.json({ received: true })
}
