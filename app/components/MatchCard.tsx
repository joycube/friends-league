/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react';
import { Match, FALLBACK_IMG } from '../types';
import { getPrediction } from '../utils/predictor'; 
import { getMatchCommentary } from '../utils/commentary'; 

interface MatchCardProps {
  match: Match;
  onClick: (m: Match) => void;
  activeRankingData?: any; 
  historyData?: any;
}

export const MatchCard = ({ match, onClick, activeRankingData, historyData }: MatchCardProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  const prediction = getPrediction(match.home, match.away, activeRankingData, historyData);

  return (
    <div 
      onClick={() => onClick(match)} 
      className={`relative bg-slate-950 p-3 rounded-xl border ${match.status==='FINISHED'?'border-slate-800':'border-slate-700'} hover:border-emerald-500 cursor-pointer shadow-md group`}
    >
        <div className="flex justify-center items-center mb-2">
            <span className="text-[9px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded uppercase">{match.matchLabel || 'Match'}</span>
        </div>

        <div className="flex justify-between items-center">
            <div className="flex flex-col items-center w-1/3 gap-1">
                <img src={match.homeLogo} className="w-10 h-10 rounded-full bg-white object-contain p-0.5 shadow" alt="" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
                <span className="text-[10px] font-bold text-white leading-tight truncate w-full text-center">{match.home}</span>
                <span className="text-[9px] text-slate-500">{match.homeOwner}</span>
            </div>

            <div className="flex flex-col items-center justify-center">
                {match.status === 'FINISHED' ? (
                    <div className="flex items-center gap-2 text-3xl font-black italic text-white tracking-tighter">
                        <span className={Number(match.homeScore)>Number(match.awayScore)?'text-emerald-400':''}>{match.homeScore}</span>
                        <span className="text-slate-700 text-xl">:</span>
                        <span className={Number(match.awayScore)>Number(match.homeScore)?'text-emerald-400':''}>{match.awayScore}</span>
                    </div>
                ) : (
                    <div className="bg-slate-900 px-3 py-1 rounded text-xs font-bold text-slate-500">VS</div>
                )}
            </div>

            <div className="flex flex-col items-center w-1/3 gap-1">
                <img src={match.awayLogo} className="w-10 h-10 rounded-full bg-white object-contain p-0.5 shadow" alt="" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
                <span className="text-[10px] font-bold text-white leading-tight truncate w-full text-center">{match.away}</span>
                <span className="text-[9px] text-slate-500">{match.awayOwner}</span>
            </div>
        </div>

        {match.status === 'FINISHED' && (
            <div className="border-t border-slate-800 pt-2 mt-2 grid grid-cols-[1fr_auto_1fr] gap-2 text-[9px] items-center">
                <div className="text-right space-y-0.5">
                    {match.homeScorers.map((s, idx)=><div key={`hg-${idx}`} className="text-slate-300">⚽ {s.name} {s.count>1 && `(${s.count})`}</div>)}
                    {match.homeAssists.map((s, idx)=><div key={`ha-${idx}`} className="text-slate-500">🅰️ {s.name} {s.count>1 && `(${s.count})`}</div>)}
                </div>
                <div className="flex justify-center">
                    {match.youtubeUrl ? (
                        <div 
                            className="bg-red-900/20 border border-red-900/50 p-1.5 rounded-full cursor-pointer hover:bg-red-900/40 transition-colors group/yt"
                            onClick={(e) => { e.stopPropagation(); window.open(match.youtubeUrl, '_blank'); }}
                            title="Watch Highlight"
                        >
                            <img src="https://img.icons8.com/ios-filled/50/ff0000/youtube-play.png" className="w-4 h-4 group-hover/yt:scale-110 transition-transform" alt="YT"/>
                        </div>
                    ) : <div className="w-1 h-8 border-l border-slate-800"></div>}
                </div>
                <div className="text-left space-y-0.5">
                    {match.awayScorers.map((s, idx)=><div key={`ag-${idx}`} className="text-slate-300">⚽ {s.name} {s.count>1 && `(${s.count})`}</div>)}
                    {match.awayAssists.map((s, idx)=><div key={`aa-${idx}`} className="text-slate-500">🅰️ {s.name} {s.count>1 && `(${s.count})`}</div>)}
                </div>
            </div>
        )}

        {match.status !== 'FINISHED' && match.home !== 'TBD' && match.home !== 'BYE' && match.away !== 'TBD' && (
            <div className="w-full mt-3 mb-2 px-1">
                <div className="text-center text-[8px] text-slate-500 font-bold mb-1 tracking-widest uppercase">WIN RATE PREDICTION</div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-emerald-400 w-8 text-right">{prediction.hRate}%</span>
                    <div className="relative flex-1 h-4 bg-slate-800 flex items-center justify-center overflow-hidden rounded-md border border-slate-700 shadow-inner">
                        <div style={{ width: isLoaded ? `${prediction.hRate}%` : '0%' }} className="h-full bg-gradient-to-r from-emerald-900 to-emerald-400 transition-all duration-1000 ease-out absolute left-0 top-0 skew-x-[-12deg] origin-bottom-left -ml-2 w-[calc(100%+8px)]" />
                        <div style={{ width: isLoaded ? `${prediction.aRate}%` : '0%' }} className="h-full bg-gradient-to-l from-blue-900 to-blue-400 transition-all duration-1000 ease-out absolute right-0 top-0 skew-x-[-12deg] origin-top-right -mr-2 w-[calc(100%+8px)]" />
                        
                        {/* 🔥 [복구] 번개 아이콘 (Z-index 및 위치 보정) */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center">
                            <div className="w-5 h-5 bg-slate-900 border-2 border-slate-600 rounded-full flex items-center justify-center shadow-lg">
                                <span className="text-[9px] text-yellow-400 font-bold animate-pulse">⚡</span>
                            </div>
                        </div>
                    </div>
                    <span className="text-[10px] font-black text-blue-400 w-8 text-left">{prediction.aRate}%</span>
                </div>
            </div>
        )}

        {match.status === 'FINISHED' && (
            <div className="bg-slate-900/50 p-2 mt-2 rounded text-center border border-slate-800/50">
                <p className="text-[10px] text-emerald-300 italic">
                    &quot; {getMatchCommentary(match)} &quot;
                </p>
            </div>
        )}
    </div>
  );
};