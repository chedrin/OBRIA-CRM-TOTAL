/**
 * ObraMaster - Autenticación y gestión de usuarios (Supabase Auth)
 *
 * Qué hace este módulo:
 *  - POST   /api/auth/login               Login por usuario / email / teléfono / DNI (sin exponer qué datos existen).
 *  - POST   /api/auth/change-password     Cambio de la propia contraseña.
 *  - POST   /api/admin/users              Alta de usuario (solo administradores).
 *  - PATCH  /api/admin/users/:id          Editar / activar / desactivar usuario (solo administradores).
 *  - POST   /api/admin/users/:id/password Restablecer contraseña (solo administradores).
 *  - DELETE /api/admin/users/:id          Eliminar usuario (solo administradores).
 *  - enforceApiAuth()                     Exige sesión válida en el resto de /api.
 *
 * La clave SUPABASE_SERVICE_ROLE_KEY solo existe en el servidor. NUNCA debe llevar
 * el prefijo VITE_ (todo lo que empieza por VITE_ acaba visible en el navegador).
 */

import { createClient } from "@supabase/supabase-js";
import { passwordProblem } from "./security.js";

const INTERNAL_EMAIL_DOMAIN = "obramaster.local";
const MAX_BODY_BYTES = 64 * 1024;

// Rutas /api que puede usar cualquier usuario activo autenticado (admin u obrero).
// El resto de /api queda reservado a administradores si no está en PUBLIC_PATHS.
const PUBLIC_PATHS = new Set(["/api/health", "/api/auth/login"]);
const WORKER_ALLOWED_PATHS = new Set([
  "/api/ai/improve-text",
  "/api/ai/refine-text",
  "/api/ai/transcribe",
  "/api/transcribir",
  "/api/ai/memory/corrections",
  "/api/needs",
  "/api/avance/mis-tajos",
  "/api/avance/report"
]);

// ---------------------------------------------------------------------------
// Configuración y clientes de Supabase (se leen al usarlos, no al importar)
// ---------------------------------------------------------------------------
function getConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  return { url, serviceKey, anonKey, ok: Boolean(url && serviceKey && anonKey) };
}

let cachedAdminClient = null;
let cachedAdminKey = "";
function adminClient() {
  const { url, serviceKey } = getConfig();
  const signature = `${url}|${serviceKey}`;
  if (!cachedAdminClient || cachedAdminKey !== signature) {
    cachedAdminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    cachedAdminKey = signature;
  }
  return cachedAdminClient;
}

/** Cliente con clave de servicio, para otros módulos del servidor (p. ej. la memoria de la IA). */
export function getAdminClient() {
  return adminClient();
}

export function isSupabaseReady() {
  return getConfig().ok;
}

