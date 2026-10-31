import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Undo2,
  Redo2,
  Save,
  FileDown,
  Ruler,
  DoorOpen,
  Square,
  Type,
  Trash2,
  RotateCw,
  Copy,
  ZoomIn,
  ZoomOut,
  Maximize,
  Sparkles,
  ImagePlus,
  Plus,
  Magnet,
  AppWindow,
  Columns2,
  PencilRuler,
  AlertTriangle,
  Box,
  Lock,
  LockOpen,
  ScanLine
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import CroquisLienzo, { reajustarHuecos } from './CroquisLienzo';
import EscaneoLidarSubida from './EscaneoLidarSubida';
import { generateCroquisViaBackend } from '../../services/backendAiService';
import { buildCroquisPdf } from '../../utils/croquisPdf';
import {
  ALTO_DEFECTO,
  ANCHO_HUECO,
  COLORES_ESTANCIA,
  NOMBRE_HUECO,
  cambiarLargoLado,
  centroide,
  croquisDesdeMediciones,
  esRectangulo,
  formatoMetros,
  lados,
  quitarVertice,
  rehacerEstancia,
  respetaFijas,
  formatoM2,
  leerMediciones,
  lienzoParaPlano,
  largoMuro,
  muroMasCercano,
  normalizarCroquis,
  nuevoId,
  planVacio,
  ratioQueCabe,
  redondear,
  resumenSuperficies,
  textoMediciones
} from '../../utils/croquisPlano';
import ModalOverlay from '../Common/ModalOverlay';

const inputCls = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400';
const btnCls = 'px-2.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700';
const MAX_FOTOS = 8;
// La vista 3D (three.js) solo se descarga al abrirla.
const Croquis3D = lazy(() => import('./Croquis3D'));
const VisorEscaneo3D = lazy(() => import('../Escaneo/VisorEscaneo3D'));

const PALETA = [
  { tipo: 'room', label: 'Estancia', icon: Square },
  { tipo: 'door', label: 'Puerta', icon: DoorOpen },
  { tipo: 'window', label: 'Ventana', icon: AppWindow },
  { tipo: 'sliding_door', label: 'Corredera', icon: Columns2 },
  { tipo: 'texto', label: 'Texto', icon: Type },
  { tipo: 'cota', label: 'Cota', icon: Ruler }
];

// Orden de giro de una puerta: bisagra y sentido de apertura.
const GIROS = [['in', 'start'], ['in', 'end'], ['out', 'end'], ['out', 'start']];

const filaVacia = () => ({ id: nuevoId('med'), estancia: '', largo: '', ancho: '', alto: '' });

