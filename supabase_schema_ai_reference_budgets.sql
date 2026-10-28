-- =========================================================================
-- ESQUEMA DE DATOS PARA PRESUPUESTOS DE REFERENCIA Y ENTRENAMIENTO IA
-- PROYECTO: OBRAMASTER AI - PIPELINE MULTIMODAL CON GEMINI
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla Principal para almacenar los presupuestos de entrenamiento/referencia (PDFs)
CREATE TABLE IF NOT EXISTS public.ai_reference_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT,
  is_active BOOLEAN DEFAULT true,
  extracted_text TEXT,
  gemini_file_uri TEXT, -- Identificador de la API de archivos de Gemini (google.generativeai.upload_file)
  tipo_obra VARCHAR(100) DEFAULT 'Reforma General',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Índices para agilizar la recuperación de documentos activos en la generación con IA
CREATE INDEX IF NOT EXISTS idx_reference_budgets_is_active ON public.ai_reference_budgets(is_active);
CREATE INDEX IF NOT EXISTS idx_reference_budgets_created_at ON public.ai_reference_budgets(created_at DESC);

-- 3. Políticas de Seguridad por Fila (Row Level Security - RLS)
ALTER TABLE public.ai_reference_budgets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_reference_budgets FROM anon;

-- Solo administradores (necesita public.is_admin() de supabase_migration_seguridad.sql).
-- Antes había dos políticas "USING (true)" para anon: cualquiera podía leer y borrar.
DROP POLICY IF EXISTS "Permitir lectura de presupuestos modelo a usuarios autenticados" ON public.ai_reference_budgets;
DROP POLICY IF EXISTS "Permitir administración de presupuestos modelo" ON public.ai_reference_budgets;
DROP POLICY IF EXISTS ai_reference_budgets_solo_admin ON public.ai_reference_budgets;
CREATE POLICY ai_reference_budgets_solo_admin
ON public.ai_reference_budgets
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. Inserción de Presupuestos Modelo Iniciales (Few-Shot Training Seed)
INSERT INTO public.ai_reference_budgets (name, file_url, file_size, is_active, tipo_obra, extracted_text)
VALUES
(
  'Presupuesto_Modelo_Reforma_Integral_Salamanca.pdf',
  'https://obramaster.app/storage/reference-budgets/Presupuesto_Modelo_Reforma_Integral_Salamanca.pdf',
  422100,
  true,
  'Reforma Integral Vivienda',
  'Capítulos canónicos: 01. Demoliciones, 02. Albañilería, 03. Fontanería, 04. Electricidad REBT, 05. Revestimientos, 06. Pintura. Unidades m2, ml, ud, pa. Partidas con desglose de medios auxiliares, acopio y transporte a vertedero homologado con canon RCD.'
),
(
  'Presupuesto_Modelo_Reforma_Bano_Suite_Serrano.pdf',
  'https://obramaster.app/storage/reference-budgets/Presupuesto_Modelo_Reforma_Bano_Suite_Serrano.pdf',
  285400,
  true,
  'Baño de Alta Gama',
  'Demolición de bañera, alicatado porcelánico rectificado 60x120 con mortero C2TE S1 y crucetas autonivelantes, inodoro suspendido Geberit Duofix, plato de pizarra C3 y grifería termostática empotrada.'
),
(
  'Presupuesto_Modelo_Alisado_Gotele_Pintura_Pladur.pdf',
  'https://obramaster.app/storage/reference-budgets/Presupuesto_Modelo_Alisado_Gotele_Pintura_Pladur.pdf',
  198200,
  true,
  'Pintura y Alisado de Gotelé',
  'Protección de superficies, rascado de gotelé, dos manos de masilla plástica en pasta de alto relleno, lijado jirafa con aspiración HEPA y dos manos de pintura plástica lavable mate clase 1 UNE-EN 13300.'
)
ON CONFLICT DO NOTHING;
