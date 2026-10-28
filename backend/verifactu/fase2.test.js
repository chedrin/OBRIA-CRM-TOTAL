import test from "node:test";
import assert from "node:assert/strict";
import { verificarCadena } from "./huella.js";
import { registroAltaXml, registroAnulacionXml, sobreSoap, parsearRespuesta, estadoLocal, escapeXml } from "./xml.js";
import { calcularFiscalidadObra } from "./fiscalidadObra.js";
import { libroExpedidasCsv, resumenTrimestral } from "./libros.js";
import { generarFacturae } from "./facturae.js";
import { cifrar, descifrar, inspeccionarPfx } from "./certificados.js";
import { elegirLote } from "./envio.js";

// Cadena de pruebas generada por PostgreSQL 16 con emitir_factura(), anular_factura() y
// subsanar_registro(): alta, rectificativa por sustitución, alta con ISP, anulación y subsanación.
const REGISTROS = [
  { id: 1, anterior_id: null, tipo_registro: "alta", nif_emisor: "B12345674", num_serie: "PRUEBA-F-2026-00001", fecha_expedicion: "28-10-2026", tipo_factura: "F1", cuota_total: "210.00", importe_total: "1210.00", huella_anterior: null, fecha_hora_huso: "2026-10-28T21:27:11+01:00", huella: "2215456745654D26ED347392C1405ACF53C3F1F71B75CB57073D487334754988" },
  { id: 2, anterior_id: 1, tipo_registro: "alta", nif_emisor: "B12345674", num_serie: "PRUEBA-R-2026-00001", fecha_expedicion: "28-10-2026", tipo_factura: "R1", cuota_total: "189.00", importe_total: "1089.00", huella_anterior: "2215456745654D26ED347392C1405ACF53C3F1F71B75CB57073D487334754988", fecha_hora_huso: "2026-10-28T21:27:11+01:00", huella: "6C8C23596AD7AD843BF6E7F9125776A4E8BE6F737A18EDB243B20761807463DA" },
  { id: 3, anterior_id: 2, tipo_registro: "alta", nif_emisor: "B12345674", num_serie: "PRUEBA-F-2026-00002", fecha_expedicion: "28-10-2026", tipo_factura: "F1", cuota_total: "0.00", importe_total: "5000.00", huella_anterior: "6C8C23596AD7AD843BF6E7F9125776A4E8BE6F737A18EDB243B20761807463DA", fecha_hora_huso: "2026-10-28T21:27:11+01:00", huella: "5761AE47CF05231194A50B8F943375CAE441CCF8A0D452ACCEE50F257DF01381" },
  { id: 4, anterior_id: 3, tipo_registro: "anulacion", nif_emisor: "B12345674", num_serie: "PRUEBA-F-2026-00002", fecha_expedicion: "28-10-2026", tipo_factura: null, cuota_total: null, importe_total: null, huella_anterior: "5761AE47CF05231194A50B8F943375CAE441CCF8A0D452ACCEE50F257DF01381", fecha_hora_huso: "2026-10-28T21:27:11+01:00", huella: "3D1F164EE6301C3287D90521B7E5986C3580E595179F08D737CDB054A3639FAE" },
  { id: 5, anterior_id: 4, tipo_registro: "alta", nif_emisor: "B12345674", num_serie: "PRUEBA-F-2026-00001", fecha_expedicion: "28-10-2026", tipo_factura: "F1", cuota_total: "210.00", importe_total: "1210.00", huella_anterior: "3D1F164EE6301C3287D90521B7E5986C3580E595179F08D737CDB054A3639FAE", fecha_hora_huso: "2026-10-28T21:27:11+01:00", huella: "B00AD4BB256C9FBFC007E1E26B8189B4EADAEB9DB85785C4503D41AC07550F0F", subsanacion: "S", rechazo_previo: "X" }
];

