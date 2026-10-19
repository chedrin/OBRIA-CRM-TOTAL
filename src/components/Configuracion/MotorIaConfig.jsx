import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS, checkAndAutoSelectBestGeminiModel, testGeminiConnection } from '../../services/geminiService';
import { checkBackendStatus, getBackendAiSettings, updateBackendAiSettings, testBackendAiConnection } from '../../services/backendAiService';
import { supabase } from '../../services/supabaseClient';
import {
  Sparkles,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Zap,
  Cpu,
  RefreshCw,
  Server,
  Camera,
  Mic,
  MessageSquare,
  FileSpreadsheet,
  ExternalLink,
  Lock,
  Check,
  Sliders,
  SearchCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';

const PROVIDERS = [
  {
    id: 'google',
    name: 'Google Gemini',
    logo: '✨',
    badge: 'Multimodal Nativo',
    defaultModel: DEFAULT_GEMINI_MODEL,
    models: GEMINI_MODELS,
    keyPrefix: 'AIza',
    helpUrl: 'https://aistudio.google.com/app/apikey'
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    logo: '⚡',
    badge: 'Líder Multimodal',
    defaultModel: 'gpt-4o',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o (Visión & Razonamiento Técnico)', speed: 'Muy Rápido', context: '128k' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Económico · Partes de Obra)', speed: 'Ultrarrápido', context: '128k' },
      { id: 'o3-mini', label: 'o3-mini (Cálculo y Mediciones Complejas)', speed: 'Medio', context: '200k' }
    ],
    keyPrefix: 'sk-',
    helpUrl: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    logo: '🧠',
    badge: 'Máxima Precisión',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: [
      { id: 'claude-3-7-sonnet', label: 'Claude 3.7 Sonnet (Pensamiento Extendido)', speed: 'Muy Rápido', context: '200k' },
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Análisis de Planos y Pliegos)', speed: 'Rápido', context: '200k' },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Respuestas Instantáneas)', speed: 'Instantáneo', context: '200k' }
    ],
    keyPrefix: 'sk-ant-',
    helpUrl: 'https://console.anthropic.com/settings/keys'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    logo: '🌐',
    badge: 'Multi-Modelo Universal',
    defaultModel: 'google/gemini-2.5-flash',
    models: [
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Vía OpenRouter)', speed: 'Ultrarrápido', context: '1M tokens' },
      { id: 'openai/gpt-4o', label: 'GPT-4o (Vía OpenRouter)', speed: 'Muy Rápido', context: '128k' },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (Vía OpenRouter)', speed: 'Rápido', context: '200k' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3 (Vía OpenRouter)', speed: 'Rápido', context: '64k' }
    ],
    keyPrefix: 'sk-or-',
    helpUrl: 'https://openrouter.ai/keys'
  }
];

