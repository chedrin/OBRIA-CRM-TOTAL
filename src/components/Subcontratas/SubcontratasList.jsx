import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Percent,
  FileText,
  Sparkles,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  DollarSign,
  Upload,
  RefreshCw,
  Sliders,
  Database
} from 'lucide-react';
import confetti from 'canvas-confetti';

const SIMULATED_NEW_QUOTES = [
  {
    id: 'sim-carpinteria',
    subcontrata: 'Carpintería y Maderas Robles SL',
    gremio: 'Carpintería',
    archivoNombre: 'Tarifas_Puertas_Tarimas_2026.pdf',
    resumen: 'Actualización de costes de puertas de paso block lacadas (+12%) y tarimas laminadas AC5 (+9%) por costes de tablero hidrófugo.',
    margenDefecto: 25,
    partidasDetectadas: [
      { codigo: 'CAR-01', concepto: 'Suministro y colocación de puerta de paso maciza block lacada blanco 72.5cm', unidad: 'ud', precioAnterior: 215.00, nuevoPrecioSubcontrata: 240.00, variacionPct: 11.6, margenConfiguradoPct: 25, nuevoPvpCliente: 300.00 },
      { codigo: 'CAR-02', concepto: 'Instalación de suelo laminado AC5 alta resistencia con rodapié lacado', unidad: 'm²', precioAnterior: 19.00, nuevoPrecioSubcontrata: 21.00, variacionPct: 10.5, margenConfiguradoPct: 25, nuevoPvpCliente: 26.25 },
      { codigo: 'CAR-03', concepto: 'Frente de armario empotrado 2 puertas correderas suelo-techo', unidad: 'ud', precioAnterior: 550.00, nuevoPrecioSubcontrata: 620.00, variacionPct: 12.7, margenConfiguradoPct: 30, nuevoPvpCliente: 806.00 }
    ]
  },
  {
    id: 'sim-fontaneria',
    subcontrata: 'ClimaTec Fontanería y Aerotermia',
    gremio: 'Fontanería',
    archivoNombre: 'Presupuesto_Fontaneria_Otoño_ClimaTec.pdf',
    resumen: 'Incremento en accesorios multicapa y latón. Platos de ducha de resina pizarra con descuento por volumen.',
    margenDefecto: 30,
    partidasDetectadas: [
      { codigo: 'FON-01', concepto: 'Punto de agua fría y caliente con tubería multicapa aislada', unidad: 'ud', precioAnterior: 58.00, nuevoPrecioSubcontrata: 65.00, variacionPct: 12.1, margenConfiguradoPct: 30, nuevoPvpCliente: 84.50 },
      { codigo: 'FON-02', concepto: 'Punto de desagüe en PVC insonorizado de 40mm/50mm', unidad: 'ud', precioAnterior: 40.00, nuevoPrecioSubcontrata: 45.00, variacionPct: 12.5, margenConfiguradoPct: 30, nuevoPvpCliente: 58.50 },
      { codigo: 'FON-03', concepto: 'Instalación de plato de ducha resina pizarra con válvula sifónica gran caudal', unidad: 'ud', precioAnterior: 130.00, nuevoPrecioSubcontrata: 120.00, variacionPct: -7.7, margenConfiguradoPct: 30, nuevoPvpCliente: 156.00 }
    ]
  }
];

