import { useState } from 'react';
import { useCRM } from '../contexts/CRMContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Checkbox } from '../components/ui/checkbox';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import {
  Globe,
  Search,
  Download,
  Phone,
  Mail,
  Building,
  Loader2,
  CheckCircle,
  AlertCircle,
  Database,
  Sparkles,
  Map,
  MapPin,
  Zap,
  Layers,
  ExternalLink,
  Plus,
  Filter,
} from 'lucide-react';

interface ScrapedLead {
  company_name: string;
  phone: string;
  email: string;
  website: string;
  search_link?: string;
  industry: string;
  city: string;
  source: 'gmaps' | '140online' | 'facebook' | 'linkedin';
  address?: string;
  rating?: number;
  selected?: boolean;
  alreadySaved?: boolean;
}

interface Online140Task {
  type: 'company' | 'category_page' | 'product_page' | 'keyword_page';
  url?: string;
  fallbackName?: string;
  catId?: string;
  catName?: string;
  prodId?: string;
  prodName?: string;
  page?: number;
  chunk?: number;
  label?: string;
}

const CITIES_AR = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'المنصورة', 'طنطا',
  'الزقازيق', 'أسيوط', 'الأقصر', 'أسوان', 'بورسعيد',
  'الإسماعيلية', 'السويس', 'دمياط', 'المنيا', 'سوهاج',
  'بني سويف', 'الفيوم', 'شبين الكوم', 'كفر الشيخ', 'مرسى مطروح',
  'قنا', 'الغردقة', 'شرم الشيخ', 'بنها',
];

const CITY_AREAS: Record<string, string[]> = {
  'القاهرة': [
    'مدينة نصر', 'المعادي', 'الدقي', 'المهندسين', 'الزمالك', 'وسط البلد',
    'مصر الجديدة', 'العباسية', 'شبرا', 'حلوان', 'التجمع الخامس', 'الرحاب',
    'مدينتي', 'المقطم', 'عين شمس', 'النزهة', 'السيدة زينب', 'الدرب الاحمر',
    'حدائق القبة', 'المرج', 'الشروق', 'بدر', 'العبور', 'الزيتون',
    'روض الفرج', 'المطرية', 'بولاق', 'الوايلي', 'حدائق المعادي',
    'دار السلام', 'طره', 'المعصرة', 'التبين', 'الخليفة',
    'منشية ناصر', 'الساحل', 'شبرا الخيمة', 'الموسكي', 'الأزهر',
    'جاردن سيتي', 'المنيل', 'الشيخ زايد', 'القطامية',
    'البساتين', 'السلام', 'الأميرية', 'عزبة النخل', 'حدائق حلوان',
    '15 مايو', 'الشرابية', 'الجمالية', 'غمرة', 'عابدين',
    'باب الشعرية', 'الأزبكية', 'الحسين',
  ],
  'الجيزة': [
    'الهرم', 'فيصل', '6 اكتوبر', 'الشيخ زايد', 'حدائق الأهرام', 'العمرانية',
    'الحوامدية', 'البدرشين', 'أبو النمرس', 'الوراق', 'إمبابة', 'الدقي',
    'العجوزة', 'بولاق الدكرور', 'أوسيم', 'كرداسة', 'المنيب',
    'الطالبية', 'ساقية مكي', 'حدائق الاهرام',
    'الجيزة', 'المريوطية', 'أبو رواش', 'الصف', 'أطفيح',
    'منشأة القناطر', 'الطوابق', 'أرض اللواء',
  ],
  'الإسكندرية': [
    'سيدي جابر', 'سموحة', 'المنتزه', 'سيدي بشر', 'كليوباترا', 'رشدي',
    'ستانلي', 'الابراهيمية', 'العصافرة', 'المندرة', 'جليم', 'لوران',
    'محرم بك', 'العطارين', 'بحري', 'العجمي', 'الدخيلة', 'المعمورة',
    'كامب شيزار', 'فليمنج', 'ميامي', 'أبو قير', 'المنشية', 'الشاطبي',
    'باكوس', 'بولكلي', 'زيزينيا', 'الحضرة', 'كرموز', 'العامرية',
    'برج العرب', 'المكس',
    'سابا باشا', 'مصطفى كامل', 'الشلالات', 'الأميرية', 'سيدي كرير',
    'الهانوفيل', 'غيط العنب', 'الورديان', 'النخيل', 'العوايد',
    'الجمرك', 'الأنفوشي',
  ],
  'المنصورة': [
    'المنصورة', 'ميت غمر', 'طلخا', 'دكرنس', 'أجا', 'السنبلاوين', 'شربين',
    'بلقاس', 'المنزلة', 'تمي الأمديد', 'نبروه', 'منية النصر', 'الجمالية',
  ],
  'طنطا': [
    'طنطا', 'المحلة الكبرى', 'كفر الزيات', 'زفتى', 'بسيون', 'سمنود',
    'قطور', 'السنطة', 'المحلة', 'صفط تراب',
  ],
  'الزقازيق': [
    'الزقازيق', 'بلبيس', 'العاشر من رمضان', 'أبو حماد', 'منيا القمح', 'فاقوس',
    'أبو كبير', 'ههيا', 'كفر صقر', 'ديرب نجم', 'الحسينية', 'الصالحية الجديدة',
  ],
  'أسيوط': [
    'أسيوط', 'ديروط', 'القوصية', 'أبنوب', 'الفتح', 'منفلوط',
    'أسيوط الجديدة', 'الغنايم', 'ساحل سليم', 'أبو تيج', 'صدفا', 'البداري',
  ],
  'الأقصر': [
    'الأقصر', 'الأقصر شرق', 'الأقصر غرب', 'الزينية', 'الطود', 'البياضية',
    'أرمنت', 'القرنة', 'إسنا', 'الأقالتة',
  ],
  'أسوان': [
    'أسوان', 'إدفو', 'كوم أمبو', 'دراو', 'نصر النوبة',
    'أبو سمبل', 'البصيلية', 'السباعية',
  ],
  'بورسعيد': [
    'بورسعيد', 'الزهور', 'المناخ', 'الشرق', 'الضواحي', 'بور فؤاد',
    'العرب', 'الجنوب', 'حي الضواحي',
  ],
  'الإسماعيلية': [
    'الإسماعيلية', 'القنطرة شرق', 'فايد', 'التل الكبير', 'أبو صوير',
    'القنطرة غرب', 'القصاصين', 'نفيشة',
  ],
  'السويس': [
    'السويس', 'الأربعين', 'عتاقة', 'فيصل', 'الجناين',
    'السويس الجديدة', 'حي الأربعين', 'الهجانة',
  ],
  'دمياط': [
    'دمياط', 'دمياط الجديدة', 'رأس البر', 'فارسكور', 'كفر سعد',
    'الزرقا', 'السرو', 'عزبة البرج', 'كفر البطيخ',
  ],
  'المنيا': [
    'المنيا', 'المنيا الجديدة', 'ملوي', 'سمالوط', 'مطاي', 'بني مزار',
    'أبو قرقاص', 'دير مواس', 'العدوة', 'مغاغة', 'المنيا الأقصى',
  ],
  'سوهاج': [
    'سوهاج', 'أخميم', 'جرجا', 'طهطا', 'المراغة', 'البلينا',
    'سوهاج الجديدة', 'ساقلتة', 'دار السلام', 'المنشاة', 'جهينة',
  ],
  'بني سويف': [
    'بني سويف', 'الواسطى', 'ناصر', 'إهناسيا', 'ببا',
    'بني سويف الجديدة', 'الفشن', 'سمسطا', 'نيدة',
  ],
  'الفيوم': [
    'الفيوم', 'الفيوم الجديدة', 'سنورس', 'إبشواي', 'طامية', 'يوسف الصديق',
    'أطسا', 'الشواشنة', 'دمو',
  ],
  'شبين الكوم': [
    'شبين الكوم', 'مدينة السادات', 'منوف', 'قويسنا', 'أشمون', 'الباجور', 'تلا',
    'بركة السبع', 'الشهداء', 'سرس الليان',
  ],
  'كفر الشيخ': [
    'كفر الشيخ', 'دسوق', 'فوه', 'بيلا', 'الحامول', 'مطوبس',
    'الرياض', 'سيدي سالم', 'قلين', 'بلطيم',
  ],
  'مرسى مطروح': [
    'مرسى مطروح', 'الحمام', 'العلمين', 'الضبعة', 'سيدي عبد الرحمن',
    'الساحل الشمالي', 'رأس الحكمة', 'سيوة',
  ],
  'قنا': [
    'قنا', 'نجع حمادي', 'دشنا', 'قوص', 'أبو تشت', 'نقادة',
    'فرشوط', 'الوقف', 'قنا الجديدة',
  ],
  'الغردقة': [
    'الغردقة', 'سهل حشيش', 'الجونة', 'مكادي', 'القصير',
    'سفاجا', 'مرسى علم', 'الاحياء',
  ],
  'شرم الشيخ': [
    'شرم الشيخ', 'نبق', 'خليج نعمة', 'هضبة أم السيد', 'رأس محمد',
    'شرم القديمة', 'دهب', 'نويبع', 'طابا',
  ],
  'بنها': [
    'بنها', 'شبرا الخيمة', 'قليوب', 'القناطر الخيرية', 'كفر شكر',
    'طوخ', 'شبين القناطر', 'الخصوص', 'العبور',
  ],
};

const INDUSTRIES_AR = [
  { label: 'عيادات', value: 'عيادات' },
  { label: 'مستشفيات', value: 'مستشفيات' },
  { label: 'صيدليات', value: 'صيدليات' },
  { label: 'مطاعم', value: 'مطاعم' },
  { label: 'كافيهات', value: 'كافيهات' },
  { label: 'فنادق', value: 'فنادق' },
  { label: 'مقاولات', value: 'مقاولات' },
  { label: 'تعليم / مدارس', value: 'تعليم' },
  { label: 'جامعات', value: 'جامعات' },
  { label: 'بنوك', value: 'بنوك' },
  { label: 'سوبرماركت', value: 'سوبرماركت' },
  { label: 'صالونات تجميل', value: 'صالونات' },
  { label: 'مراكز رياضية', value: 'رياضة' },
  { label: 'مكاتب / شركات', value: 'مكاتب' },
];

