import React, { useMemo } from 'react';
import { Package, MoveRight, Repeat, PackagePlus, Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, inputCls } from '../../services/avisosApi';
import { TIPOS_ACTIVO, ADQUISICION, TIPOS_VEHICULO, COMBUSTIBLES, DISTINTIVOS, ESTADOS_ACTIVO, labelEstado } from '../../utils/flota';
import { Modal, Campo, Rejilla, useFormulario, CampoArchivo, subirArchivo, SelectObra, SelectOperario, SelectProveedor, num } from './flotaShared';

const limpio = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

/** Alta o edición de material, herramienta o máquina. */
export function ActivoForm({ activo, datos, onClose, onSaved }) {
  const { showNotification } = useApp() || {};
  const nuevo = !activo;
  const { form, set, setForm, busy, error, enviar } = useFormulario({
    nombre: '', tipo: 'herramienta_manual', tipo_adquisicion: 'propiedad', category_id: '', codigo_interno: '', codigo_barras: '',
    numero_serie: '', marca: '', modelo: '', cantidad: '1', unidad: 'ud', stock_minimo: '', supplier_id: '', proveedor_nombre: '',
    numero_factura: '', fecha_compra: '', precio_compra: '', fecha_fin_garantia: '', ubicacion_detalle: '', notas: '', descripcion: '',
    estado: 'en_almacen', obra_id: '', operario_id: '', operario_nombre: '', vehicle_id: '', manual: null,
    ...(activo ? Object.fromEntries(Object.entries(activo).map(([k, v]) => [k, v ?? ''])) : {})
  });
  const categorias = datos?.categorias || [];
  const vehiculos = datos?.vehiculos || [];
  const consumible = form.tipo === 'consumible';

  const elegirCategoria = (e) => {
    const c = categorias.find((x) => x.id === e.target.value);
    setForm((f) => ({ ...f, category_id: e.target.value, tipo: nuevo && c?.tipo && c.tipo !== 'vehiculo' ? c.tipo : f.tipo }));
  };

  const guardar = enviar(async () => {
    if (!form.nombre.trim()) throw new Error('Pon el nombre.');
    const manual = form.manual ? await subirArchivo(form.manual, 'activos') : null;
    const body = limpio({
      nombre: form.nombre, tipo: nuevo ? form.tipo : undefined, tipo_adquisicion: form.tipo_adquisicion, category_id: form.category_id || null,
      codigo_interno: form.codigo_interno || (nuevo ? undefined : form.codigo_interno), codigo_barras: form.codigo_barras,
      numero_serie: form.numero_serie, marca: form.marca, modelo: form.modelo, descripcion: form.descripcion,
      cantidad: num(form.cantidad) ?? 1, unidad: form.unidad || 'ud', stock_minimo: num(form.stock_minimo),
      supplier_id: form.supplier_id || null, proveedor_nombre: form.proveedor_nombre, numero_factura: form.numero_factura,
      fecha_compra: form.fecha_compra || null, precio_compra: num(form.precio_compra), fecha_fin_garantia: form.fecha_fin_garantia || null,
      ubicacion_detalle: form.ubicacion_detalle, notas: form.notas,
      manual_path: manual ? manual.path : undefined
    });
    if (nuevo) Object.assign(body, { estado: form.estado, obra_id: form.obra_id, operario_id: form.operario_id, operario_nombre: form.operario_nombre, vehicle_id: form.vehicle_id || null });
    const saved = nuevo
      ? await api('/api/flota/activos', { method: 'POST', body })
      : await api(`/api/flota/activos/${activo.id}`, { method: 'PATCH', body });
    showNotification?.(nuevo ? `${saved.codigo_interno} dado de alta` : 'Cambios guardados');
    onSaved(saved);
  });

  return (
    <Modal titulo={nuevo ? 'Nuevo material, herramienta o máquina' : `Editar ${activo.codigo_interno}`} icon={Package}
      onClose={onClose} onSubmit={guardar} busy={busy} error={error}>
      <Rejilla>
        <Campo label="Nombre *" full><input autoFocus value={form.nombre} onChange={set('nombre')} placeholder="Ej: Martillo percutor Hilti TE 30" className={inputCls} /></Campo>
        <Campo label="Categoría">
          <select value={form.category_id} onChange={elegirCategoria} className={inputCls}>
            <option value="">Sin categoría</option>
            {categorias.filter((c) => c.tipo !== 'vehiculo').map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Tipo">
          <select value={form.tipo} onChange={set('tipo')} disabled={!nuevo} className={inputCls}>
            {TIPOS_ACTIVO.filter((t) => t.id !== 'vehiculo').map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Campo>
        <Campo label="Código interno" ayuda={nuevo ? 'Vacío = se genera solo (HER-0001…)' : undefined}>
          <input value={form.codigo_interno} onChange={set('codigo_interno')} placeholder="Automático" className={inputCls} />
        </Campo>
        <Campo label="Código de barras / QR"><input value={form.codigo_barras} onChange={set('codigo_barras')} placeholder="Escanéalo o escríbelo" className={inputCls} /></Campo>
        <Campo label="Marca"><input value={form.marca} onChange={set('marca')} className={inputCls} /></Campo>
        <Campo label="Modelo"><input value={form.modelo} onChange={set('modelo')} className={inputCls} /></Campo>
        <Campo label="Nº de serie"><input value={form.numero_serie} onChange={set('numero_serie')} className={inputCls} /></Campo>
        <Campo label="Propio o alquilado">
          <select value={form.tipo_adquisicion} onChange={set('tipo_adquisicion')} className={inputCls}>
            {ADQUISICION.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Campo>
        {consumible && (
          <>
            <Campo label="Cantidad en stock"><input type="number" step="0.01" min="0" value={form.cantidad} onChange={set('cantidad')} className={inputCls} /></Campo>
            <Campo label="Unidad"><input value={form.unidad} onChange={set('unidad')} placeholder="ud, saco, caja, m…" className={inputCls} /></Campo>
            <Campo label="Avisar si baja de" ayuda="Stock mínimo (aparece en el centro de alertas)"><input type="number" step="0.01" min="0" value={form.stock_minimo} onChange={set('stock_minimo')} className={inputCls} /></Campo>
          </>
        )}
      </Rejilla>

      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 pt-2">Compra y garantía</h4>
      <Rejilla>
        <Campo label="Proveedor">
          <SelectProveedor value={form.supplier_id} proveedores={datos?.proveedores} vacio="Sin proveedor / otro"
            onChange={(id, nombre) => setForm((f) => ({ ...f, supplier_id: id, proveedor_nombre: id ? nombre : f.proveedor_nombre }))} />
        </Campo>
        <Campo label="Nº de factura"><input value={form.numero_factura} onChange={set('numero_factura')} className={inputCls} /></Campo>
        <Campo label="Fecha de compra"><input type="date" value={form.fecha_compra} onChange={set('fecha_compra')} className={inputCls} /></Campo>
        <Campo label="Precio de compra (sin IVA)"><input type="number" step="0.01" min="0" value={form.precio_compra} onChange={set('precio_compra')} className={inputCls} /></Campo>
        <Campo label="Fin de la garantía" ayuda="Se avisa antes de que acabe"><input type="date" value={form.fecha_fin_garantia} onChange={set('fecha_fin_garantia')} className={inputCls} /></Campo>
        <Campo label="Manual técnico"><CampoArchivo file={form.manual} onChange={set('manual')} actual={activo?.manual_path} label="Adjuntar PDF" /></Campo>
      </Rejilla>

      {nuevo && (
        <>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 pt-2">Dónde está</h4>
          <UbicacionCampos form={form} setForm={setForm} vehiculos={vehiculos} />
        </>
      )}
      <Rejilla>
        <Campo label="Ubicación concreta"><input value={form.ubicacion_detalle} onChange={set('ubicacion_detalle')} placeholder="Estantería 3, caja roja…" className={inputCls} /></Campo>
        <Campo label="Notas"><input value={form.notas} onChange={set('notas')} className={inputCls} /></Campo>
      </Rejilla>
    </Modal>
  );
}

function UbicacionCampos({ form, setForm, vehiculos, estados = ['en_almacen', 'en_obra', 'en_vehiculo', 'con_operario'], sinEstado = false }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }));
  return (
    <Rejilla>
      {!sinEstado && (
        <Campo label="Estado / ubicación">
          <select value={form.estado} onChange={set('estado')} className={inputCls}>
            {estados.map((e) => <option key={e} value={e}>{ESTADOS_ACTIVO[e].label}</option>)}
          </select>
        </Campo>
      )}
      {form.estado === 'en_obra' && (
        <Campo label="Obra *"><SelectObra value={form.obra_id} onChange={set('obra_id')} vacio="Elige la obra" required /></Campo>
      )}
      {form.estado === 'en_vehiculo' && (
        <Campo label="Vehículo *">
          <select value={form.vehicle_id} onChange={set('vehicle_id')} className={inputCls} required>
            <option value="">Elige el vehículo</option>
            {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.matricula} · {[v.marca, v.modelo].filter(Boolean).join(' ')}</option>)}
          </select>
        </Campo>
      )}
      {['en_obra', 'en_vehiculo', 'con_operario'].includes(form.estado) && (
        <Campo label={form.estado === 'con_operario' ? 'Operario *' : 'Responsable (opcional)'}>
          <SelectOperario value={form.operario_id} required={form.estado === 'con_operario'}
            onChange={(id, nombre) => setForm((f) => ({ ...f, operario_id: id, operario_nombre: nombre }))} />
        </Campo>
      )}
    </Rejilla>
  );
}

