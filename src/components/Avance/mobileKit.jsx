import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, Mic, MicOff } from 'lucide-react';

// Piezas móviles compartidas por el enlace de la subcontrata y el Portal del Obrero.

const MAX_SIDE = 1600;

/** Reduce la foto en el móvil (máx. 1600 px, JPEG) para que suba rápido con poca cobertura. */
export function compressImage(file) {
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

export function PhotoPicker({ photos, setPhotos, max = 2 }) {
  const add = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, max - photos.length);
    event.target.value = '';
    const compressed = await Promise.all(files.map(async (f) => {
      const blob = await compressImage(f);
      return { blob, preview: URL.createObjectURL(blob) };
    }));
    setPhotos((prev) => [...prev, ...compressed].slice(0, max));
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
      {photos.length < max && (
        <label className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-600 flex flex-col items-center justify-center gap-1 text-slate-400 cursor-pointer active:bg-slate-800">
          <Camera className="w-7 h-7" />
          <span className="text-xs font-semibold">Foto</span>
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={add} />
        </label>
      )}
    </div>
  );
}

/**
 * Nota de voz dictada: usa el reconocimiento de voz del navegador (Chrome Android,
 * Safari iOS) y añade el texto a la nota. Si el móvil no lo admite, no se muestra.
 */
export function DictadoButton({ onText }) {
  const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  useEffect(() => () => recRef.current?.abort?.(), []);
  if (!Recognition) return null;

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Recognition();
    rec.lang = 'es-ES';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0]?.transcript || '').join(' ').trim();
      if (text) onText(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <button type="button" onClick={toggle}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold border ${listening ? 'bg-rose-500 text-white border-rose-500 animate-pulse' : 'bg-slate-900 text-slate-200 border-slate-700'}`}>
      {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      {listening ? 'Escuchando… toca para parar' : 'Dictar nota'}
    </button>
  );
}
