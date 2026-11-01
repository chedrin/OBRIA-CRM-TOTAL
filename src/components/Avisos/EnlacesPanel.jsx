import React, { useEffect, useMemo, useState } from 'react';
import { Link2, Loader2, Ban, Send, ChevronUp, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { OpcionesCrear, conCrear, useQuickCreate } from '../Common/QuickCreate';
import useNotify from './useNotify';
import EnlaceEnvio, { avisoReenvio } from './EnlaceEnvio';
import { api, fmtDate, fmtDateTime, inputCls, btnPrimary, btnGhost } from '../../services/avisosApi';

// Enlaces mágicos para subcontratas: se crean aquí y se mandan por WhatsApp con un toque.
// Se pueden volver a copiar y reenviar hasta que el trabajo esté certificado al 100 %.
export default function EnlacesPanel() {
  const { obras = [], subcontractors = [] } = useApp() || {};
  const showNotification = useNotify();
  const { crear } = useQuickCreate();
  const [form, setForm] = useState({ subcontractor_id: '', obra_id: '', task: '', phone: '', days: 60 });
  const [result, setResult] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null); // { id, link } del enlace que se está reenviando
  const [resending, setResending] = useState(null);

  useEffect(() => {
    api('/api/sub-tokens').then(setTokens).catch((e) => showNotification(e.message, 'error'));
  }, [showNotification]);

  const obra = obras.find((o) => o.id === form.obra_id);
  const tasks = useMemo(() => (obra?.fases || []).flatMap((f) => [
    { value: `fase:${f.id}`, label: f.nombre || f.capitulo },
    ...(f.tareas || []).map((t) => ({ value: `tarea:${t.id}`, label: `  · ${t.titulo}` }))
  ]), [obra]);
  const sub = subcontractors.find((s) => s.id === form.subcontractor_id);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const task = tasks.find((t) => t.value === form.task);
      const data = await api('/api/sub-tokens', {
        method: 'POST',
        body: {
          subcontractor_id: form.subcontractor_id,
          obra_id: form.obra_id || null,
          task_ref: form.task || null,
          task_label: task ? task.label.replace(/^\s*·\s*/, '') : null,
          phone: form.phone || sub?.telefono || '',
          days: form.days
        }
      });
      setResult(data);
      setTokens((prev) => [{ ...data, can_resend: true, same_link: true }, ...prev]);
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id) => {
    if (!window.confirm('¿Anular este enlace? La subcontrata ya no podrá usarlo.')) return;
    try {
      await api(`/api/sub-tokens/${id}/revoke`, { method: 'POST' });
      setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, revoked_at: new Date().toISOString(), can_resend: false } : t)));
      if (open?.id === id) setOpen(null);
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  const resend = async (t) => {
    if (open?.id === t.id) {
      setOpen(null);
      return;
    }
    if (!t.same_link && !window.confirm('Este enlace no se puede recuperar: se generará uno nuevo y el anterior dejará de funcionar. ¿Continuar?')) return;
    setResending(t.id);
    try {
      const link = await api(`/api/sub-tokens/${t.id}/resend`, { method: 'POST', body: { days: form.days } });
      setOpen({ id: t.id, link });
      setTokens((prev) => prev.map((x) => (x.id === t.id ? { ...x, expires_at: link.expires_at, same_link: true, work_pct: link.work_pct } : x)));
      const aviso = avisoReenvio(link);
      if (aviso) showNotification(aviso.text, aviso.type);
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setResending(null);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-white">Nuevo enlace para una subcontrata</h3>
        <p className="text-xs text-slate-400">Sin usuario ni contraseña: con el enlace pueden marcar el trabajo terminado o avisar de una necesidad, con fotos.</p>
        <div className="grid sm:grid-cols-2 gap-2">
          <select required value={form.subcontractor_id} onChange={conCrear(crear, (v) => setForm((f) => ({ ...f, subcontractor_id: v, phone: '' })))} className={inputCls}>
            <option value="">Subcontrata…</option>
            {subcontractors.map((s) => <option key={s.id} value={s.id}>{s.nombreComercial || s.razonSocial}</option>)}
            <OpcionesCrear tipos={['subcontrata']} />
          </select>
          <input value={form.phone || sub?.telefono || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Móvil para WhatsApp" className={inputCls} />
          <select value={form.obra_id} onChange={conCrear(crear, (v) => setForm((f) => ({ ...f, obra_id: v, task: '' })))} className={inputCls}>
            <option value="">Obra…</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{[o.codigo, o.titulo].filter(Boolean).join(' - ')}</option>)}
            <OpcionesCrear tipos={['obra']} />
          </select>
          <select value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} disabled={!tasks.length} className={inputCls}>
            <option value="">Fase o tarea (opcional)…</option>
            {tasks.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className="text-xs text-slate-400 flex items-center gap-2">
            Caduca en
            <input type="number" min={1} max={365} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} className={`${inputCls} !w-20`} />
            días
          </label>
        </div>
        <button type="submit" disabled={busy} className={btnPrimary}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Crear enlace</button>

        {result && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 space-y-2">
            <p className="text-xs text-emerald-400 font-bold">Enlace listo. Podrás volver a copiarlo o reenviarlo desde la lista hasta que el trabajo esté finalizado.</p>
            <EnlaceEnvio key={result.id} link={result} showMessage={false} />
          </div>
        )}
      </form>

      <div className="space-y-2">
        <h3 className="font-bold text-white text-sm">Enlaces creados</h3>
        {tokens.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay enlaces.</p>
        ) : (
          <ul className="space-y-2">
            {tokens.map((t) => {
              const expired = new Date(t.expires_at) < new Date();
              const state = t.revoked_at ? 'Anulado' : t.finished ? 'Finalizado' : expired ? 'Caducado' : 'Activo';
              const isOpen = open?.id === t.id;
              return (
                <li key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-3 justify-between">
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-white">{t.subcontractor_name}</span>
                      <span className="block text-xs text-slate-400">{[t.obra_label, t.task_label].filter(Boolean).join(' · ') || 'Sin obra'}</span>
                      <span className="block text-[11px] text-slate-500">
                        Caduca el {fmtDate(t.expires_at)} · {t.use_count ? `usado ${t.use_count} veces, último ${fmtDateTime(t.last_used_at)}` : 'sin usar'}
                        {t.work_pct != null && ` · certificado ${t.work_pct} %`}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`text-[11px] font-bold flex items-center gap-1 ${state === 'Activo' || state === 'Finalizado' ? 'text-emerald-400' : state === 'Caducado' ? 'text-amber-400' : 'text-slate-500'}`}>
                        {state === 'Finalizado' && <CheckCircle2 className="w-3.5 h-3.5" />}{state}
                      </span>
                      {t.can_resend && (
                        <button onClick={() => resend(t)} disabled={resending === t.id} className={`${btnGhost} !py-1 !text-xs`}>
                          {resending === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                          {isOpen ? 'Ocultar' : expired ? 'Reactivar y reenviar' : 'Copiar o reenviar'}
                        </button>
                      )}
                      {state === 'Activo' && (
                        <button onClick={() => revoke(t.id)} className="text-xs text-rose-400 flex items-center gap-1"><Ban className="w-3.5 h-3.5" /> Anular</button>
                      )}
                    </span>
                  </div>
                  {isOpen && <EnlaceEnvio link={open.link} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