function freshAnonClient() {
  const { url, anonKey } = getConfig();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// ---------------------------------------------------------------------------
// Utilidades HTTP
// ---------------------------------------------------------------------------
function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Petición demasiado grande."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch {
        reject(Object.assign(new Error("El cuerpo de la petición no es un JSON válido."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "desconocida";
}

// ---------------------------------------------------------------------------
// Limitador de intentos de login (en memoria)
// ---------------------------------------------------------------------------
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS_PER_ACCOUNT = 8;
const MAX_FAILS_PER_IP = 40;
const failures = new Map(); // clave -> { count, first }

function failCount(key) {
  const entry = failures.get(key);
  if (!entry) return 0;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(key);
    return 0;
  }
  return entry.count;
}

function addFailure(key) {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    failures.set(key, { count: 1, first: Date.now() });
  } else {
    entry.count += 1;
  }
  if (failures.size > 5000) {
    for (const [k, v] of failures) {
      if (Date.now() - v.first > WINDOW_MS) failures.delete(k);
    }
  }
}

// ---------------------------------------------------------------------------
// Normalización de datos de usuario
// ---------------------------------------------------------------------------
export function cleanUsername(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}

const onlyDigits = (value) => String(value || "").replace(/\D/g, "");
const normalizeDni = (value) => String(value || "").toUpperCase().replace(/[\s-]/g, "");
const cleanText = (value, max = 150) => String(value ?? "").trim().slice(0, max);

function toPublicProfile(profile) {
  return {
    id: profile.id,
    username: profile.username,
    email: profile.email || "",
    role: profile.role,
    fullName: profile.full_name,
    trade: profile.trade || "",
    phone: profile.phone || "",
    dni: profile.dni || "",
    obreroId: profile.obrero_id || null,
    employeeId: profile.employee_id || null,
    isActive: Boolean(profile.is_active),
    lastLogin: profile.last_login || null,
    createdAt: profile.created_at || null
  };
}

// ---------------------------------------------------------------------------
// Resolver quién intenta entrar (usuario, email, teléfono o DNI)
// ---------------------------------------------------------------------------
async function resolveProfile(identifier) {
  const admin = adminClient();
  const raw = String(identifier || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (lower.includes("@")) {
    let { data } = await admin.from("profiles").select("*").eq("auth_email", lower).maybeSingle();
    if (data) return data;
    ({ data } = await admin.from("profiles").select("*").eq("email", lower).limit(2));
    return data && data.length === 1 ? data[0] : null;
  }

  const username = cleanUsername(raw);
  if (username) {
    const { data } = await admin.from("profiles").select("*").eq("username", username).maybeSingle();
    if (data) return data;
  }

  const dni = normalizeDni(raw);
  if (dni.length >= 7) {
    const { data } = await admin.from("profiles").select("*").eq("dni", dni).limit(2);
    if (data && data.length === 1) return data[0];
  }

  const digits = onlyDigits(raw);
  if (digits.length >= 7) {
    const { data } = await admin.from("profiles").select("*").not("phone", "is", null);
    const matches = (data || []).filter((p) => {
      const pd = onlyDigits(p.phone);
      return pd && (pd === digits || pd.endsWith(digits) || digits.endsWith(pd));
    });
    if (matches.length === 1) return matches[0];
  }

  return null;
}

// ---------------------------------------------------------------------------
// Autenticación de peticiones (token de sesión de Supabase)
// ---------------------------------------------------------------------------
const tokenCache = new Map(); // token -> { profile, expires }
const TOKEN_CACHE_MS = 15 * 1000;

async function authenticate(req) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const cached = tokenCache.get(token);
  if (cached && cached.expires > Date.now()) return cached.profile;

  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: profile } = await admin.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (!profile || !profile.is_active) return null;

  tokenCache.set(token, { profile, expires: Date.now() + TOKEN_CACHE_MS });
  if (tokenCache.size > 500) {
    for (const [k, v] of tokenCache) {
      if (v.expires <= Date.now()) tokenCache.delete(k);
    }
  }
  return profile;
}

async function requireAdmin(req, res) {
  const profile = await authenticate(req);
  if (!profile) {
    sendJson(res, 401, { error: "Sesión no válida o caducada. Vuelve a iniciar sesión." });
    return null;
  }
  if (profile.role !== "admin") {
    sendJson(res, 403, { error: "Esta acción solo está permitida a administradores." });
    return null;
  }
  return profile;
}

async function countActiveAdmins(excludingId = null) {
  let query = adminClient()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true);
  if (excludingId) query = query.neq("id", excludingId);
  const { count } = await query;
  return count || 0;
}

