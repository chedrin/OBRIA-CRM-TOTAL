import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { CalendarClock, Plus, Undo2, Repeat, Edit2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, fmtDate, fmtMoney, inputCls, btnPrimary, btnGhost } from '../../services/avisosApi';
import { TIPOS_ACTIVO, PERIODOS_TARIFA, costeAlquiler, costePrevistoAlquiler, labelDe } from '../../utils/flota';
import { useFlota, Cabecera, Cargando, SinMigracion, EstadoAlerta, Vacio, Modal, Campo, Rejilla, useFormulario, CampoArchivo, subirArchivo, SelectObra, SelectProveedor, BotonArchivo, num, hoy } from './flotaShared';
import FichaActivo from './FichaActivo';

const diasHasta = (f) => Math.round((Date.parse(`${f}T12:00:00Z`) - Date.parse(`${hoy()}T12:00:00Z`)) / 86400000);

/** Alquileres de maquinaria, herramientas y vehículos: fin de alquiler, coste e imputación a obra. */
export default function AlquileresView() {
  const { obras = [] } = useApp() || {};
  const { data, error, loading, reload } = useFlota();
  const [vista, setVista] = useState('activos');
  const [modal, setModal] = useState(null);
  const [ficha, setFicha] = useState(null);

  const activosPorId = useMemo(() => new Map((data?.activos || []).map((a) => [a.id, a])), [data]);
  const alertaDe = (r) => (data?.alertas || []).find((a) => a.rental_id === r.id);
  const lista = useMemo(() => (data?.alquileres || [])
    .filter((r) => (vista === 'activos' ? r.estado === 'activo' : r.estado !== 'activo'))
    .sort((a, b) => vista === 'activos' ? a.fecha_prevista_devolucion.localeCompare(b.fecha_prevista_devolucion) : String(b.fecha_devolucion).localeCompare(String(a.fecha_devolucion))), [data, vista]);

  const enCurso = (data?.alquileres || []).filter((r) => r.estado === 'activo');
  const costeCurso = enCurso.reduce((s, r) => s + costeAlquiler(r).base, 0);
  const obraNombre = (id) => obras.find((o) => o.id === id)?.titulo || '';

  if (loading && !data) return <Cargando />;
  if (error || data?.listo === false) return <><Cabecera icon={CalendarClock} titulo="Alquileres" tono="text-orange-400" /><SinMigracion error={error} /></>;

  return (
    <div>
      <Cabecera icon={CalendarClock} titulo="Alquileres" tono="text-orange-400" subtitulo="Maquinaria, herramientas y vehículos alquilados: devoluciones, coste e imputación a cada obra.">
        <button type="button" onClick={() => setModal({ t: 'nuevo' })} className={btnPrimary}><Plus className="w-4 h-4" /> Nuevo alquiler</button>
      </Cabecera>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3"><span className="block text-[11px] text-slate-400 font-semibold">En curso</span><span className="text-xl font-black text-white">{enCurso.length}</span></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3"><span className="block text-[11px] text-slate-400 font-semibold">A devolver en 7 días</span><span className="text-xl font-black text-amber-300">{enCurso.filter((r) => diasHasta(r.fecha_prevista_devolucion) <= 7).length}</span></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3 col-span-2 sm:col-span-1"><span className="block text-[11px] text-slate-400 font-semibold">Coste acumulado en curso (sin IVA)</span><span className="text-xl font-black text-white tabular-nums">{fmtMoney(costeCurso)}</span></div>
      </div>

      <div className="flex gap-2 mb-3">
        {[['activos', 'En curso'], ['cerrados', 'Devueltos y sustituidos']].map(([id, l]) => (
          <button key={id} type="button" onClick={() => setVista(id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${vista === id ? 'bg-amber-500 text-slate-950 border-amber-500' : 'border-slate-700 text-slate-300'}`}>{l}</button>
        ))}
      </div>

      {lista.length === 0 ? <Vacio>{vista === 'activos' ? 'No hay alquileres en curso.' : 'Aún no hay alquileres cerrados.'}</Vacio> : (
        <div className="space-y-2">
          {lista.map((r) => {
            const a = activosPorId.get(r.asset_id);
            const c = costeAlquiler(r);
            const al = alertaDe(r);
            return (
              <div key={r.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 flex flex-col md:flex-row md:items-center gap-3">
                <button type="button" onClick={() => a && setFicha(a.id)} className="flex-1 min-w-0 text-left">
                  <p className="text-white font-bold flex items-center gap-2 flex-wrap">
                    {a?.nombre || 'Elemento'} <span className="text-xs font-mono text-amber-300">{a?.codigo_interno}</span>
                    {al && <EstadoAlerta estado={al.estado}>{diasHasta(r.fecha_prevista_devolucion) < 0 ? `Devolución atrasada ${-diasHasta(r.fecha_prevista_devolucion)} d` : diasHasta(r.fecha_prevista_devolucion) === 0 ? 'Se devuelve hoy' : `Quedan ${diasHasta(r.fecha_prevista_devolucion)} d`}</EstadoAlerta>}
                    {r.sustituye_a_rental_id && <span className="text-[10px] text-sky-300 border border-sky-500/30 rounded-md px-1.5 py-0.5">Sustitución</span>}
                    {r.estado === 'sustituido' && <span className="text-[10px] text-slate-400 border border-slate-600 rounded-md px-1.5 py-0.5">Sustituido</span>}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {r.arrendador || 'Arrendadora'}{r.numero_contrato ? ` · contrato ${r.numero_contrato}` : ''} · {labelDe(TIPOS_ACTIVO, a?.tipo)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {fmtDate(r.fecha_inicio)} → {fmtDate(r.fecha_devolucion || r.fecha_prevista_devolucion)}{!r.fecha_devolucion ? ' (prevista)' : ''}
                    {r.obra_id ? <> · Obra: <span className="text-slate-200">{obraNombre(r.obra_id) || r.obra_id}</span></> : ' · Sin obra'}
                  </p>
                  {r.motivo_sustitucion && <p className="text-[11px] text-slate-500">Motivo: {r.motivo_sustitucion}</p>}
                </button>
                <div className="md:text-right shrink-0">
                  <p className="text-lg font-black text-white tabular-nums">{fmtMoney(c.base)}</p>
                  <p className="text-[11px] text-slate-500">
                    {c.estimado ? `${c.dias} días hasta hoy · ` : ''}{fmtMoney(r.tarifa)} {labelDe(PERIODOS_TARIFA, r.tarifa_periodo)}{Number(r.transporte) ? ` + ${fmtMoney(r.transporte)} portes` : ''}
                  </p>
                  {r.estado === 'activo' && <p className="text-[11px] text-slate-500">Previsto total: {fmtMoney(costePrevistoAlquiler(r).base)}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <BotonArchivo path={r.contrato_path} label="Contrato" />
                  {r.estado === 'activo' && <>
                    <button type="button" onClick={() => setModal({ t: 'devolver', r })} className={`${btnGhost} !py-1.5 text-xs`}><Undo2 className="w-4 h-4" /> Devolver</button>
                    <button type="button" onClick={() => setModal({ t: 'sustituir', r, a })} className={`${btnGhost} !py-1.5 text-xs`}><Repeat className="w-4 h-4" /> Sustituir</button>
                  </>}
                  <button type="button" onClick={() => setModal({ t: 'editar', r })} className={`${btnGhost} !py-1.5 text-xs`} aria-label="Editar"><Edit2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {(modal?.t === 'nuevo' || modal?.t === 'editar') && <AlquilerForm key="form" alquiler={modal.r} datos={data} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
        {modal?.t === 'devolver' && <DevolverModal key="dev" alquiler={modal.r} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
        {modal?.t === 'sustituir' && <SustituirAlquilerModal key="sus" alquiler={modal.r} activo={modal.a} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
        {ficha && <FichaActivo key={ficha} activoId={ficha} datos={data} onClose={() => setFicha(null)} onChanged={reload} />}
      </AnimatePresence>
    </div>
  );
}

function AlquilerForm({ alquiler, datos, onClose, onSaved }) {
  const { showNotification } = useApp() || {};
  const nuevo = !alquiler;
  const propios = (datos?.activos || []).filter((a) => a.tipo_adquisicion !== 'propiedad' && !['baja'].includes(a.estado) && !(datos?.alquileres || []).some((r) => r.asset_id === a.id && r.estado === 'activo'));
  const { form, set, setForm, busy, error, enviar } = useFormulario({
    que: 'nuevo', asset_id: '', nombre: '', tipo: 'maquinaria_ligera', marca: '', modelo: '', numero_serie: '',
    supplier_id: '', arrendador_nombre: '', obra_id: '', numero_contrato: '', fecha_inicio: hoy(), fecha_prevista_devolucion: '',
    tarifa: '', tarifa_periodo: 'dia', transporte: '', fianza: '', iva_pct: '21', importe_final: '', numero_factura: '', notas: '', archivo: null,
    ...(alquiler ? Object.fromEntries(Object.entries(alquiler).map(([k, v]) => [k, v ?? ''])) : {})
  });
  const previsto = form.fecha_prevista_devolucion && form.fecha_inicio && num(form.tarifa) !== null
    ? costePrevistoAlquiler({ ...form, tarifa: num(form.tarifa), transporte: num(form.transporte) || 0 }).base : null;

  const guardar = enviar(async () => {
    const contrato = form.archivo ? await subirArchivo(form.archivo, 'alquileres') : null;
    const body = {
      supplier_id: form.supplier_id || null, arrendador_nombre: form.arrendador_nombre, obra_id: form.obra_id || null, numero_contrato: form.numero_contrato,
      fecha_inicio: form.fecha_inicio, fecha_prevista_devolucion: form.fecha_prevista_devolucion, tarifa: num(form.tarifa) ?? 0, tarifa_periodo: form.tarifa_periodo,
      transporte: num(form.transporte) ?? 0, fianza: num(form.fianza) ?? 0, iva_pct: num(form.iva_pct) ?? 21, notas: form.notas,
      ...(contrato ? { contrato_path: contrato.path } : {})
    };
    if (nuevo) {
      if (form.que === 'nuevo') {
        if (!form.nombre.trim()) throw new Error('¿Qué se alquila? Pon el nombre.');
        body.nuevo = { nombre: form.nombre, tipo: form.tipo, marca: form.marca, modelo: form.modelo, numero_serie: form.numero_serie };
      } else {
        if (!form.asset_id) throw new Error('Elige el elemento.');
        body.asset_id = form.asset_id;
      }
      await api('/api/flota/alquileres', { method: 'POST', body });
      showNotification?.('Alquiler registrado');
    } else {
      body.importe_final = num(form.importe_final);
      body.numero_factura = form.numero_factura;
      await api(`/api/flota/alquileres/${alquiler.id}`, { method: 'PATCH', body });
      showNotification?.('Alquiler actualizado');
    }
    onSaved();
  });

  return (
    <Modal titulo={nuevo ? 'Nuevo alquiler' : 'Editar alquiler'} icon={CalendarClock} onClose={onClose} onSubmit={guardar} busy={busy} error={error}>
      {nuevo && (
        <>
          <div className="flex gap-2">
            {[['nuevo', 'Algo nuevo'], ['existente', 'Ya está en el inventario']].map(([id, l]) => (
              <button key={id} type="button" onClick={() => set('que')(id)} disabled={id === 'existente' && !propios.length}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border disabled:opacity-40 ${form.que === id ? 'bg-amber-500 text-slate-950 border-amber-500' : 'border-slate-700 text-slate-300'}`}>{l}</button>
            ))}
          </div>
          <Rejilla>
            {form.que === 'nuevo' ? (
              <>
                <Campo label="Qué se alquila *" full><input autoFocus value={form.nombre} onChange={set('nombre')} placeholder="Miniexcavadora 1,8 t, andamio, plataforma…" className={inputCls} /></Campo>
                <Campo label="Tipo">
                  <select value={form.tipo} onChange={set('tipo')} className={inputCls}>
                    {TIPOS_ACTIVO.filter((t) => !['vehiculo', 'consumible'].includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </Campo>
                <Campo label="Nº de serie / matrícula"><input value={form.numero_serie} onChange={set('numero_serie')} className={inputCls} /></Campo>
              </>
            ) : (
              <Campo label="Elemento *" full>
                <select value={form.asset_id} onChange={set('asset_id')} className={inputCls}>
                  <option value="">Elige</option>
                  {propios.map((a) => <option key={a.id} value={a.id}>{a.codigo_interno} · {a.nombre}</option>)}
                </select>
              </Campo>
            )}
          </Rejilla>
        </>
      )}
      <Rejilla>
        <Campo label="Empresa de alquiler *">
          <SelectProveedor value={form.supplier_id} proveedores={datos?.proveedores} categoria="alquiler" vacio="Otra (escribir)"
            onChange={(id, nombre) => setForm((f) => ({ ...f, supplier_id: id, arrendador_nombre: id ? nombre : f.arrendador_nombre }))} />
        </Campo>
        {!form.supplier_id && <Campo label="Nombre de la empresa"><input value={form.arrendador_nombre} onChange={set('arrendador_nombre')} className={inputCls} /></Campo>}
        <Campo label="Obra (se le imputa el coste)"><SelectObra value={form.obra_id} onChange={set('obra_id')} /></Campo>
        <Campo label="Nº de contrato o albarán"><input value={form.numero_contrato} onChange={set('numero_contrato')} className={inputCls} /></Campo>
        <Campo label="Entrega *"><input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} className={inputCls} required /></Campo>
        <Campo label="Devolución prevista *" ayuda="Avisa antes de esta fecha"><input type="date" value={form.fecha_prevista_devolucion} onChange={set('fecha_prevista_devolucion')} className={inputCls} required /></Campo>
        <Campo label="Tarifa (sin IVA)">
          <div className="flex gap-2">
            <input type="number" step="0.01" min="0" value={form.tarifa} onChange={set('tarifa')} className={inputCls} />
            <select value={form.tarifa_periodo} onChange={set('tarifa_periodo')} className={`${inputCls} !w-36`}>
              {PERIODOS_TARIFA.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        </Campo>
        <Campo label="Portes (sin IVA)" ayuda={previsto !== null ? `Coste previsto: ${fmtMoney(previsto)} sin IVA` : undefined}><input type="number" step="0.01" min="0" value={form.transporte} onChange={set('transporte')} className={inputCls} /></Campo>
        <Campo label="Fianza"><input type="number" step="0.01" min="0" value={form.fianza} onChange={set('fianza')} className={inputCls} /></Campo>
        {!nuevo && (
          <>
            <Campo label="Importe de la factura (sin IVA)" ayuda="Si lo pones, manda sobre el cálculo"><input type="number" step="0.01" min="0" value={form.importe_final} onChange={set('importe_final')} className={inputCls} /></Campo>
            <Campo label="Nº de factura"><input value={form.numero_factura} onChange={set('numero_factura')} className={inputCls} /></Campo>
          </>
        )}
        <Campo label="Contrato / albarán"><CampoArchivo file={form.archivo} onChange={set('archivo')} actual={alquiler?.contrato_path} /></Campo>
        <Campo label="Notas" full><input value={form.notas} onChange={set('notas')} className={inputCls} /></Campo>
      </Rejilla>
    </Modal>
  );
}

function DevolverModal({ alquiler, onClose, onSaved }) {
  const { showNotification } = useApp() || {};
  const { form, set, busy, error, enviar } = useFormulario({ fecha_devolucion: hoy(), importe_final: '', numero_factura: '' });
  const calculado = costeAlquiler({ ...alquiler, fecha_devolucion: form.fecha_devolucion }).base;
  const guardar = enviar(async () => {
    await api(`/api/flota/alquileres/${alquiler.id}/devolver`, { method: 'POST', body: { ...form, importe_final: num(form.importe_final) } });
    showNotification?.('Alquiler cerrado');
    onSaved();
  });
  return (
    <Modal titulo="Devolver al arrendador" icon={Undo2} ancho="max-w-md" onClose={onClose} onSubmit={guardar} busy={busy} error={error} submitLabel="Cerrar alquiler">
      <Rejilla>
        <Campo label="Fecha de devolución"><input type="date" value={form.fecha_devolucion} onChange={set('fecha_devolucion')} className={inputCls} /></Campo>
        <Campo label="Importe facturado (sin IVA)" ayuda={`Calculado: ${fmtMoney(calculado)}`}><input type="number" step="0.01" min="0" value={form.importe_final} onChange={set('importe_final')} placeholder={String(calculado)} className={inputCls} /></Campo>
        <Campo label="Nº de factura" full><input value={form.numero_factura} onChange={set('numero_factura')} className={inputCls} /></Campo>
      </Rejilla>
      <p className="text-[11px] text-slate-500">El coste queda imputado a la obra y sale en su pestaña Gastos vs ingresos.</p>
    </Modal>
  );
}

function SustituirAlquilerModal({ alquiler, activo, onClose, onSaved }) {
  const { showNotification } = useApp() || {};
  const { form, set, busy, error, enviar } = useFormulario({ nombre: activo?.nombre || '', numero_serie: '', motivo: '', transporte: '' });
  const guardar = enviar(async () => {
    await api(`/api/flota/alquileres/${alquiler.id}/sustituir`, {
      method: 'POST', body: { motivo: form.motivo, transporte: num(form.transporte) ?? 0, nuevo: { nombre: form.nombre, numero_serie: form.numero_serie } }
    });
    showNotification?.('Máquina sustituida');
    onSaved();
  });
  return (
    <Modal titulo="Sustitución por avería del proveedor" icon={Repeat} ancho="max-w-md" onClose={onClose} onSubmit={guardar} busy={busy} error={error} submitLabel="Sustituir">
      <p className="text-xs text-slate-400">El alquiler actual se cierra hoy y se abre otro con la nueva máquina, misma empresa, obra, tarifa y fecha prevista.</p>
      <Rejilla>
        <Campo label="Nueva máquina"><input value={form.nombre} onChange={set('nombre')} className={inputCls} /></Campo>
        <Campo label="Nº de serie"><input value={form.numero_serie} onChange={set('numero_serie')} className={inputCls} /></Campo>
        <Campo label="Motivo *" full><input value={form.motivo} onChange={set('motivo')} placeholder="Avería hidráulica, no arranca…" className={inputCls} required /></Campo>
        <Campo label="Portes del cambio (sin IVA)" ayuda="Normalmente 0 si la avería es del proveedor"><input type="number" step="0.01" min="0" value={form.transporte} onChange={set('transporte')} className={inputCls} /></Campo>
      </Rejilla>
    </Modal>
  );
}
