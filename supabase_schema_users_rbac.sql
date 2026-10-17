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
