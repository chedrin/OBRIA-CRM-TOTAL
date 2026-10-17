import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Percent,
  FileText,
  Sparkles,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  DollarSign,
  Upload,
  RefreshCw,
  Sliders,
  Database,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Building2,
  Phone,
  Mail,
  Star,
  Receipt,
  X,
  Calendar,
  Check,
  Ban,
  Clock,
  Eye,
  Lock,
  Layers,
  ChevronRight,
  MessageSquare,
  HelpCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

const SIMULATED_NEW_QUOTES = [
  {
    id: 'sim-carpinteria',
    subcontrata: 'Carpintería y Maderas Robles SL',
    gremio: 'Carpintería',
    archivoNombre: 'Tarifas_Puertas_Tarimas_2026.pdf',
    resumen: 'Actualización de costes de puertas de paso block lacadas (+12%) y tarimas laminadas AC5 (+9%) por costes de tablero hidrófugo.',
    margenDefecto: 25,
    partidasDetectadas: [
      { codigo: 'CAR-01', concepto: 'Suministro y colocación de puerta de paso maciza block lacada blanco 72.5cm', unidad: 'ud', precioAnterior: 215.00, nuevoPrecioSubcontrata: 240.00, variacionPct: 11.6, margenConfiguradoPct: 25, nuevoPvpCliente: 300.00 },
      { codigo: 'CAR-02', concepto: 'Instalación de suelo laminado AC5 alta resistencia con rodapié lacado', unidad: 'm²', precioAnterior: 19.00, nuevoPrecioSubcontrata: 21.00, variacionPct: 10.5, margenConfiguradoPct: 25, nuevoPvpCliente: 26.25 },
      { codigo: 'CAR-03', concepto: 'Frente de armario empotrado 2 puertas correderas suelo-techo', unidad: 'ud', precioAnterior: 550.00, nuevoPrecioSubcontrata: 620.00, variacionPct: 12.7, margenConfiguradoPct: 30, nuevoPvpCliente: 806.00 }
    ]
  },
  {
    id: 'sim-fontaneria',
    subcontrata: 'ClimaTec Fontanería y Aerotermia',
    gremio: 'Fontanería',
    archivoNombre: 'Presupuesto_Fontaneria_Otoño_ClimaTec.pdf',
    resumen: 'Incremento en accesorios multicapa y latón. Platos de ducha de resina pizarra con descuento por volumen.',
    margenDefecto: 30,
    partidasDetectadas: [
      { codigo: 'FON-01', concepto: 'Punto de agua fría y caliente con tubería multicapa aislada', unidad: 'ud', precioAnterior: 58.00, nuevoPrecioSubcontrata: 65.00, variacionPct: 12.1, margenConfiguradoPct: 30, nuevoPvpCliente: 84.50 },
      { codigo: 'FON-02', concepto: 'Punto de desagüe en PVC insonorizado de 40mm/50mm', unidad: 'ud', precioAnterior: 40.00, nuevoPrecioSubcontrata: 45.00, variacionPct: 12.5, margenConfiguradoPct: 30, nuevoPvpCliente: 58.50 },
      { codigo: 'FON-03', concepto: 'Instalación de plato de ducha resina pizarra con válvula sifónica gran caudal', unidad: 'ud', precioAnterior: 130.00, nuevoPrecioSubcontrata: 120.00, variacionPct: -7.7, margenConfiguradoPct: 30, nuevoPvpCliente: 156.00 }
    ]
  }
];

