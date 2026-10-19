-- =========================================================================
-- ESQUEMA SQL COMPLETO DE BASE DE DATOS Y POLÍTICAS RLS - SUPABASE
-- PROYECTO: OBRAMASTER AI (CLIENTES, OBRAS, EMPLEADOS, PRESUPUESTOS, IA)
-- =========================================================================

-- 1. Extensión para generación de UUIDs v4
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 2. TABLA DE USUARIOS Y ROLES (RBAC)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100),
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'obrero')),
  full_name VARCHAR(100) NOT NULL,
  trade VARCHAR(50),
  phone VARCHAR(20),
  avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f8?auto=format&fit=crop&w=200&q=80',
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- =========================================================================
-- 3. TABLA DE EMPLEADOS Y PERSONAL LABORAL (RRHH & NÓMINAS)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  dni_nie VARCHAR(20) UNIQUE NOT NULL,
  naf_ss VARCHAR(30),
  birth_date DATE,
  address TEXT,
  phone VARCHAR(30),
  email VARCHAR(100),
  iban VARCHAR(34),
  professional_category VARCHAR(50) NOT NULL DEFAULT 'Oficial 1ª',
  labor_agreement VARCHAR(150) DEFAULT 'Convenio General del Sector de la Construcción',
  main_trade VARCHAR(100) NOT NULL,
  contract_type VARCHAR(30) NOT NULL DEFAULT 'indefinido',
  monthly_base_salary NUMERIC(10,2) NOT NULL DEFAULT 1600.00,
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  termination_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'activo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_employees_dni ON public.employees(dni_nie);

-- =========================================================================
-- 4. TABLA DE CONFIGURACIÓN DE LA EMPRESA Y DIRECTOR DE OBRA
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(150) NOT NULL,
  commercial_name VARCHAR(150),
  tax_id VARCHAR(50) NOT NULL,
  address TEXT,
  phone VARCHAR(30),
  email VARCHAR(100),
  logo_url TEXT,
  director_name VARCHAR(150),
  director_title VARCHAR(100),
  signature_url TEXT,
  bank_account_iban VARCHAR(34),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- 5. TABLA DE CONFIGURACIÓN DE IA (API KEY DE GEMINI / BYOK)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.ai_integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL DEFAULT 'google',
  encrypted_api_key TEXT NOT NULL,
  model_name VARCHAR(50) DEFAULT 'gemini-1.5-flash',
  is_active BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- 6. TABLA DE CLIENTES Y CONTACTOS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  tax_id VARCHAR(50),
  phone VARCHAR(50),
  email VARCHAR(100),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- 7. TABLA DE OBRAS Y PROYECTOS (REALTIME)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(150) NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name VARCHAR(150) NOT NULL,
  client_phone VARCHAR(50),
  client_email VARCHAR(100),
  address TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'en_curso',
  progress_percentage NUMERIC(5,2) DEFAULT 0.00,
  direct_cost NUMERIC(12,2) DEFAULT 0.00,
  expected_margin_pct NUMERIC(5,2) DEFAULT 30.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_projects_code ON public.projects(code);

-- =========================================================================
-- 8. TABLA DE FASES Y TAREAS DE OBRA
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  order_index INT DEFAULT 1,
  progress_percentage INT DEFAULT 0,
  status VARCHAR(30) DEFAULT 'pendiente',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES public.project_phases(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  assigned_to UUID REFERENCES public.users(id),
  progress_percentage INT DEFAULT 0,
  status VARCHAR(30) DEFAULT 'pendiente',
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- 9. TABLA DE PRESUPUESTOS (QUOTES) Y PARTIDAS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  version INT DEFAULT 1,
  status VARCHAR(50) DEFAULT 'borrador_ia',
  client_name VARCHAR(150) NOT NULL,
  client_phone VARCHAR(50),
  client_email VARCHAR(100),
  property_address TEXT NOT NULL,
  subtotal NUMERIC(12,2) DEFAULT 0.00,
  tax_rate NUMERIC(4,2) DEFAULT 10.00,
  tax_amount NUMERIC(12,2) DEFAULT 0.00,
  total NUMERIC(12,2) DEFAULT 0.00,
  commercial_margin_pct NUMERIC(5,2) DEFAULT 30.00,
  ai_generation_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- 10. TABLA DE SUBCONTRATAS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name VARCHAR(150) NOT NULL,
  commercial_name VARCHAR(150),
  cif_nif VARCHAR(20) UNIQUE NOT NULL,
  trade VARCHAR(100) NOT NULL,
  contact_person VARCHAR(100),
  phone VARCHAR(30),
  emergency_phone VARCHAR(30),
  email VARCHAR(100),
  fiscal_address TEXT,
  insurance_company VARCHAR(100),
  insurance_policy_number VARCHAR(100),
  insurance_insured_sum NUMERIC(12,2) DEFAULT 300000.00,
  insurance_expiry_date DATE,
  is_approved_for_site BOOLEAN DEFAULT true,
  rating_average NUMERIC(3,2) DEFAULT 5.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- 11. TABLA DE PRESUPUESTOS MODELO PARA ENTRENAMIENTO IA (RAG)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.ai_reference_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT,
  is_active BOOLEAN DEFAULT true,
  extracted_text TEXT,
  gemini_file_uri TEXT,
  tipo_obra VARCHAR(100) DEFAULT 'Reforma General',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- 12. HABILITAR SEGURIDAD RLS EN TODAS LAS TABLAS
-- =========================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reference_budgets ENABLE ROW LEVEL SECURITY;

-- Políticas de Permisos de Lectura y Escritura por Defecto
CREATE POLICY "Permitir todo acceso lectura usuarios autenticados y anon" ON public.users FOR ALL USING (true);
CREATE POLICY "Permitir todo acceso lectura employees" ON public.employees FOR ALL USING (true);
CREATE POLICY "Permitir todo acceso company_settings" ON public.company_settings FOR ALL USING (true);
CREATE POLICY "Permitir todo acceso ai_integration_settings" ON public.ai_integration_settings FOR ALL USING (true);
CREATE POLICY "Permitir todo acceso clients" ON public.clients FOR ALL USING (true);
CREATE POLICY "Permitir todo acceso projects" ON public.projects FOR ALL USING (true);
CREATE POLICY "Permitir todo acceso project_phases" ON public.project_phases FOR ALL USING (true);
CREATE POLICY "Permitir todo acceso project_tasks" ON public.project_tasks FOR ALL USING (true);
CREATE POLICY "Permitir todo acceso quotes" ON public.quotes FOR ALL USING (true);
CREATE POLICY "Permitir todo acceso subcontractors" ON public.subcontractors FOR ALL USING (true);
CREATE POLICY "Permitir todo acceso ai_reference_budgets" ON public.ai_reference_budgets FOR ALL USING (true);
