require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

const app = express();
const port = Number(process.env.PORT || 4173);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

const publicUser = ({ id, name, email, phone, role, specialization }) => ({ id, name, email, phone, role, specialization });
const signToken = (user) => jwt.sign({ sub: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const { rows } = await pool.query('SELECT id,name,email,phone,role,specialization FROM users WHERE id=$1', [payload.sub]);
    if (!rows[0]) return res.status(401).json({ error: 'User account not found' });
    req.user = rows[0]; next();
  } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
}
const allow = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Insufficient permissions' });
async function audit(userId, action, resource, resourceId, metadata = {}) { await pool.query('INSERT INTO audit_logs (user_id,action,resource,resource_id,metadata) VALUES ($1,$2,$3,$4,$5)', [userId, action, resource, resourceId || null, metadata]); }

app.get('/api/health', asyncRoute(async (_req, res) => { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }));

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: 'Name, email, and a password of at least 8 characters are required' });
  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await pool.query('INSERT INTO users (name,email,phone,password_hash,role) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,phone,role,specialization', [name.trim(), email.toLowerCase().trim(), phone || null, hash, 'patient']);
    const user = rows[0]; await audit(user.id, 'REGISTER', 'user', user.id); res.status(201).json({ user: publicUser(user), token: signToken(user) });
  } catch (error) { if (error.code === '23505') return res.status(409).json({ error: 'An account with that email already exists' }); throw error; }
}));
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body; const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [(email || '').toLowerCase().trim()]);
  if (!rows[0] || !(await bcrypt.compare(password || '', rows[0].password_hash))) return res.status(401).json({ error: 'Invalid email or password' });
  const user = rows[0]; await audit(user.id, 'LOGIN', 'user', user.id); res.json({ user: publicUser(user), token: signToken(user) });
}));
app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

function appointmentQuery(role, userId) {
  if (role === 'patient') return { sql: `SELECT a.*, p.name patient_name,p.email patient_email,p.phone patient_phone,d.name doctor_name,d.email doctor_email,d.phone doctor_phone,d.specialization FROM appointments a JOIN users p ON p.id=a.patient_id JOIN users d ON d.id=a.doctor_id WHERE a.patient_id=$1 ORDER BY a.appointment_at`, params: [userId] };
  if (role === 'doctor') return { sql: `SELECT a.*, p.name patient_name,p.email patient_email,p.phone patient_phone,d.name doctor_name,d.email doctor_email,d.phone doctor_phone,d.specialization FROM appointments a JOIN users p ON p.id=a.patient_id JOIN users d ON d.id=a.doctor_id WHERE a.doctor_id=$1 ORDER BY a.appointment_at`, params: [userId] };
  return { sql: `SELECT a.*, p.name patient_name,p.email patient_email,p.phone patient_phone,d.name doctor_name,d.email doctor_email,d.phone doctor_phone,d.specialization FROM appointments a JOIN users p ON p.id=a.patient_id JOIN users d ON d.id=a.doctor_id ORDER BY a.appointment_at`, params: [] };
}
app.get('/api/appointments', auth, asyncRoute(async (req, res) => { const q = appointmentQuery(req.user.role, req.user.id); const { rows } = await pool.query(q.sql, q.params); res.json({ appointments: rows }); }));
app.post('/api/appointments', auth, allow('admin', 'doctor', 'patient'), asyncRoute(async (req, res) => {
  const { patientId, doctorId, appointmentAt, durationMinutes = 30, appointmentType = 'General consultation', reason = '' } = req.body;
  const targetPatient = req.user.role === 'patient' ? req.user.id : patientId;
  const targetDoctor = req.user.role === 'doctor' ? req.user.id : doctorId;
  if (!targetPatient || !targetDoctor || !appointmentAt) return res.status(400).json({ error: 'patientId, doctorId, and appointmentAt are required' });
  const conflict = await pool.query(`SELECT id FROM appointments WHERE status IN ('pending','confirmed') AND doctor_id=$1 AND appointment_at < $2::timestamptz + ($3 || ' minutes')::interval AND appointment_at + (duration_minutes || ' minutes')::interval > $2::timestamptz`, [targetDoctor, appointmentAt, durationMinutes]);
  if (conflict.rows.length) return res.status(409).json({ error: 'The doctor is already booked for that time' });
  const { rows } = await pool.query(`INSERT INTO appointments (patient_id,doctor_id,appointment_at,duration_minutes,appointment_type,reason,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,'confirmed',$7) RETURNING id`, [targetPatient, targetDoctor, appointmentAt, durationMinutes, appointmentType, reason, req.user.id]);
  await audit(req.user.id, 'CREATE', 'appointment', rows[0].id, { patientId: targetPatient, doctorId: targetDoctor });
  await queueAppointmentNotifications(rows[0].id, 'confirmation');
  const result = await pool.query(`SELECT a.*, p.name patient_name,p.email patient_email,p.phone patient_phone,d.name doctor_name,d.email doctor_email,d.phone doctor_phone,d.specialization FROM appointments a JOIN users p ON p.id=a.patient_id JOIN users d ON d.id=a.doctor_id WHERE a.id=$1`, [rows[0].id]);
  res.status(201).json({ appointment: result.rows[0] });
}));
app.patch('/api/appointments/:id/status', auth, allow('admin', 'doctor', 'patient'), asyncRoute(async (req, res) => {
  const { status } = req.body; if (!['confirmed', 'cancelled', 'completed'].includes(status)) return res.status(400).json({ error: 'Unsupported appointment status' });
  const check = await pool.query('SELECT * FROM appointments WHERE id=$1', [req.params.id]); if (!check.rows[0]) return res.status(404).json({ error: 'Appointment not found' });
  const appointment = check.rows[0]; if (req.user.role === 'patient' && appointment.patient_id !== req.user.id) return res.status(403).json({ error: 'You can only update your own appointments' }); if (req.user.role === 'doctor' && appointment.doctor_id !== req.user.id) return res.status(403).json({ error: 'You can only update your own appointments' });
  await pool.query('UPDATE appointments SET status=$1,updated_at=now() WHERE id=$2', [status, req.params.id]); await audit(req.user.id, 'STATUS_UPDATE', 'appointment', req.params.id, { status }); if (status === 'cancelled') await queueAppointmentNotifications(req.params.id, 'cancellation'); res.json({ status });
}));

