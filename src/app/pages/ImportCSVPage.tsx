import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  Download,
  Trash2,
  Eye,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { useCRM } from '../contexts/CRMContext';
import { Lead } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface CSVRow {
  company_name: string;
  phone: string;
  email?: string;
  website?: string;
  industry: string;
  city: string;
  source: string;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  duplicates: number;
}

export default function ImportCSVPage() {
  const { language, t } = useLanguage();
  const { users, leads, importLeads } = useCRM();
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [defaultSource, setDefaultSource] = useState<string>('manual');
  const [defaultAssignee, setDefaultAssignee] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error(language === 'ar' ? 'الرجاء اختيار ملف CSV فقط' : 'Please select a CSV file only');
      return;
    }

    setFile(selectedFile);
    parseCSV(selectedFile);
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const data: CSVRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.trim());
        const row: any = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        data.push(row as CSVRow);
      }
      
      setCsvData(data);
      setShowPreview(true);
      toast.success(language === 'ar' 
        ? `تم تحميل ${data.length} صف من ملف CSV`
        : `Loaded ${data.length} rows from CSV file`
      );
    };

    reader.onerror = () => {
      toast.error(language === 'ar' ? 'حدث خطأ أثناء قراءة الملف' : 'Error reading file');
    };

    reader.readAsText(file);
  };

  const validateRow = (row: CSVRow): boolean => {
    if (!row.company_name || !row.phone) return false;
    if (!row.industry || !row.city) return false;
    // Validate phone format (Egyptian)
    if (!/^0\d{9,10}$/.test(row.phone.replace(/\s/g, ''))) return false;
    return true;
  };

  const processImport = async () => {
    if (csvData.length === 0) {
      toast.error(language === 'ar' ? 'لا توجد بيانات للاستيراد' : 'No data to import');
      return;
    }

    if (!defaultAssignee) {
      toast.error(language === 'ar' ? 'الرجاء اختيار موظف مبيعات لتعيين العملاء' : 'Please select a salesperson to assign leads');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    // Validate rows first
    const validRows = csvData.filter(row => validateRow(row));
    const failedCount = csvData.length - validRows.length;

    // Build lead objects from valid rows
    const leadsToImport = validRows.map(row => ({
      company_name: row.company_name,
      phone: row.phone.replace(/\s/g, ''),
      email: row.email || '',
      website: row.website || '',
      industry: row.industry,
      city: row.city,
      source: (defaultSource || row.source || 'manual') as Lead['source'],
      status: 'new' as Lead['status'],
      assigned_to: defaultAssignee,
      notes: '',
      rating: 0,
    }));

    // Simulate progress for UI feedback
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      setProgress((i / steps) * 100);
    }

    // Use CRM context importLeads for actual import with duplicate detection
    const result = await importLeads(leadsToImport);

    setImportResult({
      total: csvData.length,
      success: result.success,
      failed: failedCount + result.failed,
      duplicates: result.duplicates,
    });

    setIsProcessing(false);
    toast.success(language === 'ar' ? `تم استيراد ${result.success} عميل محتمل بنجاح` : `Successfully imported ${result.success} potential leads`);
  };

  const downloadTemplate = () => {
    const template = 'company_name,phone,email,website,industry,city,source\n' +
      'شركة المقاولات العربية,0224567890,info@company.com,https://company.com,مقاولات,القاهرة,gmaps\n' +
      'عيادة النور الطبية,0223334444,contact@clinic.com,,عيادات,الجيزة,manual\n';
    
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_leads.csv';
    link.click();
    
    toast.success(language === 'ar' ? 'تم تحميل ملف القالب' : 'Template CSV downloaded');
  };

  const resetImport = () => {
    setFile(null);
    setCsvData([]);
    setImportResult(null);
    setProgress(0);
    setShowPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const salesUsers = users.filter(u => u.role === 'sales' || u.role === 'admin');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 group hover:bg-primary/20 transition-all duration-300">
            <Upload className="h-10 w-10 text-primary transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{language === 'ar' ? 'استيراد العملاء المحتملين' : 'Import Leads'}</h1>
            <p className="text-muted-foreground">{language === 'ar' ? 'استيراد بيانات العملاء من ملفات CSV' : 'Import lead data from CSV files'}</p>
          </div>
        </div>
        <Button onClick={downloadTemplate} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          {language === 'ar' ? 'تحميل قالب CSV' : 'Download CSV Template'}
        </Button>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'تعليمات الاستيراد' : 'Import Instructions'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">{language === 'ar' ? 'الأعمدة المطلوبة:' : 'Required Columns:'}</p>
              <p className="text-sm text-muted-foreground">
                company_name, phone, industry, city
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">{language === 'ar' ? 'الأعمدة الاختيارية:' : 'Optional Columns:'}</p>
              <p className="text-sm text-muted-foreground">
                email, website, source
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
            <div>
              <p className="font-medium">{language === 'ar' ? 'ملاحظات:' : 'Notes:'}</p>
              <p className="text-sm text-muted-foreground">
                • {language === 'ar' ? 'رقم الهاتف يجب أن يبدأ بـ 0 ويكون 10-11 رقم' : 'Phone number must start with 0 and be 10-11 digits'}<br />
                • {language === 'ar' ? 'سيتم تجاهل الأرقام المكررة تلقائياً' : 'Duplicate numbers will be automatically ignored'}<br />
                • {language === 'ar' ? 'يجب تحديد مصدر البيانات وموظف المبيعات قبل الاستيراد' : 'Data source and sales employee must be specified before import'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'إعدادات الاستيراد' : 'Import Settings'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'مصدر البيانات' : 'Data Source'}</Label>
              <Select value={defaultSource} onValueChange={setDefaultSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmaps">Google Maps</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="140online">140Online</SelectItem>
                  <SelectItem value="apify">Apify</SelectItem>
                  <SelectItem value="phantombuster">PhantomBuster</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="manual">{language === 'ar' ? 'يدوي' : 'Manual'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'موظف المبيعات المسؤول' : 'Responsible Salesperson'}</Label>
              <Select value={defaultAssignee} onValueChange={setDefaultAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر موظف' : 'Select Employee'} />
                </SelectTrigger>
                <SelectContent>
                  {salesUsers.map(user => (
                    <SelectItem key={user._id} value={user._id}>
                      {user.name} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'رفع ملف CSV' : 'Upload CSV File'}</CardTitle>
        </CardHeader>
        <CardContent>
          {!file ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">{language === 'ar' ? 'اسحب وأفلت ملف CSV هنا' : 'Drag and drop CSV file here'}</p>
              <p className="text-sm text-muted-foreground mb-4">{language === 'ar' ? 'أو' : 'or'}</p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
              />
              <Button asChild>
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Upload className="w-4 h-4 ml-2" />
                  {language === 'ar' ? 'اختر ملف' : 'Choose File'}
                </label>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(2)} KB • {csvData.length} صف
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {showPreview && (
                    <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={resetImport}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{language === 'ar' ? 'جاري الاستيراد...' : 'Importing...'}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              {!importResult && !isProcessing && (
                <Button 
                  onClick={processImport} 
                  className="w-full gap-2"
                  disabled={!defaultAssignee}
                >
                  <Upload className="w-4 h-4" />
                  {language === 'ar' ? 'بدء الاستيراد' : 'Start Import'} ({csvData.length} {language === 'ar' ? 'صف' : 'rows'})
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Table */}
      {showPreview && csvData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{language === 'ar' ? 'معاينة البيانات (أول 10 صفوف)' : 'Data Preview (first 10 rows)'}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-right">#</th>
                    <th className="p-2 text-right">{language === 'ar' ? 'اسم الشركة' : 'Company Name'}</th>
                    <th className="p-2 text-right">{language === 'ar' ? 'الهاتف' : 'Phone'}</th>
                    <th className="p-2 text-right">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</th>
                    <th className="p-2 text-right">{language === 'ar' ? 'الصناعة' : 'Industry'}</th>
                    <th className="p-2 text-right">{language === 'ar' ? 'المدينة' : 'City'}</th>
                    <th className="p-2 text-right">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 10).map((row, index) => {
                    const isValid = validateRow(row);
                    return (
                      <tr key={index} className="border-t">
                        <td className="p-2">{index + 1}</td>
                        <td className="p-2">{row.company_name}</td>
                        <td className="p-2 font-mono">{row.phone}</td>
                        <td className="p-2">{row.email || '-'}</td>
                        <td className="p-2">{row.industry}</td>
                        <td className="p-2">{row.city}</td>
                        <td className="p-2">
                          {isValid ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle className="w-3 h-3" />
                              {language === 'ar' ? 'صالح' : 'Valid'}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {language === 'ar' ? 'خطأ' : 'Error'}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {csvData.length > 10 && (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                ... {language === 'ar' ? 'و' : 'and'} {csvData.length - 10} {language === 'ar' ? 'صف إضافي' : 'more rows'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Results */}
      {importResult && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-6 h-6" />
              {language === 'ar' ? 'اكتمل الاستيراد' : 'Import Complete'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{importResult.total}</div>
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'إجمالي الصفوف' : 'Total Rows'}</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{importResult.success}</div>
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'تم الاستيراد' : 'Imported'}</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">{importResult.duplicates}</div>
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'مكرر' : 'Duplicates'}</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{importResult.failed}</div>
                <p className="text-sm text-muted-foreground">{language === 'ar' ? 'فشل' : 'Failed'}</p>
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={resetImport} className="w-full">
                                {language === 'ar' ? 'استيراد ملف جديد' : 'Import New File'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{language === 'ar' ? 'إجمالي العملاء' : 'Total Leads'}</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leads.length}</div>
            <p className="text-xs text-muted-foreground">{language === 'ar' ? 'في قاعدة البيانات' : 'In database'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{language === 'ar' ? 'تم الاستيراد اليوم' : 'Imported Today'}</CardTitle>
            <Upload className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{importResult?.success || 0}</div>
            <p className="text-xs text-muted-foreground">{language === 'ar' ? 'عميل محتمل' : 'Potential leads'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{language === 'ar' ? 'معدل النجاح' : 'Success Rate'}</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {importResult 
                ? ((importResult.success / importResult.total) * 100).toFixed(0) 
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">{language === 'ar' ? 'آخر عملية استيراد' : 'Last import'}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
