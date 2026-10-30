/**
 * ObraMaster - PDF del croquis 2D (A4 apaisado, vectorial).
 *
 * El plano se dibuja con primitivas de jsPDF (líneas, rectángulos y texto), no como imagen:
 * se imprime nítido a cualquier resolución (equivale a más de 300 ppp) y pesa pocos KB.
 * Usa las mismas formas que el editor (src/utils/croquisPlano.js) y el membrete del PDF del presupuesto.
 */
import jsPDF from 'jspdf';
import { describeDocument } from './documentPdf';
import {
  GROSOR_MURO,
  formasHueco,
  formasCota,
  cotasEstancia,
  cotasGenerales,
  limitesPlano,
  resumenSuperficies,
  formatoM2,
  areaConSigno,
  centroide,
  esRectangulo
} from './croquisPlano';

const ESCALAS = [20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000];
const PAGINA = { w: 297, h: 210 };
const MARCO = { x: 10, y: 40, w: 192, h: 156 };
const PANEL = { x: 207, w: 80 };
const PT_POR_MM = 2.835;

const rgb = (hex, def = [248, 250, 252]) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : def;
};

/** Escala normalizada más grande con la que el dibujo cabe en el marco. */
export function escalaParaPlano(anchoM, altoM, anchoMm, altoMm) {
  for (const n of ESCALAS) {
    const k = 1000 / n;
    if (anchoM * k <= anchoMm && altoM * k <= altoMm) return n;
  }
  return ESCALAS[ESCALAS.length - 1];
}

/**
 * Crea el PDF del croquis.
 * `cabecera`: { titulo, numero, fecha, cliente, nif, obraTitulo, direccion }.
 */
