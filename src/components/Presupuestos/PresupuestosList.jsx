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
  Mic,
  Send
} from 'lucide-react';
import PresupuestoGeneratorAI from './PresupuestoGeneratorAI';
import VisitaObraModal from './VisitaObraModal';
import ConsolaRevisionPresupuesto from './ConsolaRevisionPresupuesto';
import ConvertirObraModal from './ConvertirObraModal';
import PresupuestosListado from './PresupuestosListado';
import ViewModeSwitcher from '../Common/ViewModeSwitcher';
import SendDocumentModal from '../Common/SendDocumentModal';
import { generateExecutionPlanFromBudget } from '../../services/obraBudgetSyncService';

export default function PresupuestosList() {
  const {
    presupuestos,
    updatePresupuesto,
    addObra,
    convertPresupuestoToFactura,
    setPdfModalData,
    setActiveTab,
    showNotification
  } = useApp();

  const [viewMode, setViewMode] = useState('list'); // list, new_ai, revision_consola
  const [selectedQuoteId, setSelectedQuoteId] = useState(null);
  const [asistenteKey, setAsistenteKey] = useState(0); // al cambiar, el asistente IA 360° se vacía
  const [showConvertModal, setShowConvertModal] = useState(null); // presupuesto object
  const [quoteToSend, setQuoteToSend] = useState(null);
  const [presupuestoAObra, setPresupuestoAObra] = useState(null); // presupuesto pendiente de confirmar como obra
  const [convertPorcentaje, setConvertPorcentaje] = useState(40);
  const [convertTipo, setConvertTipo] = useState('Certificación 1 (Anticipo 40% Inicio Obra)');

  if (viewMode === 'new_ai') {
    return <PresupuestoGeneratorAI onCancel={() => setViewMode('list')} onCreated={() => setViewMode('list')} />;
  }

  if (viewMode === 'revision_consola' && selectedQuoteId) {
    return (
      <ConsolaRevisionPresupuesto
        quoteId={selectedQuoteId}
        onBack={() => setViewMode('list')}
      />
    );
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

  // El cliente acepta: se crea la obra con los datos confirmados en el modal.
  const handleAceptarPresupuesto = (pres, datosObra) => {
    updatePresupuesto(pres.id, { estado: 'aceptado' });

    // Plan canónico de fases y tareas a partir del presupuesto firmado (Single Source of Truth)
    const fasesFromPresupuesto = generateExecutionPlanFromBudget(pres).map(f => ({
      ...f,
      responsable: f.responsable && f.responsable !== 'Por asignar' ? f.responsable : datosObra.responsable
    }));

    addObra({
      titulo: datosObra.titulo,
      codigo: datosObra.codigo,
      cliente: pres.cliente,
      telefono: pres.telefono || '',
      email: pres.email || '',
      direccion: datosObra.direccion,
      tipo: 'Reforma Integral',
      estado: 'en_curso',
      progreso: 0,
      fechaInicio: datosObra.fechaInicio,
      fechaFinEstimada: datosObra.fechaFinEstimada,
      fechaEntregaCliente: datosObra.fechaEntregaCliente,
      responsable: datosObra.responsable,
      presupuestoTotal: datosObra.presupuestoTotal,
      costeRealActual: 0,
      margenEsperadoPct: pres.margenGlobalPct || 35,
      margenRealPct: pres.margenGlobalPct || 35,
      presupuestoId: pres.id,
      notas: `Obra creada tras la aceptación del presupuesto ${pres.numero}. Responsable: ${datosObra.responsable}.`,
      fases: fasesFromPresupuesto,
      necesidadesMateriales: [
        { id: `mat-${Date.now()}-1`, concepto: 'Materiales base iniciales', cantidad: 1, unidad: 'lote', costeEstimado: 500, proveedor: 'Por asignar' }
      ]
    });

    showNotification(`Presupuesto ${pres.numero} aceptado: obra ${datosObra.codigo} creada y en ejecución.`);
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

      </div>

      {/* Asistente IA 360° integrado en la página (antes era una ventana emergente) */}
      <VisitaObraModal
        key={asistenteKey}
        isOpen
        inline
        onClose={() => setAsistenteKey(k => k + 1)}
        onQuoteCreated={(newQuote) => {
          setAsistenteKey(k => k + 1);
          setSelectedQuoteId(newQuote.id);
          setViewMode('revision_consola');
        }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <h2 className="text-sm font-black text-slate-200 uppercase tracking-wider">
          Presupuestos guardados ({presupuestos.length})
        </h2>
        <ViewModeSwitcher />
      </div>
      {presupuestos.length === 0 && (
        <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">
          Aún no hay presupuestos. Completa los parámetros del cliente, graba o sube el audio de la visita arriba y pulsa "Generar Presupuesto con IA".
        </div>
      )}

      {presupuestos.length > 0 && <PresupuestosListado
        presupuestos={presupuestos}
        handlers={{
          onAceptar: (pres) => setPresupuestoAObra(pres),
          onRevisar: (pres) => {
            setSelectedQuoteId(pres.id);
            setViewMode('revision_consola');
          },
          onPdf: (pres) => setPdfModalData({ type: 'presupuesto', data: pres }),
          onEnviar: (pres) => setQuoteToSend(pres),
          onFacturar: (pres) => handleOpenConvertModal(pres)
        }}
      />}

      {/* Paso de confirmación: presupuesto aceptado -> obra activa */}
      {presupuestoAObra && (
        <ConvertirObraModal
          presupuesto={presupuestoAObra}
          onClose={() => setPresupuestoAObra(null)}
          onConfirm={(datosObra) => {
            handleAceptarPresupuesto(presupuestoAObra, datosObra);
            setPresupuestoAObra(null);
          }}
        />
      )}

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

      {/* Modal Enviar Presupuesto por Email / WhatsApp */}
      <SendDocumentModal
        isOpen={!!quoteToSend}
        onClose={() => setQuoteToSend(null)}
        document={quoteToSend}
        documentType="presupuesto"
      />

    </div>
  );
}
