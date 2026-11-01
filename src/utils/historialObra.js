// ObraMaster - Histórico diario de cada obra (cálculo compartido app / servidor).
//
// Cada suceso es { id, fecha (ISO), tipo, titulo, detalle, autor, origen, fuente, editable, datos }.
// - origen 'manual': lo apunta alguien (llamada, material usado, maquinaria, incidencia...).
// - origen 'auto': lo registra la app al hacer la acción (asignar, pedir, avanzar, cambiar plazos...).
// El servidor (backend/historialRoutes.js) junta la tabla obra_eventos con lo que ya guardan
// execution_logs, worksite_needs, material_orders, site_reports y el diario JSON de la obra.

export const TIPOS_HISTORIAL = [
  { id: 'asignacion', label: 'Asignaciones', corto: 'Asignación', color: 'sky' },
  { id: 'avance', label: 'Evolución de obra', corto: 'Avance', color: 'emerald' },
  { id: 'pedido', label: 'Material pedido', corto: 'Pedido', color: 'amber' },
  { id: 'material', label: 'Material utilizado', corto: 'Material usado', color: 'orange' },
  { id: 'maquinaria', label: 'Maquinaria', corto: 'Maquinaria', color: 'violet' },
  { id: 'llamada', label: 'Llamadas y contacto del cliente', corto: 'Cliente', color: 'pink' },
  { id: 'presupuesto', label: 'Cambios en el presupuesto', corto: 'Presupuesto', color: 'indigo' },
  { id: 'plazo', label: 'Fechas y plazos', corto: 'Plazo', color: 'cyan' },
  { id: 'incidencia', label: 'Incidencias', corto: 'Incidencia', color: 'rose' },
  { id: 'parte', label: 'Partes diarios', corto: 'Parte diario', color: 'teal' },
  { id: 'documento', label: 'Documentos', corto: 'Documento', color: 'slate' },
  { id: 'nota', label: 'Otras notas', corto: 'Nota', color: 'slate' }
];

export const TIPO_IDS = new Set(TIPOS_HISTORIAL.map(t => t.id));
// Lo que se puede apuntar a mano (el resto lo registra la app sola).
export const TIPOS_MANUALES = ['llamada', 'material', 'maquinaria', 'incidencia', 'parte', 'pedido', 'avance', 'nota'];

export const tipoInfo = (id) => TIPOS_HISTORIAL.find(t => t.id === id) || TIPOS_HISTORIAL[TIPOS_HISTORIAL.length - 1];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const txt = (v) => String(v ?? '').trim();
const euros = (v) => `${num(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const fechaCorta = (iso) => {
  if (!iso) return 'sin fecha';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : String(iso);
};
const cantidadTexto = (it) => [txt(it.cantidad), txt(it.unidad)].filter(Boolean).join(' ');

// ---------------------------------------------------------------------------
// Días y filtros
// ---------------------------------------------------------------------------

// Día local (YYYY-MM-DD) de una fecha ISO. Las fechas sin hora se toman tal cual.
export function diaLocal(fecha) {
  if (!fecha) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) return String(fecha);
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return String(fecha).slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const instante = (e) => {
  const t = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(e.fecha)) ? `${e.fecha}T12:00:00` : e.fecha).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Quita sucesos repetidos (mismo id y mismo contenido, p. ej. un parte diario guardado dos veces)
 * y da a cada uno una `clave` única para la lista: con dos sucesos del mismo id, React dejaba
 * uno pegado en pantalla al filtrar.
 */
export function unificarEventos(eventos) {
  const vistos = new Set();
  const usadas = new Map();
  const out = [];
  for (const e of eventos || []) {
    if (!e) continue;
    const firma = JSON.stringify([e.id, e.fecha, e.tipo, e.titulo, e.detalle || '']);
    if (vistos.has(firma)) continue;
    vistos.add(firma);
    const base = String(e.id ?? '');
    const n = usadas.get(base) || 0;
    usadas.set(base, n + 1);
    out.push({ ...e, clave: n ? `${base}#${n}` : base });
  }
  return out;
}

export function ordenarEventos(eventos) {
  return [...eventos].sort((a, b) => instante(b) - instante(a));
}

// [{ dia, eventos }] del más reciente al más antiguo.
export function agruparPorDia(eventos) {
  const grupos = new Map();
  for (const e of ordenarEventos(eventos)) {
    const dia = diaLocal(e.fecha);
    if (!grupos.has(dia)) grupos.set(dia, []);
    grupos.get(dia).push(e);
  }
  return [...grupos].map(([dia, lista]) => ({ dia, eventos: lista }));
}

