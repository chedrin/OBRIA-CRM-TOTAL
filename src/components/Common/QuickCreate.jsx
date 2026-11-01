import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Loader2, Truck, HardHat, Briefcase } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, inputCls, btnPrimary, btnGhost } from '../../services/avisosApi';
import ModalOverlay from './ModalOverlay';
import FichaSubcontrataForm from '../Subcontratas/FichaSubcontrataForm';
import { fasesObraPorDefecto } from '../../utils/obraDefaults';

// Alta rápida desde cualquier desplegable: "Crear nuevo proveedor", "Crear nueva subcontrata"...
// El modal de alta se abre encima del que estaba abierto (que no se desmonta, así conserva lo
// escrito) y al guardar devuelve el registro nuevo para dejarlo elegido.
//
//   const { crear } = useQuickCreate();
//   const nuevo = await crear('proveedor', { name: 'Texto ya escrito' }); // null si se cancela
//
// En un <select>: <OpcionesCrear tipos={['obra']} /> al final y onChange={conCrear(crear, setValor)}.

export const TIPOS_CREAR = {
  proveedor: { label: 'Crear nuevo proveedor', valor: (r) => r.id, nombre: (r) => r.name },
  subcontrata: { label: 'Crear nueva subcontrata', valor: (r) => r.id, nombre: (r) => r.nombreComercial || r.razonSocial },
  obra: { label: 'Crear nueva obra', valor: (r) => r.id, nombre: (r) => r.titulo },
  obrero: { label: 'Crear nuevo operario', valor: (r) => r.obreroId, nombre: (r) => `${r.nombre} ${r.apellidos || ''}`.trim() }
};

const PREFIJO = '__crear__:';
const Z_BASE = 80;

const QuickCreateContext = createContext(null);

export function useQuickCreate() {
  const ctx = useContext(QuickCreateContext);
  // Sin proveedor (tests o vistas aisladas) la opción no hace nada.
  return ctx || { crear: async () => null };
}

/** Opciones "➕ Crear nuevo…" para poner al final de un <select>. */
export function OpcionesCrear({ tipos }) {
  return tipos.map((t) => (
    <option key={t} value={`${PREFIJO}${t}`}>➕ {TIPOS_CREAR[t].label}</option>
  ));
}

/**
 * onChange para un <select> con OpcionesCrear: si se elige "Crear…", abre el alta y, al guardar,
 * llama a onValor con el valor del registro nuevo (por defecto su id; `valor` lo cambia por tipo).
 */
export function conCrear(crear, onValor, valor = {}) {
  return (e) => {
    const v = e.target.value;
    if (!v.startsWith(PREFIJO)) { onValor(v); return; }
    const tipo = v.slice(PREFIJO.length);
    crear(tipo).then((r) => { if (r) onValor((valor[tipo] || TIPOS_CREAR[tipo].valor)(r), r); });
  };
}

const EVENTO = 'obramaster:registro-creado';

/** Avisa a las listas que guardan su propia copia (p. ej. proveedores de /api/suppliers). */
export function useAlCrear(tipo, cb) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    const h = (e) => { if (e.detail?.tipo === tipo) ref.current(e.detail.registro); };
    window.addEventListener(EVENTO, h);
    return () => window.removeEventListener(EVENTO, h);
  }, [tipo]);
}

export function QuickCreateProvider({ children }) {
  const [pila, setPila] = useState([]);
  const sec = useRef(0);

  const crear = useCallback((tipo, inicial = {}) => new Promise((resolve) => {
    if (!TIPOS_CREAR[tipo]) { resolve(null); return; }
    sec.current += 1;
    setPila((p) => [...p, { key: sec.current, tipo, inicial, resolve }]);
  }), []);

  const cerrar = (key, registro) => {
    const item = pila.find((x) => x.key === key);
    if (registro && item) window.dispatchEvent(new CustomEvent(EVENTO, { detail: { tipo: item.tipo, registro } }));
    setPila((p) => {
      const item = p.find((x) => x.key === key);
      item?.resolve(registro || null);
      return p.filter((x) => x.key !== key);
    });
  };

  const value = useMemo(() => ({ crear }), [crear]);

  return (
    <QuickCreateContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {pila.map((item, i) => (
          <ModalAlta key={item.key} item={item} zIndex={Z_BASE + i * 2} onClose={(r) => cerrar(item.key, r)} />
        ))}
      </AnimatePresence>
    </QuickCreateContext.Provider>
  );
}

