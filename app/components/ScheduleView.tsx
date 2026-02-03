import React from 'react';
import { MatchCard } from './MatchCard'; // MatchCard 연결
import { Season, Match } from '../types';

interface ScheduleViewProps {
  seasons: Season[];
  viewSeasonId: number;
  setViewSeasonId: (id: number) => void;
  onMatchClick: (m: Match) => void;
  activeRankingData: any;
  historyData: any;
}

// 🔥 export const 확인
export const ScheduleView = ({ 
  seasons, viewSeasonId, setViewSeasonId, onMatchClick,
  activeRankingData, historyData 
}: ScheduleViewProps) => {
  const currentSeason = seasons.find(s => s.id === viewSeasonId);

  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
            <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700">
                {seasons.map(s => <option key={s.id} value={s.id}>🗓️ {s.name}</option>)}
            </select>
        </div>
        
        {currentSeason?.rounds?.map((r, rIdx) => (
            <div key={rIdx} className="space-y-2">
                <h3 className="text-xs font-bold text-slate-500 pl-2 border-l-2 border-emerald-500">{r.name}</h3>
                <div className="grid md:grid-cols-1 gap-2">
                    {r.matches.map(m => (
                        <MatchCard 
                            key={m.id} 
                            match={m} 
                            onClick={onMatchClick}
                            activeRankingData={activeRankingData}
                            historyData={historyData}
                        />
                    ))}
                </div>
            </div>
        ))}
        
        {(!currentSeason?.rounds || currentSeason.rounds.length === 0) && (
            <div className="text-center py-10 text-slate-500">등록된 스케줄이 없습니다.</div>
        )}
    </div>
  );
};