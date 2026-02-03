/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { FALLBACK_IMG } from '../types'; 
import { getYouTubeThumbnail } from '../utils/helpers'; 

interface RankingViewProps {
  seasons: any[];
  viewSeasonId: number;
  setViewSeasonId: (id: number) => void;
  activeRankingData: any;
}

export const RankingView = ({ seasons, viewSeasonId, setViewSeasonId, activeRankingData }: RankingViewProps) => {
  const [rankingTab, setRankingTab] = useState<'STANDINGS' | 'OWNERS' | 'PLAYERS' | 'HIGHLIGHTS'>('STANDINGS');
  const [rankPlayerMode, setRankPlayerMode] = useState<'GOAL' | 'ASSIST'>('GOAL');

  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col gap-4">
            <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700">
                {seasons.map(s => <option key={s.id} value={s.id}>🏆 {s.name}</option>)}
            </select>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {['STANDINGS', 'OWNERS', 'PLAYERS', 'HIGHLIGHTS'].map(sub => (
                    <button key={sub} onClick={() => setRankingTab(sub as any)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${rankingTab === sub ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{sub}</button>
                ))}
            </div>
        </div>

        {rankingTab === 'STANDINGS' && (
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                <table className="w-full text-left text-xs uppercase border-collapse">
                    <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                        <tr><th className="p-4 w-8">#</th><th className="p-4">Club</th><th className="p-4 text-center">W</th><th className="p-4 text-center">D</th><th className="p-4 text-center">L</th><th className="p-4 text-center">GD</th><th className="p-4 text-center text-emerald-400">Pts</th></tr>
                    </thead>
                    <tbody>
                        {activeRankingData.teams.map((t: any, i: number) => (
                            <tr key={t.id} className={`border-b border-slate-800/50 ${i<3 ? 'bg-emerald-900/10' : ''}`}>
                                <td className={`p-4 text-center font-bold ${i===0?'text-yellow-400':i===1?'text-slate-300':i===2?'text-orange-400':'text-slate-600'}`}>{i+1}</td>
                                <td className="p-4 flex items-center gap-3">
                                    <img src={t.logo} className="w-8 h-8 rounded-full bg-white object-contain p-0.5" alt="" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
                                    <div className="flex flex-col"><span className="font-bold">{t.name}</span><span className="text-[9px] text-slate-500">{t.ownerName}</span></div>
                                </td>
                                <td className="p-4 text-center text-slate-400">{t.win}</td><td className="p-4 text-center text-slate-400">{t.draw}</td><td className="p-4 text-center text-slate-400">{t.loss}</td><td className="p-4 text-center text-slate-500">{t.gd>0?`+${t.gd}`:t.gd}</td>
                                <td className="p-4 text-center text-emerald-400 font-bold text-sm">{t.points}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
        
        {rankingTab === 'OWNERS' && (
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                <table className="w-full text-left text-xs uppercase border-collapse">
                    <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                        <tr><th className="p-4 w-8">#</th><th className="p-4">Owner</th><th className="p-4 text-center">W/D/L</th><th className="p-4 text-center">Pts</th><th className="p-4 text-right">Prize</th></tr>
                    </thead>
                    <tbody>
                        {activeRankingData.owners.map((o: any, i: number) => (
                            <tr key={i} className="border-b border-slate-800/50">
                                <td className={`p-4 text-center font-bold ${i===0?'text-yellow-400':i===1?'text-slate-300':i===2?'text-orange-400':'text-slate-600'}`}>{i+1}</td>
                                <td className="p-4 font-bold text-white">{o.name}</td>
                                <td className="p-4 text-center text-slate-400">{o.win}W {o.draw}D {o.loss}L</td>
                                <td className="p-4 text-center text-emerald-400 font-bold">{o.points}</td>
                                <td className="p-4 text-right text-yellow-500 font-bold">₩ {o.prize.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {rankingTab === 'PLAYERS' && (
             <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                <div className="flex bg-slate-950 border-b border-slate-800">
                    <button onClick={()=>setRankPlayerMode('GOAL')} className={`flex-1 py-3 text-xs font-bold ${rankPlayerMode==='GOAL'?'text-yellow-400 bg-slate-900':'text-slate-500'}`}>⚽ TOP SCORERS</button>
                    <button onClick={()=>setRankPlayerMode('ASSIST')} className={`flex-1 py-3 text-xs font-bold ${rankPlayerMode==='ASSIST'?'text-blue-400 bg-slate-900':'text-slate-500'}`}>🅰️ TOP ASSISTS</button>
                </div>
                <table className="w-full text-left text-xs uppercase">
                    <thead className="bg-slate-900 text-slate-500"><tr><th className="p-3 w-8">#</th><th className="p-3">Player</th><th className="p-3">Team</th><th className="p-3 text-right">{rankPlayerMode}</th></tr></thead>
                    <tbody>
                        {activeRankingData.players
                            .filter((p:any) => rankPlayerMode === 'GOAL' ? p.goals > 0 : p.assists > 0)
                            .sort((a:any,b:any) => rankPlayerMode === 'GOAL' ? b.goals - a.goals : b.assists - a.assists)
                            .slice(0, 20).map((p:any,i:number)=>(
                            <tr key={i} className="border-b border-slate-800/50">
                                <td className={`p-3 text-center ${i<3?'text-emerald-400 font-bold':'text-slate-600'}`}>{i+1}</td>
                                <td className="p-3 font-bold text-white">{p.name} <span className="text-[9px] text-slate-500 font-normal ml-1">({p.owner})</span></td>
                                <td className="p-3 text-slate-400 flex items-center gap-2"><img src={p.teamLogo} className="w-5 h-5 object-contain rounded-full bg-white p-0.5" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /><span>{p.team}</span></td>
                                <td className={`p-3 text-right font-bold ${rankPlayerMode==='GOAL'?'text-yellow-400':'text-blue-400'}`}>{rankPlayerMode==='GOAL'?p.goals:p.assists}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {rankingTab === 'HIGHLIGHTS' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {activeRankingData.highlights.map((m:any, idx:number) => {
                    const isDraw = m.homeScore === m.awayScore;
                    return (
                        <div key={idx} className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 group hover:border-emerald-500 transition-all cursor-pointer" onClick={() => window.open(m.youtubeUrl, '_blank')}>
                            <div className="relative aspect-video">
                                <img src={getYouTubeThumbnail(m.youtubeUrl)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                                <div className="absolute inset-0 flex items-center justify-center"><div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-110 transition-transform">▶</div></div>
                            </div>
                            <div className="p-3 flex items-center gap-3">
                                {/* 🔥 [수정] 무승부일 경우 엠블럼 교차, 승자일 경우 승자만 */}
                                {isDraw ? (
                                    <div className="relative w-8 h-8 flex-shrink-0">
                                        <img src={m.homeLogo} className="w-6 h-6 absolute top-0 left-0 rounded-full bg-white object-contain p-0.5 z-10 shadow-sm border border-slate-300" alt="" />
                                        <img src={m.awayLogo} className="w-6 h-6 absolute bottom-0 right-0 rounded-full bg-white object-contain p-0.5 opacity-80" alt="" />
                                    </div>
                                ) : (
                                    <img src={m.winnerLogo} className="w-8 h-8 rounded-full bg-white object-contain p-0.5" alt="" />
                                )}
                                
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">{m.stage} • {m.matchLabel}</p>
                                    <p className="text-xs font-bold text-white truncate">{m.home} <span className="text-emerald-400">{m.homeScore}:{m.awayScore}</span> {m.away}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {activeRankingData.highlights.length === 0 && <div className="col-span-3 text-center py-10 text-slate-500">등록된 하이라이트가 없습니다.</div>}
            </div>
        )}
    </div>
  );
};