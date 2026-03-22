'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import type { Campaign, Company, EmailLog, CompanyStatus } from '@/types'

const TONES = {
  Professional: (context: string) =>
    `You are writing a sponsorship pitch email on behalf of EngGames, a university-level engineering competition. Write a personalised, professional sponsorship pitch email to the following company. The email should explain what EngGames is, why sponsoring it would benefit them, and include a clear call to action. Be concise (under 300 words) and genuine.\n\n${context}\n\nWrite only the email body (no subject line). Start with a greeting.`,
  Friendly: (context: string) =>
    `You are writing a sponsorship pitch email on behalf of EngGames, a university-level engineering competition. Write a warm, conversational, and approachable sponsorship pitch email to the following company. Use a friendly tone while staying professional. Explain what EngGames is, why this partnership would be exciting, and end with an inviting call to action. Keep it under 300 words.\n\n${context}\n\nWrite only the email body (no subject line). Start with a friendly greeting.`,
  Concise: (context: string) =>
    `You are writing a sponsorship pitch email on behalf of EngGames, a university-level engineering competition. Write a brief, to-the-point sponsorship pitch email. No fluff — just what EngGames is, the value for the sponsor, and a clear next step. Under 150 words.\n\n${context}\n\nWrite only the email body (no subject line). Start with a greeting.`,
  Bold: (context: string) =>
    `You are writing a sponsorship pitch email on behalf of EngGames, a university-level engineering competition. Write a bold, confident sponsorship pitch email that leads with impact. Make it stand out — show ambition, highlight the unique opportunity, and drive urgency in the call to action. Under 300 words.\n\n${context}\n\nWrite only the email body (no subject line). Start with a greeting.`,
}

function buildContext(company: Company): string {
  return [
    `Company name: ${company.name}`,
    company.industry ? `Industry: ${company.industry}` : null,
    company.website ? `Website: ${company.website}` : null,
    company.contact_name ? `Contact person: ${company.contact_name}` : null,
    company.notes ? `Notes: ${company.notes}` : null,
  ].filter(Boolean).join('\n')
}

const STATUS_COLORS: Record<CompanyStatus, string> = {
  pending: 'bg-gray-100 text-gray-800',
  drafted: 'bg-blue-100 text-blue-800',
  sent: 'bg-green-100 text-green-800',
  replied: 'bg-purple-100 text-purple-800',
  rejected: 'bg-red-100 text-red-800',
}

interface Props {
  company: Company
  initialLogs: EmailLog[]
}

