'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { TEMPLATE_VARIABLES } from '@/lib/template'
import type { Campaign, CampaignType } from '@/types'

interface Props {
  initialCampaigns: Campaign[]
}

type CampaignFormValues = {
  name: string
  type: CampaignType
  subject_template: string
  prompt_template: string
}

const EMPTY_FORM: CampaignFormValues = { name: '', type: 'prompt', subject_template: '', prompt_template: '' }

const VARS_HINT = TEMPLATE_VARIABLES.join('  ')

// Shared fields for both the New and Edit campaign dialogs.
function CampaignFields({ values, onChange }: {
  values: CampaignFormValues
  onChange: (patch: Partial<CampaignFormValues>) => void
}) {
  const isTemplate = values.type === 'template'
  return (
    <>
      <div className="space-y-2">
        <Label>Campaign Name *</Label>
        <Input
          value={values.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="e.g. Winter 2026 Tech Outreach"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Type</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ type: 'prompt' })}
            className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${values.type === 'prompt' ? 'bg-black text-white border-black' : 'border-gray-300 hover:border-gray-400'}`}
          >
            AI Prompt
          </button>
          <button
            type="button"
            onClick={() => onChange({ type: 'template' })}
            className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${values.type === 'template' ? 'bg-black text-white border-black' : 'border-gray-300 hover:border-gray-400'}`}
          >
            Fill-in Template
          </button>
        </div>
        <p className="text-xs text-gray-500">
          {isTemplate
            ? 'A ready-to-send email with [variables] filled from each company. No AI is used.'
            : 'A prompt for Claude to write a personalised email. Company context is appended automatically.'}
        </p>
      </div>

      <div className="space-y-2">
        <Label>Subject Line</Label>
        <p className="text-xs text-gray-500">
          Optional. Supports variables: {VARS_HINT}. Leave blank to use the default subject.
        </p>
        <Input
          value={values.subject_template}
          onChange={e => onChange({ subject_template: e.target.value })}
          placeholder="e.g. Sponsoring EngGames — [company]?"
        />
      </div>

      <div className="space-y-2">
        <Label>{isTemplate ? 'Email Body *' : 'Prompt Template *'}</Label>
        <p className="text-xs text-gray-500">
          {isTemplate
            ? <>Write the email exactly as it should be sent. Use variables: {VARS_HINT} — filled from each company&apos;s details.</>
            : 'Write the full prompt for Claude. Company context (name, industry, website, notes) will be appended automatically.'}
        </p>
        <Textarea
          value={values.prompt_template}
          onChange={e => onChange({ prompt_template: e.target.value })}
          placeholder={isTemplate
            ? 'Hi [contact],\n\nI’m reaching out on behalf of EngGames to see if [company] would be interested in sponsoring...'
            : 'You are writing a sponsorship pitch email on behalf of EngGames...'}
          className="min-h-[200px] max-h-[50vh] overflow-y-auto font-mono text-sm"
          required
        />
      </div>
    </>
  )
}