const buildGoogleMapsSearchUrl = (query: string) => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalizedQuery)}`;
};

const buildFacebookSearchUrl = (query: string) => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return '';
  return `https://www.facebook.com/search/top?q=${encodeURIComponent(normalizedQuery)}`;
};

const normalizeExternalUrl = (rawUrl: string) => {
  const candidate = rawUrl.trim();
  if (!candidate) return '';
  if (/^https?:\/\//i.test(candidate)) return candidate;
  if (candidate.startsWith('//')) return `https:${candidate}`;
  if (/^(?:www\.)?[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(candidate)) {
    return `https://${candidate}`;
  }
  return '';
};

const isFacebookSearchResultsUrl = (url: string) => /facebook\.com\/search\//i.test(url);

const buildPreferredFacebookLeadLink = (
  lead: Pick<ScrapedLead, 'website' | 'company_name' | 'search_link'>,
  fallbackQuery: string,
  locationHint: string,
) => {
  const companyWebsite = normalizeExternalUrl(lead.website || '');
  if (companyWebsite) return companyWebsite;

  const existingLink = (lead.search_link || '').trim();
  if (existingLink && !isFacebookSearchResultsUrl(existingLink)) return existingLink;

  const companyName = (lead.company_name || '').trim();
  const companyQuery = [companyName, locationHint.trim()].filter(Boolean).join(' ').trim();
  const companySearchLink = buildFacebookSearchUrl(companyQuery || companyName);
  if (companySearchLink) return companySearchLink;

  return existingLink || buildFacebookSearchUrl(fallbackQuery);
};

const buildLinkedInSearchUrl = (query: string) => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return '';
  return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(normalizedQuery)}`;
};

const isLinkedInDomainUrl = (url: string) => /(?:^https?:\/\/)?(?:[a-z]+\.)?linkedin\.com\//i.test(url);
const isLinkedInSearchResultsUrl = (url: string) => /linkedin\.com\/search\//i.test(url);

const buildLinkedInCompanyProfileUrl = (companyName: string) => {
  const normalizedName = companyName.trim();
  if (!normalizedName) return '';

  const slug = normalizedName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!slug) return '';
  return `https://www.linkedin.com/company/${encodeURIComponent(slug)}/`;
};

const buildPreferredLinkedInLeadLink = (
  lead: Pick<ScrapedLead, 'website' | 'company_name' | 'search_link'>,
  fallbackQuery: string,
  locationHint: string,
) => {
  const companyWebsite = normalizeExternalUrl(lead.website || '');
  if (companyWebsite && isLinkedInDomainUrl(companyWebsite) && !isLinkedInSearchResultsUrl(companyWebsite)) {
    return companyWebsite;
  }

  const existingLink = (lead.search_link || '').trim();
  if (existingLink && isLinkedInDomainUrl(existingLink) && !isLinkedInSearchResultsUrl(existingLink)) {
    return existingLink;
  }

  const companyName = (lead.company_name || '').trim();
  const companyProfileLink = buildLinkedInCompanyProfileUrl(companyName);
  if (companyProfileLink) return companyProfileLink;

  const companyQuery = [companyName, locationHint.trim()].filter(Boolean).join(' ').trim();
  const companySearchLink = buildLinkedInSearchUrl(companyQuery || companyName);
  if (companySearchLink) return companySearchLink;

  if (companyWebsite) return companyWebsite;
  return existingLink || buildLinkedInSearchUrl(fallbackQuery);
};

