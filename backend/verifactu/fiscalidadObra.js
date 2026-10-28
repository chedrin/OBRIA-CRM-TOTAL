/**
 * ObraMaster - IVA e IRPF de una factura de obra según el tipo de obra y el cliente
 *
 * Reglas de la Ley 37/1992 del IVA (LIVA) y del Reglamento del IRPF:
 *
 *  1. Inversión del sujeto pasivo (art. 84.Uno.2º.f LIVA): ejecuciones de obra (con o
 *     sin materiales) de urbanización, construcción o rehabilitación de edificaciones,
 *     contratadas directamente con el PROMOTOR, o del subcontratista con el contratista
 *     principal, cuando el cliente es empresario o profesional. La factura va sin
 *     cuota de IVA (la declara el cliente) y lleva la mención "inversión del sujeto pasivo".
 *     El cliente debe comunicarlo por escrito (art. 24 quater.7 del Reglamento del IVA).
 *  2. 10 % obra nueva o rehabilitación de edificios destinados principalmente a
 *     vivienda, contratada directamente entre promotor y contratista (art. 91.Uno.3.1º LIVA).
 *  3. 10 % renovación y reparación de vivienda (art. 91.Uno.2.10º LIVA): cliente
 *     particular (persona física que no actúa como empresario) o comunidad de
 *     propietarios, vivienda de uso particular terminada o rehabilitada hace al menos
 *     2 años y materiales aportados por el contratista que no superen el 40 % de la base.
 *  4. En el resto de casos, 21 %.
 *
 *  IRPF: retención del 1 % si el emisor es autónomo en estimación objetiva (módulos)
 *  y el cliente es empresario o profesional (art. 95.6.2º Reglamento del IRPF).
 *
 * Esto es una ayuda: el usuario confirma el resultado y la factura guarda el motivo.
 */

const TIPOS_OBRA = new Set(["obra_nueva", "rehabilitacion", "reforma_vivienda", "otra"]);

/**
 * @param {object} d
 *   tipoObra: 'obra_nueva' | 'rehabilitacion' | 'reforma_vivienda' | 'otra'
 *   clienteTipo: 'particular' | 'comunidad' | 'empresa'
 *   relacion: 'promotor' (el cliente es el dueño/promotor) | 'contratista' (yo subcontrato para él)
 *   destinoVivienda: el edificio es principalmente de viviendas (al menos el 50 % de la superficie)
 *   usoParticular: la vivienda la usa el cliente para sí (no para una actividad)
 *   antiguedadMas2Anos: la vivienda se terminó o rehabilitó hace 2 años o más
 *   materialesPct: coste de los materiales que aporto / base imponible, en %
 *   regimenIrpfEmisor: 'directa' | 'objetiva'
 *   emisorAutonomo: true si el emisor es autónomo
 */
export function calcularFiscalidadObra(d = {}) {
  const tipoObra = TIPOS_OBRA.has(d.tipoObra) ? d.tipoObra : "otra";
  const clienteTipo = ["particular", "comunidad", "empresa"].includes(d.clienteTipo) ? d.clienteTipo : "particular";
  const relacion = d.relacion === "contratista" ? "contratista" : "promotor";
  const clienteEmpresa = clienteTipo === "empresa";
  const materialesPct = Number(d.materialesPct);
  const avisos = [];
  const documentos = [];

  let ivaPct = 21;
  let isp = false;
  let motivo = "Tipo general del IVA (art. 90 Ley 37/1992).";

  const construccionOrehab = tipoObra === "obra_nueva" || tipoObra === "rehabilitacion";

  if (clienteEmpresa && construccionOrehab) {
    // El tipo que liquidará el cliente: 10 % solo si es vivienda y contrata directamente como promotor.
    ivaPct = relacion === "promotor" && d.destinoVivienda ? 10 : 21;
    isp = true;
    motivo = relacion === "contratista"
      ? "Inversión del sujeto pasivo: subcontrata de obra con el contratista principal (art. 84.Uno.2º.f Ley 37/1992)."
      : "Inversión del sujeto pasivo: ejecución de obra de construcción o rehabilitación contratada con el promotor (art. 84.Uno.2º.f Ley 37/1992).";
    documentos.push("Comunicación escrita del cliente de que actúa como empresario y la obra es de construcción o rehabilitación (art. 24 quater.7 Reglamento del IVA).");
    if (tipoObra === "rehabilitacion") {
      avisos.push("Rehabilitación a efectos de IVA: más del 50 % del coste debe ser de consolidación o tratamiento de estructuras, fachadas o cubiertas (o análogas), y el total superar el 25 % del valor de la edificación (art. 20.Uno.22º.B Ley 37/1992). Si no se cumple, es una reforma.");
    }
  } else if (construccionOrehab && relacion === "promotor" && d.destinoVivienda) {
    ivaPct = 10;
    motivo = tipoObra === "obra_nueva"
      ? "IVA reducido del 10 %: construcción de edificación destinada principalmente a vivienda contratada con el promotor (art. 91.Uno.3.1º Ley 37/1992)."
      : "IVA reducido del 10 %: rehabilitación de edificación destinada principalmente a vivienda contratada con el promotor (art. 91.Uno.3.1º Ley 37/1992).";
    if (tipoObra === "rehabilitacion") {
      avisos.push("Comprueba que es rehabilitación a efectos de IVA (art. 20.Uno.22º.B Ley 37/1992); si no, aplica las reglas de reforma.");
    }
  } else if ((tipoObra === "reforma_vivienda" || tipoObra === "rehabilitacion") && !clienteEmpresa) {
    const faltan = [];
    if (!d.usoParticular) faltan.push("la vivienda debe ser de uso particular del cliente");
    if (!d.antiguedadMas2Anos) faltan.push("la vivienda debe tener al menos 2 años desde su construcción o rehabilitación");
    if (!(materialesPct >= 0 && materialesPct <= 40)) faltan.push("los materiales que aportas no pueden superar el 40 % de la base");
    if (faltan.length === 0) {
      ivaPct = 10;
      motivo = "IVA reducido del 10 %: renovación o reparación de vivienda particular (art. 91.Uno.2.10º Ley 37/1992).";
      documentos.push("Declaración firmada del cliente: uso particular de la vivienda y antigüedad de al menos 2 años.");
    } else {
      avisos.push(`No se aplica el 10 %: ${faltan.join("; ")}.`);
    }
  } else if (clienteEmpresa && tipoObra === "reforma_vivienda") {
    avisos.push("El 10 % de reforma de vivienda solo se aplica a particulares y comunidades de propietarios. A una empresa se le factura al 21 % (sin inversión del sujeto pasivo, salvo que sea construcción o rehabilitación).");
  }

  let irpfPct = 0;
  if (d.emisorAutonomo && d.regimenIrpfEmisor === "objetiva" && clienteEmpresa) {
    irpfPct = 1;
  }

  return {
    ivaPct,
    isp,
    irpfPct,
    motivo,
    textoFactura: isp
      ? "Operación con inversión del sujeto pasivo conforme al art. 84.Uno.2º.f) de la Ley 37/1992 del IVA."
      : motivo,
    avisos,
    documentos,
    clienteTipo: clienteEmpresa ? "empresa" : "particular"
  };
}
