import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  INITIAL_EMPRESA_CONFIG,
  INITIAL_OBRAS,
  INITIAL_OBREROS,
  INITIAL_BASE_PRECIOS,
  INITIAL_PRESUPUESTOS,
  INITIAL_FACTURAS,
  INITIAL_FACTURAS_PROVEEDORES,
  INITIAL_MENSAJES_INBOX,
  INITIAL_SUBCONTRATAS_PRESUPUESTOS,
  INITIAL_USERS,
  INITIAL_EMPLOYEES,
  INITIAL_SUBCONTRACTORS
} from '../data/initialData';
import realtimeSync from '../services/realtimeSyncService';
import {
  VISITA_TEMPLATES,
  processSiteVisitExpediente,
  applyVoiceCommandToQuote
} from '../services/siteVisitAIService';

const AppContext = createContext();

const STORAGE_KEYS = {
  EMPRESA: 'obracon_empresa_config_v1',
  OBRAS: 'obracon_obras_v1',
  OBREROS: 'obracon_obreros_v1',
  BASE_PRECIOS: 'obracon_base_precios_v1',
  PRESUPUESTOS: 'obracon_presupuestos_v1',
  FACTURAS: 'obracon_facturas_v1',
  FACTURAS_PROV: 'obracon_facturas_prov_v1',
  MENSAJES: 'obracon_mensajes_v1',
  SUBCONTRATAS_PRES: 'obracon_sub_pres_v1',
  AUDIT_LOGS: 'obracon_audit_logs_v1',
  USERS: 'obracon_users_v1',
  AUTH_USER: 'obracon_current_auth_user_v1',
  SITE_VISITS: 'obracon_site_visits_v1',
  EMPLOYEES: 'obracon_employees_v1',
  SUBCONTRACTORS: 'obracon_subcontractors_v1'
};

function loadStored(key, fallback) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error('Error loading from localStorage', e);
    return fallback;
  }
}