export function filtrarEventos(eventos, { tipos = null, texto = '', desde = '', hasta = '' } = {}) {
  const q = txt(texto).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return eventos.filter((e) => {
    if (tipos && tipos.size && !tipos.has(e.tipo)) return false;
    const dia = diaLocal(e.fecha);
    if (desde && dia < desde) return false;
    if (hasta && dia > hasta) return false;
    if (!q) return true;
    const hay = [e.titulo, e.detalle, e.autor, ...(e.datos?.items || []).map(i => i.concepto)]
      .join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return hay.includes(q);
  });
}

export function contarPorTipo(eventos) {
  const c = {};
  for (const e of eventos) c[e.tipo] = (c[e.tipo] || 0) + 1;
  return c;
}

// ---------------------------------------------------------------------------
// Cambios detectados en la app (se guardan como sucesos 'auto')
// ---------------------------------------------------------------------------

const CAMPOS_PLAZO = [
  ['fechaInicio', 'Fecha de inicio'],
  ['fechaFinEstimada', 'Fin planificado'],
  ['fechaEntregaCliente', 'Entrega al cliente'],
  ['fechaFinReal', 'Fin real']
];

const ESTADOS_OBRA = { presupuestada: 'Presupuestada', en_curso: 'En curso', pausada: 'Pausada', finalizada: 'Finalizada' };

/** Sucesos que produce pasar la obra de `antes` a `despues` (plazos, responsables, etapas y avance). */
export function cambiosObra(antes, despues) {
  if (!antes || !despues) return [];
  const eventos = [];

  for (const [campo, nombre] of CAMPOS_PLAZO) {
    if (!(campo in despues)) continue;
    const a = txt(antes[campo]);
    const b = txt(despues[campo]);
    if (a === b) continue;
    eventos.push({
      tipo: 'plazo',
      titulo: `${nombre}: ${a ? `${fechaCorta(a)} → ` : ''}${b ? fechaCorta(b) : 'sin fecha'}`,
      datos: { campo, antes: a || null, despues: b || null }
    });
  }

  if ('estado' in despues && txt(antes.estado) !== txt(despues.estado)) {
    eventos.push({
      tipo: 'avance',
      titulo: `Estado de la obra: ${ESTADOS_OBRA[despues.estado] || despues.estado || 'sin estado'}`,
      datos: { campo: 'estado', antes: antes.estado || null, despues: despues.estado || null }
    });
  }

  if (Array.isArray(despues.fases)) {
    const previas = new Map((antes.fases || []).map(f => [String(f.id), f]));
    const actuales = new Set();
    for (const f of despues.fases) {
      const id = String(f.id);
      actuales.add(id);
      const p = previas.get(id);
      const nombre = f.nombre || f.capitulo || 'Etapa';
      if (!p) {
        eventos.push({ tipo: 'presupuesto', titulo: `Nueva etapa: ${nombre}`, datos: { faseId: id } });
        continue;
      }
      if (txt(p.responsable) !== txt(f.responsable) && txt(f.responsable)) {
        eventos.push({
          tipo: 'asignacion',
          titulo: `${nombre}: responsable ${txt(f.responsable)}`,
          detalle: txt(p.responsable) && txt(p.responsable) !== 'Por asignar' ? `Antes: ${txt(p.responsable)}` : '',
          datos: { faseId: id, antes: p.responsable || null, despues: f.responsable || null }
        });
      }
      if (num(p.dias) !== num(f.dias) && 'dias' in f) {
        eventos.push({
          tipo: 'plazo',
          titulo: `${nombre}: duración ${num(p.dias)} → ${num(f.dias)} días`,
          datos: { faseId: id, campo: 'dias', antes: num(p.dias), despues: num(f.dias) }
        });
      }
      const tareasPrevias = new Map((p.tareas || []).map(t => [String(t.id), t]));
      const cambiosTareas = (f.tareas || [])
        .map(t => ({ t, prev: tareasPrevias.get(String(t.id)) }))
        .filter(({ t, prev }) => prev && num(prev.progreso) !== num(t.progreso));
      if (cambiosTareas.length) {
        for (const { t, prev } of cambiosTareas.slice(0, 20)) {
          eventos.push({
            tipo: 'avance',
            titulo: `${t.titulo || t.concepto || 'Partida'}: ${num(prev.progreso)} % → ${num(t.progreso)} %`,
            detalle: nombre,
            datos: { faseId: id, partidaId: String(t.id), antes: num(prev.progreso), despues: num(t.progreso) }
          });
        }
      } else if (num(p.progreso) !== num(f.progreso)) {
        eventos.push({
          tipo: 'avance',
          titulo: `${nombre}: ${num(p.progreso)} % → ${num(f.progreso)} %`,
          datos: { faseId: id, antes: num(p.progreso), despues: num(f.progreso) }
        });
      }
    }
    for (const [id, p] of previas) {
      if (!actuales.has(id)) eventos.push({ tipo: 'presupuesto', titulo: `Etapa quitada: ${p.nombre || p.capitulo || 'Etapa'}`, datos: { faseId: id } });
    }
  }

  if (Array.isArray(despues.necesidadesMateriales)) {
    const previos = new Map((antes.necesidadesMateriales || []).map(m => [String(m.id), m]));
    for (const m of despues.necesidadesMateriales) {
      const p = previos.get(String(m.id));
      const etiqueta = [m.concepto, cantidadTexto(m)].filter(Boolean).join(' · ');
      if (!p) {
        eventos.push({
          tipo: 'pedido',
          titulo: `Material necesario: ${etiqueta}`,
          detalle: [m.proveedor && `Proveedor: ${m.proveedor}`, num(m.costeEstimado) && `Coste estimado ${euros(m.costeEstimado)}`].filter(Boolean).join(' · '),
          datos: { items: [{ concepto: m.concepto, cantidad: m.cantidad, unidad: m.unidad }] }
        });
      } else if (txt(p.estado) !== txt(m.estado)) {
        eventos.push({ tipo: 'pedido', titulo: `${m.concepto || 'Material'}: ${m.estado}`, detalle: etiqueta, datos: { antes: p.estado, despues: m.estado } });
      }
    }
  }

  return eventos;
}

