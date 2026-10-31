/**
 * Cálculo de nómina mensual (España, régimen general, 2026).
 *
 * Es un cálculo orientativo para preparar la nómina y saber el coste real de
 * cada operario. No sustituye a la gestoría: no hace regularizaciones de IRPF a
 * mitad de año, ni cotización de solidaridad, ni cuotas fijas de contratos de
 * formación. Los parámetros anuales están juntos en PARAMETROS_NOMINA para
 * poder revisarlos cada enero.
 */

export const PARAMETROS_NOMINA = {
  anio: 2026,
  diasMes: 30,
  baseMaximaMensual: 5101.2,
  baseMinimaMensual: 1424.5, // grupos 4 a 11 (SMI prorrateado); los grupos 1 a 3 tienen una base mínima mayor
  trabajador: { contingenciasComunes: 4.7, mei: 0.15, formacion: 0.1, horasExtra: 4.7, desempleoIndefinido: 1.55, desempleoTemporal: 1.6 },
  empresa: { contingenciasComunes: 23.6, mei: 0.75, formacion: 0.6, fogasa: 0.2, horasExtra: 23.6, desempleoIndefinido: 5.5, desempleoTemporal: 6.7, atEpConstruccion: 6.7 },
  irpf: {
    escala: [
      [12450, 19], [20200, 24], [35200, 30], [60000, 37], [300000, 45], [Infinity, 47]
    ],
    otrosGastos: 2000,
    gastosDiscapacidad33: 3500,
    gastosDiscapacidad65: 7750,
    minimoPersonal: 5550,
    minimoMayor65: 1150,
    minimoMayor75: 1400,
    minimoHijos: [2400, 2700, 4000, 4500],
    minimoHijoMenor3: 2800,
    minimoAscendiente65: 1150,
    minimoAscendiente75: 1400,
    minimoDiscapacidad33: 3000,
    minimoDiscapacidad65: 9000,
    // Límites por debajo de los cuales no se retiene (art. 81 RIRPF): [0 hijos, 1 hijo, 2 o más]
    limiteExento: { 1: [null, 17644, 18694], 2: [17197, 18130, 19262], 3: [15876, 16342, 16867] },
    tipoMinimoTemporal: 2,
    deduccionSmi: { importe: 340, hasta: 16576, finTramo: 18276 }
  }
};

export const TIPOS_CONTRATO = [
  { value: 'indefinido', label: 'Indefinido' },
  { value: 'fijo_obra', label: 'Indefinido adscrito a obra' },
  { value: 'fijo_discontinuo', label: 'Fijo discontinuo' },
  { value: 'temporal', label: 'Temporal (duración determinada)' },
  { value: 'formacion', label: 'Formativo (formación en alternancia)' },
  { value: 'practicas', label: 'Formativo (práctica profesional)' }
];

export const SITUACIONES_FAMILIARES = [
  { value: 'soltero', label: 'Soltero, viudo o separado sin hijos a cargo' },
  { value: 'casado', label: 'Casado o pareja de hecho' },
  { value: 'monoparental', label: 'Monoparental (solo, con hijos a cargo)' }
];

export const etiquetaContrato = (v) => TIPOS_CONTRATO.find((t) => t.value === v)?.label || v || 'Sin indicar';

const CONTRATOS_TEMPORALES = new Set(['temporal', 'formacion', 'practicas']);
const MESES_PAGA_EXTRA = { 2: [6, 12], 3: [3, 6, 12] };

const n = (v, def = 0) => {
  const x = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(x) ? x : def;
};
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const pct = (base, p) => r2((base * p) / 100);

const aniosEntre = (desde, hasta) => {
  if (!desde) return 0;
  const a = new Date(desde);
  if (Number.isNaN(a.getTime())) return 0;
  let anios = hasta.getFullYear() - a.getFullYear();
  const m = hasta.getMonth() - a.getMonth();
  if (m < 0 || (m === 0 && hasta.getDate() < a.getDate())) anios -= 1;
  return Math.max(0, anios);
};

/** Trienios cumplidos a una fecha (o los que se hayan puesto a mano en la ficha). */
export function calcularTrienios(emp, fecha = new Date()) {
  if (emp.trieniosManual !== null && emp.trieniosManual !== undefined && emp.trieniosManual !== '') {
    return Math.max(0, Math.floor(n(emp.trieniosManual)));
  }
  return Math.floor(aniosEntre(emp.fechaAlta, fecha) / 3);
}