// ---------------------------------------------------------------------------
// Manejadores
// ---------------------------------------------------------------------------
async function handleLogin(req, res) {
  const body = await readJson(req);
  const identifier = String(body.identifier || "").trim();
  const password = String(body.password || "");

  if (!identifier) return sendJson(res, 400, { error: "Por favor, introduce tu usuario, teléfono o DNI." });
  if (!password) return sendJson(res, 400, { error: "Por favor, introduce tu contraseña." });

  const accountKey = `acct|${identifier.toLowerCase()}`;
  const ipKey = `ip|${clientIp(req)}`;
  if (failCount(accountKey) >= MAX_FAILS_PER_ACCOUNT || failCount(ipKey) >= MAX_FAILS_PER_IP) {
    return sendJson(res, 429, { error: "Demasiados intentos fallidos. Espera unos minutos y vuelve a probar." });
  }

  const genericError = { error: "Usuario o contraseña incorrectos." };

  const profile = await resolveProfile(identifier);
  if (!profile) {
    addFailure(accountKey);
    addFailure(ipKey);
    return sendJson(res, 401, genericError);
  }

  const anon = freshAnonClient();
  const { data, error } = await anon.auth.signInWithPassword({ email: profile.auth_email, password });
  if (error || !data?.session) {
    addFailure(accountKey);
    addFailure(ipKey);
    return sendJson(res, 401, genericError);
  }

  if (!profile.is_active) {
    return sendJson(res, 403, { error: "Esta cuenta ha sido desactivada por el administrador." });
  }

  failures.delete(accountKey);
  // La contraseña es correcta pero débil (p. ej. la inicial): la web pide cambiarla.
  const weakPassword = Boolean(passwordProblem(password, { username: profile.username, email: profile.email }));
  const now = new Date().toISOString();
  await adminClient().from("profiles").update({ last_login: now, updated_at: now }).eq("id", profile.id);

  return sendJson(res, 200, {
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in
    },
    profile: toPublicProfile({ ...profile, last_login: now }),
    weakPassword
  });
}

async function handleChangeOwnPassword(req, res) {
  const profile = await authenticate(req);
  if (!profile) return sendJson(res, 401, { error: "Sesión no válida o caducada. Vuelve a iniciar sesión." });

  const body = await readJson(req);
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");

  const weak = passwordProblem(newPassword, { username: profile.username, email: profile.email });
  if (weak) return sendJson(res, 400, { error: weak });
  if (newPassword === currentPassword) {
    return sendJson(res, 400, { error: "La nueva contraseña debe ser distinta de la actual." });
  }

  const key = `chg|${profile.id}`;
  if (failCount(key) >= MAX_FAILS_PER_ACCOUNT) {
    return sendJson(res, 429, { error: "Demasiados intentos fallidos. Espera unos minutos y vuelve a probar." });
  }

  const { error: signInError } = await freshAnonClient().auth.signInWithPassword({
    email: profile.auth_email,
    password: currentPassword
  });
  if (signInError) {
    addFailure(key);
    return sendJson(res, 400, { error: "La contraseña actual no coincide." });
  }

  const { error } = await adminClient().auth.admin.updateUserById(profile.id, { password: newPassword });
  if (error) return sendJson(res, 400, { error: "No se pudo actualizar la contraseña. Prueba con otra más segura." });

  failures.delete(key);
  return sendJson(res, 200, { success: true });
}

async function handleCreateUser(req, res) {
  const caller = await requireAdmin(req, res);
  if (!caller) return;

  const body = await readJson(req);
  const username = cleanUsername(body.username);
  const password = String(body.password || "");
  const role = body.role === "admin" ? "admin" : "obrero";
  const fullName = cleanText(body.fullName);

  if (!username) return sendJson(res, 400, { error: "El nombre de usuario es obligatorio." });
  if (!fullName) return sendJson(res, 400, { error: "El nombre completo es obligatorio." });
  const weak = passwordProblem(password, { username, email: body.email });
  if (weak) return sendJson(res, 400, { error: weak });

  const admin = adminClient();
  const { data: existing } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
  if (existing) return sendJson(res, 409, { error: `El usuario "${username}" ya existe en el sistema.` });

  const authEmail = `${username}@${INTERNAL_EMAIL_DOMAIN}`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: { username }
  });
  if (createError || !created?.user) {
    const message = /already|registered|exists/i.test(createError?.message || "")
      ? `El usuario "${username}" ya existe en el sistema.`
      : "No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.";
    return sendJson(res, 400, { error: message });
  }

  const row = {
    id: created.user.id,
    username,
    auth_email: authEmail,
    email: cleanText(body.email, 100).toLowerCase() || null,
    role,
    full_name: fullName,
    trade: cleanText(body.trade, 100) || null,
    phone: cleanText(body.phone, 30) || null,
    dni: normalizeDni(body.dni) || null,
    obrero_id: cleanText(body.obreroId, 80) || null,
    employee_id: cleanText(body.employeeId, 80) || null,
    is_active: true
  };

  const { data: profile, error: profileError } = await admin.from("profiles").insert(row).select("*").single();
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return sendJson(res, 400, { error: "No se pudo guardar el perfil del usuario." });
  }

  return sendJson(res, 201, { profile: toPublicProfile(profile) });
}

