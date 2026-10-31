import React, { useState } from 'react';
import BarraProgreso from '../Common/BarraProgreso';
import { useApp } from '../../context/AppContext';
import EmptyState from '../Common/EmptyState';
import {
  Smartphone,
  HardHat,
  Clock,
  Camera,
  Mic,
  AlertTriangle,
  MapPin,
  Layers,
  Maximize2,
  Minimize2,
  LogOut,
  ChevronDown,
  Check,
  FileText,
  Bell,
  PackagePlus
} from 'lucide-react';
import confetti from 'canvas-confetti';
import PwaInstallPrompt from './PwaInstallPrompt';
import TaskProgressSelector from './TaskProgressSelector';
import AvisosTecnicosModal from './AvisosTecnicosModal';
import PedirMaterialModal from './PedirMaterialModal';
import MisTajos from './MisTajos';
import ModalOverlay from '../Common/ModalOverlay';
import { AnimatePresence } from 'motion/react';

// Foto del operario; si no hay o no carga (sin conexión), sus iniciales.
function FotoObrero({ obrero }) {
  const [fallo, setFallo] = useState(false);
  const iniciales = (obrero.nombre || '?').split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  if (!obrero.foto || fallo) {
    return (
      <div className="w-12 h-12 rounded-xl shrink-0 bg-amber-500/15 text-amber-400 border border-amber-500/40 flex items-center justify-center font-black text-base">
        {iniciales}
      </div>
    );
  }
  return (
    <img
      src={obrero.foto}
      alt=""
      onError={() => setFallo(true)}
      className="w-12 h-12 rounded-xl object-cover border border-amber-500/40 shrink-0"
    />
  );
}

