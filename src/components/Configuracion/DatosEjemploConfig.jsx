import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Database, Plus, Trash2 } from 'lucide-react';

// Carga o quita los datos de ejemplo de todos los módulos (obras, presupuestos, facturas, plantilla...).
export default function DatosEjemploConfig() {
  const { cargarDatosEjemplo, quitarDatosEjemplo, demoDataCount, demoDataTotal, currentUser } = useApp();
  const [confirmar, setConfirmar] = useState(null); // 'cargar' | 'quitar' | null

  if (currentUser?.role !== 'admin') {
    return <p className="text-sm text-slate-400">Solo el administrador puede cargar o quitar datos de ejemplo.</p>;
  }

  const ejecutar = () => {
    if (confirmar === 'cargar') cargarDatosEjemplo();
    if (confirmar === 'quitar') quitarDatosEjemplo();
    setConfirmar(null);
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 max-w-3xl">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-white">Datos de ejemplo</h2>
          <p className="text-sm text-slate-400 mt-1">
            Rellena todos los módulos (obras, presupuestos, facturas, avance, plantilla, subcontratas, avisos y bandeja IA)
            con datos de muestra para probar o enseñar la aplicación. Solo se añaden registros nuevos: lo que ya tengas no se toca.
          </p>
          <p className="text-xs text-amber-400 mt-2">
            Se guardan en tu base de datos como cualquier otro dato, así que también los verás en el resto de dispositivos.
            Puedes quitarlos cuando quieras.
          </p>
        </div>
      </div>

      <p className="text-sm text-slate-300">
        Cargados ahora: <strong className="text-white tabular-nums">{demoDataCount}</strong> de {demoDataTotal} registros de ejemplo.
      </p>

      {confirmar ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <p className="text-sm text-slate-200 flex-1">
            {confirmar === 'cargar'
              ? '¿Cargar los datos de ejemplo en todos los módulos?'
              : '¿Quitar los datos de ejemplo? También se borran los cambios que hayas hecho sobre ellos.'}
          </p>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setConfirmar(null)} className="px-4 py-2 text-sm rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition">
              Cancelar
            </button>
            <button
              onClick={ejecutar}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition ${confirmar === 'cargar' ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-rose-600 hover:bg-rose-500 text-white'}`}
            >
              {confirmar === 'cargar' ? 'Sí, cargar' : 'Sí, quitar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={() => setConfirmar('cargar')}
            disabled={demoDataCount >= demoDataTotal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            Cargar datos de ejemplo
          </button>
          <button
            onClick={() => setConfirmar('quitar')}
            disabled={demoDataCount === 0}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-rose-400 font-semibold text-sm rounded-xl border border-rose-500/30 transition"
          >
            <Trash2 className="w-4 h-4" />
            Quitar datos de ejemplo
          </button>
        </div>
      )}
    </section>
  );
}
