import React, { useState, useEffect } from 'react';

export const TopBar = () => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        setCurrentTime(`${yy}.${mm}.${dd} ${hh}:${min}:${ss}`);
    };
    updateTime();
    const t = setInterval(updateTime, 1000);
    return () => clearInterval(t);
  }, []);

  const handleShareLink = () => { 
      navigator.clipboard.writeText(window.location.href); 
      alert("🔗 링크가 복사되었습니다!"); 
  };

  return (
    <>
      <div className="absolute top-4 left-4 z-30 bg-black/50 px-3 py-1 rounded-full border border-slate-800 text-[10px] text-slate-300 font-mono tracking-widest">
        {currentTime}
      </div>
      
      <div className="absolute bottom-6 left-6 uppercase z-20 pointer-events-none">
        <h1 className="text-2xl md:text-4xl text-white font-black italic tracking-tighter">eFOOTBALL Live Evolution&trade;</h1>
      </div>

      <button onClick={handleShareLink} className="absolute top-4 right-4 z-30 bg-slate-900/80 p-2 rounded-full border border-slate-700 hover:bg-emerald-900 transition-colors">
        <img src="https://img.icons8.com/ios-filled/50/ffffff/share.png" className="w-5 h-5" alt="share"/>
      </button>
    </>
  );
};