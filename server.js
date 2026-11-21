const express = require('express');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Real results live in data/students.json (git-ignored). Falls back to the demo data.
const realFile = path.join(DATA_DIR, 'students.json');
const usingSample = !fs.existsSync(realFile);
const students = JSON.parse(fs.readFileSync(usingSample ? path.join(DATA_DIR, 'students.sample.json') : realFile, 'utf8'));
const byId = new Map(students.map((s) => [s.id, s]));

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', req.path.startsWith('/api') ? 'no-store' : 'public, max-age=300');
  next();
});

// Small in-memory rate limiter so IDs cannot be brute-forced.
const hits = new Map();
const WINDOW_MS = 60_000, MAX_HITS = 15;
setInterval(() => hits.clear(), WINDOW_MS).unref();
const limiter = (req, res, next) => {
  const n = (hits.get(req.ip) || 0) + 1;
  hits.set(req.ip, n);
  if (n > MAX_HITS) return res.status(429).json({ error: 'Too many attempts. Please wait a minute and try again.' });
  next();
};

// Returns ONE student's record. The full list is never sent to the browser.
app.get('/api/result', limiter, (req, res) => {
  const id = String(req.query.id || '').replace(/\s+/g, '');
  if (!/^\d{9}$/.test(id)) return res.status(400).json({ error: 'Please enter your 9-digit student ID.' });
  const student = byId.get(id);
  if (!student) return res.status(404).json({ error: 'We could not find that ID. Check the number and try again.' });
  res.json(student);
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Foundation School portal running at http://localhost:${PORT}`);
  console.log(usingSample ? 'Using DEMO data (data/students.sample.json). Run "npm run import" to load real results.' : `Loaded ${students.length} students.`);
});
