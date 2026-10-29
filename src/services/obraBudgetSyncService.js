/**
 * OBRAMASTER - Servicio de Vinculación Estricta y Sincronización (Single Source of Truth)
 * Vincula el Presupuesto Firmado con el Plan de Ejecución de Obra (Fases y Tareas)
 * y garantiza coherencia matemática absoluta en el recálculo ponderado del avance.
 */

/**
 * Convierte las partidas y capítulos de un presupuesto firmado en las Fases y Tareas canónicas de la Obra.
 * @param {Object} presupuesto - Presupuesto aceptado/firmado
 * @param {Array} existingFases - Fases existentes (para preservar asignaciones o avances previos)
 * @returns {Array} Fases canónicas con tareas vinculadas a las partidas del presupuesto
 */
export function generateExecutionPlanFromBudget(presupuesto, existingFases = []) {
  if (!presupuesto || !presupuesto.partidas || presupuesto.partidas.length === 0) {
    return existingFases || [];
  }

  const partidas = presupuesto.partidas;
  const totalPresupuestoBase = partidas.reduce((acc, p) => acc + (Number(p.total) || (Number(p.cantidad) * Number(p.precioVenta)) || 0), 0) || 1;

  // Agrupar partidas por capítulo
  const capitulosMap = new Map();

  partidas.forEach((partida, idx) => {
    const capituloName = partida.capitulo || 'General';
    if (!capitulosMap.has(capituloName)) {
      capitulosMap.set(capituloName, []);
    }
    capitulosMap.get(capituloName).push({
      ...partida,
      originalIndex: idx
    });
  });

  const canonicalFases = [];
  let faseIndex = 1;

  for (const [capituloName, items] of capitulosMap.entries()) {
    // Buscar si ya existía una fase previa para este capítulo (para conservar avances y responsables)
    const existingFase = existingFases.find(f => 
      f.nombre?.toLowerCase().includes(capituloName.toLowerCase()) ||
      capituloName.toLowerCase().includes(f.nombre?.toLowerCase() || '') ||
      f.capitulo === capituloName
    ) || existingFases.find(f =>
      // Capítulo renombrado en una revisión del presupuesto: se reconoce por sus partidas.
      (f.tareas || []).some(t => items.some(it => it.id && (t.quote_line_id === it.id || t.partidaId === it.id)))
    );

    const faseId = existingFase?.id || `fase-${capituloName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${faseIndex}`;
    const faseTotal = items.reduce((acc, it) => acc + (Number(it.total) || (Number(it.cantidad) * Number(it.precioVenta)) || 0), 0);
    const weightPct = Number(((faseTotal / totalPresupuestoBase) * 100).toFixed(2));

    // Determinar responsable estimado según gremio o mantener el existente
    let defaultResponsable = existingFase?.responsable || 'Equipo propio';
    if (!existingFase?.responsable) {
      const capLower = capituloName.toLowerCase();
      if (capLower.includes('demolicion')) defaultResponsable = 'Mario Silva';
      else if (capLower.includes('pladur') || capLower.includes('albañileria')) defaultResponsable = 'Ionut Radu';
      else if (capLower.includes('fontaneria') || capLower.includes('clima')) defaultResponsable = 'ClimaTec Subcontrata';
      else if (capLower.includes('electricidad')) defaultResponsable = 'ElectroSur Subcontrata';
      else if (capLower.includes('alicat') || capLower.includes('revestimiento')) defaultResponsable = 'Pedro Gómez';
      else if (capLower.includes('carpinteria')) defaultResponsable = 'Carpintería Robles';
      else if (capLower.includes('pintura')) defaultResponsable = 'DecorPint Subcontrata';
    }

    // Mapear cada partida como una tarea del capítulo
    const tareas = items.map((partida, tIdx) => {
      // Buscar avance previo de la tarea si existía
      const existingTask = (existingFase?.tareas || []).find(t => 
        t.quote_line_id === partida.id || 
        t.partidaId === partida.id ||
        t.codigo === partida.codigo
      );

      // Si no hay tarea previa pero la fase existente tenía progreso general, heredar coherentemente
      let taskProgress = existingTask?.progreso !== undefined 
        ? existingTask.progreso 
        : (existingFase?.progreso !== undefined ? existingFase.progreso : 0);
      
      // Asegurar que sea 0, 25, 50, 75 o 100
      taskProgress = normalizeProgress(taskProgress);

      const taskTotal = Number(partida.total) || (Number(partida.cantidad) * Number(partida.precioVenta)) || 0;
      const isCompleted = taskProgress === 100;

      return {
        id: existingTask?.id || `task-${partida.id || `${faseId}-${tIdx + 1}`}`,
        quote_line_id: partida.id, // Vínculo estricto con la partida firmada
        partidaId: partida.id,
        codigo: partida.codigo || `PAR-${tIdx + 1}`,
        // Un título editado a mano en la obra se conserva al resincronizar con el presupuesto.
        titulo: existingTask?.tituloEditado ? existingTask.titulo : (partida.concepto || 'Partida de obra'),
        tituloEditado: Boolean(existingTask?.tituloEditado),
        unidad: partida.unidad || 'ud',
        cantidad: Number(partida.cantidad) || 1,
        precioVenta: Number(partida.precioVenta) || 0,
        importeTotal: taskTotal,
        progreso: taskProgress,
        estado: isCompleted ? 'completada' : taskProgress > 0 ? 'en_curso' : 'pendiente',
        asignadoA: existingTask?.asignadoA || defaultResponsable,
        completedAt: isCompleted ? (existingTask?.completedAt || new Date().toISOString()) : null
      };
    });

    // Calcular progreso ponderado de la fase en base al importe de sus tareas
    const faseProgress = calculatePhaseWeightedProgress(tareas, faseTotal);
    const isFaseCompleted = faseProgress === 100;

    canonicalFases.push({
      id: faseId,
      quote_id: presupuesto.id,
      capitulo: capituloName,
      nombre: existingFase?.nombreEditado ? existingFase.nombre : `Fase ${faseIndex}: ${capituloName}`,
      nombreEditado: Boolean(existingFase?.nombreEditado),
      descripcion: existingFase?.descripcion || '',
      orden: faseIndex,
      importeTotal: faseTotal,
      weight_percentage: weightPct,
      progreso: faseProgress,
      estado: isFaseCompleted ? 'completada' : faseProgress > 0 ? 'en_curso' : 'pendiente',
      responsable: defaultResponsable,
      dias: existingFase?.dias || (items.length * 3 + 2),
      tareas: tareas
    });

    faseIndex++;
  }

  return canonicalFases;
}

