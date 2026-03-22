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
import type { Company, CompanyStatus } from '@/types'

const STATUS_COLORS: Record<CompanyStatus, string> = {
  pending: 'bg-gray-100 text-gray-800',
  drafted: 'bg-blue-100 text-blue-800',
  sent: 'bg-green-100 text-green-800',
  replied: 'bg-purple-100 text-purple-800',
  rejected: 'bg-red-100 text-red-800',
}

const ALL_STATUSES: CompanyStatus[] = ['pending', 'drafted', 'sent', 'replied', 'rejected']

interface Props {
  initialCompanies: Company[]
}

export default function CompaniesClient({ initialCompanies }: Props) {
  const [companies, setCompanies] = useState(initialCompanies)
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | 'all'>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', contact_email: '', website: '', industry: '', notes: '', contact_name: '' })
  const [adding, setAdding] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const filtered = statusFilter === 'all' ? companies : companies.filter(c => c.status === statusFilter)

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-gray-500 mt-1">{companies.length} total</p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <Button variant="outline" asChild>
              <span>Import CSV</span>
            </Button>
            <input type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          </label>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>Add Company</Button>
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
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No companies found.
                </td>
              </tr>
            ) : (
              filtered.map(company => (
                <tr key={company.id}>
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
