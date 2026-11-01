import React, { useState } from 'react';
import BotonVolver from '../Common/BotonVolver';
import BarraProgreso from '../Common/BarraProgreso';
import { useApp } from '../../context/AppContext';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Package,
  HardHat,
  FileText,
  DollarSign,
  MapPin,
  Phone,
  User,
  Star,
  Check,
  Sparkles,
  FolderOpen,
  Tag,
  Edit2,
  Trash2,
  PlusCircle,
  Download,
  ChevronDown,
  Send,
  PencilRuler
} from 'lucide-react';
import CroquisEditorModal from '../Croquis/CroquisEditorModal';
import CroquisLienzo from '../Croquis/CroquisLienzo';
import { buildCroquisPdf } from '../../utils/croquisPdf';
import { normalizarCroquis, resumenSuperficies } from '../../utils/croquisPlano';
import TaskProgressSelector from '../PortalObrero/TaskProgressSelector';
import { calculateObraScheduling } from '../../services/obraBudgetSyncService';
import AiImprovementControl from '../Common/AiImprovementControl';
import PartidaPrecioModal from '../Common/PartidaPrecioModal';
import NuevoPedidoModal from '../Avisos/NuevoPedidoModal';
import HistorialObra from './HistorialObra';
import ArchivosObra from './ArchivosObra';
import ModalOverlay from '../Common/ModalOverlay';
import BarraFacturacion from '../Facturas/BarraFacturacion';
import GastosIngresosObra from './GastosIngresosObra';
import { facturacionObra } from '../../utils/facturadoPresupuesto';
import { AnimatePresence } from 'motion/react';
import Pestanas from '../Common/Pestanas';

