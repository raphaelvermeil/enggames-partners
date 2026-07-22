export type CompanyStatus = 'pending' | 'drafted' | 'sent' | 'replied' | 'rejected' | 'bounced' | 'complained'
export type CampaignType = 'prompt' | 'template'
export type EmailLogStatus = 'draft' | 'sent' | 'failed' | 'bounced' | 'complained'

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
  type: CampaignType
  // For type='prompt' this is the AI prompt; for type='template' the literal email body with [variables].
  prompt_template: string
  subject_template: string | null
  attachment_url: string | null
  attachment_name: string | null
  created_at: string
  user_id: string
}

export interface EmailLog {
  id: string
  company_id: string
  campaign_id: string | null
  generated_body: string
  subject: string | null
  status: EmailLogStatus
  resend_id: string | null
  sent_at: string | null
  delivered_at: string | null
  opened_at: string | null
  created_at: string
}
