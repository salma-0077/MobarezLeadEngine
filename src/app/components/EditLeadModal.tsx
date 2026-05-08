import { useState, useEffect } from 'react';
import { Lead } from '../types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useCRM } from '../contexts/CRMContext';
import { useLanguage } from '../contexts/LanguageContext';

interface EditLeadModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditLeadModal({ lead, isOpen, onClose }: EditLeadModalProps) {
  const { user } = useAuth();
  const { updateLead, users } = useCRM();
  const { language } = useLanguage();
  const [formData, setFormData] = useState({
    company_name: '',
    phone: '',
    email: '',
    website: '',
    industry: '',
    city: '',
    source: '' as string,
    status: '' as string,
    assigned_to: '',
    notes: '',
  });

  useEffect(() => {
    if (lead) {
      setFormData({
        company_name: lead.company_name,
        phone: lead.phone,
        email: lead.email || '',
        website: lead.website || '',
        industry: lead.industry,
        city: lead.city,
        source: lead.source,
        status: lead.status,
        assigned_to: lead.assigned_to || 'none',
        notes: lead.notes || '',
      });
    }
  }, [lead]);

  const handleSubmit = () => {
    if (!formData.company_name || !formData.phone) {
      toast.error(language === 'ar' ? 'يرجى إدخال اسم الشركة ورقم الهاتف' : 'Please enter company name and phone');
      return;
    }

    updateLead(lead._id, {
      company_name: formData.company_name,
      phone: formData.phone,
      email: formData.email || undefined,
      website: formData.website || undefined,
      industry: formData.industry,
      city: formData.city,
      source: formData.source as Lead['source'],
      status: formData.status as Lead['status'],
      assigned_to: formData.assigned_to === 'none' ? undefined : formData.assigned_to || undefined,
      notes: formData.notes || undefined,
    }, user?._id);

    toast.success(language === 'ar' ? 'تم تحديث بيانات العميل بنجاح' : 'Lead updated successfully');
    onClose();
  };

  const statusOptions = [
    { value: 'new', label: language === 'ar' ? 'جديد' : 'New' },
    { value: 'contacted', label: language === 'ar' ? 'تم التواصل' : 'Contacted' },
    { value: 'followup', label: language === 'ar' ? 'متابعة' : 'Follow Up' },
    { value: 'meeting', label: language === 'ar' ? 'اجتماع' : 'Meeting' },
    { value: 'closed', label: language === 'ar' ? 'مغلق' : 'Closed' },
    { value: 'lost', label: language === 'ar' ? 'خسارة' : 'Lost' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir={language === 'ar' ? 'rtl' : 'ltr'} aria-describedby="edit-lead-dialog-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            {language === 'ar' ? 'تعديل بيانات العميل' : 'Edit Lead'}
          </DialogTitle>
          <DialogDescription id="edit-lead-dialog-description">
            {language === 'ar' ? 'قم بتعديل بيانات العميل المحتمل' : 'Update lead information'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label>{language === 'ar' ? 'اسم الشركة *' : 'Company Name *'}</Label>
            <Input
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>{language === 'ar' ? 'رقم الهاتف *' : 'Phone *'}</Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label>{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label>{language === 'ar' ? 'الموقع الإلكتروني' : 'Website'}</Label>
            <Input
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'الصناعة' : 'Industry'}</Label>
              <Select value={formData.industry} onValueChange={(val) => setFormData({ ...formData, industry: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="مقاولات">{language === 'ar' ? 'مقاولات' : 'Construction'}</SelectItem>
                  <SelectItem value="عيادات">{language === 'ar' ? 'عيادات' : 'Clinics'}</SelectItem>
                  <SelectItem value="سياحة">{language === 'ar' ? 'سياحة' : 'Tourism'}</SelectItem>
                  <SelectItem value="صيدليات">{language === 'ar' ? 'صيدليات' : 'Pharmacies'}</SelectItem>
                  <SelectItem value="مطاعم">{language === 'ar' ? 'مطاعم' : 'Restaurants'}</SelectItem>
                  <SelectItem value="تكنولوجيا">{language === 'ar' ? 'تكنولوجيا' : 'Technology'}</SelectItem>
                  <SelectItem value="أخرى">{language === 'ar' ? 'أخرى' : 'Other'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'المدينة' : 'City'}</Label>
              <Input
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'الحالة' : 'Status'}</Label>
              <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'المصدر' : 'Source'}</Label>
              <Select value={formData.source} onValueChange={(val) => setFormData({ ...formData, source: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">{language === 'ar' ? 'يدوي' : 'Manual'}</SelectItem>
                  <SelectItem value="gmaps">Google Maps</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="140online">140Online</SelectItem>
                  <SelectItem value="phantombuster">PhantomBuster</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{language === 'ar' ? 'مسؤول المتابعة' : 'Assigned To'}</Label>
            <Select value={formData.assigned_to} onValueChange={(val) => setFormData({ ...formData, assigned_to: val })}>
              <SelectTrigger>
                <SelectValue placeholder={language === 'ar' ? 'اختر مسؤول' : 'Select user'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{language === 'ar' ? 'غير محدد' : 'Unassigned'}</SelectItem>
                {users.map(u => (
                  <SelectItem key={u._id} value={u._id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{language === 'ar' ? 'ملاحظات' : 'Notes'}</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleSubmit} className="flex-1">
            {language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
