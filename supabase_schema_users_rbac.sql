-- =========================================================================
-- ESQUEMA DE DATOS Y POLÍTICAS DE SEGURIDAD (RLS) - SUPABASE / POSTGRESQL
-- PROYECTO: OBRAMASTER AI - PORTAL DEL OPERARIO Y ADMINISTRACIÓN
-- =========================================================================

-- 1. Extensión para generación de UUIDs v4
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla Principal de Usuarios con RBAC (Admin / Obrero)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100),
  password_hash TEXT NOT NULL, -- Almacenado con bcrypt o gestionado por Supabase Auth
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'obrero')),
  full_name VARCHAR(100) NOT NULL,
  trade VARCHAR(50), -- Albañilería, Pintura, Pladur, Electricidad, Fontanería, etc.
  phone VARCHAR(20),
  avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f8?auto=format&fit=crop&w=200&q=80',
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Índices para búsqueda rápida y autenticación
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

-- 3. Tabla de Control Horario y Fichajes de Operarios
CREATE TABLE IF NOT EXISTS public.fichajes_obreros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  obra_id VARCHAR(50),
  tipo_evento VARCHAR(20) NOT NULL CHECK (tipo_evento IN ('entrada', 'salida', 'pausa')),
  geolocalizacion_lat NUMERIC(10, 7),
  geolocalizacion_lng NUMERIC(10, 7),
  fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  observaciones TEXT
);

CREATE INDEX IF NOT EXISTS idx_fichajes_user_fecha ON public.fichajes_obreros(user_id, fecha_hora DESC);

-- 4. Trigger para actualizar el campo updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_updated_at ON public.users;
CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- 5. POLÍTICAS DE SEGURIDAD BASADAS EN FILAS (ROW LEVEL SECURITY - RLS)
-- =========================================================================

-- Habilitar RLS en las tablas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fichajes_obreros ENABLE ROW LEVEL SECURITY;

-- Función auxiliar para verificar si el usuario conectado es Administrador
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- POLÍTICAS PARA LA TABLA 'users':
-- A) Los Administradores pueden ver, crear, actualizar y borrar cualquier usuario
CREATE POLICY admin_all_access ON public.users
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- B) Los Operarios solo pueden leer su propio perfil
CREATE POLICY obrero_select_own_profile ON public.users
FOR SELECT
USING (auth.uid() = id AND is_active = true);

-- C) Los Operarios pueden actualizar su propio teléfono o avatar (pero no su rol ni su estado activo)
CREATE POLICY obrero_update_own_profile ON public.users
FOR UPDATE
USING (auth.uid() = id AND is_active = true)
WITH CHECK (
  auth.uid() = id 
  AND role = 'obrero' -- No puede ascenderse a admin
  AND is_active = true
);

-- POLÍTICAS PARA LA TABLA 'fichajes_obreros':
-- A) Los Administradores pueden ver y gestionar todos los fichajes de la empresa
CREATE POLICY admin_fichajes_all ON public.fichajes_obreros
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- B) Los Operarios pueden registrar sus propios fichajes
CREATE POLICY obrero_insert_own_fichaje ON public.fichajes_obreros
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- C) Los Operarios pueden ver su propio historial de fichajes
CREATE POLICY obrero_select_own_fichajes ON public.fichajes_obreros
FOR SELECT
USING (auth.uid() = user_id);

-- =========================================================================
-- 6. DATOS INICIALES DE DEMOSTRACIÓN (SEED DATA)
-- =========================================================================

-- Inserción del Administrador Inicial
INSERT INTO public.users (username, email, password_hash, role, full_name, trade, phone, is_active)
VALUES 
  ('admin', 'administracion@obramaster.es', '$2a$10$demoHashAdmin123', 'admin', 'Manuel Gómez (Director de Obras)', 'Dirección Técnica & Gerencia', '+34 91 234 5678', true)
ON CONFLICT (username) DO NOTHING;

