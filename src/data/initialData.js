// Initial realistic dataset for Spanish Construction & Reform Contractor

export const INITIAL_OBRAS = [
  {
    id: 'obra-1',
    codigo: 'OBR-2026-001',
    titulo: 'Reforma Integral Ático Velázquez',
    cliente: 'D. Javier Morales Benítez',
    telefono: '+34 612 345 678',
    email: 'j.morales@gmail.com',
    direccion: 'Calle Velázquez 48, 6ºB, Madrid',
    tipo: 'Reforma Integral Vivienda',
    estado: 'en_curso', // en_curso, presupuestada, finalizada, pausada
    fechaInicio: '2026-09-01',
    fechaFinEstimada: '2026-11-20',
    progreso: 68,
    presupuestoTotal: 48500,
    costeRealActual: 28900,
    margenEsperadoPct: 35,
    margenRealPct: 40.4,
    notas: 'Ático de 95m² con terraza. Se demuele distribución antigua para crear espacio abierto salón-cocina.',
    fases: [
      { id: 'f-1', nombre: 'Demoliciones y Desescombro', progreso: 100, estado: 'completada', dias: 6, responsable: 'Mario Silva' },
      { id: 'f-2', nombre: 'Fontanería, Saneamiento y Climatización', progreso: 100, estado: 'completada', dias: 10, responsable: 'ClimaTec Subcontrata' },
      { id: 'f-3', nombre: 'Albañilería y Falsos Techos Pladur', progreso: 85, estado: 'en_curso', dias: 14, responsable: 'Ionut Radu' },
      { id: 'f-4', nombre: 'Alicatados y Solados Porcelánicos', progreso: 60, estado: 'en_curso', dias: 12, responsable: 'Pedro Gómez' },
      { id: 'f-5', nombre: 'Electricidad e Iluminación LED', progreso: 70, estado: 'en_curso', dias: 8, responsable: 'ElectroSur Subcontrata' },
      { id: 'f-6', nombre: 'Carpintería de Madera y Puertas Lacadas', progreso: 10, estado: 'pendiente', dias: 5, responsable: 'Carpintería Robles' },
      { id: 'f-7', nombre: 'Pintura Plástica Lisa y Remates', progreso: 0, estado: 'pendiente', dias: 6, responsable: 'DecorPint Subcontrata' },
      { id: 'f-8', nombre: 'Limpieza Final y Entrega', progreso: 0, estado: 'pendiente', dias: 2, responsable: 'Cuadrilla propia' }
    ],
    diario: [
      {
        id: 'd-1',
        fecha: '2026-10-16',
        autor: 'Manuel (Encargado)',
        clima: 'Despejado, 21°C',
        obrerosPresentes: ['Pedro Gómez', 'Mario Silva', 'ElectroSur (2 operarios)'],
        resumen: 'Se completa el alicatado del baño principal con porcelánico rectificado 60x120. ElectroSur termina el cableado del salón y cuadro general.',
        incidencias: 'Falta confirmar por el cliente el color de las juntas del suelo de la cocina.',
        fotos: [
          'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
          'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80'
        ]
      },
      {
        id: 'd-2',
        fecha: '2026-10-14',
        autor: 'Manuel (Encargado)',
        clima: 'Lluvia ligera, 17°C',
        obrerosPresentes: ['Ionut Radu', 'Mario Silva'],
        resumen: 'Instalación de perfiles y placas de pladur hidrófugo en techos de cocina y baños. Apertura de foseados para iluminación perimetral.',
        incidencias: 'Ninguna destacable. Ritmo según lo planificado.',
        fotos: [
          'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80'
        ]
      }
    ],
    necesidadesMateriales: [
      { id: 'm-1', concepto: 'Cemento Cola Porcelánico C2TE Flexible', cantidad: 12, unidad: 'sacos 25kg', estado: 'recibido', costeEstimado: 144, proveedor: 'Obramat' },
      { id: 'm-2', concepto: 'Placas Pladur Hidrófugo Verde 13mm', cantidad: 16, unidad: 'placas', estado: 'recibido', costeEstimado: 208, proveedor: 'La Plataforma' },
      { id: 'm-3', concepto: 'Plato de ducha resina pizarra negra 140x80cm', cantidad: 1, unidad: 'ud', estado: 'pedido', costeEstimado: 235, proveedor: 'Suministros Sanimax' },
      { id: 'm-4', concepto: 'Cable Libre de Halógenos 2.5mm² Azul/Marrón', cantidad: 200, unidad: 'metros', estado: 'recibido', costeEstimado: 110, proveedor: 'ElectroSur' },
      { id: 'm-5', concepto: 'Pintura plástica lavable blanca mate (Cubeta 15L)', cantidad: 3, unidad: 'botes', estado: 'pendiente', costeEstimado: 195, proveedor: 'Pinturas Pro' },
      { id: 'm-6', concepto: 'Puertas de paso lacadas en blanco 72.5cm macizas', cantidad: 5, unidad: 'ud', estado: 'pedido', costeEstimado: 950, proveedor: 'Carpintería Robles' }
    ],
    operariosIds: ['obrero-1', 'obrero-2', 'obrero-3', 'sub-1', 'sub-2'],
    presupuestoId: 'pres-1'
  },
  {
    id: 'obra-2',
    codigo: 'OBR-2026-002',
    titulo: 'Reforma Cocina y 2 Baños Av. Bruselas',
    cliente: 'Dña. Elena Santamaría',
    telefono: '+34 655 890 123',
    email: 'elena.santamaria@yahoo.es',
    direccion: 'Avenida de Bruselas 14, 3ºA, Alcobendas',
    tipo: 'Reforma Parcial (Cocina + Baños)',
    estado: 'en_curso',
    fechaInicio: '2026-09-25',
    fechaFinEstimada: '2026-10-31',
    progreso: 42,
    presupuestoTotal: 26800,
    costeRealActual: 12300,
    margenEsperadoPct: 32,
    margenRealPct: 34.5,
    notas: 'Cambio de fontanería completa por multicapa con colectores independientes. Instalación de isla en cocina.',
    fases: [
      { id: 'f-201', nombre: 'Demolición muebles y azulejos', progreso: 100, estado: 'completada', dias: 4, responsable: 'Mario Silva' },
      { id: 'f-202', nombre: 'Fontanería y desagües PVC', progreso: 90, estado: 'en_curso', dias: 6, responsable: 'ClimaTec' },
      { id: 'f-203', nombre: 'Nuevos circuitos eléctricos cocina y baño', progreso: 75, estado: 'en_curso', dias: 5, responsable: 'ElectroSur' },
      { id: 'f-204', nombre: 'Alicatados y solados', progreso: 15, estado: 'en_curso', dias: 8, responsable: 'Pedro Gómez' },
      { id: 'f-205', nombre: 'Montaje de muebles y encimera cuarzo', progreso: 0, estado: 'pendiente', dias: 4, responsable: 'Subcontrata Cocinas' }
    ],
    diario: [
      {
        id: 'd-201',
        fecha: '2026-10-15',
        autor: 'Manuel (Encargado)',
        clima: 'Nublado, 19°C',
        obrerosPresentes: ['Pedro Gómez', 'Mario Silva'],
        resumen: 'Pruebas de estanqueidad de las nuevas tomas de fontanería superadas con éxito. Se empieza a replantear el suelo de la cocina.',
        incidencias: 'El cliente pide mover el enchufe del microondas 15cm a la izquierda.',
        fotos: ['https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80']
      }
    ],
    necesidadesMateriales: [
      { id: 'm-201', concepto: 'Tubería multicapa 20mm con aislamiento', cantidad: 60, unidad: 'metros', estado: 'recibido', costeEstimado: 120, proveedor: 'Saltoki' },
      { id: 'm-202', concepto: 'Mortero autonivelante para suelo cocina', cantidad: 8, unidad: 'sacos', estado: 'recibido', costeEstimado: 96, proveedor: 'Obramat' },
      { id: 'm-203', concepto: 'Mampara fija cristal templado 8mm con perfil negro', cantidad: 2, unidad: 'ud', estado: 'pedido', costeEstimado: 380, proveedor: 'Sanimax' }
    ],
    operariosIds: ['obrero-1', 'obrero-2', 'sub-1'],
    presupuestoId: 'pres-2'
  },
  {
    id: 'obra-3',
    codigo: 'OBR-2026-003',
    titulo: 'Acondicionamiento Local Comercial Fuencarral',
    cliente: 'Boutique Moda Bella SL (NIF B87654321)',
    telefono: '+34 670 112 233',
    email: 'administracion@modabella.com',
    direccion: 'Calle Fuencarral 82, Bajo, Madrid',
    tipo: 'Reforma Local Comercial',
    estado: 'presupuestada',
    fechaInicio: '2026-11-01',
    fechaFinEstimada: '2026-12-15',
    progreso: 0,
    presupuestoTotal: 34200,
    costeRealActual: 0,
    margenEsperadoPct: 30,
    margenRealPct: 30,
    notas: 'Presupuesto entregado al cliente, pendiente de firma de contrato y entrega del 40% de anticipo.',
    fases: [
      { id: 'f-301', nombre: 'Demolición tabiques y falso techo viejo', progreso: 0, estado: 'pendiente', dias: 5, responsable: 'Por asignar' },
      { id: 'f-302', nombre: 'Instalación eléctrica trifásica y focos carriles', progreso: 0, estado: 'pendiente', dias: 10, responsable: 'ElectroSur' },
      { id: 'f-303', nombre: 'Suelo vinílico continuo de alto tránsito', progreso: 0, estado: 'pendiente', dias: 5, responsable: 'Por asignar' },
      { id: 'f-304', nombre: 'Pintura y decoración escaparate', progreso: 0, estado: 'pendiente', dias: 6, responsable: 'DecorPint' }
    ],
    diario: [],
    necesidadesMateriales: [],
    operariosIds: [],
    presupuestoId: 'pres-3'
  },
  {
    id: 'obra-4',
    codigo: 'OBR-2026-004',
    titulo: 'Reforma Vivienda Turística C/ Mayor',
    cliente: 'Inversiones Centro Capital SL',
    telefono: '+34 620 998 877',
    email: 'contacto@centrocapital.es',
    direccion: 'Calle Mayor 12, 2º Izq, Madrid',
    tipo: 'Reforma Completa Apartamento',
    estado: 'finalizada',
    fechaInicio: '2026-07-01',
    fechaFinEstimada: '2026-08-28',
    progreso: 100,
    presupuestoTotal: 22000,
    costeRealActual: 14200,
    margenEsperadoPct: 35,
    margenRealPct: 35.4,
    notas: 'Obra concluida con éxito en plazo y forma. Cliente muy satisfecho. Facturas cobradas al 100%.',
    fases: [
      { id: 'f-401', nombre: 'Demoliciones', progreso: 100, estado: 'completada', dias: 3, responsable: 'Mario Silva' },
      { id: 'f-402', nombre: 'Instalaciones', progreso: 100, estado: 'completada', dias: 8, responsable: 'ElectroSur & ClimaTec' },
      { id: 'f-403', nombre: 'Alicatado y Suelo laminado AC5', progreso: 100, estado: 'completada', dias: 10, responsable: 'Pedro Gómez' },
      { id: 'f-404', nombre: 'Pintura y acabados', progreso: 100, estado: 'completada', dias: 5, responsable: 'DecorPint' }
    ],
    diario: [],
    necesidadesMateriales: [],
    operariosIds: ['obrero-1', 'obrero-2', 'sub-1', 'sub-2'],
    presupuestoId: 'pres-4'
  }
];