export default function PortalObreroView() {
  const {
    obreros,
    obras,
    updateObra,
    addDiarioEntry,
    addMensajeInbox,
    showNotification,
    currentUser,
    logout,
    setActiveTab,
    broadcastWorkerProgress,
    broadcastWorkerEvidence,
    broadcastWorkerEstimate,
    isOnline,
    offlineQueueLength,
    avisosTecnicos,
    marcarAvisoLeido
  } = useApp();

  const isObreroLoggedIn = currentUser?.role === 'obrero';

  // Selected Worker (for Admin simulator)
  const [selectedObreroId, setSelectedObreroId] = useState(
    currentUser?.obreroId || obreros[0]?.id || 'obrero-1'
  );
  const [isPhoneFrame, setIsPhoneFrame] = useState(!isObreroLoggedIn);

  // Determine current obrero
  const currentObrero = isObreroLoggedIn
    ? (obreros.find(o => o.id === currentUser?.obreroId) ||
       obreros.find(o => o.nombre.toLowerCase().includes((currentUser?.fullName || '').split(' ')[0].toLowerCase())) || {
        id: currentUser?.id,
        nombre: currentUser?.fullName || 'Operario',
        puesto: currentUser?.trade || 'Oficial',
        telefono: currentUser?.phone || '',
        foto: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f8?auto=format&fit=crop&w=200&q=80'
      })
    : (obreros.find(o => o.id === selectedObreroId) || obreros[0]);

  // Con el módulo de avance activo, el obrero reporta en "Mis tajos" (avance reportado)
  // y la lista de fases solo muestra el avance certificado por la oficina.
  const [avanceDisponible, setAvanceDisponible] = useState(false);
  const lockLegacyProgress = avanceDisponible && isObreroLoggedIn;

  // Quick Action in Obra
  const [activeObraId, setActiveObraId] = useState(obras[0]?.id || '');
  const [fichadoEntrada, setFichadoEntrada] = useState(true);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showHorasModal, setShowHorasModal] = useState(false);
  const [showAvisosModal, setShowAvisosModal] = useState(false);
  const [showPedirModal, setShowPedirModal] = useState(false);

  // Unread technical notices calculation for this worker
  const obreroIdentifier = currentObrero?.username ||
    currentObrero?.id ||
    (currentObrero?.nombre ? currentObrero.nombre.toLowerCase().replace(/\s+/g, '.') : 'operario');

  const isAvisoLeido = (aviso) => {
    const list = Array.isArray(aviso.leidoPor) ? aviso.leidoPor : [];
    return list.some(id =>
      id === obreroIdentifier ||
      id === currentObrero?.id ||
      id === currentObrero?.nombre ||
      id === currentObrero?.username
    );
  };

  const unreadAvisos = (avisosTecnicos || []).filter(a => !isAvisoLeido(a));
  const unreadAvisosCount = unreadAvisos.length;
  const unreadAvisosObra = unreadAvisos.filter(a => a.obraId === activeObraId);
  const unreadAvisosObraCount = unreadAvisosObra.length;

  // Hours and Stock logging
  const [horasTrabajadas, setHorasTrabajadas] = useState(8);
  const [stockConsumido, setStockConsumido] = useState('');

  // Photo upload state
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState('https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80');
  const [photoNote, setPhotoNote] = useState('');

  // Voice note state
  const [voiceText, setVoiceText] = useState('');

  const currentObra = obras.find(o => o.id === activeObraId) || obras[0];

  // Estado para desplegar fases y ver sus partidas presupuestadas
  const [expandedFases, setExpandedFases] = useState({});

  const toggleFaseExpand = (faseId) => {
    setExpandedFases(prev => ({
      ...prev,
      [faseId]: !prev[faseId]
    }));
  };

  // Assigned works to this worker
  const assignedObras = obras.filter(o =>
    (o.operariosIds || []).includes(currentObrero?.id) ||
    (currentObrero?.nombre && (o.fases || []).some(f => f.responsable?.toLowerCase().includes(currentObrero.nombre.split(' ')[0].toLowerCase()))) ||
    o.estado === 'en_curso'
  );

  // Días que el operario calcula que faltan por etapa (borrador antes de enviar).
  const [estimateDrafts, setEstimateDrafts] = useState({});

  // Vista previa sin operarios dados de alta: aviso en lugar de una pantalla en blanco.
  if (!currentObrero) {
    return (
      <EmptyState icon={HardHat} title="Aún no hay operarios para previsualizar">
        Da de alta un empleado en RRHH &amp; Nóminas para ver aquí su portal móvil.
      </EmptyState>
    );
  }

  const handleSendEstimate = (obraId, fase) => {
    const raw = estimateDrafts[fase.id];
    if (raw === undefined || raw === '' || Number(raw) < 0) return;
    broadcastWorkerEstimate(obraId, fase.id, Number(raw), '', currentObrero.nombre);
    setEstimateDrafts(prev => ({ ...prev, [fase.id]: undefined }));
    showNotification(`Plazo enviado: ${Math.round(Number(raw))} días para "${fase.nombre}". La oficina recalcula el fin de obra.`);
  };

  const handleUpdateFaseProgress = (obraId, faseId, newProgress) => {
    const progNum = Math.min(100, Math.max(0, newProgress));
    const isCompleted = progNum === 100;

    // Use bidirectional realtime broadcast!
    broadcastWorkerProgress(obraId, faseId, progNum, currentObrero.nombre);

    if (isCompleted) {
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.7 }
      });
      showNotification(`¡Fase completada al 100%! Notificada en tiempo real a la oficina.`);
    } else {
      showNotification(`Avance de fase actualizado al ${progNum}%.`);
    }
  };

  const handleUpdateTaskProgress = (obraId, faseId, taskId, newProgress) => {
    const progNum = Math.min(100, Math.max(0, newProgress));
    const isCompleted = progNum === 100;

    // Sincronización en tiempo real a nivel de tarea de partida con recálculo ponderado
    broadcastWorkerProgress(obraId, faseId, progNum, currentObrero.nombre, taskId);

    if (isCompleted) {
      showNotification(`¡Partida completada al 100%! Sincronizada con la central.`);
    } else {
      showNotification(`Partida actualizada al ${progNum}%.`);
    }
  };

  const handleSendPhotoProgress = (e) => {
    e.preventDefault();
    if (!activeObraId) return;

    const entry = {
      autor: `${currentObrero.nombre} (${currentObrero.puesto})`,
      clima: 'En obra',
      obrerosPresentes: [currentObrero.nombre],
      resumen: photoNote || 'Avance fotográfico de tareas completadas hoy en la obra.',
      incidencias: '',
      fotos: [uploadedPhotoUrl]
    };

    // Use bidirectional realtime broadcast!
    broadcastWorkerEvidence(activeObraId, entry);

    setShowPhotoModal(false);
    setPhotoNote('');
    confetti({ particleCount: 30, spread: 40 });
    showNotification('Foto y parte diario enviados a la oficina en tiempo real.');
  };

  const handleSendHorasYStock = (e) => {
    e.preventDefault();
    if (!activeObraId) return;

    const entry = {
      autor: `${currentObrero.nombre} (${currentObrero.puesto})`,
      clima: 'Turno en obra',
      obrerosPresentes: [currentObrero.nombre],
      resumen: `Parte de jornada: Imputadas ${horasTrabajadas}h de trabajo.${stockConsumido ? ` Material consumido: ${stockConsumido}` : ''}`,
      incidencias: '',
      fotos: []
    };

    broadcastWorkerEvidence(activeObraId, entry);
    setShowHorasModal(false);
    setStockConsumido('');
    showNotification(`Horas (${horasTrabajadas}h) y consumos registrados y notificados a oficina.`);
  };

  const handleSendVoiceNote = (e) => {
    e.preventDefault();
    if (!voiceText) return;

    addMensajeInbox({
      tipo: 'audio',
      origen: 'WhatsApp Audio Obrero (Móvil en Obra)',
      remitente: `${currentObrero.nombre} (${currentObrero.puesto})`,
      telefono: currentObrero.telefono,
      obraId: currentObra.id,
      obraTitulo: currentObra.titulo,
      audioDuracion: '0:22',
      audioTranscripcion: voiceText,
      analisisIA: {
        remitenteDetectado: `Obrero (${currentObrero.nombre})`,
        obraDetectada: currentObra.titulo,
        urgencia: 'Normal',
        necesidadesCalculadas: [
          { concepto: 'Revisión y material reportado por el obrero', cantidad: 1, unidad: 'parte', costeAprox: 45, pvpCliente: 65 }
        ],
        impactoPresupuesto: 65.00,
        accionSugerida: 'Verificar avance en diario de obra y confirmar pedido de suministros.'
      }
    });

    setShowVoiceModal(false);
    setVoiceText('');
    showNotification('Nota de voz enviada al constructor y analizada por IA.');
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      
      {/* PWA Install Banner */}
      <PwaInstallPrompt />

      {/* Top Header */}
      {isObreroLoggedIn ? (
        <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-4 rounded-2xl flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-400 text-slate-950 flex items-center justify-center shadow font-black">
              <HardHat className="w-5 h-5 stroke-[2.3]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-white text-sm">ObraMaster Móvil</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 rounded font-bold">
                  Operario
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-tight">
                {currentObrero.nombre} · {currentObrero.puesto.split('/')[0]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAvisosModal(true)}
              className="relative p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
              title="Avisos e Instrucciones Técnicas"
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Avisos</span>
              {unreadAvisosCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-rose-500 text-white rounded-full text-xs font-black flex items-center justify-center animate-pulse">
                  {unreadAvisosCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                if (window.confirm('¿Deseas cerrar tu sesión?')) {
                  logout();
                }
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
              <Smartphone className="w-4 h-4" />
              <span>Simulador / Vista Previa del Portal Móvil</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">App Móvil del Obrero</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Así es como cada operario ve y gestiona sus tareas desde su teléfono en <code className="text-amber-400 font-mono">/#empleados</code>.
            </p>
          </div>

          {/* Worker Switcher & Phone Frame Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
              <span className="text-slate-400 pl-2">Ver como:</span>
              <select
                value={selectedObreroId}
                onChange={(e) => setSelectedObreroId(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-amber-400"
              >
                {obreros.map(o => (
                  <option key={o.id} value={o.id}>{o.nombre} ({o.puesto.split('/')[0]})</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowAvisosModal(true)}
              className="relative px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
              title="Ver avisos técnicos recibidos"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Avisos</span>
              {unreadAvisosCount > 0 && (
                <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center font-black">
                  {unreadAvisosCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsPhoneFrame(!isPhoneFrame)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
              title="Alternar entre modo smartphone y pantalla completa"
            >
              {isPhoneFrame ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              <span>{isPhoneFrame ? 'Pantalla Completa' : 'Marco Móvil'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Container (Simulated Smartphone Frame or Full Responsive) */}
      <div className={`mx-auto transition-all duration-300 ${isPhoneFrame ? 'max-w-sm' : 'max-w-2xl w-full'}`}>
        
        {/* Smartphone Shell */}
        <div className={isPhoneFrame ? 'bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden p-3 ring-8 ring-slate-900 rounded-[2.5rem]' : ''}>
          
          {/* Phone Top Notch & Status Bar (if phone frame) */}
          {isPhoneFrame && (
            <div className="flex items-center justify-between px-6 pt-2 pb-3 text-xs font-mono text-slate-400">
              <span>08:42</span>
              <div className="w-20 h-4 bg-slate-900 rounded-full mx-auto"></div>
              <div className="flex items-center gap-1">
                <span>5G</span>
                <span>100%</span>
              </div>
            </div>
          )}

          {/* Phone Screen Canvas */}
          <div className={isPhoneFrame ? 'bg-slate-900 rounded-[2rem] p-4 border border-slate-800/80 space-y-4' : 'space-y-4'}>
            
            {/* Worker Top Profile Card */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950/30 p-3.5 rounded-2xl border border-slate-700/80 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <FotoObrero obrero={currentObrero} />
                <div className="min-w-0">
                  <h3 className="font-extrabold text-white text-base leading-tight break-words">{currentObrero.nombre}</h3>
                  <p className="text-xs text-amber-400 font-medium break-words">{currentObrero.puesto}</p>
                  <span className={`text-xs flex items-center gap-1.5 mt-0.5 ${fichadoEntrada ? 'text-emerald-400' : 'text-slate-400'}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${fichadoEntrada ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></span>
                    {fichadoEntrada ? 'Turno activo' : 'Fuera de turno'}
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                <button
                  onClick={() => {
                    setFichadoEntrada(!fichadoEntrada);
                    showNotification(fichadoEntrada ? 'Jornada finalizada y fichaje registrado.' : 'Jornada iniciada. ¡Buen día de trabajo!');
                  }}
                  className={`px-3.5 py-2.5 rounded-xl text-sm font-bold transition shadow ${
                    fichadoEntrada ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                  }`}
                >
                  {fichadoEntrada ? 'Fin Turno' : 'Fichar'}
                </button>
              </div>
            </div>

            {/* Realtime Connectivity Status Banner */}
            <div className="flex items-center justify-between px-1 text-xs">
              {isOnline ? (
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Sincronizado en Tiempo Real
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  Modo Offline ({offlineQueueLength} pendientes)
                </span>
              )}
              <span className="hidden sm:inline text-xs text-slate-500">Central conectada</span>
            </div>

            {/* Quick Actions in Jobsite */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setShowPedirModal(true)}
                className="col-span-2 p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/30 rounded-xl text-left transition space-y-1.5 group min-h-[5.5rem]"
              >
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center group-hover:scale-110 transition">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <span className="font-bold text-white text-sm block leading-tight">Pedir Material</span>
                <span className="text-xs text-slate-400 block leading-tight">Falta algo / avería</span>
              </button>

              <button
                onClick={() => setShowPhotoModal(true)}
                className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/30 rounded-xl text-left transition space-y-1.5 group min-h-[5.5rem]"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="font-bold text-white text-sm block leading-tight">Foto Avance</span>
                <span className="text-xs text-slate-400 block leading-tight">Evidencia</span>
              </button>

              <button
                onClick={() => setShowVoiceModal(true)}
                className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/30 rounded-xl text-left transition space-y-1.5 group min-h-[5.5rem]"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition">
                  <Mic className="w-5 h-5" />
                </div>
                <span className="font-bold text-white text-sm block leading-tight">Nota de Voz</span>
                <span className="text-xs text-slate-400 block leading-tight">Audio IA</span>
              </button>

              <button
                onClick={() => setShowHorasModal(true)}
                className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/30 rounded-xl text-left transition space-y-1.5 group min-h-[5.5rem]"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition">
                  <Clock className="w-5 h-5" />
                </div>
                <span className="font-bold text-white text-sm block leading-tight">Horas & Stock</span>
                <span className="text-xs text-slate-400 block leading-tight">Imputar turno</span>
              </button>

              <button
                onClick={() => setShowAvisosModal(true)}
                className={`p-3 bg-slate-950 hover:bg-slate-800 border rounded-xl text-left transition space-y-1.5 group min-h-[5.5rem] relative ${
                  unreadAvisosCount > 0 ? 'border-amber-500/50 bg-amber-500/5 shadow-md' : 'border-slate-800'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center group-hover:scale-110 transition relative">
                  <Bell className="w-5 h-5" />
                  {unreadAvisosCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm block leading-tight">Avisos</span>
                  {unreadAvisosCount > 0 && (
                    <span className="text-xs font-black bg-rose-500 text-white px-1.5 rounded-full">
                      {unreadAvisosCount}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400 block leading-tight">Técnicos & PRL</span>
              </button>
            </div>

            {/* Unread Notice Banner for this Obra */}
            {unreadAvisosObraCount > 0 && (
              <div
                onClick={() => setShowAvisosModal(true)}
                className="bg-gradient-to-r from-amber-500/20 via-rose-500/15 to-amber-500/20 border border-amber-500/60 p-3 rounded-2xl cursor-pointer hover:border-amber-400 transition flex items-center justify-between gap-2.5 shadow-lg shadow-amber-500/10 animate-in fade-in"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center font-black shrink-0 animate-pulse">
                    <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-amber-300">
                        {unreadAvisosObraCount} {unreadAvisosObraCount === 1 ? 'Aviso Técnico' : 'Avisos'} en esta obra
                      </span>
                      <span className="text-xs bg-rose-500 text-white font-bold px-1.5 py-0.2 rounded-full">
                        Atención
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 truncate">
                      {unreadAvisosObra[0]?.titulo}
                    </p>
                  </div>
                </div>
                <button className="text-xs font-bold text-amber-300 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-amber-500/40 shrink-0">
                  Ver
                </button>
              </div>
            )}

            {/* Work Selector */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Obra en la que estás hoy:
              </span>
              <select
                value={activeObraId}
                onChange={(e) => setActiveObraId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-amber-400"
              >
                {obras.map(o => (
                  <option key={o.id} value={o.id}>{o.titulo} ({o.codigo})</option>
                ))}
              </select>
            </div>

            {/* Active Obra Card in Phone */}
            {currentObra && (
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded">
                      {currentObra.codigo}
                    </span>
                    <h4 className="font-bold text-white text-sm mt-1">{currentObra.titulo}</h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span className="truncate">{currentObra.direccion}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-amber-400">{currentObra.progreso}%</span>
                    <span className="text-xs text-slate-500 block">avance obra</span>
                  </div>
                </div>

                {/* Progress bar */}
                <BarraProgreso valor={currentObra.progreso} alto="h-4" />
              </div>
            )}

            {/* Mis tajos: partidas asignadas a este obrero en la obra activa */}
            <MisTajos
              obraId={currentObra?.id}
              obreroId={currentObrero?.id}
              isAdmin={!isObreroLoggedIn}
              onAvailable={setAvanceDisponible}
            />

            {/* Phases / Tasks List for this Worker */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Fases del Presupuesto Firmado</span>
                </span>
                <span className="text-xs text-slate-400">{lockLegacyProgress ? 'Avance certificado' : 'Pulsa para avanzar'}</span>
              </div>

              <div className="space-y-3">
                {(currentObra?.fases || []).map((fase, idx) => {
                  const isCompleted = fase.progreso === 100;
                  const isResponsible = fase.responsable?.toLowerCase().includes(currentObrero.nombre.split(' ')[0].toLowerCase());
                  const hasTasks = Array.isArray(fase.tareas) && fase.tareas.length > 0;
                  const isExpanded = expandedFases[fase.id] ?? (!isCompleted || isResponsible);

                  return (
                    <div
                      key={fase.id}
                      className={`rounded-2xl border transition overflow-hidden ${
                        isCompleted
                          ? 'bg-slate-950/80 border-emerald-500/30'
                          : isResponsible
                          ? 'bg-slate-950 border-amber-500/60 ring-1 ring-amber-500/20 shadow-md'
                          : 'bg-slate-950/90 border-slate-800'
                      }`}
                    >
                      {/* Phase Header */}
                      <div className="p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition ${
                              isCompleted
                                ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}>
                              {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                            </div>
                            <div className="min-w-0">
                              <h5 className={`text-sm font-bold leading-snug break-words ${isCompleted ? 'text-emerald-400 line-through' : 'text-white'}`}>
                                {fase.nombre}
                              </h5>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-400">
                                <span>
                                  Asignado: <strong className={isResponsible ? 'text-amber-400' : 'text-slate-300'}>{fase.responsable}</strong>
                                </span>
                                {fase.weight_percentage && (
                                  <span className="text-amber-400/80 font-mono font-semibold">
                                    · {fase.weight_percentage}% de obra
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-mono font-black ${isCompleted ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {fase.progreso}%
                            </span>
                            {hasTasks && (
                              <button
                                type="button"
                                onClick={() => toggleFaseExpand(fase.id)}
                                className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
                              >
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Phase Progress Bar */}
                        <BarraProgreso
                          valor={fase.progreso}
                          alto="h-3"
                          fondo="bg-slate-900"
                          color={isCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-yellow-400'}
                        />

                        {/* Indicación de plazo del operario: alimenta el fin de obra previsto */}
                        {!isCompleted && (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="shrink-0">Me faltan</span>
                            <input
                              type="number"
                              min="0"
                              inputMode="numeric"
                              value={estimateDrafts[fase.id] ?? ''}
                              placeholder={fase.estimacionObrero ? String(fase.estimacionObrero.diasRestantes) : '?'}
                              onChange={(e) => setEstimateDrafts(prev => ({ ...prev, [fase.id]: e.target.value }))}
                              className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                            />
                            <span className="shrink-0">días</span>
                            <button
                              type="button"
                              onClick={() => handleSendEstimate(currentObra.id, fase)}
                              disabled={estimateDrafts[fase.id] === undefined || estimateDrafts[fase.id] === ''}
                              className="px-2 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold disabled:opacity-40"
                            >
                              Enviar
                            </button>
                            {fase.estimacionObrero && (
                              <span className="truncate text-slate-500">
                                Último: {fase.estimacionObrero.diasRestantes}d ({fase.estimacionObrero.fecha})
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Tasks List (Partidas del Presupuesto Firmado) */}
                      {hasTasks && isExpanded && (
                        <div className="bg-slate-900/50 border-t border-slate-800/80 p-3 space-y-3">
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-400 px-1">
                            <span className="font-semibold uppercase tracking-wider flex items-center gap-1">
                              <FileText className="w-3 h-3 text-amber-400" />
                              <span>Partidas del Presupuesto ({fase.tareas.length})</span>
                            </span>
                            <span className="hidden sm:inline">Pulsa un % para avanzar</span>
                          </div>

                          <div className="space-y-2.5">
                            {fase.tareas.map((tarea) => {
                              const isTaskDone = tarea.progreso === 100;
                              return (
                                <div
                                  key={tarea.id}
                                  className={`p-2.5 rounded-xl border space-y-2 transition ${
                                    isTaskDone
                                      ? 'bg-slate-950/60 border-emerald-500/20'
                                      : 'bg-slate-950 border-slate-800'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded">
                                          {tarea.codigo}
                                        </span>
                                        {tarea.unidad && (
                                          <span className="text-xs text-slate-400 font-mono">
                                            {tarea.cantidad} {tarea.unidad}
                                          </span>
                                        )}
                                      </div>
                                      <h6 className={`text-xs font-semibold mt-1 leading-snug ${isTaskDone ? 'text-slate-300 line-through' : 'text-white'}`}>
                                        {tarea.titulo}
                                      </h6>
                                    </div>
                                    <span className="text-xs font-mono font-bold text-slate-400 shrink-0">
                                      {tarea.importeTotal ? `${tarea.importeTotal.toLocaleString('es-ES')} €` : ''}
                                    </span>
                                  </div>

                                  {/* Tactile Progress Selector */}
                                  <TaskProgressSelector
                                    disabled={lockLegacyProgress}
                                    currentProgress={tarea.progreso}
                                    onProgressChange={(pct) => handleUpdateTaskProgress(currentObra.id, fase.id, tarea.id, pct)}
                                    onRequestEvidencePhoto={() => setShowPhotoModal(true)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* If phase has no subtasks, show tactile selector directly on phase */}
                      {!hasTasks && (
                        <div className="bg-slate-900/50 border-t border-slate-800/80 p-3">
                          <TaskProgressSelector
                            disabled={lockLegacyProgress}
                            currentProgress={fase.progreso}
                            onProgressChange={(pct) => handleUpdateFaseProgress(currentObra.id, fase.id, pct)}
                            onRequestEvidencePhoto={() => setShowPhotoModal(true)}
                          />
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Modal Subir Foto del Avance */}
      <AnimatePresence>
      {showPhotoModal && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-400" />
              <span>Subir Foto de Avance a la Obra</span>
            </h3>

            <div className="rounded-xl overflow-hidden border border-slate-700 h-44 bg-slate-950">
              <img src={uploadedPhotoUrl} alt="Foto de obra" className="w-full h-full object-cover" />
            </div>

            <form onSubmit={handleSendPhotoProgress} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Muestra de foto realizada:</label>
                <select
                  value={uploadedPhotoUrl}
                  onChange={(e) => setUploadedPhotoUrl(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value="https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80">Alicatado de Baño con Porcelánico</option>
                  <option value="https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80">Falso Techo de Pladur Instalado</option>
                  <option value="https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80">Suelo de Cocina Nivelado</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Nota o Comentario del Obrero:</label>
                <textarea
                  rows="2"
                  value={photoNote}
                  onChange={(e) => setPhotoNote(e.target.value)}
                  placeholder="Ej: Alicatado del baño terminado y listo para lechada..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow"
                >
                  Enviar al Diario
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
      </AnimatePresence>

      {/* Modal Nota de Voz desde el Móvil */}
      <AnimatePresence>
      {showVoiceModal && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Mic className="w-4 h-4 text-amber-400" />
              <span>Nota de Voz de WhatsApp al Encargado</span>
            </h3>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-400">
              Dicta los materiales que faltan o el estado de la obra para que la IA los procese automáticamente en el despacho.
            </div>

            <form onSubmit={handleSendVoiceNote} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Mensaje de audio transcrito:</label>
                <textarea
                  rows="3"
                  required
                  value={voiceText}
                  onChange={(e) => setVoiceText(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-400"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowVoiceModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow"
                >
                  Enviar Audio
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
      </AnimatePresence>

      {/* Modal Imputar Horas & Consumo de Stock */}
      <AnimatePresence>
      {showHorasModal && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Imputar Horas y Consumo de Stock</span>
            </h3>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-400">
              Registra la jornada de hoy y los materiales consumidos del stock de la obra para sincronizar con oficina al instante.
            </div>

            <form onSubmit={handleSendHorasYStock} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Horas dedicadas hoy:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="14"
                    step="0.5"
                    value={horasTrabajadas}
                    onChange={(e) => setHorasTrabajadas(Number(e.target.value))}
                    className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono font-bold text-center"
                  />
                  <span className="text-slate-400 font-semibold">horas ordinarias</span>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Material o stock consumido:</label>
                <textarea
                  rows="2"
                  value={stockConsumido}
                  onChange={(e) => setStockConsumido(e.target.value)}
                  placeholder="Ej: 5 sacos mortero gris, 1 rollo cinta pintor, 2 codos multicapa..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-400"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowHorasModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg shadow"
                >
                  Guardar y Sincronizar
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
      </AnimatePresence>

      {/* Pedir material o avisar de una incidencia a la oficina */}
      <PedirMaterialModal
        isOpen={showPedirModal}
        onClose={() => setShowPedirModal(false)}
        obra={currentObra}
        onSent={() => showNotification('Aviso enviado a la oficina.')}
      />

      {/* Modal Avisos Técnicos e Instrucciones de Dirección de Obra */}
      <AvisosTecnicosModal
        isOpen={showAvisosModal}
        onClose={() => setShowAvisosModal(false)}
        currentObrero={currentObrero}
        currentObraId={activeObraId}
      />

    </div>
  );
}