/** Situación del Modelo 145: 1 monoparental, 2 cónyuge a cargo (rentas < 1.500 €), 3 resto. */
export function situacionIrpf(emp) {
  const hijos = n(emp.hijosACargo);
  if (emp.situacionFamiliar === 'monoparental' && hijos > 0) return 1;
  if (emp.situacionFamiliar === 'casado' && emp.conyugeSinRentas) return 2;
  return 3;
}

const cuotaEscala = (base, escala) => {
  let cuota = 0;
  let desde = 0;
  for (const [hasta, tipo] of escala) {
    if (base <= desde) break;
    cuota += (Math.min(base, hasta) - desde) * (tipo / 100);
    desde = hasta;
  }
  return cuota;
};

/**
 * Tipo de retención anual según el procedimiento general de la AEAT
 * (simplificado: sin pensiones compensatorias ni prolongación de actividad).
 */
export function calcularTipoIrpf({ retribucionAnual, cotizacionesAnuales, emp, fecha = new Date(), P = PARAMETROS_NOMINA }) {
  const I = P.irpf;
  const RI = Math.max(0, retribucionAnual);
  const situacion = situacionIrpf(emp);
  const hijos = Math.max(0, Math.floor(n(emp.hijosACargo)));
  const fila = I.limiteExento[situacion];
  const limite = fila[Math.min(hijos, 2)] ?? fila[1];
  const discap = n(emp.discapacidadPct);

  if (RI <= limite) {
    return { tipo: CONTRATOS_TEMPORALES.has(emp.tipoContrato) && RI > 0 ? I.tipoMinimoTemporal : 0, situacion, limite, detalle: null, exento: true };
  }

  let gastos = cotizacionesAnuales + I.otrosGastos;
  if (discap >= 65) gastos += I.gastosDiscapacidad65;
  else if (discap >= 33) gastos += I.gastosDiscapacidad33;
  const rendimientoNeto = Math.max(0, RI - gastos);

  let reduccion = 0;
  if (rendimientoNeto <= 14852) reduccion = 7302;
  else if (rendimientoNeto <= 17673.52) reduccion = 7302 - 1.75 * (rendimientoNeto - 14852);
  else if (rendimientoNeto <= 19747.5) reduccion = 2364.34 - 1.5 * (rendimientoNeto - 17673.52);
  const baseRetencion = Math.max(0, rendimientoNeto - Math.max(0, reduccion));

  const edad = aniosEntre(emp.fechaNacimiento, fecha);
  let minimo = I.minimoPersonal;
  if (edad >= 65) minimo += I.minimoMayor65;
  if (edad >= 75) minimo += I.minimoMayor75;
  if (discap >= 65) minimo += I.minimoDiscapacidad65;
  else if (discap >= 33) minimo += I.minimoDiscapacidad33;
  const factorHijos = emp.hijosComputoMitad ? 0.5 : 1;
  let minHijos = 0;
  for (let i = 0; i < hijos; i += 1) minHijos += I.minimoHijos[Math.min(i, I.minimoHijos.length - 1)];
  minHijos += Math.min(hijos, Math.max(0, Math.floor(n(emp.hijosMenores3)))) * I.minimoHijoMenor3;
  minimo += minHijos * factorHijos;
  const asc65 = Math.max(0, Math.floor(n(emp.dependientesACargo)));
  const asc75 = Math.min(asc65, Math.max(0, Math.floor(n(emp.ascendientesMayores75))));
  minimo += asc65 * I.minimoAscendiente65 + asc75 * I.minimoAscendiente75;

  let cuota = Math.max(0, cuotaEscala(baseRetencion, I.escala) - cuotaEscala(minimo, I.escala));

  // Deducción para rentas cercanas al SMI
  const D = I.deduccionSmi;
  if (RI <= D.hasta) cuota = Math.max(0, cuota - D.importe);
  else if (RI < D.finTramo) cuota = Math.max(0, cuota - (D.importe - 0.2 * (RI - D.hasta)));

  // La retención no puede superar el 43 % de lo que exceda del límite exento
  cuota = Math.min(cuota, 0.43 * (RI - limite));

  let tipo = r2((cuota / RI) * 100);
  if (CONTRATOS_TEMPORALES.has(emp.tipoContrato)) tipo = Math.max(tipo, I.tipoMinimoTemporal);
  return {
    tipo,
    situacion,
    limite,
    exento: false,
    detalle: {
      retribucionAnual: r2(RI),
      gastos: r2(gastos),
      rendimientoNeto: r2(rendimientoNeto),
      reduccion: r2(Math.max(0, reduccion)),
      baseRetencion: r2(baseRetencion),
      minimoPersonalFamiliar: r2(minimo),
      cuotaAnual: r2(cuota)
    }
  };
}