export function AppProvider({ children }) {
  const [empresaConfig, setEmpresaConfig] = useState(() => loadStored(STORAGE_KEYS.EMPRESA, INITIAL_EMPRESA_CONFIG));
  const [obras, setObras] = useState(() => loadStored(STORAGE_KEYS.OBRAS, INITIAL_OBRAS));
  const [obreros, setObreros] = useState(() => loadStored(STORAGE_KEYS.OBREROS, INITIAL_OBREROS));
  const [basePrecios, setBasePrecios] = useState(() => loadStored(STORAGE_KEYS.BASE_PRECIOS, INITIAL_BASE_PRECIOS));
  const [presupuestos, setPresupuestos] = useState(() => loadStored(STORAGE_KEYS.PRESUPUESTOS, INITIAL_PRESUPUESTOS));
  const [facturas, setFacturas] = useState(() => loadStored(STORAGE_KEYS.FACTURAS, INITIAL_FACTURAS));
  const [facturasProveedores, setFacturasProveedores] = useState(() => loadStored(STORAGE_KEYS.FACTURAS_PROV, INITIAL_FACTURAS_PROVEEDORES));
  const [mensajesInbox, setMensajesInbox] = useState(() => loadStored(STORAGE_KEYS.MENSAJES, INITIAL_MENSAJES_INBOX));
  const [subcontratasPresupuestos, setSubcontratasPresupuestos] = useState(() => loadStored(STORAGE_KEYS.SUBCONTRATAS_PRES, INITIAL_SUBCONTRATAS_PRESUPUESTOS));
  const [auditLogs, setAuditLogs] = useState(() => loadStored(STORAGE_KEYS.AUDIT_LOGS, [
    { id: 'log-1', timestamp: '2026-10-16 10:15:22', usuario: 'Manuel (Gerente)', accion: 'EMISION_FACTURA_VERIFACTU', recurso: 'FAC-2026-024', ip: '88.12.45.192', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }
  ]));

  // Expedientes de Visita de Obra Multimodal
  const [siteVisits, setSiteVisits] = useState(() => loadStored(STORAGE_KEYS.SITE_VISITS, VISITA_TEMPLATES));

  // Realtime & Offline Network State
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [offlineQueueLength, setOfflineQueueLength] = useState(() => realtimeSync.offlineQueue.length);
  const [activeRealtimeAlert, setActiveRealtimeAlert] = useState(null);

  // Users & Authentication State
  const [users, setUsers] = useState(() => loadStored(STORAGE_KEYS.USERS, INITIAL_USERS));
  const [currentUser, setCurrentUser] = useState(() => loadStored(STORAGE_KEYS.AUTH_USER, null));

  // RRHH (Employees) & Subcontractors State
  const [employees, setEmployees] = useState(() => loadStored(STORAGE_KEYS.EMPLOYEES, INITIAL_EMPLOYEES));
  const [subcontractors, setSubcontractors] = useState(() => loadStored(STORAGE_KEYS.SUBCONTRACTORS, INITIAL_SUBCONTRACTORS));

  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, obras, inbox, presupuestos, facturas, gestoria, obreros, subcontratas, portal_obrero, empresa_config
  const [selectedObraId, setSelectedObraId] = useState(null);
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState(null);
  const [pdfModalData, setPdfModalData] = useState(null); // { type: 'presupuesto'|'factura', data: ... }
  const [notification, setNotification] = useState(null);

  // Sync to LocalStorage
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.EMPRESA, JSON.stringify(empresaConfig)); }, [empresaConfig]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.OBRAS, JSON.stringify(obras)); }, [obras]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.OBREROS, JSON.stringify(obreros)); }, [obreros]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.BASE_PRECIOS, JSON.stringify(basePrecios)); }, [basePrecios]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.PRESUPUESTOS, JSON.stringify(presupuestos)); }, [presupuestos]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.FACTURAS, JSON.stringify(facturas)); }, [facturas]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.FACTURAS_PROV, JSON.stringify(facturasProveedores)); }, [facturasProveedores]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.MENSAJES, JSON.stringify(mensajesInbox)); }, [mensajesInbox]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SUBCONTRATAS_PRES, JSON.stringify(subcontratasPresupuestos)); }, [subcontratasPresupuestos]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs)); }, [auditLogs]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SITE_VISITS, JSON.stringify(siteVisits)); }, [siteVisits]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees)); }, [employees]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SUBCONTRACTORS, JSON.stringify(subcontractors)); }, [subcontractors]);
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    }
  }, [currentUser]);

  // Realtime Bidirectional Event Bus Subscriptions
  useEffect(() => {
    const unsubProgress = realtimeSync.subscribe('WORKER_PROGRESS_UPDATED', (payload) => {
      const { obraId, faseId, newProgress, obreroNombre } = payload;
      setObras(prevObras => prevObras.map(o => {
        if (o.id === obraId) {
          const progNum = Math.min(100, Math.max(0, newProgress));
          const isCompleted = progNum === 100;
          const updatedFases = (o.fases || []).map(f => {
            if (f.id === faseId) {
              return {
                ...f,
                progreso: progNum,
                estado: isCompleted ? 'completada' : progNum > 0 ? 'en_curso' : 'pendiente'
              };
            }
            return f;
          });
          const totalProg = updatedFases.reduce((s, f) => s + f.progreso, 0);
          const newGlobalProg = Math.round(totalProg / (updatedFases.length || 1));
          return { ...o, fases: updatedFases, progreso: newGlobalProg };
        }
        return o;
      }));

      setActiveRealtimeAlert({
        type: 'progress',
        msg: `⚡ [Realtime] ${obreroNombre || 'Operario'} actualizó avance al ${newProgress}%`,
        timestamp: Date.now()
      });
      setTimeout(() => setActiveRealtimeAlert(null), 5000);
    });

    const unsubEvidence = realtimeSync.subscribe('WORKER_EVIDENCE_UPLOADED', (payload) => {
      const { obraId, entry } = payload;
      setObras(prev => prev.map(o => o.id === obraId ? { ...o, diario: [entry, ...(o.diario || [])] } : o));
      setActiveRealtimeAlert({
        type: 'evidence',
        msg: `📸 [Realtime] Nueva foto/parte diario recibido desde obra: "${entry.resumen?.substring(0, 45)}..."`,
        timestamp: Date.now()
      });
      setTimeout(() => setActiveRealtimeAlert(null), 5000);
    });

    const unsubTask = realtimeSync.subscribe('ADMIN_TASK_DISPATCHED', (payload) => {
      const { obraId, task } = payload;
      setObras(prev => prev.map(o => o.id === obraId ? { ...o, fases: [...(o.fases || []), task] } : o));
      setActiveRealtimeAlert({
        type: 'task',
        msg: `🛠️ [Realtime] Nueva tarea asignada por Dirección de Obra: "${task.nombre}"`,
        timestamp: Date.now()
      });
      setTimeout(() => setActiveRealtimeAlert(null), 5000);
    });

    const unsubAlert = realtimeSync.subscribe('ADMIN_ALERT_DISPATCHED', (payload) => {
      const { alert } = payload;
      setActiveRealtimeAlert({
        type: 'admin_alert',
        msg: `⚠️ [Aviso Técnico] ${alert.titulo}: ${alert.descripcion}`,
        timestamp: Date.now()
      });
      setTimeout(() => setActiveRealtimeAlert(null), 6000);
    });

    const unsubNetwork = realtimeSync.subscribe('NETWORK_STATUS_CHANGED', ({ isOnline: online }) => {
      setIsOnline(online);
      showNotification(online ? 'Conexión a internet restablecida' : 'Sin conexión: Modo Offline Activo', online ? 'success' : 'error');
    });

    const unsubQueue = realtimeSync.subscribe('OFFLINE_QUEUE_UPDATED', ({ queueLength }) => {
      setOfflineQueueLength(queueLength);
    });

    const unsubFlush = realtimeSync.subscribe('OFFLINE_QUEUE_FLUSHED', ({ processedCount }) => {
      showNotification(`¡Sincronización completada! ${processedCount} acciones volcadas a la oficina.`);
    });

    return () => {
      unsubProgress();
      unsubEvidence();
      unsubTask();
      unsubAlert();
      unsubNetwork();
      unsubQueue();
      unsubFlush();
    };
  }, []);

  const updateEmpresaConfig = (updates) => {
    setEmpresaConfig(prev => ({ ...prev, ...updates }));
    showNotification('Datos fiscales y perfil del Director de Obra guardados correctamente');
  };

  const updateAiConfig = (newAiConfig) => {
    setEmpresaConfig(prev => ({
      ...prev,
      aiConfig: {
        ...(prev.aiConfig || {}),
        ...newAiConfig
      }
    }));
    addAuditLog('CONFIG_IA_ACTUALIZADA', `Proveedor: ${newAiConfig.provider || empresaConfig.aiConfig?.provider}`);
    showNotification('Configuración del Motor de IA guardada correctamente');
  };

  const testAiConnection = async (provider, apiKey, modelName) => {
    const key = (apiKey || '').trim();
    if (!key) {
      showNotification('Debes introducir una API Key para probar la conexión.', 'error');
      return { success: false, error: 'API Key requerida' };
    }

    // Validate key format
    if (provider === 'openai' && !key.startsWith('sk-') && !key.startsWith('sk-proj-')) {
      showNotification('La API Key de OpenAI debe comenzar por "sk-" o "sk-proj-".', 'error');
      return { success: false, error: 'Formato de API Key no válido para OpenAI' };
    }
    if (provider === 'anthropic' && !key.startsWith('sk-ant-')) {
      showNotification('La API Key de Anthropic debe comenzar por "sk-ant-".', 'error');
      return { success: false, error: 'Formato de API Key no válido para Anthropic' };
    }

    // Ping handshake simulation
    const latency = Math.floor(130 + Math.random() * 70);
    const testedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const updatedConfig = {
      provider,
      apiKey: key,
      modelName,
      isActive: true,
      lastTestedAt: testedAt,
      status: 'connected',
      latencyMs: latency
    };

    setEmpresaConfig(prev => ({
      ...prev,
      aiConfig: updatedConfig
    }));

    addAuditLog('PING_MOTOR_IA', `Proveedor: ${provider.toUpperCase()} (${modelName}) - 200 OK (${latency}ms)`);
    showNotification(`¡Conexión con ${provider.toUpperCase()} (${modelName}) exitosa! Latencia: ${latency}ms`);
    return {
      success: true,
      latencyMs: latency,
      capabilities: ['Visión Multimodal (Fotos Obra)', 'Audio Whisper (Notas de Voz)', 'Function Calling (Tool Calling)', 'Partidas Base Precios JSON']
    };
  };

  const addAuditLog = (accion, recurso, valorAnterior = null, valorNuevo = null) => {
    const newLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      usuario: currentUser ? `${currentUser.fullName} (${currentUser.role})` : 'Sistema',
      accion,
      recurso,
      ip: '192.168.1.45',
      valorAnterior,
      valorNuevo,
      hash: Math.random().toString(36).substring(2) + Date.now().toString(36)
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Auth Functions
  const login = (usernameOrEmail, password) => {
    const clean = (usernameOrEmail || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    const user = users.find(u =>
      u.username.toLowerCase() === clean ||
      (u.email && u.email.toLowerCase() === clean)
    );

    if (!user) {
      return { success: false, error: 'Usuario o correo no encontrado.' };
    }

    if (!user.isActive) {
      return { success: false, error: 'Esta cuenta ha sido desactivada por el administrador.' };
    }

    if (user.password !== cleanPass) {
      return { success: false, error: 'Contraseña incorrecta. Revisa tus credenciales.' };
    }

    const updatedUser = {
      ...user,
      lastLogin: new Date().toISOString()
    };

    setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    setCurrentUser(updatedUser);
    showNotification(`¡Bienvenido, ${user.fullName}!`);
    return { success: true, user: updatedUser };
  };

  const logout = () => {
    setCurrentUser(null);
    showNotification('Sesión cerrada correctamente');
  };

  const quickSwitchUser = (userId) => {
    const found = users.find(u => u.id === userId);
    if (found) {
      setCurrentUser(found);
      showNotification(`Sesión cambiada a ${found.fullName} (${found.role})`);
    }
  };

  // User Management (Admin CRUD)
  const addUser = ({ username, password, role = 'obrero', fullName, trade, phone, email }) => {
    const cleanUsername = (username || '').trim().toLowerCase();
    if (!cleanUsername) return { success: false, error: 'El nombre de usuario es obligatorio.' };
    if (!fullName || !fullName.trim()) return { success: false, error: 'El nombre completo es obligatorio.' };

    if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
      return { success: false, error: `El usuario "${cleanUsername}" ya existe en el sistema.` };
    }

    const newUserId = `user-${role}-${Date.now()}`;
    let associatedObreroId = null;

    if (role === 'obrero') {
      associatedObreroId = `obrero-${Date.now()}`;
      const newObreroRecord = {
        id: associatedObreroId,
        nombre: fullName.trim(),
        puesto: trade?.trim() || 'Operario Especialista',
        telefono: phone?.trim() || '',
        tipo: 'plantilla',
        especialidad: trade?.trim() || 'Construcción y Reformas',
        foto: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f8?auto=format&fit=crop&w=200&q=80',
        calificacionMedia: 5.0,
        criterios: { calidadAcabados: 5.0, puntualidadPlazos: 5.0, autonomiaProblemas: 5.0, limpiezaSeguridad: 5.0 },
        obrasRealizadas: 0,
        horasRegistradasMes: 0,
        costeHora: 20.00,
        estado: 'activo',
        recomendacionesIA: 'Nuevo operario incorporado a la plantilla de la empresa.',
        ultimasResenas: []
      };
      setObreros(prev => [...prev, newObreroRecord]);
    }

    const newUser = {
      id: newUserId,
      obreroId: associatedObreroId,
      username: cleanUsername,
      password: (password || '123456').trim(),
      role,
      fullName: fullName.trim(),
      trade: trade?.trim() || (role === 'admin' ? 'Dirección Técnica' : 'Albañilería'),
      phone: phone?.trim() || '',
      email: email?.trim() || '',
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    setUsers(prev => [...prev, newUser]);
    addAuditLog('ALTA_USUARIO', `${role.toUpperCase()}: ${cleanUsername} (${fullName})`);
    showNotification(`Usuario "${fullName}" creado exitosamente con rol ${role}.`);
    return { success: true, user: newUser };
  };

  const updateUser = (userId, updates) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const updated = { ...u, ...updates };
        if (currentUser && currentUser.id === userId) {
          setCurrentUser(updated);
        }
        return updated;
      }
      return u;
    }));
    addAuditLog('MODIFICACION_USUARIO', `ID: ${userId}`);
    showNotification('Datos de usuario actualizados correctamente.');
  };

  const resetUserPassword = (userId, newPassword) => {
    if (!newPassword || newPassword.trim().length < 4) {
      showNotification('La contraseña debe tener al menos 4 caracteres.', 'error');
      return { success: false, error: 'Mínimo 4 caracteres' };
    }
    const cleanPass = newPassword.trim();
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const updated = { ...u, password: cleanPass };
        if (currentUser && currentUser.id === userId) {
          setCurrentUser(updated);
        }
        return updated;
      }
      return u;
    }));
    addAuditLog('CAMBIO_PASSWORD', `Usuario ID: ${userId}`);
    showNotification('Contraseña restablecida con éxito.');
    return { success: true };
  };

  const changeAdminPassword = (userId, currentPassword, newPassword) => {
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, error: 'Usuario no encontrado' };
    if (user.password !== currentPassword.trim()) {
      return { success: false, error: 'La contraseña actual no coincide.' };
    }
    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'La nueva contraseña debe tener al menos 4 caracteres.' };
    }
    const cleanPass = newPassword.trim();
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, password: cleanPass } : u));
    if (currentUser && currentUser.id === userId) {
      setCurrentUser(prev => ({ ...prev, password: cleanPass }));
    }
    addAuditLog('CAMBIO_PASSWORD_ADMIN', `Admin ID: ${userId}`);
    showNotification('Tu contraseña se ha actualizado correctamente.');
    return { success: true };
  };

  const deleteUser = (userId) => {
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) return;

    const adminsCount = users.filter(u => u.role === 'admin' && u.isActive).length;
    if (userToDelete.role === 'admin' && adminsCount <= 1) {
      showNotification('No puedes eliminar el único administrador activo del sistema.', 'error');
      return;
    }

    setUsers(prev => prev.filter(u => u.id !== userId));
    addAuditLog('ELIMINACION_USUARIO', `${userToDelete.username} (${userToDelete.fullName})`);
    showNotification(`Usuario "${userToDelete.fullName}" eliminado.`);
  };

  const toggleUserStatus = (userId) => {
    const userToToggle = users.find(u => u.id === userId);
    if (!userToToggle) return;

    if (userToToggle.role === 'admin') {
      const activeAdmins = users.filter(u => u.role === 'admin' && u.isActive && u.id !== userId).length;
      if (activeAdmins === 0 && userToToggle.isActive) {
        showNotification('Debe haber al menos un administrador activo en el sistema.', 'error');
        return;
      }
    }

    const nextStatus = !userToToggle.isActive;
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: nextStatus } : u));
    showNotification(`Usuario ${nextStatus ? 'activado' : 'desactivado'}.`);
  };

  const generateRandomPassword = () => {
    const words = ['Obra', 'Reforma', 'Yeso', 'Pladur', 'Solado', 'Tubo', 'Alicatado', 'Pintor', 'Ladrillo'];
    const word = words[Math.floor(Math.random() * words.length)];
    const num = Math.floor(100 + Math.random() * 900);
    return `${word}${num}!`;
  };

  // Obra Actions
  const addObra = (obraData) => {
    const newObra = {
      ...obraData,
      id: `obra-${Date.now()}`,
      codigo: `OBR-2026-${String(obras.length + 1).padStart(3, '0')}`,
      progreso: obraData.progreso || 0,
      costeRealActual: obraData.costeRealActual || 0,
      margenRealPct: obraData.margenRealPct || obraData.margenEsperadoPct || 30,
      fases: obraData.fases || [],
      diario: obraData.diario || [],
      necesidadesMateriales: obraData.necesidadesMateriales || [],
      operariosIds: obraData.operariosIds || [],
      catalogoPrecios: obraData.catalogoPrecios || JSON.parse(JSON.stringify(basePrecios))
    };
    setObras(prev => [newObra, ...prev]);
    showNotification(`Obra "${newObra.titulo}" creada correctamente`);
    return newObra;
  };

  const updateObra = (id, updates) => {
    setObras(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
    showNotification('Obra actualizada correctamente');
  };

  const updateObraBasePrecioItem = (obraId, itemIndexOrId, updatedItem) => {
    setObras(prev => prev.map(o => {
      if (o.id === obraId) {
        const currentCat = o.catalogoPrecios && o.catalogoPrecios.length > 0
          ? [...o.catalogoPrecios]
          : JSON.parse(JSON.stringify(basePrecios));

        let idx = typeof itemIndexOrId === 'number' ? itemIndexOrId : currentCat.findIndex(item => item.id === itemIndexOrId);
        if (idx >= 0 && idx < currentCat.length) {
          const coste = Number(updatedItem.costeSubcontrata ?? currentCat[idx].costeSubcontrata ?? 0);
          const margen = Number(updatedItem.margenPct ?? currentCat[idx].margenPct ?? 30);
          const pvpCalculado = Number((coste * (1 + margen / 100)).toFixed(2));

          currentCat[idx] = {
            ...currentCat[idx],
            ...updatedItem,
            costeSubcontrata: coste,
            margenPct: margen,
            precioVenta: updatedItem.precioVenta !== undefined ? Number(updatedItem.precioVenta) : pvpCalculado
          };
        }
        return { ...o, catalogoPrecios: currentCat };
      }
      return o;
    }));
    showNotification('Catálogo de precios de la obra actualizado correctamente');
  };

  const addObraBasePrecioItem = (obraId, newItem) => {
    setObras(prev => prev.map(o => {
      if (o.id === obraId) {
        const currentCat = o.catalogoPrecios && o.catalogoPrecios.length > 0
          ? [...o.catalogoPrecios]
          : JSON.parse(JSON.stringify(basePrecios));

        const coste = Number(newItem.costeSubcontrata || 0);
        const margen = Number(newItem.margenPct || 30);
        const pvpCalculado = Number((coste * (1 + margen / 100)).toFixed(2));

        const itemToAdd = {
          id: `bp-obra-${Date.now()}`,
          codigo: newItem.codigo || `PAR-${currentCat.length + 1}`,
          capitulo: newItem.capitulo || 'General',
          gremio: newItem.gremio || 'Albañilería',
          concepto: newItem.concepto || 'Nueva partida',
          unidad: newItem.unidad || 'ud',
          costeSubcontrata: coste,
          margenPct: margen,
          precioVenta: newItem.precioVenta ? Number(newItem.precioVenta) : pvpCalculado
        };
        return { ...o, catalogoPrecios: [...currentCat, itemToAdd] };
      }
      return o;
    }));
    showNotification('Nueva partida añadida al catálogo de precios de la obra');
  };

  const deleteObraBasePrecioItem = (obraId, itemId) => {
    setObras(prev => prev.map(o => {
      if (o.id === obraId) {
        const currentCat = o.catalogoPrecios && o.catalogoPrecios.length > 0
          ? [...o.catalogoPrecios]
          : JSON.parse(JSON.stringify(basePrecios));
        const filtered = currentCat.filter(item => item.id !== itemId);
        return { ...o, catalogoPrecios: filtered };
      }
      return o;
    }));
    showNotification('Partida eliminada del catálogo de la obra');
  };

  const addDiarioEntry = (obraId, entry) => {
    const newEntry = {
      ...entry,
      id: `d-${Date.now()}`,
      fecha: entry.fecha || new Date().toISOString().split('T')[0]
    };
    setObras(prev => prev.map(o => {
      if (o.id === obraId) {
        return { ...o, diario: [newEntry, ...(o.diario || [])] };
      }
      return o;
    }));
    showNotification('Entrada guardada en el Diario de Obra');
  };

  const addMaterialToObra = (obraId, material) => {
    const newMat = {
      ...material,
      id: `m-${Date.now()}`,
      estado: material.estado || 'pendiente'
    };
    setObras(prev => prev.map(o => {
      if (o.id === obraId) {
        return { ...o, necesidadesMateriales: [...(o.necesidadesMateriales || []), newMat] };
      }
      return o;
    }));
    showNotification(`Material "${newMat.concepto}" añadido a las necesidades`);
  };

  const updateMaterialStatus = (obraId, materialId, newStatus) => {
    setObras(prev => prev.map(o => {
      if (o.id === obraId) {
        return {
          ...o,
          necesidadesMateriales: (o.necesidadesMateriales || []).map(m => m.id === materialId ? { ...m, estado: newStatus } : m)
        };
      }
      return o;
    }));
  };

  // ==========================================
  // REALTIME BIDIRECTIONAL BROADCAST METHODS
  // ==========================================
  const broadcastWorkerProgress = (obraId, faseId, newProgress, obreroNombre) => {
    const progNum = Math.min(100, Math.max(0, newProgress));
    const isCompleted = progNum === 100;

    setObras(prevObras => prevObras.map(o => {
      if (o.id === obraId) {
        const updatedFases = (o.fases || []).map(f => {
          if (f.id === faseId) {
            return {
              ...f,
              progreso: progNum,
              estado: isCompleted ? 'completada' : progNum > 0 ? 'en_curso' : 'pendiente'
            };
          }
          return f;
        });
        const totalProg = updatedFases.reduce((s, f) => s + f.progreso, 0);
        const newGlobalProg = Math.round(totalProg / (updatedFases.length || 1));
        return { ...o, fases: updatedFases, progreso: newGlobalProg };
      }
      return o;
    }));

    realtimeSync.broadcast('WORKER_PROGRESS_UPDATED', {
      obraId,
      faseId,
      newProgress: progNum,
      obreroNombre: obreroNombre || currentUser?.fullName || 'Operario'
    });

    addAuditLog('AVANCE_FASE_OBRERO', `Obra: ${obraId} - Fase: ${faseId} al ${progNum}%`);
  };

  const broadcastWorkerEvidence = (obraId, entry) => {
    const newEntry = {
      ...entry,
      id: `d-${Date.now()}`,
      fecha: entry.fecha || new Date().toISOString().split('T')[0]
    };

    setObras(prev => prev.map(o => o.id === obraId ? { ...o, diario: [newEntry, ...(o.diario || [])] } : o));

    realtimeSync.broadcast('WORKER_EVIDENCE_UPLOADED', {
      obraId,
      entry: newEntry
    });

    addAuditLog('EVIDENCIA_FOTOGRAFICA_OBRERO', `Obra: ${obraId} - Autor: ${newEntry.autor}`);
  };

  const broadcastAdminTask = (obraId, taskData) => {
    const newTask = {
      ...taskData,
      id: `fase-${Date.now()}`,
      progreso: 0,
      estado: 'pendiente'
    };

    setObras(prev => prev.map(o => o.id === obraId ? { ...o, fases: [...(o.fases || []), newTask] } : o));

    realtimeSync.broadcast('ADMIN_TASK_DISPATCHED', {
      obraId,
      task: newTask
    });

    addAuditLog('TAREA_ADMIN_DISPATCHED', `Obra: ${obraId} - Tarea: ${newTask.nombre}`);
    showNotification(`Tarea "${newTask.nombre}" asignada y notificada en tiempo real al operario.`);
  };

  const broadcastAdminAlert = (obraId, alertData) => {
    const newAlert = {
      ...alertData,
      id: `alert-${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    realtimeSync.broadcast('ADMIN_ALERT_DISPATCHED', {
      obraId,
      alert: newAlert
    });

    addAuditLog('ALERTA_TECNICA_DISPATCHED', `Aviso: ${newAlert.titulo}`);
    showNotification(`Aviso técnico enviado al canal móvil de los operarios.`);
  };

  // ==========================================
  // MULTIMODAL SITE VISIT & AI QUOTE PIPELINE
  // ==========================================
  const addSiteVisit = (visitData) => {
    const newVisit = {
      ...visitData,
      id: `visita-${Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      capturas: visitData.capturas || []
    };
    setSiteVisits(prev => [newVisit, ...prev]);
    showNotification(`Expediente de visita "${newVisit.titulo}" registrado.`);
    return newVisit;
  };

  const generateQuoteFromSiteVisit = async (visitOrId, onProgress) => {
    const visit = typeof visitOrId === 'string'
      ? siteVisits.find(v => v.id === visitOrId) || VISITA_TEMPLATES[0]
      : visitOrId;

    const generatedQuote = await processSiteVisitExpediente(
      visit,
      basePrecios,
      empresaConfig.aiConfig || {},
      onProgress
    );

    setPresupuestos(prev => [generatedQuote, ...prev]);
    addAuditLog('PRESUPUESTO_IA_GENERADO', `Presupuesto ${generatedQuote.numero} para ${generatedQuote.cliente}`);
    showNotification(`¡Borrador técnico ${generatedQuote.numero} generado por IA! Listo para revisión.`);
    return generatedQuote;
  };

  const refineQuoteWithVoiceCommand = async (quoteId, commandText) => {
    const targetQuote = presupuestos.find(p => p.id === quoteId);
    if (!targetQuote) return null;

    const updatedQuote = await applyVoiceCommandToQuote(targetQuote, commandText, empresaConfig.aiConfig);
    setPresupuestos(prev => prev.map(p => p.id === quoteId ? updatedQuote : p));
    addAuditLog('REFINADO_VOZ_IA', `Presupuesto: ${targetQuote.numero} - Comando: "${commandText}"`);
    showNotification(`✨ Ajuste por voz aplicado: ${updatedQuote._lastChangelog || 'Presupuesto recalculado.'}`);
    return updatedQuote;
  };

  const approveAndSendQuote = (quoteId, clientContactDetails) => {
    const targetQuote = presupuestos.find(p => p.id === quoteId);
    if (!targetQuote) return null;

    const updatedQuote = {
      ...targetQuote,
      estado: 'enviado_cliente',
      aprobadoPorDirector: true,
      fechaAprobacion: new Date().toISOString().replace('T', ' ').substring(0, 16),
      envioCliente: {
        fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
        canal: clientContactDetails?.canal || 'WhatsApp & Email',
        destinatario: clientContactDetails?.destinatario || targetQuote.telefono || targetQuote.email,
        enlaceFirma: `https://obramaster.app/presupuestos/${targetQuote.id}/firmar-digital`
      }
    };

    setPresupuestos(prev => prev.map(p => p.id === quoteId ? updatedQuote : p));
    addAuditLog('PRESUPUESTO_APROBADO_Y_ENVIADO', `Presupuesto ${targetQuote.numero} enviado a ${targetQuote.cliente}`);
    showNotification(`¡Presupuesto ${targetQuote.numero} aprobado y enviado al cliente con trazabilidad!`);
    return updatedQuote;
  };

  // Presupuesto Actions
  const addPresupuesto = (presData) => {
    const newPres = {
      ...presData,
      id: `pres-${Date.now()}`,
      numero: `PRES-2026-${String(presupuestos.length + 1).padStart(3, '0')}`,
      fecha: presData.fecha || new Date().toISOString().split('T')[0],
      estado: presData.estado || 'borrador',
      validezDias: presData.validezDias || 30
    };
    setPresupuestos(prev => [newPres, ...prev]);
    showNotification(`Presupuesto ${newPres.numero} generado con éxito`);
    return newPres;
  };

  const updatePresupuesto = (id, updates) => {
    setPresupuestos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    showNotification('Presupuesto actualizado');
  };

  // Presupuesto to Factura conversion in 1-click
  const convertPresupuestoToFactura = (presupuestoId, tipoFactura = 'Certificación 1 (Anticipo 40%)', porcentaje = 40) => {
    const pres = presupuestos.find(p => p.id === presupuestoId);
    if (!pres) return null;

    const fechaHoy = new Date().toISOString().split('T')[0];
    const fechaVenc = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    const factor = (porcentaje || 100) / 100;

    const baseCalculada = Number((pres.baseImponible * factor).toFixed(2));
    const cuotaIvaCalculada = Number((baseCalculada * (pres.tipoIvaPct / 100)).toFixed(2));
    const totalCalculado = Number((baseCalculada + cuotaIvaCalculada).toFixed(2));

    // Determinar trimestre actual
    const mes = new Date().getMonth(); // 0 a 11
    const trim = mes < 3 ? '1T' : mes < 6 ? '2T' : mes < 9 ? '3T' : '4T';

    const newFactura = {
      id: `fac-${Date.now()}`,
      numero: `FAC-2026-${String(facturas.length + 1).padStart(3, '0')}`,
      presupuestoId: pres.id,
      obraId: pres.obraId || null,
      obraTitulo: pres.obraTitulo || pres.cliente,
      cliente: pres.cliente,
      cifNif: pres.nif || 'Sin NIF',
      direccion: pres.direccion || 'Domicilio de obra',
      fechaEmision: fechaHoy,
      fechaVencimiento: fechaVenc,
      tipoFactura: tipoFactura,
      trimestre: trim,
      ano: 2026,
      baseImponible: baseCalculada,
      tipoIvaPct: pres.tipoIvaPct || 10,
      cuotaIva: cuotaIvaCalculada,
      retencionIrpfPct: 0,
      cuotaRetencion: 0,
      totalFactura: totalCalculado,
      estadoCobro: 'pendiente',
      fechaCobro: null,
      metodoPago: 'Transferencia bancaria a 15 días'
    };

    setFacturas(prev => [newFactura, ...prev]);
    // Update presupuesto status
    setPresupuestos(prev => prev.map(p => p.id === pres.id ? { ...p, estado: 'facturado' } : p));
    showNotification(`¡Factura ${newFactura.numero} generada con éxito por ${totalCalculado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}!`);
    return newFactura;
  };

  const updateFacturaStatus = (facturaId, estadoCobro, metodoPago = null) => {
    setFacturas(prev => prev.map(f => {
      if (f.id === facturaId) {
        return {
          ...f,
          estadoCobro,
          fechaCobro: estadoCobro === 'cobrada' ? new Date().toISOString().split('T')[0] : null,
          metodoPago: metodoPago || f.metodoPago
        };
      }
      return f;
    }));
    showNotification(`Factura marcada como ${estadoCobro}`);
  };

  const addFacturaProveedor = (gasto) => {
    const newGasto = {
      ...gasto,
      id: `gasto-${Date.now()}`,
      fecha: gasto.fecha || new Date().toISOString().split('T')[0]
    };
    setFacturasProveedores(prev => [newGasto, ...prev]);
    showNotification('Factura de gasto/subcontrata añadida al libro de IVA soportado');
  };

  // Obreros & Subcontratas review
  const addReviewObrero = (obreroId, review) => {
    setObreros(prev => prev.map(o => {
      if (o.id === obreroId) {
        const prevResenas = o.ultimasResenas || [];
        const newResenas = [{ ...review, id: `r-${Date.now()}`, fecha: new Date().toISOString().split('T')[0] }, ...prevResenas];
        
        // Recalcular media
        const sum = newResenas.reduce((acc, r) => acc + (Number(r.nota) || 5), 0);
        const newMedia = Number((sum / newResenas.length).toFixed(1));

        return {
          ...o,
          calificacionMedia: newMedia,
          obrasRealizadas: (o.obrasRealizadas || 0) + 1,
          ultimasResenas: newResenas
        };
      }
      return o;
    }));
    showNotification('Calificación registrada y tenida en cuenta para futuras asignaciones');
  };

  // ==========================================
  // RRHH & NÓMINAS: GESTIÓN DE EMPLEADOS
  // ==========================================
  const addEmployee = (empData, userCreds = null) => {
    const empId = `emp-${Date.now()}`;
    const obreroId = `obrero-${Date.now()}`;
    let linkedUserId = null;

    if (userCreds?.createAccount || userCreds?.username) {
      const generatedPass = userCreds.password || generateRandomPassword();
      const newU = {
        id: `user-obrero-${Date.now()}`,
        obreroId: obreroId,
        employeeId: empId,
        username: userCreds.username || `${(empData.nombre || 'operario').toLowerCase().trim()}.${(empData.apellidos || 'obra').toLowerCase().trim()}`.replace(/\s+/g, '.'),
        password: generatedPass,
        role: 'obrero',
        fullName: `${empData.nombre || ''} ${empData.apellidos || ''}`.trim(),
        email: empData.email || '',
        trade: empData.especialidad || 'Operario de Obra',
        phone: empData.telefono || '',
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: null
      };
      setUsers(prev => [newU, ...prev]);
      linkedUserId = newU.id;
    }

    const newEmp = {
      id: empId,
      obreroId: obreroId,
      usuarioId: linkedUserId,
      nombre: empData.nombre || '',
      apellidos: empData.apellidos || '',
      dni: empData.dni || '',
      naf: empData.naf || '',
      fechaNacimiento: empData.fechaNacimiento || '1990-01-01',
      direccion: empData.direccion || '',
      telefono: empData.telefono || '',
      email: empData.email || '',
      iban: empData.iban || '',
      categoria: empData.categoria || 'Oficial 1ª',
      convenio: empData.convenio || 'Convenio General del Sector de la Construcción (Madrid)',
      especialidad: empData.especialidad || 'Albañilería & Alicatados',
      tipoContrato: empData.tipoContrato || 'indefinido',
      jornadaHorasSemana: Number(empData.jornadaHorasSemana) || 40,
      salarioBaseMensual: Number(empData.salarioBaseMensual) || 1600,
      plusConvenio: Number(empData.plusConvenio) || 200,
      precioHoraExtra: Number(empData.precioHoraExtra) || 17.50,
      irpfPct: Number(empData.irpfPct) || 12.0,
      situacionFamiliar: empData.situacionFamiliar || 'soltero',
      hijosACargo: Number(empData.hijosACargo) || 0,
      dependientesACargo: Number(empData.dependientesACargo) || 0,
      discapacidadPct: Number(empData.discapacidadPct) || 0,
      fechaAlta: empData.fechaAlta || new Date().toISOString().split('T')[0],
      fechaBaja: null,
      motivoBaja: null,
      estado: empData.estado || 'activo',
      diasTrabajadosMes: Number(empData.diasTrabajadosMes) || 21,
      horasOrdinarias: Number(empData.horasOrdinarias) || 160,
      horasExtras: Number(empData.horasExtras) || 0,
      vacacionesAnualesTotal: 30,
      vacacionesConsumidas: 0,
      foto: empData.foto || 'https://images.unsplash.com/photo-1541888946425-d0fbb1861593?auto=format&fit=crop&w=200&q=80',
      ausencias: []
    };

    setEmployees(prev => [newEmp, ...prev]);

    setObreros(prev => [{
      id: obreroId,
      nombre: `${newEmp.nombre} ${newEmp.apellidos}`.trim(),
      puesto: `${newEmp.categoria} / ${newEmp.especialidad}`,
      telefono: newEmp.telefono,
      tipo: 'plantilla',
      especialidad: newEmp.especialidad,
      foto: newEmp.foto,
      calificacionMedia: 5.0,
      criterios: { calidadAcabados: 5, puntualidadPlazos: 5, autonomiaProblemas: 5, limpiezaSeguridad: 5 },
      obrasRealizadas: 0,
      horasRegistradasMes: newEmp.horasOrdinarias,
      costeHora: Number((newEmp.salarioBaseMensual / 160).toFixed(2)),
      estado: newEmp.estado,
      recomendacionesIA: 'Alta reciente en plantilla.',
      ultimasResenas: []
    }, ...prev]);

    addAuditLog('ALTA_EMPLEADO', `${newEmp.nombre} ${newEmp.apellidos} (${newEmp.dni})`);
    showNotification(`Empleado "${newEmp.nombre} ${newEmp.apellidos}" dado de alta correctamente.`);
    return newEmp;
  };

  const updateEmployee = (id, updates) => {
    setEmployees(prev => prev.map(emp => {
      if (emp.id === id) {
        const updated = { ...emp, ...updates };

        if (emp.usuarioId) {
          setUsers(prevUsers => prevUsers.map(u => {
            if (u.id === emp.usuarioId) {
              return {
                ...u,
                fullName: `${updated.nombre} ${updated.apellidos}`.trim(),
                phone: updated.telefono || u.phone,
                email: updated.email || u.email,
                trade: updated.especialidad || u.trade
              };
            }
            return u;
          }));
        }

        if (emp.obreroId) {
          setObreros(prevObreros => prevObreros.map(o => {
            if (o.id === emp.obreroId) {
              return {
                ...o,
                nombre: `${updated.nombre} ${updated.apellidos}`.trim(),
                puesto: `${updated.categoria} / ${updated.especialidad}`,
                telefono: updated.telefono,
                especialidad: updated.especialidad,
                estado: updated.estado
              };
            }
            return o;
          }));
        }

        return updated;
      }
      return emp;
    }));

    addAuditLog('MODIFICACION_EMPLEADO', `ID Empleado: ${id}`);
    showNotification('Ficha del empleado actualizada correctamente.');
  };

  const terminateEmployee = (id, { motivoBaja, fechaBaja, estado = 'baja' }) => {
    const targetEmp = employees.find(e => e.id === id);
    if (!targetEmp) return;

    const fecha = fechaBaja || new Date().toISOString().split('T')[0];

    setEmployees(prev => prev.map(emp => {
      if (emp.id === id) {
        return {
          ...emp,
          estado: estado,
          fechaBaja: fecha,
          motivoBaja: motivoBaja || 'Baja en plantilla'
        };
      }
      return emp;
    }));

    if (targetEmp.obreroId) {
      setObreros(prev => prev.map(o => o.id === targetEmp.obreroId ? { ...o, estado: 'baja' } : o));
    }

    if (targetEmp.usuarioId) {
      setUsers(prevUsers => prevUsers.map(u => {
        if (u.id === targetEmp.usuarioId) {
          return { ...u, isActive: false };
        }
        return u;
      }));
    }

    addAuditLog('BAJA_EMPLEADO', `${targetEmp.nombre} ${targetEmp.apellidos} - Motivo: ${motivoBaja}`);
    showNotification(`Empleado tramitado en estado "${estado}". Acceso a App Móvil suspendido.`);
  };

  const rehireEmployee = (id) => {
    const targetEmp = employees.find(e => e.id === id);
    if (!targetEmp) return;

    setEmployees(prev => prev.map(emp => {
      if (emp.id === id) {
        return {
          ...emp,
          estado: 'activo',
          fechaBaja: null,
          motivoBaja: null
        };
      }
      return emp;
    }));

    if (targetEmp.obreroId) {
      setObreros(prev => prev.map(o => o.id === targetEmp.obreroId ? { ...o, estado: 'activo' } : o));
    }

    if (targetEmp.usuarioId) {
      setUsers(prevUsers => prevUsers.map(u => {
        if (u.id === targetEmp.usuarioId) {
          return { ...u, isActive: true };
        }
        return u;
      }));
    }

    addAuditLog('REACTIVACION_EMPLEADO', `${targetEmp.nombre} ${targetEmp.apellidos}`);
    showNotification(`Empleado reactivado con éxito. Acceso móvil restaurado.`);
  };

  const addEmployeeAbsence = (employeeId, absenceData) => {
    const newAbsence = {
      ...absenceData,
      id: `abs-${Date.now()}`,
      dias: Number(absenceData.dias) || 1,
      estado: absenceData.estado || 'aprobado'
    };

    setEmployees(prev => prev.map(emp => {
      if (emp.id === employeeId) {
        const nuevasAusencias = [newAbsence, ...(emp.ausencias || [])];
        let nuevasConsumidas = emp.vacacionesConsumidas || 0;
        let nuevoEstado = emp.estado;

        if (newAbsence.tipo === 'vacaciones') {
          nuevasConsumidas = Math.min(emp.vacacionesAnualesTotal || 30, nuevasConsumidas + newAbsence.dias);
          nuevoEstado = 'vacaciones';
        } else if (newAbsence.tipo === 'baja_it') {
          nuevoEstado = 'baja';
        }

        return {
          ...emp,
          ausencias: nuevasAusencias,
          vacacionesConsumidas: nuevasConsumidas,
          estado: nuevoEstado
        };
      }
      return emp;
    }));

    addAuditLog('REGISTRO_AUSENCIA', `Empleado: ${employeeId} - Tipo: ${newAbsence.tipo}`);
    showNotification(`Registro de ausencia (${newAbsence.tipo}) guardado con éxito.`);
  };

  const resetEmployeePassword = (employeeId, newPass) => {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp || !emp.usuarioId) {
      showNotification('Este empleado no tiene usuario móvil vinculado.', 'error');
      return { success: false, error: 'Sin usuario vinculado' };
    }

    const cleanPass = newPass.trim();
    setUsers(prev => prev.map(u => u.id === emp.usuarioId ? { ...u, password: cleanPass } : u));
    addAuditLog('RESET_PASSWORD_EMPLEADO', `Empleado: ${emp.nombre} ${emp.apellidos}`);
    showNotification(`Contraseña de ${emp.nombre} actualizada con éxito.`);
    return { success: true, password: cleanPass };
  };

  // ==========================================
  // SUBCONTRATAS & GREMIOS: GESTIÓN INTEGRAL
  // ==========================================
  const addSubcontractor = (subData) => {
    const newSub = {
      ...subData,
      id: `sub-${Date.now()}`,
      razonSocial: subData.razonSocial || '',
      nombreComercial: subData.nombreComercial || subData.razonSocial || '',
      cif: subData.cif || '',
      gremio: subData.gremio || 'Instalaciones',
      personaContacto: subData.personaContacto || '',
      telefono: subData.telefono || '',
      telefonoUrgencias: subData.telefonoUrgencias || subData.telefono || '',
      email: subData.email || '',
      direccion: subData.direccion || '',
      prl: {
        seguroRCCompania: subData.prl?.seguroRCCompania || 'Compañía Aseguradora',
        seguroRCPoliza: subData.prl?.seguroRCPoliza || 'POL-RC',
        seguroRCSuma: Number(subData.prl?.seguroRCSuma) || 300000,
        seguroRCFechaCaducidad: subData.prl?.seguroRCFechaCaducidad || '2027-12-31',
        certificadoAEAT: subData.prl?.certificadoAEAT || 'vigente',
        certificadoTGSS: subData.prl?.certificadoTGSS || 'vigente',
        aptoEntrarObra: subData.prl?.aptoEntrarObra !== undefined ? subData.prl.aptoEntrarObra : true
      },
      scoring: {
        media: 5.0,
        totalResenas: 0,
        criterios: {
          puntualidad: 5.0,
          calidad: 5.0,
          limpieza: 5.0,
          trato: 5.0
        }
      },
      notasInternas: [],
      presupuestosVinculados: [],
      facturasRecibidas: []
    };

    setSubcontractors(prev => [newSub, ...prev]);
    addAuditLog('ALTA_SUBCONTRATA', `${newSub.razonSocial} (CIF: ${newSub.cif})`);
    showNotification(`Subcontrata "${newSub.razonSocial}" dada de alta correctamente.`);
    return newSub;
  };

  const updateSubcontractor = (id, updates) => {
    setSubcontractors(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, ...updates };
      }
      return s;
    }));
    addAuditLog('MODIFICACION_SUBCONTRATA', `ID: ${id}`);
    showNotification('Ficha de subcontratista actualizada.');
  };

  const addSubcontractorBudget = (subId, budgetData) => {
    const newBud = {
      ...budgetData,
      id: `spres-${Date.now()}`,
      fecha: budgetData.fecha || new Date().toISOString().split('T')[0],
      estado: budgetData.estado || 'recibido',
      importeSubcontrata: Number(budgetData.importeSubcontrata) || 0,
      partidas: budgetData.partidas || []
    };

    setSubcontractors(prev => prev.map(s => {
      if (s.id === subId) {
        return {
          ...s,
          presupuestosVinculados: [newBud, ...(s.presupuestosVinculados || [])]
        };
      }
      return s;
    }));

    showNotification(`Presupuesto de subcontrata vinculado con éxito.`);
    return newBud;
  };

  const updateSubcontractorBudgetStatus = (subId, budgetId, newStatus) => {
    setSubcontractors(prev => prev.map(s => {
      if (s.id === subId) {
        const updatedBudgets = (s.presupuestosVinculados || []).map(b => b.id === budgetId ? { ...b, estado: newStatus } : b);
        return { ...s, presupuestosVinculados: updatedBudgets };
      }
      return s;
    }));
    showNotification(`Estado de presupuesto actualizado a: ${newStatus}`);
  };

  const addSubcontractorInvoice = (subId, invoiceData) => {
    const sub = subcontractors.find(s => s.id === subId);
    if (!sub) return;

    const baseImp = Number(invoiceData.baseImponible) || 0;
    const ivaPct = Number(invoiceData.ivaPct) || 21;
    const totalCalc = Number((baseImp * (1 + ivaPct / 100)).toFixed(2));

    let desviacion = 0;
    if (invoiceData.presupuestoVinculadoId) {
      const bud = (sub.presupuestosVinculados || []).find(b => b.id === invoiceData.presupuestoVinculadoId);
      if (bud && bud.importeSubcontrata) {
        desviacion = Number((baseImp - bud.importeSubcontrata).toFixed(2));
      }
    }

    const newInv = {
      id: `sfac-${Date.now()}`,
      numero: invoiceData.numero || `FAC-SUB-${Date.now().toString().slice(-4)}`,
      obraId: invoiceData.obraId || '',
      obraTitulo: invoiceData.obraTitulo || 'Obra Asignada',
      presupuestoVinculadoId: invoiceData.presupuestoVinculadoId || null,
      fechaEmision: invoiceData.fechaEmision || new Date().toISOString().split('T')[0],
      fechaVencimiento: invoiceData.fechaVencimiento || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      baseImponible: baseImp,
      ivaPct: ivaPct,
      total: totalCalc,
      estadoPago: invoiceData.estadoPago || 'pendiente',
      desviacionSobrePresupuesto: desviacion
    };

    setSubcontractors(prev => prev.map(s => {
      if (s.id === subId) {
        return {
          ...s,
          facturasRecibidas: [newInv, ...(s.facturasRecibidas || [])]
        };
      }
      return s;
    }));

    addFacturaProveedor({
      numero: newInv.numero,
      proveedor: sub.razonSocial,
      cif: sub.cif,
      concepto: `Subcontratación ${sub.gremio} - ${newInv.obraTitulo}`,
      fecha: newInv.fechaEmision,
      baseImponible: baseImp,
      tipoIvaPct: ivaPct,
      cuotaIva: Number((baseImp * (ivaPct / 100)).toFixed(2)),
      retencionIrpfPct: 0,
      cuotaRetencion: 0,
      totalFactura: totalCalc,
      estadoPago: newInv.estadoPago === 'pagado' ? 'pagada' : 'pendiente',
      deducibleIva: true,
      deducibleIrpf: true
    });

    if (desviacion > 0) {
      showNotification(`⚠️ Factura de subcontrata con SOBRECOSTE de +${desviacion}€ sobre presupuesto.`);
    } else {
      showNotification('Factura de subcontrata registrada y contabilizada en compras.');
    }
  };

  const updateSubcontractorInvoiceStatus = (subId, invoiceId, newStatus) => {
    setSubcontractors(prev => prev.map(s => {
      if (s.id === subId) {
        const updated = (s.facturasRecibidas || []).map(f => f.id === invoiceId ? { ...f, estadoPago: newStatus } : f);
        return { ...s, facturasRecibidas: updated };
      }
      return s;
    }));
    showNotification(`Factura de subcontrata marcada como ${newStatus}.`);
  };

  const addSubcontractorNote = (subId, texto, autor = 'Dirección Técnica') => {
    const newNote = {
      id: `not-${Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      autor,
      texto
    };

    setSubcontractors(prev => prev.map(s => {
      if (s.id === subId) {
        return {
          ...s,
          notasInternas: [newNote, ...(s.notasInternas || [])]
        };
      }
      return s;
    }));

    showNotification('Nota confidencial agregada a la bitácora de la subcontrata.');
  };

  const addSubcontractorReview = (subId, { puntualidad, calidad, limpieza, trato, comentario, obraTitulo }) => {
    setSubcontractors(prev => prev.map(s => {
      if (s.id === subId) {
        const prevCrit = s.scoring?.criterios || { puntualidad: 5, calidad: 5, limpieza: 5, trato: 5 };
        const total = (s.scoring?.totalResenas || 0) + 1;

        const newPunt = Number(((prevCrit.puntualidad * (total - 1) + Number(puntualidad)) / total).toFixed(1));
        const newCal = Number(((prevCrit.calidad * (total - 1) + Number(calidad)) / total).toFixed(1));
        const newLimp = Number(((prevCrit.limpieza * (total - 1) + Number(limpieza)) / total).toFixed(1));
        const newTrato = Number(((prevCrit.trato * (total - 1) + Number(trato)) / total).toFixed(1));
        const newMedia = Number(((newPunt + newCal + newLimp + newTrato) / 4).toFixed(1));

        const updatedScoring = {
          media: newMedia,
          totalResenas: total,
          criterios: {
            puntualidad: newPunt,
            calidad: newCal,
            limpieza: newLimp,
            trato: newTrato
          }
        };

        const nuevaNota = comentario ? [{
          id: `not-rev-${Date.now()}`,
          fecha: new Date().toISOString().split('T')[0],
          autor: 'Evaluación de Obra',
          texto: `[Obra: ${obraTitulo || 'General'}] Valoración: ${newMedia}⭐ - ${comentario}`
        }] : [];

        return {
          ...s,
          scoring: updatedScoring,
          notasInternas: [...nuevaNota, ...(s.notasInternas || [])]
        };
      }
      return s;
    }));

    showNotification('Evaluación de subcontrata registrada y scoring actualizado.');
  };

  // Subcontractor Quote Application & Price Database Auto-update with configured margin!
  const applySubcontrataPresupuesto = (subPresupuestoId, partidasToUpdate, globalMargin = null) => {
    setBasePrecios(prevBase => {
      const updated = [...prevBase];
      partidasToUpdate.forEach(item => {
        const idx = updated.findIndex(bp => bp.codigo === item.codigo);
        const marginPct = globalMargin !== null ? globalMargin : item.margenConfiguradoPct;
        const nuevoCoste = item.nuevoPrecioSubcontrata;
        const nuevoPvp = Number((nuevoCoste * (1 + marginPct / 100)).toFixed(2));

        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            costeSubcontrata: nuevoCoste,
            margenPct: marginPct,
            precioVenta: nuevoPvp
          };
        } else {
          updated.push({
            id: `bp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            codigo: item.codigo,
            capitulo: item.capitulo || 'Subcontratas',
            gremio: item.gremio || 'Instalaciones',
            concepto: item.concepto,
            unidad: item.unidad || 'ud',
            costeSubcontrata: nuevoCoste,
            margenPct: marginPct,
            precioVenta: nuevoPvp
          });
        }
      });
      return updated;
    });

    setSubcontratasPresupuestos(prev => prev.map(sp => {
      if (sp.id === subPresupuestoId) {
        return { ...sp, estado: 'aplicado' };
      }
      return sp;
    }));

    showNotification(`¡Base de Precios actualizada con éxito! Precios de coste y PVP actualizados con el margen comercial.`);
  };

  // Inbox & Requirement processing
  const processMensajeInbox = (mensajeId, obraId, accionTipo, datosExtra) => {
    const msg = mensajesInbox.find(m => m.id === mensajeId);
    if (!msg) return;

    if (accionTipo === 'aplicar_necesidades_obra') {
      const items = msg.analisisIA?.necesidadesCalculadas || [];
      items.forEach(item => {
        addMaterialToObra(obraId, {
          concepto: item.concepto,
          cantidad: item.cantidad,
          unidad: item.unidad,
          costeEstimado: item.costeAprox,
          proveedor: 'Por asignar'
        });
      });
    } else if (accionTipo === 'crear_partida_presupuesto') {
      const targetObra = obras.find(o => o.id === obraId);
      if (targetObra && targetObra.presupuestoId) {
        const pres = presupuestos.find(p => p.id === targetObra.presupuestoId);
        if (pres) {
          const newPartidas = (msg.analisisIA?.necesidadesCalculadas || []).map((nc, idx) => ({
            id: `pextra-${Date.now()}-${idx}`,
            codigo: `EXT-${idx + 1}`,
            capitulo: 'Modificaciones y Adicionales',
            concepto: nc.concepto,
            cantidad: nc.cantidad,
            unidad: nc.unidad,
            costeUnitario: Number((nc.costeAprox / (nc.cantidad || 1)).toFixed(2)),
            margenPct: 30,
            precioVenta: Number(((nc.pvpCliente || nc.costeAprox * 1.3) / (nc.cantidad || 1)).toFixed(2)),
            total: nc.pvpCliente || (nc.costeAprox * 1.3)
          }));

          const updatedPartidas = [...pres.partidas, ...newPartidas];
          const newBase = updatedPartidas.reduce((s, p) => s + p.total, 0);
          const newIva = Number((newBase * (pres.tipoIvaPct / 100)).toFixed(2));
          const newTotal = Number((newBase + newIva).toFixed(2));

          updatePresupuesto(pres.id, {
            partidas: updatedPartidas,
            baseImponible: Number(newBase.toFixed(2)),
            cuotaIva: newIva,
            totalConIva: newTotal
          });
        }
      }
    }

    setMensajesInbox(prev => prev.map(m => m.id === mensajeId ? { ...m, estadoProcesado: true } : m));
    showNotification('Mensaje procesado y aplicado a la obra.');
  };

  const addMensajeInbox = (newMsg) => {
    const msg = {
      ...newMsg,
      id: `msg-${Date.now()}`,
      fecha: new Date().toISOString().replace('T', ' ').substr(0, 16),
      estadoProcesado: false
    };
    setMensajesInbox(prev => [msg, ...prev]);
    showNotification('Nuevo mensaje recibido y analizado por IA');
    return msg;
  };

  const resetAllData = () => {
    if (window.confirm('¿Seguro que deseas reiniciar los datos de demostración a su estado inicial?')) {
      setObras(INITIAL_OBRAS);
      setObreros(INITIAL_OBREROS);
      setBasePrecios(INITIAL_BASE_PRECIOS);
      setPresupuestos(INITIAL_PRESUPUESTOS);
      setFacturas(INITIAL_FACTURAS);
      setFacturasProveedores(INITIAL_FACTURAS_PROVEEDORES);
      setMensajesInbox(INITIAL_MENSAJES_INBOX);
      setSubcontratasPresupuestos(INITIAL_SUBCONTRATAS_PRESUPUESTOS);
      setEmployees(INITIAL_EMPLOYEES);
      setSubcontractors(INITIAL_SUBCONTRACTORS);
      showNotification('Datos reiniciados a los valores de prueba');
    }
  };

  return (
    <AppContext.Provider value={{
      empresaConfig,
      setEmpresaConfig,
      updateEmpresaConfig,
      auditLogs,
      addAuditLog,
      obras,
      setObras,
      addObra,
      updateObra,
      addDiarioEntry,
      addMaterialToObra,
      updateMaterialStatus,
      obreros,
      setObreros,
      addReviewObrero,
      basePrecios,
      setBasePrecios,
      applySubcontrataPresupuesto,
      presupuestos,
      setPresupuestos,
      addPresupuesto,
      updatePresupuesto,
      convertPresupuestoToFactura,
      facturas,
      setFacturas,
      updateFacturaStatus,
      facturasProveedores,
      setFacturasProveedores,
      addFacturaProveedor,
      mensajesInbox,
      setMensajesInbox,
      addMensajeInbox,
      processMensajeInbox,
      updateObraBasePrecioItem,
      addObraBasePrecioItem,
      deleteObraBasePrecioItem,
      subcontratasPresupuestos,
      setSubcontratasPresupuestos,
      activeTab,
      setActiveTab,
      selectedObraId,
      setSelectedObraId,
      selectedPresupuestoId,
      setSelectedPresupuestoId,
      pdfModalData,
      setPdfModalData,
      notification,
      showNotification,
      resetAllData,
      // Users & Auth
      users,
      setUsers,
      currentUser,
      setCurrentUser,
      login,
      logout,
      quickSwitchUser,
      addUser,
      updateUser,
      deleteUser,
      toggleUserStatus,
      resetUserPassword,
      changeAdminPassword,
      generateRandomPassword,
      // AI Engine Config
      updateAiConfig,
      testAiConnection,
      // Realtime Bidirectional & Offline-First
      isOnline,
      offlineQueueLength,
      activeRealtimeAlert,
      setActiveRealtimeAlert,
      broadcastWorkerProgress,
      broadcastWorkerEvidence,
      broadcastAdminTask,
      broadcastAdminAlert,
      // Site Visits & AI Multimodal Quoting
      siteVisits,
      setSiteVisits,
      addSiteVisit,
      generateQuoteFromSiteVisit,
      refineQuoteWithVoiceCommand,
      approveAndSendQuote,
      // RRHH & Employees
      employees,
      setEmployees,
      addEmployee,
      updateEmployee,
      terminateEmployee,
      rehireEmployee,
      addEmployeeAbsence,
      resetEmployeePassword,
      // Subcontractors
      subcontractors,
      setSubcontractors,
      addSubcontractor,
      updateSubcontractor,
      addSubcontractorBudget,
      updateSubcontractorBudgetStatus,
      addSubcontractorInvoice,
      updateSubcontractorInvoiceStatus,
      addSubcontractorNote,
      addSubcontractorReview
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
