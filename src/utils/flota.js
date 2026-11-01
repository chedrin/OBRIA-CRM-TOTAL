/**
 * ObraMaster - Inventario, maquinaria y flota: textos, colores y cálculos puros.
 * Lo usan las pantallas (src/components/Flota), el servidor (backend/flotaRoutes.js) y los tests.
 * Tablas y vistas: supabase_schema_inventario_flota.sql.
 */

export const TIPOS_ACTIVO = [
  { id: 'consumible', label: 'Consumible' },
  { id: 'herramienta_manual', label: 'Herramienta manual' },
  { id: 'herramienta_electrica', label: 'Herramienta eléctrica' },
  { id: 'maquinaria_ligera', label: 'Maquinaria ligera' },
  { id: 'maquinaria_pesada', label: 'Maquinaria pesada' },
  { id: 'epi', label: 'EPI y seguridad' },
  { id: 'medicion', label: 'Medición y topografía' },
  { id: 'medio_auxiliar', label: 'Medio auxiliar (andamio...)' },
  { id: 'vehiculo', label: 'Vehículo' },
  { id: 'otro', label: 'Otro' }
];

export const ADQUISICION = [
  { id: 'propiedad', label: 'Propio' },
  { id: 'alquiler', label: 'Alquilado' },
  { id: 'renting', label: 'Renting' },
  { id: 'leasing', label: 'Leasing' }
];

