import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ShieldAlert, Settings2, RefreshCw, Loader2, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, fmtDate, inputCls, btnGhost } from '../../services/avisosApi';
import { ESTADO_ALERTA, GRUPOS_ALERTA, ordenarAlertas, plazoAlerta } from '../../utils/flota';
import { useFlota, Cabecera, Cargando, SinMigracion, EstadoAlerta, Vacio, Modal, Campo, Rejilla, useFormulario } from './flotaShared';
import FichaActivo from './FichaActivo';

/** Centro de alertas: ITV, seguros, mantenimiento, calibraciones, garantías, documentos, alquileres y stock. */
export default function AlertasView() {
  const { setActiveTab, showNotification } = useApp() || {};
  const { data, error, loading, reload } = useFlota();
  const [grupo, setGrupo] = useState('');
  const [estados, setEstados] = useState(['vencido', 'urgente', 'proximo']);
  const [ajustes, setAjustes] = useState(false);
  const [ficha, setFicha] = useState(null);
  const [revisando, setRevisando] = useState(false);

  const todas = useMemo(() => ordenarAlertas(data?.alertas || []), [data]);
  const visibles = todas.filter((a) => (!grupo || a.grupo === grupo) && estados.includes(a.estado));
  const porGrupo = useMemo(() => Object.fromEntries(GRUPOS_ALERTA.map((g) => [g, todas.filter((a) => a.grupo === g && a.estado !== 'vigente').length])), [todas]);
  const cuenta = (e) => todas.filter((a) => a.estado === e && (!grupo || a.grupo === grupo)).length;

  const revisar = async () => {
    setRevisando(true);
    try {
      const r = await api('/api/flota/alertas/revisar', { method: 'POST' });
      showNotification?.(r.creados ? `${r.creados} avisos nuevos enviados a la campana` : 'No hay avisos nuevos: los pendientes ya se enviaron');
      reload();
    } catch (err) {
      showNotification?.(err.message, 'error');
    } finally {
      setRevisando(false);
    }
  };

  const abrir = (a) => {
    if (a.tipo === 'alquiler') { setActiveTab?.('alquileres'); return; }
    if (a.asset_id) setFicha(a.asset_id);
  };

  if (loading && !data) return <Cargando />;
  if (error || data?.listo === false) return <><Cabecera icon={ShieldAlert} titulo="Centro de alertas" tono="text-rose-400" /><SinMigracion error={error} /></>;

  const s = data.ajustes || {};
  return (
    <div>
      <Cabecera icon={ShieldAlert} titulo="Centro de alertas" tono="text-rose-400"
        subtitulo={`Avisa a ${(s.avisos_dias || [30, 15, 7]).join(', ')} días y ${Number(s.avisos_km || 1000).toLocaleString('es-ES')} km antes, en la campana${s.enviar_email ? ', por correo' : ''}${s.enviar_whatsapp ? ' y por WhatsApp' : ''}.`}>
        <button type="button" onClick={revisar} disabled={revisando} className={btnGhost}>{revisando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Avisar ahora</button>
        <button type="button" onClick={() => setAjustes(true)} className={btnGhost}><Settings2 className="w-4 h-4" /> Cuándo avisar</button>
      </Cabecera>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {['vencido', 'urgente', 'proximo'].map((e) => (
          <button key={e} type="button" onClick={() => setEstados((x) => (x.length === 1 && x[0] === e ? ['vencido', 'urgente', 'proximo'] : [e]))}
            className={`rounded-2xl border p-3 text-left transition ${estados.length === 1 && estados[0] === e ? ESTADO_ALERTA[e].cls : 'border-slate-800 bg-slate-900'}`}>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400"><span className={`w-2 h-2 rounded-full ${ESTADO_ALERTA[e].dot}`} />{ESTADO_ALERTA[e].label}</span>
            <span className="block text-2xl font-black text-white tabular-nums">{cuenta(e)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <button type="button" onClick={() => setGrupo('')} className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${!grupo ? 'bg-amber-500 text-slate-950 border-amber-500' : 'border-slate-700 text-slate-300'}`}>Todas</button>
        {GRUPOS_ALERTA.map((g) => (
          <button key={g} type="button" onClick={() => setGrupo(grupo === g ? '' : g)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${grupo === g ? 'bg-amber-500 text-slate-950 border-amber-500' : 'border-slate-700 text-slate-300'}`}>
            {g}{porGrupo[g] ? <span className="ml-1 opacity-70">{porGrupo[g]}</span> : null}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={estados.includes('vigente')} onChange={(e) => setEstados((x) => (e.target.checked ? [...x, 'vigente'] : x.filter((y) => y !== 'vigente')))} /> Ver también lo vigente
        </label>
      </div>

      {visibles.length === 0 ? <Vacio>{todas.length ? 'Nada pendiente con estos filtros.' : 'Todo en orden. Las alertas salen de la ITV, seguros, planes de mantenimiento, garantías, documentos, alquileres y stock mínimo.'}</Vacio> : (
        <div className="space-y-2">
          {visibles.map((a) => (
            <button key={a.alert_key} type="button" onClick={() => abrir(a)}
              className={`w-full text-left rounded-2xl border border-slate-800 border-l-4 ${ESTADO_ALERTA[a.estado].bar} bg-slate-900 hover:bg-slate-800/60 px-4 py-3 flex items-center gap-3`}>
              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">{a.grupo}</span>
                  {a.elemento}
                  {a.fuera_servicio && <span className="text-[10px] font-black rounded-md bg-rose-600 text-white px-1.5 py-0.5">FUERA DE SERVICIO</span>}
                </p>
                <p className="text-xs text-slate-400 truncate">{a.detalle}{a.fecha_vencimiento ? ` · ${fmtDate(a.fecha_vencimiento)}` : ''}</p>
              </div>
              <div className="text-right shrink-0">
                <EstadoAlerta estado={a.estado} />
                <p className="text-[11px] text-slate-400 mt-1">{plazoAlerta(a)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {ajustes && <AjustesAvisos key="aj" ajustes={s} onClose={() => setAjustes(false)} onSaved={() => { setAjustes(false); reload(); }} />}
        {ficha && <FichaActivo key={ficha} activoId={ficha} datos={data} onClose={() => setFicha(null)} onChanged={reload} />}
      </AnimatePresence>
    </div>
  );
}

function AjustesAvisos({ ajustes, onClose, onSaved }) {
  const { showNotification } = useApp() || {};
  const { form, set, busy, error, enviar } = useFormulario({
    avisos_dias: (ajustes.avisos_dias || [30, 15, 7]).join(', '),
    avisos_km: ajustes.avisos_km ?? 1000,
    urgente_km: ajustes.urgente_km ?? 300,
    alquiler_dias: ajustes.alquiler_dias ?? 3,
    garantia_dias: ajustes.garantia_dias ?? 30,
    enviar_email: !!ajustes.enviar_email,
    email_avisos: ajustes.email_avisos || '',
    enviar_whatsapp: !!ajustes.enviar_whatsapp,
    whatsapp_telefono: ajustes.whatsapp_telefono || ''
  });
  const guardar = enviar(async () => {
    await api('/api/flota/ajustes', { method: 'PUT', body: form });
    showNotification?.('Ajustes de avisos guardados');
    onSaved();
  });
  return (
    <Modal titulo="Cuándo y cómo avisar" icon={Settings2} ancho="max-w-lg" onClose={onClose} onSubmit={guardar} busy={busy} error={error}>
      <Rejilla>
        <Campo label="Avisar a (días antes)" ayuda="Separados por comas. El más pequeño marca 'urgente'." full>
          <input value={form.avisos_dias} onChange={set('avisos_dias')} placeholder="30, 15, 7" className={inputCls} />
        </Campo>
        <Campo label="Mantenimiento: avisar a (km antes)"><input type="number" min="0" value={form.avisos_km} onChange={set('avisos_km')} className={inputCls} /></Campo>
        <Campo label="Urgente a (km antes)"><input type="number" min="0" value={form.urgente_km} onChange={set('urgente_km')} className={inputCls} /></Campo>
        <Campo label="Fin de alquiler: días antes"><input type="number" min="0" value={form.alquiler_dias} onChange={set('alquiler_dias')} className={inputCls} /></Campo>
        <Campo label="Fin de garantía: días antes"><input type="number" min="0" value={form.garantia_dias} onChange={set('garantia_dias')} className={inputCls} /></Campo>
      </Rejilla>
      <div className="rounded-xl border border-slate-800 p-3 space-y-2">
        <p className="text-xs text-slate-400">Siempre salen en la campana del panel y como notificación en los dispositivos con avisos activados. Además:</p>
        <label className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={form.enviar_email} onChange={set('enviar_email')} /> Enviar también por correo</label>
        {form.enviar_email && <input type="email" value={form.email_avisos} onChange={set('email_avisos')} placeholder="correo@empresa.com" className={inputCls} />}
        <label className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={form.enviar_whatsapp} onChange={set('enviar_whatsapp')} /> Enviar también por WhatsApp</label>
        {form.enviar_whatsapp && (
          <>
            <input type="tel" value={form.whatsapp_telefono} onChange={set('whatsapp_telefono')} placeholder="+34 600 000 000" className={inputCls} />
            <p className="text-[11px] text-slate-500">Necesita WhatsApp Cloud API configurado en el servidor (WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID).</p>
          </>
        )}
      </div>
    </Modal>
  );
}

/** Tarjeta del Panel General con lo vencido y lo próximo. */
export function AlertasFlotaResumen() {
  const { setActiveTab } = useApp() || {};
  const { data } = useFlota();
  if (!data?.listo) return null;
  const pendientes = ordenarAlertas((data.alertas || []).filter((a) => a.estado !== 'vigente'));
  const vencidas = pendientes.filter((a) => a.estado === 'vencido').length;
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-rose-400" /> Flota y maquinaria</h3>
        <button type="button" onClick={() => setActiveTab?.('alertas_flota')} className="text-xs font-semibold text-amber-400 hover:text-amber-300">Centro de alertas →</button>
      </div>
      {pendientes.length === 0 ? (
        <p className="text-xs text-emerald-300 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /> ITV, seguros, revisiones y alquileres al día.</p>
      ) : (
        <>
          <p className="text-xs text-slate-400">{vencidas ? <span className="text-rose-300 font-bold">{vencidas} vencidas</span> : null}{vencidas ? ' · ' : ''}{pendientes.length - vencidas} próximas a vencer</p>
          <div className="space-y-1.5">
            {pendientes.slice(0, 5).map((a) => (
              <button key={a.alert_key} type="button" onClick={() => setActiveTab?.('alertas_flota')}
                className="w-full flex items-center gap-2 text-left text-xs rounded-lg px-2 py-1.5 hover:bg-slate-800">
                <span className={`w-2 h-2 rounded-full shrink-0 ${ESTADO_ALERTA[a.estado].dot}`} />
                <span className="text-slate-200 truncate"><strong>{a.grupo}</strong> · {a.elemento}</span>
                <span className="ml-auto text-slate-500 shrink-0">{plazoAlerta(a)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
