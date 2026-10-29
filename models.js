const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const User = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['applicant', 'recruiter'], required: true },
  image: { type: String, default: '' }
}, { timestamps: true }));

const Job = model('Job', new Schema({
  title: { type: String, required: true, trim: true },
  company: { type: String, required: true, trim: true },
  logo: { type: String, default: '' },
  about: { type: String, default: '' },
  location: { type: String, required: true, trim: true },
  type: { type: String, enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote'], default: 'Full-time' },
  skills: [String],
  minSalary: Number,
  maxSalary: Number,
  description: { type: String, default: '' },
  recruiter: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true }));

const Application = model('Application', new Schema({
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  applicant: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  coverLetter: { type: String, default: '' },
  resume: { type: String, required: true }
}, { timestamps: true }));
Application.schema.index({ job: 1, applicant: 1 }, { unique: true });

// One record per applicant per job: powers the "Viewed" badge
const View = model('View', new Schema({
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true }));
View.schema.index({ job: 1, user: 1 }, { unique: true });

module.exports = { User, Job, Application, View };
