// Edición de presupuestos y revisiones tras la aprobación.
// Antes de aprobar se edita libremente. Una vez aprobado (enviado al cliente, aceptado,
// firmado o facturado) también se puede editar, pero queda "Revisado" con fecha y
// pendiente de "Nueva aceptación" del cliente. Mientras tanto la obra sigue con la
// última versión aceptada (`versionAceptada`).

export const ESTADOS_APROBADOS = ['enviado_cliente', 'aceptado', 'firmado', 'facturado'];

// Campos que forman el contenido del presupuesto (lo que el cliente acepta).
const CAMPOS_CONTENIDO = [
  'obraTitulo', 'cliente', 'nif', 'telefono', 'email', 'direccion', 'fecha', 'validezDias',
  'tipoIvaPct', 'notasLegales', 'capitulos', 'partidas', 'baseImponible', 'cuotaIva',
  'totalConIva', 'costeTotal', 'margenGlobalPct'
];

const ahora = () => new Date().toISOString().replace('T', ' ').substring(0, 16);

export const estaAprobado = (p) => Boolean(p) && (ESTADOS_APROBADOS.includes(p.estado) || p.aprobadoPorDirector === true);

const copiaContenido = (p) => JSON.parse(JSON.stringify(
  Object.fromEntries(CAMPOS_CONTENIDO.filter(k => p[k] !== undefined).map(k => [k, p[k]]))
));

// Copia completa de la versión actual para el historial de versiones (no se borra nunca).
export function fotoVersion(pres) {
  return {
    version: pres.version || 1,
    estado: pres.estado || 'borrador',
    fecha: pres.fecha || '',
    firmadaEl: pres.fechaNuevaAceptacion || pres.fechaAceptacion || '',
    guardadaEl: ahora(),
    baseImponible: Number(pres.baseImponible || 0),
    totalConIva: Number(pres.totalConIva || 0),
    contenido: copiaContenido(pres)
  };
}

// Versiones anteriores guardadas (de la más antigua a la más reciente).
export const versionesDe = (p) => (Array.isArray(p?.versiones) ? p.versiones : []);

// Marcas de una versión nueva: la actual pasa al historial y, si estaba aprobada,
// la nueva queda pendiente de que el cliente la firme.
function marcasVersionNueva(pres) {
  const marcas = {
    version: (pres.version || 1) + 1,
    versiones: [...versionesDe(pres), fotoVersion(pres)]
  };
  if (estaAprobado(pres)) {
    Object.assign(marcas, {
      revisado: true,
      fechaRevision: ahora(),
      pendienteNuevaAceptacion: true,
      revisionNumero: (pres.revisionNumero || 0) + 1,
      versionAceptada: copiaContenido(pres)
    });
  }
  return marcas;
}

// Añade a `updates` las marcas de revisión si el presupuesto ya estaba aprobado.
export function conRevision(pres, updates) {
  if (!estaAprobado(pres)) return updates;
  if (pres.pendienteNuevaAceptacion) {
    // Se sigue editando la versión nueva que aún no ha firmado el cliente.
    return { ...updates, revisado: true, fechaRevision: ahora(), pendienteNuevaAceptacion: true };
  }
  // Primera modificación tras la aprobación: nueva versión y copia de lo aceptado.
  return { ...updates, ...marcasVersionNueva(pres) };
}

// "Nueva versión" a mano: guarda la actual y abre otra del mismo presupuesto (misma obra).
// Si ya hay una versión nueva sin firmar, no se crea otra (devuelve null).
export function datosNuevaVersion(pres) {
  if (!pres || pres.pendienteNuevaAceptacion) return null;
  return marcasVersionNueva(pres);
}

// El cliente acepta la versión revisada.
export function datosNuevaAceptacion(pres) {
  const fecha = ahora();
  return {
    pendienteNuevaAceptacion: false,
    versionAceptada: null,
    fechaNuevaAceptacion: fecha,
    historialAceptaciones: [
      ...(pres.historialAceptaciones || []),
      { revision: pres.revisionNumero || 1, fechaRevision: pres.fechaRevision || '', fechaAceptacion: fecha, totalConIva: pres.totalConIva }
    ]
  };
}

// Versión que manda en la obra: la aceptada mientras haya una revisión pendiente.
export function presupuestoVigente(p) {
  if (p?.pendienteNuevaAceptacion && p.versionAceptada) return { ...p, ...p.versionAceptada };
  return p;
}

// Capítulos del presupuesto. Los antiguos solo tenían `partidas` con el nombre del capítulo,
// y algunas acciones (bandeja de audios, mensajes) añaden partidas sin tocar `capitulos`.
export function capitulosDe(p) {
  const caps = (Array.isArray(p?.capitulos) ? p.capitulos : []).map(c => ({ ...c, partidas: [...(c.partidas || [])] }));
  const enCapitulos = new Set(caps.flatMap(c => c.partidas.map(it => it.id)));
  (p?.partidas || []).filter(it => !enCapitulos.has(it.id)).forEach((it) => {
    const nombre = it.capitulo || 'General';
    let cap = caps.find(c => c.nombre === nombre);
    if (!cap) {
      cap = { id: `cap-${nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, codigo: String(caps.length + 1).padStart(2, '0'), nombre, partidas: [] };
      caps.push(cap);
    }
    cap.partidas.push(it);
  });
  return caps;
}

const r2 = (n) => Number((Number(n) || 0).toFixed(2));

// Precio de venta y total de una partida editada (PVP = coste + margen).
export function recalcularPartida(p) {
  const costeUnitario = Math.max(0, Number(p.costeUnitario) || 0);
  const margenPct = Math.max(0, Number(p.margenPct) || 0);
  const cantidad = Math.max(0, Number(p.cantidad) || 0);
  const precioVenta = r2(costeUnitario * (1 + margenPct / 100));
  return { ...p, costeUnitario, margenPct, cantidad, precioVenta, total: r2(precioVenta * cantidad) };
}

// Recalcula subtotales y totales a partir de los capítulos (sin tocar el precio de cada partida).
export function recalcularTotales(capitulos, tipoIvaPct, margenPorDefecto) {
  const caps = capitulos.map(c => {
    const partidas = c.partidas || [];
    return {
      ...c,
      partidas,
      subtotal: r2(partidas.reduce((s, p) => s + (Number(p.total) || 0), 0)),
      costeTotal: r2(partidas.reduce((s, p) => s + (Number(p.costeUnitario) || 0) * (Number(p.cantidad) || 0), 0))
    };
  });
  const partidas = caps.flatMap(c => c.partidas.map(p => ({ ...p, capitulo: c.nombre })));
  const baseImponible = r2(partidas.reduce((s, p) => s + (Number(p.total) || 0), 0));
  const cuotaIva = r2(baseImponible * ((Number(tipoIvaPct) || 0) / 100));
  const costeTotal = r2(caps.reduce((s, c) => s + c.costeTotal, 0));
  return {
    capitulos: caps,
    partidas,
    baseImponible,
    cuotaIva,
    totalConIva: r2(baseImponible + cuotaIva),
    costeTotal,
    margenGlobalPct: baseImponible > 0 ? Number((((baseImponible - costeTotal) / baseImponible) * 100).toFixed(1)) : margenPorDefecto
  };
}
