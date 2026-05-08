import { useState } from 'react';
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
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useCRM } from '../contexts/CRMContext';
import { useLanguage } from '../contexts/LanguageContext';

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (lead: Lead) => void;
}

export function AddLeadModal({ isOpen, onClose, onAdd }: AddLeadModalProps) {
  const { user } = useAuth();
  const { addLead } = useCRM();
  const { language } = useLanguage();
  const [formData, setFormData] = useState({
    company_name: '',
    phone: '',
    email: '',
    website: '',
    industry: 'مقاولات',
    city: '',
    source: 'manual' as const,
    notes: '',
  });

  const handleSubmit = () => {
    if (!formData.company_name || !formData.phone || !formData.city) {
      toast.error(language === 'ar' ? 'يرجى إدخال اسم الشركة ورقم الهاتف والمدينة' : 'Please enter company name, phone and city');
      return;
    }

    const newLead = addLead({
      company_name: formData.company_name,
      phone: formData.phone,
      email: formData.email || undefined,
      website: formData.website || undefined,
      industry: formData.industry,
      city: formData.city,
      source: formData.source,
      notes: formData.notes || undefined,
      status: 'new',
      assigned_to: user?._id,
    }, user?._id);

    onAdd(newLead);
    toast.success(language === 'ar' ? 'تم إضافة العميل بنجاح' : 'Lead added successfully');
    
    // Reset form
    setFormData({
      company_name: '',
      phone: '',
      email: '',
      website: '',
      industry: 'مقاولات',
      city: '',
      source: 'manual',
      notes: '',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir="rtl" aria-describedby="add-lead-dialog-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            إضافة عميل جديد
          </DialogTitle>
          <DialogDescription id="add-lead-dialog-description">
            أدخل بيانات العميل المحتمل
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label>اسم الشركة *</Label>
            <Input
              placeholder="مثال: شركة المقاولات العربية"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>رقم الهاتف *</Label>
            <Input
              placeholder="0223456789"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input
              type="email"
              placeholder="info@company.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label>الموقع الإلكتروني</Label>
            <Input
              placeholder="https://company.com"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label>الصناعة</Label>
            <Select value={formData.industry} onValueChange={(val) => setFormData({ ...formData, industry: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="مقاولات">مقاولات</SelectItem>
                <SelectItem value="عيادات">عيادات</SelectItem>
                <SelectItem value="سياحة">سياحة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>المدينة *</Label>
            <Input
              placeholder="القاهرة"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>المصدر</Label>
            <Select value={formData.source} onValueChange={(val: any) => setFormData({ ...formData, source: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">يدوي</SelectItem>
                  <SelectItem value="gmaps">Google Maps</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="140online">140Online</SelectItem>
                  <SelectItem value="phantombuster">PhantomBuster</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea
              placeholder="أي ملاحظات إضافية..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            إلغاء
          </Button>
          <Button onClick={handleSubmit} className="flex-1">
            إضافة العميل
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Also export as default for compatibility
export default AddLeadModal;