/** Traslado: almacén ↔ obra ↔ vehículo ↔ operario, taller o baja. */
export function MoverModal({ activo, datos, onClose, onSaved }) {
  const { showNotification } = useApp() || {};
  const { form, setForm, set, busy, error, enviar } = useFormulario({
    estado: activo.estado === 'en_almacen' ? 'en_obra' : 'en_almacen',
    obra_id: activo.obra_id || '', vehicle_id: activo.vehicle_id || '', operario_id: activo.operario_id || '', operario_nombre: activo.operario_nombre || '', motivo: ''
  });
  const vehiculos = (datos?.vehiculos || []).filter((v) => v.asset_id !== activo.id);
  const esVehiculo = activo.tipo === 'vehiculo';
  const estados = esVehiculo
    ? ['en_almacen', 'en_obra', 'con_operario', 'en_reparacion', 'baja']
    : ['en_almacen', 'en_obra', 'en_vehiculo', 'con_operario', 'en_reparacion', ...(activo.tipo_adquisicion === 'alquiler' ? ['devuelto_proveedor'] : []), 'baja'];

  const guardar = enviar(async () => {
    if (form.estado === 'baja' && !form.motivo.trim()) throw new Error('Escribe el motivo de la baja.');
    const saved = await api(`/api/flota/activos/${activo.id}/mover`, { method: 'POST', body: form });
    showNotification?.(`${activo.codigo_interno}: ${labelEstado(saved.estado, saved.tipo).toLowerCase()}`);
    onSaved(saved);
  });

  return (
    <Modal titulo={`Mover ${activo.codigo_interno} · ${activo.nombre}`} icon={MoveRight} ancho="max-w-lg" onClose={onClose} onSubmit={guardar} busy={busy} error={error} submitLabel="Mover">
      <p className="text-xs text-slate-400">Queda anotado en el historial con la fecha, quién lo hace y el motivo. Si entra o sale de una obra, también en su histórico diario.</p>
      <div className="flex flex-wrap gap-1.5">
        {estados.map((e) => (
          <button key={e} type="button" onClick={() => setForm((f) => ({ ...f, estado: e }))}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border ${form.estado === e ? 'bg-amber-500 text-slate-950 border-amber-500' : 'border-slate-700 text-slate-300'}`}>
            {labelEstado(e, activo.tipo)}
          </button>
        ))}
      </div>
      <UbicacionCampos form={form} setForm={setForm} vehiculos={vehiculos} estados={estados} sinEstado />
      <Campo label={form.estado === 'baja' ? 'Motivo de la baja *' : form.estado === 'en_reparacion' ? 'Avería / qué hay que reparar' : 'Motivo o nota'}>
        <input value={form.motivo} onChange={set('motivo')} placeholder={form.estado === 'baja' ? 'Rota sin reparación, robada, perdida…' : ''} className={inputCls} />
      </Campo>
    </Modal>
  );
}

/** Entrada o consumo de un consumible. */
export function StockModal({ activo, onClose, onSaved }) {
  const { showNotification } = useApp() || {};
  const { form, set, busy, error, enviar } = useFormulario({ sentido: 'salida', cantidad: '', motivo: '', obra_id: activo.obra_id || '' });
  const guardar = enviar(async () => {
    const c = num(form.cantidad);
    if (!c || c <= 0) throw new Error('Pon la cantidad.');
    const saved = await api(`/api/flota/activos/${activo.id}/stock`, {
      method: 'POST', body: { delta: form.sentido === 'entrada' ? c : -c, motivo: form.motivo, obra_id: form.sentido === 'salida' ? form.obra_id : '' }
    });
    showNotification?.(`Stock de ${activo.nombre}: ${saved.cantidad} ${saved.unidad}`);
    onSaved(saved);
  });
  return (
    <Modal titulo={`Stock · ${activo.nombre}`} icon={PackagePlus} ancho="max-w-md" onClose={onClose} onSubmit={guardar} busy={busy} error={error}>
      <p className="text-sm text-slate-300">En almacén: <strong className="text-white">{Number(activo.cantidad).toLocaleString('es-ES')} {activo.unidad}</strong></p>
      <div className="flex gap-2">
        {[['salida', 'Se gasta / sale'], ['entrada', 'Entra (compra)']].map(([id, l]) => (
          <button key={id} type="button" onClick={() => set('sentido')(id)}
            className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border ${form.sentido === id ? 'bg-amber-500 text-slate-950 border-amber-500' : 'border-slate-700 text-slate-300'}`}>{l}</button>
        ))}
      </div>
      <Rejilla>
        <Campo label={`Cantidad (${activo.unidad})`}><input autoFocus type="number" step="0.01" min="0" value={form.cantidad} onChange={set('cantidad')} className={inputCls} /></Campo>
        {form.sentido === 'salida' && <Campo label="Para la obra"><SelectObra value={form.obra_id} onChange={set('obra_id')} /></Campo>}
        <Campo label="Nota" full><input value={form.motivo} onChange={set('motivo')} placeholder={form.sentido === 'entrada' ? 'Albarán, proveedor…' : 'Para qué'} className={inputCls} /></Campo>
      </Rejilla>
    </Modal>
  );
}

