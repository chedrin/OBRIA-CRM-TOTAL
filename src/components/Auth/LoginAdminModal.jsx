import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  Lock,
  User,
  ArrowRight,
  ShieldAlert,
  X,
  Eye,
  EyeOff
} from 'lucide-react';

export default function LoginAdminModal({ isOpen, onClose, onSwitchToWorker }) {
  const { login, logout } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await login(username, password);
    setLoading(false);

    if (!res.success) {
      setError(res.error);
    } else {
      if (res.user.role !== 'admin') {
        // Entró con una cuenta de operario: se cierra la sesión y se avisa.
        logout();
        setError('Esta cuenta no tiene permisos de administrador.');
      } else {
        if (onClose) onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 relative">
        
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center border border-amber-500/30">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white">Acceso Administración</h2>
          <p className="text-xs text-slate-400">
            Panel de control general, presupuestos, facturación y gestión de operarios.
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">Usuario o Email</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="tu usuario"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">Contraseña</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Accediendo...' : 'Iniciar Sesión Admin'}</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>

        {onSwitchToWorker && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={onSwitchToWorker}
              className="text-xs text-slate-400 hover:text-amber-400 transition underline underline-offset-4"
            >
              ¿Eres un operario en obra? Ir al Portal Móvil del Obrero
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
