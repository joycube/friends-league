import React from 'react';

export const Footer = () => {
  return (
    <footer className="bg-slate-950 border-t border-slate-900 mt-12 py-8 px-4 text-center">
      <p className="text-slate-500 text-xs mb-1 font-bold">게임은 eFootball 2025 기반으로 게임을 진행 합니다.</p>
      <p className="text-slate-500 text-xs mb-4">게임 참여 문의 : joycbue@gmail.com</p>
      
      <div className="flex justify-center gap-6 mb-6">
          <a href="https://www.konami.com/games/" target="_blank" rel="noreferrer" className="opacity-50 hover:opacity-100 transition-opacity" title="Konami">
              <img src="https://img.icons8.com/ios-filled/50/ffffff/controller.png" className="w-6 h-6" alt="Konami"/>
          </a>
          <a href="https://www.konami.com/efootball/ko/" target="_blank" rel="noreferrer" className="opacity-50 hover:opacity-100 transition-opacity" title="eFootball Official">
              <img src="https://img.icons8.com/ios-filled/50/ffffff/football.png" className="w-6 h-6" alt="eFootball"/>
          </a>
          <a href="https://www.youtube.com/@eFootball_Live_evolution" target="_blank" rel="noreferrer" className="opacity-50 hover:opacity-100 transition-opacity" title="YouTube Channel">
              <img src="https://img.icons8.com/ios-filled/50/ffffff/youtube-play.png" className="w-6 h-6" alt="YouTube"/>
          </a>
      </div>
      
      <p className="text-[9px] text-slate-700 mt-2 uppercase tracking-widest">© 2026 eFootball Live Evolution League. All Rights Reserved.</p>
      <p className="text-[9px] text-slate-800 mt-1">ver. P_16_02_Final</p>
    </footer>
  );
};