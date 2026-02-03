import React from 'react';

type ViewType = 'RANKING' | 'SCHEDULE' | 'HISTORY' | 'ADMIN' | 'TUTORIAL';

interface NavTabsProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
}

// 🔥 export const 확인!
export const NavTabs = ({ currentView, setCurrentView }: NavTabsProps) => {
  const tabs: ViewType[] = ['RANKING', 'SCHEDULE', 'HISTORY', 'TUTORIAL', 'ADMIN'];

  return (
    <div className="max-w-6xl mx-auto px-4 mt-6 mb-8">
      <div className="grid grid-cols-5 gap-2">
        {tabs.map(t => (
          <button 
            key={t} 
            onClick={() => setCurrentView(t)} 
            className={`h-14 md:h-16 rounded-xl border border-slate-800 flex flex-col items-center justify-center transition-all active:scale-95 shadow-lg ${currentView === t ? 'bg-gradient-to-br from-emerald-900 to-slate-900 border-emerald-500 text-emerald-400' : 'bg-slate-950 text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}
          >
            <span className="text-[10px] md:text-xs font-black tracking-widest">{t}</span>
          </button>
        ))}
      </div>
    </div>
  );
};