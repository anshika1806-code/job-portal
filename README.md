# CareerNest

Job board with two roles: **applicant** and **recruiter**.
Stack: HTML, CSS, vanilla JS (frontend) · Node.js + Express (backend) · MongoDB (Mongoose).

## Run
1. Install Node 18+ and MongoDB (local) or use a MongoDB Atlas URI.
2. `npm install`
3. Edit `.env` (MONGO_URI, JWT_SECRET).
4. `npm start` → open http://localhost:3000

## Features
- Sign up / log in as Applicant or Recruiter (JWT, bcrypt)
- Recruiter: post, edit, delete jobs (form on left, job list on right with Edit / Submissions), view applicants and résumés
- Applicant: search jobs, open a job (it then shows a **Viewed** badge on the list), apply with cover letter + résumé (PDF/DOC/DOCX, 5 MB)
- Profile: edit name/email, upload a picture (2 MB); it appears top-right in the navbar and on the profile page
