import React, { useMemo, useState } from 'react';
import { X, Loader2, FileText, Upload, Trash2, TrendingUp, TrendingDown, ExternalLink, Receipt } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, fmtDate, fmtMoney, inputCls, btnPrimary, btnGhost } from '../../services/avisosApi';
import useNotify from '../Avisos/useNotify';
import ModalOverlay from '../Common/ModalOverlay';

// Presupuesto y factura de la subcontrata de una fase o partida, con el beneficio
// o la pérdida frente a lo que cobramos al cliente (ver subcontractMargins en utils/avanceObra.js).

const KIND_LABEL = { presupuesto: 'Presupuesto', factura: 'Factura' };

/** Etiqueta compacta de beneficio (verde) o pérdida (rojo). */
export function MargenBadge({ m, className = '' }) {
  if (!m) return null;
  const up = m.beneficio >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const title = `Cobramos ${fmtMoney(m.ingreso)} · Coste ${fmtMoney(m.coste)} (${m.fuente === 'factura' ? 'factura' : m.fuente === 'mixto' ? 'facturas y presupuestos' : 'presupuesto'})`;
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${up ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'} ${className}`}>
      <Icon className="w-3 h-3" /> {up ? '+' : ''}{fmtMoney(m.beneficio)}{m.pct != null ? ` · ${String(m.pct).replace('.', ',')} %` : ''}
    </span>
  );
}

