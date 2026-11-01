import { createClient } from '@supabase/supabase-js';

// La URL del proyecto y la clave pública (anon) se leen del entorno (.env / variables de Render).
// La clave anon es pública por diseño: la seguridad real la ponen las políticas RLS de Supabase.
// NUNCA pongas aquí (ni en variables VITE_*) la clave service_role.
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rgwgjystfzlcogxyaksx.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error(
    '[Supabase] Falta VITE_SUPABASE_ANON_KEY. Defínela en el archivo .env (local) o en las variables de entorno de Render y vuelve a compilar.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey || 'sin-configurar', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

export default supabase;