export const INITIAL_OBREROS = [
  {
    id: 'obrero-1',
    nombre: 'Pedro Gómez Castillo',
    puesto: 'Oficial 1ª Albañil & Alicatador',
    telefono: '+34 611 223 344',
    tipo: 'plantilla', // plantilla o subcontrata
    especialidad: 'Alicatado rectificado, porcelánico gran formato, tabiquería y soleras',
    foto: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f8?auto=format&fit=crop&w=200&q=80',
    calificacionMedia: 4.9,
    criterios: {
      calidadAcabados: 5.0,
      puntualidadPlazos: 4.8,
      autonomiaProblemas: 4.9,
      limpiezaSeguridad: 4.8
    },
    obrasRealizadas: 14,
    horasRegistradasMes: 152,
    costeHora: 22.50,
    estado: 'activo',
    recomendacionesIA: 'Excelente para alicatados de baños y cocinas de alta exigencia estética. Destaca por rapidez y precisión milimétrica.',
    ultimasResenas: [
      { obra: 'Ático Velázquez', fecha: '2026-10-15', nota: 5.0, comentario: 'Juntas perfectas y cortes limpios en ingletes a 45 grados.' },
      { obra: 'Vivienda Turística C/ Mayor', fecha: '2026-08-20', nota: 4.8, comentario: 'Terminó 2 días antes de lo presupuestado.' }
    ]
  },
  {
    id: 'obrero-2',
    nombre: 'Mario Silva Santos',
    puesto: 'Peón Especialista / Demoliciones y Carga',
    telefono: '+34 622 334 455',
    tipo: 'plantilla',
    especialidad: 'Demoliciones controladas, desescombro, preparación de mezclas, apoyo a oficiales',
    foto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    calificacionMedia: 4.6,
    criterios: {
      calidadAcabados: 4.3,
      puntualidadPlazos: 4.9,
      autonomiaProblemas: 4.5,
      limpiezaSeguridad: 4.8
    },
    obrasRealizadas: 18,
    horasRegistradasMes: 160,
    costeHora: 16.00,
    estado: 'activo',
    recomendacionesIA: 'Muy trabajador, gran capacidad física y puntualidad intachable. Deja las obras despejadas y limpias de escombro a diario.',
    ultimasResenas: [
      { obra: 'Ático Velázquez', fecha: '2026-09-08', nota: 4.7, comentario: 'Desescombró 95m² en tiempo récord protegiendo zonas comunes del edificio.' }
    ]
  },
  {
    id: 'obrero-3',
    nombre: 'Ionut Radu',
    puesto: 'Oficial Pladurista y Yesero',
    telefono: '+34 633 445 566',
    tipo: 'plantilla',
    especialidad: 'Tabiquería seca Pladur, trasdosados acústicos/térmicos, falsos techos decorativos y foseados LED',
    foto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    calificacionMedia: 4.8,
    criterios: {
      calidadAcabados: 4.9,
      puntualidadPlazos: 4.7,
      autonomiaProblemas: 4.8,
      limpiezaSeguridad: 4.7
    },
    obrasRealizadas: 11,
    horasRegistradasMes: 144,
    costeHora: 23.00,
    estado: 'activo',
    recomendacionesIA: 'El mejor en montaje de techos y candilejas de luz indirecta. Cinta y pasta impecables, sin marcas para el pintor.',
    ultimasResenas: [
      { obra: 'Ático Velázquez', fecha: '2026-10-14', nota: 4.9, comentario: 'Techo foseado de salón ejecutado con enorme finura.' }
    ]
  },
  {
    id: 'sub-1',
    nombre: 'ElectroSur Instalaciones SL',
    puesto: 'Subcontrata Electricidad y Clima',
    telefono: '+34 91 555 7788',
    contacto: 'Sergio Navas (Jefe de Equipo)',
    tipo: 'subcontrata',
    especialidad: 'Instalaciones eléctricas BT, cuadros con IGA y protectores sobretensión, boletines oficiales CIE, cableado estructurado',
    foto: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=200&q=80',
    calificacionMedia: 4.7,
    criterios: {
      calidadAcabados: 4.8,
      puntualidadPlazos: 4.6,
      autonomiaProblemas: 4.9,
      limpiezaSeguridad: 4.6
    },
    obrasRealizadas: 22,
    margenAplicadoEmpresa: 25, // % que recarga el constructor al cliente
    estado: 'activo',
    recomendacionesIA: 'Subcontrata de máxima confianza. Emisión rápida de boletines oficiales. Precios competitivos y cumplen normativa REBT.',
    ultimasResenas: [
      { obra: 'Ático Velázquez', fecha: '2026-10-12', nota: 4.7, comentario: 'Instalación impecable del cuadro y circuitos independientes para horno/inducción.' }
    ]
  },
  {
    id: 'sub-2',
    nombre: 'ClimaTec Fontanería y Climatización',
    puesto: 'Subcontrata Fontanería y Gas',
    telefono: '+34 91 444 3322',
    contacto: 'David Aranda',
    tipo: 'subcontrata',
    especialidad: 'Tubería multicapa y PPR, desagües insonorizados, instalación de suelo radiante/refrescante y aerotermia',
    foto: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=200&q=80',
    calificacionMedia: 4.4,
    criterios: {
      calidadAcabados: 4.7,
      puntualidadPlazos: 4.1,
      autonomiaProblemas: 4.6,
      limpiezaSeguridad: 4.3
    },
    obrasRealizadas: 16,
    margenAplicadoEmpresa: 22,
    estado: 'activo',
    recomendacionesIA: 'Gran conocimiento técnico en aerotermia y saneamiento. A vigilar: suele ajustar mucho los plazos de llegada, avisar con 48h de antelación.',
    ultimasResenas: [
      { obra: 'Av. Bruselas', fecha: '2026-10-10', nota: 4.4, comentario: 'Instalación sin fugas a la primera prueba de presión.' }
    ]
  },
  {
    id: 'sub-3',
    nombre: 'DecorPint Madrid SL',
    puesto: 'Subcontrata Pintura y Revestimientos',
    telefono: '+34 91 888 9900',
    contacto: 'Roberto Alcaide',
    tipo: 'subcontrata',
    especialidad: 'Alisado de gotelé, pintura plástica satinada y mate lavable, colocación papel pintado, microcemento',
    foto: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=200&q=80',
    calificacionMedia: 4.8,
    criterios: {
      calidadAcabados: 4.9,
      puntualidadPlazos: 4.8,
      autonomiaProblemas: 4.7,
      limpiezaSeguridad: 4.9
    },
    obrasRealizadas: 19,
    margenAplicadoEmpresa: 30,
    estado: 'activo',
    recomendacionesIA: 'Excelente acabado en alisados con luz rasante. Muy limpios con el encintado y protección de suelos.',
    ultimasResenas: [
      { obra: 'Vivienda Turística C/ Mayor', fecha: '2026-08-25', nota: 4.9, comentario: 'Acabado de pintura de categoría superior.' }
    ]
  }
];

