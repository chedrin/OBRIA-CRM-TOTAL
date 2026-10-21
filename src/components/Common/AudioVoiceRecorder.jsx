import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Upload,
  Play,
  Square,
  Sparkles,
  Edit3,
  CheckCircle2,
  AlertCircle,
  FileAudio,
  Volume2,
  RotateCcw,
  Clock,
  Key,
  ExternalLink,
  Info,
  ShieldAlert,
  ChevronRight,
  Settings,
  Trash2
} from 'lucide-react';
import { transcribeAudio } from '../../services/aiAudioTextService';
import { useApp } from '../../context/AppContext';

export default function AudioVoiceRecorder({
  onTranscriptChange,
  onTranscriptionComplete,
  initialTranscript = '',
  placeholder = 'La transcripción del audio aparecerá aquí en tiempo real y podrás editarla antes de generar partidas...',
  title = 'Captura de Voz con Inteligencia Artificial (Whisper)'
}) {
  const { empresaConfig, showNotification, setActiveTab } = useApp();

  const notifyTranscript = (text, blob = null) => {
    if (onTranscriptChange) onTranscriptChange(text, blob);
    if (onTranscriptionComplete) onTranscriptionComplete(text, blob);
  };

  const [isRecording, setIsRecording] = useState(false);
  const [isSimulatedRecording, setIsSimulatedRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState(initialTranscript);
  const [liveSpeechText, setLiveSpeechText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [micVolume, setMicVolume] = useState(0); // 0 to 100%
  const [micError, setMicError] = useState(null); // 'insecure_context' | 'permission_denied' | 'no_hardware' | null
  const [showKeyGuideModal, setShowKeyGuideModal] = useState(false);
  const [audioPreview, setAudioPreview] = useState(null); // { url, name, size }

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const mediaElementSourceRef = useRef(null);

  const aiConfig = empresaConfig?.aiConfig || {};
  const hasRealOpenAiKey =
    aiConfig.apiKey &&
    aiConfig.apiKey.startsWith('sk-') &&
    !aiConfig.apiKey.includes('obramaster9876543210');

  // Sync initial transcript
  useEffect(() => {
    setTranscript(initialTranscript || '');
  }, [initialTranscript]);

  // Clean up AudioContext & MediaStream on unmount
  const stopAudioTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAudioTracks();
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [stopAudioTracks]);

  // Audio Visualization Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let simAngle = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const barCount = 28;
      const barWidth = Math.floor(width / barCount) - 2;

      if (isRecording && analyserRef.current) {
        // Real microphone frequency data
        const analyser = analyserRef.current;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        // Calculate average volume level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const volPct = Math.min(100, Math.round((avg / 128) * 100));
        setMicVolume(volPct);

        for (let i = 0; i < barCount; i++) {
          const dataIndex = Math.floor((i / barCount) * dataArray.length);
          const value = dataArray[dataIndex] || 0;
          const percent = value / 255;
          const barHeight = Math.max(4, percent * (height - 6));

          const x = i * (barWidth + 2);
          const y = (height - barHeight) / 2;

          // Gradient: Amber -> Emerald for voice intensity
          const gradient = ctx.createLinearGradient(0, height, 0, 0);
          gradient.addColorStop(0, '#f59e0b'); // amber-500
          gradient.addColorStop(0.7, '#fbbf24'); // amber-400
          gradient.addColorStop(1, '#10b981'); // emerald-500

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 3);
          ctx.fill();
        }
      } else if (isSimulatedRecording) {
        // Simulated voice rhythm (natural cadence with peaks and pauses)
        simAngle += 0.15;
        const simVol = Math.round(30 + Math.sin(simAngle * 0.8) * 35);
        setMicVolume(simVol);

        for (let i = 0; i < barCount; i++) {
          const wave = Math.sin(simAngle + i * 0.25) * Math.cos(simAngle * 0.5 + i * 0.1);
          const percent = Math.abs(wave);
          const barHeight = Math.max(4, percent * (height - 8));
          const x = i * (barWidth + 2);
          const y = (height - barHeight) / 2;

          ctx.fillStyle = i % 2 === 0 ? '#f59e0b' : '#38bdf8';
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 3);
          ctx.fill();
        }
      } else {
        // Idle state: Subtle animated baseline dots
        setMicVolume(0);
        ctx.fillStyle = '#334155'; // slate-700
        for (let i = 0; i < barCount; i++) {
          const x = i * (barWidth + 2);
          const y = height / 2 - 2;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, 4, 2);
          ctx.fill();
        }
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isRecording, isSimulatedRecording]);

  // Start Live Microphone Recording
  const handleStartRecording = async () => {
    setMicError(null);
    setLiveSpeechText('');

    // Check secure context for local IP network
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!window.isSecureContext && !isLocalhost) {
      setMicError('insecure_context');
      showNotification('Conexión HTTP: El navegador exige HTTPS o localhost para activar el micrófono real.', 'error');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError('insecure_context');
      showNotification('El navegador no expone getUserMedia en este entorno.', 'error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      // 1. Initialize AudioContext and AnalyserNode for the live sound wave
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyserRef.current = analyser;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
          sourceRef.current = source;
        }
      } catch (audioCtxErr) {
        console.warn('AudioContext visualization warning:', audioCtxErr);
      }

      // 2. Initialize browser SpeechRecognition for live speech-to-text
      let fullSpeech = '';
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'es-ES';
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.onresult = (event) => {
            let interim = '';
            for (let i = 0; i < event.results.length; i++) {
              interim += event.results[i][0].transcript + ' ';
            }
            fullSpeech = interim;
            setLiveSpeechText(interim);
            setTranscript(interim);
            notifyTranscript(interim, null);
          };
          recognition.onerror = (e) => {
            console.warn('SpeechRecognition interim event:', e?.error);
          };
          recognition.start();
          recognitionRef.current = recognition;
        } catch (speechErr) {
          console.warn('SpeechRecognition not available or failed:', speechErr);
        }
      }

      // 3. Setup MediaRecorder for final audio blob
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const previewUrl = URL.createObjectURL(audioBlob);
        setAudioPreview({
          url: previewUrl,
          name: `Grabacion_${new Date().toLocaleTimeString().replace(/:/g, '-')}.webm`,
          size: `${(audioBlob.size / 1024).toFixed(1)} KB`
        });
        stopAudioTracks();
        await processAudioTranscription(audioBlob, 'microphone', fullSpeech);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setIsSimulatedRecording(false);
      setRecordSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordSeconds(prev => prev + 1);
      }, 1000);

      showNotification('🎙️ Micrófono conectado. Habla con claridad y observa las barras de sonido.');
    } catch (err) {
      console.warn('Microphone error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicError('permission_denied');
        showNotification('Permiso de micrófono bloqueado. Desbloquéalo en el candado 🔒 de tu navegador.', 'error');
      } else {
        setMicError('no_hardware');
        showNotification('No se ha detectado micrófono físico o está ocupado por otra app.', 'error');
      }
    }
  };

  // Stop Recording
  const handleStopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsSimulatedRecording(false);
  };

  // Connect Audio Player to Visualizer Analyser Node
  const handleAudioPlay = () => {
    setIsRecording(false);
    setIsSimulatedRecording(true);
    try {
      if (audioPlayerRef.current && !mediaElementSourceRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = audioContextRef.current || new AudioCtx();
          audioContextRef.current = audioCtx;
          if (audioCtx.state === 'suspended') {
            audioCtx.resume();
          }
          const analyser = analyserRef.current || audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyserRef.current = analyser;

          const source = audioCtx.createMediaElementSource(audioPlayerRef.current);
          source.connect(analyser);
          analyser.connect(audioCtx.destination);
          mediaElementSourceRef.current = source;
        }
      }
    } catch (err) {
      console.warn('MediaElementSource visualization warning:', err);
    }
  };

  const handleAudioPauseOrEnded = () => {
    setIsSimulatedRecording(false);
  };

  // Upload Audio File
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so re-selecting same file works
    e.target.value = '';

    const previewUrl = URL.createObjectURL(file);
    setAudioPreview({
      url: previewUrl,
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`
    });

    showNotification(`Archivo "${file.name}" cargado. Procesando transcripción...`);

    // Auto-play preview audio so user hears and sees waveform
    setTimeout(() => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.play().catch(() => {});
      }
    }, 200);

    await processAudioTranscription(file, 'file', liveSpeechText);
  };

  const handleDiscardAudio = () => {
    if (audioPreview?.url) {
      try {
        URL.revokeObjectURL(audioPreview.url);
      } catch (e) {}
    }
    setAudioPreview(null);
    mediaElementSourceRef.current = null;
    setIsSimulatedRecording(false);
    setTranscript('');
    notifyTranscript('', null);
    showNotification('Audio descartado.');
  };

  // Transcribe and notify parent
  const processAudioTranscription = async (blobOrFile, source, speechFallback = '') => {
    setIsTranscribing(true);
    try {
      const res = await transcribeAudio(blobOrFile, aiConfig, speechFallback);
      if (res && res.success && res.text) {
        setTranscript(res.text);
        notifyTranscript(res.text, blobOrFile);
        showNotification(
          res.source === 'whisper-api'
            ? '✨ Audio transcribido por OpenAI Whisper Cloud con éxito.'
            : res.source === 'gemini-multimodal'
            ? '✨ Audio transcribido por Google Gemini Multimodal con éxito.'
            : res.source === 'browser-speech-recognition'
            ? '🎙️ Audio transcribido mediante reconocimiento de voz del navegador.'
            : '📝 Audio de obra procesado por el motor de IA.'
        );
      }
    } catch (err) {
      console.error('[Audio Processing Exception]', err);
      showNotification(`No se pudo transcribir el audio: ${err.message || 'revisa el motor de IA en Ajustes'}`, 'error');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setTranscript(val);
    notifyTranscript(val, null);
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4">
      
      {/* 1. Header: Title & AI Cloud Engine Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Volume2 className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-white leading-tight">{title}</h4>
            <p className="text-[11px] text-slate-400">Captura por voz y normalización técnica</p>
          </div>
        </div>

        {/* Engine Status Badge & Setup Helper */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Transcripción con IA (Whisper / Gemini)
          </span>
        </div>
      </div>

      {/* 2. Recording Waveform Canvas & Control Buttons */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
        
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          
          {/* Left: Dynamic Real Sound Waves */}
          <div className="w-full lg:w-1/2 space-y-1.5">
            <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800 flex flex-col justify-center">
              <canvas
                ref={canvasRef}
                width={320}
                height={48}
                className="w-full h-12 rounded-lg"
              />
            </div>

            <div className="flex items-center justify-between px-1 text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                {isRecording ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-emerald-400 font-bold">Nivel Micrófono: {micVolume}%</span>
                  </>
                ) : isSimulatedRecording ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                    <span className="text-amber-400 font-bold">Simulación Activa ({micVolume}%)</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                    <span>Detector de Sonido en Espera</span>
                  </>
                )}
              </span>

              {(isRecording || isSimulatedRecording) && (
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimer(recordSeconds)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2 w-full lg:w-auto shrink-0">
            
            {isRecording || isSimulatedRecording ? (
              <button
                type="button"
                onClick={handleStopRecording}
                className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-rose-600/30 animate-pulse"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Finalizar y Transcribir</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartRecording}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-amber-500/20 active:scale-95"
              >
                <Mic className="w-4 h-4 stroke-[2.5]" />
                <span>Grabar con Micrófono</span>
              </button>
            )}

            {/* Upload Audio File */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                  fileInputRef.current.click();
                }
              }}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-amber-400/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
              title="Añadir archivo de audio grabado (mp3, wav, m4a, ogg, webm)"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>Añadir Audio</span>
            </button>
          </div>

        </div>

        {/* Audio Player Preview (if audio was recorded or uploaded) */}
        {audioPreview && (
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-2.5 min-w-0 w-full sm:w-auto">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                <FileAudio className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-white font-bold truncate block">{audioPreview.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">{audioPreview.size} · Audio listo para procesar</span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <audio
                ref={audioPlayerRef}
                src={audioPreview.url}
                controls
                onPlay={handleAudioPlay}
                onPause={handleAudioPauseOrEnded}
                onEnded={handleAudioPauseOrEnded}
                className="h-8 w-full sm:w-60"
              />
              <button
                type="button"
                onClick={handleDiscardAudio}
                className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl transition shrink-0"
                title="Descartar este archivo de audio"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Diagnostic Banner if mic error */}
        {micError && (
          <div className="bg-rose-950/30 border border-rose-500/40 p-3 rounded-xl text-xs space-y-2 animate-in fade-in">
            <div className="flex items-start gap-2 text-rose-300 font-bold">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                {micError === 'insecure_context' && (
                  <span>Restricción de Seguridad del Navegador (Conexión HTTP en Red Local)</span>
                )}
                {micError === 'permission_denied' && (
                  <span>Permiso de Micrófono Bloqueado</span>
                )}
                {micError === 'no_hardware' && (
                  <span>No se ha podido iniciar el micrófono físico</span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              {micError === 'insecure_context' && (
                <>
                  Los navegadores modernos (Chrome, Edge, Safari) bloquean la API de micrófono al navegar por IP local en HTTP (ej: <code>http://192.168.1.135:5173</code>). 
                  Para usar tu micrófono real, abre la app desde <strong>https://</strong> o desde <strong>http://localhost</strong> en tu PC. También puedes grabar con el móvil y pulsar <strong>"Añadir Audio"</strong>.
                </>
              )}
              {micError === 'permission_denied' && (
                <>
                  Has bloqueado el micrófono en esta página. Pulsa en el <strong>icono del candado 🔒</strong> a la izquierda de la barra de direcciones de tu navegador, cambia el permiso de Micrófono a <strong>"Permitir"</strong> y recarga la página.
                </>
              )}
              {micError === 'no_hardware' && (
                <>
                  Verifica que tu micrófono esté bien enchufado en Windows/móvil y que ninguna otra aplicación (Teams, Zoom, etc.) lo tenga bloqueado en exclusiva.
                </>
              )}
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 border border-slate-700 transition"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Subir archivo mp3/m4a</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* 3. Transcription Preview & Live Editing Box */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
            <span>Transcripción del Audio (Editable en Vivo)</span>
          </span>

          <div className="flex items-center gap-2">
            {transcript && (
              <button
                type="button"
                onClick={() => { setTranscript(''); notifyTranscript('', null); }}
                className="text-slate-500 hover:text-slate-300 text-[10px] transition"
              >
                Borrar
              </button>
            )}
            {transcript && (
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {transcript.split(' ').filter(Boolean).length} palabras
              </span>
            )}
          </div>
        </div>

        <div className="relative">
          <textarea
            rows="3"
            value={transcript}
            onChange={handleTextChange}
            placeholder={placeholder}
            className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500/60 rounded-xl p-3.5 text-xs text-white placeholder-slate-500 leading-relaxed focus:outline-none transition font-sans"
          ></textarea>

          {isTranscribing && (
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm rounded-xl flex items-center justify-center gap-2.5 text-xs font-bold text-amber-400 border border-amber-500/40">
              <Sparkles className="w-5 h-5 animate-spin text-amber-400" />
              <span>Transcribiendo audio con Inteligencia Artificial (Whisper)...</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span>
            {transcript ? (
              <span className="text-amber-400/90 font-medium">
                ✓ Transcripción lista. Puedes editar cualquier cifra antes de pulsar "Generar Partidas con IA".
              </span>
            ) : (
              <span>Habla con naturalidad sobre partidas, mediciones, tabiques o demoliciones.</span>
            )}
          </span>
        </div>
      </div>

      {/* 4. Modal Guía: Cómo activar Whisper y la IA con API Key */}
      {showKeyGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/40 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4 text-xs">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Cómo activar Whisper y la IA en ObraMaster</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowKeyGuideModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-slate-300 leading-relaxed text-[11px]">
              <p>
                ObraMaster integra el motor oficial de <strong>OpenAI Whisper</strong> (para transcribir la voz con máxima fidelidad en términos de construcción) y <strong>GPT-4o</strong> (para convertir esa voz en capítulos y partidas con precios).
              </p>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">1</span>
                  <span>Obtén tu clave de OpenAI:</span>
                </div>
                <p className="text-slate-400 pl-7">
                  Entra en <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-amber-400 underline font-bold inline-flex items-center gap-0.5">platform.openai.com/api-keys <ExternalLink className="w-3 h-3" /></a> y crea una clave (empieza por <code>sk-</code>).
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">2</span>
                  <span>Configúrala en ObraMaster:</span>
                </div>
                <p className="text-slate-400 pl-7">
                  Ve a la pestaña <strong>Config. Fiscal & IA</strong> en el menú lateral izquierdo y accede a la sección <strong>Motor de Inteligencia Artificial</strong>.
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">3</span>
                  <span>Prueba la conexión:</span>
                </div>
                <p className="text-slate-400 pl-7">
                  Pega tu clave, selecciona el modelo <strong>GPT-4o</strong> y pulsa <strong>"Probar Conexión con Motor IA"</strong>. Quedará activado para siempre.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowKeyGuideModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg"
              >
                Entendido
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowKeyGuideModal(false);
                  if (setActiveTab) setActiveTab('empresa_config');
                }}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg transition flex items-center gap-1.5 shadow"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Ir a Configurar Clave Ahora</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