const resumenPartida = (p) => [p.codigo, p.concepto || p.titulo || p.descripcion].filter(Boolean).join(' ') || 'Partida';
const firmaPartida = (p) => `${num(p.cantidad)}|${num(p.precioVenta)}|${txt(p.unidad)}|${txt(p.concepto || p.titulo)}`;

/**
 * Sucesos que produce editar el presupuesto de una obra: capítulos (secciones) y partidas
 * añadidas, quitadas o cambiadas. Recibe los capítulos ya normalizados (capitulosDe()).
 */
export function cambiosPresupuesto(capsAntes = [], capsDespues = [], { numero = '' } = {}) {
  const eventos = [];
  const pre = numero ? `${numero}: ` : '';
  const capPrevios = new Map(capsAntes.map(c => [String(c.id), c]));
  const capActuales = new Set(capsDespues.map(c => String(c.id)));
  const partidasPrevias = new Map(capsAntes.flatMap(c => (c.partidas || []).map(p => [String(p.id), { p, cap: c }])));
  const partidasActuales = new Set();

  for (const c of capsDespues) {
    const prev = capPrevios.get(String(c.id));
    if (!prev) eventos.push({ tipo: 'presupuesto', titulo: `${pre}nueva sección "${c.nombre}"`, datos: { capitulo: c.nombre } });
    else if (txt(prev.nombre) !== txt(c.nombre)) eventos.push({ tipo: 'presupuesto', titulo: `${pre}sección "${prev.nombre}" renombrada a "${c.nombre}"`, datos: { capitulo: c.nombre } });

    for (const p of c.partidas || []) {
      partidasActuales.add(String(p.id));
      const antes = partidasPrevias.get(String(p.id));
      if (!antes) {
        eventos.push({
          tipo: 'presupuesto',
          titulo: `${pre}partida añadida: ${resumenPartida(p)}`,
          detalle: `${c.nombre} · ${cantidadTexto(p) || '0'} × ${euros(p.precioVenta)} = ${euros(p.total)}`,
          datos: { capitulo: c.nombre, partidaId: String(p.id), despues: { cantidad: num(p.cantidad), precioVenta: num(p.precioVenta), total: num(p.total) } }
        });
        continue;
      }
      if (firmaPartida(antes.p) === firmaPartida(p) && String(antes.cap.id) === String(c.id)) continue;
      const cambios = [];
      if (txt(antes.p.concepto || antes.p.titulo) !== txt(p.concepto || p.titulo)) cambios.push('texto');
      if (num(antes.p.cantidad) !== num(p.cantidad)) cambios.push(`cantidad ${num(antes.p.cantidad)} → ${num(p.cantidad)} ${txt(p.unidad)}`.trim());
      if (num(antes.p.precioVenta) !== num(p.precioVenta)) cambios.push(`precio ${euros(antes.p.precioVenta)} → ${euros(p.precioVenta)}`);
      if (txt(antes.p.unidad) !== txt(p.unidad)) cambios.push(`unidad ${txt(antes.p.unidad) || '-'} → ${txt(p.unidad) || '-'}`);
      if (String(antes.cap.id) !== String(c.id)) cambios.push(`pasa a "${c.nombre}"`);
      eventos.push({
        tipo: 'presupuesto',
        titulo: `${pre}partida cambiada: ${resumenPartida(p)}`,
        detalle: cambios.join(' · '),
        datos: {
          capitulo: c.nombre,
          partidaId: String(p.id),
          antes: { cantidad: num(antes.p.cantidad), precioVenta: num(antes.p.precioVenta), total: num(antes.p.total) },
          despues: { cantidad: num(p.cantidad), precioVenta: num(p.precioVenta), total: num(p.total) }
        }
      });
    }
  }
  for (const [id, { p, cap }] of partidasPrevias) {
    if (!partidasActuales.has(id)) eventos.push({ tipo: 'presupuesto', titulo: `${pre}partida quitada: ${resumenPartida(p)}`, detalle: cap.nombre, datos: { capitulo: cap.nombre, partidaId: id } });
  }
  for (const [id, c] of capPrevios) {
    if (!capActuales.has(id)) eventos.push({ tipo: 'presupuesto', titulo: `${pre}sección quitada "${c.nombre}"`, datos: { capitulo: c.nombre } });
  }
  return eventos;
}

