import React, { useState, useRef, useEffect } from 'react';
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
  Clock
} from 'lucide-react';
import { transcribeAudio } from '../../services/aiAudioTextService';
import { useApp } from '../../context/AppContext';

export default function AudioVoiceRecorder({
  onTranscriptChange,
  initialTranscript = '',
  placeholder = 'La transcripción del audio aparecerá aquí en tiempo real y podrás editarla...',
  title = 'Grabación de Voz & Transcripción IA'
}) {
  const { empresaConfig, showNotification } = useApp();

  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState(initialTranscript);
  const [isEditing, setIsEditing] = useState(false);
  const [audioSourceType, setAudioSourceType] = useState(null); // 'microphone', 'file', 'demo'

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sync initial transcript
  useEffect(() => {
    if (initialTranscript) {
      setTranscript(initialTranscript);
    }
  }, [initialTranscript]);

  // Waveform visualization while recording
  useEffect(() => {
    if (isRecording) {
      let angle = 0;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const draw = () => {
        angle += 0.18;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.strokeStyle = '#f59e0b'; // Amber
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

  // Start Live Microphone Recording with MediaRecorder
  const handleStartRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showNotification('Tu navegador no soporta captura de micrófono nativa. Usa la subida de audio.', 'error');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await processAudioTranscription(audioBlob, 'microphone');
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      setAudioSourceType('microphone');

      timerRef.current = setInterval(() => {
        setRecordSeconds(prev => prev + 1);
      }, 1000);

      showNotification('🎙️ Grabando audio de obra... Habla con naturalidad.');
    } catch (err) {
      console.warn('Microphone permission or hardware error:', err);
      showNotification('Permiso de micrófono denegado. Puedes subir un archivo de audio o usar la muestra.', 'error');
    }
  };

  // Stop Recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Upload Audio File
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioSourceType('file');
    showNotification(`Archivo "${file.name}" cargado. Transcribiendo con IA...`);
    await processAudioTranscription(file, 'file');
  };

  // Load Demo Audio
  const handleLoadDemoAudio = async () => {
    setAudioSourceType('demo');
    const demoBlob = new Blob(['sample-audio-data'], { type: 'audio/webm' });
    await processAudioTranscription(demoBlob, 'demo');
  };

  // Transcribe and notify parent
  const processAudioTranscription = async (blobOrFile, source) => {
    setIsTranscribing(true);
    try {
      const res = await transcribeAudio(blobOrFile, empresaConfig?.aiConfig || {});
      if (res.success && res.text) {
        setTranscript(res.text);
        if (onTranscriptChange) {
          onTranscriptChange(res.text, blobOrFile);
        }
        showNotification('Transcripción completada con éxito. Revisa el texto antes de generar el presupuesto.');
      }
    } catch (err) {
      showNotification('Error al transcribir el audio.', 'error');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setTranscript(val);
    if (onTranscriptChange) {
      onTranscriptChange(val, null);
    }
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
      
      {/* Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-xs font-bold text-white flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-amber-400" />
          <span>{title}</span>
        </span>

        <div className="flex items-center gap-2 text-[11px]">
          {isRecording ? (
            <span className="flex items-center gap-1.5 text-rose-400 font-bold animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>Grabando: {formatTimer(recordSeconds)}</span>
            </span>
          ) : isTranscribing ? (
            <span className="flex items-center gap-1.5 text-indigo-400 font-bold">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>Transcribiendo con Whisper IA...</span>
            </span>
          ) : (
            <span className="text-slate-400 font-medium">Whisper STT Activo</span>
          )}
        </div>
      </div>

      {/* Recording Waveform & Buttons */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Left: Waveform or Idle Graphic */}
        <div className="w-full sm:w-1/2 flex items-center gap-3">
          {isRecording ? (
            <div className="w-full bg-slate-950 rounded-lg p-2 border border-amber-500/30 flex items-center justify-center">
              <canvas ref={canvasRef} width={260} height={40} className="w-full h-10" />
            </div>
          ) : (
            <div className="w-full bg-slate-950/80 rounded-lg p-2.5 border border-slate-800 flex items-center gap-2 text-xs text-slate-400">
              <Mic className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="truncate">Pulsa "Grabar Micrófono" o sube un archivo de voz</span>
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isRecording ? (
            <button
              type="button"
              onClick={handleStopRecording}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-rose-600/30"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>Finalizar y Transcribir</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartRecording}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-amber-500/20"
            >
              <Mic className="w-3.5 h-3.5 stroke-[2.5]" />
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
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            title="Subir archivo m4a, mp3, wav"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span>Subir Audio</span>
          </button>

          {/* Quick Demo Sample Audio */}
          <button
            type="button"
            onClick={handleLoadDemoAudio}
            className="px-2.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-amber-400 border border-slate-800 rounded-xl text-xs font-semibold transition"
            title="Cargar audio dictado de ejemplo"
          >
            <span>Ejemplo</span>
          </button>
        </div>

      </div>

      {/* Transcript Preview & Edit Area */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Edit3 className="w-3 h-3 text-amber-400" />
            <span>Transcripción Literal del Audio (Editable)</span>
          </span>

          {transcript && (
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="text-amber-400 hover:text-amber-300 font-semibold"
            >
              {isEditing ? 'Fijar Texto' : 'Modificar Términos'}
            </button>
          )}
        </div>

        <div className="relative">
          <textarea
            rows="3"
            value={transcript}
            onChange={handleTextChange}
            placeholder={placeholder}
            className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500/60 rounded-xl p-3 text-xs text-white placeholder-slate-500 leading-relaxed focus:outline-none transition font-sans"
          ></textarea>

          {isTranscribing && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-amber-400">
              <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
              <span>Transcribiendo audio con Inteligencia Artificial...</span>
            </div>
          )}
        </div>

        {transcript && (
          <p className="text-[11px] text-slate-400 italic">
            ✓ Texto listo. Puedes retocar mediciones o nombres antes de pulsar "Transformar con IA".
          </p>
        )}
      </div>

    </div>
  );
}
