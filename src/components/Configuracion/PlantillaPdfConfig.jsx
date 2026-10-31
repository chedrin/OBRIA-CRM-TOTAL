import React from 'react';
import { useSyncedForm } from '../../hooks/useSyncedForm';
import { useApp } from '../../context/AppContext';
import { FileText, Download, Save, RotateCcw } from 'lucide-react';
import {
  PLANTILLA_PDF_DEFECTO, plantillaPdfDe, describeDocument, buildDocumentModel, buildDocumentPdf, loadDocumentAssets
} from '../../utils/documentPdf';

const inputClass = 'w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-amber-400';
const card = 'bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4';

// Presupuesto de ejemplo para probar la plantilla sin tocar datos reales.
const PRESUPUESTO_EJEMPLO = {
  numero: 'PRES-EJEMPLO',
  fecha: new Date().toISOString().slice(0, 10),
  cliente: 'Cliente de ejemplo',
  nif: '00000000T',
  direccion: 'Calle de ejemplo 1, 2º A',
  obraTitulo: 'Reforma de baño',
  tipoIvaPct: 10,
  capitulos: [
    {
      codigo: '01', nombre: 'Demolición', partidas: [
        { concepto: 'Desmontado de sanitarios sin recuperación, demolición de alicatado y levantado de solado, incluso limpieza y retirada de escombros a pie de carga y con p.p. de medios auxiliares.', cantidad: 1, unidad: 'ud', precioVenta: 650, total: 650 },
        { concepto: 'Transporte de escombros a planta de reciclaje en camión basculante o similar, incluso canon de vertedero incluyendo la carga.', cantidad: 1, unidad: 'ud', precioVenta: 250, total: 250 }
      ]
    },
    {
      codigo: '02', nombre: 'Alicatado', partidas: [
        { concepto: 'Alicatado de baño con azulejo 25x40 cm o similar, material a elegir por la Propiedad (precio hasta 15 €/m²), recibido con pegamento porcelánico, rejuntado y limpieza.', cantidad: 24, unidad: 'm²', precioVenta: 38, total: 912 },
        { concepto: 'OBSERVACIONES: si al picar el alicatado el soporte estuviera en mal estado, su reparación no está incluida.', cantidad: 0, total: 0 }
      ]
    }
  ],
  baseImponible: 1812,
  cuotaIva: 181.2,
  totalConIva: 1993.2
};

const Check = ({ label, checked, onChange, ayuda }) => (
  <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-amber-500" />
    <span>
      <span className="font-bold">{label}</span>
      {ayuda && <span className="block text-[11px] text-slate-500">{ayuda}</span>}
    </span>
  </label>
);

