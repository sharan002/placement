require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { ApifyClient } = require('apify-client');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { Job } = require('./schema');

const app = express();
const PORT = process.env.PORT || 4000;

const dns  = require("dns");

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const corsOptions = {
  origin: [
    'http://localhost:4200',
    'https://shadowcarsfe.vercel.app',
    'https://sharan002.github.io',
    'http://127.0.0.1:5500',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://appincoimbatore.com',
    'https://cert.appincoimbatore.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.options('/{*path}', cors(corsOptions));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── MongoDB Connection ────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB connected');
        // initJobs();
    })
    .catch(err => console.error('MongoDB connection error:', err));

// ── Apify helper (used only by cron job) ─────────────────────────────────────
async function fetchJobsFromApify(query, options = {}) {
    const {
        location = 'Coimbatore',
        country  = 'in',
        maxItems = 50,
        fromDays = '14',
        sort     = 'date',
    } = options;

    const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

    const input = {
        query,
        country:  country.toLowerCase(),
        location,
        maxItems: parseInt(maxItems, 10),
        fromDays: String(fromDays),
        sort,
    };

    const run = await client.actor('borderline/indeed-scraper').call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return items;
}

// ── Parse posted date from Apify item ────────────────────────────────────────
function parsePostedAt(item) {
    if (item.datePublished) {
        const d = new Date(item.datePublished);
        if (!isNaN(d)) return d;
    }
    if (item.postedToday) return new Date();
    if (item.age) {
        const match = item.age.match(/(\d+)\s+day/i);
        if (match) {
            const d = new Date();
            d.setDate(d.getDate() - parseInt(match[1], 10));
            return d;
        }
    }
    return new Date();
}

// ── Seed Indeed jobs from Apify into DB ──────────────────────────────────────
const JOB_CATEGORIES = [
    { key: 'python', query: 'python' },
    { key: 'java',   query: 'java full stack' },
    { key: 'mern',   query: 'mern stack' },
];

async function seedJobsFromApify() {
    if (!process.env.APIFY_API_TOKEN) {
        console.error('[Cron] APIFY_API_TOKEN not set, skipping job fetch');
        return;
    }
    console.log('[Cron] Starting Indeed job fetch from Apify...');
    for (const { key, query } of JOB_CATEGORIES) {
        try {
            const items = await fetchJobsFromApify(query, { maxItems: 50, fromDays: '14' });
            await Job.deleteMany({ category: key, $or: [{ source: 'indeed' }, { source: { $exists: false } }] });
            const docs = items.map(item => ({
                ...item,
                source: 'indeed',
                category: key,
                postedAt: parsePostedAt(item),
            }));
            await Job.insertMany(docs, { ordered: false });
            console.log(`[Cron] Stored ${docs.length} Indeed ${key} jobs`);
        } catch (err) {
            console.error(`[Cron] Failed to fetch Indeed ${key} jobs:`, err.message);
        }
    }
    console.log('[Cron] Indeed job fetch complete');
}

// ── LinkedIn scraping ─────────────────────────────────────────────────────────
const LINKEDIN_JOB_CATEGORIES = [
    { key: 'python', url: 'https://www.linkedin.com/jobs/search/?keywords=python&location=Coimbatore%2C+Tamil+Nadu%2C+India&f_TPR=r604800&position=1&pageNum=0' },
    { key: 'java',   url: 'https://www.linkedin.com/jobs/search/?keywords=java+full+stack&location=Coimbatore%2C+Tamil+Nadu%2C+India&f_TPR=r604800&position=1&pageNum=0' },
    { key: 'mern',   url: 'https://www.linkedin.com/jobs/search/?keywords=mern+stack&location=Coimbatore%2C+Tamil+Nadu%2C+India&f_TPR=r604800&position=1&pageNum=0' },
];

async function fetchLinkedInJobsFromApify(searchUrl, options = {}) {
    const { count = 50 } = options;
    const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
    const input = { urls: [searchUrl], count, scrapeCompany: true };
    const run = await client.actor('curious_coder/linkedin-jobs-scraper').call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return items;
}

