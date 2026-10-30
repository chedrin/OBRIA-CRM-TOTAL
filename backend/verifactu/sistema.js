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

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-10-30" -> "30 de octubre de 2026" (fecha completa, art. 15.1.l). Si no es una fecha válida, "". */
export function fechaLarga(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[3]) < 1 || Number(m[3]) > 31) return "";
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`;
}

export const TITULO_DECLARACION = "DECLARACIÓN RESPONSABLE DEL SISTEMA INFORMÁTICO DE FACTURACIÓN";

/**
 * Declaración responsable del productor (art. 15 de la Orden HAC/1177/2024): título y los datos
 * a) a l) en ese orden, cada uno precedido de su texto descriptivo. `completa` exige también la
 * fecha y el lugar de suscripción; sin ellos no se puede pasar a producción.
 */
export function declaracionResponsable() {
  const p = datosProductor();
  const fecha = fechaLarga(p.fecha);
  const faltan = [...p.faltan];
  if (!fecha) faltan.push("VERIFACTU_DECLARACION_FECHA");
  if (!p.lugar) faltan.push("VERIFACTU_DECLARACION_LUGAR");
  const componentes =
    "Aplicación web que se usa desde el navegador (React), servidor Node.js y base de datos PostgreSQL (Supabase). " +
    "Funciones principales: la base de datos asigna el número correlativo, calcula la huella SHA-256 encadenada y bloquea " +
    "las facturas emitidas (no se pueden borrar ni modificar, solo rectificar o anular) en una sola transacción; el servidor " +
    "remite cada registro de facturación a la AEAT por servicio web con certificado electrónico, con cola de envío, control " +
    "de flujo y reintentos; la aplicación genera la factura en PDF con el código QR y la leyenda VERI*FACTU.";
  const textoDeclaracion =
    `${p.nombre || "[productor]"} declara que el sistema informático de facturación ${NOMBRE_SISTEMA}, en la versión ${VERSION_SISTEMA} ` +
    "indicada en esta declaración, cumple con lo dispuesto en el artículo 29.2.j) de la Ley 58/2003, de 17 de diciembre, " +
    "General Tributaria, y en su desarrollo reglamentario: el Reglamento que establece los requisitos que deben adoptar los " +
    "sistemas y programas informáticos o electrónicos que soporten los procesos de facturación de empresarios y profesionales, " +
    "y la estandarización de formatos de los registros de facturación, aprobado por el Real Decreto 1007/2023, de 5 de diciembre, " +
    "la Orden HAC/1177/2024, de 17 de octubre, y las especificaciones publicadas en la sede electrónica de la Agencia Estatal de " +
    "Administración Tributaria que la complementan.";
  const campos = [
    { letra: "a", etiqueta: "Nombre del sistema informático", valor: NOMBRE_SISTEMA },
    { letra: "b", etiqueta: "Código identificador del sistema informático", valor: ID_SISTEMA },
    { letra: "c", etiqueta: "Identificador completo de la versión", valor: VERSION_SISTEMA },
    { letra: "d", etiqueta: "Componentes hardware y software y sus funcionalidades", valor: componentes },
    { letra: "e", etiqueta: "Funciona exclusivamente como sistema VERI*FACTU", valor: "Sí" },
    { letra: "f", etiqueta: "Permite su uso por varios obligados tributarios o por un mismo usuario para representar a varios", valor: "Sí" },
    { letra: "g", etiqueta: "Tipos de firma utilizados para firmar los registros de facturación y de evento (solo si no es VERI*FACTU)", valor: "No aplica: el sistema funciona exclusivamente como VERI*FACTU y no genera registros de evento." },
    { letra: "h", etiqueta: "Nombre y apellidos o razón social del productor", valor: p.nombre },
    { letra: "i", etiqueta: "NIF del productor", valor: p.nif },
    { letra: "j", etiqueta: "Dirección postal completa de contacto del productor", valor: p.direccion },
    { letra: "k", etiqueta: "Declaración de cumplimiento", valor: textoDeclaracion },
    { letra: "l", etiqueta: "Fecha y lugar de suscripción", valor: fecha || p.lugar ? `En ${p.lugar || "[lugar]"}, a ${fecha || "[fecha]"}.` : "" }
  ];
  return {
    titulo: TITULO_DECLARACION,
    completa: faltan.length === 0,
    faltan,
    campos,
    // Datos adicionales recomendados (art. 15.2).
    contacto: p.email ? { email: p.email } : null,
    sistema: { nombre: NOMBRE_SISTEMA, codigo: ID_SISTEMA, version: VERSION_SISTEMA, componentes, soloVerifactu: true, multiplesObligados: true },
    productor: { nombre: p.nombre, nif: p.nif, direccion: p.direccion, email: p.email },
    declaracion: textoDeclaracion,
    fecha,
    lugar: p.lugar
  };
}
