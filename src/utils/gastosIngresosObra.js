/**
 * ObraMaster - Gastos ejecutados e ingresos de una obra y su comparación.
 *
 * Código puro (lo usan la ficha de la obra, la gestoría y los tests del servidor).
 *
 * Gastos: facturas recibidas con obraId (app_records "facturas_proveedores": material,
 * proveedores, licencias, combustible...) y facturas de subcontrata subidas en Avance de obra
 * (tabla subcontract_documents, kind = 'factura'). Si una factura de subcontrata ya está
 * apuntada como gasto (mismo número y misma base) no se cuenta dos veces.
 *
 * Ingresos: facturas emitidas al cliente de la obra, sin anuladas ni borradores; las
 * rectificativas se aplican sobre su original (ver basesVigentes).
 *
 * La comparación se hace sin IVA (base imponible): el IVA no es beneficio ni coste.
 */
import { basesVigentes, facturacionObra } from './facturadoPresupuesto.js';

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export const CATEGORIAS_GASTO = [
  { id: 'Materiales', label: 'Material' },
  { id: 'Proveedores', label: 'Proveedores y servicios' },
  { id: 'Subcontratas', label: 'Subcontratas' },
  { id: 'Mano de obra', label: 'Mano de obra / personal' },
  { id: 'Maquinaria', label: 'Alquiler de maquinaria' },
  { id: 'Licencias', label: 'Licencias, tasas y permisos' },
  { id: 'Combustible', label: 'Gasolina y gasóleo' },
  { id: 'Transporte', label: 'Transporte y residuos' },
  { id: 'Suministros', label: 'Suministros y herramientas' },
  { id: 'Otros', label: 'Otros gastos' }
];

const CATEGORIA_IDS = new Set(CATEGORIAS_GASTO.map((c) => c.id));
const ALIAS = {
  material: 'Materiales',
  materiales: 'Materiales',
  proveedor: 'Proveedores',
  subcontrata: 'Subcontratas',
  'estructura / alquiler': 'Maquinaria',
  alquiler: 'Maquinaria',
  licencia: 'Licencias',
  tasas: 'Licencias',
  gasolina: 'Combustible',
  gasoil: 'Combustible',
  'gasóleo': 'Combustible'
};

/** Categoría conocida para cualquier valor antiguo o escrito a mano. */
export function categoriaGasto(value) {
  const raw = String(value || '').trim();
  if (CATEGORIA_IDS.has(raw)) return raw;
  return ALIAS[raw.toLowerCase()] || 'Otros';
}

export const labelCategoria = (id) => CATEGORIAS_GASTO.find((c) => c.id === id)?.label || id;

/** Trimestre ('1T'..'4T') y año de una fecha AAAA-MM-DD. */
export function trimestreDe(fecha) {
  const f = String(fecha || '');
  const mes = Number(f.slice(5, 7)) || 1;
  return { trimestre: `${Math.ceil(mes / 3)}T`, ano: Number(f.slice(0, 4)) || new Date().getFullYear() };
}

/** Importes de una factura recibida a partir de base, IVA % y retención %. */
export function importesGasto({ base, ivaPct = 21, retencionPct = 0 }) {
  const baseImponible = r2(String(base ?? '').replace(',', '.'));
  const cuotaIva = r2(baseImponible * (Number(ivaPct) || 0) / 100);
  const cuotaRetencion = r2(baseImponible * (Number(retencionPct) || 0) / 100);
  return { baseImponible, cuotaIva, cuotaRetencion, total: r2(baseImponible + cuotaIva - cuotaRetencion) };
}

const normNum = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const totalDe = (f) => Number(f.total ?? f.totalFactura ?? (Number(f.baseImponible || 0) + Number(f.cuotaIva || 0)));

