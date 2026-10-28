/**
 * ObraMaster - Conexión con el servicio web VERI*FACTU de la AEAT (SOAP 1.1 sobre HTTPS
 * con certificado de cliente). No reintenta: de eso se encarga la cola (envio.js).
 */

import https from "node:https";
import { ENDPOINTS } from "./xml.js";

const TIMEOUT_MS = 60_000;
const MAX_RESPUESTA = 10 * 1024 * 1024;

/**
 * Envía el sobre SOAP y devuelve { status, body }. Lanza un error con `red = true`
 * si no hubo respuesta (sin conexión, tiempo agotado...): el envío se repite más tarde.
 */
export function enviarSoap({ entorno, xml, pfx, passphrase, endpoint }) {
  if (!ENDPOINTS[entorno] && !endpoint) throw new Error(`Entorno VeriFactu no válido: ${entorno}`);
  const url = new URL(endpoint || ENDPOINTS[entorno]);
  const payload = Buffer.from(xml, "utf8");

  return new Promise((resolve, reject) => {
    const req = https.request({
      method: "POST",
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      pfx,
      passphrase,
      minVersion: "TLSv1.2",
      timeout: TIMEOUT_MS,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Content-Length": payload.length,
        SOAPAction: '""'
      }
    }, (res) => {
      const chunks = [];
      let size = 0;
      res.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_RESPUESTA) {
          req.destroy(Object.assign(new Error("Respuesta de la AEAT demasiado grande."), { red: true }));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", (err) => reject(Object.assign(err, { red: true })));
    });
    req.on("timeout", () => req.destroy(Object.assign(new Error("La AEAT no respondió a tiempo."), { red: true })));
    req.on("error", (err) => reject(Object.assign(err, { red: err.red ?? true })));
    req.end(payload);
  });
}
