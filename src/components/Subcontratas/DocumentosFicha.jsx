import React, { useMemo, useState } from 'react';
import { Upload, Loader2, ExternalLink, Trash2, Edit2, FileText, Plus, AlertTriangle } from 'lucide-react';
import { api, fmtDate, inputCls, btnPrimary, btnGhost } from '../../services/avisosApi';
import useNotify from '../Avisos/useNotify';
import { OpcionesCrear, conCrear, useQuickCreate } from '../Common/QuickCreate';
import {
  DOC_TYPES,
  docType,
  docStatus,
  daysLeft,
  companyCompliance,
  STATUS_INFO
} from '../../utils/documentacionSubcontratas';
import { TONE_CLS, ESTADO_INFO } from './useDocumentacionSubcontratas';

const MIGRATION = 'supabase_migration_documentacion_subcontratas.sql';

/** Etiqueta de estado de un documento o requisito, con los días que quedan. */
export function EstadoChip({ status, days, className = '' }) {
  const info = STATUS_INFO[status];
  let extra = '';
  if (days != null && status === 'por_caducar') extra = days === 0 ? ' · hoy' : ` · ${days} d`;
  if (days != null && status === 'caducado') extra = ` · hace ${-days} d`;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${TONE_CLS[info.tone]} ${className}`}>
      {info.label}{extra}
    </span>
  );
}

export function MigracionAviso({ error }) {
  return (
    <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>
        {error
          ? `No se pudo cargar la documentación: ${error}`
          : <>Para guardar documentos de subcontratas ejecuta <code>{MIGRATION}</code> en Supabase &gt; SQL Editor.</>}
      </span>
    </p>
  );
}

export async function openDocFile(doc, notify) {
  try {
    const { url } = await api(`/api/subcontratas/docs/${doc.id}/file`);
    window.open(url, '_blank', 'noopener');
  } catch (err) {
    notify(err.message, 'error');
  }
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Alta o corrección de un documento de la ficha.
 * initial = documento existente (edición) o { doc_type, obra_id } para empezar uno nuevo.
 */
export function DocumentoForm({ subcontractorId, obras = [], initial = {}, onSaved, onCancel }) {
  const notify = useNotify();
  const { crear } = useQuickCreate();
  const editing = Boolean(initial.id);
  const [form, setForm] = useState({
    doc_type: initial.doc_type || 'rc_seguro',
    obra_id: initial.obra_id || '',
    titulo: initial.titulo || '',
    trabajador: initial.trabajador || '',
    fecha_emision: initial.fecha_emision || (editing ? '' : today()),
    fecha_caducidad: initial.fecha_caducidad || '',
    notes: initial.notes || '',
    file: null
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const type = docType(form.doc_type);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (type.scope === 'obra' && !form.obra_id) { setError('Este documento es de una obra: elige la obra.'); return; }
    if (type.caduca && !form.fecha_caducidad) { setError('Pon la fecha de caducidad (o hasta cuándo es válido).'); return; }
    if (!editing && !form.file && !window.confirm('No has adjuntado el archivo. ¿Guardar solo los datos?')) return;
    setBusy(true);
    setError('');
    const fd = new FormData();
    if (!editing) fd.append('subcontractor_id', subcontractorId);
    ['doc_type', 'obra_id', 'titulo', 'trabajador', 'fecha_emision', 'fecha_caducidad', 'notes'].forEach((k) => fd.append(k, form[k]));
    if (form.file) fd.append('archivo', form.file, form.file.name);
    try {
      const res = await fetch(editing ? `/api/subcontratas/docs/${initial.id}` : '/api/subcontratas/docs', { method: editing ? 'PATCH' : 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      notify(editing ? 'Documento actualizado' : 'Documento guardado en la ficha');
      onSaved?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs">
      <p className="font-bold text-white">{editing ? 'Corregir documento' : 'Nuevo documento'}</p>
      <label className="block text-[11px] text-slate-400">Tipo de documento
        <select value={form.doc_type} onChange={set('doc_type')} className={`${inputCls} mt-1`}>
          <optgroup label="De la empresa (vale para todas las obras)">
            {DOC_TYPES.filter((t) => t.scope === 'empresa').map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </optgroup>
          <optgroup label="De una obra concreta">
            {DOC_TYPES.filter((t) => t.scope === 'obra').map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </optgroup>
        </select>
      </label>
      <label className="block text-[11px] text-slate-400">Obra {type.scope === 'obra' ? '*' : '(déjalo en blanco si vale para todas)'}
        <select value={form.obra_id} onChange={conCrear(crear, (v) => setForm((f) => ({ ...f, obra_id: v })))} className={`${inputCls} mt-1`}>
          <option value="">{type.scope === 'obra' ? 'Elige la obra…' : 'Todas las obras'}</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{[o.codigo, o.titulo].filter(Boolean).join(' - ') || o.id}</option>)}
          <OpcionesCrear tipos={['obra']} />
        </select>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input value={form.titulo} onChange={set('titulo')} placeholder="Descripción (opcional): nº póliza, mes…" className={inputCls} />
        {(type.porTrabajador || form.trabajador) && (
          <input value={form.trabajador} onChange={set('trabajador')} placeholder="Trabajador (nombre y DNI)" className={inputCls} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-slate-400">Fecha de emisión
          <input type="date" value={form.fecha_emision} onChange={set('fecha_emision')} className={`${inputCls} mt-1`} />
        </label>
        <label className="text-[11px] text-slate-400">Caduca el {type.caduca ? '*' : '(si caduca)'}
          <input type="date" value={form.fecha_caducidad} onChange={set('fecha_caducidad')} className={`${inputCls} mt-1`} />
        </label>
      </div>
      <label className={`${btnGhost} !py-1.5 !text-xs w-full cursor-pointer`}>
        <Upload className="w-3.5 h-3.5" />
        <span className="truncate">{form.file ? form.file.name : editing && initial.file_name ? `Sustituir ${initial.file_name}` : 'Adjuntar PDF o foto'}</span>
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} />
      </label>
      <input value={form.notes} onChange={set('notes')} placeholder="Notas (opcional)" className={inputCls} />
      {error && <p className="text-rose-400 font-semibold">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={`${btnGhost} !py-1 !text-xs`}>Cancelar</button>
        <button type="submit" disabled={busy} className={`${btnPrimary} !py-1 !text-xs`}>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar</button>
      </div>
    </form>
  );
}

/** Pestaña de documentos de la ficha de una subcontrata. */
export default function DocumentosFicha({ subcontractor, docs = [], obras = [], ready = true, error = '', onChanged }) {
  const notify = useNotify();
  const [form, setForm] = useState(null); // null | {} nuevo | doc a corregir
  const own = useMemo(() => docs.filter((d) => String(d.subcontractor_id) === String(subcontractor.id)), [docs, subcontractor.id]);
  const resumen = useMemo(() => companyCompliance(own, subcontractor.id), [own, subcontractor.id]);
  const obraName = (id) => {
    const o = obras.find((x) => String(x.id) === String(id));
    return o ? o.titulo || o.codigo || id : id;
  };

  if (!ready || error) return <MigracionAviso error={error} />;

  const remove = async (d) => {
    if (!window.confirm(`¿Quitar "${docType(d.doc_type).label}" de la ficha?`)) return;
    try {
      await api(`/api/subcontratas/docs/${d.id}`, { method: 'DELETE' });
      onChanged?.();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const sorted = [...own].sort((a, b) => {
    const rank = { caducado: 0, por_caducar: 1, vigente: 2, sin_caducidad: 3 };
    return rank[docStatus(a)] - rank[docStatus(b)] || docType(a.doc_type).label.localeCompare(docType(b.doc_type).label, 'es');
  });

  return (
    <div className="space-y-3 text-xs">
      <div className={`rounded-xl border p-3 ${TONE_CLS[ESTADO_INFO[resumen.estado].tone]}`}>
        <p className="font-black text-sm">{ESTADO_INFO[resumen.estado].label}</p>
        <p className="opacity-80">Documentación de empresa: {resumen.ok} en regla, {resumen.warn} por caducar, {resumen.bad} que faltan o han caducado.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {resumen.items.map((it) => (
            <button
              key={it.type}
              type="button"
              onClick={() => setForm(it.doc && it.status !== 'falta' ? it.doc : { doc_type: it.type })}
              title={it.status === 'falta' ? 'Subir este documento' : 'Ver o corregir'}
              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-200 hover:border-slate-500"
            >
              <span className="min-w-0 max-w-[12rem] truncate">{docType(it.type).label}</span>
              <EstadoChip status={it.status} days={it.daysLeft} />
            </button>
          ))}
        </div>
      </div>

      {!form && (
        <button type="button" onClick={() => setForm({})} className={`${btnPrimary} !py-1.5 !text-xs`}>
          <Plus className="w-3.5 h-3.5" /> Subir documento
        </button>
      )}
      {form && (
        <DocumentoForm
          key={form.id || form.doc_type || 'nuevo'}
          subcontractorId={subcontractor.id}
          obras={obras}
          initial={form}
          onCancel={() => setForm(null)}
          onSaved={() => { setForm(null); onChanged?.(); }}
        />
      )}

      {sorted.length === 0 ? (
        <p className="text-slate-500">Todavía no hay documentos en esta ficha.</p>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((d) => {
            const st = docStatus(d);
            return (
              <li key={d.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-2">
                <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{docType(d.doc_type).label}</p>
                  <p className="text-slate-500 truncate">
                    {[d.titulo, d.trabajador, d.obra_id ? `Obra: ${obraName(d.obra_id)}` : null, d.fecha_emision ? `Emitido ${fmtDate(d.fecha_emision)}` : null, d.fecha_caducidad ? `Caduca ${fmtDate(d.fecha_caducidad)}` : null].filter(Boolean).join(' · ') || 'Sin datos'}
                  </p>
                </div>
                <EstadoChip status={st} days={daysLeft(d)} />
                {d.file_path && <button type="button" onClick={() => openDocFile(d, notify)} className="text-slate-400 hover:text-indigo-400" title={d.file_name || 'Abrir archivo'} aria-label="Abrir archivo"><ExternalLink className="w-4 h-4" /></button>}
                <button type="button" onClick={() => setForm(d)} className="text-slate-400 hover:text-white" aria-label="Corregir"><Edit2 className="w-4 h-4" /></button>
                <button type="button" onClick={() => remove(d)} className="text-slate-500 hover:text-rose-400" aria-label="Quitar"><Trash2 className="w-4 h-4" /></button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
