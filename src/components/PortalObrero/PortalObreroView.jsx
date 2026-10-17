import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Smartphone,
  HardHat,
  CheckCircle2,
  Clock,
  Camera,
  Mic,
  Send,
  AlertTriangle,
  Sparkles,
  User,
  MapPin,
  Calendar,
  Layers,
  ChevronRight,
  Maximize2,
  Minimize2,
  ThumbsUp,
  Image as ImageIcon,
  LogOut,
  ArrowLeft,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import PwaInstallPrompt from './PwaInstallPrompt';

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
    setActiveTab
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

  // Quick Action in Obra
  const [activeObraId, setActiveObraId] = useState(obras[0]?.id || '');
  const [fichadoEntrada, setFichadoEntrada] = useState(true);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  // Photo upload state
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState('https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80');
  const [photoNote, setPhotoNote] = useState('');

  // Voice note state
  const [voiceText, setVoiceText] = useState('Manuel, ya hemos colocado el suelo porcelánico del pasillo y mañana empezamos con el baño suite.');

  const currentObra = obras.find(o => o.id === activeObraId) || obras[0];

  // Assigned works to this worker
  const assignedObras = obras.filter(o =>
    (o.operariosIds || []).includes(currentObrero.id) ||
    (o.fases || []).some(f => f.responsable?.toLowerCase().includes(currentObrero.nombre.split(' ')[0].toLowerCase())) ||
    o.estado === 'en_curso'
  );

  const handleUpdateFaseProgress = (obraId, faseId, newProgress) => {
    const targetObra = obras.find(o => o.id === obraId);
    if (!targetObra) return;

    const progNum = Math.min(100, Math.max(0, newProgress));
    const isCompleted = progNum === 100;

    const updatedFases = (targetObra.fases || []).map(f => {
      if (f.id === faseId) {
        return {
          ...f,
          progreso: progNum,
          estado: isCompleted ? 'completada' : progNum > 0 ? 'en_curso' : 'pendiente'
        };
      }
      return f;
    });

    const totalProg = updatedFases.reduce((s, f) => s + f.progreso, 0);
    const newGlobalProg = Math.round(totalProg / updatedFases.length);

    updateObra(obraId, {
      fases: updatedFases,
      progreso: newGlobalProg
    });

    if (isCompleted) {
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.7 }
      });
      showNotification(`¡Fase completada al 100%! El avance global de la obra sube a ${newGlobalProg}%.`);
    } else {
      showNotification(`Avance de fase actualizado al ${progNum}%.`);
    }
  };

  const handleSendPhotoProgress = (e) => {
    e.preventDefault();
    if (!activeObraId) return;

    addDiarioEntry(activeObraId, {
      autor: `${currentObrero.nombre} (${currentObrero.puesto})`,
      clima: 'En obra',
      obrerosPresentes: [currentObrero.nombre],
      resumen: photoNote || 'Avance fotográfico de tareas completadas hoy en la obra.',
      incidencias: '',
      fotos: [uploadedPhotoUrl]
    });

    setShowPhotoModal(false);
    setPhotoNote('');
    confetti({ particleCount: 30, spread: 40 });
    showNotification('Foto y parte diario enviados al constructor.');
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
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 rounded font-bold">
                  Operario
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                {currentObrero.nombre} · {currentObrero.puesto.split('/')[0]}
              </p>
            </div>
          </div>

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
        <div className={`bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden ${
          isPhoneFrame ? 'p-3 ring-8 ring-slate-900 rounded-[2.5rem]' : 'p-3 sm:p-5 rounded-2xl'
        }`}>
          
          {/* Phone Top Notch & Status Bar (if phone frame) */}
          {isPhoneFrame && (
            <div className="flex items-center justify-between px-6 pt-2 pb-3 text-[11px] font-mono text-slate-400">
              <span>08:42</span>
              <div className="w-20 h-4 bg-slate-900 rounded-full mx-auto"></div>
              <div className="flex items-center gap-1">
                <span>5G</span>
                <span>100%</span>
              </div>
            </div>
          )}

          {/* Phone Screen Canvas */}
          <div className="bg-slate-900 rounded-[2rem] p-4 sm:p-5 border border-slate-800/80 space-y-4">
            
            {/* Worker Top Profile Card */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950/30 p-3.5 rounded-2xl border border-slate-700/80 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <img
                  src={currentObrero.foto}
                  alt={currentObrero.nombre}
                  className="w-12 h-12 rounded-xl object-cover border border-amber-500/40"
                />
                <div>
                  <h3 className="font-extrabold text-white text-sm leading-tight">{currentObrero.nombre}</h3>
                  <p className="text-[11px] text-amber-400 font-medium">{currentObrero.puesto}</p>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Jornada en Curso · Turno Activo
                  </span>
                </div>
              </div>

              {/* Fichar Button */}
              <button
                onClick={() => {
                  setFichadoEntrada(!fichadoEntrada);
                  showNotification(fichadoEntrada ? 'Jornada finalizada y fichaje registrado.' : 'Jornada iniciada. ¡Buen día de trabajo!');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow ${
                  fichadoEntrada ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                }`}
              >
                {fichadoEntrada ? 'Fin Jornada' : 'Fichar Entrada'}
              </button>
            </div>

            {/* Quick Actions in Jobsite */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowPhotoModal(true)}
                className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition space-y-1 group"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition">
                  <Camera className="w-4 h-4" />
                </div>
                <span className="font-bold text-white text-xs block">Subir Foto Avance</span>
                <span className="text-[10px] text-slate-400 block">Fotografía del trabajo hecho</span>
              </button>

              <button
                onClick={() => setShowVoiceModal(true)}
                className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition space-y-1 group"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition">
                  <Mic className="w-4 h-4" />
                </div>
                <span className="font-bold text-white text-xs block">Nota de Voz / Falta Material</span>
                <span className="text-[10px] text-slate-400 block">Aviso urgente al encargado</span>
              </button>
            </div>

            {/* Work Selector */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
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
                    <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded">
                      {currentObra.codigo}
                    </span>
                    <h4 className="font-bold text-white text-sm mt-1">{currentObra.titulo}</h4>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span className="truncate">{currentObra.direccion}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-amber-400">{currentObra.progreso}%</span>
                    <span className="text-[9px] text-slate-500 block">avance obra</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${currentObra.progreso}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Phases / Tasks List for this Worker */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Fases del Presupuesto Firmado</span>
                </span>
                <span className="text-[10px] text-slate-400">Pulsa para avanzar</span>
              </div>

              <div className="space-y-2">
                {(currentObra?.fases || []).map((fase, idx) => {
                  const isCompleted = fase.progreso === 100;
                  const isResponsible = fase.responsable?.toLowerCase().includes(currentObrero.nombre.split(' ')[0].toLowerCase());

                  return (
                    <div
                      key={fase.id}
                      className={`p-3.5 rounded-xl border transition space-y-2.5 ${
                        isCompleted
                          ? 'bg-emerald-950/20 border-emerald-500/30'
                          : isResponsible
                          ? 'bg-slate-950 border-amber-500/50 ring-1 ring-amber-500/20 shadow-md'
                          : 'bg-slate-950/70 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <button
                            onClick={() => handleUpdateFaseProgress(currentObra.id, fase.id, isCompleted ? 0 : 100)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition ${
                              isCompleted
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            {isCompleted ? '✓' : idx + 1}
                          </button>
                          <div>
                            <h5 className={`text-xs font-bold ${isCompleted ? 'text-emerald-400 line-through' : 'text-white'}`}>
                              {fase.nombre}
                            </h5>
                            <p className="text-[10px] text-slate-400">
                              Asignado: <strong className={isResponsible ? 'text-amber-400' : 'text-slate-300'}>{fase.responsable}</strong>
                              {isResponsible && ' (¡Es tu tarea!)'}
                            </p>
                          </div>
                        </div>

                        <span className={`text-xs font-mono font-bold ${isCompleted ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {fase.progreso}%
                        </span>
                      </div>

                      {/* Progress bar and quick increment buttons */}
                      <div className="space-y-1.5 pt-1">
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${isCompleted ? 'bg-emerald-500' : 'bg-amber-400'}`}
                            style={{ width: `${fase.progreso}%` }}
                          ></div>
                        </div>

                        {!isCompleted && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <span className="text-[10px] text-slate-500">Marcar avance:</span>
                            {[50, 75, 100].map(pct => (
                              <button
                                key={pct}
                                onClick={() => handleUpdateFaseProgress(currentObra.id, fase.id, pct)}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition"
                              >
                                {pct === 100 ? 'Terminada ✓' : `${pct}%`}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Modal Subir Foto del Avance */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4">
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
        </div>
      )}

      {/* Modal Nota de Voz desde el Móvil */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4">
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
        </div>
      )}

    </div>
  );
}