export default function CampaignsClient({ initialCampaigns }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<CampaignFormValues>(EMPTY_FORM)
  const [file, setFile] = useState<File | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [editForm, setEditForm] = useState<CampaignFormValues>(EMPTY_FORM)
  const [editFile, setEditFile] = useState<File | null>(null)
  const [removeAttachment, setRemoveAttachment] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const supabase = createClient()

  // Derive the storage object path from a public attachment URL so we can delete it.
  function storagePathFromUrl(url: string): string | null {
    const marker = '/campaign-attachments/'
    const idx = url.indexOf(marker)
    return idx === -1 ? null : url.slice(idx + marker.length)
  }

  async function uploadPdf(pdf: File): Promise<{ url: string; name: string }> {
    const { data: { user } } = await supabase.auth.getUser()
    const path = `${user!.id}/${crypto.randomUUID()}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('campaign-attachments')
      .upload(path, pdf, { contentType: 'application/pdf' })
    if (uploadError) throw new Error(uploadError.message)
    const url = supabase.storage.from('campaign-attachments').getPublicUrl(path).data.publicUrl
    return { url, name: pdf.name }
  }

  function openEdit(campaign: Campaign) {
    setEditing(campaign)
    setEditForm({
      name: campaign.name,
      type: campaign.type,
      subject_template: campaign.subject_template ?? '',
      prompt_template: campaign.prompt_template,
    })
    setEditFile(null)
    setRemoveAttachment(false)
    setEditError(null)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()

    let attachment_url: string | null = null
    let attachment_name: string | null = null
    if (file) {
      try {
        const uploaded = await uploadPdf(file)
        attachment_url = uploaded.url
        attachment_name = uploaded.name
      } catch (err) {
        setError(`Attachment upload failed: ${(err as Error).message}`)
        setAdding(false)
        return
      }
    }

    const { data, error: insertError } = await supabase.from('campaigns').insert({
      name: form.name,
      type: form.type,
      subject_template: form.subject_template.trim() || null,
      prompt_template: form.prompt_template,
      attachment_url,
      attachment_name,
      user_id: user!.id,
    }).select().single()
    if (!insertError && data) {
      setCampaigns(prev => [data as Campaign, ...prev])
      setForm(EMPTY_FORM)
      setFile(null)
      setAddOpen(false)
    } else if (insertError) {
      setError(insertError.message)
    }
    setAdding(false)
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setEditSaving(true)
    setEditError(null)

    let attachment_url = editing.attachment_url
    let attachment_name = editing.attachment_name

    async function deleteOld() {
      if (editing!.attachment_url) {
        const oldPath = storagePathFromUrl(editing!.attachment_url)
        if (oldPath) await supabase.storage.from('campaign-attachments').remove([oldPath])
      }
    }

    if (editFile) {
      try {
        const uploaded = await uploadPdf(editFile)
        await deleteOld()
        attachment_url = uploaded.url
        attachment_name = uploaded.name
      } catch (err) {
        setEditError(`Attachment upload failed: ${(err as Error).message}`)
        setEditSaving(false)
        return
      }
    } else if (removeAttachment) {
      await deleteOld()
      attachment_url = null
      attachment_name = null
    }

    const { data, error: updateError } = await supabase.from('campaigns').update({
      name: editForm.name,
      type: editForm.type,
      subject_template: editForm.subject_template.trim() || null,
      prompt_template: editForm.prompt_template,
      attachment_url,
      attachment_name,
    }).eq('id', editing.id).select().single()

    if (!updateError && data) {
      setCampaigns(prev => prev.map(c => c.id === editing.id ? (data as Campaign) : c))
      setEditing(null)
    } else if (updateError) {
      setEditError(updateError.message)
    }
    setEditSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('campaigns').delete().eq('id', id)
    setCampaigns(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-gray-500 mt-1">Reusable AI prompts or fill-in email templates</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger render={<Button />}>
            New Campaign
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Campaign</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <CampaignFields values={form} onChange={patch => setForm(p => ({ ...p, ...patch }))} />
              <div className="space-y-2">
                <Label>PDF Attachment</Label>
                <p className="text-xs text-gray-500">
                  Optional. This PDF will be attached to every email generated from this campaign.
                </p>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={adding}>
                {adding ? 'Creating...' : 'Create Campaign'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white rounded-lg border px-4 py-12 text-center text-gray-500">
          No campaigns yet. Create one to use as a reusable prompt or email template.
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map(campaign => (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{campaign.name}</CardTitle>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${campaign.type === 'template' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                      {campaign.type === 'template' ? 'Template' : 'AI Prompt'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(campaign)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(campaign.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Created {new Date(campaign.created_at).toLocaleDateString()}
                </p>
                {campaign.subject_template && (
                  <p className="text-xs text-gray-500">
                    Subject: {campaign.subject_template}
                  </p>
                )}
                {campaign.attachment_name && (
                  <p className="text-xs text-gray-500">
                    📎 <a href={campaign.attachment_url!} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">
                      {campaign.attachment_name}
                    </a>
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-mono bg-gray-50 rounded p-3">
                  {campaign.prompt_template}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={o => { if (!o) setEditing(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4">
            <CampaignFields values={editForm} onChange={patch => setEditForm(p => ({ ...p, ...patch }))} />
            <div className="space-y-2">
              <Label>PDF Attachment</Label>
              {editing?.attachment_name && !editFile && !removeAttachment && (
                <p className="text-xs text-gray-500">
                  📎 Current: {editing.attachment_name}
                  <button
                    type="button"
                    onClick={() => setRemoveAttachment(true)}
                    className="ml-2 text-red-600 underline hover:text-red-700"
                  >
                    Remove
                  </button>
                </p>
              )}
              {removeAttachment && !editFile && (
                <p className="text-xs text-gray-500">
                  Attachment will be removed.
                  <button
                    type="button"
                    onClick={() => setRemoveAttachment(false)}
                    className="ml-2 underline hover:text-gray-700"
                  >
                    Undo
                  </button>
                </p>
              )}
              <p className="text-xs text-gray-500">
                {editing?.attachment_name ? 'Upload a new PDF to replace the current one.' : 'Optional. Attached to every email generated from this campaign.'}
              </p>
              <Input
                type="file"
                accept="application/pdf"
                onChange={e => setEditFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {editError && <p className="text-sm text-red-500">{editError}</p>}
            <Button type="submit" className="w-full" disabled={editSaving}>
              {editSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
