import React, { useRef } from 'react';
import {
  PX_POR_METRO as PX,
  GROSOR_MURO,
  formasHueco,
  formasCota,
  cotasEstancia,
  cotasGenerales,
  muroMasCercano,
  ratioQueCabe,
  largoMuro,
  formatoM2,
  redondear
} from '../../utils/croquisPlano';

// Colores fijos de plano técnico (no dependen del tema claro/oscuro de la app).
const TINTA = '#1e293b';
const TINTA_SUAVE = '#64748b';
const COTA = '#0f766e';
const SELECCION = '#f59e0b';
const MIN_LADO = 0.5;
const IMAN = 0.15; // m: distancia a la que un borde se pega al de otra estancia

const px = (m) => redondear(m * PX, 2);
const puntos = (lista) => lista.map(([x, y]) => `${px(x)},${px(y)}`).join(' ');
const ASAS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Ajusta los huecos de una estancia tras cambiar su tamaño (siguen cabiendo en su muro). */
export function reajustarHuecos(plan, roomId) {
  const room = plan.rooms.find(r => r.id === roomId);
  if (!room) return plan;
  return {
    ...plan,
    openings: plan.openings.map(o => {
      if (o.roomId !== roomId) return o;
      const widthMeters = Math.min(o.widthMeters, Math.max(0.4, largoMuro(room, o.wall) - 0.1));
      return { ...o, widthMeters, positionRatio: ratioQueCabe(room, o.wall, o.positionRatio, widthMeters) };
    })
  };
}

function Cota({ forma, color = COTA, fuente = 0.2 }) {
  if (!forma) return null;
  const { linea, referencias, marcas, texto } = forma;
  return (
    <g stroke={color} fill="none" pointerEvents="none">
      <line x1={px(linea[0][0])} y1={px(linea[0][1])} x2={px(linea[1][0])} y2={px(linea[1][1])} strokeWidth={0.8} />
      {referencias.map((r, i) => <line key={`r${i}`} x1={px(r[0][0])} y1={px(r[0][1])} x2={px(r[1][0])} y2={px(r[1][1])} strokeWidth={0.6} />)}
      {marcas.map((m, i) => <line key={`m${i}`} x1={px(m[0][0])} y1={px(m[0][1])} x2={px(m[1][0])} y2={px(m[1][1])} strokeWidth={1.4} />)}
      <text
        x={px(texto.x)} y={px(texto.y)}
        transform={`rotate(${texto.angulo} ${px(texto.x)} ${px(texto.y)})`}
        fill={color} stroke="none" fontSize={px(fuente)} textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif"
      >
        {texto.valor}
      </text>
    </g>
  );
}

/**
 * Lienzo SVG del croquis. Coordenadas en metros (1 m = 50 px del SVG; el zoom solo cambia el tamaño en pantalla).
 * - onPreview(plan): cambio en curso (arrastre), sin historial.
 * - onCommit(planAntes): fin del arrastre; el editor guarda `planAntes` para deshacer.
 * - onSoltar(tipo, x, y): un elemento de la paleta soltado en el lienzo.
 */
