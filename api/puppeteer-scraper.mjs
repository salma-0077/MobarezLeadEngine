import puppeteer from 'puppeteer';

let browser = null;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const PAGE_TIMEOUT = 30000;
const REQUEST_TIMEOUT = 10000;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
];

async function getBrowser() {
  if (browser && browser.isConnected()) {
    return browser;
  }

  browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  return browser;
}

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractPhoneNumbers(text) {
  if (!text) return [];
  const phoneRegex = /(\+?20|0)?1[0125]\d{8}/g;
  const matches = text.match(phoneRegex) || [];
  return [...new Set(matches.map(p => (p.startsWith('0') ? p : (p.startsWith('+') ? p : '+2' + p))))];
}

async function scrapeFacebookPage(query, retryCount = 0) {
  const browserInstance = await getBrowser();
  let page;

  try {
    page = await browserInstance.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(getRandomUserAgent());
    
    // Set extra headers to avoid detection
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': 'https://www.google.com/',
    });

    // Enable request interception to block unnecessary resources
    await page.setRequestInterception(true);
    
    // Handle aborted requests (images, CSS, etc.) to speed up
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });

    const searchUrl = `https://www.google.com/search?q=site:facebook.com ${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT });

    // Wait a bit for dynamic content
    await delay(2000);

    // Try multiple selector patterns
    const results = await page.evaluate(() => {
      const items = [];
      
      // Try different selector combinations for Google search results
      const selectors = [
        '.g',
        '.Gd',
        '[data-sokoban-container]',
        'div[jsname="N0PJme"]',
      ];

      for (const selector of selectors) {
        const found = document.querySelectorAll(selector);
        if (found.length > 0) {
          found.forEach((item) => {
            const titleEl = item.querySelector('h3');
            const linkEl = item.querySelector('a');
            const snippetEl = item.querySelector('.VwiC3b, .s, [data-sncf]');

            if (titleEl && linkEl) {
              const title = titleEl.innerText || titleEl.textContent;
              const link = linkEl.href;
              const snippet = snippetEl ? (snippetEl.innerText || snippetEl.textContent) : '';
              const fullText = `${title} ${snippet}`;

              items.push({
                title: title.trim(),
                url: link,
                snippet: snippet.trim(),
                fullText: fullText,
              });
            }
          });
          break;
        }
      }

      return items;
    });

    // Extract phone numbers and company info
    const businesses = results.map((result) => {
      const phones = extractPhoneNumbers(result.fullText);
      
      // Try to extract company name from title or URL
      let companyName = result.title.replace(/\/.*$/g, '').trim();
      if (!companyName || companyName.length < 2) {
        try {
          const urlParts = new URL(result.url).hostname.split('.');
          companyName = urlParts[0] || result.title;
        } catch (e) {
          companyName = result.title;
        }
      }

      return {
        name: companyName,
        phone: phones.length > 0 ? phones[0] : '',
        website: result.url,
        address: '',
        category: 'Facebook',
        rating: 0,
      };
    });

    await page.close();
    return { businesses, _debug: { source: 'puppeteer-facebook', resultsCount: results.length, url: searchUrl } };
  } catch (err) {
    if (page) {
      await page.close().catch(() => {});
    }

    if (retryCount < MAX_RETRIES) {
      console.warn(`Facebook scrape failed (retry ${retryCount + 1}/${MAX_RETRIES}):`, err.message);
      await delay(RETRY_DELAY);
      return scrapeFacebookPage(query, retryCount + 1);
    }

    console.error('Facebook scrape failed after retries:', err);
    throw err;
  }
}

async function scrapeLinkedInPage(query, retryCount = 0) {
  const browserInstance = await getBrowser();
  let page;

  try {
    page = await browserInstance.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(getRandomUserAgent());
    
    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': 'https://www.google.com/',
    });

    // Enable request interception to block unnecessary resources
    await page.setRequestInterception(true);

    // Handle aborted requests to speed up
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });

    const searchUrl = `https://www.google.com/search?q=site:linkedin.com/company ${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT });

    // Wait a bit for dynamic content
    await delay(2000);

    // Extract search results
    const results = await page.evaluate(() => {
      const items = [];
      
      // Try different selector combinations for Google search results
      const selectors = [
        '.g',
        '.Gd',
        '[data-sokoban-container]',
        'div[jsname="N0PJme"]',
      ];

      for (const selector of selectors) {
        const found = document.querySelectorAll(selector);
        if (found.length > 0) {
          found.forEach((item) => {
            const titleEl = item.querySelector('h3');
            const linkEl = item.querySelector('a');
            const snippetEl = item.querySelector('.VwiC3b, .s, [data-sncf]');

            if (titleEl && linkEl) {
              const title = titleEl.innerText || titleEl.textContent;
              const link = linkEl.href;
              const snippet = snippetEl ? (snippetEl.innerText || snippetEl.textContent) : '';
              const fullText = `${title} ${snippet}`;

              items.push({
                title: title.trim(),
                url: link,
                snippet: snippet.trim(),
                fullText: fullText,
              });
            }
          });
          break;
        }
      }

      return items;
    });

    // Extract company info
    const businesses = results.map((result) => {
      const phones = extractPhoneNumbers(result.fullText);
      
      // Extract company name from title (usually format: "Company Name | LinkedIn")
      let companyName = result.title.split('|')[0].trim();
      if (!companyName || companyName.length < 2) {
        companyName = result.title.replace(/\s+/g, ' ').substring(0, 100);
      }

      return {
        name: companyName,
        phone: phones.length > 0 ? phones[0] : '',
        website: result.url,
        address: '',
        category: 'LinkedIn',
        rating: 0,
      };
    });

    await page.close();
    return { businesses, _debug: { source: 'puppeteer-linkedin', resultsCount: results.length, url: searchUrl } };
  } catch (err) {
    if (page) {
      await page.close().catch(() => {});
    }

    if (retryCount < MAX_RETRIES) {
      console.warn(`LinkedIn scrape failed (retry ${retryCount + 1}/${MAX_RETRIES}):`, err.message);
      await delay(RETRY_DELAY);
      return scrapeLinkedInPage(query, retryCount + 1);
    }

    console.error('LinkedIn scrape failed after retries:', err);
    throw err;
  }
}

export async function scrapeFacebookWithPuppeteer(query) {
  try {
    return await scrapeFacebookPage(query);
  } catch (err) {
    console.error('Facebook Puppeteer scrape error:', err.message);
    // Return empty results instead of throwing
    return { businesses: [], _debug: { source: 'puppeteer-facebook', error: err.message, resultsCount: 0 } };
  }
}

export async function scrapeLinkedInWithPuppeteer(query) {
  try {
    return await scrapeLinkedInPage(query);
  } catch (err) {
    console.error('LinkedIn Puppeteer scrape error:', err.message);
    // Return empty results instead of throwing
    return { businesses: [], _debug: { source: 'puppeteer-linkedin', error: err.message, resultsCount: 0 } };
  }
}

export async function closeBrowser() {
  if (browser) {
    try {
      await browser.close();
      browser = null;
    } catch (err) {
      console.error('Error closing browser:', err);
    }
  }
}
