'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import type { Campaign } from '@/types'

interface Props {
  initialCampaigns: Campaign[]
}

export default function CampaignsClient({ initialCampaigns }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', prompt_template: '' })
  const [file, setFile] = useState<File | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [editForm, setEditForm] = useState({ name: '', prompt_template: '' })
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

  function openEdit(campaign: Campaign) {
    setEditing(campaign)
    setEditForm({ name: campaign.name, prompt_template: campaign.prompt_template })
    setEditFile(null)
    setRemoveAttachment(false)
    setEditError(null)
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setEditSaving(true)
    setEditError(null)
    const { data: { user } } = await supabase.auth.getUser()

    let attachment_url = editing.attachment_url
    let attachment_name = editing.attachment_name

    async function deleteOld() {
      if (editing!.attachment_url) {
        const oldPath = storagePathFromUrl(editing!.attachment_url)
        if (oldPath) await supabase.storage.from('campaign-attachments').remove([oldPath])
      }
    }

    if (editFile) {
      const path = `${user!.id}/${crypto.randomUUID()}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('campaign-attachments')
        .upload(path, editFile, { contentType: 'application/pdf' })
      if (uploadError) {
        setEditError(`Attachment upload failed: ${uploadError.message}`)
        setEditSaving(false)
        return
      }
      await deleteOld()
      attachment_url = supabase.storage.from('campaign-attachments').getPublicUrl(path).data.publicUrl
      attachment_name = editFile.name
    } else if (removeAttachment) {
      await deleteOld()
      attachment_url = null
      attachment_name = null
    }

    const { data, error: updateError } = await supabase.from('campaigns').update({
      name: editForm.name,
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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()

    let attachment_url: string | null = null
    let attachment_name: string | null = null
    if (file) {
      const path = `${user!.id}/${crypto.randomUUID()}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('campaign-attachments')
        .upload(path, file, { contentType: 'application/pdf' })
      if (uploadError) {
        setError(`Attachment upload failed: ${uploadError.message}`)
        setAdding(false)
        return
      }
      attachment_url = supabase.storage.from('campaign-attachments').getPublicUrl(path).data.publicUrl
      attachment_name = file.name
    }

    const { data, error: insertError } = await supabase.from('campaigns').insert({
      name: form.name,
      prompt_template: form.prompt_template,
      attachment_url,
      attachment_name,
      user_id: user!.id,
    }).select().single()
    if (!insertError && data) {
      setCampaigns(prev => [data as Campaign, ...prev])
      setForm({ name: '', prompt_template: '' })
      setFile(null)
      setAddOpen(false)
    } else if (insertError) {
      setError(insertError.message)
    }
    setAdding(false)
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
          <p className="text-gray-500 mt-1">Reusable prompt templates for email generation</p>
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
              <div className="space-y-2">
                <Label>Campaign Name *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Winter 2026 Tech Outreach"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Prompt Template *</Label>
                <p className="text-xs text-gray-500">
                  Write the full prompt for Claude. Company context (name, industry, website, notes) will be appended automatically.
                </p>
                <Textarea
                  value={form.prompt_template}
                  onChange={e => setForm(p => ({ ...p, prompt_template: e.target.value }))}
                  placeholder="You are writing a sponsorship pitch email on behalf of EngGames..."
                  className="min-h-[200px] max-h-[50vh] overflow-y-auto font-mono text-sm"
                  required
                />
              </div>
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
          No campaigns yet. Create one to use as a reusable prompt template.
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map(campaign => (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{campaign.name}</CardTitle>
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
            <div className="space-y-2">
              <Label>Campaign Name *</Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Prompt Template *</Label>
              <Textarea
                value={editForm.prompt_template}
                onChange={e => setEditForm(p => ({ ...p, prompt_template: e.target.value }))}
                className="min-h-[200px] max-h-[50vh] overflow-y-auto font-mono text-sm"
                required
              />
            </div>
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
