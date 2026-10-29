import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Mail, Send, RotateCcw, Save, Loader2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { api, inputCls, btnPrimary, btnGhost } from '../../services/avisosApi';
import {
  EMAIL_TEMPLATE_TYPES,
  DEFAULT_EMAIL_TEMPLATES,
  SAMPLE_EMAIL_VARIABLES,
  getEmailTemplate,
  renderEmail
} from '../../utils/emailTemplates';

/**
 * Ajustes > Correos: estado de Resend, remitente, copia oculta y plantillas
 * (asunto y cuerpo con variables) de cada tipo de correo que envía la app.
 * Se guarda en empresaConfig.plantillasCorreo y empresaConfig.correoAjustes.
 */
export default function CorreosConfig() {
  const { empresaConfig, setEmpresaConfig, showNotification } = useApp();
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [tipo, setTipo] = useState(EMAIL_TEMPLATE_TYPES[0].id);
  const [plantillas, setPlantillas] = useState(() => {
    const out = {};
    for (const t of EMAIL_TEMPLATE_TYPES) out[t.id] = getEmailTemplate(t.id, empresaConfig.plantillasCorreo);
    return out;
  });
  const [ajustes, setAjustes] = useState(() => ({ nombreRemitente: '', copiaOculta: false, ...(empresaConfig.correoAjustes || {}) }));
  const [testTo, setTestTo] = useState(empresaConfig.email || '');
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const bodyRef = useRef(null);

  const comprobar = () => {
    setStatusError('');
    api('/api/email/status').then(setStatus).catch((e) => setStatusError(e.message));
  };
  useEffect(() => { comprobar(); }, []);

  const type = EMAIL_TEMPLATE_TYPES.find((t) => t.id === tipo);
  const actual = plantillas[tipo];
  const cambiada = actual.asunto !== DEFAULT_EMAIL_TEMPLATES[tipo].asunto || actual.cuerpo !== DEFAULT_EMAIL_TEMPLATES[tipo].cuerpo;

  const preview = useMemo(
    () => renderEmail(tipo, SAMPLE_EMAIL_VARIABLES[tipo], { templates: plantillas, empresa: empresaConfig }),
    [tipo, plantillas, empresaConfig]
  );

  const edit = (field, value) => {
    setPlantillas((prev) => ({ ...prev, [tipo]: { ...prev[tipo], [field]: value } }));
    setDirty(true);
  };

  // Inserta {{variable}} donde está el cursor del cuerpo.
  const insertar = (key) => {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    const text = actual.cuerpo;
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    edit('cuerpo', text.slice(0, start) + token + text.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  };

  const restaurar = () => {
    if (!window.confirm('¿Volver al texto original de esta plantilla?')) return;
    setPlantillas((prev) => ({ ...prev, [tipo]: { ...DEFAULT_EMAIL_TEMPLATES[tipo] } }));
    setDirty(true);
  };

  const guardar = () => {
    // Solo se guardan las plantillas cambiadas: las demás siguen las mejoras de serie.
    const propias = {};
    for (const t of EMAIL_TEMPLATE_TYPES) {
      const p = plantillas[t.id];
      if (p.asunto !== DEFAULT_EMAIL_TEMPLATES[t.id].asunto || p.cuerpo !== DEFAULT_EMAIL_TEMPLATES[t.id].cuerpo) propias[t.id] = p;
    }
    setEmpresaConfig((prev) => ({
      ...prev,
      plantillasCorreo: propias,
      correoAjustes: { nombreRemitente: ajustes.nombreRemitente.trim(), copiaOculta: Boolean(ajustes.copiaOculta) }
    }));
    setDirty(false);
    showNotification('Plantillas de correo guardadas');
  };

  const probar = async () => {
    if (dirty) showNotification('Guarda primero los cambios para que la prueba los use.', 'warning');
    setTesting(true);
    try {
      await api('/api/email/test', { method: 'POST', body: { to: testTo } });
      showNotification(`Correo de prueba enviado a ${testTo}. Revisa también la carpeta de spam.`);
    } catch (e) {
      showNotification(e.message, 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-white">Correos</h2>
          <p className="text-sm text-slate-400 mt-1">
            Presupuestos, facturas, pedidos a proveedores y encargos a subcontratas salen por Resend con estas plantillas.
            Las respuestas llegan al correo de la empresa ({empresaConfig.email || 'sin configurar en Perfil'}).
          </p>
        </div>
      </div>

      {/* Estado del servidor */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          {!status && !statusError && <span className="text-xs text-slate-400">Comprobando el servidor…</span>}
          {statusError && <span className="text-xs font-semibold px-2.5 py-1 rounded-lg border text-rose-400 bg-rose-500/10 border-rose-500/30">No se pudo comprobar: {statusError}</span>}
          {status && !status.configured && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg border text-rose-400 bg-rose-500/10 border-rose-500/30">Falta RESEND_API_KEY en el servidor: los envíos se simulan</span>
          )}
          {status?.configured && status.sandbox && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg border text-amber-400 bg-amber-500/10 border-amber-500/30">Modo pruebas: solo llega a tu propio correo de Resend</span>
          )}
          {status?.configured && !status.sandbox && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg border text-emerald-400 bg-emerald-500/10 border-emerald-500/30 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Listo · remitente {status.from}
            </span>
          )}
          <button onClick={comprobar} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition">
            <RefreshCw className="w-3.5 h-3.5" /> Volver a comprobar
          </button>
        </div>
        {status?.configured && status.sandbox && (
          <p className="text-xs text-amber-300/90 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Para enviar a clientes y proveedores, verifica tu dominio en Resend y pon RESEND_FROM_EMAIL con una dirección de ese dominio
            (pasos en docs/correo-resend.md del proyecto).
          </p>
        )}
      </div>

      {/* Remitente y copia */}
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-slate-400 space-y-1">
          <span className="block">Nombre que verá el destinatario</span>
          <input
            value={ajustes.nombreRemitente}
            onChange={(e) => { setAjustes({ ...ajustes, nombreRemitente: e.target.value }); setDirty(true); }}
            placeholder={status?.fromName || empresaConfig.nombreComercial || 'Reformas …'}
            className={inputCls}
          />
        </label>
        <label className="text-xs text-slate-300 flex items-center gap-2 sm:pt-5">
          <input
            type="checkbox"
            checked={Boolean(ajustes.copiaOculta)}
            onChange={(e) => { setAjustes({ ...ajustes, copiaOculta: e.target.checked }); setDirty(true); }}
            className="accent-amber-500"
          />
          Enviarme copia oculta de cada correo al correo de la empresa
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-400 space-y-1 flex-1 min-w-[200px]">
          <span className="block">Enviar un correo de prueba a</span>
          <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="tu@correo.es" className={inputCls} />
        </label>
        <button type="button" onClick={probar} disabled={testing || !testTo} className={btnGhost}>
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Probar envío
        </button>
      </div>

      {/* Plantillas */}
      <div className="space-y-3">
        <h3 className="font-bold text-white text-sm">Plantillas</h3>
        <div className="flex flex-wrap gap-2" role="tablist">
          {EMAIL_TEMPLATE_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tipo === t.id}
              onClick={() => setTipo(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${tipo === t.id ? 'bg-amber-500/15 border-amber-500/50 text-amber-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">{type.description}</p>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-2 min-w-0">
            <label className="text-xs text-slate-400 block">Asunto</label>
            <input value={actual.asunto} onChange={(e) => edit('asunto', e.target.value)} className={inputCls} />
            <label className="text-xs text-slate-400 block">Cuerpo</label>
            <textarea
              ref={bodyRef}
              rows={16}
              value={actual.cuerpo}
              onChange={(e) => edit('cuerpo', e.target.value)}
              className={`${inputCls} font-mono text-xs leading-relaxed`}
            />
            <div>
              <p className="text-[11px] text-slate-500 mb-1">Variables (pulsa para insertar). Una línea cuyas variables estén vacías no se envía.</p>
              <div className="flex flex-wrap gap-1.5">
                {type.variables.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    title={v.label}
                    onClick={() => insertar(v.key)}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-200 border border-slate-700"
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2 min-w-0">
            <p className="text-xs text-slate-400">Vista previa con datos de ejemplo</p>
            <p className="text-xs text-white bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 break-words"><span className="text-slate-500">Asunto: </span>{preview.subject}</p>
            <iframe
              title="Vista previa del correo"
              sandbox=""
              srcDoc={preview.html}
              className="w-full h-[420px] rounded-xl border border-slate-800 bg-white"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-800">
        {cambiada && (
          <button type="button" onClick={restaurar} className={btnGhost}><RotateCcw className="w-4 h-4" /> Restaurar original</button>
        )}
        <button type="button" onClick={guardar} disabled={!dirty} className={btnPrimary}><Save className="w-4 h-4" /> Guardar</button>
      </div>
    </section>
  );
}