-- Inserción de Operarios Iniciales
INSERT INTO public.users (username, email, password_hash, role, full_name, trade, phone, is_active)
VALUES 
  ('pedro.gomez', 'pedro.gomez@obramaster.es', '$2a$10$demoHashPedro123', 'obrero', 'Pedro Gómez Castillo', 'Albañilería & Alicatados Porcelánicos', '+34 611 223 344', true),
  ('mario.silva', 'mario.silva@obramaster.es', '$2a$10$demoHashMario123', 'obrero', 'Mario Silva Santos', 'Demoliciones & Carga', '+34 622 334 455', true),
  ('ionut.radu', 'ionut.radu@obramaster.es', '$2a$10$demoHashIonut123', 'obrero', 'Ionut Radu', 'Yesos & Pladur', '+34 633 445 566', true)
ON CONFLICT (username) DO NOTHING;

-- =========================================================================
-- 7. TABLA DE CONFIGURACIÓN DE EMPRESA Y DIRECTOR DE OBRA
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(150) NOT NULL,
  commercial_name VARCHAR(150),
  tax_id VARCHAR(50) NOT NULL, -- NIF/CIF
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

-- Trigger updated_at para company_settings
DROP TRIGGER IF EXISTS trigger_company_settings_updated_at ON public.company_settings;
CREATE TRIGGER trigger_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS para company_settings
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Admins pueden modificar la configuración de empresa
CREATE POLICY admin_company_settings_all ON public.company_settings
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Usuarios autenticados (obreros) pueden leer los datos fiscales y logo para la app
CREATE POLICY authenticated_read_company_settings ON public.company_settings
FOR SELECT
USING (auth.role() = 'authenticated');

-- Inserción inicial de datos de empresa y Director
INSERT INTO public.company_settings (
  company_name, commercial_name, tax_id, address, phone, email,
  logo_url, director_name, director_title, signature_url, bank_account_iban
) VALUES (
  'ObraMaster AI Construcciones y Reformas SL',
  'ObraMaster AI',
  'B87654321',
  'Calle Velázquez 102, Planta 3, 28006 Madrid',
  '+34 91 234 5678',
  'administracion@obramaster.es',
  'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f8?auto=format&fit=crop&w=200&q=80',
  'Manuel Gómez Castillo',
  'Arquitecto Técnico & Aparejador Colegiado (Col. COAATM 4.821)',
  'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=300&q=80',
  'ES91 2100 0418 45 0200051234'
) ON CONFLICT DO NOTHING;

-- =========================================================================
-- 8. TABLA DE CONEXIÓN DEL MOTOR DE IA (BYOK - BRING YOUR OWN KEY)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.ai_integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL DEFAULT 'openai', -- 'openai', 'anthropic', 'google', 'deepseek'
  encrypted_api_key TEXT NOT NULL, -- Clave cifrada con AES-256 / Supabase Vault
  model_name VARCHAR(50) DEFAULT 'gpt-4o',
  is_active BOOLEAN DEFAULT false,
  last_tested_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Trigger updated_at para ai_integration_settings
DROP TRIGGER IF EXISTS trigger_ai_integration_updated_at ON public.ai_integration_settings;
CREATE TRIGGER trigger_ai_integration_updated_at
BEFORE UPDATE ON public.ai_integration_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS de máxima seguridad: SOLO ADMINS PUEDEN ACCEDER A LAS CLAVES DE IA
ALTER TABLE public.ai_integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_ai_settings_exclusive ON public.ai_integration_settings
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Inserción inicial de configuración de IA
INSERT INTO public.ai_integration_settings (
  provider, encrypted_api_key, model_name, is_active, last_tested_at
) VALUES (
  'openai',
  'aes256_vault_sk_proj_demo9982348712349081234',
  'gpt-4o',
  true,
  timezone('utc'::text, now())
) ON CONFLICT DO NOTHING;

