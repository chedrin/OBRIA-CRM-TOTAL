import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Download, Eye, FileText, FolderUp, Image as ImageIcon, Loader2, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  borrarArchivoObra, descargarComoFile, listarArchivosObra, subirArchivoObra, urlArchivo, urlsFirmadas
} from '../../services/archivosObraService';
import { CATEGORIAS_ARCHIVO, acceptCategoria, esImagen, formatoTamano } from '../../utils/archivosObra';
import { esVisible3D } from '../../utils/formatos3D';

const VisorEscaneo3D = lazy(() => import('../Escaneo/VisorEscaneo3D'));

const CATS = Object.entries(CATEGORIAS_ARCHIVO);
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

function Icono({ archivo }) {
  if (archivo.categoria === 'lidar') return <Box className="w-7 h-7 text-sky-400" />;
  if (esImagen(archivo)) return <ImageIcon className="w-7 h-7 text-emerald-400" />;
  return <FileText className="w-7 h-7 text-amber-400" />;
}

/**
 * Archivos de la obra guardados en Supabase Storage (fotos, planos, LiDAR, documentación...).
 * En la base de datos solo van los metadatos; se abren con enlaces firmados de pocos minutos.
 */
export default function ArchivosObra({ obra }) {
  const { showNotification } = useApp();
  const [archivos, setArchivos] = useState([]);
  const [miniaturas, setMiniaturas] = useState({});
  const [filtro, setFiltro] = useState('');
  const [categoriaSubida, setCategoriaSubida] = useState('fotos');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [subidas, setSubidas] = useState([]); // { clave, nombre, progreso, control }
  const [arrastrando, setArrastrando] = useState(false);
  const [visor, setVisor] = useState(null); // File[] para el visor 3D
  const [abriendo, setAbriendo] = useState(null); // { id, progreso }
  const inputRef = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const lista = await listarArchivosObra(obra.id);
      setArchivos(lista);
      const conMiniatura = lista.filter(a => a.miniatura_path);
      if (conMiniatura.length) {
        const urls = await urlsFirmadas('obra-archivos', conMiniatura.map(a => a.miniatura_path));
        setMiniaturas(urls);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [obra.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => (filtro ? archivos.filter(a => a.categoria === filtro) : archivos), [archivos, filtro]);
  const cuenta = useMemo(() => archivos.reduce((acc, a) => ({ ...acc, [a.categoria]: (acc[a.categoria] || 0) + 1 }), {}), [archivos]);
  const totalBytes = useMemo(() => archivos.reduce((s, a) => s + Number(a.size_bytes || 0), 0), [archivos]);

  const subir = async (files) => {
    const lista = Array.from(files || []);
    for (const file of lista) {
      const clave = `${file.name}-${Date.now()}-${Math.random()}`;
      const control = new AbortController();
      setSubidas(prev => [...prev, { clave, nombre: file.name, progreso: 0, control }]);
      try {
        const archivo = await subirArchivoObra({
          obraId: obra.id,
          categoria: categoriaSubida,
          file,
          signal: control.signal,
          onProgress: (p) => setSubidas(prev => prev.map(s => (s.clave === clave ? { ...s, progreso: p } : s)))
        });
        setArchivos(prev => [archivo, ...prev]);
        if (archivo.miniatura_path) {
          urlsFirmadas('obra-archivos', [archivo.miniatura_path]).then(u => setMiniaturas(prev => ({ ...prev, ...u }))).catch(() => {});
        }
        showNotification(`«${file.name}» guardado en ${CATEGORIAS_ARCHIVO[categoriaSubida].label}.`);
      } catch (e) {
        showNotification(e.message, 'error');
      } finally {
        setSubidas(prev => prev.filter(s => s.clave !== clave));
      }
    }
  };

  const ver = async (archivo) => {
    if (archivo.categoria === 'lidar' && esVisible3D(archivo.nombre)) {
      setAbriendo({ id: archivo.id, progreso: 0 });
      try {
        const file = await descargarComoFile(archivo, p => setAbriendo({ id: archivo.id, progreso: p }));
        setVisor([file]);
      } catch (e) {
        showNotification(e.message, 'error');
      } finally {
        setAbriendo(null);
      }
      return;
    }
    // La ventana se abre antes de pedir el enlace para que el navegador no la bloquee.
    const ventana = window.open('about:blank', '_blank');
    try {
      const url = await urlArchivo(archivo);
      if (ventana) ventana.location.href = url;
      else window.location.href = url;
    } catch (e) {
      ventana?.close();
      showNotification(e.message, 'error');
    }
  };

  const descargar = async (archivo) => {
    try {
      const a = document.createElement('a');
      a.href = await urlArchivo(archivo, { descargar: true });
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  const borrar = async (archivo) => {
    if (!window.confirm(`¿Borrar «${archivo.nombre}»? Se elimina también de Supabase Storage.`)) return;
    try {
      await borrarArchivoObra(archivo);
      setArchivos(prev => prev.filter(a => a.id !== archivo.id));
      showNotification('Archivo borrado.');
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setArrastrando(false);
    subir(e.dataTransfer.files);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2">
            <FolderUp className="w-4 h-4" />
            <span>Archivos de la obra ({archivos.length})</span>
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Fotos, planos, escaneos LiDAR y documentación. Se guardan en Supabase Storage{totalBytes ? ` · ${formatoTamano(totalBytes)}` : ''}.
          </p>
        </div>
        <button onClick={cargar} className="p-2 shrink-0 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800" aria-label="Recargar archivos">
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Subida */}
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition ${arrastrando ? 'border-sky-400 bg-sky-500/10' : 'border-slate-700 bg-slate-950/50'}`}
      >
        <label className="text-xs text-slate-300 flex items-center gap-2">
          <span className="font-bold whitespace-nowrap">Guardar en</span>
          <select
            value={categoriaSubida}
            onChange={(e) => setCategoriaSubida(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
          >
            {CATS.map(([id, c]) => <option key={id} value={id}>{c.label}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="px-3 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <Upload className="w-4 h-4" />
          <span>Subir archivos</span>
        </button>
        <span className="text-[11px] text-slate-500">
          o arrástralos aquí · máx. {categoriaSubida === 'lidar' ? '5 GB' : '100 MB'} por archivo
          {categoriaSubida === 'lidar' ? ' (OBJ con texturas: súbelo en ZIP)' : ''}
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptCategoria(categoriaSubida)}
          className="hidden"
          onChange={(e) => { const l = e.target.files; subir(l); e.target.value = ''; }}
        />
      </div>

      {subidas.length > 0 && (
        <ul className="space-y-2">
          {subidas.map(s => (
            <li key={s.clave} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-200">{s.nombre}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-400 tabular-nums">{Math.round(s.progreso * 100)}%</span>
                  <button onClick={() => s.control.abort()} className="text-slate-400 hover:text-rose-400" aria-label={`Cancelar ${s.nombre}`}><X className="w-3.5 h-3.5" /></button>
                </span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-sky-400 transition-all" style={{ width: `${Math.round(s.progreso * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Filtro por categoría */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFiltro('')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${!filtro ? 'bg-sky-500/20 border-sky-500/50 text-sky-300' : 'border-slate-700 text-slate-400 hover:text-white'}`}
        >
          Todos ({archivos.length})
        </button>
        {CATS.filter(([id]) => cuenta[id]).map(([id, c]) => (
          <button
            key={id}
            onClick={() => setFiltro(id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${filtro === id ? 'bg-sky-500/20 border-sky-500/50 text-sky-300' : 'border-slate-700 text-slate-400 hover:text-white'}`}
          >
            {c.label} ({cuenta[id]})
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">{error}</p>
      ) : cargando && !archivos.length ? (
        <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando archivos…</p>
      ) : visibles.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Todavía no hay archivos{filtro ? ' en esta categoría' : ''}.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {visibles.map(a => (
            <li key={a.id} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center gap-3 min-w-0">
              <button onClick={() => ver(a)} className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center" aria-label={`Abrir ${a.nombre}`}>
                {a.miniatura_path && miniaturas[a.miniatura_path]
                  ? <img src={miniaturas[a.miniatura_path]} alt="" loading="lazy" className="w-full h-full object-cover" />
                  : <Icono archivo={a} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate" title={a.nombre}>{a.nombre}</p>
                <p className="text-[11px] text-slate-400 truncate">
                  {CATEGORIAS_ARCHIVO[a.categoria]?.label} · {formatoTamano(a.size_bytes)}
                </p>
                <p className="text-[11px] text-slate-500">{fecha(a.created_at)}</p>
                {abriendo?.id === a.id && (
                  <p className="text-[11px] text-sky-300">Descargando para el visor… {Math.round(abriendo.progreso * 100)}%</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => ver(a)} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800" aria-label={`Ver ${a.nombre}`} title="Ver"><Eye className="w-4 h-4" /></button>
                <button onClick={() => descargar(a)} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800" aria-label={`Descargar ${a.nombre}`} title="Descargar"><Download className="w-4 h-4" /></button>
                <button onClick={() => borrar(a)} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-500/10" aria-label={`Borrar ${a.nombre}`} title="Borrar"><Trash2 className="w-4 h-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {visor && (
        <Suspense fallback={null}>
          <VisorEscaneo3D archivos={visor} onClose={() => setVisor(null)} />
        </Suspense>
      )}
    </div>
  );
}