/**
 * Normaliza un número al selector de progreso canónico: 0, 25, 50, 75, 100
 */
export function normalizeProgress(value) {
  const val = Number(value) || 0;
  if (val >= 90) return 100;
  if (val >= 65) return 75;
  if (val >= 40) return 50;
  if (val >= 15) return 25;
  return 0;
}

/**
 * Calcula el progreso ponderado de una fase según sus tareas e importes.
 */
export function calculatePhaseWeightedProgress(tareas, totalFaseImporte) {
  if (!tareas || tareas.length === 0) return 0;
  
  const totalImporte = totalFaseImporte || tareas.reduce((s, t) => s + (t.importeTotal || 1), 0) || 1;
  const sumaPonderada = tareas.reduce((s, t) => {
    const imp = t.importeTotal || 1;
    return s + (imp * (t.progreso || 0));
  }, 0);

  return Math.round(sumaPonderada / totalImporte);
}

/**
 * Recálculo ponderado del avance global de la obra según fórmula canónica:
 * Progreso Obra (%) = Σ (Importe Partida * % Avance Partida) / Importe Total Presupuestado * 100
 * @param {Array} fases - Lista canónica de fases con sus tareas
 * @returns {number} Porcentaje entero entre 0 y 100
 */
export function calculateGlobalProjectProgress(fases) {
  if (!fases || fases.length === 0) return 0;

  let sumaPonderadaTotal = 0;
  let importeTotalPresupuesto = 0;

  fases.forEach(fase => {
    if (fase.tareas && fase.tareas.length > 0) {
      fase.tareas.forEach(tarea => {
        const importe = Number(tarea.importeTotal) || 0;
        const prog = Number(tarea.progreso) || 0;
        sumaPonderadaTotal += importe * (prog / 100);
        importeTotalPresupuesto += importe;
      });
    } else {
      // Fallback a nivel de fase si no tuviese tareas desglosadas
      const importe = Number(fase.importeTotal) || 1;
      const prog = Number(fase.progreso) || 0;
      sumaPonderadaTotal += importe * (prog / 100);
      importeTotalPresupuesto += importe;
    }
  });

  if (importeTotalPresupuesto === 0) {
    // Si no hay importes, media simple de fases
    const sumaSimple = fases.reduce((s, f) => s + (f.progreso || 0), 0);
    return Math.round(sumaSimple / fases.length);
  }

  const progresoGlobal = (sumaPonderadaTotal / importeTotalPresupuesto) * 100;
  return Math.round(Math.min(100, Math.max(0, progresoGlobal)));
}

/**
 * Sincroniza y repara todas las obras existentes contrastándolas con sus presupuestos firmados.
 * Elimina cualquier discrepancia (ej: fases huérfanas en Calle Velázquez).
 * @param {Array} obras - Lista de obras del ERP
 * @param {Array} presupuestos - Lista de presupuestos
 * @returns {Array} Obras reparadas con vinculación canónica 1:1
 */
