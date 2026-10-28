/**
 * ObraMaster - Datos del sistema informático de facturación (SIF) y declaración responsable
 *
 * Cada registro que se envía a la AEAT lleva el bloque SistemaInformatico, y el
 * productor del software tiene que firmar una declaración responsable que el
 * usuario pueda consultar desde la propia aplicación (art. 13 RD 1007/2023 y
 * art. 15 de la Orden HAC/1177/2024).
 *
 * Los datos del productor van en variables de entorno del servidor (no en el repo):
 *   VERIFACTU_PRODUCTOR_NOMBRE      nombre o razón social del productor
 *   VERIFACTU_PRODUCTOR_NIF         NIF del productor
 *   VERIFACTU_PRODUCTOR_DIRECCION   dirección postal completa
 *   VERIFACTU_PRODUCTOR_EMAIL       correo de contacto (opcional)
 *   VERIFACTU_NUMERO_INSTALACION    identificador de esta instalación (opcional)
 *   VERIFACTU_DECLARACION_FECHA     fecha de la declaración, AAAA-MM-DD (opcional)
 *   VERIFACTU_DECLARACION_LUGAR     lugar de la declaración (opcional)
 */

import { readFileSync } from "node:fs";
import { validarNif } from "./nif.js";

export const NOMBRE_SISTEMA = "ObraMaster";
export const ID_SISTEMA = "OM"; // dos caracteres, únicos entre los sistemas del productor

function leerVersion() {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf-8"));
    return String(pkg.version || "1.0.0");
  } catch {
    return "1.0.0";
  }
}

export const VERSION_SISTEMA = leerVersion();

const env = (name) => String(process.env[name] || "").trim();

/** Datos del productor y de la instalación. `completo` = false si falta algo obligatorio. */
export function datosProductor() {
  const nif = validarNif(env("VERIFACTU_PRODUCTOR_NIF"));
  const nombre = env("VERIFACTU_PRODUCTOR_NOMBRE");
  const direccion = env("VERIFACTU_PRODUCTOR_DIRECCION");
  const faltan = [];
  if (!nombre) faltan.push("VERIFACTU_PRODUCTOR_NOMBRE");
  if (!nif.valido) faltan.push("VERIFACTU_PRODUCTOR_NIF");
  if (!direccion) faltan.push("VERIFACTU_PRODUCTOR_DIRECCION");
  return {
    completo: faltan.length === 0,
    faltan,
    nombre,
    nif: nif.valido ? nif.nif : "",
    direccion,
    email: env("VERIFACTU_PRODUCTOR_EMAIL"),
    numeroInstalacion: env("VERIFACTU_NUMERO_INSTALACION") || "obramaster-servidor-1",
    fecha: env("VERIFACTU_DECLARACION_FECHA"),
    lugar: env("VERIFACTU_DECLARACION_LUGAR")
  };
}

/** Bloque SistemaInformatico de cada registro. `multiplesOT`: la instalación la usan varias empresas. */
export function sistemaInformatico({ multiplesOT = false } = {}) {
  const p = datosProductor();
  if (!p.completo) {
    throw new Error(`Faltan los datos del productor del software en el servidor: ${p.faltan.join(", ")}.`);
  }
  return {
    NombreRazon: p.nombre.slice(0, 120),
    NIF: p.nif,
    NombreSistemaInformatico: NOMBRE_SISTEMA,
    IdSistemaInformatico: ID_SISTEMA,
    Version: VERSION_SISTEMA,
    NumeroInstalacion: p.numeroInstalacion.slice(0, 100),
    TipoUsoPosibleSoloVerifactu: "S",
    TipoUsoPosibleMultiOT: "S",
    IndicadorMultiplesOT: multiplesOT ? "S" : "N"
  };
}

/** Declaración responsable del productor (contenido del art. 15 de la Orden HAC/1177/2024). */
export function declaracionResponsable() {
  const p = datosProductor();
  return {
    completa: p.completo,
    faltan: p.faltan,
    sistema: {
      nombre: NOMBRE_SISTEMA,
      codigo: ID_SISTEMA,
      version: VERSION_SISTEMA,
      componentes:
        "Aplicación web (navegador) con servidor Node.js y base de datos PostgreSQL (Supabase). " +
        "La numeración, la huella encadenada y el bloqueo de facturas emitidas los aplica la base de datos " +
        "en una sola transacción; el servidor envía los registros a la AEAT por servicio web con certificado " +
        "electrónico, con cola de envío, control de flujo y reintentos.",
      soloVerifactu: true,
      multiplesObligados: true,
      firma: "No aplica firma XAdES de los registros: el sistema funciona solo como VERI*FACTU y los remite a la AEAT con certificado electrónico cualificado."
    },
    productor: {
      nombre: p.nombre,
      nif: p.nif,
      direccion: p.direccion,
      email: p.email
    },
    declaracion:
      `${p.nombre || "[productor]"} declara que el sistema informático de facturación ${NOMBRE_SISTEMA}, en la versión ${VERSION_SISTEMA}, ` +
      "cumple lo dispuesto en el artículo 29.2.j) de la Ley 58/2003, de 17 de diciembre, General Tributaria, " +
      "en el Reglamento aprobado por el Real Decreto 1007/2023, de 5 de diciembre, en la Orden HAC/1177/2024, " +
      "de 17 de octubre, y en las especificaciones técnicas publicadas en la sede electrónica de la AEAT.",
    fecha: p.fecha,
    lugar: p.lugar
  };
}