export default function CompanyDetail({ company, initialLogs }: Props) {
  const [logs, setLogs] = useState(initialLogs)
  const [currentCompany, setCurrentCompany] = useState(company)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [editingLog, setEditingLog] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [showPromptDialog, setShowPromptDialog] = useState(false)
  const [promptText, setPromptText] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const latestDraft = logs.find(l => l.status === 'draft')

  async function openPromptDialog() {
    setPromptText(TONES.Professional(buildContext(currentCompany)))
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false })
    setCampaigns((data ?? []) as Campaign[])
    setShowPromptDialog(true)
  }

  async function handleGenerate() {
    setShowPromptDialog(false)
    setGenerating(true)
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id, promptOverride: promptText, campaignId: selectedCampaignId }),
      })
      const data = await res.json()
      if (data.log) {
        setLogs(prev => [data.log as EmailLog, ...prev])
        setCurrentCompany(prev => ({ ...prev, status: 'drafted' }))
      }
    } finally {
      setGenerating(false)
    }
  }

  async function handleSend(log: EmailLog) {
    setSending(log.id)
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId: log.id }),
      })
      const data = await res.json()
      if (data.success) {
        setLogs(prev => prev.map(l => l.id === log.id ? { ...l, status: 'sent', sent_at: new Date().toISOString() } : l))
        setCurrentCompany(prev => ({ ...prev, status: 'sent' }))
      } else {
        alert(data.error ?? 'Failed to send email')
      }
    } finally {
      setSending(null)
    }
  }

  async function handleMarkReplied() {
    await supabase.from('companies').update({ status: 'replied' }).eq('id', company.id)
    setCurrentCompany(prev => ({ ...prev, status: 'replied' }))
  }

  async function handleScheduleFollowUp(date: string) {
    await supabase.from('companies').update({ follow_up_at: date }).eq('id', company.id)
    setCurrentCompany(prev => ({ ...prev, follow_up_at: date }))
  }

  async function handleClearFollowUp() {
    await supabase.from('companies').update({ follow_up_at: null }).eq('id', company.id)
    setCurrentCompany(prev => ({ ...prev, follow_up_at: null }))
  }

  async function handleSaveEdit(logId: string) {
    await supabase.from('email_logs').update({ generated_body: editContent }).eq('id', logId)
    setLogs(prev => prev.map(l => l.id === logId ? { ...l, generated_body: editContent } : l))
    setEditingLog(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-black mb-2 block">
            &larr; Back
          </button>
          <h1 className="text-2xl font-bold">{currentCompany.name}</h1>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[currentCompany.status]}`}>
          {currentCompany.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Company Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-gray-500">Email:</span> {currentCompany.contact_email}</div>
            {currentCompany.contact_name && <div><span className="text-gray-500">Contact:</span> {currentCompany.contact_name}</div>}
            {currentCompany.website && <div><span className="text-gray-500">Website:</span> <a href={currentCompany.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{currentCompany.website}</a></div>}
            {currentCompany.industry && <div><span className="text-gray-500">Industry:</span> {currentCompany.industry}</div>}
            {currentCompany.notes && <div><span className="text-gray-500">Notes:</span> {currentCompany.notes}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={openPromptDialog} disabled={generating} className="w-full">
              {generating ? 'Generating...' : latestDraft ? 'Regenerate Email' : 'Generate Email'}
            </Button>
            {latestDraft && (
              <Button
                onClick={() => handleSend(latestDraft)}
                disabled={sending === latestDraft.id}
                variant="outline"
                className="w-full"
              >
                {sending === latestDraft.id ? 'Sending...' : 'Send Draft Email'}
              </Button>
            )}
            {currentCompany.status === 'sent' && (
              <Button variant="outline" className="w-full" onClick={handleMarkReplied}>
                Mark as Replied
              </Button>
            )}
            {(currentCompany.status === 'sent' || currentCompany.status === 'drafted') && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500">
                  {currentCompany.follow_up_at
                    ? `Follow-up: ${new Date(currentCompany.follow_up_at).toLocaleDateString()}`
                    : 'Schedule follow-up'}
                </p>
                <div className="flex gap-2">
                  <input
                    type="date"
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    defaultValue={currentCompany.follow_up_at?.slice(0, 10) ?? ''}
                    onChange={e => e.target.value && handleScheduleFollowUp(e.target.value)}
                  />
                  {currentCompany.follow_up_at && (
                    <Button variant="outline" size="sm" onClick={handleClearFollowUp}>Clear</Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showPromptDialog} onOpenChange={setShowPromptDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Prompt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {campaigns.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500">Campaign</p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => { setSelectedCampaignId(null); setPromptText(TONES.Professional(buildContext(currentCompany))) }}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${selectedCampaignId === null ? 'bg-black text-white border-black' : 'border-gray-300 hover:border-gray-400'}`}
                  >
                    None
                  </button>
                  {campaigns.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedCampaignId(c.id); setPromptText(`${c.prompt_template}\n\n${buildContext(currentCompany)}\n\nWrite only the email body (no subject line). Start with a greeting.`) }}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${selectedCampaignId === c.id ? 'bg-black text-white border-black' : 'border-gray-300 hover:border-gray-400'}`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(TONES) as (keyof typeof TONES)[]).map(tone => (
                <Button
                  key={tone}
                  size="sm"
                  variant="outline"
                  onClick={() => setPromptText(TONES[tone](buildContext(currentCompany)))}
                >
                  {tone}
                </Button>
              ))}
            </div>
            <Textarea
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPromptDialog(false)}>Cancel</Button>
              <Button onClick={handleGenerate}>Generate</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {logs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Email History</h2>
          {logs.map(log => (
            <Card key={log.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {log.status === 'draft' ? 'Draft' : log.status === 'sent' ? 'Sent' : 'Failed'}
                  </CardTitle>
                  <div className="flex gap-2 items-center">
                    {log.status === 'draft' && (
                      <>
                        {editingLog === log.id ? (
                          <>
                            <Button size="sm" onClick={() => handleSaveEdit(log.id)}>Save</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingLog(null)}>Cancel</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => { setEditingLog(log.id); setEditContent(log.generated_body) }}>
                            Edit
                          </Button>
                        )}
                        <Button size="sm" onClick={() => handleSend(log)} disabled={sending === log.id}>
                          {sending === log.id ? 'Sending...' : 'Send'}
                        </Button>
                      </>
                    )}
                    {log.sent_at && (
                      <span className="text-xs text-gray-500">
                        Sent {new Date(log.sent_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {editingLog === log.id ? (
                  <Textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed">{log.generated_body}</pre>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
