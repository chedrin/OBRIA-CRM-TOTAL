import React from 'react';
import { ClipboardCheck, ShieldCheck, Fuel, Wrench, CalendarClock, CircleDot, FileText } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, inputCls } from '../../services/avisosApi';
import {
  RESULTADOS_ITV, COBERTURAS, TIPOS_MANTENIMIENTO, TIPOS_PLAN, POSICIONES_NEUMATICO, TIPOS_DOCUMENTO, itvSugerida
} from '../../utils/flota';
import { Modal, Campo, Rejilla, useFormulario, CampoArchivo, subirArchivo, SelectObra, SelectOperario, SelectProveedor, num, hoy } from './flotaShared';

const CONFIG = {
  itv: { titulo: 'ITV', icon: ClipboardCheck, carpeta: 'vehiculos', archivo: 'informe_path', parent: 'vehicle_id' },
  seguro: { titulo: 'Seguro', icon: ShieldCheck, carpeta: 'vehiculos', archivo: 'poliza_path', parent: 'vehicle_id' },
  repostaje: { titulo: 'Repostaje', icon: Fuel, carpeta: 'repostajes', archivo: 'ticket_path', parent: 'vehicle_id' },
  mantenimiento: { titulo: 'Mantenimiento o reparación', icon: Wrench, carpeta: 'mantenimiento', archivo: 'factura_path', parent: 'asset_id' },
  plan: { titulo: 'Plan de mantenimiento preventivo', icon: CalendarClock, parent: 'asset_id' },
  neumatico: { titulo: 'Neumático', icon: CircleDot, parent: 'vehicle_id' },
  documento: { titulo: 'Documento', icon: FileText, carpeta: 'activos', archivo: 'file_path', parent: 'asset_id' }
};

const valoresIniciales = (tipo, { vehiculo, activo, planes }) => ({
  itv: { fecha_inspeccion: hoy(), resultado: 'favorable', proxima_itv: vehiculo ? itvSugerida(vehiculo, hoy()) || '' : '', estacion: '', km: vehiculo?.km_actual ?? '', coste: '', defectos: '' },
  seguro: { aseguradora: '', numero_poliza: '', cobertura: 'terceros', telefono_asistencia: '', fecha_inicio: hoy(), fecha_vencimiento: '', prima: '' },
  repostaje: { fecha: new Date().toISOString().slice(0, 16), km: vehiculo?.km_actual ?? '', litros: '', importe: '', iva_pct: '21', deposito_lleno: true, estacion: '', operario_id: vehiculo?.conductor_operario_id || '', operario_nombre: vehiculo?.conductor_nombre || '', obra_id: '' },
  mantenimiento: { tipo: vehiculo ? 'revision' : 'reparacion_mecanica', plan_id: (planes || []).length === 1 ? planes[0].id : '', fecha: hoy(), km: vehiculo?.km_actual ?? '', supplier_id: '', taller_nombre: '', mano_obra: '', piezas: '', iva_pct: '21', numero_factura: '', descripcion: '', obra_id: '' },
  plan: vehiculo
    ? { nombre: 'Cambio de aceite y filtros', tipo: 'revision', cada_km: '15000', cada_meses: '12', ultima_fecha: hoy(), ultimo_km: vehiculo.km_actual ?? '', activo: true }
    : { nombre: 'Revisión de seguridad', tipo: 'certificacion', cada_km: '', cada_meses: '12', ultima_fecha: activo?.fecha_compra || hoy(), ultimo_km: '', activo: true },
  neumatico: { posicion: 'delantero_izquierdo', marca: '', modelo: '', medida: '', fecha_montaje: hoy(), km_montaje: vehiculo?.km_actual ?? '', profundidad_mm: '', activo: true },
  documento: { tipo: vehiculo ? 'tarjeta_transporte' : 'certificado', nombre: '', numero: '', fecha_emision: '', fecha_caducidad: '' }
}[tipo]);

/**
 * Alta o edición de un registro (ITV, seguro, repostaje...). `registro` = el que se edita;
 * `renueva` = el que se renueva (seguro o documento: el anterior deja de contar).
 */
