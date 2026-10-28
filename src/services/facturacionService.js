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
export const anularFactura = (id, motivo) => call(`/api/facturas/${encodeURIComponent(id)}/anular`, { method: 'POST', body: { motivo } });
export const subsanarFactura = (id) => call(`/api/facturas/${encodeURIComponent(id)}/subsanar`, { method: 'POST', body: {} });
export const subirCertificado = (pfxBase64, password) => call('/api/facturacion/certificado', { method: 'PUT', body: { pfxBase64, password } });
export const quitarCertificado = () => call('/api/facturacion/certificado', { method: 'DELETE' });
export const listarEnvios = () => call('/api/facturacion/envios');
export const enviarAhora = () => call('/api/facturacion/enviar', { method: 'POST', body: {} });
export const getDeclaracionResponsable = () => call('/api/facturacion/declaracion');
export const calcularIvaObra = (datos) => call('/api/facturacion/iva-obra', { method: 'POST', body: datos });
export const getObraFiscal = (obraId) => call(`/api/facturacion/obras/${encodeURIComponent(obraId)}`);
export const guardarObraFiscal = (obraId, datos) => call(`/api/facturacion/obras/${encodeURIComponent(obraId)}`, { method: 'PUT', body: datos });
export const getResumenTrimestral = (ejercicio, trimestre) =>
  call(`/api/facturacion/resumen?ejercicio=${encodeURIComponent(ejercicio)}&trimestre=${encodeURIComponent(trimestre || '')}`);

/** Descarga un archivo de la API (con la sesión) y lo guarda con su nombre. Devuelve { ok, error }. */
export async function descargarArchivo(path, nombrePorDefecto) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      let error = `Error ${response.status}`;
      try { error = (await response.json())?.error || error; } catch { /* sin cuerpo JSON */ }
      return { ok: false, error };
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const nombre = disposition.match(/filename="([^"]+)"/)?.[1] || nombrePorDefecto;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true, error: '' };
  } catch {
    return { ok: false, error: 'No hay conexión con el servidor.' };
  }
}

export const descargarLibroExpedidas = (ejercicio, trimestre) =>
  descargarArchivo(`/api/facturacion/libro?ejercicio=${encodeURIComponent(ejercicio)}&trimestre=${encodeURIComponent(trimestre || '')}`, 'libro-facturas.csv');
export const descargarFacturae = (id) => descargarArchivo(`/api/facturas/${encodeURIComponent(id)}/facturae`, 'factura.xml');