export const INITIAL_BASE_PRECIOS = [
  // Demoliciones
  { id: 'bp-1', codigo: 'DEM-01', capitulo: 'Demoliciones', gremio: 'Albañilería', concepto: 'Demolición de tabicón de ladrillo hueco doble o sencillo con medios manuales y carga de escombro', unidad: 'm²', costeSubcontrata: 12.50, margenPct: 35, precioVenta: 16.88 },
  { id: 'bp-2', codigo: 'DEM-02', capitulo: 'Demoliciones', gremio: 'Albañilería', concepto: 'Picado y desescombro de alicatado o solado cerámico existente, incluso limpieza de soporte', unidad: 'm²', costeSubcontrata: 9.80, margenPct: 35, precioVenta: 13.23 },
  { id: 'bp-3', codigo: 'DEM-03', capitulo: 'Demoliciones', gremio: 'Albañilería', concepto: 'Desmontaje de aparatos sanitarios antiguos (inodoro, lavabo, bidé, bañera) y griferías', unidad: 'ud', costeSubcontrata: 25.00, margenPct: 40, precioVenta: 35.00 },
  { id: 'bp-4', codigo: 'DEM-04', capitulo: 'Demoliciones', gremio: 'Albañilería', concepto: 'Tasa y canon de gestión de residuos en vertedero autorizado + contenedor de escombros 5m³', unidad: 'ud', costeSubcontrata: 180.00, margenPct: 20, precioVenta: 216.00 },
  
  // Albañilería & Pladur
  { id: 'bp-5', codigo: 'ALB-01', capitulo: 'Albañilería', gremio: 'Albañilería', concepto: 'Tabique de placas de yeso laminado (Pladur) 13mm a ambas caras con estructura metálica de 46mm y lana de roca', unidad: 'm²', costeSubcontrata: 28.50, margenPct: 30, precioVenta: 37.05 },
  { id: 'bp-6', codigo: 'ALB-02', capitulo: 'Albañilería', gremio: 'Albañilería', concepto: 'Falso techo continuo de pladur con perfiles TC-47 incluso encintado y pasta de juntas', unidad: 'm²', costeSubcontrata: 24.00, margenPct: 30, precioVenta: 31.20 },
  { id: 'bp-7', codigo: 'ALB-03', capitulo: 'Albañilería', gremio: 'Albañilería', concepto: 'Formación de foseado perimetral en falso techo para alojamiento de tira LED oculta', unidad: 'ml', costeSubcontrata: 18.00, margenPct: 35, precioVenta: 24.30 },
  { id: 'bp-8', codigo: 'ALB-04', capitulo: 'Albañilería', gremio: 'Albañilería', concepto: 'Solera de mortero autonivelante de 3 a 5cm de espesor armada con fibra de vidrio', unidad: 'm²', costeSubcontrata: 14.50, margenPct: 30, precioVenta: 18.85 },
  
  // Fontanería y Saneamiento
  { id: 'bp-9', codigo: 'FON-01', capitulo: 'Fontanería', gremio: 'Fontanería', concepto: 'Punto de agua fría y caliente con tubería multicapa aislada por falso techo o roza', unidad: 'ud', costeSubcontrata: 65.00, margenPct: 25, precioVenta: 81.25 },
  { id: 'bp-10', codigo: 'FON-02', capitulo: 'Fontanería', gremio: 'Fontanería', concepto: 'Punto de desagüe en PVC insonorizado de 40mm o 50mm con bote sifónico o sifón registrable', unidad: 'ud', costeSubcontrata: 45.00, margenPct: 25, precioVenta: 56.25 },
  { id: 'bp-11', codigo: 'FON-03', capitulo: 'Fontanería', gremio: 'Fontanería', concepto: 'Instalación y conexión de plato de ducha de resina pizarra con válvula sifónica de gran caudal', unidad: 'ud', costeSubcontrata: 120.00, margenPct: 30, precioVenta: 156.00 },
  { id: 'bp-12', codigo: 'FON-04', capitulo: 'Fontanería', gremio: 'Fontanería', concepto: 'Montaje de inodoro con cisterna empotrada tipo Geberit y pulsador frontal', unidad: 'ud', costeSubcontrata: 160.00, margenPct: 25, precioVenta: 200.00 },

  // Electricidad
  { id: 'bp-13', codigo: 'ELE-01', capitulo: 'Electricidad', gremio: 'Electricidad', concepto: 'Punto de luz sencillo o conmutado con tubo corrugado M-20 y cable libre de halógenos 1.5mm²', unidad: 'ud', costeSubcontrata: 32.00, margenPct: 25, precioVenta: 40.00 },
  { id: 'bp-14', codigo: 'ELE-02', capitulo: 'Electricidad', gremio: 'Electricidad', concepto: 'Toma de corriente con toma de tierra Schuko 16A mecanismo serie media (Schneider / Niessen)', unidad: 'ud', costeSubcontrata: 34.00, margenPct: 25, precioVenta: 42.50 },
  { id: 'bp-15', codigo: 'ELE-03', capitulo: 'Electricidad', gremio: 'Electricidad', concepto: 'Cuadro general de mando y protección con IGA, ID superinmunizado y 6 PIAS independientes', unidad: 'ud', costeSubcontrata: 380.00, margenPct: 25, precioVenta: 475.00 },
  { id: 'bp-16', codigo: 'ELE-04', capitulo: 'Electricidad', gremio: 'Electricidad', concepto: 'Instalación de downlight LED empotrado en falso techo de 12W a 18W regulable', unidad: 'ud', costeSubcontrata: 22.00, margenPct: 30, precioVenta: 28.60 },

  // Alicatados y Revestimientos
  { id: 'bp-17', codigo: 'ALI-01', capitulo: 'Revestimientos', gremio: 'Albañilería', concepto: 'Alicatado con gres porcelánico rectificado en paredes con cemento cola C2TE y crucetas autonivelantes', unidad: 'm²', costeSubcontrata: 26.00, margenPct: 30, precioVenta: 33.80 },
  { id: 'bp-18', codigo: 'ALI-02', capitulo: 'Revestimientos', gremio: 'Albañilería', concepto: 'Solado con gres porcelánico de gran formato en suelos con rejuntado fino repelente al agua', unidad: 'm²', costeSubcontrata: 24.50, margenPct: 30, precioVenta: 31.85 },
  
  // Pintura
  { id: 'bp-19', codigo: 'PIN-01', capitulo: 'Pintura', gremio: 'Pintura', concepto: 'Alisado de gotelé mediante tendido de dos manos de masilla plástica, lijado y fondo fijador', unidad: 'm²', costeSubcontrata: 12.00, margenPct: 30, precioVenta: 15.60 },
  { id: 'bp-20', codigo: 'PIN-02', capitulo: 'Pintura', gremio: 'Pintura', concepto: 'Pintura plástica lisa lavable mate en paramentos verticales y techos a dos manos', unidad: 'm²', costeSubcontrata: 7.50, margenPct: 30, precioVenta: 9.75 },

  // Carpintería
  { id: 'bp-21', codigo: 'CAR-01', capitulo: 'Carpintería', gremio: 'Carpintería', concepto: 'Suministro y colocación de puerta de paso maciza lacada en blanco block con herrajes magnéticos', unidad: 'ud', costeSubcontrata: 240.00, margenPct: 22, precioVenta: 292.80 },
  { id: 'bp-22', codigo: 'CAR-02', capitulo: 'Carpintería', gremio: 'Carpintería', concepto: 'Instalación de suelo laminado AC5 de alta resistencia con base aislante acústica y rodapié lacado', unidad: 'm²', costeSubcontrata: 21.00, margenPct: 25, precioVenta: 26.25 }
];

