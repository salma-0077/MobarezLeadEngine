import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import * as cheerio from 'cheerio';
import serverless from 'serverless-http';

// Import models
import '../server/src/models/User.js';
import '../server/src/models/Lead.js';
import '../server/src/models/Call.js';
import '../server/src/models/Meeting.js';
import '../server/src/models/Activity.js';
import '../server/src/models/Settings.js';

// Import routes
import authRouter from '../server/src/routes/auth.js';
import leadsRouter from '../server/src/routes/leads.js';
import callsRouter from '../server/src/routes/calls.js';
import meetingsRouter from '../server/src/routes/meetings.js';
import usersRouter from '../server/src/routes/users.js';
import activitiesRouter from '../server/src/routes/activities.js';
import settingsRouter from '../server/src/routes/settings.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// MongoDB connection (reuse across invocations)
let isConnected = false;
async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGODB_URI, {
    serverApi: { version: '1', strict: true, deprecationErrors: true },
  });
  isConnected = true;
}

// Connect to DB before any route
app.use(async (req, res, next) => {
  try { await connectDB(); next(); }
  catch (err) { res.status(500).json({ error: 'Database connection failed' }); }
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/calls', callsRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/users', usersRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/settings', settingsRouter);

// Save scraped leads endpoint
const Lead = mongoose.model('Lead');
function buildGoogleMapsSearchUrl(query) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalizedQuery)}`;
}

function buildFacebookSearchUrl(query) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) return '';
  return `https://www.facebook.com/search/top?q=${encodeURIComponent(normalizedQuery)}`;
}

