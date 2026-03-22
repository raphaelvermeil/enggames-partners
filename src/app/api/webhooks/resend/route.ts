import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Resend sends a svix-signature header for webhook verification.
// Set RESEND_WEBHOOK_SECRET in your environment variables (from Resend dashboard).
export async function POST(req: NextRequest) {
  const payload = await req.json()

  // Only handle email.opened events
  if (payload.type !== 'email.opened') {
    return NextResponse.json({ received: true })
  }

  const resendId: string | undefined = payload.data?.email_id
  if (!resendId) return NextResponse.json({ received: true })

  const supabase = await createClient()
  await supabase
    .from('email_logs')
    .update({ opened_at: new Date().toISOString() })
    .eq('resend_id', resendId)
    .is('opened_at', null) // only set once

  return NextResponse.json({ received: true })
}