export default function SubcontratasList() {
  const {
    subcontractors = [],
    addSubcontractor,
    updateSubcontractor,
    addSubcontractorBudget,
    updateSubcontractorBudgetStatus,
    addSubcontractorInvoice,
    updateSubcontractorInvoiceStatus,
    addSubcontractorNote,
    addSubcontractorReview,
    obras = [],
    subcontratasPresupuestos = [],
    setSubcontratasPresupuestos,
    basePrecios = [],
    setBasePrecios,
    applySubcontrataPresupuesto,
    showNotification
  } = useApp();

  // Main Tabs: 'directorio', 'presupuestos_comparador', 'facturas_desviaciones', 'base_precios'
  const [activeTab, setActiveTab] = useState('directorio');

  // Subcontractor Filters
  const [searchSubQuery, setSearchSubQuery] = useState('');
  const [filterGremioSub, setFilterGremioSub] = useState('todos');
  const [filterPRLStatus, setFilterPRLStatus] = useState('todos'); // 'todos', 'vigente', 'proximo', 'caducado'

  // Subcontractor Detail Modal / Drawer
  const [selectedSubcontractor, setSelectedSubcontractor] = useState(null);
  const [detailTab, setDetailTab] = useState('prl'); // 'prl', 'presupuestos', 'facturas', 'bitacora', 'scoring'

  // New Subcontractor Modal
  const [showAddSubModal, setShowAddSubModal] = useState(false);
  const [newSubForm, setNewSubForm] = useState({
    razonSocial: '',
    nombreComercial: '',
    cif: '',
    gremio: 'Electricidad y Climatización',
    personaContacto: '',
    telefono: '',
    telefonoUrgencias: '',
    email: '',
    direccion: '',
    seguroRCCompania: 'Mapfre Empresas',
    seguroRCPoliza: '',
    seguroRCSuma: 300000,
    seguroRCFechaCaducidad: '2027-12-31'
  });

  // Add Budget to Subcontractor Modal
  const [showAddBudgetModal, setShowAddBudgetModal] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    obraId: obras[0]?.id || '',
    importeSubcontrata: 1500,
    estado: 'recibido',
    concepto: 'Instalación completa de circuitos y mecanismos'
  });

  // Add Invoice to Subcontractor Modal
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    numero: `FAC-SUB-${Date.now().toString().slice(-4)}`,
    obraId: obras[0]?.id || '',
    presupuestoVinculadoId: '',
    baseImponible: 1500,
    ivaPct: 21,
    estadoPago: 'pendiente'
  });

  // New Note state
  const [newNoteText, setNewNoteText] = useState('');

  // Scoring Form State
  const [scoringForm, setScoringForm] = useState({
    puntualidad: 5,
    calidad: 5,
    limpieza: 5,
    trato: 5,
    comentario: '',
    obraTitulo: obras[0]?.titulo || 'General'
  });

  // Subcontractor Quotes Inbox State (Existing Feature)
  const [selectedSubPresId, setSelectedSubPresId] = useState(subcontratasPresupuestos[0]?.id || null);
  const [customMargins, setCustomMargins] = useState({});
  const [globalMarginInput, setGlobalMarginInput] = useState(25);

  // Base de Precios State (Existing Feature)
  const [searchPrecios, setSearchPrecios] = useState('');
  const [filterGremio, setFilterGremio] = useState('todos');
  const [showAddMasterModal, setShowAddMasterModal] = useState(false);
  const [newMasterItem, setNewMasterItem] = useState({
    codigo: '',
    capitulo: 'Albañilería',
    gremio: 'Albañilería',
    concepto: '',
    unidad: 'm²',
    costeSubcontrata: 15.00,
    margenPct: 30
  });

  // Helper for PRL Traffic Light Status
  const getPRLTrafficLight = (sub) => {
    if (!sub.prl || !sub.prl.seguroRCFechaCaducidad) {
      return { status: 'desconocido', label: 'Sin Datos PRL', color: 'bg-slate-500', badgeClass: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
    const today = new Date();
    const expiry = new Date(sub.prl.seguroRCFechaCaducidad);
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0 || sub.prl.aptoEntrarObra === false) {
      return { status: 'caducado', label: 'CADUCADO / BLOQUEADO', color: 'bg-rose-500', badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
    } else if (diffDays <= 30) {
      return { status: 'proximo', label: `Vence en ${diffDays} días`, color: 'bg-amber-400', badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    } else {
      return { status: 'vigente', label: 'Vigente y Apto', color: 'bg-emerald-400', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    }
  };

  // Filter Subcontractors
  const filteredSubcontractors = subcontractors.filter(sub => {
    const matchesGremio = filterGremioSub === 'todos' || sub.gremio.toLowerCase().includes(filterGremioSub.toLowerCase());
    const prl = getPRLTrafficLight(sub);
    const matchesPRL = filterPRLStatus === 'todos' || prl.status === filterPRLStatus;
    const matchesSearch =
      sub.razonSocial.toLowerCase().includes(searchSubQuery.toLowerCase()) ||
      sub.nombreComercial.toLowerCase().includes(searchSubQuery.toLowerCase()) ||
      sub.cif.toLowerCase().includes(searchSubQuery.toLowerCase()) ||
      sub.gremio.toLowerCase().includes(searchSubQuery.toLowerCase()) ||
      sub.personaContacto.toLowerCase().includes(searchSubQuery.toLowerCase());
    return matchesGremio && matchesPRL && matchesSearch;
  });

  // Base Precios Filtering
  const filteredBasePrecios = basePrecios.filter(bp => {
    const matchesGremio = filterGremio === 'todos' || bp.gremio === filterGremio || bp.capitulo === filterGremio;
    const matchesSearch =
      bp.codigo.toLowerCase().includes(searchPrecios.toLowerCase()) ||
      bp.concepto.toLowerCase().includes(searchPrecios.toLowerCase()) ||
      bp.capitulo.toLowerCase().includes(searchPrecios.toLowerCase());
    return matchesGremio && matchesSearch;
  });

  // Handle Add Subcontractor Submit
  const handleAddSubSubmit = (e) => {
    e.preventDefault();
    if (!newSubForm.razonSocial || !newSubForm.cif) {
      showNotification('Razón Social y CIF son obligatorios', 'error');
      return;
    }

    const today = new Date();
    const expiry = new Date(newSubForm.seguroRCFechaCaducidad);
    const isApto = expiry > today;

    addSubcontractor({
      razonSocial: newSubForm.razonSocial,
      nombreComercial: newSubForm.nombreComercial || newSubForm.razonSocial,
      cif: newSubForm.cif.toUpperCase(),
      gremio: newSubForm.gremio,
      personaContacto: newSubForm.personaContacto,
      telefono: newSubForm.telefono,
      telefonoUrgencias: newSubForm.telefonoUrgencias || newSubForm.telefono,
      email: newSubForm.email,
      direccion: newSubForm.direccion,
      prl: {
        seguroRCCompania: newSubForm.seguroRCCompania,
        seguroRCPoliza: newSubForm.seguroRCPoliza,
        seguroRCSuma: Number(newSubForm.seguroRCSuma) || 300000,
        seguroRCFechaCaducidad: newSubForm.seguroRCFechaCaducidad,
        certificadoAEAT: 'vigente',
        certificadoTGSS: 'vigente',
        aptoEntrarObra: isApto
      }
    });

    confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
    setShowAddSubModal(false);
    setNewSubForm({
      razonSocial: '',
      nombreComercial: '',
      cif: '',
      gremio: 'Electricidad y Climatización',
      personaContacto: '',
      telefono: '',
      telefonoUrgencias: '',
      email: '',
      direccion: '',
      seguroRCCompania: 'Mapfre Empresas',
      seguroRCPoliza: '',
      seguroRCSuma: 300000,
      seguroRCFechaCaducidad: '2027-12-31'
    });
  };

  // Add Budget Submit
  const handleAddBudgetSubmit = (e) => {
    e.preventDefault();
    if (!selectedSubcontractor) return;

    const targetObra = obras.find(o => o.id === budgetForm.obraId);

    addSubcontractorBudget(selectedSubcontractor.id, {
      obraId: budgetForm.obraId,
      obraTitulo: targetObra ? targetObra.titulo : 'Obra Reformas',
      importeSubcontrata: Number(budgetForm.importeSubcontrata) || 0,
      estado: budgetForm.estado,
      partidas: [
        { codigo: 'PART-01', concepto: budgetForm.concepto, importe: Number(budgetForm.importeSubcontrata) }
      ]
    });

    setShowAddBudgetModal(false);
    // Refresh modal
    const updated = subcontractors.find(s => s.id === selectedSubcontractor.id);
    if (updated) setSelectedSubcontractor(updated);
  };

  // Add Invoice Submit
  const handleAddInvoiceSubmit = (e) => {
    e.preventDefault();
    if (!selectedSubcontractor) return;

    const targetObra = obras.find(o => o.id === invoiceForm.obraId);

    addSubcontractorInvoice(selectedSubcontractor.id, {
      numero: invoiceForm.numero,
      obraId: invoiceForm.obraId,
      obraTitulo: targetObra ? targetObra.titulo : 'Obra Reformas',
      presupuestoVinculadoId: invoiceForm.presupuestoVinculadoId || null,
      baseImponible: Number(invoiceForm.baseImponible) || 0,
      ivaPct: Number(invoiceForm.ivaPct) || 21,
      estadoPago: invoiceForm.estadoPago
    });

    setShowAddInvoiceModal(false);
    const updated = subcontractors.find(s => s.id === selectedSubcontractor.id);
    if (updated) setSelectedSubcontractor(updated);
  };

  // Submit Note
  const handleAddNote = (e) => {
    e.preventDefault();
    if (!selectedSubcontractor || !newNoteText.trim()) return;

    addSubcontractorNote(selectedSubcontractor.id, newNoteText.trim());
    setNewNoteText('');
    const updated = subcontractors.find(s => s.id === selectedSubcontractor.id);
    if (updated) setSelectedSubcontractor(updated);
  };

  // Submit Review
  const handleAddReview = (e) => {
    e.preventDefault();
    if (!selectedSubcontractor) return;

    addSubcontractorReview(selectedSubcontractor.id, scoringForm);
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
    setScoringForm({
      puntualidad: 5,
      calidad: 5,
      limpieza: 5,
      trato: 5,
      comentario: '',
      obraTitulo: obras[0]?.titulo || 'General'
    });
    const updated = subcontractors.find(s => s.id === selectedSubcontractor.id);
    if (updated) setSelectedSubcontractor(updated);
  };

  // Quote Simulators
  const handleSimulateNewQuote = (quoteData) => {
    const newQuote = {
      ...quoteData,
      id: `subpres-${Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      estado: 'analizado'
    };
    setSubcontratasPresupuestos(prev => [newQuote, ...prev]);
    setSelectedSubPresId(newQuote.id);
    showNotification(`Presupuesto de "${newQuote.subcontrata}" recibido y analizado por IA.`);
  };

  const handleApplyToDatabase = (subPres) => {
    if (!subPres) return;
    const itemsToApply = (subPres.partidasDetectadas || []).map(p => {
      const margin = customMargins[p.codigo] !== undefined ? customMargins[p.codigo] : p.margenConfiguradoPct;
      return { ...p, margenConfiguradoPct: margin };
    });
    applySubcontrataPresupuesto(subPres.id, itemsToApply);
    confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
  };

  const handleAddMasterItem = (e) => {
    e.preventDefault();
    if (!newMasterItem.codigo || !newMasterItem.concepto) return;
    const coste = Number(newMasterItem.costeSubcontrata || 0);
    const margen = Number(newMasterItem.margenPct || 30);
    const pvp = Number((coste * (1 + margen / 100)).toFixed(2));

    const newItem = {
      id: `bp-master-${Date.now()}`,
      ...newMasterItem,
      costeSubcontrata: coste,
      margenPct: margen,
      precioVenta: pvp
    };

    setBasePrecios(prev => [newItem, ...prev]);
    setShowAddMasterModal(false);
    setNewMasterItem({
      codigo: '',
      capitulo: 'Albañilería',
      gremio: 'Albañilería',
      concepto: '',
      unidad: 'm²',
      costeSubcontrata: 15.00,
      margenPct: 30
    });
    showNotification('Nueva partida añadida a la Base de Precios Oficial de la Empresa');
  };

  const selectedSubPres = subcontratasPresupuestos.find(sp => sp.id === selectedSubPresId);

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Percent className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Subcontratas & Base de Precios</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Control Integral ERP
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Directorio y scoring de gremios, control PRL (Seguros RC Ley 32/2006), comparador de ofertas, facturas recibidas y tarifas unitarias
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAddSubModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-2 transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Alta Nueva Subcontrata</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-800 space-x-1 sm:space-x-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('directorio')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'directorio'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Directorio & Control PRL ({subcontractors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('presupuestos_comparador')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'presupuestos_comparador'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Presupuestos de Gremios & Comparador IA</span>
        </button>

        <button
          onClick={() => setActiveTab('facturas_desviaciones')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'facturas_desviaciones'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Facturas Recibidas & Desviaciones</span>
        </button>

        <button
          onClick={() => setActiveTab('base_precios')}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'base_precios'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Base de Precios Oficial ({basePrecios.length} partidas)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DIRECTORIO DE SUBCONTRATAS & CONTROL PRL (SEGUROS RC)              */}
      {/* ========================================================================= */}
      {activeTab === 'directorio' && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar subcontrata, CIF o contacto..."
                value={searchSubQuery}
                onChange={(e) => setSearchSubQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={filterGremioSub}
                onChange={(e) => setFilterGremioSub(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none"
              >
                <option value="todos">Todos los Gremios</option>
                <option value="Electricidad">Electricidad</option>
                <option value="Fontanería">Fontanería</option>
                <option value="Pintura">Pintura</option>
                <option value="Carpintería">Carpintería</option>
                <option value="Albañilería">Albañilería</option>
              </select>

              <select
                value={filterPRLStatus}
                onChange={(e) => setFilterPRLStatus(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none"
              >
                <option value="todos">Estado Seguro PRL</option>
                <option value="vigente">🟢 Vigente y Apto</option>
                <option value="proximo">🟡 Caduca &lt; 30 días</option>
                <option value="caducado">🔴 Bloqueado / Caducado</option>
              </select>
            </div>
          </div>

          {/* Subcontractor Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSubcontractors.map((sub) => {
              const prl = getPRLTrafficLight(sub);
              const activeBudgets = (sub.presupuestosVinculados || []).filter(b => b.estado === 'aprobado').length;

              return (
                <div
                  key={sub.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl shadow-sm transition space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-base">{sub.razonSocial}</h3>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                            {sub.cif}
                          </span>
                        </div>
                        <p className="text-xs text-indigo-400 font-semibold">{sub.gremio}</p>
                        <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Contacto: <strong>{sub.personaContacto}</strong> ({sub.telefono})</span>
                        </p>
                      </div>

                      {/* Scoring Rating Badge */}
                      <div className="text-right">
                        <div className="flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20 text-amber-400">
                          <Star className="w-4 h-4 fill-amber-400" />
                          <span className="font-black text-sm">{sub.scoring?.media?.toFixed(1) || '5.0'}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-1">
                          {sub.scoring?.totalResenas || 0} valoraciones
                        </span>
                      </div>
                    </div>

                    {/* PRL Traffic Light Box */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Seguro Resp. Civil (RC)</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${prl.color} animate-pulse shrink-0`}></span>
                          <span className="font-bold text-white">{sub.prl?.seguroRCCompania || 'Seguro'}</span>
                          <span className="text-slate-400">({sub.prl?.seguroRCSuma ? `${(sub.prl.seguroRCSuma / 1000)}k€` : '300k€'})</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Vencimiento: {sub.prl?.seguroRCFechaCaducidad}</span>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${prl.badgeClass}`}>
                        {prl.label}
                      </span>
                    </div>

                    {/* Emergency Phone & Notes preview */}
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1 text-rose-400 font-bold">
                        <Phone className="w-3.5 h-3.5" />
                        <span>Urgencias 24h: {sub.telefonoUrgencias || sub.telefono}</span>
                      </span>
                      <span className="text-slate-400">{activeBudgets} obras en curso</span>
                    </div>

                  </div>

                  {/* Bottom Action */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium truncate max-w-xs">
                      {sub.notasInternas && sub.notasInternas.length > 0 ? `"${sub.notasInternas[0].texto.slice(0, 45)}..."` : 'Sin incidencias'}
                    </span>

                    <button
                      onClick={() => {
                        setSelectedSubcontractor(sub);
                        setDetailTab('prl');
                      }}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 rounded-xl font-bold text-xs transition border border-slate-700 flex items-center gap-1.5"
                    >
                      <span>Ficha Completa & Control</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PRESUPUESTOS DE GREMIOS & COMPARADOR DE OFERTAS                     */}
      {/* ========================================================================= */}
      {activeTab === 'presupuestos_comparador' && (
        <div className="space-y-6">
          
          {/* Quick simulator banner */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <span>Presupuestos Recibidos de Subcontratas & Actualización de Precios</span>
              </h2>
              <p className="text-xs text-slate-400">
                La IA analiza presupuestos en PDF, detecta partidas y te permite actualizar el catálogo oficial con el margen que elijas
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSimulateNewQuote(SIMULATED_NEW_QUOTES[0])}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Simular PDF Carpintería</span>
              </button>
              <button
                onClick={() => handleSimulateNewQuote(SIMULATED_NEW_QUOTES[1])}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Simular PDF Fontanería</span>
              </button>
            </div>
          </div>

          {/* Comparator Matrix & Quotes Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left list (4 cols) */}
            <div className="lg:col-span-4 space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Presupuestos Recibidos ({subcontratasPresupuestos.length})
              </span>

              {subcontratasPresupuestos.map((subPres) => (
                <div
                  key={subPres.id}
                  onClick={() => setSelectedSubPresId(subPres.id)}
                  className={`p-4 rounded-2xl border transition cursor-pointer ${
                    selectedSubPresId === subPres.id
                      ? 'bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/20'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{subPres.gremio}</span>
                    <span className="text-[10px] text-slate-400">{subPres.fecha}</span>
                  </div>
                  <h4 className="font-bold text-white text-sm">{subPres.subcontrata}</h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{subPres.resumen}</p>
                </div>
              ))}
            </div>

            {/* Right quote detail (8 cols) */}
            <div className="lg:col-span-8">
              {selectedSubPres ? (
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-white text-lg">{selectedSubPres.subcontrata}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          selectedSubPres.estado === 'aplicado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {selectedSubPres.estado === 'aplicado' ? 'Aplicado a Base Precios' : 'Pendiente de Aplicar'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedSubPres.archivoNombre}</p>
                    </div>

                    <button
                      onClick={() => handleApplyToDatabase(selectedSubPres)}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 transition shadow-lg shadow-amber-500/20 shrink-0"
                    >
                      <Database className="w-4 h-4 stroke-[2.5]" />
                      <span>Aplicar a la Base de Precios</span>
                    </button>
                  </div>

                  {/* Partidas Table */}
                  <div className="overflow-x-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold text-[11px]">
                          <th className="py-2.5 px-3">Código</th>
                          <th className="py-2.5 px-3">Partida / Concepto</th>
                          <th className="py-2.5 px-3 text-right">Coste Subcontrata</th>
                          <th className="py-2.5 px-3 text-center">Margen (%)</th>
                          <th className="py-2.5 px-3 text-right">PVP Presupuestos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {(selectedSubPres.partidasDetectadas || []).map((partida) => {
                          const currentMargin = customMargins[partida.codigo] !== undefined ? customMargins[partida.codigo] : partida.margenConfiguradoPct;
                          const calculatedPvp = Number((partida.nuevoPrecioSubcontrata * (1 + currentMargin / 100)).toFixed(2));

                          return (
                            <tr key={partida.codigo} className="hover:bg-slate-800/30">
                              <td className="py-2.5 px-3 font-bold text-amber-400">{partida.codigo}</td>
                              <td className="py-2.5 px-3 font-sans font-medium text-white max-w-xs">{partida.concepto}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-white">{partida.nuevoPrecioSubcontrata.toFixed(2)} €</td>
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="number"
                                  min="5"
                                  max="80"
                                  value={currentMargin}
                                  onChange={(e) => setCustomMargins({ ...customMargins, [partida.codigo]: Number(e.target.value) })}
                                  className="w-14 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs text-amber-400 font-bold"
                                />
                                <span className="text-slate-400 ml-1">%</span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-amber-400">{calculatedPvp.toFixed(2)} €</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center text-slate-500">
                  Selecciona un presupuesto a la izquierda para inspeccionar sus partidas.
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: FACTURAS RECIBIDAS DE SUBCONTRATAS & CONTROL DE DESVIACIONES        */}
      {/* ========================================================================= */}
      {activeTab === 'facturas_desviaciones' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-400" />
                <span>Facturas Recibidas vs. Presupuestos Pactados</span>
              </h2>
              <p className="text-xs text-slate-400">
                Alerta de sobrecostes y desviaciones respecto al presupuesto aprobado antes de emitir los pagos
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold text-[11px]">
                    <th className="py-3 px-4">Subcontrata / Razón Social</th>
                    <th className="py-3 px-4">Nº Factura</th>
                    <th className="py-3 px-4">Obra Asignada</th>
                    <th className="py-3 px-4 text-right">Base Imponible</th>
                    <th className="py-3 px-4 text-right">Total (+IVA)</th>
                    <th className="py-3 px-4 text-center">Desviación Presupuesto</th>
                    <th className="py-3 px-4 text-center">Estado Pago</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {subcontractors.flatMap(sub => 
                    (sub.facturasRecibidas || []).map(fac => ({ ...fac, subId: sub.id, subNombre: sub.razonSocial }))
                  ).map((fac) => {
                    const hasOverrun = fac.desviacionSobrePresupuesto > 0;

                    return (
                      <tr key={fac.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-sans font-bold text-white">{fac.subNombre}</td>
                        <td className="py-3 px-4 text-slate-300 font-bold">{fac.numero}</td>
                        <td className="py-3 px-4 font-sans text-slate-300 text-[11px]">{fac.obraTitulo}</td>
                        <td className="py-3 px-4 text-right font-bold text-white">{fac.baseImponible.toFixed(2)} €</td>
                        <td className="py-3 px-4 text-right font-black text-amber-400">{fac.total.toFixed(2)} €</td>
                        <td className="py-3 px-4 text-center">
                          {hasOverrun ? (
                            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>+{fac.desviacionSobrePresupuesto.toFixed(2)} € (Sobrecoste)</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              0.00 € (Según Pacto)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => updateSubcontractorInvoiceStatus(fac.subId, fac.id, fac.estadoPago === 'pagado' ? 'pendiente' : 'pagado')}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition ${
                              fac.estadoPago === 'pagado'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {fac.estadoPago}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-[11px] text-slate-500">Vence: {fac.fechaVencimiento}</span>
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
      {/* TAB 4: BASE DE PRECIOS OFICIAL (CATÁLOGO COMPLETO)                        */}
      {/* ========================================================================= */}
      {activeTab === 'base_precios' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-400" />
                <span>Catálogo de Precios Unitarios de Obra</span>
              </h2>
              <p className="text-xs text-slate-400">
                Precios de coste de subcontrata/material, margen comercial aplicado y precio de venta al público en presupuestos
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar partida, código..."
                  value={searchPrecios}
                  onChange={(e) => setSearchPrecios(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white"
                />
              </div>

              <select
                value={filterGremio}
                onChange={(e) => setFilterGremio(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-semibold"
              >
                <option value="todos">Todos los Gremios</option>
                <option value="Albañilería">Albañilería</option>
                <option value="Fontanería">Fontanería</option>
                <option value="Electricidad">Electricidad</option>
                <option value="Pintura">Pintura</option>
                <option value="Carpintería">Carpintería</option>
              </select>

              <button
                onClick={() => setShowAddMasterModal(true)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Añadir Partida</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold text-[11px]">
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Capítulo / Gremio</th>
                  <th className="py-2.5 px-3">Descripción de Partida</th>
                  <th className="py-2.5 px-3 text-center">Unidad</th>
                  <th className="py-2.5 px-3 text-right">Coste Subcontrata</th>
                  <th className="py-2.5 px-3 text-center">Margen (%)</th>
                  <th className="py-2.5 px-3 text-right">PVP Cliente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredBasePrecios.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30">
                    <td className="py-2 px-3 font-bold text-amber-400">{item.codigo}</td>
                    <td className="py-2 px-3 font-sans text-slate-400 text-[11px]">{item.gremio || item.capitulo}</td>
                    <td className="py-2 px-3 font-sans font-medium text-white max-w-sm">{item.concepto}</td>
                    <td className="py-2 px-3 text-center text-slate-300">{item.unidad}</td>
                    <td className="py-2 px-3 text-right font-bold text-white">{Number(item.costeSubcontrata).toFixed(2)} €</td>
                    <td className="py-2 px-3 text-center font-bold text-amber-400">+{item.margenPct}%</td>
                    <td className="py-2 px-3 text-right font-black text-emerald-400">{Number(item.precioVenta).toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ALTA NUEVA SUBCONTRATA (CON DATOS PRL Y SEGURO RC)               */}
      {/* ========================================================================= */}
      {showAddSubModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <span>Alta de Empresa Subcontratista (PRL & Ficha Técnica)</span>
              </h3>
              <button onClick={() => setShowAddSubModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddSubSubmit} className="space-y-4 text-xs">
              <div>
                <span className="text-[11px] font-black uppercase text-indigo-400 block mb-2">1. Datos Fiscales y Contacto</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Razón Social *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: ElectroSur Instalaciones SL"
                      value={newSubForm.razonSocial}
                      onChange={(e) => setNewSubForm({ ...newSubForm, razonSocial: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">CIF / NIF *</label>
                    <input
                      type="text"
                      required
                      placeholder="B84561234"
                      value={newSubForm.cif}
                      onChange={(e) => setNewSubForm({ ...newSubForm, cif: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Gremio / Especialidad</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Electricidad y Climatización"
                      value={newSubForm.gremio}
                      onChange={(e) => setNewSubForm({ ...newSubForm, gremio: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Persona de Contacto</label>
                    <input
                      type="text"
                      placeholder="Ej: Sergio Navas (Jefe Técnico)"
                      value={newSubForm.personaContacto}
                      onChange={(e) => setNewSubForm({ ...newSubForm, personaContacto: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Teléfono Ordinario</label>
                    <input
                      type="text"
                      placeholder="+34 91 555 7788"
                      value={newSubForm.telefono}
                      onChange={(e) => setNewSubForm({ ...newSubForm, telefono: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Teléfono de Urgencias en Obra</label>
                    <input
                      type="text"
                      placeholder="+34 600 112 233"
                      value={newSubForm.telefonoUrgencias}
                      onChange={(e) => setNewSubForm({ ...newSubForm, telefonoUrgencias: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* PRL Seguros */}
              <div className="pt-2 border-t border-slate-800">
                <span className="text-[11px] font-black uppercase text-amber-400 block mb-2">2. Prevención de Riesgos Laborales (Seguro RC - Ley 32/2006)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Aseguradora</label>
                    <input
                      type="text"
                      value={newSubForm.seguroRCCompania}
                      onChange={(e) => setNewSubForm({ ...newSubForm, seguroRCCompania: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Nº Póliza Seguro RC</label>
                    <input
                      type="text"
                      placeholder="POL-RC-982134"
                      value={newSubForm.seguroRCPoliza}
                      onChange={(e) => setNewSubForm({ ...newSubForm, seguroRCPoliza: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Suma Asegurada (€)</label>
                    <input
                      type="number"
                      value={newSubForm.seguroRCSuma}
                      onChange={(e) => setNewSubForm({ ...newSubForm, seguroRCSuma: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Fecha de Caducidad de la Póliza</label>
                    <input
                      type="date"
                      required
                      value={newSubForm.seguroRCFechaCaducidad}
                      onChange={(e) => setNewSubForm({ ...newSubForm, seguroRCFechaCaducidad: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSubModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black transition shadow-lg shadow-indigo-600/30"
                >
                  Guardar Subcontrata
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FICHA COMPLETA DE SUBCONTRATA (PRL + PRESUPUESTOS + FACTURAS...) */}
      {/* ========================================================================= */}
      {selectedSubcontractor && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl p-6 shadow-2xl space-y-4 my-8">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-white">{selectedSubcontractor.razonSocial}</h3>
                  <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    CIF: {selectedSubcontractor.cif}
                  </span>
                </div>
                <p className="text-xs text-indigo-400 font-semibold">{selectedSubcontractor.gremio}</p>
              </div>

              <button onClick={() => setSelectedSubcontractor(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Sub-tabs */}
            <div className="flex border-b border-slate-800 space-x-3 text-xs font-bold">
              <button
                onClick={() => setDetailTab('prl')}
                className={`pb-2 border-b-2 transition ${
                  detailTab === 'prl' ? 'border-indigo-400 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                1. Control PRL & Documental
              </button>
              <button
                onClick={() => setDetailTab('presupuestos')}
                className={`pb-2 border-b-2 transition ${
                  detailTab === 'presupuestos' ? 'border-indigo-400 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                2. Presupuestos Obras ({(selectedSubcontractor.presupuestosVinculados || []).length})
              </button>
              <button
                onClick={() => setDetailTab('facturas')}
                className={`pb-2 border-b-2 transition ${
                  detailTab === 'facturas' ? 'border-indigo-400 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                3. Facturas & Desviaciones ({(selectedSubcontractor.facturasRecibidas || []).length})
              </button>
              <button
                onClick={() => setDetailTab('bitacora')}
                className={`pb-2 border-b-2 transition ${
                  detailTab === 'bitacora' ? 'border-indigo-400 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                4. Bitácora de Incidencias
              </button>
              <button
                onClick={() => setDetailTab('scoring')}
                className={`pb-2 border-b-2 transition ${
                  detailTab === 'scoring' ? 'border-indigo-400 text-indigo-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                5. Evaluación & Scoring
              </button>
            </div>

            {/* TAB 1: PRL */}
            {detailTab === 'prl' && (() => {
              const prl = getPRLTrafficLight(selectedSubcontractor);
              return (
                <div className="space-y-4 text-xs">
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${prl.badgeClass}`}>
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
                      <div>
                        <span className="text-[10px] uppercase font-bold block">Dictamen de Acceso a Obra</span>
                        <span className="text-base font-black">{prl.label}</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono">Póliza: {selectedSubcontractor.prl?.seguroRCPoliza || 'S/N'}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">Compañía Aseguradora</span>
                      <span className="font-bold text-white text-sm">{selectedSubcontractor.prl?.seguroRCCompania || 'Mapfre'}</span>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">Suma Asegurada</span>
                      <span className="font-bold text-amber-400 text-sm font-mono">{Number(selectedSubcontractor.prl?.seguroRCSuma || 300000).toLocaleString('es-ES')} €</span>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">Certificado AEAT (Hacienda)</span>
                      <span className="font-bold text-emerald-400 text-sm">Al Corriente</span>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">Certificado TGSS (Seguridad Social)</span>
                      <span className="font-bold text-emerald-400 text-sm">Al Corriente</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* TAB 2: PRESUPUESTOS */}
            {detailTab === 'presupuestos' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-300">Presupuestos Emitidos por la Subcontrata</span>
                  <button
                    onClick={() => setShowAddBudgetModal(true)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Vincular Presupuesto</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {(selectedSubcontractor.presupuestosVinculados || []).map((bud) => (
                    <div key={bud.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{bud.obraTitulo}</span>
                          <span className="text-slate-500 text-[10px]">({bud.fecha})</span>
                        </div>
                        <p className="text-slate-400 text-[11px] mt-0.5 font-mono">
                          Importe Pactado: <strong className="text-amber-400">{bud.importeSubcontrata.toFixed(2)} €</strong>
                        </p>
                      </div>

                      <select
                        value={bud.estado}
                        onChange={(e) => updateSubcontractorBudgetStatus(selectedSubcontractor.id, bud.id, e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-2 py-1"
                      >
                        <option value="recibido">Recibido</option>
                        <option value="en_negociacion">En Negociación</option>
                        <option value="aprobado">Aprobado</option>
                        <option value="rechazado">Rechazado</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: FACTURAS & DESVIACIONES */}
            {detailTab === 'facturas' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-300">Histórico de Facturas Emitidas</span>
                  <button
                    onClick={() => setShowAddInvoiceModal(true)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold transition flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Registrar Factura</span>
                  </button>
                </div>

                <div className="space-y-2 font-mono">
                  {(selectedSubcontractor.facturasRecibidas || []).map((fac) => (
                    <div key={fac.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white text-sm">{fac.numero}</span>
                        <span className="text-slate-400 text-[11px] block font-sans">{fac.obraTitulo}</span>
                        {fac.desviacionSobrePresupuesto > 0 && (
                          <span className="text-rose-400 font-bold text-[10px] block mt-0.5">
                            ⚠️ Desviación: +{fac.desviacionSobrePresupuesto.toFixed(2)} € sobre presupuesto
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-base font-bold text-amber-400 block">{fac.total.toFixed(2)} €</span>
                        <button
                          onClick={() => updateSubcontractorInvoiceStatus(selectedSubcontractor.id, fac.id, fac.estadoPago === 'pagado' ? 'pendiente' : 'pagado')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            fac.estadoPago === 'pagado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {fac.estadoPago}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: BITÁCORA */}
            {detailTab === 'bitacora' && (
              <div className="space-y-3 text-xs">
                <form onSubmit={handleAddNote} className="space-y-2">
                  <textarea
                    rows="2"
                    placeholder="Escribe una anotación confidencial sobre esta subcontrata..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  ></textarea>
                  <div className="flex justify-end">
                    <button type="submit" className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold">
                      Añadir a Bitácora
                    </button>
                  </div>
                </form>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  {(selectedSubcontractor.notasInternas || []).map((not) => (
                    <div key={not.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span className="font-bold text-amber-400">{not.autor}</span>
                        <span>{not.fecha}</span>
                      </div>
                      <p className="text-slate-300">{not.texto}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: SCORING */}
            {detailTab === 'scoring' && (
              <div className="space-y-4 text-xs">
                <form onSubmit={handleAddReview} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <span className="font-bold text-white block">Añadir Evaluación por Criterios</span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">Puntualidad en Plazos</span>
                        <span className="text-amber-400 font-bold">{scoringForm.puntualidad}/5</span>
                      </div>
                      <input
                        type="range" min="1" max="5" step="0.5"
                        value={scoringForm.puntualidad}
                        onChange={(e) => setScoringForm({ ...scoringForm, puntualidad: Number(e.target.value) })}
                        className="w-full accent-amber-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">Calidad Técnica</span>
                        <span className="text-amber-400 font-bold">{scoringForm.calidad}/5</span>
                      </div>
                      <input
                        type="range" min="1" max="5" step="0.5"
                        value={scoringForm.calidad}
                        onChange={(e) => setScoringForm({ ...scoringForm, calidad: Number(e.target.value) })}
                        className="w-full accent-amber-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">Limpieza y Orden</span>
                        <span className="text-amber-400 font-bold">{scoringForm.limpieza}/5</span>
                      </div>
                      <input
                        type="range" min="1" max="5" step="0.5"
                        value={scoringForm.limpieza}
                        onChange={(e) => setScoringForm({ ...scoringForm, limpieza: Number(e.target.value) })}
                        className="w-full accent-amber-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">Trato & Resolución</span>
                        <span className="text-amber-400 font-bold">{scoringForm.trato}/5</span>
                      </div>
                      <input
                        type="range" min="1" max="5" step="0.5"
                        value={scoringForm.trato}
                        onChange={(e) => setScoringForm({ ...scoringForm, trato: Number(e.target.value) })}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Comentario para la ficha</label>
                    <input
                      type="text"
                      placeholder="Buen trabajo en cuadro general..."
                      value={scoringForm.comentario}
                      onChange={(e) => setScoringForm({ ...scoringForm, comentario: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button type="submit" className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl">
                      Guardar Puntuación
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedSubcontractor(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VINCULAR PRESUPUESTO                                               */}
      {/* ========================================================================= */}
      {showAddBudgetModal && selectedSubcontractor && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Vincular Presupuesto a Obra</h3>
            <form onSubmit={handleAddBudgetSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Obra</label>
                <select
                  value={budgetForm.obraId}
                  onChange={(e) => setBudgetForm({ ...budgetForm, obraId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  {obras.map(o => (
                    <option key={o.id} value={o.id}>{o.titulo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Concepto / Partida Contratada</label>
                <input
                  type="text"
                  required
                  value={budgetForm.concepto}
                  onChange={(e) => setBudgetForm({ ...budgetForm, concepto: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Importe Subcontrata (€ sin IVA)</label>
                <input
                  type="number"
                  step="10"
                  required
                  value={budgetForm.importeSubcontrata}
                  onChange={(e) => setBudgetForm({ ...budgetForm, importeSubcontrata: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowAddBudgetModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR FACTURA                                                  */}
      {/* ========================================================================= */}
      {showAddInvoiceModal && selectedSubcontractor && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Registrar Factura de Subcontrata</h3>
            <form onSubmit={handleAddInvoiceSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Nº Factura</label>
                <input
                  type="text"
                  required
                  value={invoiceForm.numero}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, numero: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Obra</label>
                <select
                  value={invoiceForm.obraId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, obraId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  {obras.map(o => (
                    <option key={o.id} value={o.id}>{o.titulo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Presupuesto Vinculado (para control de sobrecostes)</label>
                <select
                  value={invoiceForm.presupuestoVinculadoId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, presupuestoVinculadoId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  <option value="">Sin presupuesto vinculado</option>
                  {(selectedSubcontractor.presupuestosVinculados || []).map(b => (
                    <option key={b.id} value={b.id}>{b.obraTitulo} ({b.importeSubcontrata}€)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Base Imponible (€)</label>
                <input
                  type="number"
                  step="10"
                  required
                  value={invoiceForm.baseImponible}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, baseImponible: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowAddInvoiceModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl">Registrar Factura</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AÑADIR PARTIDA A BASE DE PRECIOS                                   */}
      {/* ========================================================================= */}
      {showAddMasterModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Nueva Partida en Base de Precios Oficial</h3>
            <form onSubmit={handleAddMasterItem} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Código</label>
                  <input
                    type="text"
                    required
                    placeholder="ALB-05"
                    value={newMasterItem.codigo}
                    onChange={(e) => setNewMasterItem({ ...newMasterItem, codigo: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Unidad</label>
                  <input
                    type="text"
                    required
                    placeholder="m², ud, ml..."
                    value={newMasterItem.unidad}
                    onChange={(e) => setNewMasterItem({ ...newMasterItem, unidad: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Gremio</label>
                <select
                  value={newMasterItem.gremio}
                  onChange={(e) => setNewMasterItem({ ...newMasterItem, gremio: e.target.value, capitulo: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  <option value="Albañilería">Albañilería</option>
                  <option value="Fontanería">Fontanería</option>
                  <option value="Electricidad">Electricidad</option>
                  <option value="Pintura">Pintura</option>
                  <option value="Carpintería">Carpintería</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Descripción de la Partida</label>
                <textarea
                  rows="2"
                  required
                  placeholder="Descripción detallada de la ejecución..."
                  value={newMasterItem.concepto}
                  onChange={(e) => setNewMasterItem({ ...newMasterItem, concepto: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Coste Subcontrata (€)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newMasterItem.costeSubcontrata}
                    onChange={(e) => setNewMasterItem({ ...newMasterItem, costeSubcontrata: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Margen Comercial (%)</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={newMasterItem.margenPct}
                    onChange={(e) => setNewMasterItem({ ...newMasterItem, margenPct: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowAddMasterModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl">Añadir al Catálogo</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
