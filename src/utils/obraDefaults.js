// Fases con las que nace una obra cuando no viene de un presupuesto.
export const fasesObraPorDefecto = () => {
  const t = Date.now();
  return [
    { id: `f-${t}-1`, nombre: 'Demoliciones y Desescombro', progreso: 0, estado: 'pendiente', dias: 4, responsable: 'Por asignar' },
    { id: `f-${t}-2`, nombre: 'Instalaciones (Fontanería y Luz)', progreso: 0, estado: 'pendiente', dias: 8, responsable: 'Por asignar' },
    { id: `f-${t}-3`, nombre: 'Albañilería y Alicatados', progreso: 0, estado: 'pendiente', dias: 10, responsable: 'Por asignar' },
    { id: `f-${t}-4`, nombre: 'Pintura y Carpinterías', progreso: 0, estado: 'pendiente', dias: 6, responsable: 'Por asignar' },
    { id: `f-${t}-5`, nombre: 'Limpieza y Entrega de Llaves', progreso: 0, estado: 'pendiente', dias: 2, responsable: 'Por asignar' }
  ];
};
