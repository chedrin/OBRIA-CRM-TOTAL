import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Truck, Package, MoveRight, Repeat, Edit2, Plus, Trash2, PackagePlus, RefreshCw, Phone, Fuel, Gauge, History, AlertTriangle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, fmtDate, fmtDateTime, fmtMoney, btnPrimary, btnGhost } from '../../services/avisosApi';
import {
  TIPOS_ACTIVO, ADQUISICION, TIPOS_VEHICULO, COMBUSTIBLES, RESULTADOS_ITV, COBERTURAS, TIPOS_MANTENIMIENTO, POSICIONES_NEUMATICO,
  TIPOS_DOCUMENTO, ACCIONES_MOVIMIENTO, labelDe, labelEstado, consumoMedio, ordenarAlertas, plazoAlerta, ubicacionTexto, peorEstado, costeAlquiler
} from '../../utils/flota';
import { Modal, Pestanas, Vacio, EstadoActivo, EstadoAlerta, BotonArchivo, Cargando, fmtKm } from './flotaShared';
import { ActivoForm, MoverModal, StockModal, SustituirModal, VehiculoForm } from './ActivoForms';
import { RegistroModal } from './RegistroForms';

const Dato = ({ label, children }) => (
  <div className="min-w-0">
    <span className="block text-[11px] text-slate-500">{label}</span>
    <span className="block text-sm text-white truncate">{children || '—'}</span>
  </div>
);

