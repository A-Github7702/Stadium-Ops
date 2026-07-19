import React, { useState, useEffect, useRef } from 'react';
import StadiumCanvas from './components/StadiumCanvas';
import AIInputHub from './components/AIInputHub';
import TelemetryControl from './components/TelemetryControl';
import EmergencyControl from './components/EmergencyControl';
import {
  Navigation,
  Compass,
  Wifi,
  Clock,
  Terminal as TerminalIcon,
  AlertTriangle
} from 'lucide-react';

const INITIAL_TELEMETRY = {
  gates: {
    gateA: { name: 'Gate A - North Access', coords: [0, 0.5, -12], congestion: 18, status: 'clear' },
    gateB: { name: 'Gate B - North East Entrance', coords: [8, 0.5, -10], congestion: 25, status: 'clear' },
    gateC: { name: 'Gate C - East Plaza', coords: [12, 0.5, 0], congestion: 48, status: 'moderate' },
    gateD: { name: 'Gate D - South East Entry', coords: [8, 0.5, 10], congestion: 82, status: 'heavy' },
    gateE: { name: 'Gate E - South Plaza', coords: [0, 0.5, 12], congestion: 41, status: 'moderate' },
    gateF: { name: 'Gate F - West Entrance', coords: [-12, 0.5, 0], congestion: 88, status: 'heavy' },
    gateG: { name: 'Gate G - North West Plaza', coords: [-8, 0.5, -10], congestion: 12, status: 'clear' },
  }
};

const TRANSIT_HUBS = {
  metro: { name: 'Stadium Metro Terminal', coords: [20, 0.5, -14] },
  bus: { name: 'Central Bus Loop', coords: [-20, 0.5, 14] },
  parking: { name: 'Main Parking Lot P1', coords: [0, 0.5, 20] },
};

const SAFETY_ZONES = {
  northSafety: { name: 'North Assembly Field', coords: [0, 0.5, -24] },
  eastSafety: { name: 'East Plaza Assembly', coords: [24, 0.5, 0] },
  westSafety: { name: 'West Field Station', coords: [-24, 0.5, 0] },
};

// Calculate distance between gates to recommend the nearest alternative safe gate
const findAlternateSafeGate = (currentGateKey, currentTelemetry) => {
  const currentGate = currentTelemetry.gates[currentGateKey];
  if (!currentGate) return null;

  let nearestGateKey = null;
  let minDistance = Infinity;

  Object.entries(currentTelemetry.gates).forEach(([key, gate]) => {
    if (key === currentGateKey || gate.status === 'heavy') {
      return;
    }

    const dx = currentGate.coords[0] - gate.coords[0];
    const dy = currentGate.coords[1] - gate.coords[1];
    const dz = currentGate.coords[2] - gate.coords[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < minDistance) {
      minDistance = distance;
      nearestGateKey = key;
    }
  });

  if (nearestGateKey) {
    return {
      key: nearestGateKey,
      name: currentTelemetry.gates[nearestGateKey].name.split(' - ')[0],
      congestion: currentTelemetry.gates[nearestGateKey].congestion,
      status: currentTelemetry.gates[nearestGateKey].status,
      distance: Math.round(minDistance * 20) // scale units for realistic meter visualization
    };
  }

  return null;
};