function normalizeLinkedInItem(item, category) {
    const locationStr = typeof item.location === 'string'
        ? item.location
        : (item.location?.city || item.location?.name || '');

    const postedAtDate = item.postedAt ? new Date(item.postedAt) : new Date();
    const isValidDate = !isNaN(postedAtDate);

    let age = '';
    if (isValidDate) {
        const diffDays = Math.floor((Date.now() - postedAtDate.getTime()) / 86400000);
        age = diffDays === 0 ? 'Today' : `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }

    const attributes = [];
    if (item.seniorityLevel) attributes.push(item.seniorityLevel);
    if (Array.isArray(item.industries)) attributes.push(...item.industries.slice(0, 3));
    if (Array.isArray(item.jobFunctions)) attributes.push(...item.jobFunctions.slice(0, 2));

    return {
        title: item.title || '',
        companyName: item.companyName || item.company || '',
        location: { formattedAddressShort: locationStr, fullAddress: locationStr },
        salary: null,
        jobType: item.employmentType ? [item.employmentType] : [],
        attributes,
        descriptionText: item.descriptionText || item.description || '',
        applyUrl: item.applyUrl || item.url || item.jobUrl || '',
        jobUrl: item.url || item.jobUrl || item.applyUrl || '',
        postedToday: age === 'Today',
        age,
        isRemote: locationStr.toLowerCase().includes('remote'),
        category,
        source: 'linkedin',
        postedAt: isValidDate ? postedAtDate : new Date(),
    };
}

async function seedLinkedInJobs() {
    if (!process.env.APIFY_API_TOKEN) {
        console.error('[Cron] APIFY_API_TOKEN not set, skipping LinkedIn job fetch');
        return;
    }
    console.log('[Cron] Starting LinkedIn job fetch from Apify...');
    for (const { key, url } of LINKEDIN_JOB_CATEGORIES) {
        try {
            const items = await fetchLinkedInJobsFromApify(url, { count: 50 });
            await Job.deleteMany({ category: key, source: 'linkedin' });
            const docs = items.map(item => normalizeLinkedInItem(item, key));
            await Job.insertMany(docs, { ordered: false });
            console.log(`[Cron] Stored ${docs.length} LinkedIn ${key} jobs`);
        } catch (err) {
            console.error(`[Cron] Failed to fetch LinkedIn ${key} jobs:`, err.message);
        }
    }
    console.log('[Cron] LinkedIn job fetch complete');
}

// ── Auto-seed on startup if DB is empty ──────────────────────────────────────
async function initJobs() {
    const count = await Job.countDocuments();
    if (count === 0) {
        console.log('[Init] No jobs in DB, seeding from Apify now...');
        seedJobsFromApify();
    } else {
        console.log(`[Init] ${count} jobs already in DB`);
    }
}

// ── Cron: daily at 9 AM IST (Indeed), 9:15 AM IST (LinkedIn) ─────────────────
cron.schedule('0 9 * * *',  seedJobsFromApify,  { timezone: 'Asia/Kolkata' });
cron.schedule('15 9 * * *', seedLinkedInJobs,   { timezone: 'Asia/Kolkata' });

// ── Job Endpoints (served from DB) ───────────────────────────────────────────
function buildJobFilter(category, source, query) {
    const { fromDays = '30', jobType = '' } = query;
    const filter = { category };

    if (source === 'linkedin') {
        filter.source = 'linkedin';
    } else {
        filter.$or = [{ source: 'indeed' }, { source: { $exists: false } }];
    }

    if (jobType) {
        filter.jobType = { $elemMatch: { $regex: new RegExp(jobType, 'i') } };
    }

    const daysAgo = parseInt(fromDays, 10);
    if (!isNaN(daysAgo)) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysAgo);
        filter.postedAt = { $gte: cutoff };
    }

    return filter;
}

function dbJobRoute(category, source = 'indeed') {
    return async (req, res) => {
        try {
            const { maxItems = '20' } = req.query;
            const filter = buildJobFilter(category, source, req.query);
            const jobs = await Job.find(filter)
                .limit(parseInt(maxItems, 10) || 20)
                .sort({ postedAt: -1 })
                .lean();
            res.json({ success: true, count: jobs.length, jobs });
        } catch (err) {
            console.error(`[${source}-${category}] DB error:`, err.message);
            res.status(500).json({ error: 'Failed to fetch jobs', details: err.message });
        }
    };
}

// Indeed routes
app.get('/api/jobs/python', dbJobRoute('python', 'indeed'));
app.get('/api/jobs/java',   dbJobRoute('java',   'indeed'));
app.get('/api/jobs/mern',   dbJobRoute('mern',   'indeed'));

// LinkedIn routes
app.get('/api/jobs/linkedin/python', dbJobRoute('python', 'linkedin'));
app.get('/api/jobs/linkedin/java',   dbJobRoute('java',   'linkedin'));
app.get('/api/jobs/linkedin/mern',   dbJobRoute('mern',   'linkedin'));

// Manual refresh triggers
app.post('/api/jobs/refresh',          (req, res) => { res.json({ message: 'Indeed job refresh started' });   seedJobsFromApify(); });
app.get('/api/jobs/refresh/linkedin', (req, res) => { res.json({ message: 'LinkedIn job refresh started' }); seedLinkedInJobs();  });
// ─────────────────────────────────────────────────────────────────────────────

app.get('/hi', async (req, res) => res.send({ Hii: 'Hello' }));
app.get('/hello', (req, res) => res.json({ message: 'Hello, World!' }));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // console.log(`Frontend: http://localhost:${PORT}`);
});