function Fila({ children, acciones, tono = '' }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2.5 ${tono}`}>
      <div className="flex-1 min-w-0 text-sm">{children}</div>
      {acciones && <div className="flex items-center gap-1 shrink-0">{acciones}</div>}
    </div>
  );
}

const IconBtn = ({ icon: Icon, onClick, label, danger }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label}
    className={`p-1.5 rounded-lg ${danger ? 'text-slate-500 hover:text-rose-400' : 'text-slate-400 hover:text-white'} hover:bg-slate-800`}>
    <Icon className="w-4 h-4" />
  </button>
);

function Seccion({ titulo, accion, children }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">{titulo}</h4>
        {accion}
      </div>
      {children}
    </section>
  );
}

const BotonNuevo = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className={`${btnGhost} !py-1 !px-2 text-xs`}><Plus className="w-3.5 h-3.5" /> {children}</button>
);

/** Ficha completa de un elemento del inventario o de un vehículo. */
export default function FichaActivo({ activoId, datos, onClose, onChanged }) {
  const { obras = [], showNotification } = useApp() || {};
  const [ficha, setFicha] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('resumen');
  const [modal, setModal] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setFicha(await api(`/api/flota/activos/${activoId}`));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [activoId]);

  useEffect(() => { cargar(); }, [cargar]);

  const hecho = () => { setModal(null); cargar(); onChanged?.(); };
  const borrar = async (tipo, r, texto) => {
    if (!window.confirm(`¿Borrar ${texto}?`)) return;
    try {
      await api(`/api/flota/registros/${tipo}/${r.id}`, { method: 'DELETE' });
      hecho();
    } catch (err) {
      showNotification?.(err.message, 'error');
    }
  };

  const a = ficha?.activo;
  const v = ficha?.vehiculo;
  const consumo = useMemo(() => consumoMedio(ficha?.repostajes || []), [ficha]);
  const obraNombre = (id) => obras.find((o) => o.id === id)?.titulo || id;

  if (!ficha) {
    return (
      <Modal titulo="Ficha" onClose={onClose} ancho="max-w-4xl">
        {error ? <p className="text-sm text-rose-400">{error}</p> : <Cargando />}
      </Modal>
    );
  }

  const esVehiculo = !!v;
  const alertas = ordenarAlertas(ficha.alertas || []);
  const pendientes = alertas.filter((x) => x.estado !== 'vigente');
  const donde = ubicacionTexto(a, { obras, vehiculos: datos?.vehiculos || [] });
  const costeTotal = (ficha.costes || []).reduce((s, c) => s + Number(c.total || 0), 0);
  const tabs = esVehiculo
    ? [
      { id: 'resumen', label: 'Resumen' },
      { id: 'itv', label: 'ITV', badge: ficha.itv.length || '' },
      { id: 'seguros', label: 'Seguro', badge: ficha.seguros.length || '' },
      { id: 'combustible', label: 'Combustible', badge: ficha.repostajes.length || '' },
      { id: 'mantenimiento', label: 'Mantenimiento', badge: ficha.mantenimientos.length || '' },
      { id: 'neumaticos', label: 'Neumáticos' },
      { id: 'dotacion', label: 'Stock a bordo', badge: ficha.aBordo.length || '' },
      { id: 'documentos', label: 'Documentos', badge: ficha.documentos.filter((d) => d.activo).length || '' },
      { id: 'costes', label: 'Costes' },
      { id: 'historial', label: 'Historial' }
    ]
    : [
      { id: 'resumen', label: 'Resumen' },
      { id: 'mantenimiento', label: 'Revisiones y reparaciones', badge: ficha.mantenimientos.length || '' },
      { id: 'documentos', label: 'Documentos', badge: ficha.documentos.filter((d) => d.activo).length || '' },
      ...(ficha.alquileres.length ? [{ id: 'alquileres', label: 'Alquileres', badge: ficha.alquileres.length }] : []),
      { id: 'costes', label: 'Costes' },
      { id: 'historial', label: 'Historial', badge: ficha.movimientos.length || '' }
    ];

  const regProps = { activo: a, vehiculo: v, planes: ficha.planes, proveedores: datos?.proveedores || [], onClose: () => setModal(null), onSaved: hecho };
  const segVigente = ficha.seguros.find((s) => s.activa);
  const itvVigente = ficha.itv[0];

  const titulo = esVehiculo ? `${v.matricula} · ${[v.marca, v.modelo].filter(Boolean).join(' ')}` : `${a.codigo_interno} · ${a.nombre}`;

  return (
    <>
      <Modal titulo={titulo} icon={esVehiculo ? Truck : Package} onClose={onClose} ancho="max-w-4xl">
        <div className="flex flex-wrap items-center gap-2">
          <EstadoActivo estado={a.estado} tipo={a.tipo} />
          {donde !== labelEstado(a.estado, a.tipo) && <span className="text-xs text-slate-400">{donde}</span>}
          {pendientes.length > 0 && <EstadoAlerta estado={peorEstado(pendientes)}>{pendientes.length} {pendientes.length === 1 ? 'alerta' : 'alertas'}</EstadoAlerta>}
          {a.tipo_adquisicion !== 'propiedad' && <span className="text-[10px] font-bold rounded-md border border-sky-500/30 bg-sky-500/10 text-sky-300 px-1.5 py-0.5">{labelDe(ADQUISICION, a.tipo_adquisicion)}</span>}
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {a.estado !== 'baja' && <button type="button" onClick={() => setModal({ t: 'mover' })} className={`${btnPrimary} !py-1.5 text-xs`}><MoveRight className="w-4 h-4" /> Mover</button>}
            {a.tipo === 'consumible' && a.estado !== 'baja' && <button type="button" onClick={() => setModal({ t: 'stock' })} className={`${btnGhost} !py-1.5 text-xs`}><PackagePlus className="w-4 h-4" /> Stock</button>}
            {!esVehiculo && a.estado !== 'baja' && a.tipo !== 'consumible' && <button type="button" onClick={() => setModal({ t: 'sustituir' })} className={`${btnGhost} !py-1.5 text-xs`}><Repeat className="w-4 h-4" /> Sustituir</button>}
            <button type="button" onClick={() => setModal({ t: 'editar' })} className={`${btnGhost} !py-1.5 text-xs`}><Edit2 className="w-4 h-4" /> Editar</button>
          </div>
        </div>

        <Pestanas tabs={tabs} value={tab} onChange={setTab} />

        {tab === 'resumen' && (
          <div className="space-y-4">
            {alertas.length > 0 && (
              <div className="space-y-1.5">
                {alertas.map((al) => (
                  <div key={al.alert_key} className="flex items-center gap-2 text-sm rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <EstadoAlerta estado={al.estado} />
                    <span className="text-slate-200 truncate">{al.grupo}: {al.detalle}</span>
                    <span className="ml-auto text-xs text-slate-400 shrink-0">{plazoAlerta(al)}</span>
                  </div>
                ))}
              </div>
            )}
            {esVehiculo ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Tarjeta icon={Gauge} titulo="Kilómetros" valor={fmtKm(v.km_actual)} detalle={v.km_actualizado_at ? `Actualizado ${fmtDate(v.km_actualizado_at)}` : ''} />
                  <Tarjeta icon={Fuel} titulo="Consumo medio" valor={consumo.media ? `${String(consumo.media).replace('.', ',')} l/100` : '—'} detalle={consumo.eurosKm ? `${String(consumo.eurosKm).replace('.', ',')} €/km en combustible` : 'Faltan repostajes con depósito lleno'} />
                  <Tarjeta icon={History} titulo="Próxima ITV" valor={itvVigente ? fmtDate(itvVigente.proxima_itv) : 'Sin datos'} detalle={itvVigente ? labelDe(RESULTADOS_ITV, itvVigente.resultado) : ''} />
                  <Tarjeta icon={AlertTriangle} titulo="Coste total" valor={fmtMoney(costeTotal)} detalle="Combustible, taller, ITV, seguro y alquiler" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-2xl border border-slate-800 p-4">
                  <Dato label="Matrícula">{v.matricula}</Dato>
                  <Dato label="Bastidor (VIN)">{v.bastidor}</Dato>
                  <Dato label="Tipo">{labelDe(TIPOS_VEHICULO, v.tipo_vehiculo)}</Dato>
                  <Dato label="Matriculación">{fmtDate(v.fecha_matriculacion)}</Dato>
                  <Dato label="Combustible">{labelDe(COMBUSTIBLES, v.combustible)}</Dato>
                  <Dato label="Distintivo ambiental">{v.distintivo_ambiental === 'sin' ? 'Sin distintivo' : v.distintivo_ambiental}</Dato>
                  <Dato label="Conductor habitual">{v.conductor_nombre}</Dato>
                  <Dato label="Código interno">{a.codigo_interno}</Dato>
                  <Dato label="Compra">{[fmtDate(a.fecha_compra), a.precio_compra ? fmtMoney(a.precio_compra) : ''].filter(Boolean).join(' · ')}</Dato>
                </div>
                {segVigente && (
                  <div className="rounded-2xl border border-slate-800 p-4 flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-slate-400">Seguro:</span>
                    <span className="text-white font-semibold">{segVigente.aseguradora} · {labelDe(COBERTURAS, segVigente.cobertura)}</span>
                    <span className="text-slate-400">hasta {fmtDate(segVigente.fecha_vencimiento)}</span>
                    {segVigente.telefono_asistencia && (
                      <a href={`tel:${segVigente.telefono_asistencia}`} className="ml-auto inline-flex items-center gap-1 text-emerald-300 font-bold"><Phone className="w-4 h-4" /> Asistencia {segVigente.telefono_asistencia}</a>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-2xl border border-slate-800 p-4">
                <Dato label="Tipo">{labelDe(TIPOS_ACTIVO, a.tipo)}</Dato>
                <Dato label="Marca y modelo">{[a.marca, a.modelo].filter(Boolean).join(' ')}</Dato>
                <Dato label="Nº de serie">{a.numero_serie}</Dato>
                <Dato label="Código de barras / QR">{a.codigo_barras}</Dato>
                {a.tipo === 'consumible' && <Dato label="Stock">{`${Number(a.cantidad).toLocaleString('es-ES')} ${a.unidad}${a.stock_minimo !== null ? ` (mín. ${a.stock_minimo})` : ''}`}</Dato>}
                <Dato label="Proveedor">{datos?.proveedores?.find((p) => p.id === a.supplier_id)?.name || a.proveedor_nombre}</Dato>
                <Dato label="Factura de compra">{a.numero_factura}</Dato>
                <Dato label="Compra">{[fmtDate(a.fecha_compra), a.precio_compra ? fmtMoney(a.precio_compra) : ''].filter(Boolean).join(' · ')}</Dato>
                <Dato label="Garantía hasta">{fmtDate(a.fecha_fin_garantia)}</Dato>
                <Dato label="Ubicación concreta">{a.ubicacion_detalle}</Dato>
                {a.manual_path && <div><span className="block text-[11px] text-slate-500">Manual</span><BotonArchivo path={a.manual_path} label="Abrir manual" /></div>}
                {a.notas && <div className="col-span-2 sm:col-span-3"><Dato label="Notas">{a.notas}</Dato></div>}
              </div>
            )}
            {(a.sustituye_a || ficha.sustitutos.length > 0) && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5" />
                {a.sustituye_a && <>Sustituye a {datos?.activos?.find((x) => x.id === a.sustituye_a)?.codigo_interno || 'otro elemento'}. </>}
                {ficha.sustitutos.map((s) => `Sustituido por ${s.codigo_interno} · ${s.nombre}`).join('; ')}
              </p>
            )}
          </div>
        )}

        {tab === 'itv' && (
          <Seccion titulo="Inspecciones técnicas" accion={<BotonNuevo onClick={() => setModal({ t: 'reg', tipo: 'itv' })}>Apuntar ITV</BotonNuevo>}>
            {ficha.itv.length === 0 && <Vacio>Sin ITV registrada. Apunta la última o la fecha de la próxima para que avise.</Vacio>}
            {ficha.itv.map((i, n) => (
              <Fila key={i.id} tono={n === 0 ? 'border-slate-700' : 'opacity-70'} acciones={<>
                <BotonArchivo path={i.informe_path} label="Informe" />
                <IconBtn icon={Edit2} label="Editar" onClick={() => setModal({ t: 'reg', tipo: 'itv', registro: i })} />
                <IconBtn icon={Trash2} danger label="Borrar" onClick={() => borrar('itv', i, 'esta ITV')} />
              </>}>
                <p className="text-white font-semibold">Próxima: {fmtDate(i.proxima_itv)} {n === 0 && <span className="text-[10px] text-amber-300 ml-1">VIGENTE</span>}</p>
                <p className="text-xs text-slate-400">
                  {i.fecha_inspeccion ? `Pasada el ${fmtDate(i.fecha_inspeccion)} · ` : 'Cita pendiente · '}{labelDe(RESULTADOS_ITV, i.resultado)}
                  {i.km ? ` · ${fmtKm(i.km)}` : ''}{i.estacion ? ` · ${i.estacion}` : ''}{Number(i.coste) ? ` · ${fmtMoney(i.coste)}` : ''}
                </p>
                {i.defectos && <p className="text-xs text-amber-200/80 mt-0.5">{i.defectos}</p>}
              </Fila>
            ))}
          </Seccion>
        )}

        {tab === 'seguros' && (
          <Seccion titulo="Pólizas" accion={<BotonNuevo onClick={() => setModal({ t: 'reg', tipo: 'seguro' })}>Nueva póliza</BotonNuevo>}>
            {ficha.seguros.length === 0 && <Vacio>Sin seguro registrado.</Vacio>}
            {ficha.seguros.map((s) => (
              <Fila key={s.id} tono={s.activa ? '' : 'opacity-60'} acciones={<>
                <BotonArchivo path={s.poliza_path} label="Póliza" />
                {s.activa && <button type="button" onClick={() => setModal({ t: 'reg', tipo: 'seguro', renueva: s })} className="text-[11px] font-bold text-amber-400 px-1.5 inline-flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Renovar</button>}
                <IconBtn icon={Edit2} label="Editar" onClick={() => setModal({ t: 'reg', tipo: 'seguro', registro: s })} />
                <IconBtn icon={Trash2} danger label="Borrar" onClick={() => borrar('seguro', s, 'esta póliza')} />
              </>}>
                <p className="text-white font-semibold">{s.aseguradora} · {s.numero_poliza} {!s.activa && <span className="text-[10px] text-slate-500 ml-1">ANTERIOR</span>}</p>
                <p className="text-xs text-slate-400">
                  {labelDe(COBERTURAS, s.cobertura)} · {fmtDate(s.fecha_inicio)} – {fmtDate(s.fecha_vencimiento)}{s.prima ? ` · ${fmtMoney(s.prima)}` : ''}
                </p>
                {s.telefono_asistencia && <a href={`tel:${s.telefono_asistencia}`} className="text-xs text-emerald-300 inline-flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> Asistencia: {s.telefono_asistencia}</a>}
              </Fila>
            ))}
          </Seccion>
        )}

        {tab === 'combustible' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Tarjeta titulo="Consumo medio" valor={consumo.media ? `${String(consumo.media).replace('.', ',')} l/100 km` : '—'} />
              <Tarjeta titulo="Último tramo" valor={consumo.ultimo ? `${String(consumo.ultimo).replace('.', ',')} l/100 km` : '—'} />
              <Tarjeta titulo="Litros" valor={consumo.litros.toLocaleString('es-ES')} />
              <Tarjeta titulo="Gastado" valor={fmtMoney(consumo.importe)} />
            </div>
            <Seccion titulo="Repostajes" accion={<BotonNuevo onClick={() => setModal({ t: 'reg', tipo: 'repostaje' })}>Repostaje</BotonNuevo>}>
              {ficha.repostajes.length === 0 && <Vacio>Sin repostajes.</Vacio>}
              {ficha.repostajes.map((f) => (
                <Fila key={f.id} acciones={<>
                  <BotonArchivo path={f.ticket_path} label="Ticket" />
                  <IconBtn icon={Edit2} label="Editar" onClick={() => setModal({ t: 'reg', tipo: 'repostaje', registro: f })} />
                  <IconBtn icon={Trash2} danger label="Borrar" onClick={() => borrar('repostaje', f, 'este repostaje')} />
                </>}>
                  <p className="text-white font-semibold">{Number(f.litros).toLocaleString('es-ES')} l · {fmtMoney(f.importe)} <span className="text-xs text-slate-400 font-normal">({String(f.precio_litro).replace('.', ',')} €/l{f.deposito_lleno ? ', lleno' : ', parcial'})</span></p>
                  <p className="text-xs text-slate-400">{fmtDateTime(f.fecha)} · {fmtKm(f.km)}{f.estacion ? ` · ${f.estacion}` : ''}{f.operario_nombre ? ` · ${f.operario_nombre}` : ''}{f.obra_id ? ` · Obra: ${obraNombre(f.obra_id)}` : ''}</p>
                </Fila>
              ))}
            </Seccion>
          </div>
        )}

        {tab === 'mantenimiento' && (
          <div className="space-y-5">
            <Seccion titulo={esVehiculo ? 'Mantenimiento preventivo' : 'Revisiones periódicas, calibraciones y certificaciones'}
              accion={<BotonNuevo onClick={() => setModal({ t: 'reg', tipo: 'plan' })}>Plan</BotonNuevo>}>
              {ficha.planes.length === 0 && <Vacio>{esVehiculo ? 'Ej: "Aceite y filtros cada 15.000 km o 12 meses".' : 'Ej: "Revisión del arnés cada 12 meses" o "Calibración anual".'}</Vacio>}
              {ficha.planes.map((p) => {
                const al = alertas.find((x) => x.ref_id === p.id);
                return (
                  <Fila key={p.id} tono={p.activo ? '' : 'opacity-60'} acciones={<>
                    <IconBtn icon={Edit2} label="Editar" onClick={() => setModal({ t: 'reg', tipo: 'plan', registro: p })} />
                    <IconBtn icon={Trash2} danger label="Borrar" onClick={() => borrar('plan', p, `el plan "${p.nombre}"`)} />
                  </>}>
                    <p className="text-white font-semibold flex items-center gap-2 flex-wrap">{p.nombre} {al && <EstadoAlerta estado={al.estado}>{plazoAlerta(al) || al.estado}</EstadoAlerta>}</p>
                    <p className="text-xs text-slate-400">
                      Cada {[p.cada_km ? fmtKm(p.cada_km) : '', p.cada_meses ? `${p.cada_meses} meses` : ''].filter(Boolean).join(' o ')}
                      {' · '}Última: {[fmtDate(p.ultima_fecha), p.ultimo_km ? fmtKm(p.ultimo_km) : ''].filter(Boolean).join(', ') || 'sin datos'}
                    </p>
                  </Fila>
                );
              })}
            </Seccion>
            <Seccion titulo="Revisiones y reparaciones hechas" accion={<BotonNuevo onClick={() => setModal({ t: 'reg', tipo: 'mantenimiento' })}>Apuntar</BotonNuevo>}>
              {ficha.mantenimientos.length === 0 && <Vacio>Sin registros.</Vacio>}
              {ficha.mantenimientos.map((m) => (
                <Fila key={m.id} acciones={<>
                  <BotonArchivo path={m.factura_path} label="Factura" />
                  <IconBtn icon={Edit2} label="Editar" onClick={() => setModal({ t: 'reg', tipo: 'mantenimiento', registro: m })} />
                  <IconBtn icon={Trash2} danger label="Borrar" onClick={() => borrar('mantenimiento', m, 'este registro')} />
                </>}>
                  <p className="text-white font-semibold">{labelDe(TIPOS_MANTENIMIENTO, m.tipo)} · {fmtMoney(m.importe_total)}</p>
                  <p className="text-xs text-slate-400">{fmtDate(m.fecha)}{m.km ? ` · ${fmtKm(m.km)}` : ''}{m.proveedor ? ` · ${m.proveedor}` : ''}{m.numero_factura ? ` · Fra. ${m.numero_factura}` : ''}{m.obra_id ? ` · Obra: ${obraNombre(m.obra_id)}` : ''}</p>
                  <p className="text-xs text-slate-300 mt-0.5">{m.descripcion}</p>
                  {(Number(m.mano_obra) > 0 || Number(m.piezas) > 0) && <p className="text-[11px] text-slate-500">Mano de obra {fmtMoney(m.mano_obra)} · Piezas {fmtMoney(m.piezas)} (sin IVA)</p>}
                </Fila>
              ))}
            </Seccion>
          </div>
        )}

        {tab === 'neumaticos' && (
          <Seccion titulo="Neumáticos montados" accion={<BotonNuevo onClick={() => setModal({ t: 'reg', tipo: 'neumatico' })}>Neumático</BotonNuevo>}>
            {ficha.neumaticos.length === 0 && <Vacio>Sin neumáticos registrados.</Vacio>}
            <div className="grid sm:grid-cols-2 gap-2">
              {ficha.neumaticos.map((t) => {
                const mm = t.profundidad_mm === null ? null : Number(t.profundidad_mm);
                const estado = mm === null ? null : mm < 1.6 ? 'vencido' : mm < 2.5 ? 'urgente' : mm < 3 ? 'proximo' : 'vigente';
                return (
                  <Fila key={t.id} tono={t.activo ? '' : 'opacity-50'} acciones={<>
                    <IconBtn icon={Edit2} label="Editar" onClick={() => setModal({ t: 'reg', tipo: 'neumatico', registro: t })} />
                    <IconBtn icon={Trash2} danger label="Borrar" onClick={() => borrar('neumatico', t, 'este neumático')} />
                  </>}>
                    <p className="text-white font-semibold flex items-center gap-2">{labelDe(POSICIONES_NEUMATICO, t.posicion)} {estado && <EstadoAlerta estado={estado}>{String(mm).replace('.', ',')} mm</EstadoAlerta>}</p>
                    <p className="text-xs text-slate-400">{t.marca} {t.modelo || ''} · {t.medida}</p>
                    <p className="text-[11px] text-slate-500">Montado {fmtDate(t.fecha_montaje)} a {fmtKm(t.km_montaje)}{t.activo && v.km_actual > t.km_montaje ? ` · lleva ${fmtKm(v.km_actual - t.km_montaje)}` : ''}{!t.activo ? ' · desmontado' : ''}</p>
                  </Fila>
                );
              })}
            </div>
          </Seccion>
        )}

        {tab === 'dotacion' && (
          <Seccion titulo="Herramientas y repuestos a bordo">
            <p className="text-xs text-slate-500">Para cargar algo en el vehículo: Inventario &gt; el elemento &gt; Mover &gt; En vehículo.</p>
            {ficha.aBordo.length === 0 && <Vacio>No lleva nada asignado.</Vacio>}
            {ficha.aBordo.map((x) => (
              <Fila key={x.id}>
                <p className="text-white font-semibold">{x.codigo_interno} · {x.nombre}</p>
                <p className="text-xs text-slate-400">{labelDe(TIPOS_ACTIVO, x.tipo)}{x.tipo === 'consumible' ? ` · ${Number(x.cantidad).toLocaleString('es-ES')} ${x.unidad}` : ''}{x.ubicacion_detalle ? ` · ${x.ubicacion_detalle}` : ''}</p>
              </Fila>
            ))}
          </Seccion>
        )}

        {tab === 'documentos' && (
          <Seccion titulo={esVehiculo ? 'Ficha técnica, permiso, tarjeta de transporte, autorizaciones…' : 'Certificados, manuales, garantía…'}
            accion={<BotonNuevo onClick={() => setModal({ t: 'reg', tipo: 'documento' })}>Documento</BotonNuevo>}>
            {ficha.documentos.length === 0 && <Vacio>Sin documentos.</Vacio>}
            {ficha.documentos.map((d) => {
              const al = alertas.find((x) => x.ref_id === d.id);
              return (
                <Fila key={d.id} tono={d.activo ? '' : 'opacity-50'} acciones={<>
                  <BotonArchivo path={d.file_path} label="Abrir" />
                  {d.activo && d.fecha_caducidad && <button type="button" onClick={() => setModal({ t: 'reg', tipo: 'documento', renueva: d })} className="text-[11px] font-bold text-amber-400 px-1.5 inline-flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Renovar</button>}
                  <IconBtn icon={Edit2} label="Editar" onClick={() => setModal({ t: 'reg', tipo: 'documento', registro: d })} />
                  <IconBtn icon={Trash2} danger label="Borrar" onClick={() => borrar('documento', d, `"${d.nombre}"`)} />
                </>}>
                  <p className="text-white font-semibold flex items-center gap-2 flex-wrap">{d.nombre} {al && <EstadoAlerta estado={al.estado}>{plazoAlerta(al)}</EstadoAlerta>}</p>
                  <p className="text-xs text-slate-400">{labelDe(TIPOS_DOCUMENTO, d.tipo)}{d.numero ? ` · nº ${d.numero}` : ''}{d.fecha_caducidad ? ` · caduca ${fmtDate(d.fecha_caducidad)}` : ''}{!d.activo ? ' · sustituido' : ''}</p>
                </Fila>
              );
            })}
          </Seccion>
        )}

        {tab === 'alquileres' && (
          <Seccion titulo="Alquileres de este elemento">
            {ficha.alquileres.map((r) => (
              <Fila key={r.id}>
                <p className="text-white font-semibold">{r.proveedor} · {fmtMoney(costeAlquiler(r).base)} <span className="text-xs text-slate-400 font-normal">sin IVA</span></p>
                <p className="text-xs text-slate-400">{fmtDate(r.fecha_inicio)} – {fmtDate(r.fecha_devolucion || r.fecha_prevista_devolucion)} · {r.estado}{r.obra_id ? ` · Obra: ${obraNombre(r.obra_id)}` : ''}</p>
              </Fila>
            ))}
          </Seccion>
        )}

        {tab === 'costes' && (
          <Seccion titulo={`Centro de coste · ${fmtMoney(costeTotal)} con IVA`}>
            {ficha.costes.length === 0 && <Vacio>Sin costes registrados.</Vacio>}
            {ficha.costes.map((c) => (
              <Fila key={`${c.origen}-${c.id}`}>
                <p className="text-white font-semibold flex justify-between gap-2"><span className="truncate">{c.concepto}</span><span className="tabular-nums shrink-0">{fmtMoney(c.total)}</span></p>
                <p className="text-xs text-slate-400">{fmtDate(c.fecha)} · {c.proveedor}{c.obra_id ? ` · imputado a ${obraNombre(c.obra_id)}` : ''}</p>
              </Fila>
            ))}
          </Seccion>
        )}

        {tab === 'historial' && (
          <Seccion titulo="Historial de movimientos (no se puede modificar)">
            {ficha.movimientos.map((m) => (
              <div key={m.id} className="flex gap-3 text-sm border-l-2 border-slate-700 pl-3 py-1">
                <div className="min-w-0">
                  <p className="text-white font-semibold">{ACCIONES_MOVIMIENTO[m.accion] || m.accion}
                    <span className="text-xs text-slate-400 font-normal"> · {fmtDateTime(m.created_at)}{m.user_name ? ` · ${m.user_name}` : ''}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {m.de_estado ? `${ubicacionTexto({ estado: m.de_estado, obra_id: m.de_obra_id, vehicle_id: m.de_vehicle_id, operario_nombre: m.de_operario_nombre, tipo: a.tipo }, { obras, vehiculos: datos?.vehiculos || [] })} → ` : ''}
                    {ubicacionTexto({ estado: m.a_estado, obra_id: m.a_obra_id, vehicle_id: m.a_vehicle_id, operario_nombre: m.a_operario_nombre, tipo: a.tipo }, { obras, vehiculos: datos?.vehiculos || [] })}
                    {m.cantidad_antes !== null && m.cantidad_despues !== null && m.cantidad_antes !== m.cantidad_despues ? ` · ${m.cantidad_antes} → ${m.cantidad_despues} ${a.unidad}` : ''}
                  </p>
                  {m.motivo && <p className="text-xs text-slate-300">{m.motivo}</p>}
                </div>
              </div>
            ))}
          </Seccion>
        )}
      </Modal>

      <AnimatePresence>
        {modal?.t === 'mover' && <MoverModal key="mover" activo={a} datos={datos} onClose={() => setModal(null)} onSaved={hecho} />}
        {modal?.t === 'stock' && <StockModal key="stock" activo={a} onClose={() => setModal(null)} onSaved={hecho} />}
        {modal?.t === 'sustituir' && <SustituirModal key="sust" activo={a} datos={datos} onClose={() => setModal(null)} onSaved={hecho} />}
        {modal?.t === 'editar' && (esVehiculo
          ? <VehiculoForm key="ev" vehiculo={v} activo={a} onClose={() => setModal(null)} onSaved={hecho} />
          : <ActivoForm key="ea" activo={a} datos={datos} onClose={() => setModal(null)} onSaved={hecho} />)}
        {modal?.t === 'reg' && <RegistroModal key={`reg-${modal.tipo}`} tipo={modal.tipo} registro={modal.registro} renueva={modal.renueva} {...regProps} />}
      </AnimatePresence>
    </>
  );
}

function Tarjeta({ icon: Icon, titulo, valor, detalle }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3 min-w-0">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">{Icon && <Icon className="w-3.5 h-3.5" />}{titulo}</span>
      <span className="block text-lg font-black text-white tabular-nums truncate">{valor}</span>
      {detalle && <span className="block text-[11px] text-slate-500 truncate">{detalle}</span>}
    </div>
  );
}