const SISTEMA = {
  NombreRazon: "Productor de prueba", NIF: "12345678Z", NombreSistemaInformatico: "ObraMaster", IdSistemaInformatico: "OM",
  Version: "1.0.0", NumeroInstalacion: "test", TipoUsoPosibleSoloVerifactu: "S", TipoUsoPosibleMultiOT: "S", IndicadorMultiplesOT: "N"
};

const ORIGINAL = {
  id: "a1", status: "ISSUED", tipo_factura: "F1", num_serie: "PRUEBA-F-2026-00001", fecha_expedicion: "2026-10-28",
  descripcion: "Reforma de baño", cliente_nombre: "Cliente & Hijos", cliente_nif: "12345678Z",
  base_imponible: "1000.00", iva_pct: "21.00", cuota_iva: "210.00", isp: false
};
const SUSTITUTIVA = {
  id: "b1", status: "ISSUED", tipo_factura: "R1", tipo_rectificativa: "S", rectifica_invoice_id: "a1", num_serie: "PRUEBA-R-2026-00001",
  fecha_expedicion: "2026-10-28", descripcion: "Error de medición", cliente_nombre: "Cliente & Hijos", cliente_nif: "12345678Z",
  base_imponible: "900.00", iva_pct: "21.00", cuota_iva: "189.00", isp: false, base_rectificada: "1000.00", cuota_rectificada: "210.00"
};
const ISP = {
  id: "a3", status: "ISSUED", tipo_factura: "F1", num_serie: "PRUEBA-F-2026-00002", fecha_expedicion: "2026-10-28",
  descripcion: "Estructura", cliente_nombre: "Promotora SA", cliente_nif: "A58818501",
  base_imponible: "5000.00", iva_pct: "10.00", cuota_iva: "0.00", isp: true
};

test("la cadena con anulación y subsanación generada por la base de datos se verifica en el servidor", () => {
  assert.deepEqual(verificarCadena(REGISTROS), { ok: true, errores: [] });
  const rota = REGISTROS.filter((r) => r.id !== 4);
  assert.equal(verificarCadena(rota).ok, false);
});

test("XML de alta: valores de la huella sin reformatear, sustitución y primer registro", () => {
  const xml = registroAltaXml({ registro: REGISTROS[1], factura: SUSTITUTIVA, original: ORIGINAL, anterior: REGISTROS[0], emisor: { razonSocial: "Obras <SL>" }, sistema: SISTEMA });
  assert.match(xml, /<sum1:TipoRectificativa>S<\/sum1:TipoRectificativa>/);
  assert.match(xml, /<sum1:BaseRectificada>1000.00<\/sum1:BaseRectificada><sum1:CuotaRectificada>210.00<\/sum1:CuotaRectificada>/);
  assert.match(xml, /<sum1:IDFacturaRectificada><sum1:IDEmisorFactura>B12345674<\/sum1:IDEmisorFactura><sum1:NumSerieFactura>PRUEBA-F-2026-00001<\/sum1:NumSerieFactura><sum1:FechaExpedicionFactura>28-10-2026</);
  assert.match(xml, /<sum1:RegistroAnterior>.*<sum1:Huella>2215456745654D26ED347392C1405ACF53C3F1F71B75CB57073D487334754988<\/sum1:Huella><\/sum1:RegistroAnterior>/);
  assert.match(xml, /<sum1:NombreRazonEmisor>Obras &lt;SL&gt;<\/sum1:NombreRazonEmisor>/);
  assert.match(xml, /<sum1:NombreRazon>Cliente &amp; Hijos<\/sum1:NombreRazon>/);
  assert.match(xml, /<sum1:CuotaTotal>189.00<\/sum1:CuotaTotal><sum1:ImporteTotal>1089.00<\/sum1:ImporteTotal>/);

  const primero = registroAltaXml({ registro: REGISTROS[0], factura: ORIGINAL, anterior: null, emisor: { razonSocial: "Obras" }, sistema: SISTEMA });
  assert.match(primero, /<sum1:PrimerRegistro>S<\/sum1:PrimerRegistro>/);
  assert.doesNotMatch(primero, /TipoRectificativa|Subsanacion/);
});