export const INITIAL_PRESUPUESTOS = [
  {
    id: 'pres-1',
    numero: 'PRES-2026-001',
    obraId: 'obra-1',
    obraTitulo: 'Reforma Integral Ático Velázquez',
    cliente: 'D. Javier Morales Benítez',
    nif: '50849201K',
    direccion: 'Calle Velázquez 48, 6ºB, Madrid',
    fecha: '2026-08-20',
    validezDias: 30,
    estado: 'aceptado', // borrador, enviado, aceptado, facturado
    tipoIvaPct: 10, // 10% reforma vivienda habitual
    margenGlobalPct: 35,
    notasLegales: 'Forma de pago: 40% a la firma del contrato y replanteo, 40% a la mitad de obra (tras instalaciones y alicatados), 20% a la entrega de llaves y fin de obra. Garantía de 2 años en instalaciones y acabados según LOE.',
    partidas: [
      { id: 'p-1', codigo: 'DEM-01', capitulo: 'Demoliciones', concepto: 'Demolición de tabiquería interior para creación de concepto abierto (salón-cocina)', cantidad: 45, unidad: 'm²', costeUnitario: 12.50, margenPct: 35, precioVenta: 16.88, total: 759.60 },
      { id: 'p-2', codigo: 'DEM-02', capitulo: 'Demoliciones', concepto: 'Picado de azulejos y solados en 2 baños y cocina', cantidad: 85, unidad: 'm²', costeUnitario: 9.80, margenPct: 35, precioVenta: 13.23, total: 1124.55 },
      { id: 'p-3', codigo: 'DEM-04', capitulo: 'Demoliciones', concepto: 'Contenedores de escombro y gestión ambiental en vertedero', cantidad: 4, unidad: 'ud', costeUnitario: 180.00, margenPct: 20, precioVenta: 216.00, total: 864.00 },
      { id: 'p-4', codigo: 'ALB-01', capitulo: 'Albañilería y Pladur', concepto: 'Tabiquería seca Pladur con aislamiento acústico en dormitorios y baños', cantidad: 60, unidad: 'm²', costeUnitario: 28.50, margenPct: 30, precioVenta: 37.05, total: 2223.00 },
      { id: 'p-5', codigo: 'ALB-02', capitulo: 'Albañilería y Pladur', concepto: 'Falso techo continuo con foseados perimetrales LED', cantidad: 80, unidad: 'm²', costeUnitario: 24.00, margenPct: 30, precioVenta: 31.20, total: 2496.00 },
      { id: 'p-6', codigo: 'FON-01', capitulo: 'Fontanería y Clima', concepto: 'Instalación completa de fontanería multicapa en cocina y 2 baños', cantidad: 14, unidad: 'ud', costeUnitario: 65.00, margenPct: 25, precioVenta: 81.25, total: 1137.50 },
      { id: 'p-7', codigo: 'FON-03', capitulo: 'Fontanería y Clima', concepto: 'Instalación de 2 platos de ducha de resina pizarra con mamparas de diseño', cantidad: 2, unidad: 'ud', costeUnitario: 120.00, margenPct: 30, precioVenta: 156.00, total: 312.00 },
      { id: 'p-8', codigo: 'ELE-01', capitulo: 'Electricidad', concepto: 'Renovación completa de instalación eléctrica según REBT con mecanismos Niessen', cantidad: 42, unidad: 'ud', costeUnitario: 34.00, margenPct: 25, precioVenta: 42.50, total: 1785.00 },
      { id: 'p-9', codigo: 'ELE-03', capitulo: 'Electricidad', concepto: 'Cuadro general eléctrico trifásico y boletín oficial de industria (CIE)', cantidad: 1, unidad: 'ud', costeUnitario: 380.00, margenPct: 25, precioVenta: 475.00, total: 475.00 },
      { id: 'p-10', codigo: 'ALI-01', capitulo: 'Revestimientos', concepto: 'Alicatado porcelánico rectificado en baños hasta el techo', cantidad: 75, unidad: 'm²', costeUnitario: 26.00, margenPct: 30, precioVenta: 33.80, total: 2535.00 },
      { id: 'p-11', codigo: 'CAR-02', capitulo: 'Carpintería y Suelos', concepto: 'Suministro e instalación de tarima laminada AC5 hidrófuga en toda la vivienda', cantidad: 85, unidad: 'm²', costeUnitario: 21.00, margenPct: 25, precioVenta: 26.25, total: 2231.25 },
      { id: 'p-12', codigo: 'PIN-01', capitulo: 'Pintura', concepto: 'Alisado de gotelé completo en techos y paredes con pintura plástica lavable', cantidad: 210, unidad: 'm²', costeUnitario: 12.00, margenPct: 30, precioVenta: 15.60, total: 3276.00 }
    ],
    baseImponible: 20218.90, // Subtotal calculado (con partidas adicionales llega a 44.090)
    cuotaIva: 2021.89,
    totalConIva: 22240.79
  },
  {
    id: 'pres-2',
    numero: 'PRES-2026-002',
    obraId: 'obra-2',
    obraTitulo: 'Reforma Cocina y 2 Baños Av. Bruselas',
    cliente: 'Dña. Elena Santamaría',
    nif: '02894103M',
    direccion: 'Avenida de Bruselas 14, 3ºA, Alcobendas',
    fecha: '2026-09-10',
    validezDias: 30,
    estado: 'aceptado',
    tipoIvaPct: 10,
    margenGlobalPct: 32,
    notasLegales: 'Pago: 40% inicio, 40% replanteo instalaciones, 20% fin de obra.',
    partidas: [
      { id: 'p-201', codigo: 'DEM-02', capitulo: 'Demoliciones', concepto: 'Picado y desescombro de cocina y baños', cantidad: 65, unidad: 'm²', costeUnitario: 9.80, margenPct: 35, precioVenta: 13.23, total: 859.95 },
      { id: 'p-202', codigo: 'FON-01', capitulo: 'Fontanería', concepto: 'Puntos de agua y desagües para cocina con isla y 2 baños', cantidad: 12, unidad: 'ud', costeUnitario: 65.00, margenPct: 25, precioVenta: 81.25, total: 975.00 },
      { id: 'p-203', codigo: 'ALI-01', capitulo: 'Alicatados', concepto: 'Alicatado porcelánico imitación mármol calacatta', cantidad: 55, unidad: 'm²', costeUnitario: 26.00, margenPct: 30, precioVenta: 33.80, total: 1859.00 }
    ],
    baseImponible: 14500.00,
    cuotaIva: 1450.00,
    totalConIva: 15950.00
  }
];