/** Tramos de la prestación por incapacidad temporal (IT) para los días de baja del mes. */
function calcularIT(emp, baseDiariaIT, salarioDiario) {
  const dias = Math.max(0, Math.floor(n(emp.itDiasMes)));
  if (!dias) return { dias: 0, prestacion: 0, complemento: 0, tramos: [] };
  const previos = Math.max(0, Math.floor(n(emp.itDiasPrevios)));
  const accidente = emp.itTipo === 'accidente';
  const tramos = { 0: 0, 60: 0, 75: 0 };
  for (let i = 1; i <= dias; i += 1) {
    const d = previos + i;
    const p = accidente ? 75 : d <= 3 ? 0 : d <= 20 ? 60 : 75;
    tramos[p] += 1;
  }
  const prestacion = r2(baseDiariaIT * ((tramos[60] * 60) + (tramos[75] * 75)) / 100);
  const complPct = Math.min(100, Math.max(0, n(emp.itComplementoPct)));
  const objetivo = r2((salarioDiario * dias * complPct) / 100);
  const complemento = complPct > 0 ? Math.max(0, r2(objetivo - prestacion)) : 0;
  return {
    dias,
    prestacion,
    complemento,
    tramos: Object.entries(tramos).filter(([, d]) => d > 0).map(([p, d]) => ({ pct: Number(p), dias: d }))
  };
}

/** Vacaciones: devengadas en el año, pendientes y lo que valen si hubiera que pagarlas en el finiquito. */
export function calcularVacaciones(emp, fecha = new Date(), salarioAnual = 0) {
  const total = n(emp.vacacionesAnualesTotal, 30);
  const consumidas = n(emp.vacacionesConsumidas);
  const inicioAnio = new Date(fecha.getFullYear(), 0, 1);
  const alta = emp.fechaAlta ? new Date(emp.fechaAlta) : inicioAnio;
  const desde = alta > inicioAnio ? alta : inicioAnio;
  const finAnio = new Date(fecha.getFullYear(), 11, 31);
  const diasAnio = Math.round((finAnio - inicioAnio) / 86400000) + 1;
  const diasTranscurridos = Math.max(0, Math.round((fecha - desde) / 86400000) + 1);
  const devengadas = r2(Math.min(total, (total * diasTranscurridos) / diasAnio));
  const valorDia = r2(salarioAnual / 365);
  return {
    total,
    consumidas,
    pendientes: r2(total - consumidas),
    devengadas,
    pendientesDevengadas: r2(Math.max(0, devengadas - consumidas)),
    valorDia,
    valorPendientesDevengadas: r2(Math.max(0, devengadas - consumidas) * valorDia)
  };
}

/**
 * Nómina de un mes.
 * @param emp ficha del empleado (los campos que falten toman un valor razonable)
 * @param opciones { mes: 1-12, anio }
 */