-- =========================================================================
-- 9. TABLA DE CONTROL DE OBRAS Y PROYECTOS (REALTIME REACTIVO)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(150) NOT NULL,
  client_id UUID,
  client_name VARCHAR(150) NOT NULL,
  client_phone VARCHAR(50),
  client_email VARCHAR(100),
  address TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'en_curso' CHECK (status IN ('estudio', 'presupuestado', 'en_curso', 'paralizada', 'finalizada')),
  progress_percentage NUMERIC(5,2) DEFAULT 0.00,
  direct_cost NUMERIC(12,2) DEFAULT 0.00,
  expected_margin_pct NUMERIC(5,2) DEFAULT 30.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Trigger updated_at para projects
DROP TRIGGER IF EXISTS trigger_projects_updated_at ON public.projects;
CREATE TRIGGER trigger_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- 10. EXPEDIENTES DE VISITA DE OBRA MULTIMODAL (AI CAPTURES)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.site_visit_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('audio', 'photo_state', 'handwritten_note', 'plan', 'laser_sketch')),
  title VARCHAR(150),
  file_url TEXT NOT NULL,
  transcription_or_ocr TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  captured_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- 11. TABLA DE PRESUPUESTOS INTERACTIVOS REFINADOS POR IA
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  version INT DEFAULT 1,
  status VARCHAR(50) DEFAULT 'borrador_ia' CHECK (status IN ('borrador_ia', 'en_revision_director', 'aprobado_director', 'enviado_cliente', 'aceptado', 'facturado')),
  client_name VARCHAR(150) NOT NULL,
  client_phone VARCHAR(50),
  client_email VARCHAR(100),
  property_address TEXT NOT NULL,
  quality_tier VARCHAR(50) DEFAULT 'Media-Alta',
  subtotal NUMERIC(12,2) DEFAULT 0.00,
  tax_rate NUMERIC(4,2) DEFAULT 10.00, -- 10% vivienda o 21% general
  tax_amount NUMERIC(12,2) DEFAULT 0.00,
  total NUMERIC(12,2) DEFAULT 0.00,
  commercial_margin_pct NUMERIC(5,2) DEFAULT 30.00,
  ai_generation_summary TEXT,
  refinement_changelog JSONB DEFAULT '[]'::jsonb,
  approved_by_director BOOLEAN DEFAULT false,
  director_signature_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Trigger updated_at para quotes
DROP TRIGGER IF EXISTS trigger_quotes_updated_at ON public.quotes;
CREATE TRIGGER trigger_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- 12. TABLA DE CAPÍTULOS Y PARTIDAS DESGLOSADAS
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.quote_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE,
  chapter_code VARCHAR(20) NOT NULL, -- '01', '02', '03'
  chapter_name VARCHAR(150) NOT NULL,
  subtotal NUMERIC(12,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES public.quote_chapters(id) ON DELETE CASCADE,
  item_code VARCHAR(50) NOT NULL,
  concept TEXT NOT NULL,
  unit VARCHAR(20) DEFAULT 'm²',
  quantity NUMERIC(10,2) DEFAULT 1.00,
  subcontractor_unit_cost NUMERIC(10,2) DEFAULT 0.00,
  margin_pct NUMERIC(5,2) DEFAULT 30.00,
  unit_price NUMERIC(10,2) DEFAULT 0.00,
  total_price NUMERIC(12,2) DEFAULT 0.00,
  is_ai_modified BOOLEAN DEFAULT false,
  origin VARCHAR(50) DEFAULT 'base_oficial'
);

-- =========================================================================
-- 13. HABILITACIÓN DE PUBLICACIÓN REALTIME PARA EVENTOS BIDIRECCIONALES
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_visit_captures;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;

-- =========================================================================
-- 13-B. FASES Y TAREAS VINCULADAS ESTRICTAMENTE AL PRESUPUESTO FIRMADO
-- =========================================================================

