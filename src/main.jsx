import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import SubcontrataPortal from './components/PortalSubcontrata/SubcontrataPortal.jsx';
import './index.css';

// /sub/<token>: página del enlace mágico para subcontratas (sin login ni datos de la app).
const isSubcontractorLink = window.location.pathname.startsWith('/sub/');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isSubcontractorLink ? <SubcontrataPortal /> : <App />}
  </React.StrictMode>
);
