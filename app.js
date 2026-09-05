const API = '/api';
let token = localStorage.getItem('carely-token');
let currentUser = null;
let appointments = [];
let directory = { doctors: [], patients: [] };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const initials = (name = '') => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
const colors = ['aqua', 'orange', 'bluebg', 'rose'];

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 3000); }
function showError(message) { const el = $('#authError'); if (el) { el.textContent = message; el.classList.add('visible'); } else toast(message); }

function addAuthScreen() {
  const screen = document.createElement('div'); screen.id = 'authScreen'; screen.className = 'auth-screen';
  screen.innerHTML = `<div class="auth-card"><div class="brand auth-brand"><div class="brand-mark">✚</div><span>carely</span></div><p class="eyebrow">SECURE CLINIC WORKSPACE</p><h1>Welcome back</h1><p class="auth-copy">Sign in to manage appointments and care teams securely.</p><div id="authError" class="auth-error"></div><form id="loginForm"><label>Email address<input name="email" type="email" required placeholder="you@clinic.com" autocomplete="email"></label><label>Password<input name="password" type="password" required placeholder="••••••••" autocomplete="current-password"></label><button class="primary-btn full-btn">Sign in</button></form><p class="auth-switch">New to Carely? <button id="showRegister">Create a patient account</button></p></div>`;
  document.body.appendChild(screen);
  $('#loginForm').addEventListener('submit', login);
  $('#showRegister').addEventListener('click', showRegister);
}
function showRegister() { const form = $('#loginForm'); form.innerHTML = `<label>Full name<input name="name" required placeholder="Alex Morgan"></label><label>Email address<input name="email" type="email" required placeholder="you@example.com"></label><label>Phone number<input name="phone" type="tel" placeholder="+1 555 000 0000"></label><label>Password<input name="password" type="password" required minlength="8" placeholder="At least 8 characters"></label><button class="primary-btn full-btn">Create patient account</button>`; form.removeEventListener('submit', login); form.addEventListener('submit', register); $('#showRegister').textContent = 'Back to sign in'; $('#showRegister').onclick = () => location.reload(); }
async function login(event) { event.preventDefault(); try { const body = Object.fromEntries(new FormData(event.target)); const data = await api('/auth/login', { method: 'POST', body: JSON.stringify(body) }); token = data.token; localStorage.setItem('carely-token', token); await boot(); } catch (error) { showError(error.message); } }
async function register(event) { event.preventDefault(); try { const body = Object.fromEntries(new FormData(event.target)); const data = await api('/auth/register', { method: 'POST', body: JSON.stringify(body) }); token = data.token; localStorage.setItem('carely-token', token); await boot(); } catch (error) { showError(error.message); } }
function hideAuth() { $('#authScreen')?.remove(); }

