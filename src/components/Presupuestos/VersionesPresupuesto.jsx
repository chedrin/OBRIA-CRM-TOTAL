import React from 'react';
import { History, FileText, FilePlus2 } from 'lucide-react';
import { versionesDe, cambiosEntreVersiones, datosVersionGuardada } from '../../utils/presupuestoRevision';

const eur = (n) => Number(n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const ESTADO = {
  borrador: 'Borrador',
  borrador_ia: 'Borrador',
  enviado_cliente: 'Enviada',
  aceptado: 'Firmada',
  firmado: 'Firmada',
  facturado: 'Firmada'
};

// Datos de una versión guardada para verla en PDF: los suyos, sin nada de la revisión actual.
export const datosVersionPdf = datosVersionGuardada;

/**
 * Versiones de un presupuesto: la actual y las anteriores, que se guardan siempre
 * (cada una con su PDF). "Nueva versión" guarda la actual y abre otra de la misma obra.
 */
export default function VersionesPresupuesto({ pres, onPdf, onNuevaVersion, className = '' }) {
  if (!pres) return null;
  const guardadas = versionesDe(pres);
  // Cada versión guardada con lo que cambió en la que la sustituyó (guardado al firmar o calculado).
  const anteriores = guardadas.map((v, i) => ({
    ...v,
    cambios: v.cambios || cambiosEntreVersiones(v.contenido, i + 1 < guardadas.length ? guardadas[i + 1].contenido : pres)
  })).reverse();
  const actual = pres.version || 1;
  const sinFirmar = Boolean(pres.pendienteNuevaAceptacion);

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <History className="w-4 h-4 text-amber-400" />
          <span>Versiones del presupuesto ({anteriores.length + 1})</span>
        </h3>
        {onNuevaVersion && !sinFirmar && (
          <button
            type="button"
            onClick={() => onNuevaVersion(pres)}
            className="px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            title="La versión actual queda guardada como modificada y la revisión la sustituye"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Añadir revisión</span>
          </button>
        )}
      </div>
      <ul className="space-y-1.5">
        <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          <span className="text-slate-200">
            <strong className="text-amber-300">v{actual}</strong> · actual · {eur(pres.totalConIva)}
            {sinFirmar
              ? <span className="ml-2 text-violet-300 font-semibold">Pendiente de firma del cliente</span>
              : <span className="ml-2 text-slate-400">{ESTADO[pres.estado] || pres.estado}</span>}
          </span>
          <button type="button" onClick={() => onPdf?.(pres)} className="text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
        </li>
        {anteriores.map(v => (
          <li key={`${v.version}-${v.guardadaEl}`} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-300">
                <strong className="text-slate-100">v{v.version}</strong> · {eur(v.totalConIva)}
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-slate-800 text-slate-300 border-slate-700">Modificado el {v.guardadaEl}</span>
                <span className="ml-2 text-slate-500">{ESTADO[v.estado] || v.estado}{v.fecha ? ` · ${v.fecha}` : ''}</span>
              </span>
              <button type="button" onClick={() => onPdf?.(datosVersionPdf(pres, v))} className="text-slate-300 hover:text-white font-semibold flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
            </div>
            {v.cambios.length > 0 ? (
              <details>
                <summary className="cursor-pointer text-[11px] text-slate-400 hover:text-slate-200">{v.cambios.length} cambio(s) en la revisión que la sustituye</summary>
                <ul className="mt-1 ml-4 list-disc space-y-0.5 text-[11px] text-slate-400">
                  {v.cambios.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </details>
            ) : (
              <p className="text-[11px] text-slate-500">Sin cambios todavía en la revisión que la sustituye.</p>
            )}
          </li>
        ))}
      </ul>
      {anteriores.length === 0 && (
        <p className="text-[11px] text-slate-500">Al añadir una revisión, la versión anterior queda guardada aquí como modificada, con la fecha y los cambios.</p>
      )}
    </div>
  );
}
