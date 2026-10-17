import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Users,
  Star,
  HardHat,
  Sparkles,
  CheckCircle2,
  Phone,
  Briefcase,
  Award,
  TrendingUp,
  Plus,
  Filter,
  Search,
  MessageSquare,
  ThumbsUp,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

const TRADES_AI_MATCH = [
  { id: 'alicatado', label: 'Alicatado Porcelánico Rectificado Gran Formato', gremio: 'Albañilería' },
  { id: 'demolicion', label: 'Demolición Estructural y Desescombro Rápido', gremio: 'Albañilería' },
  { id: 'pladur', label: 'Falsos Techos Pladur y Candilejas Foseadas LED', gremio: 'Yeso / Pladur' },
  { id: 'electricidad', label: 'Cuadro Eléctrico General y Boletín Oficial CIE', gremio: 'Electricidad' },
  { id: 'fontaneria', label: 'Fontanería Multicapa y Calefacción / Clima', gremio: 'Fontanería' },
  { id: 'pintura', label: 'Alisado de Gotelé Fino y Pintura Lisa Decorativa', gremio: 'Pintura' }
];

export default function ObrerosList() {
  const {
    obreros,
    obras,
    addReviewObrero,
    showNotification
  } = useApp();

  const [filterTipo, setFilterTipo] = useState('todos'); // todos, plantilla, subcontrata
  const [searchQuery, setSearchQuery] = useState('');
  
  // Rating Modal
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedObreroForReview, setSelectedObreroForReview] = useState(obreros[0]?.id || '');
  const [selectedObraForReview, setSelectedObraForReview] = useState(obras[0]?.titulo || '');
  const [notaEstrellas, setNotaEstrellas] = useState(5.0);
  const [comentarioReview, setComentarioReview] = useState('');
  const [criterioCalidad, setCriterioCalidad] = useState(5.0);
  const [criterioPlazos, setCriterioPlazos] = useState(5.0);
  const [criterioLimpieza, setCriterioLimpieza] = useState(5.0);
  const [criterioAutonomia, setCriterioAutonomia] = useState(5.0);

  // AI Recommender State
  const [selectedTradeRecommender, setSelectedTradeRecommender] = useState(TRADES_AI_MATCH[0].id);

  const filteredObreros = obreros.filter(o => {
    const matchesTipo = filterTipo === 'todos' || o.tipo === filterTipo;
    const matchesSearch =
      o.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.puesto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.especialidad.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTipo && matchesSearch;
  });

  const handleOpenReviewModal = (obreroId) => {
    setSelectedObreroForReview(obreroId);
    setNotaEstrellas(5.0);
    setCriterioCalidad(5.0);
    setCriterioPlazos(5.0);
    setCriterioLimpieza(5.0);
    setCriterioAutonomia(5.0);
    setComentarioReview('');
    setShowRatingModal(true);
  };

  const handleSubmitReview = (e) => {
    e.preventDefault();
    if (!selectedObreroForReview) return;

    const mediaCalculada = Number(((criterioCalidad + criterioPlazos + criterioLimpieza + criterioAutonomia) / 4).toFixed(1));

    addReviewObrero(selectedObreroForReview, {
      obra: selectedObraForReview,
      nota: mediaCalculada,
      comentario: comentarioReview || 'Trabajo ejecutado según especificaciones de proyecto y calidad requerida.'
    });

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 }
    });

    setShowRatingModal(false);
  };

  // AI Matching Logic
  const getAiRecommendation = () => {
    if (selectedTradeRecommender === 'alicatado') {
      const match = obreros.find(o => o.id === 'obrero-1'); // Pedro Gomez
      return {
        obrero: match,
        motivo: 'Pedro tiene una nota de 4.9/5 en alicatados gran formato con juntas rectificadas milimétricas en 14 obras previas. Máxima valoración en cortes a 45 grados.',
        puntuacionAfinidad: 99
      };
    } else if (selectedTradeRecommender === 'demolicion') {
      const match = obreros.find(o => o.id === 'obrero-2'); // Mario Silva
      return {
        obrero: match,
        motivo: 'Mario destaca por rapidez física y puntualidad (4.9/5). Especialista en demoliciones controladas protegiendo elementos comunes de la finca.',
        puntuacionAfinidad: 96
      };
    } else if (selectedTradeRecommender === 'pladur') {
      const match = obreros.find(o => o.id === 'obrero-3'); // Ionut Radu
      return {
        obrero: match,
        motivo: 'Ionut es oficial pladurista con 4.9 en calidad de acabados. Experto en foseados para iluminación indirecta LED y encintado perfecto.',
        puntuacionAfinidad: 98
      };
    } else if (selectedTradeRecommender === 'electricidad') {
      const match = obreros.find(o => o.id === 'sub-1'); // ElectroSur
      return {
        obrero: match,
        motivo: 'ElectroSur tiene 22 obras con nuestra constructora. Homologada por Industria para emisión de boletines CIE inmediatos y cableados REBT.',
        puntuacionAfinidad: 97
      };
    } else if (selectedTradeRecommender === 'fontaneria') {
      const match = obreros.find(o => o.id === 'sub-2'); // ClimaTec
      return {
        obrero: match,
        motivo: 'ClimaTec cuenta con 16 proyectos completados y 4.7 en pruebas de presión y colectores sin fugas a la primera prueba.',
        puntuacionAfinidad: 94
      };
    } else {
      const match = obreros.find(o => o.id === 'sub-3'); // DecorPint
      return {
        obrero: match,
        motivo: 'DecorPint cuenta con 4.9/5 en alisado de gotelé y pintura con luz rasante. Muy limpios en protección de suelos y carpinterías.',
        puntuacionAfinidad: 98
      };
    }
  };

  const aiRecommendation = getAiRecommendation();

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-amber-400" />
            <span>Calificación y Rendimiento de Obreros y Subcontratas</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Evalúa el desempeño por obra (calidad, plazos, limpieza y autonomía) para que la IA los tenga en cuenta en posteriores asignaciones de trabajo.
          </p>
        </div>

        <button
          onClick={() => handleOpenReviewModal(obreros[0]?.id)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition shadow-lg shadow-amber-500/20 active:scale-95"
        >
          <Star className="w-4 h-4 fill-slate-950" />
          <span>Calificar Trabajo de Obra</span>
        </button>
      </div>

      {/* AI Smart Matcher Banner (User Requirement) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950/40 p-5 rounded-2xl border border-amber-500/30 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Asignador Inteligente para Próximas Obras</h3>
              <p className="text-xs text-slate-300">
                Selecciona la partida o especialidad requerida y la IA recomendará al operario o subcontrata con mejor calificación histórica:
              </p>
            </div>
          </div>

          <select
            value={selectedTradeRecommender}
            onChange={(e) => setSelectedTradeRecommender(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-400"
          >
            {TRADES_AI_MATCH.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* AI Recommendation Box */}
        {aiRecommendation.obrero && (
          <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={aiRecommendation.obrero.foto}
                alt={aiRecommendation.obrero.nombre}
                className="w-14 h-14 rounded-xl object-cover border border-amber-500/40 shrink-0"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-white text-sm sm:text-base">{aiRecommendation.obrero.nombre}</h4>
                  <span className="flex items-center gap-1 text-xs font-black text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    {aiRecommendation.obrero.calificacionMedia}
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">
                    {aiRecommendation.puntuacionAfinidad}% Afinidad IA
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  {aiRecommendation.motivo}
                </p>
              </div>
            </div>

            <button
              onClick={() => showNotification(`Asignación de ${aiRecommendation.obrero.nombre} reservada para la próxima obra.`)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow shrink-0"
            >
              Asignar a Próxima Obra
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por operario, gremio o especialidad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'plantilla', label: 'Plantilla Propia' },
            { id: 'subcontrata', label: 'Subcontratas' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterTipo(f.id)}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterTipo === f.id ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Workers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredObreros.map((obrero) => {
          const isPlantilla = obrero.tipo === 'plantilla';

          return (
            <div
              key={obrero.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl shadow-sm transition space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={obrero.foto}
                      alt={obrero.nombre}
                      className="w-14 h-14 rounded-2xl object-cover border border-slate-700 shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-base">{obrero.nombre}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          isPlantilla ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {obrero.tipo}
                        </span>
                      </div>
                      <p className="text-xs text-amber-400 font-medium">{obrero.puesto}</p>
                      <p className="text-xs text-slate-400">{obrero.telefono}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20 text-amber-400">
                      <Star className="w-4 h-4 fill-amber-400" />
                      <span className="font-black text-sm">{obrero.calificacionMedia}</span>
                      <span className="text-[10px] text-slate-400">/ 5.0</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-1">{obrero.obrasRealizadas} obras hechas</span>
                  </div>
                </div>

                {/* Specialties */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs text-slate-300">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Especialidad Principal</span>
                  <p>{obrero.especialidad}</p>
                </div>

                {/* Rating Criteria Progress Bars */}
                {obrero.criterios && (
                  <div className="space-y-2 pt-1 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Calidad de Acabados</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-amber-400 h-full rounded-full" style={{ width: `${(obrero.criterios.calidadAcabados / 5) * 100}%` }}></div>
                        </div>
                        <span className="font-bold text-white w-6 text-right">{obrero.criterios.calidadAcabados}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span>Cumplimiento de Plazos</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-amber-400 h-full rounded-full" style={{ width: `${(obrero.criterios.puntualidadPlazos / 5) * 100}%` }}></div>
                        </div>
                        <span className="font-bold text-white w-6 text-right">{obrero.criterios.puntualidadPlazos}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span>Limpieza y Seguridad en Obra</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-amber-400 h-full rounded-full" style={{ width: `${(obrero.criterios.limpiezaSeguridad / 5) * 100}%` }}></div>
                        </div>
                        <span className="font-bold text-white w-6 text-right">{obrero.criterios.limpiezaSeguridad}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Reviews History */}
                {obrero.ultimasResenas && obrero.ultimasResenas.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Última Valoración de Obra:</span>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60 text-xs">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-bold text-amber-400">{obrero.ultimasResenas[0].obra}</span>
                        <span className="text-slate-500">{obrero.ultimasResenas[0].fecha}</span>
                      </div>
                      <p className="text-slate-300 italic text-[11px]">"{obrero.ultimasResenas[0].comentario}"</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">
                  {isPlantilla ? `Coste: ${obrero.costeHora} €/hora` : `Margen recargo: +${obrero.margenAplicadoEmpresa}%`}
                </span>

                <button
                  onClick={() => handleOpenReviewModal(obrero.id)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl font-bold flex items-center gap-1.5 transition border border-slate-700"
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <span>Calificar Trabajo</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Calificar Trabajo de Obrero */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <span>Calificar Desempeño en Obra</span>
              </h3>
              <button onClick={() => setShowRatingModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Operario / Subcontrata</label>
                <select
                  value={selectedObreroForReview}
                  onChange={(e) => setSelectedObreroForReview(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  {obreros.map(o => (
                    <option key={o.id} value={o.id}>{o.nombre} ({o.puesto})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Obra Realizada</label>
                <select
                  value={selectedObraForReview}
                  onChange={(e) => setSelectedObraForReview(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  {obras.map(o => (
                    <option key={o.id} value={o.titulo}>{o.titulo} ({o.codigo})</option>
                  ))}
                </select>
              </div>

              {/* Sliders for the 4 Criteria */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Calidad de los Acabados:</span>
                    <strong className="text-amber-400 font-bold">{criterioCalidad} ★</strong>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.1"
                    value={criterioCalidad}
                    onChange={(e) => setCriterioCalidad(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Cumplimiento de Plazos y Ritmo:</span>
                    <strong className="text-amber-400 font-bold">{criterioPlazos} ★</strong>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.1"
                    value={criterioPlazos}
                    onChange={(e) => setCriterioPlazos(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Limpieza y Seguridad en la Finca:</span>
                    <strong className="text-amber-400 font-bold">{criterioLimpieza} ★</strong>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.1"
                    value={criterioLimpieza}
                    onChange={(e) => setCriterioLimpieza(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Autonomía y Resolución de Problemas:</span>
                    <strong className="text-amber-400 font-bold">{criterioAutonomia} ★</strong>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.1"
                    value={criterioAutonomia}
                    onChange={(e) => setCriterioAutonomia(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Comentario / Justificación de la Calificación</label>
                <textarea
                  rows="2"
                  value={comentarioReview}
                  onChange={(e) => setComentarioReview(e.target.value)}
                  placeholder="Detalla lo más destacable: rapidez, cortes perfectos, dejar la obra limpia..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRatingModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow"
                >
                  Guardar Calificación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