test("XML de alta con inversión del sujeto pasivo: S2, tipo y cuota a cero", () => {
  const xml = registroAltaXml({ registro: REGISTROS[2], factura: ISP, anterior: REGISTROS[1], emisor: { razonSocial: "Obras" }, sistema: SISTEMA });
  assert.match(xml, /<sum1:CalificacionOperacion>S2<\/sum1:CalificacionOperacion><sum1:TipoImpositivo>0.00<\/sum1:TipoImpositivo><sum1:BaseImponibleOimporteNoSujeto>5000.00<\/sum1:BaseImponibleOimporteNoSujeto><sum1:CuotaRepercutida>0.00</);
});

test("XML de subsanación y de anulación", () => {
  const sub = registroAltaXml({ registro: REGISTROS[4], factura: ORIGINAL, anterior: REGISTROS[3], emisor: { razonSocial: "Obras" }, sistema: SISTEMA });
  assert.match(sub, /<sum1:Subsanacion>S<\/sum1:Subsanacion><sum1:RechazoPrevio>X<\/sum1:RechazoPrevio><sum1:TipoFactura>F1/);
  const anul = registroAnulacionXml({ registro: { ...REGISTROS[3], sin_registro_previo: "S" }, anterior: REGISTROS[2], sistema: SISTEMA });
  assert.match(anul, /<sum1:RegistroAnulacion><sum1:IDVersion>1.0<\/sum1:IDVersion><sum1:IDFactura><sum1:IDEmisorFacturaAnulada>B12345674/);
  assert.match(anul, /<sum1:SinRegistroPrevio>S<\/sum1:SinRegistroPrevio>/);
  const sobre = sobreSoap({ obligado: { nombre: "Obras", nif: "B12345674" }, registrosXml: [sub, anul] });
  assert.match(sobre, /^<\?xml version="1.0" encoding="UTF-8"\?><soapenv:Envelope /);
  assert.equal((sobre.match(/<sum:RegistroFactura>/g) || []).length, 2);
  assert.throws(() => sobreSoap({ obligado: { nombre: "x", nif: "B12345674" }, registrosXml: [] }));
});

test("escapeXml quita caracteres de control y escapa los especiales", () => {
  assert.equal(escapeXml("a&b<c>\"d'\u0001"), "a&amp;b&lt;c&gt;&quot;d&apos;");
});