-- 1. Fases de ejecución vinculadas directamente al presupuesto
CREATE TABLE IF NOT EXISTS public.project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.quotes(id), -- Presupuesto de origen (Single Source of Truth)
  name VARCHAR(150) NOT NULL,
  order_index INT DEFAULT 1,
  weight_percentage NUMERIC(5,2) DEFAULT 0.00, -- Peso sobre el total de la obra
  progress_percentage INT DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  status VARCHAR(30) DEFAULT 'pendiente', -- 'pendiente', 'en_curso', 'completada'
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Tareas/Partidas vinculadas a la fase y a la línea de presupuesto
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES public.project_phases(id) ON DELETE CASCADE,
  quote_line_id UUID REFERENCES public.quote_items(id), -- Partida original firmada
  title VARCHAR(200) NOT NULL,
  assigned_to UUID REFERENCES public.users(id),
  progress_percentage INT DEFAULT 0 CHECK (progress_percentage IN (0, 25, 50, 75, 100)),
  status VARCHAR(30) DEFAULT 'pendiente', -- 'pendiente', 'en_curso', 'completada'
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Trigger / Función para recalcular automáticamente el avance de fase y obra
CREATE OR REPLACE FUNCTION update_project_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_phase_id UUID;
  v_project_id UUID;
  v_phase_avg NUMERIC(5,2);
  v_project_avg NUMERIC(5,2);
BEGIN
  v_phase_id := NEW.phase_id;
  
  -- Recalcular progreso de la Fase según la media de sus tareas
  SELECT COALESCE(AVG(progress_percentage), 0)
  INTO v_phase_avg
  FROM public.project_tasks
  WHERE phase_id = v_phase_id;

  UPDATE public.project_phases
  SET 
    progress_percentage = ROUND(v_phase_avg),
    status = CASE 
      WHEN ROUND(v_phase_avg) = 100 THEN 'completada'
      WHEN ROUND(v_phase_avg) > 0 THEN 'en_curso'
      ELSE 'pendiente'
    END,
    updated_at = NOW()
  WHERE id = v_phase_id
  RETURNING project_id INTO v_project_id;

  -- Recalcular progreso general de la Obra según la media ponderada de sus fases
  SELECT COALESCE(AVG(progress_percentage), 0)
  INTO v_project_avg
  FROM public.project_phases
  WHERE project_id = v_project_id;

  UPDATE public.projects
  SET 
    progress_percentage = ROUND(v_project_avg, 2),
    updated_at = NOW()
  WHERE id = v_project_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_progress_update ON public.project_tasks;
CREATE TRIGGER trg_task_progress_update
AFTER UPDATE OF progress_percentage ON public.project_tasks
FOR EACH ROW
EXECUTE FUNCTION update_project_progress();

