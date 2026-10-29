import React, { useEffect, useMemo, useState } from 'react';
import BotonVolver from '../Common/BotonVolver';
import {
  CheckCircle2, AlertTriangle, Loader2, HardHat, Phone, ListChecks, Package, MapPin, CalendarClock, Gauge
} from 'lucide-react';
import { PhotoPicker } from '../Avance/mobileKit';
import ReporteAvanceSheet, { PartidaCard } from '../Avance/ReporteAvanceSheet';

/**
 * Página del enlace mágico para subcontratas: /sub/<token>
 * Sin login ni instalación. Muestra la fase o partida asignada (obra, dirección, fecha
 * prevista y estado) y tres acciones: Solicitar material, Tengo un problema y Marcar
 * como terminada. Además, el avance en % de cada partida asignada a su empresa.
 * Las fotos se reducen en el móvil antes de subirlas (máx. 1600 px, JPEG).
 */

const MOTIVOS = [
  'Falta de luz o agua',
  'Retraso de otro gremio',
  'Zona no accesible',
  'Falta de material',
  'Otro'
];

const ESTADO = {
  no_iniciada: { label: 'Pendiente', cls: 'bg-slate-700 text-slate-100' },
  en_curso: { label: 'En curso', cls: 'bg-sky-500 text-slate-950' },
  bloqueada: { label: 'Bloqueada', cls: 'bg-rose-500 text-white' },
  completada: { label: 'Terminada', cls: 'bg-emerald-500 text-slate-950' },
  revision: { label: 'Pendiente de revisión', cls: 'bg-emerald-500 text-slate-950' }
};

function tokenFromPath() {
  const match = window.location.pathname.match(/^\/sub\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

const fmtDia = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) : '');

/** Estado conjunto de varias partidas (asignación de fase completa). */
function estadoConjunto(partidas) {
  if (!partidas.length) return null;
  if (partidas.some((p) => p.status === 'bloqueada')) return 'bloqueada';
  if (partidas.every((p) => p.readyForCertification)) return 'revision';
  if (partidas.every((p) => p.status === 'completada')) return 'completada';
  if (partidas.some((p) => p.status !== 'no_iniciada' || p.reported > 0)) return 'en_curso';
  return 'no_iniciada';
}

