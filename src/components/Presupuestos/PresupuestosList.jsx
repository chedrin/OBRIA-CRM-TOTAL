import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import PresupuestoGeneratorAI from './PresupuestoGeneratorAI';
import VisitaObraModal from './VisitaObraModal';
import ConsolaRevisionPresupuesto from './ConsolaRevisionPresupuesto';
import ConvertirObraModal from './ConvertirObraModal';
import PresupuestosListado from './PresupuestosListado';
import ViewModeSwitcher from '../Common/ViewModeSwitcher';
import SendDocumentModal from '../Common/SendDocumentModal';
import EmitirFacturaModal from '../Facturas/EmitirFacturaModal';
import { generateExecutionPlanFromBudget } from '../../services/obraBudgetSyncService';

export default function PresupuestosList() {
  const {
    presupuestos,
    updatePresupuesto,
    addObra,
    facturacionActivada,
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

  const handleOpenConvertModal = (pres) => setShowConvertModal(pres);

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
          // Sin la facturación activada no se ofrece facturar.
          onFacturar: facturacionActivada ? (pres) => handleOpenConvertModal(pres) : null
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

      {/* Emitir factura desde el presupuesto (datos del cliente e IVA de la obra) */}
      {showConvertModal && (
        <EmitirFacturaModal
          presupuestos={presupuestos}
          presupuestoInicial={showConvertModal}
          onClose={() => setShowConvertModal(null)}
          onEmitida={() => {
            setShowConvertModal(null);
            setActiveTab('facturas');
          }}
        />
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
