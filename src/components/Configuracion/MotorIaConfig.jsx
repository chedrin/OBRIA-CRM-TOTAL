import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
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
  Layers,
  Mic,
  Camera,
  MessageSquare,
  FileSpreadsheet,
  ArrowRight,
  ExternalLink,
  Lock,
  Flame,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';

const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    logo: '⚡',
    badge: 'Líder Multimodal',
    defaultModel: 'gpt-4o',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o (Recomendado · Visión, Audio & Function Calling)', speed: 'Muy Rápido', context: '128k' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Económico · Partes de trabajo y texto)', speed: 'Ultrarrápido', context: '128k' },
      { id: 'gpt-4o-audio-preview', label: 'GPT-4o Audio Preview (Procesamiento de Voz Nativo)', speed: 'Tiempo Real', context: '128k' },
      { id: 'o3-mini', label: 'o3-mini (Razonamiento profundo para mediciones complejas)', speed: 'Medio', context: '200k' }
    ],
    keyPrefix: 'sk-',
    helpUrl: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    logo: '🧠',
    badge: 'Máxima Precisión',
    defaultModel: 'claude-3-7-sonnet',
    models: [
      { id: 'claude-3-7-sonnet', label: 'Claude 3.7 Sonnet (Recomendado · Pensamiento Extendido)', speed: 'Muy Rápido', context: '200k' },
      { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet (Análisis de planos y documentos)', speed: 'Rápido', context: '200k' },
      { id: 'claude-3-5-haiku', label: 'Claude 3.5 Haiku (Respuestas instantáneas en obra)', speed: 'Instantáneo', context: '200k' }
    ],
    keyPrefix: 'sk-ant-',
    helpUrl: 'https://console.anthropic.com/settings/keys'
  },
  {
    id: 'google',
    name: 'Google Gemini',
    logo: '✨',
    badge: 'Gran Ventana Contexto',
    defaultModel: 'gemini-2.5-flash',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recomendado · Ultrarrápido & Multimodal)', speed: 'Ultrarrápido', context: '1M tokens' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Cálculo estructural y normativo)', speed: 'Rápido', context: '2M tokens' }
    ],
    keyPrefix: 'AIza',
    helpUrl: 'https://aistudio.google.com/app/apikey'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    logo: '🐳',
    badge: 'Coste Eficiente',
    defaultModel: 'deepseek-chat',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek-V3 (Chat & Extracción de partidas)', speed: 'Muy Rápido', context: '64k' },
      { id: 'deepseek-reasoner', label: 'DeepSeek-R1 (Razonamiento de costes matemáticos)', speed: 'Medio', context: '64k' }
    ],
    keyPrefix: 'sk-',
    helpUrl: 'https://platform.deepseek.com/'
  }
];

