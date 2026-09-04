-- ============================================================================
-- RCD (Report of Collections and Deposits) - Supabase Database Schema
-- Last Updated: September 2026
--
-- INSTRUCTIONS:
-- Run this entire script in your Supabase project's SQL Editor to set up
-- all required tables, constraints, indexes, and initial configurations.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SECTION A: INCREMENTAL MIGRATIONS (For existing databases)
-- ============================================================================

-- Ensure community tax collection has gender, basic_salary, booklet_no, and updated default form number
ALTER TABLE IF EXISTS public.rcd_community_tax_collections
  ADD COLUMN IF NOT EXISTS gender text DEFAULT 'Male',
  ADD COLUMN IF NOT EXISTS basic_salary numeric(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS booklet_no text;

-- Ensure real property tax collection has parcel (fraction) column
ALTER TABLE IF EXISTS public.rcd_rpt_collections
  ADD COLUMN IF NOT EXISTS parcel text DEFAULT '1/1';

ALTER TABLE IF EXISTS public.rcd_community_tax_collections
  ALTER COLUMN af_no SET DEFAULT 'BRF 0016';

-- Update old AF 0016 references to BRF 0016 if any exist
UPDATE public.rcd_community_tax_collections
SET af_no = 'BRF 0016'
WHERE af_no = 'AF 0016' OR af_no = '0016';

-- Resynchronize table ID sequences to prevent 409 Conflict errors (e.g. duplicate key violates unique constraint)
SELECT setval(pg_get_serial_sequence('public.rcd_community_tax_collections', 'id'), COALESCE(max(id), 1)) FROM public.rcd_community_tax_collections;
SELECT setval(pg_get_serial_sequence('public.rcd_collections', 'id'), COALESCE(max(id), 1)) FROM public.rcd_collections;
SELECT setval(pg_get_serial_sequence('public.rcd_rpt_collections', 'id'), COALESCE(max(id), 1)) FROM public.rcd_rpt_collections;
SELECT setval(pg_get_serial_sequence('public.rcd_signatories', 'id'), COALESCE(max(id), 1)) FROM public.rcd_signatories;
SELECT setval(pg_get_serial_sequence('public.rcd_account_codes', 'id'), COALESCE(max(id), 1)) FROM public.rcd_account_codes;

-- Remove foreign key constraints to auth.users (the application uses its own custom public.users authentication system)
ALTER TABLE IF EXISTS public.rcd_community_tax_collections DROP CONSTRAINT IF EXISTS rcd_community_tax_collections_user_id_fkey;
ALTER TABLE IF EXISTS public.rcd_collections DROP CONSTRAINT IF EXISTS rcd_collections_user_id_fkey;
ALTER TABLE IF EXISTS public.rcd_rpt_collections DROP CONSTRAINT IF EXISTS rcd_rpt_collections_user_id_fkey;
ALTER TABLE IF EXISTS public.rcd_reports DROP CONSTRAINT IF EXISTS rcd_reports_user_id_fkey;
ALTER TABLE IF EXISTS public.rcd_bank_deposits DROP CONSTRAINT IF EXISTS rcd_bank_deposits_user_id_fkey;
ALTER TABLE IF EXISTS public.rcd_account_codes DROP CONSTRAINT IF EXISTS rcd_account_codes_user_id_fkey;
ALTER TABLE IF EXISTS public.rcd_signatories DROP CONSTRAINT IF EXISTS rcd_signatories_user_id_fkey;

-- ============================================================================
-- SECTION B: TABLE DEFINITIONS (DDL)
-- ============================================================================

-- 1. USERS TABLE (System / Managed Users)
CREATE TABLE IF NOT EXISTS public.users (
  userid text PRIMARY KEY,
  firstname text NOT NULL,
  lastname text NOT NULL,
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  department text,
  position text,
  role text NOT NULL DEFAULT 'user',      -- 'admin', 'administrator', 'collector', 'user'
  status text NOT NULL DEFAULT 'active',  -- 'active', 'inactive'
  datecreated timestamptz DEFAULT now()
);

-- 2. ACCOUNT CODES (Revenue Account Code Library)
CREATE TABLE IF NOT EXISTS public.rcd_account_codes (
  id bigserial PRIMARY KEY,
  user_id uuid,
  main_category text NOT NULL,
  sub_category text NOT NULL,
  code text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. SIGNATORIES (Official Signatures for RCD Reports)
CREATE TABLE IF NOT EXISTS public.rcd_signatories (
  id bigserial PRIMARY KEY,
  user_id uuid,
  full_name text NOT NULL,
  position text NOT NULL,
  department text NOT NULL,
  remarks text,
  created_at timestamptz DEFAULT now()
);

-- 4. GENERAL COLLECTIONS (Accountable Form No. 51)
CREATE TABLE IF NOT EXISTS public.rcd_collections (
  id bigserial PRIMARY KEY,
  user_id uuid,
  collector_email text,
  af_no text NOT NULL DEFAULT 'AF 51',
  or_no text NOT NULL,
  payor text NOT NULL,
  main_category text NOT NULL,
  sub_category text NOT NULL,
  account_code text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0.00,
  date date NOT NULL DEFAULT current_date,
  remarks text,
  status text DEFAULT 'Pending',           -- 'Pending', 'Submitted'
  created_at timestamptz DEFAULT now()
);

-- 5. REAL PROPERTY TAX COLLECTIONS (Accountable Form No. 56)
CREATE TABLE IF NOT EXISTS public.rcd_rpt_collections (
  id bigserial PRIMARY KEY,
  user_id uuid,
  collector_email text,
  af56_id text NOT NULL DEFAULT 'AF 56',
  or_number text NOT NULL,
  payor text NOT NULL,
  barangay text NOT NULL,
  land_name text,
  td_number text,
  years_paid text,
  amount numeric(12,2) NOT NULL DEFAULT 0.00,
  parcel text DEFAULT '1/1',
  date date NOT NULL DEFAULT current_date,
  remarks text,
  status text DEFAULT 'Pending',           -- 'Pending', 'Submitted'
  created_at timestamptz DEFAULT now()
);

-- 6. COMMUNITY TAX CERTIFICATE (Cedula - Accountable Form BRF No. 0016)
--    Includes Gender, Basic Salary, and Concepcion, Romblon Barangays
CREATE TABLE IF NOT EXISTS public.rcd_community_tax_collections (
  id bigserial PRIMARY KEY,
  user_id uuid,
  collector_email text,
  af_no text NOT NULL DEFAULT 'BRF 0016',
  booklet_no text,
  ctc_no text NOT NULL,
  taxpayer_name text NOT NULL,
  ctc_type text NOT NULL DEFAULT 'Individual', -- 'Individual', 'Corporation'
  gender text DEFAULT 'Male',                  -- 'Male' (₱20 Base) or 'Female' (₱10 Base)
  basic_salary numeric(12,2) DEFAULT 0.00,     -- Basic Salary: (Salary * 12)/1000
  barangay text NOT NULL,                      -- Concepcion, Romblon official barangays
  address text DEFAULT '',
  basic_tax numeric(12,2) NOT NULL DEFAULT 5.00,
  additional_tax numeric(12,2) NOT NULL DEFAULT 20.00,
  penalty numeric(12,2) NOT NULL DEFAULT 0.00,
  amount numeric(12,2) NOT NULL DEFAULT 25.00,
  date date NOT NULL DEFAULT current_date,
  remarks text,
  status text DEFAULT 'Pending',
  created_at timestamptz DEFAULT now()
);

-- 7. RCD CONSOLIDATED REPORTS (Summary Submission Headers)
CREATE TABLE IF NOT EXISTS public.rcd_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  collector_email text,
  report_number text NOT NULL,
  date date NOT NULL DEFAULT current_date,
  collector_name text NOT NULL,
  fund_type text NOT NULL,                -- 'General Fund', 'Trust Fund', 'SEF'
  collections jsonb DEFAULT '[]'::jsonb,
  total_collection numeric(14,2) NOT NULL DEFAULT 0.00,
  deposits jsonb DEFAULT '[]'::jsonb,
  total_deposit numeric(14,2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'Submitted',-- 'Draft', 'Submitted', 'Verified'
  created_at timestamptz DEFAULT now()
);

-- 8. BANK DEPOSITS (Admin Deposit Tracking)
CREATE TABLE IF NOT EXISTS public.rcd_bank_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  deposit_date date NOT NULL,
  deposit_control_number text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0.00,
  depositor_name text NOT NULL,
  is_reported boolean DEFAULT false,
  report_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 9. LGU DEPARTMENTS (Directory for Municipal Offices)
CREATE TABLE IF NOT EXISTS public.lgu_departments (
  id bigserial PRIMARY KEY,
  department_code text UNIQUE NOT NULL,
  department_name text NOT NULL,
  department_acronym text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- SECTION C: PERFORMANCE INDEXES
-- ============================================================================

-- Account Codes
CREATE INDEX IF NOT EXISTS idx_rcd_account_codes_code ON public.rcd_account_codes(code);

-- General Collections (AF 51)
CREATE INDEX IF NOT EXISTS idx_rcd_collections_or_no ON public.rcd_collections(or_no);
CREATE INDEX IF NOT EXISTS idx_rcd_collections_email ON public.rcd_collections(collector_email);
CREATE INDEX IF NOT EXISTS idx_rcd_collections_date ON public.rcd_collections(date);

-- Real Property Tax Collections (AF 56)
CREATE INDEX IF NOT EXISTS idx_rcd_rpt_or_no ON public.rcd_rpt_collections(or_number);
CREATE INDEX IF NOT EXISTS idx_rcd_rpt_email ON public.rcd_rpt_collections(collector_email);
CREATE INDEX IF NOT EXISTS idx_rcd_rpt_date ON public.rcd_rpt_collections(date);

-- Community Tax Collections (BRF 0016)
CREATE INDEX IF NOT EXISTS idx_rcd_ctc_collections_no ON public.rcd_community_tax_collections(ctc_no);
CREATE INDEX IF NOT EXISTS idx_rcd_ctc_collections_email ON public.rcd_community_tax_collections(collector_email);
CREATE INDEX IF NOT EXISTS idx_rcd_ctc_collections_date ON public.rcd_community_tax_collections(date);
CREATE INDEX IF NOT EXISTS idx_rcd_ctc_collections_brgy ON public.rcd_community_tax_collections(barangay);

-- RCD Reports
CREATE INDEX IF NOT EXISTS idx_rcd_reports_number ON public.rcd_reports(report_number);
CREATE INDEX IF NOT EXISTS idx_rcd_reports_email ON public.rcd_reports(collector_email);
CREATE INDEX IF NOT EXISTS idx_rcd_reports_date ON public.rcd_reports(date);

-- Bank Deposits
CREATE INDEX IF NOT EXISTS idx_rcd_bank_deposits_ctrl ON public.rcd_bank_deposits(deposit_control_number);
CREATE INDEX IF NOT EXISTS idx_rcd_bank_deposits_date ON public.rcd_bank_deposits(deposit_date);