export default function DataCollectionPage() {
  const { users, settings } = useCRM();
  const { language } = useLanguage();
  const { user } = useAuth();

  const [industry, setIndustry] = useState('عيادات');
  const [searchSource, setSearchSource] = useState<'gmaps' | '140online' | 'facebook' | 'linkedin'>('gmaps');

  // Google Maps direct scrape params
  const [gmapsQuery, setGmapsQuery] = useState('');
  const [gmapsSearchLink, setGmapsSearchLink] = useState('');
  const [gmapsCity, setGmapsCity] = useState('القاهرة');
  const [gmapsArea, setGmapsArea] = useState('');
  const [comprehensive, setComprehensive] = useState(false);
  const [facebookComprehensive, setFacebookComprehensive] = useState(true);
  const [facebookSearchLink, setFacebookSearchLink] = useState('');
  const [facebookPreciseMode, setFacebookPreciseMode] = useState(false);
  const [facebookIncludeKeywords, setFacebookIncludeKeywords] = useState('');
  const [facebookExcludeKeywords, setFacebookExcludeKeywords] = useState('');
  const [facebookResultView, setFacebookResultView] = useState<'all' | 'withPhone' | 'withoutPhone'>('all');
  const [linkedinComprehensive, setLinkedinComprehensive] = useState(true);
  const [linkedinSearchLink, setLinkedinSearchLink] = useState('');
  const [linkedinPreciseMode, setLinkedinPreciseMode] = useState(false);
  const [linkedinIncludeKeywords, setLinkedinIncludeKeywords] = useState('');
  const [linkedinExcludeKeywords, setLinkedinExcludeKeywords] = useState('');
  const [linkedinResultView, setLinkedinResultView] = useState<'all' | 'withPhone' | 'withoutPhone'>('all');
  const [queriesRun, setQueriesRun] = useState(0);
  const [queryStats, setQueryStats] = useState<{ query: string; found: number; new: number }[]>([]);

  // Results state
  const [results, setResults] = useState<ScrapedLead[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchStats, setSearchStats] = useState<{ total: number; withPhone: number; withoutPhone?: number; source: string; totalScraped?: number; newLeads?: number; alreadySaved?: number; queriesRun?: number } | null>(null);
  const [saveResult, setSaveResult] = useState<{ success: number; duplicates: number; noPhone: number; failed: number } | null>(null);
  const [assignTo, setAssignTo] = useState('');
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [maxPages, setMaxPages] = useState(5);

  const hasFacebookResults = results.some(r => r.source === 'facebook');
  const hasLinkedInResults = results.some(r => r.source === 'linkedin');
  const visibleRows = results
    .map((lead, index) => ({ lead, index }))
    .filter(({ lead }) => {
      if (lead.source === 'facebook' && hasFacebookResults) {
        if (facebookResultView === 'withPhone') return !!lead.phone;
        if (facebookResultView === 'withoutPhone') return !lead.phone;
        return true;
      }
      if (lead.source === 'linkedin' && hasLinkedInResults) {
        if (linkedinResultView === 'withPhone') return !!lead.phone;
        if (linkedinResultView === 'withoutPhone') return !lead.phone;
        return true;
      }
      return true;
    });
  const visibleIndexes = visibleRows.map(r => r.index);
  const visibleSelectedCount = visibleRows.filter(r => r.lead.selected).length;
  const salesUsers = users.filter(u => u.role === 'sales' || u.role === 'admin');

  // Search Google Maps — uses POST endpoint with frontend-managed batching for comprehensive search
  const searchGMaps = async () => {
    setIsSearching(true);
    setSaveResult(null);
    setResults([]);
    setSearchStats(null);
    setQueryStats([]);
    setQueriesRun(0);
    setProgressMsg(language === 'ar' ? 'جاري البحث...' : 'Searching...');
    setProgressPercent(0);

    const selectedArea = gmapsArea && gmapsArea !== 'all' ? gmapsArea : '';
    const defaultQuery = (gmapsQuery || `${industry} في ${selectedArea || gmapsCity}`).trim();
    const fallbackSearchLink = buildGoogleMapsSearchUrl(defaultQuery);
    const effectiveSearchLink = gmapsSearchLink.trim() || fallbackSearchLink;
    if (!gmapsSearchLink.trim() && effectiveSearchLink) {
      setGmapsSearchLink(effectiveSearchLink);
    }

    try {
      if (comprehensive) {
        // Comprehensive search — always batch from frontend to avoid Netlify timeout
        // Step 1: Get the list of queries to run from the server
        let queries: string[] = [];
        let queryLabels: string[] = [];

        if (!selectedArea) {
          // All areas — build queries locally
          const areas = CITY_AREAS[gmapsCity] || [];
          const rawTerm = gmapsQuery || industry;
          queries = areas.map(a => gmapsQuery ? `${gmapsQuery} في ${a}` : `${rawTerm} في ${a}`);
          queryLabels = areas;
        } else {
          // Specific area — get sub-zone queries from server
          try {
            const buildRes = await fetch('/api/scrape/gmaps/build-queries', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                searchQuery: gmapsQuery || '',
                city: gmapsCity,
                industry,
                area: selectedArea,
                comprehensive: true,
              }),
            });
            if (buildRes.ok) {
              const buildData = await buildRes.json();
              queries = buildData.queries || [];
              queryLabels = queries.map((q: string) => q.substring(0, 40));
            }
          } catch {
            // Fallback: use basic queries
            const rawTerm = gmapsQuery || industry;
            queries = [
              `${rawTerm} في ${selectedArea}`,
              `${rawTerm} ${selectedArea}`,
              `${rawTerm} في ${selectedArea} ${gmapsCity}`,
            ];
            queryLabels = queries;
          }
        }

        if (queries.length === 0) {
          throw new Error(language === 'ar' ? 'لا توجد استعلامات للبحث' : 'No queries to search');
        }

        // Shuffle queries so different streets get prioritized each run
        const shuffled = queries.map((q, idx) => ({ query: q, label: queryLabels[idx] || q.substring(0, 40), origIdx: idx }));
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Step 2: Run queries one by one via search-single
        const allLeads: ScrapedLead[] = [];
        const seenNames = new Set<string>();
        const stats: { query: string; found: number; new: number }[] = [];
        let debugInfo: Record<string, unknown> | null = null;
        const failedQueries: { query: string; label: string; engineUsed: number }[] = [];

        // Helper to run a single query
        const runQuery = async (q: string, engineHint: number): Promise<{ leads: ScrapedLead[]; total: number; _debug?: Record<string, unknown> } | null> => {
          try {
            const res = await fetch('/api/scrape/gmaps/search-single', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: q, engineHint }),
            });
            if (res.ok) return await res.json();
          } catch { /* ignore */ }
          return null;
        };

        for (let i = 0; i < shuffled.length; i++) {
          const { query, label } = shuffled[i];
          const querySearchLink = buildGoogleMapsSearchUrl(query);

          setProgressMsg(`${i + 1}/${shuffled.length} — ${label}`);
          setProgressPercent(Math.round((i / shuffled.length) * 100));

          // Longer delay between requests (3–8s) to avoid rate-limiting
          if (i > 0) {
            const delay = 3000 + Math.floor(Math.random() * 5000);
            await new Promise(r => setTimeout(r, delay));
          }

          // Rotate engine per query: 1=brave, 2=google, 3=startpage
          const engineHint = (i % 3) + 1;

          const data = await runQuery(query, engineHint);

          if (data && (data.total || 0) > 0) {
            if (i === 0 && data._debug) debugInfo = data._debug as Record<string, unknown>;
            const newLeads: ScrapedLead[] = [];
            for (const lead of data.leads || []) {
              const key = (lead.company_name || '').toLowerCase().trim();
              if (key && !seenNames.has(key)) {
                seenNames.add(key);
                newLeads.push({
                  ...lead,
                  industry: lead.industry || industry,
                  city: selectedArea || label,
                  search_link: lead.search_link || querySearchLink || effectiveSearchLink,
                  selected: !lead.alreadySaved,
                });
              }
            }
            allLeads.push(...newLeads);
            setResults([...allLeads]);
            stats.push({ query: label, found: data.total || 0, new: newLeads.length });
          } else {
            // Track failed queries for retry with different engine
            failedQueries.push({ query, label, engineUsed: engineHint });
            stats.push({ query: label, found: 0, new: 0 });
          }

          setQueryStats([...stats]);
          setQueriesRun(i + 1);
        }

        // Retry phase: retry failed queries with a different engine + longer delay
        if (failedQueries.length > 0 && failedQueries.length < shuffled.length) {
          setProgressMsg(language === 'ar' ? `إعادة محاولة ${failedQueries.length} استعلام...` : `Retrying ${failedQueries.length} queries...`);
          const retryBatch = failedQueries.slice(0, Math.min(failedQueries.length, 15)); // limit retries
          for (let r = 0; r < retryBatch.length; r++) {
            const { query, label, engineUsed } = retryBatch[r];
            // Pick a different engine than the one that failed
            const retryEngine = engineUsed === 3 ? 1 : engineUsed + 1;

            // Longer delay for retries (5–10s)
            const delay = 5000 + Math.floor(Math.random() * 5000);
            await new Promise(res => setTimeout(res, delay));

            setProgressMsg(`${language === 'ar' ? 'إعادة' : 'Retry'} ${r + 1}/${retryBatch.length} — ${label}`);

            const data = await runQuery(query, retryEngine);
            if (data && (data.total || 0) > 0) {
              const newLeads: ScrapedLead[] = [];
              for (const lead of data.leads || []) {
                const key = (lead.company_name || '').toLowerCase().trim();
                if (key && !seenNames.has(key)) {
                  seenNames.add(key);
                  newLeads.push({
                    ...lead,
                    industry: lead.industry || industry,
                    city: selectedArea || label,
                    search_link: lead.search_link || buildGoogleMapsSearchUrl(query) || effectiveSearchLink,
                    selected: !lead.alreadySaved,
                  });
                }
              }
              allLeads.push(...newLeads);
              setResults([...allLeads]);
              // Update the stat entry for this query
              const statIdx = stats.findIndex(s => s.query === label);
              if (statIdx >= 0) stats[statIdx] = { query: label, found: data.total || 0, new: newLeads.length };
              setQueryStats([...stats]);
            }
          }
        }

        // Final stats
        setProgressPercent(100);
        const withPhone = allLeads.filter(l => l.phone).length;
        const newCount = allLeads.filter(l => !l.alreadySaved).length;
        const alreadySaved = allLeads.filter(l => l.alreadySaved).length;
        setSearchStats({
          total: allLeads.length,
          totalScraped: allLeads.length,
          withPhone,
          newLeads: newCount,
          alreadySaved,
          queriesRun: queries.length,
          source: 'Google Maps (بحث شامل)',
        });

        if (allLeads.length === 0 && debugInfo) {
          console.warn('[LeadEngine] Debug info from search:', debugInfo);
          toast.error(language === 'ar'
            ? `لم يتم العثور على نتائج — Debug: strategies=${JSON.stringify((debugInfo as Record<string, unknown>).strategies)}, htmlLengths=${JSON.stringify((debugInfo as Record<string, unknown>).htmlLengths)}, statusCodes=${JSON.stringify((debugInfo as Record<string, unknown>).statusCodes)}`
            : `No results found — Debug: ${JSON.stringify(debugInfo)}`);
        } else {
          toast.success(language === 'ar'
            ? `تم العثور على ${newCount} عميل جديد`
            : `Found ${newCount} new leads`);
        }
      } else {
        // Single (non-comprehensive) search
        const res = await fetch('/api/scrape/gmaps/search-single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: gmapsQuery || `${industry} في ${selectedArea || gmapsCity}`,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'خطأ في البحث');
        }

        const data = await res.json();
        const singleSearchLink = effectiveSearchLink || buildGoogleMapsSearchUrl(gmapsQuery || `${industry} في ${selectedArea || gmapsCity}`);
        const leads: ScrapedLead[] = (data.leads || []).map((r: ScrapedLead & { alreadySaved?: boolean }) => ({
          ...r,
          industry: r.industry || industry,
          city: selectedArea || gmapsCity,
          search_link: r.search_link || singleSearchLink,
          selected: !r.alreadySaved,
        }));

        setResults(leads);
        setProgressPercent(100);
        setSearchStats({
          total: data.total,
          totalScraped: data.total,
          withPhone: data.withPhone,
          newLeads: leads.filter(l => !l.alreadySaved).length,
          alreadySaved: leads.filter(l => l.alreadySaved).length,
          queriesRun: 1,
          source: 'Google Maps',
        });

        if (leads.length === 0 && data._debug) {
          console.warn('[LeadEngine] Debug info:', data._debug);
          toast.error(language === 'ar'
            ? `لم يتم العثور على نتائج — Status: ${JSON.stringify(data._debug.statusCodes)}, HTML: ${JSON.stringify(data._debug.htmlLengths)}`
            : `No results — Debug: ${JSON.stringify(data._debug)}`);
        } else {
          const newCount = leads.filter(l => !l.alreadySaved).length;
          toast.success(language === 'ar'
            ? `تم العثور على ${newCount} عميل جديد`
            : `Found ${newCount} new leads`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطأ في البحث';
      toast.error(msg);
    } finally {
      setIsSearching(false);
      setProgressMsg('');
    }
  };

  // Search 140Online directory
  const search140Online = async () => {
    setIsSearching(true);
    setSaveResult(null);
    setResults([]);
    setSearchStats(null);
    setQueryStats([]);
    setQueriesRun(0);
    setProgressMsg(language === 'ar' ? 'جاري البحث في دليل 140 أونلاين...' : 'Searching 140Online directory...');
    setProgressPercent(5);

    try {
      const searchQuery = (gmapsQuery || industry).trim();

      // Step 1: build small tasks, then execute one-by-one (same pattern as Google Maps comprehensive mode)
      const buildRes = await fetch('/api/scrape/140online/build-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, maxPages }),
      });

      if (!buildRes.ok) {
        const err = await buildRes.json();
        throw new Error(err.error || 'خطأ في البحث');
      }

      const buildData = await buildRes.json();
      const tasks: Online140Task[] = buildData.tasks || [];
      if (tasks.length === 0) {
        setProgressPercent(100);
        toast.warning(language === 'ar'
          ? 'لم يتم العثور على نتائج مبدئية — جرّب كلمة بحث مختلفة'
          : 'No initial matches found — try another query');
        return;
      }

      const allLeads: ScrapedLead[] = [];
      const seenKeys = new Set<string>();
      const stats: { query: string; found: number; new: number }[] = [];

      const runTask = async (task: Online140Task): Promise<{ leads: ScrapedLead[]; total: number } | null> => {
        try {
          const res = await fetch('/api/scrape/140online/search-single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: searchQuery, task }),
          });
          if (res.ok) return await res.json();
        } catch {
          // ignore single task failure and continue
        }
        return null;
      };

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const label = task.label || `${language === 'ar' ? 'مهمة' : 'Task'} ${i + 1}`;

        setProgressMsg(`${i + 1}/${tasks.length} — ${label}`);
        setProgressPercent(Math.round((i / tasks.length) * 100));

        if (i > 0) {
          const delay = 250 + Math.floor(Math.random() * 350);
          await new Promise(r => setTimeout(r, delay));
        }

        const data = await runTask(task);
        if (!data) {
          stats.push({ query: label, found: 0, new: 0 });
          setQueryStats([...stats]);
          setQueriesRun(i + 1);
          continue;
        }

        let newCountPerTask = 0;
        const taskLeads = data.leads || [];
        for (const lead of taskLeads) {
          const phoneKey = (lead.phone || '').replace(/[\s\-]+/g, '').trim();
          const nameKey = (lead.company_name || '').toLowerCase().trim();
          const dedupeKey = phoneKey || nameKey;
          if (!dedupeKey || seenKeys.has(dedupeKey)) continue;
          seenKeys.add(dedupeKey);
          allLeads.push({
            ...lead,
            selected: !lead.alreadySaved,
          });
          newCountPerTask++;
        }

        setResults([...allLeads]);
        stats.push({ query: label, found: taskLeads.length, new: newCountPerTask });
        setQueryStats([...stats]);
        setQueriesRun(i + 1);
      }

      setProgressPercent(100);
      const withPhone = allLeads.filter(l => l.phone).length;
      const newCount = allLeads.filter(l => !l.alreadySaved).length;
      const alreadySaved = allLeads.filter(l => l.alreadySaved).length;
      setSearchStats({
        total: allLeads.length,
        totalScraped: allLeads.length,
        withPhone,
        newLeads: newCount,
        alreadySaved,
        queriesRun: tasks.length,
        source: 'دليل 140 أونلاين (بحث شامل)',
      });

      if (allLeads.length > 0) {
        toast.success(language === 'ar'
          ? `تم العثور على ${newCount} عميل جديد من دليل 140 أونلاين`
          : `Found ${newCount} new leads from 140Online`);
      } else {
        toast.warning(language === 'ar'
          ? 'لم يتم العثور على نتائج — جرب كلمة بحث مختلفة'
          : 'No results found — try a different search term');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطأ في البحث';
      toast.error(msg);
    } finally {
      setIsSearching(false);
      setProgressMsg('');
    }
  };

  // Search Facebook using batched multi-query mode (similar to Google Maps comprehensive flow)
  const searchFacebook = async () => {
    setIsSearching(true);
    setSaveResult(null);
    setResults([]);
    setSearchStats(null);
    setQueryStats([]);
    setQueriesRun(0);
    setFacebookResultView('all');
    setProgressMsg(language === 'ar' ? 'جاري البحث في Facebook...' : 'Searching Facebook...');
    setProgressPercent(0);

    const selectedArea = gmapsArea && gmapsArea !== 'all' ? gmapsArea : '';
    const searchQuery = (gmapsQuery || `${industry} ${selectedArea || gmapsCity}`).trim();
    const fallbackSearchLink = buildFacebookSearchUrl(searchQuery);
    const effectiveSearchLink = facebookSearchLink.trim() || fallbackSearchLink;
    if (!facebookSearchLink.trim() && effectiveSearchLink) {
      setFacebookSearchLink(effectiveSearchLink);
    }

    try {
      if (!searchQuery) {
        throw new Error(language === 'ar' ? 'يرجى إدخال كلمة بحث' : 'Please enter a search query');
      }
      if (facebookPreciseMode && !selectedArea && !gmapsCity.trim()) {
        throw new Error(language === 'ar' ? 'في وضع البحث الدقيق يجب تحديد المدينة أو المنطقة' : 'In precise mode, city or area is required');
      }

      const buildRes = await fetch('/api/scrape/facebook/build-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          city: gmapsCity,
          area: selectedArea,
          comprehensive: facebookComprehensive,
          preciseMode: facebookPreciseMode,
          includeKeywords: facebookIncludeKeywords,
          excludeKeywords: facebookExcludeKeywords,
        }),
      });

      if (!buildRes.ok) {
        const err = await buildRes.json();
        throw new Error(err.error || (language === 'ar' ? 'فشل تجهيز الاستعلامات' : 'Failed to build queries'));
      }

      const buildData = await buildRes.json();
      const queries: string[] = buildData.queries || [];
      if (queries.length === 0) {
        throw new Error(language === 'ar' ? 'لا توجد استعلامات للبحث' : 'No queries to search');
      }

      const allLeads: ScrapedLead[] = [];
      const seenKeys = new Set<string>();
      const stats: { query: string; found: number; new: number }[] = [];
      const failedQueries: { queryText: string; label: string; engineUsed: number; statIdx: number }[] = [];

      const runQuery = async (queryText: string, engineHint: number): Promise<{ leads: ScrapedLead[]; total: number } | null> => {
        try {
          const res = await fetch('/api/scrape/facebook/search-single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryText, engineHint }),
          });
          if (res.ok) return await res.json();
        } catch {
          // ignore per-query failure and continue
        }
        return null;
      };

      for (let i = 0; i < queries.length; i++) {
        const queryText = queries[i];
        const label = queryText.length > 45 ? `${queryText.slice(0, 45)}...` : queryText;

        setProgressMsg(`${i + 1}/${queries.length} — ${label}`);
        setProgressPercent(Math.round((i / queries.length) * 100));

        if (i > 0) {
          const delay = 800 + Math.floor(Math.random() * 1200);
          await new Promise(r => setTimeout(r, delay));
        }

        const engineHint = (i % 3) + 1;
        const data = await runQuery(queryText, engineHint);
        if (!data || (data.total || 0) === 0) {
          stats.push({ query: label, found: 0, new: 0 });
          failedQueries.push({ queryText, label, engineUsed: engineHint, statIdx: stats.length - 1 });
          setQueryStats([...stats]);
          setQueriesRun(i + 1);
          continue;
        }

        const querySearchLink = buildFacebookSearchUrl(queryText);
        let newCountPerQuery = 0;
        for (const lead of data.leads || []) {
          const phoneKey = (lead.phone || '').replace(/[\s\-]+/g, '').trim();
          const nameKey = (lead.company_name || '').toLowerCase().trim();
          const dedupeKey = phoneKey || nameKey;
          if (!dedupeKey || seenKeys.has(dedupeKey)) continue;
          seenKeys.add(dedupeKey);
          allLeads.push({
            ...lead,
            industry: lead.industry || industry,
            city: lead.city || selectedArea || gmapsCity,
            search_link: buildPreferredFacebookLeadLink(lead, queryText, selectedArea || gmapsCity) || querySearchLink || effectiveSearchLink,
            selected: !!lead.phone && !lead.alreadySaved,
          });
          newCountPerQuery++;
        }

        setResults([...allLeads]);
        stats.push({ query: label, found: data.total || 0, new: newCountPerQuery });
        setQueryStats([...stats]);
        setQueriesRun(i + 1);
      }

      // Smart retry for zero-result queries using another engine with longer delay.
      if (failedQueries.length > 0) {
        const retryBatch = failedQueries.slice(0, Math.min(failedQueries.length, 30));
        for (let r = 0; r < retryBatch.length; r++) {
          const item = retryBatch[r];
          const retryEngine = item.engineUsed === 3 ? 1 : item.engineUsed + 1;
          const delay = 1500 + Math.floor(Math.random() * 1800);
          await new Promise(res => setTimeout(res, delay));
          setProgressMsg(
            `${language === 'ar' ? 'إعادة' : 'Retry'} ${r + 1}/${retryBatch.length} — ${item.label}`,
          );

          const data = await runQuery(item.queryText, retryEngine);
          if (!data || (data.total || 0) === 0) continue;

          const querySearchLink = buildFacebookSearchUrl(item.queryText);
          let newCountPerRetry = 0;
          for (const lead of data.leads || []) {
            const phoneKey = (lead.phone || '').replace(/[\s\-]+/g, '').trim();
            const nameKey = (lead.company_name || '').toLowerCase().trim();
            const dedupeKey = phoneKey || nameKey;
            if (!dedupeKey || seenKeys.has(dedupeKey)) continue;
            seenKeys.add(dedupeKey);
            allLeads.push({
              ...lead,
              industry: lead.industry || industry,
              city: lead.city || selectedArea || gmapsCity,
              search_link: buildPreferredFacebookLeadLink(lead, item.queryText, selectedArea || gmapsCity) || querySearchLink || effectiveSearchLink,
              selected: !!lead.phone && !lead.alreadySaved,
            });
            newCountPerRetry++;
          }

          stats[item.statIdx] = {
            query: item.label,
            found: data.total || 0,
            new: newCountPerRetry,
          };
          setResults([...allLeads]);
          setQueryStats([...stats]);
        }
      }

      setProgressPercent(100);
      const withPhone = allLeads.filter(l => l.phone).length;
      const withoutPhone = allLeads.length - withPhone;
      const newCount = allLeads.filter(l => !l.alreadySaved).length;
      const alreadySaved = allLeads.filter(l => l.alreadySaved).length;
      setSearchStats({
        total: allLeads.length,
        totalScraped: allLeads.length,
        withPhone,
        withoutPhone,
        newLeads: newCount,
        alreadySaved,
        queriesRun: queries.length,
        source: language === 'ar'
          ? (facebookPreciseMode ? 'Facebook (بحث دقيق)' : (facebookComprehensive ? 'Facebook (بحث شامل)' : 'Facebook'))
          : (facebookPreciseMode ? 'Facebook (Precise)' : (facebookComprehensive ? 'Facebook (Comprehensive)' : 'Facebook')),
      });

      if (allLeads.length > 0) {
        toast.success(language === 'ar'
          ? `تم العثور على ${newCount} عميل جديد من Facebook (${withPhone} برقم هاتف)`
          : `Found ${newCount} new leads from Facebook (${withPhone} with phone)`);
      } else {
        toast.warning(language === 'ar'
          ? 'لم يتم العثور على نتائج — جرّب كلمات مختلفة'
          : 'No results found — try different keywords');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (language === 'ar' ? 'خطأ في البحث' : 'Search failed');
      toast.error(msg);
    } finally {
      setIsSearching(false);
      setProgressMsg('');
    }
  };

  // Search LinkedIn using batched multi-query mode (similar to Google Maps comprehensive flow)
  const searchLinkedIn = async () => {
    setIsSearching(true);
    setSaveResult(null);
    setResults([]);
    setSearchStats(null);
    setQueryStats([]);
    setQueriesRun(0);
    setLinkedinResultView('all');
    setProgressMsg(language === 'ar' ? 'جاري البحث في LinkedIn...' : 'Searching LinkedIn...');
    setProgressPercent(0);

    const selectedArea = gmapsArea && gmapsArea !== 'all' ? gmapsArea : '';
    const searchQuery = (gmapsQuery || `${industry} ${selectedArea || gmapsCity}`).trim();
    const fallbackSearchLink = buildLinkedInSearchUrl(searchQuery);
    const effectiveSearchLink = linkedinSearchLink.trim() || fallbackSearchLink;
    if (!linkedinSearchLink.trim() && effectiveSearchLink) {
      setLinkedinSearchLink(effectiveSearchLink);
    }

    try {
      if (!searchQuery) {
        throw new Error(language === 'ar' ? 'يرجى إدخال كلمة بحث' : 'Please enter a search query');
      }
      if (linkedinPreciseMode && !selectedArea && !gmapsCity.trim()) {
        throw new Error(language === 'ar' ? 'في وضع البحث الدقيق يجب تحديد المدينة أو المنطقة' : 'In precise mode, city or area is required');
      }

      const buildRes = await fetch('/api/scrape/linkedin/build-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          city: gmapsCity,
          area: selectedArea,
          comprehensive: linkedinComprehensive,
          preciseMode: linkedinPreciseMode,
          includeKeywords: linkedinIncludeKeywords,
          excludeKeywords: linkedinExcludeKeywords,
        }),
      });

      if (!buildRes.ok) {
        const err = await buildRes.json();
        throw new Error(err.error || (language === 'ar' ? 'فشل تجهيز الاستعلامات' : 'Failed to build queries'));
      }

      const buildData = await buildRes.json();
      const queries: string[] = buildData.queries || [];
      if (queries.length === 0) {
        throw new Error(language === 'ar' ? 'لا توجد استعلامات للبحث' : 'No queries to search');
      }

      const allLeads: ScrapedLead[] = [];
      const seenKeys = new Set<string>();
      const stats: { query: string; found: number; new: number }[] = [];
      const failedQueries: { queryText: string; label: string; engineUsed: number; statIdx: number }[] = [];

      const runQuery = async (queryText: string, engineHint: number): Promise<{ leads: ScrapedLead[]; total: number } | null> => {
        try {
          const res = await fetch('/api/scrape/linkedin/search-single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryText, engineHint }),
          });
          if (res.ok) return await res.json();
        } catch {
          // ignore per-query failure and continue
        }
        return null;
      };

      for (let i = 0; i < queries.length; i++) {
        const queryText = queries[i];
        const label = queryText.length > 45 ? `${queryText.slice(0, 45)}...` : queryText;

        setProgressMsg(`${i + 1}/${queries.length} — ${label}`);
        setProgressPercent(Math.round((i / queries.length) * 100));

        if (i > 0) {
          const delay = 800 + Math.floor(Math.random() * 1200);
          await new Promise(r => setTimeout(r, delay));
        }

        const engineHint = (i % 3) + 1;
        const data = await runQuery(queryText, engineHint);
        if (!data || (data.total || 0) === 0) {
          stats.push({ query: label, found: 0, new: 0 });
          failedQueries.push({ queryText, label, engineUsed: engineHint, statIdx: stats.length - 1 });
          setQueryStats([...stats]);
          setQueriesRun(i + 1);
          continue;
        }

        const querySearchLink = buildLinkedInSearchUrl(queryText);
        let newCountPerQuery = 0;
        for (const lead of data.leads || []) {
          const phoneKey = (lead.phone || '').replace(/[\s\-]+/g, '').trim();
          const nameKey = (lead.company_name || '').toLowerCase().trim();
          const dedupeKey = phoneKey || nameKey;
          if (!dedupeKey || seenKeys.has(dedupeKey)) continue;
          seenKeys.add(dedupeKey);
          allLeads.push({
            ...lead,
            industry: lead.industry || industry,
            city: lead.city || selectedArea || gmapsCity,
            search_link: buildPreferredLinkedInLeadLink(lead, queryText, selectedArea || gmapsCity) || querySearchLink || effectiveSearchLink,
            selected: !!lead.phone && !lead.alreadySaved,
          });
          newCountPerQuery++;
        }

        setResults([...allLeads]);
        stats.push({ query: label, found: data.total || 0, new: newCountPerQuery });
        setQueryStats([...stats]);
        setQueriesRun(i + 1);
      }

      // Smart retry for zero-result queries using another engine with longer delay.
      if (failedQueries.length > 0) {
        const retryBatch = failedQueries.slice(0, Math.min(failedQueries.length, 30));
        for (let r = 0; r < retryBatch.length; r++) {
          const item = retryBatch[r];
          const retryEngine = item.engineUsed === 3 ? 1 : item.engineUsed + 1;
          const delay = 1500 + Math.floor(Math.random() * 1800);
          await new Promise(res => setTimeout(res, delay));
          setProgressMsg(
            `${language === 'ar' ? 'إعادة' : 'Retry'} ${r + 1}/${retryBatch.length} — ${item.label}`,
          );

          const data = await runQuery(item.queryText, retryEngine);
          if (!data || (data.total || 0) === 0) continue;

          const querySearchLink = buildLinkedInSearchUrl(item.queryText);
          let newCountPerRetry = 0;
          for (const lead of data.leads || []) {
            const phoneKey = (lead.phone || '').replace(/[\s\-]+/g, '').trim();
            const nameKey = (lead.company_name || '').toLowerCase().trim();
            const dedupeKey = phoneKey || nameKey;
            if (!dedupeKey || seenKeys.has(dedupeKey)) continue;
            seenKeys.add(dedupeKey);
            allLeads.push({
              ...lead,
              industry: lead.industry || industry,
              city: lead.city || selectedArea || gmapsCity,
              search_link: buildPreferredLinkedInLeadLink(lead, item.queryText, selectedArea || gmapsCity) || querySearchLink || effectiveSearchLink,
              selected: !!lead.phone && !lead.alreadySaved,
            });
            newCountPerRetry++;
          }

          stats[item.statIdx] = {
            query: item.label,
            found: data.total || 0,
            new: newCountPerRetry,
          };
          setResults([...allLeads]);
          setQueryStats([...stats]);
        }
      }

      setProgressPercent(100);
      const withPhone = allLeads.filter(l => l.phone).length;
      const withoutPhone = allLeads.length - withPhone;
      const newCount = allLeads.filter(l => !l.alreadySaved).length;
      const alreadySaved = allLeads.filter(l => l.alreadySaved).length;
      setSearchStats({
        total: allLeads.length,
        totalScraped: allLeads.length,
        withPhone,
        withoutPhone,
        newLeads: newCount,
        alreadySaved,
        queriesRun: queries.length,
        source: language === 'ar'
          ? (linkedinPreciseMode ? 'LinkedIn (بحث دقيق)' : (linkedinComprehensive ? 'LinkedIn (بحث شامل)' : 'LinkedIn'))
          : (linkedinPreciseMode ? 'LinkedIn (Precise)' : (linkedinComprehensive ? 'LinkedIn (Comprehensive)' : 'LinkedIn')),
      });

      if (allLeads.length > 0) {
        toast.success(language === 'ar'
          ? `تم العثور على ${newCount} عميل جديد من LinkedIn (${withPhone} برقم هاتف)`
          : `Found ${newCount} new leads from LinkedIn (${withPhone} with phone)`);
      } else {
        toast.warning(language === 'ar'
          ? 'لم يتم العثور على نتائج — جرّب كلمات مختلفة'
          : 'No results found — try different keywords');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (language === 'ar' ? 'خطأ في البحث' : 'Search failed');
      toast.error(msg);
    } finally {
      setIsSearching(false);
      setProgressMsg('');
    }
  };

  // Save selected leads to database
  const saveLeads = async () => {
    const selectedArea = gmapsArea && gmapsArea !== 'all' ? gmapsArea : '';
    const fallbackSearchQuery = (gmapsQuery || `${industry} في ${selectedArea || gmapsCity}`).trim();
    const fallbackSearchLink = gmapsSearchLink.trim() || buildGoogleMapsSearchUrl(fallbackSearchQuery);
    const fallbackFacebookSearchLink = facebookSearchLink.trim() || buildFacebookSearchUrl(fallbackSearchQuery);
    const fallbackLinkedInSearchLink = linkedinSearchLink.trim() || buildLinkedInSearchUrl(fallbackSearchQuery);
    const selected = results
      .filter(r => r.selected)
      .map((lead) => {
        if (lead.source === 'gmaps') {
          return { ...lead, search_link: lead.search_link || fallbackSearchLink };
        }
        if (lead.source === 'facebook') {
          const preferredFacebookLink = buildPreferredFacebookLeadLink(
            lead,
            fallbackSearchQuery,
            selectedArea || gmapsCity,
          );
          return { ...lead, search_link: preferredFacebookLink || fallbackFacebookSearchLink };
        }
        if (lead.source === 'linkedin') {
          const preferredLinkedInLink = buildPreferredLinkedInLeadLink(
            lead,
            fallbackSearchQuery,
            selectedArea || gmapsCity,
          );
          return { ...lead, search_link: preferredLinkedInLink || fallbackLinkedInSearchLink };
        }
        return lead;
      });
    if (selected.length === 0) {
      toast.error(language === 'ar' ? 'يرجى اختيار عملاء محتملين أولاً' : 'Please select leads first');
      return;
    }

    setIsSaving(true);
    setSaveResult(null);

    try {
      const res = await fetch('/api/scrape/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: selected,
          assignTo: assignTo || user?._id || '',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'فشل الحفظ');
      }

      const data = await res.json();
      setSaveResult(data);

      if (data.success > 0) {
        toast.success(language === 'ar'
          ? `تم حفظ ${data.success} عميل محتمل في قاعدة البيانات`
          : `Saved ${data.success} leads to database`);
        // Remove saved leads from results
        setResults(prev => prev.filter(r => !r.selected));
      }
      if (data.duplicates > 0) {
        toast.warning(language === 'ar'
          ? `${data.duplicates} عميل مكرر تم تجاهلهم`
          : `${data.duplicates} duplicates skipped`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطأ غير متوقع';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleVisibleAll = (checked: boolean) => {
    const visibleSet = new Set(visibleIndexes);
    setResults(prev => prev.map((r, i) => (visibleSet.has(i) ? { ...r, selected: checked } : r)));
  };

  const toggleOne = (idx: number) => {
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 group hover:bg-primary/20 transition-all duration-300">
            <Globe className="h-10 w-10 text-primary transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {language === 'ar' ? 'جمع البيانات' : 'Data Collection'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'ar'
                ? 'جمع بيانات العملاء المحتملين من مصادر متعددة'
                : 'Collect potential leads from multiple sources'}
            </p>
          </div>
        </div>
      </div>

      {/* Source Toggle */}
      <div className="flex gap-3">
        <Button
          variant={searchSource === 'gmaps' ? 'default' : 'outline'}
          onClick={() => setSearchSource('gmaps')}
          className="gap-2 flex-1"
          disabled={isSearching}
        >
          <Map className="h-4 w-4" />
          Google Maps
        </Button>
        <Button
          variant={searchSource === 'facebook' ? 'default' : 'outline'}
          onClick={() => setSearchSource('facebook')}
          className="gap-2 flex-1"
          disabled={isSearching}
        >
          <Globe className="h-4 w-4" />
          Facebook
        </Button>
        <Button
          variant={searchSource === 'linkedin' ? 'default' : 'outline'}
          onClick={() => setSearchSource('linkedin')}
          className="gap-2 flex-1"
          disabled={isSearching}
        >
          <Globe className="h-4 w-4" />
          LinkedIn
        </Button>
        <Button
          variant={searchSource === '140online' ? 'default' : 'outline'}
          onClick={() => setSearchSource('140online')}
          className="gap-2 flex-1"
          disabled={isSearching}
        >
          <Globe className="h-4 w-4" />
          {language === 'ar' ? 'دليل 140 أونلاين' : '140Online Directory'}
        </Button>
      </div>

      {/* 140Online Search */}
      {searchSource === '140online' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-emerald-600" />
              {language === 'ar' ? 'البحث في دليل 140 أونلاين' : 'Search 140Online Directory'}
            </CardTitle>
            <CardDescription>
              {language === 'ar'
                ? 'البحث في دليل الشركات المصرية 140online.com — يعرض اسم الشركة والعنوان والتليفون'
                : 'Search the Egyptian business directory 140online.com — shows company name, address, and phone'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Search className="size-4" /> {language === 'ar' ? 'كلمة البحث' : 'Search Query'}</Label>
              <Input
                placeholder={language === 'ar' ? 'مثال: عيادات، مطاعم، ترجمه، مقاولات...' : 'e.g. clinics, restaurants, translation...'}
                value={gmapsQuery}
                onChange={e => setGmapsQuery(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {language === 'ar'
                  ? 'أدخل اسم النشاط أو الشركة — سيتم البحث في الدليل وجلب بيانات الشركات تلقائياً'
                  : 'Enter industry or company name — will search the directory and fetch company data automatically'}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2"><Layers className="size-4" /> {language === 'ar' ? 'عدد الصفحات' : 'Pages to scan'}</Label>
                <span className="text-sm font-mono text-muted-foreground">{maxPages} {language === 'ar' ? 'صفحات (~' + (maxPages * 20) + ' شركة)' : 'pages (~' + (maxPages * 20) + ' companies)'}</span>
              </div>
              <input
                type="range"
                min="1"
                max="200"
                value={maxPages}
                onChange={e => setMaxPages(parseInt(e.target.value))}
                className="w-full accent-emerald-600"
              />
              <p className="text-xs text-muted-foreground">
                {language === 'ar'
                  ? 'كل صفحة تحتوي ~20 شركة — زيادة الصفحات تعطي نتائج أكثر لكن تستغرق وقتاً أطول'
                  : 'Each page has ~20 companies — more pages = more results but takes longer'}
              </p>
            </div>

            <Button onClick={search140Online} disabled={isSearching} className="gap-2" size="lg">
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {isSearching
                ? (language === 'ar' ? 'جاري البحث...' : 'Searching...')
                : (language === 'ar' ? 'بحث في دليل 140 أونلاين' : 'Search 140Online')}
            </Button>

            {/* Live Progress */}
            {isSearching && progressMsg && (
              <div className="space-y-2 p-4 rounded-xl border bg-gradient-to-r from-emerald-500/5 to-green-500/5 animate-in fade-in">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                  <span className="font-medium">{progressMsg}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-green-500 h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.max(progressPercent, 2)}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Facebook Search */}
      {searchSource === 'facebook' && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-600" />
            {language === 'ar' ? 'البحث في Facebook' : 'Search Facebook'}
          </CardTitle>
          <CardDescription>
            {language === 'ar'
              ? 'بحث شامل داخل Facebook باستخدام كلمات مفتاحية متعددة لتوسيع النتائج'
              : 'Comprehensive Facebook search using multiple keyword variations for wider coverage'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2"><Search className="size-4" /> {language === 'ar' ? 'كلمة البحث' : 'Search Query'}</Label>
              <Input
                placeholder={language === 'ar' ? 'مثال: مطاعم، عيادات، مقاولات...' : 'e.g. restaurants, clinics, construction...'}
                value={gmapsQuery}
                onChange={e => setGmapsQuery(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {language === 'ar'
                  ? 'سيتم البحث في Facebook بالكامل باستخدام نفس الكلمة بعدة صيغ'
                  : 'Will search across Facebook using multiple query variants'}
              </p>

              <div className="space-y-2 pt-2">
                <Label className="flex items-center gap-2"><ExternalLink className="size-4" /> {language === 'ar' ? 'رابط البحث' : 'Search Link'}</Label>
                <Input
                  placeholder={language === 'ar' ? 'https://www.facebook.com/search/...' : 'https://www.facebook.com/search/...'}
                  value={facebookSearchLink}
                  onChange={e => setFacebookSearchLink(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {language === 'ar'
                    ? 'يتم حفظ هذا الرابط مع النتائج داخل قاعدة البيانات'
                    : 'This link is saved with results in the database'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Map className="size-4" /> {language === 'ar' ? (facebookPreciseMode ? 'المدينة (مطلوب في الدقيق)' : 'المدينة (اختياري)') : (facebookPreciseMode ? 'City (required in precise mode)' : 'City (optional)')}</Label>
              <Select value={gmapsCity} onValueChange={(v) => { setGmapsCity(v); setGmapsArea(''); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CITIES_AR.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {CITY_AREAS[gmapsCity] && CITY_AREAS[gmapsCity].length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><MapPin className="size-4" /> {language === 'ar' ? 'المنطقة / الحي (اختياري)' : 'Area / Neighborhood (optional)'}</Label>
              <Select value={gmapsArea} onValueChange={setGmapsArea}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'كل المناطق' : 'All areas'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'كل المناطق' : 'All areas'}</SelectItem>
                  {CITY_AREAS[gmapsCity].map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between p-4 rounded-xl border bg-gradient-to-r from-purple-500/5 to-pink-500/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-600/10">
                <MapPin className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <Label htmlFor="facebook-precise" className="font-semibold cursor-pointer">
                  {language === 'ar' ? 'بحث دقيق (Precision Mode)' : 'Precise Search Mode'}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === 'ar'
                    ? 'يركّز على صفحات الشركات الرسمية ويقلل النتائج غير الدقيقة'
                    : 'Focuses on official business pages and reduces noisy results'}
                </p>
              </div>
            </div>
            <Switch
              id="facebook-precise"
              checked={facebookPreciseMode}
              onCheckedChange={setFacebookPreciseMode}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Plus className="size-4" /> {language === 'ar' ? 'كلمات تضمين إضافية (اختياري)' : 'Include Keywords (optional)'}</Label>
              <Input
                placeholder={language === 'ar' ? 'مثال: واتساب, الصفحة الرسمية, إدارة' : 'e.g. whatsapp, official page, management'}
                value={facebookIncludeKeywords}
                onChange={e => setFacebookIncludeKeywords(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {language === 'ar'
                  ? 'افصل الكلمات بفاصلة أو سطر جديد لزيادة دقة الاستهداف'
                  : 'Separate keywords by comma/new line for better targeting'}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Filter className="size-4" /> {language === 'ar' ? 'كلمات استبعاد (اختياري)' : 'Exclude Keywords (optional)'}</Label>
              <Input
                placeholder={language === 'ar' ? 'مثال: وظائف, جروب, career' : 'e.g. jobs, group, career'}
                value={facebookExcludeKeywords}
                onChange={e => setFacebookExcludeKeywords(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {language === 'ar'
                  ? 'تساعد في استبعاد نتائج غير مرغوبة مثل الوظائف والجروبات'
                  : 'Helps remove noisy results like jobs and groups'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border bg-gradient-to-r from-indigo-500/5 to-blue-500/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-600/10">
                <Layers className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <Label htmlFor="facebook-comprehensive" className="font-semibold cursor-pointer">
                  {language === 'ar' ? 'بحث شامل في Facebook' : 'Comprehensive Facebook Search'}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === 'ar'
                    ? 'يقسم البحث إلى استعلامات متعددة لتفادي حدود النتائج'
                    : 'Splits search into multiple queries to avoid result limits'}
                </p>
              </div>
            </div>
            <Switch
              id="facebook-comprehensive"
              checked={facebookComprehensive}
              onCheckedChange={setFacebookComprehensive}
            />
          </div>

          <Button onClick={searchFacebook} disabled={isSearching} className="gap-2" size="lg">
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (facebookComprehensive || facebookPreciseMode) ? (
              <Layers className="h-4 w-4" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {isSearching
              ? (language === 'ar' ? 'جاري البحث...' : 'Searching...')
              : (language === 'ar'
                ? (facebookPreciseMode ? 'بحث دقيق في Facebook' : (facebookComprehensive ? 'بحث شامل في Facebook' : 'بحث في Facebook'))
                : (facebookPreciseMode ? 'Precise Facebook Search' : (facebookComprehensive ? 'Comprehensive Facebook Search' : 'Search Facebook')))}
          </Button>

          {isSearching && progressMsg && (
            <div className="space-y-2 p-4 rounded-xl border bg-gradient-to-r from-indigo-500/5 to-blue-500/5 animate-in fade-in">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                <span className="font-medium">{progressMsg}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-blue-500 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(progressPercent, 2)}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* LinkedIn Search */}
      {searchSource === 'linkedin' && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-sky-600" />
            {language === 'ar' ? 'البحث في LinkedIn' : 'Search LinkedIn'}
          </CardTitle>
          <CardDescription>
            {language === 'ar'
              ? 'بحث شامل داخل LinkedIn باستخدام كلمات مفتاحية متعددة لتوسيع النتائج'
              : 'Comprehensive LinkedIn search using multiple keyword variations for wider coverage'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2"><Search className="size-4" /> {language === 'ar' ? 'كلمة البحث' : 'Search Query'}</Label>
              <Input
                placeholder={language === 'ar' ? 'مثال: شركات برمجيات، مقاولات، عيادات...' : 'e.g. software companies, construction, clinics...'}
                value={gmapsQuery}
                onChange={e => setGmapsQuery(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {language === 'ar'
                  ? 'سيتم البحث في LinkedIn بالكامل باستخدام نفس الكلمة بعدة صيغ'
                  : 'Will search across LinkedIn using multiple query variants'}
              </p>

              <div className="space-y-2 pt-2">
                <Label className="flex items-center gap-2"><ExternalLink className="size-4" /> {language === 'ar' ? 'رابط البحث' : 'Search Link'}</Label>
                <Input
                  placeholder={language === 'ar' ? 'https://www.linkedin.com/search/...' : 'https://www.linkedin.com/search/...'}
                  value={linkedinSearchLink}
                  onChange={e => setLinkedinSearchLink(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {language === 'ar'
                    ? 'يتم حفظ هذا الرابط مع النتائج داخل قاعدة البيانات'
                    : 'This link is saved with results in the database'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Map className="size-4" /> {language === 'ar' ? (linkedinPreciseMode ? 'المدينة (مطلوب في الدقيق)' : 'المدينة (اختياري)') : (linkedinPreciseMode ? 'City (required in precise mode)' : 'City (optional)')}</Label>
              <Select value={gmapsCity} onValueChange={(v) => { setGmapsCity(v); setGmapsArea(''); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CITIES_AR.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {CITY_AREAS[gmapsCity] && CITY_AREAS[gmapsCity].length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><MapPin className="size-4" /> {language === 'ar' ? 'المنطقة / الحي (اختياري)' : 'Area / Neighborhood (optional)'}</Label>
              <Select value={gmapsArea} onValueChange={setGmapsArea}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'كل المناطق' : 'All areas'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'كل المناطق' : 'All areas'}</SelectItem>
                  {CITY_AREAS[gmapsCity].map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between p-4 rounded-xl border bg-gradient-to-r from-blue-500/5 to-indigo-500/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-600/10">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <Label htmlFor="linkedin-precise" className="font-semibold cursor-pointer">
                  {language === 'ar' ? 'بحث دقيق (Precision Mode)' : 'Precise Search Mode'}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === 'ar'
                    ? 'يركّز على صفحات الشركات/الملفات الرسمية ويقلل النتائج العامة'
                    : 'Focuses on official company/profile pages and reduces generic noise'}
                </p>
              </div>
            </div>
            <Switch
              id="linkedin-precise"
              checked={linkedinPreciseMode}
              onCheckedChange={setLinkedinPreciseMode}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Plus className="size-4" /> {language === 'ar' ? 'كلمات تضمين إضافية (اختياري)' : 'Include Keywords (optional)'}</Label>
              <Input
                placeholder={language === 'ar' ? 'مثال: company, official, hr, sales' : 'e.g. company, official, hr, sales'}
                value={linkedinIncludeKeywords}
                onChange={e => setLinkedinIncludeKeywords(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {language === 'ar'
                  ? 'افصل الكلمات بفاصلة أو سطر جديد لرفع دقة النتائج'
                  : 'Separate keywords by comma/new line to improve targeting'}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Filter className="size-4" /> {language === 'ar' ? 'كلمات استبعاد (اختياري)' : 'Exclude Keywords (optional)'}</Label>
              <Input
                placeholder={language === 'ar' ? 'مثال: jobs, hiring, internship' : 'e.g. jobs, hiring, internship'}
                value={linkedinExcludeKeywords}
                onChange={e => setLinkedinExcludeKeywords(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {language === 'ar'
                  ? 'تقلل ضوضاء نتائج الوظائف والصفحات غير المستهدفة'
                  : 'Reduces noise from jobs and non-target pages'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border bg-gradient-to-r from-sky-500/5 to-cyan-500/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-600/10">
                <Layers className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <Label htmlFor="linkedin-comprehensive" className="font-semibold cursor-pointer">
                  {language === 'ar' ? 'بحث شامل في LinkedIn' : 'Comprehensive LinkedIn Search'}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === 'ar'
                    ? 'يقسم البحث إلى استعلامات متعددة لتفادي حدود النتائج'
                    : 'Splits search into multiple queries to avoid result limits'}
                </p>
              </div>
            </div>
            <Switch
              id="linkedin-comprehensive"
              checked={linkedinComprehensive}
              onCheckedChange={setLinkedinComprehensive}
            />
          </div>

          <Button onClick={searchLinkedIn} disabled={isSearching} className="gap-2" size="lg">
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (linkedinComprehensive || linkedinPreciseMode) ? (
              <Layers className="h-4 w-4" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {isSearching
              ? (language === 'ar' ? 'جاري البحث...' : 'Searching...')
              : (language === 'ar'
                ? (linkedinPreciseMode ? 'بحث دقيق في LinkedIn' : (linkedinComprehensive ? 'بحث شامل في LinkedIn' : 'بحث في LinkedIn'))
                : (linkedinPreciseMode ? 'Precise LinkedIn Search' : (linkedinComprehensive ? 'Comprehensive LinkedIn Search' : 'Search LinkedIn')))}
          </Button>

          {isSearching && progressMsg && (
            <div className="space-y-2 p-4 rounded-xl border bg-gradient-to-r from-sky-500/5 to-cyan-500/5 animate-in fade-in">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                <span className="font-medium">{progressMsg}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-sky-500 to-cyan-500 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(progressPercent, 2)}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Google Maps Search */}
      {searchSource === 'gmaps' && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5 text-blue-600" />
            {language === 'ar' ? 'البحث في Google Maps' : 'Search Google Maps'}
          </CardTitle>
          <CardDescription>
            {language === 'ar'
              ? 'جمع بيانات الأماكن مباشرة من Google Maps — بدون مفتاح API'
              : 'Collect business data directly from Google Maps — no API key needed'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2"><Search className="size-4" /> {language === 'ar' ? 'كلمة البحث' : 'Search Query'}</Label>
              <Input
                placeholder={language === 'ar' ? 'مثال: عيادات أسنان في القاهرة' : 'e.g. dental clinics in Cairo'}
                value={gmapsQuery}
                onChange={e => setGmapsQuery(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {language === 'ar'
                  ? 'اتركه فارغاً لاستخدام النشاط والمدينة المحددين'
                  : 'Leave empty to use selected industry + city'}
              </p>

              <div className="space-y-2 pt-2">
                <Label className="flex items-center gap-2"><ExternalLink className="size-4" /> {language === 'ar' ? 'رابط البحث' : 'Search Link'}</Label>
                <Input
                  placeholder={language === 'ar' ? 'https://www.google.com/maps/search/...' : 'https://www.google.com/maps/search/...'}
                  value={gmapsSearchLink}
                  onChange={e => setGmapsSearchLink(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {language === 'ar'
                    ? 'يتم حفظ هذا الرابط مع النتائج داخل قاعدة البيانات'
                    : 'This link is saved with the results in the database'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Map className="size-4" /> {language === 'ar' ? 'المدينة' : 'City'}</Label>
              <Select value={gmapsCity} onValueChange={(v) => { setGmapsCity(v); setGmapsArea(''); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CITIES_AR.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Area/Neighborhood Selector */}
          {CITY_AREAS[gmapsCity] && CITY_AREAS[gmapsCity].length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><MapPin className="size-4" /> {language === 'ar' ? 'المنطقة / الحي (اختياري)' : 'Area / Neighborhood (optional)'}</Label>
              <Select value={gmapsArea} onValueChange={setGmapsArea}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'كل المناطق' : 'All areas'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'كل المناطق' : 'All areas'}</SelectItem>
                  {CITY_AREAS[gmapsCity].map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {language === 'ar'
                  ? 'اختر منطقة محددة للبحث الشامل داخلها — أو اتركها لكل المناطق'
                  : 'Pick a specific area for focused comprehensive search — or leave for all areas'}
              </p>
            </div>
          )}

          {/* Comprehensive Search Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border bg-gradient-to-r from-blue-500/5 to-purple-500/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-600/10">
                <Layers className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="comprehensive" className="font-semibold cursor-pointer">
                    {language === 'ar'
                      ? (gmapsArea && gmapsArea !== 'all' ? `بحث شامل داخل ${gmapsArea}` : 'بحث شامل (جميع المناطق)')
                      : (gmapsArea && gmapsArea !== 'all' ? `Comprehensive Search in ${gmapsArea}` : 'Comprehensive Search (All Areas)')}
                  </Label>
                  <Badge variant="secondary" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    MAX
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === 'ar'
                    ? (gmapsArea && gmapsArea !== 'all'
                      ? `بحث متعدد بطرق مختلفة داخل ${gmapsArea} للحصول على أكبر عدد من النتائج`
                      : 'بحث تلقائي في جميع أحياء ومناطق المدينة للحصول على أكبر عدد من النتائج — يستغرق وقتاً أطول')
                    : (gmapsArea && gmapsArea !== 'all'
                      ? `Multiple search variations within ${gmapsArea} for maximum results`
                      : 'Automatically searches all city neighborhoods for maximum results — takes longer')}
                </p>
              </div>
            </div>
            <Switch
              id="comprehensive"
              checked={comprehensive}
              onCheckedChange={setComprehensive}
            />
          </div>

          {comprehensive && (
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
              <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
              <span>
                {language === 'ar'
                  ? `سيتم البحث في المدينة الرئيسية + جميع الأحياء والمناطق الفرعية تلقائياً. قد يستغرق البحث عدة دقائق.`
                  : 'Will search main city + all sub-areas automatically. This may take several minutes.'}
              </span>
            </div>
          )}

          <Button onClick={searchGMaps} disabled={isSearching} className="gap-2" size="lg">
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : comprehensive ? (
              <Layers className="h-4 w-4" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {isSearching
              ? (language === 'ar'
                ? (comprehensive ? 'جاري البحث الشامل...' : 'جاري البحث...')
                : (comprehensive ? 'Comprehensive search in progress...' : 'Searching...'))
              : (language === 'ar'
                ? (comprehensive ? 'بحث شامل في Google Maps' : 'بحث في Google Maps')
                : (comprehensive ? 'Comprehensive Google Maps Search' : 'Search Google Maps'))}
          </Button>

          {/* Live Progress Bar */}
          {isSearching && progressMsg && (
            <div className="space-y-2 p-4 rounded-xl border bg-gradient-to-r from-blue-500/5 to-green-500/5 animate-in fade-in">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="font-medium">{progressMsg}</span>
                </div>
                {comprehensive && progressPercent > 0 && (
                  <span className="text-muted-foreground font-mono text-xs">
                    {progressPercent}%
                  </span>
                )}
              </div>
              {comprehensive && (
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.max(progressPercent, 2)}%` }}
                  />
                </div>
              )}
              {results.length > 0 && (
                <p className="text-xs text-green-600 font-medium">
                  {language === 'ar' 
                    ? `✓ تم العثور على ${results.length} نتيجة حتى الآن...`
                    : `✓ Found ${results.length} results so far...`}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Search Stats */}
      {searchStats && (
        <div className={`grid grid-cols-1 gap-4 ${searchStats.withoutPhone !== undefined ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Database className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{searchStats.totalScraped || searchStats.total}</p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'إجمالي النتائج' : 'Total Scraped'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Phone className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{searchStats.withPhone}</p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'لديهم رقم هاتف' : 'With Phone Number'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="text-2xl font-bold">{searchStats.newLeads ?? searchStats.total}</p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'عملاء جدد' : 'New Leads'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{searchStats.alreadySaved || 0}</p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'محفوظ مسبقاً' : 'Already Saved'}
                </p>
              </div>
            </CardContent>
          </Card>
          {searchStats.withoutPhone !== undefined && (
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">{searchStats.withoutPhone}</p>
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'بدون رقم هاتف' : 'No Phone Number'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Comprehensive Search Area Breakdown */}
      {queryStats.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              {language === 'ar'
                ? (searchSource === 'gmaps'
                  ? `تفاصيل البحث الشامل (${queryStats.length} منطقة)`
                  : `تفاصيل الاستعلامات (${queryStats.length})`)
                : (searchSource === 'gmaps'
                  ? `Comprehensive Search Details (${queryStats.length} areas)`
                  : `Query Breakdown (${queryStats.length})`)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {queryStats.map((qs, idx) => (
                <div key={idx} className={`flex items-center justify-between p-2 rounded-lg text-xs border ${qs.new > 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/30 border-muted'}`}>
                  <span className="truncate font-medium" title={qs.query}>
                    {qs.query.length > 25 ? qs.query.slice(0, 25) + '…' : qs.query}
                  </span>
                  <Badge variant={qs.new > 0 ? 'default' : 'secondary'} className="text-xs ml-1 shrink-0">
                    {qs.new}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Result Banner */}
      {saveResult && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <h3 className="font-bold text-lg">
                {language === 'ar' ? 'تم الحفظ بنجاح' : 'Saved Successfully'}
              </h3>
            </div>
            <div className="flex gap-6 text-sm">
              <span className="text-green-600 font-medium">✓ {saveResult.success} {language === 'ar' ? 'تم حفظهم' : 'saved'}</span>
              {saveResult.duplicates > 0 && <span className="text-yellow-600">⚠ {saveResult.duplicates} {language === 'ar' ? 'مكرر' : 'duplicates'}</span>}
              {saveResult.noPhone > 0 && <span className="text-orange-600">📵 {saveResult.noPhone} {language === 'ar' ? 'بدون هاتف' : 'no phone'}</span>}
              {saveResult.failed > 0 && <span className="text-red-600">✗ {saveResult.failed} {language === 'ar' ? 'فشل' : 'failed'}</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <CardTitle>
                  {language === 'ar' ? `النتائج (${visibleRows.length}/${results.length})` : `Results (${visibleRows.length}/${results.length})`}
                </CardTitle>
                {hasFacebookResults && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={facebookResultView === 'all' ? 'default' : 'outline'}
                      onClick={() => setFacebookResultView('all')}
                    >
                      {language === 'ar'
                        ? `الكل (${results.filter(r => r.source === 'facebook').length})`
                        : `All (${results.filter(r => r.source === 'facebook').length})`}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={facebookResultView === 'withPhone' ? 'default' : 'outline'}
                      onClick={() => setFacebookResultView('withPhone')}
                    >
                      {language === 'ar'
                        ? `مع هاتف (${results.filter(r => r.source === 'facebook' && !!r.phone).length})`
                        : `With Phone (${results.filter(r => r.source === 'facebook' && !!r.phone).length})`}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={facebookResultView === 'withoutPhone' ? 'default' : 'outline'}
                      onClick={() => setFacebookResultView('withoutPhone')}
                    >
                      {language === 'ar'
                        ? `بدون هاتف (${results.filter(r => r.source === 'facebook' && !r.phone).length})`
                        : `No Phone (${results.filter(r => r.source === 'facebook' && !r.phone).length})`}
                    </Button>
                  </div>
                )}
                {hasLinkedInResults && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={linkedinResultView === 'all' ? 'default' : 'outline'}
                      onClick={() => setLinkedinResultView('all')}
                    >
                      {language === 'ar'
                        ? `الكل (${results.filter(r => r.source === 'linkedin').length})`
                        : `All (${results.filter(r => r.source === 'linkedin').length})`}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={linkedinResultView === 'withPhone' ? 'default' : 'outline'}
                      onClick={() => setLinkedinResultView('withPhone')}
                    >
                      {language === 'ar'
                        ? `مع هاتف (${results.filter(r => r.source === 'linkedin' && !!r.phone).length})`
                        : `With Phone (${results.filter(r => r.source === 'linkedin' && !!r.phone).length})`}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={linkedinResultView === 'withoutPhone' ? 'default' : 'outline'}
                      onClick={() => setLinkedinResultView('withoutPhone')}
                    >
                      {language === 'ar'
                        ? `بدون هاتف (${results.filter(r => r.source === 'linkedin' && !r.phone).length})`
                        : `No Phone (${results.filter(r => r.source === 'linkedin' && !r.phone).length})`}
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* Assign To */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">
                    {language === 'ar' ? 'تعيين إلى:' : 'Assign to:'}
                  </Label>
                  <Select value={assignTo} onValueChange={setAssignTo}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder={language === 'ar' ? 'اختر موظف' : 'Select user'} />
                    </SelectTrigger>
                    <SelectContent>
                      {salesUsers.map(u => (
                        <SelectItem key={u._id} value={u._id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={saveLeads}
                  disabled={isSaving || visibleSelectedCount === 0}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {language === 'ar'
                    ? `حفظ ${visibleSelectedCount} عميل في قاعدة البيانات`
                    : `Save ${visibleSelectedCount} leads to database`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={visibleRows.length > 0 && visibleRows.every(r => r.lead.selected)}
                        onCheckedChange={(checked) => toggleVisibleAll(!!checked)}
                      />
                    </TableHead>
                    <TableHead>{language === 'ar' ? 'اسم الشركة' : 'Company'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الهاتف' : 'Phone'}</TableHead>
                    <TableHead>{language === 'ar' ? 'البريد' : 'Email'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الرابط' : 'Link'}</TableHead>
                    <TableHead>{language === 'ar' ? 'المدينة' : 'City'}</TableHead>
                    <TableHead>{language === 'ar' ? 'النشاط' : 'Industry'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map(({ lead, index }) => {
                    const selectedArea = gmapsArea && gmapsArea !== 'all' ? gmapsArea : gmapsCity;
                    const fallbackFacebookQuery = (gmapsQuery || `${industry} ${selectedArea}`).trim();
                    const fallbackLinkedInQuery = (gmapsQuery || `${industry} ${selectedArea}`).trim();
                    const leadLink = lead.source === 'facebook'
                      ? buildPreferredFacebookLeadLink(lead, fallbackFacebookQuery, selectedArea)
                      : lead.source === 'linkedin'
                      ? buildPreferredLinkedInLeadLink(lead, fallbackLinkedInQuery, selectedArea)
                      : lead.search_link || normalizeExternalUrl(lead.website || '');

                    return (
                    <TableRow key={index} className={lead.alreadySaved ? 'opacity-40 bg-muted/30' : lead.selected ? '' : 'opacity-50'}>
                      <TableCell>
                        <Checkbox
                          checked={lead.selected}
                          onCheckedChange={() => toggleOne(index)}
                          disabled={lead.alreadySaved}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                          {lead.company_name}
                          {lead.alreadySaved && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-500/30 text-xs shrink-0">
                              {language === 'ar' ? 'محفوظ' : 'Saved'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.phone ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <Phone className="h-3 w-3" />
                            <span dir="ltr">{lead.phone}</span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-orange-500 border-orange-500/30">
                            {language === 'ar' ? 'غير متوفر' : 'N/A'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.email ? (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{lead.email}</span>
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {leadLink ? (
                          <a
                            href={leadLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {language === 'ar' ? 'فتح' : 'Open'}
                          </a>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{lead.city}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{lead.industry}</Badge>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isSearching && results.length === 0 && !searchStats && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Globe className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">
              {language === 'ar' ? 'ابدأ بالبحث عن عملاء محتملين' : 'Start searching for potential leads'}
            </h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                {language === 'ar'
                ? 'اختر المصدر وكلمة البحث ثم ابدأ الجمع التلقائي للبيانات'
                : 'Choose a source and keyword, then start automatic data collection'}
              </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
