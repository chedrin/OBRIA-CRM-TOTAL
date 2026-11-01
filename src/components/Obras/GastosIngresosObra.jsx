import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Plus, Upload, ExternalLink, Trash2, Edit2, TrendingUp, TrendingDown, Receipt, Download, Loader2, CheckCircle2, Clock, FileText, AlertTriangle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNotifications } from '../../context/NotificationsContext';
import { api, fmtDate, fmtMoney, inputCls, btnPrimary, btnGhost } from '../../services/avisosApi';
import ModalOverlay from '../Common/ModalOverlay';
import CampoProveedor from '../Common/CampoProveedor';
import { CATEGORIAS_GASTO, labelCategoria, importesGasto, resumenObra } from '../../utils/gastosIngresosObra';
import { obraIdsPedido, pedidoPendienteDePrecio } from '../../utils/gastoPedido';
import { alquileresPendientesDePrecio } from '../../utils/flota';

// Gastos ejecutados de la obra (facturas de material, proveedores, subcontratas, licencias,
// combustible...), ingresos (facturas emitidas al cliente) y la comparación, sin IVA.
// Cálculo en utils/gastosIngresosObra.js; justificantes en backend/gastosObraRoutes.js.

const CAT_COLOR = {
  Materiales: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Proveedores: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Subcontratas: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  'Mano de obra': 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  Maquinaria: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  Licencias: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  Combustible: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  Transporte: 'bg-lime-500/15 text-lime-300 border-lime-500/30',
  Suministros: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  Otros: 'bg-slate-500/15 text-slate-300 border-slate-500/30'
};

const hoy = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({
  id: null, categoria: 'Materiales', proveedor: '', cif: '', numero: '', fecha: hoy(), concepto: '',
  base: '', ivaPct: '21', retencionPct: '0', pagado: false, file: null, adjunto: null
});

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csvNum = (n) => Number(n || 0).toFixed(2).replace('.', ',');

