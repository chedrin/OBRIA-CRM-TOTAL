import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App.jsx';
import SubcontrataPortal from './components/PortalSubcontrata/SubcontrataPortal.jsx';
import { registerServiceWorker } from './services/pushService';
import './index.css';

// /sub/<token>: página del enlace mágico para subcontratas (sin login ni datos de la app).
const isSubcontractorLink = window.location.pathname.startsWith('/sub/');

// Service worker de notificaciones push (solo en la app, no en la página de subcontratas).
if (!isSubcontractorLink) registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* reducedMotion="user": sin animaciones si el sistema pide reducir movimiento. */}
    <MotionConfig reducedMotion="user">
      {isSubcontractorLink ? <SubcontrataPortal /> : <App />}
    </MotionConfig>
  </React.StrictMode>
);
