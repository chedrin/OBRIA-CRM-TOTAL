import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Calculator,
  Plus,
  FileText,
  Sparkles,
  ArrowRight,
  Receipt,
  CheckCircle2,
  Clock,
  Trash2,
  Edit,
  Download,
  Share2,
  Calendar,
  User,
  MapPin,
  Camera,
  Mic
} from 'lucide-react';
import PresupuestoGeneratorAI from './PresupuestoGeneratorAI';

export default function PresupuestosList() {
  const {
    presupuestos,
    convertPresupuestoToFactura,
    setPdfModalData,
    setActiveTab
  } = useApp();

  const [viewMode, setViewMode] = useState('list'); // list o new_ai
  const [showConvertModal, setShowConvertModal] = useState(null); // presupuesto object
  const [convertPorcentaje, setConvertPorcentaje] = useState(40);
  const [convertTipo, setConvertTipo] = useState('Certificación 1 (Anticipo 40% Inicio Obra)');

  if (viewMode === 'new_ai') {
    return <PresupuestoGeneratorAI onCancel={() => setViewMode('list')} onCreated={() => setViewMode('list')} />;
  }

  const handleOpenConvertModal = (pres) => {
    setShowConvertModal(pres);
    setConvertPorcentaje(40);
    setConvertTipo('Certificación 1 (Anticipo 40% Inicio Obra)');
  };

  const handleConfirmConvert = () => {
    if (!showConvertModal) return;
    convertPresupuestoToFactura(showConvertModal.id, convertTipo, Number(convertPorcentaje));
    setShowConvertModal(null);
    setActiveTab('facturas');
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Calculator className="w-7 h-7 text-amber-400" />
            <span>Presupuestos de Obras y Reformas</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Genera presupuestos detallados por partidas mediante IA a partir de fotos y notas de voz, y pásalos a factura en 1 solo clic.
          </p>
        </div>

        <button
          onClick={() => setViewMode('new_ai')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl transition shadow-lg shadow-amber-500/20 active:scale-95"
        >
          <Sparkles className="w-4 h-4" />
          <span>Nuevo Presupuesto con IA</span>
        </button>
      </div>

      {/* Hero Banner for AI Generator */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950/30 p-5 rounded-2xl border border-amber-500/30 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Generador Inteligente con Fotos y Audio</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Sube fotos del baño o vivienda, dicta los trabajos necesarios y la IA desglosa capítulos, partidas, mediciones y márgenes automáticamente.
            </p>
          </div>
        </div>

        <button
          onClick={() => setViewMode('new_ai')}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shrink-0 transition"
        >
          <Camera className="w-4 h-4" />
          <Mic className="w-4 h-4" />
          <span>Generar con IA Ahora</span>
        </button>
      </div>

      {/* Presupuestos List */}
      <div className="space-y-4">
        {presupuestos.map((pres) => {
          const isAceptado = pres.estado === 'aceptado';
          const isFacturado = pres.estado === 'facturado';

          return (
            <div
              key={pres.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl shadow-sm transition space-y-4"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                    {pres.numero}
                  </span>
                  <div>
                    <h3 className="font-bold text-white text-base">{pres.obraTitulo}</h3>
                    <p className="text-xs text-slate-400">
                      Cliente: <strong className="text-slate-300">{pres.cliente}</strong> ({pres.nif || 'NIF pendiente'}) · Fecha: {pres.fecha}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    isFacturado
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : isAceptado
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {pres.estado}
                  </span>
                </div>
              </div>

              {/* Partidas Preview */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Resumen de Capítulos y Partidas ({pres.partidas?.length || 0} unidades de obra):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {(pres.partidas || []).slice(0, 6).map((p, idx) => (
                    <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-xs">
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span className="font-mono text-amber-400/80">{p.codigo}</span>
                        <span>{p.cantidad} {p.unidad}</span>
                      </div>
                      <p className="text-slate-200 font-medium truncate mt-0.5">{p.concepto}</p>
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span className="text-slate-500">PVP: {p.precioVenta} €</span>
                        <span className="font-bold text-white">{p.total?.toLocaleString('es-ES')} €</span>
                      </div>
                    </div>
                  ))}
                </div>
                {(pres.partidas?.length || 0) > 6 && (
                  <p className="text-[11px] text-slate-500 italic">+ {pres.partidas.length - 6} partidas más en el presupuesto completo</p>
                )}
              </div>

              {/* Financial Bottom & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-6 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Base Imponible</span>
                    <span className="font-semibold text-slate-200 text-sm">{pres.baseImponible?.toLocaleString('es-ES')} €</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">IVA ({pres.tipoIvaPct}%)</span>
                    <span className="font-semibold text-slate-300 text-sm">{pres.cuotaIva?.toLocaleString('es-ES')} €</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Total Presupuesto</span>
                    <span className="font-black text-amber-400 text-base">{pres.totalConIva?.toLocaleString('es-ES')} €</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* View PDF */}
                  <button
                    onClick={() => setPdfModalData({ type: 'presupuesto', data: pres })}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Ver Presupuesto PDF</span>
                  </button>

                  {/* 1-Click Convert to Invoice */}
                  <button
                    onClick={() => handleOpenConvertModal(pres)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-600/20"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Pasar a Factura (1 Clic)</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal 1-Click Convert to Invoice */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <span>Emitir Factura desde Presupuesto</span>
              </h3>
              <button onClick={() => setShowConvertModal(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1">
              <span className="font-mono text-amber-400">{showConvertModal.numero}</span>
              <h4 className="font-bold text-white text-sm">{showConvertModal.obraTitulo}</h4>
              <p className="text-slate-400">Cliente: {showConvertModal.cliente} ({showConvertModal.nif})</p>
              <p className="text-slate-400">Total presupuesto: <strong className="text-white">{showConvertModal.totalConIva?.toLocaleString('es-ES')} €</strong></p>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Tipo de Factura a Generar</label>
                <select
                  value={convertTipo}
                  onChange={(e) => setConvertTipo(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="Certificación 1 (Anticipo 40% Inicio Obra)">Certificación 1: Anticipo 40% (Inicio de obra)</option>
                  <option value="Certificación 2 (Avance 40% Mitad de Obra)">Certificación 2: Avance 40% (Instalaciones y alicatados)</option>
                  <option value="Certificación Final 20% (Fin de Obra y Llaves)">Certificación 3: Final 20% (Entrega de llaves)</option>
                  <option value="Factura Completa Ordinaria 100%">Factura Ordinaria Completa (100%)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Porcentaje a Facturar</label>
                <div className="flex items-center gap-2">
                  {[20, 40, 50, 100].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        setConvertPorcentaje(pct);
                        if (pct === 40) setConvertTipo('Certificación 1 (Anticipo 40% Inicio Obra)');
                        else if (pct === 20) setConvertTipo('Certificación Final 20% (Fin de Obra y Llaves)');
                        else if (pct === 100) setConvertTipo('Factura Completa Ordinaria 100%');
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                        convertPorcentaje === pct ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculated preview */}
              <div className="bg-slate-950 p-3 rounded-xl border border-emerald-500/30 flex items-center justify-between text-xs">
                <span className="text-slate-300">Total a Facturar ({convertPorcentaje}%):</span>
                <span className="font-extrabold text-emerald-400 text-base">
                  {((showConvertModal.totalConIva * convertPorcentaje) / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowConvertModal(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmConvert}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/20"
              >
                Generar Factura Oficial
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
