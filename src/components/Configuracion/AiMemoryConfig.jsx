import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  getAiMemory,
  addAiInstruction,
  updateAiInstruction,
  deleteAiInstruction,
  deleteAiCorrection
} from '../../services/backendAiService';
import { Brain, Plus, Trash2, RefreshCw, AlertCircle, History, ToggleLeft, ToggleRight } from 'lucide-react';

const SCOPES = [
  { id: 'all', label: 'Todo (textos y presupuestos)' },
  { id: 'texto', label: 'Solo mejora de textos' },
  { id: 'presupuesto', label: 'Solo presupuestos' }
];

const scopeLabel = (id) => SCOPES.find((s) => s.id === id)?.label || id;

export default function AiMemoryConfig() {
  const { showNotification } = useApp();
  const [instructions, setInstructions] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [scope, setScope] = useState('all');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAiMemory();
      setInstructions(data.instructions || []);
      setCorrections(data.corrections || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    try {
      const { instruction } = await addAiInstruction({ title, content, scope });
      setInstructions((prev) => [...prev, instruction]);
      setTitle('');
      setContent('');
      showNotification('Instrucción guardada. La IA la aplicará desde ahora en cada petición.');
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item) => {
    try {
      const { instruction } = await updateAiInstruction(item.id, { isActive: !item.is_active });
      setInstructions((prev) => prev.map((i) => (i.id === item.id ? instruction : i)));
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleDelete = async (item) => {
    try {
      await deleteAiInstruction(item.id);
      setInstructions((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteCorrection = async (item) => {
    try {
      await deleteAiCorrection(item.id);
      setCorrections((prev) => prev.filter((c) => c.id !== item.id));
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-2">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
          <Brain className="w-5 h-5" />
          <span>Memoria de la IA</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-400">
          Lo que escribas aquí se añade automáticamente a cada petición a la IA (Gemini, Claude u OpenAI), así nunca pierde
          el contexto. Además, la IA recuerda tus correcciones: los textos que aceptas o descartas, los cambios que haces a mano en
          los presupuestos y las órdenes que le das.
        </p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Nueva instrucción */}
      <form onSubmit={handleAdd} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-3">
        <h3 className="text-sm font-bold text-white">Nueva instrucción permanente</h3>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Título corto (opcional), p. ej. Estilo de redacción"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          rows={4}
          required
          placeholder="Ej.: Redacta siempre en tercera persona. Los baños llevan siempre demolición, fontanería y alicatado en partidas separadas. Margen mínimo del 25%."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition"
        />
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 transition"
          >
            {SCOPES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={saving || !content.trim()}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{saving ? 'Guardando...' : 'Añadir instrucción'}</span>
          </button>
        </div>
      </form>

      {/* Lista de instrucciones */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Instrucciones activas ({instructions.filter((i) => i.is_active).length})</h3>
          <button
            type="button"
            onClick={load}
            className="text-slate-400 hover:text-amber-400 transition p-1"
            title="Recargar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {!loading && instructions.length === 0 && (
          <p className="text-xs text-slate-500">Todavía no hay instrucciones. Añade la primera arriba.</p>
        )}
        {instructions.map((item) => (
          <div
            key={item.id}
            className={`border rounded-xl p-3 flex gap-3 items-start transition ${
              item.is_active ? 'border-slate-700 bg-slate-950/60' : 'border-slate-800 bg-slate-950/30 opacity-60'
            }`}
          >
            <button type="button" onClick={() => handleToggle(item)} className="text-amber-400 shrink-0 mt-0.5" title="Activar / desactivar">
              {item.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6 text-slate-500" />}
            </button>
            <div className="min-w-0 flex-1">
              {item.title && <div className="text-xs font-bold text-white">{item.title}</div>}
              <p className="text-xs text-slate-300 whitespace-pre-wrap break-words">{item.content}</p>
              <span className="text-[10px] text-slate-500">{scopeLabel(item.scope)}</span>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(item)}
              className="text-slate-500 hover:text-rose-400 transition p-1 shrink-0"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Correcciones aprendidas */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <History className="w-4 h-4 text-amber-400" />
          <span>Lo que la IA ha aprendido de ti ({corrections.length})</span>
        </div>
        {!loading && corrections.length === 0 && (
          <p className="text-xs text-slate-500">
            Aún no hay correcciones. Se guardan solas al aceptar o descartar una mejora de texto, editar un presupuesto o darle una orden.
          </p>
        )}
        {corrections.slice(0, 30).map((c) => (
          <div key={c.id} className="border border-slate-800 rounded-xl p-3 bg-slate-950/40 text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wide text-amber-400 font-bold">
                {c.kind === 'presupuesto' ? 'Presupuesto' : 'Texto'}
                {c.accepted === true ? ' · aceptado' : c.accepted === false ? ' · descartado' : ''}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteCorrection(c)}
                className="text-slate-500 hover:text-rose-400 transition"
                title="Olvidar esta corrección"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {c.context && <div className="text-slate-400">{c.context}</div>}
            {c.note && <div className="text-slate-300">{c.note}</div>}
            {c.ai_output && <div className="text-slate-400 line-clamp-2">IA: {c.ai_output}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
