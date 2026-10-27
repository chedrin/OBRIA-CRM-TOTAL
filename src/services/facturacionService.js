/**
 * ObraMaster - Facturación legal (cliente)
 *
 * Todas las facturas se emiten en el servidor (/api/facturas): la base de datos pone
 * el número correlativo y la huella VeriFactu. Aquí solo se llama a esas rutas.
 * Cada función devuelve { ok, data, error }.
 */

async function call(path, { method = 'GET', body } = {}) {
  try {
    const response = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) return { ok: false, status: response.status, data, error: data?.error || `Error ${response.status}` };
    return { ok: true, status: response.status, data, error: '' };
  } catch {
    return { ok: false, status: 0, data: null, error: 'No hay conexión con el servidor.' };
  }
}

export const getFacturacion = () => call('/api/facturacion');
export const saveEmpresaFacturacion = (empresa) => call('/api/facturacion/empresa', { method: 'PUT', body: empresa });
export const verificarCadenaVerifactu = () => call('/api/facturacion/verificar');
export const listFacturasLegales = () => call('/api/facturas');
export const emitirFactura = (factura) => call('/api/facturas', { method: 'POST', body: factura });
export const rectificarFactura = (id, datos) => call(`/api/facturas/${encodeURIComponent(id)}/rectificar`, { method: 'POST', body: datos });
export const cambiarCobroFactura = (id, datos) => call(`/api/facturas/${encodeURIComponent(id)}/cobro`, { method: 'PATCH', body: datos });