// ---------------------------------------------------------------------------
// Conversión de lo que ya guardan otras tablas (lo usa el servidor)
// ---------------------------------------------------------------------------

const LOG_TIPO = {
  asignacion: 'asignacion',
  avance: 'avance',
  listo_certificacion: 'avance',
  certificacion: 'avance',
  bloqueo: 'incidencia',
  desbloqueo: 'incidencia',
  documento: 'documento'
};
const LOG_TITULO = {
  asignacion: 'Asignación',
  avance: 'Avance',
  listo_certificacion: 'Lista para certificar',
  certificacion: 'Certificado',
  bloqueo: 'Tajo bloqueado',
  desbloqueo: 'Tajo desbloqueado',
  documento: 'Documento de subcontrata'
};

/** execution_logs → suceso. `etiqueta(faseId, partidaId)` devuelve el nombre legible de la partida. */
export function eventoDesdeLog(log, etiqueta = () => '') {
  const donde = etiqueta(log.fase_id, log.partida_id);
  const pct = log.pct_after !== null && log.pct_after !== undefined
    ? ` ${log.pct_before !== null && log.pct_before !== undefined ? `${log.pct_before} % → ` : ''}${log.pct_after} %`
    : '';
  return {
    id: `log:${log.id}`,
    fecha: log.created_at,
    tipo: LOG_TIPO[log.kind] || 'avance',
    titulo: `${LOG_TITULO[log.kind] || 'Avance'}${donde ? `: ${donde}` : ''}${pct}`,
    detalle: txt(log.notes),
    autor: txt(log.author_name),
    origen: 'auto',
    fuente: 'execution_logs',
    editable: false,
    datos: { faseId: log.fase_id, partidaId: log.partida_id, fotos: (log.photos || []).length }
  };
}

const NEED_TIPO = { material: 'pedido', herramienta: 'pedido', maquinaria: 'maquinaria', bloqueo: 'incidencia', seguridad: 'incidencia' };
const NEED_TITULO = {
  material: 'Necesidad de material',
  herramienta: 'Necesidad de herramienta',
  maquinaria: 'Necesidad de maquinaria',
  bloqueo: 'Tajo bloqueado',
  seguridad: 'Aviso de seguridad',
  coordinacion: 'Coordinación',
  otro: 'Aviso de obra'
};

export function eventoDesdeNecesidad(n) {
  const items = Array.isArray(n.items) ? n.items : [];
  return {
    id: `need:${n.id}`,
    fecha: n.created_at,
    tipo: NEED_TIPO[n.category] || 'nota',
    titulo: `${NEED_TITULO[n.category] || 'Aviso de obra'}${n.urgency === 'urgente' ? ' (urgente)' : ''}${n.partida_label ? `: ${n.partida_label}` : ''}`,
    detalle: [txt(n.description), items.map(i => [i.material || i.concepto, cantidadTexto(i)].filter(Boolean).join(' ')).filter(Boolean).join(', ')]
      .filter(Boolean).join(' · '),
    autor: txt(n.reported_by_name),
    origen: 'auto',
    fuente: 'worksite_needs',
    editable: false,
    datos: { estado: n.status, items: items.map(i => ({ concepto: i.material || i.concepto, cantidad: i.cantidad, unidad: i.unidad })) }
  };
}