async function handleUpdateUser(req, res, userId) {
  const caller = await requireAdmin(req, res);
  if (!caller) return;

  const body = await readJson(req);
  const admin = adminClient();
  const { data: target } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!target) return sendJson(res, 404, { error: "Usuario no encontrado." });

  const updates = {};
  if (body.fullName !== undefined) {
    const fullName = cleanText(body.fullName);
    if (!fullName) return sendJson(res, 400, { error: "El nombre completo es obligatorio." });
    updates.full_name = fullName;
  }
  if (body.trade !== undefined) updates.trade = cleanText(body.trade, 100) || null;
  if (body.phone !== undefined) updates.phone = cleanText(body.phone, 30) || null;
  if (body.email !== undefined) updates.email = cleanText(body.email, 100).toLowerCase() || null;
  if (body.dni !== undefined) updates.dni = normalizeDni(body.dni) || null;
  if (body.obreroId !== undefined) updates.obrero_id = cleanText(body.obreroId, 80) || null;
  if (body.employeeId !== undefined) updates.employee_id = cleanText(body.employeeId, 80) || null;

  if (body.isActive !== undefined) {
    const nextActive = Boolean(body.isActive);
    if (!nextActive && target.id === caller.id) {
      return sendJson(res, 400, { error: "No puedes desactivar tu propia cuenta." });
    }
    if (!nextActive && target.role === "admin" && (await countActiveAdmins(target.id)) === 0) {
      return sendJson(res, 400, { error: "Debe haber al menos un administrador activo en el sistema." });
    }
    updates.is_active = nextActive;
  }

  if (Object.keys(updates).length === 0) return sendJson(res, 200, { profile: toPublicProfile(target) });

  updates.updated_at = new Date().toISOString();
  const { data: profile, error } = await admin.from("profiles").update(updates).eq("id", userId).select("*").single();
  if (error) return sendJson(res, 400, { error: "No se pudieron guardar los cambios." });

  tokenCache.clear();
  return sendJson(res, 200, { profile: toPublicProfile(profile) });
}

async function handleResetPassword(req, res, userId) {
  const caller = await requireAdmin(req, res);
  if (!caller) return;

  const body = await readJson(req);
  const password = String(body.password || "");

  const { data: target } = await adminClient().from("profiles").select("id, username, email").eq("id", userId).maybeSingle();
  if (!target) return sendJson(res, 404, { error: "Usuario no encontrado." });
  const weak = passwordProblem(password, { username: target.username, email: target.email });
  if (weak) return sendJson(res, 400, { error: weak });

  const { error } = await adminClient().auth.admin.updateUserById(userId, { password });
  if (error) return sendJson(res, 400, { error: "No se pudo restablecer la contraseña. Prueba con otra más segura." });

  tokenCache.clear();
  return sendJson(res, 200, { success: true });
}

