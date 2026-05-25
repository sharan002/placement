require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { ApifyClient } = require('apify-client');

const app = express();
const PORT = process.env.PORT || 4000;

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

// ─── Shared Apify helper ─────────────────────────────────────────────────────
async function fetchJobsFromApify(query, options = {}) {
    const {
        location = 'Coimbatore',
        country  = 'in',
        maxItems = 20,
        fromDays = '3',
        jobType  = '',
        sort     = 'date',
        jobLevel = '',
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

    if (jobType)  input.jobType  = jobType;
    if (jobLevel) input.jobLevel = jobLevel;

    const run = await client.actor('borderline/indeed-scraper').call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return items;
}

function jobRoute(query) {
    return async (req, res) => {
        if (!process.env.APIFY_API_TOKEN) {
            return res.status(500).json({ error: 'APIFY_API_TOKEN is not set in .env' });
        }
        try {
            const jobs = await fetchJobsFromApify(query, req.query);
            res.json({ success: true, count: jobs.length, jobs });
        } catch (err) {
            console.error(`[${query}] Apify error:`, err.message);
            res.status(500).json({ error: 'Failed to fetch jobs', details: err.message });
        }
    };
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Job Endpoints ───────────────────────────────────────────────────────────
// GET /api/jobs/python?fromDays=3&location=Coimbatore&country=in&maxItems=20
app.get('/api/jobs/python', jobRoute('python'));

// GET /api/jobs/java?fromDays=3&location=Coimbatore&country=in&maxItems=20
app.get('/api/jobs/java',   jobRoute('java full stack'));

// GET /api/jobs/mern?fromDays=3&location=Coimbatore&country=in&maxItems=20
app.get('/api/jobs/mern',   jobRoute('mern stack'));
// ─────────────────────────────────────────────────────────────────────────────

app.get('/hi', async (req, res) => res.send({ Hii: 'Hello' }));
app.get('/hello', (req, res) => res.json({ message: 'Hello, World!' }));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend: http://localhost:${PORT}`);
});