export function buildCroquisPdf({ plan, cabecera = {}, empresaConfig = {} }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const { emisorNombre, emisorNif, emisorDireccion } = describeDocument({ type: 'presupuesto', data: {}, empresaConfig });

  // --- Membrete: empresa a la izquierda, datos del presupuesto y del cliente a la derecha ---
  let xEmisor = 10;
  const logo = empresaConfig?.logoUrl || '';
  if (/^data:image\/(png|jpe?g)/i.test(logo)) {
    try {
      doc.addImage(logo, logo.includes('png') ? 'PNG' : 'JPEG', 10, 10, 22, 22, undefined, 'FAST');
      xEmisor = 36;
    } catch { /* logo no válido: se omite */ }
  }
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(emisorNombre || 'ObraMaster', xEmisor, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  if (emisorNif) doc.text(`NIF: ${emisorNif}`, xEmisor, 21);
  if (emisorDireccion) doc.text(doc.splitTextToSize(emisorDireccion, 95).slice(0, 2), xEmisor, 25.5);

  const xd = PAGINA.w - 10;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(cabecera.titulo || 'CROQUIS DE DISTRIBUCIÓN', xd, 15, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const filas = [
    [cabecera.numero ? `Presupuesto ${cabecera.numero}` : '', cabecera.fecha ? `Fecha: ${cabecera.fecha}` : ''].filter(Boolean).join('  ·  '),
    [cabecera.cliente ? `Cliente: ${cabecera.cliente}` : '', cabecera.nif ? `NIF/CIF: ${cabecera.nif}` : ''].filter(Boolean).join('  ·  '),
    cabecera.obraTitulo ? `Obra: ${cabecera.obraTitulo}` : '',
    cabecera.direccion ? `Dirección: ${cabecera.direccion}` : ''
  ].filter(Boolean);
  filas.forEach((f, i) => doc.text(doc.splitTextToSize(f, 150)[0], xd, 20.5 + i * 4.2, { align: 'right' }));
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(10, 36, PAGINA.w - 10, 36);

  // --- Marco del plano ---
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.5);
  doc.rect(MARCO.x, MARCO.y, MARCO.w, MARCO.h, 'S');

  const b = limitesPlano(plan);
  // Espacio para las cotas generales (arriba e izquierda) y un pequeño margen.
  const minX = b.minX - 1.0, minY = b.minY - 1.0, maxX = b.maxX + 0.4, maxY = b.maxY + 0.4;
  const util = { w: MARCO.w - 16, h: MARCO.h - 24 };
  const n = escalaParaPlano(Math.max(1, maxX - minX), Math.max(1, maxY - minY), util.w, util.h);
  const k = 1000 / n; // mm de papel por metro
  const ox = MARCO.x + (MARCO.w - (maxX - minX) * k) / 2;
  const oy = MARCO.y + 10 + (util.h - (maxY - minY) * k) / 2;
  const T = ([x, y]) => [ox + (x - minX) * k, oy + (y - minY) * k];
  const linea = (p, q) => { const a = T(p), c = T(q); doc.line(a[0], a[1], c[0], c[1]); };
  // Polígono cerrado (estancias de cualquier forma y cortes de muro inclinados).
  const poligono = (pts, estilo) => {
    const [x0, y0] = T(pts[0]);
    const deltas = pts.slice(1).map((p, i) => { const a = T(pts[i]), b = T(p); return [b[0] - a[0], b[1] - a[1]]; });
    doc.lines(deltas, x0, y0, [1, 1], estilo, true);
  };
  const fuentePt = (metros, min, max) => Math.max(min, Math.min(max, metros * k * PT_POR_MM));

  // Texto centrado en un punto y girado (ángulo del editor: horario, con y hacia abajo).
  const textoGirado = (str, [x, y], anguloEditor = 0) => {
    const ancho = doc.getTextWidth(str);
    const rad = (anguloEditor * Math.PI) / 180;
    const [px, py] = T([x, y]);
    doc.text(str, px - Math.cos(rad) * ancho / 2, py - Math.sin(rad) * ancho / 2, { angle: -anguloEditor });
  };

  // Suelo (con trama de 50 cm en las estancias rectangulares)
  plan.rooms.forEach(r => {
    doc.setFillColor(...rgb(r.color));
    poligono(r.points, 'F');
    if (!esRectangulo(r)) return;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.08);
    for (let gx = 0.5; gx < r.width; gx += 0.5) linea([r.x + gx, r.y], [r.x + gx, r.y + r.height]);
    for (let gy = 0.5; gy < r.height; gy += 0.5) linea([r.x, r.y + gy], [r.x + r.width, r.y + gy]);
  });

  // Muros
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(Math.max(0.5, GROSOR_MURO * k));
  doc.setLineJoin('miter');
  plan.rooms.forEach(r => poligono(r.points, 'S'));

  // Huecos: corte del muro + símbolo
  plan.openings.forEach(op => {
    const room = plan.rooms.find(r => r.id === op.roomId);
    if (!room) return;
    const f = formasHueco(room, op);
    doc.setFillColor(255, 255, 255);
    poligono(f.hueco, 'F');
    doc.setDrawColor(30, 41, 59);
    f.lineas.forEach((l, i) => { doc.setLineWidth(op.type === 'door' && i === 2 ? 0.35 : 0.18); linea(l[0], l[1]); });
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.15);
    doc.setLineDashPattern([0.8, 0.6], 0);
    f.discontinuas.forEach(pl => pl.slice(1).forEach((p, i) => linea(pl[i], p)));
    doc.setLineDashPattern([], 0);
  });

  // Nombres y superficies
  plan.rooms.forEach(r => {
    const fs = Math.max(0.16, Math.min(0.32, Math.min(r.width, r.height) / 9));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fuentePt(fs, 5, 10));
    doc.setTextColor(30, 41, 59);
    const [cx, cy] = centroide(r.points);
    textoGirado(r.name, [cx, cy - fs * 0.2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fuentePt(fs * 0.85, 4.5, 8.5));
    doc.setTextColor(100, 116, 139);
    textoGirado(formatoM2(Math.abs(areaConSigno(r.points))), [cx, cy + fs * 1.05]);
  });

  // Cotas
  const dibujarCota = (c, color, fuenteM) => {
    if (!c) return;
    doc.setDrawColor(...color);
    doc.setLineWidth(0.15);
    linea(c.linea[0], c.linea[1]);
    c.referencias.forEach(r => linea(r[0], r[1]));
    doc.setLineWidth(0.3);
    c.marcas.forEach(m => linea(m[0], m[1]));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fuentePt(fuenteM, 4.5, 7.5));
    doc.setTextColor(...color);
    textoGirado(c.texto.valor, [c.texto.x, c.texto.y], c.texto.angulo);
  };
  plan.rooms.forEach(r => cotasEstancia(r).forEach(c => dibujarCota(c, [15, 118, 110], 0.17)));
  cotasGenerales(plan).forEach(c => dibujarCota(c, [30, 41, 59], 0.22));
  plan.dimensions.forEach(d => dibujarCota(formasCota(d.x1, d.y1, d.x2, d.y2, d.offset), [15, 118, 110], 0.2));

  // Textos libres
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(30, 41, 59);
  plan.labels.forEach(l => {
    doc.setFontSize(fuentePt(l.size || 0.25, 5, 12));
    textoGirado(l.text, [l.x, l.y], l.rotation || 0);
  });
  doc.setFont('helvetica', 'normal');

  // Escala gráfica (abajo a la izquierda)
  const largos = [0.5, 1, 2, 5, 10, 20, 50];
  const L = largos.filter(v => v * k <= 55).pop() || 0.5;
  const ex = MARCO.x + 6, ey = MARCO.y + MARCO.h - 9;
  const tramo = (L * k) / 5;
  doc.setLineWidth(0.2);
  doc.setDrawColor(30, 41, 59);
  for (let i = 0; i < 5; i++) {
    if (i % 2 === 0) doc.setFillColor(30, 41, 59); else doc.setFillColor(255, 255, 255);
    doc.rect(ex + i * tramo, ey, tramo, 1.6, 'FD');
  }
  doc.setFontSize(6.5);
  doc.setTextColor(30, 41, 59);
  doc.text('0', ex, ey + 4.6, { align: 'center' });
  doc.text(`${String(L).replace('.', ',')} m`, ex + L * k, ey + 4.6, { align: 'center' });
  doc.setFontSize(7.5);
  doc.text(`Escala aprox. 1:${n} (impreso en A4 al 100 %)`, ex, ey - 2);

  // Norte (arriba a la derecha)
  const nx = MARCO.x + MARCO.w - 12, ny = MARCO.y + 13;
  doc.setLineWidth(0.25);
  doc.circle(nx, ny, 5.5, 'S');
  doc.setFillColor(30, 41, 59);
  doc.triangle(nx, ny - 5, nx - 2.2, ny + 3, nx, ny + 1.4, 'F');
  doc.setFillColor(255, 255, 255);
  doc.triangle(nx, ny - 5, nx + 2.2, ny + 3, nx, ny + 1.4, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('N', nx, ny - 6.8, { align: 'center' });

  // --- Panel lateral: leyenda, superficies y observaciones ---
  let y = MARCO.y + 4;
  const titulo = (t) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(t, PANEL.x, y);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(PANEL.x, y + 1.3, PANEL.x + PANEL.w, y + 1.3);
    y += 5.5;
  };

  titulo('LEYENDA');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const sx = PANEL.x + 2, tx = PANEL.x + 16;
  const fila = (texto, dibujo) => { doc.setDrawColor(30, 41, 59); dibujo(y - 1.2); doc.setTextColor(51, 65, 85); doc.text(texto, tx, y); y += 5.2; };
  fila('Muro / tabique', (cy) => { doc.setLineWidth(1.2); doc.line(sx, cy, sx + 10, cy); });
  fila('Puerta abatible', (cy) => {
    doc.setLineWidth(0.3); doc.line(sx, cy + 1.5, sx, cy - 2.5);
    doc.setLineWidth(0.15); doc.setLineDashPattern([0.6, 0.5], 0);
    for (let i = 0; i < 8; i++) {
      const a1 = (Math.PI / 2) * (i / 8), a2 = (Math.PI / 2) * ((i + 1) / 8);
      doc.line(sx + 4 * Math.sin(a1), cy + 1.5 - 4 * Math.cos(a1), sx + 4 * Math.sin(a2), cy + 1.5 - 4 * Math.cos(a2));
    }
    doc.setLineDashPattern([], 0);
  });
  fila('Ventana', (cy) => { doc.setLineWidth(0.18); [-0.8, -0.25, 0.25, 0.8].forEach(d => doc.line(sx, cy + d, sx + 10, cy + d)); });
  fila('Puerta corredera', (cy) => { doc.setLineWidth(0.25); doc.line(sx, cy - 0.5, sx + 6, cy - 0.5); doc.line(sx + 4, cy + 0.5, sx + 10, cy + 0.5); });
  fila('Cota (m)', (cy) => {
    doc.setDrawColor(15, 118, 110); doc.setLineWidth(0.15); doc.line(sx, cy, sx + 10, cy);
    doc.setLineWidth(0.3); doc.line(sx - 0.7, cy + 0.7, sx + 0.7, cy - 0.7); doc.line(sx + 9.3, cy + 0.7, sx + 10.7, cy - 0.7);
  });

  y += 2;
  titulo('SUPERFICIES ÚTILES');
  const sup = resumenSuperficies(plan);
  const tamFila = sup.estancias.length > 14 ? 3.4 : 4.2;
  doc.setFontSize(sup.estancias.length > 14 ? 6.5 : 7.5);
  doc.setFont('helvetica', 'normal');
  sup.estancias.forEach((e, i) => {
    if (y > MARCO.y + MARCO.h - 30) return;
    if (i % 2 === 0) { doc.setFillColor(241, 245, 249); doc.rect(PANEL.x, y - tamFila + 1, PANEL.w, tamFila, 'F'); }
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(e.nombre, 55)[0], PANEL.x + 1.5, y);
    doc.text(formatoM2(e.area), PANEL.x + PANEL.w - 1.5, y, { align: 'right' });
    y += tamFila;
  });
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.3);
  doc.line(PANEL.x, y - 2, PANEL.x + PANEL.w, y - 2);
  y += 1.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Total superficie útil', PANEL.x + 1.5, y);
  doc.text(formatoM2(sup.util), PANEL.x + PANEL.w - 1.5, y, { align: 'right' });
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.text('Construida aprox.*', PANEL.x + 1.5, y);
  doc.text(formatoM2(sup.construida), PANEL.x + PANEL.w - 1.5, y, { align: 'right' });
  y += 4;
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('* Útil más la parte proporcional de muros de 15 cm.', PANEL.x + 1.5, y);
  y += 6;

  const notas = (plan.notes || []).filter(Boolean);
  if (notas.length && y < MARCO.y + MARCO.h - 12) {
    titulo('OBSERVACIONES');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    for (const nota of notas) {
      const lineas = doc.splitTextToSize(`• ${nota}`, PANEL.w - 2);
      if (y + lineas.length * 3 > MARCO.y + MARCO.h) break;
      doc.text(lineas, PANEL.x + 1, y);
      y += lineas.length * 3 + 1;
    }
  }

  // Pie
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Croquis orientativo elaborado a partir de las mediciones tomadas en obra. No sustituye al plano de proyecto ni a la medición definitiva.', 10, 203);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, PAGINA.w - 10, 203, { align: 'right' });

  return doc;
}
