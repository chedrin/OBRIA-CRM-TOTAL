import test from "node:test";
import assert from "node:assert/strict";
import { sealToken, openToken } from "./notificaciones.js";

const TOKEN = "tk_abcdefghijklmnopqrstuvwxyz012345";

test("el token del enlace se cifra y se recupera con la misma clave", () => {
  process.env.LINK_ENCRYPTION_KEY = "x".repeat(40);
  const sealed = sealToken(TOKEN);
  assert.ok(sealed.startsWith("v1."));
  assert.ok(!sealed.includes(TOKEN));
  assert.equal(openToken(sealed), TOKEN);
});

test("con otra clave o sin clave no se recupera (se regenera al reenviar)", () => {
  process.env.LINK_ENCRYPTION_KEY = "x".repeat(40);
  const sealed = sealToken(TOKEN);
  process.env.LINK_ENCRYPTION_KEY = "y".repeat(40);
  assert.equal(openToken(sealed), null);
  delete process.env.LINK_ENCRYPTION_KEY;
  delete process.env.CERT_ENCRYPTION_KEY;
  assert.equal(sealToken(TOKEN), null);
  assert.equal(openToken(sealed), null);
  assert.equal(openToken(null), null);
});