export const INITIAL_FACTURAS = [
  {
    id: 'fac-1',
    numero: 'FAC-2026-021',
    presupuestoId: 'pres-1',
    obraId: 'obra-1',
    obraTitulo: 'Reforma Integral Ático Velázquez',
    cliente: 'D. Javier Morales Benítez',
    cifNif: '50849201K',
    direccion: 'Calle Velázquez 48, 6ºB, Madrid',
    fechaEmision: '2026-09-02',
    fechaVencimiento: '2026-09-15',
    tipoFactura: 'Certificación 1 (Anticipo 40% Inicio Obra)',
    trimestre: '3T', // 1T, 2T, 3T, 4T
    ano: 2026,
    baseImponible: 17636.36,
    tipoIvaPct: 10,
    cuotaIva: 1763.64,
    retencionIrpfPct: 0,
    cuotaRetencion: 0,
    totalFactura: 19400.00,
    estadoCobro: 'cobrada', // cobrada, pendiente, retrasada
    fechaCobro: '2026-09-04',
    metodoPago: 'Transferencia bancaria Banco Santander'
  },
  {
    id: 'fac-2',
    numero: 'FAC-2026-022',
    presupuestoId: 'pres-1',
    obraId: 'obra-1',
    obraTitulo: 'Reforma Integral Ático Velázquez',
    cliente: 'D. Javier Morales Benítez',
    cifNif: '50849201K',
    direccion: 'Calle Velázquez 48, 6ºB, Madrid',
    fechaEmision: '2026-10-12',
    fechaVencimiento: '2026-10-26',
    tipoFactura: 'Certificación 2 (Avance 40% Tras Instalaciones y Alicatados)',
    trimestre: '4T',
    ano: 2026,
    baseImponible: 17636.36,
    tipoIvaPct: 10,
    cuotaIva: 1763.64,
    retencionIrpfPct: 0,
    cuotaRetencion: 0,
    totalFactura: 19400.00,
    estadoCobro: 'cobrada',
    fechaCobro: '2026-10-14',
    metodoPago: 'Transferencia bancaria Banco Santander'
  },
  {
    id: 'fac-3',
    numero: 'FAC-2026-023',
    presupuestoId: 'pres-2',
    obraId: 'obra-2',
    obraTitulo: 'Reforma Cocina y 2 Baños Av. Bruselas',
    cliente: 'Dña. Elena Santamaría',
    cifNif: '02894103M',
    direccion: 'Avenida de Bruselas 14, 3ºA, Alcobendas',
    fechaEmision: '2026-09-26',
    fechaVencimiento: '2026-10-10',
    tipoFactura: 'Certificación 1 (Anticipo 40%)',
    trimestre: '3T',
    ano: 2026,
    baseImponible: 9745.45,
    tipoIvaPct: 10,
    cuotaIva: 974.55,
    retencionIrpfPct: 0,
    cuotaRetencion: 0,
    totalFactura: 10720.00,
    estadoCobro: 'cobrada',
    fechaCobro: '2026-09-28',
    metodoPago: 'Transferencia bancaria BBVA'
  },
  {
    id: 'fac-4',
    numero: 'FAC-2026-024',
    presupuestoId: 'pres-2',
    obraId: 'obra-2',
    obraTitulo: 'Reforma Cocina y 2 Baños Av. Bruselas',
    cliente: 'Dña. Elena Santamaría',
    cifNif: '02894103M',
    direccion: 'Avenida de Bruselas 14, 3ºA, Alcobendas',
    fechaEmision: '2026-10-16',
    fechaVencimiento: '2026-10-30',
    tipoFactura: 'Certificación 2 (Avance 40%)',
    trimestre: '4T',
    ano: 2026,
    baseImponible: 9745.45,
    tipoIvaPct: 10,
    cuotaIva: 974.55,
    retencionIrpfPct: 0,
    cuotaRetencion: 0,
    totalFactura: 10720.00,
    estadoCobro: 'pendiente',
    fechaCobro: null,
    metodoPago: 'Transferencia bancaria BBVA'
  },
  {
    id: 'fac-old-1',
    numero: 'FAC-2026-018',
    presupuestoId: 'pres-4',
    obraId: 'obra-4',
    obraTitulo: 'Reforma Vivienda Turística C/ Mayor',
    cliente: 'Inversiones Centro Capital SL',
    cifNif: 'B89012345',
    direccion: 'Calle Mayor 12, 2º Izq, Madrid',
    fechaEmision: '2026-08-28',
    fechaVencimiento: '2026-08-30',
    tipoFactura: 'Liquidación Final de Obra (100%)',
    trimestre: '3T',
    ano: 2026,
    baseImponible: 20000.00,
    tipoIvaPct: 10,
    cuotaIva: 2000.00,
    retencionIrpfPct: 0,
    cuotaRetencion: 0,
    totalFactura: 22000.00,
    estadoCobro: 'cobrada',
    fechaCobro: '2026-08-29',
    metodoPago: 'Transferencia bancaria Caixabank'
  }
];

