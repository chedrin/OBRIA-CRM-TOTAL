// Cronograma de obras (diagrama de Gantt): cálculos puros, sin React, para poder probarlos.
import { parseObraDate, toIsoDate, calculateForecastEndDate } from '../services/obraBudgetSyncService.js';

const DAY_MS = 86400000;

// Colores distintos que se leen bien sobre fondo claro y oscuro.
export const COLORES_OBRA = [
  '#3b82f6', // azul
  '#f59e0b', // ámbar
  '#10b981', // verde
  '#a855f7', // violeta
  '#ef4444', // rojo
  '#06b6d4', // cian
  '#ec4899', // rosa
  '#84cc16', // lima
  '#f97316', // naranja
  '#6366f1'  // índigo
];

export const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function inicioDia(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function diasEntre(a, b) {
  return Math.round((inicioDia(a).getTime() - inicioDia(b).getTime()) / DAY_MS);
}

export function sumarDias(d, n) {
  const r = inicioDia(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function inicioMes(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function finMes(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function fechaCorta(d) {
  if (!d) return '—';
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
}

// El color se guarda en la obra si se elige a mano (obra.color); si no, se reparte por orden.
export function colorObra(obra, index) {
  if (obra?.color && /^#[0-9a-f]{6}$/i.test(obra.color)) return obra.color;
  return COLORES_OBRA[index % COLORES_OBRA.length];
}

// Fecha real de terminación de una obra finalizada: la última etapa o partida completada,
// o el campo fechaFinReal si existe. Si no consta, se da por terminada en la fecha prevista.
function fechaFinReal(obra, finPlan) {
  const explicita = parseObraDate(obra.fechaFinReal);
  if (explicita) return inicioDia(explicita);
  const fechas = (obra.fases || [])
    .flatMap(f => [f.completedAt, ...(f.tareas || []).map(t => t.completedAt)])
    .map(v => (v ? new Date(v) : null))
    .filter(d => d && !Number.isNaN(d.getTime()));
  if (fechas.length) return inicioDia(new Date(Math.max(...fechas.map(d => d.getTime()))));
  return finPlan;
}

/**
 * Datos de una fila del cronograma.
 * - inicio / finPlan: lo planificado (fechaInicio, fechaFinEstimada).
 * - entrega: fecha prometida al cliente (si no hay, la de fin planificada).
 * - finPrevisto: previsión con el ritmo real (o fin real si está finalizada).
 * - desviacionDias: finPrevisto − entrega. Positivo = retraso, negativo = adelanto.
 * - difAvance: avance real − avance que tocaría hoy según el plan (puntos %).
 */
export function calcularFilaCronograma(obra, hoyEntrada = new Date()) {
  const hoy = inicioDia(hoyEntrada);
  const dur = obra.fases?.length ? obra.fases.reduce((s, f) => s + (Number(f.dias) || 5), 0) : 45;
  const inicio = inicioDia(parseObraDate(obra.fechaInicio) || hoy);
  let finPlan = parseObraDate(obra.fechaFinEstimada);
  finPlan = finPlan ? inicioDia(finPlan) : sumarDias(inicio, dur);
  if (finPlan < inicio) finPlan = inicio;
  const entregaRaw = parseObraDate(obra.fechaEntregaCliente);
  const entrega = entregaRaw ? inicioDia(entregaRaw) : finPlan;

  const progreso = Math.max(0, Math.min(100, Number(obra.progreso) || 0));
  const finalizada = obra.estado === 'finalizada' || progreso >= 100;
  const presupuestada = obra.estado === 'presupuestada';

  let finPrevisto;
  if (finalizada) finPrevisto = fechaFinReal(obra, finPlan);
  else if (presupuestada && progreso === 0 && hoy <= inicio) finPrevisto = finPlan;
  else finPrevisto = inicioDia(calculateForecastEndDate(obra, hoy).fecha);

  const totalPlan = Math.max(1, diasEntre(finPlan, inicio));
  const transcurridos = Math.min(totalPlan, Math.max(0, diasEntre(hoy, inicio)));
  const esperado = finalizada ? 100 : Math.round((transcurridos / totalPlan) * 100);
  const difAvance = progreso - esperado;
  const desviacionDias = diasEntre(finPrevisto, entrega);
  const diasParaEntrega = diasEntre(entrega, hoy);

  let estado;
  if (finalizada) {
    estado = desviacionDias > 0 ? 'finalizada_tarde' : 'finalizada';
  } else if (hoy < inicio && progreso === 0) {
    estado = 'por_empezar';
  } else if (desviacionDias > 7 || hoy > entrega) {
    estado = 'retraso';
  } else if (desviacionDias > 0 || difAvance < -15) {
    estado = 'riesgo';
  } else if (desviacionDias < -2 || difAvance > 10) {
    estado = 'adelanto';
  } else {
    estado = 'en_plazo';
  }

  return {
    id: obra.id,
    obra,
    inicio,
    finPlan,
    entrega,
    finPrevisto,
    progreso,
    esperado,
    difAvance,
    desviacionDias,
    diasParaEntrega,
    estado,
    finalizada
  };
}

export const ESTADOS_PLAZO = {
  retraso: { label: 'Retraso', tono: 'red' },
  riesgo: { label: 'Riesgo', tono: 'amber' },
  en_plazo: { label: 'En plazo', tono: 'emerald' },
  adelanto: { label: 'Adelantada', tono: 'sky' },
  por_empezar: { label: 'Por empezar', tono: 'slate' },
  finalizada: { label: 'Terminada', tono: 'emerald' },
  finalizada_tarde: { label: 'Terminada tarde', tono: 'amber' }
};

// Texto corto de la desviación: "+5 d" (retraso) o "−3 d" (adelanto).
export function textoDesviacion(dias) {
  if (!dias) return 'Al día';
  return dias > 0 ? `+${dias} d` : `−${Math.abs(dias)} d`;
}

// Periodos rápidos. "todo" se ajusta a las fechas de las obras.
export function rangoPreset(preset, filas, hoyEntrada = new Date()) {
  const hoy = inicioDia(hoyEntrada);
  const mesActual = inicioMes(hoy);
  const mesMas = n => new Date(mesActual.getFullYear(), mesActual.getMonth() + n, 1);
  switch (preset) {
    case '4m':
      return { desde: mesMas(-1), hasta: finMes(mesMas(2)) };
    case '6m':
      return { desde: mesMas(-2), hasta: finMes(mesMas(3)) };
    case '12m':
      return { desde: mesMas(-3), hasta: finMes(mesMas(8)) };
    case 'todo':
    default: {
      if (!filas?.length) return { desde: mesMas(-1), hasta: finMes(mesMas(2)) };
      const ms = filas.flatMap(f => [f.inicio, f.finPlan, f.entrega, f.finPrevisto]).map(d => d.getTime());
      return { desde: inicioMes(new Date(Math.min(...ms))), hasta: finMes(new Date(Math.max(...ms))) };
    }
  }
}

// Meses y marcas de días 1 y 15 de cada mes (y el último día al final del periodo).
export function escalaCronograma(desde, hasta) {
  const totalDias = Math.max(1, diasEntre(hasta, desde) + 1);
  const meses = [];
  const marcas = [];
  let cursor = inicioMes(desde);
  while (cursor <= hasta) {
    const ini = cursor < desde ? desde : cursor;
    const fin = finMes(cursor) > hasta ? hasta : finMes(cursor);
    meses.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: MESES_ES[cursor.getMonth()],
      anio: cursor.getFullYear(),
      izquierda: (diasEntre(ini, desde) / totalDias) * 100,
      ancho: ((diasEntre(fin, ini) + 1) / totalDias) * 100
    });
    const ultimo = finMes(cursor).getDate();
    // El último día solo se marca al final del periodo: junto al día 1 siguiente se solaparía.
    const dias = finMes(cursor) >= hasta ? [1, 15, ultimo] : [1, 15];
    dias.forEach(dia => {
      const f = new Date(cursor.getFullYear(), cursor.getMonth(), dia);
      if (f >= desde && f <= hasta) {
        marcas.push({ key: toIsoDate(f), dia, inicioMes: dia === 1, izquierda: (diasEntre(f, desde) / totalDias) * 100 });
      }
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return { totalDias, meses, marcas };
}

// Posición en % de una fecha dentro del periodo (inicio del día). fin=true → final del día.
export function posicion(fecha, desde, totalDias, fin = false) {
  return ((diasEntre(fecha, desde) + (fin ? 1 : 0)) / totalDias) * 100;
}

export function filaVisible(fila, desde, hasta) {
  const ini = fila.inicio;
  const fin = [fila.finPlan, fila.finPrevisto, fila.entrega].reduce((a, b) => (b > a ? b : a));
  return ini <= hasta && fin >= desde;
}

// Resumen para las tarjetas superiores.
export function resumenCronograma(filas) {
  const activas = filas.filter(f => !f.finalizada && f.estado !== 'por_empezar');
  const conRetraso = activas.filter(f => f.estado === 'retraso');
  const enRiesgo = activas.filter(f => f.estado === 'riesgo');
  const adelantadas = activas.filter(f => f.estado === 'adelanto');
  const retrasos = activas.filter(f => f.desviacionDias > 0).map(f => f.desviacionDias);
  const proxima = filas
    .filter(f => !f.finalizada && f.diasParaEntrega >= 0)
    .sort((a, b) => a.entrega - b.entrega)[0] || null;
  return {
    activas: activas.length,
    retraso: conRetraso.length,
    riesgo: enRiesgo.length,
    adelanto: adelantadas.length,
    enPlazo: activas.length - conRetraso.length - enRiesgo.length,
    retrasoMedio: retrasos.length ? Math.round(retrasos.reduce((s, d) => s + d, 0) / retrasos.length) : 0,
    proxima
  };
}
