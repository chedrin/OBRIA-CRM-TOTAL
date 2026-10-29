import React, { useState } from 'react';
import BotonVolver from '../Common/BotonVolver';
import BarraProgreso from '../Common/BarraProgreso';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  Camera,
  Mic,
  Upload,
  CheckCircle2,
  Trash2,
  FileText,
  Building2,
  RefreshCw,
  Edit3,
  Music,
  Check,
  BookOpen,
  X
} from 'lucide-react';
import PresupuestosModeloConfig from '../Configuracion/PresupuestosModeloConfig';
import confetti from 'canvas-confetti';
import { processScopeWithAI } from '../../services/aiAudioTextService';
import { transcribeAudio } from '../../services/aiAudioTextService';
import AiImprovementControl from '../Common/AiImprovementControl';

export default function PresupuestoGeneratorAI({ onCancel, onCreated }) {
  const {
    addPresupuesto,
    showNotification,
    empresaConfig,
    basePrecios,
    referenceBudgets
  } = useApp();

  // Audio Files & Transcription
  const [audioFiles, setAudioFiles] = useState([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioTranscript, setAudioTranscript] = useState('');
  const [hasTranscribed, setHasTranscribed] = useState(false);

  // Photos & Project Data
  const [customPhotos, setCustomPhotos] = useState([]);
  const [obraTitulo, setObraTitulo] = useState('Reforma Integral de Inmueble');
  const [clienteNombre, setClienteNombre] = useState('Cliente Particular');
  const [clienteNif, setClienteNif] = useState('12345678Z');
  const [clienteDireccion, setClienteDireccion] = useState('Ubicación de Obra');
  const [margenGlobal, setMargenGlobal] = useState(30);
  const [tipoIva, setTipoIva] = useState(10);

  // Model References Tab State
  const [showReferenceModal, setShowReferenceModal] = useState(false);

  // AI Progress & Generation State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [partidasList, setPartidasList] = useState([]);
  const [generatedResult, setGeneratedResult] = useState(null);

  // Handle Audio Uploads
  const handleAudioUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setAudioFiles(prev => [...prev, ...files]);
    setIsTranscribing(true);
    setProgressStatus('Subiendo archivo de audio...');
    setProgressPct(20);

    try {
      setProgressStatus('Transcribiendo audio con Inteligencia Artificial...');
      setProgressPct(60);

      const transcribedTexts = [];
      for (const file of files) {
        const res = await transcribeAudio(file, empresaConfig?.aiConfig || {});
        if (res && res.text) {
          transcribedTexts.push(res.text);
        }
      }
      const text = transcribedTexts.join('\n\n');

      setAudioTranscript(prev => (prev ? `${prev}\n\n${text}` : text));
      setHasTranscribed(true);
      setProgressPct(100);
      showNotification(`Audio transcrito exitosamente (${files.length} archivo/s)`);
      confetti({ particleCount: 25, spread: 40 });
    } catch (err) {
      showNotification(`Error al transcribir audio: ${err.message}`, 'error');
    } finally {
      setIsTranscribing(false);
      setProgressStatus('');
      setProgressPct(0);
    }
  };

  // Handle Photo Uploads
  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCustomPhotos(prev => [...prev, {
          id: `usr-img-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          title: file.name,
          url: event.target.result,
          file: file,
          descripcion: `Foto de obra (${(file.size / 1024).toFixed(0)} KB)`
        }]);
      };
      reader.readAsDataURL(file);
    });
    if (files.length > 0) {
      showNotification(`📸 ${files.length} foto(s) de obra añadida(s).`);
    }
  };

  const handleDeleteCustomPhoto = (id, e) => {
    if (e) e.stopPropagation();
    setCustomPhotos(prev => prev.filter(p => p.id !== id));
    showNotification('Foto eliminada.');
  };

  // Run AI Budget Generation
  const handleRunAiAnalysis = async () => {
    if (!audioTranscript.trim() && customPhotos.length === 0) {
      showNotification('Por favor, sube un audio o añade descripción de la obra antes de generar.', 'error');
      return;
    }

    setIsAnalyzing(true);
    setProgressStatus('Subiendo y procesando datos de obra...');
    setProgressPct(25);

    setTimeout(() => {
      setProgressStatus('Analizando fotografías y cotas de espacio...');
      setProgressPct(50);
    }, 800);

    setTimeout(() => {
      setProgressStatus('Consultando base de precios oficial y generando presupuesto...');
      setProgressPct(80);
    }, 1600);

    try {
      const combinedInput = [
        audioTranscript ? `[TRANSCRIPCIÓN DE AUDIO VERIFICADA]:\n${audioTranscript}` : '',
        customPhotos.length > 0 ? `[FOTOGRAFÍAS REALES ADJUNTAS (${customPhotos.length})]` : ''
      ].filter(Boolean).join('\n\n');

      const aiResult = await processScopeWithAI(
        combinedInput,
        'presupuesto_obra',
        null,
        empresaConfig?.aiConfig || {},
        basePrecios,
        referenceBudgets,
        customPhotos
      );

      setProgressPct(100);

      const generatedItems = [];
      (aiResult.capitulos || []).forEach(cap => {
        (cap.partidas || []).forEach(part => {
          const med = Number(part.medicion || part.cantidad || 1);
          const pvp = Number(part.precioVenta || part.precio_unitario_estimado || part.precioUnitario || 25);
          const coste = Number(part.costeUnitario || Number((pvp * 0.7).toFixed(2)));
          const pvpWithMargin = Number((coste * (1 + margenGlobal / 100)).toFixed(2));
          const tot = Number((pvpWithMargin * med).toFixed(2));

          generatedItems.push({
            id: part.id || `gen-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            codigo: part.codigo || 'GEN-01',
            capitulo: cap.nombre_capitulo || cap.nombre || 'General',
            concepto: part.concepto || part.titulo || part.descripcion,
            cantidad: med,
            unidad: part.unidad || 'ud',
            costeUnitario: coste,
            margenPct: margenGlobal,
            precioVenta: pvpWithMargin,
            total: tot
          });
        });
      });

      setPartidasList(generatedItems);
      setGeneratedResult({
        audio: audioTranscript,
        photosCount: customPhotos.length,
        resumen: aiResult.resumen_alcance || aiResult.resumen_obra,
        mediciones: {
          partidasGeneradas: generatedItems.length,
          fotosAnalizadas: customPhotos.length,
          margenAplicado: `${margenGlobal}%`
        }
      });

      confetti({ particleCount: 50, spread: 60 });
      showNotification('Presupuesto técnico generado exitosamente por la IA');
    } catch (err) {
      console.error('Error generando presupuesto IA:', err);
      showNotification(`Error de IA: ${err.message}`, 'error');
    } finally {
      setIsAnalyzing(false);
      setProgressStatus('');
      setProgressPct(0);
    }
  };

  const handleUpdatePartidaCantidad = (id, newCant) => {
    const cantNum = Math.max(0.1, Number(newCant) || 1);
    setPartidasList(prev => prev.map(p => {
      if (p.id === id) {
        const newTotal = Number((p.precioVenta * cantNum).toFixed(2));
        return { ...p, cantidad: cantNum, total: newTotal };
      }
      return p;
    }));
  };

  const handleDeletePartida = (id) => {
    setPartidasList(prev => prev.filter(p => p.id !== id));
  };

  const baseImponible = Number(partidasList.reduce((s, p) => s + p.total, 0).toFixed(2));
  const cuotaIva = Number((baseImponible * (tipoIva / 100)).toFixed(2));
  const totalPresupuesto = Number((baseImponible + cuotaIva).toFixed(2));
  const costeTotalDirecto = Number(partidasList.reduce((s, p) => s + (p.costeUnitario * p.cantidad), 0).toFixed(2));
  const beneficioBruto = Number((baseImponible - costeTotalDirecto).toFixed(2));

  const handleSavePresupuestoBorrador = () => {
    const newPres = addPresupuesto({
      obraTitulo,
      cliente: clienteNombre,
      nif: clienteNif,
      direccion: clienteDireccion,
      tipoIvaPct: tipoIva,
      margenGlobalPct: margenGlobal,
      partidas: partidasList,
      baseImponible,
      cuotaIva,
      totalConIva: totalPresupuesto,
      estado: 'borrador',
      notasLegales: 'Presupuesto técnico generado mediante IA. Forma de pago: 40% a la firma, 40% avance de obra, 20% liquidación.'
    });

    confetti({ particleCount: 60, spread: 60 });
    showNotification(`Presupuesto ${newPres.numero} guardado correctamente`);
    if (onCreated) onCreated();
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>Módulo de Presupuestos IA de Producción</span>
          </div>
          <h1 className="text-2xl font-black text-white">Transcribir Audios y Generar Presupuesto Real</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Sube los audios dictados in situ (mp3, wav, m4a, webm, ogg). La IA transcribirá el contenido, te permitirá revisarlo y generará las partidas técnicas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReferenceModal(true)}
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3.5 py-2 rounded-xl transition font-bold"
          >
            <BookOpen className="w-4 h-4" />
            <span>Presupuestos Modelo ({referenceBudgets?.filter(b => b.is_active).length || 0} activos)</span>
          </button>
          <BotonVolver onClick={onCancel}>Volver a Presupuestos</BotonVolver>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: AUDIO UPLOAD, TRANSCRIPTION & INPUTS */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* 1. Subida de Audios de Obra */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Mic className="w-4 h-4 text-amber-400" />
                <span>1. Audios de Dictado de Obra</span>
              </h3>
              <span className="text-[11px] text-amber-400/90 font-bold">
                {audioFiles.length} archivo/s
              </span>
            </div>

            <label className="flex flex-col items-center justify-center p-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-dashed border-amber-500/40 rounded-xl cursor-pointer transition text-xs font-bold text-center space-y-1">
              <Music className="w-6 h-6" />
              <span>Subir Archivos de Audio (mp3, wav, m4a, webm, ogg)</span>
              <span className="text-[10px] text-slate-400 font-normal">Sube una o varias grabaciones dictadas en la visita</span>
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                multiple
                onChange={handleAudioUpload}
                className="hidden"
              />
            </label>

            {/* Loading / Transcribing Progress Bar */}
            {isTranscribing && (
              <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{progressStatus}</span>
                  </span>
                  <span>{progressPct}%</span>
                </div>
                <BarraProgreso valor={progressPct} alto="h-4" color="bg-amber-500" />
              </div>
            )}
          </div>

          {/* 2. Texto Transcrito (Editable por el Usuario) */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>2. Texto Transcrito (Verificar / Editar)</span>
              </h3>
              {hasTranscribed && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Transcrito con IA
                </span>
              )}
            </div>

            <textarea
              rows="5"
              value={audioTranscript}
              onChange={(e) => setAudioTranscript(e.target.value)}
              placeholder="El texto transcrito de tus audios aparecerá aquí automáticamente. Puedes editarlo o modificarlo antes de generar el presupuesto."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400 leading-relaxed font-sans"
            ></textarea>

            <AiImprovementControl
              value={audioTranscript}
              onAccept={(improved) => setAudioTranscript(improved)}
              context="Alcance y descripción técnica de la reforma"
              buttonLabel="Mejorar Texto con IA"
            />
          </div>

          {/* 3. Fotos de la Obra */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>3. Fotografías de la Obra</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-bold">
                {customPhotos.length} foto/s
              </span>
            </div>

            <label className="flex items-center justify-center gap-2 p-3 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl cursor-pointer transition text-xs font-bold">
              <Upload className="w-4 h-4 text-amber-400" />
              <span>Añadir Fotografías de Inspección</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>

            {customPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {customPhotos.map((item) => (
                  <div key={item.id} className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 relative group">
                    <img src={item.url} alt={item.title} className="w-full h-20 object-cover" />
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCustomPhoto(item.id, e)}
                      className="absolute top-1 right-1 w-5 h-5 rounded bg-rose-600/90 text-white flex items-center justify-center opacity-90 hover:opacity-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Datos del Proyecto y Margen */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-sm">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <span>4. Datos de la Obra</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Título de la Reforma</label>
                <input
                  type="text"
                  value={obraTitulo}
                  onChange={(e) => setObraTitulo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Cliente</label>
                  <input
                    type="text"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">NIF/CIF</label>
                  <input
                    type="text"
                    value={clienteNif}
                    onChange={(e) => setClienteNif(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Dirección</label>
                <input
                  type="text"
                  value={clienteDireccion}
                  onChange={(e) => setClienteDireccion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-slate-400 block mb-1 flex items-center justify-between">
                    <span>Margen Comercial</span>
                    <strong className="text-amber-400">{margenGlobal}%</strong>
                  </label>
                  <input
                    type="range"
                    min="15"
                    max="50"
                    step="1"
                    value={margenGlobal}
                    onChange={(e) => setMargenGlobal(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Tipo de IVA</label>
                  <select
                    value={tipoIva}
                    onChange={(e) => setTipoIva(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"
                  >
                    <option value={10}>10% (Vivienda Habitual)</option>
                    <option value={21}>21% (Local Comercial / Empresa)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleRunAiAnalysis}
              disabled={isAnalyzing}
              className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition shadow-lg ${
                isAnalyzing
                  ? 'bg-amber-500/50 text-slate-950 cursor-wait'
                  : 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-amber-500/25 active:scale-95'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Procesando Presupuesto...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 stroke-[2.5]" />
                  <span>Generar Presupuesto Técnico</span>
                </>
              )}
            </button>

            {/* General Processing Bar */}
            {isAnalyzing && (
              <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                  <span>{progressStatus}</span>
                  <span>{progressPct}%</span>
                </div>
                <BarraProgreso valor={progressPct} alto="h-4" color="bg-amber-500" />
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: GENERATED PARTIDAS & RESULTS */}
        <div className="lg:col-span-7 space-y-5">
          
          {generatedResult && (
            <div className="space-y-4 animate-in fade-in">
              
              <div className="bg-slate-900 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  <div>
                    <h4 className="font-bold text-white text-sm">Presupuesto Técnico Generado</h4>
                    <p className="text-xs text-slate-400">{generatedResult.resumen}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold">
                  {partidasList.length} Partidas
                </span>
              </div>

              {/* Partidas Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold text-white text-sm">Partidas Calculadas</h3>
                  <span className="text-[11px] text-slate-400">Edita cantidades antes de guardar</span>
                </div>

                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Cód. / Capítulo</th>
                        <th className="py-2.5 px-3">Concepto</th>
                        <th className="py-2.5 px-3 text-center">Cant.</th>
                        <th className="py-2.5 px-3 text-right">Coste</th>
                        <th className="py-2.5 px-3 text-right">PVP Ud.</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-2 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {partidasList.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="font-mono text-amber-400 block font-bold text-[10px]">{p.codigo}</span>
                            <span className="text-slate-500 text-[10px]">{p.capitulo}</span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-medium text-white">{p.concepto}</span>
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0.1"
                                step="0.5"
                                value={p.cantidad}
                                onChange={(e) => handleUpdatePartidaCantidad(p.id, e.target.value)}
                                className="w-16 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs text-white font-mono"
                              />
                              <span className="text-[10px] text-slate-400">{p.unidad}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-400 whitespace-nowrap">
                            {p.costeUnitario.toFixed(2)} €
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                            {p.precioVenta.toFixed(2)} €
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-white whitespace-nowrap">
                            {p.total.toFixed(2)} €
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              onClick={() => handleDeletePartida(p.id)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals & Save */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Coste Directo</span>
                    <span className="text-sm font-bold text-slate-300">{costeTotalDirecto.toLocaleString('es-ES')} €</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Beneficio ({margenGlobal}%)</span>
                    <span className="text-sm font-bold text-emerald-400">+{beneficioBruto.toLocaleString('es-ES')} €</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Base Imponible</span>
                    <span className="text-sm font-bold text-white">{baseImponible.toLocaleString('es-ES')} €</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-amber-500/40">
                    <span className="text-[10px] text-amber-400 uppercase font-semibold block">Total con IVA ({tipoIva}%)</span>
                    <span className="text-base font-black text-amber-400">{totalPresupuesto.toLocaleString('es-ES')} €</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    onClick={onCancel}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSavePresupuestoBorrador}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95"
                  >
                    <FileText className="w-4 h-4 stroke-[2.5]" />
                    <span>Guardar Presupuesto</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {!generatedResult && !isAnalyzing && (
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Listo para Generar Presupuesto</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Sube las grabaciones de audio a la izquierda. La IA transcribirá las notas de voz y calculará las partidas técnicas.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* Modal Presupuestos Modelo / RAG Reference Training */}
      {showReferenceModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-white text-base">Presupuestos de Referencia para Aprendizaje de la IA</h3>
              </div>
              <button onClick={() => setShowReferenceModal(false)} aria-label="Cerrar" className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <PresupuestosModeloConfig />

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowReferenceModal(false)}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition"
              >
                Aplicar y Volver al Generador
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