export function calcularNomina(emp = {}, { mes, anio } = {}, P = PARAMETROS_NOMINA) {
  const hoy = new Date();
  const m = mes || hoy.getMonth() + 1;
  const a = anio || hoy.getFullYear();
  const finMes = new Date(a, m, 0);
  const DM = P.diasMes;

  const temporal = CONTRATOS_TEMPORALES.has(emp.tipoContrato);
  const salarioBase = n(emp.salarioBaseMensual);
  const trienios = calcularTrienios(emp, finMes);
  const importeTrienio = n(emp.importeTrienio);
  const antiguedad = r2(trienios * importeTrienio);
  const plusConvenio = n(emp.plusConvenio);
  const otrosPluses = n(emp.otrosPlusesSalariales);
  const dietas = n(emp.dietasExentas);
  const horasExtras = n(emp.horasExtras);
  const precioHoraExtra = n(emp.precioHoraExtra);
  const importeExtras = r2(horasExtras * precioHoraExtra);

  const numPagas = [0, 2, 3].includes(n(emp.numPagasExtra, 2)) ? n(emp.numPagasExtra, 2) : 2;
  const prorratea = !!emp.pagasProrrateadas;
  const importePaga = emp.importePagaExtra !== undefined && emp.importePagaExtra !== null && emp.importePagaExtra !== ''
    ? n(emp.importePagaExtra)
    : r2(salarioBase + antiguedad);
  const prorrataMensual = r2((importePaga * numPagas) / 12);

  // Días: 30 al mes; los no retribuidos (permiso sin sueldo, faltas) no se pagan ni cotizan.
  const diasNoRetribuidos = Math.min(DM, Math.max(0, Math.floor(n(emp.diasNoRetribuidos))));
  const itDias = Math.min(DM - diasNoRetribuidos, Math.max(0, Math.floor(n(emp.itDiasMes))));
  const diasSalario = DM - diasNoRetribuidos - itDias;
  const fSalario = diasSalario / DM;
  const fCotiza = (DM - diasNoRetribuidos) / DM;

  const fijoMensual = salarioBase + antiguedad + plusConvenio + otrosPluses;
  const salarioDiario = fijoMensual / DM;

  const conceptos = [];
  const add = (concepto, importe, tipo, extra = {}) => {
    const { siempre, ...resto } = extra;
    const v = r2(importe);
    if (v !== 0 || siempre) conceptos.push({ concepto, importe: v, tipo, ...resto });
    return v;
  };
  add('Salario base', salarioBase * fSalario, 'salarial', { dias: diasSalario, siempre: true });
  if (antiguedad) add(`Antigüedad (${trienios} trienio${trienios === 1 ? '' : 's'})`, antiguedad * fSalario, 'salarial');
  add('Plus convenio', plusConvenio * fSalario, 'salarial');
  add('Otros pluses', otrosPluses * fSalario, 'salarial');
  add(`Horas extra (${horasExtras} h)`, importeExtras, 'extra');

  let pagaExtraMes = 0;
  if (numPagas > 0) {
    if (prorratea) add('Prorrata pagas extra', prorrataMensual * fCotiza, 'salarial');
    else if ((MESES_PAGA_EXTRA[numPagas] || []).includes(m)) pagaExtraMes = add('Paga extra', importePaga, 'paga');
  }

  // Bases de cotización: siempre con prorrata de pagas; en IT se sigue cotizando.
  const baseTeorica = fijoMensual * fCotiza + prorrataMensual * fCotiza;
  const baseMin = P.baseMinimaMensual * fCotiza;
  const baseMax = P.baseMaximaMensual * fCotiza;
  const baseMinFicha = n(emp.baseMinimaCotizacion) > 0 ? n(emp.baseMinimaCotizacion) * fCotiza : baseMin;
  const baseCC = r2(Math.min(baseMax, Math.max(baseMinFicha, baseTeorica)));
  const baseCP = r2(Math.min(baseMax, baseCC + importeExtras));

  const it = calcularIT({ ...emp, itDiasMes: itDias }, (fijoMensual + prorrataMensual) / DM, salarioDiario);
  if (it.dias) {
    add(`Prestación IT (${it.dias} días, pago delegado)`, it.prestacion, 'it');
    add('Complemento IT a cargo de la empresa', it.complemento, 'salarial');
  }
  add('Dietas y gastos de desplazamiento (exentos)', dietas, 'exento');

  const totalDevengado = r2(conceptos.reduce((s, c) => s + c.importe, 0));
  const sujetoIrpf = r2(totalDevengado - dietas);

  const T = P.trabajador;
  const E = P.empresa;
  const desempT = temporal ? T.desempleoTemporal : T.desempleoIndefinido;
  const desempE = temporal ? E.desempleoTemporal : E.desempleoIndefinido;
  const ssTrabajador = [
    { concepto: 'Contingencias comunes', base: baseCC, pct: T.contingenciasComunes },
    { concepto: 'Mecanismo de equidad (MEI)', base: baseCC, pct: T.mei },
    { concepto: 'Desempleo', base: baseCP, pct: desempT },
    { concepto: 'Formación profesional', base: baseCP, pct: T.formacion },
    { concepto: 'Horas extra', base: importeExtras, pct: T.horasExtra }
  ].filter((l) => l.base > 0).map((l) => ({ ...l, importe: pct(l.base, l.pct) }));
  const atEp = emp.atEpPct !== undefined && emp.atEpPct !== '' && emp.atEpPct !== null ? n(emp.atEpPct) : E.atEpConstruccion;
  const ssEmpresa = [
    { concepto: 'Contingencias comunes', base: baseCC, pct: E.contingenciasComunes },
    { concepto: 'Mecanismo de equidad (MEI)', base: baseCC, pct: E.mei },
    { concepto: 'Accidentes de trabajo (AT/EP)', base: baseCP, pct: atEp },
    { concepto: 'Desempleo', base: baseCP, pct: desempE },
    { concepto: 'FOGASA', base: baseCP, pct: E.fogasa },
    { concepto: 'Formación profesional', base: baseCP, pct: E.formacion },
    { concepto: 'Horas extra', base: importeExtras, pct: E.horasExtra }
  ].filter((l) => l.base > 0).map((l) => ({ ...l, importe: pct(l.base, l.pct) }));
  const totalSSTrabajador = r2(ssTrabajador.reduce((s, l) => s + l.importe, 0));
  const totalSSEmpresa = r2(ssEmpresa.reduce((s, l) => s + l.importe, 0));

  // IRPF: retribución anual prevista con los conceptos fijos (12 meses + pagas extra).
  const retribucionAnual = r2(fijoMensual * 12 + importePaga * numPagas);
  const baseAnualCC = Math.min(P.baseMaximaMensual, Math.max(P.baseMinimaMensual, fijoMensual + prorrataMensual)) * 12;
  const cotizacionesAnuales = baseAnualCC * (T.contingenciasComunes + T.mei + desempT + T.formacion) / 100;
  const irpfCalc = calcularTipoIrpf({ retribucionAnual, cotizacionesAnuales, emp, fecha: finMes, P });
  const irpfManual = emp.irpfModo === 'manual';
  const irpfPct = irpfManual ? n(emp.irpfPct) : irpfCalc.tipo;
  const retencionIrpf = pct(sujetoIrpf, irpfPct);

  const otrasDeducciones = r2(n(emp.anticipos) + n(emp.otrasDeducciones));
  const totalDeducciones = r2(totalSSTrabajador + retencionIrpf + otrasDeducciones);
  const liquido = r2(totalDevengado - totalDeducciones);
  const costeEmpresa = r2(totalDevengado + totalSSEmpresa);

  const vacaciones = calcularVacaciones(emp, finMes, retribucionAnual);

  return {
    mes: m,
    anio: a,
    contrato: etiquetaContrato(emp.tipoContrato),
    temporal,
    dias: { mes: DM, salario: diasSalario, noRetribuidos: diasNoRetribuidos, it: itDias },
    trienios,
    antiguedad,
    conceptos,
    pagaExtraMes,
    prorrataMensual,
    totalDevengado,
    sujetoIrpf,
    bases: { contingenciasComunes: baseCC, contingenciasProfesionales: baseCP, irpf: sujetoIrpf },
    ssTrabajador,
    ssEmpresa,
    totalSSTrabajador,
    totalSSEmpresa,
    irpf: { ...irpfCalc, aplicado: irpfPct, manual: irpfManual, calculado: irpfCalc.tipo },
    retencionIrpf,
    otrasDeducciones,
    totalDeducciones,
    liquido,
    costeEmpresa,
    retribucionAnual,
    costeAnualEstimado: r2(retribucionAnual + (totalSSEmpresa - ssEmpresa.filter((l) => l.concepto === 'Horas extra').reduce((s, l) => s + l.importe, 0)) * 12),
    it,
    vacaciones
  };
}

/** Salario base mensual necesario para que el trabajador cobre un neto concreto (mes normal, sin extras). */
export function salarioBaseParaNeto(emp, netoDeseado, opciones = {}) {
  const objetivo = n(netoDeseado);
  if (objetivo <= 0) return 0;
  const neutro = { ...emp, horasExtras: 0, diasNoRetribuidos: 0, itDiasMes: 0, anticipos: 0, otrasDeducciones: 0, importePagaExtra: undefined };
  let lo = 0;
  let hi = objetivo * 3 + 1000;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const { liquido } = calcularNomina({ ...neutro, salarioBaseMensual: mid }, { mes: 1, anio: opciones.anio });
    if (liquido < objetivo) lo = mid; else hi = mid;
  }
  return r2(hi);
}
