// Histórico diario de cada obra (ver backend/historialRoutes.js y src/utils/historialObra.js).
// La cabecera de sesión la añade installApiAuthHeader() automáticamente.

export const EVENTO_HISTORIAL = 'obramaster:historial-obra';

async function peticion(path, { method = 'GET', body, keepalive = false } = {}) {
  const res = await fetch(path, {
    method,
    keepalive,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data;
}

const ruta = (obraId) => `/api/historial/${encodeURIComponent(obraId)}`;
const avisar = (obraId) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO_HISTORIAL, { detail: { obraId } }));
};

export const cargarHistorial = (obraId) => peticion(ruta(obraId));

export async function apuntarSuceso(obraId, suceso) {
  const data = await peticion(ruta(obraId), { method: 'POST', body: { ...suceso, origen: 'manual' } });
  avisar(obraId);
  return data;
}

export async function corregirSuceso(id, suceso) {
  return peticion(`/api/historial/evento/${id}`, { method: 'PATCH', body: suceso });
}

export async function quitarSuceso(id) {
  return peticion(`/api/historial/evento/${id}`, { method: 'DELETE' });
}

/** Sucesos automáticos: nunca bloquean ni avisan de error (el histórico es un extra). */
export function registrarSucesos(obraId, eventos) {
  const lista = (eventos || []).filter(e => e && e.titulo);
  if (!obraId || !lista.length) return;
  const fecha = new Date().toISOString();
  peticion(ruta(obraId), { method: 'POST', keepalive: true, body: { eventos: lista.map(e => ({ fecha, ...e })) } })
    .then(() => avisar(obraId))
    .catch(err => console.warn('[historial] No se pudo guardar el suceso:', err.message));
}

// Cambios que llegan a ráfagas (se edita al teclear): se compara el estado del primer
// cambio con el del último tras unos segundos sin tocar nada y se guarda un solo resumen.
const pendientes = new Map();

function vaciar(clave) {
  const p = pendientes.get(clave);
  if (!p) return;
  pendientes.delete(clave);
  clearTimeout(p.timer);
  try {
    registrarSucesos(p.obraId, p.calcular(p.antes, p.despues));
  } catch (err) {
    console.warn('[historial] No se pudo calcular el cambio:', err.message);
  }
}

export function cambioDiferido(clave, { obraId, antes, despues, calcular, espera = 4000 }) {
  const previo = pendientes.get(clave);
  if (previo) clearTimeout(previo.timer);
  const p = previo ? { ...previo, obraId, despues } : { obraId, antes, despues, calcular };
  p.timer = setTimeout(() => vaciar(clave), espera);
  pendientes.set(clave, p);
}

export function vaciarPendientes() {
  [...pendientes.keys()].forEach(vaciar);
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', vaciarPendientes);
