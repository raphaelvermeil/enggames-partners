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
  const [adding, setAdding] = useState(false)
  const supabase = createClient()

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('campaigns').insert({
      name: form.name,
      prompt_template: form.prompt_template,
      user_id: user!.id,
    }).select().single()
    if (!error && data) {
      setCampaigns(prev => [data as Campaign, ...prev])
      setForm({ name: '', prompt_template: '' })
      setAddOpen(false)
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
          <DialogContent className="max-w-2xl">
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
                  className="min-h-[200px] font-mono text-sm"
                  required
                />
              </div>
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDelete(campaign.id)}
                  >
                    Delete
                  </Button>
                </div>
                <p className="text-xs text-gray-400">
                  Created {new Date(campaign.created_at).toLocaleDateString()}
                </p>
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
    </div>
  )
}
