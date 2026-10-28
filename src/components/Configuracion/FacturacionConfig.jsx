import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, AlertTriangle, CheckCircle2, Link2, KeyRound, Send, FileSignature, Rocket } from 'lucide-react';
import {
  saveEmpresaFacturacion, verificarCadenaVerifactu, subirCertificado, quitarCertificado,
  listarEnvios, enviarAhora, getDeclaracionResponsable
} from '../../services/facturacionService';

const EMPTY = {
  razonSocial: '',
  nif: '',
  domicilio: '',
  codigoPostal: '',
  municipio: '',
  provincia: '',
  regimen: 'autonomo',
  regimenIrpf: 'directa',
  facturacionActivada: false,
  envioAeatActivo: false,
  serieOrdinaria: 'F',
  serieRectificativa: 'R',
  ivaPorDefectoPct: 21,
  irpfPorDefectoPct: 0,
  diasVencimiento: 30
};

const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-sm focus:outline-none focus:border-amber-400';
const card = 'bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4';
const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '');

function Aviso({ tipo = 'info', children }) {
  const clases = {
    info: 'bg-sky-500/10 border-sky-500/30 text-sky-200',
    warn: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
    error: 'bg-rose-500/10 border-rose-500/30 text-rose-200',
    ok: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
  };
  const Icon = tipo === 'ok' ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`flex items-start gap-2 border rounded-xl p-3 text-xs ${clases[tipo]}`}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

function leerArchivoBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Ajustes > Facturación (VeriFactu): datos fiscales del emisor, interruptor
 * "Facturación activada", certificado, envío a la AEAT, paso a producción y
 * declaración responsable del sistema.
 */