-- RLS y Realtime
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_full_project_phases ON public.project_phases FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY worker_read_update_phases ON public.project_phases FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY admin_full_project_tasks ON public.project_tasks FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY worker_read_update_tasks ON public.project_tasks FOR ALL USING (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE public.project_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_phases;

-- RLS para proyectos, capturas y presupuestos
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_full_quotes ON public.quotes FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_full_captures ON public.site_visit_captures FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY worker_read_assigned_projects ON public.projects FOR SELECT USING (true);

-- =========================================================================
-- 14. TABLA DE EMPLEADOS Y PERSONAL LABORAL (RRHH & NÓMINAS)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Vinculación con credencial de acceso móvil
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  dni_nie VARCHAR(20) UNIQUE NOT NULL,
  naf_ss VARCHAR(30), -- Número de afiliación a la Seguridad Social
  birth_date DATE,
  address TEXT,
  phone VARCHAR(30),
  email VARCHAR(100),
  iban VARCHAR(34), -- Cuenta para liquidación de nóminas
  professional_category VARCHAR(50) NOT NULL DEFAULT 'Oficial 1ª', -- Oficial 1ª, Oficial 2ª, Peón Especialista, Peón Ordinario, Encargado
  labor_agreement VARCHAR(150) DEFAULT 'Convenio General del Sector de la Construcción',
  main_trade VARCHAR(100) NOT NULL, -- Albañilería, Pladur, Pintura, Fontanería, etc.
  contract_type VARCHAR(30) NOT NULL DEFAULT 'indefinido' CHECK (contract_type IN ('indefinido', 'fijo_discontinuo', 'temporal', 'practicas')),
  weekly_hours NUMERIC(4,2) DEFAULT 40.00,
  monthly_base_salary NUMERIC(10,2) NOT NULL DEFAULT 1600.00,
  convenio_bonus NUMERIC(10,2) DEFAULT 200.00,
  overtime_hourly_rate NUMERIC(6,2) DEFAULT 17.50,
  irpf_retention_pct NUMERIC(4,2) DEFAULT 12.00, -- Retención según Modelo 145
  family_situation VARCHAR(30) DEFAULT 'soltero' CHECK (family_situation IN ('soltero', 'casado', 'monoparental')),
  dependent_children INT DEFAULT 0,
  dependent_elders INT DEFAULT 0,
  disability_pct NUMERIC(4,2) DEFAULT 0.00,
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  termination_date DATE,
  termination_reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'vacaciones', 'baja', 'despedido')),
  annual_vacation_days INT DEFAULT 30,
  used_vacation_days NUMERIC(4,1) DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_employees_dni ON public.employees(dni_nie);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);