export default function CroquisLienzo({
  plan,
  seleccion = null,
  onSeleccion = () => {},
  onPreview = () => {},
  onCommit = () => {},
  onSoltar = () => {},
  soloLectura = false,
  paso = 0.05,
  mostrarCotas = true,
  zoom = 1,
  svgRef: svgRefExterno
}) {
  const svgRefInterno = useRef(null);
  const svgRef = svgRefExterno || svgRefInterno;
  const arrastre = useRef(null);
  const W = plan.canvas.widthMeters;
  const H = plan.canvas.heightMeters;
  const margen = 1.5;

  const aMetros = (e) => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x / PX, p.y / PX];
  };
  const ajustar = (v) => (paso ? redondear(Math.round(v / paso) * paso, 3) : redondear(v, 3));

  // Pega un valor al borde más cercano de otra estancia si está a menos de IMAN.
  const imantar = (valor, candidatos) => {
    let mejor = null;
    candidatos.forEach(c => { if (Math.abs(c - valor) <= IMAN && (mejor === null || Math.abs(c - valor) < Math.abs(mejor - valor))) mejor = c; });
    return mejor;
  };
  const bordes = (excluir) => {
    const otras = plan.rooms.filter(r => r.id !== excluir);
    return { xs: otras.flatMap(r => [r.x, r.x + r.width]), ys: otras.flatMap(r => [r.y, r.y + r.height]) };
  };

  const empezar = (e, datos) => {
    if (soloLectura) return;
    e.stopPropagation();
    e.preventDefault();
    svgRef.current?.setPointerCapture?.(e.pointerId);
    arrastre.current = { ...datos, inicio: aMetros(e), planAntes: plan, movido: false };
    onSeleccion(datos.seleccion);
  };

  const mover = (e) => {
    const d = arrastre.current;
    if (!d) return;
    const [mx, my] = aMetros(e);
    const dx = mx - d.inicio[0];
    const dy = my - d.inicio[1];
    if (!d.movido && Math.hypot(dx, dy) < 0.02) return;
    d.movido = true;
    const base = d.planAntes;
    let nuevo = base;

    if (d.tipo === 'room') {
      const o = d.original;
      const { xs, ys } = bordes(o.id);
      let x = ajustar(o.x + dx), y = ajustar(o.y + dy);
      const ix = imantar(x, xs), ixd = imantar(x + o.width, xs);
      if (ix !== null) x = ix; else if (ixd !== null) x = redondear(ixd - o.width, 3);
      const iy = imantar(y, ys), iyd = imantar(y + o.height, ys);
      if (iy !== null) y = iy; else if (iyd !== null) y = redondear(iyd - o.height, 3);
      nuevo = { ...base, rooms: base.rooms.map(r => (r.id === o.id ? { ...r, x, y } : r)) };
      // Los textos y cotas no van unidos a la estancia; los huecos sí (se dibujan desde ella).
    } else if (d.tipo === 'asa') {
      const o = d.original;
      const { xs, ys } = bordes(o.id);
      const borde = (v, lista) => { const a = ajustar(v); const i = imantar(a, lista); return i !== null ? i : a; };
      let left = o.x, right = o.x + o.width, top = o.y, bottom = o.y + o.height;
      if (d.asa.includes('e')) right = Math.max(left + MIN_LADO, borde(right + dx, xs));
      if (d.asa.includes('w')) left = Math.min(right - MIN_LADO, borde(left + dx, xs));
      if (d.asa.includes('s')) bottom = Math.max(top + MIN_LADO, borde(bottom + dy, ys));
      if (d.asa.includes('n')) top = Math.min(bottom - MIN_LADO, borde(top + dy, ys));
      const width = redondear(right - left), height = redondear(bottom - top);
      nuevo = reajustarHuecos({
        ...base,
        rooms: base.rooms.map(r => (r.id === o.id ? { ...r, x: redondear(left, 3), y: redondear(top, 3), width, height, area: redondear(width * height) } : r))
      }, o.id);
    } else if (d.tipo === 'hueco') {
      const muro = muroMasCercano(base, mx, my);
      if (muro) {
        const room = base.rooms.find(r => r.id === muro.roomId);
        nuevo = {
          ...base,
          openings: base.openings.map(op => {
            if (op.id !== d.original.id) return op;
            const widthMeters = Math.min(op.widthMeters, Math.max(0.4, largoMuro(room, muro.wall) - 0.1));
            const L = largoMuro(room, muro.wall);
            const ratio = paso ? Math.round((muro.ratio * L) / paso) * paso / L : muro.ratio;
            return { ...op, roomId: room.id, wall: muro.wall, widthMeters, positionRatio: ratioQueCabe(room, muro.wall, ratio, widthMeters) };
          })
        };
      }
    } else if (d.tipo === 'texto') {
      const o = d.original;
      nuevo = { ...base, labels: base.labels.map(l => (l.id === o.id ? { ...l, x: ajustar(o.x + dx), y: ajustar(o.y + dy) } : l)) };
    } else if (d.tipo === 'cota' || d.tipo === 'cotaExtremo') {
      const o = d.original;
      nuevo = {
        ...base,
        dimensions: base.dimensions.map(c => {
          if (c.id !== o.id) return c;
          if (d.tipo === 'cota') return { ...c, x1: ajustar(o.x1 + dx), y1: ajustar(o.y1 + dy), x2: ajustar(o.x2 + dx), y2: ajustar(o.y2 + dy) };
          const k = d.extremo;
          let nx = ajustar(o[`x${k}`] + dx), ny = ajustar(o[`y${k}`] + dy);
          const otro = k === 1 ? 2 : 1;
          // Casi horizontal o vertical: se endereza.
          if (Math.abs(ny - o[`y${otro}`]) < 0.12) ny = o[`y${otro}`];
          if (Math.abs(nx - o[`x${otro}`]) < 0.12) nx = o[`x${otro}`];
          return { ...c, [`x${k}`]: nx, [`y${k}`]: ny };
        })
      };
    }
    onPreview(nuevo);
  };

  const terminar = (e) => {
    const d = arrastre.current;
    arrastre.current = null;
    try { svgRef.current?.releasePointerCapture?.(e.pointerId); } catch { /* ya liberado */ }
    if (d?.movido) onCommit(d.planAntes);
  };

  const soltarPaleta = (e) => {
    e.preventDefault();
    const tipo = e.dataTransfer.getData('application/x-croquis') || e.dataTransfer.getData('text/plain');
    if (!tipo) return;
    const [x, y] = aMetros(e);
    onSoltar(tipo, x, y);
  };

  const roomSel = seleccion?.tipo === 'room' ? plan.rooms.find(r => r.id === seleccion.id) : null;
  const cursorEdicion = soloLectura ? 'default' : 'move';
  const fuenteNombre = (r) => Math.max(0.16, Math.min(0.32, Math.min(r.width, r.height) / 9));

  return (
    <svg
      ref={svgRef}
      viewBox={`${px(-margen)} ${px(-margen)} ${px(W + margen * 2)} ${px(H + margen * 2)}`}
      style={{ width: `${zoom * 100}%`, height: 'auto', touchAction: soloLectura ? 'auto' : 'none', display: 'block', background: '#ffffff' }}
      onPointerMove={mover}
      onPointerUp={terminar}
      onPointerCancel={terminar}
      onPointerDown={() => !soloLectura && onSeleccion(null)}
      onDragOver={(e) => { if (!soloLectura) e.preventDefault(); }}
      onDrop={soloLectura ? undefined : soltarPaleta}
      role="img"
      aria-label="Croquis 2D de la vivienda"
    >
      <defs>
        <pattern id="croquis-cuadricula-fina" width={px(0.25)} height={px(0.25)} patternUnits="userSpaceOnUse">
          <path d={`M ${px(0.25)} 0 L 0 0 0 ${px(0.25)}`} fill="none" stroke="#eef2f7" strokeWidth={0.6} />
        </pattern>
        <pattern id="croquis-cuadricula" width={PX} height={PX} patternUnits="userSpaceOnUse">
          <rect width={PX} height={PX} fill="url(#croquis-cuadricula-fina)" />
          <path d={`M ${PX} 0 L 0 0 0 ${PX}`} fill="none" stroke="#dbe3ec" strokeWidth={0.9} />
        </pattern>
        <pattern id="croquis-trama" width={px(0.2)} height={px(0.2)} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={px(0.2)} stroke="#cbd5e1" strokeWidth={0.5} strokeOpacity={0.45} />
        </pattern>
      </defs>

      {/* Papel y cuadrícula milimetrada (1 m / 25 cm) */}
      <rect x={px(-margen)} y={px(-margen)} width={px(W + margen * 2)} height={px(H + margen * 2)} fill="#ffffff" />
      {!soloLectura && <rect x={0} y={0} width={px(W)} height={px(H)} fill="url(#croquis-cuadricula)" />}

      {/* Estancias: suelo, trama y muros */}
      {plan.rooms.map(r => (
        <g key={r.id} onPointerDown={(e) => empezar(e, { tipo: 'room', original: r, seleccion: { tipo: 'room', id: r.id } })} style={{ cursor: cursorEdicion }}>
          <rect x={px(r.x)} y={px(r.y)} width={px(r.width)} height={px(r.height)} fill={r.color || '#f8fafc'} />
          <rect x={px(r.x)} y={px(r.y)} width={px(r.width)} height={px(r.height)} fill="url(#croquis-trama)" />
        </g>
      ))}
      {plan.rooms.map(r => (
        <rect key={`muro-${r.id}`} x={px(r.x)} y={px(r.y)} width={px(r.width)} height={px(r.height)} fill="none" stroke={TINTA} strokeWidth={px(GROSOR_MURO)} strokeLinejoin="miter" pointerEvents="none" />
      ))}

      {/* Huecos: corte del muro y símbolo normalizado */}
      {plan.openings.map(op => {
        const room = plan.rooms.find(r => r.id === op.roomId);
        if (!room) return null;
        const f = formasHueco(room, op);
        const sel = seleccion?.tipo === 'hueco' && seleccion.id === op.id;
        const [cx, cy] = f.centro;
        const a = f.horizontal ? [cx - op.widthMeters / 2, cy] : [cx, cy - op.widthMeters / 2];
        const b = f.horizontal ? [cx + op.widthMeters / 2, cy] : [cx, cy + op.widthMeters / 2];
        return (
          <g key={op.id}>
            <polygon points={puntos(f.hueco)} fill="#ffffff" />
            {f.lineas.map((l, i) => <line key={i} x1={px(l[0][0])} y1={px(l[0][1])} x2={px(l[1][0])} y2={px(l[1][1])} stroke={sel ? SELECCION : TINTA} strokeWidth={op.type === 'door' && i === 2 ? 1.6 : 1} />)}
            {f.discontinuas.map((d, i) => <polyline key={`d${i}`} points={puntos(d)} fill="none" stroke={sel ? SELECCION : TINTA_SUAVE} strokeWidth={0.8} strokeDasharray="4 3" />)}
            {!soloLectura && (
              <line
                x1={px(a[0])} y1={px(a[1])} x2={px(b[0])} y2={px(b[1])}
                stroke={sel ? SELECCION : 'transparent'} strokeOpacity={sel ? 0.35 : 0} strokeWidth={18}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => empezar(e, { tipo: 'hueco', original: op, seleccion: { tipo: 'hueco', id: op.id } })}
              />
            )}
          </g>
        );
      })}

      {/* Nombre y superficie útil de cada estancia */}
      {plan.rooms.map(r => {
        const fs = fuenteNombre(r);
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        return (
          <g key={`txt-${r.id}`} pointerEvents="none" fontFamily="Helvetica, Arial, sans-serif" textAnchor="middle">
            <text x={px(cx)} y={px(cy - fs * 0.2)} fontSize={px(fs)} fontWeight="700" fill={TINTA}>{r.name}</text>
            <text x={px(cx)} y={px(cy + fs * 1.05)} fontSize={px(fs * 0.85)} fill={TINTA_SUAVE}>{formatoM2(r.width * r.height)}</text>
          </g>
        );
      })}

      {/* Cotas automáticas (se actualizan al mover o redimensionar) */}
      {mostrarCotas && plan.rooms.flatMap(r => cotasEstancia(r).map((c, i) => <Cota key={`ce-${r.id}-${i}`} forma={c} fuente={0.17} />))}
      {mostrarCotas && cotasGenerales(plan).map((c, i) => <Cota key={`cg-${i}`} forma={c} color={TINTA} fuente={0.22} />)}

      {/* Cotas libres */}
      {plan.dimensions.map(c => {
        const forma = formasCota(c.x1, c.y1, c.x2, c.y2, c.offset);
        const sel = seleccion?.tipo === 'cota' && seleccion.id === c.id;
        return (
          <g key={c.id}>
            <Cota forma={forma} color={sel ? SELECCION : COTA} fuente={0.2} />
            {!soloLectura && forma && (
              <line
                x1={px(forma.linea[0][0])} y1={px(forma.linea[0][1])} x2={px(forma.linea[1][0])} y2={px(forma.linea[1][1])}
                stroke="transparent" strokeWidth={14} style={{ cursor: cursorEdicion }}
                onPointerDown={(e) => empezar(e, { tipo: 'cota', original: c, seleccion: { tipo: 'cota', id: c.id } })}
              />
            )}
            {sel && !soloLectura && [1, 2].map(k => (
              <circle
                key={k} cx={px(c[`x${k}`])} cy={px(c[`y${k}`])} r={6} fill="#ffffff" stroke={SELECCION} strokeWidth={2}
                style={{ cursor: 'crosshair' }}
                onPointerDown={(e) => empezar(e, { tipo: 'cotaExtremo', extremo: k, original: c, seleccion: { tipo: 'cota', id: c.id } })}
              />
            ))}
          </g>
        );
      })}

      {/* Textos libres */}
      {plan.labels.map(l => {
        const sel = seleccion?.tipo === 'texto' && seleccion.id === l.id;
        return (
          <text
            key={l.id}
            x={px(l.x)} y={px(l.y)}
            transform={`rotate(${l.rotation || 0} ${px(l.x)} ${px(l.y)})`}
            fontSize={px(l.size || 0.25)} fill={sel ? SELECCION : TINTA} textAnchor="middle" dominantBaseline="middle"
            fontFamily="Helvetica, Arial, sans-serif" fontStyle="italic"
            style={{ cursor: cursorEdicion, userSelect: 'none' }}
            onPointerDown={(e) => empezar(e, { tipo: 'texto', original: l, seleccion: { tipo: 'texto', id: l.id } })}
          >
            {l.text}
          </text>
        );
      })}

      {/* Selección de estancia y asas de redimensionado */}
      {roomSel && !soloLectura && (
        <g>
          <rect x={px(roomSel.x)} y={px(roomSel.y)} width={px(roomSel.width)} height={px(roomSel.height)} fill="none" stroke={SELECCION} strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />
          {ASAS.map(asa => {
            const hx = roomSel.x + (asa.includes('w') ? 0 : asa.includes('e') ? roomSel.width : roomSel.width / 2);
            const hy = roomSel.y + (asa.includes('n') ? 0 : asa.includes('s') ? roomSel.height : roomSel.height / 2);
            const cursor = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' }[asa];
            return (
              <rect
                key={asa} x={px(hx) - 6} y={px(hy) - 6} width={12} height={12} rx={2}
                fill="#ffffff" stroke={SELECCION} strokeWidth={2} style={{ cursor }}
                onPointerDown={(e) => empezar(e, { tipo: 'asa', asa, original: roomSel, seleccion: { tipo: 'room', id: roomSel.id } })}
              />
            );
          })}
        </g>
      )}
    </svg>
  );
}
