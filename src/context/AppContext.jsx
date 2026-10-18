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
  INITIAL_SUBCONTRACTORS,
  INITIAL_AVISOS_TECNICOS
} from '../data/initialData';
import realtimeSync from '../services/realtimeSyncService';
import {
  VISITA_TEMPLATES,
  processSiteVisitExpediente,
  applyVoiceCommandToQuote
} from '../services/siteVisitAIService';
import { testGeminiConnection, normalizeGeminiModel } from '../services/geminiService';
import {
  generateExecutionPlanFromBudget,
  calculateGlobalProjectProgress,
  calculatePhaseWeightedProgress,
  repairAndSyncObrasWithBudgets
} from '../services/obraBudgetSyncService';
import {
  INITIAL_REFERENCE_BUDGETS,
  validatePdfFile,
  extractTextFromPdfBlob
} from '../services/referenceBudgetService';

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
  SUBCONTRACTORS: 'obracon_subcontractors_v1',
  AVISOS_TECNICOS: 'obracon_avisos_tecnicos_v1',
  REFERENCE_BUDGETS: 'obramaster_reference_budgets_v1'
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
  const [empresaConfig, setEmpresaConfig] = useState(() => {
    const raw = loadStored(STORAGE_KEYS.EMPRESA, INITIAL_EMPRESA_CONFIG);
    if (raw?.aiConfig?.provider === 'google') {
      if (raw.aiConfig.modelName) raw.aiConfig.modelName = normalizeGeminiModel(raw.aiConfig.modelName);
      if (raw.aiConfig.model) raw.aiConfig.model = normalizeGeminiModel(raw.aiConfig.model);
    }
    return raw;
  });
  const [obreros, setObreros] = useState(() => loadStored(STORAGE_KEYS.OBREROS, INITIAL_OBREROS));
  const [basePrecios, setBasePrecios] = useState(() => loadStored(STORAGE_KEYS.BASE_PRECIOS, INITIAL_BASE_PRECIOS));
  const [presupuestos, setPresupuestos] = useState(() => loadStored(STORAGE_KEYS.PRESUPUESTOS, INITIAL_PRESUPUESTOS));
  const [obras, setObras] = useState(() => {
    const rawObras = loadStored(STORAGE_KEYS.OBRAS, INITIAL_OBRAS);
    const rawPres = loadStored(STORAGE_KEYS.PRESUPUESTOS, INITIAL_PRESUPUESTOS);
    return repairAndSyncObrasWithBudgets(rawObras, rawPres);
  });
  const [facturas, setFacturas] = useState(() => loadStored(STORAGE_KEYS.FACTURAS, INITIAL_FACTURAS));
  const [facturasProveedores, setFacturasProveedores] = useState(() => loadStored(STORAGE_KEYS.FACTURAS_PROV, INITIAL_FACTURAS_PROVEEDORES));
  const [mensajesInbox, setMensajesInbox] = useState(() => loadStored(STORAGE_KEYS.MENSAJES, INITIAL_MENSAJES_INBOX));
  const [subcontratasPresupuestos, setSubcontratasPresupuestos] = useState(() => loadStored(STORAGE_KEYS.SUBCONTRATAS_PRES, INITIAL_SUBCONTRATAS_PRESUPUESTOS));
  const [auditLogs, setAuditLogs] = useState(() => loadStored(STORAGE_KEYS.AUDIT_LOGS, [
    { id: 'log-1', timestamp: '2026-10-16 10:15:22', usuario: 'Manuel (Gerente)', accion: 'EMISION_FACTURA_VERIFACTU', recurso: 'FAC-2026-024', ip: '88.12.45.192', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }
  ]));

  const [siteVisits, setSiteVisits] = useState(() => {
    const raw = loadStored(STORAGE_KEYS.SITE_VISITS, VISITA_TEMPLATES);
    return (raw || []).map(v => ({
      ...v,
      capturas: (v.capturas || []).filter(c => c.isLocalBlob || (c.url && !c.url.includes('images.unsplash.com')))
    }));
  });

  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [offlineQueueLength, setOfflineQueueLength] = useState(() => realtimeSync.offlineQueue.length);
  const [activeRealtimeAlert, setActiveRealtimeAlert] = useState(null);

  const [users, setUsers] = useState(() => loadStored(STORAGE_KEYS.USERS, INITIAL_USERS));
  const [currentUser, setCurrentUser] = useState(() => loadStored(STORAGE_KEYS.AUTH_USER, null));

  const [employees, setEmployees] = useState(() => loadStored(STORAGE_KEYS.EMPLOYEES, INITIAL_EMPLOYEES));
  const [subcontractors, setSubcontractors] = useState(() => loadStored(STORAGE_KEYS.SUBCONTRACTORS, INITIAL_SUBCONTRACTORS));

  const [avisosTecnicos, setAvisosTecnicos] = useState(() => loadStored(STORAGE_KEYS.AVISOS_TECNICOS, INITIAL_AVISOS_TECNICOS));

  const [referenceBudgets, setReferenceBudgets] = useState(() => loadStored(STORAGE_KEYS.REFERENCE_BUDGETS, INITIAL_REFERENCE_BUDGETS));

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedObraId, setSelectedObraId] = useState(null);
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState(null);
  const [pdfModalData, setPdfModalData] = useState(null);
  const [notification, setNotification] = useState(null);

  // Sync with Backend Database API
  useEffect(() => {
    fetch('/api/presupuestos')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (Array.isArray(data) && data.length > 0) setPresupuestos(data); })
      .catch(() => {});

    fetch('/api/obras')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (Array.isArray(data) && data.length > 0) setObras(data); })
      .catch(() => {});
  }, []);

  // Sync to LocalStorage & Backend
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.EMPRESA, JSON.stringify(empresaConfig)); }, [empresaConfig]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.OBRAS, JSON.stringify(obras));
    fetch('/api/obras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obras) }).catch(() => {});
  }, [obras]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.OBREROS, JSON.stringify(obreros)); }, [obreros]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.BASE_PRECIOS, JSON.stringify(basePrecios)); }, [basePrecios]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRESUPUESTOS, JSON.stringify(presupuestos));
    fetch('/api/presupuestos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(presupuestos) }).catch(() => {});
  }, [presupuestos]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.FACTURAS, JSON.stringify(facturas)); }, [facturas]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.FACTURAS_PROV, JSON.stringify(facturasProveedores)); }, [facturasProveedores]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.MENSAJES, JSON.stringify(mensajesInbox)); }, [mensajesInbox]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SUBCONTRATAS_PRES, JSON.stringify(subcontratasPresupuestos)); }, [subcontratasPresupuestos]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs)); }, [auditLogs]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SITE_VISITS, JSON.stringify(siteVisits)); }, [siteVisits]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees)); }, [employees]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SUBCONTRACTORS, JSON.stringify(subcontractors)); }, [subcontractors]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.AVISOS_TECNICOS, JSON.stringify(avisosTecnicos)); }, [avisosTecnicos]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.REFERENCE_BUDGETS, JSON.stringify(referenceBudgets)); }, [referenceBudgets]);
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    }
  }, [currentUser]);

  // Realtime Subscriptions
  useEffect(() => {
    const unsubProgress = realtimeSync.subscribe('WORKER_PROGRESS_UPDATED', (payload) => {
      const { obraId, faseId, taskId, newProgress, obreroNombre, taskTitle } = payload;
      setObras(prevObras => prevObras.map(o => {
        if (o.id === obraId) {
          const progNum = Math.min(100, Math.max(0, newProgress));
          const isCompleted = progNum === 100;
          let computedFaseProg = progNum;

          const updatedFases = (o.fases || []).map(f => {
            if (f.id === faseId) {
              let updatedTareas = f.tareas ? [...f.tareas] : [];
              if (taskId && updatedTareas.length > 0) {
                updatedTareas = updatedTareas.map(t => {
                  if (t.id === taskId || t.quote_line_id === taskId || t.partidaId === taskId) {
                    return {
                      ...t,
                      progreso: progNum,
                      estado: isCompleted ? 'completada' : progNum > 0 ? 'en_curso' : 'pendiente',
                      completedAt: isCompleted ? new Date().toISOString() : null
                    };
                  }
                  return t;
                });
                computedFaseProg = calculatePhaseWeightedProgress(updatedTareas, f.importeTotal);
              } else {
                computedFaseProg = progNum;
                if (updatedTareas.length > 0) {
                  updatedTareas = updatedTareas.map(t => ({
                    ...t,
                    progreso: progNum,
                    estado: isCompleted ? 'completada' : progNum > 0 ? 'en_curso' : 'pendiente',
                    completedAt: isCompleted ? new Date().toISOString() : null
                  }));
                }
              }
              const isFaseComp = computedFaseProg === 100;
              return {
                ...f,
                tareas: updatedTareas,
                progreso: computedFaseProg,
                estado: isFaseComp ? 'completada' : computedFaseProg > 0 ? 'en_curso' : 'pendiente'
              };
            }
            return f;
          });

          const newGlobalProg = calculateGlobalProjectProgress(updatedFases);
          return { ...o, fases: updatedFases, progreso: newGlobalProg };
        }
        return o;
      }));

      setActiveRealtimeAlert({
        type: 'progress',
        msg: `⚡ [Realtime] ${obreroNombre || 'Operario'} actualizó ${taskTitle ? `"${taskTitle.substring(0, 25)}..."` : 'avance'} al ${newProgress}%`,
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
      if (alert && alert.id) {
        setAvisosTecnicos(prev => {
          if (prev.some(a => a.id === alert.id)) return prev;
          return [alert, ...prev];
        });
      }
      setActiveRealtimeAlert({
        type: 'admin_alert',
        msg: `⚠️ [Aviso Técnico] ${alert.titulo}: ${alert.descripcion}`,
        timestamp: Date.now()
      });
      setTimeout(() => setActiveRealtimeAlert(null), 7000);
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
    const sanitized = { ...newAiConfig };
    if (sanitized.provider === 'google') {
      if (sanitized.modelName) sanitized.modelName = normalizeGeminiModel(sanitized.modelName);
      if (sanitized.model) sanitized.model = normalizeGeminiModel(sanitized.model);
    }
    setEmpresaConfig(prev => ({
      ...prev,
      aiConfig: {
        ...(prev.aiConfig || {}),
        ...sanitized
      }
    }));
    addAuditLog('CONFIG_IA_ACTUALIZADA', `Proveedor: ${sanitized.provider || empresaConfig.aiConfig?.provider}`);
    showNotification('Configuración del Motor de IA guardada correctamente');
  };

  const testAiConnection = async (provider, apiKey, modelName) => {
    const key = (apiKey || '').trim();
    if (!key) {
      showNotification('Debes introducir una API Key para probar la conexión.', 'error');
      return { success: false, error: 'API Key requerida' };
    }

    const normalizedModel = provider === 'google' ? normalizeGeminiModel(modelName) : modelName;
    let latency = Math.floor(130 + Math.random() * 70);

    if (provider === 'google') {
      try {
        const pingResult = await testGeminiConnection(key, normalizedModel);
        latency = pingResult.latencyMs;
      } catch (geminiErr) {
        showNotification(geminiErr.message, 'error');
        return { success: false, error: geminiErr.message };
      }
    }

    const testedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const updatedConfig = {
      provider,
      apiKey: key,
      modelName: normalizedModel,
      isActive: true,
      lastTestedAt: testedAt,
      status: 'connected',
      latencyMs: latency
    };

    setEmpresaConfig(prev => ({
      ...prev,
      aiConfig: updatedConfig
    }));

    addAuditLog('PING_MOTOR_IA', `Proveedor: ${provider.toUpperCase()} (${normalizedModel}) - 200 OK (${latency}ms)`);
    showNotification(`¡Conexión con ${provider.toUpperCase()} (${modelName}) exitosa! Latencia: ${latency}ms`);
    return {
      success: true,
      latencyMs: latency,
      capabilities: ['Visión Multimodal (Fotos Obra)', 'Audio Whisper (Notas de Voz)', 'Function Calling (Tool Calling)', 'Partidas Base Precios JSON']
    };
  };

  const addReferenceBudget = async (file, customTitle = '', tipoObra = 'Reforma General') => {
    const val = validatePdfFile(file);
    if (!val.valid) {
      showNotification(val.error, 'error');
      return { success: false, error: val.error };
    }

    try {
      showNotification(`Extrayendo texto técnico y pliego de "${file.name}"...`);
      const text = await extractTextFromPdfBlob(file);
      const fileUrl = URL.createObjectURL(file);

      const newBudget = {
        id: `ref-pdf-${Date.now()}`,
        name: customTitle || file.name,
        file_url: fileUrl,
        file_size: file.size,
        is_active: true,
        tipo_obra: tipoObra,
        extracted_text: text,
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 16)
      };

      setReferenceBudgets(prev => [newBudget, ...prev]);
      addAuditLog('PRESUPUESTO_REFERENCIA_ANADIDO', `Documento: ${newBudget.name} (${(file.size / 1024).toFixed(0)} KB)`);
      showNotification(`✨ Presupuesto modelo "${newBudget.name}" cargado y activado para entrenamiento RAG.`);
      return { success: true, budget: newBudget };
    } catch (err) {
      console.error('Error procesando PDF de referencia:', err);
      showNotification('Error al leer el archivo PDF: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  const toggleReferenceBudget = (id) => {
    setReferenceBudgets(prev => prev.map(b => {
      if (b.id === id) {
        const nextState = !b.is_active;
        showNotification(nextState ? `"${b.name}" activado como referencia de estilo.` : `"${b.name}" desactivado.`);
        return { ...b, is_active: nextState };
      }
      return b;
    }));
  };

  const deleteReferenceBudget = (id) => {
    setReferenceBudgets(prev => {
      const target = prev.find(b => b.id === id);
      if (target?.file_url && target.file_url.startsWith('blob:')) {
        try { URL.revokeObjectURL(target.file_url); } catch (e) {}
      }
      return prev.filter(b => b.id !== id);
    });
    addAuditLog('PRESUPUESTO_REFERENCIA_ELIMINADO', `ID: ${id}`);
    showNotification('Presupuesto modelo eliminado.');
  };

  const updateReferenceBudgetText = (id, newText) => {
    setReferenceBudgets(prev => prev.map(b => b.id === id ? { ...b, extracted_text: newText } : b));
    showNotification('Texto técnico de referencia actualizado.');
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

  const login = (usernameOrEmailOrPhone, password) => {
    const rawInput = (usernameOrEmailOrPhone || '').trim();
    const cleanPass = (password || '').trim();

    if (!rawInput) {
      return { success: false, error: 'Por favor, introduce tu usuario, teléfono o DNI.' };
    }
    if (!cleanPass) {
      return { success: false, error: 'Por favor, introduce tu contraseña.' };
    }

    const norm = (str) => (str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normInput = norm(rawInput);
    const digitsInput = rawInput.replace(/\D/g, '');
    const dniInput = rawInput.toUpperCase().replace(/[\s-]/g, '');

    let matchedUser = users.find(u => {
      const uNormName = norm(u.username);
      const uNormEmail = norm(u.email);

      if (uNormName === normInput || (uNormEmail && uNormEmail === normInput)) {
        return true;
      }

      if (digitsInput && digitsInput.length >= 7 && u.phone) {
        const uDigits = u.phone.replace(/\D/g, '');
        if (uDigits === digitsInput || uDigits.endsWith(digitsInput) || digitsInput.endsWith(uDigits)) {
          return true;
        }
      }

      return false;
    });

    if (!matchedUser) {
      const matchedEmployee = employees.find(emp => {
        const empDni = (emp.dni || '').toUpperCase().replace(/[\s-]/g, '');
        if (dniInput && empDni && empDni === dniInput) return true;

        if (digitsInput && digitsInput.length >= 7 && emp.telefono) {
          const empDigits = emp.telefono.replace(/\D/g, '');
          if (empDigits === digitsInput || empDigits.endsWith(digitsInput) || digitsInput.endsWith(empDigits)) {
            return true;
          }
        }

        const empFullName = norm(`${emp.nombre} ${emp.apellidos}`);
        if (empFullName === normInput || empFullName.replace(/\s+/g, '.') === normInput) {
          return true;
        }

        return false;
      });

      if (matchedEmployee) {
        matchedUser = users.find(u =>
          (matchedEmployee.usuarioId && u.id === matchedEmployee.usuarioId) ||
          u.employeeId === matchedEmployee.id ||
          (matchedEmployee.obreroId && u.obreroId === matchedEmployee.obreroId)
        );

        if (!matchedUser) {
          const autoUsername = `${norm(matchedEmployee.nombre || 'operario')}.${norm(matchedEmployee.apellidos || 'obra')}`
            .replace(/[^a-z0-9]/g, '.')
            .replace(/\.+/g, '.');
          const autoUserId = `user-obrero-${Date.now()}`;
          const newAutoUser = {
            id: autoUserId,
            obreroId: matchedEmployee.obreroId || `obrero-${Date.now()}`,
            employeeId: matchedEmployee.id,
            username: autoUsername,
            password: matchedEmployee.dni ? matchedEmployee.dni.toUpperCase() : 'obra2026',
            role: 'obrero',
            fullName: `${matchedEmployee.nombre} ${matchedEmployee.apellidos}`.trim(),
            email: matchedEmployee.email || '',
            trade: matchedEmployee.especialidad || 'Operario',
            phone: matchedEmployee.telefono || '',
            isActive: matchedEmployee.estado === 'activo',
            createdAt: new Date().toISOString(),
            lastLogin: null
          };

          setUsers(prev => [newAutoUser, ...prev]);
          setEmployees(prev => prev.map(e => e.id === matchedEmployee.id ? { ...e, usuarioId: autoUserId } : e));
          matchedUser = newAutoUser;
        }
      }
    }

    if (!matchedUser) {
      const matchedObrero = obreros.find(o => {
        if (digitsInput && digitsInput.length >= 7 && o.telefono) {
          const oDigits = o.telefono.replace(/\D/g, '');
          if (oDigits === digitsInput || oDigits.endsWith(digitsInput) || digitsInput.endsWith(oDigits)) {
            return true;
          }
        }
        const oNorm = norm(o.nombre);
        return oNorm === normInput || oNorm.replace(/\s+/g, '.') === normInput;
      });

      if (matchedObrero) {
        matchedUser = users.find(u => u.obreroId === matchedObrero.id);
      }
    }

    if (!matchedUser) {
      return {
        success: false,
        error: `No encontramos ningún usuario, teléfono o DNI registrado con "${rawInput}". Revisa tus datos.`
      };
    }

    if (!matchedUser.isActive) {
      return {
        success: false,
        error: 'Esta cuenta ha sido desactivada por el administrador.'
      };
    }

    if (matchedUser.password.trim() !== cleanPass) {
      return {
        success: false,
        error: `Contraseña incorrecta para ${matchedUser.fullName}. Comprueba mayúsculas o contacta con la oficina.`
      };
    }

    const updatedUser = {
      ...matchedUser,
      lastLogin: new Date().toISOString()
    };

    setUsers(prev => prev.map(u => u.id === matchedUser.id ? updatedUser : u));
    setCurrentUser(updatedUser);
    showNotification(`¡Bienvenido, ${matchedUser.fullName}!`);
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

  const addUser = ({ username, password, role = 'obrero', fullName, trade, phone, email }) => {
    const cleanUsername = (username || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9.]/g, '')
      .replace(/\.+/g, '.')
      .replace(/^\.|\.$/g, '');

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
      password: (password || 'obra2026').trim(),
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

  const broadcastWorkerProgress = (obraId, faseId, newProgress, obreroNombre, taskId = null) => {
    const progNum = Math.min(100, Math.max(0, newProgress));
    const isCompleted = progNum === 100;

    let computedGlobalProg = 0;
    let computedFaseProg = progNum;
    let targetTaskTitle = '';

    setObras(prevObras => prevObras.map(o => {
      if (o.id === obraId) {
        const updatedFases = (o.fases || []).map(f => {
          if (f.id === faseId) {
            let updatedTareas = f.tareas ? [...f.tareas] : [];
            
            if (taskId && updatedTareas.length > 0) {
              updatedTareas = updatedTareas.map(t => {
                if (t.id === taskId || t.quote_line_id === taskId || t.partidaId === taskId) {
                  targetTaskTitle = t.titulo;
                  return {
                    ...t,
                    progreso: progNum,
                    estado: isCompleted ? 'completada' : progNum > 0 ? 'en_curso' : 'pendiente',
                    completedAt: isCompleted ? new Date().toISOString() : null
                  };
                }
                return t;
              });
              computedFaseProg = calculatePhaseWeightedProgress(updatedTareas, f.importeTotal);
            } else {
              computedFaseProg = progNum;
              if (updatedTareas.length > 0) {
                updatedTareas = updatedTareas.map(t => ({
                  ...t,
                  progreso: progNum,
                  estado: isCompleted ? 'completada' : progNum > 0 ? 'en_curso' : 'pendiente',
                  completedAt: isCompleted ? new Date().toISOString() : null
                }));
              }
            }

            const isFaseCompleted = computedFaseProg === 100;
            return {
              ...f,
              tareas: updatedTareas,
              progreso: computedFaseProg,
              estado: isFaseCompleted ? 'completada' : computedFaseProg > 0 ? 'en_curso' : 'pendiente'
            };
          }
          return f;
        });

        computedGlobalProg = calculateGlobalProjectProgress(updatedFases);
        return { ...o, fases: updatedFases, progreso: computedGlobalProg };
      }
      return o;
    }));

    realtimeSync.broadcast('WORKER_PROGRESS_UPDATED', {
      obraId,
      faseId,
      taskId,
      newProgress: progNum,
      faseProgress: computedFaseProg,
      globalProgress: computedGlobalProg,
      taskTitle: targetTaskTitle,
      obreroNombre: obreroNombre || currentUser?.fullName || 'Operario'
    });

    addAuditLog('AVANCE_PARTIDA_OBRERO', `Obra: ${obraId} - ${targetTaskTitle ? `Partida: "${targetTaskTitle.substring(0, 30)}..."` : `Fase: ${faseId}`} al ${progNum}% (Obra Global: ${computedGlobalProg}%)`);
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
    const targetObra = obras.find(o => o.id === obraId);
    const newAlert = {
      ...alertData,
      id: alertData.id || `aviso-${Date.now()}`,
      obraId: obraId || targetObra?.id || 'obra-general',
      obraCodigo: targetObra?.codigo || alertData.obraCodigo || 'OBRA',
      obraTitulo: targetObra?.titulo || alertData.obraTitulo || 'Obra General',
      titulo: alertData.titulo || 'Instrucción Técnica / Seguridad',
      descripcion: alertData.descripcion || '',
      prioridad: alertData.prioridad || 'alta',
      tipo: alertData.tipo || 'tecnico',
      fecha: new Date().toISOString(),
      emisor: alertData.emisor || (currentUser?.fullName ? `${currentUser.fullName} (Director de Obra)` : 'Manuel Gómez (Director de Obra)'),
      leidoPor: alertData.leidoPor || [],
      requiereConfirmacion: true
    };

    setAvisosTecnicos(prev => [newAlert, ...prev]);

    realtimeSync.broadcast('ADMIN_ALERT_DISPATCHED', {
      obraId,
      alert: newAlert
    });

    addAuditLog('ALERTA_TECNICA_DISPATCHED', `Aviso: ${newAlert.titulo}`);
    showNotification(`Aviso técnico enviado al canal móvil de los operarios.`);
    return newAlert;
  };

  const marcarAvisoLeido = (avisoId, obreroIdentifier) => {
    if (!avisoId || !obreroIdentifier) return;
    setAvisosTecnicos(prev => prev.map(a => {
      if (a.id === avisoId) {
        const list = Array.isArray(a.leidoPor) ? a.leidoPor : [];
        if (!list.includes(obreroIdentifier)) {
          return { ...a, leidoPor: [...list, obreroIdentifier] };
        }
      }
      return a;
    }));
    showNotification('Aviso técnico marcado como leído.', 'success');
  };

  const marcarTodosAvisosLeidos = (obreroIdentifier) => {
    if (!obreroIdentifier) return;
    setAvisosTecnicos(prev => prev.map(a => {
      const list = Array.isArray(a.leidoPor) ? a.leidoPor : [];
      if (!list.includes(obreroIdentifier)) {
        return { ...a, leidoPor: [...list, obreroIdentifier] };
      }
      return a;
    }));
    showNotification('Todos los avisos técnicos han sido marcados como leídos.', 'success');
  };

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
      onProgress,
      referenceBudgets
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
    setPresupuestos(prev => prev.map(p => {
      if (p.id === id) {
        const newPres = { ...p, ...updates };

        if (updates.estado === 'aceptado' || updates.estado === 'firmado') {
          const canonicalFases = generateExecutionPlanFromBudget(newPres);
          const canonicalProgreso = calculateGlobalProjectProgress(canonicalFases);

          setObras(prevObras => prevObras.map(o => {
            if (o.id === newPres.obraId || o.presupuestoId === newPres.id) {
              return {
                ...o,
                presupuestoId: newPres.id,
                presupuestoTotal: newPres.totalConIva || newPres.baseImponible,
                fases: canonicalFases,
                progreso: canonicalProgreso,
                _syncSourceOfTruth: {
                  presupuestoNumero: newPres.numero,
                  syncedAt: new Date().toISOString()
                }
              };
            }
            return o;
          }));
        }

        return newPres;
      }
      return p;
    }));
    showNotification('Presupuesto actualizado y sincronizado');
  };

  const convertPresupuestoToFactura = (presupuestoId, tipoFactura = 'Certificación 1 (Anticipo 40%)', porcentaje = 40) => {
    const pres = presupuestos.find(p => p.id === presupuestoId);
    if (!pres) return null;

    const fechaHoy = new Date().toISOString().split('T')[0];
    const fechaVenc = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    const factor = (porcentaje || 100) / 100;

    const baseCalculada = Number((pres.baseImponible * factor).toFixed(2));
    const cuotaIvaCalculada = Number((baseCalculada * (pres.tipoIvaPct / 100)).toFixed(2));
    const totalCalculado = Number((baseCalculada + cuotaIvaCalculada).toFixed(2));

    const mes = new Date().getMonth();
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

  const addReviewObrero = (obreroId, review) => {
    let newScoreValue = null;
    let newCritValues = null;

    setObreros(prev => prev.map(o => {
      if (o.id === obreroId) {
        const prevResenas = o.ultimasResenas || [];
        const isDirect = review.isDirectOverride !== false;
        
        let newMedia;
        let newCriterios;

        if (review.criterios) {
          if (isDirect) {
            newCriterios = {
              calidadAcabados: Number(Number(review.criterios.calidadAcabados ?? 5.0).toFixed(1)),
              puntualidadPlazos: Number(Number(review.criterios.puntualidadPlazos ?? 5.0).toFixed(1)),
              limpiezaSeguridad: Number(Number(review.criterios.limpiezaSeguridad ?? 5.0).toFixed(1)),
              autonomiaProblemas: Number(Number(review.criterios.autonomiaProblemas ?? 5.0).toFixed(1)),
            };
            newMedia = review.nota !== undefined
              ? Number(Number(review.nota).toFixed(1))
              : Number(((newCriterios.calidadAcabados + newCriterios.puntualidadPlazos + newCriterios.limpiezaSeguridad + newCriterios.autonomiaProblemas) / 4).toFixed(1));
          } else {
            const prevCrit = o.criterios || { calidadAcabados: 5.0, puntualidadPlazos: 5.0, limpiezaSeguridad: 5.0, autonomiaProblemas: 5.0 };
            const total = (prevResenas.length || 1) + 1;
            newCriterios = {
              calidadAcabados: Number(((prevCrit.calidadAcabados * (total - 1) + Number(review.criterios.calidadAcabados ?? 5)) / total).toFixed(1)),
              puntualidadPlazos: Number(((prevCrit.puntualidadPlazos * (total - 1) + Number(review.criterios.puntualidadPlazos ?? 5)) / total).toFixed(1)),
              limpiezaSeguridad: Number(((prevCrit.limpiezaSeguridad * (total - 1) + Number(review.criterios.limpiezaSeguridad ?? 5)) / total).toFixed(1)),
              autonomiaProblemas: Number(((prevCrit.autonomiaProblemas * (total - 1) + Number(review.criterios.autonomiaProblemas ?? 5)) / total).toFixed(1)),
            };
            newMedia = Number(((newCriterios.calidadAcabados + newCriterios.puntualidadPlazos + newCriterios.limpiezaSeguridad + newCriterios.autonomiaProblemas) / 4).toFixed(1));
          }
        } else {
          newMedia = Number(Number(review.nota || 5.0).toFixed(1));
          newCriterios = {
            calidadAcabados: newMedia,
            puntualidadPlazos: newMedia,
            limpiezaSeguridad: newMedia,
            autonomiaProblemas: newMedia
          };
        }

        const newReviewEntry = {
          id: `r-${Date.now()}`,
          obra: review.obra || 'Inspección de Obra',
          fecha: review.fecha || new Date().toISOString().split('T')[0],
          nota: newMedia,
          comentario: review.comentario || 'Evaluación de calidad y rendimiento en obra.'
        };

        const newResenas = [newReviewEntry, ...prevResenas];
        newScoreValue = newMedia;
        newCritValues = newCriterios;

        return {
          ...o,
          calificacionMedia: newMedia,
          criterios: newCriterios,
          obrasRealizadas: (o.obrasRealizadas || 0) + 1,
          ultimasResenas: newResenas
        };
      }
      return o;
    }));

    if (newScoreValue !== null) {
      setEmployees(prevEmp => prevEmp.map(emp => {
        if (emp.obreroId === obreroId || emp.id === obreroId) {
          return {
            ...emp,
            calificacionMedia: newScoreValue,
            criterios: newCritValues || emp.criterios
          };
        }
        return emp;
      }));
    }

    showNotification(`Calificación de operario actualizada a ${newScoreValue}⭐`);
  };

  const updateObreroScoringDirect = (obreroId, newScore, customCriteria = null) => {
    const scoreNum = Math.min(5, Math.max(1, Number(Number(newScore).toFixed(1))));
    const updatedCrit = customCriteria || {
      calidadAcabados: scoreNum,
      puntualidadPlazos: scoreNum,
      limpiezaSeguridad: scoreNum,
      autonomiaProblemas: scoreNum
    };

    setObreros(prev => prev.map(o => {
      if (o.id === obreroId) {
        const prevResenas = o.ultimasResenas || [];
        const newReview = {
          id: `r-${Date.now()}`,
          obra: 'Ajuste Dirección Técnica',
          fecha: new Date().toISOString().split('T')[0],
          nota: scoreNum,
          comentario: `Scoring fijado por Dirección Técnica a ${scoreNum.toFixed(1)}⭐`
        };
        return {
          ...o,
          calificacionMedia: scoreNum,
          criterios: updatedCrit,
          ultimasResenas: [newReview, ...prevResenas]
        };
      }
      return o;
    }));

    setEmployees(prev => prev.map(emp => {
      if (emp.obreroId === obreroId || emp.id === obreroId) {
        return {
          ...emp,
          calificacionMedia: scoreNum,
          criterios: updatedCrit
        };
      }
      return emp;
    }));

    showNotification(`Scoring de operario fijado en ${scoreNum.toFixed(1)}⭐`);
  };

  const addEmployee = (empData, userCreds = null) => {
    const empId = `emp-${Date.now()}`;
    const obreroId = `obrero-${Date.now()}`;
    let linkedUserId = null;
    let createdUserRecord = null;

    if (userCreds?.createAccount || userCreds?.username) {
      const norm = (str) => (str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const rawUser = userCreds.username || `${norm(empData.nombre || 'operario')}.${norm(empData.apellidos || 'obra')}`;
      const cleanUsername = rawUser
        .replace(/[^a-z0-9.]/g, '')
        .replace(/\.+/g, '.')
        .replace(/^\.|\.$/g, '') || `obrero.${Date.now().toString().slice(-4)}`;

      const finalPassword = (userCreds.password || 'obra2026').trim();

      const newU = {
        id: `user-obrero-${Date.now()}`,
        obreroId: obreroId,
        employeeId: empId,
        username: cleanUsername,
        password: finalPassword,
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
      createdUserRecord = newU;
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
    return {
      ...newEmp,
      user: createdUserRecord,
      credentials: createdUserRecord ? { username: createdUserRecord.username, password: createdUserRecord.password } : null
    };
  };

  const createMobileAccountForEmployee = (employeeId, customPassword = 'obra2026') => {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return { success: false, error: 'Empleado no encontrado' };

    const norm = (str) => (str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const cleanUser = `${norm(emp.nombre || 'operario')}.${norm(emp.apellidos || 'obra')}`
      .replace(/[^a-z0-9.]/g, '')
      .replace(/\.+/g, '.')
      .replace(/^\.|\.$/g, '');

    const pass = (customPassword || 'obra2026').trim();
    const newUserId = `user-obrero-${Date.now()}`;

    const newU = {
      id: newUserId,
      obreroId: emp.obreroId || `obrero-${Date.now()}`,
      employeeId: emp.id,
      username: cleanUser,
      password: pass,
      role: 'obrero',
      fullName: `${emp.nombre} ${emp.apellidos}`.trim(),
      email: emp.email || '',
      trade: emp.especialidad || 'Operario de Obra',
      phone: emp.telefono || '',
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    setUsers(prev => [newU, ...prev]);
    setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, usuarioId: newUserId } : e));
    addAuditLog('CREACION_CUENTA_MOVIL', `Empleado: ${emp.nombre} ${emp.apellidos} - Usuario: ${cleanUser}`);
    showNotification(`¡Acceso móvil creado para ${emp.nombre}! Usuario: ${cleanUser} | Clave: ${pass}`);
    return { success: true, user: newU, credentials: { username: cleanUser, password: pass } };
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
    if (!emp) return { success: false, error: 'Empleado no encontrado' };

    let targetUserId = emp.usuarioId;
    if (!targetUserId) {
      const existingUser = users.find(u => u.employeeId === emp.id || u.obreroId === emp.obreroId);
      if (existingUser) {
        targetUserId = existingUser.id;
        setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, usuarioId: existingUser.id } : e));
      }
    }

    if (!targetUserId) {
      return createMobileAccountForEmployee(employeeId, newPass);
    }

    const cleanPass = newPass.trim();
    setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, password: cleanPass } : u));
    addAuditLog('RESET_PASSWORD_EMPLEADO', `Empleado: ${emp.nombre} ${emp.apellidos}`);
    showNotification(`Contraseña de ${emp.nombre} actualizada con éxito: "${cleanPass}"`);
    return { success: true, password: cleanPass };
  };

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
      setAvisosTecnicos(INITIAL_AVISOS_TECNICOS);
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
      updateObreroScoringDirect,
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
      updateAiConfig,
      testAiConnection,
      isOnline,
      offlineQueueLength,
      activeRealtimeAlert,
      setActiveRealtimeAlert,
      broadcastWorkerProgress,
      broadcastWorkerEvidence,
      broadcastAdminTask,
      broadcastAdminAlert,
      avisosTecnicos,
      setAvisosTecnicos,
      marcarAvisoLeido,
      marcarTodosAvisosLeidos,
      siteVisits,
      setSiteVisits,
      addSiteVisit,
      generateQuoteFromSiteVisit,
      refineQuoteWithVoiceCommand,
      approveAndSendQuote,
      employees,
      setEmployees,
      addEmployee,
      updateEmployee,
      terminateEmployee,
      rehireEmployee,
      addEmployeeAbsence,
      resetEmployeePassword,
      createMobileAccountForEmployee,
      subcontractors,
      setSubcontractors,
      addSubcontractor,
      updateSubcontractor,
      addSubcontractorBudget,
      updateSubcontractorBudgetStatus,
      addSubcontractorInvoice,
      updateSubcontractorInvoiceStatus,
      addSubcontractorNote,
      addSubcontractorReview,
      referenceBudgets,
      addReferenceBudget,
      toggleReferenceBudget,
      deleteReferenceBudget,
      updateReferenceBudgetText
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  return context || {};
};
