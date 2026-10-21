/**
 * ObraMaster - Servicio de autenticación (Supabase Auth)
 *
 * - El login pasa por el servidor (/api/auth/login), que acepta usuario, email,
 *   teléfono o DNI y devuelve una sesión de Supabase Auth.
 * - Las altas, cambios de contraseña y bajas de usuarios las hace el servidor
 *   con la clave de servicio; el navegador nunca la ve.
 * - Las contraseñas no se guardan en ningún sitio legible: ni en el navegador
 *   ni en las tablas.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

const NETWORK_ERROR = 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.';

/** Convierte una fila de `profiles` (o la respuesta del servidor) al formato de usuario de la app. */
export function mapProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email || '',
    role: row.role,
    fullName: row.fullName ?? row.full_name ?? '',
    trade: row.trade || '',
    phone: row.phone || '',
    dni: row.dni || '',
    obreroId: row.obreroId ?? row.obrero_id ?? null,
    employeeId: row.employeeId ?? row.employee_id ?? null,
    isActive: row.isActive ?? row.is_active ?? true,
    lastLogin: row.lastLogin ?? row.last_login ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null,
    // Las contraseñas no se pueden leer. Solo se conocen justo al crearlas o restablecerlas.
    password: null
  };
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

/** Llamada autenticada al servidor propio. Devuelve { ok, status, data }. */
async function callApi(path, { method = 'GET', body } = {}) {
  try {
    const token = await getAccessToken();
    const response = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: NETWORK_ERROR } };
  }
}

/** El servidor exige sesión en todas las llamadas a /api: se la añadimos automáticamente. */
export function installApiAuthHeader() {
  if (typeof window === 'undefined' || window.__obramasterFetchPatched) return;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    try {
      const rawUrl = typeof input === 'string' ? input : input?.url || '';
      const url = new URL(rawUrl, window.location.origin);
      const isOwnApi = url.origin === window.location.origin && url.pathname.startsWith('/api/');
      if (isOwnApi && url.pathname !== '/api/auth/login') {
        const token = await getAccessToken();
        if (token) {
          const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
          if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
          init = { ...init, headers };
        }
      }
    } catch {
      // Si algo falla aquí, la petición sigue su curso sin cabecera.
    }
    return originalFetch(input, init);
  };

  window.__obramasterFetchPatched = true;
}

/** Login: usuario, email, teléfono o DNI + contraseña. */
export async function signInWithIdentifier(identifier, password) {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'La aplicación no está conectada a Supabase (falta la clave pública).' };
  }

  const { ok, data } = await callApi('/api/auth/login', {
    method: 'POST',
    body: { identifier, password }
  });

  if (!ok || !data?.session) {
    return { success: false, error: data?.error || 'No se pudo iniciar sesión.' };
  }

  const { error } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token
  });
  if (error) return { success: false, error: 'No se pudo abrir la sesión. Inténtalo de nuevo.' };

  return { success: true, user: mapProfile(data.profile) };
}

/** Recupera la sesión guardada (al recargar la página). Devuelve el usuario o null. */
export async function restoreSession() {
  if (!isSupabaseConfigured) return null;

  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session?.user) return null;

  const { data: row, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !row || !row.is_active) {
    await supabase.auth.signOut();
    return null;
  }

  return mapProfile(row);
}

export async function signOutUser() {
  try {
    await supabase.auth.signOut();
  } catch {
    // Aunque falle la llamada, la sesión local se limpia igualmente.
  }
}

/** Avisa cuando la sesión se cierra o caduca. */
export function onSignedOut(callback) {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') callback();
  });
  return () => data?.subscription?.unsubscribe();
}

/** Lista de usuarios (solo la devuelve la base de datos a administradores). */
export async function fetchProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map(mapProfile);
}

export async function createUserAccount(payload) {
  const { ok, data } = await callApi('/api/admin/users', { method: 'POST', body: payload });
  if (!ok || !data?.profile) return { success: false, error: data?.error || 'No se pudo crear el usuario.' };
  return { success: true, user: mapProfile(data.profile) };
}

export async function updateUserAccount(userId, updates) {
  const { ok, data } = await callApi(`/api/admin/users/${userId}`, { method: 'PATCH', body: updates });
  if (!ok || !data?.profile) return { success: false, error: data?.error || 'No se pudo actualizar el usuario.' };
  return { success: true, user: mapProfile(data.profile) };
}

export async function resetUserAccountPassword(userId, password) {
  const { ok, data } = await callApi(`/api/admin/users/${userId}/password`, { method: 'POST', body: { password } });
  if (!ok) return { success: false, error: data?.error || 'No se pudo restablecer la contraseña.' };
  return { success: true };
}

export async function deleteUserAccount(userId) {
  const { ok, data } = await callApi(`/api/admin/users/${userId}`, { method: 'DELETE' });
  if (!ok) return { success: false, error: data?.error || 'No se pudo eliminar el usuario.' };
  return { success: true };
}

export async function changeOwnPassword(currentPassword, newPassword) {
  const { ok, data } = await callApi('/api/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword }
  });
  if (!ok) return { success: false, error: data?.error || 'No se pudo cambiar la contraseña.' };
  return { success: true };
}