function CategoriaBadge({ id }) {
  return (
    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${CAT_COLOR[id] || CAT_COLOR.Otros}`}>
      {labelCategoria(id)}
    </span>
  );
}

function Tarjeta({ titulo, valor, detalle, tono = 'neutro' }) {
  const tonos = {
    neutro: 'bg-slate-900 border-slate-800',
    ingreso: 'bg-emerald-500/5 border-emerald-500/25',
    gasto: 'bg-rose-500/5 border-rose-500/25',
    bueno: 'bg-emerald-500/10 border-emerald-500/40',
    malo: 'bg-rose-500/10 border-rose-500/40'
  };
  const color = { ingreso: 'text-emerald-300', gasto: 'text-rose-300', bueno: 'text-emerald-300', malo: 'text-rose-300' }[tono] || 'text-white';
  return (
    <div className={`rounded-2xl border p-4 ${tonos[tono]}`}>
      <span className="block text-[11px] font-semibold text-slate-400">{titulo}</span>
      <span className={`block text-xl sm:text-2xl font-black tabular-nums ${color}`}>{valor}</span>
      {detalle && <span className="block text-[11px] text-slate-400 mt-0.5">{detalle}</span>}
    </div>
  );
}

export default function GastosIngresosObra({ obra }) {
  const {
    facturas = [], facturasProveedores = [], presupuestos = [],
    addFacturaProveedor, updateFacturaProveedor, deleteFacturaProveedor,
    setPdfModalData, setActiveTab, showNotification
  } = useApp();

  const [subDocs, setSubDocs] = useState([]);
  const [flotaCostes, setFlotaCostes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const { setTarget } = useNotifications();
  const [filtro, setFiltro] = useState('todas');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Facturas de subcontrata subidas en Avance de obra (si el servidor y la tabla están disponibles).
  useEffect(() => {
    let vivo = true;
    api(`/api/avance/obras/${encodeURIComponent(obra.id)}`)
      .then((data) => { if (vivo) setSubDocs(data?.docs || []); })
      .catch(() => { if (vivo) setSubDocs([]); });
    return () => { vivo = false; };
  }, [obra.id]);

  // Gasoil, taller y alquileres imputados a la obra en Inventario y flota.
  useEffect(() => {
    let vivo = true;
    api(`/api/flota/costes?obra=${encodeURIComponent(obra.id)}`)
      .then((data) => { if (vivo) setFlotaCostes(Array.isArray(data) ? data : []); })
      .catch(() => { if (vivo) setFlotaCostes([]); });
    return () => { vivo = false; };
  }, [obra.id]);

  // Pedidos a proveedor de la obra (para avisar de los entregados sin precio).
  useEffect(() => {
    let vivo = true;
    api('/api/material-orders')
      .then((list) => { if (vivo) setPedidos((list || []).filter((o) => obraIdsPedido(o).includes(obra.id))); })
      .catch(() => { if (vivo) setPedidos([]); });
    return () => { vivo = false; };
  }, [obra.id]);

  const pedidosSinPrecio = pedidos.filter((o) => pedidoPendienteDePrecio(o, facturasProveedores));
  const alquileresSinPrecio = alquileresPendientesDePrecio(obra.id, flotaCostes);

  const r = useMemo(
    () => resumenObra({ obra, presupuestos, facturas, facturasProveedores, subDocs, flotaCostes }),
    [obra, presupuestos, facturas, facturasProveedores, subDocs, flotaCostes]
  );
  const gastosVisibles = filtro === 'todas' ? r.gastos : r.gastos.filter((g) => g.categoria === filtro);
  const maxBarra = Math.max(r.ingresosBase, r.gastosBase, 1);

  const avisar = (msg, tipo) => (showNotification ? showNotification(msg, tipo) : window.alert(msg));

  const abrirNuevo = () => { setError(''); setForm(emptyForm()); };
  const abrirEditar = (g) => {
    const f = g.registro;
    setError('');
    setForm({
      id: f.id,
      categoria: g.categoria,
      proveedor: f.proveedor || '',
      cif: f.cif || '',
      numero: f.numeroProveedor || f.numero || '',
      fecha: f.fecha || hoy(),
      concepto: f.concepto || '',
      base: String(f.baseImponible ?? ''),
      ivaPct: String(f.tipoIvaPct ?? 21),
      retencionPct: String(f.retencionIrpfPct ?? 0),
      pagado: g.pagado,
      file: null,
      adjunto: f.adjunto || null
    });
  };

  const subirAdjunto = async (file) => {
    const fd = new FormData();
    fd.append('obra_id', obra.id);
    fd.append('archivo', file, file.name);
    const res = await fetch('/api/obras/gastos/adjunto', { method: 'POST', body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || `Error ${res.status} al subir el archivo`);
    return data;
  };

  const borrarAdjunto = (adjunto) => {
    if (!adjunto?.path) return;
    api(`/api/obras/gastos/adjunto?path=${encodeURIComponent(adjunto.path)}`, { method: 'DELETE' }).catch(() => {});
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.proveedor.trim()) { setError('Indica el proveedor o a quién se paga.'); return; }
    const base = Number(String(form.base).replace(',', '.'));
    if (!form.base || !Number.isFinite(base) || base < 0) { setError('Pon el importe sin IVA (base imponible).'); return; }
    setBusy(true);
    setError('');
    try {
      let adjunto = form.adjunto;
      if (form.file) {
        adjunto = await subirAdjunto(form.file);
        if (form.adjunto) borrarAdjunto(form.adjunto);
      }
      const imp = importesGasto({ base, ivaPct: form.ivaPct, retencionPct: form.retencionPct });
      const datos = {
        obraId: obra.id,
        obraTitulo: obra.titulo,
        categoria: form.categoria,
        proveedor: form.proveedor.trim(),
        cif: form.cif.trim(),
        numeroProveedor: form.numero.trim(),
        concepto: form.concepto.trim(),
        fecha: form.fecha || hoy(),
        baseImponible: imp.baseImponible,
        tipoIvaPct: Number(form.ivaPct),
        cuotaIva: imp.cuotaIva,
        retencionIrpfPct: Number(form.retencionPct),
        cuotaRetencion: imp.cuotaRetencion,
        total: imp.total,
        totalFactura: imp.total,
        estadoPago: form.pagado ? 'pagada' : 'pendiente',
        adjunto
      };
      if (form.id) {
        updateFacturaProveedor(form.id, datos);
        avisar('Gasto actualizado');
      } else {
        addFacturaProveedor(datos, { silent: true });
        avisar('Gasto añadido a la obra y al libro de facturas recibidas');
      }
      setForm(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const quitar = (g) => {
    if (!window.confirm(`¿Quitar el gasto de ${g.proveedor}${g.numero ? ` (${g.numero})` : ''}? También sale del libro de facturas recibidas.`)) return;
    deleteFacturaProveedor(g.id);
    borrarAdjunto(g.adjunto);
  };

  const abrirAdjunto = async (g) => {
    try {
      const { url } = g.origen === 'subcontrata'
        ? await api(`/api/avance/docs/${g.adjunto.docId}/file`)
        : g.origen === 'flota'
        ? await api(`/api/flota/archivo?path=${encodeURIComponent(g.adjunto.flotaPath)}`)
        : await api(`/api/obras/gastos/adjunto?path=${encodeURIComponent(g.adjunto.path)}`);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      avisar(err.message, 'error');
    }
  };

  const descargarCsv = () => {
    const filas = [
      `Obra;${csvCell(`${obra.codigo ? `${obra.codigo} · ` : ''}${obra.titulo}`)}`,
      '',
      'GASTOS',
      'Fecha;Categoría;Proveedor;Nº factura;Concepto;Base (sin IVA);Total;Pagado',
      ...r.gastos.map((g) => [g.fecha, labelCategoria(g.categoria), csvCell(g.proveedor), csvCell(g.numero), csvCell(g.concepto), csvNum(g.base), csvNum(g.total), g.pagado ? 'Sí' : 'No'].join(';')),
      '',
      'INGRESOS',
      'Fecha;Nº factura;Concepto;Base (sin IVA);Total;Cobrada',
      ...r.ingresos.map((i) => [i.fecha, csvCell(i.numero), csvCell(i.concepto), csvNum(i.base), csvNum(i.total), i.cobrada ? 'Sí' : 'No'].join(';')),
      '',
      `Total ingresos (sin IVA);${csvNum(r.ingresosBase)}`,
      `Total gastos (sin IVA);${csvNum(r.gastosBase)}`,
      `Resultado;${csvNum(r.resultado)}`
    ];
    const blob = new Blob([`﻿${filas.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gastos-ingresos-${(obra.codigo || obra.id).replace(/[^A-Za-z0-9_-]/g, '_')}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const positivo = r.resultado >= 0;
  const impPreview = form ? importesGasto({ base: form.base || 0, ivaPct: form.ivaPct, retencionPct: form.retencionPct }) : null;

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tarjeta titulo="Ingresos (facturado sin IVA)" valor={fmtMoney(r.ingresosBase)} tono="ingreso"
          detalle={`${r.ingresos.length} factura(s) · cobrado ${fmtMoney(r.cobrado)}`} />
        <Tarjeta titulo="Gastos ejecutados (sin IVA)" valor={fmtMoney(r.gastosBase)} tono="gasto"
          detalle={`${r.gastos.length} gasto(s) · pagado ${fmtMoney(r.pagado)}`} />
        <Tarjeta titulo={positivo ? 'Beneficio' : 'Pérdida'} valor={fmtMoney(r.resultado)} tono={positivo ? 'bueno' : 'malo'}
          detalle={r.margenPct != null ? `Margen ${String(r.margenPct).replace('.', ',')} % sobre lo facturado` : 'Sin facturas emitidas todavía'} />
      </div>

      {(pedidosSinPrecio.length > 0 || alquileresSinPrecio.length > 0) && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-100 space-y-2">
          <p className="font-bold flex items-center gap-2 text-amber-200">
            <AlertTriangle className="w-4 h-4" /> Pendiente de precio: no cuenta en los gastos hasta que pongas el precio o la factura del proveedor
          </p>
          <ul className="space-y-1">
            {pedidosSinPrecio.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2">
                <span className="flex-1 min-w-0 truncate">Material entregado{o.delivery_date ? ` el ${fmtDate(o.delivery_date)}` : ''}: {(o.items || []).map((it) => it.material).filter(Boolean).join(', ') || o.subject}</span>
                <button type="button" onClick={() => { setTarget?.({ section: 'pedidos', id: o.id }); setActiveTab?.('avisos'); }} className="underline font-semibold">Poner precio</button>
              </li>
            ))}
            {alquileresSinPrecio.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <span className="flex-1 min-w-0 truncate">{c.concepto} · {c.proveedor}</span>
                <button type="button" onClick={() => setActiveTab?.('alquileres')} className="underline font-semibold">Poner precio</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-white text-sm">Gastos frente a ingresos</h3>
          <button type="button" onClick={descargarCsv} className={`${btnGhost} !py-1 !text-xs`}><Download className="w-3.5 h-3.5" /> Exportar CSV</button>
        </div>
        {[['Ingresos', r.ingresosBase, 'bg-emerald-500'], ['Gastos', r.gastosBase, 'bg-rose-500']].map(([label, v, color]) => (
          <div key={label} className="flex items-center gap-3 text-xs">
            <span className="w-16 text-slate-400 shrink-0">{label}</span>
            <div className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${(v / maxBarra) * 100}%` }} />
            </div>
            <span className="w-28 text-right font-bold text-white tabular-nums shrink-0">{fmtMoney(v)}</span>
          </div>
        ))}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-2"><span className="block text-slate-400">Pendiente de cobro</span><span className="font-bold text-white tabular-nums">{fmtMoney(r.pendienteCobro)}</span></div>
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-2"><span className="block text-slate-400">Pendiente de pago</span><span className="font-bold text-white tabular-nums">{fmtMoney(r.pendientePago)}</span></div>
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-2"><span className="block text-slate-400">Contratado (presupuesto)</span><span className="font-bold text-white tabular-nums">{r.contratadoBase ? fmtMoney(r.contratadoBase) : '—'}</span></div>
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-2">
            <span className="block text-slate-400">Resultado previsto</span>
            <span className={`font-bold tabular-nums ${r.resultadoPrevisto == null ? 'text-white' : r.resultadoPrevisto >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{r.resultadoPrevisto == null ? '—' : fmtMoney(r.resultadoPrevisto)}</span>
            {r.resultadoPrevisto != null && <span className="block text-slate-500">contratado − gastos</span>}
          </div>
        </div>
        {r.porCategoria.length > 0 && (
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-400">Gastos por tipo</p>
            {r.porCategoria.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <span className="w-40 sm:w-48 shrink-0 truncate text-slate-300">{c.label}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-rose-400/80" style={{ width: `${(c.base / Math.max(r.gastosBase, 1)) * 100}%` }} />
                </div>
                <span className="w-24 text-right tabular-nums text-white shrink-0">{fmtMoney(c.base)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Gastos */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-400" />
              <h3 className="font-bold text-white text-sm">Gastos ejecutados ({r.gastos.length})</h3>
            </div>
            <button type="button" onClick={abrirNuevo} className={`${btnPrimary} !py-1.5 !text-xs`}><Plus className="w-3.5 h-3.5" /> Añadir gasto</button>
          </div>
          {r.porCategoria.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {[{ id: 'todas', label: 'Todos' }, ...r.porCategoria].map((c) => (
                <button key={c.id} type="button" onClick={() => setFiltro(c.id)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold border transition ${filtro === c.id ? 'border-amber-400 text-amber-300 bg-amber-400/10' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          )}
          {gastosVisibles.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              Todavía no hay gastos en esta obra. Añade las facturas de material, proveedores, subcontratas, licencias, gasolina, etc.
            </p>
          ) : (
            <ul className="space-y-2">
              {gastosVisibles.map((g) => (
                <li key={g.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <CategoriaBadge id={g.categoria} />
                      <span className="font-semibold text-white truncate">{g.proveedor}</span>
                      {g.numero && <span className="font-mono text-slate-400">{g.numero}</span>}
                      {g.origen === 'subcontrata' && <span className="text-[10px] text-violet-300">· desde Avance de obra</span>}
                      {g.registro?.pedidoId && <span className="text-[10px] text-amber-300">· pedido a proveedor</span>}
                      {g.origen === 'flota' && (
                        <button type="button" onClick={() => setActiveTab?.(g.registro.origen === 'alquiler' ? 'alquileres' : 'flota')} className="text-[10px] text-sky-300 hover:underline">
                          · desde {g.registro.origen === 'alquiler' ? 'Alquileres' : 'Flota'}{g.registro.origen === 'alquiler' && /en curso/.test(g.concepto) ? ' (hasta hoy)' : ''}
                        </button>
                      )}
                    </div>
                    <p className="text-slate-400 mt-0.5 truncate">{g.fecha ? fmtDate(g.fecha) : 'Sin fecha'}{g.concepto ? ` · ${g.concepto}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div className="text-right tabular-nums">
                      <span className="block font-bold text-rose-300">{fmtMoney(g.base)}</span>
                      <span className="block text-[10px] text-slate-500">{fmtMoney(g.total)} total</span>
                    </div>
                    {g.origen === 'gasto' ? (
                      <button type="button" onClick={() => updateFacturaProveedor(g.id, { estadoPago: g.pagado ? 'pendiente' : 'pagada' })}
                        title={g.pagado ? 'Pagada (pulsa para marcar pendiente)' : 'Pendiente de pago (pulsa para marcar pagada)'}
                        className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-bold ${g.pagado ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
                        {g.pagado ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />} {g.pagado ? 'Pagada' : 'Pendiente'}
                      </button>
                    ) : null}
                    {g.adjunto && (
                      <button type="button" onClick={() => abrirAdjunto(g)} className="text-slate-400 hover:text-amber-400" title={g.adjunto.name || 'Ver factura'} aria-label="Ver factura">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}
                    {g.origen === 'gasto' && (
                      <>
                        <button type="button" onClick={() => abrirEditar(g)} className="text-slate-400 hover:text-white" aria-label="Editar gasto"><Edit2 className="w-4 h-4" /></button>
                        <button type="button" onClick={() => quitar(g)} className="text-slate-500 hover:text-rose-400" aria-label="Quitar gasto"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Ingresos */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-white text-sm">Ingresos: facturas al cliente ({r.ingresos.length})</h3>
            </div>
            <button type="button" onClick={() => setActiveTab('facturas')} className={`${btnGhost} !py-1.5 !text-xs`}><Receipt className="w-3.5 h-3.5" /> Facturación</button>
          </div>
          {r.ingresos.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Aún no se ha emitido ninguna factura de esta obra.</p>
          ) : (
            <ul className="space-y-2">
              {r.ingresos.map((i) => (
                <li key={i.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono font-bold text-amber-400">{i.numero}</span>
                      <span className="text-slate-300 truncate">{i.concepto}</span>
                      {i.rectificada && <span className="text-[10px] text-sky-300">· rectificada</span>}
                    </div>
                    <p className="text-slate-400 mt-0.5">{i.fecha ? fmtDate(i.fecha) : 'Sin fecha'}</p>
                  </div>
                  <div className="text-right tabular-nums shrink-0">
                    <span className="block font-bold text-emerald-300">{fmtMoney(i.base)}</span>
                    <span className="block text-[10px] text-slate-500">{fmtMoney(i.total)} total</span>
                  </div>
                  <span className={`shrink-0 rounded-lg border px-1.5 py-0.5 text-[10px] font-bold ${i.cobrada ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
                    {i.cobrada ? 'Cobrada' : 'Pendiente'}
                  </span>
                  <button type="button" onClick={() => setPdfModalData({ type: 'factura', data: i.registro })} className="text-slate-400 hover:text-white shrink-0" aria-label="Ver PDF">
                    <FileText className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <AnimatePresence>
        {form && (
          <ModalOverlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-5 shadow-2xl space-y-3">
              <div>
                <h3 className="text-lg font-bold text-white">{form.id ? 'Editar gasto' : 'Nuevo gasto de la obra'}</h3>
                <p className="text-xs text-slate-400">{obra.titulo}. También se apunta en Gestoría (libro de facturas recibidas).</p>
              </div>
              <form onSubmit={guardar} className="space-y-3 text-xs">
                <label className="block text-slate-400">Tipo de gasto
                  <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className={`${inputCls} mt-1`}>
                    {CATEGORIAS_GASTO.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem] gap-2">
                  <label className="block text-slate-400">Proveedor / a quién se paga *
                    <div className="mt-1">
                      <CampoProveedor
                        value={form.proveedor}
                        onChange={(v) => setForm((f) => ({ ...f, proveedor: v }))}
                        onElegir={({ proveedor, cif, origen }) => setForm((f) => ({
                          ...f,
                          proveedor,
                          cif: cif || f.cif,
                          categoria: origen === 'subcontrata' ? 'Subcontratas' : f.categoria
                        }))}
                        className={inputCls}
                        placeholder="Ej: Almacén de materiales, gasolinera, Ayuntamiento"
                      />
                    </div>
                  </label>
                  <label className="block text-slate-400">CIF/NIF
                    <input value={form.cif} onChange={(e) => setForm({ ...form, cif: e.target.value })} className={`${inputCls} mt-1`} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-slate-400">Nº factura o ticket
                    <input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className={`${inputCls} mt-1`} />
                  </label>
                  <label className="block text-slate-400">Fecha
                    <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={`${inputCls} mt-1`} />
                  </label>
                </div>
                <label className="block text-slate-400">Concepto
                  <input value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} className={`${inputCls} mt-1`} placeholder="Ej: 20 sacos de cemento, licencia de obra menor, gasoil furgoneta" />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="block text-slate-400">Importe sin IVA (€) *
                    <input inputMode="decimal" value={form.base} onChange={(e) => setForm({ ...form, base: e.target.value })} className={`${inputCls} mt-1 font-mono`} placeholder="0,00" />
                  </label>
                  <label className="block text-slate-400">IVA
                    <select value={form.ivaPct} onChange={(e) => setForm({ ...form, ivaPct: e.target.value })} className={`${inputCls} mt-1`}>
                      {['21', '10', '4', '0'].map((v) => <option key={v} value={v}>{v} %</option>)}
                    </select>
                  </label>
                  <label className="block text-slate-400">Retención IRPF
                    <select value={form.retencionPct} onChange={(e) => setForm({ ...form, retencionPct: e.target.value })} className={`${inputCls} mt-1`}>
                      {['0', '1', '7', '15', '19'].map((v) => <option key={v} value={v}>{v} %</option>)}
                    </select>
                  </label>
                </div>
                <p className="text-slate-400 tabular-nums">Total factura: <strong className="text-white">{fmtMoney(impPreview.total)}</strong> (IVA {fmtMoney(impPreview.cuotaIva)}{impPreview.cuotaRetencion ? ` · retención −${fmtMoney(impPreview.cuotaRetencion)}` : ''})</p>
                <label className="flex items-center gap-2 text-slate-300">
                  <input type="checkbox" checked={form.pagado} onChange={(e) => setForm({ ...form, pagado: e.target.checked })} className="accent-amber-500" />
                  Ya está pagada
                </label>
                <label className={`${btnGhost} !py-1.5 !text-xs w-full cursor-pointer`}>
                  <Upload className="w-3.5 h-3.5" />
                  {form.file ? form.file.name : form.adjunto ? `Sustituir factura adjunta (${form.adjunto.name || 'archivo'})` : 'Adjuntar factura: PDF o foto (opcional)'}
                  <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} />
                </label>
                {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-300">{error}</p>}
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button type="button" onClick={() => setForm(null)} className={btnGhost}>Cancelar</button>
                  <button type="submit" disabled={busy} className={btnPrimary}>
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />} {form.id ? 'Guardar cambios' : 'Añadir gasto'}
                  </button>
                </div>
              </form>
            </div>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </div>
  );
}
