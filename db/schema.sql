CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'doctor', 'patient');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('email', 'sms');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(30),
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'patient',
  specialization VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  appointment_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 10 AND 240),
  appointment_type VARCHAR(80) NOT NULL DEFAULT 'General consultation',
  reason TEXT,
  status appointment_status NOT NULL DEFAULT 'confirmed',
  reminder_sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appointments_time_idx ON appointments(appointment_at);
CREATE INDEX IF NOT EXISTS appointments_patient_idx ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS appointments_doctor_idx ON appointments(doctor_id);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  kind VARCHAR(40) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  provider_id VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_status_idx ON notifications(status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  resource VARCHAR(80),
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