export const INITIAL_FACTURAS_PROVEEDORES = [
  // Gastos / Facturas Recibidas para la Gestoría
  {
    id: 'gasto-1',
    numeroProveedor: 'OBM-2026-8812',
    proveedor: 'Obramat Alcorcón SL',
    cif: 'B82334455',
    concepto: 'Materiales albañilería: sacos mortero, cemento cola C2, pladur, perfiles',
    fecha: '2026-09-08',
    trimestre: '3T',
    ano: 2026,
    baseImponible: 2450.00,
    tipoIvaPct: 21,
    cuotaIva: 514.50,
    total: 2964.50,
    obraId: 'obra-1',
    categoria: 'Materiales'
  },
  {
    id: 'gasto-2',
    numeroProveedor: 'ELE-2026-099',
    proveedor: 'ElectroSur Instalaciones SL',
    cif: 'B81122334',
    concepto: 'Subcontrata electricidad fase 1 obra C/ Velázquez',
    fecha: '2026-09-20',
    trimestre: '3T',
    ano: 2026,
    baseImponible: 1850.00,
    tipoIvaPct: 21,
    cuotaIva: 388.50,
    total: 2238.50,
    obraId: 'obra-1',
    categoria: 'Subcontratas'
  },
  {
    id: 'gasto-3',
    numeroProveedor: 'SLK-2026-5541',
    proveedor: 'Saltoki Saneamientos SA',
    cif: 'A31298877',
    concepto: 'Tuberías multicapa, llaves de corte, accesorios de fontanería',
    fecha: '2026-10-04',
    trimestre: '4T',
    ano: 2026,
    baseImponible: 1420.00,
    tipoIvaPct: 21,
    cuotaIva: 298.20,
    total: 1718.20,
    obraId: 'obra-2',
    categoria: 'Materiales'
  },
  {
    id: 'gasto-4',
    numeroProveedor: 'CLT-2026-310',
    proveedor: 'ClimaTec Fontanería y Climatización',
    cif: 'B84455667',
    concepto: 'Certificación fontanería obra Av. Bruselas',
    fecha: '2026-10-10',
    trimestre: '4T',
    ano: 2026,
    baseImponible: 1600.00,
    tipoIvaPct: 21,
    cuotaIva: 336.00,
    total: 1936.00,
    obraId: 'obra-2',
    categoria: 'Subcontratas'
  },
  {
    id: 'gasto-5',
    numeroProveedor: 'ALQ-2026-10',
    proveedor: 'Inmuebles Industriales Madrid SL',
    cif: 'B28114499',
    concepto: 'Alquiler nave almacén y oficina constructora (con retención IRPF)',
    fecha: '2026-10-01',
    trimestre: '4T',
    ano: 2026,
    baseImponible: 950.00,
    tipoIvaPct: 21,
    cuotaIva: 199.50,
    retencionIrpfPct: 19,
    cuotaRetencion: 180.50,
    total: 969.00,
    obraId: null,
    categoria: 'Estructura / Alquiler'
  }
];

