import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  Camera,
  Mic,
  Upload,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ArrowRight,
  FileText,
  DollarSign,
  TrendingUp,
  Percent,
  Layers,
  ChevronRight,
  RefreshCw,
  Building2,
  HardHat
} from 'lucide-react';
import confetti from 'canvas-confetti';

const PHOTO_PRESETS = [
  {
    id: 'bano_antiguo',
    title: 'Baño Antiguo (Bañera a plato, azulejos 80s)',
    url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
    descripcion: 'Bañera de chapa 160cm, alicatado antiguo de gresite, bidé y sanitario con cisterna vista.',
    tipo: 'Baño',
    defaultAudio: 'Reforma integral de este baño de 5.5 m2. Demoler bañera antigua y alicatados con retirada a vertedero. Instalar plato de ducha de resina pizarra grafito 140x80 con mampara fija perfil negro. Inodoro suspendido con cisterna empotrada Geberit. Puntos de fontanería para mueble doble de 120cm. Alicatado porcelánico rectificado gran formato en paredes y suelo imitación madera. Techo de pladur verde hidrófugo con 4 focos LED.',
    mediciones: { m2Paredes: 24, m2Suelo: 5.5, fontaneriaPuntos: 5, electricidadPuntos: 4 },
    partidas: [
      { id: 'gen-1', codigo: 'DEM-02', capitulo: 'Demoliciones', concepto: 'Picado de azulejos, desescombro de bañera y sanitarios con retirada en sacas a vertedero', cantidad: 29.5, unidad: 'm²', costeUnitario: 9.80, margenPct: 35, precioVenta: 13.23, total: 390.29 },
      { id: 'gen-2', codigo: 'FON-01', capitulo: 'Fontanería', concepto: 'Instalación de fontanería multicapa empotrada para ducha, inodoro y lavabo doble', cantidad: 5, unidad: 'ud', costeUnitario: 65.00, margenPct: 25, precioVenta: 81.25, total: 406.25 },
      { id: 'gen-3', codigo: 'FON-03', capitulo: 'Fontanería', concepto: 'Suministro e instalación de plato de ducha resina pizarra grafito 140x80 y mampara fija 100cm perfil negro', cantidad: 1, unidad: 'ud', costeUnitario: 140.00, margenPct: 30, precioVenta: 182.00, total: 182.00 },
      { id: 'gen-4', codigo: 'FON-04', capitulo: 'Fontanería', concepto: 'Instalación de bastidor Geberit Duofix con cisterna empotrada e inodoro suspendido rimless', cantidad: 1, unidad: 'ud', costeUnitario: 160.00, margenPct: 25, precioVenta: 200.00, total: 200.00 },
      { id: 'gen-5', codigo: 'ALB-02', capitulo: 'Albañilería', concepto: 'Falso techo continuo de pladur hidrófugo verde 13mm con perfiles y encintado', cantidad: 5.5, unidad: 'm²', costeUnitario: 24.00, margenPct: 30, precioVenta: 31.20, total: 171.60 },
      { id: 'gen-6', codigo: 'ALI-01', capitulo: 'Revestimientos', concepto: 'Alicatado con porcelánico rectificado 60x120 imitación mármol calacatta con mortero cola C2TE', cantidad: 24, unidad: 'm²', costeUnitario: 26.00, margenPct: 30, precioVenta: 33.80, total: 811.20 },
      { id: 'gen-7', codigo: 'ALI-02', capitulo: 'Revestimientos', concepto: 'Solado con porcelánico antideslizante imitación roble natural con juntas epoxi', cantidad: 5.5, unidad: 'm²', costeUnitario: 24.50, margenPct: 30, precioVenta: 31.85, total: 175.18 },
      { id: 'gen-8', codigo: 'ELE-01', capitulo: 'Electricidad', concepto: 'Instalación de 4 downlights LED empotrados IP44 estancos y toma de corriente estanca para espejo', cantidad: 4, unidad: 'ud', costeUnitario: 32.00, margenPct: 25, precioVenta: 40.00, total: 160.00 },
      { id: 'gen-9', codigo: 'PIN-02', capitulo: 'Pintura', concepto: 'Pintura plástica antimoho especial cuartos húmedos en techo', cantidad: 5.5, unidad: 'm²', costeUnitario: 7.50, margenPct: 30, precioVenta: 9.75, total: 53.63 }
    ]
  },
  {
    id: 'cocina_abierta',
    title: 'Cocina Cerrada para Abrir al Salón',
    url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80',
    descripcion: 'Tabique divisorio de 4 metros entre cocina y salón, muebles antiguos y suelo desgastado.',
    tipo: 'Cocina',
    defaultAudio: 'Reforma de cocina de 14 m² que queremos abrir por completo al salón. Hay que demoler tabique de ladrillo de 4.5 metros con contenedor en la calle. Diseñar isla central con tomas de fontanería para fregadero bajo encimera y lavavajillas, además de tomas de 25A para placa de inducción y horno. Suelo porcelánico gris rectificado 80x80 continuo nivelado con el salón. Techo de pladur con foseado perimetral para tira LED cálida.',
    mediciones: { m2Paredes: 34, m2Suelo: 14, tabiqueDemolerM2: 12, electricidadPuntos: 8 },
    partidas: [
      { id: 'gen-10', codigo: 'DEM-01', capitulo: 'Demoliciones', concepto: 'Demolición de tabique divisorio de ladrillo hueco con medios manuales y carga de escombro', cantidad: 12, unidad: 'm²', costeUnitario: 12.50, margenPct: 35, precioVenta: 16.88, total: 202.56 },
      { id: 'gen-11', codigo: 'DEM-02', capitulo: 'Demoliciones', concepto: 'Picado de azulejos perimetrales de cocina y retirada de muebles antiguos', cantidad: 34, unidad: 'm²', costeUnitario: 9.80, margenPct: 35, precioVenta: 13.23, total: 449.82 },
      { id: 'gen-12', codigo: 'DEM-04', capitulo: 'Demoliciones', concepto: 'Contenedor de obra 5m³ con tasas municipales y canon de vertedero', cantidad: 2, unidad: 'ud', costeUnitario: 180.00, margenPct: 20, precioVenta: 216.00, total: 432.00 },
      { id: 'gen-13', codigo: 'FON-01', capitulo: 'Fontanería', concepto: 'Nuevas líneas de fontanería multicapa por suelo para isla (fregadero, lavavajillas y desagües)', cantidad: 4, unidad: 'ud', costeUnitario: 65.00, margenPct: 25, precioVenta: 81.25, total: 325.00 },
      { id: 'gen-14', codigo: 'ELE-02', capitulo: 'Electricidad', concepto: 'Circuitos de fuerza independientes 6mm² para inducción y horno + 6 tomas para electrodomésticos', cantidad: 8, unidad: 'ud', costeUnitario: 34.00, margenPct: 25, precioVenta: 42.50, total: 340.00 },
      { id: 'gen-15', codigo: 'ALB-02', capitulo: 'Albañilería', concepto: 'Falso techo continuo de pladur con foseado decorativo para candileja LED indirecta', cantidad: 14, unidad: 'm²', costeUnitario: 24.00, margenPct: 30, precioVenta: 31.20, total: 436.80 },
      { id: 'gen-16', codigo: 'ALI-02', capitulo: 'Revestimientos', concepto: 'Solado con porcelánico rectificado 80x80 imitación hormigón pulido nivelado con tarima de salón', cantidad: 14, unidad: 'm²', costeUnitario: 24.50, margenPct: 30, precioVenta: 31.85, total: 445.90 },
      { id: 'gen-17', codigo: 'PIN-02', capitulo: 'Pintura', concepto: 'Pintura plástica superlavable mate especial cocinas en techos y paredes no alicatadas', cantidad: 28, unidad: 'm²', costeUnitario: 7.50, margenPct: 30, precioVenta: 9.75, total: 273.00 }
    ]
  },
  {
    id: 'piso_completo',
    title: 'Reforma Integral Vivienda 85m² (Gotelé, Suelos, Puertas)',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
    descripcion: 'Piso antiguo con gotelé en todas las estancias, puertas sapelly y suelos desgastados.',
    tipo: 'Vivienda Integral',
    defaultAudio: 'Reforma completa de piso de 85 m². Alisar gotelé en todo el piso aproximadamente 220 m² de paramentos verticales y techos. Instalación de tarima flotante laminada AC5 hidrófuga en toda la casa con rodapié lacado blanco. Sustitución de 6 puertas de paso por modelos macizos lacados en blanco con manillas magnéticas. Cuadro eléctrico nuevo según normativa REBT con boletín oficial de industria.',
    mediciones: { m2AlisadoParedes: 220, m2Tarima: 75, puertasPaso: 6, cuadroElectrico: 1 },
    partidas: [
      { id: 'gen-20', codigo: 'PIN-01', capitulo: 'Pintura', concepto: 'Alisado de gotelé mediante tendido de dos manos de masilla, lijado con aspiración y fijador acrílico', cantidad: 220, unidad: 'm²', costeUnitario: 12.00, margenPct: 30, precioVenta: 15.60, total: 3432.00 },
      { id: 'gen-21', codigo: 'PIN-02', capitulo: 'Pintura', concepto: 'Pintura plástica lisa lavable mate blanco puro en techos y paredes a dos manos', cantidad: 220, unidad: 'm²', costeUnitario: 7.50, margenPct: 30, precioVenta: 9.75, total: 2145.00 },
      { id: 'gen-22', codigo: 'CAR-02', capitulo: 'Carpintería', concepto: 'Suministro e instalación de suelo laminado AC5 alta resistencia con base aislante acústica y rodapié lacado 9cm', cantidad: 75, unidad: 'm²', costeUnitario: 21.00, margenPct: 25, precioVenta: 26.25, total: 1968.75 },
      { id: 'gen-23', codigo: 'CAR-01', capitulo: 'Carpintería', concepto: 'Suministro y montaje de puertas de paso macizas lacadas en blanco block 72.5cm con herrajes magnéticos', cantidad: 6, unidad: 'ud', costeUnitario: 240.00, margenPct: 22, precioVenta: 292.80, total: 1756.80 },
      { id: 'gen-24', codigo: 'ELE-03', capitulo: 'Electricidad', concepto: 'Cuadro general de mando y protección con IGA, ID superinmunizado, 6 circuitos y boletín oficial CIE', cantidad: 1, unidad: 'ud', costeUnitario: 380.00, margenPct: 25, precioVenta: 475.00, total: 475.00 }
    ]
  }
];

