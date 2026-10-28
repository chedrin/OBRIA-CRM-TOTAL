import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordProblem, applyCors } from "./security.js";

test("contraseñas débiles o típicas se rechazan", () => {
  assert.match(passwordProblem("corta1"), /10 caracteres/);
  assert.match(passwordProblem("admin123"), /10 caracteres/);
  assert.match(passwordProblem("password123"), /común/);
  assert.match(passwordProblem("aaaaaaaaaaaa"), /común/);
  assert.match(passwordProblem("soloLetrasLargas"), /letras con números/);
  assert.match(passwordProblem("12345678901"), /letras con números/);
  assert.match(passwordProblem("pedro2026obra", { username: "pedro" }), /nombre de usuario/);
  assert.match(passwordProblem("jefe-obra-2026", { email: "jefe@empresa.es" }), /nombre de usuario/);
});

test("contraseñas fuertes se aceptan", () => {
  assert.equal(passwordProblem("Tejado-Rojo-2026", { username: "admin" }), "");
  assert.equal(passwordProblem("andamio 7 grúas"), "");
});

function fakeRes() {
  const headers = {};
  return { headers, setHeader: (k, v) => { headers[k] = v; } };
}

test("CORS: sin lista, no se abre a otros dominios", () => {
  delete process.env.CORS_ORIGIN;
  const res = fakeRes();
  applyCors({ headers: { origin: "https://web-maliciosa.com" } }, res);
  assert.equal(res.headers["Access-Control-Allow-Origin"], undefined);
});

test("CORS: solo los dominios de la lista, con credenciales", () => {
  process.env.CORS_ORIGIN = "https://app.ejemplo.es, http://localhost:5173";
  const ok = fakeRes();
  applyCors({ headers: { origin: "http://localhost:5173" } }, ok);
  assert.equal(ok.headers["Access-Control-Allow-Origin"], "http://localhost:5173");
  assert.equal(ok.headers["Access-Control-Allow-Credentials"], "true");
  const ko = fakeRes();
  applyCors({ headers: { origin: "https://otra.com" } }, ko);
  assert.equal(ko.headers["Access-Control-Allow-Origin"], undefined);
  delete process.env.CORS_ORIGIN;
});

test("CORS: el comodín nunca va con credenciales", () => {
  process.env.CORS_ORIGIN = "*";
  const res = fakeRes();
  applyCors({ headers: { origin: "https://otra.com" } }, res);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(res.headers["Access-Control-Allow-Credentials"], undefined);
  delete process.env.CORS_ORIGIN;
});
