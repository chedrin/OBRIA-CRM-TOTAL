import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Download, RotateCw } from 'lucide-react';
import { GROSOR_MURO, centroide, limitesPlano, murosParaVolumen } from '../../utils/croquisPlano';

// Alturas de carpintería (m): puertas y dinteles a 2,10; antepecho de ventanas a 0,90.
const DINTEL = 2.1;
const ANTEPECHO = 0.9;
const btnCls = 'px-2.5 py-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-lg text-[11px] font-bold border border-slate-300 flex items-center gap-1.5 shadow-sm';

// Etiqueta con el nombre de la estancia (siempre mirando a la cámara).
function etiqueta(textoEtiqueta) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fuente = 44;
  ctx.font = `bold ${fuente}px Helvetica, Arial, sans-serif`;
  canvas.width = Math.ceil(ctx.measureText(textoEtiqueta).width) + 32;
  canvas.height = fuente + 24;
  ctx.font = `bold ${fuente}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1e293b';
  ctx.textBaseline = 'middle';
  ctx.fillText(textoEtiqueta, 16, canvas.height / 2);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, depthTest: false }));
  const alto = 0.32;
  sprite.scale.set((alto * canvas.width) / canvas.height, alto, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** Construye el volumen: suelos con el color de cada estancia y muros extruidos con sus huecos. */
function construirVolumen(plan) {
  const grupo = new THREE.Group();
  const matMuro = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85 });
  const matBorde = new THREE.LineBasicMaterial({ color: 0x334155 });
  const matVidrio = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.35, roughness: 0.1 });

  plan.rooms.forEach(room => {
    const forma = new THREE.Shape(room.points.map(([x, y]) => new THREE.Vector2(x, -y)));
    const suelo = new THREE.Mesh(
      new THREE.ShapeGeometry(forma),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(room.color || '#f8fafc'), side: THREE.DoubleSide, roughness: 0.9 })
    );
    suelo.rotation.x = -Math.PI / 2;
    grupo.add(suelo);
    const [cx, cy] = centroide(room.points);
    const nombre = etiqueta(room.name);
    nombre.position.set(cx, 0.35, cy);
    grupo.add(nombre);
  });

  // Prisma de muro entre las distancias s0 y s1 (m) a lo largo del muro, de y0 a y1 de altura.
  const prisma = (muro, s0, s1, y0, y1, material = matMuro) => {
    const largo = s1 - s0, alto = y1 - y0;
    if (largo < 0.01 || alto < 0.01) return;
    const [ax, ay] = muro.a, [bx, by] = muro.b;
    const L = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / L, uy = (by - ay) / L;
    const m = (s0 + s1) / 2;
    const geo = new THREE.BoxGeometry(largo, alto, material === matVidrio ? 0.02 : GROSOR_MURO);
    const malla = new THREE.Mesh(geo, material);
    malla.position.set(ax + ux * m, y0 + alto / 2, ay + uy * m);
    malla.rotation.y = -Math.atan2(uy, ux);
    grupo.add(malla);
    if (material === matMuro) {
      const bordes = new THREE.LineSegments(new THREE.EdgesGeometry(geo), matBorde);
      bordes.position.copy(malla.position);
      bordes.rotation.copy(malla.rotation);
      grupo.add(bordes);
    }
  };

  murosParaVolumen(plan).forEach(muro => {
    const L = Math.hypot(muro.b[0] - muro.a[0], muro.b[1] - muro.a[1]);
    const huecos = muro.huecos
      .map(h => ({ ...h, desde: Math.max(0, h.desde), hasta: Math.min(L, h.hasta) }))
      .filter(h => h.hasta > h.desde)
      .sort((p, q) => p.desde - q.desde);
    let cursor = 0;
    huecos.forEach(h => {
      prisma(muro, cursor, Math.max(cursor, h.desde), 0, muro.alto);
      const desde = Math.max(cursor, h.desde);
      prisma(muro, desde, h.hasta, DINTEL, muro.alto); // dintel
      if (h.type === 'window') {
        prisma(muro, desde, h.hasta, 0, ANTEPECHO); // antepecho
        prisma(muro, desde, h.hasta, ANTEPECHO, DINTEL, matVidrio);
      } else if (h.type === 'sliding_door') {
        prisma(muro, desde, h.hasta, 0, DINTEL, matVidrio);
      }
      cursor = Math.max(cursor, h.hasta);
    });
    prisma(muro, cursor, L, 0, muro.alto);
  });
  return grupo;
}

function liberar(objeto) {
  objeto.traverse(o => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.filter(Boolean).forEach(m => { m.map?.dispose?.(); m.dispose?.(); });
  });
}

/** Vista 3D del croquis (solo lectura): girar arrastrando, rueda para acercar, botón derecho para desplazar. */
export default function Croquis3D({ plan, nombreArchivo = 'Croquis3D' }) {
  const contenedor = useRef(null);
  const motor = useRef(null);

  useEffect(() => {
    const el = contenedor.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 2.2));
    const sol = new THREE.DirectionalLight(0xffffff, 1.4);
    sol.position.set(12, 25, 8);
    scene.add(sol);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    const ajustarTamano = () => {
      const w = el.clientWidth || 600, h = el.clientHeight || 400;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(ajustarTamano);
    ro.observe(el);
    ajustarTamano();

    let frame;
    const animar = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animar);
    };
    animar();
    motor.current = { renderer, scene, camera, controls, grupo: null };

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      if (motor.current?.grupo) liberar(motor.current.grupo);
      renderer.dispose();
      renderer.domElement.remove();
      motor.current = null;
    };
  }, []);

  const encuadrar = (cenital = false) => {
    const m = motor.current;
    if (!m) return;
    const b = limitesPlano(plan);
    const cx = (b.minX + b.maxX) / 2, cz = (b.minY + b.maxY) / 2;
    const tam = Math.max(4, b.maxX - b.minX, b.maxY - b.minY);
    m.controls.target.set(cx, 0, cz);
    if (cenital) m.camera.position.set(cx, tam * 1.6, cz + 0.01);
    else m.camera.position.set(cx + tam * 0.7, tam * 1.15, cz + tam * 1.35);
    m.controls.update();
  };

  // El volumen se rehace con cada cambio del plano; la cámara solo se encuadra la primera vez.
  const primeraVez = useRef(true);
  useEffect(() => {
    const m = motor.current;
    if (!m) return;
    if (m.grupo) {
      m.scene.remove(m.grupo);
      liberar(m.grupo);
    }
    m.grupo = construirVolumen(plan);
    m.scene.add(m.grupo);
    if (primeraVez.current) {
      encuadrar();
      primeraVez.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const descargar = () => {
    const m = motor.current;
    if (!m) return;
    m.renderer.render(m.scene, m.camera);
    const a = document.createElement('a');
    a.href = m.renderer.domElement.toDataURL('image/png');
    a.download = `${nombreArchivo}.png`;
    a.click();
  };

  return (
    <div className="relative w-full rounded-lg overflow-hidden" style={{ height: 'max(380px, 62vh)', background: '#f1f5f9' }}>
      <div ref={contenedor} className="absolute inset-0" aria-label="Vista 3D del croquis" role="img" />
      <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
        <button onClick={() => encuadrar(false)} className={btnCls}><RotateCw className="w-3.5 h-3.5" />Vista 3/4</button>
        <button onClick={() => encuadrar(true)} className={btnCls}>Vista cenital</button>
        <button onClick={descargar} className={btnCls}><Download className="w-3.5 h-3.5" />Descargar imagen</button>
      </div>
      <p className="absolute bottom-2 left-2 right-2 text-[11px] text-slate-600 bg-white/80 rounded-md px-2 py-1 w-fit">
        Arrastra para girar · rueda o pellizco para acercar · botón derecho o dos dedos para desplazar. Muros de 12 cm, puertas a 2,10 m y ventanas con antepecho de 0,90 m.
      </p>
    </div>
  );
}
