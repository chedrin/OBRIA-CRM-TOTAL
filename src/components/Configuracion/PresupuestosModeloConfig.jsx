import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Eye,
  Download,
  Info,
  Layers,
  Check,
  RefreshCw,
  Plus,
  BookOpen,
  X,
  FileCheck2,
  FileUp
} from 'lucide-react';
import confetti from 'canvas-confetti';

const TIPOS_OBRA_PRESETS = [
  'Reforma Integral Vivienda',
  'Reforma de Baño / Cocina',
  'Pintura y Alisado de Gotelé',
  'Instalación Eléctrica / Clima',
  'Albañilería y Falsos Techos',
  'Obra Nueva / Estructura',
  'Rehabilitación de Fachada'
];

export default function PresupuestosModeloConfig() {
  const {
    referenceBudgets,
    addReferenceBudget,
    toggleReferenceBudget,
    deleteReferenceBudget,
    updateReferenceBudgetText,
    showNotification
  } = useApp();

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewBudget, setPreviewBudget] = useState(null);
  const [editText, setEditText] = useState('');
  const [isEditingText, setIsEditingText] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [stagedFile, setStagedFile] = useState(null);
  const [customTitle, setCustomTitle] = useState('');
  const [selectedTipoObra, setSelectedTipoObra] = useState(TIPOS_OBRA_PRESETS[0]);

  const fileInputRef = useRef(null);

  const activeCount = (referenceBudgets || []).filter(b => b.is_active).length;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelected(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelected(files[0]);
    }
    e.target.value = '';
  };

  const handleFileSelected = (file) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      showNotification('Solo se admiten documentos en formato PDF (.pdf)', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showNotification('El archivo supera el límite de 10 MB. Sube un PDF optimizado.', 'error');
      return;
    }
    setStagedFile(file);
    setCustomTitle(file.name.replace(/\.[^/.]+$/, ''));
    setShowUploadModal(true);
  };

  const handleConfirmUpload = async (e) => {
    e.preventDefault();
    if (!stagedFile) return;

    setIsUploading(true);
    const res = await addReferenceBudget(stagedFile, customTitle, selectedTipoObra);
    setIsUploading(false);

    if (res.success) {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      setShowUploadModal(false);
      setStagedFile(null);
    }
  };

  const handleOpenPreview = (budget) => {
    setPreviewBudget(budget);
    setEditText(budget.extracted_text || '');
    setIsEditingText(false);
  };

  const handleSaveEditedText = () => {
    if (!previewBudget) return;
    updateReferenceBudgetText(previewBudget.id, editText);
    setPreviewBudget(prev => ({ ...prev, extracted_text: editText }));
    setIsEditingText(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/30 p-5 sm:p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 font-black text-xs">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Entrenamiento Contextual · Few-Shot RAG
            </span>
          </div>
          <h2 className="text-xl font-black text-white">Presupuestos de Referencia de la Empresa</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
            Sube presupuestos anteriores en formato PDF para que Google Gemini aprenda la redacción técnica formal,
            estructura canónica de capítulos y criterios de descomposición propios de tu constructora.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-2xl text-center">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Documentos Activos</span>
            <span className="text-lg font-black text-emerald-400">{activeCount} / {referenceBudgets.length}</span>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-95"
          >
            <Upload className="w-4 h-4 stroke-[2.5]" />
            <span>Subir PDF Modelo</span>
          </button>
        </div>
      </div>

      {/* Drag & Drop Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center transition cursor-pointer relative group ${
          isDragging
            ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/40'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept="application/pdf,.pdf"
          className="hidden"
        />

        <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto mb-3.5 group-hover:scale-110 transition">
          <FileUp className="w-7 h-7" />
        </div>

        <h3 className="font-extrabold text-white text-sm sm:text-base mb-1">
          Arrastra y suelta tus presupuestos históricos en PDF aquí
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          O haz clic para explorar en tu equipo. Se extraerán automáticamente los pliegos técnicos, unidades (m², ml, ud, pa) y capítulos.
        </p>

        <div className="flex items-center justify-center gap-3 mt-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Formato PDF (.pdf)</span>
          </span>
          <span>·</span>
          <span>Máximo 10 MB por archivo</span>
          <span>·</span>
          <span className="text-amber-400 font-semibold">Gemini 1.5 Pro Ready</span>
        </div>
      </div>

      {/* Reference Budgets Table / Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-lg">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <h3 className="font-extrabold text-white text-sm sm:text-base">
              Catálogo de Presupuestos Modelo Disponibles ({referenceBudgets.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Los marcados como <strong className="text-emerald-400">Activo</strong> se inyectan en el prompt de la IA.
          </span>
        </div>

        {referenceBudgets.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No hay presupuestos modelo cargados. Arrastra un archivo PDF arriba para comenzar.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {referenceBudgets.map((budget) => {
              const sizeKb = budget.file_size ? (budget.file_size / 1024).toFixed(0) : '250';
              return (
                <div
                  key={budget.id}
                  className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                    budget.is_active ? 'bg-slate-900/80' : 'bg-slate-950/40 opacity-70'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-white text-xs sm:text-sm truncate">
                          {budget.name}
                        </h4>
                        <span className="bg-slate-800 border border-slate-700 text-indigo-300 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                          {budget.tipo_obra || 'Reforma'}
                        </span>
                        {budget.is_active ? (
                          <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>Activo en IA</span>
                          </span>
                        ) : (
                          <span className="bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-medium">
                            Pausado
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span>Tamaño: <strong className="text-slate-300">{sizeKb} KB</strong></span>
                        <span>·</span>
                        <span>Subido: {budget.created_at || 'Reciente'}</span>
                        <span>·</span>
                        <span className="text-amber-400/80 font-mono">
                          {budget.extracted_text?.length || 0} caracteres extraídos
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Toggle */}
                  <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                    
                    {/* Active/Inactive Toggle Button */}
                    <button
                      type="button"
                      onClick={() => toggleReferenceBudget(budget.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                        budget.is_active
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                      title={budget.is_active ? 'Desactivar de la IA' : 'Activar como referencia para la IA'}
                    >
                      <span className={`w-2 h-2 rounded-full ${budget.is_active ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                      <span>{budget.is_active ? 'Referencia Activa' : 'Activar'}</span>
                    </button>

                    {/* Preview / Inspect Extracted Text */}
                    <button
                      type="button"
                      onClick={() => handleOpenPreview(budget)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs transition"
                      title="Ver pliego y partidas extraídas"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Delete Budget */}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`¿Eliminar el presupuesto modelo "${budget.name}"?`)) {
                          deleteReferenceBudget(budget.id);
                        }
                      }}
                      className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs transition"
                      title="Eliminar presupuesto de referencia"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Architectural Best Practices Card */}
      <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-2 text-xs">
        <div className="flex items-center gap-2 text-amber-400 font-bold">
          <Info className="w-4 h-4" />
          <span>Recomendaciones del Arquitecto Técnico para el Entrenamiento RAG</span>
        </div>
        <ul className="text-slate-400 space-y-1.5 list-disc list-inside leading-relaxed pl-1">
          <li><strong>Menos es más:</strong> Mantén activos entre <strong>3 y 6 presupuestos modelo</strong> de alta calidad (ejemplo: uno de reforma integral, uno de baños y uno de pintura/pladur). Subir demasiados PDFs con estilos dispares genera ambigüedad.</li>
          <li><strong>Temperatura óptima (0.1 a 0.2):</strong> El motor de presupuestos de ObraMaster opera con baja temperatura para garantizar rigor matemático y pliegos contractuales sin invenciones.</li>
          <li><strong>Estructura canónica:</strong> La IA respetará la jerarquía de capítulos (01. Demoliciones, 02. Albañilería, etc.) y unidades universales (m², ml, ud, pa) aprendida de estos documentos.</li>
        </ul>
      </div>

      {/* Modal Confirm Upload */}
      {showUploadModal && stagedFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <span>Registrar Presupuesto Modelo</span>
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmUpload} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Nombre Descriptivo del Documento:</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400 font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Tipo o Especialidad de la Obra:</label>
                <select
                  value={selectedTipoObra}
                  onChange={(e) => setSelectedTipoObra(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400 font-medium"
                >
                  {TIPOS_OBRA_PRESETS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Archivo:</span>
                  <span className="text-white font-mono">{stagedFile.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tamaño:</span>
                  <span className="text-white font-mono">{(stagedFile.size / 1024).toFixed(1)} KB</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={isUploading}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-amber-500 hover:from-indigo-400 hover:to-amber-400 text-slate-950 font-black rounded-xl shadow-lg flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Extrayendo Texto...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Guardar y Activar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview / Inspect Extracted Text */}
      {previewBudget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm sm:text-base">{previewBudget.name}</h3>
                  <span className="text-[11px] text-slate-400">{previewBudget.tipo_obra} · Extracción de Pliegos RAG</span>
                </div>
              </div>

              <button onClick={() => setPreviewBudget(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span>Texto extraído que la IA leerá como ejemplo de estilo y descomposición:</span>
              <button
                type="button"
                onClick={() => setIsEditingText(!isEditingText)}
                className="text-amber-400 hover:text-amber-300 font-bold"
              >
                {isEditingText ? 'Cancelar Edición' : 'Editar Texto Manualmente'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
              {isEditingText ? (
                <textarea
                  rows="14"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full h-full bg-transparent border-0 text-white focus:outline-none resize-none font-mono"
                ></textarea>
              ) : (
                previewBudget.extracted_text || 'No se extrajo texto del documento.'
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-800 shrink-0 text-xs">
              <span className="text-slate-500 text-[11px]">
                {previewBudget.extracted_text?.length || 0} caracteres analizados
              </span>

              <div className="flex gap-2">
                {isEditingText && (
                  <button
                    type="button"
                    onClick={handleSaveEditedText}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
                  >
                    Guardar Cambios
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewBudget(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 font-bold"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