export default function ObraDetail({ obraId, onBack, abrirCroquis = false }) {
  const {
    obras,
    updateObra,
    addMaterialToObra,
    updateMaterialStatus,
    obreros,
    employees,
    users,
    presupuestos,
    facturas,
    facturacionActivada,
    facturasProveedores,
    basePrecios,
    updateObraBasePrecioItem,
    addObraBasePrecioItem,
    deleteObraBasePrecioItem,
    setActiveTab,
    setSelectedPresupuestoId,
    setPdfModalData,
    guardarCroquisObra,
    empresaConfig,
    broadcastAdminTask,
    broadcastAdminAlert,
    broadcastWorkerProgress
  } = useApp();

  const obra = obras.find(o => o.id === obraId);
  const [detailTab, setDetailTab] = useState('fases'); // fases, diario, materiales, economico, gastos_ingresos, documentos, catalogo_precios, equipo
  const [showCroquis, setShowCroquis] = useState(abrirCroquis);
  const [expandedFases, setExpandedFases] = useState({});
  const [editingFase, setEditingFase] = useState(null); // copia de la fase en edición

  // Operarios disponibles: fichas de operario, empleados de RRHH y usuarios con rol obrero (sin bajas ni duplicados).
  const operariosDisponibles = (() => {
    const seen = new Set();
    const list = [];
    const add = (nombre, detalle) => {
      const clean = (nombre || '').trim();
      if (!clean || seen.has(clean.toLowerCase())) return;
      seen.add(clean.toLowerCase());
      list.push({ nombre: clean, detalle: (detalle || '').split('/')[0].trim() });
    };
    (obreros || []).filter(o => o.estado !== 'baja').forEach(o => add(o.nombre, o.puesto || o.especialidad));
    (employees || []).filter(e => e.estado !== 'baja').forEach(e => add(`${e.nombre || ''} ${e.apellidos || ''}`, e.especialidad || e.categoria));
    (users || []).filter(u => u.role === 'obrero' && u.isActive !== false).forEach(u => add(u.fullName || u.username, u.trade));
    return list;
  })();

  const toggleFaseExpand = (faseId) => {
    setExpandedFases(prev => ({
      ...prev,
      [faseId]: !prev[faseId]
    }));
  };

  // New Material State
  const [showNewMaterialModal, setShowNewMaterialModal] = useState(false);
  // Materiales que se van a pedir al proveedor (null: modal cerrado).
  const [pedidoMateriales, setPedidoMateriales] = useState(null);
  const [materialForm, setMaterialForm] = useState({
    concepto: '',
    cantidad: 1,
    unidad: 'sacos',
    costeEstimado: 0,
    proveedor: 'Obramat'
  });

  // Realtime Admin Task & Alert Modal States
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({
    nombre: '',
    responsable: '',
    dias: 4
  });

  const openNewTaskModal = () => {
    setNewTaskForm(prev => ({ ...prev, responsable: prev.responsable || operariosDisponibles[0]?.nombre || '' }));
    setShowNewTaskModal(true);
  };

  const startEditFase = (fase) => {
    setEditingFase({ ...fase, tareas: (fase.tareas || []).map(t => ({ ...t })) });
    setExpandedFases(prev => ({ ...prev, [fase.id]: true }));
  };

  const updateEditingTarea = (tareaId, changes) => {
    setEditingFase(prev => ({ ...prev, tareas: prev.tareas.map(t => (t.id === tareaId ? { ...t, ...changes } : t)) }));
  };

  const handleSaveFase = () => {
    if (!editingFase?.nombre?.trim()) return;
    const original = (obra.fases || []).find(f => f.id === editingFase.id) || {};
    const tareas = editingFase.tareas.map(t => {
      const prev = (original.tareas || []).find(o => o.id === t.id) || {};
      // Marca lo editado a mano para que una resincronización con el presupuesto no lo pise.
      const tituloEditado = prev.tituloEditado || prev.titulo !== t.titulo;
      return { ...t, tituloEditado };
    });
    const fases = (obra.fases || []).map(f => (f.id === editingFase.id
      ? { ...editingFase, tareas, nombreEditado: original.nombreEditado || original.nombre !== editingFase.nombre }
      : f));
    updateObra(obra.id, { fases });
    setEditingFase(null);
  };

  // Fechas de la obra en edición: inicio, fin planificado y fecha de entrega comprometida con el cliente.
  const [editingFechas, setEditingFechas] = useState(null);

  const startEditFechas = () => setEditingFechas({
    fechaInicio: obra.fechaInicio || '',
    fechaFinEstimada: obra.fechaFinEstimada || '',
    fechaEntregaCliente: obra.fechaEntregaCliente || obra.fechaFinEstimada || ''
  });

  const handleSaveFechas = () => {
    if (!editingFechas?.fechaInicio) return;
    updateObra(obra.id, editingFechas);
    setEditingFechas(null);
  };

  const [showNewAlertModal, setShowNewAlertModal] = useState(false);
  const [alertForm, setAlertForm] = useState({
    titulo: 'Instrucción Técnica / Seguridad',
    descripcion: '',
    tipo: 'seguridad',
    prioridad: 'alta'
  });

  if (!obra) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Obra no encontrada.</p>
        <BotonVolver onClick={onBack} className="mt-4">Volver al listado de obras</BotonVolver>
      </div>
    );
  }

  // Related Data
  const obraPresupuesto = presupuestos.find(p => p.id === obra.presupuestoId);
  const croquisCabecera = {
    numero: obraPresupuesto?.numero || '',
    fecha: obraPresupuesto?.fecha || '',
    cliente: obra.cliente,
    nif: obraPresupuesto?.nif || '',
    obraTitulo: `${obra.codigo ? `${obra.codigo} · ` : ''}${obra.titulo}`,
    direccion: obra.direccion
  };
  const croquisPlanObra = obra.croquis?.plan?.rooms?.length ? normalizarCroquis(obra.croquis.plan) : null;
  const obraFacturas = facturas.filter(f => f.obraId === obra.id);
  const estadoFacturacionObra = facturacionActivada ? facturacionObra(obra, presupuestos, facturas) : null;
  const obraFacturasProveedores = (facturasProveedores || []).filter(f => f.obraId === obra.id);
  const totalFacturadoObra = obraFacturas.reduce((s, f) => s + f.totalFactura, 0);
  const totalCobradoObra = obraFacturas.filter(f => f.estadoCobro === 'cobrada').reduce((s, f) => s + f.totalFactura, 0);

  // Price Catalog for this specific Obra
  const catalogList = obra.catalogoPrecios && obra.catalogoPrecios.length > 0 ? obra.catalogoPrecios : basePrecios;

  // New Price Item State for Modal / Inline Add
  const [showNewPriceModal, setShowNewPriceModal] = useState(false);
  const [editingPriceItem, setEditingPriceItem] = useState(null);

  const handleOpenEditPrice = (item) => {
    setEditingPriceItem(item);
    setShowNewPriceModal(true);
  };

  const handleSavePriceItem = (partida) => {
    if (editingPriceItem) {
      updateObraBasePrecioItem(obra.id, editingPriceItem.id, partida);
    } else {
      addObraBasePrecioItem(obra.id, partida);
    }
    setShowNewPriceModal(false);
    setEditingPriceItem(null);
  };

  const handleDeletePriceItem = (item) => {
    if (!window.confirm(`¿Eliminar la partida ${item.codigo} del catálogo de esta obra?`)) return;
    deleteObraBasePrecioItem(obra.id, item.id);
  };


  const handleToggleFase = (faseId) => {
    const updatedFases = (obra.fases || []).map(f => {
      if (f.id === faseId) {
        const isComp = f.progreso === 100;
        return {
          ...f,
          progreso: isComp ? 0 : 100,
          estado: isComp ? 'pendiente' : 'completada'
        };
      }
      return f;
    });

    // Recalculate global progress
    const totalProg = updatedFases.reduce((s, f) => s + f.progreso, 0);
    const newGlobalProg = Math.round(totalProg / updatedFases.length);

    updateObra(obra.id, { fases: updatedFases, progreso: newGlobalProg });
  };


  const handleSaveMaterial = (e) => {
    e.preventDefault();
    if (!materialForm.concepto) return;

    addMaterialToObra(obra.id, {
      concepto: materialForm.concepto,
      cantidad: Number(materialForm.cantidad),
      unidad: materialForm.unidad,
      costeEstimado: Number(materialForm.costeEstimado),
      proveedor: materialForm.proveedor,
      estado: 'pendiente'
    });

    setShowNewMaterialModal(false);
    setMaterialForm({
      concepto: '',
      cantidad: 1,
      unidad: 'sacos',
      costeEstimado: 0,
      proveedor: 'Obramat'
    });
  };

  const handleSaveNewTask = (e) => {
    e.preventDefault();
    if (!newTaskForm.nombre) return;
    broadcastAdminTask(obra.id, newTaskForm);
    setShowNewTaskModal(false);
    setNewTaskForm({ nombre: '', responsable: newTaskForm.responsable, dias: 4 });
  };

  const handleSaveNewAlert = (e) => {
    e.preventDefault();
    if (!alertForm.descripcion) return;
    broadcastAdminAlert(obra.id, {
      ...alertForm,
      obraCodigo: obra.codigo,
      obraTitulo: obra.titulo
    });
    setShowNewAlertModal(false);
    setAlertForm({
      titulo: 'Instrucción Técnica / Seguridad',
      descripcion: '',
      tipo: 'seguridad',
      prioridad: 'alta'
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <BotonVolver onClick={onBack}>Volver al listado de obras</BotonVolver>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            obra.estado === 'en_curso'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : obra.estado === 'finalizada'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-800 text-slate-300'
          }`}>
            {obra.estado.replace('_', ' ')}
          </span>
          <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md font-mono">{obra.codigo}</span>
        </div>
      </div>

      {/* Main Obra Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-white">{obra.titulo}</h1>
            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <MapPin className="w-4 h-4 text-amber-400" />
                {obra.direccion}
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <User className="w-4 h-4 text-amber-400" />
                {obra.cliente}
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <Phone className="w-4 h-4 text-emerald-400" />
                {obra.telefono}
              </span>
            </div>
            {obra.notas && (
              <p className="text-xs text-slate-400 max-w-3xl pt-1 italic">
                "{obra.notas}"
              </p>
            )}
          </div>

          {/* Métricas y Planificación IA arriba; debajo, el croquis de la obra si lo tiene */}
          <div className="flex flex-col gap-3 shrink-0 lg:max-w-[46rem]">
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center gap-4">
              <div className="text-center px-2">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Presupuesto</span>
                <span className="text-lg font-black text-white">{obra.presupuestoTotal?.toLocaleString('es-ES')} €</span>
              </div>
              <div className="w-px h-8 bg-slate-800"></div>
              <div className="text-center px-2">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Coste Real</span>
                <span className="text-lg font-black text-slate-200">{obra.costeRealActual?.toLocaleString('es-ES')} €</span>
              </div>
              <div className="w-px h-8 bg-slate-800"></div>
              <div className="text-center px-2">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Margen</span>
                <span className="text-lg font-black text-emerald-400">{obra.margenRealPct || 35}%</span>
              </div>
            </div>

            {(() => {
              const sched = calculateObraScheduling(obra, obras);
              return (
                <div className="bg-slate-900 p-2.5 rounded-lg border border-amber-500/30 text-[11px] space-y-1 w-full sm:w-auto">
                  <div className="flex items-center justify-between font-bold text-amber-400 gap-2">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>PLANIFICACIÓN IA</span>
                    </span>
                    <span>{sched.estadoRiesgo}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-300">
                    <span>Fin previsto: <strong>{sched.fechaPrevistaFormatted}</strong></span>
                    <span>Días rem: <strong className="text-amber-400">{sched.diasRestantes}d</strong></span>
                  </div>
                </div>
              );
            })()}
          </div>

          {obra.croquis?.plan?.rooms?.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCroquis(true)}
              title="Abrir el croquis en el editor"
              aria-label="Abrir el croquis de la obra"
              className="group relative rounded-xl overflow-hidden border border-slate-800 hover:border-amber-500/60 transition-colors"
              style={{ background: '#ffffff' }}
            >
              <CroquisLienzo plan={croquisPlanObra} soloLectura mostrarCotas={false} alto="11rem" ajustado />
              <span className="absolute top-1.5 left-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-white/85 rounded px-1.5 py-0.5">
                Croquis · {resumenSuperficies(croquisPlanObra).util.toLocaleString('es-ES')} m² útiles
              </span>
            </button>
          )}
          </div>
        </div>

        {/* Global Progress */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-medium">Avance de Ejecución de la Obra</span>
            <span className="text-amber-400 font-bold text-sm">{obra.progreso}%</span>
          </div>
          <BarraProgreso valor={obra.progreso} alto="h-6" />
          {(() => {
            const sched = calculateObraScheduling(obra, obras);
            const desv = sched.desviacionEntregaDias;
            const metodoTexto = {
              plan: 'según los días planificados de cada etapa',
              ritmo_real: `según el ritmo real de la obra (×${sched.ritmo} sobre lo planificado)`,
              avance_y_obreros: `según el ritmo real (×${sched.ritmo}) y ${sched.estimacionesObrero} indicación(es) de operarios`,
              finalizada: 'obra terminada: fecha de la última partida completada'
            }[sched.metodoPrevision];
            return (
              <div className="mt-4 bg-slate-950/60 border border-slate-800 rounded-xl p-3 sm:p-4 text-xs">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <span>Fechas de la obra</span>
                  </span>
                  {!editingFechas && (
                    <button
                      type="button"
                      onClick={startEditFechas}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border border-slate-700 font-semibold flex items-center gap-1.5 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar fechas</span>
                    </button>
                  )}
                </div>

                {editingFechas ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { key: 'fechaInicio', label: 'Inicio de obra' },
                        { key: 'fechaFinEstimada', label: 'Fin planificado' },
                        { key: 'fechaEntregaCliente', label: 'Entrega al cliente' }
                      ].map(f => (
                        <div key={f.key}>
                          <label className="text-slate-400 block mb-1 font-medium">{f.label}</label>
                          <input
                            type="date"
                            value={editingFechas[f.key]}
                            onChange={(e) => setEditingFechas({ ...editingFechas, [f.key]: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditingFechas(null)} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold">
                        Cancelar
                      </button>
                      <button type="button" onClick={handleSaveFechas} className="px-3 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold">
                        Guardar fechas
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Inicio</span>
                      <span className="text-slate-200 font-semibold">{sched.fechaInicioFormatted}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Fin planificado</span>
                      <span className="text-slate-200 font-semibold">{sched.fechaFinFormatted}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Entrega al cliente</span>
                      <span className="text-white font-bold">{sched.fechaEntregaFormatted}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Fin previsto (calculado)</span>
                      <span className={`font-bold ${desv > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{sched.fechaPrevistaFormatted}</span>
                      <span className={`block text-[10px] ${desv > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {desv > 0 ? `${desv} días tarde respecto a la entrega` : desv < 0 ? `${-desv} días de margen` : 'Justo en la fecha de entrega'}
                      </span>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-slate-500 mt-3">
                  Fin previsto calculado {metodoTexto}. Se actualiza solo al completar partidas y etapas.
                </p>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Tabs Bar inside Obra */}
      <Pestanas
        ariaLabel="Secciones de la obra"
        value={detailTab}
        onChange={setDetailTab}
        tabs={[
          { id: 'fases', label: 'Fases y Planificación', count: obra.fases?.length },
          { id: 'diario', label: 'Histórico diario' },
          { id: 'materiales', label: 'Necesidades y Materiales', count: obra.necesidadesMateriales?.length },
          { id: 'documentos', label: 'Documentación de Obra', count: (obraPresupuesto ? 1 : 0) + obraFacturas.length + obraFacturasProveedores.length },
          { id: 'catalogo_precios', label: 'Catálogo de Precios Unitarios', count: catalogList.length },
          { id: 'economico', label: 'Presupuesto y Facturas', count: obraFacturas.length },
          { id: 'gastos_ingresos', label: 'Gastos vs Ingresos', count: obraFacturasProveedores.length },
          { id: 'equipo', label: 'Equipo y Subcontratas', count: (obra.operariosIds || []).length }
        ]}
      />

      {/* TAB 1: FASES Y PLANIFICACIÓN (SINGLE SOURCE OF TRUTH) */}
      {detailTab === 'fases' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-amber-400" />
                  <span>Etapas Constructivas y Partidas de Ejecución</span>
                </h3>
                {obraPresupuesto && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                    Fuente: {obraPresupuesto.numero}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400">
                Estructura canónica vinculada 1:1 con las partidas del presupuesto firmado. Cada avance de operario recalcula el progreso global.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { window.location.hash = `#admin/avance/${encodeURIComponent(obra.id)}`; }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                title="Asignar fases y partidas a obreros o subcontratas y validar su avance"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Seguimiento y asignaciones</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNewAlertModal(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                title="Enviar aviso o instrucción técnica a los operarios"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Aviso Técnico</span>
              </button>

              <button
                type="button"
                onClick={openNewTaskModal}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow"
              >
                <Plus className="w-4 h-4" />
                <span>Asignar Tarea (Realtime)</span>
              </button>
            </div>
          </div>

          {/* Canonical Phases List */}
          <div className="grid grid-cols-1 gap-4">
            {(obra.fases || []).map((fase, idx) => {
              const isCompleted = fase.progreso === 100;
              const hasTasks = Array.isArray(fase.tareas) && fase.tareas.length > 0;
              const isExpanded = expandedFases[fase.id] ?? (fase.progreso > 0 && fase.progreso < 100);

              return (
                <div
                  key={fase.id}
                  className={`rounded-2xl border transition overflow-hidden shadow-lg ${
                    isCompleted
                      ? 'bg-slate-900/40 border-emerald-500/30'
                      : fase.progreso > 0
                      ? 'bg-slate-900 border-amber-500/40'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  {/* Phase Header Card */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 transition ${
                        isCompleted
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                          : fase.progreso > 0
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {isCompleted ? <Check className="w-5 h-5 stroke-[3]" /> : idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-bold text-sm sm:text-base truncate ${isCompleted ? 'text-emerald-400 line-through decoration-emerald-500/50' : 'text-white'}`}>
                            {fase.nombre}
                          </h4>
                          {fase.weight_percentage && (
                            <span className="text-[10px] font-mono font-bold bg-slate-800 text-amber-400 border border-slate-700 px-2 py-0.5 rounded-full shrink-0">
                              {fase.weight_percentage}% peso obra
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                          <span>
                            Responsable: <strong className="text-slate-200">{fase.responsable}</strong>
                          </span>
                          <span>·</span>
                          <span>
                            Importe Capítulo: <strong className="text-slate-200 font-mono">{fase.importeTotal ? `${fase.importeTotal.toLocaleString('es-ES')} €` : '-'}</strong>
                          </span>
                          {hasTasks && (
                            <>
                              <span>·</span>
                              <span className="text-amber-400 font-semibold">{fase.tareas.length} partidas presupuestadas</span>
                            </>
                          )}
                          <span>·</span>
                          <span>Plazo: <strong className="text-slate-200">{fase.dias || 5} días</strong></span>
                          {fase.estimacionObrero && !isCompleted && (
                            <>
                              <span>·</span>
                              <span className="text-sky-400" title={fase.estimacionObrero.nota || ''}>
                                {fase.estimacionObrero.autor} estima {fase.estimacionObrero.diasRestantes} días ({fase.estimacionObrero.fecha})
                              </span>
                            </>
                          )}
                        </div>
                        {fase.descripcion && (
                          <p className="text-xs text-slate-300 mt-1.5 whitespace-pre-line">{fase.descripcion}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                      <div className="text-right">
                        <div className="flex items-center gap-3">
                          <BarraProgreso
                            valor={fase.progreso}
                            ancho="w-28 sm:w-36"
                            alto="h-4"
                            color={isCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-yellow-400'}
                          />
                          <span className={`text-sm font-mono font-black w-12 text-right ${isCompleted ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {fase.progreso}%
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {isCompleted ? 'Fase Completada' : fase.progreso > 0 ? 'En Ejecución' : 'Pendiente de inicio'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => startEditFase(fase)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border border-slate-700 transition"
                        title="Editar etapa"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {hasTasks && (
                        <button
                          type="button"
                          onClick={() => toggleFaseExpand(fase.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                        >
                          <span>Partidas</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Editor de la etapa */}
                  {editingFase?.id === fase.id && (
                    <div className="bg-slate-950/90 border-t border-amber-500/30 p-4 sm:p-5 space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-2">
                          <label className="text-slate-300 block mb-1 font-bold">Nombre de la etapa:</label>
                          <input
                            type="text"
                            value={editingFase.nombre || ''}
                            onChange={(e) => setEditingFase({ ...editingFase, nombre: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                          />
                        </div>
                        <div>
                          <label className="text-slate-300 block mb-1 font-bold">Responsable:</label>
                          <select
                            value={editingFase.responsable || ''}
                            onChange={(e) => setEditingFase({ ...editingFase, responsable: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                          >
                            {editingFase.responsable && !operariosDisponibles.some(o => o.nombre === editingFase.responsable) && (
                              <option value={editingFase.responsable}>{editingFase.responsable}</option>
                            )}
                            {operariosDisponibles.map(o => (
                              <option key={o.nombre} value={o.nombre}>{o.nombre}{o.detalle ? ` (${o.detalle})` : ''}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-slate-300 block mb-1 font-bold">Días previstos:</label>
                          <input
                            type="number"
                            min="1"
                            value={editingFase.dias ?? ''}
                            onChange={(e) => setEditingFase({ ...editingFase, dias: e.target.value === '' ? '' : Math.max(1, Number(e.target.value)) })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-slate-300 block mb-1 font-bold">Descripción de la etapa:</label>
                        <textarea
                          rows={3}
                          value={editingFase.descripcion || ''}
                          onChange={(e) => setEditingFase({ ...editingFase, descripcion: e.target.value })}
                          placeholder="Trabajos que incluye, medios, condiciones de ejecución..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                        />
                        <div className="mt-2">
                          <AiImprovementControl
                            value={editingFase.descripcion || ''}
                            onAccept={(improved) => setEditingFase(prev => ({ ...prev, descripcion: improved }))}
                            context={`Descripción de la etapa de obra "${editingFase.nombre || ''}"`}
                            buttonSize="small"
                          />
                        </div>
                      </div>

                      {editingFase.tareas.length > 0 && (
                        <div className="space-y-3">
                          <span className="text-slate-300 font-bold block">Partidas de la etapa:</span>
                          {editingFase.tareas.map((tarea) => (
                            <div key={tarea.id} className="p-3 rounded-xl border border-slate-800 bg-slate-900 space-y-2">
                              <div className="flex items-center gap-2">
                                {tarea.codigo && (
                                  <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded shrink-0">
                                    {tarea.codigo}
                                  </span>
                                )}
                                <select
                                  value={tarea.asignadoA || ''}
                                  onChange={(e) => updateEditingTarea(tarea.id, { asignadoA: e.target.value })}
                                  className="ml-auto bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-white text-[11px] focus:outline-none focus:border-amber-400"
                                >
                                  <option value="">Responsable de la etapa</option>
                                  {tarea.asignadoA && !operariosDisponibles.some(o => o.nombre === tarea.asignadoA) && (
                                    <option value={tarea.asignadoA}>{tarea.asignadoA}</option>
                                  )}
                                  {operariosDisponibles.map(o => (
                                    <option key={o.nombre} value={o.nombre}>{o.nombre}</option>
                                  ))}
                                </select>
                              </div>
                              <textarea
                                rows={2}
                                value={tarea.titulo || ''}
                                onChange={(e) => updateEditingTarea(tarea.id, { titulo: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                              />
                              <AiImprovementControl
                                value={tarea.titulo || ''}
                                onAccept={(improved) => updateEditingTarea(tarea.id, { titulo: improved })}
                                context="Descripción técnica de partida de obra"
                                buttonSize="small"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                        <button type="button" onClick={() => setEditingFase(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveFase}
                          className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-black rounded-xl shadow"
                        >
                          Guardar etapa
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tasks Breakdown (Partidas del Presupuesto Firmado) */}
                  {hasTasks && isExpanded && editingFase?.id !== fase.id && (
                    <div className="bg-slate-950/80 border-t border-slate-800 p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-2">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          <span>Partidas y Tareas Operativas del Presupuesto Firmado</span>
                        </span>
                        <span className="text-[11px] text-slate-400">Modifica avance aquí o en la app del operario</span>
                      </div>

                      <div className="space-y-3">
                        {fase.tareas.map((tarea) => {
                          const isTaskDone = tarea.progreso === 100;
                          return (
                            <div
                              key={tarea.id}
                              className={`p-3.5 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                                isTaskDone
                                  ? 'bg-slate-900/40 border-emerald-500/20'
                                  : 'bg-slate-900 border-slate-800'
                              }`}
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
                                    {tarea.codigo}
                                  </span>
                                  {tarea.unidad && (
                                    <span className="text-xs text-slate-400 font-mono">
                                      {tarea.cantidad} {tarea.unidad} · {tarea.precioVenta} €/{tarea.unidad}
                                    </span>
                                  )}
                                  <span className="text-xs font-mono font-bold text-white">
                                    = {tarea.importeTotal ? `${tarea.importeTotal.toLocaleString('es-ES')} €` : ''}
                                  </span>
                                </div>
                                <h5 className={`text-xs sm:text-sm font-semibold leading-snug ${isTaskDone ? 'text-slate-300 line-through' : 'text-white'}`}>
                                  {tarea.titulo}
                                </h5>
                                <div className="text-[11px] text-slate-400">
                                  Asignado a: <strong className="text-slate-300">{tarea.asignadoA || fase.responsable}</strong>
                                </div>
                              </div>

                              <div className="w-full md:w-56 shrink-0 pt-2 md:pt-0">
                                <TaskProgressSelector
                                  compact={true}
                                  currentProgress={tarea.progreso}
                                  onProgressChange={(pct) => broadcastWorkerProgress(obra.id, fase.id, pct, 'Director de Obra', tarea.id)}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* If phase has no subtasks, show tactile selector directly on phase */}
                  {!hasTasks && (
                    <div className="bg-slate-950/80 border-t border-slate-800 p-4">
                      <div className="w-full sm:w-72 ml-auto">
                        <TaskProgressSelector
                          compact={true}
                          currentProgress={fase.progreso}
                          onProgressChange={(pct) => broadcastWorkerProgress(obra.id, fase.id, pct, 'Director de Obra')}
                        />
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: HISTÓRICO DIARIO DE LA OBRA */}
      {detailTab === 'diario' && <HistorialObra obra={obra} />}

      {/* TAB 3: NECESIDADES Y MATERIALES */}
      {detailTab === 'materiales' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <span>Necesidades Calculadas de Materiales y Suministros</span>
              </h3>
              <p className="text-xs text-slate-400">Alimentado por los audios de obreros, pedidos y mediciones de obra</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
            {(obra.necesidadesMateriales || []).some((m) => m.estado === 'pendiente') && (
              <button
                onClick={() => setPedidoMateriales((obra.necesidadesMateriales || []).filter((m) => m.estado === 'pendiente'))}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
              >
                <Send className="w-4 h-4" />
                <span>Pedir pendientes</span>
              </button>
            )}
            <button
              onClick={() => setShowNewMaterialModal(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir Material</span>
            </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Concepto / Material</th>
                    <th className="py-3 px-4">Cantidad</th>
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4">Coste Estimado</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {(obra.necesidadesMateriales || []).map((mat) => (
                    <tr key={mat.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-semibold text-white">{mat.concepto}</td>
                      <td className="py-3 px-4">{mat.cantidad} {mat.unidad}</td>
                      <td className="py-3 px-4 text-slate-400">{mat.proveedor || 'Por definir'}</td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-200">{mat.costeEstimado ? `${mat.costeEstimado} €` : '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          mat.estado === 'recibido'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : mat.estado === 'pedido'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {mat.estado}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {mat.estado !== 'recibido' && (
                          <button
                            onClick={() => setPedidoMateriales([mat])}
                            title="Pedir este material a un proveedor por correo"
                            className="mr-2 px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 inline-flex items-center gap-1"
                          >
                            <Send className="w-3.5 h-3.5" /> Pedir
                          </button>
                        )}
                        <select
                          value={mat.estado}
                          onChange={(e) => updateMaterialStatus(obra.id, mat.id, e.target.value)}
                          className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-amber-400"
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="pedido">Pedido</option>
                          <option value="recibido">Recibido en obra</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: DOCUMENTACIÓN DE OBRA */}
      {detailTab === 'documentos' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-amber-400" />
                <span>Gestor Documental Integrado de la Obra</span>
              </h3>
              <p className="text-xs text-slate-400">Acceso centralizado a presupuestos, contratos, certificaciones y facturas de compras/subcontratas</p>
            </div>
          </div>

          {/* Croquis 2D de la vivienda (llega del presupuesto aceptado o se dibuja aquí) */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <PencilRuler className="w-4 h-4" />
                <span>Croquis 2D de la vivienda</span>
              </h4>
              <div className="flex gap-2">
                {obra.croquis?.plan?.rooms?.length > 0 && (
                  <button
                    onClick={() => buildCroquisPdf({ plan: normalizarCroquis(obra.croquis.plan), cabecera: croquisCabecera, empresaConfig }).save(`Croquis-${obra.codigo || 'obra'}.pdf`)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold border border-slate-700 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>PDF</span>
                  </button>
                )}
                <button onClick={() => setShowCroquis(true)} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold">
                  {obra.croquis?.plan?.rooms?.length ? 'Abrir editor' : 'Crear croquis'}
                </button>
              </div>
            </div>
            {obra.croquis?.plan?.rooms?.length > 0 ? (
              <div className="rounded-xl overflow-hidden border border-slate-800 max-w-2xl" style={{ background: '#ffffff' }}>
                <CroquisLienzo plan={croquisPlanObra} soloLectura />
              </div>
            ) : (
              <p className="text-xs text-slate-400">Sin croquis. Se copia aquí al aceptar un presupuesto que lo tenga, o puedes crearlo desde las medidas.</p>
            )}
          </div>

          {/* Archivos de la obra en Supabase Storage (fotos, planos, LiDAR, documentación) */}
          <ArchivosObra obra={obra} />

          {/* Document Section 1: Presupuesto y Contrato */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
            <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Presupuesto Principal y Contrato</span>
            </h4>
            {obraPresupuesto ? (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-amber-400 font-bold">{obraPresupuesto.numero}</span>
                    <span className="text-xs text-slate-300 font-semibold">{obraPresupuesto.obraTitulo}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Fecha: {obraPresupuesto.fecha} · Base Imponible: {obraPresupuesto.baseImponible?.toLocaleString('es-ES')} €</p>
                </div>
                <button
                  onClick={() => setPdfModalData({ type: 'presupuesto', data: obraPresupuesto })}
                  className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Ver/Descargar PDF</span>
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No hay presupuesto firmado vinculado a esta obra.</p>
            )}
          </div>

          {/* Document Section 2: Facturas Emitidas a Cliente */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
            <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span>Certificaciones y Facturas Emitidas al Cliente ({obraFacturas.length})</span>
            </h4>
            {obraFacturas.length > 0 ? (
              <div className="space-y-2">
                {obraFacturas.map((fac) => (
                  <div key={fac.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-amber-400 font-bold mr-2">{fac.numero}</span>
                      <span className="text-white font-medium">{fac.tipoFactura}</span>
                      <span className="text-slate-400 block text-[11px] mt-0.5">Emisión: {fac.fechaEmision} · Vencimiento: {fac.fechaVencimiento}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white text-sm">{fac.totalFactura?.toLocaleString('es-ES')} €</span>
                      <button
                        onClick={() => setPdfModalData({ type: 'factura', data: fac })}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
                      >
                        PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No hay facturas emitidas para esta obra.</p>
            )}
          </div>

          {/* Document Section 3: Facturas de Proveedores y Subcontratas */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
            <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Tag className="w-4 h-4" />
              <span>Gastos Imputados, Materiales y Subcontratas ({obraFacturasProveedores.length})</span>
            </h4>
            {obraFacturasProveedores.length > 0 ? (
              <div className="space-y-2">
                {obraFacturasProveedores.map((gasto) => (
                  <div key={gasto.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-indigo-400 font-bold mr-2">{gasto.numeroProveedor || 'Factura'}</span>
                      <span className="text-white font-medium">{gasto.proveedor}</span>
                      <p className="text-slate-400 text-[11px] mt-0.5">{gasto.concepto}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-rose-400 text-sm block">{gasto.total?.toLocaleString('es-ES')} €</span>
                      <span className="text-[10px] text-slate-400">Fecha: {gasto.fecha}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No hay gastos ni facturas de subcontratas asociadas a esta obra.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB: CATÁLOGO DE PRECIOS UNITARIOS DE LA OBRA */}
      {detailTab === 'catalogo_precios' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-400" />
                <span>Catálogo de Precios Unitarios de esta Obra</span>
              </h3>
              <p className="text-xs text-slate-400">Modifica libremente costes, unidades, conceptos y márgenes de ganancia % para esta obra</p>
            </div>
            <button
              onClick={() => {
                setEditingPriceItem(null);
                setShowNewPriceModal(true);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Añadir Partida al Catálogo</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-xs sm:text-sm text-slate-300">
                <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Capítulo / Concepto</th>
                    <th className="py-3 px-4">Unidad</th>
                    <th className="py-3 px-4 text-right">Coste Base (€)</th>
                    <th className="py-3 px-4 text-right">Ganancia (%)</th>
                    <th className="py-3 px-4 text-right">Precio Venta (€)</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {catalogList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">{item.codigo}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-white block whitespace-pre-line break-words">{item.concepto}</span>
                        <span className="text-[10px] text-slate-400">{item.capitulo} · {item.gremio}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{item.unidad}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">{Number(item.costeSubcontrata).toFixed(2)} €</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-400">+{item.margenPct}%</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">{Number(item.precioVenta).toFixed(2)} €</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEditPrice(item)}
                            title="Editar partida"
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePriceItem(item)}
                            title="Eliminar partida"
                            className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-rose-400 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PRESUPUESTO Y FACTURAS */}
      {detailTab === 'economico' && (
        <div className="space-y-6">
          {/* Presupuesto Vincular */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Presupuesto Aceptado de la Obra</h3>
                <p className="text-xs text-slate-400">Presupuesto base con desglose de partidas y mediciones</p>
              </div>
              {obraPresupuesto && (
                <button
                  onClick={() => setPdfModalData({ type: 'presupuesto', data: obraPresupuesto })}
                  className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                  <span>Ver PDF Presupuesto</span>
                </button>
              )}
            </div>

            {obraPresupuesto ? (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-mono text-amber-400">{obraPresupuesto.numero}</span>
                  <h4 className="font-bold text-white text-sm">{obraPresupuesto.obraTitulo}</h4>
                  <p className="text-xs text-slate-400">Base Imponible: {obraPresupuesto.baseImponible?.toLocaleString('es-ES')} € · IVA (10%): {obraPresupuesto.cuotaIva?.toLocaleString('es-ES')} €</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Total con IVA</span>
                  <span className="text-xl font-black text-amber-400">{obraPresupuesto.totalConIva?.toLocaleString('es-ES')} €</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No hay presupuesto vinculado directamente.</p>
            )}
          </div>

          {/* Facturas Emitidas de la Obra */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Facturas y Certificaciones Emitidas</h3>
                <p className="text-xs text-slate-400">Total facturado: {totalFacturadoObra.toLocaleString('es-ES')} € (Cobrado: {totalCobradoObra.toLocaleString('es-ES')} €)</p>
                {estadoFacturacionObra?.total > 0 && (
                  <BarraFacturacion
                    estado={estadoFacturacionObra}
                    titulo={`Facturado de ${estadoFacturacionObra.presupuestos === 1 ? 'su presupuesto' : `sus ${estadoFacturacionObra.presupuestos} presupuestos`} (base imponible)`}
                    className="mt-2 max-w-md"
                  />
                )}
              </div>
              <button
                onClick={() => setActiveTab('facturas')}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                Módulo Facturación
              </button>
            </div>

            <div className="space-y-2.5">
              {obraFacturas.map((fac) => (
                <div key={fac.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-4 text-xs sm:text-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400">{fac.numero}</span>
                      <span className="text-slate-300 font-medium">{fac.tipoFactura}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Emisión: {fac.fechaEmision} · Vencimiento: {fac.fechaVencimiento}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-base font-bold text-white">{fac.totalFactura?.toLocaleString('es-ES')} €</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                      fac.estadoCobro === 'cobrada' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {fac.estadoCobro}
                    </span>
                    <button
                      onClick={() => setPdfModalData({ type: 'factura', data: fac })}
                      className="text-xs text-slate-400 hover:text-white underline"
                    >
                      PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: GASTOS EJECUTADOS VS INGRESOS */}
      {detailTab === 'gastos_ingresos' && <GastosIngresosObra obra={obra} />}

      {/* TAB 5: EQUIPO Y SUBCONTRATAS */}
      {detailTab === 'equipo' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HardHat className="w-5 h-5 text-amber-400" />
                <span>Personal y Subcontratistas Asignados a la Obra</span>
              </h3>
              <p className="text-xs text-slate-400">Obreros de plantilla y gremios subcontratados con sus valoraciones</p>
            </div>
            <button
              onClick={() => setActiveTab('obreros')}
              className="text-xs text-amber-400 hover:underline font-semibold"
            >
              Ver Módulo de Evaluación de Obreros
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {obreros.filter(o => (obra.operariosIds || []).includes(o.id)).map((obrero) => (
              <div key={obrero.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-start gap-4">
                <img
                  src={obrero.foto}
                  alt={obrero.nombre}
                  className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-sm">{obrero.nombre}</h4>
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      <Star className="w-3 h-3 fill-amber-400" />
                      {obrero.calificacionMedia}
                    </span>
                  </div>
                  <p className="text-xs text-amber-300/80 font-medium">{obrero.puesto}</p>
                  <p className="text-xs text-slate-400 line-clamp-2">{obrero.especialidad}</p>
                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab('obreros')}
                      className="text-[11px] text-amber-400 hover:underline font-bold"
                    >
                      ⭐ Calificar su trabajo en esta obra →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Nuevo Material */}
      {pedidoMateriales && (
        <NuevoPedidoModal
          initial={{
            title: `Pedir material · ${[obra.codigo, obra.titulo].filter(Boolean).join(' - ')}`,
            obraIds: [obra.id],
            items: pedidoMateriales.map((m) => ({ material: m.concepto || '', cantidad: String(m.cantidad ?? ''), unidad: m.unidad || '' })),
            supplierName: pedidoMateriales.length === 1 ? pedidoMateriales[0].proveedor : ''
          }}
          onClose={() => setPedidoMateriales(null)}
          onDone={({ orders = [] }) => {
            // Solo pasan a "pedido" si el correo salió; los borradores se revisan en Avisos y Pedidos.
            if (orders.some((o) => o.status === 'enviado')) {
              pedidoMateriales.forEach((m) => updateMaterialStatus(obra.id, m.id, 'pedido'));
            }
            setPedidoMateriales(null);
          }}
        />
      )}

      <AnimatePresence>
      {showNewMaterialModal && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Añadir Necesidad de Material</h3>
            <form onSubmit={handleSaveMaterial} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="text-slate-400 block mb-1">Concepto o Producto</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Cemento Cola C2TE 25kg"
                  value={materialForm.concepto}
                  onChange={(e) => setMaterialForm({ ...materialForm, concepto: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={materialForm.cantidad}
                    onChange={(e) => setMaterialForm({ ...materialForm, cantidad: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Unidad</label>
                  <input
                    type="text"
                    value={materialForm.unidad}
                    onChange={(e) => setMaterialForm({ ...materialForm, unidad: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Coste Estimado (€)</label>
                  <input
                    type="number"
                    value={materialForm.costeEstimado}
                    onChange={(e) => setMaterialForm({ ...materialForm, costeEstimado: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Proveedor Habitual</label>
                  <input
                    type="text"
                    value={materialForm.proveedor}
                    onChange={(e) => setMaterialForm({ ...materialForm, proveedor: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewMaterialModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                >
                  Añadir Material
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
      </AnimatePresence>

      {/* Modal Editar / Añadir Partida de Catálogo de la Obra */}
      {showNewPriceModal && (
        <PartidaPrecioModal
          initial={editingPriceItem || { codigo: `PAR-${catalogList.length + 1}` }}
          isEditing={Boolean(editingPriceItem)}
          title={editingPriceItem ? `Editar partida ${editingPriceItem.codigo}` : 'Nueva partida en el catálogo de la obra'}
          catalogo={catalogList}
          onSave={handleSavePriceItem}
          onClose={() => { setShowNewPriceModal(false); setEditingPriceItem(null); }}
        />
      )}

      {/* Modal Asignar Nueva Tarea (Realtime Dispatch) */}
      <AnimatePresence>
      {showNewTaskModal && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Asignar Tarea a Operario en Tiempo Real</span>
              </h3>
              <button aria-label="Cerrar" type="button" onClick={() => setShowNewTaskModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-slate-400 text-[11px]">
              Al crear la tarea, se emitirá una señal instantánea por canal WebSocket al teléfono del operario asignado con aviso sonoro y táctil.
            </p>

            <form onSubmit={handleSaveNewTask} className="space-y-3">
              <div>
                <label className="text-slate-300 block mb-1 font-bold">Descripción de la Tarea / Fase:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Montaje de mecanismos eléctricos en salón..."
                  value={newTaskForm.nombre}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, nombre: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-bold">Operario Responsable:</label>
                  <select
                    value={newTaskForm.responsable}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, responsable: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white font-medium focus:outline-none focus:border-amber-400"
                  >
                    {operariosDisponibles.length === 0 && <option value="">No hay operarios dados de alta</option>}
                    {operariosDisponibles.map(o => (
                      <option key={o.nombre} value={o.nombre}>{o.nombre}{o.detalle ? ` (${o.detalle})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-bold">Días estimados:</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={newTaskForm.dias}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, dias: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white font-mono text-center font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-black rounded-xl shadow"
                >
                  Asignar y Notificar Móvil
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
      </AnimatePresence>

      {/* Modal Enviar Aviso Técnico / Instrucción */}
      <AnimatePresence>
      {showNewAlertModal && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Enviar Instrucción Técnica o Advertencia</span>
              </h3>
              <button aria-label="Cerrar" type="button" onClick={() => setShowNewAlertModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-slate-400 text-[11px]">
              Envía un plano urgente, advertencia de seguridad o cambio de directriz que aparecerá en pantalla completa en los móviles del equipo.
            </p>

            <form onSubmit={handleSaveNewAlert} className="space-y-3">
              <div>
                <label className="text-slate-300 block mb-1 font-bold">Título del Aviso:</label>
                <input
                  type="text"
                  required
                  value={alertForm.titulo}
                  onChange={(e) => setAlertForm({ ...alertForm, titulo: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-bold">Tipo de Comunicado:</label>
                  <select
                    value={alertForm.tipo}
                    onChange={(e) => setAlertForm({ ...alertForm, tipo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400 font-semibold"
                  >
                    <option value="seguridad">🛡️ Seguridad / PRL</option>
                    <option value="tecnico">📐 Instrucción Técnica</option>
                    <option value="operativo">⚠️ Aviso Operativo</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-bold">Prioridad:</label>
                  <select
                    value={alertForm.prioridad}
                    onChange={(e) => setAlertForm({ ...alertForm, prioridad: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400 font-semibold"
                  >
                    <option value="urgente">🔴 Urgente</option>
                    <option value="alta">🟠 Alta</option>
                    <option value="media">🟡 Normal / Media</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-bold">Instrucción Detallada:</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Ej: No picar en tabique del baño hasta verificar paso de bajante general según plano anexo..."
                  value={alertForm.descripcion}
                  onChange={(e) => setAlertForm({ ...alertForm, descripcion: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewAlertModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow"
                >
                  Emitir Alerta a Operarios
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
      </AnimatePresence>

      {showCroquis && (
        <CroquisEditorModal
          titulo={`Croquis 2D · ${obra.titulo}`}
          croquis={obra.croquis}
          contexto={{ medidasNotas: obraPresupuesto?.medidasNotas || '', obraTitulo: obra.titulo }}
          cabecera={croquisCabecera}
          onGuardar={(croquis) => guardarCroquisObra(obra.id, croquis)}
          onClose={() => setShowCroquis(false)}
        />
      )}
    </div>
  );
}