const RESPUESTA = { confirmado: 'confirmado', parcial: 'confirmado en parte', rechazado: 'rechazado' };

/** material_orders → uno o varios sucesos (creado/enviado, respuesta del proveedor, entregado). */
export function eventosDesdePedido(o) {
  const items = Array.isArray(o.items) ? o.items : [];
  const proveedor = txt(o.suppliers?.name || o.supplier_name || o.to_email) || 'proveedor';
  const que = o.kind === 'solicitud_presupuesto' ? 'Petición de presupuesto' : 'Pedido';
  const lista = items.map(i => [i.material || i.concepto || i.descripcion, cantidadTexto(i)].filter(Boolean).join(' ')).filter(Boolean).join(', ');
  const base = { origen: 'auto', fuente: 'material_orders', editable: false, datos: { estado: o.status, items: items.map(i => ({ concepto: i.material || i.concepto || i.descripcion, cantidad: i.cantidad, unidad: i.unidad })) } };
  const eventos = [];
  if (o.status === 'borrador' || !o.sent_at) {
    eventos.push({ ...base, id: `order:${o.id}`, fecha: o.created_at, tipo: 'pedido', titulo: `${que} preparado para ${proveedor}${o.status === 'borrador' ? ' (borrador)' : ''}`, detalle: lista });
  } else {
    eventos.push({ ...base, id: `order:${o.id}`, fecha: o.sent_at, tipo: 'pedido', titulo: `${que} enviado a ${proveedor}`, detalle: [lista, o.needed_by && `Para el ${fechaCorta(o.needed_by)}`].filter(Boolean).join(' · ') });
  }
  if (o.responded_at && o.response_status && o.response_status !== 'pendiente') {
    eventos.push({
      ...base,
      id: `order:${o.id}:respuesta`,
      fecha: o.responded_at,
      tipo: 'pedido',
      titulo: `${proveedor}: pedido ${RESPUESTA[o.response_status] || o.response_status}`,
      detalle: [o.delivery_date && `Entrega ${fechaCorta(o.delivery_date)}`, o.quoted_amount && euros(o.quoted_amount), txt(o.response_notes)].filter(Boolean).join(' · ')
    });
  }
  if (o.status === 'entregado') {
    eventos.push({ ...base, id: `order:${o.id}:entregado`, fecha: o.updated_at || o.delivery_date, tipo: 'pedido', titulo: `Material entregado (${proveedor})`, detalle: lista });
  }
  return eventos;
}

export function eventoDesdeParteSubcontrata(r) {
  const incidencia = r.kind === 'incidencia';
  return {
    id: `report:${r.id}`,
    fecha: r.created_at,
    tipo: incidencia ? 'incidencia' : 'avance',
    titulo: `${incidencia ? 'Incidencia' : 'Trabajo terminado'}${r.task_label ? `: ${r.task_label}` : ''}`,
    detalle: txt(r.notes),
    autor: txt(r.subcontractor_name),
    origen: 'auto',
    fuente: 'site_reports',
    editable: false,
    datos: { revision: r.review_result || null, fotos: (r.photos || []).length }
  };
}

/** Entradas del antiguo diario de la obra (obra.diario en app_records). */
export function eventoDesdeDiario(d) {
  const presentes = Array.isArray(d.obrerosPresentes) ? d.obrerosPresentes.filter(Boolean) : [];
  return {
    id: `diario:${d.id}`,
    fecha: d.fecha,
    tipo: 'parte',
    titulo: 'Parte diario',
    detalle: [txt(d.resumen), d.incidencias && `Incidencia: ${txt(d.incidencias)}`].filter(Boolean).join('\n'),
    autor: txt(d.autor),
    origen: 'manual',
    fuente: 'diario',
    editable: false,
    datos: { clima: d.clima || '', operarios: presentes, fotos: d.fotos || [] }
  };
}

/** Fila de obra_eventos → suceso. */
export function eventoDesdeFila(row) {
  return {
    id: row.id,
    fecha: row.ocurrido_at,
    tipo: TIPO_IDS.has(row.tipo) ? row.tipo : 'nota',
    titulo: row.titulo,
    detalle: txt(row.detalle),
    autor: txt(row.autor_name),
    origen: row.origen,
    fuente: 'obra_eventos',
    editable: row.origen === 'manual',
    datos: row.datos || {}
  };
}
