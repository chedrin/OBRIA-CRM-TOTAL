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
        titulo: partida.concepto || 'Partida de obra',
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
      nombre: `Fase ${faseIndex}: ${capituloName}`,
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
/**
 * Calculates AI scheduling analytics for an obra:
 * - Fin previsto, Días restantes, Estado de riesgo (En plazo 🟢, Riesgo de retraso 🟡, Retraso crítico 🔴)
 * - Capacity analysis & next available start date for new projects
 */
export function calculateObraScheduling(obra, allObras = []) {
  const today = new Date();
  const fechaInicio = obra.fechaInicio ? new Date(obra.fechaInicio) : new Date();

  // Total estimated days from phases or default
  const duracionPrevistaDias = obra.fases?.length > 0
    ? obra.fases.reduce((sum, f) => sum + (Number(f.dias) || 5), 0)
    : 45;

  let fechaFin = obra.fechaFinEstimada ? new Date(obra.fechaFinEstimada) : new Date(fechaInicio.getTime() + duracionPrevistaDias * 86400000);

  const totalDaysMs = fechaFin.getTime() - fechaInicio.getTime();
  const totalDays = Math.max(1, Math.round(totalDaysMs / 86400000));

  const elapsedDaysMs = today.getTime() - fechaInicio.getTime();
  const elapsedDays = Math.max(0, Math.round(elapsedDaysMs / 86400000));
  const diasRestantes = Math.max(0, Math.round((fechaFin.getTime() - today.getTime()) / 86400000));

  const progreso = Number(obra.progreso) || 0;
  const expectedProgreso = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

  let estadoRiesgo = '🟢 En plazo';
  let riesgoLevel = 'low'; // low, medium, high

  if (progreso < 100) {
    if (diasRestantes <= 0 || (expectedProgreso - progreso) > 30) {
      estadoRiesgo = '🔴 Retraso crítico detectado';
      riesgoLevel = 'high';
    } else if ((expectedProgreso - progreso) > 15) {
      estadoRiesgo = '🟡 Riesgo de retraso';
      riesgoLevel = 'medium';
    }
  } else {
    estadoRiesgo = '🟢 Finalizada en plazo';
    riesgoLevel = 'low';
  }

  // Operarios asignados
  const operariosAsignados = obra.operariosAsignados || 3;

  // Calculate global next available date across all active obras
  const activeObras = (allObras || []).filter(o => o.estado === 'en_curso');
  let maxFinMs = today.getTime();
  activeObras.forEach(o => {
    if (o.fechaFinEstimada) {
      const f = new Date(o.fechaFinEstimada).getTime();
      if (f > maxFinMs) maxFinMs = f;
    }
  });
  const nextAvailableDate = new Date(maxFinMs + 86400000);

  const formatDate = (d) => {
    try {
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return d.toISOString().split('T')[0];
    }
  };

  return {
    fechaInicioFormatted: formatDate(fechaInicio),
    fechaFinFormatted: formatDate(fechaFin),
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