const DAY_MS = 86400000;

// Fechas 'AAAA-MM-DD' en hora local (new Date('AAAA-MM-DD') sería UTC y puede restar un día).
export function parseObraDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toIsoDate(d) {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diffDays(a, b) {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS);
}

function addDays(d, days) {
  const r = startOfDay(d);
  r.setDate(r.getDate() + Math.ceil(days));
  return r;
}

/**
 * Fin de obra previsto calculado con el avance real:
 * - Cada etapa aporta sus días planificados × (1 - avance).
 * - Si un operario ha indicado los días que le faltan a una etapa, manda su indicación
 *   (descontando los días pasados desde que la dio).
 * - El ritmo real (días transcurridos frente a días de trabajo ya hechos) corrige lo que no indicó nadie.
 * Las etapas se consideran consecutivas.
 */
export function calculateForecastEndDate(obra, today = new Date()) {
  const hoy = startOfDay(today);
  const fases = obra?.fases || [];
  const inicio = parseObraDate(obra?.fechaInicio) || hoy;
  const progreso = Number(obra?.progreso) || 0;

  const plannedDays = (f) => Math.max(1, Number(f.dias) || 5);
  const totalPlanned = fases.length > 0 ? fases.reduce((s, f) => s + plannedDays(f), 0) : 45;

  if (fases.length === 0 && progreso <= 0) {
    return { fecha: addDays(inicio, totalPlanned), diasRestantesTrabajo: totalPlanned, ritmo: 1, metodo: 'plan', estimacionesObrero: 0 };
  }

  if (progreso >= 100) {
    const completions = fases.flatMap(f => [f.completedAt, ...(f.tareas || []).map(t => t.completedAt)])
      .map(v => (v ? new Date(v) : null))
      .filter(d => d && !Number.isNaN(d.getTime()));
    const last = completions.length ? new Date(Math.max(...completions.map(d => d.getTime()))) : hoy;
    return { fecha: startOfDay(last), diasRestantesTrabajo: 0, ritmo: 1, metodo: 'finalizada', estimacionesObrero: 0 };
  }

  // Ritmo real: solo es fiable con algo de avance y unos días de obra.
  const elapsed = Math.max(0, diffDays(hoy, inicio));
  const doneDays = fases.length > 0
    ? fases.reduce((s, f) => s + plannedDays(f) * ((Number(f.progreso) || 0) / 100), 0)
    : totalPlanned * (progreso / 100);
  let ritmo = 1;
  if (elapsed >= 3 && doneDays >= 1) {
    ritmo = Math.min(3, Math.max(0.5, elapsed / doneDays));
  }

  let remaining = 0;
  let estimacionesObrero = 0;
  const pending = fases.length > 0 ? fases : [{ dias: totalPlanned, progreso }];
  pending.forEach(f => {
    const prog = Number(f.progreso) || 0;
    if (prog >= 100) return;
    const est = f.estimacionObrero;
    const estDias = Number(est?.diasRestantes);
    const estFecha = parseObraDate(est?.fecha);
    if (est && Number.isFinite(estDias) && estDias >= 0 && estFecha) {
      estimacionesObrero++;
      // Una etapa sin terminar cuenta al menos medio día aunque su plazo indicado ya haya pasado.
      remaining += Math.max(0.5, estDias - Math.max(0, diffDays(hoy, estFecha)));
    } else {
      remaining += plannedDays(f) * (1 - prog / 100) * ritmo;
    }
  });

  // Lo pendiente se cuenta desde hoy, o desde el inicio si la obra aún no ha empezado.
  const desde = hoy > inicio ? hoy : inicio;
  return {
    fecha: addDays(desde, remaining),
    diasRestantesTrabajo: Math.ceil(remaining),
    ritmo: Math.round(ritmo * 100) / 100,
    metodo: estimacionesObrero > 0 ? 'avance_y_obreros' : (ritmo !== 1 ? 'ritmo_real' : 'plan'),
    estimacionesObrero
  };
}

/**
 * Calculates AI scheduling analytics for an obra:
 * - Fin planificado (editable), fecha de entrega al cliente y fin previsto calculado
 * - Días restantes, Estado de riesgo (En plazo 🟢, Riesgo de retraso 🟡, Retraso crítico 🔴)
 * - Capacity analysis & next available start date for new projects
 */
