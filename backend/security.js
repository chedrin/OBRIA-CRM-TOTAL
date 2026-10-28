/**
 * ObraMaster - Utilidades de seguridad del servidor
 *
 *  - Cabeceras de seguridad (CSP, anti-clickjacking, HSTS, etc.) en todas las respuestas.
 *  - CORS con lista de orígenes permitidos (CORS_ORIGIN, separados por comas).
 *  - Lectura del cuerpo de la petición con límite de tamaño.
 *  - Política de contraseñas compartida por el login, el alta de usuarios y scripts/crearAdmin.js.
 */

export const MIN_PASSWORD_LENGTH = 10;

const isProduction = () => Boolean(process.env.RENDER) || process.env.NODE_ENV === "production";

// La web habla con su propio servidor, con Supabase (REST y tiempo real) y, en algunas
// pantallas antiguas, directamente con los proveedores de IA. Los scripts solo pueden
// venir del propio dominio: un script inyectado no se ejecuta.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");

export function applySecurityHeaders(res) {
  res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  if (isProduction()) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

/** Orígenes permitidos para CORS. Vacío = solo el mismo dominio (lo normal: la web y la API van juntas). */
function allowedOrigins() {
  return String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function applyCors(req, res) {
  const origin = String(req.headers.origin || "").replace(/\/+$/, "");
  if (!origin) return;
  const allowed = allowedOrigins();
  if (allowed.includes("*")) {
    // Comodín: sin credenciales, para que ninguna web ajena pueda usar cookies del usuario.
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  } else {
    return;
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Max-Age", "600");
}

/** Lee el cuerpo completo; corta la conexión si pasa de `limit` bytes. */
export function readBodyLimited(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"] || 0);
    if (declared > limit) {
      reject(Object.assign(new Error("La petición es demasiado grande."), { status: 413 }));
      req.resume();
      return;
    }
    const chunks = [];
    let size = 0;
    let done = false;
    req.on("data", (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > limit) {
        done = true;
        reject(Object.assign(new Error("La petición es demasiado grande."), { status: 413 }));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => { if (!done) { done = true; resolve(Buffer.concat(chunks)); } });
    req.on("error", (err) => { if (!done) { done = true; reject(err); } });
  });
}

// Contraseñas que aparecen siempre en las listas de ataques (y las típicas de la app).
const COMMON_PASSWORDS = new Set([
  "admin123", "admin1234", "admin12345", "administrador", "password", "password1", "password123",
  "contraseña", "contrasena", "123456789", "1234567890", "12345678", "qwerty123", "qwertyuiop",
  "obramaster", "obramaster1", "obramaster123", "obria", "obria123", "construccion", "reformas",
  "iloveyou", "11111111", "00000000", "abc12345", "abcd1234", "letmein1", "welcome1", "bienvenido"
]);

/**
 * Devuelve un mensaje de error si la contraseña es débil, o "" si vale.
 * Regla: 10 caracteres o más, letras y números (o símbolos), y que no sea una contraseña típica
 * ni contenga el nombre de usuario.
 */
export function passwordProblem(password, { username = "", email = "" } = {}) {
  const value = String(password || "");
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (value.length > 128) return "La contraseña es demasiado larga (máximo 128 caracteres).";
  const lower = value.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || /^(.)\1+$/.test(value)) {
    return "Esa contraseña es demasiado común. Elige otra más difícil de adivinar.";
  }
  const hasLetter = /\p{L}/u.test(value);
  const hasOther = /[^\p{L}]/u.test(value);
  if (!hasLetter || !hasOther) {
    return "La contraseña debe mezclar letras con números o símbolos.";
  }
  const user = String(username || "").toLowerCase();
  const mailUser = String(email || "").toLowerCase().split("@")[0];
  if ((user.length >= 3 && lower.includes(user)) || (mailUser.length >= 3 && lower.includes(mailUser))) {
    return "La contraseña no puede contener tu nombre de usuario ni tu correo.";
  }
  return "";
}