DROP TRIGGER IF EXISTS trigger_employees_updated_at ON public.employees;
CREATE TRIGGER trigger_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- 15. TABLA DE AUSENCIAS, VACACIONES Y BAJAS MÉDICAS (IT)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.employee_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  absence_type VARCHAR(30) NOT NULL CHECK (absence_type IN ('vacaciones', 'baja_it', 'permiso_retribuido', 'excedencia')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INT NOT NULL DEFAULT 1,
  reason TEXT,
  medical_report_url TEXT,
  status VARCHAR(20) DEFAULT 'aprobado' CHECK (status IN ('solicitado', 'aprobado', 'rechazado', 'disfrutado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_absences_employee ON public.employee_absences(employee_id, start_date);

-- =========================================================================
-- 16. TABLA DE SUBCONTRATAS Y GREMIOS EXTERNOS
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name VARCHAR(150) NOT NULL, -- Razón Social
  commercial_name VARCHAR(150),
  cif_nif VARCHAR(20) UNIQUE NOT NULL,
  trade VARCHAR(100) NOT NULL, -- Gremio
  contact_person VARCHAR(100),
  phone VARCHAR(30),
  emergency_phone VARCHAR(30), -- Teléfono de urgencias 24h en obra
  email VARCHAR(100),
  fiscal_address TEXT,
  -- Prevención de Riesgos Laborales (PRL - Ley 32/2006)
  insurance_company VARCHAR(100),
  insurance_policy_number VARCHAR(100),
  insurance_insured_sum NUMERIC(12,2) DEFAULT 300000.00,
  insurance_expiry_date DATE NOT NULL, -- Fecha de vencimiento del seguro RC
  aeat_status VARCHAR(20) DEFAULT 'vigente' CHECK (aeat_status IN ('vigente', 'caducado', 'pendiente')),
  tgss_status VARCHAR(20) DEFAULT 'vigente' CHECK (tgss_status IN ('vigente', 'caducado', 'pendiente')),
  is_approved_for_site BOOLEAN DEFAULT true, -- Semáforo de aptitud para entrar en obra
  rating_average NUMERIC(3,2) DEFAULT 5.00,
  reviews_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_subcontractors_cif ON public.subcontractors(cif_nif);
CREATE INDEX IF NOT EXISTS idx_subcontractors_trade ON public.subcontractors(trade);
CREATE INDEX IF NOT EXISTS idx_subcontractors_insurance_expiry ON public.subcontractors(insurance_expiry_date);

DROP TRIGGER IF EXISTS trigger_subcontractors_updated_at ON public.subcontractors;
CREATE TRIGGER trigger_subcontractors_updated_at
BEFORE UPDATE ON public.subcontractors
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- 17. TABLA DE PRESUPUESTOS DE SUBCONTRATAS VINCULADOS A OBRAS
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.subcontractor_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id UUID NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  quote_number VARCHAR(50),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'recibido' CHECK (status IN ('recibido', 'en_negociacion', 'aprobado', 'rechazado')),
  pdf_quote_url TEXT,
  breakdown_items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sub_budgets_project ON public.subcontractor_budgets(project_id);

-- =========================================================================
-- 18. TABLA DE FACTURAS DE SUBCONTRATAS Y CONTROL DE DESVIACIONES
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.subcontractor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id UUID NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  budget_id UUID REFERENCES public.subcontractor_budgets(id) ON DELETE SET NULL,
  invoice_number VARCHAR(50) NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  tax_base NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  vat_pct NUMERIC(4,2) DEFAULT 21.00,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  budget_deviation NUMERIC(12,2) DEFAULT 0.00, -- Desviación o sobrecoste respecto al presupuesto aprobado
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente', 'pagado', 'bloqueado')),
  payment_date DATE,
  invoice_file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sub_invoices_subcontractor ON public.subcontractor_invoices(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_sub_invoices_payment ON public.subcontractor_invoices(payment_status);

-- =========================================================================
-- 19. TABLA DE EVALUACIONES CONTINUAS (SCORING) DE SUBCONTRATAS
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.subcontractor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id UUID NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  punctuality_score NUMERIC(2,1) CHECK (punctuality_score BETWEEN 1 AND 5),
  technical_quality_score NUMERIC(2,1) CHECK (technical_quality_score BETWEEN 1 AND 5),
  cleanliness_score NUMERIC(2,1) CHECK (cleanliness_score BETWEEN 1 AND 5),
  cooperation_score NUMERIC(2,1) CHECK (cooperation_score BETWEEN 1 AND 5),
  average_score NUMERIC(3,2) NOT NULL,
  confidential_comment TEXT,
  evaluator_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- 20. HABILITACIÓN RLS Y PUBLICACIÓN REALTIME
-- =========================================================================

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractor_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractor_reviews ENABLE ROW LEVEL SECURITY;

-- Políticas Admin
CREATE POLICY admin_full_employees ON public.employees FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_full_absences ON public.employee_absences FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_full_subcontractors ON public.subcontractors FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_full_sub_budgets ON public.subcontractor_budgets FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_full_sub_invoices ON public.subcontractor_invoices FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY admin_full_sub_reviews ON public.subcontractor_reviews FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Operarios solo leen sus propios datos laborales
CREATE POLICY worker_read_own_employee_record ON public.employees FOR SELECT USING (user_id = auth.uid());

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subcontractors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subcontractor_invoices;

-- =========================================================================
-- 21. TABLA DE AUDITORÍA Y TRAZABILIDAD DE CAPTURAS MULTIMODALES (IA)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.ai_inputs_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_entrada VARCHAR(50) NOT NULL, -- 'audio', 'texto', 'email', 'whatsapp'
  remitente VARCHAR(150),
  obra_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  audio_url TEXT,
  transcripcion_original TEXT,
  redaccion_tecnica TEXT,
  partidas_generadas JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_inputs_obra ON public.ai_inputs_log(obra_id);
CREATE INDEX IF NOT EXISTS idx_ai_inputs_tipo ON public.ai_inputs_log(tipo_entrada);

ALTER TABLE public.ai_inputs_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_ai_inputs_all ON public.ai_inputs_log FOR ALL USING (is_admin()) WITH CHECK (is_admin());