/** Ajustes > Plantilla PDF: aspecto y textos de los presupuestos y facturas. */
export default function PlantillaPdfConfig() {
  const { empresaConfig, updateEmpresaConfig, showNotification } = useApp();
  const [form, setForm, marcarGuardado] = useSyncedForm(empresaConfig, plantillaPdfDe);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const guardar = (e) => {
    e.preventDefault();
    marcarGuardado();
    updateEmpresaConfig({ plantillaPdf: form });
  };

  const descargarEjemplo = async () => {
    try {
      const config = { ...empresaConfig, plantillaPdf: form };
      const info = describeDocument({ type: 'presupuesto', data: PRESUPUESTO_EJEMPLO, empresaConfig: config });
      const assets = await loadDocumentAssets(buildDocumentModel(info, config), '');
      buildDocumentPdf(info, { empresaConfig: config, ...assets }).save('presupuesto-ejemplo.pdf');
    } catch (err) {
      console.error(err);
      showNotification('No se pudo crear el PDF de ejemplo.', 'error');
    }
  };

  return (
    <form onSubmit={guardar} className="space-y-6">
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 p-5 rounded-2xl border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4" />
            <span>Plantilla de presupuestos y facturas</span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl">
            Colores, teléfonos y textos fijos del PDF. El logotipo, los datos fiscales y el IBAN se toman de Perfil Director &amp; Empresa.
            Las facturas llevan siempre el QR tributario y la leyenda VERI*FACTU cuando se emiten con registro.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={descargarEjemplo} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5">
            <Download className="w-4 h-4" /> PDF de ejemplo
          </button>
          <button type="submit" className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5">
            <Save className="w-4 h-4" /> Guardar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={card}>
          <h4 className="font-extrabold text-white text-sm">Colores y contacto</h4>
          <div className="grid grid-cols-2 gap-3">
            {[['colorPrincipal', 'Color principal'], ['colorOscuro', 'Color de las barras']].map(([k, label]) => (
              <div key={k}>
                <label className="text-slate-300 font-bold block mb-1 text-xs">{label}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form[k]} onChange={(e) => set(k, e.target.value)} className="h-9 w-12 rounded bg-transparent border border-slate-700" />
                  <input value={form[k]} onChange={(e) => set(k, e.target.value)} className={`${inputClass} font-mono`} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-bold block mb-1 text-xs">Teléfono móvil</label>
              <input value={form.telefonoMovil} onChange={(e) => set('telefonoMovil', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-slate-300 font-bold block mb-1 text-xs">Teléfono oficina</label>
              <input value={form.telefonoOficina} onChange={(e) => set('telefonoOficina', e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="text-slate-300 font-bold block mb-1 text-xs">Web</label>
            <input value={form.web} onChange={(e) => set('web', e.target.value)} placeholder="www.miempresa.es" className={inputClass} />
          </div>
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <Check label="Mostrar mediciones en cada partida" ayuda="Añade «(31,50 m²)» al final de la descripción." checked={Boolean(form.mostrarMediciones)} onChange={(v) => set('mostrarMediciones', v)} />
            <Check label="Mostrar cantidad, precio e importe de cada partida en presupuestos" ayuda="Si está apagado, solo se muestra el total de cada capítulo (como en tus presupuestos actuales). Las facturas muestran siempre el detalle." checked={Boolean(form.mostrarImportesPartida)} onChange={(v) => set('mostrarImportesPartida', v)} />
            <Check label="Poner la firma o sello de la empresa en los presupuestos" checked={Boolean(form.mostrarFirmaEmpresa)} onChange={(v) => set('mostrarFirmaEmpresa', v)} />
          </div>
        </div>

        <div className={card}>
          <h4 className="font-extrabold text-white text-sm">Textos</h4>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px] gap-3">
            <div>
              <label className="text-slate-300 font-bold block mb-1 text-xs">Forma de pago por defecto (presupuestos)</label>
              <input value={form.formaPagoPresupuesto} onChange={(e) => set('formaPagoPresupuesto', e.target.value)} placeholder="30% firma contrato y pagos a cuenta según partidas en proceso" className={inputClass} />
            </div>
            <div>
              <label className="text-slate-300 font-bold block mb-1 text-xs">Validez (días)</label>
              <input type="number" min="1" value={form.validezDias} onChange={(e) => set('validezDias', Number(e.target.value) || 15)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="text-slate-300 font-bold block mb-1 text-xs">Forma de pago por defecto (facturas)</label>
            <input value={form.formaPagoFactura} onChange={(e) => set('formaPagoFactura', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-slate-300 font-bold block mb-1 text-xs">Observaciones fijas del presupuesto</label>
            <textarea rows={3} value={form.observacionesPresupuesto} onChange={(e) => set('observacionesPresupuesto', e.target.value)} className={inputClass} />
            <span className="text-[10px] text-slate-500">{'{validez}'} se cambia por los días de validez.</span>
          </div>
          <div>
            <label className="text-slate-300 font-bold block mb-1 text-xs">Observaciones fijas de la factura</label>
            <textarea rows={2} value={form.observacionesFactura} onChange={(e) => set('observacionesFactura', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-slate-300 font-bold block mb-1 text-xs">Texto del recuadro de firma</label>
            <input value={form.textoFirma} onChange={(e) => set('textoFirma', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-slate-300 font-bold block mb-1 text-xs">Protección de datos (pie de página)</label>
            <textarea rows={3} value={form.textoProteccionDatos} onChange={(e) => set('textoProteccionDatos', e.target.value)} className={inputClass} />
            <span className="text-[10px] text-slate-500">{'{razonSocial}'}, {'{email}'} y {'{direccion}'} se rellenan con los datos de la empresa.</span>
          </div>
          <button type="button" onClick={() => setForm({ ...PLANTILLA_PDF_DEFECTO, telefonoMovil: form.telefonoMovil, telefonoOficina: form.telefonoOficina, web: form.web })} className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar textos y colores por defecto
          </button>
        </div>
      </div>
    </form>
  );
}
