/**
 * ObraMaster - Crear o reparar el usuario administrador
 *
 * Crea (o actualiza) el usuario en Supabase Auth y su fila en `profiles`,
 * que es lo que el login de la aplicación necesita para dejarte entrar.
 *
 * Uso (desde la carpeta del proyecto):
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/crearAdmin.js --usuario admin --email tu@correo.com --password "tu_contraseña"
 *
 * La clave service_role está en Supabase > Project Settings > API. No la subas a GitHub.
 */

import { createClient } from "@supabase/supabase-js";
import { passwordProblem } from "../backend/security.js";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const username = arg("usuario", "admin").trim().toLowerCase();
const email = arg("email").trim().toLowerCase();
const password = arg("password");
const fullName = arg("nombre", "Administrador");

if (!url || !serviceKey) {
  console.error("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY (variables de entorno).");
  process.exit(1);
}
if (!email || !password) {
  console.error('Uso: node scripts/crearAdmin.js --usuario admin --email tu@correo.com --password "contraseña"');
  process.exit(1);
}
const weak = passwordProblem(password, { username, email });
if (weak) {
  console.error(`${weak} (es la regla de la aplicación).`);
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findAuthUser(targetEmail) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => (u.email || "").toLowerCase() === targetEmail);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

try {
  let user = await findAuthUser(email);

  if (user) {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true
    });
    if (error) throw error;
    user = data.user;
    console.log(`Usuario de Auth existente actualizado: ${email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    user = data.user;
    console.log(`Usuario de Auth creado: ${email}`);
  }

  // Libera el nombre de usuario si lo tenía otra fila distinta.
  await admin.from("profiles").delete().eq("username", username).neq("id", user.id);

  const now = new Date().toISOString();
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: user.id,
      username,
      auth_email: email,
      email,
      role: "admin",
      full_name: fullName,
      trade: "Dirección Técnica",
      is_active: true,
      updated_at: now
    },
    { onConflict: "id" }
  );
  if (profileError) {
    throw new Error(
      `${profileError.message}. ¿Ejecutaste supabase_migration_seguridad.sql en el SQL Editor de Supabase?`
    );
  }

  console.log(`Listo. Entra en la app con usuario "${username}" (o con ${email}) y la contraseña indicada.`);
} catch (err) {
  console.error("No se pudo crear el administrador:", err.message || err);
  process.exit(1);
}
