import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Bell,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Check,
  CheckCheck,
  Clock,
  X,
  MapPin,
  User,
  Filter
} from 'lucide-react';

export default function AvisosTecnicosModal({
  isOpen = false,
  onClose = () => {},
  currentObrero = {},
  currentObraId = ''
}) {
  const {
    avisosTecnicos,
    marcarAvisoLeido,
    marcarTodosAvisosLeidos,
    obras
  } = useApp();

  const [activeFilter, setActiveFilter] = useState('todos'); // 'todos' | 'pendientes' | 'obra'

  if (!isOpen) return null;

  // Determine worker identifier for reading tracking
  const obreroIdentifier = currentObrero?.username ||
    currentObrero?.id ||
    (currentObrero?.nombre ? currentObrero.nombre.toLowerCase().replace(/\s+/g, '.') : 'operario');

  const isAvisoLeido = (aviso) => {
    const list = Array.isArray(aviso.leidoPor) ? aviso.leidoPor : [];
    return list.some(id =>
      id === obreroIdentifier ||
      id === currentObrero?.id ||
      id === currentObrero?.nombre ||
      id === currentObrero?.username
    );
  };

  const unreadCount = avisosTecnicos.filter(a => !isAvisoLeido(a)).length;

  // Filtered notices
  const filteredAvisos = avisosTecnicos.filter(aviso => {
    if (activeFilter === 'pendientes') {
      return !isAvisoLeido(aviso);
    }
    if (activeFilter === 'obra' && currentObraId) {
      return aviso.obraId === currentObraId;
    }
    return true;
  });

  const getPriorityStyle = (prioridad, tipo) => {
    if (prioridad === 'urgente' || tipo === 'seguridad') {
      return {
        badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        cardBorder: 'border-rose-500/40 bg-gradient-to-br from-rose-950/20 via-slate-900 to-slate-950',
        icon: ShieldAlert,
        iconColor: 'text-rose-400',
        label: 'Seguridad / PRL Urgente'
      };
    }
    if (prioridad === 'alta' || tipo === 'tecnico') {
      return {
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        cardBorder: 'border-amber-500/40 bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-950',
        icon: AlertTriangle,
        iconColor: 'text-amber-400',
        label: 'Instrucción Técnica'
      };
    }
    return {
      badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      cardBorder: 'border-slate-800 bg-slate-950/70',
      icon: Bell,
      iconColor: 'text-blue-400',
      label: 'Aviso Operativo'
    };
  };

  const formatFecha = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0 font-black">
              <Bell className="w-5 h-5 stroke-[2.3]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-base sm:text-lg">
                  Avisos Técnicos e Instrucciones
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-black uppercase bg-rose-500 text-white rounded-full whitespace-nowrap shrink-0">
                    {unreadCount} {unreadCount === 1 ? 'nuevo' : 'nuevos'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Comunicados de Dirección de Obra y Prevención (PRL)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition shrink-0"
            aria-label="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls & Bulk Action */}
        <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveFilter('todos')}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                activeFilter === 'todos'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Todos ({avisosTecnicos.length})
            </button>
            <button
              onClick={() => setActiveFilter('pendientes')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                activeFilter === 'pendientes'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>Pendientes</span>
              {unreadCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center font-black">
                  {unreadCount}
                </span>
              )}
            </button>
            {currentObraId && (
              <button
                onClick={() => setActiveFilter('obra')}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${
                  activeFilter === 'obra'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Esta Obra
              </button>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={() => marcarTodosAvisosLeidos(obreroIdentifier)}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-xl transition ml-auto"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Marcar todos leídos</span>
            </button>
          )}
        </div>

        {/* Notices Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800">
          {filteredAvisos.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-white text-sm">No hay avisos en esta sección</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                {activeFilter === 'pendientes'
                  ? '¡Perfecto! Has leído y confirmado todas las instrucciones técnicas y de seguridad.'
                  : 'No se han registrado avisos técnicos o incidencias para este filtro.'}
              </p>
            </div>
          ) : (
            filteredAvisos.map((aviso) => {
              const isRead = isAvisoLeido(aviso);
              const style = getPriorityStyle(aviso.prioridad, aviso.tipo);
              const Icon = style.icon;

              return (
                <div
                  key={aviso.id}
                  className={`p-4 rounded-2xl border transition-all ${style.cardBorder} ${
                    !isRead ? 'ring-2 ring-amber-500/30 shadow-lg' : 'opacity-90'
                  }`}
                >
                  {/* Top Bar of Notice */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-extrabold uppercase px-2 py-0.5 rounded-full border ${style.badgeBg}`}>
                        <Icon className="w-3 h-3" />
                        <span>{style.label}</span>
                      </span>

                      {aviso.obraCodigo && (
                        <span className="text-xs font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full">
                          {aviso.obraCodigo}
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-slate-400 font-mono flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{formatFecha(aviso.fecha)}</span>
                    </span>
                  </div>

                  {/* Title & Obra Title */}
                  <h4 className="font-extrabold text-white text-sm leading-snug mb-1">
                    {aviso.titulo}
                  </h4>

                  {aviso.obraTitulo && (
                    <p className="text-xs text-amber-400/90 font-medium flex items-center gap-1 mb-2.5">
                      <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="truncate">{aviso.obraTitulo}</span>
                    </p>
                  )}

                  {/* Description / Instruction Body */}
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-xs text-slate-200 leading-relaxed mb-3 whitespace-pre-wrap">
                    {aviso.descripcion}
                  </div>

                  {/* Footer & Acknowledgment Action */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
                    <div className="text-slate-400 flex items-center gap-1.5 min-w-0">
                      <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate font-medium">{aviso.emisor || 'Dirección de Obra'}</span>
                    </div>

                    <div>
                      {isRead ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-xl">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Leído</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => marcarAvisoLeido(aviso.id, obreroIdentifier)}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-xl shadow-md transition flex items-center gap-1.5 active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Confirmar Lectura</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="text-xs">
            Sesión activa como: <strong className="text-slate-300">{currentObrero.nombre}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