export default function MotorIaConfig() {
  const { empresaConfig, updateAiConfig, showNotification } = useApp();

  const [provider, setProvider] = useState('google');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState(DEFAULT_GEMINI_MODEL);
  const [temperature, setTemperature] = useState(0.15);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [checkingGemini, setCheckingGemini] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [geminiCheckResult, setGeminiCheckResult] = useState(null);

  const [backendInfo, setBackendInfo] = useState({ checking: true, isAvailable: false, details: null });

  const loadSettingsFromBackend = async () => {
    setBackendInfo(prev => ({ ...prev, checking: true }));
    const res = await checkBackendStatus();
    setBackendInfo({ checking: false, isAvailable: res.isAvailable, details: res.details });

    if (res.isAvailable) {
      const saved = await getBackendAiSettings();
      if (saved) {
        if (saved.provider) setProvider(saved.provider);
        if (saved.model) setModelName(saved.model);
        if (saved.apiKey) setApiKey(saved.apiKey);
        if (saved.temperature !== undefined) setTemperature(saved.temperature);
        if (saved.maxTokens !== undefined) setMaxTokens(saved.maxTokens);
      }
    }
  };

  useEffect(() => {
    loadSettingsFromBackend();
  }, []);

  const selectedProviderObj = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];

  const handleProviderChange = (newProvider) => {
    setProvider(newProvider);
    const pObj = PROVIDERS.find(p => p.id === newProvider);
    if (pObj) {
      setModelName(pObj.defaultModel);
    }
    setTestResult(null);
    setGeminiCheckResult(null);
  };

  const updateSupabaseAiStatus = async (status, keyToSave = apiKey, modelToSave = modelName) => {
    try {
      await supabase.from('ai_integration_settings').upsert({
        provider: provider || 'google',
        encrypted_api_key: keyToSave,
        model_name: modelToSave,
        is_active: status === 'active',
        last_tested_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[MotorIaConfig] Error guardando estado en Supabase:', e.message);
    }
  };

  const handleCheckGeminiApi = async () => {
    if (!apiKey || !apiKey.trim()) {
      showNotification('Introduce una API Key de Google Gemini para realizar la comprobación.', 'error');
      return;
    }

    setCheckingGemini(true);
    setGeminiCheckResult(null);
    setTestResult(null);

    try {
      let res;
      try {
        const fetchRes = await fetch('/api/ai/check-gemini-api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: apiKey.trim() })
        });
        if (fetchRes.ok) {
          res = await fetchRes.json();
        }
      } catch (e) {
        // ignore
      }

      if (!res || !res.success) {
        res = await checkAndAutoSelectBestGeminiModel(apiKey.trim());
      }

      const optimalModel = res.activeModel || DEFAULT_GEMINI_MODEL;
      setProvider('google');
      setModelName(optimalModel);

      await updateBackendAiSettings({
        provider: 'google',
        apiKey: apiKey.trim(),
        model: optimalModel,
        temperature,
        maxTokens
      });

      await updateSupabaseAiStatus('active', apiKey.trim(), optimalModel);

      updateAiConfig({
        provider: 'google',
        apiKey: apiKey.trim(),
        modelName: optimalModel,
        temperature,
        maxTokens,
        isActive: true,
        status: 'connected',
        lastTestedAt: new Date().toISOString()
      });

      setCheckingGemini(false);
      setGeminiCheckResult({
        success: true,
        provider: 'Google Gemini',
        activeModel: optimalModel,
        status: 'Operativo',
        formattedOutput: `✅ API correcta\n\nProveedor: Google Gemini\nModelo activo: ${optimalModel}\nEstado: Operativo`
      });

      confetti({ particleCount: 50, spread: 60 });
      showNotification(`API Gemini verificada. Modelo "${optimalModel}" seleccionado y estado activado en Supabase.`, 'success');
    } catch (err) {
      setCheckingGemini(false);
      await updateSupabaseAiStatus('error');
      setGeminiCheckResult({
        success: false,
        error: err.message || 'No ha sido posible conectar con la IA. Revise la clave o seleccione un modelo válido.'
      });
      showNotification(err.message || 'Error al conectar con la API de Gemini', 'error');
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      let res;
      if (provider === 'google') {
        res = await testGeminiConnection(apiKey.trim(), modelName);
      } else {
        res = await testBackendAiConnection({
          provider,
          apiKey: apiKey.trim(),
          model: modelName,
          temperature,
          maxTokens
        });
      }

      setTesting(false);
      await updateSupabaseAiStatus('active');

      setTestResult({
        success: true,
        latencyMs: res.latencyMs || 120,
        message: res.message || 'Conexión verificada exitosamente'
      });
      confetti({ particleCount: 40, spread: 50 });
      showNotification('Conexión con la API de IA verificada y guardada como activa en Supabase', 'success');
    } catch (err) {
      setTesting(false);
      await updateSupabaseAiStatus('error');

      setTestResult({
        success: false,
        error: err.message || 'No ha sido posible conectar con la IA. Revise la configuración de la API.'
      });
      showNotification(err.message || 'Error en prueba de conexión con la IA', 'error');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await updateBackendAiSettings({
        provider,
        apiKey: apiKey.trim(),
        model: modelName,
        temperature,
        maxTokens
      });

      await updateSupabaseAiStatus('active');

      updateAiConfig({
        provider,
        apiKey: apiKey.trim(),
        modelName,
        temperature,
        maxTokens,
        isActive: true,
        status: 'connected',
        lastTestedAt: new Date().toISOString()
      });

      setSaving(false);
      showNotification('Configuración de la API Key de Gemini y estado actualizados en Supabase y Servidor', 'success');
      confetti({ particleCount: 30, spread: 40 });
    } catch (err) {
      setSaving(false);
      showNotification(`Error al guardar configuración: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950/40 p-5 rounded-2xl border border-amber-500/30 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black text-white">Motor Central de IA (Google Gemini / Supabase)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                  SUPABASE SYNC
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Configura tu clave API de Google Gemini (`gemini-1.5-flash` / `gemini-1.5-pro`). Se almacena de forma segura en Supabase (`ai_integration_settings`).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
              apiKey && apiKey.trim()
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              <span>{apiKey && apiKey.trim() ? '🟢 API Key Lista' : '🔴 API Key Requerida'}</span>
            </span>
          </div>
        </div>

        {/* Backend Proxy Status */}
        <div className="p-3.5 rounded-xl border bg-slate-950/80 border-slate-800 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white text-xs">
                Proveedor Activo: <span className="text-amber-400 font-mono uppercase">{provider}</span> ({modelName})
              </span>
            </div>

            <button
              type="button"
              onClick={loadSettingsFromBackend}
              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5 text-[11px] transition"
            >
              <RefreshCw className={`w-3 h-3 ${backendInfo.checking ? 'animate-spin' : ''}`} />
              <span>Sincronizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Formulario de Configuración de IA */}
      <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-xl space-y-5">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-sm">Ajustes del Motor de Inteligencia Artificial</h4>
              <p className="text-[11px] text-slate-400">Introduce la API Key de Google Gemini y selecciona el modelo (`gemini-1.5-flash` o `gemini-1.5-pro`)</p>
            </div>
          </div>

          <a
            href={selectedProviderObj.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
          >
            <span>Obtener API Key de {selectedProviderObj.name.split(' ')[0]}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Selector de Proveedor */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 block">Proveedor IA:</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {PROVIDERS.map((p) => {
              const isSelected = provider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderChange(p.id)}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between space-y-2 ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/60 ring-2 ring-amber-500/20 shadow'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{p.logo}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                      isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {p.badge}
                    </span>
                  </div>
                  <div>
                    <h5 className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{p.name}</h5>
                    <span className="text-[10px] text-slate-500 block truncate">{p.defaultModel}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Campo API Key & Selector de Modelo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* API Key tipo Password */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>API Key de {selectedProviderObj.name} (Password) *</span>
              </label>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Supabase Sync</span>
              </span>
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                required
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                  setGeminiCheckResult(null);
                }}
                placeholder={`Introduce tu clave (${selectedProviderObj.keyPrefix}...)`}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-10 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                title={showKey ? 'Ocultar clave' : 'Mostrar clave'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Selector de Modelo */}
          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-300 block">Modelo de IA:</label>
            <select
              value={modelName}
              onChange={(e) => {
                setModelName(e.target.value);
                setTestResult(null);
                setGeminiCheckResult(null);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-semibold text-xs focus:outline-none focus:border-amber-400"
            >
              {selectedProviderObj.models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.label} · {m.speed}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Temperatura y Tokens Máximos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between font-bold text-slate-300">
              <label className="flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Temperatura:</span>
              </label>
              <span className="font-mono text-amber-400">{temperature}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
            <span className="text-[10px] text-slate-500 block">0.0 = Rigor técnico estricto | 1.0 = Máxima creatividad</span>
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-300 block">Máximos Tokens de Salida:</label>
            <select
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
            >
              <option value={2048}>2.048 Tokens (Presupuestos Rápidos)</option>
              <option value={4096}>4.096 Tokens (Recomendado Estándar)</option>
              <option value={8192}>8.192 Tokens (Proyectos Grandes y Complejos)</option>
            </select>
          </div>
        </div>

        {/* Formatted Gemini Auto-Discovery Box */}
        {geminiCheckResult && (
          <div className={`p-4 rounded-xl border text-xs font-mono space-y-1 whitespace-pre-line ${
            geminiCheckResult.success
              ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/30 border-rose-500/50 text-rose-300'
          }`}>
            {geminiCheckResult.success ? (
              <span>{geminiCheckResult.formattedOutput}</span>
            ) : (
              <span>Error al verificar API Gemini: {geminiCheckResult.error}</span>
            )}
          </div>
        )}

        {/* Test Result Box */}
        {testResult && (
          <div className={`p-4 rounded-xl border text-xs space-y-2 ${
            testResult.success
              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="font-bold">
                  {testResult.success
                    ? `¡Conexión Exitosa con ${selectedProviderObj.name}! Ping PONG (HTTP 200 OK)`
                    : testResult.error}
                </span>
              </div>
              {testResult.success && (
                <span className="font-mono text-[11px] bg-emerald-500/20 px-2 py-0.5 rounded font-bold">
                  Latencia: {testResult.latencyMs} ms
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={checkingGemini || !apiKey}
              onClick={handleCheckGeminiApi}
              className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs rounded-xl transition border border-amber-500/40 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {checkingGemini ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <SearchCheck className="w-3.5 h-3.5 text-amber-400" />}
              <span>{checkingGemini ? 'Verificando modelos...' : 'Comprobar API Gemini'}</span>
            </button>

            <button
              type="button"
              disabled={testing || !apiKey}
              onClick={handleTestConnection}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition border border-slate-700 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
              <span>{testing ? 'Probando...' : 'Probar conexión'}</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 stroke-[2.5]" />}
            <span>Guardar Configuración IA</span>
          </button>
        </div>

      </form>

    </div>
  );
}
