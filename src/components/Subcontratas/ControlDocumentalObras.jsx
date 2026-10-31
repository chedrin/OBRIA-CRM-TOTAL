import React, { useMemo, useState } from 'react';
import { ShieldCheck, Settings2, Plus, X, Loader2, RefreshCw, ChevronRight } from 'lucide-react';
import { api, btnGhost, btnPrimary, inputCls } from '../../services/avisosApi';
import useNotify from '../Avisos/useNotify';
import ModalOverlay from '../Common/ModalOverlay';
import { DOC_TYPES, docType, obraCompliance, requiredFor } from '../../utils/documentacionSubcontratas';
import { TONE_CLS, ESTADO_INFO } from './useDocumentacionSubcontratas';
import { DocumentoForm, EstadoChip, MigracionAviso, openDocFile } from './DocumentosFicha';

const ORIGEN = { asignacion: 'Asignada en avance de obra', presupuesto: 'Presupuesto vinculado', manual: 'Añadida a mano' };
const obraName = (o) => [o.codigo, o.titulo].filter(Boolean).join(' - ') || o.id;

/**
 * Control documental por obra: qué documentos se exigen en cada obra y, para cada
 * subcontrata que trabaja en ella, si los tiene en regla, por caducar o le faltan.
 */
export default function ControlDocumentalObras({ subcontractors = [], obras = [], docState, onOpenFicha }) {
  const notify = useNotify();
  const { docs, requirements, assignments, ready, error, loading, reload } = docState;
  const obrasOrdenadas = useMemo(
    () => [...obras].sort((a, b) => (a.estado === 'finalizada') - (b.estado === 'finalizada')),
    [obras]
  );
  const [obraId, setObraId] = useState(obrasOrdenadas[0]?.id || '');
  const [editReq, setEditReq] = useState(null); // lista de tipos mientras se edita
  const [upload, setUpload] = useState(null); // { subId, initial }
  const [addSub, setAddSub] = useState('');
  const [saving, setSaving] = useState(false);

  const subById = useMemo(() => new Map(subcontractors.map((s) => [String(s.id), s])), [subcontractors]);
  const resumenObras = useMemo(
    () => obrasOrdenadas.map((o) => ({ obra: o, ...obraCompliance({ obraId: o.id, subcontractors, assignments, requirements, docs }) })),
    [obrasOrdenadas, subcontractors, assignments, requirements, docs]
  );
  const actual = resumenObras.find((r) => String(r.obra.id) === String(obraId));
  const reqRow = requirements.find((r) => String(r.obra_id) === String(obraId)) || {};

  if (loading) return <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando documentación…</p>;
  if (!ready || error) return <MigracionAviso error={error} />;
  if (!obras.length) return <p className="text-xs text-slate-400">No hay obras dadas de alta.</p>;

  const saveCae = async (patch) => {
    setSaving(true);
    try {
      await api(`/api/subcontratas/cae/${encodeURIComponent(obraId)}`, {
        method: 'PUT',
        body: {
          doc_types: requiredFor(requirements, obraId),
          subcontractor_ids: reqRow.subcontractor_ids || [],
          excluded_ids: reqRow.excluded_ids || [],
          ...patch
        }
      });
      await reload();
      return true;
    } catch (err) {
      notify(err.message, 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const enObra = new Set((actual?.rows || []).map((r) => r.subcontractorId));
  const disponibles = subcontractors.filter((s) => !enObra.has(String(s.id)));

  const addToObra = async () => {
    if (!addSub) return;
    const ok = await saveCae({
      subcontractor_ids: [...new Set([...(reqRow.subcontractor_ids || []), addSub])],
      excluded_ids: (reqRow.excluded_ids || []).filter((id) => id !== addSub)
    });
    if (ok) setAddSub('');
  };

  const removeFromObra = (row) => {
    const sub = subById.get(row.subcontractorId);
    if (!window.confirm(`¿Dejar de controlar la documentación de ${sub?.razonSocial || 'esta subcontrata'} en esta obra?`)) return;
    saveCae({
      subcontractor_ids: (reqRow.subcontractor_ids || []).filter((id) => id !== row.subcontractorId),
      excluded_ids: row.origen.some((o) => o !== 'manual')
        ? [...new Set([...(reqRow.excluded_ids || []), row.subcontractorId])]
        : reqRow.excluded_ids || []
    });
  };

  const onChip = (row, it) => {
    if (it.doc && it.status !== 'falta' && it.status !== 'caducado' && it.doc.file_path) { openDocFile(it.doc, notify); return; }
    setUpload({
      subId: row.subcontractorId,
      initial: { doc_type: it.type, obra_id: docType(it.type).scope === 'obra' ? obraId : '' }
    });
  };

  return (
    <div className="space-y-4">
      {/* Resumen de todas las obras */}
      <div className="flex flex-wrap gap-2">
        {resumenObras.map(({ obra, rows }) => {
          const malas = rows.filter((r) => r.estado === 'no_apto').length;
          const aviso = rows.filter((r) => r.estado === 'aviso').length;
          const tone = malas ? 'bad' : aviso ? 'warn' : 'ok';
          const sel = String(obra.id) === String(obraId);
          return (
            <button
              key={obra.id}
              type="button"
              onClick={() => { setObraId(obra.id); setEditReq(null); }}
              className={`text-left rounded-xl border px-3 py-2 text-xs transition ${sel ? 'ring-2 ring-indigo-500/40 border-indigo-500' : 'border-slate-800 hover:border-slate-600'} bg-slate-900`}
            >
              <span className="block font-bold text-white max-w-[14rem] truncate">{obraName(obra)}</span>
              <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${rows.length ? TONE_CLS[tone] : 'border-slate-700 text-slate-400'}`}>
                {rows.length ? (malas ? `${malas} de ${rows.length} no aptas` : aviso ? `${aviso} con avisos` : `${rows.length} en regla`) : 'Sin subcontratas'}
              </span>
            </button>
          );
        })}
      </div>

      {actual && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-black text-white flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-indigo-400" /> {obraName(actual.obra)}</h3>
              <p className="text-xs text-slate-400">Se exigen {actual.required.length} documentos a cada subcontrata. Los de empresa sirven para todas las obras; los de obra se suben para esta.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => reload()} className={`${btnGhost} !py-1 !text-xs`} aria-label="Recargar"><RefreshCw className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => setEditReq(editReq ? null : actual.required)} className={`${btnGhost} !py-1 !text-xs`}>
                <Settings2 className="w-3.5 h-3.5" /> Documentos exigidos
              </button>
            </div>
          </div>

          {editReq && (
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 space-y-2 text-xs">
              {['empresa', 'obra'].map((scope) => (
                <div key={scope}>
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">{scope === 'empresa' ? 'De la empresa' : 'De esta obra'}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {DOC_TYPES.filter((t) => t.scope === scope && t.id !== 'otro').map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-slate-300">
                        <input
                          type="checkbox"
                          className="accent-indigo-500"
                          checked={editReq.includes(t.id)}
                          onChange={(e) => setEditReq((list) => (e.target.checked ? [...list, t.id] : list.filter((x) => x !== t.id)))}
                        />
                        {t.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditReq(null)} className={`${btnGhost} !py-1 !text-xs`}>Cancelar</button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => { if (await saveCae({ doc_types: DOC_TYPES.map((t) => t.id).filter((id) => editReq.includes(id)) })) setEditReq(null); }}
                  className={`${btnPrimary} !py-1 !text-xs`}
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar para esta obra
                </button>
              </div>
            </div>
          )}

          {actual.rows.length === 0 && (
            <p className="text-xs text-slate-400">
              Ninguna subcontrata trabaja todavía en esta obra. Aparecen solas al asignarles una fase o partida en Avance de obra, o al vincular un presupuesto en su ficha; también puedes añadirlas aquí.
            </p>
          )}

          <div className="space-y-3">
            {actual.rows.map((row) => {
              const sub = subById.get(row.subcontractorId);
              const bloqueada = sub?.prl?.bloqueoManual === true;
              const estado = bloqueada ? { label: 'Bloqueada a mano en su ficha', tone: 'bad' } : ESTADO_INFO[row.estado];
              return (
                <div key={row.subcontractorId} className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <button type="button" onClick={() => sub && onOpenFicha(sub.id)} className="font-bold text-white hover:text-indigo-300 flex items-center gap-1 text-sm">
                        {sub ? sub.razonSocial : `Subcontrata ${row.subcontractorId} (sin ficha)`} {sub && <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                      <p className="text-[10px] text-slate-500">{row.origen.map((o) => ORIGEN[o]).join(' · ')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${TONE_CLS[estado.tone]}`}>{estado.label}</span>
                      <button type="button" onClick={() => removeFromObra(row)} className="text-slate-500 hover:text-rose-400" aria-label="Quitar de esta obra"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {row.items.map((it) => (
                      <button
                        key={it.type}
                        type="button"
                        disabled={!sub}
                        onClick={() => onChip(row, it)}
                        title={it.status === 'falta' || it.status === 'caducado' ? 'Subir documento' : 'Abrir archivo'}
                        className="inline-flex max-w-full items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] text-slate-200 hover:border-slate-500 disabled:opacity-60"
                      >
                        <span className="min-w-0 max-w-[13rem] truncate">{docType(it.type).label}</span>
                        <EstadoChip status={it.status} days={it.daysLeft} />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {disponibles.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={addSub} onChange={(e) => setAddSub(e.target.value)} className={inputCls}>
                <option value="">Añadir otra subcontrata a esta obra…</option>
                {disponibles.map((s) => <option key={s.id} value={s.id}>{s.razonSocial}</option>)}
              </select>
              <button type="button" disabled={!addSub || saving} onClick={addToObra} className={`${btnPrimary} !text-xs shrink-0`}>
                <Plus className="w-3.5 h-3.5" /> Añadir
              </button>
            </div>
          )}
        </div>
      )}

      {upload && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setUpload(null)}>
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto space-y-2" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-white px-1">{subById.get(upload.subId)?.razonSocial}</p>
            <DocumentoForm
              subcontractorId={upload.subId}
              obras={obras}
              initial={upload.initial}
              onCancel={() => setUpload(null)}
              onSaved={() => { setUpload(null); reload(); }}
            />
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
