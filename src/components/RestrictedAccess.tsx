import React from 'react';
import { ShieldAlert, Lock, AlertOctagon, Terminal } from 'lucide-react';

interface RestrictedAccessProps {
  moduleName: string;
  requiredPermission: string;
  onBackToSafety?: () => void;
  id?: string;
}

export default function RestrictedAccess({
  moduleName,
  requiredPermission,
  onBackToSafety,
  id = "restricted-access-overlay"
}: RestrictedAccessProps) {
  return (
    <div 
      id={id}
      className="min-h-[70vh] flex flex-col items-center justify-center p-6 border-2 border-red-500/20 bg-cyber-card/45 rounded-2xl relative overflow-hidden group max-w-4xl mx-auto backdrop-blur-md"
    >
      {/* Laser alarm horizontal line scan effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-500/[0.04] to-transparent pointer-events-none animate-scanline"></div>
      
      {/* Cyber Red Warning Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(239,68,68,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(239,68,68,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

      {/* Extreme ambient red glow */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-600/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl animate-pulse"></div>

      {/* Outer warning hexagon-like layout */}
      <div className="relative mb-6 flex items-center justify-center">
        {/* Ring animations */}
        <div className="absolute inset-0 rounded-full bg-red-500/5 border border-red-500/20 scale-150 animate-ping opacity-30"></div>
        <div className="absolute inset-0 rounded-full bg-red-500/10 border-2 border-red-500/40 scale-125 animate-pulse opacity-40"></div>
        
        {/* Core Lock Container */}
        <div className="p-6 bg-slate-950 rounded-2xl border-2 border-red-500 text-red-500 shadow-[0_0_25px_rgba(239,68,68,0.25)] relative z-10">
          <Lock size={36} className="animate-pulse" />
          <div className="absolute -top-1 -right-1 bg-red-500 text-black p-0.5 rounded-full">
            <AlertOctagon size={14} />
          </div>
        </div>
      </div>

      {/* Warning Text Details */}
      <div className="space-y-4 max-w-md z-10 text-center">
        <div className="inline-block px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-[9px] font-mono text-red-400 uppercase tracking-widest animate-pulse">
          ⚡ SECURITY_BREACH_RESTRICTION_PROTOCOL_77 ⚡
        </div>
        
        <h2 className="text-xl font-black text-white font-mono uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-red-200 to-red-400">
          Acceso Restringido
        </h2>
        
        <div className="bg-slate-950/90 border border-red-500/30 rounded-xl p-4 font-mono text-left space-y-2 text-xs text-gray-300 shadow-inner">
          <div className="flex items-center gap-2 border-b border-red-500/20 pb-1.5 text-red-400 text-[10px] font-bold">
            <Terminal size={12} />
            <span>[SYS_MONITOR_ALERTA]</span>
          </div>
          <p className="leading-relaxed text-gray-400 text-[11px]">
            Su perfil operativo actual no posee el nivel de autorización requerido para interactuar con este proceso/módulo.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
            <div>
              <span className="text-gray-500 uppercase block">MÓDULO OBJETIVO:</span>
              <span className="text-white font-bold uppercase">{moduleName}</span>
            </div>
            <div>
              <span className="text-gray-500 uppercase block">PERMISO EXIGIDO:</span>
              <span className="text-red-400 font-bold font-mono text-[9px] select-all bg-red-500/10 px-1 py-0.5 rounded border border-red-500/20">
                {requiredPermission}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3 z-10 font-mono text-xs">
        {onBackToSafety && (
          <button
            type="button"
            onClick={onBackToSafety}
            className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-black border border-red-500/30 hover:border-red-500 font-bold rounded-lg transition-all duration-200 cursor-pointer shadow-lg active:scale-95"
          >
            VOLVER AL PANEL SEGURO
          </button>
        )}
      </div>

      {/* Decorative footer status */}
      <div className="mt-8 flex gap-1 font-mono text-[8px] text-slate-600 select-none">
        <span>[ROLE_RESTRICTION]</span>
        <span>•</span>
        <span>[SYS_ACCESS_DENIED_0x0041]</span>
      </div>
    </div>
  );
}
