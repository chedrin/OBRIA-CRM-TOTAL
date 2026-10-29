import test from "node:test";
import assert from "node:assert/strict";
import { renderEmail, getEmailTemplate, DEFAULT_EMAIL_TEMPLATES, EMAIL_TEMPLATE_TYPES } from "../src/utils/emailTemplates.js";
import { buildSupplierOrderEmail } from "./supplierEmail.js";
import { sendEmail, emailStatus, parseEmailList } from "./emailService.js";

test("cada tipo de correo tiene plantilla de serie", () => {
  for (const type of EMAIL_TEMPLATE_TYPES) assert.ok(DEFAULT_EMAIL_TEMPLATES[type.id], type.id);
});

test("la plantilla de Ajustes sustituye a la de serie y la vacía no", () => {
  const custom = { presupuesto: { asunto: "Hola {{cliente}}", cuerpo: "" } };
  const t = getEmailTemplate("presupuesto", custom);
  assert.equal(t.asunto, "Hola {{cliente}}");
  assert.equal(t.cuerpo, DEFAULT_EMAIL_TEMPLATES.presupuesto.cuerpo);
});

test("quita líneas con variables vacías, escapa HTML y deja variables desconocidas", () => {
  const { subject, html, text } = renderEmail("presupuesto", { cliente: "<b>Ana</b>", numero: "P-1", obra: "Baño", total: "100" }, {
    templates: { presupuesto: { asunto: "{{numero}} · {{nada}}", cuerpo: "Hola {{cliente}}\nTajo: {{tajo_x}}\nIVA: {{iva}}\n\nTotal {{total}}" } },
    empresa: { nombreComercial: "Reformas X" }
  });
  assert.equal(subject, "P-1 · {{nada}}");
  assert.ok(!text.includes("IVA:"));
  assert.ok(text.includes("Tajo: {{tajo_x}}"));
  assert.ok(!text.includes("{{iva}}"));
  assert.ok(html.includes("&lt;b&gt;Ana&lt;/b&gt;"));
  assert.ok(!html.includes("<b>Ana</b>"));
});

test("{{enlace}} solo en su línea es botón y solo admite http(s)", () => {
  const ok = renderEmail("subcontrata_enlace", { enlace: "https://app.es/sub/tk_1", obra: "OB-1" });
  assert.ok(ok.html.includes('href="https://app.es/sub/tk_1"'));
  assert.ok(ok.text.includes("https://app.es/sub/tk_1"));
  const bad = renderEmail("subcontrata_enlace", { enlace: "javascript:alert(1)", obra: "OB-1" });
  assert.ok(!bad.html.includes("javascript:"));
});

test("el pedido a proveedor usa la plantilla y une varias obras", () => {
  const email = buildSupplierOrderEmail({
    need: { items: [{ material: "Cemento", cantidad: 10, unidad: "sacos" }], urgency: "urgente", delivery_address: "C/ Mayor 5" },
    obras: [{ codigo: "OB-1", titulo: "Baño" }, { codigo: "OB-2", titulo: "Cocina" }],
    supplier: { contact_name: "Antonio" },
    empresa: { nombreComercial: "Reformas X", plantillasCorreo: { pedido_material: { asunto: "Pedido {{obra}} {{urgente}}" } } },
    notes: "Por la mañana"
  });
  assert.equal(email.subject, "Pedido OB-1 - Baño · OB-2 - Cocina URGENTE");
  assert.ok(email.text.startsWith("Hola Antonio,"));
  assert.ok(email.text.includes("- Cemento · 10 sacos"));
  assert.ok(email.text.includes("Observaciones: Por la mañana"));
  assert.ok(email.html.includes("<table"));
  assert.equal(email.deliveryAddress, "C/ Mayor 5");
});

test("parseEmailList valida y quita duplicados", () => {
  assert.deepEqual(parseEmailList("a@b.es; A@b.es, c@d.com"), ["a@b.es", "c@d.com"]);
  assert.throws(() => parseEmailList("no-es-correo"), /no es válida/);
});

test("sendEmail: remitente, respuesta, copia oculta y error de modo pruebas", async () => {
  const saved = { key: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM_EMAIL, fetch: globalThis.fetch };
  try {
    delete process.env.RESEND_API_KEY;
    await assert.rejects(sendEmail({ to: "a@b.es", subject: "x", html: "<p>x</p>" }), (e) => e.status === 503 && e.notConfigured);

    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "ObraMaster <avisos@midominio.es>";
    assert.equal(emailStatus().sandbox, false);
    let sentBody;
    globalThis.fetch = async (_url, init) => {
      sentBody = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ id: "em_1" }) };
    };
    const empresa = { email: "empresa@gmail.com", correoAjustes: { nombreRemitente: "Reformas Marchelo", copiaOculta: true } };
    const res = await sendEmail({ to: "cliente@x.es", subject: "Hola", html: "<p>x</p>", empresa, attachments: [{ filename: "P-1.pdf", content: "data:application/pdf;base64,QUJD" }] });
    assert.equal(res.id, "em_1");
    assert.equal(sentBody.from, "Reformas Marchelo <avisos@midominio.es>");
    assert.equal(sentBody.reply_to, "empresa@gmail.com");
    assert.deepEqual(sentBody.bcc, ["empresa@gmail.com"]);
    assert.deepEqual(sentBody.attachments, [{ filename: "P-1.pdf", content: "QUJD" }]);

    process.env.RESEND_FROM_EMAIL = "ObraMaster <onboarding@resend.dev>";
    assert.equal(emailStatus().sandbox, true);
    globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({ message: "You can only send testing emails to your own email address (x@y.com)." }) });
    await assert.rejects(sendEmail({ to: "otro@x.es", subject: "x", html: "<p>x</p>" }), (e) => e.status === 502 && /modo pruebas/.test(e.message));
  } finally {
    if (saved.key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = saved.key;
    if (saved.from === undefined) delete process.env.RESEND_FROM_EMAIL; else process.env.RESEND_FROM_EMAIL = saved.from;
    globalThis.fetch = saved.fetch;
  }
});
