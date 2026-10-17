import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Mic,
  MicOff,
  Mail,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  Package,
  Plus,
  ArrowRight,
  HardHat,
  User,
  Clock,
  DollarSign,
  Send,
  Volume2,
  Layers,
  Inbox
} from 'lucide-react';
import AudioEmailCaptureView from './AudioEmailCaptureView';

export default function AudioEmailInbox() {
  const {
    mensajesInbox,
    obras,
    processMensajeInbox,
    addMensajeInbox
  } = useApp();

  const [inboxViewMode, setInboxViewMode] = useState('multimodal_studio'); // 'multimodal_studio' | 'message_feed'
  const [activeTab, setActiveTab] = useState('todos'); // todos, audios, emails, procesados
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const timerRef = useRef(null);

  // New simulated input state
  const [newMode, setNewMode] = useState('quick_audio'); // quick_audio, mic, manual_email
  const [emailText, setEmailText] = useState('');
  const [emailSender, setEmailSender] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [targetObraId, setTargetObraId] = useState(obras[0]?.id || '');

  // Live Canvas Waveform for recording
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    if (isRecording) {
      let angle = 0;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const draw = () => {
        angle += 0.15;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;

        for (let x = 0; x < canvas.width; x++) {
          const y = canvas.height / 2 + Math.sin(x * 0.05 + angle) * 16 * Math.sin(angle * 0.5 + x * 0.02);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        animationFrameRef.current = requestAnimationFrame(draw);
      };
      draw();
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isRecording]);

  const startRecording = () => {
    setIsRecording(true);
    setRecordSeconds(0);
    timerRef.current = setInterval(() => {
      setRecordSeconds(s => s + 1);
    }, 1000);
  };

  const stopRecording = (simulatedCase = null) => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);

    // If simulated case chosen or mic recorded
    let newMsg;
    if (simulatedCase === 'obrero_pladur') {
      newMsg = {
        tipo: 'audio',
        origen: 'WhatsApp Audio Obrero (Micrófono)',
        remitente: 'Ionut Radu (Oficial Pladurista)',
        telefono: '+34 633 445 566',
        obraId: targetObraId || obras[0]?.id,
        obraTitulo: obras.find(o => o.id === targetObraId)?.titulo || obras[0]?.titulo,
        audioDuracion: '0:34',
        audioTranscripcion: 'Manuel, soy Ionut. Te mando este audio desde el salón de la obra: para terminar los foseados perimetrales del falso techo nos faltan 5 placas de pladur hidrófugo verde y 2 rollos de cinta para juntas de papel microperforado. Si nos lo puedes mandar hoy a las 2 de la tarde, lo dejamos listo para que entre el pintor el lunes.',
        analisisIA: {
          remitenteDetectado: 'Obrero (Ionut Radu - Pladurista)',
          obraDetectada: obras.find(o => o.id === targetObraId)?.titulo || obras[0]?.titulo,
          urgencia: 'Alta (Evitar cuello de botella en fase pintura)',
          necesidadesCalculadas: [
            { concepto: 'Placas Pladur Hidrófugo Verde 13mm', cantidad: 5, unidad: 'placas', costeAprox: 65, pvpCliente: 0 },
            { concepto: 'Rollos cinta de juntas microperforada 150m', cantidad: 2, unidad: 'rollos', costeAprox: 18, pvpCliente: 0 },
            { concepto: 'Coordinación con DecorPint para entrada el lunes', cantidad: 1, unidad: 'aviso', costeAprox: 0, pvpCliente: 0 }
          ],
          impactoPresupuesto: 83.00,
          accionSugerida: 'Pedir 5 placas verdes a La Plataforma y avisar al pintor para el lunes a las 08:30.'
        }
      };
    } else if (simulatedCase === 'cliente_griferia') {
      newMsg = {
        tipo: 'audio',
        origen: 'WhatsApp Audio Cliente',
        remitente: 'D. Javier Morales (Cliente)',
        telefono: '+34 612 345 678',
        obraId: targetObraId || obras[0]?.id,
        obraTitulo: obras.find(o => o.id === targetObraId)?.titulo || obras[0]?.titulo,
        audioDuracion: '0:45',
        audioTranscripcion: 'Hola Manuel, te llamaba por lo que comentamos ayer. Hemos estado mirando el baño de invitados y preferimos poner un plato de ducha de resina blanca con textura pizarra en lugar de azulejos en el suelo. Y en la grifería queremos monomando en cascada negro mate. Pásame por favor el importe extra para darte el ok.',
        analisisIA: {
          remitenteDetectado: 'Cliente (D. Javier Morales)',
          obraDetectada: obras.find(o => o.id === targetObraId)?.titulo || obras[0]?.titulo,
          urgencia: 'Media (Aprobación de modificación)',
          necesidadesCalculadas: [
            { concepto: 'Suministro e instalación plato de ducha resina blanca textura pizarra 120x80', cantidad: 1, unidad: 'ud', costeAprox: 190, pvpCliente: 260 },
            { concepto: 'Grifería de lavabo monomando acabado cascada negro mate', cantidad: 1, unidad: 'ud', costeAprox: 75, pvpCliente: 110 }
          ],
          impactoPresupuesto: 370.00,
          accionSugerida: 'Crear partida adicional de modificación presupuestaria por 370,00 € + IVA (10%).'
        }
      };
    } else {
      // General voice note recorded
      newMsg = {
        tipo: 'audio',
        origen: 'Grabación de Voz en Directo',
        remitente: 'Nota de Voz en Obra',
        telefono: '+34 611 000 111',
        obraId: targetObraId || obras[0]?.id,
        obraTitulo: obras.find(o => o.id === targetObraId)?.titulo || obras[0]?.titulo,
        audioDuracion: `0:${String(recordSeconds).padStart(2, '0')}`,
        audioTranscripcion: 'Audio registrado: Revisión de estado de obra. Se requiere pedir mortero fino y coordinar revisión de fontanería antes de cerrar suelo.',
        analisisIA: {
          remitenteDetectado: 'Nota de Voz de Encargado',
          obraDetectada: obras.find(o => o.id === targetObraId)?.titulo || obras[0]?.titulo,
          urgencia: 'Normal',
          necesidadesCalculadas: [
            { concepto: 'Mortero fino de acabado gris', cantidad: 4, unidad: 'sacos', costeAprox: 32, pvpCliente: 45 },
            { concepto: 'Revisión presión colectores fontanería', cantidad: 1, unidad: 'servicio', costeAprox: 0, pvpCliente: 0 }
          ],
          impactoPresupuesto: 45.00,
          accionSugerida: 'Verificar albarán con proveedor y registrar en diario de obra.'
        }
      };
    }

    addMensajeInbox(newMsg);
  };

  const handleSendManualEmail = (e) => {
    e.preventDefault();
    if (!emailText) return;

    const matchedObra = obras.find(o => o.id === targetObraId) || obras[0];

    const newMsg = {
      tipo: 'email',
      origen: 'Email Recibido',
      remitente: emailSender || 'Cliente Remitente',
      email: 'cliente@ejemplo.es',
      asunto: emailSubject || 'Modificación solicitada para la obra',
      cuerpo: emailText,
      obraId: matchedObra.id,
      obraTitulo: matchedObra.titulo,
      analisisIA: {
        remitenteDetectado: 'Cliente',
        obraDetectada: matchedObra.titulo,
        urgencia: 'Media',
        necesidadesCalculadas: [
          { concepto: 'Modificación según solicitud de email: ' + emailSubject, cantidad: 1, unidad: 'partida', costeAprox: 150, pvpCliente: 210 }
        ],
        impactoPresupuesto: 210.00,
        accionSugerida: 'Calcular medición exacta y responder al cliente con presupuesto adicional.'
      }
    };

    addMensajeInbox(newMsg);
    setEmailText('');
    setEmailSubject('');
    setEmailSender('');
  };

  const filteredMessages = mensajesInbox.filter(m => {
    if (activeTab === 'audios') return m.tipo === 'audio';
    if (activeTab === 'emails') return m.tipo === 'email';
    if (activeTab === 'procesados') return m.estadoProcesado;
    return true; // todos
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Sparkles className="w-7 h-7 text-amber-400" />
            <span>Módulo Multimodal de Captura IA & Mensajes de Obra</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Captura voz en directo, procesa audios o hilos de email/WhatsApp y genera partidas técnicas presupuestarias normalizadas con IA.
          </p>
        </div>

        <div className="flex items-center bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shadow-inner self-start lg:self-auto">
          <button
            onClick={() => setInboxViewMode('multimodal_studio')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
              inboxViewMode === 'multimodal_studio'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Estudio Multimodal IA</span>
            <span className="text-[10px] bg-slate-950/40 text-slate-950 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold">Recomendado</span>
          </button>

          <button
            onClick={() => setInboxViewMode('message_feed')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
              inboxViewMode === 'message_feed'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Bandeja de Mensajes ({mensajesInbox.length})</span>
          </button>
        </div>
      </div>

      {/* View router */}
      {inboxViewMode === 'multimodal_studio' ? (
        <AudioEmailCaptureView />
      ) : (
        <div className="space-y-6">
          {/* Voice Recorder & Intake Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden space-y-6">
        
        {/* Sub-modes selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Modo de Entrada:</span>
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setNewMode('quick_audio')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  newMode === 'quick_audio' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Audios de Ejemplo Reales
              </button>
              <button
                onClick={() => setNewMode('mic')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  newMode === 'mic' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Grabar con Micrófono</span>
              </button>
              <button
                onClick={() => setNewMode('manual_email')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  newMode === 'manual_email' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Pegar Email de Cliente</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Asignar a Obra:</span>
            <select
              value={targetObraId}
              onChange={(e) => setTargetObraId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400 font-medium"
            >
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.titulo} ({o.codigo})</option>
              ))}
            </select>
          </div>
        </div>

        {/* MODE 1: QUICK AUDIOS TO TEST IA */}
        {newMode === 'quick_audio' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Simular Nota de Voz de WhatsApp en 1 Clic</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Test Audio 1: Obrero Pladur */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-amber-500/40 transition space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                      👷
                    </span>
                    <div>
                      <h4 className="font-bold text-white text-xs">Obrero: Falta Pladur y Cinta</h4>
                      <p className="text-[11px] text-slate-400">Ionut Radu (Yesista/Pladurista)</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">0:34</span>
                </div>
                <p className="text-xs text-slate-300 italic line-clamp-2">
                  "Manuel, nos faltan 5 placas de pladur hidrófugo verde y 2 rollos de cinta para cerrar el techo del salón..."
                </p>
                <button
                  onClick={() => stopRecording('obrero_pladur')}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Procesar este Audio con IA</span>
                </button>
              </div>

              {/* Test Audio 2: Cliente Grifería y Plato de Ducha */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-amber-500/40 transition space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                      👤
                    </span>
                    <div>
                      <h4 className="font-bold text-white text-xs">Cliente: Cambio Grifería y Plato</h4>
                      <p className="text-[11px] text-slate-400">D. Javier Morales (Cliente)</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">0:45</span>
                </div>
                <p className="text-xs text-slate-300 italic line-clamp-2">
                  "Hola Manuel, preferimos poner plato de ducha de resina pizarra blanca y grifería monomando cascada negro mate..."
                </p>
                <button
                  onClick={() => stopRecording('cliente_griferia')}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Procesar este Audio con IA</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* MODE 2: LIVE MIC RECORDER */}
        {newMode === 'mic' && (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
            {isRecording ? (
              <div className="space-y-4 w-full max-w-md">
                <div className="flex items-center justify-center gap-2 text-rose-500 animate-pulse font-bold text-sm">
                  <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                  <span>Grabando audio de obra... {recordSeconds}s</span>
                </div>
                <canvas ref={canvasRef} width="400" height="60" className="w-full h-14 bg-slate-950 rounded-xl border border-slate-800"></canvas>
                <button
                  onClick={() => stopRecording()}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 mx-auto shadow-lg shadow-rose-600/30"
                >
                  <Square className="w-4 h-4 fill-white" />
                  <span>Detener y Analizar con IA</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={startRecording}
                  className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 hover:scale-105 active:scale-95 transition flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/25 mx-auto"
                >
                  <Mic className="w-8 h-8 stroke-[2.2]" />
                </button>
                <p className="text-xs text-slate-300 font-medium">Pulsa el micrófono para dictar las necesidades de la obra o grabar al cliente</p>
                <p className="text-[11px] text-slate-500">Dicta materiales que faltan, cambios de alicatado, rozas o peticiones</p>
              </div>
            )}
          </div>
        )}

        {/* MODE 3: EMAIL INTAKE */}
        {newMode === 'manual_email' && (
          <form onSubmit={handleSendManualEmail} className="space-y-3 text-xs sm:text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Nombre o Email del Cliente</label>
                <input
                  type="text"
                  placeholder="Ej: Carmen Ruiz <carmen@gmail.com>"
                  value={emailSender}
                  onChange={(e) => setEmailSender(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Asunto</label>
                <input
                  type="text"
                  placeholder="Ej: Cambio de enchufes y pintura salón"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Cuerpo del Email Recibido</label>
              <textarea
                rows="3"
                required
                placeholder="Pega aquí el correo que te ha mandado el cliente solicitando cambios o necesidades..."
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400"
              ></textarea>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center gap-2 shadow"
              >
                <Sparkles className="w-4 h-4" />
                <span>Analizar y Calcular Necesidades con IA</span>
              </button>
            </div>
          </form>
        )}

      </div>

      {/* Messages Feed Header & Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-amber-400" />
          <span>Bandeja de Mensajes Analizados ({filteredMessages.length})</span>
        </h2>

        <div className="flex items-center gap-1">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'audios', label: 'Audios' },
            { id: 'emails', label: 'Emails' },
            { id: 'procesados', label: 'Completados' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activeTab === tab.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages List */}
      <div className="space-y-5">
        {filteredMessages.map((msg) => {
          const isAudio = msg.tipo === 'audio';
          const isProcessed = msg.estadoProcesado;
          const matchedObra = obras.find(o => o.id === msg.obraId) || obras[0];

          return (
            <div
              key={msg.id}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-lg space-y-4 transition ${
                isProcessed ? 'border-slate-800 opacity-90' : 'border-amber-500/40 shadow-amber-500/5'
              }`}
            >
              {/* Message Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isAudio ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {isAudio ? <Mic className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-sm sm:text-base">{msg.remitente}</h3>
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {msg.origen}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Obra vinculada: <strong className="text-amber-400">{msg.obraTitulo || matchedObra.titulo}</strong> · {msg.fecha}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    isProcessed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {isProcessed ? '✓ Aplicado a Obra' : '⚡ Pendiente de aplicar'}
                  </span>
                </div>
              </div>

              {/* Transcription / Body */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  <span>{isAudio ? 'Transcripción de la Nota de Voz' : 'Texto del Correo Electrónico'}</span>
                  {msg.audioDuracion && <span>Duración: {msg.audioDuracion}</span>}
                </div>
                <p className="text-xs sm:text-sm text-slate-200 italic leading-relaxed">
                  "{msg.audioTranscripcion || msg.cuerpo}"
                </p>
              </div>

              {/* AI Needs Calculation Box */}
              {msg.analisisIA && (
                <div className="bg-gradient-to-r from-slate-900 to-amber-950/20 border border-amber-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                      <Sparkles className="w-4 h-4" />
                      <span>Cálculo Inteligente de Necesidades Extraídas</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-300">
                      Urgencia: <strong className="text-amber-400">{msg.analisisIA.urgencia}</strong>
                    </span>
                  </div>

                  {/* Calculated items table */}
                  <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="py-2 px-3">Necesidad / Material / Partida</th>
                          <th className="py-2 px-3">Cantidad</th>
                          <th className="py-2 px-3">Coste Estimado</th>
                          <th className="py-2 px-3 text-right">PVP Cliente</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {(msg.analisisIA.necesidadesCalculadas || []).map((nc, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/40">
                            <td className="py-2 px-3 font-medium text-white">{nc.concepto}</td>
                            <td className="py-2 px-3">{nc.cantidad} {nc.unidad}</td>
                            <td className="py-2 px-3 text-slate-400 font-mono">{nc.costeAprox} €</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-amber-400">
                              {nc.pvpCliente ? `${nc.pvpCliente} €` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-xs text-slate-300">
                    💡 <strong className="text-white">Acción recomendada por la IA:</strong> {msg.analisisIA.accionSugerida}
                  </p>

                  {/* Action Buttons to apply to obra or budget */}
                  {!isProcessed && (
                    <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => processMensajeInbox(msg.id, matchedObra.id, 'aplicar_necesidades_obra')}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>Incorporar a Necesidades de la Obra</span>
                      </button>

                      <button
                        onClick={() => processMensajeInbox(msg.id, matchedObra.id, 'crear_partida_presupuesto')}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Añadir como Partida Adicional al Presupuesto</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          );
        })}
        </div>
      </div>
    )}

  </div>
  );
}


