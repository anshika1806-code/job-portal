require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { User, Job, Application, View } = require('./models');

const app = express();
const SECRET = process.env.JWT_SECRET || 'dev-secret';
fs.mkdirSync('uploads', { recursive: true });
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

/* ---------- helpers ---------- */
const uploader = (maxBytes, exts) => multer({
  storage: multer.diskStorage({
    destination: 'uploads',
    filename: (req, f, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(f.originalname).toLowerCase())
  }),
  limits: { fileSize: maxBytes },
  fileFilter: (req, f, cb) => exts.includes(path.extname(f.originalname).toLowerCase())
    ? cb(null, true) : cb(new Error('Unsupported file type'))
});
const imageUpload = uploader(2 * 1024 * 1024, ['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const resumeUpload = uploader(5 * 1024 * 1024, ['.pdf', '.doc', '.docx']);

const publicUser = u => ({ id: u._id, name: u.name, email: u.email, role: u.role, image: u.image });
const sign = u => jwt.sign({ id: u._id, role: u.role }, SECRET, { expiresIn: '7d' });
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Reads the token if present; never blocks
async function optionalAuth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  try { if (t) { const { id } = jwt.verify(t, SECRET); req.user = await User.findById(id); } } catch (e) {}
  next();
}
const auth = (role) => async (req, res, next) => {
  await optionalAuth(req, res, () => {});
  if (!req.user) return res.status(401).json({ error: 'Please log in first' });
  if (role && req.user.role !== role) return res.status(403).json({ error: `Only ${role}s can do this` });
  next();
};
const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.message }));

/* ---------- auth ---------- */
app.post('/api/auth/register', wrap(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !['applicant', 'recruiter'].includes(role))
    throw new Error('Fill in name, email, password and role');
  if (password.length < 6) throw new Error('Password must be at least 6 characters');
  if (await User.findOne({ email: email.toLowerCase() })) throw new Error('That email is already registered');
  const user = await User.create({ name, email, role, password: await bcrypt.hash(password, 10) });
  res.json({ token: sign(user), user: publicUser(user) });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password)))
    throw new Error('Email or password is incorrect');
  res.json({ token: sign(user), user: publicUser(user) });
}));

/* ---------- profile ---------- */
app.get('/api/me', auth(), (req, res) => res.json(publicUser(req.user)));

app.put('/api/me', auth(), imageUpload.single('image'), wrap(async (req, res) => {
  const { name, email } = req.body;
  if (email && email.toLowerCase() !== req.user.email) {
    if (await User.findOne({ email: email.toLowerCase() })) throw new Error('That email is already in use');
    req.user.email = email;
  }
  if (name) req.user.name = name;
  if (req.file) req.user.image = '/uploads/' + req.file.filename;
  await req.user.save();
  res.json(publicUser(req.user));
}));

/* ---------- jobs ---------- */
app.get('/api/jobs', optionalAuth, wrap(async (req, res) => {
  const { q, location, type } = req.query;
  const filter = {};
  if (q) { const r = new RegExp(esc(q), 'i'); filter.$or = [{ title: r }, { company: r }, { skills: r }]; }
  if (location) filter.location = new RegExp(esc(location), 'i');
  if (type) filter.type = type;
  const jobs = await Job.find(filter).sort('-createdAt').lean();
  let viewed = new Set();
  if (req.user && req.user.role === 'applicant') {
    const v = await View.find({ user: req.user._id }).lean();
    viewed = new Set(v.map(x => String(x.job)));
  }
  res.json(jobs.map(j => ({ ...j, viewed: viewed.has(String(j._id)) })));
}));

app.get('/api/my-jobs', auth('recruiter'), wrap(async (req, res) => {
  const jobs = await Job.find({ recruiter: req.user._id }).sort('-createdAt').lean();
  const counts = await Application.aggregate([{ $match: { job: { $in: jobs.map(j => j._id) } } }, { $group: { _id: '$job', n: { $sum: 1 } } }]);
  const map = Object.fromEntries(counts.map(c => [String(c._id), c.n]));
  res.json(jobs.map(j => ({ ...j, applicants: map[String(j._id)] || 0 })));
}));

// Opening a job as an applicant marks it as viewed
app.get('/api/jobs/:id', optionalAuth, wrap(async (req, res) => {
  const job = await Job.findById(req.params.id).lean();
  if (!job) throw new Error('Job not found');
  let applied = false;
  if (req.user && req.user.role === 'applicant') {
    await View.updateOne({ job: job._id, user: req.user._id }, {}, { upsert: true });
    applied = !!(await Application.exists({ job: job._id, applicant: req.user._id }));
  }
  res.json({ ...job, applied });
}));

const jobFields = b => ({
  title: b.title, company: b.company, logo: b.logo, about: b.about, location: b.location,
  type: b.type, description: b.description,
  skills: (b.skills || '').split(',').map(s => s.trim()).filter(Boolean),
  minSalary: b.minSalary ? Number(b.minSalary) : undefined,
  maxSalary: b.maxSalary ? Number(b.maxSalary) : undefined
});

app.post('/api/jobs', auth('recruiter'), wrap(async (req, res) => {
  res.json(await Job.create({ ...jobFields(req.body), recruiter: req.user._id }));
}));

app.put('/api/jobs/:id', auth('recruiter'), wrap(async (req, res) => {
  const job = await Job.findOneAndUpdate({ _id: req.params.id, recruiter: req.user._id }, jobFields(req.body), { new: true, runValidators: true });
  if (!job) throw new Error('Job not found');
  res.json(job);
}));

app.delete('/api/jobs/:id', auth('recruiter'), wrap(async (req, res) => {
  const job = await Job.findOneAndDelete({ _id: req.params.id, recruiter: req.user._id });
  if (!job) throw new Error('Job not found');
  await Application.deleteMany({ job: job._id });
  await View.deleteMany({ job: job._id });
  res.json({ ok: true });
}));

/* ---------- applications ---------- */
app.post('/api/jobs/:id/apply', auth('applicant'), resumeUpload.single('resume'), wrap(async (req, res) => {
  if (!req.file) throw new Error('Attach your resume (PDF, DOC or DOCX)');
  if (!(await Job.exists({ _id: req.params.id }))) throw new Error('Job not found');
  if (await Application.exists({ job: req.params.id, applicant: req.user._id })) throw new Error('You already applied to this job');
  await Application.create({ job: req.params.id, applicant: req.user._id, coverLetter: req.body.coverLetter, resume: '/uploads/' + req.file.filename });
  res.json({ ok: true });
}));

app.get('/api/jobs/:id/applications', auth('recruiter'), wrap(async (req, res) => {
  if (!(await Job.exists({ _id: req.params.id, recruiter: req.user._id }))) throw new Error('Job not found');
  res.json(await Application.find({ job: req.params.id }).sort('-createdAt').populate('applicant', 'name email image').lean());
}));

// Upload / validation errors from multer
app.use((err, req, res, next) => res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message }));

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/careernest')
  .then(() => app.listen(process.env.PORT || 3000, () => console.log('CareerNest running on http://localhost:' + (process.env.PORT || 3000))))
  .catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