function ModalAlta({ item, zIndex, onClose }) {
  const { addSubcontractor } = useApp();
  if (item.tipo === 'subcontrata') {
    return (
      <FichaSubcontrataForm
        inicial={item.inicial}
        zIndex={zIndex}
        onSave={(datos) => onClose(addSubcontractor(datos))}
        onClose={() => onClose(null)}
      />
    );
  }
  if (item.tipo === 'proveedor') return <ProveedorAlta inicial={item.inicial} zIndex={zIndex} onClose={onClose} />;
  if (item.tipo === 'obra') return <ObraAlta inicial={item.inicial} zIndex={zIndex} onClose={onClose} />;
  if (item.tipo === 'obrero') return <OperarioAlta inicial={item.inicial} zIndex={zIndex} onClose={onClose} />;
  return null;
}

function Marco({ zIndex, icon: Icon, titulo, nota, onClose, onSubmit, busy, error, children }) {
  return (
    <ModalOverlay style={{ zIndex }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4">
      <form onSubmit={onSubmit} className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-3 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2"><Icon className="w-5 h-5 text-amber-400" />{titulo}</h3>
          <button type="button" aria-label="Cerrar" onClick={() => onClose(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
        {nota && <p className="text-xs text-slate-400">{nota}</p>}
        <div className="grid sm:grid-cols-2 gap-2 text-xs">{children}</div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={() => onClose(null)} className={btnGhost}>Cancelar</button>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Guardar y volver</button>
        </div>
      </form>
    </ModalOverlay>
  );
}

const Campo = ({ label, full, children }) => (
  <label className={`text-slate-400 ${full ? 'sm:col-span-2' : ''}`}>{label}<div className="mt-1">{children}</div></label>
);

function ProveedorAlta({ inicial, zIndex, onClose }) {
  const { showNotification } = useApp();
  const [form, setForm] = useState({ name: '', contact_name: '', email: '', phone: '', categories: '', notes: '', ...inicial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre es obligatorio.'); return; }
    setBusy(true);
    setError('');
    try {
      const body = { ...form, name: form.name.trim(), categories: String(form.categories || '').split(',').map((c) => c.trim()).filter(Boolean) };
      const saved = await api('/api/suppliers', { method: 'POST', body });
      showNotification?.(`Proveedor "${saved.name}" dado de alta`);
      onClose(saved);
    } catch (err) {
      setError(`No se pudo guardar el proveedor: ${err.message}`);
      setBusy(false);
    }
  };

  return (
    <Marco zIndex={zIndex} icon={Truck} titulo="Nuevo proveedor" onClose={onClose} onSubmit={submit} busy={busy} error={error}
      nota="Queda guardado en Avisos > Proveedores para los pedidos y los gastos.">
      <Campo label="Nombre *" full><input autoFocus value={form.name} onChange={set('name')} placeholder="Ej: Almacén Saltoki" className={inputCls} /></Campo>
      <Campo label="Persona de contacto"><input value={form.contact_name} onChange={set('contact_name')} className={inputCls} /></Campo>
      <Campo label="Teléfono"><input value={form.phone} onChange={set('phone')} className={inputCls} /></Campo>
      <Campo label="Correo para pedidos" full><input type="email" value={form.email} onChange={set('email')} className={inputCls} /></Campo>
      <Campo label="Categorías (separadas por comas)" full><input value={form.categories} onChange={set('categories')} placeholder="fontanería, áridos…" className={inputCls} /></Campo>
      <Campo label="Notas" full><textarea rows={2} value={form.notes} onChange={set('notes')} className={inputCls} /></Campo>
    </Marco>
  );
}

const dia = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().split('T')[0];

function ObraAlta({ inicial, zIndex, onClose }) {
  const { addObra } = useApp();
  const [form, setForm] = useState({
    titulo: '', cliente: '', telefono: '', email: '', direccion: '', tipo: 'Reforma Integral Vivienda',
    presupuestoTotal: 30000, margenEsperadoPct: 35, fechaInicio: dia(), fechaFinEstimada: dia(60), ...inicial
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.cliente.trim()) { setError('Título y cliente son obligatorios.'); return; }
    const obra = addObra({
      ...form,
      titulo: form.titulo.trim(),
      cliente: form.cliente.trim(),
      presupuestoId: null,
      notas: '',
      fechaEntregaCliente: form.fechaFinEstimada,
      presupuestoTotal: Number(form.presupuestoTotal) || 0,
      margenEsperadoPct: Number(form.margenEsperadoPct) || 0,
      estado: 'en_curso',
      fases: fasesObraPorDefecto()
    });
    onClose(obra);
  };

  return (
    <Marco zIndex={zIndex} icon={Briefcase} titulo="Nueva obra" onClose={onClose} onSubmit={submit} error={error}
      nota="Alta rápida con las fases estándar. El resto de datos se completa luego en la ficha de la obra.">
      <Campo label="Título de la obra *" full><input autoFocus value={form.titulo} onChange={set('titulo')} placeholder="Ej: Reforma baño C/ Goya" className={inputCls} /></Campo>
      <Campo label="Cliente *"><input value={form.cliente} onChange={set('cliente')} className={inputCls} /></Campo>
      <Campo label="Teléfono"><input value={form.telefono} onChange={set('telefono')} className={inputCls} /></Campo>
      <Campo label="Dirección" full><input value={form.direccion} onChange={set('direccion')} className={inputCls} /></Campo>
      <Campo label="Presupuesto (€)"><input type="number" min="0" value={form.presupuestoTotal} onChange={set('presupuestoTotal')} className={inputCls} /></Campo>
      <Campo label="Margen esperado (%)"><input type="number" value={form.margenEsperadoPct} onChange={set('margenEsperadoPct')} className={inputCls} /></Campo>
      <Campo label="Inicio"><input type="date" value={form.fechaInicio} onChange={set('fechaInicio')} className={inputCls} /></Campo>
      <Campo label="Fin estimado"><input type="date" value={form.fechaFinEstimada} onChange={set('fechaFinEstimada')} className={inputCls} /></Campo>
    </Marco>
  );
}

function OperarioAlta({ inicial, zIndex, onClose }) {
  const { addEmployee } = useApp();
  const [form, setForm] = useState({ nombre: '', apellidos: '', dni: '', telefono: '', email: '', especialidad: 'Albañilería & Alicatados', categoria: 'Oficial 1ª', ...inicial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.dni.trim()) { setError('Nombre y DNI/NIE son obligatorios.'); return; }
    setBusy(true);
    const emp = await addEmployee({ ...form, nombre: form.nombre.trim(), apellidos: form.apellidos.trim(), dni: form.dni.trim().toUpperCase() }, null);
    onClose(emp);
  };

  return (
    <Marco zIndex={zIndex} icon={HardHat} titulo="Nuevo operario" onClose={onClose} onSubmit={submit} busy={busy} error={error}
      nota="Alta rápida en plantilla. Contrato, nómina y acceso al portal móvil se completan luego en Empleados.">
      <Campo label="Nombre *"><input autoFocus value={form.nombre} onChange={set('nombre')} className={inputCls} /></Campo>
      <Campo label="Apellidos"><input value={form.apellidos} onChange={set('apellidos')} className={inputCls} /></Campo>
      <Campo label="DNI / NIE *"><input value={form.dni} onChange={set('dni')} className={inputCls} /></Campo>
      <Campo label="Teléfono"><input value={form.telefono} onChange={set('telefono')} className={inputCls} /></Campo>
      <Campo label="Categoría"><input value={form.categoria} onChange={set('categoria')} className={inputCls} /></Campo>
      <Campo label="Especialidad"><input value={form.especialidad} onChange={set('especialidad')} className={inputCls} /></Campo>
    </Marco>
  );
}
