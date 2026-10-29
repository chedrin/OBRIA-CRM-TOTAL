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

// Añade a `updates` las marcas de revisión si el presupuesto ya estaba aprobado.
export function conRevision(pres, updates) {
  if (!estaAprobado(pres)) return updates;
  const marcas = { revisado: true, fechaRevision: ahora(), pendienteNuevaAceptacion: true };
  if (!pres.pendienteNuevaAceptacion) {
    // Primera modificación tras la aprobación: nueva revisión y copia de lo aceptado.
    marcas.revisionNumero = (pres.revisionNumero || 0) + 1;
    marcas.version = (pres.version || 1) + 1;
    marcas.versionAceptada = copiaContenido(pres);
  }
  return { ...updates, ...marcas };
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