export function calculateObraScheduling(obra, allObras = [], today = new Date()) {
  const hoy = startOfDay(today);
  const fechaInicio = parseObraDate(obra.fechaInicio) || hoy;

  const duracionPrevistaDias = obra.fases?.length > 0
    ? obra.fases.reduce((sum, f) => sum + (Number(f.dias) || 5), 0)
    : 45;

  const fechaFin = parseObraDate(obra.fechaFinEstimada) || addDays(fechaInicio, duracionPrevistaDias);
  const fechaEntrega = parseObraDate(obra.fechaEntregaCliente) || fechaFin;
  const forecast = calculateForecastEndDate(obra, hoy);
  const fechaPrevista = forecast.fecha;

  const totalDays = Math.max(1, diffDays(fechaFin, fechaInicio));
  const elapsedDays = Math.max(0, diffDays(hoy, fechaInicio));
  const diasRestantes = Math.max(0, diffDays(fechaPrevista, hoy));
  // Positivo = la previsión llega tarde respecto a lo prometido al cliente.
  const desviacionEntregaDias = diffDays(fechaPrevista, fechaEntrega);
  const desviacionPlanDias = diffDays(fechaPrevista, fechaFin);

  const progreso = Number(obra.progreso) || 0;
  const expectedProgreso = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

  let estadoRiesgo = '🟢 En plazo';
  let riesgoLevel = 'low'; // low, medium, high

  if (progreso < 100) {
    if (desviacionEntregaDias > 7 || (hoy > fechaEntrega)) {
      estadoRiesgo = '🔴 Retraso crítico detectado';
      riesgoLevel = 'high';
    } else if (desviacionEntregaDias > 0 || (expectedProgreso - progreso) > 15) {
      estadoRiesgo = '🟡 Riesgo de retraso';
      riesgoLevel = 'medium';
    }
  } else {
    estadoRiesgo = desviacionEntregaDias > 0 ? '🟡 Finalizada con retraso' : '🟢 Finalizada en plazo';
    riesgoLevel = 'low';
  }

  // Operarios asignados
  const operariosAsignados = obra.operariosAsignados || 3;

  // Próxima fecha disponible: la previsión calculada más tardía de las obras en curso.
  const activeObras = (allObras || []).filter(o => o.estado === 'en_curso');
  let maxFinMs = hoy.getTime();
  activeObras.forEach(o => {
    const f = (o.id === obra.id ? fechaPrevista : calculateForecastEndDate(o, hoy).fecha).getTime();
    if (f > maxFinMs) maxFinMs = f;
  });
  const nextAvailableDate = addDays(new Date(maxFinMs), 1);

  const formatDate = (d) => {
    try {
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return toIsoDate(d);
    }
  };

  return {
    fechaInicioFormatted: formatDate(fechaInicio),
    fechaFinFormatted: formatDate(fechaFin),
    fechaEntregaFormatted: formatDate(fechaEntrega),
    fechaPrevistaFormatted: formatDate(fechaPrevista),
    fechaPrevistaIso: toIsoDate(fechaPrevista),
    desviacionEntregaDias,
    desviacionPlanDias,
    ritmo: forecast.ritmo,
    metodoPrevision: forecast.metodo,
    estimacionesObrero: forecast.estimacionesObrero,
    duracionPrevistaDias: totalDays,
    diasRestantes,
    operariosAsignados,
    progreso,
    expectedProgreso,
    estadoRiesgo,
    riesgoLevel,
    proximaFechaDisponibleFormatted: formatDate(nextAvailableDate)
  };
}

export function repairAndSyncObrasWithBudgets(obras, presupuestos) {
  if (!obras || obras.length === 0) return [];

  return obras.map(obra => {
    // Buscar el presupuesto de referencia (por presupuestoId o por obraId o por cliente)
    const matchedPresupuesto = (presupuestos || []).find(p => 
      p.id === obra.presupuestoId || 
      p.obraId === obra.id ||
      (p.cliente && obra.cliente && p.cliente.toLowerCase() === obra.cliente.toLowerCase())
    );

    if (!matchedPresupuesto) {
      // Si la obra no tiene presupuesto firmado, asegurar que sus fases tengan tareas y coherencia
      return obra;
    }

    // Generar el plan canónico de fases y tareas a partir del presupuesto firmado
    const canonicalFases = generateExecutionPlanFromBudget(matchedPresupuesto, obra.fases || []);
    const canonicalProgreso = calculateGlobalProjectProgress(canonicalFases);

    return {
      ...obra,
      presupuestoId: matchedPresupuesto.id,
      presupuestoTotal: matchedPresupuesto.totalConIva || matchedPresupuesto.baseImponible || obra.presupuestoTotal,
      fases: canonicalFases,
      progreso: canonicalProgreso,
      // Metadata de trazabilidad
      _syncSourceOfTruth: {
        presupuestoNumero: matchedPresupuesto.numero,
        totalPartidas: (matchedPresupuesto.partidas || []).length,
        syncedAt: new Date().toISOString()
      }
    };
  });
}