export default function SubcontratasList() {
  const {
    subcontratasPresupuestos,
    setSubcontratasPresupuestos,
    basePrecios,
    setBasePrecios,
    applySubcontrataPresupuesto,
    showNotification
  } = useApp();

  const [activeTab, setActiveTab] = useState('subcontratas_inbox'); // subcontratas_inbox, base_precios
  const [selectedSubPresId, setSelectedSubPresId] = useState(subcontratasPresupuestos[0]?.id || null);
  const [searchPrecios, setSearchPrecios] = useState('');
  const [filterGremio, setFilterGremio] = useState('todos');

  // Interactive Margin Customization for selected subquote
  const [customMargins, setCustomMargins] = useState({});
  const [globalMarginInput, setGlobalMarginInput] = useState(25);

  const selectedSubPres = subcontratasPresupuestos.find(sp => sp.id === selectedSubPresId);

  const handleSimulateNewQuote = (quoteData) => {
    const newQuote = {
      ...quoteData,
      id: `subpres-${Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      estado: 'analizado'
    };
    setSubcontratasPresupuestos(prev => [newQuote, ...prev]);
    setSelectedSubPresId(newQuote.id);
    showNotification(`Presupuesto de "${newQuote.subcontrata}" recibido y analizado por IA.`);
  };

  const handleUpdateMarginForItem = (codigo, marginPct) => {
    setCustomMargins(prev => ({
      ...prev,
      [codigo]: Number(marginPct)
    }));
  };

  const handleApplyToDatabase = (subPres) => {
    if (!subPres) return;

    const itemsToApply = (subPres.partidasDetectadas || []).map(p => {
      const margin = customMargins[p.codigo] !== undefined ? customMargins[p.codigo] : p.margenConfiguradoPct;
      return {
        ...p,
        margenConfiguradoPct: margin
      };
    });

    applySubcontrataPresupuesto(subPres.id, itemsToApply);

    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.6 }
    });
  };

  const filteredBasePrecios = basePrecios.filter(bp => {
    const matchesGremio = filterGremio === 'todos' || bp.gremio === filterGremio || bp.capitulo === filterGremio;
    const matchesSearch =
      bp.codigo.toLowerCase().includes(searchPrecios.toLowerCase()) ||
      bp.concepto.toLowerCase().includes(searchPrecios.toLowerCase()) ||
      bp.capitulo.toLowerCase().includes(searchPrecios.toLowerCase());
    return matchesGremio && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Percent className="w-7 h-7 text-indigo-400" />
            <span>Presupuestos de Subcontratas y Base de Precios</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Analiza presupuestos de electricistas, pintores, carpinteros y fontaneros, y actualiza los precios de coste y venta en la base de datos aplicando el margen comercial que configures.
          </p>
        </div>

        {/* Quick simulator dropdown */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSimulateNewQuote(SIMULATED_NEW_QUOTES[0])}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/20"
          >
            <Upload className="w-4 h-4" />
            <span>Recibir Presupuesto Carpintería</span>
          </button>
          <button
            onClick={() => handleSimulateNewQuote(SIMULATED_NEW_QUOTES[1])}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition border border-slate-700"
          >
            <Upload className="w-4 h-4" />
            <span>Recibir Presupuesto Fontanería</span>
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 border-b border-slate-800 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('subcontratas_inbox')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'subcontratas_inbox'
              ? 'border-indigo-400 text-indigo-400 bg-slate-900/60 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Presupuestos Recibidos de Gremios ({subcontratasPresupuestos.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('base_precios')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'base_precios'
              ? 'border-amber-400 text-amber-400 bg-slate-900/60 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Base de Precios Oficial de la Empresa ({basePrecios.length} partidas)</span>
        </button>
      </div>

      {/* TAB 1: SUBCONTRATAS QUOTES & MARGIN ADJUSTER */}
      {activeTab === 'subcontratas_inbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Quotes List (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Presupuestos Recibidos de Oficios
            </span>

            {subcontratasPresupuestos.map((sub) => {
              const isSelected = selectedSubPresId === sub.id;
              const isAplicado = sub.estado === 'aplicado';

              return (
                <div
                  key={sub.id}
                  onClick={() => setSelectedSubPresId(sub.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition shadow-sm space-y-2.5 ${
                    isSelected
                      ? 'bg-slate-900 border-indigo-400 ring-2 ring-indigo-400/20'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase bg-indigo-500/10 px-2 py-0.5 rounded">
                      {sub.gremio}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      isAplicado ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {isAplicado ? '✓ Precios Aplicados' : '⚡ Pendiente'}
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-sm">{sub.subcontrata}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2">{sub.resumen}</p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800">
                    <span>{sub.partidasDetectadas?.length || 0} partidas extraídas</span>
                    <span>{sub.fecha}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Comparison & Margin Tool (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedSubPres ? (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
                
                {/* Header of Selected Quote */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded">
                        {selectedSubPres.gremio}
                      </span>
                      <h2 className="text-lg font-bold text-white">{selectedSubPres.subcontrata}</h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Archivo: <strong className="text-slate-300">{selectedSubPres.archivoNombre}</strong> · Fecha: {selectedSubPres.fecha}
                    </p>
                  </div>

                  {selectedSubPres.estado === 'aplicado' ? (
                    <span className="px-3.5 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Actualizado en la Base de Precios</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleApplyToDatabase(selectedSubPres)}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs sm:text-sm rounded-xl transition shadow-lg shadow-emerald-600/25 active:scale-95 flex items-center gap-2"
                    >
                      <Database className="w-4 h-4" />
                      <span>Aplicar a la Base de Precios con Margen</span>
                    </button>
                  )}
                </div>

                {/* Subcontractor Summary Note */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 block">Análisis Automático del Documento</span>
                  <p>{selectedSubPres.resumen}</p>
                </div>

                {/* Partidas Comparison Table */}
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Cód.</th>
                          <th className="py-2.5 px-3">Concepto / Partida</th>
                          <th className="py-2.5 px-3 text-right">Coste Anterior</th>
                          <th className="py-2.5 px-3 text-right">Nuevo Coste</th>
                          <th className="py-2.5 px-3 text-center">Variación</th>
                          <th className="py-2.5 px-3 text-center">Margen Configurado</th>
                          <th className="py-2.5 px-3 text-right">Nuevo PVP Cliente</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {(selectedSubPres.partidasDetectadas || []).map((partida) => {
                          const currentMargin = customMargins[partida.codigo] !== undefined ? customMargins[partida.codigo] : partida.margenConfiguradoPct;
                          const calculatedPvp = Number((partida.nuevoPrecioSubcontrata * (1 + currentMargin / 100)).toFixed(2));
                          const isUp = partida.variacionPct > 0;

                          return (
                            <tr key={partida.codigo} className="hover:bg-slate-800/40">
                              <td className="py-2.5 px-3 font-mono font-bold text-amber-400">{partida.codigo}</td>
                              <td className="py-2.5 px-3 font-medium text-white max-w-xs">{partida.concepto}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-400">{partida.precioAnterior.toFixed(2)} €</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-white">{partida.nuevoPrecioSubcontrata.toFixed(2)} €</td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                  isUp ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                                }`}>
                                  {isUp ? `+${partida.variacionPct}%` : `${partida.variacionPct}%`}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    min="5"
                                    max="80"
                                    step="1"
                                    value={currentMargin}
                                    onChange={(e) => handleUpdateMarginForItem(partida.codigo, e.target.value)}
                                    className="w-14 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs text-amber-400 font-bold"
                                  />
                                  <span className="text-slate-400">%</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-black text-amber-400 text-sm">
                                {calculatedPvp.toFixed(2)} €
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Explanation Banner */}
                <div className="bg-gradient-to-r from-slate-950 to-indigo-950/20 p-4 rounded-xl border border-indigo-500/20 flex items-start gap-3 text-xs text-slate-300">
                  <Sliders className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>Ajuste Dinámico de Márgenes:</strong> Modifica el porcentaje de margen para cada partida o mantén el configurado. Al pulsar en <strong>"Aplicar a la Base de Precios"</strong>, todos los futuros presupuestos de obra que uses con estas partidas utilizarán automáticamente el nuevo coste y el PVP comercial actualizado.
                  </p>
                </div>

              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center text-slate-400">
                Selecciona un presupuesto recibido a la izquierda.
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: BASE DE PRECIOS OFICIAL (CATÁLOGO COMPLETO) */}
      {activeTab === 'base_precios' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow space-y-4 p-5">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-400" />
                <span>Catálogo de Precios Unitarios de Obra</span>
              </h2>
              <p className="text-xs text-slate-400">
                Precios de coste de subcontrata/material, margen aplicado y precio de venta al público en presupuestos
              </p>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar partida, código o unidad..."
                  value={searchPrecios}
                  onChange={(e) => setSearchPrecios(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white"
                />
              </div>

              <select
                value={filterGremio}
                onChange={(e) => setFilterGremio(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-semibold"
              >
                <option value="todos">Todos los Gremios</option>
                <option value="Albañilería">Albañilería & Demolición</option>
                <option value="Fontanería">Fontanería</option>
                <option value="Electricidad">Electricidad</option>
                <option value="Pintura">Pintura</option>
                <option value="Carpintería">Carpintería</option>
              </select>
            </div>
          </div>

          {/* Catalog Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Capítulo</th>
                    <th className="py-2.5 px-3">Concepto Detallado</th>
                    <th className="py-2.5 px-3 text-center">Unidad</th>
                    <th className="py-2.5 px-3 text-right">Coste Subcontrata</th>
                    <th className="py-2.5 px-3 text-center">Margen Comercial</th>
                    <th className="py-2.5 px-3 text-right">PVP Cliente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredBasePrecios.map((bp) => (
                    <tr key={bp.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-400 whitespace-nowrap">{bp.codigo}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-semibold">
                          {bp.capitulo}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-white">{bp.concepto}</td>
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono whitespace-nowrap">{bp.unidad}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300 whitespace-nowrap">{bp.costeSubcontrata.toFixed(2)} €</td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className="bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded text-[11px]">
                          +{bp.margenPct}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-amber-400 text-sm whitespace-nowrap">
                        {bp.precioVenta.toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
