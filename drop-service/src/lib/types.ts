export type RequestUrgency = 'low' | 'normal' | 'urgent'
export type RequestStatus = 'new' | 'contacted' | 'quote_sent' | 'won' | 'lost'

export interface Artisan {
  id: string
  user_id: string
  company_name: string
  slug: string
  activity: string
  service_area: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CustomerRequest {
  id: string
  artisan_id: string
  customer_name: string
  phone: string
  email: string | null
  city: string
  category: string
  description: string
  urgency: RequestUrgency
  availability: string | null
  status: RequestStatus
  created_at: string
  updated_at: string
}
