'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import type { Campaign, Company, CompanyStatus } from '@/types'

const STATUS_COLORS: Record<CompanyStatus, string> = {
  pending: 'bg-gray-100 text-gray-800',
  drafted: 'bg-blue-100 text-blue-800',
  sent: 'bg-green-100 text-green-800',
  replied: 'bg-purple-100 text-purple-800',
  rejected: 'bg-red-100 text-red-800',
}

const ALL_STATUSES: CompanyStatus[] = ['pending', 'drafted', 'sent', 'replied', 'rejected']

type BulkItemStatus = 'queued' | 'generating' | 'sending' | 'done' | 'failed'

interface BulkProgress {
  companyId: string
  name: string
  status: BulkItemStatus
  error?: string
}

interface Props {
  initialCompanies: Company[]
  campaigns: Campaign[]
}

export default function CompaniesClient({ initialCompanies, campaigns }: Props) {
  const [companies, setCompanies] = useState(initialCompanies)
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | 'all'>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', contact_email: '', website: '', industry: '', notes: '', contact_name: '' })
  const [adding, setAdding] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkProgress, setBulkProgress] = useState<BulkProgress[] | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const filtered = statusFilter === 'all' ? companies : companies.filter(c => c.status === statusFilter)
  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id))

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filtered.forEach(c => next.delete(c.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filtered.forEach(c => next.add(c.id))
        return next
      })
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('companies').insert({
      ...form,
      status: 'pending',
      user_id: user!.id,
    }).select().single()
    if (!error && data) {
      setCompanies(prev => [data as Company, ...prev])
      setForm({ name: '', contact_email: '', website: '', industry: '', notes: '', contact_name: '' })
      setAddOpen(false)
    }
    setAdding(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('companies').delete().eq('id', id)
    setCompanies(prev => prev.filter(c => c.id !== id))
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  async function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const { data: { user } } = await supabase.auth.getUser()
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[]
        const inserts = rows.map(row => ({
          name: row.name ?? row.Name ?? '',
          contact_email: row.email ?? row.contact_email ?? row.Email ?? '',
          website: row.website ?? row.Website ?? null,
          industry: row.industry ?? row.Industry ?? null,
          notes: row.notes ?? row.Notes ?? null,
          contact_name: row.contact_name ?? row.contact ?? row.Contact ?? null,
          status: 'pending' as CompanyStatus,
          user_id: user!.id,
        })).filter(r => r.name && r.contact_email)

        if (inserts.length === 0) return
        const { data } = await supabase.from('companies').insert(inserts).select()
        if (data) setCompanies(prev => [...(data as Company[]), ...prev])
        e.target.value = ''
      },
    })
  }

  function openCampaignPicker() {
    setSelectedCampaignId(null)
    setCampaignPickerOpen(true)
  }

  async function handleBulkSend(campaignId: string | null) {
    setCampaignPickerOpen(false)
    const campaign = campaigns.find(c => c.id === campaignId) ?? null
    const targets = companies.filter(c => selectedIds.has(c.id))
    const initial: BulkProgress[] = targets.map(c => ({ companyId: c.id, name: c.name, status: 'queued' }))
    setBulkProgress(initial)
    setBulkRunning(true)

    for (const company of targets) {
      // Generate
      setBulkProgress(prev => prev!.map(p => p.companyId === company.id ? { ...p, status: 'generating' } : p))
      let logId: string | null = null
      try {
        const genRes = await fetch('/api/generate-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: company.id,
            campaignId: campaign?.id ?? null,
            promptOverride: campaign?.prompt_template ?? null,
          }),
        })
        const genData = await genRes.json()
        if (!genData.log) throw new Error(genData.error ?? 'Generation failed')
        logId = genData.log.id
        setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, status: 'drafted' } : c))
      } catch (err) {
        setBulkProgress(prev => prev!.map(p => p.companyId === company.id ? { ...p, status: 'failed', error: String(err) } : p))
        continue
      }

      // Send
      setBulkProgress(prev => prev!.map(p => p.companyId === company.id ? { ...p, status: 'sending' } : p))
      try {
        const sendRes = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logId }),
        })
        const sendData = await sendRes.json()
        if (!sendData.success) throw new Error(sendData.error ?? 'Send failed')
        setBulkProgress(prev => prev!.map(p => p.companyId === company.id ? { ...p, status: 'done' } : p))
        setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, status: 'sent' } : c))
      } catch (err) {
        setBulkProgress(prev => prev!.map(p => p.companyId === company.id ? { ...p, status: 'failed', error: String(err) } : p))
      }
    }

    setBulkRunning(false)
    setSelectedIds(new Set())
  }

  const BULK_STATUS_LABELS: Record<BulkItemStatus, string> = {
    queued: 'Queued',
    generating: 'Generating...',
    sending: 'Sending...',
    done: 'Done',
    failed: 'Failed',
  }

  const BULK_STATUS_COLORS: Record<BulkItemStatus, string> = {
    queued: 'text-gray-400',
    generating: 'text-blue-600',
    sending: 'text-yellow-600',
    done: 'text-green-600',
    failed: 'text-red-600',
  }

  return (
    <div className="space-y-6">
      {/* Campaign picker dialog */}
      <Dialog open={campaignPickerOpen} onOpenChange={setCampaignPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose a Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <button
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${selectedCampaignId === null ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
              onClick={() => setSelectedCampaignId(null)}
            >
              <p className="font-medium">Default prompt</p>
              <p className="text-gray-500 text-xs mt-0.5">Generic EngGames sponsorship pitch</p>
            </button>
            {campaigns.map(campaign => (
              <button
                key={campaign.id}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${selectedCampaignId === campaign.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                onClick={() => setSelectedCampaignId(campaign.id)}
              >
                <p className="font-medium">{campaign.name}</p>
                <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{campaign.prompt_template}</p>
              </button>
            ))}
          </div>
          <Button className="w-full mt-2" onClick={() => handleBulkSend(selectedCampaignId)}>
            Start Bulk Send ({selectedIds.size})
          </Button>
        </DialogContent>
      </Dialog>

      {/* Bulk progress dialog */}
      {bulkProgress && (
        <Dialog open onOpenChange={() => { if (!bulkRunning) setBulkProgress(null) }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Bulk Generate & Send</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {bulkProgress.map(item => (
                <div key={item.companyId} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                  <span className="font-medium">{item.name}</span>
                  <div className="text-right">
                    <span className={`font-medium ${BULK_STATUS_COLORS[item.status]}`}>
                      {BULK_STATUS_LABELS[item.status]}
                    </span>
                    {item.error && <p className="text-xs text-red-500 mt-0.5">{item.error}</p>}
                  </div>
                </div>
              ))}
            </div>
            {!bulkRunning && (
              <Button className="w-full" onClick={() => setBulkProgress(null)}>Close</Button>
            )}
          </DialogContent>
        </Dialog>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-gray-500 mt-1">{companies.length} total</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button onClick={openCampaignPicker}>
              Bulk Send ({selectedIds.size})
            </Button>
          )}
          <label className="cursor-pointer inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground h-9">
            Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          </label>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button />}>
              Add Company
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Company</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email *</Label>
                  <Input type="email" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
                <Button type="submit" className="w-full" disabled={adding}>
                  {adding ? 'Adding...' : 'Add Company'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
        >
          All
        </Button>
        {ALL_STATUSES.map(s => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 w-8">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Company</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Contact</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Industry</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No companies found.
                </td>
              </tr>
            ) : (
              filtered.map(company => (
                <tr key={company.id} className={selectedIds.has(company.id) ? 'bg-blue-50' : ''}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(company.id)}
                      onChange={() => toggleSelect(company.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/companies/${company.id}`} className="font-medium hover:underline">
                      {company.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{company.contact_email}</td>
                  <td className="px-4 py-3 text-gray-600">{company.industry ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[company.status]}`}>
                      {company.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/companies/${company.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(company.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