export default function MotorIaConfig() {
  const { empresaConfig, updateAiConfig, testAiConnection, showNotification } = useApp();

  const currentAi = empresaConfig?.aiConfig || {
    provider: 'openai',
    apiKey: 'sk-proj-obramaster98765432109876543210',
    modelName: 'gpt-4o',
    isActive: true,
    lastTestedAt: '2026-10-17 18:00',
    status: 'connected',
    latencyMs: 168
  };

  const [provider, setProvider] = useState(currentAi.provider || 'openai');
  const [apiKey, setApiKey] = useState(currentAi.apiKey || '');
  const [modelName, setModelName] = useState(currentAi.modelName || 'gpt-4o');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(
    currentAi.status === 'connected'
      ? {
          success: true,
          latencyMs: currentAi.latencyMs || 168,
          testedAt: currentAi.lastTestedAt || 'Reciente'
        }
      : null
  );

  // Active Demo Task Simulator
  const [activeSimulatorTask, setActiveSimulatorTask] = useState(1);
  const [simulating, setSimulating] = useState(false);
  const [simOutput, setSimOutput] = useState(null);

  const selectedProviderObj = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];

  const handleProviderChange = (newProvider) => {
    setProvider(newProvider);
    const pObj = PROVIDERS.find(p => p.id === newProvider);
    if (pObj) {
      setModelName(pObj.defaultModel);
    }
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    // Call test connection method
    const res = await testAiConnection(provider, apiKey, modelName);
    setTesting(false);

    if (res.success) {
      setTestResult({
        success: true,
        latencyMs: res.latencyMs,
        testedAt: new Date().toLocaleTimeString()
      });
      confetti({ particleCount: 40, spread: 50 });
    } else {
      setTestResult({
        success: false,
        error: res.error
      });
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    updateAiConfig({
      provider,
      apiKey: apiKey.trim(),
      modelName,
      isActive: true,
      status: testResult?.success ? 'connected' : 'configured',
      lastTestedAt: testResult?.testedAt || new Date().toISOString()
    });
  };

  // Run Task Simulation
  const handleRunSimulator = (taskNum) => {
    setSimulating(true);
    setSimOutput(null);

    setTimeout(() => {
      setSimulating(false);
      if (taskNum === 1) {
        setSimOutput({
          tipo: 'Presupuesto Multimodal Generado',
          resumen: 'Audio del cliente: "Queremos demoler el tabique de la cocina para poner una isla y alicatar con azulejo porcelánico 60x120".',
          partidasGeneradas: [
            { codigo: 'DEM-01', concepto: 'Demolición de tabicón de ladrillo con carga de escombro', cant: '14.5 m²', pvp: '16.88 €', total: '244.76 €' },
            { codigo: 'ALI-01', concepto: 'Alicatado porcelánico rectificado gran formato en paredes', cant: '28.0 m²', pvp: '33.80 €', total: '946.40 €' },
            { codigo: 'FON-01', concepto: 'Puntos de agua fría y caliente multicapa para isla', cant: '3.0 ud', pvp: '81.25 €', total: '243.75 €' }
          ],
          totalCalculado: '1.434,91 €',
          cruceBasePrecios: '3/3 partidas cruzadas con la Base Oficial con margen del 32%'
        });
      } else if (taskNum === 2) {
        setSimOutput({
          tipo: 'Parte de Cuadrilla Procesado',
          resumen: 'Audio del obrero Pedro Gómez: "Manuel, hemos terminado de alicatar todo el baño grande y puesto la lechada impermeable. Mañana empezamos con el suelo".',
          extraccionIA: {
            faseAfectada: 'Fase 4: Alicatados y Solados Porcelánicos',
            progresoAnterior: '60%',
            nuevoProgresoCalculado: '100% (Fase completada)',
            materialesReportados: 'Lechada impermeable Ultracolor Plus (2 sacos consumidos)',
            incidencias: 'Ninguna detectada. Obra al día en plazo.'
          }
        });
      } else if (taskNum === 3) {
        setSimOutput({
          tipo: 'Propuesta de Anexo / Partida Adicional',
          resumen: 'WhatsApp Cliente D. Javier: "Por favor ponedme dos enchufes más en la cabecera del dormitorio y una tira led oculta en el cortinero".',
          propuestaRedactada: {
            titulo: 'Anexo Adicional Nº 2 - Proyecto Ático Velázquez',
            partidasAdicionales: [
              { codigo: 'ELE-02', concepto: 'Toma de corriente Schuko 16A adicional en cabecero', cant: 2, pvp: '42.50 €', total: '85.00 €' },
              { codigo: 'ALB-03', concepto: 'Foseado en cortinero con alojamiento para tira LED', cant: '3.2 ml', pvp: '24.30 €', total: '77.76 €' }
            ],
            totalAdicionalConIva: '179.04 €',
            mensajeRespuestaSugerido: 'Propuesta lista para enviar al cliente para su aprobación digital con firma antes de ejecutar.'
          }
        });
      } else {
        setSimOutput({
          tipo: 'Análisis de Subcontratista y Base de Precios',
          resumen: 'PDF subido por ElectroSur Instalaciones SL: Nueva tarifa con incremento del 8% en cableado libre de halógenos y cuadros eléctricos.',
          analisisPrecios: {
            partida: 'ELE-03: Cuadro general con IGA y protectores sobretensión',
            costeAnterior: '380.00 €',
            nuevoCosteSubcontrata: '410.00 € (+7.8%)',
            nuevoPvpRecomendado: '512.50 € (mantiene el margen objetivo del 25%)',
            accionAutomatica: 'Precio actualizado en la Base Oficial de la Empresa para los próximos presupuestos.'
          }
        });
      }
      confetti({ particleCount: 30, spread: 45 });
    }, 800);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Technical Architecture Clarification */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950/40 p-5 rounded-2xl border border-amber-500/30 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black text-white">Motor Central de IA Multimodal</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                  REST API · BYOK
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Conecta tu propia cuenta de OpenAI, Anthropic o Google para dotar a ObraMaster de visión artificial, transcripción de voz y automatización integral de costes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
              currentAi.status === 'connected'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${currentAi.status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{currentAi.status === 'connected' ? 'IA Activa y Enlazada' : 'Pendiente de Configurar'}</span>
            </span>
          </div>
        </div>

        {/* Technical Note on Architecture (API Key vs MCP) */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px] uppercase tracking-wider">
            <Server className="w-3.5 h-3.5" />
            <span>Arquitectura Técnica: REST API Cifrada en Backend 24/7 vs Protocolo MCP</span>
          </div>
          <p className="leading-relaxed text-[11px] text-slate-300">
            El protocolo <strong>MCP</strong> (Model Context Protocol) está diseñado para asistentes de escritorio locales (Cursor, Claude Desktop). Para una aplicación SaaS y móvil como <strong>ObraMaster</strong>, la integración mediante <strong>REST API con API Key cifrada (AES-256)</strong> permite que los obreros envíen notas de voz y fotos desde la obra a cualquier hora y el servidor procese los presupuestos y partes en tiempo real de forma autónoma.
          </p>
        </div>
      </div>

      {/* Formulario de Configuración de la API Key */}
      <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-xl space-y-5">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-sm">Credenciales y Selección de Modelo</h4>
              <p className="text-[11px] text-slate-400">Introduce la API Key de tu proveedor preferido</p>
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
          <label className="text-xs font-bold text-slate-300 block">Proveedor de Inteligencia Artificial:</label>
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
          
          {/* API Key */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>API Key de {selectedProviderObj.name} *</span>
              </label>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Cifrado AES-256</span>
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
            <p className="text-[10px] text-slate-500">
              La clave se almacena cifrada en base de datos protegida y solo se invoca desde endpoints seguros de backend.
            </p>
          </div>

          {/* Modelo Recomendado */}
          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-slate-300 block">Modelo de IA Seleccionado:</label>
            <select
              value={modelName}
              onChange={(e) => {
                setModelName(e.target.value);
                setTestResult(null);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-semibold text-xs focus:outline-none focus:border-amber-400"
            >
              {selectedProviderObj.models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.label} · {m.speed}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500">
              Soporte nativo para Function Calling, Visión de Obras y salida estructurada JSON.
            </p>
          </div>

        </div>

        {/* Diagnóstico / Test Result Box */}
        {testResult && (
          <div className={`p-4 rounded-xl border text-xs animate-in fade-in space-y-2 ${
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
                    ? `¡Conexión Exitosa con ${selectedProviderObj.name}! (HTTP 200 OK)`
                    : `Error al conectar con la API: ${testResult.error}`}
                </span>
              </div>
              {testResult.success && (
                <span className="font-mono text-[11px] bg-emerald-500/20 px-2 py-0.5 rounded font-bold">
                  Latencia: {testResult.latencyMs} ms
                </span>
              )}
            </div>

            {testResult.success && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-emerald-500/20 text-[11px]">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Visión de Obras 👁️</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Audio Whisper 🎙️</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Function Calling 🛠️</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>JSON Estructurado 📋</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={testing || !apiKey}
              onClick={handleTestConnection}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition border border-slate-700 flex items-center gap-2 disabled:opacity-50"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
              <span>{testing ? 'Probando conexión...' : 'Probar Conexión (Ping API)'}</span>
            </button>

            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Comprueba validez y saldo antes de guardar.
            </span>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
            <span>Guardar Conexión del Motor IA</span>
          </button>
        </div>

      </form>

      {/* PANEL INTERACTIVO DE LAS 4 RESPONSABILIDADES DEL MOTOR DE IA */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-xl space-y-4">
        
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Cpu className="w-4 h-4" />
            <span>Flujos de Trabajo Autónomos de ObraMaster</span>
          </div>
          <h4 className="text-lg font-black text-white">Tareas Clave del Motor de IA en la Aplicación</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Una vez conectada la API Key, el backend orquesta estas 4 funciones automáticamente según el origen de los datos:
          </p>
        </div>

        {/* 4 Task Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            { id: 1, label: '1. Ingesta Multimodal Presupuestos', desc: 'Audio visita + fotos -> Partidas Base Oficial', icon: Camera, color: 'text-amber-400' },
            { id: 2, label: '2. Seguimiento y Partes Obrero', desc: 'Voz WhatsApp obrero -> Avance % fases', icon: Mic, color: 'text-blue-400' },
            { id: 3, label: '3. Comunicaciones y Adicionales', desc: 'Email/WhatsApp cliente -> Propuesta anexo', icon: MessageSquare, color: 'text-emerald-400' },
            { id: 4, label: '4. Análisis Subcontratas & Margen', desc: 'Presupuesto electricista -> Actualiza costes', icon: FileSpreadsheet, color: 'text-purple-400' }
          ].map(t => {
            const Icon = t.icon;
            const isSelected = activeSimulatorTask === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveSimulatorTask(t.id);
                  setSimOutput(null);
                }}
                className={`p-3 rounded-xl border text-left transition space-y-1.5 ${
                  isSelected
                    ? 'bg-slate-800/90 border-amber-500/50 shadow'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${t.color}`} />
                  <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{t.label}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">{t.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Interactive Simulator Card */}
        <div className="bg-slate-950 p-4 sm:p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                Simulador de Función en Vivo:
              </span>
              <h5 className="font-extrabold text-white text-sm mt-0.5">
                {activeSimulatorTask === 1 && 'Ingesta de Visita de Obra (Audio + Fotos) → Partidas Oficiales'}
                {activeSimulatorTask === 2 && 'Ingesta de WhatsApp Móvil del Obrero → Avance Fases de Obra'}
                {activeSimulatorTask === 3 && 'Gestión de Cambios de Cliente → Redacción de Anexo Adicional'}
                {activeSimulatorTask === 4 && 'Ingesta de Factura de Subcontrata → Calibración de Margen y Base'}
              </h5>
            </div>

            <button
              type="button"
              disabled={simulating}
              onClick={() => handleRunSimulator(activeSimulatorTask)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow flex items-center gap-2 shrink-0 disabled:opacity-50"
            >
              {simulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{simulating ? 'Procesando con IA...' : 'Ejecutar Demostración IA'}</span>
            </button>
          </div>

          {/* Output of Simulation */}
          {simOutput ? (
            <div className="bg-slate-900 p-4 rounded-xl border border-amber-500/30 text-xs space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-white text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{simOutput.tipo}</span>
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold px-2 py-0.5 rounded">
                  Modelo: {modelName}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 italic">
                "{simOutput.resumen}"
              </div>

              {/* Task 1 details */}
              {simOutput.partidasGeneradas && (
                <div className="space-y-2">
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-800 text-slate-400 font-mono">
                        <tr>
                          <th className="p-2">Partida Oficial</th>
                          <th className="p-2">Medición</th>
                          <th className="p-2 text-right">PVP Cliente</th>
                          <th className="p-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {simOutput.partidasGeneradas.map((p, i) => (
                          <tr key={i} className="hover:bg-slate-800/30">
                            <td className="p-2 font-medium text-white">
                              <span className="font-mono text-amber-400 mr-1">[{p.codigo}]</span>
                              {p.concepto}
                            </td>
                            <td className="p-2 font-mono text-slate-300">{p.cant}</td>
                            <td className="p-2 font-mono text-slate-300 text-right">{p.pvp}</td>
                            <td className="p-2 font-mono font-bold text-amber-300 text-right">{p.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold pt-1">
                    <span className="text-slate-400">{simOutput.cruceBasePrecios}</span>
                    <span className="text-amber-400 font-mono text-sm">Total Partidas: {simOutput.totalCalculado}</span>
                  </div>
                </div>
              )}

              {/* Task 2 details */}
              {simOutput.extraccionIA && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Fase de la Obra:</span>
                    <strong className="text-white">{simOutput.extraccionIA.faseAfectada}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Avance Calculado:</span>
                    <span className="text-emerald-400 font-bold font-mono">{simOutput.extraccionIA.progresoAnterior} → {simOutput.extraccionIA.nuevoProgresoCalculado}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Materiales Consumidos:</span>
                    <span className="text-slate-300">{simOutput.extraccionIA.materialesReportados}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Incidencias:</span>
                    <span className="text-slate-300">{simOutput.extraccionIA.incidencias}</span>
                  </div>
                </div>
              )}

              {/* Task 3 details */}
              {simOutput.propuestaRedactada && (
                <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <h6 className="font-bold text-white text-xs">{simOutput.propuestaRedactada.titulo}</h6>
                  <ul className="space-y-1">
                    {simOutput.propuestaRedactada.partidasAdicionales.map((p, i) => (
                      <li key={i} className="flex justify-between text-slate-300 text-[11px]">
                        <span>• {p.concepto} ({p.cant} ud)</span>
                        <span className="font-mono text-amber-400 font-bold">{p.total}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between pt-2 border-t border-slate-800 font-bold text-xs">
                    <span className="text-slate-400">Total Anexo Adicional:</span>
                    <span className="text-emerald-400 font-mono">{simOutput.propuestaRedactada.totalAdicionalConIva}</span>
                  </div>
                </div>
              )}

              {/* Task 4 details */}
              {simOutput.analisisPrecios && (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                  <p className="font-bold text-white">{simOutput.analisisPrecios.partida}</p>
                  <div className="flex items-center gap-4 text-[11px] font-mono">
                    <span className="text-slate-400">Coste Anterior: <strike>{simOutput.analisisPrecios.costeAnterior}</strike></span>
                    <span className="text-rose-400 font-bold">Nuevo Coste: {simOutput.analisisPrecios.nuevoCosteSubcontrata}</span>
                    <span className="text-emerald-400 font-bold">Nuevo PVP Cliente: {simOutput.analisisPrecios.nuevoPvpRecomendado}</span>
                  </div>
                  <p className="text-[11px] text-emerald-400 font-semibold pt-1">
                    ✓ {simOutput.analisisPrecios.accionAutomatica}
                  </p>
                </div>
              )}

            </div>
          ) : (
            <div className="text-center py-6 text-slate-500 text-xs">
              Pulsa en <strong>"Ejecutar Demostración IA"</strong> para simular cómo responde el motor {selectedProviderObj.name} con datos reales de obra.
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