/** Resumen grande: cobramos, presupuesto, factura y beneficio. */
export function MargenResumen({ m, importe }) {
  if (!m) {
    return (
      <p className="text-xs text-slate-400">
        Cobramos al cliente <strong className="text-white">{fmtMoney(importe || 0)}</strong>. Sube el presupuesto o la factura de la subcontrata para ver el beneficio o la pérdida.
      </p>
    );
  }
  const up = m.beneficio >= 0;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
      <div className="rounded-xl bg-slate-950 border border-slate-800 p-2"><span className="block text-[10px] text-slate-400">Cobramos</span><span className="font-black text-white tabular-nums text-sm">{fmtMoney(m.ingreso)}</span></div>
      <div className="rounded-xl bg-slate-950 border border-slate-800 p-2"><span className="block text-[10px] text-slate-400">Su presupuesto</span><span className="font-black text-slate-200 tabular-nums text-sm">{m.presupuesto ? fmtMoney(m.presupuesto) : '—'}</span></div>
      <div className="rounded-xl bg-slate-950 border border-slate-800 p-2">
        <span className="block text-[10px] text-slate-400">Su factura</span>
        <span className="font-black text-slate-200 tabular-nums text-sm">{m.factura ? fmtMoney(m.factura) : '—'}</span>
        {m.desviacion != null && m.desviacion !== 0 && (
          <span className={`block text-[10px] tabular-nums ${m.desviacion > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{m.desviacion > 0 ? '+' : ''}{fmtMoney(m.desviacion)} vs presupuesto</span>
        )}
      </div>
      <div className={`rounded-xl border p-2 ${up ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
        <span className="block text-[10px] text-slate-400">{up ? 'Beneficio' : 'Pérdida'}</span>
        <span className={`font-black tabular-nums text-sm ${up ? 'text-emerald-300' : 'text-rose-300'}`}>{fmtMoney(m.beneficio)}</span>
        {m.pct != null && <span className={`block text-[10px] tabular-nums ${up ? 'text-emerald-300' : 'text-rose-300'}`}>{String(m.pct).replace('.', ',')} %</span>}
      </div>
    </div>
  );
}

/**
 * Lista y alta de documentos de una fase o partida.
 * target = { faseId, partidaId, titulo, importe, assignees } (assignees = asignaciones efectivas).
 */
export function DocumentosLista({ obraId, target, docs, margin, docsReady = true, onChanged }) {
  const { subcontractors = [] } = useApp() || {};
  const notify = useNotify();
  const subAssignees = useMemo(() => (target.assignees || []).filter((a) => a.assignee_type === 'subcontrata'), [target.assignees]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const startForm = (kind) => {
    setError('');
    setForm({
      kind,
      who: subAssignees[0] ? `a:${subAssignees[0].id}` : '',
      numero: '',
      fecha: new Date().toISOString().slice(0, 10),
      base_amount: kind === 'factura' ? String(docs.filter((d) => d.kind === 'presupuesto').reduce((s, d) => s + Number(d.base_amount || 0), 0) || '') : '',
      iva_pct: '21',
      notes: '',
      file: null
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.who) { setError('Elige la subcontrata.'); return; }
    if (form.base_amount === '' || Number(String(form.base_amount).replace(',', '.')) < 0) { setError('Pon el importe sin IVA.'); return; }
    setBusy(true);
    setError('');
    const fd = new FormData();
    fd.append('obra_id', obraId);
    fd.append('fase_id', target.faseId);
    fd.append('partida_id', target.partidaId || '');
    fd.append('kind', form.kind);
    if (form.who.startsWith('a:')) fd.append('assignment_id', form.who.slice(2));
    else fd.append('subcontractor_id', form.who.slice(2));
    ['numero', 'fecha', 'base_amount', 'iva_pct', 'notes'].forEach((k) => fd.append(k, form[k]));
    if (form.file) fd.append('archivo', form.file, form.file.name);
    try {
      const res = await fetch('/api/avance/docs', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      notify(form.kind === 'factura' ? 'Factura guardada' : 'Presupuesto guardado');
      setForm(null);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (d) => {
    try {
      const { url } = await api(`/api/avance/docs/${d.id}/file`);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const remove = async (d) => {
    if (!window.confirm(`¿Quitar ${KIND_LABEL[d.kind].toLowerCase()} ${d.numero || ''} de ${d.subcontractor_name}?`)) return;
    try {
      await api(`/api/avance/docs/${d.id}`, { method: 'DELETE' });
      onChanged?.();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  if (!docsReady) {
    return (
      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
        Para guardar presupuestos y facturas de subcontratas ejecuta <code>supabase_migration_documentos_subcontrata.sql</code> en Supabase &gt; SQL Editor.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <MargenResumen m={margin} importe={target.importe} />

      {docs.length > 0 && (
        <ul className="space-y-1.5">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs">
              {d.kind === 'factura' ? <Receipt className="w-4 h-4 text-amber-400 shrink-0" /> : <FileText className="w-4 h-4 text-sky-400 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{KIND_LABEL[d.kind]}{d.numero ? ` nº ${d.numero}` : ''} · {d.subcontractor_name}</p>
                <p className="text-slate-500">{d.fecha ? fmtDate(d.fecha) : 'Sin fecha'}{d.notes ? ` · ${d.notes}` : ''}</p>
              </div>
              <div className="text-right shrink-0 tabular-nums">
                <span className="block font-bold text-white">{fmtMoney(d.base_amount)}</span>
                <span className="block text-[10px] text-slate-500">{fmtMoney(d.total_amount)} con IVA</span>
              </div>
              {d.file_path && <button type="button" onClick={() => openFile(d)} className="text-slate-400 hover:text-amber-400" title={d.file_name || 'Abrir archivo'} aria-label="Abrir archivo"><ExternalLink className="w-4 h-4" /></button>}
              <button type="button" onClick={() => remove(d)} className="text-slate-500 hover:text-rose-400" aria-label="Quitar"><Trash2 className="w-4 h-4" /></button>
            </li>
          ))}
        </ul>
      )}

      {!form && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => startForm('presupuesto')} className={`${btnGhost} !py-1 !text-xs`}><FileText className="w-3.5 h-3.5" /> Añadir presupuesto</button>
          <button type="button" onClick={() => startForm('factura')} className={`${btnGhost} !py-1 !text-xs`}><Receipt className="w-3.5 h-3.5" /> Añadir factura</button>
        </div>
      )}

      {form && (
        <form onSubmit={submit} className="space-y-2 rounded-xl border border-slate-700 bg-slate-950 p-3">
          <p className="text-xs font-bold text-white">{KIND_LABEL[form.kind]} de la subcontrata</p>
          <select value={form.who} onChange={(e) => setForm({ ...form, who: e.target.value })} className={inputCls}>
            <option value="">Subcontrata…</option>
            {subAssignees.length > 0 && (
              <optgroup label="Asignadas aquí">
                {subAssignees.map((a) => <option key={a.id} value={`a:${a.id}`}>{a.assignee_name}{a.heredada ? ' (de la fase)' : ''}</option>)}
              </optgroup>
            )}
            <optgroup label="Todas las subcontratas">
              {subcontractors.map((s) => <option key={s.id} value={`s:${s.id}`}>{s.nombreComercial || s.razonSocial || s.id}</option>)}
            </optgroup>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder={form.kind === 'factura' ? 'Nº de factura' : 'Nº de presupuesto'} className={inputCls} />
            <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inputCls} aria-label="Fecha" />
          </div>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <label className="text-[11px] text-slate-400">Importe sin IVA (€)
              <input inputMode="decimal" value={form.base_amount} onChange={(e) => setForm({ ...form, base_amount: e.target.value })} className={`${inputCls} mt-1`} placeholder="0,00" />
            </label>
            <label className="text-[11px] text-slate-400">IVA %
              <select value={form.iva_pct} onChange={(e) => setForm({ ...form, iva_pct: e.target.value })} className={`${inputCls} mt-1`}>
                {['21', '10', '4', '0'].map((v) => <option key={v} value={v}>{v} %</option>)}
              </select>
            </label>
          </div>
          <label className={`${btnGhost} !py-1.5 !text-xs w-full cursor-pointer`}>
            <Upload className="w-3.5 h-3.5" /> {form.file ? form.file.name : 'Adjuntar PDF o foto (opcional)'}
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} />
          </label>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas (opcional)" className={inputCls} />
          {error && <p className="text-xs text-rose-400 font-semibold">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className={`${btnGhost} !py-1 !text-xs`}>Cancelar</button>
            <button type="submit" disabled={busy} className={`${btnPrimary} !py-1 !text-xs`}>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar</button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Ventana de la fase entera: documentos de fase y beneficio total de la fase. */
export default function DocumentosFaseModal({ obraId, fase, docs, margins, docsReady, faseAssignees, onClose, onChanged }) {
  const own = docs.filter((d) => d.fase_id === fase.id && !d.partida_id);
  const partidaDocs = docs.filter((d) => d.fase_id === fase.id && d.partida_id);
  const faseMargin = margins?.[`${fase.id}::`] || null;
  return (
    <ModalOverlay className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start gap-2">
          <div>
            <span className="text-[11px] text-slate-400">Presupuesto y factura de la subcontrata</span>
            <h3 className="font-black text-white">{fase.nombre}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-[11px] text-slate-500">Un documento de la fase cubre todas sus partidas. Si una partida la hace otra subcontrata, añade su documento desde la partida.</p>
        <DocumentosLista
          obraId={obraId}
          target={{ faseId: fase.id, partidaId: '', titulo: fase.nombre, importe: fase.importe, assignees: faseAssignees }}
          docs={own}
          margin={faseMargin}
          docsReady={docsReady}
          onChanged={onChanged}
        />
        {partidaDocs.length > 0 && (
          <p className="text-[11px] text-slate-400">El beneficio de la fase incluye además {partidaDocs.length} documento(s) de sus partidas.</p>
        )}
      </div>
    </ModalOverlay>
  );
}
