export type CompanyStatus = 'pending' | 'drafted' | 'sent' | 'replied' | 'rejected'
export type EmailLogStatus = 'draft' | 'sent' | 'failed'

export interface Company {
  id: string
  name: string
  website: string | null
  industry: string | null
  notes: string | null
  contact_email: string
  contact_name: string | null
  status: CompanyStatus
  follow_up_at: string | null
  created_at: string
  user_id: string
}

export interface Campaign {
  id: string
  name: string
  prompt_template: string
  created_at: string
  user_id: string
}

export interface EmailLog {
  id: string
  company_id: string
  campaign_id: string | null
  generated_body: string
  status: EmailLogStatus
  resend_id: string | null
  sent_at: string | null
  opened_at: string | null
  created_at: string
}