async function boot() {
  if (!token) return;
  try { const me = await api('/auth/me'); currentUser = me.user; hideAuth(); applyUser(); await loadAppointments(); if (currentUser.role === 'admin') await loadDirectory(); }
  catch { token = null; localStorage.removeItem('carely-token'); addAuthScreen(); }
}
function applyUser() { $$('.user-mini strong').forEach(el => el.textContent = currentUser.name); $$('.user-mini small').forEach(el => el.textContent = currentUser.role[0].toUpperCase() + currentUser.role.slice(1)); $$('.avatar-purple').forEach(el => el.textContent = initials(currentUser.name)); }
async function loadAppointments() { const data = await api('/appointments'); appointments = data.appointments; renderAppointments(); }
async function loadDirectory() { const [doctors, patients] = await Promise.all([api('/users?role=doctor'), api('/users?role=patient')]); directory = { doctors: doctors.users, patients: patients.users }; const select = $('select[name="doctor"]'); if (select) select.innerHTML = directory.doctors.map(d => `<option value="${d.id}">${d.name}</option>`).join(''); const patientField = $('input[name="patient"]'); if (patientField && currentUser.role === 'admin') { const replacement = document.createElement('select'); replacement.name = 'patient'; replacement.required = true; replacement.innerHTML = directory.patients.map(p => `<option value="${p.id}">${p.name}</option>`).join(''); patientField.replaceWith(replacement); } }
function toDisplayTime(value) { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function renderAppointments(filter = '') {
  const visible = appointments.filter(a => `${a.patient_name} ${a.doctor_name} ${a.appointment_type}`.toLowerCase().includes(filter.toLowerCase()));
  $('#appointmentList').innerHTML = visible.slice(0, 4).map((a, i) => `<div class="appointment"><span class="time">${toDisplayTime(a.appointment_at)}</span><div class="patient-avatar ${colors[i % colors.length]}">${initials(a.patient_name)}</div><div class="appointment-info"><strong>${a.patient_name}</strong><small>${a.doctor_name} · ${a.appointment_type}</small></div><span class="tag ${a.status}">${a.status[0].toUpperCase() + a.status.slice(1)}</span></div>`).join('') || '<p class="subheading">No appointments found.</p>';
  $('#appointmentTable').innerHTML = visible.map(a => `<tr><td><strong>${a.patient_name}</strong></td><td>${a.doctor_name}</td><td>${new Date(a.appointment_at).toLocaleString()}</td><td>${a.appointment_type}</td><td><span class="tag ${a.status}">${a.status[0].toUpperCase() + a.status.slice(1)}</span></td></tr>`).join('') || '<tr><td colspan="5">No appointments found.</td></tr>';
}
function showSection(id) { $$('.section-view').forEach(s => s.classList.toggle('active', s.id === id)); $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.section === id)); $('#pageTitle').textContent = id.charAt(0).toUpperCase() + id.slice(1); $('#sidebar').classList.remove('open'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
$$('[data-section]').forEach(btn => btn.addEventListener('click', () => showSection(btn.dataset.section)));
$('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
function openModal() { $('#modal').classList.add('open'); $('#modal').querySelector('input,select')?.focus(); }
function closeModal() { $('#modal').classList.remove('open'); }
$('#newAppointmentBtn').addEventListener('click', openModal); $('#newAppointmentBtn2').addEventListener('click', openModal); $('#modalClose').addEventListener('click', closeModal); $('#modal').addEventListener('click', e => { if (e.target === $('#modal')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
$('#appointmentForm').addEventListener('submit', async event => { event.preventDefault(); try { const form = new FormData(event.target); const date = form.get('date'); const time = form.get('time'); const patientId = currentUser.role === 'patient' ? currentUser.id : form.get('patient'); const doctorId = currentUser.role === 'doctor' ? currentUser.id : form.get('doctor'); await api('/appointments', { method: 'POST', body: JSON.stringify({ patientId, doctorId, appointmentAt: new Date(`${date}T${time}`).toISOString(), appointmentType: form.get('type') }) }); await loadAppointments(); closeModal(); event.target.reset(); toast('Appointment created and notifications queued'); } catch (error) { toast(error.message); } });
$('#appointmentSearch').addEventListener('input', e => renderAppointments(e.target.value)); $('#reviewBtn').addEventListener('click', () => { showSection('appointments'); $('#appointmentSearch').focus(); });
$$('.quick-prompts button').forEach(b => b.addEventListener('click', () => { $('#chatInput').value = b.textContent.replace(/[“”]/g, ''); $('#chatInput').focus(); }));
function answerAssistant() { const input = $('#chatInput'); const query = input.value.trim().toLowerCase(); if (!query) return; const next = appointments[0]; toast(query.includes('next') && next ? `Next: ${next.patient_name} at ${toDisplayTime(next.appointment_at)}` : 'Carely can help with appointments, availability, and clinic information.'); input.value = ''; }
$('#chatBtn').addEventListener('click', answerAssistant); $('#chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') answerAssistant(); }); $('#learnBtn').addEventListener('click', () => toast('Carely AI is ready to assist your team.'));

addAuthScreen(); boot();
