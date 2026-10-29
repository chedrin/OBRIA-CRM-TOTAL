import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  HardHat,
  Lock,
  User,
  ArrowRight,
  ShieldAlert,
  Eye,
  EyeOff
} from 'lucide-react';
import PwaInstallPrompt from '../PortalObrero/PwaInstallPrompt';

export default function LoginObreroView({ onSwitchToAdmin }) {
  const { login } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await login(username, password);
    setLoading(false);

    if (!res.success) {
      setError(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      
      {/* Top Bar with PWA prompt */}
      <div className="w-full max-w-md mx-auto space-y-4 pt-2 sm:pt-6">
        <PwaInstallPrompt />

        {/* Brand Header */}
        <div className="text-center space-y-2 pt-4">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 mx-auto flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/25">
            <HardHat className="w-9 h-9 stroke-[2.3]" />
          </div>
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              Portal del Operario en Obra
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-2">
              ObraMaster Móvil
            </h1>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
              Accede a tus obras asignadas, control horario, partes de avance con foto y notas de voz.
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
          
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Username / Phone / DNI */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 block">
                  Usuario, Teléfono o DNI
                </label>
                <span className="text-xs text-amber-400/80">3 formas de entrar</span>
              </div>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="ej: pedro.gomez, 611223344 o DNI"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
                />
              </div>
              <p className="text-xs text-slate-400">
                Puedes acceder con tu nombre de usuario, tu número de móvil o tu DNI/NIE.
              </p>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Introduce tu clave"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-11 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm rounded-2xl transition shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 active:scale-98"
            >
              <span>{loading ? 'Entrando...' : 'Entrar a la Obra'}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </form>

        </div>

      </div>

      {/* Footer & Admin Switch */}
      <div className="text-center py-4 space-y-2">
        <button
          onClick={onSwitchToAdmin}
          className="text-xs text-slate-400 hover:text-amber-400 transition underline underline-offset-4"
        >
          ¿Eres el jefe de obra o administrador? Acceder al panel de gestión
        </button>
        <p className="text-xs text-slate-600">
          ObraMaster AI © 2026 · Conexión segura con cifrado
        </p>
      </div>

    </div>
  );
}
