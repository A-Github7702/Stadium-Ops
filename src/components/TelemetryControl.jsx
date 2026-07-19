import React, { useState } from 'react';
import { Activity, Database, CheckCircle2, AlertCircle, Flame } from 'lucide-react';

export default function TelemetryControl({ telemetry, setTelemetry, activeGate, setActiveGate }) {
  const [showJson, setShowJson] = useState(false);

  const updateCongestion = (gateKey, value) => {
    const numericValue = parseInt(value, 10);
    let status = 'clear';
    if (numericValue > 75) {
      status = 'heavy';
    } else if (numericValue > 35) {
      status = 'moderate';
    }

    setTelemetry((prev) => ({
      ...prev,
      gates: {
        ...prev.gates,
        [gateKey]: {
          ...prev.gates[gateKey],
          congestion: numericValue,
          status,
        },
      },
    }));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'clear':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'moderate':
        return <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />;
      case 'heavy':
        return <Flame className="w-4 h-4 text-rose-500 animate-bounce" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'clear': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'moderate': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'heavy': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="glass-panel p-5 rounded-2xl flex flex-col h-full border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-950 text-cyan-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-semibold text-base text-slate-100 tracking-wide">
              LIVE GATE TELEMETRY
            </h2>
            <p className="text-xs text-slate-400">Manage gate flow parameters</p>
          </div>
        </div>
        <button
          onClick={() => setShowJson(!showJson)}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-xs flex items-center gap-1.5 cursor-pointer text-slate-300 transition-colors"
        >
          <Database className="w-3.5 h-3.5" />
          {showJson ? 'Dashboard' : 'JSON State'}
        </button>
      </div>

      {showJson ? (
        <div className="flex-1 overflow-auto max-h-[380px] p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[10px] text-cyan-400/90 leading-tight">
          <pre>{JSON.stringify(telemetry, null, 2)}</pre>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[380px] space-y-3 pr-1">
          {Object.entries(telemetry.gates).map(([key, gate]) => {
            const isSelected = activeGate === key;
            return (
              <div
                key={key}
                onClick={() => setActiveGate(isSelected ? null : key)}
                className={`p-3 rounded-xl border transition-all duration-300 cursor-pointer ${
                  isSelected 
                    ? 'bg-slate-800/50 border-cyan-500/60 shadow-lg shadow-cyan-950/20' 
                    : 'bg-slate-900/30 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      gate.status === 'clear' ? 'bg-emerald-500' :
                      gate.status === 'moderate' ? 'bg-amber-500' : 'bg-rose-500'
                    }`} />
                    <span className="font-medium text-sm text-slate-200">{gate.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getStatusIcon(gate.status)}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold tracking-wider ${getStatusColor(gate.status)}`}>
                      {gate.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-2">
                  <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={gate.congestion}
                      onChange={(e) => updateCongestion(key, e.target.value)}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                  <span className="text-xs font-mono text-cyan-400 w-8 text-right font-bold">
                    {gate.congestion}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
