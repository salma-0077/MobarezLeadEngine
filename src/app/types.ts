// MongoDB Document Types for LeadEngine CRM

export interface UserPermissions {
  leads: boolean;
  calls: boolean;
  reports: boolean;
  analytics: boolean;
  settings: boolean;
  users: boolean;
  import_data: boolean;
  auto_dial: boolean;
  calendar: boolean;
  templates: boolean;
  data_collection: boolean;
}

export const defaultPermissions: UserPermissions = {
  leads: true,
  calls: true,
  reports: false,
  analytics: false,
  settings: false,
  users: false,
  import_data: false,
  auto_dial: true,
  calendar: true,
  templates: false,
  data_collection: false,
};

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'sales' | 'manager';
  phone?: string;
  isActive: boolean;
  permissions: UserPermissions;
  createdAt: string;
}

export interface Lead {
  _id: string;
  company_name: string;
  phone: string;
  email?: string;
  website?: string;
  search_link?: string;
  industry: string;
  city: string;
  source: 'gmaps' | 'phantombuster' | 'manual' | 'linkedin';
  status: 'new' | 'contacted' | 'followup' | 'meeting' | 'closed' | 'lost';
  assigned_to?: string; // User ID
  notes?: string;
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Call {
  _id: string;
  lead_id: string;
  user_id: string;
  result: 'answered' | 'no_answer' | 'busy' | 'rejected' | 'voicemail';
  duration: number; // seconds
  notes?: string;
  next_followup?: string;
  created_at: string;
}

export interface Meeting {
  _id: string;
  lead_id: string;
  user_id: string;
  meeting_date: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface CallStats {
  totalCalls: number;
  answeredCalls: number;
  contactRate: number;
  conversionRate: number;
  avgDuration: number;
}
