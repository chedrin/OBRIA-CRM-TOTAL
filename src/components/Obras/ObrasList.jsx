import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import ObraDetail from './ObraDetail';
import {
  HardHat,
  Plus,
  Search,
  Filter,
  Calendar,
  MapPin,
  User,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function ObrasList() {
  const {
    obras,
    addObra,
    presupuestos,
    selectedObraId,
    setSelectedObraId
  } = useApp();

  const [filterState, setFilterState] = useState('todas'); // todas, en_curso, presupuestada, finalizada
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1: Seleccionar Presupuesto de origen, 2: Confirmar/Editar Datos de la Obra
  const [selectedPresupuestoId, setSelectedPresupuestoIdForm] = useState('');

  // New Obra Form State
  const [formData, setFormData] = useState({
    presupuestoId: '',
    titulo: '',
    cliente: '',
    telefono: '',
    email: '',
    direccion: '',
    tipo: 'Reforma Integral Vivienda',
    presupuestoTotal: 30000,
    margenEsperadoPct: 35,
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaFinEstimada: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
    notas: '',
    fases: []
  });

  const handleOpenNewModal = () => {
    setModalStep(1);
    setSelectedPresupuestoIdForm('');
    setShowNewModal(true);
  };

  const handleSelectPresupuesto = (pres) => {
    setSelectedPresupuestoIdForm(pres ? pres.id : '');
    if (pres) {
      // Extraer capítulos de las partidas del presupuesto para generar las fases automáticas
      const capitulosUnicos = Array.from(new Set((pres.partidas || []).map(p => p.capitulo || 'General')));
      const fasesGeneradas = capitulosUnicos.length > 0
        ? capitulosUnicos.map((cap, idx) => ({
            id: `f-${Date.now()}-${idx + 1}`,
            nombre: cap,
            progreso: 0,
            estado: 'pendiente',
            dias: 5,
            responsable: 'Por asignar'
          }))
        : [
            { id: `f-${Date.now()}-1`, nombre: 'Demoliciones y Preparación', progreso: 0, estado: 'pendiente', dias: 4, responsable: 'Por asignar' },
            { id: `f-${Date.now()}-2`, nombre: 'Ejecución e Instalaciones', progreso: 0, estado: 'pendiente', dias: 10, responsable: 'Por asignar' },
            { id: `f-${Date.now()}-3`, nombre: 'Acabados y Entrega', progreso: 0, estado: 'pendiente', dias: 5, responsable: 'Por asignar' }
          ];

      setFormData({
        presupuestoId: pres.id,
        titulo: pres.obraTitulo || `Obra - ${pres.cliente}`,
        cliente: pres.cliente || '',
        telefono: pres.telefono || '+34 600 000 000',
        email: pres.email || '',
        direccion: pres.direccion || 'Domicilio de cliente',
        tipo: 'Reforma de Vivienda',
        presupuestoTotal: pres.totalConIva || pres.baseImponible || 30000,
        margenEsperadoPct: pres.margenGlobalPct || 35,
        fechaInicio: new Date().toISOString().split('T')[0],
        fechaFinEstimada: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
        notas: `Obra creada a partir del presupuesto ${pres.numero}.`,
        fases: fasesGeneradas
      });
    } else {
      // Obra manual sin presupuesto previo
      setFormData({
        presupuestoId: null,
        titulo: '',
        cliente: '',
        telefono: '',
        email: '',
        direccion: '',
        tipo: 'Reforma Integral Vivienda',
        presupuestoTotal: 30000,
        margenEsperadoPct: 35,
        fechaInicio: new Date().toISOString().split('T')[0],
        fechaFinEstimada: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
        notas: '',
        fases: [
          { id: `f-${Date.now()}-1`, nombre: 'Demoliciones y Desescombro', progreso: 0, estado: 'pendiente', dias: 4, responsable: 'Por asignar' },
          { id: `f-${Date.now()}-2`, nombre: 'Instalaciones (Fontanería y Luz)', progreso: 0, estado: 'pendiente', dias: 8, responsable: 'Por asignar' },
          { id: `f-${Date.now()}-3`, nombre: 'Albañilería y Alicatados', progreso: 0, estado: 'pendiente', dias: 10, responsable: 'Por asignar' },
          { id: `f-${Date.now()}-4`, nombre: 'Pintura y Carpinterías', progreso: 0, estado: 'pendiente', dias: 6, responsable: 'Por asignar' },
          { id: `f-${Date.now()}-5`, nombre: 'Limpieza y Entrega de Llaves', progreso: 0, estado: 'pendiente', dias: 2, responsable: 'Por asignar' }
        ]
      });
    }
    setModalStep(2);
  };

  if (selectedObraId) {
    return <ObraDetail obraId={selectedObraId} onBack={() => setSelectedObraId(null)} />;
  }

  const filteredObras = obras.filter(obra => {
    const matchesFilter = filterState === 'todas' || obra.estado === filterState;
    const matchesSearch =
      obra.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obra.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obra.direccion.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obra.codigo.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleCreateObra = (e) => {
    e.preventDefault();
    if (!formData.titulo || !formData.cliente) return;

    const newObra = addObra({
      ...formData,
      presupuestoTotal: Number(formData.presupuestoTotal),
      margenEsperadoPct: Number(formData.margenEsperadoPct),
      estado: 'en_curso',
      fases: [
        { id: `f-${Date.now()}-1`, nombre: 'Demoliciones y Desescombro', progreso: 0, estado: 'pendiente', dias: 4, responsable: 'Por asignar' },
        { id: `f-${Date.now()}-2`, nombre: 'Instalaciones (Fontanería y Luz)', progreso: 0, estado: 'pendiente', dias: 8, responsable: 'Por asignar' },
        { id: `f-${Date.now()}-3`, nombre: 'Albañilería y Alicatados', progreso: 0, estado: 'pendiente', dias: 10, responsable: 'Por asignar' },
        { id: `f-${Date.now()}-4`, nombre: 'Pintura y Carpinterías', progreso: 0, estado: 'pendiente', dias: 6, responsable: 'Por asignar' },
        { id: `f-${Date.now()}-5`, nombre: 'Limpieza y Entrega de Llaves', progreso: 0, estado: 'pendiente', dias: 2, responsable: 'Por asignar' }
      ]
    });

    setShowNewModal(false);
    setSelectedObraId(newObra.id);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Bar with Search & New Obra */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <HardHat className="w-7 h-7 text-amber-400" />
            <span>Seguimiento de Obras y Reformas</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Control de fases constructivas, bitácora fotográfica diaria, cálculo de materiales y certificaciones
          </p>
        </div>

        <button
          onClick={handleOpenNewModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition shadow-lg shadow-amber-500/20 active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nueva Obra</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por obra, cliente, dirección o código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-none">
          {[
            { id: 'todas', label: 'Todas' },
            { id: 'en_curso', label: 'En Curso' },
            { id: 'presupuestada', label: 'Presupuestadas' },
            { id: 'finalizada', label: 'Finalizadas' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterState(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                filterState === f.id
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Works Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredObras.map(obra => {
          const isEnCurso = obra.estado === 'en_curso';
          const isFinalizada = obra.estado === 'finalizada';

          return (
            <div
              key={obra.id}
              onClick={() => setSelectedObraId(obra.id)}
              className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 p-5 rounded-2xl cursor-pointer transition shadow-sm hover:shadow-lg flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{obra.codigo}</span>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    isEnCurso
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : isFinalizada
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    {obra.estado.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition">{obra.titulo}</h3>
                
                <div className="space-y-1 text-xs text-slate-400 mt-2">
                  <p className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Cliente: <strong className="text-slate-300">{obra.cliente}</strong></span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span className="truncate">{obra.direccion}</span>
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Avance</span>
                    <span className="font-bold text-white">{obra.progreso}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isFinalizada ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-yellow-400'}`}
                      style={{ width: `${obra.progreso}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Bottom Financial Details */}
              <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Presupuesto</span>
                  <span className="font-bold text-white text-sm">{obra.presupuestoTotal?.toLocaleString('es-ES')} €</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Coste Real</span>
                  <span className="font-semibold text-slate-300">{obra.costeRealActual?.toLocaleString('es-ES')} €</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Margen</span>
                  <span className="font-bold text-emerald-400">{obra.margenRealPct || 35}%</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Nueva Obra con Selección de Presupuesto */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <HardHat className="w-5 h-5 text-amber-400" />
                  <span>Apertura de Nueva Obra o Reforma</span>
                </h3>
                <p className="text-xs text-slate-400">
                  {modalStep === 1 ? 'Paso 1: Selecciona el presupuesto de origen para extraer datos y fases' : 'Paso 2: Revisa y confirma los datos antes de iniciar'}
                </p>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* PASO 1: SELECCIONAR PRESUPUESTO */}
            {modalStep === 1 && (
              <div className="space-y-4">
                <p className="text-xs text-slate-300">
                  Selecciona el presupuesto aprobado de donde se extraerán automáticamente el presupuesto total, cliente, dirección y las <strong>fases de ejecución</strong> según los capítulos:
                </p>

                <div className="space-y-2.5">
                  {presupuestos.map((pres) => (
                    <div
                      key={pres.id}
                      onClick={() => handleSelectPresupuesto(pres)}
                      className="p-4 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 cursor-pointer transition flex items-center justify-between gap-4 group"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{pres.numero}</span>
                          <span className="font-bold text-white text-sm group-hover:text-amber-400 transition">{pres.obraTitulo}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Cliente: <strong className="text-slate-300">{pres.cliente}</strong> · {pres.direccion}</p>
                        <p className="text-[11px] text-amber-300/80 mt-0.5">Fases calculadas: {(Array.from(new Set((pres.partidas || []).map(p => p.capitulo)))).join(', ') || 'Generales'}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-black text-amber-400 block">{pres.totalConIva?.toLocaleString('es-ES')} €</span>
                        <span className="text-[10px] text-emerald-400 uppercase font-bold bg-emerald-500/10 px-2 py-0.5 rounded">Seleccionar →</span>
                      </div>
                    </div>
                  ))}

                  <div
                    onClick={() => handleSelectPresupuesto(null)}
                    className="p-4 rounded-xl bg-slate-900 border border-dashed border-slate-700 hover:border-slate-500 cursor-pointer transition text-center space-y-1"
                  >
                    <span className="text-xs font-bold text-slate-300">Crear obra manualmente (Sin presupuesto previo)</span>
                    <p className="text-[11px] text-slate-500">Se crearán fases constructivas estándar por defecto</p>
                  </div>
                </div>
              </div>
            )}

            {/* PASO 2: CONFIRMAR DATOS Y FASES */}
            {modalStep === 2 && (
              <form onSubmit={handleCreateObra} className="space-y-3 text-xs sm:text-sm">
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center justify-between text-xs text-amber-300">
                  <span>Datos y fases extraídas del presupuesto</span>
                  <button
                    type="button"
                    onClick={() => setModalStep(1)}
                    className="underline text-amber-400 font-bold"
                  >
                    Cambiar presupuesto
                  </button>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Título de la Obra *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Reforma Integral Vivienda C/ Goya"
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Nombre del Cliente *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Dña. Carmen Ruiz"
                      value={formData.cliente}
                      onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Teléfono de Contacto</label>
                    <input
                      type="text"
                      placeholder="+34 600 000 000"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Dirección de la Obra</label>
                  <input
                    type="text"
                    placeholder="Calle, número, piso y ciudad"
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Presupuesto Inicial (€)</label>
                    <input
                      type="number"
                      value={formData.presupuestoTotal}
                      onChange={(e) => setFormData({ ...formData, presupuestoTotal: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Margen Esperado (%)</label>
                    <input
                      type="number"
                      value={formData.margenEsperadoPct}
                      onChange={(e) => setFormData({ ...formData, margenEsperadoPct: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>

                {/* Desglose de Fases Extraídas */}
                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Fases Constructivas Automáticas ({formData.fases?.length})</label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
                    {formData.fases.map((f, i) => (
                      <div key={f.id} className="flex items-center justify-between text-slate-300">
                        <span>{i + 1}. {f.nombre}</span>
                        <span className="text-[10px] text-slate-500">{f.dias} días est.</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Fecha de Inicio</label>
                    <input
                      type="date"
                      value={formData.fechaInicio}
                      onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Fin Estimado</label>
                    <input
                      type="date"
                      value={formData.fechaFinEstimada}
                      onChange={(e) => setFormData({ ...formData, fechaFinEstimada: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Observaciones de la Obra</label>
                  <textarea
                    rows="2"
                    placeholder="Detalles sobre licencias, accesos, llaves..."
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setModalStep(1)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700"
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow"
                  >
                    Guardar y Abrir Obra
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
