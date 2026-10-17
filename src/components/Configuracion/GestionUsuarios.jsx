import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Users,
  ShieldCheck,
  UserPlus,
  KeyRound,
  Lock,
  Unlock,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail,
  HardHat,
  Briefcase,
  Sparkles,
  MessageSquare
} from 'lucide-react';

export default function GestionUsuarios() {
  const {
    users,
    employees = [],
    addEmployee,
    currentUser,
    addUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
    resetUserPassword,
    changeAdminPassword,
    generateRandomPassword,
    createMobileAccountForEmployee,
    showNotification
  } = useApp();

  // Active Tab: obreros vs admins vs mi_perfil
  const [activeTab, setActiveTab] = useState('obreros');

  // Compute clean normalized username
  const computeUsername = (nombre, apellidos) => {
    const raw = `${nombre || ''} ${apellidos || ''}`.trim();
    if (!raw) return '';
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join('.');
  };

  // Form State: Nuevo Obrero
  const [showAddObreroModal, setShowAddObreroModal] = useState(false);
  const [obreroForm, setObreroForm] = useState({
    nombre: '',
    apellidos: '',
    especialidad: 'Albañilería & Alicatados',
    telefono: '',
    username: '',
    password: 'obra2026',
    email: '',
    isCustomUsername: false
  });

  // Modal de confirmación de credenciales
  const [createdCredentialsModal, setCreatedCredentialsModal] = useState(null);

  // Form State: Nuevo Admin
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    phone: ''
  });

  // Modal Reset Password
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState(null);
  const [newResetPassword, setNewResetPassword] = useState('');

  // Form State: Cambiar Mi Contraseña (Admin actual)
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [adminPassMsg, setAdminPassMsg] = useState(null);

  // Copied State
  const [copiedId, setCopiedId] = useState(null);
  const [copiedCred, setCopiedCred] = useState(null);

  const obrerosList = users.filter(u => u.role === 'obrero');
  const adminsList = users.filter(u => u.role === 'admin');

  // Find employees that don't have mobile user credentials
  const unlinkedEmployees = (employees || []).filter(e =>
    e.estado === 'activo' &&
    !users.some(u => u.id === e.usuarioId || u.employeeId === e.id || (e.obreroId && u.obreroId === e.obreroId))
  );

  // Submit Nuevo Obrero
  const handleCreateObrero = (e) => {
    e.preventDefault();
    const fullName = `${obreroForm.nombre.trim()} ${obreroForm.apellidos.trim()}`.trim();
    const cleanUser = (obreroForm.username || computeUsername(obreroForm.nombre, obreroForm.apellidos) || 'operario')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9.]/g, '')
      .replace(/\.+/g, '.')
      .replace(/^\.|\.$/g, '');

    const pass = (obreroForm.password || 'obra2026').trim();

    const res = addUser({
      username: cleanUser,
      password: pass,
      role: 'obrero',
      fullName,
      trade: obreroForm.especialidad,
      phone: obreroForm.telefono,
      email: obreroForm.email
    });

    if (res.success) {
      // Sincronizar automáticamente con la ficha de empleado en RRHH si no existe
      const existingEmp = (employees || []).find(e => 
        (e.nombre.toLowerCase() === obreroForm.nombre.trim().toLowerCase() && 
         e.apellidos.toLowerCase() === obreroForm.apellidos.trim().toLowerCase()) ||
        e.usuarioId === res.user?.id
      );

      if (!existingEmp && addEmployee) {
        addEmployee({
          nombre: obreroForm.nombre.trim(),
          apellidos: obreroForm.apellidos.trim(),
          especialidad: obreroForm.especialidad,
          telefono: obreroForm.telefono,
          email: obreroForm.email,
          dni: `DNI-${Math.floor(10000000 + Math.random() * 90000000)}K`,
          categoria: 'Oficial 1ª',
          tipoContrato: 'indefinido',
          salarioBaseMensual: 1750,
          plusConvenio: 200,
          estado: 'activo'
        }, {
          createAccount: false // Ya creado por addUser
        });
      }

      setShowAddObreroModal(false);
      setCreatedCredentialsModal({
        fullName,
        username: cleanUser,
        password: pass,
        phone: obreroForm.telefono || '',
        dni: ''
      });

      setObreroForm({
        nombre: '',
        apellidos: '',
        especialidad: 'Albañilería & Alicatados',
        telefono: '',
        username: '',
        password: 'obra2026',
        email: '',
        isCustomUsername: false
      });
    } else {
      showNotification(res.error, 'error');
    }
  };

  // Submit Nuevo Admin
  const handleCreateAdmin = (e) => {
    e.preventDefault();
    const res = addUser({
      username: adminForm.username,
      password: adminForm.password || 'admin123',
      role: 'admin',
      fullName: adminForm.fullName,
      email: adminForm.email,
      phone: adminForm.phone,
      trade: 'Dirección Técnica'
    });

    if (res.success) {
      setShowAddAdminModal(false);
      setAdminForm({ fullName: '', username: '', email: '', password: '', phone: '' });
    } else {
      showNotification(res.error, 'error');
    }
  };

  // Submit Reset Password
  const handleConfirmResetPassword = (e) => {
    e.preventDefault();
    if (!selectedUserForReset) return;

    const res = resetUserPassword(selectedUserForReset.id, newResetPassword);
    if (res.success) {
      setShowResetModal(false);
      setSelectedUserForReset(null);
      setNewResetPassword('');
    }
  };

  // Submit Mi Contraseña (Admin actual)
  const handleChangeMyPassword = (e) => {
    e.preventDefault();
    setAdminPassMsg(null);

    if (newAdminPassword !== confirmAdminPassword) {
      setAdminPassMsg({ type: 'error', text: 'Las contraseñas nuevas no coinciden.' });
      return;
    }

    const currentId = currentUser?.id || adminsList[0]?.id;
    const res = changeAdminPassword(currentId, currentAdminPassword, newAdminPassword);

    if (res.success) {
      setAdminPassMsg({ type: 'success', text: '¡Contraseña actualizada con éxito!' });
      setCurrentAdminPassword('');
      setNewAdminPassword('');
      setConfirmAdminPassword('');
    } else {
      setAdminPassMsg({ type: 'error', text: res.error });
    }
  };

  // Copy access WhatsApp message
  const handleCopyCredentials = (user) => {
    const origin = window.location.origin;
    const path = window.location.pathname.replace(/\/$/, '');
    const loginUrl = `${origin}${path}/#empleados`;

    const text = `👷 Hola ${user.fullName}, aquí tienes tu acceso al Portal del Operario en ObraMaster:

🔗 Enlace de acceso: ${loginUrl}
👤 Usuario: ${user.username}
🔑 Contraseña: ${user.password}

Guarda este enlace en tu móvil o pulsa en "Añadir a pantalla de inicio" para tener la app siempre disponible.`;

    navigator.clipboard.writeText(text);
    setCopiedId(user.id);
    showNotification(`Datos de acceso de ${user.fullName} copiados al portapapeles.`);
    setTimeout(() => setCopiedId(null), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>Control de Acceso Basado en Roles (RBAC) & Credenciales</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Gestión de Usuarios y Accesos</h2>
          <p className="text-xs text-slate-400 mt-1">
            Crea cuentas independientes para operarios con contraseñas de acceso al portal móvil y gestiona administradores del sistema.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'obreros' ? (
            <button
              onClick={() => {
                setObreroForm(prev => ({ ...prev, password: generateRandomPassword() }));
                setShowAddObreroModal(true);
              }}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition shadow-lg shadow-amber-500/20 active:scale-95 flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              <span>Alta Nuevo Operario</span>
            </button>
          ) : activeTab === 'admins' ? (
            <button
              onClick={() => {
                setAdminForm(prev => ({ ...prev, password: generateRandomPassword() }));
                setShowAddAdminModal(true);
              }}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition shadow-lg shadow-amber-500/20 active:scale-95 flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
              <span>Nuevo Administrador</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Subtabs Navigation */}
      <div className="flex gap-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('obreros')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === 'obreros'
              ? 'border-amber-400 text-amber-400 bg-slate-900/80'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <HardHat className="w-4 h-4" />
          <span>Operarios & Obreros ({obrerosList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('admins')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === 'admins'
              ? 'border-amber-400 text-amber-400 bg-slate-900/80'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Administradores ({adminsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('mi_perfil')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === 'mi_perfil'
              ? 'border-amber-400 text-amber-400 bg-slate-900/80'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Cambiar Mi Contraseña</span>
        </button>
      </div>

      {/* TAB 1: OPERARIOS / OBREROS */}
      {activeTab === 'obreros' && (
        <div className="space-y-4">
          
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>
                Cada operario accede exclusivamente a <code className="text-amber-400 bg-slate-950 px-1.5 py-0.5 rounded font-mono">/#empleados</code> con su usuario y contraseña.
              </span>
            </div>
            <span className="text-slate-400 text-[11px]">
              Pulsa <strong className="text-amber-400">"Copiar Datos"</strong> para enviar los datos de acceso por WhatsApp.
            </span>
          </div>

          {unlinkedEmployees.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-amber-300 block">
                    {unlinkedEmployees.length} operario(s) dados de alta en RRHH no tienen cuenta móvil vinculada:
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    {unlinkedEmployees.map(e => `${e.nombre} ${e.apellidos}`).join(', ')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  unlinkedEmployees.forEach(emp => {
                    createMobileAccountForEmployee(emp.id, 'obra2026');
                  });
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl transition text-xs shrink-0 shadow-md shadow-amber-500/20"
              >
                Activar Acceso Móvil ({unlinkedEmployees.length})
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {obrerosList.map((user) => (
              <div
                key={user.id}
                className={`bg-slate-900 border rounded-2xl p-4 shadow-sm transition space-y-3 flex flex-col justify-between ${
                  user.isActive ? 'border-slate-800 hover:border-slate-700' : 'border-rose-900/40 bg-slate-950/80 opacity-75'
                }`}
              >
                <div className="space-y-2.5">
                  {/* Top card */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black text-sm">
                        {user.fullName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-white text-sm leading-tight">{user.fullName}</h4>
                        <span className="text-[11px] text-amber-400 font-semibold">{user.trade}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleUserStatus(user.id)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition ${
                        user.isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      }`}
                      title={user.isActive ? 'Desactivar cuenta' : 'Activar cuenta'}
                    >
                      {user.isActive ? '● Activo' : '○ Desactivado'}
                    </button>
                  </div>

                  {/* Credentials summary */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Usuario:</span>
                      <code className="text-white font-mono font-bold">{user.username}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Contraseña:</span>
                      <code className="text-amber-400 font-mono font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {user.password}
                      </code>
                    </div>
                    {user.phone && (
                      <div className="flex items-center justify-between text-slate-400 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>Móvil:</span>
                        </span>
                        <span className="text-slate-300 font-mono">{user.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1 text-xs">
                  <button
                    onClick={() => handleCopyCredentials(user)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold flex items-center gap-1.5 transition text-[11px]"
                    title="Copiar mensaje de WhatsApp para el operario"
                  >
                    {copiedId === user.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Datos</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setSelectedUserForReset(user);
                        setNewResetPassword(generateRandomPassword());
                        setShowResetModal(true);
                      }}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-400 rounded-lg font-bold flex items-center gap-1 transition text-[11px]"
                      title="Cambiar contraseña de este operario"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Clave</span>
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm(`¿Seguro que deseas eliminar al operario ${user.fullName}?`)) {
                          deleteUser(user.id);
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* TAB 2: ADMINISTRADORES */}
      {activeTab === 'admins' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {adminsList.map((admin) => (
              <div
                key={admin.id}
                className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-400 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
                        <ShieldCheck className="w-6 h-6 stroke-[2.3]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-white text-base">{admin.fullName}</h4>
                          <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold px-2 py-0.5 rounded uppercase">
                            Admin
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{admin.email || 'Sin correo asociado'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Usuario:</span>
                      <code className="text-white font-mono font-bold">{admin.username}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Contraseña:</span>
                      <code className="text-amber-400 font-mono font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {admin.password}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-[11px]">Acceso total al sistema</span>
                  <button
                    onClick={() => {
                      setSelectedUserForReset(admin);
                      setNewResetPassword(generateRandomPassword());
                      setShowResetModal(true);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg font-bold flex items-center gap-1.5 transition text-xs"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Cambiar Clave</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: MI CONTRASEÑA */}
      {activeTab === 'mi_perfil' && (
        <div className="max-w-md bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
          <div>
            <h3 className="font-black text-white text-base">Modificar Mi Contraseña de Administrador</h3>
            <p className="text-xs text-slate-400 mt-1">
              Introduce tu contraseña actual para confirmar tu identidad antes de definir la nueva.
            </p>
          </div>

          {adminPassMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                adminPassMsg.type === 'error'
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                  : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              }`}
            >
              {adminPassMsg.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{adminPassMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleChangeMyPassword} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-slate-300 font-bold block">Contraseña Actual:</label>
              <input
                type="password"
                required
                value={currentAdminPassword}
                onChange={(e) => setCurrentAdminPassword(e.target.value)}
                placeholder="Tu clave actual"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-bold block">Nueva Contraseña:</label>
              <input
                type="password"
                required
                minLength={4}
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                placeholder="Mínimo 4 caracteres"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-bold block">Confirmar Nueva Contraseña:</label>
              <input
                type="password"
                required
                minLength={4}
                value={confirmAdminPassword}
                onChange={(e) => setConfirmAdminPassword(e.target.value)}
                placeholder="Repite la nueva clave"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow shadow-amber-500/20"
            >
              Actualizar Mi Contraseña
            </button>
          </form>
        </div>
      )}

      {/* MODAL: ALTA NUEVO OBRERO */}
      {showAddObreroModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-black text-white text-base">Alta de Operario para App Móvil</h3>
              </div>
              <button
                onClick={() => setShowAddObreroModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateObrero} className="space-y-3.5 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Carlos"
                    value={obreroForm.nombre}
                    onChange={(e) => {
                      const val = e.target.value;
                      setObreroForm(prev => ({
                        ...prev,
                        nombre: val,
                        username: prev.isCustomUsername ? prev.username : computeUsername(val, prev.apellidos)
                      }));
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Apellidos *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Ruiz Gómez"
                    value={obreroForm.apellidos}
                    onChange={(e) => {
                      const val = e.target.value;
                      setObreroForm(prev => ({
                        ...prev,
                        apellidos: val,
                        username: prev.isCustomUsername ? prev.username : computeUsername(prev.nombre, val)
                      }));
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Especialidad / Puesto</label>
                  <select
                    value={obreroForm.especialidad}
                    onChange={(e) => setObreroForm({ ...obreroForm, especialidad: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="Albañilería & Alicatados">Albañilería & Alicatados</option>
                    <option value="Demoliciones & Carga">Demoliciones & Carga</option>
                    <option value="Yesos & Pladur">Yesos & Pladur</option>
                    <option value="Pintura & Acabados">Pintura & Acabados</option>
                    <option value="Electricidad Oficial">Electricidad Oficial</option>
                    <option value="Fontanería & Clima">Fontanería & Clima</option>
                    <option value="Carpintería & Tarima">Carpintería & Tarima</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Teléfono Móvil (WhatsApp)</label>
                  <input
                    type="tel"
                    placeholder="+34 600 123 456"
                    value={obreroForm.telefono}
                    onChange={(e) => setObreroForm({ ...obreroForm, telefono: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Login credentials section */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                  Credenciales de Acceso a la App Móvil:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400 font-semibold text-xs">Nombre de Usuario *</label>
                      {obreroForm.isCustomUsername && (
                        <button
                          type="button"
                          onClick={() => setObreroForm(prev => ({
                            ...prev,
                            isCustomUsername: false,
                            username: computeUsername(prev.nombre, prev.apellidos)
                          }))}
                          className="text-[10px] text-amber-400 hover:underline"
                        >
                          Auto
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="ej: carlos.ruiz"
                      value={obreroForm.username}
                      onChange={(e) => setObreroForm({ ...obreroForm, username: e.target.value.toLowerCase(), isCustomUsername: true })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400 font-semibold text-xs">Contraseña Móvil *</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setObreroForm({ ...obreroForm, password: 'obra2026' })}
                          className="text-slate-400 hover:text-white text-[10px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700"
                        >
                          obra2026
                        </button>
                        <button
                          type="button"
                          onClick={() => setObreroForm({ ...obreroForm, password: generateRandomPassword() })}
                          className="text-amber-400 hover:text-amber-300 text-[10px] font-bold"
                        >
                          ⚡ Aleatoria
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      required
                      value={obreroForm.password}
                      onChange={(e) => setObreroForm({ ...obreroForm, password: e.target.value })}
                      placeholder="obra2026"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-amber-400 font-mono font-bold"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  💡 El operario podrá identificarse en <code>/#empleados</code> con este <strong>usuario</strong>, con su <strong>número de móvil</strong> o con su <strong>DNI</strong>.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddObreroModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow shadow-amber-500/20"
                >
                  Dar de Alta Operario
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {showResetModal && selectedUserForReset && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Restablecer Contraseña</span>
              </h3>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs">
              <span className="text-slate-400 block">Usuario a modificar:</span>
              <strong className="text-white block text-sm">{selectedUserForReset.fullName}</strong>
              <span className="text-amber-400 font-mono text-[11px]">@{selectedUserForReset.username}</span>
            </div>

            <form onSubmit={handleConfirmResetPassword} className="space-y-3 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-slate-300 font-bold">Nueva Contraseña:</label>
                  <button
                    type="button"
                    onClick={() => setNewResetPassword(generateRandomPassword())}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-bold"
                  >
                    ⚡ Generar aleatoria
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-amber-400 font-mono font-bold text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-3.5 py-1.5 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow"
                >
                  Guardar Nueva Clave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ALTA NUEVO ADMINISTRADOR */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-white text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Nuevo Administrador</span>
              </h3>
              <button
                onClick={() => setShowAddAdminModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Laura Martínez"
                  value={adminForm.fullName}
                  onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Nombre de Usuario *</label>
                <input
                  type="text"
                  required
                  placeholder="laura.admin"
                  value={adminForm.username}
                  onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value.toLowerCase().trim() })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Email Corporativo</label>
                <input
                  type="email"
                  placeholder="laura@obramaster.es"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Contraseña *</label>
                <input
                  type="text"
                  required
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-amber-400 font-mono font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="px-3.5 py-1.5 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow"
                >
                  Crear Administrador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN: CREDENCIALES GENERADAS */}
      {createdCredentialsModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-emerald-500/40 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                ¡Operario Creado & Acceso Móvil Listo!
              </span>
              <h3 className="text-lg font-black text-white">{createdCredentialsModal.fullName}</h3>
              <p className="text-xs text-slate-300">
                El operario ya puede acceder inmediatamente a la app desde <code className="text-amber-400 font-mono">/#empleados</code>.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Enlace de la App:</span>
                <code className="text-amber-400 font-mono font-bold">{window.location.origin}/#empleados</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Usuario móvil:</span>
                <div className="flex items-center gap-1.5">
                  <code className="text-white font-mono font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {createdCredentialsModal.username}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdCredentialsModal.username);
                      setCopiedCred('user');
                      setTimeout(() => setCopiedCred(null), 2500);
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    {copiedCred === 'user' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Contraseña:</span>
                <div className="flex items-center gap-1.5">
                  <code className="text-amber-400 font-mono font-black bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {createdCredentialsModal.password}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdCredentialsModal.password);
                      setCopiedCred('pass');
                      setTimeout(() => setCopiedCred(null), 2500);
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    {copiedCred === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              {createdCredentialsModal.phone && (
                <div className="flex items-center justify-between pt-1 text-slate-400 border-t border-slate-800/60">
                  <span>Teléfono móvil:</span>
                  <span className="text-slate-300 font-mono">{createdCredentialsModal.phone}</span>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  const msg = `Hola ${createdCredentialsModal.fullName}, aquí tienes tus datos de acceso a la App de ObraMaster:\n\n🔗 Web Móvil: ${window.location.origin}/#empleados\n👤 Usuario: ${createdCredentialsModal.username}\n🔑 Contraseña: ${createdCredentialsModal.password}\n\n(También puedes identificarte con tu teléfono o DNI).\nRecuerda usar la opción 'Añadir a pantalla de inicio' en tu navegador para tenerla como app.`;
                  navigator.clipboard.writeText(msg);
                  setCopiedCred('whatsapp');
                  showNotification('¡Mensaje copiado para enviar por WhatsApp o SMS!');
                  setTimeout(() => setCopiedCred(null), 2500);
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition flex items-center justify-center gap-2 text-xs shadow-lg shadow-emerald-600/20"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{copiedCred === 'whatsapp' ? '¡Mensaje Copiado!' : 'Copiar Mensaje para WhatsApp / SMS'}</span>
              </button>

              <button
                onClick={() => setCreatedCredentialsModal(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl transition text-xs"
              >
                Entendido / Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