export default function SubcontrataPortal() {
  const [token] = useState(tokenFromPath);
  const [info, setInfo] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState('menu'); // menu | material | problema | terminada | partidas | partida | hecho
  const [partida, setPartida] = useState(null);
  const [notes, setNotes] = useState('');
  const [motivo, setMotivo] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [fecha, setFecha] = useState('');
  const [photos, setPhotos] = useState([]);
  const [target, setTarget] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [doneMessage, setDoneMessage] = useState('');

  const base = `/api/sub/${encodeURIComponent(token)}`;

  const loadPlan = () => fetch(`${base}/partidas`)
    .then(async (r) => (r.ok ? r.json() : { fases: [] }))
    .then(setPlan)
    .catch(() => setPlan({ fases: [] }));

  useEffect(() => {
    fetch(base)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || 'No se pudo abrir el enlace.');
        setInfo(body);
        loadPlan();
      })
      .catch((e) => setLoadError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const partidas = useMemo(() => (plan?.fases || []).flatMap((f) => f.partidas.map((p) => ({ ...p, faseNombre: f.nombre }))), [plan]);

  // Tarea en la que se centra la página: la de la asignación del enlace o, si solo hay una, esa.
  const foco = useMemo(() => {
    const f = plan?.foco || info?.foco;
    if (f?.partidaId) {
      const p = partidas.find((x) => x.faseId === f.faseId && x.id === f.partidaId);
      return p ? { faseId: p.faseId, partidaId: p.id, partidas: [p], titulo: `${p.codigo} · ${p.titulo}`, tipo: 'Partida' } : null;
    }
    if (f?.faseId) {
      const list = partidas.filter((x) => x.faseId === f.faseId);
      const single = list.length === 1 && list[0].faseCompleta;
      return list.length
        ? { faseId: f.faseId, partidaId: single ? list[0].id : '', partidas: list, titulo: plan.fases.find((x) => x.id === f.faseId)?.nombre || '', tipo: 'Fase' }
        : null;
    }
    if (partidas.length === 1) {
      const p = partidas[0];
      return { faseId: p.faseId, partidaId: p.id, partidas: [p], titulo: p.faseCompleta ? p.titulo : `${p.codigo} · ${p.titulo}`, tipo: p.faseCompleta ? 'Fase' : 'Partida' };
    }
    return null;
  }, [plan, info, partidas]);

  const reset = (nextMode) => {
    setNotes('');
    setMotivo('');
    setCantidad('');
    setUnidad('');
    setUrgent(false);
    setFecha('');
    setPhotos([]);
    setTarget(foco ? `${foco.faseId}::${foco.partidaId}` : '');
    setError('');
    setMode(nextMode);
  };

  const post = async (path, form) => {
    const r = await fetch(`${base}/${path}`, { method: 'POST', body: form });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || 'No se pudo enviar. Inténtalo otra vez.');
    return body;
  };

  const appendTarget = (form) => {
    if (!target) return;
    const [faseId, partidaId = ''] = target.split('::');
    form.append('fase_id', faseId);
    form.append('partida_id', partidaId);
  };

  const finish = async (body) => {
    await loadPlan();
    setDoneMessage(body.mensaje || 'Enviado.');
    setMode('hecho');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const form = new FormData();
    if (mode === 'material') {
      if (!notes.trim()) return setError('Escribe qué material o suministro necesitas.');
      form.append('categoria', 'material');
      form.append('descripcion', notes);
      form.append('cantidad', cantidad);
      form.append('unidad', unidad);
      form.append('urgente', String(urgent));
      if (fecha) form.append('fecha_limite', fecha);
      appendTarget(form);
    } else if (mode === 'problema') {
      if (!motivo) return setError('Elige el motivo.');
      form.append('categoria', 'bloqueo');
      form.append('motivo', motivo);
      form.append('descripcion', notes);
      form.append('urgente', 'true');
      appendTarget(form);
    } else {
      form.append('notas', notes);
      if (target) {
        form.append('listo', 'true');
        appendTarget(form);
      }
    }
    photos.forEach((p, i) => form.append('fotos', p.blob, `foto-${i + 1}.jpg`));
    setSending(true);
    try {
      const path = mode === 'terminada' ? (target ? 'avance' : 'terminado') : 'necesidad';
      await finish(await post(path, form));
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const sendAvance = async (form) => finish(await post('avance', form));

  const shell = (children) => (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans px-4 py-6">
      <div className="max-w-md mx-auto">{children}</div>
    </div>
  );

  if (loadError) {
    return shell(
      <div className="mt-16 text-center space-y-3">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
        <p className="text-lg font-bold">{loadError}</p>
      </div>
    );
  }

  if (!info || !plan) {
    return shell(
      <div className="mt-24 flex justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const estado = foco ? estadoConjunto(foco.partidas) : null;
  const fin = foco ? foco.partidas.map((p) => p.endDate).filter(Boolean).sort().pop() : null;
  const avance = foco && foco.partidas.length ? Math.round(foco.partidas.reduce((s, p) => s + p.reported, 0) / foco.partidas.length) : null;
  const notasEncargado = foco ? [...new Set(foco.partidas.map((p) => p.notes).filter(Boolean))].join(' · ') : '';
  const back = (to = 'menu') => (
    <BotonVolver onClick={() => reset(to)} className="mb-4">Volver</BotonVolver>
  );

  const header = (
    <header className="mb-6 space-y-2">
      <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
        <HardHat className="w-5 h-5" />
        <span>{info.empresa}</span>
      </div>
      <h1 className="text-xl font-black">{info.subcontrata}</h1>
      <div>
        {info.obra && <p className="text-slate-200 font-semibold">{info.obra}</p>}
        {info.direccion && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(info.direccion)}`} target="_blank" rel="noreferrer"
            className="text-slate-400 text-sm flex items-center gap-1"><MapPin className="w-4 h-4" /> {info.direccion}</a>
        )}
      </div>
      {foco ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-700 p-4 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{foco.tipo} asignada</span>
          <p className="text-lg font-black leading-snug">{foco.titulo}</p>
          {foco.tipo === 'Fase' && foco.partidas.length > 1 && (
            <p className="text-sm text-slate-400">{foco.partidas.length} partidas: {foco.partidas.map((p) => p.titulo).join(', ')}</p>
          )}
          {foco.partidas.length === 1 && foco.partidas[0].cantidad > 0 && (
            <p className="text-sm text-slate-400">Medición: {foco.partidas[0].cantidad} {foco.partidas[0].unidad}</p>
          )}
          {notasEncargado && <p className="text-sm text-slate-300">Indicaciones: {notasEncargado}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {estado && <span className={`text-sm font-black px-3 py-1 rounded-lg ${ESTADO[estado].cls}`}>{ESTADO[estado].label}</span>}
            {avance !== null && <span className="text-sm font-bold text-slate-300">{avance}% hecho</span>}
            {fin && <span className="text-sm text-slate-400 flex items-center gap-1"><CalendarClock className="w-4 h-4" /> Fin previsto {fmtDia(fin)}</span>}
          </div>
          {foco.partidas.some((p) => p.alert) && (
            <p className="text-sm font-semibold text-rose-300">⚠ {foco.partidas.find((p) => p.alert)?.alertText || 'Hay un aviso abierto'}</p>
          )}
        </div>
      ) : info.tarea ? (
        <p className="inline-block bg-slate-800 text-slate-200 text-sm font-semibold px-3 py-1 rounded-lg">{info.tarea}</p>
      ) : null}
    </header>
  );

  if (mode === 'hecho') {
    return shell(
      <>
        {header}
        <div className="text-center space-y-4 mt-6">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
          <p className="text-lg font-bold">{doneMessage}</p>
          <BotonVolver onClick={() => reset('menu')}>Volver al inicio</BotonVolver>
        </div>
      </>
    );
  }

  if (mode === 'partida' && partida) {
    return shell(<ReporteAvanceSheet partida={partida} onSubmit={sendAvance} onClose={() => setMode('partidas')} />);
  }

  if (mode === 'partidas') {
    return shell(
      <>
        {back()}
        {header}
        <div className="space-y-6">
          {(plan.fases || []).map((fase) => (
            <section key={fase.id} className="space-y-3">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-400">{fase.nombre}</h2>
              {fase.partidas.map((p) => (
                <PartidaCard key={`${p.faseId}::${p.id}`} partida={p} onOpen={(item) => { setPartida(item); setMode('partida'); }} />
              ))}
            </section>
          ))}
        </div>
      </>
    );
  }

  if (mode === 'menu') {
    return shell(
      <>
        {header}
        <div className="space-y-3">
          <button onClick={() => reset('material')}
            className="w-full bg-amber-400 active:bg-amber-500 text-slate-950 rounded-2xl p-5 text-left shadow-lg flex items-center gap-4">
            <Package className="w-10 h-10 shrink-0" />
            <span>
              <span className="block text-xl font-black">Solicitar material</span>
              <span className="block text-sm font-semibold opacity-80">Lo que necesitas para continuar.</span>
            </span>
          </button>
          <button onClick={() => reset('problema')}
            className="w-full bg-rose-500 active:bg-rose-600 text-white rounded-2xl p-5 text-left shadow-lg flex items-center gap-4">
            <AlertTriangle className="w-10 h-10 shrink-0" />
            <span>
              <span className="block text-xl font-black">Tengo un problema</span>
              <span className="block text-sm font-semibold opacity-90">Sin luz o agua, otro gremio, zona no accesible…</span>
            </span>
          </button>
          <button onClick={() => reset('terminada')}
            className="w-full bg-emerald-500 active:bg-emerald-600 text-slate-950 rounded-2xl p-5 text-left shadow-lg flex items-center gap-4">
            <CheckCircle2 className="w-10 h-10 shrink-0" />
            <span>
              <span className="block text-xl font-black">Marcar {foco?.tipo === 'Fase' ? 'fase' : 'partida'} como terminada</span>
              <span className="block text-sm font-semibold opacity-80">Lista para revisión, con fotos del remate.</span>
            </span>
          </button>
          {partidas.length > 0 && (
            <button onClick={() => reset('partidas')}
              className="w-full bg-slate-900 border border-slate-700 active:bg-slate-800 rounded-2xl p-4 text-left flex items-center gap-3">
              <Gauge className="w-7 h-7 text-sky-400 shrink-0" />
              <span>
                <span className="block font-black">Reportar avance (%)</span>
                <span className="block text-sm text-slate-400">{partidas.length} partida(s) asignada(s) a tu empresa</span>
              </span>
              <ListChecks className="w-5 h-5 text-slate-500 ml-auto" />
            </button>
          )}
        </div>
        {info.telefonoEmpresa && (
          <a href={`tel:${info.telefonoEmpresa.replace(/\s+/g, '')}`}
            className="mt-8 flex items-center justify-center gap-2 text-slate-400 text-sm">
            <Phone className="w-4 h-4" /> Llamar a la oficina
          </a>
        )}
      </>
    );
  }

  const titles = {
    material: 'Solicitar material',
    problema: 'Tengo un problema',
    terminada: `Marcar ${foco?.tipo === 'Fase' ? 'fase' : 'partida'} como terminada`
  };
  const targetSelector = !foco && partidas.length > 0 && (
    <label className="block space-y-1">
      <span className="text-sm font-bold text-slate-300">¿En qué partida?</span>
      <select value={target} onChange={(e) => setTarget(e.target.value)}
        className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-base text-white">
        <option value="">{mode === 'terminada' ? 'Trabajo general de la obra' : 'General de la obra'}</option>
        {partidas.map((p) => (
          <option key={`${p.faseId}::${p.id}`} value={`${p.faseId}::${p.id}`}>{p.codigo} · {p.titulo}</option>
        ))}
      </select>
    </label>
  );
  const field = 'w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-base text-white focus:outline-none focus:border-amber-500';

  return shell(
    <>
      {back()}
      {header}
      <form onSubmit={submit} className="space-y-5">
        <h2 className="text-lg font-black">{titles[mode]}</h2>
        {targetSelector}

        {mode === 'material' && (
          <>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000}
              placeholder="¿Qué material o suministro necesitas para continuar? Ej.: cemento cola C2" className={field} />
            <div className="grid grid-cols-2 gap-2">
              <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} inputMode="decimal" placeholder="Cantidad" className={field} />
              <input value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="Unidad (sacos, m²…)" className={field} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: false, l: 'Normal' }, { v: true, l: 'Urgente · tajo parado' }].map((o) => (
                <button type="button" key={o.l} onClick={() => setUrgent(o.v)}
                  className={`rounded-xl px-3 py-3 text-sm font-bold border ${urgent === o.v ? (o.v ? 'bg-rose-500 text-white border-rose-500' : 'bg-amber-400 text-slate-950 border-amber-400') : 'bg-slate-900 border-slate-700 text-slate-200'}`}>
                  {o.l}
                </button>
              ))}
            </div>
            <label className="block text-sm font-bold text-slate-300">¿Para cuándo lo necesitas en obra?
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${field} mt-1`} />
            </label>
          </>
        )}

        {mode === 'problema' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {MOTIVOS.map((m) => (
                <button type="button" key={m} onClick={() => setMotivo(m)}
                  className={`rounded-xl px-3 py-3 text-sm font-bold border ${motivo === m ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-900 border-slate-700 text-slate-200'}`}>
                  {m}
                </button>
              ))}
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000}
              placeholder="Cuéntanos qué pasa (opcional)" className={field} />
            <p className="text-sm text-slate-400">La partida quedará marcada como bloqueada hasta que la oficina lo resuelva.</p>
          </>
        )}

        {mode === 'terminada' && (
          <>
            <p className="text-base font-semibold text-slate-200">Confirmo que el trabajo está listo para revisión.</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000}
              placeholder="Observaciones (opcional): remates pendientes, zonas a revisar…" className={field} />
            <p className="text-sm text-slate-400">Recomendado: hasta 3 fotos del remate como justificante.</p>
          </>
        )}

        <PhotoPicker photos={photos} setPhotos={setPhotos} max={3} />

        {error && <p className="text-rose-400 font-semibold">{error}</p>}

        <button type="submit" disabled={sending}
          className={`w-full rounded-2xl py-4 text-lg font-black flex items-center justify-center gap-2 disabled:opacity-60 ${
            mode === 'problema' ? 'bg-rose-500 text-white' : mode === 'terminada' ? 'bg-emerald-500 text-slate-950' : 'bg-amber-400 text-slate-950'
          }`}>
          {sending && <Loader2 className="w-5 h-5 animate-spin" />}
          {sending ? 'Enviando…' : mode === 'terminada' ? 'Confirmar terminado' : 'Enviar'}
        </button>
      </form>
    </>
  );
}