app.get('/api/users', auth, allow('admin'), asyncRoute(async (req, res) => { const role = req.query.role; const params = role ? [role] : []; const { rows } = await pool.query(`SELECT id,name,email,phone,role,specialization FROM users ${role ? 'WHERE role=$1' : ''} ORDER BY name`, params); res.json({ users: rows }); }));

function smtpTransport() { if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null; return nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }); }
async function deliver(notification) {
  try {
    if (notification.channel === 'email') { const transporter = smtpTransport(); if (!transporter) { console.log(`[notification:email:dev] ${notification.destination} — ${notification.subject}`); return 'dev-email'; } const info = await transporter.sendMail({ from: process.env.NOTIFICATION_FROM, to: notification.destination, subject: notification.subject, text: notification.body }); return info.messageId; }
    if (notification.channel === 'sms') { if (!process.env.TWILIO_ACCOUNT_SID) { console.log(`[notification:sms:dev] ${notification.destination} — ${notification.body}`); return 'dev-sms'; } const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN); const message = await client.messages.create({ body: notification.body, from: process.env.TWILIO_FROM_NUMBER, to: notification.destination }); return message.sid; }
  } catch (error) { throw error; }
}
async function queueAppointmentNotifications(appointmentId, kind) {
  const { rows } = await pool.query(`SELECT a.appointment_at,p.name patient_name,p.email patient_email,p.phone patient_phone,d.name doctor_name,d.email doctor_email,d.phone doctor_phone FROM appointments a JOIN users p ON p.id=a.patient_id JOIN users d ON d.id=a.doctor_id WHERE a.id=$1`, [appointmentId]); if (!rows[0]) return; const a = rows[0]; const when = new Date(a.appointment_at).toLocaleString(); const subject = kind === 'cancellation' ? 'Appointment cancelled' : 'Appointment confirmed'; const body = kind === 'cancellation' ? `Your appointment with ${a.doctor_name} on ${when} has been cancelled.` : `Your appointment with ${a.doctor_name} is confirmed for ${when}.`;
  const recipients = [{ email: a.patient_email, phone: a.patient_phone }, { email: a.doctor_email, phone: a.doctor_phone }]; for (const recipient of recipients) { for (const [channel, destination] of [['email', recipient.email], ['sms', recipient.phone]]) { if (!destination) continue; const inserted = await pool.query('INSERT INTO notifications (appointment_id,user_id,channel,kind,destination,subject,body) SELECT $1,id,$2,$3,$4,$5,$6 FROM users WHERE email=$4 OR phone=$4 RETURNING id', [appointmentId, channel, kind, destination, subject, body]); if (inserted.rows[0]) { try { const providerId = await deliver({ channel, destination, subject, body }); await pool.query('UPDATE notifications SET status=$1,provider_id=$2,sent_at=now() WHERE id=$3', ['sent', providerId, inserted.rows[0].id]); } catch (error) { await pool.query('UPDATE notifications SET status=$1,error_message=$2 WHERE id=$3', ['failed', error.message, inserted.rows[0].id]); } } } }
}
async function sendReminders() { const { rows } = await pool.query(`SELECT id FROM appointments WHERE status='confirmed' AND reminder_sent_at IS NULL AND appointment_at BETWEEN now() + interval '23 hours' AND now() + interval '25 hours'`); for (const row of rows) { await queueAppointmentNotifications(row.id, 'reminder'); await pool.query('UPDATE appointments SET reminder_sent_at=now() WHERE id=$1', [row.id]); } }
cron.schedule('*/5 * * * *', () => sendReminders().catch(error => console.error('Reminder worker failed:', error.message)));

app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message }); });
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(port, () => console.log(`Carely server listening on http://localhost:${port}`));