test("respuesta de la AEAT: líneas, CSV, espera, duplicados y SOAP Fault", () => {
  const xml = `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><tikR:RespuestaRegFactuSistemaFacturacion xmlns:tikR="r" xmlns:tik="i">
    <tikR:CSV>A-123</tikR:CSV><tikR:TiempoEsperaEnvio>90</tikR:TiempoEsperaEnvio><tikR:EstadoEnvio>ParcialmenteCorrecto</tikR:EstadoEnvio>
    <tikR:RespuestaLinea><tikR:IDFactura><tik:NumSerieFactura>F-1</tik:NumSerieFactura></tikR:IDFactura><tikR:Operacion><tik:TipoOperacion>Alta</tik:TipoOperacion></tikR:Operacion><tikR:RefExterna>OM-7</tikR:RefExterna><tikR:EstadoRegistro>AceptadoConErrores</tikR:EstadoRegistro><tikR:CodigoErrorRegistro>2000</tikR:CodigoErrorRegistro></tikR:RespuestaLinea>
    <tikR:RespuestaLinea><tikR:IDFactura><tik:NumSerieFactura>F-2</tik:NumSerieFactura></tikR:IDFactura><tikR:Operacion><tik:TipoOperacion>Alta</tik:TipoOperacion></tikR:Operacion><tikR:EstadoRegistro>Incorrecto</tikR:EstadoRegistro><tikR:CodigoErrorRegistro>3000</tikR:CodigoErrorRegistro><tikR:RegistroDuplicado><tik:IdPeticionRegistroDuplicado>1</tik:IdPeticionRegistroDuplicado><tik:EstadoRegistroDuplicado>Correcta</tik:EstadoRegistroDuplicado></tikR:RegistroDuplicado></tikR:RespuestaLinea>
    <tikR:RespuestaLinea><tikR:IDFactura><tik:NumSerieFactura>F-3</tik:NumSerieFactura></tikR:IDFactura><tikR:Operacion><tik:TipoOperacion>Anulacion</tik:TipoOperacion></tikR:Operacion><tikR:EstadoRegistro>Incorrecto</tikR:EstadoRegistro><tikR:DescripcionErrorRegistro>NIF &amp; otro</tikR:DescripcionErrorRegistro></tikR:RespuestaLinea>
  </tikR:RespuestaRegFactuSistemaFacturacion></env:Body></env:Envelope>`;
  const r = parsearRespuesta(xml);
  assert.equal(r.estadoEnvio, "ParcialmenteCorrecto");
  assert.equal(r.csv, "A-123");
  assert.equal(r.tiempoEsperaEnvio, 90);
  assert.deepEqual(r.lineas.map(estadoLocal), ["aceptado_con_errores", "aceptado", "rechazado"]);
  assert.equal(r.lineas[0].refExterna, "OM-7");
  assert.equal(r.lineas[2].descripcionError, "NIF & otro");
  const fault = parsearRespuesta('<s:Envelope xmlns:s="x"><s:Body><s:Fault><faultcode>s:Client</faultcode><faultstring>Codigo[4102]. Esquema</faultstring></s:Fault></s:Body></s:Envelope>');
  assert.equal(fault.codigoFault, "4102");
});

test("el lote respeta el orden y no repite factura y operación en el mismo envío", () => {
  const pendientes = [
    { id: 1, num_serie: "F-1", tipo_registro: "alta" },
    { id: 2, num_serie: "F-2", tipo_registro: "alta" },
    { id: 3, num_serie: "F-1", tipo_registro: "anulacion" },
    { id: 4, num_serie: "F-1", tipo_registro: "alta" },
    { id: 5, num_serie: "F-3", tipo_registro: "alta" }
  ];
  assert.deepEqual(elegirLote(pendientes).map((r) => r.id), [1, 2, 3]);
  assert.deepEqual(elegirLote(pendientes, 2).map((r) => r.id), [1, 2]);
});

test("IVA de obra: ISP, 10 % de vivienda, 10 % de reforma y 21 %", () => {
  const isp = calcularFiscalidadObra({ tipoObra: "obra_nueva", clienteTipo: "empresa", relacion: "promotor", destinoVivienda: true });
  assert.equal(isp.isp, true);
  assert.equal(isp.ivaPct, 10);
  const sub = calcularFiscalidadObra({ tipoObra: "rehabilitacion", clienteTipo: "empresa", relacion: "contratista" });
  assert.equal(sub.isp, true);
  assert.equal(sub.ivaPct, 21);
  const autopromotor = calcularFiscalidadObra({ tipoObra: "obra_nueva", clienteTipo: "particular", relacion: "promotor", destinoVivienda: true });
  assert.deepEqual([autopromotor.isp, autopromotor.ivaPct], [false, 10]);
  const reforma = calcularFiscalidadObra({ tipoObra: "reforma_vivienda", clienteTipo: "particular", usoParticular: true, antiguedadMas2Anos: true, materialesPct: 35 });
  assert.equal(reforma.ivaPct, 10);
  assert.ok(reforma.documentos.length);
  const muchosMateriales = calcularFiscalidadObra({ tipoObra: "reforma_vivienda", clienteTipo: "particular", usoParticular: true, antiguedadMas2Anos: true, materialesPct: 55 });
  assert.equal(muchosMateriales.ivaPct, 21);
  assert.match(muchosMateriales.avisos[0], /40 %/);
  const local = calcularFiscalidadObra({ tipoObra: "reforma_vivienda", clienteTipo: "empresa" });
  assert.deepEqual([local.isp, local.ivaPct], [false, 21]);
  const modulos = calcularFiscalidadObra({ tipoObra: "otra", clienteTipo: "empresa", emisorAutonomo: true, regimenIrpfEmisor: "objetiva" });
  assert.equal(modulos.irpfPct, 1);
});

