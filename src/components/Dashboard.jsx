import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Building2,
  HardHat,
  Mic,
  Calculator,
  Receipt,
  FileSpreadsheet,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Users,
  Percent,
  Calendar,
  Euro,
  FileText
} from 'lucide-react';

export default function Dashboard() {
  const {
    obras,
    facturas,
    mensajesInbox,
    subcontratasPresupuestos,
    setActiveTab,
    setSelectedObraId,
    currentUser
  } = useApp();

  // Financial Calculations
  const obrasActivas = obras.filter(o => o.estado === 'en_curso');
  const totalPresupuestadoActivas = obrasActivas.reduce((s, o) => s + (o.presupuestoTotal || 0), 0);
  const totalCosteRealActivas = obrasActivas.reduce((s, o) => s + (o.costeRealActual || 0), 0);
  const margenMedio = totalPresupuestadoActivas > 0
    ? Number((((totalPresupuestadoActivas - totalCosteRealActivas) / totalPresupuestadoActivas) * 100).toFixed(1))
    : 35.0;

  // Facturas 4T / Recientes
  const facturas4T = facturas.filter(f => f.trimestre === '4T');
  const facturadoTotal4T = facturas4T.reduce((s, f) => s + f.totalFactura, 0);
  const facturadoCobrado4T = facturas4T.filter(f => f.estadoCobro === 'cobrada').reduce((s, f) => s + f.totalFactura, 0);
  const facturadoPendienteTotal = facturas.filter(f => f.estadoCobro === 'pendiente').reduce((s, f) => s + f.totalFactura, 0);

  // Unprocessed messages
  const mensajesPendientes = mensajesInbox.filter(m => !m.estadoProcesado);
  const subPresPendientes = subcontratasPresupuestos.filter(s => s.estado === 'pendiente');

  const handleOpenObra = (id) => {
    setSelectedObraId(id);
    setActiveTab('obras');
  };

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950/40 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs tracking-wider uppercase mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Panel Operativo del Constructor</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Buenos días, {currentUser ? currentUser.fullName : 'Manuel'}
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Tienes <strong className="text-amber-400">{obrasActivas.length} obras en ejecución</strong>, {mensajesPendientes.length} audios/mensajes de obra pendientes de procesar y la facturación del 4T lista para la gestoría.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setActiveTab('inbox')}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition shadow-lg shadow-amber-500/20 active:scale-95"
            >
              <Mic className="w-4 h-4" />
              <span>Grabar / Oír Audio IA</span>
            </button>
            <button
              onClick={() => setActiveTab('presupuestos')}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold text-xs sm:text-sm rounded-xl border border-amber-500/30 transition active:scale-95"
            >
              <Calculator className="w-4 h-4" />
              <span>Presupuesto con IA</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Obras en curso */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium">Obras en Curso</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <HardHat className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white">{obrasActivas.length}</span>
            <span className="text-xs text-slate-400">obras activas</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Total presupuestado:</span>
            <span className="font-semibold text-slate-200">{totalPresupuestadoActivas.toLocaleString('es-ES')} €</span>
          </div>
        </div>

        {/* Card 2: Margen Medio */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium">Margen Real Estimado</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">{margenMedio}%</span>
            <span className="text-xs text-emerald-500 font-medium">Objetivo: 32%</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Coste real ejecutado:</span>
            <span className="font-semibold text-slate-200">{totalCosteRealActivas.toLocaleString('es-ES')} €</span>
          </div>
        </div>

        {/* Card 3: Facturación Trimestre 4T */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium">Facturación 4T (Oct-Dic)</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Euro className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white">{facturadoTotal4T.toLocaleString('es-ES')} €</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-emerald-400 font-medium">Cobrado: {facturadoCobrado4T.toLocaleString('es-ES')} €</span>
            <span className="text-amber-400 font-medium">Pendiente: {(facturadoTotal4T - facturadoCobrado4T).toLocaleString('es-ES')} €</span>
          </div>
        </div>

        {/* Card 4: Alertas e Inbox IA */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium">Audios & Avisos IA</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center relative">
              <Mic className="w-5 h-5" />
              {mensajesPendientes.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping"></span>
              )}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-400">{mensajesPendientes.length}</span>
            <span className="text-xs text-slate-300">por procesar</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Subcontratas nuevas:</span>
            <span className="font-semibold text-indigo-400">{subPresPendientes.length} presupuestos</span>
          </div>
        </div>
      </div>

      {/* Main Content 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Active Works Overview (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <HardHat className="w-5 h-5 text-amber-400" />
              <span>Obras en Ejecución y Estado</span>
            </h2>
            <button
              onClick={() => setActiveTab('obras')}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
            >
              <span>Ver todas ({obras.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {obras.map((obra) => {
              const pct = obra.progreso || 0;
              const isEnCurso = obra.estado === 'en_curso';
              const isFinalizada = obra.estado === 'finalizada';

              return (
                <div
                  key={obra.id}
                  onClick={() => handleOpenObra(obra.id)}
                  className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 p-4 sm:p-5 rounded-2xl cursor-pointer transition shadow-sm hover:shadow-md group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">{obra.codigo}</span>
                        <h3 className="font-bold text-white group-hover:text-amber-400 transition text-base">{obra.titulo}</h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{obra.direccion} · Cliente: <strong className="text-slate-300">{obra.cliente}</strong></p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        isEnCurso
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : isFinalizada
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {obra.estado.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Progreso global</span>
                      <span className="font-bold text-slate-200">{pct}% completado</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Financials & Quick Tags */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-4 text-slate-300">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Presupuesto</span>
                        <span className="font-bold text-white">{obra.presupuestoTotal?.toLocaleString('es-ES')} €</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Coste Actual</span>
                        <span className="font-semibold text-slate-300">{obra.costeRealActual?.toLocaleString('es-ES')} €</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Margen Real</span>
                        <span className="font-bold text-emerald-400">{obra.margenRealPct || 35}%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Entrega: {obra.fechaFinEstimada}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: AI Voice Inbox & Subcontracts Quick Watch (1 col) */}
        <div className="space-y-4">
          
          {/* Planificación & Capacidad IA Widget */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-sm">Planificación IA</h3>
              </div>
              <button
                onClick={() => setActiveTab('obras')}
                className="text-xs text-amber-400 hover:underline font-medium"
              >
                Ver Obras
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-300">🚧 Obras activas:</span>
                <span className="text-amber-400 font-mono text-sm">{obrasActivas.length}</span>
              </div>

              {obrasActivas.length > 0 && (() => {
                const endingObra = [...obrasActivas].sort((a, b) => new Date(a.fechaFinEstimada || '2026-12-31') - new Date(b.fechaFinEstimada || '2026-12-31'))[0];
                const daysRemaining = endingObra?.fechaFinEstimada
                  ? Math.max(0, Math.round((new Date(endingObra.fechaFinEstimada) - new Date()) / 86400000))
                  : 12;
                return (
                  <div className="pt-1.5 border-t border-slate-800/80 text-[11px] text-slate-300">
                    <span className="text-emerald-400 font-bold block mb-0.5">✅ Obra más próxima a finalizar:</span>
                    <p className="font-medium text-white truncate">{endingObra.titulo}</p>
                    <p className="text-slate-400 mt-0.5">Quedan <strong className="text-amber-400">{daysRemaining} días</strong> para liberar equipo.</p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Audio & Email AI Assistant Quick Widget */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Mic className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-sm">Necesidades por Audio / Email</h3>
              </div>
              <button
                onClick={() => setActiveTab('inbox')}
                className="text-xs text-amber-400 hover:underline font-medium"
              >
                Abrir Inbox
              </button>
            </div>

            <p className="text-xs text-slate-400">
              La IA analiza notas de voz de clientes y peones/oficiales, calcula materiales necesarios y los añade a la obra o presupuesto:
            </p>

            <div className="space-y-2.5">
              {mensajesInbox.slice(0, 2).map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => setActiveTab('inbox')}
                  className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 cursor-pointer transition text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-400">{msg.remitente}</span>
                    <span className="text-[10px] text-slate-400">{msg.audioDuracion ? `🔊 ${msg.audioDuracion}` : '✉️ Email'}</span>
                  </div>
                  <p className="text-slate-300 line-clamp-2 italic">
                    "{msg.audioTranscripcion || msg.cuerpo}"
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="text-slate-400 font-medium truncate max-w-[180px]">{msg.obraTitulo}</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      msg.estadoProcesado ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {msg.estadoProcesado ? '✓ Procesado' : '⚡ Requiere cálculo'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveTab('inbox')}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Grabar o Simular Nota de Voz</span>
            </button>
          </div>

          {/* Subcontractor Price Updates Alert Widget */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-sm">Presupuestos Subcontratas</h3>
              </div>
              <button
                onClick={() => setActiveTab('subcontratas')}
                className="text-xs text-indigo-400 hover:underline font-medium"
              >
                Base de Precios
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Analizador automático de presupuestos de electricistas, fontaneros, carpinteros y pintores con ajuste de margen comercial configurado.
            </p>

            {subcontratasPresupuestos.slice(0, 1).map((sub) => (
              <div key={sub.id} className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-xs space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-white">{sub.subcontrata}</span>
                  <span className="text-indigo-400">{sub.gremio}</span>
                </div>
                <p className="text-[11px] text-slate-300">{sub.resumen}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-amber-400 font-medium">Margen configurado: +25%</span>
                  <button
                    onClick={() => setActiveTab('subcontratas')}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold transition"
                  >
                    Actualizar Precios
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Gestoria Ready Banner */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 p-5 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white text-sm">Cierre Trimestral Gestoría</h3>
            </div>
            <p className="text-xs text-slate-300">
              Modelos 303 (IVA) y 130 (IRPF) calculados al instante con libros de ventas y compras listos para enviar por email.
            </p>
            <button
              onClick={() => setActiveTab('gestoria')}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>Ver Documentación Trimestral</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
