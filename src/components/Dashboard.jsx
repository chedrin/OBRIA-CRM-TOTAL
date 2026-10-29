import React from 'react';
import { useApp } from '../context/AppContext';
import EmptyState from './Common/EmptyState';
import {
  HardHat,
  Mic,
  FileSpreadsheet,
  TrendingUp,
  Clock,
  ArrowRight,
  Percent,
  Calendar,
  Euro,
  FileText,
  Plus
} from 'lucide-react';

// Tarjeta entera clicable y accesible con teclado (Enter / espacio).
const clickable = (fn) => ({
  role: 'button',
  tabIndex: 0,
  onClick: fn,
  onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }
});

const eur = (n) => `${(n || 0).toLocaleString('es-ES')} €`;

// Tarjeta de indicador: título, icono, cifra principal y una línea de detalle.
function KpiCard({ label, icon: Icon, iconClass, value, valueClass = 'text-white', hint, hintClass = 'text-slate-400', footer }) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm hover:border-slate-700 transition min-w-0">
      <div className="flex items-center justify-between gap-2 text-slate-400 mb-2 sm:mb-3">
        <span className="text-xs font-medium leading-tight">{label}</span>
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={`text-xl sm:text-3xl font-black tabular-nums ${valueClass}`}>{value}</span>
        {hint && <span className={`text-xs ${hintClass}`}>{hint}</span>}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] sm:text-xs">
        {footer}
      </div>
    </div>
  );
}