test("libro registro y resumen: anuladas no suman, sustitución suma la diferencia, ISP aparte", () => {
  const facturas = [
    { ...ORIGINAL, cuota_irpf: "0", irpf_pct: "0", importe_total: "1210.00" },
    { ...SUSTITUTIVA, cuota_irpf: "0", irpf_pct: "0", importe_total: "1089.00" },
    { ...ISP, cuota_irpf: "50.00", irpf_pct: "1", importe_total: "5000.00", anulada: true },
    { ...ISP, id: "a4", num_serie: "PRUEBA-F-2026-00003", cuota_irpf: "30.00", irpf_pct: "1", base_imponible: "3000.00", importe_total: "3000.00", cliente_nombre: "=HYPERLINK()" }
  ];
  const r = resumenTrimestral(facturas);
  assert.equal(r.facturas, 3);
  assert.equal(r.anuladas, 1);
  assert.deepEqual(r.tipos, [{ tipoPct: 21, base: 900, cuota: 189 }]);
  assert.equal(r.baseInversionSujetoPasivo, 3000);
  assert.equal(r.retencionesIrpf, 30);
  const csv = libroExpedidasCsv(facturas, { numeros: new Map([["a1", "PRUEBA-F-2026-00001"]]) });
  const lineas = csv.trim().split("\r\n");
  assert.equal(lineas.length, 5);
  assert.match(lineas[2], /;R1;S;PRUEBA-F-2026-00001;/);
  assert.match(lineas[4], /;'=HYPERLINK\(\);/);
});

test("Facturae: rectificativa por sustitución y datos que faltan", () => {
  const empresa = { nif: "B12345674", razon_social: "Obras SL", domicilio: "C/ Mayor 1", codigo_postal: "28001", municipio: "Madrid", provincia: "Madrid" };
  const cliente = { cliente_direccion: "C/ Uno", cliente_codigo_postal: "28002", cliente_municipio: "Madrid", cliente_provincia: "Madrid", liquido: "1089.00", cuota_irpf: "0", rectificacion_causa: "Medición" };
  const xml = generarFacturae({ factura: { ...SUSTITUTIVA, ...cliente }, empresa, original: ORIGINAL, textoIsp: "" });
  assert.match(xml, /<InvoiceClass>OR<\/InvoiceClass><Corrective><InvoiceNumber>00001<\/InvoiceNumber><InvoiceSeriesCode>PRUEBA-F-2026<\/InvoiceSeriesCode>/);
  assert.match(xml, /<CorrectionMethod>01<\/CorrectionMethod>/);
  assert.match(xml, /<PersonTypeCode>J<\/PersonTypeCode>.*<PersonTypeCode>F<\/PersonTypeCode>/);
  assert.match(xml, /<Individual><Name>Cliente<\/Name><FirstSurname>&amp;<\/FirstSurname><SecondSurname>Hijos<\/SecondSurname>/);
  assert.throws(() => generarFacturae({ factura: { ...ORIGINAL, ...cliente, cliente_codigo_postal: "" }, empresa }), /código postal/);
});

test("certificados: cifrado autenticado ligado a la empresa y archivo no válido", () => {
  process.env.CERT_ENCRYPTION_KEY = "clave-de-pruebas-de-al-menos-32-caracteres!!";
  const texto = cifrar(Buffer.from("secreto"), "pfx:empresa-1");
  assert.equal(descifrar(texto, "pfx:empresa-1").toString(), "secreto");
  assert.throws(() => descifrar(texto, "pfx:empresa-2"));
  assert.throws(() => inspeccionarPfx(Buffer.from("no es un pfx"), "x"), /certificado|contraseña/);
});