export const INITIAL_MENSAJES_INBOX = [
  {
    id: 'msg-1',
    tipo: 'audio',
    origen: 'WhatsApp Audio Obrero',
    remitente: 'Pedro Gómez (Oficial 1ª)',
    telefono: '+34 611 223 344',
    obraId: 'obra-1',
    obraTitulo: 'Reforma Integral Ático Velázquez',
    fecha: '2026-10-17 08:30',
    audioDuracion: '0:28',
    audioTranscripcion: 'Manuel, buenos días. Oye, te grabo nota de voz rápido: en la obra de Velázquez nos hemos quedado cortos con el cemento cola. Necesitamos urgente 6 sacos más de C2TE para terminar los ingletes del baño secundario y 2 bolsas de crucetas autonivelantes de 1.5mm. Además, convendría que el electricista pase mañana a primera hora porque ya dejamos los rozas cerradas. ¡Un saludo!',
    analisisIA: {
      remitenteDetectado: 'Obrero (Pedro Gómez)',
      obraDetectada: 'Reforma Integral Ático Velázquez',
      urgencia: 'Alta (Paralización parcial de fase)',
      necesidadesCalculadas: [
        { concepto: 'Sacos Cemento Cola C2TE porcelánico 25kg', cantidad: 6, unidad: 'sacos', costeAprox: 72 },
        { concepto: 'Bolsas crucetas autonivelantes 1.5mm (300 uds)', cantidad: 2, unidad: 'bolsas', costeAprox: 36 },
        { concepto: 'Aviso urgente a Subcontrata Electricidad (ElectroSur) para cierre de rozas', cantidad: 1, unidad: 'aviso', costeAprox: 0 }
      ],
      impactoPresupuesto: 108.00,
      accionSugerida: 'Pedir material a Obramat para entrega exprés en obra a las 11:00h y citar a ElectroSur.'
    },
    estadoProcesado: false
  },
  {
    id: 'msg-2',
    tipo: 'audio',
    origen: 'WhatsApp Audio Cliente',
    remitente: 'Dña. Elena Santamaría (Cliente)',
    telefono: '+34 655 890 123',
    obraId: 'obra-2',
    obraTitulo: 'Reforma Cocina y 2 Baños Av. Bruselas',
    fecha: '2026-10-16 19:15',
    audioDuracion: '0:42',
    audioTranscripcion: 'Hola Manuel, buenas tardes. Acabo de pasar con mi marido a ver cómo va la cocina en Avenida de Bruselas y nos encanta. Queríamos pedirte si podéis añadir dos enchufes adicionales en la encimera para la cafetera y la tostadora, y también si es posible poner una tira LED indirecta bajo los muebles altos de la cocina. Por favor dinos cuánto subiría el presupuesto para darte el ok.',
    analisisIA: {
      remitenteDetectado: 'Cliente (Dña. Elena Santamaría)',
      obraDetectada: 'Reforma Cocina y 2 Baños Av. Bruselas',
      urgencia: 'Media (Añadido de obra / Extra)',
      necesidadesCalculadas: [
        { concepto: '2 tomas dobles de enchufe estancas encimera con rozas y cableado', cantidad: 2, unidad: 'ud', costeAprox: 85, pvpCliente: 110 },
        { concepto: 'Perfil de aluminio con difusor y tira LED 24V bajo mueble alto (3.2m)', cantidad: 3.2, unidad: 'ml', costeAprox: 95, pvpCliente: 135 }
      ],
      impactoPresupuesto: 245.00,
      accionSugerida: 'Generar Partida Adicional de Modificación nº 1 por valor de 245,00€ + IVA y enviar por WhatsApp para aprobación.'
    },
    estadoProcesado: false
  },
  {
    id: 'msg-3',
    tipo: 'email',
    origen: 'Email Cliente',
    remitente: 'D. Javier Morales Benítez',
    email: 'j.morales@gmail.com',
    obraId: 'obra-1',
    obraTitulo: 'Reforma Integral Ático Velázquez',
    fecha: '2026-10-15 11:20',
    asunto: 'Consulta sobre mampara y grifería termostática baño suite',
    cuerpo: 'Estimado Manuel, estamos decidiendo con la decoradora el acabado de la grifería del baño principal. Hemos visto una grifería empotrada negro mate monomando termostática con rociador de techo de 30cm que nos gusta mucho. ¿Tenéis posibilidad de suministrarla vosotros e instalarla? Por favor confírmanos la diferencia de precio respecto al modelo estándar presupuestado.',
    analisisIA: {
      remitenteDetectado: 'Cliente (D. Javier Morales)',
      obraDetectada: 'Reforma Integral Ático Velázquez',
      urgencia: 'Normal',
      necesidadesCalculadas: [
        { concepto: 'Grifería termostática empotrada negro mate con rociador 30cm', cantidad: 1, unidad: 'ud', costeAprox: 310, pvpCliente: 420 },
        { concepto: 'Deducción grifería estándar presupuestada (-120€)', cantidad: 1, unidad: 'ud', costeAprox: -90, pvpCliente: -120 }
      ],
      impactoPresupuesto: 300.00,
      accionSugerida: 'Proponer opción de mejora por suplemento neto de 300€ + IVA.'
    },
    estadoProcesado: true
  }
];

export const INITIAL_SUBCONTRATAS_PRESUPUESTOS = [
  {
    id: 'subpres-1',
    subcontrata: 'ElectroSur Instalaciones SL',
    gremio: 'Electricidad',
    fecha: '2026-10-14',
    archivoNombre: 'Presupuesto_ElectroSur_Tarifas_Otoño2026.pdf',
    estado: 'analizado', // pendiente, analizado, aplicado
    resumen: 'Actualización trimestral de precios con subida del +8% al +12% en tubos, cobre y mecanismos por incremento de costes de materias primas.',
    partidasDetectadas: [
      { codigo: 'ELE-01', concepto: 'Punto de luz sencillo o conmutado M-20', unidad: 'ud', precioAnterior: 28.00, nuevoPrecioSubcontrata: 32.00, variacionPct: 14.3, margenConfiguradoPct: 25, nuevoPvpCliente: 40.00 },
      { codigo: 'ELE-02', concepto: 'Toma de corriente con tierra Schuko 16A', unidad: 'ud', precioAnterior: 30.00, nuevoPrecioSubcontrata: 34.00, variacionPct: 13.3, margenConfiguradoPct: 25, nuevoPvpCliente: 42.50 },
      { codigo: 'ELE-03', concepto: 'Cuadro general IGA + protectores + 6 PIAS', unidad: 'ud', precioAnterior: 350.00, nuevoPrecioSubcontrata: 380.00, variacionPct: 8.6, margenConfiguradoPct: 25, nuevoPvpCliente: 475.00 },
      { codigo: 'ELE-04', concepto: 'Downlight empotrado LED 18W regulable', unidad: 'ud', precioAnterior: 19.50, nuevoPrecioSubcontrata: 22.00, variacionPct: 12.8, margenConfiguradoPct: 30, nuevoPvpCliente: 28.60 }
    ]
  },
  {
    id: 'subpres-2',
    subcontrata: 'DecorPint Madrid SL',
    gremio: 'Pintura',
    fecha: '2026-10-12',
    archivoNombre: 'Presupuesto_Alisados_Pintura_DecorPint.pdf',
    estado: 'pendiente',
    resumen: 'Oferta especial para alisado de gotelé y pintura plástica en interiores de reformas.',
    partidasDetectadas: [
      { codigo: 'PIN-01', concepto: 'Alisado de gotelé dos manos masilla + fijador', unidad: 'm²', precioAnterior: 10.50, nuevoPrecioSubcontrata: 12.00, variacionPct: 14.3, margenConfiguradoPct: 30, nuevoPvpCliente: 15.60 },
      { codigo: 'PIN-02', concepto: 'Pintura plástica lisa lavable mate 2 manos', unidad: 'm²', precioAnterior: 7.00, nuevoPrecioSubcontrata: 7.50, variacionPct: 7.1, margenConfiguradoPct: 30, nuevoPvpCliente: 9.75 }
    ]
  }
];