// Tarjeta lateral con cabecera (icono, título y un único enlace de acceso al módulo).
function Widget({ icon: Icon, iconClass, title, action, onAction, actionClass = 'text-amber-400', children }) {
  return (
    <section className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
            <Icon className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-white text-sm truncate">{title}</h3>
        </div>
        {action && (
          <button onClick={onAction} className={`text-xs font-semibold whitespace-nowrap hover:underline shrink-0 ${actionClass}`}>
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const {
    obras,
    facturas,
    mensajesInbox,
    subcontratasPresupuestos,
    setActiveTab,
    setSelectedObraId
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

  const endingObra = obrasActivas.length
    ? [...obrasActivas].sort((a, b) => new Date(a.fechaFinEstimada || '2026-12-31') - new Date(b.fechaFinEstimada || '2026-12-31'))[0]
    : null;
  const daysRemaining = endingObra?.fechaFinEstimada
    ? Math.max(0, Math.round((new Date(endingObra.fechaFinEstimada) - new Date()) / 86400000))
    : 12;

  return (
    <div className="space-y-6">

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="Obras en curso"
          icon={HardHat}
          iconClass="bg-amber-500/10 text-amber-400"
          value={obrasActivas.length}
          hint="obras activas"
          footer={<><span className="text-slate-400">Presupuestado</span><span className="font-semibold text-slate-200">{eur(totalPresupuestadoActivas)}</span></>}
        />
        <KpiCard
          label="Margen real estimado"
          icon={TrendingUp}
          iconClass="bg-emerald-500/10 text-emerald-400"
          value={`${margenMedio}%`}
          valueClass="text-emerald-400"
          hint="Objetivo: 32%"
          hintClass="text-emerald-400 font-medium"
          footer={<><span className="text-slate-400">Coste ejecutado</span><span className="font-semibold text-slate-200">{eur(totalCosteRealActivas)}</span></>}
        />
        <KpiCard
          label="Facturación 4T (oct-dic)"
          icon={Euro}
          iconClass="bg-blue-500/10 text-blue-400"
          value={eur(facturadoTotal4T)}
          footer={<><span className="text-emerald-400 font-medium">Cobrado: {eur(facturadoCobrado4T)}</span><span className="text-amber-400 font-medium">Pendiente: {eur(facturadoTotal4T - facturadoCobrado4T)}</span></>}
        />
        <KpiCard
          label="Audios y avisos IA"
          icon={Mic}
          iconClass="bg-amber-500/10 text-amber-400"
          value={mensajesPendientes.length}
          valueClass="text-amber-400"
          hint="por procesar"
          footer={<><span className="text-slate-400">Subcontratas nuevas</span><span className="font-semibold text-indigo-400">{subPresPendientes.length} presupuestos</span></>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Obras */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 min-w-0">
              <HardHat className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="truncate">Obras en ejecución y estado</span>
            </h2>
            <button
              onClick={() => setActiveTab('obras')}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold whitespace-nowrap shrink-0"
            >
              <span>Ver todas ({obras.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {obras.length === 0 && (
            <EmptyState icon={HardHat} title="Todavía no hay obras" actionLabel="Ir a Obras" actionIcon={Plus} onAction={() => setActiveTab('obras')}>
              Crea la primera obra o convierte un presupuesto aceptado para ver aquí su avance, costes y fecha de entrega.
            </EmptyState>
          )}

          <div className="space-y-3">
            {obras.map((obra) => {
              const pct = obra.progreso || 0;
              const isEnCurso = obra.estado === 'en_curso';
              const isFinalizada = obra.estado === 'finalizada';

              return (
                <div
                  key={obra.id}
                  {...clickable(() => handleOpenObra(obra.id))}
                  className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 block w-full text-left bg-slate-900 border border-slate-800 hover:border-amber-500/40 p-4 sm:p-5 rounded-2xl transition shadow-sm hover:shadow-md group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded shrink-0">{obra.codigo}</span>
                        <h3 className="font-bold text-white group-hover:text-amber-400 transition text-base truncate">{obra.titulo}</h3>
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
                      <span>Entrega: {obra.fechaEntregaCliente || obra.fechaFinEstimada}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Columna lateral: un acceso por módulo */}
        <div className="space-y-4">

          <Widget icon={Clock} iconClass="bg-amber-500/20 text-amber-400" title="Planificación IA">
            {endingObra ? (
              <div
                {...clickable(() => handleOpenObra(endingObra.id))}
                className="cursor-pointer w-full text-left bg-slate-950 hover:bg-slate-800/60 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-300 transition"
              >
                <span className="text-emerald-400 font-bold block mb-0.5">Obra más próxima a finalizar</span>
                <p className="font-medium text-white truncate">{endingObra.titulo}</p>
                <p className="text-slate-400 mt-0.5">Quedan <strong className="text-amber-400">{daysRemaining} días</strong> para liberar equipo.</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Sin obras en ejecución. Cuando haya alguna, aquí verás cuál termina antes para liberar equipo.</p>
            )}
          </Widget>

          <Widget icon={Mic} iconClass="bg-amber-500/20 text-amber-400" title="Audio y email" action="Abrir bandeja" onAction={() => setActiveTab('inbox')}>
            <p className="text-xs text-slate-400">
              La IA analiza notas de voz de clientes y operarios, calcula materiales necesarios y los añade a la obra o presupuesto.
            </p>
            {mensajesInbox.length > 0 && (
              <div className="space-y-2.5">
                {mensajesInbox.slice(0, 2).map((msg) => (
                  <div
                    key={msg.id}
                    {...clickable(() => setActiveTab('inbox'))}
                    className="cursor-pointer block w-full text-left p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-amber-400 truncate">{msg.remitente}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{msg.audioDuracion ? `🔊 ${msg.audioDuracion}` : '✉️ Email'}</span>
                    </div>
                    <p className="text-slate-300 line-clamp-2 italic">
                      "{msg.audioTranscripcion || msg.cuerpo}"
                    </p>
                    <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                      <span className="text-slate-400 font-medium truncate">{msg.obraTitulo}</span>
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] shrink-0 ${
                        msg.estadoProcesado ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {msg.estadoProcesado ? '✓ Procesado' : '⚡ Requiere cálculo'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Widget>

          <Widget icon={Percent} iconClass="bg-indigo-500/20 text-indigo-400" title="Subcontratas" action="Base de precios" onAction={() => setActiveTab('subcontratas')} actionClass="text-indigo-400">
            <p className="text-xs text-slate-400">
              Analizador automático de presupuestos de electricistas, fontaneros, carpinteros y pintores con ajuste de margen comercial configurado.
            </p>
            {subcontratasPresupuestos.slice(0, 1).map((sub) => (
              <div key={sub.id} className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-xs space-y-2">
                <div className="flex items-center justify-between gap-2 font-semibold">
                  <span className="text-white truncate">{sub.subcontrata}</span>
                  <span className="text-indigo-400 shrink-0">{sub.gremio}</span>
                </div>
                <p className="text-[11px] text-slate-300">{sub.resumen}</p>
                <p className="text-[10px] text-amber-400 font-medium">Margen configurado: +25%</p>
              </div>
            ))}
          </Widget>

          <Widget icon={FileSpreadsheet} iconClass="bg-emerald-500/20 text-emerald-400" title="Cierre trimestral gestoría">
            <p className="text-xs text-slate-300">
              Modelos 303 (IVA) y 130 (IRPF) calculados al instante con libros de ventas y compras listos para enviar por email.
            </p>
            <button
              onClick={() => setActiveTab('gestoria')}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>Ver documentación trimestral</span>
            </button>
          </Widget>

        </div>

      </div>
    </div>
  );
}
