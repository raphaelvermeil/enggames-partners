import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Company, CompanyStatus } from '@/types'

const STATUS_COLORS: Record<CompanyStatus, string> = {
  pending: 'bg-gray-100 text-gray-800',
  drafted: 'bg-blue-100 text-blue-800',
  sent: 'bg-green-100 text-green-800',
  replied: 'bg-purple-100 text-purple-800',
  rejected: 'bg-red-100 text-red-800',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const [{ data: companies }, { data: openedLogs }] = await Promise.all([
    supabase.from('companies').select('*').order('created_at', { ascending: false }),
    supabase.from('email_logs').select('company_id').not('opened_at', 'is', null),
  ])
  const openedCompanyIds = new Set((openedLogs ?? []).map(l => l.company_id))

  const all = (companies ?? []) as Company[]
  const now = new Date()
  const dueForFollowUp = all.filter(c => c.follow_up_at && new Date(c.follow_up_at) <= now && c.status !== 'replied' && c.status !== 'rejected')
  const counts = {
    total: all.length,
    pending: all.filter(c => c.status === 'pending').length,
    drafted: all.filter(c => c.status === 'drafted').length,
    sent: all.filter(c => c.status === 'sent').length,
    replied: all.filter(c => c.status === 'replied').length,
    rejected: all.filter(c => c.status === 'rejected').length,
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500 mt-1">Outreach overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {(['total', 'pending', 'drafted', 'sent', 'replied'] as const).map(key => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 capitalize">{key}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{counts[key]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {dueForFollowUp.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Due for Follow-up</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-amber-100 border-b border-amber-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-amber-900">Company</th>
                  <th className="text-left px-4 py-3 font-medium text-amber-900">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-amber-900">Follow-up Date</th>
                  <th className="text-left px-4 py-3 font-medium text-amber-900">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-amber-900">Opened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {dueForFollowUp.map(company => (
                  <tr key={company.id}>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/companies/${company.id}`} className="hover:underline text-amber-900">
                        {company.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-amber-800">{company.contact_email}</td>
                    <td className="px-4 py-3 text-amber-800">{new Date(company.follow_up_at!).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[company.status]}`}>
                        {company.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {openedCompanyIds.has(company.id) && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Opened
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Companies</h2>
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Industry</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Opened</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {all.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No companies yet. Go to Companies to add some.
                  </td>
                </tr>
              ) : (
                all.slice(0, 10).map(company => (
                  <tr key={company.id}>
                    <td className="px-4 py-3 font-medium">{company.name}</td>
                    <td className="px-4 py-3 text-gray-600">{company.contact_email}</td>
                    <td className="px-4 py-3 text-gray-600">{company.industry ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[company.status]}`}>
                        {company.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {openedCompanyIds.has(company.id) && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Opened
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
