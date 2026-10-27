import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import useNotify from './useNotify';
import { api, fmtDateTime, btnGhost } from '../../services/avisosApi';

// Partes recibidos por el enlace de las subcontratas ("trabajo terminado"), para revisarlos.
export default function PartesPanel({ focusId }) {
  const showNotification = useNotify();
  const [reports, setReports] = useState(null);

  useEffect(() => {
    api('/api/site-reports').then(setReports).catch((e) => { setReports([]); showNotification(e.message, 'error'); });
  }, [showNotification]);

  const review = async (id, review_result) => {
    try {
      const updated = await api(`/api/site-reports/${id}`, { method: 'PATCH', body: { review_result } });
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated, photo_urls: r.photo_urls } : r)));
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  if (!reports) return <div className="py-10 flex justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (reports.length === 0) return <p className="text-center py-10 text-sm text-slate-500">Aún no hay partes de subcontratas.</p>;

  return (
    <ul className="space-y-3">
      {reports.map((r) => (
        <li key={r.id} className={`bg-slate-900 border rounded-2xl p-4 space-y-2 ${r.id === focusId ? 'border-amber-500' : 'border-slate-800'}`}>
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-white">{r.subcontractor_name}: trabajo terminado</p>
              <p className="text-xs text-slate-400">{[r.obra_label, r.task_label].filter(Boolean).join(' · ')}</p>
              <p className="text-[11px] text-slate-500">{fmtDateTime(r.created_at)}</p>
            </div>
            {r.review_result ? (
              <span className={`text-xs font-bold ${r.review_result === 'aprobado' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {r.review_result === 'aprobado' ? 'Revisado: correcto' : 'Revisado: con pegas'}
              </span>
            ) : (
              <span className="flex gap-2">
                <button onClick={() => review(r.id, 'aprobado')} className={btnGhost}><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Correcto</button>
                <button onClick={() => review(r.id, 'rechazado')} className={btnGhost}><XCircle className="w-4 h-4 text-rose-400" /> Con pegas</button>
              </span>
            )}
          </div>
          {r.notes && <p className="text-sm text-slate-300 whitespace-pre-line">{r.notes}</p>}
          {r.photo_urls?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {r.photo_urls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Foto del remate" className="w-28 h-28 object-cover rounded-xl border border-slate-700" /></a>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
