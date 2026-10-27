/**
 * ObraMaster - Notificaciones push (Web Push API estándar con claves VAPID)
 *
 * Llegan al móvil (Android, e iPhone con la app instalada en la pantalla de inicio)
 * y al navegador del PC aunque la app esté cerrada o en segundo plano.
 *
 * Variables de entorno (solo servidor):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  -> se generan una vez con: npx web-push generate-vapid-keys
 *   VAPID_SUBJECT                         -> mailto:tu-correo (lo exige el estándar)
 *
 * Rutas (con sesión):
 *   GET  /api/push/public-key   Clave pública para suscribirse (o enabled: false).
 *   POST /api/push/subscribe    Guarda la suscripción de este navegador.
 *   POST /api/push/unsubscribe  La borra.
 */

import webpush from "web-push";
import { getAdminClient } from "./authRoutes.js";

let configuredWith = "";

function vapidReady() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  if (!publicKey || !privateKey) return false;
  const signature = `${publicKey}|${privateKey}`;
  if (configuredWith !== signature) {
    try {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@obramaster.local", publicKey, privateKey);
      configuredWith = signature;
    } catch (err) {
      console.error("[push] Claves VAPID no válidas:", err.message);
      return false;
    }
  }
  return true;
}

/**
 * Envía la notificación a los dispositivos suscritos: los del destinatario o,
 * si no hay destinatario, los de todos los administradores activos.
 * Nunca lanza: un fallo de push no debe impedir guardar el aviso.
 */
export async function sendPushForNotification(notification) {
  if (!notification || !vapidReady()) return;
  try {
    const admin = getAdminClient();
    let userIds;
    if (notification.recipient_id) {
      userIds = [notification.recipient_id];
    } else {
      const { data } = await admin.from("profiles").select("id").eq("role", "admin").eq("is_active", true);
      userIds = (data || []).map((p) => p.id);
    }
    if (userIds.length === 0) return;

    const { data: subs } = await admin.from("push_subscriptions").select("*").in("user_id", userIds);
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body || "",
      tag: notification.ref_id || notification.id,
      category: notification.category,
      link: notification.link || "#admin/avisos",
      id: notification.id
    });

    await Promise.all(
      (subs || []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 60 * 60 * 24, urgency: notification.category === "urgente" ? "high" : "normal" }
          );
          await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString(), failures: 0 }).eq("id", sub.id);
        } catch (err) {
          // 404/410: la suscripción ya no existe (permiso retirado, app desinstalada).
          if (err?.statusCode === 404 || err?.statusCode === 410 || (sub.failures || 0) >= 9) {
            await admin.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            await admin.from("push_subscriptions").update({ failures: (sub.failures || 0) + 1 }).eq("id", sub.id);
          }
        }
      })
    );
  } catch (err) {
    console.error("[push] Error enviando notificaciones:", err?.message || err);
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 16 * 1024) {
        reject(Object.assign(new Error("Petición demasiado grande."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf-8")) : {});
      } catch {
        reject(Object.assign(new Error("JSON no válido."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

/** Llamar DESPUÉS de enforceApiAuth. */
export async function handlePushRoutes(req, res, pathname) {
  if (!pathname.startsWith("/api/push/")) return false;
  try {
    if (pathname === "/api/push/public-key" && req.method === "GET") {
      const enabled = vapidReady();
      sendJson(res, 200, { enabled, publicKey: enabled ? process.env.VAPID_PUBLIC_KEY : null });
      return true;
    }
    if (!req.user?.id) {
      sendJson(res, 503, { error: "Las notificaciones push necesitan Supabase configurado en el servidor." });
      return true;
    }
    if (pathname === "/api/push/subscribe" && req.method === "POST") {
      const body = await readJson(req);
      const endpoint = String(body?.endpoint || "");
      const p256dh = String(body?.keys?.p256dh || "");
      const auth = String(body?.keys?.auth || "");
      if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
        sendJson(res, 400, { error: "Suscripción no válida." });
        return true;
      }
      const { error } = await getAdminClient()
        .from("push_subscriptions")
        .upsert(
          { user_id: req.user.id, endpoint, p256dh, auth, user_agent: String(req.headers["user-agent"] || "").slice(0, 300), failures: 0 },
          { onConflict: "endpoint" }
        );
      if (error) throw new Error(error.message);
      sendJson(res, 201, { ok: true });
      return true;
    }
    if (pathname === "/api/push/unsubscribe" && req.method === "POST") {
      const body = await readJson(req);
      await getAdminClient().from("push_subscriptions").delete().eq("endpoint", String(body?.endpoint || "")).eq("user_id", req.user.id);
      sendJson(res, 200, { ok: true });
      return true;
    }
    sendJson(res, 405, { error: "Método no permitido." });
  } catch (err) {
    console.error("[push]", err?.message || err);
    if (!res.headersSent) sendJson(res, err?.status || 500, { error: err?.status ? err.message : "Error interno del servidor." });
  }
  return true;
}
