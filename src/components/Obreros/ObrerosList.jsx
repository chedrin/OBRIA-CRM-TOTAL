import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Users,
  Star,
  HardHat,
  Sparkles,
  CheckCircle2,
  Phone,
  Briefcase,
  Award,
  TrendingUp,
  Plus,
  Filter,
  Search,
  MessageSquare,
  ThumbsUp,
  AlertCircle,
  FileText,
  Calendar,
  DollarSign,
  Printer,
  Copy,
  ShieldCheck,
  Lock,
  Unlock,
  RefreshCw,
  X,
  UserX,
  UserCheck,
  Clock,
  Check,
  Ban,
  Building,
  CreditCard,
  HeartHandshake
} from 'lucide-react';
import confetti from 'canvas-confetti';

const TRADES_AI_MATCH = [
  { id: 'alicatado', label: 'Alicatado Porcelánico Rectificado Gran Formato', gremio: 'Albañilería' },
  { id: 'demolicion', label: 'Demolición Estructural y Desescombro Rápido', gremio: 'Albañilería' },
  { id: 'pladur', label: 'Falsos Techos Pladur y Candilejas Foseadas LED', gremio: 'Yeso / Pladur' },
  { id: 'electricidad', label: 'Cuadro Eléctrico General y Boletín Oficial CIE', gremio: 'Electricidad' },
  { id: 'fontaneria', label: 'Fontanería Multicapa y Calefacción / Clima', gremio: 'Fontanería' },
  { id: 'pintura', label: 'Alisado de Gotelé Fino y Pintura Lisa Decorativa', gremio: 'Pintura' }
];

