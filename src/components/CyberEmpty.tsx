import React from 'react';
import { LucideIcon, FolderOpen } from 'lucide-react';

interface CyberEmptyProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionText?: string;
  onAction?: () => void;
  id?: string;
}

export default function CyberEmpty({
  title,
  description,
  icon: Icon = FolderOpen,
  actionText,
  onAction,
  id = "cyber-empty-state"
}: CyberEmptyProps) {
  return (
    <div 
      id={id}
      className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-slate-800/80 bg-cyber-card/30 rounded-2xl relative overflow-hidden group"
    >
      {/* Decorative scanline accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyber-pink/[0.01] to-transparent pointer-events-none animate-scanline"></div>
      
      {/* Cyber ambient glow */}
      <div className="absolute -top-12 -left-12 w-24 h-24 bg-cyber-pink/5 rounded-full blur-2xl group-hover:bg-cyber-pink/10 transition-all duration-500"></div>
      <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-cyan-400/5 rounded-full blur-2xl group-hover:bg-cyan-400/10 transition-all duration-500"></div>

      {/* Futuristic floating icon container */}
      <div className="relative mb-4 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-cyber-pink/5 border border-cyber-pink/10 scale-150 animate-ping opacity-25"></div>
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-cyber-pink shadow-lg group-hover:border-cyber-pink/30 group-hover:text-cyber-pink/90 transition-all duration-300">
          <Icon size={24} className="animate-pulse" />
        </div>
      </div>

      {/* Text Info */}
      <div className="space-y-1.5 max-w-sm z-10">
        <h3 className="text-xs font-extrabold text-white font-mono uppercase tracking-widest">
          {title}
        </h3>
        <p className="text-[11px] text-gray-500 font-mono leading-relaxed uppercase">
          {description}
        </p>
      </div>

      {/* Micro-grid decoration */}
      <div className="mt-4 flex gap-1 font-mono text-[8px] text-slate-700 select-none">
        <span>[0x00_EMPTY_STATE]</span>
        <span>•</span>
        <span>[SYS_OK]</span>
      </div>

      {/* Optional action CTA */}
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 px-4 py-2 bg-cyber-pink/10 hover:bg-cyber-pink text-cyber-pink hover:text-black border border-cyber-pink/30 hover:border-cyber-pink text-[10px] font-extrabold font-mono rounded-lg transition-all duration-200 cursor-pointer shadow-lg active:scale-95"
        >
          {actionText.toUpperCase()}
        </button>
      )}
    </div>
  );
}