/** Sustitución directa de un elemento averiado por otro (del almacén o nuevo). */
export function SustituirModal({ activo, datos, onClose, onSaved }) {
  const { showNotification } = useApp() || {};
  const candidatos = useMemo(() => (datos?.activos || []).filter((a) => a.id !== activo.id && a.estado === 'en_almacen' && a.tipo === activo.tipo), [datos, activo]);
  const { form, set, busy, error, enviar } = useFormulario({ modo: candidatos.length ? 'existente' : 'nuevo', sustituto_id: '', nombre: activo.nombre, numero_serie: '', estado_original: 'en_reparacion', motivo: '' });
  const guardar = enviar(async () => {
    const body = { motivo: form.motivo, estado_original: form.estado_original };
    if (form.modo === 'existente') body.sustituto_id = form.sustituto_id;
    else body.nuevo = { nombre: form.nombre, numero_serie: form.numero_serie, marca: activo.marca, modelo: activo.modelo, category_id: activo.category_id, tipo_adquisicion: activo.tipo_adquisicion };
    const r = await api(`/api/flota/activos/${activo.id}/sustituir`, { method: 'POST', body });
    showNotification?.(`${r.nuevo.codigo_interno} sustituye a ${activo.codigo_interno}`);
    onSaved(r.nuevo);
  });
  return (
    <Modal titulo={`Sustituir ${activo.codigo_interno} · ${activo.nombre}`} icon={Repeat} ancho="max-w-lg" onClose={onClose} onSubmit={guardar} busy={busy} error={error} submitLabel="Sustituir">
      <p className="text-xs text-slate-400">El sustituto ocupa su lugar ({activo.obra_id ? 'misma obra' : activo.vehicle_id ? 'mismo vehículo' : activo.operario_nombre || 'misma ubicación'}) y los dos quedan enlazados en el historial.</p>
      <div className="flex gap-2">
        {[['existente', 'Otro del almacén'], ['nuevo', 'Uno nuevo']].map(([id, l]) => (
          <button key={id} type="button" onClick={() => set('modo')(id)}
            className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border ${form.modo === id ? 'bg-amber-500 text-slate-950 border-amber-500' : 'border-slate-700 text-slate-300'}`}>{l}</button>
        ))}
      </div>
      <Rejilla>
        {form.modo === 'existente' ? (
          <Campo label="Sustituto *" full>
            <select value={form.sustituto_id} onChange={set('sustituto_id')} className={inputCls} required>
              <option value="">Elige uno del almacén</option>
              {candidatos.map((a) => <option key={a.id} value={a.id}>{a.codigo_interno} · {a.nombre}</option>)}
            </select>
          </Campo>
        ) : (
          <>
            <Campo label="Nombre *"><input value={form.nombre} onChange={set('nombre')} className={inputCls} /></Campo>
            <Campo label="Nº de serie"><input value={form.numero_serie} onChange={set('numero_serie')} className={inputCls} /></Campo>
          </>
        )}
        <Campo label="El original pasa a">
          <select value={form.estado_original} onChange={set('estado_original')} className={inputCls}>
            <option value="en_reparacion">En reparación</option>
            <option value="en_almacen">Almacén</option>
            {activo.tipo_adquisicion === 'alquiler' && <option value="devuelto_proveedor">Devuelto al proveedor</option>}
            <option value="baja">Baja</option>
          </select>
        </Campo>
        <Campo label="Motivo *"><input value={form.motivo} onChange={set('motivo')} placeholder="Avería del motor, robo…" className={inputCls} required /></Campo>
      </Rejilla>
    </Modal>
  );
}

/** Alta de vehículo o edición de su ficha. */
export function VehiculoForm({ vehiculo, activo, onClose, onSaved }) {
  const { showNotification } = useApp() || {};
  const nuevo = !vehiculo;
  const { form, set, setForm, busy, error, enviar } = useFormulario({
    matricula: '', bastidor: '', marca: '', modelo: '', tipo_vehiculo: 'furgoneta', fecha_matriculacion: '', combustible: 'diesel',
    capacidad_deposito: '', km_actual: '', distintivo_ambiental: '', mma_kg: '', conductor_operario_id: '', conductor_nombre: '', notas: '',
    tipo_adquisicion: activo?.tipo_adquisicion || 'propiedad', fecha_compra: activo?.fecha_compra || '', precio_compra: activo?.precio_compra ?? '',
    numero_factura: activo?.numero_factura || '', fecha_fin_garantia: activo?.fecha_fin_garantia || '', codigo_barras: activo?.codigo_barras || '',
    ...(vehiculo ? Object.fromEntries(Object.entries(vehiculo).map(([k, v]) => [k, v ?? ''])) : {})
  });
  const guardar = enviar(async () => {
    if (!form.matricula.trim()) throw new Error('Pon la matrícula.');
    const veh = {
      matricula: form.matricula, bastidor: form.bastidor, marca: form.marca, modelo: form.modelo, tipo_vehiculo: form.tipo_vehiculo,
      fecha_matriculacion: form.fecha_matriculacion || null, combustible: form.combustible, capacidad_deposito: num(form.capacidad_deposito),
      km_actual: num(form.km_actual) ?? 0, distintivo_ambiental: form.distintivo_ambiental || null, mma_kg: num(form.mma_kg),
      conductor_operario_id: form.conductor_operario_id || null, conductor_nombre: form.conductor_nombre || null, notas: form.notas
    };
    const act = {
      tipo_adquisicion: form.tipo_adquisicion, fecha_compra: form.fecha_compra || null, precio_compra: num(form.precio_compra),
      numero_factura: form.numero_factura, fecha_fin_garantia: form.fecha_fin_garantia || null, codigo_barras: form.codigo_barras
    };
    if (nuevo) {
      const r = await api('/api/flota/vehiculos', { method: 'POST', body: { vehiculo: veh, activo: act } });
      showNotification?.(`Vehículo ${r.vehiculo.matricula} dado de alta`);
      onSaved(r.activo);
    } else {
      await api(`/api/flota/vehiculos/${vehiculo.id}`, { method: 'PATCH', body: veh });
      await api(`/api/flota/activos/${activo.id}`, { method: 'PATCH', body: act });
      showNotification?.('Ficha del vehículo guardada');
      onSaved(activo);
    }
  });
  return (
    <Modal titulo={nuevo ? 'Nuevo vehículo' : `Editar ${vehiculo.matricula}`} icon={Truck} onClose={onClose} onSubmit={guardar} busy={busy} error={error}>
      <Rejilla>
        <Campo label="Matrícula *"><input autoFocus value={form.matricula} onChange={set('matricula')} placeholder="1234 ABC" className={`${inputCls} uppercase`} /></Campo>
        <Campo label="Nº de bastidor (VIN)"><input value={form.bastidor} onChange={set('bastidor')} className={`${inputCls} uppercase`} /></Campo>
        <Campo label="Marca"><input value={form.marca} onChange={set('marca')} placeholder="Ford" className={inputCls} /></Campo>
        <Campo label="Modelo"><input value={form.modelo} onChange={set('modelo')} placeholder="Transit Custom" className={inputCls} /></Campo>
        <Campo label="Tipo" ayuda="Sirve para sugerir la próxima ITV">
          <select value={form.tipo_vehiculo} onChange={set('tipo_vehiculo')} className={inputCls}>
            {TIPOS_VEHICULO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Campo>
        <Campo label="Fecha de matriculación"><input type="date" value={form.fecha_matriculacion} onChange={set('fecha_matriculacion')} className={inputCls} /></Campo>
        <Campo label="Combustible">
          <select value={form.combustible} onChange={set('combustible')} className={inputCls}>
            {COMBUSTIBLES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Campo>
        <Campo label="Distintivo ambiental">
          <select value={form.distintivo_ambiental} onChange={set('distintivo_ambiental')} className={inputCls}>
            <option value="">—</option>
            {DISTINTIVOS.map((d) => <option key={d} value={d}>{d === 'sin' ? 'Sin distintivo' : d}</option>)}
          </select>
        </Campo>
        <Campo label="Kilómetros actuales"><input type="number" min="0" value={form.km_actual} onChange={set('km_actual')} className={inputCls} /></Campo>
        <Campo label="Depósito (litros)"><input type="number" min="0" step="0.1" value={form.capacidad_deposito} onChange={set('capacidad_deposito')} className={inputCls} /></Campo>
        <Campo label="Conductor habitual" full>
          <SelectOperario value={form.conductor_operario_id} vacio="Sin conductor fijo"
            onChange={(id, nombre) => setForm((f) => ({ ...f, conductor_operario_id: id, conductor_nombre: nombre }))} />
        </Campo>
      </Rejilla>
      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 pt-2">Compra</h4>
      <Rejilla>
        <Campo label="Propio, renting o leasing">
          <select value={form.tipo_adquisicion} onChange={set('tipo_adquisicion')} className={inputCls}>
            {ADQUISICION.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Campo>
        <Campo label="Fecha de compra"><input type="date" value={form.fecha_compra} onChange={set('fecha_compra')} className={inputCls} /></Campo>
        <Campo label="Precio (sin IVA)"><input type="number" step="0.01" min="0" value={form.precio_compra} onChange={set('precio_compra')} className={inputCls} /></Campo>
        <Campo label="Fin de la garantía"><input type="date" value={form.fecha_fin_garantia} onChange={set('fecha_fin_garantia')} className={inputCls} /></Campo>
        <Campo label="Notas" full><input value={form.notas} onChange={set('notas')} className={inputCls} /></Campo>
      </Rejilla>
    </Modal>
  );
}