export function RegistroModal({ tipo, activo, vehiculo, planes = [], proveedores = [], registro, renueva, onClose, onSaved }) {
  const { showNotification } = useApp() || {};
  const cfg = CONFIG[tipo];
  const base = valoresIniciales(tipo, { vehiculo, activo, planes });
  const desdeRegistro = registro
    ? Object.fromEntries(Object.keys(base).map((k) => [k, registro[k] === null || registro[k] === undefined ? '' : (k === 'fecha' && tipo === 'repostaje' ? String(registro[k]).slice(0, 16) : registro[k])]))
    : renueva
      ? { ...base, ...Object.fromEntries(['aseguradora', 'cobertura', 'telefono_asistencia', 'tipo', 'nombre'].filter((k) => k in base && renueva[k]).map((k) => [k, renueva[k]])) }
      : {};
  const { form, set, setForm, busy, error, enviar } = useFormulario({ ...base, ...desdeRegistro, archivo: null });

  const guardar = enviar(async () => {
    const { archivo, ...resto } = form;
    const body = {};
    for (const [k, v] of Object.entries(resto)) body[k] = typeof v === 'string' && ['km', 'coste', 'prima', 'litros', 'importe', 'iva_pct', 'mano_obra', 'piezas', 'cada_km', 'cada_meses', 'ultimo_km', 'km_montaje', 'profundidad_mm'].includes(k) ? num(v) : (v === '' ? null : v);
    if (tipo === 'repostaje' && body.fecha) body.fecha = new Date(body.fecha).toISOString();
    if (archivo) body[cfg.archivo] = (await subirArchivo(archivo, cfg.carpeta)).path;
    if (archivo && tipo === 'documento') body.file_name = archivo.name;
    let saved;
    if (registro) {
      saved = await api(`/api/flota/registros/${tipo}/${registro.id}`, { method: 'PATCH', body });
    } else {
      body[cfg.parent] = cfg.parent === 'vehicle_id' ? vehiculo.id : activo.id;
      if (renueva) body.renueva_id = renueva.id;
      saved = await api(`/api/flota/registros/${tipo}`, { method: 'POST', body });
    }
    showNotification?.(`${cfg.titulo} guardado`);
    onSaved(saved);
  });

  const sugerir = () => {
    const s = vehiculo && itvSugerida(vehiculo, form.fecha_inspeccion || null);
    if (s) setForm((f) => ({ ...f, proxima_itv: s }));
  };

  const precioLitro = tipo === 'repostaje' && num(form.litros) > 0 && num(form.importe) > 0 ? (num(form.importe) / num(form.litros)).toFixed(3) : null;
  const totalMant = tipo === 'mantenimiento' ? ((num(form.mano_obra) || 0) + (num(form.piezas) || 0)) * (1 + (num(form.iva_pct) || 0) / 100) : 0;

  return (
    <Modal titulo={`${registro ? 'Editar' : renueva ? 'Renovar' : 'Nuevo'}: ${cfg.titulo.toLowerCase()}`} icon={cfg.icon} ancho="max-w-xl"
      onClose={onClose} onSubmit={guardar} busy={busy} error={error}>
      {tipo === 'itv' && (
        <Rejilla>
          <Campo label="Fecha de la inspección" ayuda="Vacía si solo apuntas la próxima"><input type="date" value={form.fecha_inspeccion} onChange={set('fecha_inspeccion')} className={inputCls} /></Campo>
          <Campo label="Resultado">
            <select value={form.resultado} onChange={set('resultado')} className={inputCls}>
              {RESULTADOS_ITV.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Campo>
          <Campo label={form.resultado === 'desfavorable' ? 'Fecha límite para corregir *' : 'Próxima ITV (caducidad) *'}
            ayuda={vehiculo?.fecha_matriculacion ? <button type="button" onClick={sugerir} className="text-amber-400 font-semibold">Calcular según antigüedad y tipo</button> : 'Pon la fecha de matriculación en la ficha para calcularla'}>
            <input type="date" value={form.proxima_itv} onChange={set('proxima_itv')} className={inputCls} required />
          </Campo>
          <Campo label="Kilómetros"><input type="number" min="0" value={form.km} onChange={set('km')} className={inputCls} /></Campo>
          <Campo label="Estación"><input value={form.estacion} onChange={set('estacion')} className={inputCls} /></Campo>
          <Campo label="Tasa pagada (con IVA)"><input type="number" step="0.01" min="0" value={form.coste} onChange={set('coste')} className={inputCls} /></Campo>
          <Campo label="Defectos / observaciones" full><textarea rows={2} value={form.defectos} onChange={set('defectos')} className={inputCls} /></Campo>
          <Campo label="Informe" full><CampoArchivo file={form.archivo} onChange={set('archivo')} actual={registro?.informe_path} /></Campo>
        </Rejilla>
      )}

      {tipo === 'seguro' && (
        <Rejilla>
          <Campo label="Aseguradora *"><input value={form.aseguradora} onChange={set('aseguradora')} className={inputCls} required /></Campo>
          <Campo label="Nº de póliza *"><input value={form.numero_poliza} onChange={set('numero_poliza')} className={inputCls} required /></Campo>
          <Campo label="Cobertura">
            <select value={form.cobertura} onChange={set('cobertura')} className={inputCls}>
              {COBERTURAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Campo>
          <Campo label="Teléfono de asistencia en carretera"><input type="tel" value={form.telefono_asistencia} onChange={set('telefono_asistencia')} className={inputCls} /></Campo>
          <Campo label="Inicio *"><input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} className={inputCls} required /></Campo>
          <Campo label="Vencimiento / renovación *"><input type="date" value={form.fecha_vencimiento} onChange={set('fecha_vencimiento')} className={inputCls} required /></Campo>
          <Campo label="Prima anual (€)"><input type="number" step="0.01" min="0" value={form.prima} onChange={set('prima')} className={inputCls} /></Campo>
          <Campo label="Póliza"><CampoArchivo file={form.archivo} onChange={set('archivo')} actual={registro?.poliza_path} /></Campo>
          {renueva && <p className="sm:col-span-2 text-[11px] text-slate-500">La póliza {renueva.numero_poliza} dejará de contar para los avisos.</p>}
        </Rejilla>
      )}

      {tipo === 'repostaje' && (
        <Rejilla>
          <Campo label="Fecha y hora"><input type="datetime-local" value={form.fecha} onChange={set('fecha')} className={inputCls} /></Campo>
          <Campo label="Km del cuentakilómetros *"><input type="number" min="0" value={form.km} onChange={set('km')} className={inputCls} required /></Campo>
          <Campo label="Litros *"><input type="number" step="0.01" min="0" value={form.litros} onChange={set('litros')} className={inputCls} required /></Campo>
          <Campo label="Importe del ticket (con IVA) *" ayuda={precioLitro ? `${precioLitro.replace('.', ',')} €/l` : undefined}>
            <input type="number" step="0.01" min="0" value={form.importe} onChange={set('importe')} className={inputCls} required />
          </Campo>
          <Campo label="Gasolinera"><input value={form.estacion} onChange={set('estacion')} className={inputCls} /></Campo>
          <Campo label="Operario">
            <SelectOperario value={form.operario_id} onChange={(id, nombre) => setForm((f) => ({ ...f, operario_id: id, operario_nombre: nombre }))} />
          </Campo>
          <Campo label="Imputar a la obra" ayuda="Sale en Gastos vs ingresos de esa obra"><SelectObra value={form.obra_id} onChange={set('obra_id')} /></Campo>
          <Campo label="Ticket"><CampoArchivo file={form.archivo} onChange={set('archivo')} actual={registro?.ticket_path} label="Foto del ticket" /></Campo>
          <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={!!form.deposito_lleno} onChange={set('deposito_lleno')} /> Depósito lleno (necesario para calcular el consumo)
          </label>
        </Rejilla>
      )}

      {tipo === 'mantenimiento' && (
        <Rejilla>
          <Campo label="Tipo">
            <select value={form.tipo} onChange={set('tipo')} className={inputCls}>
              {TIPOS_MANTENIMIENTO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Campo>
          <Campo label="Cumple el plan" ayuda="Reinicia el aviso de ese plan">
            <select value={form.plan_id} onChange={set('plan_id')} className={inputCls}>
              <option value="">Ninguno</option>
              {planes.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Fecha"><input type="date" value={form.fecha} onChange={set('fecha')} className={inputCls} /></Campo>
          {vehiculo && <Campo label="Kilómetros"><input type="number" min="0" value={form.km} onChange={set('km')} className={inputCls} /></Campo>}
          <Campo label="Taller">
            <SelectProveedor value={form.supplier_id} proveedores={proveedores} categoria="taller" vacio="Otro / sin registrar"
              onChange={(id, nombre) => setForm((f) => ({ ...f, supplier_id: id, taller_nombre: id ? nombre : f.taller_nombre }))} />
          </Campo>
          {!form.supplier_id && <Campo label="Nombre del taller"><input value={form.taller_nombre} onChange={set('taller_nombre')} className={inputCls} /></Campo>}
          <Campo label="Mano de obra (sin IVA)"><input type="number" step="0.01" min="0" value={form.mano_obra} onChange={set('mano_obra')} className={inputCls} /></Campo>
          <Campo label="Piezas (sin IVA)" ayuda={totalMant ? `Total con IVA: ${totalMant.toFixed(2).replace('.', ',')} €` : undefined}>
            <input type="number" step="0.01" min="0" value={form.piezas} onChange={set('piezas')} className={inputCls} />
          </Campo>
          <Campo label="Nº de factura"><input value={form.numero_factura} onChange={set('numero_factura')} className={inputCls} /></Campo>
          <Campo label="Imputar a la obra" ayuda="Solo si la reparación es por esa obra"><SelectObra value={form.obra_id} onChange={set('obra_id')} /></Campo>
          <Campo label="Trabajos realizados *" full><textarea rows={2} value={form.descripcion} onChange={set('descripcion')} className={inputCls} required /></Campo>
          <Campo label="Factura" full><CampoArchivo file={form.archivo} onChange={set('archivo')} actual={registro?.factura_path} /></Campo>
        </Rejilla>
      )}

      {tipo === 'plan' && (
        <Rejilla>
          <Campo label="Qué hay que hacer *" full><input value={form.nombre} onChange={set('nombre')} className={inputCls} required /></Campo>
          <Campo label="Tipo">
            <select value={form.tipo} onChange={set('tipo')} className={inputCls}>
              {TIPOS_PLAN.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Campo>
          {vehiculo && <Campo label="Cada (km)"><input type="number" min="1" value={form.cada_km} onChange={set('cada_km')} placeholder="15000" className={inputCls} /></Campo>}
          <Campo label="Cada (meses)"><input type="number" min="1" value={form.cada_meses} onChange={set('cada_meses')} placeholder="12" className={inputCls} /></Campo>
          <Campo label="Última vez (fecha)"><input type="date" value={form.ultima_fecha} onChange={set('ultima_fecha')} className={inputCls} /></Campo>
          {vehiculo && <Campo label="Última vez (km)"><input type="number" min="0" value={form.ultimo_km} onChange={set('ultimo_km')} className={inputCls} /></Campo>}
          <p className="sm:col-span-2 text-[11px] text-slate-500">Avisa con lo que llegue antes: los km o la fecha. Al apuntar un mantenimiento que cumple este plan, el contador vuelve a empezar.</p>
        </Rejilla>
      )}

      {tipo === 'neumatico' && (
        <Rejilla>
          <Campo label="Posición">
            <select value={form.posicion} onChange={set('posicion')} className={inputCls}>
              {POSICIONES_NEUMATICO.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Campo>
          <Campo label="Medida *"><input value={form.medida} onChange={set('medida')} placeholder="215/65 R16C 109T" className={inputCls} required /></Campo>
          <Campo label="Marca *"><input value={form.marca} onChange={set('marca')} className={inputCls} required /></Campo>
          <Campo label="Modelo"><input value={form.modelo} onChange={set('modelo')} className={inputCls} /></Campo>
          <Campo label="Fecha de montaje"><input type="date" value={form.fecha_montaje} onChange={set('fecha_montaje')} className={inputCls} /></Campo>
          <Campo label="Km al montarlo *"><input type="number" min="0" value={form.km_montaje} onChange={set('km_montaje')} className={inputCls} required /></Campo>
          <Campo label="Profundidad del dibujo (mm)" ayuda="Mínimo legal 1,6 mm"><input type="number" step="0.1" min="0" value={form.profundidad_mm} onChange={set('profundidad_mm')} className={inputCls} /></Campo>
          {registro && (
            <label className="flex items-center gap-2 text-xs text-slate-300 self-end pb-2">
              <input type="checkbox" checked={!!form.activo} onChange={set('activo')} /> Montado
            </label>
          )}
        </Rejilla>
      )}

      {tipo === 'documento' && (
        <Rejilla>
          <Campo label="Tipo">
            <select value={form.tipo} onChange={set('tipo')} className={inputCls}>
              {TIPOS_DOCUMENTO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Campo>
          <Campo label="Nombre *"><input value={form.nombre} onChange={set('nombre')} placeholder="Tarjeta de transporte MDL" className={inputCls} required /></Campo>
          <Campo label="Número"><input value={form.numero} onChange={set('numero')} className={inputCls} /></Campo>
          <Campo label="Fecha de emisión"><input type="date" value={form.fecha_emision} onChange={set('fecha_emision')} className={inputCls} /></Campo>
          <Campo label="Caduca el" ayuda="Vacío si no caduca. Si caduca, avisa antes."><input type="date" value={form.fecha_caducidad} onChange={set('fecha_caducidad')} className={inputCls} /></Campo>
          <Campo label="Archivo"><CampoArchivo file={form.archivo} onChange={set('archivo')} actual={registro?.file_path} /></Campo>
        </Rejilla>
      )}
    </Modal>
  );
}
