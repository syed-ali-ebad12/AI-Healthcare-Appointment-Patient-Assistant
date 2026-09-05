# Carely — AI Healthcare Appointment & Patient Assistant

Carely is a clinic operations workspace with a responsive dashboard and a real Node.js/PostgreSQL backend. It supports authenticated administrators, doctors, and patients; appointment conflict checks; role-based data access; audit logging; and confirmation/reminder notifications over email and SMS.

## Features

- JWT authentication with bcrypt password hashing.
- Role-based access control for `admin`, `doctor`, and `patient` users.
- Patients can access their own appointments; doctors can access their schedules; admins can access clinic-wide appointment and user data.
- Express REST API backed by PostgreSQL rather than browser `localStorage`.
- Appointment conflict protection at the database-backed API boundary.
- Audit logs for registration, login, appointment creation, and status changes.
- Confirmation and cancellation notification orchestration.
- A five-minute reminder worker that sends reminders approximately 24 hours before an appointment.
- SMTP email delivery through Nodemailer and SMS delivery through Twilio when configured.
- Development-safe notification fallback that logs messages when provider credentials are absent.
- Responsive dashboard with authenticated login/register flow.

## Run locally

Requirements: Node.js 20+, Docker Desktop (recommended for PostgreSQL), and npm.

1. Install dependencies:

```bash
npm install
```

2. Start PostgreSQL:

```bash
docker compose up -d postgres
```

3. Create environment configuration:

```bash
cp .env.example .env
```

Set a long random `JWT_SECRET` in `.env`. The default local database URL already matches the included Docker Compose service.

4. Initialize the database and add demo users:

```bash
npm run db:init
npm run db:seed
```

5. Start the application:

```bash
npm run dev
```

Open [http://localhost:4173](http://localhost:4173). Demo accounts created by the seed script all use `ChangeMe123!` and should be changed immediately:

| Role | Email |
| --- | --- |
| Admin | `admin@carely.local` |
| Doctor | `doctor@carely.local` |
| Patient | `patient@carely.local` |

## Notification providers

Notifications are queued and delivered by the server after appointment confirmation or cancellation. For email, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `NOTIFICATION_FROM`. For SMS, set the Twilio account SID, auth token, and sending number. Without provider credentials, development messages are written to the server log and marked as sent with a development provider ID; this prevents accidental external messages during local testing.

## API summary

| Method | Endpoint | Access |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Public; creates patients only |
| `POST` | `/api/auth/login` | Public |
| `GET` | `/api/auth/me` | Authenticated |
| `GET` | `/api/appointments` | Authenticated; filtered by role |
| `POST` | `/api/appointments` | Authenticated; conflict checked |
| `PATCH` | `/api/appointments/:id/status` | Appointment owner, doctor, or admin |
| `GET` | `/api/users?role=doctor` | Admin only |
| `GET` | `/api/health` | Public health check |

Use `Authorization: Bearer <token>` for protected endpoints.

## Production hardening

Before handling real health information, add TLS termination, a secrets manager, refresh-token rotation or an equivalent session strategy, rate limiting, CSRF protection if cookie sessions are introduced, structured logs and monitoring, encrypted backups, stricter CORS, provider webhook verification, notification retry/dead-letter handling, and a jurisdiction-specific privacy/security review. Appointment and user access policies should be tested with automated authorization tests. The AI assistant must remain administrative and informational and must not diagnose, triage emergencies, or make treatment decisions.