export const ESTADOS_ACTIVO = {
  en_almacen: { label: 'En almacén', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  en_obra: { label: 'En obra', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  en_vehiculo: { label: 'En vehículo', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  con_operario: { label: 'Con operario', cls: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  en_reparacion: { label: 'En reparación', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  devuelto_proveedor: { label: 'Devuelto', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  baja: { label: 'Baja', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/25' }
};

// Para los vehículos, "en almacén" se lee como disponible en la nave.
export const labelEstado = (estado, tipo) =>
  tipo === 'vehiculo' && estado === 'en_almacen' ? 'Disponible' : (ESTADOS_ACTIVO[estado]?.label || estado);

export const ACCIONES_MOVIMIENTO = {
  alta: 'Alta',
  traslado_obra: 'Traslado a obra',
  carga_vehiculo: 'Cargado en vehículo',
  asignacion_operario: 'Entregado a operario',
  devolucion_almacen: 'Vuelve al almacén',
  envio_reparacion: 'Enviado a reparar',
  devolucion_proveedor: 'Devuelto al proveedor',
  sustitucion: 'Sustitución',
  baja: 'Baja',
  ajuste_stock: 'Ajuste de stock',
  cambio: 'Cambio'
};

export const TIPOS_VEHICULO = [
  { id: 'furgoneta', label: 'Furgoneta / camión ligero (≤ 3.500 kg)' },
  { id: 'turismo', label: 'Turismo / todoterreno' },
  { id: 'camion', label: 'Camión (> 3.500 kg)' },
  { id: 'moto', label: 'Moto' },
  { id: 'remolque', label: 'Remolque' },
  { id: 'maquinaria_autopropulsada', label: 'Maquinaria autopropulsada' },
  { id: 'otro', label: 'Otro' }
];

export const COMBUSTIBLES = [
  { id: 'diesel', label: 'Diésel' },
  { id: 'gasolina', label: 'Gasolina' },
  { id: 'hibrido', label: 'Híbrido' },
  { id: 'electrico', label: 'Eléctrico' },
  { id: 'glp', label: 'GLP' },
  { id: 'otro', label: 'Otro' }
];

export const DISTINTIVOS = ['0', 'ECO', 'C', 'B', 'sin'];

export const RESULTADOS_ITV = [
  { id: 'favorable', label: 'Favorable' },
  { id: 'desfavorable', label: 'Desfavorable' },
  { id: 'negativa', label: 'Negativa' },
  { id: 'pendiente', label: 'Cita pendiente' }
];

export const COBERTURAS = [
  { id: 'terceros', label: 'Terceros' },
  { id: 'terceros_ampliado', label: 'Terceros ampliado' },
  { id: 'todo_riesgo_franquicia', label: 'Todo riesgo con franquicia' },
  { id: 'todo_riesgo', label: 'Todo riesgo' }
];

export const TIPOS_MANTENIMIENTO = [
  { id: 'revision', label: 'Revisión periódica' },
  { id: 'aceite_filtros', label: 'Aceite y filtros' },
  { id: 'frenos', label: 'Frenos (pastillas, discos)' },
  { id: 'neumaticos', label: 'Neumáticos' },
  { id: 'reparacion_mecanica', label: 'Reparación mecánica' },
  { id: 'chapa_pintura', label: 'Chapa y pintura' },
  { id: 'electricidad', label: 'Electricidad' },
  { id: 'calibracion', label: 'Calibración' },
  { id: 'certificacion', label: 'Certificación / inspección de seguridad' },
  { id: 'otro', label: 'Otro' }
];

export const TIPOS_PLAN = [
  { id: 'revision', label: 'Mantenimiento' },
  { id: 'calibracion', label: 'Calibración' },
  { id: 'certificacion', label: 'Certificación de seguridad' }
];

export const POSICIONES_NEUMATICO = [
  { id: 'delantero_izquierdo', label: 'Delantero izq.' },
  { id: 'delantero_derecho', label: 'Delantero dcho.' },
  { id: 'trasero_izquierdo', label: 'Trasero izq.' },
  { id: 'trasero_derecho', label: 'Trasero dcho.' },
  { id: 'trasero_izquierdo_interior', label: 'Trasero izq. interior' },
  { id: 'trasero_derecho_interior', label: 'Trasero dcho. interior' },
  { id: 'repuesto', label: 'Repuesto' },
  { id: 'otra', label: 'Otra' }
];

export const TIPOS_DOCUMENTO = [
  { id: 'ficha_tecnica', label: 'Ficha técnica' },
  { id: 'permiso_circulacion', label: 'Permiso de circulación' },
  { id: 'tarjeta_transporte', label: 'Tarjeta de transporte' },
  { id: 'autorizacion', label: 'Autorización / permiso' },
  { id: 'certificado', label: 'Certificado (CE, revisión, calibración)' },
  { id: 'garantia', label: 'Garantía' },
  { id: 'manual', label: 'Manual técnico' },
  { id: 'factura', label: 'Factura de compra' },
  { id: 'foto', label: 'Foto' },
  { id: 'otro', label: 'Otro' }
];

export const PERIODOS_TARIFA = [
  { id: 'dia', label: 'por día' },
  { id: 'semana', label: 'por semana' },
  { id: 'mes', label: 'por mes' }
];

// Semáforo de las alertas: verde vigente, amarillo próximo/urgente, rojo vencido.
export const ESTADO_ALERTA = {
  vencido: { label: 'Vencido', orden: 0, cls: 'bg-rose-500/15 text-rose-300 border-rose-500/40', dot: 'bg-rose-500', bar: 'border-l-rose-500' },
  urgente: { label: 'Urgente', orden: 1, cls: 'bg-amber-500/15 text-amber-300 border-amber-500/50', dot: 'bg-amber-400', bar: 'border-l-amber-400' },
  proximo: { label: 'Próximo a vencer', orden: 2, cls: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/40', dot: 'bg-yellow-400', bar: 'border-l-yellow-400' },
  vigente: { label: 'Vigente', orden: 3, cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-500', bar: 'border-l-emerald-500' }
};

export const GRUPOS_ALERTA = ['ITV', 'Seguros', 'Mantenimiento', 'Calibraciones', 'Garantías', 'Documentos', 'Alquileres', 'Stock'];

const label = (lista, id) => lista.find((x) => x.id === id)?.label || id || '';
export const labelDe = label;

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/** Fecha AAAA-MM-DD (hora local) sumando meses, sin desbordar el mes (31/01 + 1 mes = 28/02). */
export function sumarMeses(fecha, meses) {
  const [y, m, d] = String(fecha).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const total = (m - 1) + meses;
  const ano = y + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const dt = new Date(Date.UTC(ano, mes, Math.min(d, ultimo)));
  return dt.toISOString().slice(0, 10);
}

const edadAnos = (desde, hasta) => {
  const a = new Date(`${String(desde).slice(0, 10)}T12:00:00Z`);
  const b = new Date(`${String(hasta).slice(0, 10)}T12:00:00Z`);
  let anos = b.getUTCFullYear() - a.getUTCFullYear();
  if (b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())) anos -= 1;
  return anos;
};

/**
 * Próxima ITV orientativa según el Real Decreto 920/2017 (Anexo I). Si no hay ITV
 * pasada, la primera desde la matriculación. Devuelve null si no se puede sugerir
 * (remolques, maquinaria, otros: se escribe a mano).
 *   Turismos: exentos 4 años; de 4 a 10, cada 2; más de 10, cada año.
 *   Mercancías ≤ 3.500 kg: exentos 2 años; de 2 a 6, cada 2; de 6 a 10, cada año; más de 10, cada 6 meses.
 *   Camiones > 3.500 kg: cada año hasta 10; después, cada 6 meses.
 *   Motos: exentas 4 años; después, cada 2.
 */
export function itvSugerida({ tipo_vehiculo: tipo, fecha_matriculacion: matric }, fechaInspeccion = null) {
  if (!matric) return null;
  if (!fechaInspeccion) {
    const primera = { turismo: 48, furgoneta: 24, camion: 12, moto: 48 }[tipo];
    return primera ? sumarMeses(matric, primera) : null;
  }
  const edad = edadAnos(matric, fechaInspeccion);
  let meses = null;
  if (tipo === 'turismo') meses = edad < 10 ? 24 : 12;
  else if (tipo === 'furgoneta') meses = edad < 6 ? 24 : edad < 10 ? 12 : 6;
  else if (tipo === 'camion') meses = edad < 10 ? 12 : 6;
  else if (tipo === 'moto') meses = 24;
  return meses ? sumarMeses(fechaInspeccion, meses) : null;
}

/**
 * Consumo medio (l/100 km) por el método de depósito lleno: entre dos repostajes con
 * el depósito lleno, los litros puestos después del primero (incluido el último) son
 * lo gastado en esos km. Los repostajes parciales se suman al siguiente lleno.
 */
export function consumoMedio(repostajes = []) {
  const lista = repostajes
    .filter((r) => Number(r.km) >= 0 && Number(r.litros) > 0)
    .map((r) => ({ ...r, km: Number(r.km), litros: Number(r.litros), lleno: r.deposito_lleno !== false }))
    .sort((a, b) => a.km - b.km || String(a.fecha).localeCompare(String(b.fecha)));
  const tramos = [];
  let base = null;
  let litros = 0;
  for (const r of lista) {
    if (base === null) {
      if (r.lleno) base = r;
      continue;
    }
    litros += r.litros;
    if (!r.lleno) continue;
    const km = r.km - base.km;
    if (km > 0) tramos.push({ desdeKm: base.km, hastaKm: r.km, km, litros: r2(litros), l100: r2((litros / km) * 100), fecha: r.fecha });
    base = r;
    litros = 0;
  }
  const kmTotal = tramos.reduce((s, t) => s + t.km, 0);
  const litrosTotal = tramos.reduce((s, t) => s + t.litros, 0);
  const importe = r2(lista.reduce((s, r) => s + Number(r.importe || 0), 0));
  return {
    media: kmTotal > 0 ? r2((litrosTotal / kmTotal) * 100) : null,
    ultimo: tramos.length ? tramos[tramos.length - 1].l100 : null,
    // €/km entre el primer y el último repostaje (lo del primero se gastó antes de ese tramo).
    eurosKm: lista.length > 1 && lista[lista.length - 1].km > lista[0].km
      ? Math.round(((importe - Number(lista[0].importe || 0)) / (lista[lista.length - 1].km - lista[0].km)) * 1000) / 1000
      : null,
    tramos,
    litros: r2(lista.reduce((s, r) => s + r.litros, 0)),
    importe
  };
}

const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

/**
 * Coste de un alquiler sin IVA (igual que public.rental_base en SQL): periodos facturables
 * hasta la devolución (o hasta hoy si sigue activo, sin pasar de la fecha prevista) por la
 * tarifa, más el transporte. Si hay importe de la factura real, manda ese.
 */
export function costeAlquiler(r, hoy = new Date().toISOString().slice(0, 10)) {
  if (r.importe_final !== null && r.importe_final !== undefined && r.importe_final !== '') {
    return { base: r2(r.importe_final), dias: null, periodos: null, estimado: false };
  }
  const fin = r.fecha_devolucion || (hoy < r.fecha_prevista_devolucion ? hoy : r.fecha_prevista_devolucion);
  const dias = Math.max(diasEntre(r.fecha_inicio, fin) + 1, 1);
  const periodos = r.tarifa_periodo === 'semana' ? Math.ceil(dias / 7) : r.tarifa_periodo === 'mes' ? Math.ceil(dias / 30) : dias;
  return { base: r2(periodos * Number(r.tarifa || 0) + Number(r.transporte || 0)), dias, periodos, estimado: !r.fecha_devolucion };
}

/**
 * Alquiler sin precio de la factura: no cuenta como gasto de la obra hasta que se ponga.
 * Pasa al cerrarlo (devuelto o sustituido) sin importe facturado, o si sigue en curso sin tarifa.
 */
export function alquilerPendienteDePrecio(r) {
  if (!r) return false;
  const sinImporte = r.importe_final === null || r.importe_final === undefined || r.importe_final === '';
  return sinImporte && (r.estado !== 'activo' || !Number(r.tarifa));
}

/**
 * Marca en los costes de flota (vista fleet_costes) los alquileres sin precio de la factura
 * (pendiente_precio) y usa la factura subida como justificante si la hay.
 */
export function marcarAlquileresSinPrecio(costes = [], rentals = []) {
  const porId = new Map(rentals.map((r) => [r.id, r]));
  return costes.map((c) => {
    const r = c.origen === 'alquiler' ? porId.get(c.id) : null;
    if (!r) return c;
    return {
      ...c,
      pendiente_precio: alquilerPendienteDePrecio(r),
      rental_estado: r.estado,
      ...(r.factura_path ? { file_path: r.factura_path } : {})
    };
  });
}

/** Coste previsto del alquiler completo (hasta la fecha prevista de devolución). */
export function costePrevistoAlquiler(r) {
  return costeAlquiler({ ...r, fecha_devolucion: r.fecha_devolucion || r.fecha_prevista_devolucion, importe_final: null });
}

/** Peor estado de una lista de alertas (para el badge de un vehículo o máquina). */
export function peorEstado(alertas = []) {
  return alertas.reduce((peor, a) => (ESTADO_ALERTA[a.estado]?.orden ?? 9) < (ESTADO_ALERTA[peor]?.orden ?? 9) ? a.estado : peor, 'vigente');
}

/** Ordena alertas: primero lo vencido y lo más cercano. */
export function ordenarAlertas(alertas = []) {
  return [...alertas].sort((a, b) =>
    (ESTADO_ALERTA[a.estado]?.orden ?? 9) - (ESTADO_ALERTA[b.estado]?.orden ?? 9)
    || (a.dias_restantes ?? a.km_restantes ?? 99999) - (b.dias_restantes ?? b.km_restantes ?? 99999));
}

/** Texto corto del plazo de una alerta: "Vence en 5 días", "Venció hace 3 días", "Faltan 800 km". */
export function plazoAlerta(a) {
  const partes = [];
  if (a.dias_restantes !== null && a.dias_restantes !== undefined) {
    const d = Number(a.dias_restantes);
    partes.push(d < 0 ? `Venció hace ${-d} ${-d === 1 ? 'día' : 'días'}` : d === 0 ? 'Vence hoy' : d === 1 ? 'Vence mañana' : `Vence en ${d} días`);
  }
  if (a.km_restantes !== null && a.km_restantes !== undefined) {
    const k = Number(a.km_restantes);
    partes.push(k <= 0 ? `Pasado ${(-k).toLocaleString('es-ES')} km` : `Faltan ${k.toLocaleString('es-ES')} km`);
  }
  return partes.join(' · ');
}

/** Dónde está un activo, en texto: "Obra: Reforma Goya", "Furgoneta 1234ABC", "Juan Pérez". */
export function ubicacionTexto(a, { obras = [], vehiculos = [] } = {}) {
  const obra = a.obra_id ? obras.find((o) => o.id === a.obra_id) : null;
  const veh = a.vehicle_id ? vehiculos.find((v) => v.id === a.vehicle_id) : null;
  const partes = [];
  if (a.estado === 'en_obra') partes.push(obra ? obra.titulo : 'Obra');
  if (a.estado === 'en_vehiculo') partes.push(veh ? veh.matricula : 'Vehículo');
  if (a.operario_nombre) partes.push(a.operario_nombre);
  if (!partes.length) partes.push(labelEstado(a.estado, a.tipo));
  if (a.ubicacion_detalle) partes.push(a.ubicacion_detalle);
  return partes.join(' · ');
}

const CATEGORIA_COSTE = { combustible: 'Combustible', alquiler: 'Maquinaria', mantenimiento: 'Maquinaria', itv: 'Otros', seguro: 'Otros' };

/** Alquileres de la obra que esperan el precio o la factura (marcados por /api/flota/costes). */
export const alquileresPendientesDePrecio = (obraId, costes = []) =>
  costes.filter((c) => c && c.pendiente_precio && String(c.obra_id) === String(obraId));

/**
 * Costes de flota imputados a una obra (vista fleet_costes) en el formato de gastos de
 * utils/gastosIngresosObra.js. origen 'flota': se editan en Inventario y flota.
 */
export function gastosFlota(obraId, costes = []) {
  return costes
    .filter((c) => c && String(c.obra_id) === String(obraId))
    // Alquiler cerrado sin precio de la factura: sale como pendiente, no como gasto.
    .filter((c) => !c.pendiente_precio)
    .map((c) => ({
      id: `flota-${c.origen}-${c.id}`,
      origen: 'flota',
      categoria: CATEGORIA_COSTE[c.origen] || 'Otros',
      proveedor: c.proveedor || '',
      numero: c.numero || '',
      concepto: c.concepto || '',
      fecha: String(c.fecha || '').slice(0, 10),
      base: r2(c.base),
      total: r2(c.total),
      pagado: c.origen === 'combustible',
      adjunto: c.file_path ? { flotaPath: c.file_path } : null,
      registro: c
    }));
}
