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

// ── Seed jobs from Apify into DB ─────────────────────────────────────────────
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
    console.log('[Cron] Starting job fetch from Apify...');
    for (const { key, query } of JOB_CATEGORIES) {
        try {
            const items = await fetchJobsFromApify(query, { maxItems: 50, fromDays: '14' });
            await Job.deleteMany({ category: key });
            const docs = items.map(item => ({
                ...item,
                category: key,
                postedAt: parsePostedAt(item),
            }));
            await Job.insertMany(docs, { ordered: false });
            console.log(`[Cron] Stored ${docs.length} ${key} jobs`);
        } catch (err) {
            console.error(`[Cron] Failed to fetch ${key} jobs:`, err.message);
        }
    }
    console.log('[Cron] Job fetch complete');
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

// ── Cron: daily at 9 AM IST ──────────────────────────────────────────────────
cron.schedule('0 9 * * *', seedJobsFromApify, { timezone: 'Asia/Kolkata' });

// ── Job Endpoints (served from DB) ───────────────────────────────────────────
function dbJobRoute(category) {
    return async (req, res) => {
        try {
            const { fromDays = '30', jobType = '', maxItems = '20' } = req.query;

            const filter = { category };

            if (jobType) {
                filter.jobType = { $elemMatch: { $regex: new RegExp(jobType, 'i') } };
            }

            const daysAgo = parseInt(fromDays, 10);
            if (!isNaN(daysAgo)) {
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - daysAgo);
                filter.postedAt = { $gte: cutoff };
            }

            const jobs = await Job.find(filter)
                .limit(parseInt(maxItems, 10) || 20)
                .sort({ postedAt: -1 })
                .lean();

            res.json({ success: true, count: jobs.length, jobs });
        } catch (err) {
            console.error(`[${category}] DB error:`, err.message);
            res.status(500).json({ error: 'Failed to fetch jobs', details: err.message });
        }
    };
}

app.get('/api/jobs/python', dbJobRoute('python'));
app.get('/api/jobs/java',   dbJobRoute('java'));
app.get('/api/jobs/mern',   dbJobRoute('mern'));

// Manual refresh trigger
app.post('/api/jobs/refresh', (req, res) => {
    res.json({ message: 'Job refresh started in background' });
    seedJobsFromApify();
});
// ─────────────────────────────────────────────────────────────────────────────

app.get('/hi', async (req, res) => res.send({ Hii: 'Hello' }));
app.get('/hello', (req, res) => res.json({ message: 'Hello, World!' }));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // console.log(`Frontend: http://localhost:${PORT}`);
});
