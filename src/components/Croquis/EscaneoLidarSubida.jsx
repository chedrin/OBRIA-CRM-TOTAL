import React, { useState } from 'react';
import { ScanLine, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { ACCEPT_ESCANEO, FORMATO_ESCANEO, leerEscaneoLidar } from '../../utils/escaneoLidar';

/**
 * Subida de un escaneo LiDAR (JSON de RoomPlan, OBJ, DXF, CSV o imagen del plano).
 * Lee el archivo en el navegador, enseña lo encontrado y llama a onUsar(resultado) al confirmarlo.
 */
export default function EscaneoLidarSubida({ onUsar, textoUsar = 'Usar el escaneo', ayuda = '' }) {
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const elegir = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setResultado(null);
    setLeyendo(true);
    // Deja pintar el "Leyendo…" antes de procesar mallas grandes.
    await new Promise(r => setTimeout(r, 30));
    try {
      setResultado(await leerEscaneoLidar(file));
    } catch (err) {
      console.error(err);
      setError(err.escaneo ? err.message : `No se pudo leer el escaneo: ${err.message}`);
    } finally {
      setLeyendo(false);
    }
  };

  const r = resultado?.resumen;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${leyendo ? 'opacity-60 pointer-events-none' : ''} bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/40 text-cyan-300`}>
          <ScanLine className={`w-3.5 h-3.5 ${leyendo ? 'animate-pulse' : ''}`} />
          <span>{leyendo ? 'Leyendo el escaneo…' : 'Subir escaneo LiDAR'}</span>
          <input type="file" accept={ACCEPT_ESCANEO} onChange={elegir} className="hidden" disabled={leyendo} />
        </label>
        <span className="text-[11px] text-slate-500">{ayuda || 'JSON (RoomPlan), DXF, OBJ, CSV o imagen del plano.'}</span>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-xs p-3 rounded-xl flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {resultado && (
        <div className="bg-cyan-500/5 border border-cyan-500/30 rounded-xl p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs text-slate-200 space-y-0.5 min-w-0">
              <p className="font-bold text-white flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" /><span className="truncate">{resultado.nombreArchivo}</span></p>
              <p className="text-slate-400">{FORMATO_ESCANEO[resultado.formato]}</p>
              {r && (
                <p>
                  {r.estancias} {r.estancias === 1 ? 'estancia' : 'estancias'} · {r.superficie.toLocaleString('es-ES')} m² útiles
                  {r.alto ? ` · altura ${r.alto.toLocaleString('es-ES')} m` : ''}
                  {r.huecos ? ` · ${r.huecos} puertas y ventanas` : ''}
                </p>
              )}
            </div>
            <button type="button" onClick={() => setResultado(null)} className="p-1 text-slate-500 hover:text-white" aria-label="Descartar escaneo"><X className="w-4 h-4" /></button>
          </div>
          {resultado.mediciones?.length > 0 && (
            <ul className="text-[11px] text-slate-300 grid sm:grid-cols-2 gap-x-4">
              {resultado.mediciones.slice(0, 12).map(m => (
                <li key={m.id} className="truncate">
                  {m.estancia}: {Number(m.largo).toLocaleString('es-ES')} × {Number(m.ancho).toLocaleString('es-ES')} m{m.superficie ? ` (${m.superficie.toLocaleString('es-ES')} m²)` : ''}
                </li>
              ))}
            </ul>
          )}
          {resultado.avisos?.map(a => <p key={a} className="text-[11px] text-amber-300">⚠️ {a}</p>)}
          <button
            type="button"
            onClick={() => { onUsar?.(resultado); setResultado(null); }}
            className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-black transition active:scale-95"
          >
            {textoUsar}
          </button>
        </div>
      )}
    </div>
  );
}
