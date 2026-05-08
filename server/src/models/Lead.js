import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
  company_name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, default: '' },
  website: { type: String, default: '' },
  search_link: { type: String, default: '' },
  industry: { type: String, required: true },
  city: { type: String, required: true },
  source: { type: String, enum: ['gmaps', 'phantombuster', 'manual', 'linkedin', '140online', 'facebook'], required: true },
  status: { type: String, enum: ['new', 'contacted', 'followup', 'meeting', 'closed', 'lost'], default: 'new' },
  assigned_to: { type: String, default: '' },
  notes: { type: String, default: '' },
  rating: { type: Number, default: 0 },
}, { timestamps: true });

// Index on phone for duplicate detection
leadSchema.index({ phone: 1 }, { unique: true });

export default mongoose.model('Lead', leadSchema);