export default function App() {
  const [sosActive, setSosActive] = useState(false);
  const [telemetry, setTelemetry] = useState(INITIAL_TELEMETRY);
  const [activeGate, setActiveGate] = useState(null);
  const [focusTarget, setFocusTarget] = useState(null);
  const [aiLogs, setAiLogs] = useState([
    { time: new Date().toLocaleTimeString(), message: 'System Initialized. Telemetry streams active.' },
    { time: new Date().toLocaleTimeString(), message: '3D Waypoint Grid operational. Connected to Lusail Stadium operations server.' }
  ]);
  const logTerminalEndRef = useRef(null);

  const [geminiAnalysis, setGeminiAnalysis] = useState(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

  const fetchGeminiAnalysis = async (gateKey, currentTelemetry, signal) => {
    const activeGateData = currentTelemetry.gates[gateKey];
    if (!activeGateData) return;

    // Calculate distance to other gates
    const gatesList = Object.entries(currentTelemetry.gates).map(([key, gate]) => {
      const dx = activeGateData.coords[0] - gate.coords[0];
      const dy = activeGateData.coords[1] - gate.coords[1];
      const dz = activeGateData.coords[2] - gate.coords[2];
      const distance = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz) * 20);
      return {
        key,
        name: gate.name,
        congestion: gate.congestion,
        status: gate.status,
        distance
      };
    });

    const prompt = `You are the Lusail Stadium Operations AI. Analyze the crowd occupancy telemetry for the active gate and all other gates.
Active Gate:
- Key: ${gateKey}
- Name: ${activeGateData.name}
- Congestion Level: ${activeGateData.congestion}%
- Status: ${activeGateData.status}

All Available Gates (including active gate and possible alternative gates with distance from the active gate):
${JSON.stringify(gatesList, null, 2)}

Your task is to generate:
1. A clear warning message explaining the congestion state of the active gate.
2. A recommended alternative gate from the list (choose the best available gate that has lower congestion, preferably 'clear' or 'moderate', and is relatively close). If the active gate is not congested, or no better alternative is available, return null.
3. A detailed, professional reroute recommendation explaining why this alternative gate is recommended.

Respond strictly in JSON format matching this schema:
{
  "warningText": "string describing the congestion warning or current state of the active gate",
  "recommendedGateKey": "string representing the recommended gate key (e.g. gateB), or null if no alternative is available or active gate is clear",
  "recommendationText": "string describing the reroute recommendation and reasoning"
}
Do not include any markdown formatting, code blocks (e.g. \`\`\`json), or additional text outside the JSON object.`;

    try {
      const apiKey = import.meta.env.VITE_ANTIGRAVITY_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key is not configured.");
      }
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Empty response from Gemini API.");
      }

      const parsed = JSON.parse(text.trim());
      if (signal.aborted) return;

      setGeminiAnalysis(parsed);
      addLog(`🤖 Gemini: Analysis complete for ${activeGateData.name.split(' - ')[0]}.`);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Failed to fetch Gemini analysis:", err);
      setGeminiAnalysis(null);
    } finally {
      if (!signal.aborted) {
        setIsAnalysisLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!activeGate) {
      setGeminiAnalysis(null);
      setIsAnalysisLoading(false);
      return;
    }

    setGeminiAnalysis(null);
    setIsAnalysisLoading(true);

    const abortController = new AbortController();

    const timer = setTimeout(() => {
      fetchGeminiAnalysis(activeGate, telemetry, abortController.signal);
    }, 500);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [activeGate, telemetry]);

  // Auto-scroll logs terminal
  useEffect(() => {
    logTerminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiLogs]);

  // Log system overrides
  useEffect(() => {
    if (sosActive) {
      addLog('⚠️ CRITICAL: SOS OVERRIDE ACTIVE. BROADCASTING EVACUATION ROUTES TO SAFETY ZONES.');
      setFocusTarget('sos');
    } else {
      addLog('ℹ️ INFO: SOS deactivated. Standard routing tables restored.');
    }
  }, [sosActive]);

  // Log gate inspection
  useEffect(() => {
    if (activeGate) {
      const gate = telemetry.gates[activeGate];
      const nearestTransit = activeGate === 'gateA' || activeGate === 'gateB' || activeGate === 'gateC' ? 'Stadium Metro Terminal' :
        activeGate === 'gateD' || activeGate === 'gateE' ? 'Main Parking Lot P1' : 'Central Bus Loop';
      addLog(`🔍 INSPECT: Operator focused ${gate.name} (${gate.congestion}% congestion). Active path: Gate ➔ ${nearestTransit}`);
    }
  }, [activeGate]);

  const addLog = (message) => {
    setAiLogs((prev) => [
      ...prev,
      { time: new Date().toLocaleTimeString(), message }
    ]);
  };

  // Voice Command Dispatcher
  const handleVoiceCommand = (command) => {
    if (command.type === 'sos') {
      setSosActive(true);
      addLog(command.message);
    } else if (command.type === 'focus') {
      setFocusTarget(command.key);
      if (INITIAL_TELEMETRY.gates[command.key]) {
        setActiveGate(command.key);
      }
      addLog(`🎙️ Voice Command: Focus camera on ${command.label}`);
    } else if (command.type === 'reset') {
      setFocusTarget(null);
      setActiveGate(null);
      addLog('🎙️ Voice Command: Resetting viewport angle.');
    }
  };

  // Vision Command Parser
  const handleVisionCommand = (action) => {
    if (!action) return;

    if (action.type === 'reroute') {
      // Congest Gate G, highlight Gate A
      setTelemetry((prev) => ({
        ...prev,
        gates: {
          ...prev.gates,
          gateG: { ...prev.gates.gateG, congestion: 98, status: 'heavy' },
        }
      }));
      setActiveGate('gateA');
      setFocusTarget('gateG');
      addLog('👁️ Gemini Vision: Heavy congestion verified at Gate G (98%). Rerouted operator pointer to Gate A.');
    } else if (action.type === 'crowd') {
      // Congest Gate D
      setTelemetry((prev) => ({
        ...prev,
        gates: {
          ...prev.gates,
          gateD: { ...prev.gates.gateD, congestion: 95, status: 'heavy' },
        }
      }));
      setActiveGate('gateD');
      setFocusTarget('gateD');
      addLog('👁️ Gemini Vision: Congested corridor at South Exit. Updating telemetry. Highlighting parking loop waypoints.');
    } else if (action.type === 'hazard') {
      // Congest Gate F and trigger SOS
      setTelemetry((prev) => ({
        ...prev,
        gates: {
          ...prev.gates,
          gateF: { ...prev.gates.gateF, congestion: 100, status: 'heavy' },
        }
      }));
      setSosActive(true);
      setFocusTarget('sos');
      addLog('👁️ Gemini Vision CRITICAL: Thermal hazard detected in Sector 4. Warning: Gate F exit blocked. Initiated evacuations.');
    } else {
      addLog('👁️ Gemini Vision: Context analysis complete. Stadium parameters normal.');
    }
  };

  return (
    <div className={`h-screen w-screen flex flex-col transition-all duration-700 select-none ${sosActive ? 'bg-red-950/15' : 'bg-slate-950'
      }`}>
      {/* --- PREMIUM DASHBOARD HEADER --- */}
      <header className={`px-6 py-4 glass-panel border-x-0 border-t-0 flex items-center justify-between z-10 ${sosActive ? 'border-b-red-500/50 bg-red-950/10' : 'border-b-slate-800'
        }`}>
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${sosActive ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/10 text-cyan-400'
            }`}>
            <Compass className={`w-6 h-6 ${sosActive ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold tracking-wider text-slate-100 uppercase">
                Lusail Stadium Operations
              </h1>
              <span className={`text-[10px] px-2 py-0.5 rounded font-extrabold tracking-widest border ${sosActive
                  ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}>
                {sosActive ? 'SOS EVACUATION ACTIVE' : 'LIVE GRID ONLINE'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">
              FIFA WORLD CUP CONTROL SYSTEM • SECTOR D-G PLATFORM
            </p>
          </div>
        </div>

        {/* Global Stats bar */}
        <div className="hidden lg:flex items-center gap-8 text-xs">
          <div className="text-right">
            <p className="text-[9px] text-slate-400 uppercase font-semibold">Total Attendance</p>
            <p className="font-bold text-slate-200 font-mono">82,416 / 88,966</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-slate-400 uppercase font-semibold">Grid Latency</p>
            <p className="font-bold text-cyan-400 font-mono flex items-center gap-1.5 justify-end">
              <Wifi className="w-3.5 h-3.5" /> 8ms
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-slate-400 uppercase font-semibold">Local Time</p>
            <p className="font-bold text-slate-200 font-mono flex items-center gap-1.5 justify-end">
              <Clock className="w-3.5 h-3.5" /> {new Date().toLocaleDateString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </header>

      {/* --- DASHBOARD SHELL LAYOUT --- */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {sosActive && (
          <div className="absolute inset-0 border-[6px] border-red-600/50 pointer-events-none z-20 sos-active-glow" />
        )}

        {/* Column 1: Emergency & AI Input Hub */}
        <aside className="w-full lg:w-96 glass-panel border-y-0 border-l-0 p-5 flex flex-col gap-5 overflow-y-auto z-10 max-h-screen lg:max-h-none">
          <EmergencyControl
            sosActive={sosActive}
            setSosActive={setSosActive}
          />
          <AIInputHub
            onVoiceCommand={handleVoiceCommand}
            onVisionCommand={handleVisionCommand}
            sosActive={sosActive}
          />
        </aside>

        {/* Column 2: WebGL 3D Stadium Canvas */}
        <main className="flex-1 min-w-0 relative bg-slate-950/80">
          <StadiumCanvas
            telemetry={telemetry}
            sosActive={sosActive}
            activeGate={activeGate}
            setActiveGate={setActiveGate}
            focusTarget={focusTarget}
            setFocusTarget={setFocusTarget}
            transitHubs={TRANSIT_HUBS}
            safetyZones={SAFETY_ZONES}
          />

          {/* Floating dynamic route card overlay */}
          {activeGate && !sosActive && (() => {
            const alternateGate = telemetry.gates[activeGate]?.status === 'heavy'
              ? findAlternateSafeGate(activeGate, telemetry)
              : null;

            return (
              <div className="absolute bottom-6 left-6 right-6 lg:right-auto lg:w-80 glass-panel-heavy p-4 rounded-xl shadow-2xl border border-slate-700/50 z-10 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <Navigation className="w-4.5 h-4.5 text-cyan-400" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-cyan-400">Route Waypoint Analysis</h3>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Origin:</span>
                    <span className="font-semibold text-slate-100">{telemetry.gates[activeGate].name.split(' - ')[0]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Destination:</span>
                    <span className="font-semibold text-slate-100">
                      {activeGate === 'gateA' || activeGate === 'gateB' || activeGate === 'gateC' ? 'Metro Terminal' :
                        activeGate === 'gateD' || activeGate === 'gateE' ? 'Parking Lot P1' : 'Bus Loop'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Est. Evac Time:</span>
                    <span className="font-bold text-slate-200 font-mono">
                      {Math.ceil(telemetry.gates[activeGate].congestion * 0.1) + 2} minutes
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Congestion Factor:</span>
                    <span className={`font-bold font-mono uppercase ${telemetry.gates[activeGate].status === 'heavy' ? 'text-red-400' :
                        telemetry.gates[activeGate].status === 'moderate' ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                      {telemetry.gates[activeGate].congestion}% ({telemetry.gates[activeGate].status})
                    </span>
                  </div>
                </div>

                {/* Alternate Safe Gate Recommendation */}
                {isAnalysisLoading ? (
                  <div className="mt-3 pt-3 border-t border-cyan-500/20 bg-cyan-950/25 p-2.5 rounded-lg border border-cyan-900/30 flex items-center justify-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] text-cyan-400 font-semibold tracking-wider uppercase animate-pulse">Analyzing flows with Gemini...</span>
                  </div>
                ) : geminiAnalysis ? (
                  <div className="mt-3 pt-3 border-t border-slate-800 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-bold mb-1.5 text-[10px]">
                      <AlertTriangle className="w-3.5 h-3.5 animate-pulse text-amber-500" />
                      <span>GEMINI CO-PILOT ANALYSIS</span>
                    </div>
                    <p className="text-[10px] text-slate-350 leading-relaxed font-medium">
                      {geminiAnalysis.warningText}
                    </p>
                    {geminiAnalysis.recommendedGateKey && telemetry.gates[geminiAnalysis.recommendedGateKey] ? (() => {
                      const recGate = telemetry.gates[geminiAnalysis.recommendedGateKey];
                      return (
                        <div className="mt-2 pt-2 border-t border-slate-800/80">
                          <p className="text-[10px] text-slate-300 leading-normal font-semibold">
                            Reroute: Proceed to{' '}
                            <span
                              className="text-emerald-400 font-bold underline cursor-pointer hover:text-emerald-300 transition-colors"
                              onClick={() => {
                                setActiveGate(geminiAnalysis.recommendedGateKey);
                                setFocusTarget(geminiAnalysis.recommendedGateKey);
                                addLog(`🔀 REROUTE: Operator accepted Gemini alternative path to ${recGate.name.split(' - ')[0]}`);
                              }}
                            >
                              {recGate.name.split(' - ')[0]}
                            </span>
                          </p>
                          <p className="text-[9.5px] text-slate-400 mt-1 leading-relaxed">
                            {geminiAnalysis.recommendationText}
                          </p>
                        </div>
                      );
                    })() : (
                      <p className="text-[9.5px] text-slate-400 italic mt-1.5 leading-relaxed">
                        {geminiAnalysis.recommendationText || "No reroute path suggested. Follow standard exit pathways."}
                      </p>
                    )}
                  </div>
                ) : alternateGate ? (
                  <div className="mt-3 pt-3 border-t border-red-500/20 bg-red-950/25 p-2.5 rounded-lg border border-red-900/30">
                    <div className="flex items-center gap-1.5 text-red-400 font-bold mb-1 text-[10px]">
                      <AlertTriangle className="w-3.5 h-3.5 animate-bounce" />
                      <span>HEAVY CONGESTION WARNING</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-normal">
                      Flow is critical. Reroute recommendation: Proceed to{' '}
                      <span
                        className="text-emerald-400 font-bold underline cursor-pointer hover:text-emerald-300 transition-colors"
                        onClick={() => {
                          setActiveGate(alternateGate.key);
                          setFocusTarget(alternateGate.key);
                          addLog(`🔀 REROUTE: Operator accepted alternative path from congested gate to ${alternateGate.name}`);
                        }}
                      >
                        {alternateGate.name}
                      </span>{' '}
                      ({alternateGate.distance}m away, currently{' '}
                      <span className="text-emerald-400 font-bold">{alternateGate.status}</span> with{' '}
                      {alternateGate.congestion}% congestion).
                    </p>
                  </div>
                ) : telemetry.gates[activeGate]?.status === 'heavy' ? (
                  <div className="mt-3 pt-3 border-t border-slate-700/50 text-[10px] text-slate-400 italic">
                    All adjacent gates are congested. Evacuate via standard transit loops.
                  </div>
                ) : null}
              </div>
            );
          })()}

          {/* SOS Flashing banner overlay */}
          {sosActive && (
            <div className="absolute top-6 left-6 right-6 flex items-center justify-center pointer-events-none z-10">
              <div className="px-6 py-2 rounded-full bg-red-600/90 text-white font-extrabold text-xs uppercase tracking-widest flex items-center gap-3 shadow-lg shadow-red-600/30 animate-pulse border border-red-500">
                <AlertTriangle className="w-4 h-4 animate-bounce" />
                <span>WARNING: Evacuation Protocol Active. Grid Locked to Safe Assembly Zones.</span>
              </div>
            </div>
          )}
        </main>

        {/* Column 3: Telemetry Panel & AI Event Logs */}
        <aside className="w-full lg:w-96 glass-panel border-y-0 border-r-0 p-5 flex flex-col gap-5 overflow-y-auto z-10 max-h-screen lg:max-h-none">
          <div className="flex-1 min-h-[280px] lg:h-[60%]">
            <TelemetryControl
              telemetry={telemetry}
              setTelemetry={setTelemetry}
              activeGate={activeGate}
              setActiveGate={setActiveGate}
            />
          </div>

          {/* Console logger Terminal */}
          <div className="glass-panel p-4 rounded-2xl flex flex-col h-[220px] border-slate-800">
            <div className="flex items-center gap-2 mb-2 text-slate-300">
              <TerminalIcon className="w-4 h-4 text-cyan-400" />
              <span className="text-[10px] uppercase font-bold tracking-wider">AI Event Logs</span>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-950 p-3 rounded-lg border border-slate-900 font-mono text-[10px] text-slate-400 space-y-2">
              {aiLogs.map((log, idx) => (
                <div key={idx} className="leading-normal">
                  <span className="text-cyan-600 mr-2">[{log.time}]</span>
                  <span className="text-slate-200">{log.message}</span>
                </div>
              ))}
              <div ref={logTerminalEndRef} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
