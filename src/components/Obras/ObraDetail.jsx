import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Camera,
  Mic,
  Package,
  HardHat,
  FileText,
  DollarSign,
  TrendingUp,
  MapPin,
  Phone,
  Mail,
  User,
  Star,
  Check,
  Sparkles,
  ChevronRight,
  FolderOpen,
  Tag,
  Edit2,
  Trash2,
  Percent,
  PlusCircle,
  Download
} from 'lucide-react';

export default function ObraDetail({ obraId, onBack }) {
  const {
    obras,
    updateObra,
    addDiarioEntry,
    addMaterialToObra,
    updateMaterialStatus,
    obreros,
    presupuestos,
    facturas,
    facturasProveedores,
    basePrecios,
    updateObraBasePrecioItem,
    addObraBasePrecioItem,
    deleteObraBasePrecioItem,
    setActiveTab,
    setSelectedPresupuestoId,
    setPdfModalData
  } = useApp();

  const obra = obras.find(o => o.id === obraId);
  const [detailTab, setDetailTab] = useState('fases'); // fases, diario, materiales, economico, documentos, catalogo_precios, equipo

  // New Diario Entry State
  const [showNewDiarioModal, setShowNewDiarioModal] = useState(false);
  const [diarioForm, setDiarioForm] = useState({
    autor: 'Manuel (Encargado)',
    clima: 'Despejado, 20°C',
    obrerosPresentes: 'Pedro Gómez, Mario Silva',
    resumen: '',
    incidencias: '',
    fotoUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f8?auto=format&fit=crop&w=600&q=80'
  });

  // New Material State
  const [showNewMaterialModal, setShowNewMaterialModal] = useState(false);
  const [materialForm, setMaterialForm] = useState({
    concepto: '',
    cantidad: 1,
    unidad: 'sacos',
    costeEstimado: 0,
    proveedor: 'Obramat'
  });

  if (!obra) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Obra no encontrada.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg">Volver</button>
      </div>
    );
  }

  // Related Data
  const obraPresupuesto = presupuestos.find(p => p.id === obra.presupuestoId);
  const obraFacturas = facturas.filter(f => f.obraId === obra.id);
  const obraFacturasProveedores = (facturasProveedores || []).filter(f => f.obraId === obra.id);
  const totalFacturadoObra = obraFacturas.reduce((s, f) => s + f.totalFactura, 0);
  const totalCobradoObra = obraFacturas.filter(f => f.estadoCobro === 'cobrada').reduce((s, f) => s + f.totalFactura, 0);

  // Price Catalog for this specific Obra
  const catalogList = obra.catalogoPrecios && obra.catalogoPrecios.length > 0 ? obra.catalogoPrecios : basePrecios;

  // New Price Item State for Modal / Inline Add
  const [showNewPriceModal, setShowNewPriceModal] = useState(false);
  const [editingPriceItem, setEditingPriceItem] = useState(null);
  const [priceForm, setPriceForm] = useState({
    codigo: '',
    concepto: '',
    capitulo: 'Albañilería',
    gremio: 'Albañilería',
    unidad: 'm²',
    costeSubcontrata: 15.00,
    margenPct: 30,
    precioVenta: 19.50
  });

  const handleOpenEditPrice = (item) => {
    setEditingPriceItem(item);
    setPriceForm({
      codigo: item.codigo,
      concepto: item.concepto,
      capitulo: item.capitulo || 'Albañilería',
      gremio: item.gremio || 'Albañilería',
      unidad: item.unidad || 'm²',
      costeSubcontrata: item.costeSubcontrata || 0,
      margenPct: item.margenPct || 30,
      precioVenta: item.precioVenta || 0
    });
    setShowNewPriceModal(true);
  };

  const handleSavePriceItem = (e) => {
    e.preventDefault();
    if (editingPriceItem) {
      updateObraBasePrecioItem(obra.id, editingPriceItem.id, priceForm);
    } else {
      addObraBasePrecioItem(obra.id, priceForm);
    }
    setShowNewPriceModal(false);
    setEditingPriceItem(null);
    setPriceForm({
      codigo: '',
      concepto: '',
      capitulo: 'Albañilería',
      gremio: 'Albañilería',
      unidad: 'm²',
      costeSubcontrata: 15.00,
      margenPct: 30,
      precioVenta: 19.50
    });
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

  const handleSaveDiario = (e) => {
    e.preventDefault();
    if (!diarioForm.resumen) return;

    addDiarioEntry(obra.id, {
      autor: diarioForm.autor,
      clima: diarioForm.clima,
      obrerosPresentes: diarioForm.obrerosPresentes.split(',').map(s => s.trim()),
      resumen: diarioForm.resumen,
      incidencias: diarioForm.incidencias,
      fotos: diarioForm.fotoUrl ? [diarioForm.fotoUrl] : []
    });

    setShowNewDiarioModal(false);
    setDiarioForm({
      autor: 'Manuel (Encargado)',
      clima: 'Despejado, 20°C',
      obrerosPresentes: 'Pedro Gómez, Mario Silva',
      resumen: '',
      incidencias: '',
      fotoUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f8?auto=format&fit=crop&w=600&q=80'
    });
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

  return (
    <div className="space-y-6">
      
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al listado de obras</span>
        </button>

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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
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

          {/* Quick Metrics Badge */}
          <div className="flex items-center gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800 shrink-0">
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
        </div>

        {/* Global Progress */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-medium">Avance de Ejecución de la Obra</span>
            <span className="text-amber-400 font-bold text-sm">{obra.progreso}%</span>
          </div>
          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
              style={{ width: `${obra.progreso}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
            <span>Inicio: {obra.fechaInicio}</span>
            <span>Finalización prevista: <strong className="text-slate-200">{obra.fechaFinEstimada}</strong></span>
          </div>
        </div>
      </div>

      {/* Tabs Bar inside Obra */}
      <div className="flex gap-2 border-b border-slate-800 overflow-x-auto pb-1">
        {[
          { id: 'fases', label: 'Fases y Planificación', count: obra.fases?.length },
          { id: 'diario', label: 'Diario de Obra (Bitácora)', count: obra.diario?.length },
          { id: 'materiales', label: 'Necesidades y Materiales', count: obra.necesidadesMateriales?.length },
          { id: 'documentos', label: 'Documentación de Obra', count: (obraPresupuesto ? 1 : 0) + obraFacturas.length + obraFacturasProveedores.length },
          { id: 'catalogo_precios', label: 'Catálogo de Precios Unitarios', count: catalogList.length },
          { id: 'economico', label: 'Presupuesto y Facturas', count: obraFacturas.length },
          { id: 'equipo', label: 'Equipo y Subcontratas', count: (obra.operariosIds || []).length }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setDetailTab(t.id)}
            className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
              detailTab === t.id
                ? 'border-amber-400 text-amber-400 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                detailTab === t.id ? 'bg-amber-400/20 text-amber-300' : 'bg-slate-800 text-slate-400'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: FASES Y PLANIFICACIÓN */}
      {detailTab === 'fases' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-amber-400" />
              <span>Etapas Constructivas de la Obra</span>
            </h3>
            <span className="text-xs text-slate-400">Haz clic en una fase para marcarla como completada</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {(obra.fases || []).map((fase, idx) => {
              const isCompleted = fase.progreso === 100;
              return (
                <div
                  key={fase.id}
                  onClick={() => handleToggleFase(fase.id)}
                  className={`p-4 rounded-xl border transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isCompleted
                      ? 'bg-slate-900/40 border-emerald-500/30 opacity-90'
                      : fase.progreso > 0
                      ? 'bg-slate-900 border-amber-500/40 shadow-sm'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isCompleted
                        ? 'bg-emerald-500 text-slate-950'
                        : fase.progreso > 0
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                    </div>
                    <div>
                      <h4 className={`font-bold text-sm ${isCompleted ? 'text-emerald-400 line-through decoration-emerald-500/50' : 'text-white'}`}>
                        {fase.nombre}
                      </h4>
                      <p className="text-xs text-slate-400">
                        Responsable: <strong className="text-slate-300">{fase.responsable}</strong> · Estimación: {fase.dias} días
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${isCompleted ? 'bg-emerald-500' : 'bg-amber-400'}`}
                        style={{ width: `${fase.progreso}%` }}
                      ></div>
                    </div>
                    <span className={`text-xs font-bold w-12 text-right ${isCompleted ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {fase.progreso}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: DIARIO DE OBRA (BITÁCORA) */}
      {detailTab === 'diario' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-400" />
                <span>Diario de Obra con Fotografías y Partes Diarios</span>
              </h3>
              <p className="text-xs text-slate-400">Control de asistencia, climatología, incidencias y evolución visual</p>
            </div>
            <button
              onClick={() => setShowNewDiarioModal(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir Parte Diario</span>
            </button>
          </div>

          <div className="space-y-4">
            {(obra.diario || []).map((entry) => (
              <div key={entry.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{entry.fecha}</span>
                    <span className="text-xs text-slate-400">por {entry.autor}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>Clima: <strong className="text-slate-300">{entry.clima}</strong></span>
                    <span>·</span>
                    <span>Operarios: <strong className="text-amber-400">{(entry.obrerosPresentes || []).join(', ')}</strong></span>
                  </div>
                </div>

                <p className="text-sm text-slate-200 leading-relaxed">
                  {entry.resumen}
                </p>

                {entry.incidencias && (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg flex items-start gap-2 text-xs text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Incidencia:</strong> {entry.incidencias}</span>
                  </div>
                )}

                {entry.fotos && entry.fotos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    {entry.fotos.map((img, i) => (
                      <div key={i} className="h-40 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 group relative">
                        <img src={img} alt="Foto de obra" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
            <button
              onClick={() => setShowNewMaterialModal(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir Material</span>
            </button>
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
                      <td className="py-3 px-4 text-right">
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
                setPriceForm({
                  codigo: `PAR-${catalogList.length + 1}`,
                  concepto: '',
                  capitulo: 'Albañilería',
                  gremio: 'Albañilería',
                  unidad: 'm²',
                  costeSubcontrata: 15.00,
                  margenPct: 30,
                  precioVenta: 19.50
                });
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
              <table className="w-full text-left text-xs sm:text-sm text-slate-300">
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
                        <span className="font-semibold text-white block">{item.concepto}</span>
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
                            title="Editar concepto o margen"
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteObraBasePrecioItem(obra.id, item.id)}
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

      {/* Modal Nuevo Parte Diario */}
      {showNewDiarioModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Nuevo Parte en Diario de Obra</h3>
            <form onSubmit={handleSaveDiario} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="text-slate-400 block mb-1">Resumen del Trabajo Realizado Hoy</label>
                <textarea
                  rows="3"
                  required
                  value={diarioForm.resumen}
                  onChange={(e) => setDiarioForm({ ...diarioForm, resumen: e.target.value })}
                  placeholder="Ej: Se finalizan los rozas de electricidad y se alicatan 12m² de baño..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400"
                ></textarea>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Incidencias o Faltas de Material</label>
                <input
                  type="text"
                  value={diarioForm.incidencias}
                  onChange={(e) => setDiarioForm({ ...diarioForm, incidencias: e.target.value })}
                  placeholder="Ej: Faltan 4 sacos de yeso para rematar..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Climatología</label>
                  <input
                    type="text"
                    value={diarioForm.clima}
                    onChange={(e) => setDiarioForm({ ...diarioForm, clima: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Operarios Presentes</label>
                  <input
                    type="text"
                    value={diarioForm.obrerosPresentes}
                    onChange={(e) => setDiarioForm({ ...diarioForm, obrerosPresentes: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Foto de Obra (URL o Muestra)</label>
                <input
                  type="text"
                  value={diarioForm.fotoUrl}
                  onChange={(e) => setDiarioForm({ ...diarioForm, fotoUrl: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewDiarioModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                >
                  Guardar en Diario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nuevo Material */}
      {showNewMaterialModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
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
        </div>
      )}

      {/* Modal Editar / Añadir Partida de Catálogo de la Obra */}
      {showNewPriceModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">
              {editingPriceItem ? 'Editar Partida de Precios' : 'Nueva Partida en Catálogo de Obra'}
            </h3>
            <form onSubmit={handleSavePriceItem} className="space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Código</label>
                  <input
                    type="text"
                    required
                    value={priceForm.codigo}
                    onChange={(e) => setPriceForm({ ...priceForm, codigo: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Unidad (m², ud, ml, etc.)</label>
                  <input
                    type="text"
                    required
                    value={priceForm.unidad}
                    onChange={(e) => setPriceForm({ ...priceForm, unidad: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Concepto / Descripción Partida</label>
                <textarea
                  rows="2"
                  required
                  value={priceForm.concepto}
                  onChange={(e) => setPriceForm({ ...priceForm, concepto: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Capítulo</label>
                  <input
                    type="text"
                    value={priceForm.capitulo}
                    onChange={(e) => setPriceForm({ ...priceForm, capitulo: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Gremio</label>
                  <input
                    type="text"
                    value={priceForm.gremio}
                    onChange={(e) => setPriceForm({ ...priceForm, gremio: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">Coste Base (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={priceForm.costeSubcontrata}
                    onChange={(e) => {
                      const c = parseFloat(e.target.value) || 0;
                      const m = parseFloat(priceForm.margenPct) || 0;
                      setPriceForm({
                        ...priceForm,
                        costeSubcontrata: c,
                        precioVenta: (c * (1 + m / 100)).toFixed(2)
                      });
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-amber-400 block mb-1 text-[11px] font-bold">Ganancia (%)</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={priceForm.margenPct}
                    onChange={(e) => {
                      const m = parseFloat(e.target.value) || 0;
                      const c = parseFloat(priceForm.costeSubcontrata) || 0;
                      setPriceForm({
                        ...priceForm,
                        margenPct: m,
                        precioVenta: (c * (1 + m / 100)).toFixed(2)
                      });
                    }}
                    className="w-full bg-slate-800 border border-amber-500/50 rounded-xl p-2 text-amber-300 font-bold"
                  />
                </div>
                <div>
                  <label className="text-emerald-400 block mb-1 text-[11px] font-bold">PVP Final (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={priceForm.precioVenta}
                    onChange={(e) => setPriceForm({ ...priceForm, precioVenta: e.target.value })}
                    className="w-full bg-slate-800 border border-emerald-500/50 rounded-xl p-2 text-emerald-300 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewPriceModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                >
                  Guardar Partida
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