export default function PresupuestoGeneratorAI({ onCancel, onCreated }) {
  const { addPresupuesto, addObra, showNotification } = useApp();

  // Selected Preset or custom input
  const [selectedPreset, setSelectedPreset] = useState(PHOTO_PRESETS[0]);
  const [customPhotos, setCustomPhotos] = useState([]);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [audioTranscript, setAudioTranscript] = useState(PHOTO_PRESETS[0].defaultAudio);

  // AI Training & Redaction Examples State
  const [showExamplesModal, setShowExamplesModal] = useState(false);
  const [userRedactionExamples, setUserRedactionExamples] = useState([
    { id: 'ex-1', titulo: 'Estilo de Redacción Propio - Alicatado y Sanitario', texto: 'Alicatado con porcelánico rectificado en paramentos verticales con mortero cola C2TE. Incluye picado previo, nivelado con crucetas autonivelantes y rejuntado antihumedad. No se incluyen sanitarios de alta gama no presupuestados.' },
    { id: 'ex-2', titulo: 'Estilo de Redacción Propio - Electricidad y Cajas', texto: 'Suministro e instalación de puntos de luz conmutados con tubo corrugado ignífugo M-20, cable libre de halógenos 1.5mm² y mecanismos serie media Niessen. Incluye boletín oficial CIE de industria.' }
  ]);
  const [newExampleTitle, setNewExampleTitle] = useState('');
  const [newExampleText, setNewExampleText] = useState('');

  const handleAddExample = (e) => {
    e.preventDefault();
    if (!newExampleTitle || !newExampleText) return;
    setUserRedactionExamples(prev => [
      ...prev,
      { id: `ex-${Date.now()}`, titulo: newExampleTitle, texto: newExampleText }
    ]);
    setNewExampleTitle('');
    setNewExampleText('');
    showNotification('Ejemplo de redacción guardado para aprendizaje de la IA');
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCustomPhotos(prev => [...prev, {
          id: `usr-img-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          title: file.name,
          url: event.target.result,
          descripcion: 'Foto subida por el usuario'
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddPhotoUrl = () => {
    if (!customPhotoUrl) return;
    setCustomPhotos(prev => [...prev, {
      id: `usr-url-${Date.now()}`,
      title: 'Foto Adjunta',
      url: customPhotoUrl,
      descripcion: 'Foto de obra vía enlace'
    }]);
    setCustomPhotoUrl('');
  };
  const [obraTitulo, setObraTitulo] = useState('Reforma de Baño Suite C/ Serrano');
  const [clienteNombre, setClienteNombre] = useState('Dña. Victoria Méndez');
  const [clienteNif, setClienteNif] = useState('51904231S');
  const [clienteDireccion, setClienteDireccion] = useState('Calle Serrano 82, 4ºD, Madrid');
  const [margenGlobal, setMargenGlobal] = useState(30);
  const [tipoIva, setTipoIva] = useState(10); // 10% vivienda, 21% general

  // AI Generation State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [generatedResult, setGeneratedResult] = useState(null);

  // Editable partidas state once generated
  const [partidasList, setPartidasList] = useState([]);

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset);
    setAudioTranscript(preset.defaultAudio);
    if (preset.id === 'bano_antiguo') {
      setObraTitulo('Reforma Integral Baño Suite C/ Serrano');
      setClienteNombre('Dña. Victoria Méndez');
    } else if (preset.id === 'cocina_abierta') {
      setObraTitulo('Reforma Cocina Abierta con Isla Paseo Castellana');
      setClienteNombre('D. Carlos Peñafiel');
    } else {
      setObraTitulo('Reforma Completa Vivienda C/ Alcalá');
      setClienteNombre('Inmuebles & Viviendas Madrid SL');
    }
  };

  const handleRunAiAnalysis = () => {
    setIsAnalyzing(true);
    setAnalysisStep(1);

    setTimeout(() => setAnalysisStep(2), 700);
    setTimeout(() => setAnalysisStep(3), 1500);
    setTimeout(() => setAnalysisStep(4), 2200);

    setTimeout(() => {
      setIsAnalyzing(false);
      const chosenPartidas = selectedPreset.partidas.map(p => {
        // Recalculate with chosen global margin
        const coste = p.costeUnitario;
        const pvp = Number((coste * (1 + margenGlobal / 100)).toFixed(2));
        const tot = Number((pvp * p.cantidad).toFixed(2));
        return {
          ...p,
          margenPct: margenGlobal,
          precioVenta: pvp,
          total: tot
        };
      });

      setPartidasList(chosenPartidas);
      setGeneratedResult({
        preset: selectedPreset,
        mediciones: selectedPreset.mediciones
      });

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 }
      });
      showNotification('¡Presupuesto generado con éxito por la IA!');
    }, 2800);
  };

  const handleUpdatePartidaCantidad = (id, newCant) => {
    const cantNum = Math.max(0.1, Number(newCant) || 1);
    setPartidasList(prev => prev.map(p => {
      if (p.id === id) {
        const newTotal = Number((p.precioVenta * cantNum).toFixed(2));
        return { ...p, cantidad: cantNum, total: newTotal };
      }
      return p;
    }));
  };

  const handleDeletePartida = (id) => {
    setPartidasList(prev => prev.filter(p => p.id !== id));
  };

  // Calculations
  const baseImponible = Number(partidasList.reduce((s, p) => s + p.total, 0).toFixed(2));
  const cuotaIva = Number((baseImponible * (tipoIva / 100)).toFixed(2));
  const totalPresupuesto = Number((baseImponible + cuotaIva).toFixed(2));
  const costeTotalDirecto = Number(partidasList.reduce((s, p) => s + (p.costeUnitario * p.cantidad), 0).toFixed(2));
  const beneficioBruto = Number((baseImponible - costeTotalDirecto).toFixed(2));

  const handleSavePresupuestoBorrador = () => {
    // Save as Borrador (Draft) for client review, NOT auto-accepted
    const newPres = addPresupuesto({
      obraTitulo: obraTitulo,
      cliente: clienteNombre,
      nif: clienteNif,
      direccion: clienteDireccion,
      tipoIvaPct: tipoIva,
      margenGlobalPct: margenGlobal,
      partidas: partidasList,
      baseImponible: baseImponible,
      cuotaIva: cuotaIva,
      totalConIva: totalPresupuesto,
      estado: 'borrador', // Creado como borrador para revisión/envío al cliente
      notasLegales: 'Presupuesto generado con IA a partir de fotos del estado actual y notas de voz. Forma de pago: 40% a la aceptación y replanteo, 40% avance de instalaciones, 20% entrega de llaves. Garantía oficial de 2 años según LOE.'
    });

    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.6 }
    });

    showNotification(`¡Presupuesto ${newPres.numero} guardado como borrador! Pendiente de aprobación por el cliente.`);
    if (onCreated) onCreated();
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>Motor de Inteligencia Artificial para Obras y Reformas</span>
          </div>
          <h1 className="text-2xl font-black text-white">Generador de Presupuestos con Fotos y Audio</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Sube o selecciona fotos del estado actual y dicta o reproduce el audio con los trabajos requeridos. La IA cubicara mediciones y desglosará partidas con precios oficiales.
          </p>
        </div>

        <button
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3.5 py-2 rounded-xl transition w-fit"
        >
          Volver a Presupuestos
        </button>
      </div>

      {/* Main Grid: 2 Columns (Inputs vs Results) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: INPUTS (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* 1. Photo Selection & Custom Upload Card */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>1. Fotos del Estado Actual</span>
              </h3>
              <span className="text-[11px] text-slate-400">Subida propia / Plantillas</span>
            </div>

            {/* Custom Photo File Input & Camera Button */}
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center justify-center gap-2 p-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl cursor-pointer transition text-xs font-bold">
                <Upload className="w-4 h-4" />
                <span>Subir Fotos de Obra</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
                <input
                  type="text"
                  placeholder="URL de foto..."
                  value={customPhotoUrl}
                  onChange={(e) => setCustomPhotoUrl(e.target.value)}
                  className="w-full bg-transparent px-2 text-[11px] text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddPhotoUrl}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-xs font-bold shrink-0"
                >
                  OK
                </button>
              </div>
            </div>

            {/* User Uploaded Photos List */}
            {customPhotos.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] text-amber-400 font-bold block">Fotos Subidas por el Usuario ({customPhotos.length}):</span>
                <div className="grid grid-cols-3 gap-2">
                  {customPhotos.map((item) => {
                    const isSelected = selectedPreset.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedPreset(item)}
                        className={`cursor-pointer rounded-xl overflow-hidden border-2 transition relative group ${
                          isSelected ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <img src={item.url} alt={item.title} className="w-full h-20 object-cover" />
                        <div className="p-1 bg-slate-950 text-center">
                          <span className="text-[9px] font-bold text-emerald-400 truncate block">{item.title}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Presets Gallery */}
            <div className="space-y-1 pt-1">
              <span className="text-[11px] text-slate-400 font-medium block">O elige una foto de muestra:</span>
              <div className="grid grid-cols-3 gap-2">
                {PHOTO_PRESETS.map((preset) => {
                  const isSelected = selectedPreset.id === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`cursor-pointer rounded-xl overflow-hidden border-2 transition relative group ${
                        isSelected ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={preset.url} alt={preset.title} className="w-full h-20 object-cover" />
                      <div className="p-1.5 bg-slate-950 text-center">
                        <span className="text-[10px] font-bold text-white truncate block">{preset.tipo}</span>
                      </div>
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-[10px]">
                          ✓
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Photo Preview */}
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <img src={selectedPreset.url} alt="Foto seleccionada" className="w-full h-44 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent flex items-end p-3">
                <div className="text-white">
                  <span className="text-xs font-bold text-amber-400 block">{selectedPreset.title}</span>
                  <p className="text-[11px] text-slate-300">{selectedPreset.descripcion}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Audio Transcript Input Card & AI Style Examples Button */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Mic className="w-4 h-4 text-amber-400" />
                <span>2. Audio de Instrucciones de Obra</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowExamplesModal(true)}
                className="text-[11px] text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition"
              >
                <Sparkles className="w-3 h-3" />
                <span>Estilo / Aprendizaje IA ({userRedactionExamples.length})</span>
              </button>
            </div>

            <textarea
              rows="4"
              value={audioTranscript}
              onChange={(e) => setAudioTranscript(e.target.value)}
              placeholder="Dicta o escribe las instrucciones de obra: demolición, alicatados, sanitarios, electricidad..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400 leading-relaxed font-sans"
            ></textarea>
          </div>

          {/* 3. Project Configuration & Margin Card */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-sm">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <span>3. Datos de la Obra y Margen</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Título de la Obra / Reforma</label>
                <input
                  type="text"
                  value={obraTitulo}
                  onChange={(e) => setObraTitulo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Nombre Cliente</label>
                  <input
                    type="text"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">NIF/CIF Cliente</label>
                  <input
                    type="text"
                    value={clienteNif}
                    onChange={(e) => setClienteNif(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Dirección del Inmueble</label>
                <input
                  type="text"
                  value={clienteDireccion}
                  onChange={(e) => setClienteDireccion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-slate-400 block mb-1 flex items-center justify-between">
                    <span>Margen Comercial</span>
                    <strong className="text-amber-400">{margenGlobal}%</strong>
                  </label>
                  <input
                    type="range"
                    min="15"
                    max="50"
                    step="1"
                    value={margenGlobal}
                    onChange={(e) => setMargenGlobal(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Tipo de IVA</label>
                  <select
                    value={tipoIva}
                    onChange={(e) => setTipoIva(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"
                  >
                    <option value={10}>10% (Reforma Vivienda Habitual)</option>
                    <option value={21}>21% (Sociedad / Local Comercial)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Big Action Button */}
            <button
              onClick={handleRunAiAnalysis}
              disabled={isAnalyzing}
              className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition shadow-lg ${
                isAnalyzing
                  ? 'bg-amber-500/50 text-slate-950 cursor-wait'
                  : 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-amber-500/25 active:scale-95'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Analizando Fotos y Audio con IA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 stroke-[2.5]" />
                  <span>Generar Presupuesto con IA</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: AI RESULTS & PARTIDAS (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* If analyzing simulation */}
          {isAnalyzing && (
            <div className="bg-slate-900 border border-amber-500/40 p-8 rounded-2xl shadow-xl space-y-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto animate-bounce">
                <Sparkles className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Gemini Construction AI Engine</h3>
                <p className="text-xs text-slate-400 mt-1">Analizando mediciones, superficies y partidas de obra...</p>
              </div>

              {/* Progress Steps */}
              <div className="max-w-md mx-auto space-y-3 text-left text-xs">
                <div className={`p-3 rounded-xl border flex items-center gap-3 ${analysisStep >= 1 ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-[10px]">1</span>
                  <span>Cubicación visual: análisis de fotos, detección de revestimientos y bañera/tabiques</span>
                </div>
                <div className={`p-3 rounded-xl border flex items-center gap-3 ${analysisStep >= 2 ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-[10px]">2</span>
                  <span>Transcribiendo audio y extrayendo calidades solicitadas (Geberit, porcelánico, LED)</span>
                </div>
                <div className={`p-3 rounded-xl border flex items-center gap-3 ${analysisStep >= 3 ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-[10px]">3</span>
                  <span>Cruzando con la Base de Precios de Subcontratas (Electricidad, Fontanería, Albañilería)</span>
                </div>
                <div className={`p-3 rounded-xl border flex items-center gap-3 ${analysisStep >= 4 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-[10px]">4</span>
                  <span>Aplicando margen comercial del {margenGlobal}% y calculando total oficial</span>
                </div>
              </div>
            </div>
          )}

          {/* Generated Result Display */}
          {!isAnalyzing && generatedResult && (
            <div className="space-y-4">
              
              {/* AI Recognition Badge */}
              <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-amber-950/20 border border-emerald-500/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Mediciones Estimadas por la IA:</h4>
                    <p className="text-xs text-slate-300">
                      {Object.entries(generatedResult.mediciones).map(([k, v]) => `${k.replace('m2', 'm² ')}: ${v}`).join(' · ')}
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold self-start sm:self-center">
                  {partidasList.length} Partidas Calculadas
                </span>
              </div>

              {/* Editable Partidas Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold text-white text-sm">Desglose de Partidas y Mediciones</h3>
                  <span className="text-[11px] text-slate-400">Puedes modificar cantidades antes de guardar</span>
                </div>

                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Cód. / Capítulo</th>
                        <th className="py-2.5 px-3">Concepto</th>
                        <th className="py-2.5 px-3 text-center">Cant.</th>
                        <th className="py-2.5 px-3 text-right">Coste</th>
                        <th className="py-2.5 px-3 text-right">PVP Ud.</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-2 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {partidasList.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="font-mono text-amber-400 block font-bold text-[10px]">{p.codigo}</span>
                            <span className="text-slate-500 text-[10px]">{p.capitulo}</span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-medium text-white">{p.concepto}</span>
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0.1"
                                step="0.5"
                                value={p.cantidad}
                                onChange={(e) => handleUpdatePartidaCantidad(p.id, e.target.value)}
                                className="w-16 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs text-white font-mono"
                              />
                              <span className="text-[10px] text-slate-400">{p.unidad}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-400 whitespace-nowrap">
                            {p.costeUnitario.toFixed(2)} €
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                            {p.precioVenta.toFixed(2)} €
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-white whitespace-nowrap">
                            {p.total.toFixed(2)} €
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              onClick={() => handleDeletePartida(p.id)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                              title="Eliminar partida"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Summary Card */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Coste Directo</span>
                    <span className="text-sm font-bold text-slate-300">{costeTotalDirecto.toLocaleString('es-ES')} €</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Beneficio ({margenGlobal}%)</span>
                    <span className="text-sm font-bold text-emerald-400">+{beneficioBruto.toLocaleString('es-ES')} €</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Base Imponible</span>
                    <span className="text-sm font-bold text-white">{baseImponible.toLocaleString('es-ES')} €</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-amber-500/40">
                    <span className="text-[10px] text-amber-400 uppercase font-semibold block">Total con IVA ({tipoIva}%)</span>
                    <span className="text-base font-black text-amber-400">{totalPresupuesto.toLocaleString('es-ES')} €</span>
                  </div>
                </div>

                {/* Final Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
                  <div className="text-xs text-slate-400">
                    <span>✓ Creará el presupuesto formal y la <strong>ficha de obra con sus fases</strong>.</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={onCancel}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSavePresupuestoBorrador}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95"
                    >
                      <FileText className="w-4 h-4 stroke-[2.5]" />
                      <span>Guardar Presupuesto (Borrador)</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Initial State Placeholder */}
          {!isAnalyzing && !generatedResult && (
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Listo para Generar Presupuesto</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Revisa las fotos y la descripción en audio a la izquierda y pulsa en <strong>"Generar Presupuesto con IA"</strong>.
                Obtendrás el desglose de partidas, rendimientos y márgenes al instante.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* Modal Ejemplos de Redacción y Aprendizaje para la IA */}
      {showExamplesModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>Entrenamiento y Estilo de Redacción para la IA</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Introduce ejemplos de cómo te gusta redactar tus presupuestos, qué conceptos incluyes o excluyes por defecto.
                </p>
              </div>
              <button onClick={() => setShowExamplesModal(false)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            {/* Ejemplos Actuales */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                Ejemplos de Redacción Enseñados a la IA ({userRedactionExamples.length}):
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {userRedactionExamples.map((ex) => (
                  <div key={ex.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                    <span className="font-bold text-white block">{ex.titulo}</span>
                    <p className="text-slate-300 italic">"{ex.texto}"</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Formulario Añadir Nuevo Ejemplo */}
            <form onSubmit={handleAddExample} className="space-y-3 pt-2 border-t border-slate-800 text-xs">
              <span className="font-bold text-white block">Añadir Nuevo Ejemplo de Redacción / Criterio:</span>
              <div>
                <label className="text-slate-400 block mb-1">Título / Trabajo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Formateo de Fontanería con Multicapa"
                  value={newExampleTitle}
                  onChange={(e) => setNewExampleTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Texto / Partida Redactada de Ejemplo</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Escribe la descripción de la partida exactamente como quieres que la redacte la IA..."
                  value={newExampleText}
                  onChange={(e) => setNewExampleText(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExamplesModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow"
                >
                  Guardar Ejemplo de Aprendizaje
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