function buildLinkedInSearchUrl(query) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) return '';
  return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(normalizedQuery)}`;
}

app.post('/api/scrape/save', async (req, res) => {
  try {
    const { leads: leadsData, assignTo } = req.body;
    if (!Array.isArray(leadsData) || leadsData.length === 0) {
      return res.status(400).json({ error: 'leads array is required' });
    }

    let success = 0;
    let failed = 0;
    let duplicates = 0;
    let noPhone = 0;
    const created = [];

    for (const data of leadsData) {
      if (!data.company_name) { failed++; continue; }
      if (!data.phone) { noPhone++; continue; }

      try {
        const lead = await Lead.create({
          company_name: data.company_name,
          phone: String(data.phone).replace(/\s+/g, ''),
          email: data.email || '',
          website: data.website || '',
          search_link: data.search_link || '',
          industry: data.industry || 'غير محدد',
          city: data.city || 'غير محدد',
          source: data.source || 'gmaps',
          status: 'new',
          assigned_to: assignTo || '',
          notes: data.address ? `العنوان: ${data.address}` : '',
          rating: data.rating || 0,
        });
        created.push(lead);
        success++;
      } catch (err) {
        if (err.code === 11000) {
          duplicates++;
        } else {
          failed++;
        }
      }
    }

    res.status(201).json({ success, failed, duplicates, noPhone, leads: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Build queries endpoint — returns query list for frontend-managed batching
app.post('/api/scrape/gmaps/build-queries', async (req, res) => {
  try {
    const { searchQuery, city, industry, area, comprehensive: comp } = req.body;
    const selectedArea = area && area !== 'all' ? area : '';
    const rawTerm = searchQuery
      ? searchQuery.replace(new RegExp(`(في|فى|ب|بـ)\\s*(${(selectedArea||city||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}|${(city||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'g'), '').trim()
      : (industry || '');
    const baseTerm = searchQuery || `${industry || ''} في ${selectedArea || city || ''}`.trim();

    let queries = [baseTerm];
    if (comp) {
      if (selectedArea) {
        queries = buildAreaQueries(rawTerm, selectedArea, city);
      } else if (city) {
        const areas = CITY_AREAS_SERVER[city] || [];
        queries = [baseTerm, ...areas.map(a => `${rawTerm} في ${a}`)];
      }
      queries = [...new Set(queries.filter(q => q.trim()))];
    }
    res.json({ queries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single-query search endpoint (used by frontend for batched comprehensive search)
// engineHint: 0=auto-rotate, 1=brave, 2=google, 3=startpage
app.post('/api/scrape/gmaps/search-single', async (req, res) => {
  try {
    const { query, engineHint } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    const { businesses: results, _debug } = await scrapeLocalSearch(query, engineHint || 0);

    // Check existing leads
    const leads = results.map(biz => ({
      company_name: biz.name,
      phone: (biz.phone || '').replace(/[\s\-]+/g, ''),
      email: '',
      website: biz.website || '',
      search_link: buildGoogleMapsSearchUrl(query),
      industry: biz.category || '',
      city: '',
      source: 'gmaps',
      address: biz.address || '',
      rating: biz.rating || 0,
    }));

    const phones = leads.filter(l => l.phone).map(l => l.phone);
    const existingPhones = new Set();
    if (phones.length > 0) {
      const existing = await Lead.find({ phone: { $in: phones } }, 'phone');
      existing.forEach(e => existingPhones.add(e.phone));
    }

    res.json({
      leads: leads.map(l => ({
        ...l,
        alreadySaved: l.phone ? existingPhones.has(l.phone) : false,
        selected: l.phone ? !existingPhones.has(l.phone) : true,
      })),
      total: leads.length,
      withPhone: leads.filter(l => l.phone).length,
      _debug,
    });
  } catch (err) {
    console.error('[scrape/search-single] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Google Maps search via HTTP (serverless-compatible)
app.post('/api/scrape/gmaps/search', async (req, res) => {
  try {
    const { searchQuery, city, industry, area, comprehensive } = req.body;
    const selectedArea = area && area !== 'all' ? area : '';
    const baseTerm = searchQuery || `${industry || ''} في ${selectedArea || city || ''}`.trim();

    const rawTerm = searchQuery
      ? searchQuery.replace(new RegExp(`(في|فى|ب|بـ)\\s*(${(selectedArea||city||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}|${(city||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'g'), '').trim()
      : (industry || '');

    let queries = [baseTerm];
    if (comprehensive) {
      if (selectedArea) {
        queries = buildAreaQueries(rawTerm, selectedArea, city);
      } else if (city) {
        const areas = CITY_AREAS_SERVER[city] || [];
        queries = [baseTerm];
        for (const a of areas) {
          queries.push(`${rawTerm} في ${a}`);
        }
      }
      queries = [...new Set(queries.filter(q => q.trim()))];
    }

    const allResults = [];
    const seenNames = new Set();

    for (const query of queries) {
      try {
        const { businesses: results } = await scrapeLocalSearch(query);
        for (const biz of results) {
          const key = (biz.name || '').toLowerCase().trim();
          if (key && !seenNames.has(key)) {
            seenNames.add(key);
            allResults.push({
              company_name: biz.name,
              phone: (biz.phone || '').replace(/[\s\-]+/g, ''),
              email: '',
              website: biz.website || '',
              search_link: buildGoogleMapsSearchUrl(query),
              industry: industry || biz.category || '',
              city: selectedArea || city || '',
              source: 'gmaps',
              address: biz.address || '',
              rating: biz.rating || 0,
            });
          }
        }
      } catch (err) {
        console.error(`Scrape query "${query}" failed:`, err.message);
      }
    }

    const existingPhones = new Set();
    const phones = allResults.filter(r => r.phone).map(r => r.phone);
    if (phones.length > 0) {
      const existing = await Lead.find({ phone: { $in: phones } }, 'phone');
      existing.forEach(e => existingPhones.add(e.phone));
    }

    const leads = allResults.map(r => ({
      ...r,
      alreadySaved: r.phone ? existingPhones.has(r.phone) : false,
      selected: r.phone ? !existingPhones.has(r.phone) : true,
    }));

    res.json({
      leads,
      total: leads.length,
      withPhone: leads.filter(l => l.phone).length,
      newLeads: leads.filter(l => !l.alreadySaved).length,
      alreadySaved: leads.filter(l => l.alreadySaved).length,
    });
  } catch (err) {
    console.error('[scrape/search] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

function parseKeywordList(rawValue) {
  return String(rawValue || '')
    .split(/[\n,;|]+/g)
    .map(k => k.trim())
    .filter(Boolean)
    .slice(0, 15);
}

function applyKeywordModifiers(baseQuery, includeKeywords = [], excludeKeywords = []) {
  let query = String(baseQuery || '').trim();
  if (!query) return '';

  if (includeKeywords.length > 0) {
    query += ` ${includeKeywords.join(' ')}`;
  }
  if (excludeKeywords.length > 0) {
    query += ` ${excludeKeywords.map(k => (k.startsWith('-') ? k : `-${k}`)).join(' ')}`;
  }

  return query.trim();
}

function buildFacebookScopedQuery(query, enforceSite = true) {
  const normalized = String(query || '').trim();
  if (!normalized) return '';
  if (!enforceSite) return normalized;
  if (/site:\s*facebook\.com/i.test(normalized) || /facebook\.com/i.test(normalized)) {
    return normalized;
  }
  return `${normalized} site:facebook.com`;
}

// Build Facebook queries endpoint — returns query list for frontend-managed batching
app.post('/api/scrape/facebook/build-queries', async (req, res) => {
  try {
    const {
      query,
      city,
      area,
      comprehensive,
      preciseMode,
      includeKeywords,
      excludeKeywords,
    } = req.body;
    const baseQuery = String(query || '').trim();
    if (!baseQuery) return res.status(400).json({ error: 'query is required' });

    const isPreciseMode = Boolean(preciseMode);
    const cityName = String(city || '').trim();
    const selectedArea = area && area !== 'all' ? String(area).trim() : '';
    if (isPreciseMode && !selectedArea && !cityName) {
      return res.status(400).json({ error: 'city or area is required in precise mode' });
    }

    const includeTerms = parseKeywordList(includeKeywords);
    const userExcludeTerms = parseKeywordList(excludeKeywords);
    const preciseDefaultExclusions = isPreciseMode
      ? ['group', 'groups', 'jobs', 'career', 'vacancy', 'وظائف', 'توظيف', 'internship']
      : [];
    const excludeTerms = [...new Set([...userExcludeTerms, ...preciseDefaultExclusions])];

    let queries = [];
    const addQuery = (rawText, { scoped = true, unscoped = false } = {}) => {
      const normalizedText = String(rawText || '').trim();
      if (!normalizedText) return;
      const withModifiers = applyKeywordModifiers(normalizedText, includeTerms, excludeTerms);
      if (!withModifiers) return;
      if (scoped) queries.push(buildFacebookScopedQuery(withModifiers, true));
      if (unscoped) queries.push(buildFacebookScopedQuery(withModifiers, false));
    };

    // Base queries (scoped + unscoped) for wider recall.
    addQuery(baseQuery, { scoped: true, unscoped: true });
    addQuery(`${baseQuery} Facebook`, { scoped: true, unscoped: true });
    addQuery(`${baseQuery} facebook page`, { scoped: true, unscoped: true });

    if (comprehensive) {
      const variants = [
        `${baseQuery} صفحة فيسبوك`,
        `${baseQuery} facebook business page`,
        `${baseQuery} official facebook`,
        `${baseQuery} الصفحة الرسمية`,
        `${baseQuery} contact`,
        `${baseQuery} whatsapp`,
        `${baseQuery} messenger`,
        `${baseQuery} phone`,
        `${baseQuery} رقم هاتف`,
      ];
      if (!isPreciseMode) {
        variants.push(`${baseQuery} جروب فيسبوك`, `${baseQuery} facebook group`);
      }

      for (const variant of variants) {
        addQuery(variant, { scoped: true, unscoped: true });
      }

      if (selectedArea) {
        addQuery(`${baseQuery} ${selectedArea}`, { scoped: true, unscoped: true });
        addQuery(`${baseQuery} في ${selectedArea}`, { scoped: true, unscoped: true });
        addQuery(`${baseQuery} ${selectedArea} صفحة`, { scoped: true, unscoped: true });
      } else if (cityName) {
        addQuery(`${baseQuery} ${cityName}`, { scoped: true, unscoped: true });
        addQuery(`${baseQuery} في ${cityName}`, { scoped: true, unscoped: true });
        const areas = CITY_AREAS_SERVER[cityName] || [];
        for (const cityArea of areas) {
          addQuery(`${baseQuery} ${cityArea}`, { scoped: true, unscoped: !isPreciseMode });
        }
      }
    }

    if (isPreciseMode) {
      const focusLocation = selectedArea || cityName;
      if (focusLocation) {
        addQuery(`${baseQuery} ${focusLocation} صفحة رسمية`, { scoped: true, unscoped: true });
        addQuery(`${baseQuery} ${focusLocation} اتصل بنا`, { scoped: true, unscoped: true });
        addQuery(`${baseQuery} ${focusLocation} WhatsApp`, { scoped: true, unscoped: true });
      }

      // Extra strict variants to improve precision.
      addQuery(`${baseQuery} official page`, { scoped: true, unscoped: true });
      addQuery(`${baseQuery} business page`, { scoped: true, unscoped: true });
    }

    if (!comprehensive) {
      // In non-comprehensive mode we still keep small useful alternatives.
      addQuery(`${baseQuery} اتصل بنا`, { scoped: true, unscoped: true });
      if (selectedArea || cityName) {
        addQuery(`${baseQuery} ${selectedArea || cityName}`, { scoped: true, unscoped: true });
      }
    }

    queries = [...new Set(queries.map(q => q.trim()).filter(Boolean))].slice(0, isPreciseMode ? 110 : 140);

    if (queries.length === 0) {
      // fallback hard safety
      const fallback = buildFacebookScopedQuery(baseQuery, true);
      if (fallback) {
        queries = [fallback];
      } else {
        return res.status(400).json({ error: 'no valid queries generated' });
      }
    }

    res.json({
      queries,
      meta: {
        preciseMode: isPreciseMode,
        includeKeywords: includeTerms,
        excludeKeywords: excludeTerms,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single-query Facebook search endpoint (used by frontend for batched comprehensive search)
app.post('/api/scrape/facebook/search-single', async (req, res) => {
  try {
    const { query, engineHint } = req.body;
    const searchQuery = String(query || '').trim();
    if (!searchQuery) return res.status(400).json({ error: 'query is required' });

    const { businesses: results, _debug } = await scrapeLocalSearch(searchQuery, engineHint || 0);

    const leads = results.map(biz => ({
      company_name: biz.name,
      phone: (biz.phone || '').replace(/[\s\-]+/g, ''),
      email: '',
      website: biz.website || '',
      search_link: buildFacebookSearchUrl(query),
      industry: '',
      city: '',
      source: 'facebook',
      address: biz.address || '',
      rating: biz.rating || 0,
    }));

    const phones = leads.filter(l => l.phone).map(l => l.phone);
    const existingPhones = new Set();
    if (phones.length > 0) {
      const existing = await Lead.find({ phone: { $in: phones } }, 'phone');
      existing.forEach(e => existingPhones.add(e.phone));
    }

    res.json({
      leads: leads.map(l => ({
        ...l,
        alreadySaved: l.phone ? existingPhones.has(l.phone) : false,
        selected: l.phone ? !existingPhones.has(l.phone) : true,
      })),
      total: leads.length,
      withPhone: leads.filter(l => l.phone).length,
      _debug,
    });
  } catch (err) {
    console.error('[scrape/facebook/search-single] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

function buildLinkedInScopedQuery(query, enforceSite = true) {
  const normalized = String(query || '').trim();
  if (!normalized) return '';
  if (!enforceSite) return normalized;
  if (/site:\s*linkedin\.com/i.test(normalized) || /linkedin\.com/i.test(normalized)) {
    return normalized;
  }
  return `${normalized} site:linkedin.com`;
}

// Build LinkedIn queries endpoint — returns query list for frontend-managed batching
app.post('/api/scrape/linkedin/build-queries', async (req, res) => {
  try {
    const {
      query,
      city,
      area,
      comprehensive,
      preciseMode,
      includeKeywords,
      excludeKeywords,
    } = req.body;
    const baseQuery = String(query || '').trim();
    if (!baseQuery) return res.status(400).json({ error: 'query is required' });

    const isPreciseMode = Boolean(preciseMode);
    const cityName = String(city || '').trim();
    const selectedArea = area && area !== 'all' ? String(area).trim() : '';
    if (isPreciseMode && !selectedArea && !cityName) {
      return res.status(400).json({ error: 'city or area is required in precise mode' });
    }

    const includeTerms = parseKeywordList(includeKeywords);
    const userExcludeTerms = parseKeywordList(excludeKeywords);
    const preciseDefaultExclusions = isPreciseMode
      ? ['jobs', 'job', 'hiring', 'careers', 'internship', 'وظائف', 'توظيف', 'vacancy']
      : [];
    const excludeTerms = [...new Set([...userExcludeTerms, ...preciseDefaultExclusions])];

    let queries = [];
    const addQuery = (rawText, { scoped = true, unscoped = false } = {}) => {
      const normalizedText = String(rawText || '').trim();
      if (!normalizedText) return;
      const withModifiers = applyKeywordModifiers(normalizedText, includeTerms, excludeTerms);
      if (!withModifiers) return;
      if (scoped) queries.push(buildLinkedInScopedQuery(withModifiers, true));
      if (unscoped) queries.push(buildLinkedInScopedQuery(withModifiers, false));
    };

    // Base queries (scoped + unscoped) for better recall.
    addQuery(baseQuery, { scoped: true, unscoped: true });
    addQuery(`${baseQuery} LinkedIn`, { scoped: true, unscoped: true });
    addQuery(`${baseQuery} linkedin company`, { scoped: true, unscoped: true });

    if (comprehensive) {
      const variants = [
        `${baseQuery} linkedin profile`,
        `${baseQuery} linkedin page`,
        `${baseQuery} company profile`,
        `${baseQuery} company`,
        `${baseQuery} official page`,
        `${baseQuery} official linkedin`,
        `${baseQuery} employees`,
        `${baseQuery} management`,
        `${baseQuery} hr`,
        `${baseQuery} contact`,
      ];

      for (const variant of variants) {
        addQuery(variant, { scoped: true, unscoped: true });
      }

      if (selectedArea) {
        addQuery(`${baseQuery} ${selectedArea}`, { scoped: true, unscoped: true });
        addQuery(`${baseQuery} في ${selectedArea}`, { scoped: true, unscoped: true });
      } else if (cityName) {
        addQuery(`${baseQuery} ${cityName}`, { scoped: true, unscoped: true });
        addQuery(`${baseQuery} في ${cityName}`, { scoped: true, unscoped: true });
        const areas = CITY_AREAS_SERVER[cityName] || [];
        for (const cityArea of areas) {
          addQuery(`${baseQuery} ${cityArea}`, { scoped: true, unscoped: !isPreciseMode });
        }
      }
    }

    if (isPreciseMode) {
      const focusLocation = selectedArea || cityName;
      if (focusLocation) {
        addQuery(`${baseQuery} ${focusLocation} official`, { scoped: true, unscoped: true });
        addQuery(`${baseQuery} ${focusLocation} company profile`, { scoped: true, unscoped: true });
        addQuery(`${baseQuery} ${focusLocation} hr`, { scoped: true, unscoped: true });
      }
      addQuery(`${baseQuery} official company page`, { scoped: true, unscoped: true });
      addQuery(`${baseQuery} verified company`, { scoped: true, unscoped: true });
    }

    if (!comprehensive) {
      addQuery(`${baseQuery} company`, { scoped: true, unscoped: true });
      if (selectedArea || cityName) addQuery(`${baseQuery} ${selectedArea || cityName}`, { scoped: true, unscoped: true });
    }

    queries = [...new Set(queries.map(q => q.trim()).filter(Boolean))].slice(0, isPreciseMode ? 110 : 140);
    if (queries.length === 0) {
      const fallback = buildLinkedInScopedQuery(baseQuery, true);
      if (fallback) {
        queries = [fallback];
      } else {
        return res.status(400).json({ error: 'no valid queries generated' });
      }
    }

    res.json({
      queries,
      meta: {
        preciseMode: isPreciseMode,
        includeKeywords: includeTerms,
        excludeKeywords: excludeTerms,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single-query LinkedIn search endpoint (used by frontend for batched comprehensive search)
app.post('/api/scrape/linkedin/search-single', async (req, res) => {
  try {
    const { query, engineHint } = req.body;
    const searchQuery = String(query || '').trim();
    if (!searchQuery) return res.status(400).json({ error: 'query is required' });

    const { businesses: results, _debug } = await scrapeLocalSearch(searchQuery, engineHint || 0);

    const leads = results.map(biz => ({
      company_name: biz.name,
      phone: (biz.phone || '').replace(/[\s\-]+/g, ''),
      email: '',
      website: biz.website || '',
      search_link: buildLinkedInSearchUrl(query),
      industry: '',
      city: '',
      source: 'linkedin',
      address: biz.address || '',
      rating: biz.rating || 0,
    }));

    const phones = leads.filter(l => l.phone).map(l => l.phone);
    const existingPhones = new Set();
    if (phones.length > 0) {
      const existing = await Lead.find({ phone: { $in: phones } }, 'phone');
      existing.forEach(e => existingPhones.add(e.phone));
    }

    res.json({
      leads: leads.map(l => ({
        ...l,
        alreadySaved: l.phone ? existingPhones.has(l.phone) : false,
        selected: l.phone ? !existingPhones.has(l.phone) : true,
      })),
      total: leads.length,
      withPhone: leads.filter(l => l.phone).length,
      _debug,
    });
  } catch (err) {
    console.error('[scrape/linkedin/search-single] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// City areas for comprehensive search
const CITY_AREAS_SERVER = {
  'القاهرة': ['مدينة نصر','المعادي','الدقي','المهندسين','الزمالك','وسط البلد','مصر الجديدة','العباسية','شبرا','حلوان','التجمع الخامس','الرحاب','مدينتي','المقطم','عين شمس','النزهة','السيدة زينب','الدرب الاحمر','حدائق القبة','المرج','الشروق','بدر','العبور','الزيتون','روض الفرج','المطرية','بولاق','الوايلي','حدائق المعادي','دار السلام','طره','المعصرة','التبين','الخليفة','منشية ناصر','الساحل','شبرا الخيمة','الموسكي','الأزهر','جاردن سيتي','المنيل','الشيخ زايد','القطامية','البساتين','السلام','الأميرية','عزبة النخل','حدائق حلوان','15 مايو','الشرابية','الجمالية','غمرة','عابدين','باب الشعرية','الأزبكية','الحسين'],
  'الجيزة': ['الهرم','فيصل','6 اكتوبر','الشيخ زايد','حدائق الأهرام','العمرانية','الحوامدية','البدرشين','أبو النمرس','الوراق','إمبابة','الدقي','العجوزة','بولاق الدكرور','أوسيم','كرداسة','المنيب','الطالبية','ساقية مكي','حدائق الاهرام','الجيزة','المريوطية','أبو رواش','الصف','أطفيح','منشأة القناطر','الطوابق','أرض اللواء'],
  'الإسكندرية': ['سيدي جابر','سموحة','المنتزه','سيدي بشر','كليوباترا','رشدي','ستانلي','الابراهيمية','العصافرة','المندرة','جليم','لوران','محرم بك','العطارين','بحري','العجمي','الدخيلة','المعمورة','كامب شيزار','فليمنج','ميامي','أبو قير','المنشية','الشاطبي','باكوس','بولكلي','زيزينيا','الحضرة','كرموز','العامرية','برج العرب','المكس','سابا باشا','مصطفى كامل','الشلالات','الأميرية','سيدي كرير','الهانوفيل','غيط العنب','الورديان','النخيل','العوايد','الجمرك','الأنفوشي'],
  'المنصورة': ['المنصورة','ميت غمر','طلخا','دكرنس','أجا','السنبلاوين'],
  'طنطا': ['طنطا','المحلة الكبرى','كفر الزيات','زفتى','سمنود'],
  'الزقازيق': ['الزقازيق','بلبيس','العاشر من رمضان','أبو حماد','منيا القمح'],
};

// Sub-areas (streets, landmarks, sub-neighborhoods) for deep search within a neighborhood
const AREA_SUB_ZONES = {
  // ===== القاهرة =====
  'مدينة نصر': ['شارع عباس العقاد','شارع مصطفى النحاس','شارع مكرم عبيد','شارع الطيران','شارع النزهة','شارع حسن المأمون','شارع عبد الرزاق السنهوري','شارع أحمد فخري','شارع عمر بن الخطاب','شارع الميثاق','شارع يوسف عباس','شارع أنور المفتي','شارع حسين كامل','شارع محمد فوزي','شارع جسر السويس','شارع الشهيد طيار','شارع متولي الشعراوي','شارع حسن حسني','شارع أبو داوود الظاهري','شارع محمد رضوان','شارع ذاكر حسين','شارع إبراهيم حسين','شارع الواحة','شارع جمال حمدان','شارع الدكتور عمر ابن الخطاب','شارع عثمان بن عفان','شارع علي أمين','شارع إبراهيم حنفي','شارع نبيل القاضي','شارع الروضة','الحي السابع','الحي الثامن','الحي العاشر','زهراء مدينة نصر','المنطقة التاسعة','المنطقة السادسة','المنطقة الأولى','أمام سيتي ستارز','منطقة ألف مسكن','حي السفارات','الحي السادس','حي الواحة','المنطقة الحرة','حي المنتزه','عمارات رابعة','عمارات الضباط','عمارات هيئة التدريس'],
  'المعادي': ['المعادي الجديدة','المعادي القديمة','دجلة','زهراء المعادي','ثكنات المعادي','شارع 9','شارع النصر','كورنيش المعادي','ميدان الحرية','شارع 100','شارع 200','حدائق المعادي','صقر قريش','أرض الجولف','شارع 77','شارع 105','شارع 150','شارع 151','شارع 153','شارع 157','شارع 161','شارع 198','شارع 199','شارع 205','شارع 206','شارع 210','شارع 213','شارع 214','شارع 216','شارع 218','شارع 231','شارع 233','شارع 250','شارع 252','شارع 254','شارع 256','شارع 260','شارع 262','شارع 263','شارع 270','شارع 272','شارع 275','شارع 276','شارع 278','شارع 300','شارع 350','شارع 500','شارع لبنان','شارع سوريا','شارع بيروت','شارع عدن','شارع الجزائر','شارع الخرطوم','شارع بغداد','شارع الأردن','شارع فلسطين','شارع النادي','شارع المحطة','شارع حسنين دسوقي','شارع مصطفى كامل','شارع كلية الأركان','عرب المعادي','جراند مول','ميدان الجزائر','ميدان الفلكي','ساحة المعادي'],
  'الدقي': ['شارع مصدق','شارع التحرير','ميدان المساحة','شارع الدقي','شارع شهاب','شارع بطرس غالي','شارع جامعة الدول','ميدان الدقي','شارع محيي الدين أبو العز','شارع يثرب','شارع الأنصار','شارع المدينة المنورة','شارع بيروت','شارع دمشق','شارع سوريا','شارع ايران','شارع الطحان','شارع الخليل إبراهيم','شارع عبد المنعم رياض','شارع ناصر','شارع مراد','شارع الجيزة','شارع نوال','شارع عبد السلام عارف','شارع الحسين','شارع البطل أحمد عبد العزيز','ميدان الجلاء','ميدان سفنكس','شارع المسجد','شارع حافظ رمضان','شارع أولاد علام','شارع عبد المجيد الرمالي'],
  'المهندسين': ['شارع جامعة الدول العربية','شارع شهاب','شارع السودان','شارع لبنان','ميدان لبنان','شارع وادي النيل','شارع أحمد عرابي','شارع دمشق','شارع بيروت','شارع محيي الدين أبو العز','شارع سوريا','شارع عمان','شارع بغداد','شارع الرياض','شارع جدة','شارع أسوان','شارع المدينة المنورة','شارع عدن','شارع أبو المحاسن','شارع ناصر','شارع الثورة','شارع أحمد حشمت','شارع حسين وصفي','شارع متحف المنيل','شارع مساكن شيراتون','شارع البطل أحمد عبد العزيز','شارع نادي الصيد','شارع عبد المنعم رياض','شارع إسماعيل محمد','شارع يثرب','ميدان مصطفى محمود','ميدان سفنكس','شارع النزهة','شارع الفيوم','شارع العراق'],
  'الزمالك': ['شارع 26 يوليو','شارع البرازيل','شارع حسن صبري','شارع أبو الفدا','شارع شجرة الدر','شارع الشيخ المرصفي','شارع محمد مظهر','شارع إسماعيل محمد','شارع الجزيرة','شارع المرعشلي','شارع الكامل محمد','شارع صلاح الدين','شارع طه حسين','شارع البيرو','شارع ابن زنكي','شارع كمال الدين صلاح','شارع ابن خلدون','شارع يحيى إبراهيم','شارع بهجت علي','شارع أحمد حشمت','شارع عمر الخيام','شارع الجابري','شارع السعادة','شارع اسبانيا','شارع المغربي','كوبري الزمالك','ميدان الجلاء','نادي الجزيرة','نادي الزمالك','كورنيش الزمالك'],
  'وسط البلد': ['شارع طلعت حرب','شارع قصر النيل','شارع محمد فريد','ميدان التحرير','شارع 26 يوليو','شارع عدلي','شارع عبد الخالق ثروت','شارع رمسيس','شارع الجمهورية','ميدان عابدين','شارع محمد علي','شارع الألفي','شارع شريف','شارع هدى شعراوي','شارع البستان','شارع سليمان باشا','شارع قاسم أمين','شارع محمود بسيوني','شارع شامبليون','شارع أنطونيادس','شارع عماد الدين','شارع سعاد زغلول','شارع مصطفى كامل','شارع نوبار','ميدان أوبرا','ميدان طلعت حرب','ميدان مصطفى كامل','ميدان رمسيس','شارع الفلكي','شارع المنيرة','شارع منصور','شارع نجيب الريحاني','شارع مظلوم','شارع يوسف الجندي','شارع البورصة','شارع التوفيقية','ميدان العتبة','ميدان باب اللوق'],
  'مصر الجديدة': ['شارع الحجاز','شارع بغداد','شارع الأهرام','شارع الميرغني','شارع الخليفة المأمون','ميدان تريومف','ميدان هليوبوليس','شارع الثورة','شارع النزهة','روكسي','ميدان المحكمة','كوربة مصر الجديدة','ميدان الإسماعيلية','شارع ابراهيم اللقاني','شارع عثمان بن عفان','شارع بيروت','شارع كليوباترا','شارع هارون','شارع المقريزي','شارع صلاح الدين','شارع دمشق','شارع أبو بكر الصديق','شارع الشام','شارع سيناء','شارع عبد الحميد بدوي','شارع الحسين','شارع الجنان','شارع نزيه خليفة','شارع السيد الميرغني','شارع سليمان أباظة','شارع الشهيد أحمد عصمت','شارع عبد العزيز فهمي','شارع الخليفة العزيز','شارع متولي عاشور','شارع النادي','ميدان الأسما','ميدان سانت فاتيما','ميدان المطار','ألماظة','ميدان الكوربة','المحكمة','أرض الجولف','مساكن شيراتون','منشية الصدر','منشية البكري'],
  'العباسية': ['شارع رمسيس','ميدان العباسية','شارع الخليفة المأمون','أمام جامعة عين شمس','شارع أحمد سعيد','شارع يوسف عباس','شارع صبري أبو علم','شارع سكة الوايلي','شارع ابراهيم باشا','شارع الجيش','شارع الطويل','شارع عيسى','شارع القبة','شارع فاروق','شارع خليل حمادة','شارع بورسعيد','شارع القصر','شارع الشريف','ميدان الجيش','ميدان القبة','ميدان الظاهر','غمرة','الظاهر','حدائق القبة'],
  'شبرا': ['شارع شبرا','شارع أحمد حلمي','شارع خلوصي','ميدان شبرا','شارع الترعة البولاقية','شارع طوسون','شارع رئيس','شارع شنن','شارع رشدي','شارع الدكتور حسين','شارع بيجام','شارع محمد عزت','شارع يونان','شارع قنطرة غمرة','شارع أبو يوسف','شارع علي بك الكبير','شارع عمارة','شارع مايو','شارع سنان','شارع مسطرد','شارع الجلاء','شارع أحمد عرابي','شارع الساحل','شارع خليج المصري','ميدان الخلفاوي','ميدان محطة مترو شبرا','ميدان روض الفرج'],
  'حلوان': ['شارع منصور','شارع المراغي','شارع محمد سعيد','حلوان الجديدة','عين حلوان','وادي حوف','شارع الجمهورية','شارع المحطة','شارع حسن رضوان','شارع عرب الوالدة','شارع نجيب محفوظ','شارع 15 مايو','شارع محمد عبد المنعم','شارع صلاح سالم','شارع كفر العلو','شارع حلوان والسد','شارع بدر','شارع مصنع الاسمنت','حلوان الحمامات','منشأة الجمل','كفر العلو','حدائق حلوان','التبين','المساكن الشعبية','حلوان البلد'],
  'التجمع الخامس': ['التسعين الشمالي','التسعين الجنوبي','الحي الأول','الحي الثاني','الحي الثالث','الحي الخامس','البنفسج','الياسمين','اللوتس','النرجس','الأندلس','شارع التسعين','جنوب الأكاديمية','أمام الجامعة الأمريكية','داون تاون القطامية','الحي الرابع','الحي السابع','غرب أربيلا','شمال الرحاب','شرق الأكاديمية','بيت الوطن','النرجس الجديدة','اللوتس الجديدة','البنفسج الفيلات','الياسمين الفيلات','المستثمرين الشمالية','المستثمرين الجنوبية','أبو الهول','التجمع الأول','التجمع الثالث','المنطقة المركزية','الدبلوماسيين','القرنفل','الشويفات','ميدان البنفسج','كونكورد بلازا','ووتر واي','ذا سبوت','المول التجاري','كايرو فيستيفال','بوينت 90','ذا ماركت','شارع النوادي','شارع الخدمات'],
  'الرحاب': ['المرحلة الأولى','المرحلة الثانية','المرحلة الثالثة','المرحلة الرابعة','المرحلة الخامسة','المرحلة السادسة','المرحلة السابعة','المرحلة الثامنة','المرحلة التاسعة','المرحلة العاشرة','السوق التجاري','الممشى السياحي','المول التجاري','البوابة الرئيسية','ميدان الرحاب','البوابة الشمالية','البوابة الجنوبية','الحي الأول','الحي الثاني','الحي الثالث','الحي الرابع','الحي الخامس','رحاب ماركت','رحاب مول','سيتي بلازا','النادي الاجتماعي','المنطقة الخدمية'],
  'مدينتي': ['المرحلة الأولى','المرحلة الثانية','B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11','B12','B13','B14','B15','الممشى السياحي','المول التجاري','نادي مدينتي','الحديقة المركزية','المنطقة الخدمية','أوبن إير مول','المدارس','سيتي سنتر','السوق الشرقي','السوق الغربي','البوابة الرئيسية','المجمع الطبي','حدائق مدينتي','منطقة الفيلات'],
  'المقطم': ['هضبة المقطم','المقطم الهضبة الوسطى','شارع 9','المنطقة الأولى','المنطقة التاسعة','الأوتوستراد','شارع المقطم','الهضبة العليا','محور المشير','شارع سعد زغلول','شارع جمال عبد الناصر','شارع المشير','شارع 15','شارع 11','شارع 7','الحي السادس','الحي السابع','الحي الثامن','لؤلؤة المقطم','الحي الإيطالي','بداية المقطم','نهاية المقطم','كارفور المقطم','منطقة الجبل','شارع النصر','اللاسلكي','الخيالة','عزبة خير الله','جبل المقطم','المفروزة','شقق الضباط','دجلة بالمز'],
  'عين شمس': ['عين شمس الشرقية','عين شمس الغربية','شارع أحمد إسماعيل','شارع عين شمس','الزيتون','شارع نادي الصيد','المنطقة الحرة','ميدان عين شمس','حدائق عين شمس','شارع بلبيس','شارع الحرية','شارع ألف مسكن','شارع ترعة الإسماعيلية','شارع سرور','شارع جسر السويس','شارع الخمسين','شارع أحمد حلمي','شارع المطرية','شارع أحمد عبد النبي','عين شمس الجديدة','المطرية','عزبة النخل','شارع المشروع','شارع الألف مسكن','الزاوية','إسكان عين شمس'],
  'النزهة': ['شارع النزهة','النزهة الجديدة','مطار القاهرة','شيراتون','شارع الثورة','شارع عبد الحميد بدوي','ميدان المحكمة','ألماظة','شارع يوسف عباس','شارع قراجات','شارع الحجاز','شارع القاهرة بلبيس','شارع الخليفة المأمون','النزهة القديمة','حي الضباط','أمام المطار','شارع الأسلحة','شارع صلاح سالم','شارع الطيران','ميدان ألماظة','مساكن شيراتون','حدائق النزهة','منطقة المطار'],
  'السيدة زينب': ['شارع المنيرة','شارع الخليج المصري','ميدان السيدة زينب','شارع بور سعيد','شارع القصر العيني','شارع المبتديان','شارع الملك الصالح','ميدان لاظوغلي','شارع قنطرة الدكة','شارع أبو الريش','شارع عبد المجيد اللبان','شارع سعد زغلول','شارع الفلكي','شارع المحجوب','شارع حسن الأنور','شارع الدكتور السيد','شارع زين العابدين','شارع السد','شارع المنيل','شارع نصر الدين','ميدان المنيرة','ميدان أبو الريش','ميدان الفلكي','حارة الروم','شارع الملك المؤيد'],
  'الدرب الاحمر': ['شارع الأزهر','باب زويلة','شارع المعز','شارع الدرب الأحمر','شارع التبانة','ميدان صلاح الدين','القلعة','شارع محمد علي','شارع باب الوزير','شارع السيوفية','شارع الخيامية','سوق الخيامية','شارع الحلمية','حارة الروم','شارع تحت الربع','عطفة المرسى','شارع البرقوقية','حارة درب سعادة','شارع الغورية','حارة الرماح'],
  'حدائق القبة': ['شارع ترعة الإسماعيلية','شارع منشية البكري','ميدان حدائق القبة','شارع السلام','قصر القبة','شارع المطرية','شارع أحمد تيسير','شارع عين الحياة','شارع سرايا القبة','شارع أم المؤمنين','شارع القبة','شارع حسنين','شارع الملك','شارع المشير','شارع عبد الحميد','شارع دمنهور','شارع منشية البكري','ميدان القبة','شارع بغداد','شارع حلمية الزيتون','عزبة النخل'],
  'المرج': ['المرج القديمة','المرج الجديدة','شارع المرج','عزبة أبو حشيش','المرج الغربية','شارع الشهيد أحمد حمدي','ميدان المرج','شارع المرج الرئيسي','شارع أحمد بدوي','شارع السوق','شارع المدراسة','شارع المحطة','عزبة الصعايدة','شارع بلبيس','شارع الأربعين','شارع الخمسين','إسكان المرج','المرج الشرقية','ميدان أبو حشيش'],
  'الشروق': ['الحي الأول','الحي الثاني','الحي الثالث','الحي الرابع','الحي الخامس','الحي السادس','الحي السابع','الحي الثامن','الحي التاسع','المنطقة الصناعية','سوق الشروق','الشروق سبرنجز','شارع الشروق الرئيسي','شارع الخدمات','الحي المتميز','المنطقة التجارية','الجامعة البريطانية','ميدان الشروق','منطقة الفيلات','إسكان الشباب','شقق الإسكان الاجتماعي'],
  'بدر': ['الحي الأول','الحي الثاني','الحي الثالث','المنطقة الصناعية','الحي المتميز','إسكان الشباب','الحي السكني','الحي الرابع','الحي الخامس','الحي السادس','المنطقة التجارية','شارع بدر الرئيسي','منطقة الخدمات','إسكان المستقبل','شقق الضباط'],
  'العبور': ['الحي الأول','الحي الثاني','الحي الثالث','الحي الرابع','الحي الخامس','الحي السادس','الحي السابع','الحي الثامن','الحي التاسع','الحي العاشر','جولف سيتي','الجامعة العمالية','كارفور العبور','جرين بلازا','المنطقة الصناعية','شارع أحمد بن طولون','شارع صلاح سالم','شارع الشباب','شارع الخدمات','الحي الأندلسي','ميدان العبور','منطقة الفيلات'],
  'الزيتون': ['شارع الزيتون','شارع سليم الأول','شارع الأصبغ','حدائق الزيتون','شارع أحمد تيسير','ميدان الزيتون','شارع ابن الأثير','شارع القبة','شارع أحمد سعيد','شارع ترعة الإسماعيلية','شارع القاهرة','شارع السلام','شارع المنزل','شارع عمر بن الخطاب','شارع التقسيم','شارع عيسى','شارع الخندق','شارع المطرية','حلمية الزيتون','الزيتون الشرقية','الزيتون الغربية','شارع المنشية','شارع عزت','شارع شحاتة'],
  'روض الفرج': ['شارع النيل','شارع الترجمان','شارع الشرابية','ميدان روض الفرج','شارع شبرا','شارع المسطحات','كورنيش روض الفرج','محور روض الفرج','شارع أحمد حلمي','شارع بولاق','شارع الجلاء','شارع طوسون','شارع بشتيل','شارع الشيخ','شارع السواح','شارع ترعة الإسماعيلية','شارع الخلفاوي','ميدان الخلفاوي','شارع السودان','مسرح البالون'],
  'المطرية': ['شارع المطرية','شارع الحرية','ميدان المطرية','عين شمس','المطرية البلد','شارع معهد المطرية','حلمية المطرية','عزبة النخل','شارع جسر السويس','شارع القاهرة','شارع المنشية','شارع المحطة','شارع المشروع','شارع المطبعة','شارع الجامع','شارع الألف مسكن','شارع الخمسمائة','شارع السوق','شارع ترعة الإسماعيلية','شارع بلبيس','حدائق المطرية','عزبة المطرية'],
  'بولاق': ['بولاق أبو العلا','شارع 26 يوليو','شارع بولاق','شارع الجلاء','كورنيش النيل','ميدان بولاق','شارع أحمد عرابي','وكالة البلح','شارع الصناعة','شارع حسب الله','شارع الحكمة','شارع وابور الماء','شارع أبو العلا','شارع الفيل','شارع عامر','شارع رمسيس','شارع وادي النيل','ميدان عبد المنعم رياض','ميدان التحرير','ممر بولاق','حارة الأتراك','شارع سوق بولاق'],
  'الوايلي': ['شارع رمسيس','ميدان العباسية','شارع الفجالة','شارع السكة الحديد','حدائق الوايلي','الوايلي الصغير','الوايلي الكبير','شارع أحمد سعيد','شارع عين الحياة','شارع الوايلي','شارع سرور','شارع بورسعيد','شارع القبة','شارع الجيش','شارع الصناعة','شارع القاهرة','ميدان الفجالة','ميدان غمرة','شارع كلوت بك','الظاهر'],
  'حدائق المعادي': ['شارع 9 حدائق','صقر قريش','شارع النصر حدائق','ميدان الحرية حدائق','شارع 151','شارع 100 حدائق','شارع 105','شارع 77','شارع 150','شارع عرب المعادي','شارع زهراء حدائق','شارع المحطة','شارع الجزار','شارع المدبح','شارع البساتين','شارع دار السلام','شارع المنيل','شارع الأوتوستراد'],
  'دار السلام': ['شارع دار السلام','شارع عقبة بن نافع','شارع مسطرد','ميدان دار السلام','شارع إمبابة','زين العابدين','شارع الفسطاط','شارع جامع عمرو','شارع مصر القديمة','شارع الصالحية','شارع مار جرجس','شارع عين الصيرة','شارع البساتين','شارع الخليج','شارع السيدة نفيسة','شارع الأوتوستراد','شارع طولون','شارع الأثر'],
  'طره': ['طره البلد','طره الأسمنت','شارع الكورنيش','طره الجديدة','المعصرة','شارع طره','وادي حوف','شارع المحطة','شارع المصنع','شارع الجمهورية','شارع السجن','طره المحاجر','إسكان طره','شارع النيل','كوبري طره'],
  'المعصرة': ['شارع المعصرة','المعصرة البلد','المعصرة العسكري','شارع مصطفى كامل','حدائق حلوان','شارع المحطة','شارع الجمهورية','شارع المصنع','شارع النيل','المعصرة الجديدة','إسكان المعصرة','شارع كورنيش النيل'],
  'التبين': ['شارع التبين','مصنع الحديد والصلب','التبين الجديدة','شارع الجمهورية','حلوان','شارع المصنع','شارع المنطقة الصناعية','شارع المحطة','إسكان التبين','التبين البلد','شارع كفر العلو','منشأة الجمل'],
  'الخليفة': ['شارع الخليفة','شارع السيدة عائشة','شارع صلاح سالم','ميدان القلعة','شارع السيوفية','الحطابة','باب الوزير','شارع الخليفة الرئيسي','شارع السلخانة','شارع تحت الربع','شارع جامع ابن طولون','شارع المدبح','شارع زين العابدين','شارع الأشرف','حارة السقايين','شارع البرقوقية','شارع الحلمية','ميدان السيدة عائشة','شارع الصليبة'],
  'منشية ناصر': ['شارع الأوتوستراد','الدويقة','شارع السلطان حسن','استاد القاهرة','شارع صلاح سالم','ميدان صلاح الدين','شارع منشية ناصر','الحرفيين','شارع الأوتوستراد الجبل','منطقة الألف مسكن','شارع القلعة','شارع المحجر','عزبة بخيت','شارع جنينة','شارع الأنفاق','ميدان القلعة','شارع الكبش'],
  'الساحل': ['شارع بورسعيد','شارع الساحل','شارع الترعة','ميدان الساحل','شبرا الساحل','شارع أحمد حلمي','شارع منشية الصدر','شارع الجلاء','شارع طوسون','شارع ترعة الإسماعيلية','شارع الشرابية','شارع المسطحات','شارع الخلفاوي','ميدان الخلفاوي','شارع النيل','شارع شبرا الساحل'],
  'شبرا الخيمة': ['شارع أحمد عرابي','شارع 15 مايو','شارع شبين','شارع كورنيش النيل','ميدان المؤسسة','المنطقة الصناعية','شارع أحمد عصمت','ميدان شبرا الخيمة','مسطرد','شارع المنشية','شارع بنها','شارع قليوب','شارع الحرية','شارع التحرير','شارع الخلافة','شارع المحطة','شارع السوق','شارع الجلاء','شارع عبد الناصر','شارع المصانع','أبو الغار','الكرنك','بهتيم','ميدان الحرية'],
  'الموسكي': ['شارع الموسكي','شارع المعز لدين الله','شارع الأزهر','خان الخليلي','شارع الجمالية','ميدان الحسين','باب الفتوح','سوق الموسكي','شارع القلعة','حارة اليهود','شارع التحرير','شارع الأزهر','سوق العطارين','سوق النحاسين','حارة الصنادقية','شارع المشهد الحسيني','شارع تحت الربع','سوق خان الخليلي','ممر سوق السلاح'],
  'الأزهر': ['الجامع الأزهر','شارع الأزهر','مشيخة الأزهر','ميدان الأزهر','شارع المعز','ميدان الحسين','باب الغوري','شارع بورسعيد','شارع القلعة','شارع محمد عبده','حارة الأبيار','شارع الدراسة','شارع المبيضة','ميدان باب الشعرية','شارع الجمالية','حارة كتشنر','درب الجماميز'],
  'جاردن سيتي': ['شارع قصر العيني','كورنيش النيل','شارع القصر العيني','شارع الطلمبات','ميدان سيمون بوليفار','شارع أيوب','شارع حسن صبري','شارع يوسف الجندي','شارع قاسم أمين','شارع الشيخ ريحان','شارع عثمان بن عفان','شارع نوبار','شارع كريم الدولة','شارع هدى شعراوي','شارع البستان','شارع المعمل','شارع السفارة','كورنيش جاردن سيتي','ميدان القائد إبراهيم','شارع التحرير'],
  'المنيل': ['شارع المنيل','شارع الروضة','كوبري المنيل','الروضة','قصر العيني','شارع الملك الصالح','ميدان المنيل','جزيرة المنيل','شارع محمد المقريزي','شارع المنيل الروضة','شارع الجهاد','شارع أبو السعود','شارع الفسطاط','شارع مصر القديمة','شارع ابن خلدون','شارع عبد العزيز آل سعود','شارع الصالح أيوب','كورنيش المنيل','شارع مراد','ميدان الملك الصالح','شارع الملك الكامل','شارع النيل'],
  'القطامية': ['طريق القطامية العين السخنة','كمبوند القطامية','القطامية هايتس','قطامية هيلز','القطامية ريزيدنس','مول كايرو فستيفال','القطامية جاردنز','ماونتن فيو','بالم هيلز القطامية','ليك فيو','فيلدج جاردنز','طريق الأوتوستراد','القطامية القديمة','القطامية الجديدة'],
  'البساتين': ['شارع البساتين','شارع زين العابدين','ميدان البساتين','شارع عرب المعادي','منطقة عرب البساتين','شارع محمد سيد أحمد','شارع صقر قريش','التونسي','شارع الأوتوستراد','شارع الخليج','شارع جامع عمرو','شارع المدبح','شارع الفسطاط','شارع مصر القديمة','شارع القادرية','شارع السيدة نفيسة','شارع المقطم','إسكان البساتين','عرب البساتين الشرقية','عرب البساتين الغربية'],
  'السلام': ['السلام أول','السلام ثاني','شارع الثورة','شارع بلبيس','شارع السلام','ميدان السلام','المنطقة الصناعية','عزبة أول','عزبة تاني','الخصوص','شارع جسر السويس','شارع أحمد عرابي','شارع المشروع','شارع الخمسين','شارع المطار','شارع الشباب','إسكان السلام','شارع الألف مسكن','شارع عبد الناصر','المنطقة التجارية','ميدان المحكمة'],
  'الأميرية': ['شارع الأميرية','شارع ترعة الإسماعيلية','ميدان الأميرية','شارع المطرية','شارع عين شمس','حلمية الزيتون','الأميرية الشرقية','الأميرية الغربية','شارع بلبيس','شارع جسر السويس','شارع المحطة','شارع القاهرة','شارع السلام','شارع المشروع','عزبة الأميرية','شارع الأربعين','شارع المدراسة','ميدان المحطة'],
  'عزبة النخل': ['شارع عزبة النخل','شارع بلبيس','ميدان عزبة النخل','شارع المشروع','شارع النخل','عزبة النخل الشرقية','عزبة النخل الغربية','إسكان عزبة النخل','شارع جسر السويس','شارع الخمسين','شارع الأربعين','شارع المطرية','شارع الألف مسكن','شارع المحطة','المنطقة الصناعية','شارع التعاون','عزبة الشال'],
  'حدائق حلوان': ['شارع حدائق حلوان','شارع المنيل','ميدان حدائق حلوان','شارع الجمهورية','وادي حوف','شارع المحطة','إسكان حدائق حلوان','شارع النيل','شارع المصنع','شارع المراغي','شارع كفر العلو','شارع الشهيد','شارع المعصرة','شارع الكورنيش','إسكان الشباب'],
  '15 مايو': ['المنطقة الأولى','المنطقة الثانية','المنطقة الثالثة','المنطقة الرابعة','المنطقة الخامسة','المنطقة السادسة','المنطقة السابعة','شارع الجمهورية','ميدان 15 مايو','المنطقة الصناعية','إسكان الشباب','شارع المحطة','شارع حلوان','شارع التبين','المنطقة التجارية','إسكان العمال','شارع مصنع الاسمنت'],
  'الشرابية': ['شارع الشرابية','شارع القصاصين','ميدان الشرابية','شارع بيبرس','شارع أحمد حلمي','شارع الترعة البولاقية','الزاوية الحمراء','المظلات','شارع عزت','شارع الحسينية','شارع منشية الصدر','شارع السواح','شارع الحوامدية','شارع الجلاء','شارع النزهة','ميدان الزاوية الحمراء','شارع الساحل','شارع القاهرة'],
  'الجمالية': ['شارع المعز لدين الله','باب الفتوح','باب النصر','شارع الجمالية','بيت السحيمي','وكالة الغوري','سبيل محمد علي','شارع الأزهر','حارة الدرب الأصفر','ميدان الحسين','شارع الدراسة','شارع التمبكشية','شارع المسبح','حارة الحسينية','شارع بين القصرين','سبيل وكتاب','حارة زقاق الكحل','حارة الطبلاوي','شارع النحاسين','سوق الصاغة','حارة خوشقدم','باب زويلة'],
  'غمرة': ['شارع غمرة','شارع رمسيس','ميدان غمرة','شارع الفجالة','شارع كلوت بك','محطة غمرة','شارع بورسعيد','شارع السكة الحديد','شارع الجيش','شارع الظاهر','شارع القبة','ميدان الظاهر','شارع عماد الدين','شارع المبتديان','شارع السبتية','شارع التوفيقية','حارة الساقية','ميدان باب الحديد'],
  'عابدين': ['ميدان عابدين','قصر عابدين','شارع الجمهورية','شارع نوبار','شارع محمد فريد','شارع الشيخ ريحان','ميدان لاظوغلي','شارع بورسعيد','شارع مجلس الشعب','شارع يوسف الجندي','شارع قصر العيني','شارع محمد علي','شارع المبتديان','شارع أحمد ماهر','شارع الفلكي','شارع المنيرة','شارع شريف','ميدان الفلكي','ميدان المنيرة','شارع عبد العزيز','شارع حسن الأكبر','شارع سلامة'],
  'باب الشعرية': ['شارع باب الشعرية','شارع الأزهر','شارع بورسعيد','ميدان باب الشعرية','شارع كلوت بك','شارع الجيش','الفجالة','شارع عماد الدين','شارع القاهرة','شارع الحسينية','شارع التوفيقية','شارع المسالك','حارة الحوض','شارع الداودية','شارع الخازندار','ميدان الفجالة','حارة الشمع'],
  'الأزبكية': ['شارع الأزبكية','حديقة الأزبكية','شارع الجمهورية','ميدان الأوبرا','شارع 26 يوليو','شارع عماد الدين','شارع الأزهر','ميدان العتبة','شارع محمد علي','شارع كلوت بك','شارع الألفي','شارع التوفيقية','شارع عدلي','شارع شريف','شارع رمسيس','سور الأزبكية','ميدان باب الحديد','شارع فاروق','شارع نجيب الريحاني','ميدان رمسيس','حارة الروبي'],
  'الحسين': ['ميدان الحسين','مسجد الحسين','شارع الأزهر','خان الخليلي','شارع المعز','سوق الحسين','شارع الجمالية','ميدان الأزهر','سوق النحاسين','شارع المشهد الحسيني','حارة الصنادقية','شارع الصاغة','شارع الدراسة','حارة العينية','شارع بيت القاضي','عطفة المسك','حارة الطبلاوي','سوق الغورية'],
  // ===== الجيزة =====
  'الهرم': ['شارع الهرم','شارع فيصل','ميدان الرماية','ميدان الحصري','شارع العريش','شارع الملك فيصل','ميدان سفنكس','المنصورية','شارع مراد','شارع الثلاثيني','اللبيني','الطالبية','شارع ترسا','المريوطية','كفر نصار','شارع النصر','شارع الأهرام','شارع العشرين','شارع المحولات','شارع الملكة','شارع سعد زغلول','شارع ناصر','شارع الجيزة','شارع حسن محمد','شارع العمرانية','شارع المنيب','شارع الحرمين','شارع أحمد عرابي','شارع عمر بن الخطاب','شارع الملك خالد','شارع محمد رفعت','ميدان المرج','ميدان الكوم','شارع الأقصر','شارع اليمن','شارع المطبعة','شارع الخمسين','كفر الجبل','كفر طهرمس','كفر غطاطي','نزلة البطران','نزلة السمان','أبو الهول'],
  'فيصل': ['شارع فيصل','شارع العشرين','شارع الملكة','العمرانية','الطالبية','ميدان فيصل','شارع الثلاثيني','شارع المنيرة','حدائق الأهرام','شارع الميزان','اللبيني','شارع الأربعين','شارع الستين','شارع السبعين','شارع التسعين','شارع المحولات','شارع ناهيا','شارع سعد زغلول','شارع المنيب','شارع بولاق الدكرور','شارع السلام','شارع الجمهورية','شارع المدراسة','شارع المسجد','شارع الرخام','شارع الحرمين','شارع محمد نجيب','شارع أبو بكر الصديق','شارع عمر بن الخطاب','ميدان العشرين','ميدان الساعة','ميدان الجيزة'],
  '6 اكتوبر': ['الحي الأول','الحي الثاني','الحي الثالث','الحي الرابع','الحي الخامس','الحي السادس','الحي السابع','الحي الثامن','الحي التاسع','الحي العاشر','الحي الحادي عشر','الحي الثاني عشر','الحي المتميز','المحور المركزي','مول العرب','ميدان جهينة','جاردنز','دريم لاند','مدينة الإنتاج الإعلامي','المنطقة الصناعية','الحصري','حدائق أكتوبر','محور 26 يوليو','محور الكفراوي','شارع التعمير','شارع الشباب','الحي الإيطالي','البشاير','الياسمين','الأشجار','زهور أكتوبر','إسكان الشباب','إسكان مبارك','منطقة الفيلات','سيتي سكيب','بورتو أكتوبر','بالم بارك','كمبوند أشجار سيتي','وادي النخيل','كونتري هومز','سويس','الممر السياحي','مدينة الفردوس'],
  'الشيخ زايد': ['شارع الغابة','مول مصر','هايبر وان','أركان','الحي الأول','الحي الثاني','الحي الثالث','الحي الرابع','الحي الخامس','الحي السادس','الحي السابع','الحي الثامن','الحي التاسع','الحي العاشر','الحي الحادي عشر','الحي الثاني عشر','الحي الثالث عشر','الحي الرابع عشر','بيفرلي هيلز','كمبوند الربوة','كمبوند بالم هيلز','كمبوند صن سيتي','الجزيرة بلازا','وصلة دهشور','ميدان بيفرلي','كمبوند زايد هايتس','كمبوند كازا','كمبوند أليجريا','شارع النخيل','كمبوند الجازي','زايد سنترال','زايد بلازا','داندي مول','محور 26 يوليو','كمبوند ليك فيو','أولد زايد'],
  'حدائق الأهرام': ['البوابة الأولى','البوابة الثانية','البوابة الثالثة','البوابة الرابعة','شارع الجيش','الحي الأول','المنطقة التجارية','شارع 90','خلف هايبر','ميدان حدائق الأهرام','الحي الثاني','الحي الثالث','الحي الرابع','منطقة أ','منطقة ب','منطقة ج','منطقة د','منطقة هـ','منطقة و','منطقة ز','شارع الأهرام','شارع المحور','شارع الخدمات','ميدان البوابة','سوق حدائق الأهرام'],
  'العمرانية': ['شارع الهرم','شارع ترسا','شارع سليمان','ميدان العمرانية','الطوابق','شارع النيل','شارع د.مجدي يعقوب','أرض اللواء','شارع المنيل','شارع العشرين','شارع الجمهورية','شارع المحطة','شارع السلام','شارع الحرية','شارع المصنع','شارع كورنيش النيل','شارع الشيخ','شارع الجامع','ميدان الطوابق','ميدان أرض اللواء','شارع الفيوم','شارع بولاق الدكرور'],
  'الحوامدية': ['شارع الحوامدية','شارع النيل','شارع المصنع','ميدان الحوامدية','كورنيش الحوامدية','شارع المحافظة','شارع المركز','شارع السكة الحديد','شارع البحر','شارع الجسر','شارع السوق','شارع المدرسة','شارع الجمهورية','شارع السلام','صقر الحوامدية'],
  'البدرشين': ['شارع البدرشين','شارع المدرسة','ميدان البدرشين','شارع الجسر','الحوامدية','شارع المحافظة','شارع السوق','شارع الجمهورية','شارع القنطرة','شارع البحر','شارع السكة الحديد','شارع المركز','شارع سقارة','شارع دهشور'],
  'أبو النمرس': ['شارع أبو النمرس','شارع المحافظة','ميدان أبو النمرس','شارع الجيزة','شارع النيل','شارع السوق','شارع المركز','شارع الجمهورية','شارع المدرسة','شارع الجسر','شارع البحر','كورنيش النيل'],
  'الوراق': ['شارع الوراق','شارع النيل','جزيرة الوراق','ميدان الوراق','شارع ترعة المنصورية','شارع التحرير','شارع المحطة','شارع السوق','شارع الجمهورية','شارع المصنع','شارع الشيخ','شارع النخل','شارع الترعة','شارع المنشية','كورنيش الوراق','شارع المطار','إمبابة الوراق'],
  'إمبابة': ['شارع السودان','شارع الوحدة','ميدان إمبابة','شارع كورنيش النيل','شارع فيصل','أرض اللواء','شارع طلبة عويضة','سوق إمبابة','ميدان كيت كات','ميدان ابن الحكم','شارع ترعة المنصورية','شارع بشتيل','شارع الدائري','شارع ناهيا','شارع العشرين','شارع المحطة','شارع الجيش','شارع النخل','شارع المصنع','شارع الثلاثيني','شارع العمرانية','شارع الحرية','شارع المنشية','شارع الشيخ','سوق العبد'],
  'العجوزة': ['شارع النيل','شارع أحمد عرابي','شارع السودان','شارع وادي النيل','ميدان الجلاء','شارع شهاب','كورنيش العجوزة','ميدان كيت كات','شارع محيي الدين أبو العز','شارع ناصر','شارع جامعة الدول','شارع الأنصار','شارع بطرس غالي','شارع الشيخ','شارع الجلاء','شارع عبد المنعم رياض','شارع يثرب','شارع المدينة المنورة','ميدان سفنكس','شارع لبنان'],
  'بولاق الدكرور': ['شارع ناهيا','شارع المحولات','ميدان بولاق الدكرور','شارع العمرانية','شارع المنيب','عزبة الصعايدة','شارع الثلاثيني','شارع السلام','شارع الجمهورية','شارع المصنع','شارع الشباب','شارع فيصل','شارع الخمسين','شارع الأربعين','شارع أحمد عرابي','شارع المدراسة','شارع السوق','ميدان ناهيا','عزبة الهجانة'],
  'أوسيم': ['شارع أوسيم','شارع الجيزة','ميدان أوسيم','شارع المقريزي','ترعة المنصورية','شارع المحطة','شارع السكة الحديد','شارع السوق','شارع الجمهورية','شارع المدرسة','شارع المركز','شارع البحر','شارع الترعة','منشية أوسيم','بولاق أوسيم'],
  'كرداسة': ['شارع كرداسة','شارع السياحة','ميدان كرداسة','سوق كرداسة','شارع الأهرام','شارع نهضة مصر','شارع المحطة','شارع المدرسة','شارع الجمهورية','شارع أبو الهول','شارع المنصورية','شارع الملك فيصل','سوق الملابس','شارع السوق الرئيسي'],
  'المنيب': ['شارع المنيب','ميدان المنيب','شارع النيل','محطة المنيب','كوبري المنيب','شارع الجيزة','أول المنيب','شارع فيصل','شارع المحطة','شارع الكورنيش','شارع المدرسة','شارع الجمهورية','شارع الشباب','شارع الحرية','ساقية مكي','شارع النصر'],
  'الطالبية': ['شارع الطالبية','شارع فيصل','شارع الهرم','ميدان الطالبية','شارع الملكة','اللبيني','شارع العشرين','شارع الثلاثيني','شارع المحولات','شارع الأربعين','شارع المنيرة','شارع سعد زغلول','شارع الميزان','شارع المدرسة','شارع الجمهورية','ميدان اللبيني'],
  'ساقية مكي': ['شارع ساقية مكي','شارع المنيب','ميدان ساقية مكي','شارع فيصل','كوبري ساقية مكي','شارع المحطة','شارع النيل','شارع الجيزة','شارع الجمهورية','شارع الكورنيش','شارع المدرسة','شارع السوق'],
  'حدائق الاهرام': ['البوابة الأولى','البوابة الثانية','البوابة الثالثة','البوابة الرابعة','شارع الجيش','المنطقة التجارية','منطقة أ','منطقة ب','منطقة ج','منطقة د','شارع الأهرام','شارع المحور','الحي الأول','الحي الثاني'],
  'الجيزة': ['شارع الجيزة','ميدان الجيزة','شارع المحطة','شارع النيل','كورنيش الجيزة','جامعة القاهرة','شارع الملك فيصل','شارع السودان','حديقة الحيوان','ميدان الدقي','شارع مراد','شارع المنيل','شارع التحرير','شارع الجامعة','شارع البحر','شارع الأورمان','شارع الناهيا','شارع المحافظة','شارع الدقي','ميدان الجلاء','كوبري الجيزة','كوبري الجامعة','كوبري الملك فيصل'],
  'المريوطية': ['شارع المريوطية','ترعة المريوطية','شارع الهرم','المنصورية','كفر غطاطي','شارع اللبيني','كفر الجبل','شارع الفيوم','شارع المنيب','شارع المطبعة','شارع الأهرام','شارع المحور','شارع الخمسين','شارع العشرين','نزلة البطران','كفر نصار'],
  'أبو رواش': ['شارع أبو رواش','المنطقة الصناعية','ميدان أبو رواش','طريق القاهرة الإسكندرية الصحراوي','شارع المدرسة','شارع المركز','شارع الجمهورية','شارع المحطة','شارع السوق','أهرامات أبو رواش','شارع المصنع'],
  'الصف': ['شارع الصف','ميدان الصف','شارع الجيزة','شارع المحافظة','أطفيح','شارع النيل','شارع المركز','شارع السوق','شارع المدرسة','شارع الجمهورية','شارع البحر','كورنيش الصف','شارع المحطة'],
  'أطفيح': ['شارع أطفيح','ميدان أطفيح','شارع المحافظة','شارع النيل','شارع الجمهورية','شارع المركز','شارع السوق','شارع المدرسة','شارع البحر','شارع الجسر','كورنيش أطفيح'],
  'منشأة القناطر': ['شارع منشأة القناطر','ميدان المنشأة','شارع المحافظة','القناطر الخيرية','شارع النيل','شارع الرئيسي','شارع السوق','شارع المركز','شارع المدرسة','شارع الجمهورية','شارع البحر','كورنيش القناطر'],
  'الطوابق': ['شارع الطوابق','ميدان الطوابق','شارع الهرم','شارع فيصل','شارع العمرانية','الطالبية','شارع المنيل','شارع المحطة','شارع الجمهورية','شارع المصنع','شارع السلام','شارع الحرية','شارع الثلاثيني','شارع العشرين'],
  'أرض اللواء': ['شارع أرض اللواء','شارع السودان','ميدان أرض اللواء','شارع بولاق الدكرور','شارع ناهيا','شارع الوفاء والأمل','شارع ترعة الساحل','شارع المحولات','شارع فيصل','شارع العشرين','شارع الثلاثيني','شارع المدراسة','شارع الجمهورية','شارع المنشية','شارع الشيخ','ميدان ناهيا','شارع إمبابة'],
  // ===== الإسكندرية =====
  'سيدي جابر': ['شارع بورسعيد','محطة سيدي جابر','جناكليس','شارع مصطفى كامل','شارع أبو قير','ميدان سيدي جابر','شارع الحرية','شارع خليل حمادة','سيدي جابر الشيخ','شارع المشير','شارع سعد زغلول','شارع السلطان حسين','شارع الترام','شارع 14 مايو','شارع توت عنخ أمون','شارع فوزي معاذ','شارع النصر','شارع الإسكندر الأكبر','سيدي جابر المحطة','شارع كامل الكيلاني','شارع خيرت'],
  'سموحة': ['شارع فوزي معاذ','ميدان سموحة','نادي سموحة','شارع النصر','شارع 14 مايو','شارع توت عنخ أمون','شارع أحمد شوقي','شارع الحرية','شارع المشير','شارع ألبرت الأول','شارع جمال عبد الناصر','شارع الإسكندر الأكبر','شارع بور سعيد','شارع فيكتور عمانويل','شارع شاكيرا','شارع سيدي جابر','شارع محطة الرمل','شارع مصطفى كامل','جرين بلازا','سان ستيفانو','مساكن الضباط','إيزي هوم','سموحة الجديدة','شارع مدرسة شاتبي'],
  'المنتزه': ['قصر المنتزه','شارع الجيش','شارع أبو قير','كورنيش المنتزه','حدائق المنتزه','معمورة','شارع مصطفى كامل','ميدان المنتزه','المنتزه أول','المنتزه ثاني','شارع المعمورة','شارع الإسكندر الأكبر','شارع خالد بن الوليد','شارع 45','شاطئ المنتزه','شارع شريف','شارع الملك','منطقة القصر','عزبة سعد','منطقة المندرة'],
  'سيدي بشر': ['شارع خالد بن الوليد','شارع الأمل','سيدي بشر قبلي','سيدي بشر بحري','ميدان سيدي بشر','شارع 45','شارع فوزي معاذ','شارع مصطفى كامل','شارع الترام','شارع جمال عبد الناصر','شارع الإسكندر الأكبر','شارع المدراسة','شارع السوق','شارع النصر','شارع الحرية','شارع المسجد الكبير','شارع عمر بن الخطاب','شارع أبو بكر الصديق','شارع المعسكر الروماني','ميدان جمال عبد الناصر'],
  'كليوباترا': ['شارع أبو قير','كليوباترا الصغيرة','ميدان كليوباترا','شارع كليوباترا','شارع 10','شارع الحرية','كليوباترا حمامات','شارع الترام','شارع مصطفى فهمي','شارع السلطان حسين','شارع بورسعيد','شارع الإسكندر الأكبر','ميدان فيكتوريا','شارع فيكتوريا'],
  'رشدي': ['شارع أبو قير','شارع رشدي','ميدان رشدي','شارع السلطان حسين','شارع النبي دانيال','شارع فؤاد','شارع الحرية','شارع سعد زغلول','شارع صفية زغلول','شارع الترام','شارع مصطفى فهمي','شارع بورسعيد','شارع محمد كامل','ميدان سعد زغلول','محطة الرمل','شارع إسكندر إبراهيم'],
  'ستانلي': ['كوبري ستانلي','شارع الجيش','شاطئ ستانلي','ميدان ستانلي','شارع أبو قير','عمارات ستانلي','شارع الكورنيش','شارع السلطان حسين','شارع مصطفى فهمي','شارع الترام','سان ستيفانو','فندق سان ستيفانو','شارع رشدي'],
  'الابراهيمية': ['شارع مصطفى فهمي','شارع بورسعيد','ميدان الإبراهيمية','شارع أبو قير','محطة الإبراهيمية','شارع السلطان حسين','شارع الحرية','شارع الترام','شارع النبي دانيال','شارع سعد زغلول','شارع الإسكندر الأكبر','شارع كنيسة الأقباط','شارع فؤاد','شارع محمد كامل'],
  'العصافرة': ['العصافرة قبلي','العصافرة بحري','شارع المعسكر الروماني','شارع 45','شارع 10','شارع حافظ إبراهيم','ميدان العصافرة','شارع الترام','شارع الحرية','شارع مصطفى كامل','شارع النصر','شارع الجيش','شارع المدراسة','العصافرة الجديدة','عزبة سعد العصافرة','شارع جمال عبد الناصر'],
  'المندرة': ['المندرة قبلي','المندرة بحري','شاطئ المندرة','شارع الجيش','شارع 45','شارع مصطفى كامل','ميدان المندرة','شارع الترام','شارع الحرية','شارع النصر','شارع المعسكر الروماني','شارع خالد بن الوليد','المندرة الجديدة','شارع جمال عبد الناصر','ميدان المنتزه'],
  'جليم': ['شارع أبو قير','شارع جليم','ميدان جليم','شارع 14 مايو','كورنيش جليم','شارع رشدي','شارع الترام','شارع مصطفى فهمي','شارع بورسعيد','شارع السلطان حسين','شارع الحرية','سان ستيفانو','شارع ألبرت الأول','شارع النصر'],
  'لوران': ['شارع لوران','شارع الترام','شارع مصطفى فهمي','ميدان لوران','شارع السلطان حسين','شارع 10','شارع أبو قير','شارع الحرية','شارع بورسعيد','شارع جليم','شارع النصر','شارع الإسكندر الأكبر','محطة لوران'],
  'محرم بك': ['شارع محرم بك','شارع المحطة','ميدان محرم بك','شارع الحرية','شارع السلطان حسين','محطة مصر','شارع النبي دانيال','شارع بورسعيد','شارع فؤاد','شارع الترام','شارع القباري','شارع الحضرة','شارع سيدي جابر','شارع إبراهيم الأول','شارع عبد القادر','ميدان المحطة','شارع إسماعيل صبري','شارع الغرفة التجارية'],
  'العطارين': ['شارع العطارين','شارع فؤاد','شارع النبي دانيال','ميدان العطارين','سوق العطارين','شارع السبع بنات','شارع الحرية','شارع صفية زغلول','شارع سعد زغلول','شارع الشريف','ميدان محمد علي','شارع شريف','شارع عبد الفتاح الحديدي','سوق الساعات','شارع فرنسا','ميدان المنشية','حارة اليهود'],
  'بحري': ['شارع رأس التين','قلعة قايتباي','ميدان أبو العباس','شارع الميناء الشرقي','الأنفوشي','شارع قصر رأس التين','شارع الكورنيش','شارع الحرية','شارع الميناء','شارع السيالة','شارع فؤاد','شارع صلاح سالم','ميدان المنشية','شارع التتويج','منطقة بحري','سوق السمك','شارع النصر'],
  'العجمي': ['البيطاش','هانوفيل','العجمي البلد','شاطئ العجمي','شارع الملك مريوط','الهانوفيل','الدخيلة','كيلو 21','شارع 45','شارع الإسكندرية مطروح','شارع النصر','شارع الحرية','شارع الجمهورية','شارع المدراسة','شارع السوق','العجمي الجديدة','نجم الدين','أبو يوسف','الورديان','العوايد','الدكرنس','الهانوفيل الشرقية','الهانوفيل الغربية','شاطئ النخيل'],
  'الدخيلة': ['شارع الدخيلة','الميناء','شارع النهضة','ميدان الدخيلة','الورديان','الدخيلة البلد','شارع المصنع','شارع الحرية','شارع الجمهورية','شارع المحطة','شارع النصر','شارع بورسعيد','المنطقة الصناعية','شارع السوق','شارع المدراسة','الدخيلة الجديدة','المكس'],
  'المعمورة': ['شاطئ المعمورة','المعمورة البلد','المعمورة الشاطئ','عزبة سعد','شارع الجيش','شارع أبو قير','منتزه المعمورة','شارع 45','شارع مصطفى كامل','شارع خالد بن الوليد','شارع الحرية','شارع النصر','المعمورة الجديدة','شارع المنتزه','ميدان المعمورة'],
  'كامب شيزار': ['شارع بورسعيد','شارع 14 مايو','شارع محمد فريد','ميدان كامب شيزار','شارع النصر','شارع إسكندر إبراهيم','المحكمة','شارع الحرية','شارع فؤاد','شارع سعد زغلول','شارع الترام','شارع مصطفى كامل','ميدان المحكمة','شارع جمال عبد الناصر','ميدان الحرية','شارع سموحة'],
  'فليمنج': ['شارع فليمنج','شارع أبو قير','ميدان فليمنج','شارع مصطفى كامل','شارع الترام','شارع 10','شارع الحرية','شارع بورسعيد','شارع السلطان حسين','شارع النصر','شارع الإسكندر الأكبر','محطة فليمنج','شارع جليم'],
  'ميامي': ['شارع ميامي','شاطئ ميامي','شارع خالد بن الوليد','ميدان ميامي','شارع 45','شارع جمال عبد الناصر','شارع الترام','شارع مصطفى كامل','شارع الحرية','شارع النصر','شارع الإسكندر الأكبر','شارع فوزي معاذ','شارع المعسكر الروماني','ميدان سيدي بشر'],
  'أبو قير': ['شارع أبو قير','خليج أبو قير','قلعة أبو قير','شارع الكورنيش','الأنفوشي','طابية أبو قير','المعهد','شارع الحرية','شارع النصر','شارع الجيش','شارع المصنع','شارع المحطة','شارع السوق','شارع البحر','أبو قير البلد','أبو قير الجديدة','ميدان أبو قير','منطقة المعبد'],
  'المنشية': ['ميدان المنشية','شارع فؤاد','شارع صلاح سالم','ميدان التحرير','شارع النبي دانيال','سوق المنشية','شارع الحرية','شارع محمد علي','شارع السبع بنات','شارع العطارين','شارع سعد زغلول','شارع صفية زغلول','ميدان محمد علي','شارع الشريف','شارع فرنسا','القنصلية','سوق الذهب','شارع التتويج','شارع شريف'],
  'الشاطبي': ['شارع بور سعيد','جامعة الإسكندرية','مستشفى الشاطبي','شارع الشاطبي','شارع الحرية','كلية الطب','ميدان الشاطبي','شارع الترام','شارع فؤاد','شارع النبي دانيال','شارع سعد زغلول','المقابر اللاتينية','شارع كنيسة الأقباط','شارع الإبراهيمية','شارع محطة الرمل','شارع ستانلي'],
  'باكوس': ['شارع باكوس','شارع الإسكندر الأكبر','ميدان باكوس','محطة باكوس','شارع أبو قير','شارع 10','شارع الترام','شارع الحرية','شارع بورسعيد','شارع مصطفى كامل','شارع النصر','شارع المدراسة','شارع السوق','شارع فليمنج'],
  'بولكلي': ['شارع بولكلي','شارع أبو قير','ميدان بولكلي','شارع السلطان حسين','شارع الترام','شارع مصطفى فهمي','شارع الحرية','شارع بورسعيد','شارع النصر','شارع رشدي','شارع الإسكندر الأكبر','شارع ألبرت الأول','محطة بولكلي','شارع جليم'],
  'زيزينيا': ['شارع زيزينيا','شارع أبو قير','ميدان زيزينيا','شارع بورسعيد','شارع الحرية','كورنيش زيزينيا','شارع الترام','شارع مصطفى فهمي','شارع السلطان حسين','شارع النصر','شارع 14 مايو','شارع جليم','محطة زيزينيا'],
  'الحضرة': ['شارع الحضرة','شارع مصطفى كامل','ميدان الحضرة','شارع بورسعيد','مستشفى الحضرة','شارع المحطة','شارع الحرية','شارع الترام','شارع النصر','شارع محرم بك','شارع القباري','شارع إبراهيم الأول','شارع المدراسة','شارع السوق','الحضرة الجديدة','شارع الجيش'],
  'كرموز': ['شارع كرموز','شارع الميدان','ميدان كرموز','شارع المحمودية','شارع الحرية','عمود السواري','شارع النصر','شارع بورسعيد','شارع الترعة','شارع الجمهورية','شارع المدراسة','شارع السوق','شارع الجيش','شارع صلاح سالم','ميدان عمود السواري','شارع رأس التين','السراي'],
  'العامرية': ['العامرية القديمة','العامرية الجديدة','المنطقة الصناعية','شارع الإسكندرية مطروح','ميدان العامرية','شارع التحرير','كينج مريوط','شارع الحرية','شارع الجمهورية','شارع النصر','شارع المدراسة','شارع المحطة','شارع السوق','شارع المصنع','العامرية الأولى','العامرية الثانية','عزبة خورشيد','نجع العرب'],
  'برج العرب': ['برج العرب القديمة','برج العرب الجديدة','المنطقة الصناعية','شارع الإسكندرية مطروح','ميدان برج العرب','مدينة برج العرب الجديدة','شارع المحطة','شارع المصنع','شارع الجمهورية','شارع الحرية','شارع المدراسة','المنطقة السياحية','الحي الأول','الحي الثاني','الحي الثالث'],
  'المكس': ['شارع المكس','الميناء','شارع الكورنيش','ميدان المكس','الورديان','شارع الحرية','منطقة النقل البحري','شارع بورسعيد','شارع الجمهورية','شارع المصنع','شارع المدراسة','شارع النصر','شارع الجيش','المكس البلد','ميناء الصيد'],
  'سابا باشا': ['شارع سابا باشا','شارع أبو قير','ميدان سابا باشا','شارع الحرية','شارع مصطفى كامل','شارع 10','شارع ألبرت الأول','شارع الترام','شارع بورسعيد','شارع النصر','شارع فوزي معاذ','محطة سابا باشا','شارع جمال عبد الناصر','شارع الإسكندر الأكبر','شارع 14 مايو'],
  'مصطفى كامل': ['شارع مصطفى كامل','ميدان مصطفى كامل','شارع الفتح','شارع أبو قير','شارع جمال عبد الناصر','شارع 45','محطة مصطفى كامل','شارع الترام','شارع الحرية','شارع النصر','شارع بورسعيد','شارع المدراسة','شارع السوق','مصطفى كامل الجديدة'],
  'الشلالات': ['شارع الشلالات','حدائق الشلالات','شارع بورسعيد','ميدان الشلالات','شارع محطة الترام','شارع مصطفى كامل','شارع النبي دانيال','شارع الحرية','شارع فؤاد','شارع النصر','شارع الترام','شارع محرم بك','شارع الحضرة','ميدان النافورة'],
  'الأميرية': ['شارع الأميرية','شارع مصطفى كامل','ميدان الأميرية','شارع بورسعيد','شارع 45','محطة الأميرية','شارع جليم','شارع الحرية','شارع النصر','شارع الترام','شارع فوزي معاذ','شارع الإسكندر الأكبر','الأميرية الجديدة'],
  'سيدي كرير': ['شارع سيدي كرير','شاطئ سيدي كرير','طريق الإسكندرية مطروح','قرية مارينا','قرية هاسيندا','قرية ماربيلا','الساحل الشمالي','كيلو 21','شاطئ النخيل','شاطئ الهانوفيل','قرية لافيستا','قرية مراسي','قرية أمواج','شارع الكورنيش'],
  'الهانوفيل': ['شارع الهانوفيل','شاطئ الهانوفيل','البيطاش','العجمي','طريق 45','شارع الملك مريوط','شارع النصر','شارع الحرية','شارع الجمهورية','شارع المدراسة','شارع السوق','الهانوفيل الشرقية','الهانوفيل الغربية','شارع الكورنيش'],
  'غيط العنب': ['شارع غيط العنب','شارع الترعة','ميدان غيط العنب','شارع المحمودية','شارع الحرية','شارع الإسكندرية','محطة غيط العنب','شارع بورسعيد','شارع الجمهورية','شارع المدراسة','شارع السوق','شارع النصر','شارع الجيش','غيط العنب الجديدة'],
  'الورديان': ['شارع الورديان','شارع بورسعيد','ميدان الورديان','شارع الكورنيش','شارع الحرية','شارع المصنع','محطة الورديان','شارع الجمهورية','شارع النصر','شارع المدراسة','شارع السوق','شارع الجيش','الورديان الجديدة','الورديان البلد'],
  'النخيل': ['شارع النخيل','شارع الإسكندرية مطروح','ميدان النخيل','شارع الملك مريوط','العامرية','البيطاش','شارع 45','شاطئ النخيل','شارع الحرية','شارع الجمهورية','شارع النصر','شارع المدراسة','شارع السوق','النخيل الجديدة'],
  'العوايد': ['شارع العوايد','شارع بورسعيد','ميدان العوايد','شارع محمد علي','شارع الحرية','شارع المحطة','سيدي بشر','شارع الجيش','شارع الجمهورية','شارع النصر','شارع 45','شارع المدراسة','العوايد الجديدة','العوايد القديمة'],
  'الجمرك': ['شارع الجمرك','ميناء الإسكندرية','ميدان الجمرك','شارع رأس التين','شارع الكورنيش','الأنفوشي','شارع الحرية','المنشية','شارع الميناء','شارع فؤاد','شارع صلاح سالم','شارع بورسعيد','شارع الجيش','منطقة الجمرك التجارية','ميدان أبو العباس'],
  'الأنفوشي': ['شارع الأنفوشي','قلعة قايتباي','شاطئ الأنفوشي','شارع رأس التين','ميدان أبو العباس','شارع الكورنيش','مقابر الأنفوشي','شارع الميناء','شارع الحرية','شارع فؤاد','شارع صلاح سالم','سوق السمك','شارع الجمرك','بحري','شارع السيالة','ميدان المنشية'],
};

// Build comprehensive queries for a specific area using its sub-zones
function buildAreaQueries(searchTerm, area, city) {
  const zones = AREA_SUB_ZONES[area] || [];
  const queries = [
    `${searchTerm} في ${area}`,
    `${searchTerm} ${area}`,
  ];
  for (const zone of zones) {
    queries.push(`${searchTerm} ${zone} ${area}`);
  }
  if (city && city !== area) {
    queries.push(`${searchTerm} في ${area} ${city}`);
  }
  return [...new Set(queries.filter(q => q.trim()))];
}

// Multi-engine local business scraper (serverless-compatible, no puppeteer)
// Distributes searches across multiple engines to avoid blocking
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const PHONE_REGEX = /(?:0[12]\d[\s\-]?\d{3,4}[\s\-]?\d{3,4}|\+20[\s\-]?\d{1,2}[\s\-]?\d{3,4}[\s\-]?\d{3,4})/;
const PHONE_REGEX_G = new RegExp(PHONE_REGEX.source, 'g');

function normalizeResultUrl(rawUrl = '') {
  if (!rawUrl) return '';
  let candidate = rawUrl.trim();

  if (candidate.startsWith('/url?')) {
    try {
      const parsed = new URL(`https://www.google.com${candidate}`);
      const q = parsed.searchParams.get('q') || '';
      candidate = q || candidate;
    } catch {
      return '';
    }
  }

  if (candidate.startsWith('//')) candidate = `https:${candidate}`;
  if (candidate.startsWith('/')) return '';
  if (!/^https?:\/\//i.test(candidate)) return '';

  try {
    return decodeURIComponent(candidate);
  } catch {
    return candidate;
  }
}

// Request counter — rotates engine per call to distribute load
let requestCounter = 0;

// ====== MAIN SCRAPER ======
async function scrapeLocalSearch(query, engineHint = 0) {
  let businesses = [];
  const _debug = { strategies: [], htmlLengths: {}, statusCodes: {}, error: null, engineOrder: [] };

  const counter = engineHint > 0 ? engineHint - 1 : requestCounter++;
  const engineOrder = [
    ['google', 'brave', 'startpage'],
    ['brave', 'startpage', 'google'],
    ['startpage', 'google', 'brave'],
  ][counter % 3];
  _debug.engineOrder = engineOrder;

  for (const engine of engineOrder) {
    if (businesses.length > 0) break;
    try {
      if (engine === 'brave') {
        businesses = await scrapeBraveSearch(query, _debug);
        if (businesses.length > 0) _debug.strategies.push('brave');
      } else if (engine === 'google') {
        businesses = await scrapeGoogleLocal(query, _debug);
        if (businesses.length > 0) _debug.strategies.push('google');
      } else if (engine === 'startpage') {
        businesses = await scrapeStartpage(query, _debug);
        if (businesses.length > 0) _debug.strategies.push('startpage');
      }
    } catch (err) {
      _debug.error = `${engine}: ${err.message}`;
      console.error(`[scrape] ${engine} failed:`, err.message);
    }
    if (businesses.length === 0) {
      await new Promise(r => setTimeout(r, 500 + Math.floor(Math.random() * 1000)));
    }
  }

  return { businesses, _debug };
}

// ====== BRAVE SEARCH SCRAPER ======
async function scrapeBraveSearch(query, _debug) {
  const businesses = [];
  const seenNames = new Set();
  const seenPhones = new Set();

  const headers = {
    'User-Agent': getRandomUA(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ar,en;q=0.5',
    'Accept-Encoding': 'identity',
  };

  const enhancedQuery = query.includes('رقم') ? query : `${query} رقم هاتف`;
  const params = new URLSearchParams({ q: enhancedQuery });
  const resp = await fetch(`https://search.brave.com/search?${params}`, { headers, redirect: 'follow' });
  _debug.statusCodes.brave = resp.status;
  if (!resp.ok) return businesses;

  const html = await resp.text();
  _debug.htmlLengths.brave = html.length;
  const $ = cheerio.load(html);

  $('.snippet, .fdb, [class*="result"]').each((_, el) => {
    const $card = $(el);
    const cardText = $card.text();

    let phone = '';
    const $tel = $card.find('a[href^="tel:"]').first();
    if ($tel.length) {
      phone = ($tel.attr('href') || '').replace('tel:', '').replace(/[\s\-]+/g, '');
    }
    if (!phone || phone.length < 8) {
      const phoneMatch = cardText.match(PHONE_REGEX);
      if (phoneMatch) phone = phoneMatch[0];
    }
    if (!phone || phone.length < 8 || seenPhones.has(phone.replace(/[\s\-]/g, ''))) return;

    let name = '';
    const $title = $card.find('a[class*="heading"], .snippet-title, .title').first();
    if ($title.length) {
      const linkText = $title.text().trim();
      const segments = linkText.split('›').map(s => s.trim()).filter(s => s.length > 2);
      name = segments.length > 1 ? segments[segments.length - 1] : segments[0] || '';
      name = name.replace(/^[\w\u0600-\u06FF_-]+\s{2,}/, '');
    }
    if (!name || name.length < 3) {
      $card.find('strong, b').each((_, b) => {
        if (name) return;
        const t = $(b).text().trim();
        if (t.length >= 5 && t.length < 60 && !/^(call|price|address|more|click|www\.|http)/i.test(t)) name = t;
      });
    }
    if (!name || name.length < 3) {
      const desc = $card.find('.snippet-description, .generic-snippet, [class*="snippet"]').text().trim();
      const parts = desc.replace(PHONE_REGEX_G, '').split(/[.·\n]/).filter(s => s.trim().length > 5);
      if (parts[0]) name = parts[0].trim().substring(0, 80);
    }

    name = name.replace(/\s*[-|–—›].*$/, '').replace(/\s{2,}/g, ' ').trim();
    if (name && name.length >= 3 && name.length < 80 && !seenNames.has(name.toLowerCase())) {
      seenNames.add(name.toLowerCase());
      seenPhones.add(phone.replace(/[\s\-]/g, ''));
      const website = normalizeResultUrl($card.find('a[href]').first().attr('href') || '');
      businesses.push({ name, phone, address: '', rating: 0, category: '', website });
    }
  });

  if (businesses.length === 0) {
    extractPhonesWithNames($('body').text(), businesses, seenNames);
  }

  return businesses;
}

// ====== STARTPAGE SCRAPER ======
async function scrapeStartpage(query, _debug) {
  const businesses = [];
  const seenNames = new Set();

  const headers = {
    'User-Agent': getRandomUA(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ar,en;q=0.5',
    'Accept-Encoding': 'identity',
  };

  const enhancedQuery = query.includes('رقم') ? query : `${query} رقم تليفون`;
  const params = new URLSearchParams({ q: enhancedQuery, language: 'arabic', cat: 'web' });
  const resp = await fetch(`https://www.startpage.com/do/search?${params}`, { headers, redirect: 'follow' });
  _debug.statusCodes.startpage = resp.status;
  if (!resp.ok) return businesses;

  const html = await resp.text();
  _debug.htmlLengths.startpage = html.length;
  const $ = cheerio.load(html);

  $('.w-gl__result, .result, [class*="result"]').each((_, el) => {
    const $result = $(el);
    const resultText = $result.text();
    const phoneMatch = resultText.match(PHONE_REGEX);
    if (!phoneMatch) return;

    let name = '';
    const $title = $result.find('h3, h2, .w-gl__result-title, [class*="title"]').first();
    if ($title.length) {
      name = $title.text().trim().replace(/\s*[-|–—].*$/, '').trim();
    }
    if (!name || name.length < 3) {
      const desc = $result.find('p, .w-gl__description, [class*="description"]').text().trim();
      const parts = desc.replace(PHONE_REGEX_G, '').split(/[.·\n]/).filter(s => s.trim().length > 5);
      if (parts[0]) name = parts[0].trim().substring(0, 80);
    }

    if (name && name.length >= 3 && name.length < 80 && !seenNames.has(name.toLowerCase())) {
      seenNames.add(name.toLowerCase());
      const website = normalizeResultUrl($result.find('a[href]').first().attr('href') || '');
      businesses.push({ name, phone: phoneMatch[0], address: '', rating: 0, category: '', website });
    }
  });

  if (businesses.length === 0) {
    extractPhonesWithNames($('body').text(), businesses, seenNames);
  }

  return businesses;
}

// ====== GOOGLE LOCAL SEARCH SCRAPER ======
async function scrapeGoogleLocal(query, _debug) {
  const businesses = [];

  const timestamp = Date.now();
  const nidValue = Math.floor(Math.random() * 999);

  const headers = {
    'User-Agent': getRandomUA(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'identity',
    'Cache-Control': 'max-age=0',
    'Cookie': `CONSENT=PENDING+${nidValue}; SOCS=CAESHAgBEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmFyIAEaBgiA_LyaBg; NID=${nidValue}=dummy_${timestamp}; HSID=A${timestamp}; SID=g.a000${timestamp}`,
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Referer': 'https://www.google.com/',
    'DNT': '1',
  };

  const params = new URLSearchParams({ q: query, tbm: 'lcl', hl: 'ar', gl: 'eg', num: '20' });
  const resp = await fetch(`https://www.google.com/search?${params}`, { headers, redirect: 'follow' });
  _debug.statusCodes.google = resp.status;
  if (!resp.ok) return businesses;

  const html = await resp.text();
  _debug.htmlLengths.google = html.length;

  const $ = cheerio.load(html);
  const seenNames = new Set();

  $('[data-cid]').each((_, el) => {
    const $el = $(el);
    let name = $el.find('[role="heading"] span').first().text().trim()
      || $el.find('[role="heading"]').first().text().trim()
      || '';
    if (!name) {
      const ariaLabel = $el.attr('aria-label') || $el.find('a').first().attr('aria-label') || '';
      if (ariaLabel && ariaLabel.length < 80) name = ariaLabel;
    }
    if (!name || name.length < 3 || name.length > 80 || seenNames.has(name.toLowerCase())) return;

    const cardText = $el.text();
    const phoneMatch = cardText.match(PHONE_REGEX);

    let rating = 0;
    $el.find('span').each((_, sp) => {
      const t = $(sp).text().trim();
      if (/^\d\.\d$/.test(t)) { const r = parseFloat(t); if (r >= 1 && r <= 5) rating = r; }
    });

    seenNames.add(name.toLowerCase());
    const website = normalizeResultUrl($el.find('a[href]').first().attr('href') || '');
    businesses.push({
      name,
      phone: phoneMatch ? phoneMatch[0] : '',
      address: '',
      rating,
      category: '',
      website,
    });
  });

  if (businesses.length === 0) {
    $('[role="heading"]').each((_, el) => {
      const $heading = $(el);
      const name = $heading.find('span').first().text().trim() || $heading.text().trim();
      if (!name || name.length < 3 || name.length > 80 || seenNames.has(name.toLowerCase())) return;
      const $container = $heading.closest('div').parent();
      const text = $container.text();
      const phoneMatch = text.match(PHONE_REGEX);
      seenNames.add(name.toLowerCase());
      const website = normalizeResultUrl($container.find('a[href]').first().attr('href') || '');
      businesses.push({ name, phone: phoneMatch ? phoneMatch[0] : '', address: '', rating: 0, category: '', website });
    });
  }

  if (businesses.length === 0) {
    extractPhonesWithNames($('body').text(), businesses, seenNames);
  }

  return businesses;
}

// ====== SHARED: Extract phones with nearby business names ======
function extractPhonesWithNames(bodyText, businesses, seenNames) {
  let match;
  const regex = new RegExp(PHONE_REGEX.source, 'g');
  while ((match = regex.exec(bodyText)) !== null) {
    const before = bodyText.substring(Math.max(0, match.index - 200), match.index);
    const segments = before.split(/[·\n\r\t|•—–›,]/).filter(s => s.trim().length > 2);
    let nameLine = '';
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i].trim();
      if (seg.length >= 3 && seg.length < 80 && !/^\d+[\s.\d]*$/.test(seg) && !/^\(?\d+\)?$/.test(seg)) {
        nameLine = seg;
        break;
      }
    }
    if (nameLine && !seenNames.has(nameLine.toLowerCase())) {
      seenNames.add(nameLine.toLowerCase());
      businesses.push({ name: nameLine, phone: match[0], address: '', rating: 0, category: '', website: '' });
    }
  }
}

// ====== 140ONLINE.COM SCRAPER ======
const ONLINE140_BASE = 'https://www.140online.com';
const ONLINE140_PAGE_SIZE = 20;
const ONLINE140_CHUNK_SIZE = 10;
const ONLINE140_CHUNKS_PER_PAGE = Math.ceil(ONLINE140_PAGE_SIZE / ONLINE140_CHUNK_SIZE);

function normalizePhone(phone = '') {
  return String(phone).replace(/[\s\-]+/g, '').trim();
}

function build140CategoryPageUrl(catId, catName, page) {
  const encoded = encodeURIComponent(catName || '');
  if (page <= 1) return `${ONLINE140_BASE}/Class/${catId}/${encoded}`;
  return `${ONLINE140_BASE}/class/pages/${catId}/${encoded}/${page}`;
}

function build140ProductPageUrl(prodId, prodName) {
  const encoded = encodeURIComponent(prodName || '');
  return `${ONLINE140_BASE}/product/${prodId}/${encoded}`;
}

function build140KeywordResultPageUrl(query, page = 1) {
  const base = `${ONLINE140_BASE}/result.aspx?c=0&a=0&txt=${encodeURIComponent(query || '')}`;
  if (page <= 1) return base;
  return `${base}&Page=${page}`;
}

function parse140TotalResults($page) {
  const totalText = $page('body').text().match(/كل النتائج\s*-?\s*([0-9\u0660-\u0669]+)/);
  if (!totalText || !totalText[1]) return 0;

  // 140Online sometimes returns Arabic-Indic digits.
  const normalized = totalText[1].replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));
  const total = parseInt(normalized, 10);
  return Number.isFinite(total) ? total : 0;
}

function extract140CompanyLinks($page, seenIds = new Set()) {
  const companyEntries = [];
  // Paginated listing pages use /company/ID/NAME/ links in h3 > a
  $page('a[href*="/company/"]').each((_, el) => {
    const href = $page(el).attr('href') || '';
    if (href.includes('AddCompany') || href.includes('javascript:')) return;
    const idMatch = href.match(/\/company\/([^/]+)\//i);
    if (idMatch && !seenIds.has(idMatch[1])) {
      seenIds.add(idMatch[1]);
      const fullUrl = href.startsWith('http') ? href : `${ONLINE140_BASE}${href.startsWith('/') ? '' : '/'}${href}`;
      const name = $page(el).text().trim();
      const fallbackName = (name && name.length > 2 && name.length < 120) ? name : '';
      companyEntries.push({ url: fullUrl, fallbackName });
    }
  });

  // Also check CompanyId= format (used on category pages)
  $page('a[href*="CompanyId="]').each((_, el) => {
    const href = $page(el).attr('href') || '';
    const idMatch = href.match(/CompanyId=([^&]+)/);
    if (idMatch && !seenIds.has(idMatch[1]) && !href.includes('AddCompany')) {
      seenIds.add(idMatch[1]);
      const fullUrl = href.startsWith('http') ? href : `${ONLINE140_BASE}${href.startsWith('/') ? '' : '/'}${href}`;
      companyEntries.push({ url: fullUrl, fallbackName: '' });
    }
  });

  return companyEntries;
}

async function scrape140EntriesChunk(entries, chunk) {
  const sliceStart = chunk * ONLINE140_CHUNK_SIZE;
  const entriesChunk = entries.slice(sliceStart, sliceStart + ONLINE140_CHUNK_SIZE);
  const businesses = [];
  const seenPhones = new Set();

  const details = await Promise.allSettled(entriesChunk.map(entry => scrape140Company(entry.url)));
  for (let i = 0; i < details.length; i++) {
    const result = details[i];
    if (result.status !== 'fulfilled' || !result.value) continue;
    const biz = result.value;
    if (!biz.name && entriesChunk[i].fallbackName) biz.name = entriesChunk[i].fallbackName;
    const phoneKey = normalizePhone(biz.phone);
    if (phoneKey && !seenPhones.has(phoneKey)) {
      seenPhones.add(phoneKey);
      businesses.push(biz);
    }
  }

  return businesses;
}

async function scrape140Company(companyUrl) {
  try {
    const resp = await fetch(companyUrl, {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.5',
      },
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const $ = cheerio.load(html);

    const data = { name: '', phone: '', address: '', website: '', category: '' };

    // Extract name from h3.tithenamcomp span (the actual company name element)
    const nameSpan = $('h3.tithenamcomp span').first();
    if (nameSpan.length) {
      // Remove nested div (contains city) to get just the company name
      nameSpan.find('div').remove();
      data.name = nameSpan.text().trim();
    }
    if (!data.name) {
      // Fallback: try meta og:title or page title
      data.name = $('meta[property="og:title"]').attr('content') || $('title').text().trim() || '';
    }

    // Parse detail table rows
    $('table tr, .company-info tr, #ContentPlaceHolder1_Table1 tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return;
      const label = $(cells[0]).text().trim();
      const value = $(cells[1]).text().trim();
      if (/تليفون|تلفون|هاتف|تليف/i.test(label) && !/فاكس/i.test(label)) {
        const phones = value.replace(/[\s]+/g, ' ').trim();
        if (phones && phones.length >= 8) data.phone = phones;
      } else if (/عنوان/i.test(label)) {
        data.address = value;
      } else if (/موقع|ويب|website/i.test(label)) {
        const link = $(cells[1]).find('a').attr('href') || value;
        if (link && !link.includes('140online')) data.website = link;
      } else if (/تصنيف|نشاط/i.test(label)) {
        data.category = value.split(',')[0].trim();
      }
    });

    // Fallback: try WhatsApp link for phone
    if (!data.phone) {
      const waLink = $('a[href*="api.whatsapp.com"]').attr('href') || '';
      const waMatch = waLink.match(/phone=(\d+)/);
      if (waMatch) data.phone = waMatch[1];
    }

    return data.phone ? data : null;
  } catch {
    return null;
  }
}

async function scrape140Online(query, maxPages = 5) {
  const businesses = [];
  const seenPhones = new Set();
  const companyEntries = []; // { url, fallbackName }
  const seenIds = new Set();

  // Step 1: Use autocomplete API to find matching companies and categories
  const acResp = await fetch(`${ONLINE140_BASE}/autoComplete.aspx?term=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': getRandomUA(), 'Accept': 'application/json' },
  });
  if (!acResp.ok) return { businesses, total: 0 };
  const acResults = await acResp.json();

  // Collect direct company URLs from autocomplete results
  for (const item of acResults) {
    if (item.cat === 'comp' && item.id) {
      seenIds.add(item.id);
      const nameSlug = encodeURIComponent(item.nm || item.label || '');
      companyEntries.push({
        url: `${ONLINE140_BASE}/company/${item.id}/${nameSlug}/`,
        fallbackName: item.nm || item.label || '',
      });
    }
  }

  // Step 2: For category results, crawl multiple listing pages
  const categoryItems = acResults.filter(i => i.cat === 'clas');
  for (const cat of categoryItems) {
    try {
      // Fetch first page of the category
      const firstPageUrl = build140CategoryPageUrl(cat.id, cat.label || '', 1);
      const resp1 = await fetch(firstPageUrl, {
        headers: { 'User-Agent': getRandomUA(), 'Accept': 'text/html' },
        redirect: 'follow',
      });
      if (!resp1.ok) continue;
      const html1 = await resp1.text();
      const $1 = cheerio.load(html1);
      const firstPageEntries = extract140CompanyLinks($1, seenIds);
      companyEntries.push(...firstPageEntries);

      // Check total + determine max pages available
      const totalResults = parse140TotalResults($1);
      const availablePages = Math.ceil(totalResults / ONLINE140_PAGE_SIZE); // ~20 per page
      const pagesToFetch = Math.min(maxPages - 1, availablePages - 1); // -1 because we already got page 1

      // Fetch additional pages
      for (let p = 2; p <= pagesToFetch + 1; p++) {
        await new Promise(r => setTimeout(r, 200));
        try {
          const pageUrl = build140CategoryPageUrl(cat.id, cat.label || '', p);
          const respP = await fetch(pageUrl, {
            headers: { 'User-Agent': getRandomUA(), 'Accept': 'text/html' },
            redirect: 'follow',
          });
          if (!respP.ok) continue;
          const htmlP = await respP.text();
          const $p = cheerio.load(htmlP);
          const entries = extract140CompanyLinks($p, seenIds);
          companyEntries.push(...entries);
          if (entries.length === 0) break; // No more results
        } catch { break; }
      }
    } catch { /* skip failed category */ }
  }

  // Step 2b: If autocomplete has no categories, fallback to global keyword results
  // (result.aspx has the "كل النتائج" list shown on 140online.com search page).
  if (categoryItems.length === 0) {
    try {
      const firstResultUrl = build140KeywordResultPageUrl(query, 1);
      const firstResp = await fetch(firstResultUrl, {
        headers: { 'User-Agent': getRandomUA(), 'Accept': 'text/html' },
        redirect: 'follow',
      });

      if (firstResp.ok) {
        const firstHtml = await firstResp.text();
        const $first = cheerio.load(firstHtml);
        const firstEntries = extract140CompanyLinks($first, seenIds);
        companyEntries.push(...firstEntries);

        const totalResults = parse140TotalResults($first);
        const availablePages = totalResults > 0
          ? Math.ceil(totalResults / ONLINE140_PAGE_SIZE)
          : 1;
        const pagesToFetch = Math.min(maxPages - 1, Math.max(availablePages - 1, 0));

        for (let p = 2; p <= pagesToFetch + 1; p++) {
          await new Promise(r => setTimeout(r, 200));
          try {
            const pageUrl = build140KeywordResultPageUrl(query, p);
            const pageResp = await fetch(pageUrl, {
              headers: { 'User-Agent': getRandomUA(), 'Accept': 'text/html' },
              redirect: 'follow',
            });
            if (!pageResp.ok) continue;
            const pageHtml = await pageResp.text();
            const $page = cheerio.load(pageHtml);
            const entries = extract140CompanyLinks($page, seenIds);
            companyEntries.push(...entries);
            if (entries.length === 0) break;
          } catch { break; }
        }
      }
    } catch {
      // Keep direct-company results only if keyword fallback fails.
    }
  }

  // Step 3: Fetch company detail pages in batches of 10 (no limit)
  const BATCH_SIZE = 10;
  for (let i = 0; i < companyEntries.length; i += BATCH_SIZE) {
    const batch = companyEntries.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(e => scrape140Company(e.url)));
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === 'fulfilled' && r.value) {
        const biz = r.value;
        // Use fallback name from listing if scraper didn't find one
        if (!biz.name && batch[j].fallbackName) biz.name = batch[j].fallbackName;
        const phoneKey = normalizePhone(biz.phone);
        if (!seenPhones.has(phoneKey)) {
          seenPhones.add(phoneKey);
          businesses.push(biz);
        }
      }
    }
    // Small delay between batches
    if (i + BATCH_SIZE < companyEntries.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return { businesses, total: companyEntries.length };
}

// 140Online search endpoint
app.post('/api/scrape/140online/search', async (req, res) => {
  try {
    const { query, maxPages } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    const pages = Math.min(Math.max(parseInt(maxPages) || 5, 1), 200);
    const { businesses, total } = await scrape140Online(query, pages);

    // Check which phones already exist
    const phones = businesses.map(b => b.phone).filter(Boolean);
    const existingLeads = phones.length > 0
      ? await Lead.find({ phone: { $in: phones } }).select('phone').lean()
      : [];
    const existingPhones = new Set(existingLeads.map(l => l.phone));

    const results = businesses.map(b => ({
      company_name: b.name,
      phone: b.phone,
      email: '',
      website: b.website || '',
      industry: b.category || query,
      city: b.address || '',
      source: '140online',
      address: b.address || '',
      rating: 0,
      alreadySaved: existingPhones.has(b.phone),
    }));

    res.json({ leads: results, totalFound: total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 140Online build batched tasks (frontend runs them one-by-one like gmaps comprehensive mode)
app.post('/api/scrape/140online/build-queries', async (req, res) => {
  try {
    const { query, maxPages } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    const pages = Math.min(Math.max(parseInt(maxPages) || 5, 1), 200);
    const acResp = await fetch(`${ONLINE140_BASE}/autoComplete.aspx?term=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': getRandomUA(), 'Accept': 'application/json' },
    });

    if (!acResp.ok) {
      return res.status(502).json({ error: 'Failed to load 140Online index' });
    }

    const acResults = await acResp.json();
    const tasks = [];
    const seenTaskKeys = new Set();
    let directCompanies = 0;
    let productBuckets = 0;
    let keywordPages = 0;

    // Direct company results from autocomplete
    for (const item of acResults) {
      if (item.cat !== 'comp' || !item.id) continue;
      const key = `company:${item.id}`;
      if (seenTaskKeys.has(key)) continue;
      seenTaskKeys.add(key);
      const nameSlug = encodeURIComponent(item.nm || item.label || '');
      tasks.push({
        type: 'company',
        url: `${ONLINE140_BASE}/company/${item.id}/${nameSlug}/`,
        fallbackName: item.nm || item.label || '',
        label: item.nm || item.label || `Company ${item.id}`,
      });
      directCompanies++;
    }

    // Category pages split into small chunks (10 companies per request) to avoid serverless timeouts
    const categoryItems = acResults.filter(item => item.cat === 'clas' && item.id);
    for (const cat of categoryItems) {
      const catId = String(cat.id);
      const catName = String(cat.label || '').trim() || `Category ${catId}`;
      for (let page = 1; page <= pages; page++) {
        for (let chunk = 0; chunk < ONLINE140_CHUNKS_PER_PAGE; chunk++) {
          const key = `cat:${catId}:p${page}:c${chunk}`;
          if (seenTaskKeys.has(key)) continue;
          seenTaskKeys.add(key);
          tasks.push({
            type: 'category_page',
            catId,
            catName,
            page,
            chunk,
            label: `${catName} — صفحة ${page}/${pages} (${chunk + 1}/${ONLINE140_CHUNKS_PER_PAGE})`,
          });
        }
      }
    }

    // If autocomplete doesn't expose class buckets, fallback to global keyword search pages.
    if (categoryItems.length === 0) {
      try {
        const firstResultUrl = build140KeywordResultPageUrl(query, 1);
        const resultResp = await fetch(firstResultUrl, {
          headers: { 'User-Agent': getRandomUA(), 'Accept': 'text/html' },
          redirect: 'follow',
        });

        if (resultResp.ok) {
          const resultHtml = await resultResp.text();
          const $result = cheerio.load(resultHtml);
          const firstEntries = extract140CompanyLinks($result, new Set());
          const totalResults = parse140TotalResults($result);
          const availablePages = totalResults > 0
            ? Math.ceil(totalResults / ONLINE140_PAGE_SIZE)
            : (firstEntries.length > 0 ? 1 : 0);
          const pagesForKeyword = Math.min(pages, availablePages);

          if (pagesForKeyword > 0) {
            keywordPages = pagesForKeyword;
            for (let page = 1; page <= pagesForKeyword; page++) {
              for (let chunk = 0; chunk < ONLINE140_CHUNKS_PER_PAGE; chunk++) {
                const key = `kw:p${page}:c${chunk}`;
                if (seenTaskKeys.has(key)) continue;
                seenTaskKeys.add(key);
                tasks.push({
                  type: 'keyword_page',
                  page,
                  chunk,
                  label: `${query} — صفحة ${page}/${pagesForKeyword} (${chunk + 1}/${ONLINE140_CHUNKS_PER_PAGE})`,
                });
              }
            }
          }
        }
      } catch {
        // Ignore keyword fallback task generation errors and keep other tasks.
      }
    }

    // Product pages can include additional companies even when class suggestions are limited.
    // Split each product result into chunks to keep each request lightweight.
    const productItems = acResults.filter(item => item.cat === 'prod' && item.id).slice(0, 10);
    const maxProductChunks = Math.max(1, pages * ONLINE140_CHUNKS_PER_PAGE);
    for (const prod of productItems) {
      const prodId = String(prod.id);
      const prodName = String(prod.label || '').trim() || `Product ${prodId}`;
      const productUrl = build140ProductPageUrl(prodId, prodName);
      let chunksCount = 1;

      try {
        const productResp = await fetch(productUrl, {
          headers: { 'User-Agent': getRandomUA(), 'Accept': 'text/html' },
          redirect: 'follow',
        });
        if (productResp.ok) {
          const productHtml = await productResp.text();
          const $product = cheerio.load(productHtml);
          const entries = extract140CompanyLinks($product, new Set());
          chunksCount = Math.max(1, Math.ceil(entries.length / ONLINE140_CHUNK_SIZE));
        }
      } catch {
        // If product introspection fails, keep one fallback chunk task
      }

      chunksCount = Math.min(chunksCount, maxProductChunks);
      for (let chunk = 0; chunk < chunksCount; chunk++) {
        const key = `prod:${prodId}:c${chunk}`;
        if (seenTaskKeys.has(key)) continue;
        seenTaskKeys.add(key);
        tasks.push({
          type: 'product_page',
          prodId,
          prodName,
          chunk,
          label: `${prodName} — ${chunk + 1}/${chunksCount}`,
        });
      }
      productBuckets++;
    }

    res.json({
      tasks,
      totalTasks: tasks.length,
      categories: categoryItems.length,
      products: productBuckets,
      directCompanies,
      pagesPerCategory: pages,
      keywordPages,
      chunkSize: ONLINE140_CHUNK_SIZE,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 140Online run a single small task
app.post('/api/scrape/140online/search-single', async (req, res) => {
  try {
    const { query, task } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });
    if (!task || !task.type) return res.status(400).json({ error: 'task is required' });

    let businesses = [];

    if (task.type === 'company') {
      if (!task.url) return res.status(400).json({ error: 'task.url is required for company tasks' });
      const biz = await scrape140Company(task.url);
      if (biz) {
        if (!biz.name && task.fallbackName) biz.name = task.fallbackName;
        businesses.push(biz);
      }
    } else if (task.type === 'category_page') {
      const catId = String(task.catId || '');
      const catName = String(task.catName || '');
      const page = Math.max(parseInt(task.page) || 1, 1);
      const chunk = Math.max(parseInt(task.chunk) || 0, 0);
      if (!catId || !catName) return res.status(400).json({ error: 'task.catId and task.catName are required for category_page tasks' });

      const pageUrl = build140CategoryPageUrl(catId, catName, page);
      const pageResp = await fetch(pageUrl, {
        headers: { 'User-Agent': getRandomUA(), 'Accept': 'text/html' },
        redirect: 'follow',
      });

      if (!pageResp.ok) {
        return res.json({ leads: [], total: 0, taskLabel: task.label || '' });
      }

      const pageHtml = await pageResp.text();
      const $page = cheerio.load(pageHtml);
      const entries = extract140CompanyLinks($page, new Set());
      const sliceStart = chunk * ONLINE140_CHUNK_SIZE;
      const entriesChunk = entries.slice(sliceStart, sliceStart + ONLINE140_CHUNK_SIZE);

      const seenPhones = new Set();
      const details = await Promise.allSettled(entriesChunk.map(entry => scrape140Company(entry.url)));
      for (let i = 0; i < details.length; i++) {
        const result = details[i];
        if (result.status !== 'fulfilled' || !result.value) continue;
        const biz = result.value;
        if (!biz.name && entriesChunk[i].fallbackName) biz.name = entriesChunk[i].fallbackName;
        const phoneKey = normalizePhone(biz.phone);
        if (phoneKey && !seenPhones.has(phoneKey)) {
          seenPhones.add(phoneKey);
          businesses.push(biz);
        }
      }
    } else if (task.type === 'product_page') {
      const prodId = String(task.prodId || '');
      const prodName = String(task.prodName || '');
      const chunk = Math.max(parseInt(task.chunk) || 0, 0);
      if (!prodId || !prodName) return res.status(400).json({ error: 'task.prodId and task.prodName are required for product_page tasks' });

      const productUrl = build140ProductPageUrl(prodId, prodName);
      const productResp = await fetch(productUrl, {
        headers: { 'User-Agent': getRandomUA(), 'Accept': 'text/html' },
        redirect: 'follow',
      });

      if (!productResp.ok) {
        return res.json({ leads: [], total: 0, taskLabel: task.label || '' });
      }

      const productHtml = await productResp.text();
      const $product = cheerio.load(productHtml);
      const entries = extract140CompanyLinks($product, new Set());
      businesses = await scrape140EntriesChunk(entries, chunk);
    } else if (task.type === 'keyword_page') {
      const page = Math.max(parseInt(task.page) || 1, 1);
      const chunk = Math.max(parseInt(task.chunk) || 0, 0);
      const pageUrl = build140KeywordResultPageUrl(query, page);
      const pageResp = await fetch(pageUrl, {
        headers: { 'User-Agent': getRandomUA(), 'Accept': 'text/html' },
        redirect: 'follow',
      });

      if (!pageResp.ok) {
        return res.json({ leads: [], total: 0, taskLabel: task.label || '' });
      }

      const pageHtml = await pageResp.text();
      const $page = cheerio.load(pageHtml);
      const entries = extract140CompanyLinks($page, new Set());
      businesses = await scrape140EntriesChunk(entries, chunk);
    } else {
      return res.status(400).json({ error: 'Unsupported task type' });
    }

    const phones = businesses.map(biz => normalizePhone(biz.phone)).filter(Boolean);
    const existingLeads = phones.length > 0
      ? await Lead.find({ phone: { $in: phones } }).select('phone').lean()
      : [];
    const existingPhones = new Set(existingLeads.map(lead => normalizePhone(lead.phone)));

    const leads = businesses.map(biz => ({
      company_name: biz.name,
      phone: normalizePhone(biz.phone),
      email: '',
      website: biz.website || '',
      industry: biz.category || query,
      city: biz.address || '',
      source: '140online',
      address: biz.address || '',
      rating: 0,
      alreadySaved: existingPhones.has(normalizePhone(biz.phone)),
    }));

    res.json({
      leads,
      total: leads.length,
      taskLabel: task.label || '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test endpoint
app.get('/api/scrape/gmaps/test', async (req, res) => {
  try {
    const query = req.query.q || 'عيادات أسنان في مدينة نصر';
    const { businesses, _debug } = await scrapeLocalSearch(query);
    res.json({
      businessesFound: businesses.length,
      firstNames: businesses.slice(0, 10).map(b => `${b.name} | ${b.phone}`),
      _debug,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Netlify Functions handler
export const handler = serverless(app);

// For Vercel — export the Express app as default
export default app;