async function handleDeleteUser(req, res, userId) {
  const caller = await requireAdmin(req, res);
  if (!caller) return;

  const admin = adminClient();
  const { data: target } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!target) return sendJson(res, 404, { error: "Usuario no encontrado." });
  if (target.id === caller.id) return sendJson(res, 400, { error: "No puedes eliminar tu propia cuenta." });
  if (target.role === "admin" && target.is_active && (await countActiveAdmins(target.id)) === 0) {
    return sendJson(res, 400, { error: "No puedes eliminar el único administrador activo del sistema." });
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return sendJson(res, 400, { error: "No se pudo eliminar el usuario." });

  tokenCache.clear();
  return sendJson(res, 200, { success: true });
}

// ---------------------------------------------------------------------------
// Enrutador de /api/auth/* y /api/admin/users*
// Devuelve true si la petición era de este módulo (y ya está respondida).
// ---------------------------------------------------------------------------
export async function handleAuthRoutes(req, res, pathname) {
  const isAuthRoute = pathname === "/api/auth/login" || pathname === "/api/auth/change-password";
  const userMatch = pathname.match(/^\/api\/admin\/users(?:\/([0-9a-fA-F-]{36}))?(\/password)?$/);
  if (!isAuthRoute && !userMatch) return false;

  if (!getConfig().ok) {
    sendJson(res, 503, {
      error: "La autenticación no está configurada en el servidor (faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY)."
    });
    return true;
  }

  try {
    if (pathname === "/api/auth/login" && req.method === "POST") {
      await handleLogin(req, res);
    } else if (pathname === "/api/auth/change-password" && req.method === "POST") {
      await handleChangeOwnPassword(req, res);
    } else if (userMatch) {
      const [, userId, passwordSuffix] = userMatch;
      if (!userId && req.method === "POST") await handleCreateUser(req, res);
      else if (userId && passwordSuffix && req.method === "POST") await handleResetPassword(req, res, userId);
      else if (userId && !passwordSuffix && req.method === "PATCH") await handleUpdateUser(req, res, userId);
      else if (userId && !passwordSuffix && req.method === "DELETE") await handleDeleteUser(req, res, userId);
      else sendJson(res, 405, { error: "Método no permitido." });
    } else {
      sendJson(res, 405, { error: "Método no permitido." });
    }
  } catch (err) {
    console.error("[auth] Error en", pathname, err?.message || err);
    if (!res.headersSent) {
      sendJson(res, err?.status || 500, { error: err?.status ? err.message : "Error interno del servidor." });
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Protección general de la API.
// Devuelve true si la petición puede continuar; si no, ya ha respondido.
// ---------------------------------------------------------------------------
let warnedAboutOpenApi = false;

export async function enforceApiAuth(req, res, pathname) {
  if (req.method === "OPTIONS") return true;
  if (PUBLIC_PATHS.has(pathname)) return true;

  const config = getConfig();
  if (!config.ok) {
    const isProduction = Boolean(process.env.RENDER) || process.env.NODE_ENV === "production";
    if (isProduction) {
      sendJson(res, 503, {
        error: "Servidor sin configurar: faltan las variables de Supabase (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)."
      });
      return false;
    }
    if (!warnedAboutOpenApi) {
      warnedAboutOpenApi = true;
      console.warn("[auth] AVISO: sin variables de Supabase, la API local queda SIN protección (solo desarrollo).");
    }
    return true;
  }

  try {
    const profile = await authenticate(req);
    if (!profile) {
      sendJson(res, 401, { error: "Sesión no válida o caducada. Vuelve a iniciar sesión." });
      return false;
    }
    if (profile.role !== "admin" && !WORKER_ALLOWED_PATHS.has(pathname)) {
      sendJson(res, 403, { error: "No tienes permisos para esta acción." });
      return false;
    }
    req.user = profile;
    return true;
  } catch (err) {
    console.error("[auth] Error validando sesión:", err?.message || err);
    sendJson(res, 500, { error: "No se pudo validar la sesión." });
    return false;
  }
}
