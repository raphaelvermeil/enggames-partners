'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import type { Company, EmailLog, CompanyStatus } from '@/types'

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
  const router = useRouter()
  const supabase = createClient()

  const latestDraft = logs.find(l => l.status === 'draft')

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id }),
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
            <Button onClick={handleGenerate} disabled={generating} className="w-full">
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
          </CardContent>
        </Card>
      </div>

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
