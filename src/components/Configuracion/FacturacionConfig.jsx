import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, AlertTriangle, CheckCircle2, Link2 } from 'lucide-react';
import { saveEmpresaFacturacion, verificarCadenaVerifactu } from '../../services/facturacionService';

const EMPTY = {
  razonSocial: '',
  nif: '',
  domicilio: '',
  regimen: 'autonomo',
  facturacionActivada: false,
  serieOrdinaria: 'F',
  serieRectificativa: 'R',
  ivaPorDefectoPct: 21,
  irpfPorDefectoPct: 0,
  diasVencimiento: 30
};

const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-amber-400';

/**
 * Ajustes > Facturación (VeriFactu): datos fiscales del emisor e interruptor
 * "Facturación activada". Apagado, ObraMaster solo hace presupuestos y obras.
 */
export default function FacturacionConfig() {
  const { facturacion, recargarFacturacion, showNotification } = useApp();
  const empresa = facturacion?.empresa;
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [verificacion, setVerificacion] = useState(null);

  useEffect(() => {
    setForm(empresa ? { ...EMPTY, ...empresa } : { ...EMPTY });
  }, [empresa]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (form.facturacionActivada && !empresa?.facturacionActivada) {
      const ok = window.confirm(
        'Al activar la facturación, TODAS las facturas de esta empresa se emitirán desde ObraMaster con número correlativo y registro VeriFactu. ' +
        'Una factura emitida no se puede modificar ni borrar (solo rectificar). ¿Activar?'
      );
      if (!ok) return;
    }
    setSaving(true);
    const result = await saveEmpresaFacturacion({
      ...form,
      ivaPorDefectoPct: Number(form.ivaPorDefectoPct),
      irpfPorDefectoPct: Number(form.irpfPorDefectoPct),
      diasVencimiento: Number(form.diasVencimiento)
    });
    setSaving(false);
    if (!result.ok) {
      showNotification(result.error, 'error');
      return;
    }
    await recargarFacturacion();
    showNotification(result.data.empresa.facturacionActivada ? 'Facturación activada y guardada.' : 'Datos guardados. La facturación está desactivada.');
  };

  const handleVerificar = async () => {
    const result = await verificarCadenaVerifactu();
    setVerificacion(result.ok ? result.data : { ok: false, error: result.error });
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>Facturación legal (VeriFactu)</span>
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Con la facturación <strong className="text-slate-200">desactivada</strong>, ObraMaster solo hace presupuestos y obras y no emite facturas.
          Con la facturación <strong className="text-slate-200">activada</strong>, todas las facturas de la empresa se emiten aquí: número correlativo por serie y año,
          huella encadenada VeriFactu y QR tributario. Una factura emitida no se modifica ni se borra; se corrige con una rectificativa.
        </p>
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Fase de pruebas: las facturas todavía no se envían a la AEAT y el QR apunta a su entorno de pruebas.
            Sigue emitiendo tus facturas reales en tu programa actual hasta que el envío esté terminado.
          </span>
        </div>
        {facturacion?.error && (
          <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{facturacion.error}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <label className="flex items-center justify-between gap-4 bg-slate-800/60 border border-slate-700 rounded-xl p-4 cursor-pointer">
          <div>
            <span className="text-sm font-bold text-white block">Facturación activada</span>
            <span className="text-xs text-slate-400">Muestra la sección de Facturación y permite emitir facturas con VeriFactu.</span>
          </div>
          <input type="checkbox" checked={form.facturacionActivada} onChange={set('facturacionActivada')} className="w-5 h-5 accent-emerald-500" />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Nombre o razón social del emisor</label>
            <input value={form.razonSocial} onChange={set('razonSocial')} className={inputClass} required />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">NIF del emisor</label>
            <input value={form.nif} onChange={set('nif')} className={`${inputClass} font-mono uppercase`} required />
            <span className="text-[10px] text-slate-500">No se puede cambiar después de emitir la primera factura.</span>
          </div>
          <div className="sm:col-span-2">
            <label className="text-slate-400 block mb-1 font-medium">Domicilio fiscal</label>
            <input value={form.domicilio} onChange={set('domicilio')} className={inputClass} />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Régimen</label>
            <select value={form.regimen} onChange={set('regimen')} className={inputClass}>
              <option value="autonomo">Autónomo (VeriFactu obligatorio desde el 1-7-2027)</option>
              <option value="sociedad">Sociedad (VeriFactu obligatorio desde el 1-1-2027)</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Días hasta el vencimiento</label>
            <input type="number" min="0" max="365" value={form.diasVencimiento} onChange={set('diasVencimiento')} className={inputClass} />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Serie de facturas</label>
            <input value={form.serieOrdinaria} onChange={set('serieOrdinaria')} maxLength={10} className={`${inputClass} font-mono uppercase`} />
            <span className="text-[10px] text-slate-500">Número: {String(form.serieOrdinaria || 'F').toUpperCase()}-{new Date().getFullYear()}-00001</span>
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Serie de rectificativas</label>
            <input value={form.serieRectificativa} onChange={set('serieRectificativa')} maxLength={10} className={`${inputClass} font-mono uppercase`} />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">IVA por defecto</label>
            <select value={form.ivaPorDefectoPct} onChange={set('ivaPorDefectoPct')} className={inputClass}>
              <option value={21}>21 % (general)</option>
              <option value={10}>10 % (reformas y rehabilitación de vivienda)</option>
              <option value={4}>4 %</option>
              <option value={0}>0 % (exento)</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Retención IRPF por defecto (%)</label>
            <input type="number" min="0" max="47" step="0.5" value={form.irpfPorDefectoPct} onChange={set('irpfPorDefectoPct')} className={inputClass} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleVerificar}
            disabled={!empresa}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <Link2 className="w-4 h-4" />
            <span>Verificar cadena de huellas</span>
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl text-xs"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>

        {verificacion && (
          <div className={`flex items-start gap-2 rounded-xl p-3 text-xs border ${verificacion.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 border-rose-500/30 text-rose-200'}`}>
            {verificacion.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>
              {verificacion.error
                ? verificacion.error
                : verificacion.ok
                  ? `Cadena correcta: ${verificacion.registros} registros, ninguno alterado.`
                  : `Cadena rota en ${verificacion.errores.length} registro(s): ${verificacion.errores.map(e => `#${e.id} ${e.motivo}`).join(' ')}`}
            </span>
          </div>
        )}
      </form>
    </div>
  );
}
