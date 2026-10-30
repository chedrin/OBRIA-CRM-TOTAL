import React, { useCallback, useEffect, useState } from 'react';
import { ListChecks, Loader2, X } from 'lucide-react';
import ReporteAvanceSheet, { PartidaCard } from '../Avance/ReporteAvanceSheet';
import ModalOverlay from '../Common/ModalOverlay';
import { AnimatePresence } from 'motion/react';

/**
 * "Mis tajos / partidas de hoy" del Portal del Obrero: solo las fases y partidas
 * que el jefe de obra le ha asignado en la obra activa. El avance que manda queda
 * como "reportado" hasta que la oficina lo valida.
 *
 * `onAvailable(true)` avisa al portal de que el módulo está activo (tablas creadas
 * en Supabase), para que deje de usar el selector antiguo que escribía en la obra.
 */
export default function MisTajos({ obraId, obreroId, isAdmin = false, onAvailable = () => {} }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (isAdmin && obreroId) qs.set('obrero', obreroId);
      const res = await fetch(`/api/avance/mis-tajos?${qs}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'No se pudieron cargar tus partidas.');
      setData(body);
      setError('');
      onAvailable(true);
    } catch (e) {
      setError(e.message);
      setData({ obras: [] });
      onAvailable(false);
    }
  }, [isAdmin, obreroId, onAvailable]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <div className="flex justify-center py-4 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const obras = Array.isArray(data.obras) ? data.obras : [];
  const obra = obras.find((o) => o.obraId === obraId);
  const partidas = obra ? (obra.fases || []).flatMap((f) => f.partidas || []) : [];
  const otras = obras.filter((o) => o.obraId !== obraId);

  const submit = async (form) => {
    form.append('obra_id', obra.obraId);
    const res = await fetch('/api/avance/report', { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'No se pudo enviar. Inténtalo otra vez.');
    setOpen(null);
    setSaved(body.progreso?.ready_for_certification ? 'Enviada como lista para certificar.' : 'Avance enviado a la oficina.');
    setTimeout(() => setSaved(''), 4000);
    load();
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white flex items-center gap-1.5">
          <ListChecks className="w-4 h-4 text-amber-400" />
          <span>Mis tajos / partidas de hoy</span>
        </span>
        {partidas.length > 0 && <span className="text-xs text-slate-400">Pulsa una para reportar</span>}
      </div>

      {saved && <p className="text-xs font-bold text-emerald-400">{saved}</p>}
      {error && <p className="text-xs text-slate-500">{error}</p>}

      {!error && partidas.length === 0 && (
        <p className="text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-xl p-3">
          No tienes partidas asignadas en esta obra.
          {otras.length > 0 && ` Tienes trabajo en: ${otras.map((o) => o.obra).join(', ')}.`}
        </p>
      )}

      <div className="space-y-2.5 text-slate-100">
        {partidas.map((p) => (
          <PartidaCard key={`${p.faseId}::${p.id}`} partida={p} onOpen={setOpen} />
        ))}
      </div>

      <AnimatePresence>
      {open && (
        <ModalOverlay className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto text-slate-100">
          <div className="max-w-md mx-auto px-4 py-6">
            <button type="button" onClick={() => setOpen(null)} className="absolute top-4 right-4 text-slate-400" aria-label="Cerrar">
              <X className="w-6 h-6" />
            </button>
            <ReporteAvanceSheet partida={open} onSubmit={submit} onClose={() => setOpen(null)} />
          </div>
        </ModalOverlay>
      )}
      </AnimatePresence>
    </div>
  );
}