// Fotos del móvil: se reducen a 1600 px (JPEG) antes de enviarlas a la IA.
async function reducirFoto(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    if (escala === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

const esCampoDeTexto = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

/**
 * Generador y editor del croquis 2D.
 * - croquis: lo guardado ({ plan, mediciones, notas, actualizado }) o null.
 * - contexto: { medidasNotas, obraTitulo, partidas } para rellenar las mediciones y orientar a la IA.
 * - cabecera: datos del membrete del PDF (número, fecha, cliente, NIF, obra, dirección).
 * - onGuardar(croquis): guarda en el presupuesto o en la obra.
 */
export default function CroquisEditorModal({ titulo = 'Croquis 2D', croquis = null, contexto = {}, cabecera = {}, onGuardar, onClose }) {
  const { empresaConfig, showNotification } = useApp();
  const planInicial = useMemo(() => (croquis?.plan ? normalizarCroquis(croquis.plan) : null), [croquis]);

  const [vista, setVista] = useState(planInicial?.rooms.length ? 'editor' : 'datos');
  const [filas, setFilas] = useState(() => {
    if (Array.isArray(croquis?.mediciones) && croquis.mediciones.length) return croquis.mediciones;
    const leidas = leerMediciones(contexto.medidasNotas);
    return leidas.length ? leidas : [filaVacia(), filaVacia()];
  });
  const [notas, setNotas] = useState(croquis?.notas || '');
  const [fotos, setFotos] = useState([]);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');

  const [hist, setHist] = useState({ pasado: [], actual: planInicial || planVacio(), futuro: [] });
  const plan = hist.actual;
  const [seleccion, setSeleccion] = useState(null);
  const [paso, setPaso] = useState(0.05);
  const [mostrarCotas, setMostrarCotas] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [vista3d, setVista3d] = useState(false);
  // Escaneo LiDAR: panel de subida bajo la cabecera y último escaneo para volver a verlo en 3D.
  const [panelLidar, setPanelLidar] = useState(false);
  const [escaneo3D, setEscaneo3D] = useState(null);
  const [verEscaneo3D, setVerEscaneo3D] = useState(false);
  const [editCota, setEditCota] = useState(null); // { roomId, edge, x, y } al pulsar una cota del plano
  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;

  useEffect(() => () => fotosRef.current.forEach(f => URL.revokeObjectURL(f.url)), []);

  // --- Historial (deshacer / rehacer) ---
  const conLienzo = (p) => ({ ...p, canvas: lienzoParaPlano(p, p.canvas) });
  const aplicar = useCallback((cambio) => {
    setHist(h => {
      const nuevo = typeof cambio === 'function' ? cambio(h.actual) : cambio;
      if (nuevo === h.actual) return h;
      return { pasado: [...h.pasado.slice(-79), h.actual], actual: conLienzo(nuevo), futuro: [] };
    });
    setSinGuardar(true);
  }, []);
  const previsualizar = useCallback((nuevo) => setHist(h => ({ ...h, actual: nuevo })), []);
  const confirmarArrastre = useCallback((antes) => {
    setHist(h => ({ pasado: [...h.pasado.slice(-79), antes], actual: conLienzo(h.actual), futuro: [] }));
    setSinGuardar(true);
  }, []);
  const deshacer = useCallback(() => setHist(h => (h.pasado.length ? { pasado: h.pasado.slice(0, -1), actual: h.pasado[h.pasado.length - 1], futuro: [h.actual, ...h.futuro] } : h)), []);
  const rehacer = useCallback(() => setHist(h => (h.futuro.length ? { pasado: [...h.pasado, h.actual], actual: h.futuro[0], futuro: h.futuro.slice(1) } : h)), []);
  const reiniciarPlan = (nuevo) => {
    setHist(h => ({ pasado: h.actual.rooms.length ? [...h.pasado, h.actual] : h.pasado, actual: nuevo, futuro: [] }));
    setSeleccion(null);
    setSinGuardar(true);
  };

  // --- Elementos ---
  const elemento = seleccion && ({
    room: plan.rooms, hueco: plan.openings, texto: plan.labels, cota: plan.dimensions
  }[seleccion.tipo] || []).find(e => e.id === seleccion.id);

  // Nombre, color, altura o caja (x, y, ancho, fondo: mueve o escala los puntos). Respeta las medidas fijas.
  const cambiarRoom = (id, cambios) => {
    const r = plan.rooms.find(q => q.id === id);
    if (!r) return;
    const { x = r.x, y = r.y, width = r.width, height = r.height, ...resto } = cambios;
    const sx = width / (r.width || 1), sy = height / (r.height || 1);
    const nueva = rehacerEstancia({ ...r, ...resto, points: r.points.map(([qx, qy]) => [x + (qx - r.x) * sx, y + (qy - r.y) * sy]) });
    if (!respetaFijas(r, nueva)) {
      showNotification('Esa medida está fija (🔒). Desbloquea el lado o cambia su medida en la lista de lados.', 'error');
      return;
    }
    aplicar(p => reajustarHuecos({ ...p, rooms: p.rooms.map(q => (q.id === id ? nueva : q)) }, id));
  };
  // Medida de un lado (la escribe el usuario: manda sobre el bloqueo) y bloqueo del lado.
  const cambiarLado = (id, edge, { largo, fija } = {}) => aplicar(p => reajustarHuecos({
    ...p,
    rooms: p.rooms.map(r => {
      if (r.id !== id) return r;
      let n = largo ? cambiarLargoLado(r, edge, largo) : r;
      if (fija !== undefined) n = { ...n, fijas: fija ? [...new Set([...(n.fijas || []), edge])] : (n.fijas || []).filter(i => i !== edge) };
      return n;
    })
  }, id));
  const fijarTodos = (id, fija) => aplicar(p => ({ ...p, rooms: p.rooms.map(r => (r.id === id ? { ...r, fijas: fija ? r.points.map((_, i) => i) : [] } : r)) }));
  const cambiarHueco = (id, cambios) => aplicar(p => ({
    ...p,
    openings: p.openings.map(o => {
      if (o.id !== id) return o;
      const n = { ...o, ...cambios };
      const room = p.rooms.find(r => r.id === n.roomId);
      if (!room) return n;
      const widthMeters = Math.min(Math.max(0.4, n.widthMeters), Math.max(0.4, largoMuro(room, n.edge) - 0.1));
      return { ...n, widthMeters, positionRatio: ratioQueCabe(room, n.edge, n.positionRatio, widthMeters) };
    })
  }));
  const cambiarLista = (lista, id, cambios) => aplicar(p => ({ ...p, [lista]: p[lista].map(e => (e.id === id ? { ...e, ...cambios } : e)) }));

  const eliminarSeleccion = useCallback(() => {
    if (!seleccion) return;
    // Con un punto seleccionado, Supr quita ese punto (no la estancia).
    if (seleccion.tipo === 'room' && Number.isInteger(seleccion.vertice)) {
      aplicar(p => quitarVertice(p, seleccion.id, seleccion.vertice));
      setSeleccion({ tipo: 'room', id: seleccion.id });
      return;
    }
    aplicar(p => {
      if (seleccion.tipo === 'room') return { ...p, rooms: p.rooms.filter(r => r.id !== seleccion.id), openings: p.openings.filter(o => o.roomId !== seleccion.id) };
      if (seleccion.tipo === 'hueco') return { ...p, openings: p.openings.filter(o => o.id !== seleccion.id) };
      if (seleccion.tipo === 'texto') return { ...p, labels: p.labels.filter(l => l.id !== seleccion.id) };
      return { ...p, dimensions: p.dimensions.filter(d => d.id !== seleccion.id) };
    });
    setSeleccion(null);
  }, [seleccion, aplicar]);

  const girarSeleccion = useCallback(() => {
    if (!seleccion) return;
    if (seleccion.tipo === 'hueco') {
      aplicar(p => ({
        ...p,
        openings: p.openings.map(o => {
          if (o.id !== seleccion.id) return o;
          const i = GIROS.findIndex(([s, h]) => s === (o.swing || 'in') && h === (o.hinge || 'start'));
          const [swing, hinge] = GIROS[(i + 1) % GIROS.length];
          return { ...o, swing, hinge };
        })
      }));
    } else if (seleccion.tipo === 'texto') {
      aplicar(p => ({ ...p, labels: p.labels.map(l => (l.id === seleccion.id ? { ...l, rotation: ((l.rotation || 0) + 90) % 360 } : l)) }));
    } else if (seleccion.tipo === 'room') {
      // Girar una estancia 90° sobre su centro (conserva las medidas y los huecos).
      aplicar(p => ({
        ...p,
        rooms: p.rooms.map(r => {
          if (r.id !== seleccion.id) return r;
          const [cx, cy] = centroide(r.points);
          return rehacerEstancia({ ...r, points: r.points.map(([x, y]) => [cx - (y - cy), cy + (x - cx)]) });
        })
      }));
    }
  }, [seleccion, aplicar]);

  const duplicarEstancia = () => {
    const r = elemento;
    if (!r) return;
    const id = nuevoId('room');
    aplicar(p => ({ ...p, rooms: [...p.rooms, rehacerEstancia({ ...r, id, name: `${r.name} (copia)`, points: r.points.map(([x, y]) => [x + r.width, y]) })] }));
    setSeleccion({ tipo: 'room', id });
  };

  const moverSeleccion = useCallback((dx, dy) => {
    if (!seleccion) return;
    aplicar(p => {
      if (seleccion.tipo === 'room') return { ...p, rooms: p.rooms.map(r => (r.id === seleccion.id ? rehacerEstancia({ ...r, points: r.points.map(([x, y]) => [x + dx, y + dy]) }) : r)) };
      if (seleccion.tipo === 'texto') return { ...p, labels: p.labels.map(l => (l.id === seleccion.id ? { ...l, x: redondear(l.x + dx, 3), y: redondear(l.y + dy, 3) } : l)) };
      if (seleccion.tipo === 'cota') return { ...p, dimensions: p.dimensions.map(d => (d.id === seleccion.id ? { ...d, x1: d.x1 + dx, x2: d.x2 + dx, y1: d.y1 + dy, y2: d.y2 + dy } : d)) };
      return p;
    });
  }, [seleccion, aplicar]);

  // Añade un elemento de la paleta en (x, y) metros.
  const agregar = (tipo, x, y) => {
    const ajustar = (v) => (paso ? Math.round(v / paso) * paso : v);
    if (tipo === 'room') {
      const id = nuevoId('room');
      const x0 = Math.max(0, ajustar(x - 1.5)), y0 = Math.max(0, ajustar(y - 1.5));
      aplicar(p => ({ ...p, rooms: [...p.rooms, rehacerEstancia({ id, name: 'Nueva estancia', points: [[x0, y0], [x0 + 3, y0], [x0 + 3, y0 + 3], [x0, y0 + 3]], fijas: [], color: COLORES_ESTANCIA[p.rooms.length % COLORES_ESTANCIA.length] })] }));
      setSeleccion({ tipo: 'room', id });
    } else if (tipo in ANCHO_HUECO) {
      const muro = muroMasCercano(plan, x, y);
      if (!muro) {
        showNotification('Primero añade una estancia: puertas y ventanas van en sus muros.', 'error');
        return;
      }
      const room = plan.rooms.find(r => r.id === muro.roomId);
      const widthMeters = Math.min(ANCHO_HUECO[tipo], Math.max(0.4, largoMuro(room, muro.edge) - 0.1));
      const id = nuevoId('op');
      aplicar(p => ({ ...p, openings: [...p.openings, { id, type: tipo, roomId: room.id, edge: muro.edge, widthMeters, positionRatio: ratioQueCabe(room, muro.edge, muro.ratio, widthMeters), swing: 'in', hinge: 'start' }] }));
      setSeleccion({ tipo: 'hueco', id });
    } else if (tipo === 'texto') {
      const id = nuevoId('lbl');
      aplicar(p => ({ ...p, labels: [...p.labels, { id, text: 'Texto', x: redondear(ajustar(x), 3), y: redondear(ajustar(y), 3), rotation: 0, size: 0.25 }] }));
      setSeleccion({ tipo: 'texto', id });
    } else if (tipo === 'cota') {
      const id = nuevoId('dim');
      aplicar(p => ({ ...p, dimensions: [...p.dimensions, { id, x1: redondear(ajustar(x - 1), 3), y1: redondear(ajustar(y), 3), x2: redondear(ajustar(x + 1), 3), y2: redondear(ajustar(y), 3), offset: 0 }] }));
      setSeleccion({ tipo: 'cota', id });
    }
  };

  // Pulsar en la paleta (sin arrastrar, útil en el móvil): junto a la estancia seleccionada o en el centro.
  const agregarConClic = (tipo) => {
    const ref = seleccion?.tipo === 'room' ? elemento : plan.rooms[plan.rooms.length - 1];
    if (tipo === 'room') {
      const b = plan.rooms.length ? Math.max(...plan.rooms.map(r => r.x + r.width)) : 0;
      agregar('room', b + 1.5, 1.5);
    } else if (ref) {
      agregar(tipo, ref.x + ref.width / 2, tipo in ANCHO_HUECO ? ref.y : ref.y + ref.height / 2);
    } else {
      agregar(tipo, plan.canvas.widthMeters / 2, plan.canvas.heightMeters / 2);
    }
  };

  // Teclado: Supr borra, flechas mueven, R gira, Ctrl+Z / Ctrl+Y. (Escape lo gestiona la app y pulsa "Cerrar".)
  useEffect(() => {
    if (vista !== 'editor') return undefined;
    const onKey = (e) => {
      if (esCampoDeTexto(e.target)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer(); return; }
      if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); rehacer(); return; }
      if (!seleccion) return;
      const d = e.shiftKey ? 0.5 : (paso || 0.05);
      const flechas = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); eliminarSeleccion(); } else if (flechas[e.key]) { e.preventDefault(); moverSeleccion(...flechas[e.key]); } else if (e.key.toLowerCase() === 'r') { girarSeleccion(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [vista, seleccion, paso, deshacer, rehacer, eliminarSeleccion, moverSeleccion, girarSeleccion]);

  // --- Datos, fotos e IA ---
  const cambiarFila = (id, campo, valor) => setFilas(prev => prev.map(f => (f.id === id ? { ...f, [campo]: valor } : f)));
  const subirFotos = async (e) => {
    const archivos = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    e.target.value = '';
    const hueco = MAX_FOTOS - fotos.length;
    if (archivos.length > hueco) showNotification(`Máximo ${MAX_FOTOS} fotos por croquis: se añaden ${Math.max(0, hueco)}.`, 'error');
    const nuevas = await Promise.all(archivos.slice(0, Math.max(0, hueco)).map(async (f) => {
      const file = await reducirFoto(f);
      return { id: nuevoId('foto'), file, url: URL.createObjectURL(file), nombre: f.name };
    }));
    setFotos(prev => [...prev, ...nuevas]);
  };
  const quitarFoto = (id) => setFotos(prev => {
    const f = prev.find(x => x.id === id);
    if (f) URL.revokeObjectURL(f.url);
    return prev.filter(x => x.id !== id);
  });

  const medicionesTexto = textoMediciones(filas);

  // Escaneo LiDAR: con medidas, el plano sale tal cual (medidas fijas); una imagen del plano va a la IA como foto.
  const usarEscaneo = async (res) => {
    if (res.formato === 'imagen') {
      if (fotos.length >= MAX_FOTOS) {
        showNotification(`Ya hay ${MAX_FOTOS} fotos: quita alguna para añadir el plano.`, 'error');
        return;
      }
      const file = await reducirFoto(res.imagen);
      setFotos(prev => [{ id: nuevoId('foto'), file, url: URL.createObjectURL(file), nombre: res.nombreArchivo }, ...prev]);
      const aviso = `La foto «${res.nombreArchivo}» es el plano exportado de un escaneo LiDAR: copia su distribución y sus cotas exactamente.`;
      setNotas(prev => (prev.includes(aviso) ? prev : [prev.trim(), aviso].filter(Boolean).join('\n')));
      showNotification('Plano añadido a las fotos. Pulsa «Generar croquis 2D con IA».');
      return;
    }
    if (plan.rooms.length && !window.confirm('Ya hay un croquis. ¿Sustituirlo por el del escaneo? (Podrás deshacerlo.)')) return;
    setError('');
    setPanelLidar(false);
    reiniciarPlan(res.plan);
    setFilas(res.mediciones.length ? res.mediciones : [filaVacia()]);
    setVista('editor');
    setZoom(1);
    showNotification(`Croquis del escaneo: ${res.plan.rooms.length} estancias con sus medidas fijas. Revisa nombres y huecos.`);
  };

  const generarConIa = async () => {
    if (!medicionesTexto && !notas.trim() && !fotos.length) {
      setError('Añade al menos las medidas de una estancia (largo y ancho), alguna nota o fotos.');
      return;
    }
    if (plan.rooms.length && !window.confirm('Ya hay un croquis. ¿Sustituirlo por uno nuevo de la IA? (Podrás deshacerlo.)')) return;
    setError('');
    setGenerando(true);
    try {
      const res = await generateCroquisViaBackend({
        fotos: fotos.map(f => f.file),
        mediciones: medicionesTexto,
        notas,
        obra: contexto.obraTitulo || cabecera.obraTitulo || '',
        partidas: contexto.partidas || []
      });
      reiniciarPlan(normalizarCroquis(res.plan));
      setVista('editor');
      setZoom(1);
      showNotification(`Croquis generado con ${res.plan.rooms.length} estancias. Revísalo y ajústalo antes de exportarlo.`);
    } catch (err) {
      setError(err.message || 'No se pudo generar el croquis.');
    } finally {
      setGenerando(false);
    }
  };

  const dibujarSinIa = () => {
    const nuevo = croquisDesdeMediciones(filas);
    if (!nuevo.rooms.length) {
      setError('Para dibujar sin IA, indica el largo y el ancho de al menos una estancia.');
      return;
    }
    if (plan.rooms.length && !window.confirm('Ya hay un croquis. ¿Sustituirlo? (Podrás deshacerlo.)')) return;
    setError('');
    reiniciarPlan(nuevo);
    setVista('editor');
  };

  const guardar = () => {
    onGuardar?.({ plan, mediciones: filas.filter(f => f.estancia || f.largo || f.ancho), notas, actualizado: new Date().toISOString() });
    setSinGuardar(false);
  };

  const exportarPdf = () => {
    if (!plan.rooms.length) {
      showNotification('El croquis está vacío: añade alguna estancia antes de exportarlo.', 'error');
      return;
    }
    try {
      const doc = buildCroquisPdf({ plan, cabecera, empresaConfig });
      doc.save(`Croquis-${String(cabecera.numero || cabecera.obraTitulo || 'vivienda').replace(/[^\w.-]+/g, '_')}.pdf`);
      showNotification('Croquis exportado en PDF.');
    } catch (err) {
      console.error(err);
      showNotification(`No se pudo crear el PDF: ${err.message}`, 'error');
    }
  };

  const cerrar = () => {
    if (sinGuardar && !window.confirm('Hay cambios sin guardar en el croquis. ¿Cerrar sin guardar?')) return;
    onClose?.();
  };

  const sup = resumenSuperficies(plan);

  return (
    <ModalOverlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-stretch justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="croquis-titulo">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-[1500px] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">

        {/* Cabecera */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center gap-2 justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <PencilRuler className="w-5 h-5 text-amber-400 shrink-0" />
            <h3 id="croquis-titulo" className="font-bold text-white text-sm sm:text-base truncate">{titulo}</h3>
            <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-0.5 ml-1">
              {[['datos', '1. Medidas y fotos'], ['editor', '2. Editor']].map(([id, label]) => (
                <button key={id} onClick={() => setVista(id)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${vista === id ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => setPanelLidar(v => !v)} aria-expanded={panelLidar} className={`${btnCls} ${panelLidar ? '!bg-cyan-500 !text-slate-950 !border-cyan-400' : '!border-cyan-500/40 !text-cyan-300'}`} title="Subir un escaneo LiDAR para dibujar el croquis y verlo en 3D">
              <ScanLine className="w-3.5 h-3.5" /><span>Escaneo LiDAR</span>
            </button>
            {escaneo3D && (
              <button onClick={() => setVerEscaneo3D(true)} className={`${btnCls} !border-cyan-500/40 !text-cyan-300`} title="Abrir el último escaneo subido en el visor 3D">
                <Box className="w-3.5 h-3.5" /><span>Ver escaneo 3D</span>
              </button>
            )}
            {vista === 'editor' && (
              <>
                <button onClick={deshacer} disabled={!hist.pasado.length} className={btnCls} title="Deshacer (Ctrl+Z)" aria-label="Deshacer"><Undo2 className="w-3.5 h-3.5" /></button>
                <button onClick={rehacer} disabled={!hist.futuro.length} className={btnCls} title="Rehacer (Ctrl+Y)" aria-label="Rehacer"><Redo2 className="w-3.5 h-3.5" /></button>
              </>
            )}
            <button onClick={exportarPdf} className={btnCls}><FileDown className="w-3.5 h-3.5 text-amber-400" /><span>Exportar PDF</span></button>
            <button onClick={guardar} disabled={!sinGuardar} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /><span>{sinGuardar ? 'Guardar' : 'Guardado'}</span>
            </button>
            <button onClick={cerrar} aria-label="Cerrar" className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {panelLidar && (
          <div className="px-4 py-3 border-b border-cyan-500/30 bg-slate-950/80 shrink-0 space-y-1.5">
            <p className="text-[11px] text-slate-400">Con medidas (JSON de RoomPlan, DXF, OBJ, CSV) el croquis se dibuja con las cotas reales. Los modelos 3D (GLB, USDZ, el ZIP de la app, PLY, LAS…) se abren en el visor con sus colores.</p>
            <EscaneoLidarSubida onUsar={usarEscaneo} onArchivos3D={setEscaneo3D} textoUsar="Dibujar el croquis con el escaneo" />
          </div>
        )}

        {verEscaneo3D && escaneo3D && (
          <Suspense fallback={null}>
            <VisorEscaneo3D archivos={escaneo3D} onClose={() => setVerEscaneo3D(false)} />
          </Suspense>
        )}

        {vista === 'datos' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-xs p-3 rounded-xl flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span className="whitespace-pre-wrap">{error}</span>
              </div>
            )}

            {!panelLidar && (
              <section className="space-y-2 bg-slate-950/60 border border-cyan-500/20 rounded-2xl p-3">
                <div>
                  <h4 className="text-sm font-bold text-white">Escaneo LiDAR</h4>
                  <p className="text-[11px] text-slate-400">Con un escaneo del iPhone o iPad Pro el croquis sale con las medidas reales, sin IA, y rellena las mediciones de abajo. También puedes verlo en 3D.</p>
                </div>
                <EscaneoLidarSubida onUsar={usarEscaneo} onArchivos3D={setEscaneo3D} textoUsar="Dibujar el croquis con el escaneo" />
              </section>
            )}

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white">Mediciones por estancia</h4>
                  <p className="text-[11px] text-slate-400">Son la fuente de verdad de las cotas. Largo = dirección este-oeste (ancho en el plano), ancho = norte-sur.</p>
                </div>
                <button onClick={() => setFilas(prev => [...prev, filaVacia()])} className={btnCls}><Plus className="w-3.5 h-3.5" /><span>Estancia</span></button>
              </div>
              <div className="space-y-1.5">
                <div className="hidden sm:grid grid-cols-[1fr_90px_90px_80px_32px] gap-2 text-[10px] uppercase tracking-wider text-slate-500 font-bold px-1">
                  <span>Estancia</span><span>Largo (m)</span><span>Ancho (m)</span><span>Alto (m)</span><span />
                </div>
                {filas.map(f => (
                  <div key={f.id} className="grid grid-cols-[1fr_1fr_1fr_32px] sm:grid-cols-[1fr_90px_90px_80px_32px] gap-2 items-center">
                    <input value={f.estancia} onChange={(e) => cambiarFila(f.id, 'estancia', e.target.value)} placeholder="Salón, Baño 1…" className={`${inputCls} col-span-4 sm:col-span-1`} aria-label="Estancia" />
                    <input value={f.largo} onChange={(e) => cambiarFila(f.id, 'largo', e.target.value)} inputMode="decimal" placeholder="Largo" className={inputCls} aria-label="Largo en metros" />
                    <input value={f.ancho} onChange={(e) => cambiarFila(f.id, 'ancho', e.target.value)} inputMode="decimal" placeholder="Ancho" className={inputCls} aria-label="Ancho en metros" />
                    <input value={f.alto} onChange={(e) => cambiarFila(f.id, 'alto', e.target.value)} inputMode="decimal" placeholder="Alto" className={`${inputCls} hidden sm:block`} aria-label="Alto en metros" />
                    <button onClick={() => setFilas(prev => prev.filter(x => x.id !== f.id))} className="p-1.5 text-slate-500 hover:text-red-400" aria-label="Quitar estancia"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-bold text-white">Indicaciones para la IA</h4>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                placeholder="Ej.: el salón y el dormitorio principal dan a la calle (fachada sur); la cocina está junto a la entrada; el baño está entre los dos dormitorios."
                className={inputCls}
              />
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white">Fotos de la vivienda ({fotos.length}/{MAX_FOTOS})</h4>
                  <p className="text-[11px] text-slate-400">Solo sirven para situar puertas, ventanas y fachada. Se reducen antes de enviarlas.</p>
                </div>
                <label className={`${btnCls} cursor-pointer`}>
                  <ImagePlus className="w-3.5 h-3.5 text-amber-400" /><span>Añadir fotos</span>
                  <input type="file" accept="image/*" multiple onChange={subirFotos} className="hidden" />
                </label>
              </div>
              {fotos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {fotos.map(f => (
                    <div key={f.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-700">
                      <img src={f.url} alt={f.nombre} className="w-full h-full object-cover" />
                      <button onClick={() => quitarFoto(f.id)} className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5" aria-label="Quitar foto"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={generarConIa}
                disabled={generando}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-60 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center gap-2 transition active:scale-95"
              >
                {generando && <Sparkles className="w-4 h-4 animate-spin" />}
                <span>{generando ? 'La IA está dibujando la planta (30-90 s)…' : '📐 Generar croquis 2D con IA'}</span>
              </button>
              <button onClick={dibujarSinIa} disabled={generando} className={btnCls}><Square className="w-3.5 h-3.5" /><span>Dibujar sin IA con estas medidas</span></button>
              {plan.rooms.length > 0 && <button onClick={() => setVista('editor')} className={btnCls}>Volver al editor</button>}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            {/* Paleta: arrastra al lienzo o pulsa para añadir */}
            <aside className="lg:w-44 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800 p-3 space-y-3 bg-slate-950/50">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold hidden lg:block">Arrastra al plano</p>
              <div className="grid grid-cols-6 lg:grid-cols-2 gap-1.5">
                {PALETA.map(({ tipo, label, icon: Icon }) => (
                  <button
                    key={tipo}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('application/x-croquis', tipo); e.dataTransfer.setData('text/plain', tipo); e.dataTransfer.effectAllowed = 'copy'; }}
                    onClick={() => agregarConClic(tipo)}
                    title={`${label}: arrástralo al plano o pulsa para añadirlo`}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-200 text-[10px] font-semibold cursor-grab active:cursor-grabbing"
                  >
                    <Icon className="w-4 h-4 text-amber-400" />
                    <span className="truncate max-w-full">{label}</span>
                  </button>
                ))}
              </div>
              <div className="hidden lg:block space-y-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                <label className="flex items-center gap-1.5 font-semibold text-slate-300"><Magnet className="w-3.5 h-3.5 text-amber-400" />Imán a la rejilla</label>
                <select value={paso} onChange={(e) => setPaso(Number(e.target.value))} className={inputCls}>
                  <option value={0.01}>1 cm</option>
                  <option value={0.05}>5 cm</option>
                  <option value={0.1}>10 cm</option>
                  <option value={0.25}>25 cm</option>
                  <option value={0}>Sin imán</option>
                </select>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={mostrarCotas} onChange={(e) => setMostrarCotas(e.target.checked)} className="accent-amber-500" />
                  Cotas automáticas
                </label>
                <p className="leading-relaxed text-slate-500">Supr: borrar · Flechas: mover (Mayús: 50 cm) · R: girar · Ctrl+Z: deshacer · Pulsa una cota para escribir su medida (🔒 = fija)</p>
              </div>
            </aside>

            {/* Lienzo */}
            <div className="flex-1 min-h-[45vh] min-w-0 flex flex-col">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-800 text-[11px] text-slate-400">
                <button onClick={() => setZoom(z => Math.max(0.5, redondear(z - 0.25)))} className={btnCls} aria-label="Alejar"><ZoomOut className="w-3.5 h-3.5" /></button>
                <span className="w-10 text-center font-mono">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(4, redondear(z + 0.25)))} className={btnCls} aria-label="Acercar"><ZoomIn className="w-3.5 h-3.5" /></button>
                <button onClick={() => setZoom(1)} className={btnCls} aria-label="Ajustar a la pantalla"><Maximize className="w-3.5 h-3.5" /></button>
                <button onClick={() => setVista3d(v => !v)} className={`${btnCls} ${vista3d ? '!bg-amber-500 !text-slate-950 !border-amber-400' : ''}`} aria-pressed={vista3d}>
                  <Box className="w-3.5 h-3.5" /><span>{vista3d ? 'Volver a 2D' : 'Ver en 3D'}</span>
                </button>
                <span className="ml-auto hidden sm:inline">Útil {formatoM2(sup.util)} · {plan.rooms.length} estancias</span>
              </div>
              <div className="flex-1 overflow-auto p-2" style={{ background: '#e2e8f0' }}>
                {vista3d ? (
                  <Suspense fallback={<p className="text-xs text-slate-600 p-4">Cargando la vista 3D…</p>}>
                    <Croquis3D plan={plan} nombreArchivo={`Croquis3D-${String(cabecera.numero || cabecera.obraTitulo || 'vivienda').replace(/[^\w.-]+/g, '_')}`} />
                  </Suspense>
                ) : (
                  <div style={{ width: '100%' }}>
                    <CroquisLienzo
                      plan={plan}
                      seleccion={seleccion}
                      onSeleccion={setSeleccion}
                      onPreview={previsualizar}
                      onCommit={confirmarArrastre}
                      onAplicar={aplicar}
                      onSoltar={agregar}
                      onEditarCota={setEditCota}
                      onAviso={(t) => showNotification(t, 'error')}
                      paso={paso}
                      mostrarCotas={mostrarCotas}
                      zoom={zoom}
                    />
                  </div>
                )}
                {editCota && (
                  <EditorCota
                    key={`${editCota.roomId}-${editCota.edge}`}
                    datos={editCota}
                    room={plan.rooms.find(r => r.id === editCota.roomId)}
                    onAplicar={(cambios) => { cambiarLado(editCota.roomId, editCota.edge, cambios); setEditCota(null); }}
                    onCancelar={() => setEditCota(null)}
                  />
                )}
              </div>
            </div>

            {/* Propiedades */}
            <aside className="lg:w-64 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 p-3 space-y-3 overflow-y-auto bg-slate-950/50 max-h-[40vh] lg:max-h-none">
              <Propiedades
                seleccion={seleccion}
                elemento={elemento}
                plan={plan}
                sup={sup}
                cambiarRoom={cambiarRoom}
                cambiarLado={cambiarLado}
                fijarTodos={fijarTodos}
                cambiarHueco={cambiarHueco}
                cambiarLista={cambiarLista}
                eliminar={eliminarSeleccion}
                girar={girarSeleccion}
                duplicar={duplicarEstancia}
              />
            </aside>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

function Campo({ label, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</span>
      {children}
    </label>
  );
}

// Entrada numérica en metros que solo aplica valores válidos.
function Metros({ value, onChange, min = 0 }) {
  const [texto, setTexto] = useState(String(value));
  useEffect(() => setTexto(String(value)), [value]);
  return (
    <input
      value={texto}
      inputMode="decimal"
      onChange={(e) => {
        setTexto(e.target.value);
        const n = parseFloat(e.target.value.replace(',', '.'));
        if (Number.isFinite(n) && n >= min) onChange(redondear(n, 3));
      }}
      onBlur={() => setTexto(String(value))}
      className={inputCls}
    />
  );
}

// Ventanita junto a la cota pulsada: medida del lado y candado.
function EditorCota({ datos, room, onAplicar, onCancelar }) {
  const largo = room ? redondear(largoMuro(room, datos.edge), 3) : 0;
  const [texto, setTexto] = useState(String(largo).replace('.', ','));
  const [fija, setFija] = useState(Boolean(room?.fijas?.includes(datos.edge)));
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.select(); }, []);
  if (!room) return null;
  const aplicar = () => {
    const n = parseFloat(texto.replace(',', '.'));
    onAplicar({ largo: Number.isFinite(n) && n > 0.1 && Math.abs(n - largo) > 0.0005 ? n : null, fija });
  };
  const left = Math.min(datos.x, window.innerWidth - 230), top = Math.min(datos.y + 12, window.innerHeight - 140);
  return (
    <div className="fixed z-[60] w-56 bg-slate-900 border border-amber-500/60 rounded-xl shadow-2xl p-3 space-y-2" style={{ left, top }}>
      <p className="text-[11px] font-bold text-white">{room.name} · lado {datos.edge + 1}</p>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={texto}
          inputMode="decimal"
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); aplicar(); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancelar(); }
          }}
          className={inputCls}
          aria-label="Medida del lado en metros"
        />
        <span className="text-xs text-slate-400">m</span>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
        <input type="checkbox" checked={fija} onChange={(e) => setFija(e.target.checked)} className="accent-amber-500" />
        Medida fija (no cambia al mover puntos)
      </label>
      <div className="flex gap-1.5 justify-end">
        <button onClick={onCancelar} className={btnCls}>Cancelar</button>
        <button onClick={aplicar} className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold">Aplicar</button>
      </div>
    </div>
  );
}

function Propiedades({ seleccion, elemento, plan, sup, cambiarRoom, cambiarLado, fijarTodos, cambiarHueco, cambiarLista, eliminar, girar, duplicar }) {
  const acciones = (extra = null) => (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {extra}
      <button onClick={girar} className={btnCls}><RotateCw className="w-3.5 h-3.5" /><span>Girar</span></button>
      <button onClick={eliminar} className={`${btnCls} text-red-300`}><Trash2 className="w-3.5 h-3.5" /><span>Eliminar</span></button>
    </div>
  );

  if (!seleccion || !elemento) {
    return (
      <div className="space-y-3 text-xs">
        <h4 className="text-sm font-bold text-white">Superficies útiles</h4>
        {sup.estancias.length === 0 ? (
          <p className="text-slate-400">Sin estancias. Arrastra una «Estancia» al plano o genera el croquis desde «Medidas y fotos».</p>
        ) : (
          <ul className="space-y-1">
            {sup.estancias.map(e => (
              <li key={e.id} className="flex justify-between gap-2 text-slate-300"><span className="truncate">{e.nombre}</span><span className="font-mono">{formatoM2(e.area)}</span></li>
            ))}
            <li className="flex justify-between gap-2 pt-1 border-t border-slate-800 font-bold text-white"><span>Total útil</span><span className="font-mono">{formatoM2(sup.util)}</span></li>
            <li className="flex justify-between gap-2 text-slate-400"><span>Construida aprox.</span><span className="font-mono">{formatoM2(sup.construida)}</span></li>
          </ul>
        )}
        {plan.notes?.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Supuestos de la IA (comprobar)</p>
            {plan.notes.map((n, i) => <p key={i} className="text-[11px] text-slate-300">• {n}</p>)}
          </div>
        )}
        <p className="text-[11px] text-slate-500">Pulsa un elemento para editarlo. Arrastra las asas de una estancia para cambiar su tamaño: las cotas se actualizan solas.</p>
      </div>
    );
  }

  if (seleccion.tipo === 'room') {
    const r = elemento;
    const rect = esRectangulo(r);
    const todasFijas = r.points.every((_, i) => (r.fijas || []).includes(i));
    return (
      <div className="space-y-2.5">
        <h4 className="text-sm font-bold text-white">Estancia</h4>
        <Campo label="Nombre"><input value={r.name} onChange={(e) => cambiarRoom(r.id, { name: e.target.value })} className={inputCls} /></Campo>
        <div className="grid grid-cols-2 gap-2">
          {rect && <Campo label="Ancho (m)"><Metros value={r.width} min={0.5} onChange={(v) => cambiarRoom(r.id, { width: Math.max(0.5, v) })} /></Campo>}
          {rect && <Campo label="Fondo (m)"><Metros value={r.height} min={0.5} onChange={(v) => cambiarRoom(r.id, { height: Math.max(0.5, v) })} /></Campo>}
          <Campo label="X (m)"><Metros value={r.x} onChange={(v) => cambiarRoom(r.id, { x: v })} /></Campo>
          <Campo label="Y (m)"><Metros value={r.y} onChange={(v) => cambiarRoom(r.id, { y: v })} /></Campo>
          <Campo label="Altura libre (m)"><Metros value={r.alto || ALTO_DEFECTO} min={1.8} onChange={(v) => cambiarRoom(r.id, { alto: Math.min(8, Math.max(1.8, v)) })} /></Campo>
        </div>
        <p className="text-xs text-slate-300">Superficie útil: <span className="font-mono font-bold text-white">{formatoM2(r.area)}</span></p>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Lados ({r.points.length})</span>
            <button onClick={() => fijarTodos(r.id, !todasFijas)} className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold">
              {todasFijas ? 'Liberar todas' : 'Fijar todas'}
            </button>
          </div>
          {lados(r).map(({ i, largo }) => {
            const fija = (r.fijas || []).includes(i);
            return (
              <div key={i} className="grid grid-cols-[44px_1fr_32px] gap-1.5 items-center">
                <span className="text-[11px] text-slate-400">Lado {i + 1}</span>
                <Metros value={redondear(largo, 2)} min={0.1} onChange={(v) => v > 0.1 && cambiarLado(r.id, i, { largo: v })} />
                <button
                  onClick={() => cambiarLado(r.id, i, { fija: !fija })}
                  className={`p-1.5 rounded-lg border ${fija ? 'border-amber-500/60 text-amber-400 bg-amber-500/10' : 'border-slate-700 text-slate-500'}`}
                  aria-label={fija ? `Liberar la medida del lado ${i + 1}` : `Fijar la medida del lado ${i + 1}`}
                  title={fija ? 'Medida fija: no cambia al mover puntos' : 'Medida libre'}
                >
                  {fija ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })}
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Arrastra los puntos para dar cualquier forma (romboide, en L…). Los círculos pequeños añaden un punto; doble clic o Supr sobre un punto lo quita. También puedes pulsar una cota del plano para escribir su medida.
          </p>
        </div>

        <Campo label="Color del suelo">
          <div className="flex flex-wrap gap-1.5">
            {COLORES_ESTANCIA.map(c => (
              <button key={c} onClick={() => cambiarRoom(r.id, { color: c })} aria-label={`Color ${c}`} className={`w-6 h-6 rounded-md border-2 ${r.color === c ? 'border-amber-400' : 'border-slate-600'}`} style={{ background: c }} />
            ))}
          </div>
        </Campo>
        {acciones(<button onClick={duplicar} className={btnCls}><Copy className="w-3.5 h-3.5" /><span>Duplicar</span></button>)}
      </div>
    );
  }

  if (seleccion.tipo === 'hueco') {
    const o = elemento;
    const room = plan.rooms.find(r => r.id === o.roomId);
    return (
      <div className="space-y-2.5">
        <h4 className="text-sm font-bold text-white">{NOMBRE_HUECO[o.type]} · {room?.name}</h4>
        <Campo label="Tipo">
          <select value={o.type} onChange={(e) => cambiarHueco(o.id, { type: e.target.value })} className={inputCls}>
            {Object.entries(NOMBRE_HUECO).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Ancho (m)"><Metros value={o.widthMeters} min={0.4} onChange={(v) => cambiarHueco(o.id, { widthMeters: v })} /></Campo>
          <Campo label="Lado">
            <select value={o.edge} onChange={(e) => cambiarHueco(o.id, { edge: Number(e.target.value) })} className={inputCls}>
              {room && lados(room).map(({ i, largo }) => <option key={i} value={i}>{`Lado ${i + 1} (${formatoMetros(largo)})`}</option>)}
            </select>
          </Campo>
        </div>
        <Campo label={`Posición en el muro (${Math.round(o.positionRatio * 100)} %)`}>
          <input type="range" min={0} max={1} step={0.01} value={o.positionRatio} onChange={(e) => cambiarHueco(o.id, { positionRatio: Number(e.target.value) })} className="w-full accent-amber-500" />
        </Campo>
        {o.type === 'door' && (
          <p className="text-[11px] text-slate-400">Abre hacia {o.swing === 'out' ? 'fuera' : 'dentro'} · bisagras al {o.hinge === 'end' ? 'final' : 'inicio'} del lado. «Girar» cambia la apertura.</p>
        )}
        {acciones()}
      </div>
    );
  }

  if (seleccion.tipo === 'texto') {
    const l = elemento;
    return (
      <div className="space-y-2.5">
        <h4 className="text-sm font-bold text-white">Texto</h4>
        <Campo label="Texto"><input value={l.text} onChange={(e) => cambiarLista('labels', l.id, { text: e.target.value })} className={inputCls} /></Campo>
        <Campo label="Tamaño (m de altura)"><Metros value={l.size} min={0.1} onChange={(v) => cambiarLista('labels', l.id, { size: Math.min(1, Math.max(0.1, v)) })} /></Campo>
        {acciones()}
      </div>
    );
  }

  const d = elemento;
  return (
    <div className="space-y-2.5">
      <h4 className="text-sm font-bold text-white">Cota · {redondear(Math.hypot(d.x2 - d.x1, d.y2 - d.y1)).toLocaleString('es-ES')} m</h4>
      <Campo label="Separación de la línea (m)"><Metros value={d.offset} min={-3} onChange={(v) => cambiarLista('dimensions', d.id, { offset: Math.max(-3, Math.min(3, v)) })} /></Campo>
      <p className="text-[11px] text-slate-400">Arrastra los extremos (círculos) para medir. Cerca de horizontal o vertical se endereza sola.</p>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <button onClick={eliminar} className={`${btnCls} text-red-300`}><Trash2 className="w-3.5 h-3.5" /><span>Eliminar</span></button>
      </div>
    </div>
  );
}
