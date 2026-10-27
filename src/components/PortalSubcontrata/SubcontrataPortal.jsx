import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Camera, X, Loader2, ArrowLeft, HardHat, Phone } from 'lucide-react';

/**
 * Página del enlace mágico para subcontratas: /sub/<token>
 * Sin login ni instalación. Dos acciones: "Trabajo terminado" y "Reportar necesidad o incidencia".
 * Las fotos se reducen en el móvil antes de subirlas (máx. 1600 px, JPEG) para que vaya rápido con poca cobertura.
 */

const MAX_PHOTOS = 2;
const MAX_SIDE = 1600;

function tokenFromPath() {
  const match = window.location.pathname.match(/^\/sub\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function compressImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(blob || file);
      }, 'image/jpeg', 0.8);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function PhotoPicker({ photos, setPhotos }) {
  const add = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, MAX_PHOTOS - photos.length);
    event.target.value = '';
    const compressed = await Promise.all(files.map(async (f) => {
      const blob = await compressImage(f);
      return { blob, preview: URL.createObjectURL(blob) };
    }));
    setPhotos((prev) => [...prev, ...compressed].slice(0, MAX_PHOTOS));
  };
  const remove = (index) => setPhotos((prev) => prev.filter((_, i) => i !== index));

  return (
    <div className="flex gap-3 flex-wrap">
      {photos.map((p, i) => (
        <div key={p.preview} className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-700">
          <img src={p.preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
          <button type="button" onClick={() => remove(i)} aria-label="Quitar foto"
            className="absolute top-1 right-1 bg-slate-950/80 rounded-full p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      {photos.length < MAX_PHOTOS && (
        <label className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-600 flex flex-col items-center justify-center gap-1 text-slate-400 cursor-pointer active:bg-slate-800">
          <Camera className="w-7 h-7" />
          <span className="text-xs font-semibold">Foto</span>
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={add} />
        </label>
      )}
    </div>
  );
}

export default function SubcontrataPortal() {
  const [token] = useState(tokenFromPath);
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState('menu'); // menu | terminado | necesidad | hecho
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('material');
  const [urgent, setUrgent] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [doneMessage, setDoneMessage] = useState('');

  useEffect(() => {
    fetch(`/api/sub/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || 'No se pudo abrir el enlace.');
        setInfo(body);
      })
      .catch((e) => setLoadError(e.message));
  }, [token]);

  const reset = (nextMode) => {
    setNotes('');
    setPhotos([]);
    setUrgent(false);
    setCategory('material');
    setError('');
    setMode(nextMode);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (mode === 'necesidad' && !notes.trim()) {
      setError('Escribe brevemente qué pasa o qué hace falta.');
      return;
    }
    setSending(true);
    setError('');
    const form = new FormData();
    if (mode === 'terminado') {
      form.append('notas', notes);
    } else {
      form.append('descripcion', notes);
      form.append('categoria', category);
      form.append('urgente', String(urgent));
    }
    photos.forEach((p, i) => form.append('fotos', p.blob, `foto-${i + 1}.jpg`));
    try {
      const r = await fetch(`/api/sub/${encodeURIComponent(token)}/${mode}`, { method: 'POST', body: form });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || 'No se pudo enviar. Inténtalo otra vez.');
      setDoneMessage(body.mensaje || 'Enviado.');
      setMode('hecho');
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

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

  if (!info) {
    return shell(
      <div className="mt-24 flex justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const header = (
    <header className="mb-6">
      <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
        <HardHat className="w-5 h-5" />
        <span>{info.empresa}</span>
      </div>
      <h1 className="text-xl font-black mt-2">{info.subcontrata}</h1>
      {info.obra && <p className="text-slate-300 mt-1">{info.obra}</p>}
      {info.direccion && <p className="text-slate-500 text-sm">{info.direccion}</p>}
      {info.tarea && (
        <p className="mt-2 inline-block bg-slate-800 text-slate-200 text-sm font-semibold px-3 py-1 rounded-lg">{info.tarea}</p>
      )}
    </header>
  );

  if (mode === 'hecho') {
    return shell(
      <>
        {header}
        <div className="text-center space-y-4 mt-10">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
          <p className="text-lg font-bold">{doneMessage}</p>
          <button onClick={() => reset('menu')} className="text-amber-400 font-semibold underline">Enviar otro aviso</button>
        </div>
      </>
    );
  }

  if (mode === 'menu') {
    return shell(
      <>
        {header}
        <div className="space-y-4">
          <button onClick={() => reset('terminado')}
            className="w-full bg-emerald-500 active:bg-emerald-600 text-slate-950 rounded-2xl p-6 text-left shadow-lg">
            <CheckCircle2 className="w-9 h-9 mb-2" />
            <span className="block text-xl font-black">Trabajo terminado</span>
            <span className="block text-sm font-semibold opacity-80">Listo para revisión. Puedes añadir 1 o 2 fotos.</span>
          </button>
          <button onClick={() => reset('necesidad')}
            className="w-full bg-amber-500 active:bg-amber-600 text-slate-950 rounded-2xl p-6 text-left shadow-lg">
            <AlertTriangle className="w-9 h-9 mb-2" />
            <span className="block text-xl font-black">Necesidad o incidencia</span>
            <span className="block text-sm font-semibold opacity-80">Falta material, tajo bloqueado, avería…</span>
          </button>
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

  const isDone = mode === 'terminado';
  return shell(
    <>
      <button onClick={() => reset('menu')} className="flex items-center gap-1 text-slate-400 text-sm mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>
      {header}
      <form onSubmit={submit} className="space-y-5">
        <h2 className="text-lg font-black">{isDone ? 'Trabajo terminado' : 'Necesidad o incidencia'}</h2>

        {!isDone && (
          <div className="grid grid-cols-2 gap-2">
            {info.categorias.map((c) => (
              <button type="button" key={c.value} onClick={() => setCategory(c.value)}
                className={`rounded-xl px-3 py-3 text-sm font-bold border ${category === c.value ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-900 border-slate-700 text-slate-200'}`}>
                {c.label}
              </button>
            ))}
          </div>
        )}

        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={2000}
          placeholder={isDone ? 'Notas (opcional): qué se ha hecho, remates pendientes…' : '¿Qué pasa o qué hace falta? Ej.: 20 sacos de cemento cola para mañana'}
          className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-base focus:outline-none focus:border-amber-500" />

        {!isDone && (
          <label className="flex items-center gap-3 text-base font-semibold">
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="w-5 h-5 accent-rose-500" />
            Es urgente (para la obra)
          </label>
        )}

        <PhotoPicker photos={photos} setPhotos={setPhotos} />

        {error && <p className="text-rose-400 font-semibold">{error}</p>}

        <button type="submit" disabled={sending}
          className={`w-full rounded-2xl py-4 text-lg font-black flex items-center justify-center gap-2 disabled:opacity-60 ${isDone ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'}`}>
          {sending && <Loader2 className="w-5 h-5 animate-spin" />}
          {sending ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
    </>
  );
}
