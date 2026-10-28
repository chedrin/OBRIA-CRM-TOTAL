import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { NAV_SECTIONS, NAV_TONES } from './navigation/navConfig';
import {
  HardHat,
  LogOut,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Smartphone
} from 'lucide-react';

// Microbadge de estado (número de obras activas, facturas pendientes...).
function NavBadge({ value, tone, active, title }) {
  if (value === undefined || value === null || value === 0 || value === '') return null;
  return (
    <span
      title={title}
      className={`min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center rounded-full text-[10px] font-bold tabular-nums transition-colors ${
        active ? `${NAV_TONES[tone].bar} om-solid text-white` : 'bg-slate-800 text-slate-300 border border-slate-700'
      }`}
    >
      {value}
    </span>
  );
}

export default function Sidebar({
  mobileOpen = false,
  onCloseMobile = () => {},
  collapsed = false,
  onToggleCollapse = () => {}
}) {
  const {
    activeTab,
    setActiveTab,
    obras = [],
    presupuestos = [],
    facturas = [],
    mensajesInbox = [],
    subcontratasPresupuestos = [],
    currentUser,
    logout,
    showNotification,
    facturacionActivada
  } = useApp();

  const [copiedLink, setCopiedLink] = useState(false);

  const badges = {
    obras: {
      value: obras.filter(o => o.estado === 'en_curso').length,
      title: 'Obras en curso'
    },
    inbox: {
      value: mensajesInbox.filter(m => !m.estadoProcesado).length,
      title: 'Mensajes sin procesar'
    },
    presupuestos: {
      value: presupuestos.filter(p => ['borrador', 'borrador_ia', 'enviado_cliente'].includes(p.estado)).length,
      title: 'Presupuestos pendientes de aceptar'
    },
    facturas: {
      value: facturas.filter(f => f.estadoCobro === 'pendiente').length,
      title: 'Facturas pendientes de cobro'
    },
    subcontratas: {
      value: subcontratasPresupuestos.filter(s => s.estado === 'pendiente').length,
      title: 'Ofertas de subcontratas pendientes'
    }
  };

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

  const handleLogout = () => {
    if (window.confirm('¿Deseas cerrar la sesión del panel administrativo?')) logout();
  };

  const initial = currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'A';
  const roleLabel = currentUser?.role === 'admin' ? 'Director de obra' : currentUser?.role || 'Admin';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 select-none">

      {/* Marca */}
      <div className={`h-16 px-4 border-b border-slate-800 flex items-center shrink-0 ${collapsed ? 'justify-center px-2' : 'justify-between'}`}>
        <button
          type="button"
          onClick={() => handleSelectTab('dashboard')}
          className="flex items-center gap-3 group min-w-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
          title="Ir al Panel General"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/25 shrink-0 transition-transform duration-200 group-hover:scale-105">
            <HardHat className="w-5 h-5 stroke-[2.3]" />
          </div>
          {!collapsed && (
            <div className="min-w-0 text-left">
              <span className="block font-extrabold text-[15px] tracking-tight text-white leading-tight">ObraMaster</span>
              <span className="block text-[11px] text-slate-500 truncate">Gestión integral de obra</span>
            </div>
          )}
        </button>

        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navegación */}
      <nav aria-label="Menú principal" className={`flex-1 overflow-y-auto py-4 space-y-5 ${collapsed ? 'px-2' : 'px-3'}`}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            {!collapsed ? (
              <h3 className="px-3 mb-1.5 text-[10px] font-bold tracking-[0.12em] text-slate-500 uppercase">
                {section.title}
              </h3>
            ) : (
              <div className="mx-3 mb-2 border-t border-slate-800" />
            )}

            <div className="space-y-0.5">
              {section.items.filter((item) => item.id !== 'facturas' || facturacionActivada).map((item) => {
                const Icon = item.icon;
                const tone = NAV_TONES[item.tone];
                const isActive = activeTab === item.id;
                const badge = badges[item.id];

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    title={collapsed ? `${item.label} · ${item.desc}` : undefined}
                    className={`group relative w-full flex items-center gap-3 rounded-xl text-left transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 ${tone.ring} ${
                      collapsed ? 'justify-center p-2' : 'px-2 py-1.5'
                    } ${
                      isActive
                        ? 'bg-slate-800 shadow-sm'
                        : 'hover:bg-slate-800/70 hover:translate-x-0.5'
                    }`}
                  >
                    {/* Indicador del módulo activo */}
                    <span
                      className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full ${tone.bar} transition-all duration-300 ease-out ${
                        isActive ? 'h-6 opacity-100' : 'h-0 opacity-0'
                      } ${collapsed ? '-left-2' : '-left-3'}`}
                    />

                    <span
                      className={`relative w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-200 ${
                        isActive ? `${tone.tileActive} shadow-md` : `${tone.tile} group-hover:scale-105`
                      }`}
                    >
                      <Icon className="w-[18px] h-[18px] stroke-[2.1]" />
                      {collapsed && badge?.value > 0 && (
                        <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${tone.bar} ring-2 ring-slate-900`} />
                      )}
                    </span>

                    {!collapsed && (
                      <span className="flex-1 min-w-0">
                        <span className={`block text-[13px] leading-tight truncate ${isActive ? 'font-bold text-white' : 'font-semibold text-slate-200 group-hover:text-white'}`}>
                          {item.label}
                        </span>
                        <span className="block text-[11px] leading-tight text-slate-500 truncate mt-0.5">
                          {item.desc}
                        </span>
                      </span>
                    )}

                    {!collapsed && badge && (
                      <NavBadge value={badge.value} tone={item.tone} active={isActive} title={badge.title} />
                    )}

                    {/* Tooltip en modo contraído */}
                    {collapsed && (
                      <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xl border border-slate-700 whitespace-nowrap opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-150 z-50">
                        {item.label}
                        {badge?.value ? ` · ${badge.value}` : ''}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Acceso al Portal Obrero */}
        {!collapsed && (
          <div className="mx-1 p-3.5 rounded-2xl border border-slate-800 bg-slate-950">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-white">Portal Obrero</span>
              <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                PWA
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2.5 leading-snug">
              Partes diarios, fichajes y tareas desde el móvil.
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleOpenWorkerPortal}
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir</span>
              </button>
              <button
                onClick={handleCopyWorkerLink}
                title="Copiar enlace directo"
                aria-label="Copiar enlace del Portal Obrero"
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs py-1.5 px-2.5 rounded-lg transition border border-slate-700"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Sesión */}
      <div className={`p-3 border-t border-slate-800 shrink-0 ${collapsed ? 'px-2' : ''}`}>
        <div className={`flex items-center gap-2.5 rounded-xl transition ${collapsed ? 'flex-col' : 'p-1.5 hover:bg-slate-800/70'}`}>
          <div
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shrink-0"
            title={collapsed ? `${currentUser?.fullName || 'Administrador'} (${roleLabel})` : undefined}
          >
            {initial}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{currentUser?.fullName || 'Administrador'}</p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {roleLabel}
              </p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition shrink-0"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={onToggleCollapse}
          className={`hidden lg:flex mt-2 w-full items-center gap-2 text-[11px] font-semibold text-slate-500 hover:text-slate-200 hover:bg-slate-800/70 rounded-lg py-1.5 transition ${collapsed ? 'justify-center' : 'px-2'}`}
          title={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
          aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Contraer menú</span></>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Escritorio */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 h-screen sticky top-0 border-r border-slate-800 z-30 transition-[width] duration-300 ease-out ${
          collapsed ? 'w-20' : 'w-64 xl:w-72'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Móvil: cajón deslizante */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Menú de navegación">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in"
            onClick={onCloseMobile}
          />
          <aside className="relative flex flex-col w-72 max-w-[85vw] h-full shadow-2xl z-10 border-r border-slate-800 om-drawer-enter">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