export default function FacturacionConfig() {
  const { facturacion, recargarFacturacion, showNotification } = useApp();
  const empresa = facturacion?.empresa;
  const enProduccion = empresa?.verifactuEntorno === 'produccion';
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [verificacion, setVerificacion] = useState(null);
  const [cert, setCert] = useState({ file: null, password: '' });
  const [subiendo, setSubiendo] = useState(false);
  const [envios, setEnvios] = useState(null);
  const [declaracion, setDeclaracion] = useState(null);

  useEffect(() => {
    setForm(empresa ? { ...EMPTY, ...empresa } : { ...EMPTY });
  }, [empresa]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const guardar = async (extra = {}) => {
    setSaving(true);
    const result = await saveEmpresaFacturacion({
      ...form,
      ivaPorDefectoPct: Number(form.ivaPorDefectoPct),
      irpfPorDefectoPct: Number(form.irpfPorDefectoPct),
      diasVencimiento: Number(form.diasVencimiento),
      verifactuEntorno: empresa?.verifactuEntorno || 'pruebas',
      ...extra
    });
    setSaving(false);
    if (!result.ok) {
      showNotification(result.error, 'error');
      return false;
    }
    await recargarFacturacion();
    return true;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (form.facturacionActivada && !empresa?.facturacionActivada) {
      const ok = window.confirm(
        'Al activar la facturación, TODAS las facturas de esta empresa se emitirán desde ObraMaster con número correlativo y registro VeriFactu. ' +
        'Una factura emitida no se puede modificar ni borrar (solo rectificar o anular). ¿Activar?'
      );
      if (!ok) return;
    }
    if (await guardar()) showNotification(form.facturacionActivada ? 'Facturación guardada.' : 'Datos guardados. La facturación está desactivada.');
  };

  const handleProduccion = async () => {
    const ok = window.confirm(
      'PASO A PRODUCCIÓN\n\n' +
      '· Desde ahora las facturas son REALES: numeración nueva sin el prefijo PRUEBA- y QR de la sede de la AEAT.\n' +
      '· Cada factura se envía a la AEAT automáticamente (VERI*FACTU) y el envío no se puede desactivar.\n' +
      '· No se puede volver al entorno de pruebas.\n' +
      '· A partir de ese momento deja de emitir facturas en tu programa anterior.\n\n¿Pasar a producción?'
    );
    if (!ok) return;
    if (await guardar({ verifactuEntorno: 'produccion', envioAeatActivo: true, confirmarProduccion: true })) {
      showNotification('Facturación en producción: las facturas ya son reales y se envían a la AEAT.');
    }
  };

  const handleCertificado = async (e) => {
    e.preventDefault();
    if (!cert.file) return;
    setSubiendo(true);
    try {
      const base64 = await leerArchivoBase64(cert.file);
      const result = await subirCertificado(base64, cert.password);
      if (!result.ok) {
        showNotification(result.error, 'error');
        return;
      }
      setCert({ file: null, password: '' });
      e.target.reset();
      (result.data.avisos || []).forEach(a => showNotification(a, 'error'));
      showNotification(`Certificado guardado (cifrado): ${result.data.certificado.titular || 'sin nombre'}.`);
      await recargarFacturacion();
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setSubiendo(false);
    }
  };

  const handleQuitarCertificado = async () => {
    if (!window.confirm('¿Quitar el certificado? El envío a la AEAT se desactivará.')) return;
    const result = await quitarCertificado();
    if (!result.ok) showNotification(result.error, 'error');
    await recargarFacturacion();
  };

  const handleVerificar = async () => {
    const result = await verificarCadenaVerifactu();
    setVerificacion(result.ok ? result.data : { ok: false, error: result.error });
  };

  const cargarEnvios = async () => {
    const result = await listarEnvios();
    if (!result.ok) {
      showNotification(result.error, 'error');
      return;
    }
    setEnvios(result.data);
  };

  const handleEnviarAhora = async () => {
    const result = await enviarAhora();
    if (!result.ok) {
      showNotification(result.error, 'error');
    } else {
      const r = result.data.resultado;
      showNotification(r.enviados ? `Enviados ${r.enviados} registros: ${r.aceptados || 0} aceptados, ${r.rechazados || 0} rechazados.` : (r.error || 'No había registros pendientes.'), r.error ? 'error' : 'success');
    }
    await recargarFacturacion();
    await cargarEnvios();
  };

  const verDeclaracion = async () => {
    const result = await getDeclaracionResponsable();
    if (result.ok) setDeclaracion(result.data.declaracion);
    else showNotification(result.error, 'error');
  };

  const certificado = empresa?.certificado;
  const caducaPronto = certificado?.validoHasta && (new Date(certificado.validoHasta) - Date.now()) < 30 * 86400000;
  const registros = empresa?.registros;

  return (
    <div className="space-y-6">
      <div className={card}>
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>Facturación legal (VERI*FACTU)</span>
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Con la facturación <strong className="text-slate-200">activada</strong>, todas las facturas de la empresa se emiten aquí: número correlativo por serie y año,
          huella encadenada, QR tributario y envío del registro a la AEAT. Una factura emitida no se modifica ni se borra; se corrige con una rectificativa
          o se anula si no debió emitirse.
        </p>
        {enProduccion ? (
          <Aviso tipo="ok">Producción: las facturas son reales y se envían a la AEAT.</Aviso>
        ) : (
          <Aviso tipo="warn">
            Entorno de pruebas: las facturas llevan el prefijo PRUEBA-, no tienen validez fiscal y, si activas el envío, van al entorno de pruebas de la AEAT.
            Sigue emitiendo tus facturas reales en tu programa actual hasta pasar a producción.
          </Aviso>
        )}
        {facturacion?.error && <Aviso tipo="error">{facturacion.error}</Aviso>}
      </div>

      <form onSubmit={handleSave} className={card}>
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
            <input value={form.razonSocial} onChange={set('razonSocial')} className={inputClass} required maxLength={120} />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">NIF del emisor</label>
            <input value={form.nif} onChange={set('nif')} className={`${inputClass} font-mono uppercase`} required />
            <span className="text-[10px] text-slate-500">No se puede cambiar después de emitir la primera factura.</span>
          </div>
          <div className="sm:col-span-2">
            <label className="text-slate-400 block mb-1 font-medium">Domicilio fiscal (calle y número)</label>
            <input value={form.domicilio} onChange={set('domicilio')} className={inputClass} required />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Código postal</label>
            <input value={form.codigoPostal} onChange={set('codigoPostal')} className={inputClass} inputMode="numeric" maxLength={5} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Municipio</label>
              <input value={form.municipio} onChange={set('municipio')} className={inputClass} />
            </div>
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Provincia</label>
              <input value={form.provincia} onChange={set('provincia')} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Forma jurídica</label>
            <select value={form.regimen} onChange={set('regimen')} className={inputClass}>
              <option value="autonomo">Autónomo (VERI*FACTU obligatorio desde el 1-7-2027)</option>
              <option value="sociedad">Sociedad (VERI*FACTU obligatorio desde el 1-1-2027)</option>
            </select>
          </div>
          {form.regimen === 'autonomo' && (
            <div>
              <label className="text-slate-400 block mb-1 font-medium">IRPF</label>
              <select value={form.regimenIrpf} onChange={set('regimenIrpf')} className={inputClass}>
                <option value="directa">Estimación directa</option>
                <option value="objetiva">Módulos (estimación objetiva): retención del 1 % a empresas</option>
              </select>
            </div>
          )}
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Días hasta el vencimiento</label>
            <input type="number" min="0" max="365" value={form.diasVencimiento} onChange={set('diasVencimiento')} className={inputClass} />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Serie de facturas</label>
            <input value={form.serieOrdinaria} onChange={set('serieOrdinaria')} maxLength={10} className={`${inputClass} font-mono uppercase`} />
            <span className="text-[10px] text-slate-500">Número: {enProduccion ? '' : 'PRUEBA-'}{String(form.serieOrdinaria || 'F').toUpperCase()}-{new Date().getFullYear()}-00001</span>
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Serie de rectificativas</label>
            <input value={form.serieRectificativa} onChange={set('serieRectificativa')} maxLength={10} className={`${inputClass} font-mono uppercase`} />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">IVA por defecto (si no se usa el asistente de obra)</label>
            <select value={form.ivaPorDefectoPct} onChange={set('ivaPorDefectoPct')} className={inputClass}>
              <option value={21}>21 % (general)</option>
              <option value={10}>10 % (reformas y rehabilitación de vivienda)</option>
              <option value={4}>4 %</option>
              <option value={0}>0 %</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Retención IRPF por defecto (%)</label>
            <input type="number" min="0" max="47" step="0.5" value={form.irpfPorDefectoPct} onChange={set('irpfPorDefectoPct')} className={inputClass} />
          </div>
        </div>

        <label className={`flex items-center justify-between gap-4 bg-slate-800/60 border border-slate-700 rounded-xl p-4 ${enProduccion ? 'opacity-70' : 'cursor-pointer'}`}>
          <div>
            <span className="text-sm font-bold text-white block">Enviar los registros a la AEAT</span>
            <span className="text-xs text-slate-400">
              {enProduccion
                ? 'Obligatorio en producción (VERI*FACTU).'
                : 'En pruebas van al entorno de pruebas de la AEAT. Necesita el certificado de abajo.'}
            </span>
          </div>
          <input type="checkbox" checked={form.envioAeatActivo} onChange={set('envioAeatActivo')} disabled={enProduccion} className="w-5 h-5 accent-emerald-500" />
        </label>

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
          <button type="submit" disabled={saving} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl text-xs">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>

        {verificacion && (
          <Aviso tipo={verificacion.ok ? 'ok' : 'error'}>
            {verificacion.error
              ? verificacion.error
              : verificacion.ok
                ? `Cadena correcta (${verificacion.entorno}): ${verificacion.registros} registros, ninguno alterado.`
                : `Cadena rota en ${verificacion.errores.length} registro(s): ${verificacion.errores.map(e => `#${e.id} ${e.motivo}`).join(' ')}`}
          </Aviso>
        )}
      </form>

      {empresa && (
        <div className={card}>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>Certificado electrónico</span>
          </h3>
          <p className="text-xs text-slate-400">
            Con él se firma la conexión con la AEAT. Sirve el certificado de la empresa (o de su representante) o el de quien tenga su apoderamiento.
            Se guarda cifrado y no se puede descargar.
          </p>
          {certificado && !certificado.error ? (
            <Aviso tipo={caducaPronto ? 'warn' : 'ok'}>
              <strong>{certificado.titular || 'Certificado'}</strong>{certificado.nif ? ` · ${certificado.nif}` : ''}
              {certificado.validoHasta && ` · caduca el ${new Date(certificado.validoHasta).toLocaleDateString('es-ES')}`}
              {certificado.origen === 'servidor' && ' · configurado en el servidor'}
              {caducaPronto && '. Renuévalo y súbelo de nuevo antes de que caduque.'}
            </Aviso>
          ) : (
            <Aviso tipo="warn">{certificado?.error || 'Sin certificado: no se puede enviar a la AEAT.'}</Aviso>
          )}
          <form onSubmit={handleCertificado} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-end">
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Archivo .pfx o .p12</label>
              <input type="file" accept=".pfx,.p12,application/x-pkcs12" onChange={(e) => setCert(c => ({ ...c, file: e.target.files?.[0] || null }))} className="text-slate-300 text-xs" />
            </div>
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Contraseña del certificado</label>
              <input type="password" autoComplete="off" value={cert.password} onChange={(e) => setCert(c => ({ ...c, password: e.target.value }))} className={inputClass} />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={!cert.file || subiendo} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs">
                {subiendo ? 'Subiendo…' : 'Subir certificado'}
              </button>
              {certificado?.origen === 'empresa' && !enProduccion && (
                <button type="button" onClick={handleQuitarCertificado} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs">Quitar</button>
              )}
            </div>
          </form>
        </div>
      )}

      {empresa && (
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-sky-400" />
              <span>Envíos a la AEAT</span>
            </h3>
            <div className="flex gap-2">
              <button type="button" onClick={cargarEnvios} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs">Ver detalle</button>
              <button type="button" onClick={handleEnviarAhora} disabled={!empresa.envioAeatActivo} className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs">Enviar ahora</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><span className="text-slate-400 block">Pendientes</span><strong className="text-white text-lg">{registros?.pendientes ?? '-'}</strong></div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><span className="text-slate-400 block">Rechazados</span><strong className={`text-lg ${registros?.rechazados ? 'text-rose-400' : 'text-white'}`}>{registros?.rechazados ?? '-'}</strong></div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3"><span className="text-slate-400 block">Con errores</span><strong className={`text-lg ${registros?.conErrores ? 'text-amber-400' : 'text-white'}`}>{registros?.conErrores ?? '-'}</strong></div>
          </div>
          {empresa.ultimoEnvio && (
            <p className="text-xs text-slate-400">
              Último envío: {fecha(empresa.ultimoEnvio.fecha)} · {empresa.ultimoEnvio.estado}
              {empresa.ultimoEnvio.error && <span className="text-rose-300"> · {empresa.ultimoEnvio.error}</span>}
              {empresa.proximoEnvio && ` · siguiente a partir de ${fecha(empresa.proximoEnvio)}`}
            </p>
          )}
          {envios && (
            <div className="space-y-2 text-xs">
              {envios.registros.length > 0 && (
                <div className="space-y-1">
                  <p className="text-slate-300 font-semibold">Registros sin cerrar</p>
                  {envios.registros.map(r => (
                    <p key={r.id} className="text-slate-400">
                      {r.num_serie} · {r.tipo_registro} · <strong className="text-slate-200">{r.estado_envio}</strong>
                      {r.codigo_error && ` (${r.codigo_error})`}{r.descripcion_error && ` · ${r.descripcion_error}`}
                      {r.intentos > 0 && ` · ${r.intentos} intento(s)`}
                    </p>
                  ))}
                </div>
              )}
              <p className="text-slate-300 font-semibold">Últimos envíos</p>
              {envios.envios.length === 0 && <p className="text-slate-500">Todavía no hay envíos.</p>}
              {envios.envios.map(e => (
                <p key={e.id} className="text-slate-400">
                  {fecha(e.created_at)} · {e.entorno} · {e.registros} registro(s) · <strong className="text-slate-200">{e.estado_envio}</strong>
                  {e.csv_aeat && ` · CSV ${e.csv_aeat}`}{e.error && <span className="text-rose-300"> · {e.error}</span>}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {empresa && !enProduccion && (
        <div className={card}>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Rocket className="w-4 h-4 text-emerald-400" />
            <span>Pasar a producción</span>
          </h3>
          <ul className="text-xs text-slate-400 list-disc pl-5 space-y-1">
            <li className={certificado && !certificado.error ? 'text-emerald-300' : ''}>Certificado electrónico subido.</li>
            <li className={empresa.productorCompleto ? 'text-emerald-300' : ''}>Declaración responsable completa (datos del productor en el servidor).</li>
            <li className={empresa.ultimoEnvio?.estado === 'Correcto' ? 'text-emerald-300' : ''}>Al menos un envío correcto al entorno de pruebas de la AEAT.</li>
            <li>Revisado con tu gestoría: series, IVA de tus obras y fecha en la que dejas tu programa anterior.</li>
          </ul>
          <button
            type="button"
            onClick={handleProduccion}
            disabled={saving || !certificado || certificado.error || !empresa.productorCompleto}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs"
          >
            Pasar a producción
          </button>
        </div>
      )}

      <div className={card}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-violet-400" />
            <span>Declaración responsable del sistema</span>
          </h3>
          <button type="button" onClick={verDeclaracion} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs">Ver</button>
        </div>
        {declaracion && (
          <div className="text-xs text-slate-300 space-y-2">
            {!declaracion.completa && (
              <Aviso tipo="warn">Faltan datos del productor en el servidor: {declaracion.faltan.join(', ')}.</Aviso>
            )}
            <p><strong>Sistema:</strong> {declaracion.sistema.nombre} · código {declaracion.sistema.codigo} · versión {declaracion.sistema.version}</p>
            <p><strong>Componentes:</strong> {declaracion.sistema.componentes}</p>
            <p><strong>Solo VERI*FACTU:</strong> sí · <strong>Varios obligados tributarios:</strong> sí</p>
            <p><strong>Firma de los registros:</strong> {declaracion.sistema.firma}</p>
            <p><strong>Productor:</strong> {declaracion.productor.nombre || '—'} · NIF {declaracion.productor.nif || '—'} · {declaracion.productor.direccion || '—'}</p>
            <p className="text-slate-400">{declaracion.declaracion}</p>
            {(declaracion.fecha || declaracion.lugar) && <p>En {declaracion.lugar || '—'}, a {declaracion.fecha || '—'}.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