/** Gastos ejecutados de la obra, de más reciente a más antiguo. */
export function gastosObra(obraId, facturasProveedores = [], subDocs = []) {
  const manuales = facturasProveedores
    .filter((f) => f && f.obraId === obraId)
    .map((f) => ({
      id: f.id,
      origen: 'gasto',
      categoria: categoriaGasto(f.categoria),
      proveedor: f.proveedor || '',
      numero: f.numeroProveedor || f.numero || '',
      concepto: f.concepto || '',
      fecha: f.fecha || '',
      base: r2(f.baseImponible),
      total: r2(totalDe(f)),
      pagado: f.estadoPago === 'pagada' || f.estadoPago === 'pagado',
      adjunto: f.adjunto || null,
      registro: f
    }));
  const vistos = new Set(manuales.map((g) => `${normNum(g.numero)}|${g.base}`));
  const deSubcontrata = subDocs
    .filter((d) => d && d.kind === 'factura' && d.is_active !== false && String(d.obra_id) === String(obraId))
    .filter((d) => !(d.numero && vistos.has(`${normNum(d.numero)}|${r2(d.base_amount)}`)))
    .map((d) => ({
      id: `sub-${d.id}`,
      origen: 'subcontrata',
      categoria: 'Subcontratas',
      proveedor: d.subcontractor_name || 'Subcontrata',
      numero: d.numero || '',
      concepto: d.notes || 'Factura de subcontrata (Avance de obra)',
      fecha: d.fecha || String(d.created_at || '').slice(0, 10),
      base: r2(d.base_amount),
      total: r2(d.total_amount ?? Number(d.base_amount || 0) * (1 + Number(d.iva_pct ?? 21) / 100)),
      pagado: false,
      adjunto: d.file_path ? { docId: d.id, name: d.file_name } : null,
      registro: d
    }));
  return [...manuales, ...deSubcontrata].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

/** Facturas emitidas vigentes de la obra (base ya rectificada), de más reciente a más antigua. */
export function ingresosObra(obraId, facturas = []) {
  const validas = facturas.filter((f) => f && f.status !== 'borrador');
  const { bases } = basesVigentes(validas);
  return validas
    .filter((f) => f.obraId === obraId && bases.has(f.id))
    .map((f) => {
      const base = r2(bases.get(f.id));
      const rectificada = base !== r2(f.baseImponible);
      const totalOriginal = Number(f.totalFactura ?? f.importeTotal ?? 0);
      // Si una rectificativa cambió la base, el total se ajusta en la misma proporción.
      const total = rectificada && Number(f.baseImponible) ? r2(totalOriginal * base / Number(f.baseImponible)) : r2(totalOriginal);
      return {
        id: f.id,
        numero: f.numero || '',
        concepto: f.tipoFactura || f.obraTitulo || 'Factura',
        fecha: f.fechaEmision || '',
        base,
        total,
        cobrada: f.estadoCobro === 'cobrada',
        estadoCobro: f.estadoCobro || 'pendiente',
        rectificada,
        registro: f
      };
    })
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

/** Resumen gastos frente a ingresos de la obra. */
export function resumenObra({ obra, presupuestos = [], facturas = [], facturasProveedores = [], subDocs = [] }) {
  const gastos = gastosObra(obra?.id, facturasProveedores, subDocs);
  const ingresos = ingresosObra(obra?.id, facturas);
  const gastosBase = r2(gastos.reduce((s, g) => s + g.base, 0));
  const ingresosBase = r2(ingresos.reduce((s, i) => s + i.base, 0));
  const resultado = r2(ingresosBase - gastosBase);
  const porCategoria = CATEGORIAS_GASTO
    .map((c) => {
      const items = gastos.filter((g) => g.categoria === c.id);
      return { ...c, base: r2(items.reduce((s, g) => s + g.base, 0)), count: items.length };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.base - a.base);
  const contratado = facturacionObra(obra, presupuestos, facturas);
  return {
    gastos,
    ingresos,
    gastosBase,
    ingresosBase,
    resultado,
    margenPct: ingresosBase > 0 ? Math.round((resultado / ingresosBase) * 1000) / 10 : null,
    cobrado: r2(ingresos.filter((i) => i.cobrada).reduce((s, i) => s + i.total, 0)),
    pendienteCobro: r2(ingresos.filter((i) => !i.cobrada).reduce((s, i) => s + i.total, 0)),
    pagado: r2(gastos.filter((g) => g.pagado).reduce((s, g) => s + g.total, 0)),
    pendientePago: r2(gastos.filter((g) => !g.pagado).reduce((s, g) => s + g.total, 0)),
    porCategoria,
    // Lo firmado con el cliente (presupuestos de la obra), para ver el resultado previsto.
    contratadoBase: contratado.total,
    pendienteFacturar: contratado.pendiente,
    resultadoPrevisto: contratado.total > 0 ? r2(contratado.total - gastosBase) : null
  };
}
