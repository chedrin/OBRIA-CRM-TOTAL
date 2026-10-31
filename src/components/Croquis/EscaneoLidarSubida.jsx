import React, { Suspense, lazy, useState } from 'react';
import { ScanLine, AlertTriangle, CheckCircle2, X, Box } from 'lucide-react';
import { ACCEPT_ESCANEO, FORMATO_ESCANEO, leerEscaneoLidar } from '../../utils/escaneoLidar';
import { ACCEPT_VISOR, NOMBRE_FORMATO_3D, archivoPrincipal, esVisible3D } from '../../utils/formatos3D';
import { pareceNubeTexto } from '../../utils/nubesPuntos';

const VisorEscaneo3D = lazy(() => import('../Escaneo/VisorEscaneo3D'));
// Se pueden medir (croquis) y además ver en 3D.
const MEDIBLES_3D = ['obj', 'dxf'];
const ACCEPT_TODO = Array.from(new Set([...ACCEPT_ESCANEO.split(','), ...ACCEPT_VISOR.split(',')])).join(',');
const ext = (nombre) => String(nombre).toLowerCase().split('.').pop();

/**
 * Subida de un escaneo LiDAR (JSON de RoomPlan, OBJ, DXF, CSV o imagen del plano).
 * Lee el archivo en el navegador, enseña lo encontrado y llama a onUsar(resultado) al confirmarlo.
 * Los modelos 3D (GLB, PLY, USDZ, LAS, nubes de puntos…) se abren en el visor 3D; OBJ y DXF se miden y también se ven en 3D.
 */
export default function EscaneoLidarSubida({ onUsar, onArchivos3D, textoUsar = 'Usar el escaneo', ayuda = '' }) {
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);
  // Archivos del último escaneo que se pueden ver en 3D (el OBJ puede ir con su MTL y texturas).
  const [archivos3D, setArchivos3D] = useState(null);
  const [verVisor, setVerVisor] = useState(false);
  // Avisa al padre de los archivos que se pueden ver en 3D (el croquis los guarda para «Ver escaneo 3D»).
  const guardar3D = (lista) => { setArchivos3D(lista); if (lista) onArchivos3D?.(lista); };

  const elegir = async (e) => {
    const lista = Array.from(e.target.files || []);
    e.target.value = '';
    if (!lista.length) return;
    const file = archivoPrincipal(lista) || lista[0];
    const x = ext(file.name);
    setError('');
    setResultado(null);
    setArchivos3D(null);
    // Solo para ver: se abre directamente el visor.
    if (esVisible3D(file.name) && !MEDIBLES_3D.includes(x)) {
      guardar3D(lista);
      setVerVisor(true);
      return;
    }
    if (MEDIBLES_3D.includes(x)) guardar3D(lista);
    setLeyendo(true);
    // Deja pintar el "Leyendo…" antes de procesar mallas grandes.
    await new Promise(r => setTimeout(r, 30));
    try {
      setResultado(await leerEscaneoLidar(file));
    } catch (err) {
      console.error(err);
      // Un TXT/CSV que no es una lista de medidas puede ser una nube de puntos.
      if ((x === 'txt' || x === 'csv') && pareceNubeTexto(await file.text().catch(() => ''))) {
        guardar3D(lista);
        setVerVisor(true);
        return;
      }
      setError(err.escaneo ? err.message : `No se pudo leer el escaneo: ${err.message}`);
    } finally {
      setLeyendo(false);
    }
  };

  const nombre3D = archivos3D ? (archivoPrincipal(archivos3D) || archivos3D[0]).name : '';
  const botonVer = (
    <button type="button" onClick={() => setVerVisor(true)} className="px-3 py-2 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition">
      <Box className="w-3.5 h-3.5" />Ver en 3D
    </button>
  );

  const r = resultado?.resumen;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${leyendo ? 'opacity-60 pointer-events-none' : ''} bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/40 text-cyan-300`}>
          <ScanLine className={`w-3.5 h-3.5 ${leyendo ? 'animate-pulse' : ''}`} />
          <span>{leyendo ? 'Leyendo el escaneo…' : 'Subir escaneo LiDAR'}</span>
          <input type="file" multiple accept={ACCEPT_TODO} onChange={elegir} className="hidden" disabled={leyendo} />
        </label>
        <span className="text-[11px] text-slate-500">{ayuda || 'Mide: JSON (RoomPlan), DXF, OBJ, CSV o imagen del plano. Visor 3D con colores: también GLB, USDZ, el ZIP de la app (OBJ + fotos), PLY, STL, LAS, XYZ y PTS.'}</span>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-xs p-3 rounded-xl flex flex-wrap items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span className="flex-1 min-w-[12rem]">{error}</span>
          {archivos3D && botonVer}
        </div>
      )}

      {archivos3D && !resultado && !error && !leyendo && (
        <div className="bg-cyan-500/5 border border-cyan-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs min-w-0">
            <p className="font-bold text-white truncate">{nombre3D}</p>
            <p className="text-slate-400">{NOMBRE_FORMATO_3D[ext(nombre3D)] || 'Modelo 3D'} · solo visor: para medir el croquis exporta también JSON (RoomPlan), DXF u OBJ.</p>
          </div>
          <div className="flex items-center gap-1">
            {botonVer}
            <button type="button" onClick={() => setArchivos3D(null)} className="p-1 text-slate-500 hover:text-white" aria-label="Quitar escaneo"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {verVisor && archivos3D && (
        <Suspense fallback={<div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center text-sm text-slate-300">Cargando el visor 3D…</div>}>
          <VisorEscaneo3D archivos={archivos3D} onClose={() => setVerVisor(false)} />
        </Suspense>
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
            <button type="button" onClick={() => { setResultado(null); setArchivos3D(null); }} className="p-1 text-slate-500 hover:text-white" aria-label="Descartar escaneo"><X className="w-4 h-4" /></button>
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { onUsar?.(resultado); setResultado(null); setArchivos3D(null); }}
              className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-black transition active:scale-95"
            >
              {textoUsar}
            </button>
            {archivos3D && botonVer}
          </div>
        </div>
      )}
    </div>
  );
}
