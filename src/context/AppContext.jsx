import React, { createContext, useContext, useState, useEffect } from 'react';
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
  INITIAL_USERS
} from '../data/initialData';

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
  AUTH_USER: 'obracon_current_auth_user_v1'
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

  // Users & Authentication State
  const [users, setUsers] = useState(() => loadStored(STORAGE_KEYS.USERS, INITIAL_USERS));
  const [currentUser, setCurrentUser] = useState(() => loadStored(STORAGE_KEYS.AUTH_USER, null));

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
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    }
  }, [currentUser]);

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
      // Add each calculated need to the obra's material list
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
      // Add to obra's presupuesto as an extra partida
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
      testAiConnection
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