export default function ObrerosList() {
  const {
    employees = [],
    addEmployee,
    updateEmployee,
    terminateEmployee,
    rehireEmployee,
    addEmployeeAbsence,
    resetEmployeePassword,
    users = [],
    toggleUserStatus,
    obreros = [],
    obras = [],
    addReviewObrero,
    generateRandomPassword,
    showNotification
  } = useApp();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState('plantilla'); // 'plantilla', 'nominas', 'vacaciones', 'evaluaciones_ia'

  // Filters and Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos'); // 'todos', 'activo', 'vacaciones', 'baja', 'despedido'
  const [filterCategoria, setFilterCategoria] = useState('todos');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [detailActiveTab, setDetailActiveTab] = useState('personal'); // 'personal', 'laboral', 'vacaciones', 'acceso'
  
  // Termination modal
  const [showTerminationModal, setShowTerminationModal] = useState(false);
  const [employeeToTerminate, setEmployeeToTerminate] = useState(null);
  const [terminationForm, setTerminationForm] = useState({
    fechaBaja: new Date().toISOString().split('T')[0],
    motivoBaja: 'Fin de obra y rescisión de contrato por mutuo acuerdo',
    estado: 'baja' // 'baja' o 'despedido'
  });

  // Absence modal / form state
  const [showAddAbsenceModal, setShowAddAbsenceModal] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({
    tipo: 'vacaciones', // 'vacaciones', 'baja_it', 'permiso_retribuido'
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaFin: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    dias: 7,
    motivo: 'Vacaciones estivales',
    estado: 'aprobado'
  });

  // Export Gestoría Modal
  const [showGestoriaModal, setShowGestoriaModal] = useState(false);
  const [mesNomina, setMesNomina] = useState('Octubre 2026');

  // Rating Modal
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedObreroForReview, setSelectedObreroForReview] = useState(obreros[0]?.id || '');
  const [selectedObraForReview, setSelectedObraForReview] = useState(obras[0]?.titulo || '');
  const [criterioCalidad, setCriterioCalidad] = useState(5.0);
  const [criterioPlazos, setCriterioPlazos] = useState(5.0);
  const [criterioLimpieza, setCriterioLimpieza] = useState(5.0);
  const [criterioAutonomia, setCriterioAutonomia] = useState(5.0);
  const [comentarioReview, setComentarioReview] = useState('');

  // AI Recommender
  const [selectedTradeRecommender, setSelectedTradeRecommender] = useState(TRADES_AI_MATCH[0].id);

  // Form State: Nuevo Empleado
  const [newEmpForm, setNewEmpForm] = useState({
    nombre: '',
    apellidos: '',
    dni: '',
    naf: '',
    fechaNacimiento: '1990-05-15',
    direccion: '',
    telefono: '',
    email: '',
    iban: 'ES',
    categoria: 'Oficial 1ª',
    convenio: 'Convenio General del Sector de la Construcción (Madrid)',
    especialidad: 'Albañilería & Alicatados',
    tipoContrato: 'indefinido',
    jornadaHorasSemana: 40,
    salarioBaseMensual: 1850.00,
    plusConvenio: 220.00,
    precioHoraExtra: 18.50,
    irpfPct: 14.0,
    situacionFamiliar: 'soltero',
    hijosACargo: 0,
    dependientesACargo: 0,
    discapacidadPct: 0,
    fechaAlta: new Date().toISOString().split('T')[0],
    foto: 'https://images.unsplash.com/photo-1541888946425-d0fbb1861593?auto=format&fit=crop&w=200&q=80',
    createMobileAccount: true,
    mobileUsername: '',
    mobilePassword: ''
  });

  // Copied alert state
  const [copiedText, setCopiedText] = useState(null);

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Filtered employees
  const filteredEmployees = employees.filter(emp => {
    const matchesEstado = filterEstado === 'todos' || emp.estado === filterEstado;
    const matchesCat = filterCategoria === 'todos' || emp.categoria === filterCategoria;
    const matchesSearch =
      `${emp.nombre} ${emp.apellidos}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.dni && emp.dni.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.especialidad && emp.especialidad.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.categoria && emp.categoria.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesEstado && matchesCat && matchesSearch;
  });

  // Payroll Calculation Helper
  const calculatePayroll = (emp) => {
    const base = Number(emp.salarioBaseMensual || 0);
    const plus = Number(emp.plusConvenio || 0);
    const horasExtras = Number(emp.horasExtras || 0);
    const precioExtra = Number(emp.precioHoraExtra || 17.50);
    const totalExtras = horasExtras * precioExtra;

    const totalDevengado = base + plus + totalExtras;

    // Deducción SS Trabajador: 6.35% (4.70% CC + 1.55% Desempleo + 0.10% FP)
    const ssTrabajadorPct = 6.35;
    const deduccionSS = Number((totalDevengado * (ssTrabajadorPct / 100)).toFixed(2));

    // Retención IRPF (según Modelo 145 configurado)
    const irpfPct = Number(emp.irpfPct || 12);
    const retencionIrpf = Number((totalDevengado * (irpfPct / 100)).toFixed(2));

    const totalDeducciones = deduccionSS + retencionIrpf;
    const liquidoNeto = Number((totalDevengado - totalDeducciones).toFixed(2));

    // Coste SS Empresa: ~31.4% (23.6% CC + 5.5% Desempleo + 0.2% FOGASA + 0.6% FP + 1.5% IT/IMS)
    const ssEmpresaPct = 31.4;
    const costeSSEmpresa = Number((totalDevengado * (ssEmpresaPct / 100)).toFixed(2));
    const costeTotalEmpresa = Number((totalDevengado + costeSSEmpresa).toFixed(2));

    return {
      base,
      plus,
      horasExtras,
      precioExtra,
      totalExtras,
      totalDevengado,
      ssTrabajadorPct,
      deduccionSS,
      irpfPct,
      retencionIrpf,
      totalDeducciones,
      liquidoNeto,
      ssEmpresaPct,
      costeSSEmpresa,
      costeTotalEmpresa
    };
  };

  // Submit New Employee
  const handleCreateEmployeeSubmit = (e) => {
    e.preventDefault();
    if (!newEmpForm.nombre || !newEmpForm.dni) {
      showNotification('Nombre y DNI/NIE son obligatorios.', 'error');
      return;
    }

    const userCreds = newEmpForm.createMobileAccount ? {
      createAccount: true,
      username: newEmpForm.mobileUsername || `${newEmpForm.nombre.toLowerCase().trim()}.${newEmpForm.apellidos.toLowerCase().trim()}`.replace(/\s+/g, '.'),
      password: newEmpForm.mobilePassword || generateRandomPassword()
    } : null;

    addEmployee(newEmpForm, userCreds);

    confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
    setShowAddModal(false);

    // Reset form
    setNewEmpForm({
      nombre: '',
      apellidos: '',
      dni: '',
      naf: '',
      fechaNacimiento: '1990-05-15',
      direccion: '',
      telefono: '',
      email: '',
      iban: 'ES',
      categoria: 'Oficial 1ª',
      convenio: 'Convenio General del Sector de la Construcción (Madrid)',
      especialidad: 'Albañilería & Alicatados',
      tipoContrato: 'indefinido',
      jornadaHorasSemana: 40,
      salarioBaseMensual: 1850.00,
      plusConvenio: 220.00,
      precioHoraExtra: 18.50,
      irpfPct: 14.0,
      situacionFamiliar: 'soltero',
      hijosACargo: 0,
      dependientesACargo: 0,
      discapacidadPct: 0,
      fechaAlta: new Date().toISOString().split('T')[0],
      foto: 'https://images.unsplash.com/photo-1541888946425-d0fbb1861593?auto=format&fit=crop&w=200&q=80',
      createMobileAccount: true,
      mobileUsername: '',
      mobilePassword: ''
    });
  };

  // Open Termination Modal
  const handleOpenTermination = (emp) => {
    setEmployeeToTerminate(emp);
    setTerminationForm({
      fechaBaja: new Date().toISOString().split('T')[0],
      motivoBaja: 'Fin de obra y rescisión de contrato por mutuo acuerdo',
      estado: 'baja'
    });
    setShowTerminationModal(true);
  };

  // Confirm Termination
  const handleConfirmTermination = (e) => {
    e.preventDefault();
    if (!employeeToTerminate) return;

    terminateEmployee(employeeToTerminate.id, {
      motivoBaja: terminationForm.motivoBaja,
      fechaBaja: terminationForm.fechaBaja,
      estado: terminationForm.estado
    });

    setShowTerminationModal(false);
    if (selectedEmployee && selectedEmployee.id === employeeToTerminate.id) {
      setSelectedEmployee(prev => ({
        ...prev,
        estado: terminationForm.estado,
        fechaBaja: terminationForm.fechaBaja,
        motivoBaja: terminationForm.motivoBaja
      }));
    }
  };

  // Handle Add Absence Submit
  const handleAddAbsenceSubmit = (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    addEmployeeAbsence(selectedEmployee.id, absenceForm);

    setShowAddAbsenceModal(false);
    // Refresh modal local state
    const updated = employees.find(e => e.id === selectedEmployee.id);
    if (updated) setSelectedEmployee(updated);
  };

  // Handle Reset Password from detail
  const handleResetPassword = () => {
    if (!selectedEmployee) return;
    const newPass = generateRandomPassword();
    const res = resetEmployeePassword(selectedEmployee.id, newPass);
    if (res.success) {
      handleCopy(newPass, 'password');
    }
  };

  // Handle Review Modal Submit
  const handleSubmitReview = (e) => {
    e.preventDefault();
    if (!selectedObreroForReview) return;
    const media = Number(((criterioCalidad + criterioPlazos + criterioLimpieza + criterioAutonomia) / 4).toFixed(1));

    addReviewObrero(selectedObreroForReview, {
      obra: selectedObraForReview,
      nota: media,
      comentario: comentarioReview || 'Trabajo ejecutado según especificaciones de proyecto y calidad requerida.'
    });

    confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
    setShowRatingModal(false);
  };

  const activeEmployeesCount = employees.filter(e => e.estado === 'activo').length;
  const vacationEmployeesCount = employees.filter(e => e.estado === 'vacaciones').length;
  const terminatedEmployeesCount = employees.filter(e => e.estado === 'baja' || e.estado === 'despedido').length;

  return (
    <div className="space-y-6">
      
      {/* Top Header & Metrics */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Users className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Recursos Humanos & Nóminas</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Operarios ObraMaster
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Gestión integral de personal de obra: contratos, pre-nóminas (IRPF / Modelo 145), vacaciones, bajas IT y sincronización PWA
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowGestoriaModal(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-sm"
          >
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Resumen Nóminas Gestoría</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 transition shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Dar de Alta Empleado</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <HardHat className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">Plantilla Activa</span>
            <span className="text-lg font-black text-white">{activeEmployeesCount} operarios</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">En Vacaciones</span>
            <span className="text-lg font-black text-blue-400">{vacationEmployeesCount} operarios</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">Histórico Bajas</span>
            <span className="text-lg font-black text-slate-300">{terminatedEmployeesCount} registrados</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">Masa Salarial Mes</span>
            <span className="text-lg font-black text-amber-400">
              {employees
                .filter(e => e.estado === 'activo' || e.estado === 'vacaciones')
                .reduce((s, e) => s + (e.salarioBaseMensual || 0) + (e.plusConvenio || 0), 0)
                .toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-800 space-x-1 sm:space-x-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('plantilla')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'plantilla'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Fichas & Plantilla Laboral ({employees.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('nominas')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'nominas'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Simulador & Confección de Nóminas</span>
        </button>

        <button
          onClick={() => setActiveTab('vacaciones')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'vacaciones'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Vacaciones, Ausencias & Bajas IT</span>
        </button>

        <button
          onClick={() => setActiveTab('evaluaciones_ia')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'evaluaciones_ia'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Scoring & Recomendador de Gremios IA</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PLANTILLA & FICHAS LABORALES                                       */}
      {/* ========================================================================= */}
      {activeTab === 'plantilla' && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre, DNI o especialidad..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Filter Estado */}
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none"
              >
                <option value="todos">Todos los Estados</option>
                <option value="activo">🟢 Activo en Obra</option>
                <option value="vacaciones">🔵 En Vacaciones</option>
                <option value="baja">⚪ Baja Temporal / Rescisión</option>
                <option value="despedido">🔴 Despedido</option>
              </select>

              {/* Filter Categoría */}
              <select
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none"
              >
                <option value="todos">Todas las Categorías</option>
                <option value="Oficial 1ª">Oficial 1ª</option>
                <option value="Oficial 2ª">Oficial 2ª</option>
                <option value="Peón Especialista">Peón Especialista</option>
                <option value="Peón Ordinario">Peón Ordinario</option>
                <option value="Encargado">Encargado de Obra</option>
              </select>
            </div>
          </div>

          {/* Employees Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Operario / Empleado</th>
                    <th className="py-3 px-4">DNI / NAF SS</th>
                    <th className="py-3 px-4">Categoría & Especialidad</th>
                    <th className="py-3 px-4">Contrato & Horas</th>
                    <th className="py-3 px-4 text-right">Salario Base</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">App Móvil</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredEmployees.map((emp) => {
                    const linkedUser = users.find(u => u.id === emp.usuarioId || u.employeeId === emp.id);
                    const isMobileActive = linkedUser && linkedUser.isActive && emp.estado === 'activo';

                    return (
                      <tr key={emp.id} className="hover:bg-slate-800/30 transition group">
                        
                        {/* Employee Name & Photo */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={emp.foto || 'https://images.unsplash.com/photo-1541888946425-d0fbb1861593?auto=format&fit=crop&w=200&q=80'}
                              alt={emp.nombre}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0"
                            />
                            <div>
                              <span className="font-bold text-white text-sm block">
                                {emp.nombre} {emp.apellidos}
                              </span>
                              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-amber-400" />
                                {emp.telefono || 'Sin teléfono'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* DNI & NAF */}
                        <td className="py-3 px-4 font-mono">
                          <span className="text-slate-200 font-bold block">{emp.dni || 'Sin DNI'}</span>
                          <span className="text-[10px] text-slate-500 block">NAF: {emp.naf || 'Pendiente'}</span>
                        </td>

                        {/* Categoria & Especialidad */}
                        <td className="py-3 px-4">
                          <span className="font-semibold text-amber-400 block">{emp.categoria}</span>
                          <span className="text-[11px] text-slate-300 block truncate max-w-xs">{emp.especialidad}</span>
                        </td>

                        {/* Contrato */}
                        <td className="py-3 px-4">
                          <span className="capitalize text-slate-300 font-medium block">
                            {emp.tipoContrato === 'fijo_discontinuo' ? 'Fijo Discontinuo' : emp.tipoContrato}
                          </span>
                          <span className="text-[11px] text-slate-500">{emp.jornadaHorasSemana}h / semana</span>
                        </td>

                        {/* Salario */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          <span>{Number(emp.salarioBaseMensual || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                          <span className="text-[10px] text-slate-400 block font-normal">
                            +{emp.plusConvenio || 0}€ plus
                          </span>
                        </td>

                        {/* Estado */}
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                            emp.estado === 'activo'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : emp.estado === 'vacaciones'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                              : emp.estado === 'despedido'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              emp.estado === 'activo' ? 'bg-emerald-400 animate-pulse' : emp.estado === 'vacaciones' ? 'bg-blue-400' : 'bg-slate-500'
                            }`}></span>
                            {emp.estado}
                          </span>
                        </td>

                        {/* App Movil Access */}
                        <td className="py-3 px-4 text-center">
                          {linkedUser ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isMobileActive
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {isMobileActive ? 'Acceso Activo' : 'Suspendido'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">Sin usuario</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedEmployee(emp);
                                setDetailActiveTab('personal');
                                setShowDetailModal(true);
                              }}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded-lg font-bold text-xs transition border border-slate-700"
                              title="Ver ficha completa y nómina"
                            >
                              Ver Ficha
                            </button>

                            {emp.estado === 'activo' ? (
                              <button
                                onClick={() => handleOpenTermination(emp)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                                title="Tramitar baja o despido"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => rehireEmployee(emp.id)}
                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition"
                                title="Reactivar empleado en plantilla"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SIMULADOR & CONFECCIÓN DE NÓMINAS                                  */}
      {/* ========================================================================= */}
      {activeTab === 'nominas' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                <span>Simulador Pre-Nómina y Desglose Salarial Mensual</span>
              </h2>
              <p className="text-xs text-slate-400">
                Cálculo automático de retenciones IRPF (Modelo 145), aportación a la Seguridad Social (6.35%) y coste total empresa
              </p>
            </div>
            
            <button
              onClick={() => setShowGestoriaModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>Generar Listado Gestoría</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {employees.filter(e => e.estado === 'activo' || e.estado === 'vacaciones').map((emp) => {
              const p = calculatePayroll(emp);

              return (
                <div key={emp.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <img src={emp.foto} alt={emp.nombre} className="w-11 h-11 rounded-xl object-cover border border-slate-700" />
                      <div>
                        <h3 className="font-bold text-white text-sm">{emp.nombre} {emp.apellidos}</h3>
                        <p className="text-xs text-amber-400">{emp.categoria} · {emp.tipoContrato}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">DNI: {emp.dni}</span>
                      <span className="text-[10px] text-slate-500 font-mono block">IBAN: {emp.iban ? `${emp.iban.slice(0, 8)}...` : 'Sin cuenta'}</span>
                    </div>
                  </div>

                  {/* Devengos & Deducciones Grid */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    {/* Left: Devengos (Percepciones Salariales) */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2">
                      <span className="text-[10px] uppercase font-black text-emerald-400 tracking-wider block">
                        I. Devengos Salariales
                      </span>
                      <div className="flex justify-between text-slate-300">
                        <span>Salario Base:</span>
                        <span className="font-mono">{p.base.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Plus Convenio:</span>
                        <span className="font-mono">{p.plus.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Horas Extras ({p.horasExtras}h):</span>
                        <span className="font-mono">{p.totalExtras.toFixed(2)} €</span>
                      </div>
                      <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-white">
                        <span>Total Bruto:</span>
                        <span className="text-emerald-400 font-mono">{p.totalDevengado.toFixed(2)} €</span>
                      </div>
                    </div>

                    {/* Right: Deducciones Trabajador */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2">
                      <span className="text-[10px] uppercase font-black text-rose-400 tracking-wider block">
                        II. Deducciones Nómina
                      </span>
                      <div className="flex justify-between text-slate-300">
                        <span>Seg. Social ({p.ssTrabajadorPct}%):</span>
                        <span className="font-mono text-rose-400">-{p.deduccionSS.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Retención IRPF ({p.irpfPct}%):</span>
                        <span className="font-mono text-rose-400">-{p.retencionIrpf.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-slate-400 text-[10px]">
                        <span>Hijos: {emp.hijosACargo || 0} · {emp.situacionFamiliar}</span>
                        <span>Mod. 145</span>
                      </div>
                      <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-white">
                        <span>Total Retenido:</span>
                        <span className="text-rose-400 font-mono">-{p.totalDeducciones.toFixed(2)} €</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Footer */}
                  <div className="bg-gradient-to-r from-slate-950 to-slate-900 p-3.5 rounded-xl border border-amber-500/20 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Líquido a Percibir (Sueldo Neto)</span>
                      <span className="text-lg font-black text-amber-400 font-mono">
                        {p.liquidoNeto.toFixed(2)} €
                      </span>
                    </div>

                    <div className="text-right border-l border-slate-800 pl-4">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Coste Total Empresa</span>
                      <span className="text-xs font-bold text-slate-300 font-mono">
                        {p.costeTotalEmpresa.toFixed(2)} €
                      </span>
                      <span className="text-[10px] text-slate-500 block">Inc. SS Empresa (+{p.ssEmpresaPct}%)</span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: VACACIONES, AUSENCIAS & BAJAS IT                                   */}
      {/* ========================================================================= */}
      {activeTab === 'vacaciones' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                <span>Control de Tiempo, Vacaciones Anuales y Bajas Médicas</span>
              </h2>
              <p className="text-xs text-slate-400">
                Seguimiento de los 30 días de vacaciones por convenio y cómputo de Incapacidades Temporales (IT)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((emp) => {
              const totalVac = emp.vacacionesAnualesTotal || 30;
              const usedVac = emp.vacacionesConsumidas || 0;
              const pendingVac = Math.max(0, totalVac - usedVac);
              const pctUsed = Math.min(100, Math.round((usedVac / totalVac) * 100));

              return (
                <div key={emp.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow space-y-4">
                  <div className="flex items-center gap-3">
                    <img src={emp.foto} alt={emp.nombre} className="w-12 h-12 rounded-xl object-cover border border-slate-700" />
                    <div>
                      <h4 className="font-bold text-white text-sm">{emp.nombre} {emp.apellidos}</h4>
                      <p className="text-xs text-slate-400">{emp.categoria}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        emp.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-400' : emp.estado === 'vacaciones' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {emp.estado}
                      </span>
                    </div>
                  </div>

                  {/* Vacation Progress Bar */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Vacaciones Anuales:</span>
                      <span className="font-bold text-white">{usedVac} / {totalVac} días consumidos</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pctUsed > 80 ? 'bg-amber-400' : 'bg-blue-500'
                        }`}
                        style={{ width: `${pctUsed}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Saldo disponible: <strong className="text-emerald-400">{pendingVac} días</strong></span>
                      <span>{pctUsed}% gastado</span>
                    </div>
                  </div>

                  {/* Recent Absences */}
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Histórico de Ausencias:</span>
                    {emp.ausencias && emp.ausencias.length > 0 ? (
                      emp.ausencias.slice(0, 2).map((abs) => (
                        <div key={abs.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60 text-xs flex items-center justify-between">
                          <div>
                            <span className="font-bold text-amber-400 block capitalize">{abs.tipo.replace('_', ' ')}</span>
                            <span className="text-[10px] text-slate-400">{abs.fechaInicio} al {abs.fechaFin}</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                            {abs.dias} días
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">Sin ausencias registradas este año.</p>
                    )}
                  </div>

                  {/* Action button */}
                  <button
                    onClick={() => {
                      setSelectedEmployee(emp);
                      setShowAddAbsenceModal(true);
                    }}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Registrar Baja / Vacaciones</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SCORING & RECOMENDADOR DE GREMIOS IA                               */}
      {/* ========================================================================= */}
      {activeTab === 'evaluaciones_ia' && (
        <div className="space-y-6">
          
          {/* AI Recommender Card */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/30 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <Sparkles className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Recomendador Inteligente de Oficiales para Obras</h3>
                <p className="text-xs text-slate-300">
                  La IA analiza el histórico de calificaciones, especialidad y acabados para asignarte el mejor trabajador
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs text-slate-400 font-semibold mr-2">Selecciona partida crítica:</span>
              {TRADES_AI_MATCH.map(trade => (
                <button
                  key={trade.id}
                  onClick={() => setSelectedTradeRecommender(trade.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                    selectedTradeRecommender === trade.id
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {trade.label}
                </button>
              ))}
            </div>

            {/* AI Recommendation Result */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 mt-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 font-black">
                  98%
                </div>
                <div>
                  <span className="text-[11px] text-emerald-400 font-bold block uppercase tracking-wider">Candidato Recomendado por IA</span>
                  <span className="font-bold text-white text-sm">
                    {selectedTradeRecommender === 'alicatado' ? 'Pedro Gómez Castillo (Oficial 1ª)' :
                     selectedTradeRecommender === 'demolicion' ? 'Mario Silva Santos (Peón Especialista)' :
                     selectedTradeRecommender === 'pladur' ? 'Ionut Radu (Oficial 1ª Pladur)' :
                     selectedTradeRecommender === 'pintura' ? 'Antonio Morales Vega (Oficial 2ª)' :
                     'Pedro Gómez Castillo (Oficial 1ª)'}
                  </span>
                  <p className="text-xs text-slate-400 italic mt-0.5">
                    "Máxima puntuación histórica en acabados y cumplimiento milimétrico de plazos en reformas anteriores."
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedObreroForReview(obreros[0]?.id || '');
                  setShowRatingModal(true);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0"
              >
                <Star className="w-4 h-4 fill-amber-400" />
                <span>Calificar Trabajo de Obra</span>
              </button>
            </div>
          </div>

          {/* Workers Rating Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {obreros.map((obrero) => (
              <div key={obrero.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <img src={obrero.foto} alt={obrero.nombre} className="w-12 h-12 rounded-xl object-cover border border-slate-700" />
                    <div>
                      <h4 className="font-bold text-white text-sm">{obrero.nombre}</h4>
                      <p className="text-xs text-amber-400">{obrero.puesto}</p>
                      <span className="text-[10px] text-slate-500">{obrero.obrasRealizadas} obras realizadas</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20 text-amber-400">
                    <Star className="w-4 h-4 fill-amber-400" />
                    <span className="font-black text-sm">{obrero.calificacionMedia}</span>
                  </div>
                </div>

                {/* Rating Criteria Progress Bars */}
                {obrero.criterios && (
                  <div className="space-y-1.5 text-xs pt-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Calidad Acabados:</span>
                      <span className="font-bold text-white">{obrero.criterios.calidadAcabados} / 5.0</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Puntualidad Plazos:</span>
                      <span className="font-bold text-white">{obrero.criterios.puntualidadPlazos} / 5.0</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Limpieza y Seguridad:</span>
                      <span className="font-bold text-white">{obrero.criterios.limpiezaSeguridad} / 5.0</span>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedObreroForReview(obrero.id);
                      setShowRatingModal(true);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>Añadir Valoración</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: DAR DE ALTA EMPLEADO (CRUD COMPLETO)                             */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400 stroke-[3]" />
                <span>Alta Integral de Empleado (Ficha Laboral & Acceso PWA)</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployeeSubmit} className="space-y-4 text-xs">
              
              {/* Sección 1: Datos Personales */}
              <div>
                <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider block mb-2">
                  1. Datos Personales y de Contacto
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Nombre *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Pedro"
                      value={newEmpForm.nombre}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewEmpForm(prev => ({
                          ...prev,
                          nombre: val,
                          mobileUsername: prev.mobileUsername || `${val.toLowerCase().trim()}.${(prev.apellidos || '').toLowerCase().trim()}`.replace(/\s+/g, '.')
                        }));
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Apellidos *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Gómez Castillo"
                      value={newEmpForm.apellidos}
                      onChange={(e) => setNewEmpForm({ ...newEmpForm, apellidos: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">DNI / NIE *</label>
                    <input
                      type="text"
                      required
                      placeholder="47123984K"
                      value={newEmpForm.dni}
                      onChange={(e) => setNewEmpForm({ ...newEmpForm, dni: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Nº Afiliación Seg. Social (NAF)</label>
                    <input
                      type="text"
                      placeholder="28 12345678 90"
                      value={newEmpForm.naf}
                      onChange={(e) => setNewEmpForm({ ...newEmpForm, naf: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Teléfono Móvil</label>
                    <input
                      type="text"
                      placeholder="+34 611 223 344"
                      value={newEmpForm.telefono}
                      onChange={(e) => setNewEmpForm({ ...newEmpForm, telefono: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Cuenta Bancaria (IBAN)</label>
                    <input
                      type="text"
                      placeholder="ES76 2100 0418 4502 0005 1122"
                      value={newEmpForm.iban}
                      onChange={(e) => setNewEmpForm({ ...newEmpForm, iban: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Condiciones Laborales */}
              <div className="pt-2 border-t border-slate-800">
                <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider block mb-2">
                  2. Parámetros Laborales y Salario
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Categoría Profesional</label>
                    <select
                      value={newEmpForm.categoria}
                      onChange={(e) => setNewEmpForm({ ...newEmpForm, categoria: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    >
                      <option value="Oficial 1ª">Oficial 1ª</option>
                      <option value="Oficial 2ª">Oficial 2ª</option>
                      <option value="Peón Especialista">Peón Especialista</option>
                      <option value="Peón Ordinario">Peón Ordinario</option>
                      <option value="Encargado">Encargado de Obra</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Tipo de Contrato</label>
                    <select
                      value={newEmpForm.tipoContrato}
                      onChange={(e) => setNewEmpForm({ ...newEmpForm, tipoContrato: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    >
                      <option value="indefinido">Indefinido</option>
                      <option value="fijo_discontinuo">Fijo Discontinuo</option>
                      <option value="temporal">Temporal</option>
                      <option value="practicas">Prácticas / Formación</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Especialidad Principal</label>
                    <input
                      type="text"
                      placeholder="Ej: Alicatados y Yesos"
                      value={newEmpForm.especialidad}
                      onChange={(e) => setNewEmpForm({ ...newEmpForm, especialidad: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Salario Base Mensual (€)</label>
                    <input
                      type="number"
                      step="10"
                      value={newEmpForm.salarioBaseMensual}
                      onChange={(e) => setNewEmpForm({ ...newEmpForm, salarioBaseMensual: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Plus Convenio (€)</label>
                    <input
                      type="number"
                      step="5"
                      value={newEmpForm.plusConvenio}
                      onChange={(e) => setNewEmpForm({ ...newEmpForm, plusConvenio: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Precio Hora Extra (€/h)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newEmpForm.precioHoraExtra}
                      onChange={(e) => setNewEmpForm({ ...newEmpForm, precioHoraExtra: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Fiscalidad e IRPF (Modelo 145) */}
              <div className="pt-2 border-t border-slate-800">
                <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider block mb-2">
                  3. Fiscalidad e IRPF (Modelo 145)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Retención IRPF (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="2"
                      max="45"
                      value={newEmpForm.irpfPct}
                      onChange={(e) => setNewEmpForm({ ...newEmpForm, irpfPct: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Situación Familiar</label>
                    <select
                      value={newEmpForm.situacionFamiliar}
                      onChange={(e) => setNewEmpForm({ ...newEmpForm, situacionFamiliar: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    >
                      <option value="soltero">Soltero / Sin cargas</option>
                      <option value="casado">Casado / Pareja de hecho</option>
                      <option value="monoparental">Monoparental</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Hijos / Descendientes a cargo</label>
                    <input
                      type="number"
                      min="0"
                      value={newEmpForm.hijosACargo}
                      onChange={(e) => setNewEmpForm({ ...newEmpForm, hijosACargo: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 4: Credenciales App Móvil */}
              <div className="pt-2 border-t border-slate-800 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Acceso al Portal Móvil (/#empleados)</span>
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={newEmpForm.createMobileAccount}
                      onChange={(e) => setNewEmpForm({ ...newEmpForm, createMobileAccount: e.target.checked })}
                      className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <span>Generar usuario</span>
                  </label>
                </div>

                {newEmpForm.createMobileAccount && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="text-slate-400 block mb-1 text-[11px]">Usuario móvil sugerido</label>
                      <input
                        type="text"
                        placeholder="pedro.gomez"
                        value={newEmpForm.mobileUsername}
                        onChange={(e) => setNewEmpForm({ ...newEmpForm, mobileUsername: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-slate-400 text-[11px]">Contraseña temporal</label>
                        <button
                          type="button"
                          onClick={() => setNewEmpForm({ ...newEmpForm, mobilePassword: generateRandomPassword() })}
                          className="text-amber-400 hover:text-amber-300 text-[10px] font-bold"
                        >
                          Generar aleatoria
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Obra123!"
                        value={newEmpForm.mobilePassword}
                        onChange={(e) => setNewEmpForm({ ...newEmpForm, mobilePassword: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black transition shadow-lg shadow-amber-500/20"
                >
                  Guardar y Dar de Alta
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FICHA INTEGRAL DE EMPLEADO (DETALLE + TABS + EDICIÓN)            */}
      {/* ========================================================================= */}
      {showDetailModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl p-6 shadow-2xl space-y-5 my-8">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-4">
                <img
                  src={selectedEmployee.foto}
                  alt={selectedEmployee.nombre}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-700 shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-white">{selectedEmployee.nombre} {selectedEmployee.apellidos}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      selectedEmployee.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      selectedEmployee.estado === 'vacaciones' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                      'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {selectedEmployee.estado}
                    </span>
                  </div>
                  <p className="text-xs text-amber-400 font-semibold">{selectedEmployee.categoria} · {selectedEmployee.especialidad}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">DNI: {selectedEmployee.dni} · NAF: {selectedEmployee.naf || 'Sin asignar'}</p>
                </div>
              </div>

              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Internal Detail Tabs */}
            <div className="flex border-b border-slate-800 space-x-3 text-xs font-bold">
              <button
                onClick={() => setDetailActiveTab('personal')}
                className={`pb-2.5 border-b-2 transition ${
                  detailActiveTab === 'personal' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                1. Datos Personales & Banco
              </button>
              <button
                onClick={() => setDetailActiveTab('laboral')}
                className={`pb-2.5 border-b-2 transition ${
                  detailActiveTab === 'laboral' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                2. Contrato, Nómina & IRPF
              </button>
              <button
                onClick={() => setDetailActiveTab('vacaciones')}
                className={`pb-2.5 border-b-2 transition ${
                  detailActiveTab === 'vacaciones' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                3. Vacaciones & Bajas IT
              </button>
              <button
                onClick={() => setDetailActiveTab('acceso')}
                className={`pb-2.5 border-b-2 transition ${
                  detailActiveTab === 'acceso' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                4. Acceso Móvil PWA
              </button>
            </div>

            {/* TAB CONTENT 1: PERSONAL & BANCO */}
            {detailActiveTab === 'personal' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Teléfono de Contacto</span>
                    <span className="text-sm font-semibold text-white">{selectedEmployee.telefono || 'No registrado'}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Correo Electrónico</span>
                    <span className="text-sm font-semibold text-white">{selectedEmployee.email || 'No registrado'}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 sm:col-span-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Dirección de Domicilio</span>
                    <span className="text-sm font-semibold text-white">{selectedEmployee.direccion || 'Sin domicilio especificado'}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 sm:col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Cuenta Bancaria para Transferencia de Nómina</span>
                      <span className="text-sm font-mono font-bold text-amber-400">{selectedEmployee.iban || 'ES00 0000 0000 0000 0000 0000'}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(selectedEmployee.iban, 'iban')}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                      title="Copiar IBAN"
                    >
                      {copiedText === 'iban' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-400 text-[11px]">
                  <strong>Fecha de Alta en la Empresa:</strong> {selectedEmployee.fechaAlta}
                  {selectedEmployee.fechaBaja && (
                    <span className="text-rose-400 ml-3">
                      <strong>Fecha de Baja:</strong> {selectedEmployee.fechaBaja} ({selectedEmployee.motivoBaja})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: LABORAL, NÓMINA & IRPF */}
            {detailActiveTab === 'laboral' && (() => {
              const p = calculatePayroll(selectedEmployee);

              return (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Tipo de Contrato</span>
                      <span className="text-sm font-bold text-white capitalize">{selectedEmployee.tipoContrato}</span>
                      <span className="text-[10px] text-slate-400 block">{selectedEmployee.jornadaHorasSemana}h semanales</span>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Salario Base Pactado</span>
                      <span className="text-sm font-bold text-amber-400 font-mono">{p.base.toFixed(2)} €/mes</span>
                      <span className="text-[10px] text-slate-400 block">Plus: {p.plus.toFixed(2)} €</span>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Retención IRPF (Mod. 145)</span>
                      <span className="text-sm font-bold text-rose-400 font-mono">{p.irpfPct}%</span>
                      <span className="text-[10px] text-slate-400 block">{selectedEmployee.hijosACargo} hijos · {selectedEmployee.situacionFamiliar}</span>
                    </div>
                  </div>

                  {/* Pre-payroll simulation box */}
                  <div className="bg-gradient-to-r from-slate-950 to-slate-900 p-4 rounded-xl border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-amber-400" />
                        <span>Simulación Nómina del Mes Actual</span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">Días trabajados: {selectedEmployee.diasTrabajadosMes || 21}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Total Bruto</span>
                        <span className="text-sm font-bold text-white font-mono">{p.totalDevengado.toFixed(2)} €</span>
                      </div>
                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">SS Obrero (6.35%)</span>
                        <span className="text-sm font-bold text-rose-400 font-mono">-{p.deduccionSS.toFixed(2)} €</span>
                      </div>
                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">IRPF ({p.irpfPct}%)</span>
                        <span className="text-sm font-bold text-rose-400 font-mono">-{p.retencionIrpf.toFixed(2)} €</span>
                      </div>
                      <div className="bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/30">
                        <span className="text-[10px] text-amber-400 font-bold block">Sueldo Neto</span>
                        <span className="text-sm font-black text-amber-300 font-mono">{p.liquidoNeto.toFixed(2)} €</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                      <span>Aportación SS Empresa estimada (~31.4%): <strong className="text-slate-300 font-mono">+{p.costeSSEmpresa.toFixed(2)} €</strong></span>
                      <span>Coste Total Empresa: <strong className="text-white font-mono">{p.costeTotalEmpresa.toFixed(2)} €</strong></span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* TAB CONTENT 3: VACACIONES & BAJAS */}
            {detailActiveTab === 'vacaciones' && (
              <div className="space-y-4 text-xs">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Saldo de Vacaciones 2026</span>
                    <span className="text-base font-bold text-white">
                      {selectedEmployee.vacacionesConsumidas || 0} consumidos de {selectedEmployee.vacacionesAnualesTotal || 30} días
                    </span>
                    <p className="text-[11px] text-emerald-400 mt-0.5">
                      Disponibles: <strong>{(selectedEmployee.vacacionesAnualesTotal || 30) - (selectedEmployee.vacacionesConsumidas || 0)} días naturales</strong>
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAddAbsenceModal(true)}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold flex items-center gap-1.5 transition shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Ausencia</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 block">Registro de Ausencias y Bajas</span>
                  {selectedEmployee.ausencias && selectedEmployee.ausencias.length > 0 ? (
                    selectedEmployee.ausencias.map((abs) => (
                      <div key={abs.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white capitalize">{abs.tipo.replace('_', ' ')}</span>
                            <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded-md font-mono">
                              {abs.dias} días
                            </span>
                          </div>
                          <span className="text-slate-400 text-[11px]">Desde {abs.fechaInicio} hasta {abs.fechaFin}</span>
                          {abs.motivo && <p className="text-slate-400 italic text-[11px] mt-0.5">{abs.motivo}</p>}
                        </div>
                        <span className="text-emerald-400 text-xs font-bold font-mono uppercase bg-emerald-500/10 px-2 py-0.5 rounded">
                          {abs.estado}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center text-slate-500">
                      No hay ausencias o bajas registradas en el histórico.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT 4: ACCESO MÓVIL PWA */}
            {detailActiveTab === 'acceso' && (() => {
              const linkedUser = users.find(u => u.id === selectedEmployee.usuarioId || u.employeeId === selectedEmployee.id);

              return (
                <div className="space-y-4 text-xs">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        <div>
                          <h4 className="font-bold text-white text-sm">Credenciales para la App del Obrero</h4>
                          <p className="text-[11px] text-slate-400">Ruta de acceso: <code className="text-amber-400 font-mono">/#empleados</code></p>
                        </div>
                      </div>

                      {linkedUser && (
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          linkedUser.isActive && selectedEmployee.estado === 'activo'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {linkedUser.isActive && selectedEmployee.estado === 'activo' ? 'Acceso Autorizado' : 'Acceso Suspendido'}
                        </span>
                      )}
                    </div>

                    {linkedUser ? (
                      <div className="space-y-3 pt-2 border-t border-slate-800">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-500 font-bold block">Nombre de Usuario</span>
                            <span className="text-sm font-mono font-bold text-white">{linkedUser.username}</span>
                          </div>
                          <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-slate-500 font-bold block">Contraseña Actual</span>
                              <span className="text-sm font-mono font-bold text-amber-400">{linkedUser.password}</span>
                            </div>
                            <button
                              onClick={() => handleCopy(linkedUser.password, 'pass')}
                              className="p-1.5 text-slate-400 hover:text-white"
                              title="Copiar contraseña"
                            >
                              {copiedText === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Action buttons for mobile access */}
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <button
                            onClick={handleResetPassword}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Regenerar Contraseña</span>
                          </button>

                          <button
                            onClick={() => toggleUserStatus(linkedUser.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                              linkedUser.isActive
                                ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30'
                                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {linkedUser.isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            <span>{linkedUser.isActive ? 'Suspender Acceso' : 'Reactivar Acceso'}</span>
                          </button>

                          <button
                            onClick={() => {
                              const msg = `Hola ${selectedEmployee.nombre}, aquí tienes tus datos de acceso a la App de ObraMaster:\n\n🔗 Web: ${window.location.origin}/#empleados\n👤 Usuario: ${linkedUser.username}\n🔑 Contraseña: ${linkedUser.password}\n\nRecuerda añadirla a la pantalla de inicio desde tu navegador.`;
                              handleCopy(msg, 'whatsapp');
                              showNotification('Mensaje copiado para enviar por WhatsApp o SMS.');
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{copiedText === 'whatsapp' ? '¡Copiado!' : 'Copiar para WhatsApp'}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-400 italic">Este operario no tiene cuenta móvil creada.</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                {selectedEmployee.estado === 'activo' ? (
                  <button
                    onClick={() => handleOpenTermination(selectedEmployee)}
                    className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Tramitar Baja / Despido</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      rehireEmployee(selectedEmployee.id);
                      setSelectedEmployee(prev => ({ ...prev, estado: 'activo', fechaBaja: null }));
                    }}
                    className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reactivar Empleado</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition"
              >
                Cerrar Ficha
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: TRAMITAR BAJA / DESPIDO (BORRADO LÓGICO Y SUSPENSIÓN INMEDIATA)  */}
      {/* ========================================================================= */}
      {showTerminationModal && employeeToTerminate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-400" />
                <span>Tramitar Rescisión / Baja Laboral</span>
              </h3>
              <button onClick={() => setShowTerminationModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-300">
              Vas a tramitar la baja de <strong>{employeeToTerminate.nombre} {employeeToTerminate.apellidos}</strong>. El historial de costes, partes y registros en obras se conservará íntegramente. Su acceso a la App Móvil será revocado de inmediato.
            </p>

            <form onSubmit={handleConfirmTermination} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Tipo de Rescisión</label>
                <select
                  value={terminationForm.estado}
                  onChange={(e) => setTerminationForm({ ...terminationForm, estado: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  <option value="baja">Baja Voluntaria / Fin de Obra / Excedencia</option>
                  <option value="despedido">Despido Disciplinario u Objetivo</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Fecha Efectiva de Baja</label>
                <input
                  type="date"
                  required
                  value={terminationForm.fechaBaja}
                  onChange={(e) => setTerminationForm({ ...terminationForm, fechaBaja: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Motivo / Observaciones para Gestoría</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Fin de contrato y liquidación de vacaciones no disfrutadas..."
                  value={terminationForm.motivoBaja}
                  onChange={(e) => setTerminationForm({ ...terminationForm, motivoBaja: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTerminationModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition shadow-lg shadow-rose-600/30"
                >
                  Confirmar Baja y Bloquear Acceso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: AÑADIR AUSENCIA / BAJA IT                                        */}
      {/* ========================================================================= */}
      {showAddAbsenceModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                <span>Registrar Ausencia o Baja IT</span>
              </h3>
              <button onClick={() => setShowAddAbsenceModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400">
              Operario: <strong className="text-white">{selectedEmployee.nombre} {selectedEmployee.apellidos}</strong>
            </p>

            <form onSubmit={handleAddAbsenceSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Tipo de Ausencia</label>
                <select
                  value={absenceForm.tipo}
                  onChange={(e) => setAbsenceForm({ ...absenceForm, tipo: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  <option value="vacaciones">Vacaciones Retribuidas</option>
                  <option value="baja_it">Baja IT (Enfermedad Común / Accidente)</option>
                  <option value="permiso_retribuido">Permiso Retribuido (Maternidad/Paternidad/Deber)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    required
                    value={absenceForm.fechaInicio}
                    onChange={(e) => setAbsenceForm({ ...absenceForm, fechaInicio: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Fecha Fin</label>
                  <input
                    type="date"
                    required
                    value={absenceForm.fechaFin}
                    onChange={(e) => setAbsenceForm({ ...absenceForm, fechaFin: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Días Computables</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={absenceForm.dias}
                  onChange={(e) => setAbsenceForm({ ...absenceForm, dias: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Motivo / Diagnóstico confidencial</label>
                <input
                  type="text"
                  placeholder="Ej: Esguince tobillo o vacaciones verano"
                  value={absenceForm.motivo}
                  onChange={(e) => setAbsenceForm({ ...absenceForm, motivo: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddAbsenceModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold transition shadow"
                >
                  Guardar Ausencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: RESUMEN MENSUAL NÓMINAS PARA GESTORÍA                            */}
      {/* ========================================================================= */}
      {showGestoriaModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-400" />
                  <span>Resumen Consolidado de Nóminas para Gestoría Laboral</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Periodo de Liquidación: <strong className="text-amber-400">{mesNomina}</strong>
                </p>
              </div>
              <button onClick={() => setShowGestoriaModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold text-[11px]">
                    <th className="py-2.5 px-3">Operario</th>
                    <th className="py-2.5 px-3">DNI / NAF</th>
                    <th className="py-2.5 px-3">Categoría</th>
                    <th className="py-2.5 px-3 text-right">Bruto Devengado</th>
                    <th className="py-2.5 px-3 text-right">SS Obrero (6.35%)</th>
                    <th className="py-2.5 px-3 text-right">IRPF</th>
                    <th className="py-2.5 px-3 text-right">Neto a Pagar</th>
                    <th className="py-2.5 px-3 text-right">SS Empresa</th>
                    <th className="py-2.5 px-3 text-right">Coste Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {employees.filter(e => e.estado === 'activo' || e.estado === 'vacaciones').map((emp) => {
                    const p = calculatePayroll(emp);
                    return (
                      <tr key={emp.id} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-sans font-bold text-white">{emp.nombre} {emp.apellidos}</td>
                        <td className="py-2 px-3 text-slate-400 text-[10px]">{emp.dni}<br/>{emp.naf}</td>
                        <td className="py-2 px-3 font-sans text-slate-300 text-[11px]">{emp.categoria}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-400">{p.totalDevengado.toFixed(2)} €</td>
                        <td className="py-2 px-3 text-right text-rose-400">-{p.deduccionSS.toFixed(2)} €</td>
                        <td className="py-2 px-3 text-right text-rose-400">-{p.retencionIrpf.toFixed(2)} € ({p.irpfPct}%)</td>
                        <td className="py-2 px-3 text-right font-black text-amber-400">{p.liquidoNeto.toFixed(2)} €</td>
                        <td className="py-2 px-3 text-right text-slate-400">{p.costeSSEmpresa.toFixed(2)} €</td>
                        <td className="py-2 px-3 text-right font-bold text-white">{p.costeTotalEmpresa.toFixed(2)} €</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totales consolidado */}
            {(() => {
              const activeEmps = employees.filter(e => e.estado === 'activo' || e.estado === 'vacaciones');
              const totalBruto = activeEmps.reduce((s, e) => s + calculatePayroll(e).totalDevengado, 0);
              const totalSSObrero = activeEmps.reduce((s, e) => s + calculatePayroll(e).deduccionSS, 0);
              const totalIrpf = activeEmps.reduce((s, e) => s + calculatePayroll(e).retencionIrpf, 0);
              const totalNeto = activeEmps.reduce((s, e) => s + calculatePayroll(e).liquidoNeto, 0);
              const totalSSEmpresa = activeEmps.reduce((s, e) => s + calculatePayroll(e).costeSSEmpresa, 0);
              const totalCoste = activeEmps.reduce((s, e) => s + calculatePayroll(e).costeTotalEmpresa, 0);

              return (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Total Masa Bruta:</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">{totalBruto.toFixed(2)} €</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Total IRPF (Modelo 111):</span>
                    <span className="text-sm font-bold text-rose-400 font-mono">{totalIrpf.toFixed(2)} €</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Total SS (TC1 / TC2):</span>
                    <span className="text-sm font-bold text-rose-400 font-mono">{(totalSSObrero + totalSSEmpresa).toFixed(2)} €</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Total Transferencias Netas:</span>
                    <span className="text-sm font-black text-amber-400 font-mono">{totalNeto.toFixed(2)} €</span>
                  </div>
                </div>
              );
            })()}

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-[11px] text-slate-400 italic">Listo para adjuntar al Modelo 111 y remesa bancaria SEPA.</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  onClick={() => setShowGestoriaModal(false)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: CALIFICAR TRABAJO (PRESERVADO)                                   */}
      {/* ========================================================================= */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <span>Calificar Desempeño en Obra</span>
              </h3>
              <button onClick={() => setShowRatingModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Operario / Subcontrata</label>
                <select
                  value={selectedObreroForReview}
                  onChange={(e) => setSelectedObreroForReview(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  {obreros.map(o => (
                    <option key={o.id} value={o.id}>{o.nombre} ({o.puesto})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Obra Ejecutada</label>
                <select
                  value={selectedObraForReview}
                  onChange={(e) => setSelectedObraForReview(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  {obras.map(ob => (
                    <option key={ob.id} value={ob.titulo}>{ob.titulo}</option>
                  ))}
                </select>
              </div>

              {/* Sliders */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300">Calidad de Acabados</span>
                    <span className="text-amber-400 font-bold">{criterioCalidad} / 5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={criterioCalidad}
                    onChange={(e) => setCriterioCalidad(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300">Cumplimiento de Plazos</span>
                    <span className="text-amber-400 font-bold">{criterioPlazos} / 5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={criterioPlazos}
                    onChange={(e) => setCriterioPlazos(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300">Limpieza y Seguridad</span>
                    <span className="text-amber-400 font-bold">{criterioLimpieza} / 5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={criterioLimpieza}
                    onChange={(e) => setCriterioLimpieza(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Comentario para Historial Interno</label>
                <textarea
                  rows="2"
                  placeholder="Excelente corte de ingletes en azulejos, obra entregada limpia..."
                  value={comentarioReview}
                  onChange={(e) => setComentarioReview(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRatingModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold transition shadow"
                >
                  Guardar Calificación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
