import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

export default function EmergencyControl({ sosActive, setSosActive }) {
  return (
    <div className={`glass-panel p-5 rounded-2xl transition-all duration-500 ${
      sosActive 
        ? 'border-red-500/80 shadow-red-950/20 bg-red-950/20' 
        : 'border-slate-800'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${
            sosActive ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-slate-800 text-slate-400'
          }`}>
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-semibold text-base text-slate-100 tracking-wide">
              EMERGENCY SYSTEM
            </h2>
            <p className="text-xs text-slate-400">Override stadium routing grid</p>
          </div>
        </div>
        {sosActive && (
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        )}
      </div>

      <button
        onClick={() => setSosActive(!sosActive)}
        className={`w-full py-4 px-6 rounded-xl font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 transform active:scale-95 ${
          sosActive
            ? 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white shadow-lg shadow-red-500/30'
            : 'bg-gradient-to-r from-slate-900 via-red-950/40 to-slate-900 hover:via-red-900/60 text-red-400 border border-red-950 hover:border-red-800'
        }`}
      >
        <AlertTriangle className={`w-5 h-5 ${sosActive ? 'animate-bounce' : ''}`} />
        {sosActive ? 'DEACTIVATE SOS EVACUATION' : 'ACTIVATE SOS EMERGENCY'}
      </button>

      <div className="mt-4 p-3 rounded-lg bg-slate-900/80 border border-slate-800/80 text-xs text-slate-400">
        {sosActive ? (
          <div className="text-red-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
            <span>SOS Mode: Broadcast routing, gate signals locked to EVACUATION pathing. Exit routes illuminated.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>System Armed: Standard pedestrian monitoring and telemetry analytics active.</span>
          </div>
        )}
      </div>
    </div>
  );
}
