import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { companyId, promptOverride, campaignId } = await req.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: company } = await supabase.from('companies').select('*').eq('id', companyId).single()
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const context = [
    `Company name: ${company.name}`,
    company.industry ? `Industry: ${company.industry}` : null,
    company.website ? `Website: ${company.website}` : null,
    company.contact_name ? `Contact person: ${company.contact_name}` : null,
    company.notes ? `Notes: ${company.notes}` : null,
  ].filter(Boolean).join('\n')

  const userMessage = promptOverride ?? `You are writing a sponsorship pitch email on behalf of EngGames, a university-level engineering competition. Write a personalised, professional sponsorship pitch email to the following company. The email should explain what EngGames is, why sponsoring it would benefit them, and include a clear call to action. Be concise (under 300 words) and genuine.

${context}

Write only the email body (no subject line). Start with a greeting.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: userMessage }],
  })

  const body = message.content[0].type === 'text' ? message.content[0].text : ''

  const { data: log } = await supabase.from('email_logs').insert({
    company_id: companyId,
    campaign_id: campaignId ?? null,
    generated_body: body,
    status: 'draft',
  }).select().single()

  await supabase.from('companies').update({ status: 'drafted' }).eq('id', companyId)

  return NextResponse.json({ log })
}
