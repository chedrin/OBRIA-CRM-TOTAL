import React, { Suspense, lazy, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ScanLine, Smartphone, FileCheck2, Info, Box } from 'lucide-react';
import { ACCEPT_VISOR } from '../../utils/formatos3D';

const VisorEscaneo3D = lazy(() => import('../Escaneo/VisorEscaneo3D'));

// Apps de escaneo con LiDAR (iPhone 12 Pro o posterior "Pro", iPad Pro). Sus exportaciones gratuitas cambian con el tiempo.
const APPS = [
  { nombre: 'Polycam', uso: 'Modo «Room» (sala a sala). Exporta el plano en DXF y la malla en OBJ.', nota: 'DXF y algunos formatos solo con la suscripción.' },
  { nombre: '3D Scanner App', uso: 'Gratis. Exporta la malla en OBJ; en el modo de habitaciones, también el plano.', nota: 'Escanea con luz y sin prisa: rodea la estancia entera.' },
  { nombre: 'Scaniverse', uso: 'Gratis. Exporta la malla en OBJ.', nota: 'Útil para estancias sueltas; no nombra las estancias.' },
  { nombre: 'magicplan', uso: 'Planos por estancias. Exporta DXF y la lista de estancias.', nota: 'Las exportaciones son de pago.' }
];

const FORMATOS = [
  ['JSON de RoomPlan', 'El mejor: estancias con nombre, muros, puertas y ventanas.'],
  ['DXF', 'Plano 2D: cada polilínea cerrada es una estancia; los textos dentro le dan nombre.'],
  ['OBJ', 'Malla 3D: se sacan los contornos y la altura; puertas y nombres se ponen a mano.'],
  ['CSV / TXT', 'Lista «Estancia;largo;ancho;alto», una por línea.'],
  ['PNG / JPG', 'Imagen del plano acotado: la IA del croquis lo copia (no es una medición).']
];

// Solo visor 3D (se ven y se miden a mano, pero no dibujan el croquis).
const FORMATOS_VISOR = [
  ['GLB / glTF, USDZ, FBX', 'Modelos 3D con textura: se ven con los colores reales, como en el iPad (Polycam, 3D Scanner App, Scaniverse).'],
  ['PLY, STL', 'Malla o nube de puntos (3D Scanner App, Polycam).'],
  ['LAS, PCD, XYZ, PTS', 'Nubes de puntos de escáner o topografía. LAZ y E57: conviértelos a LAS o PLY con CloudCompare (gratis).'],
  ['ZIP de la app (OBJ + MTL + fotos)', 'Súbelo tal cual: se ve con las texturas reales. También vale elegir los archivos a la vez.']
];

export default function EscaneoLidarConfig() {
  const { empresaConfig, updateEmpresaConfig, showNotification } = useApp();
  const activo = Boolean(empresaConfig?.escaneoLidar?.activo);
  const [archivosVisor, setArchivosVisor] = useState(null);

  const cambiar = () => {
    updateEmpresaConfig({ escaneoLidar: { ...(empresaConfig?.escaneoLidar || {}), activo: !activo } });
    showNotification(!activo ? 'Subida de escaneos LiDAR activada en Presupuestos IA y en el croquis.' : 'Subida de escaneos LiDAR desactivada.');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1 max-w-2xl">
          <h3 className="text-base font-bold text-white flex items-center gap-2"><ScanLine className="w-5 h-5 text-amber-400" />Escaneo LiDAR de la vivienda</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Con un iPhone o iPad Pro (sensor LiDAR) se escanea cada estancia en un par de minutos. Al subir el archivo, la app dibuja el croquis con las medidas reales y fijas (🔒) y añade la medición de cada estancia (superficie, perímetro y paredes) a las anotaciones del presupuesto.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={activo}
          onClick={cambiar}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-bold transition ${activo ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-400'}`}
        >
          <span className={`relative w-10 h-6 rounded-full transition ${activo ? 'bg-emerald-500' : 'bg-slate-600'}`}>
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${activo ? 'left-5' : 'left-1'}`} />
          </span>
          {activo ? 'Activado' : 'Desactivado'}
        </button>
      </div>

      <p className="text-xs text-slate-300">
        {activo
          ? 'Verás «Subir escaneo LiDAR» en Presupuestos IA (Mediciones) y en el croquis (pestaña Medidas y fotos).'
          : 'Actívalo para ver «Subir escaneo LiDAR» en Presupuestos IA y en el croquis.'}
      </p>

      <section className="space-y-2">
        <h4 className="text-sm font-bold text-white flex items-center gap-2"><Smartphone className="w-4 h-4 text-amber-400" />Apps para escanear</h4>
        <div className="grid sm:grid-cols-2 gap-2">
          {APPS.map(a => (
            <div key={a.nombre} className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <p className="text-sm font-bold text-white">{a.nombre}</p>
              <p className="text-xs text-slate-300 mt-0.5">{a.uso}</p>
              <p className="text-[11px] text-slate-500 mt-1">{a.nota}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-bold text-white flex items-center gap-2"><FileCheck2 className="w-4 h-4 text-amber-400" />Formatos que entiende ObraMaster</h4>
        <ul className="space-y-1.5">
          {FORMATOS.map(([f, d]) => (
            <li key={f} className="text-xs text-slate-300"><span className="font-bold text-white">{f}:</span> {d}</li>
          ))}
        </ul>
        <p className="text-[11px] text-slate-500 flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-px" />USDZ (el 3D de Apple) y PDF no traen medidas legibles para el croquis: el USDZ sí se ve en el visor 3D. El archivo se lee en tu navegador; no se envía a la IA.</p>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-white flex items-center gap-2"><Box className="w-4 h-4 text-amber-400" />Visor 3D de escaneos</h4>
          <label className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/40 text-cyan-300">
            <Box className="w-3.5 h-3.5" /><span>Abrir un escaneo en 3D</span>
            <input type="file" multiple accept={ACCEPT_VISOR} className="hidden" onChange={e => { const l = Array.from(e.target.files || []); e.target.value = ''; if (l.length) setArchivosVisor(l); }} />
          </label>
        </div>
        <p className="text-xs text-slate-400">Al subir un escaneo en Presupuestos IA o en el croquis se abre aquí mismo: gíralo, míralo en planta y mide entre dos puntos. Además de los formatos de arriba, el visor abre:</p>
        <ul className="space-y-1.5">
          {FORMATOS_VISOR.map(([f, d]) => (
            <li key={f} className="text-xs text-slate-300"><span className="font-bold text-white">{f}:</span> {d}</li>
          ))}
        </ul>
      </section>

      {archivosVisor && (
        <Suspense fallback={null}>
          <VisorEscaneo3D archivos={archivosVisor} onClose={() => setArchivosVisor(null)} />
        </Suspense>
      )}
    </div>
  );
}
