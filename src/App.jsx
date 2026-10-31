import React, { useState, useEffect, useLayoutEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { UiPreferencesProvider } from './context/UiPreferencesContext';
import { NotificationsProvider } from './context/NotificationsContext';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import Dashboard from './components/Dashboard';
import ObrasList from './components/Obras/ObrasList';
import AudioEmailInbox from './components/AudioInbox/AudioEmailInbox';
import PresupuestosList from './components/Presupuestos/PresupuestosList';
import FacturasList from './components/Facturas/FacturasList';
import GestoriaTrimestres from './components/Gestoria/GestoriaTrimestres';
import ObrerosList from './components/Obreros/ObrerosList';
import SubcontratasList from './components/Subcontratas/SubcontratasList';
import PortalObreroView from './components/PortalObrero/PortalObreroView';
import EmpresaConfig from './components/Configuracion/EmpresaConfig';
import AvisosCenter from './components/Avisos/AvisosCenter';
import SeguimientoObra from './components/Avance/SeguimientoObra';
import PdfModal from './components/Common/PdfModal';
import LoginObreroView from './components/Auth/LoginObreroView';
import LoginAdminModal from './components/Auth/LoginAdminModal';
import GlobalOverlays from './components/Common/GlobalOverlays';
import DeclaracionResponsableModal from './components/Common/DeclaracionResponsable';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

function getInitialRoute() {
  const hash = (window.location.hash || '').toLowerCase();
  const path = (window.location.pathname || '').toLowerCase();
  if (hash.includes('empleados') || path.includes('empleados') || hash.includes('obrero')) {
    return 'empleados';
  }
  return 'admin';
}

function MainLayout() {
  const { activeTab = 'dashboard', notification, currentUser, activeRealtimeAlert, authReady = true, facturacionActivada = false } = useApp() || {};
  const [route, setRoute] = useState(getInitialRoute);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [verDeclaracion, setVerDeclaracion] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('obramaster_sidebar_collapsed') === 'true';
  });

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('obramaster_sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  };

  // Cada sección se abre arriba, con la cabecera visible
  useLayoutEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch (e) {
      window.scrollTo(0, 0);
    }
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    document.querySelectorAll('main').forEach((el) => { el.scrollTop = 0; });
  }, [activeTab, route]);

  // Sync route on hashchange / popstate
  useEffect(() => {
    const handleLocationChange = () => {
      setRoute(getInitialRoute());
    };

    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // RBAC GUARD: If an obrero is logged in and navigates to admin, force redirect to #empleados
  useEffect(() => {
    if (currentUser?.role === 'obrero' && route !== 'empleados') {
      window.location.hash = '#empleados';
      setRoute('empleados');
    }
  }, [currentUser, route]);

  // Navigate to route helper
  const navigateTo = (newRoute) => {
    window.location.hash = newRoute === 'empleados' ? '#empleados' : '#admin';
    setRoute(newRoute);
  };

  // Mientras se comprueba si hay una sesión guardada, no se muestra ni el login ni los datos.
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center font-sans">
        <span className="text-sm font-semibold animate-pulse">Cargando ObraMaster…</span>
      </div>
    );
  }

  const overlays = <GlobalOverlays alert={activeRealtimeAlert} notification={notification} />;

  // ==========================================
  // CASE 1: WORKER ROUTE (/#empleados)
  // ==========================================
  if (route === 'empleados') {
    // If not logged in, show dedicated worker login
    if (!currentUser) {
      return (
        <LoginObreroView
          onSwitchToAdmin={() => navigateTo('admin')}
        />
      );
    }

    const isSupervisor = currentUser.role === 'admin';

    // Worker: 100% mobile isolated layout (NO admin navbar). Admin visiting #empleados sees a supervisor bar.
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
        {isSupervisor && (
          <div className="om-solid bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-md">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 stroke-[2.5] shrink-0" />
              <span className="truncate">Modo supervisor: ves el Portal Móvil con tu cuenta de administrador ({currentUser.fullName})</span>
            </div>
            <button
              onClick={() => navigateTo('admin')}
              className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-amber-400 font-bold rounded-lg transition flex items-center gap-1.5 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al panel</span>
            </button>
          </div>
        )}

        <main className="flex-1 w-full max-w-xl mx-auto p-3 sm:p-5">
          <PortalObreroView />
        </main>

        {!isSupervisor && (
          <footer className="text-center py-4 text-[11px] text-slate-500">
            ObraMaster Móvil · Sesión activa como {currentUser.fullName}
          </footer>
        )}

        {overlays}
      </div>
    );
  }

  // ==========================================
  // CASE 2: ADMIN ROUTE (/admin o #admin o #dashboard)
  // ==========================================
  const isAdminLoggedIn = currentUser && currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans selection:bg-amber-500 selection:text-slate-950">

      {/* Sin sesión de administrador: acceso obligatorio (sin botón de cerrar) */}
      {!isAdminLoggedIn && (
        <LoginAdminModal
          isOpen={true}
          onSwitchToWorker={() => navigateTo('empleados')}
        />
      )}

      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-slate-950">

        <TopHeader onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main key={activeTab} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 om-page-enter">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'obras' && <ObrasList />}
          {activeTab === 'avisos' && <AvisosCenter />}
          {activeTab === 'avance' && <SeguimientoObra />}
          {activeTab === 'inbox' && <AudioEmailInbox />}
          {activeTab === 'presupuestos' && <PresupuestosList />}
          {activeTab === 'facturas' && facturacionActivada && <FacturasList />}
          {activeTab === 'gestoria' && <GestoriaTrimestres />}
          {activeTab === 'obreros' && <ObrerosList />}
          {activeTab === 'subcontratas' && <SubcontratasList />}
          {activeTab === 'portal_obrero' && <PortalObreroView />}
          {activeTab === 'empresa_config' && <EmpresaConfig />}
        </main>

        <footer className="border-t border-slate-800 text-[11px] text-slate-500 py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-center">
            <span><strong className="font-bold text-slate-300">ObraMaster</strong> · Gestión integral para constructores y reformas</span>
            <span className="flex items-center gap-2">
              <span>Modelos 303/130 AEAT · REBT y LOE</span>
              {currentUser && (
                <button type="button" onClick={() => setVerDeclaracion(true)} className="underline decoration-dotted hover:text-slate-300">
                  Cumplimiento legal (VERI*FACTU)
                </button>
              )}
            </span>
          </div>
        </footer>
        {verDeclaracion && <DeclaracionResponsableModal onClose={() => setVerDeclaracion(false)} />}

      </div>

      {overlays}

      {/* Printable / Downloadable PDF Modal */}
      <PdfModal />

    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <UiPreferencesProvider>
        <NotificationsProvider>
          <MainLayout />
        </NotificationsProvider>
      </UiPreferencesProvider>
    </AppProvider>
  );
}
