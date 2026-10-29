import React, { useState, useMemo } from 'react';
import BarraProgreso from '../Common/BarraProgreso';
import { useApp } from '../../context/AppContext';
import {
  Users,
  Star,
  HardHat,
  Sparkles,
  CheckCircle2,
  Phone,
  Plus,
  Filter,
  Search,
  MessageSquare,
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
  Check,
  Ban,
  CreditCard,
  KeyRound,
  Eye,
  EyeOff
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
    createMobileAccountForEmployee,
    users = [],
    toggleUserStatus,
    obreros = [],
    obras = [],
    addReviewObrero,
    updateObreroScoringDirect,
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
  const [scoringMode, setScoringMode] = useState('direct'); // 'direct' (override) | 'average' (weighted)

  // AI Recommender
  const [selectedTradeRecommender, setSelectedTradeRecommender] = useState(TRADES_AI_MATCH[0].id);

  // Helper to compute clean normalized username
  const computeUsername = (nombre, apellidos) => {
    const raw = `${nombre || ''} ${apellidos || ''}`.trim();
    if (!raw) return '';
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join('.');
  };

  const initialNewEmpForm = {
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
    mobilePassword: '',
    isCustomUsername: false
  };

  // Form State: Nuevo Empleado
  const [newEmpForm, setNewEmpForm] = useState(initialNewEmpForm);
  const [createdCredentialsModal, setCreatedCredentialsModal] = useState(null);
  const [showPasswordInModal, setShowPasswordInModal] = useState(false);

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
  const handleCreateEmployeeSubmit = async (e) => {
    e.preventDefault();
    if (!newEmpForm.nombre || !newEmpForm.dni) {
      showNotification('Nombre y DNI/NIE son obligatorios.', 'error');
      return;
    }

    const cleanUsername = (newEmpForm.mobileUsername || computeUsername(newEmpForm.nombre, newEmpForm.apellidos) || 'operario')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9.]/g, '')
      .replace(/\.+/g, '.')
      .replace(/^\.|\.$/g, '');

    const typedPassword = (newEmpForm.mobilePassword || '').trim();
    const finalPassword = typedPassword.length >= 8 ? typedPassword : generateRandomPassword();

    const userCreds = newEmpForm.createMobileAccount ? {
      createAccount: true,
      username: cleanUsername,
      password: finalPassword
    } : null;

    const res = await addEmployee(newEmpForm, userCreds);

    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    setShowAddModal(false);

    if (userCreds && res?.credentials) {
      setCreatedCredentialsModal({
        fullName: `${newEmpForm.nombre} ${newEmpForm.apellidos}`.trim(),
        username: res.credentials.username,
        password: res.credentials.password,
        phone: newEmpForm.telefono || '',
        dni: newEmpForm.dni || ''
      });
    }

    // Reset form
    setNewEmpForm(initialNewEmpForm);
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
  const handleResetPassword = async () => {
    if (!selectedEmployee) return;
    const newPass = generateRandomPassword();
    const res = await resetEmployeePassword(selectedEmployee.id, newPass);
    if (res.success) {
      handleCopy(newPass, 'password');
    }
  };

  const openRatingModalForObrero = (targetObrero) => {
    if (!targetObrero) return;
    setSelectedObreroForReview(targetObrero.id);
    const scoreVal = Number(targetObrero.calificacionMedia || 5.0);
    const crit = targetObrero.criterios || {
      calidadAcabados: scoreVal,
      puntualidadPlazos: scoreVal,
      limpiezaSeguridad: scoreVal,
      autonomiaProblemas: scoreVal
    };
    setCriterioCalidad(Number(crit.calidadAcabados ?? 5.0));
    setCriterioPlazos(Number(crit.puntualidadPlazos ?? 5.0));
    setCriterioLimpieza(Number(crit.limpiezaSeguridad ?? 5.0));
    setCriterioAutonomia(Number(crit.autonomiaProblemas ?? 5.0));
    setComentarioReview('');
    setScoringMode('direct');
    setShowRatingModal(true);
  };

  const handleWorkerSelectChange = (newObreroId) => {
    setSelectedObreroForReview(newObreroId);
    const target = obreros.find(o => o.id === newObreroId);
    if (target) {
      const scoreVal = Number(target.calificacionMedia || 5.0);
      const crit = target.criterios || {
        calidadAcabados: scoreVal,
        puntualidadPlazos: scoreVal,
        limpiezaSeguridad: scoreVal,
        autonomiaProblemas: scoreVal
      };
      setCriterioCalidad(Number(crit.calidadAcabados ?? 5.0));
      setCriterioPlazos(Number(crit.puntualidadPlazos ?? 5.0));
      setCriterioLimpieza(Number(crit.limpiezaSeguridad ?? 5.0));
      setCriterioAutonomia(Number(crit.autonomiaProblemas ?? 5.0));
    }
  };

  // Quick preset helper to quickly set all criteria
  const handleApplyRatingPreset = (presetScore) => {
    setCriterioCalidad(presetScore);
    setCriterioPlazos(presetScore);
    setCriterioLimpieza(presetScore);
    setCriterioAutonomia(presetScore);
  };

  // Handle Review Modal Submit
  const handleSubmitReview = (e) => {
    e.preventDefault();
    if (!selectedObreroForReview) return;
    const computedMedia = Number(((criterioCalidad + criterioPlazos + criterioLimpieza + criterioAutonomia) / 4).toFixed(1));

    addReviewObrero(selectedObreroForReview, {
      obra: selectedObraForReview || 'Inspección de Obra',
      nota: computedMedia,
      isDirectOverride: scoringMode === 'direct',
      criterios: {
        calidadAcabados: criterioCalidad,
        puntualidadPlazos: criterioPlazos,
        limpiezaSeguridad: criterioLimpieza,
        autonomiaProblemas: criterioAutonomia
      },
      comentario: comentarioReview || (
        computedMedia >= 4.5
          ? 'Excelente trabajo ejecutado según especificaciones y acabados impecables.'
          : computedMedia >= 3.0
          ? 'Trabajo aceptable con aspectos a mejorar en remates o tiempos.'
          : 'Incidencias detectadas en calidad, plazos o remates de obra.'
      )
    });

    confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
    setShowRatingModal(false);
  };

  // Dynamic AI Worker Recommendation based on live real scoring
  const recommendedWorker = useMemo(() => {
    const tradeKeywords = {
      alicatado: ['alicat', 'porcelan', 'soler', 'azulej', 'albañil'],
      demolicion: ['demolic', 'desescombr', 'peón', 'carga'],
      pladur: ['pladur', 'yeso', 'techo', 'falso techo'],
      electricidad: ['electr', 'cuadro', 'bt', 'cie'],
      fontaneria: ['fontan', 'clima', 'aeroterm', 'tuber', 'gas'],
      pintura: ['pint', 'gotel', 'alisad', 'lac']
    };

    const keywords = tradeKeywords[selectedTradeRecommender] || [];
    
    // Find workers that match this specialty
    const matching = obreros.filter(o => {
      const text = `${o.nombre || ''} ${o.puesto || ''} ${o.especialidad || ''}`.toLowerCase();
      return keywords.some(k => text.includes(k));
    });

    const pool = matching.length > 0 ? matching : obreros;
    const sorted = [...pool].sort((a, b) => (Number(b.calificacionMedia) || 0) - (Number(a.calificacionMedia) || 0));
    const top = sorted[0] || obreros[0];

    const matchPct = top ? Math.min(99, Math.round(((Number(top.calificacionMedia) || 5) / 5) * 100)) : 95;

    return {
      worker: top,
      matchPct,
      tradeLabel: TRADES_AI_MATCH.find(t => t.id === selectedTradeRecommender)?.label || 'Partida'
    };
  }, [obreros, selectedTradeRecommender]);

  const activeEmployeesCount = employees.filter(e => e.estado === 'activo').length;
  const vacationEmployeesCount = employees.filter(e => e.estado === 'vacaciones').length;
  const terminatedEmployeesCount = employees.filter(e => e.estado === 'baja' || e.estado === 'despedido').length;

  return (
    <div className="space-y-6">
      
      {/* Top Header & Metrics */}
      <div className="flex flex-wrap items-center justify-end gap-3">
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
                className="flex-1 min-w-0 sm:flex-none bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none"
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
                className="flex-1 min-w-0 sm:flex-none bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none"
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
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-amber-400" />
                                  {emp.telefono || 'Sin teléfono'}
                                </span>
                                {(() => {
                                  const matchedObrero = obreros.find(o => o.id === emp.obreroId || `${o.nombre || ''}`.toLowerCase() === `${emp.nombre || ''} ${emp.apellidos || ''}`.toLowerCase().trim());
                                  const scoreVal = matchedObrero?.calificacionMedia ?? emp.calificacionMedia;
                                  if (scoreVal === undefined) return null;
                                  const isGood = scoreVal >= 4.0;
                                  const isMid = scoreVal >= 3.0;
                                  return (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md inline-flex items-center gap-0.5 ${
                                      isGood
                                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                        : isMid
                                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                        : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                    }`}>
                                      <Star className="w-2.5 h-2.5 fill-current" />
                                      {Number(scoreVal).toFixed(1)}
                                    </span>
                                  );
                                })()}
                              </div>
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
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isMobileActive
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {isMobileActive ? 'Acceso Activo' : 'Suspendido'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">@{linkedUser.username}</span>
                            </div>
                          ) : (
                            <button
                              onClick={async () => {
                                const res = await createMobileAccountForEmployee(emp.id);
                                if (res.success) {
                                  setCreatedCredentialsModal({
                                    fullName: `${emp.nombre} ${emp.apellidos}`.trim(),
                                    username: res.credentials.username,
                                    password: res.credentials.password,
                                    phone: emp.telefono || '',
                                    dni: emp.dni || ''
                                  });
                                }
                              }}
                              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition flex items-center gap-1 mx-auto"
                              title="Generar credenciales para la App Móvil"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Activar App</span>
                            </button>
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
                    <BarraProgreso valor={pctUsed} alto="h-5" color={pctUsed > 80 ? 'bg-amber-400' : 'bg-blue-500'} />
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
                <div className={`w-11 h-11 rounded-full flex items-center justify-center border font-black text-xs shrink-0 ${
                  recommendedWorker.matchPct >= 85
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : recommendedWorker.matchPct >= 65
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                }`}>
                  {recommendedWorker.matchPct}%
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                      Candidato Recomendado por IA
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ({recommendedWorker.tradeLabel})
                    </span>
                  </div>
                  <span className="font-bold text-white text-sm block">
                    {recommendedWorker.worker?.nombre} ({recommendedWorker.worker?.puesto})
                  </span>
                  <p className="text-xs text-slate-400 italic mt-0.5">
                    {recommendedWorker.matchPct >= 85
                      ? `"Máxima puntuación técnica (${Number(recommendedWorker.worker?.calificacionMedia || 5).toFixed(1)}⭐) en acabados y cumplimiento milimétrico de plazos."`
                      : recommendedWorker.matchPct >= 65
                      ? `"Puntuación moderada (${Number(recommendedWorker.worker?.calificacionMedia || 3.5).toFixed(1)}⭐). Se recomienda seguimiento en plazos y remates."`
                      : `"⚠️ Puntuación reciente baja (${Number(recommendedWorker.worker?.calificacionMedia || 2).toFixed(1)}⭐). Revisar antes de asignar o considerar subcontrata."`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => openRatingModalForObrero(recommendedWorker.worker || obreros[0])}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0"
              >
                <Star className="w-4 h-4 fill-amber-400" />
                <span>Calificar Trabajo de Obra</span>
              </button>
            </div>
          </div>

          {/* Workers Rating Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {obreros.map((obrero) => {
              const score = Number(obrero.calificacionMedia || 5.0);
              const crit = obrero.criterios || {
                calidadAcabados: score,
                puntualidadPlazos: score,
                limpiezaSeguridad: score,
                autonomiaProblemas: score
              };

              const badgeColor = score >= 4.5
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : score >= 3.5
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : score >= 2.5
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400';

              const barColor = (val) => val >= 4 ? 'bg-emerald-400' : val >= 3 ? 'bg-amber-400' : 'bg-rose-400';

              return (
                <div key={obrero.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow space-y-4 hover:border-slate-700 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img src={obrero.foto} alt={obrero.nombre} className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0" />
                      <div>
                        <h4 className="font-bold text-white text-sm">{obrero.nombre}</h4>
                        <p className="text-xs text-amber-400">{obrero.puesto}</p>
                        <span className="text-[10px] text-slate-500">{obrero.obrasRealizadas || 0} obras evaluadas</span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-black text-sm ${badgeColor}`}>
                      <Star className="w-4 h-4 fill-current" />
                      <span>{score.toFixed(1)}</span>
                    </div>
                  </div>

                  {/* Rating Criteria Progress Bars */}
                  <div className="space-y-2 pt-1 text-xs">
                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span className="text-slate-400">Calidad Acabados:</span>
                        <span className="font-bold text-white font-mono">{Number(crit.calidadAcabados || 5).toFixed(1)} / 5.0</span>
                      </div>
                      <BarraProgreso valor={((crit.calidadAcabados || 5) / 5) * 100} alto="h-3" color={barColor(crit.calidadAcabados || 5)} />
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span className="text-slate-400">Puntualidad Plazos:</span>
                        <span className="font-bold text-white font-mono">{Number(crit.puntualidadPlazos || 5).toFixed(1)} / 5.0</span>
                      </div>
                      <BarraProgreso valor={((crit.puntualidadPlazos || 5) / 5) * 100} alto="h-3" color={barColor(crit.puntualidadPlazos || 5)} />
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span className="text-slate-400">Limpieza y Seguridad:</span>
                        <span className="font-bold text-white font-mono">{Number(crit.limpiezaSeguridad || 5).toFixed(1)} / 5.0</span>
                      </div>
                      <BarraProgreso valor={((crit.limpiezaSeguridad || 5) / 5) * 100} alto="h-3" color={barColor(crit.limpiezaSeguridad || 5)} />
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 mb-1">
                        <span className="text-slate-400">Autonomía y Resolución:</span>
                        <span className="font-bold text-white font-mono">{Number(crit.autonomiaProblemas || 5).toFixed(1)} / 5.0</span>
                      </div>
                      <BarraProgreso valor={((crit.autonomiaProblemas || 5) / 5) * 100} alto="h-3" color={barColor(crit.autonomiaProblemas || 5)} />
                    </div>
                  </div>

                  {/* Últimas Reseñas */}
                  {obrero.ultimasResenas && obrero.ultimasResenas.length > 0 && (
                    <div className="pt-2 border-t border-slate-800 text-[11px] bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="font-bold text-slate-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Última Evaluación:</span>
                        </span>
                        <span className="font-mono font-bold text-amber-400">{Number(obrero.ultimasResenas[0].nota || 5).toFixed(1)}⭐ ({obrero.ultimasResenas[0].fecha})</span>
                      </div>
                      <p className="text-slate-400 italic line-clamp-2">
                        "{obrero.ultimasResenas[0].comentario}"
                      </p>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1" title="Ajuste rápido de estrellas">
                      {[1, 2, 3, 4, 5].map((starVal) => (
                        <button
                          key={starVal}
                          type="button"
                          onClick={() => updateObreroScoringDirect(obrero.id, starVal)}
                          className={`p-1 rounded hover:bg-slate-800 transition ${
                            starVal <= Math.round(score) ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
                          }`}
                          title={`Fijar scoring directo a ${starVal}⭐`}
                        >
                          <Star className="w-3.5 h-3.5 fill-current" />
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => openRatingModalForObrero(obrero)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>Calificar Criterios</span>
                    </button>
                  </div>
                </div>
              );
            })}
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
              <button onClick={() => setShowAddModal(false)} aria-label="Cerrar" className="text-slate-400 hover:text-white">
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
                          mobileUsername: prev.isCustomUsername ? prev.mobileUsername : computeUsername(val, prev.apellidos)
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
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewEmpForm(prev => ({
                          ...prev,
                          apellidos: val,
                          mobileUsername: prev.isCustomUsername ? prev.mobileUsername : computeUsername(prev.nombre, val)
                        }));
                      }}
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
                  <div className="space-y-3 mt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-slate-400 text-[11px] font-semibold">Usuario de Acceso Móvil *</label>
                          {newEmpForm.isCustomUsername && (
                            <button
                              type="button"
                              onClick={() => setNewEmpForm(prev => ({
                                ...prev,
                                isCustomUsername: false,
                                mobileUsername: computeUsername(prev.nombre, prev.apellidos)
                              }))}
                              className="text-[10px] text-amber-400 hover:underline"
                            >
                              Auto
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="ej: pedro.gomez"
                          value={newEmpForm.mobileUsername}
                          onChange={(e) => setNewEmpForm({ ...newEmpForm, mobileUsername: e.target.value.toLowerCase(), isCustomUsername: true })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-slate-400 text-[11px] font-semibold">Contraseña para la App *</label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setNewEmpForm({ ...newEmpForm, mobilePassword: generateRandomPassword() })}
                              className="text-amber-400 hover:text-amber-300 text-[10px] font-bold"
                            >
                              ⚡ Aleatoria
                            </button>
                          </div>
                        </div>
                        <div className="relative">
                          <input
                            type={showPasswordInModal ? 'text' : 'password'}
                            placeholder="Vacío = clave segura automática"
                            value={newEmpForm.mobilePassword}
                            onChange={(e) => setNewEmpForm({ ...newEmpForm, mobilePassword: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 pr-8 text-amber-300 font-mono text-xs font-bold focus:outline-none focus:border-amber-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswordInModal(!showPasswordInModal)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                          >
                            {showPasswordInModal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      💡 El operario podrá entrar en <code className="text-amber-400 font-mono">/#empleados</code> con este <strong>usuario</strong>, con su <strong>número de móvil</strong> o con su <strong>DNI</strong>.
                    </p>
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

              <button onClick={() => setShowDetailModal(false)} aria-label="Cerrar" className="text-slate-400 hover:text-white p-1">
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
                              <span className="text-sm font-mono font-bold text-amber-400">{linkedUser.password || '••••••••'}</span>
                            </div>
                            <button
                              disabled={!linkedUser.password}
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
                              const msg = `Hola ${selectedEmployee.nombre}, aquí tienes tus datos de acceso a la App de ObraMaster:\n\n🔗 Web: ${window.location.origin}/#empleados\n👤 Usuario: ${linkedUser.username}\n🔑 Contraseña: ${linkedUser.password || '(pídesela a la oficina)'}\n\nRecuerda añadirla a la pantalla de inicio desde tu navegador.`;
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
                      <div className="pt-2 border-t border-slate-800 space-y-3">
                        <p className="text-slate-300 text-xs">
                          Este operario no tiene cuenta de acceso vinculada al portal móvil (<code>/#empleados</code>).
                        </p>
                        <button
                          onClick={async () => {
                            const res = await createMobileAccountForEmployee(selectedEmployee.id);
                            if (res.success) {
                              const updatedEmp = employees.find(e => e.id === selectedEmployee.id);
                              if (updatedEmp) setSelectedEmployee(updatedEmp);
                              setCreatedCredentialsModal({
                                fullName: `${selectedEmployee.nombre} ${selectedEmployee.apellidos}`.trim(),
                                username: res.credentials.username,
                                password: res.credentials.password,
                                phone: selectedEmployee.telefono || '',
                                dni: selectedEmployee.dni || ''
                              });
                            }
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition"
                        >
                          <KeyRound className="w-4 h-4" />
                          <span>Generar Acceso Móvil Ahora (clave segura automática)</span>
                        </button>
                      </div>
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
              <button aria-label="Cerrar" onClick={() => setShowTerminationModal(false)} className="text-slate-400 hover:text-white">✕</button>
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
              <button aria-label="Cerrar" onClick={() => setShowAddAbsenceModal(false)} className="text-slate-400 hover:text-white">✕</button>
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
              <button aria-label="Cerrar" onClick={() => setShowGestoriaModal(false)} className="text-slate-400 hover:text-white">✕</button>
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
      {showRatingModal && (() => {
        const currentSelectedObrero = obreros.find(o => o.id === selectedObreroForReview) || obreros[0];
        const computedMedia = Number(((criterioCalidad + criterioPlazos + criterioLimpieza + criterioAutonomia) / 4).toFixed(1));

        const scoreColor = computedMedia >= 4.5
          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
          : computedMedia >= 3.5
          ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
          : computedMedia >= 2.5
          ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
          : 'text-rose-400 bg-rose-500/10 border-rose-500/30';

        const scoreLabel = computedMedia >= 4.5
          ? 'Excelente / Sobresaliente'
          : computedMedia >= 3.5
          ? 'Bueno / Rendimiento Adecuado'
          : computedMedia >= 2.5
          ? 'Regular / Requiere Supervisión'
          : 'Deficiente / Calificación Muy Baja';

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 my-6">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Star className="w-4 h-4 fill-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Evaluación & Scoring de Operario</h3>
                    <p className="text-[11px] text-slate-400">Ajusta la calificación técnica y los criterios de desempeño</p>
                  </div>
                </div>
                <button aria-label="Cerrar" onClick={() => setShowRatingModal(false)} className="text-slate-400 hover:text-white text-sm p-1">✕</button>
              </div>

              {/* Worker selector & preview */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src={currentSelectedObrero?.foto || 'https://images.unsplash.com/photo-1541888946425-d0fbb1861593?auto=format&fit=crop&w=200&q=80'}
                    alt={currentSelectedObrero?.nombre}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] uppercase font-bold text-slate-500 block">Seleccionar Operario</label>
                    <select
                      value={selectedObreroForReview}
                      onChange={(e) => handleWorkerSelectChange(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1 px-2 text-white font-bold text-xs focus:outline-none focus:border-amber-400"
                    >
                      {obreros.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.nombre} ({o.puesto}) - Actual: {Number(o.calificacionMedia || 5).toFixed(1)}⭐
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Live Scoring Display */}
                <div className={`p-3 rounded-xl border flex items-center justify-between ${scoreColor}`}>
                  <div className="flex items-center gap-2">
                    <Star className="w-6 h-6 fill-current" />
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black">{computedMedia.toFixed(1)}</span>
                        <span className="text-xs opacity-70">/ 5.0</span>
                      </div>
                      <span className="text-[11px] font-bold block">{scoreLabel}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider block opacity-70">Puntuación Actual</span>
                    <span className="text-xs font-mono font-bold">{Number(currentSelectedObrero?.calificacionMedia || 5).toFixed(1)}⭐</span>
                  </div>
                </div>
              </div>

              {/* Mode Selector */}
              <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setScoringMode('direct')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition text-center ${
                    scoringMode === 'direct'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ⚡ Ajuste Directo (Inmediato)
                </button>
                <button
                  type="button"
                  onClick={() => setScoringMode('average')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition text-center ${
                    scoringMode === 'average'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📋 Promedio Ponderado
                </button>
              </div>

              {/* Quick Presets */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                  Ajuste Rápido de Calificación:
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { val: 5.0, label: '5.0', desc: 'Excelente', color: 'hover:border-emerald-500 hover:text-emerald-400' },
                    { val: 4.0, label: '4.0', desc: 'Bueno', color: 'hover:border-emerald-500 hover:text-emerald-400' },
                    { val: 3.0, label: '3.0', desc: 'Regular', color: 'hover:border-amber-500 hover:text-amber-400' },
                    { val: 2.0, label: '2.0', desc: 'Bajo', color: 'hover:border-rose-500 hover:text-rose-400' },
                    { val: 1.0, label: '1.0', desc: 'Mínimo', color: 'hover:border-rose-500 hover:text-rose-400' }
                  ].map(preset => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => handleApplyRatingPreset(preset.val)}
                      className={`p-1.5 rounded-xl bg-slate-800 border text-center transition ${preset.color} ${
                        computedMedia === preset.val ? 'border-amber-400 text-amber-300 font-bold bg-slate-750' : 'border-slate-700 text-slate-300'
                      }`}
                    >
                      <span className="text-xs font-black block">{preset.label}⭐</span>
                      <span className="text-[9px] block text-slate-400">{preset.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders Form */}
              <form onSubmit={handleSubmitReview} className="space-y-3 text-xs">
                
                {/* 4 Detailed Sliders */}
                <div className="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-300 font-medium">1. Calidad de Acabados</span>
                      <span className="text-amber-400 font-mono font-bold">{criterioCalidad.toFixed(1)} / 5.0</span>
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
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-300 font-medium">2. Cumplimiento de Plazos</span>
                      <span className="text-amber-400 font-mono font-bold">{criterioPlazos.toFixed(1)} / 5.0</span>
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
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-300 font-medium">3. Limpieza y Seguridad</span>
                      <span className="text-amber-400 font-mono font-bold">{criterioLimpieza.toFixed(1)} / 5.0</span>
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

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-300 font-medium">4. Autonomía y Resolución</span>
                      <span className="text-amber-400 font-mono font-bold">{criterioAutonomia.toFixed(1)} / 5.0</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.5"
                      value={criterioAutonomia}
                      onChange={(e) => setCriterioAutonomia(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>

                {/* Obra and Comments */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Obra Imputada</label>
                    <select
                      value={selectedObraForReview}
                      onChange={(e) => setSelectedObraForReview(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white"
                    >
                      <option value="Evaluación General de Dirección">Evaluación General de Dirección</option>
                      {obras.map(ob => (
                        <option key={ob.id} value={ob.titulo}>{ob.titulo}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Motivo / Comentario</label>
                    <input
                      type="text"
                      placeholder="Ej: Remates impecables en ingletes..."
                      value={comentarioReview}
                      onChange={(e) => setComentarioReview(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
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
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black transition shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Guardar Calificación ({computedMedia.toFixed(1)}⭐)</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL CONFIRMACIÓN: CREDENCIALES GENERADAS PARA EL OPERARIO               */}
      {/* ========================================================================= */}
      {createdCredentialsModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-emerald-500/40 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                ¡Acceso Móvil Generado con Éxito!
              </span>
              <h3 className="text-lg font-black text-white">{createdCredentialsModal.fullName}</h3>
              <p className="text-xs text-slate-300">
                Las credenciales están listas para que el operario acceda a su portal en <code className="text-amber-400 font-mono">/#empleados</code>.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Enlace de la App:</span>
                <code className="text-amber-400 font-mono font-bold">{window.location.origin}/#empleados</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Usuario móvil:</span>
                <div className="flex items-center gap-1.5">
                  <code className="text-white font-mono font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {createdCredentialsModal.username}
                  </code>
                  <button
                    onClick={() => handleCopy(createdCredentialsModal.username, 'cred_user')}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    {copiedText === 'cred_user' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Contraseña:</span>
                <div className="flex items-center gap-1.5">
                  <code className="text-amber-400 font-mono font-black bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {createdCredentialsModal.password}
                  </code>
                  <button
                    onClick={() => handleCopy(createdCredentialsModal.password, 'cred_pass')}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    {copiedText === 'cred_pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              {createdCredentialsModal.phone && (
                <div className="flex items-center justify-between pt-1 text-slate-400 border-t border-slate-800/60">
                  <span>Teléfono (login alternativo):</span>
                  <span className="text-slate-300 font-mono">{createdCredentialsModal.phone}</span>
                </div>
              )}
              {createdCredentialsModal.dni && (
                <div className="flex items-center justify-between text-slate-400">
                  <span>DNI (login alternativo):</span>
                  <span className="text-slate-300 font-mono">{createdCredentialsModal.dni}</span>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  const msg = `Hola ${createdCredentialsModal.fullName}, aquí tienes tus datos de acceso a la App de ObraMaster:\n\n🔗 Web Móvil: ${window.location.origin}/#empleados\n👤 Usuario: ${createdCredentialsModal.username}\n🔑 Contraseña: ${createdCredentialsModal.password}\n\n(También puedes identificarte con tu teléfono o DNI).\nRecuerda usar la opción 'Añadir a pantalla de inicio' en tu navegador para tenerla como app.`;
                  handleCopy(msg, 'cred_whatsapp');
                  showNotification('¡Mensaje copiado para enviar por WhatsApp o SMS!');
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition flex items-center justify-center gap-2 text-xs shadow-lg shadow-emerald-600/20"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{copiedText === 'cred_whatsapp' ? '¡Mensaje Copiado!' : 'Copiar Mensaje para WhatsApp / SMS'}</span>
              </button>

              <button
                onClick={() => setCreatedCredentialsModal(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl transition text-xs"
              >
                Entendido / Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
