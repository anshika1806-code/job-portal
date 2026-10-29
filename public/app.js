const $ = s => document.querySelector(s);
const token = () => localStorage.getItem('token');
const me = () => JSON.parse(localStorage.getItem('user') || 'null');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(url, opts = {}) {
  const headers = opts.headers || {};
  if (token()) headers.Authorization = 'Bearer ' + token();
  if (opts.body && !(opts.body instanceof FormData)) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.body); }
  const r = await fetch('/api' + url, { ...opts, headers });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}
function ago(date) {
  const s = (Date.now() - new Date(date)) / 1000;
  if (s < 3600) return Math.max(1, Math.floor(s / 60)) + ' minutes ago';
  if (s < 86400) return Math.floor(s / 3600) + ' hours ago';
  return Math.floor(s / 86400) + ' days ago';
}
const initials = n => (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
function avatar(u, cls = '') {
  return u.image ? `<img class="avatar ${cls}" src="${esc(u.image)}" alt="${esc(u.name)}">`
                 : `<span class="avatar ${cls}">${esc(initials(u.name))}</span>`;
}
function logo(j) {
  return `<div class="logo">${j.logo ? `<img src="${esc(j.logo)}" alt="">` : esc(j.company.slice(0, 2).toUpperCase())}</div>`;
}
function guard(role) {
  const u = me();
  if (!u || !token() || (role && u.role !== role)) { location.href = '/login.html'; return false; }
  return true;
}
function logout() { localStorage.clear(); location.href = '/'; }
function flash(el, text, ok) { el.innerHTML = `<div class="msg ${ok ? 'ok' : 'err'}">${esc(text)}</div>`; }

function renderNav() {
  const u = me();
  const links = ['<a href="/">Jobs</a>'];
  if (u && u.role === 'recruiter') links.push('<a href="/recruiter.html">Manage jobs</a>');
  if (u) links.push('<a href="/profile.html">Profile</a>');
  $('#nav').innerHTML = `<nav class="nav"><div class="wrap">
    <a class="brand" href="/">CareerNest</a><div class="links">${links.join('')}</div>
    <div class="right">${u
      ? `<a href="/profile.html" title="Your profile">${avatar(u)}</a><button class="linkbtn" onclick="logout()">Log out</button>`
      : '<a class="btn" href="/login.html">Log in</a>'}</div></div></nav>`;
}
document.addEventListener('DOMContentLoaded', renderNav);
