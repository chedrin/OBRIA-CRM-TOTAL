/**
 * ObraMaster - Certificado electrónico de cada empresa para el envío a la AEAT
 *
 * El .pfx/.p12 y su contraseña se guardan cifrados (AES-256-GCM) en
 * company_certificates. La clave de cifrado solo está en el servidor:
 *   CERT_ENCRYPTION_KEY   texto largo y aleatorio (mínimo 32 caracteres)
 * Sin esa variable no se aceptan certificados. Si se pierde, hay que volver a subirlos.
 *
 * Alternativa para un único emisor: VERIFACTU_CERT_PFX_BASE64 + VERIFACTU_CERT_PASSWORD
 * en el entorno del servidor (se usa si la empresa no ha subido uno propio).
 */

import crypto from "node:crypto";
import tls from "node:tls";
import { normalizarNif } from "./nif.js";

const ALG = "aes-256-gcm";
export const MAX_PFX_BYTES = 64 * 1024;

function claveCifrado() {
  const raw = String(process.env.CERT_ENCRYPTION_KEY || "");
  if (raw.length < 32) {
    throw Object.assign(new Error("Falta CERT_ENCRYPTION_KEY en el servidor (mínimo 32 caracteres aleatorios)."), { status: 503 });
  }
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

export function cifrar(buffer, aad) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, claveCifrado(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const data = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return `v1.${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${data.toString("base64")}`;
}

export function descifrar(texto, aad) {
  const [version, iv, tag, data] = String(texto).split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Certificado guardado con un formato desconocido.");
  const decipher = crypto.createDecipheriv(ALG, claveCifrado(), Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]);
}

/** NIF del titular: serialNumber (IDCES-12345678Z) o organizationIdentifier (VATES-B12345678). */
function nifDelSujeto(subject) {
  const lines = String(subject || "").split("\n");
  const candidatos = [];
  for (const line of lines) {
    const [key, ...rest] = line.split("=");
    const value = rest.join("=");
    if (/^(serialNumber|organizationIdentifier|2\.5\.4\.97)$/i.test(key.trim())) {
      candidatos.push(normalizarNif(value.replace(/^(IDCES|VATES|IDCESP|PASES)-?/i, "")));
    }
  }
  return candidatos.find((c) => /^[A-Z0-9]{9}$/.test(c)) || "";
}

/**
 * Abre el .pfx con su contraseña y devuelve sus datos. Lanza un error claro si
 * la contraseña no es correcta o el archivo usa un cifrado antiguo no admitido.
 */
export function inspeccionarPfx(pfx, passphrase) {
  let context;
  try {
    context = tls.createSecureContext({ pfx, passphrase });
  } catch (err) {
    const msg = String(err?.message || err);
    if (/mac verify|bad decrypt|password/i.test(msg)) throw Object.assign(new Error("La contraseña del certificado no es correcta."), { status: 400 });
    if (/unsupported/i.test(msg)) {
      throw Object.assign(new Error("El certificado usa un cifrado antiguo. Expórtalo de nuevo (en Windows: cifrado AES256-SHA256 o TripleDES-SHA1) e inténtalo otra vez."), { status: 400 });
    }
    throw Object.assign(new Error("El archivo no es un certificado .pfx/.p12 válido."), { status: 400 });
  }
  const der = typeof context.context?.getCertificate === "function" ? context.context.getCertificate() : null;
  if (!der) return { titular: "", nif: "", numeroSerie: "", validoDesde: null, validoHasta: null };
  const x509 = new crypto.X509Certificate(der);
  const cn = (x509.subject.match(/^CN=(.*)$/m) || [])[1] || "";
  return {
    titular: cn,
    nif: nifDelSujeto(x509.subject),
    numeroSerie: x509.serialNumber,
    validoDesde: new Date(x509.validFrom).toISOString(),
    validoHasta: new Date(x509.validTo).toISOString()
  };
}

/** Certificado de la plataforma (variables de entorno), o null. */
export function certificadoDelEntorno() {
  const b64 = String(process.env.VERIFACTU_CERT_PFX_BASE64 || "").trim();
  if (!b64) return null;
  return { pfx: Buffer.from(b64, "base64"), passphrase: String(process.env.VERIFACTU_CERT_PASSWORD || ""), origen: "servidor" };
}

/** Guarda (cifrado) el certificado de la empresa. Devuelve los datos públicos. */
export async function guardarCertificado(db, { companyId, pfx, passphrase, userId }) {
  if (!Buffer.isBuffer(pfx) || pfx.length === 0 || pfx.length > MAX_PFX_BYTES) {
    throw Object.assign(new Error("El archivo del certificado está vacío o es demasiado grande."), { status: 400 });
  }
  const info = inspeccionarPfx(pfx, passphrase);
  if (info.validoHasta && new Date(info.validoHasta) < new Date()) {
    throw Object.assign(new Error(`El certificado caducó el ${info.validoHasta.slice(0, 10)}.`), { status: 400 });
  }
  const { error } = await db.from("company_certificates").upsert({
    company_id: companyId,
    pfx_cifrado: cifrar(pfx, `pfx:${companyId}`),
    clave_cifrada: cifrar(Buffer.from(passphrase, "utf8"), `clave:${companyId}`),
    titular: info.titular,
    nif_titular: info.nif,
    numero_serie: info.numeroSerie,
    valido_desde: info.validoDesde,
    valido_hasta: info.validoHasta,
    subido_por: userId || null,
    updated_at: new Date().toISOString()
  }, { onConflict: "company_id" });
  if (error) throw error;
  return info;
}

/** Datos públicos del certificado de la empresa (sin el archivo), o null. */
export async function estadoCertificado(db, companyId) {
  const { data, error } = await db
    .from("company_certificates")
    .select("titular, nif_titular, numero_serie, valido_desde, valido_hasta, updated_at")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    return {
      origen: "empresa",
      titular: data.titular,
      nif: data.nif_titular,
      numeroSerie: data.numero_serie,
      validoDesde: data.valido_desde,
      validoHasta: data.valido_hasta,
      subidoEl: data.updated_at
    };
  }
  const delEntorno = certificadoDelEntorno();
  if (!delEntorno) return null;
  try {
    return { origen: "servidor", ...inspeccionarPfx(delEntorno.pfx, delEntorno.passphrase) };
  } catch (err) {
    return { origen: "servidor", error: err.message };
  }
}

/** { pfx, passphrase } para firmar la conexión con la AEAT, o null si no hay certificado. */
export async function cargarCertificado(db, companyId) {
  const { data, error } = await db
    .from("company_certificates")
    .select("pfx_cifrado, clave_cifrada")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    return {
      pfx: descifrar(data.pfx_cifrado, `pfx:${companyId}`),
      passphrase: descifrar(data.clave_cifrada, `clave:${companyId}`).toString("utf8"),
      origen: "empresa"
    };
  }
  return certificadoDelEntorno();
}