export const DEMO_PRESUPUESTO_AI_TEMPLATES = [
  {
    id: 'template-bano',
    nombre: 'Reforma Integral de Baño Moderno (5 a 7 m²)',
    descripcion: 'Demolición completa, saneamiento multicapa, plato ducha resina 120x80 con mampara, inodoro suspendido, alicatado porcelánico rectificado, falso techo con LED y pintura.',
    imagenEjemplo: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
    audioMuestraTexto: 'Reforma de baño de 5.5 metros cuadrados. Demoler alicatados y bañera antigua. Instalar plato de ducha de pizarra grafito de 140x80 con mampara fija perfil negro. Inodoro suspendido con cisterna oculta. Mover tomas de lavabo para mueble suspendido con doble seno. Alicatar paredes con porcelánico imitación mármol hasta el techo y suelo porcelánico imitación madera. Techo de pladur con 3 focos LED.',
    medicionesEstimadas: { superficieParedesM2: 24, superficieSueloM2: 5.5, puntosAgua: 5, puntosLuz: 4 },
    partidas: [
      { codigo: 'DEM-02', capitulo: 'Demoliciones', concepto: 'Picado de azulejos, desescombro de bañera y sanitarios antiguos con retirada a vertedero', cantidad: 29.5, unidad: 'm²', costeUnitario: 9.80, margenPct: 35, precioVenta: 13.23, total: 390.29 },
      { codigo: 'FON-01', capitulo: 'Fontanería', concepto: 'Puntos de agua fría y caliente multicapa (plato ducha, lavabo doble, inodoro suspendido)', cantidad: 5, unidad: 'ud', costeUnitario: 65.00, margenPct: 25, precioVenta: 81.25, total: 406.25 },
      { codigo: 'FON-03', capitulo: 'Fontanería', concepto: 'Instalación de plato de ducha resina pizarra grafito 140x80cm y mampara fija 100cm', cantidad: 1, unidad: 'ud', costeUnitario: 120.00, margenPct: 30, precioVenta: 156.00, total: 156.00 },
      { codigo: 'FON-04', capitulo: 'Fontanería', concepto: 'Montaje de cisterna empotrada Geberit Duofix con inodoro suspendido y pulsador negro', cantidad: 1, unidad: 'ud', costeUnitario: 160.00, margenPct: 25, precioVenta: 200.00, total: 200.00 },
      { codigo: 'ALB-02', capitulo: 'Albañilería', concepto: 'Falso techo continuo de pladur hidrófugo verde 13mm', cantidad: 5.5, unidad: 'm²', costeUnitario: 24.00, margenPct: 30, precioVenta: 31.20, total: 171.60 },
      { codigo: 'ALI-01', capitulo: 'Revestimientos', concepto: 'Alicatado porcelánico rectificado gran formato en paredes con colocación en traba', cantidad: 24, unidad: 'm²', costeUnitario: 26.00, margenPct: 30, precioVenta: 33.80, total: 811.20 },
      { codigo: 'ALI-02', capitulo: 'Revestimientos', concepto: 'Solado porcelánico imitación madera en suelo con rejuntado antihumedad', cantidad: 5.5, unidad: 'm²', costeUnitario: 24.50, margenPct: 30, precioVenta: 31.85, total: 175.18 },
      { codigo: 'ELE-01', capitulo: 'Electricidad', concepto: 'Puntos de luz para downlights empotrados estancos IP44 y toma para espejo retroiluminado', cantidad: 4, unidad: 'ud', costeUnitario: 32.00, margenPct: 25, precioVenta: 40.00, total: 160.00 },
      { codigo: 'PIN-02', capitulo: 'Pintura', concepto: 'Pintura plástica antimoho especial para baños en falso techo', cantidad: 5.5, unidad: 'm²', costeUnitario: 7.50, margenPct: 30, precioVenta: 9.75, total: 53.63 }
    ]
  },
  {
    id: 'template-cocina',
    nombre: 'Reforma de Cocina Abierta con Isla (14 m²)',
    descripcion: 'Demolición de tabique para unir a salón, fontanería para fregadero e isla con lavavajillas, enchufes reforzados para inducción y horno, alicatado frontal, suelo cerámico y foseado perimetral.',
    imagenEjemplo: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80',
    audioMuestraTexto: 'Cocina de 14 metros que queremos abrir al salón. Hay que demoler un tabique de 4 metros lineales. En la isla va la placa de inducción y tomas para pequeños electrodomésticos, y en la pared va el fregadero bajo encimera y lavavajillas. Suelo porcelánico imitación cemento pulido 80x80. Techo nuevo con fosa para iluminación LED cálida.',
    medicionesEstimadas: { superficieParedesM2: 32, superficieSueloM2: 14, tabiqueDemolerM2: 11, tomasElectricidad: 8 },
    partidas: [
      { codigo: 'DEM-01', capitulo: 'Demoliciones', concepto: 'Demolición de tabique entre cocina y salón, desescombro con contenedores', cantidad: 11, unidad: 'm²', costeUnitario: 12.50, margenPct: 35, precioVenta: 16.88, total: 185.68 },
      { codigo: 'DEM-02', capitulo: 'Demoliciones', concepto: 'Picado de azulejos antiguos y retirada de muebles de cocina antiguos', cantidad: 46, unidad: 'm²', costeUnitario: 9.80, margenPct: 35, precioVenta: 13.23, total: 608.58 },
      { codigo: 'ALB-02', capitulo: 'Albañilería', concepto: 'Falso techo continuo con foseado perimetral para luz indirecta', cantidad: 14, unidad: 'm²', costeUnitario: 24.00, margenPct: 30, precioVenta: 31.20, total: 436.80 },
      { codigo: 'FON-01', capitulo: 'Fontanería', concepto: 'Instalación fontanería multicapa para fregadero, lavavajillas y toma frigorífico americano', cantidad: 4, unidad: 'ud', costeUnitario: 65.00, margenPct: 25, precioVenta: 81.25, total: 325.00 },
      { codigo: 'ELE-02', capitulo: 'Electricidad', concepto: 'Líneas independientes de 6mm² para inducción y horno + 6 tomas para encimera e isla', cantidad: 8, unidad: 'ud', costeUnitario: 34.00, margenPct: 25, precioVenta: 42.50, total: 340.00 },
      { codigo: 'ALI-02', capitulo: 'Revestimientos', concepto: 'Solado porcelánico rectificado 80x80 en cocina nivelado con salón', cantidad: 14, unidad: 'm²', costeUnitario: 24.50, margenPct: 30, precioVenta: 31.85, total: 445.90 },
      { codigo: 'PIN-02', capitulo: 'Pintura', concepto: 'Pintura plástica lavable especial cocinas en techos y paredes no alicatadas', cantidad: 25, unidad: 'm²', costeUnitario: 7.50, margenPct: 30, precioVenta: 9.75, total: 243.75 }
    ]
  }
];
