import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Building2,
  HardHat,
  Mic,
  Calculator,
  Receipt,
  FileSpreadsheet,
  Users,
  Percent,
  RefreshCw,
  Sparkles,
  Smartphone,
  ShieldCheck,
  LogOut,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

export default function Sidebar({
  mobileOpen = false,
  onCloseMobile = () => {},
  collapsed = false,
  onToggleCollapse = () => {}
}) {
  const {
    activeTab,
    setActiveTab,
    obras,
    mensajesInbox,
    subcontratasPresupuestos,
    resetAllData,
    currentUser,
    logout,
    showNotification
  } = useApp();

  const [copiedLink, setCopiedLink] = useState(false);

  const activeObrasCount = obras.filter(o => o.estado === 'en_curso').length;
  const pendingInboxCount = mensajesInbox.filter(m => !m.estadoProcesado).length;
  const pendingSubPresCount = subcontratasPresupuestos.filter(s => s.estado === 'pendiente').length;

  const navSections = [
    {
      title: 'Operaciones',
      items: [
        {
          id: 'dashboard',
          label: 'Panel General',
          icon: Building2,
          desc: 'KPIs y estado global'
        },
        {
          id: 'obras',
          label: 'Obras y Reformas',
          icon: HardHat,
          badge: activeObrasCount,
          badgeColor: 'bg-emerald-500 text-slate-950',
          desc: 'Fases, costes y partes'
        },
        {
          id: 'inbox',
          label: 'Audio / Email IA',
          icon: Mic,
          badge: pendingInboxCount,
          badgeColor: 'bg-amber-500 text-slate-950',
          desc: 'Captura y transcripción'
        },
      ]
    },
    {
      title: 'Económico & Presupuestos',
      items: [
        {
          id: 'presupuestos',
          label: 'Presupuestos IA',
          icon: Calculator,
          isSpecial: true,
          desc: 'Generador y partidas'
        },
        {
          id: 'facturas',
          label: 'Facturación',
          icon: Receipt,
          desc: 'Emitidas, recibidas y certificaciones'
        },
        {
          id: 'gestoria',
          label: 'Gestoría & Trimestres',
          icon: FileSpreadsheet,
          desc: 'Modelos 303 / 130 AEAT'
        },
      ]
    },
    {
      title: 'Equipo & Subcontratas',
      items: [
        {
          id: 'obreros',
          label: 'RRHH & Nóminas',
          icon: Users,
          desc: 'Plantilla, sueldos y accesos'
        },
        {
          id: 'subcontratas',
          label: 'Subcontratas & PRL',
          icon: Percent,
          badge: pendingSubPresCount,
          badgeColor: 'bg-indigo-500 text-white',
          desc: 'Presupuestos y scoring'
        },
      ]
    },
    {
      title: 'Portal & Sistema',
      items: [
        {
          id: 'portal_obrero',
          label: 'Portal Obrero Móvil',
          icon: Smartphone,
          badge: 'PWA',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
          desc: 'Vista previa operario'
        },
        {
          id: 'empresa_config',
          label: 'Config. Fiscal & IA',
          icon: ShieldCheck,
          isSpecial: true,
          desc: 'Datos fiscales, API Key y usuarios'
        },
      ]
    }
  ];

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    onCloseMobile();
  };

  const handleCopyWorkerLink = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}#empleados`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    if (showNotification) {
      showNotification('Enlace al Portal Obrero copiado al portapapeles', 'success');
    }
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleOpenWorkerPortal = (e) => {
    e.stopPropagation();
    window.location.hash = '#empleados';
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 select-none">
      
      {/* 1. Header / Brand */}
      <div className={`p-4 border-b border-slate-800 flex items-center justify-between shrink-0 ${collapsed ? 'px-3 justify-center' : ''}`}>
        <div
          onClick={() => handleSelectTab('dashboard')}
          className="flex items-center gap-3 cursor-pointer group min-w-0"
          title="Ir al Panel General"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 shrink-0 group-hover:scale-105 transition-transform">
            <HardHat className="w-5 h-5 stroke-[2.4]" />
          </div>
          
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-amber-400 transition-colors">
                  ObraMaster
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded tracking-wider">
                  IA
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Gestión Integral de Obra</p>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Desktop collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex p-1.5 text-slate-500 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition"
          title={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* 2. Navigation Items (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {!collapsed && (
              <h3 className="px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-2">
                {section.title}
              </h3>
            )}
            
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    title={collapsed ? `${item.label} (${item.desc})` : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group relative ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
                        : item.isSpecial
                        ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80 font-medium'
                    } ${collapsed ? 'justify-center px-2 py-3' : ''}`}
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 transition-colors ${
                        isActive
                          ? 'text-slate-950 stroke-[2.3]'
                          : item.isSpecial
                          ? 'text-amber-400'
                          : 'text-slate-400 group-hover:text-amber-400'
                      }`}
                    />

                    {!collapsed && (
                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <span className="text-xs sm:text-sm truncate">
                          {item.label}
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {item.isSpecial && !isActive && (
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                          )}

                          {item.badge !== undefined && (typeof item.badge === 'string' || item.badge > 0) && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                isActive
                                  ? 'bg-slate-950 text-amber-400 font-black'
                                  : item.badgeColor || 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Active Indicator on collapsed mode */}
                    {collapsed && isActive && (
                      <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-amber-500 rounded-r-full"></span>
                    )}

                    {/* Tooltip on collapsed mode */}
                    {collapsed && (
                      <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-950 text-white text-xs font-semibold rounded-lg shadow-xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                        {item.label}
                        {item.badge ? ` (${item.badge})` : ''}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* 3. Worker App Shortcut Card (only when expanded) */}
        {!collapsed && (
          <div className="mt-4 pt-2">
            <div className="bg-gradient-to-br from-slate-800/90 to-slate-950/80 border border-amber-500/30 rounded-2xl p-3.5 shadow-md">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                    Portal Obrero PWA
                  </span>
                </div>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 font-mono px-1.5 py-0.5 rounded font-bold">
                  /#empleados
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3 leading-snug">
                Portal móvil independiente para partes diarios, fichajes y tareas de campo.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenWorkerPortal}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1 shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir App</span>
                </button>
                <button
                  onClick={handleCopyWorkerLink}
                  title="Copiar enlace directo"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1 border border-slate-700"
                >
                  {copiedLink ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Footer: User Session & Actions */}
      <div className={`p-3 border-t border-slate-800 bg-slate-900/95 shrink-0 ${collapsed ? 'px-2' : ''}`}>
        
        {!collapsed ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 bg-slate-800/70 p-2 rounded-xl border border-slate-700/60">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex items-center justify-center text-xs shrink-0">
                  {currentUser ? currentUser.fullName.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {currentUser ? currentUser.fullName : 'Administrador'}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">
                      {currentUser?.role === 'admin' ? 'Director de Obra' : currentUser?.role || 'Admin'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (window.confirm('¿Deseas cerrar la sesión del panel administrativo?')) {
                    logout();
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/80 rounded-lg transition shrink-0"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 px-1">
              <button
                onClick={resetAllData}
                className="hover:text-slate-300 flex items-center gap-1 transition"
                title="Restablecer datos de demostración"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reiniciar Demo</span>
              </button>
              <span className="text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                En Línea
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <div
              className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex items-center justify-center text-xs"
              title={`${currentUser?.fullName || 'Admin'} (${currentUser?.role || 'admin'})`}
            >
              {currentUser ? currentUser.fullName.charAt(0).toUpperCase() : 'A'}
            </div>
            <button
              onClick={() => {
                if (window.confirm('¿Deseas cerrar sesión?')) logout();
              }}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 h-screen sticky top-0 border-r border-slate-800 z-30 transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64 xl:w-72'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Overlay) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer content */}
          <aside className="relative flex flex-col w-72 max-w-[85vw] h-full shadow-2xl z-10 border-r border-slate-800">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
