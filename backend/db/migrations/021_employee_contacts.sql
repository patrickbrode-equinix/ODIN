/* ------------------------------------------------ */
/* 021 – EMPLOYEE CONTACTS TABLE                    */
/* E-Mail-Pflege für Teams-Bot & Benachrichtigungen */
/* ------------------------------------------------ */

CREATE TABLE IF NOT EXISTS employee_contacts (
  id SERIAL PRIMARY KEY,
  employee_name VARCHAR(120) NOT NULL UNIQUE,
  email VARCHAR(255),
  email_source VARCHAR(20) NOT NULL DEFAULT 'generated',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_contacts_name ON employee_contacts(employee_name);

/* Shiftplan Upload Log – für TV-Dashboard "letztes Update" */
CREATE TABLE IF NOT EXISTS shiftplan_upload_log (
  id SERIAL PRIMARY KEY,
  uploaded_by VARCHAR(120),
  months_affected TEXT[],
  employees_count INTEGER DEFAULT 0,
  changes_count INTEGER DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
