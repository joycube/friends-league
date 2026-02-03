/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { FALLBACK_IMG } from '../types';

interface HistoryViewProps {
  historyData: any; 
}

// 🔥 export const 확인!
export const HistoryView = ({ historyData }: HistoryViewProps) => {
  const [historyTab, setHistoryTab] = useState<'TEAMS' | 'OWNERS' | 'PLAYERS'>('OWNERS');
  const [histPlayerMode, setHistPlayerMode] = useState<'GOAL' | 'ASSIST'>('GOAL');

  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-blue-900/20" />
            <h2 className="text-2xl font-black italic text-white mb-1 relative z-10">👑 HALL OF FAME 👑</h2>
            <p className="text-xs text-slate-400 relative z-10">역대 모든 시즌의 통합 기록입니다.</p>
        </div>

        <div className="bg-slate-900/80 p-2 rounded-2xl border border-slate-800 flex justify-center gap-1">
            {['TEAMS', 'OWNERS', 'PLAYERS'].map(t => (
                <button key={t} onClick={() => setHistoryTab(t as any)} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${historyTab === t ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-950 text-slate-500'}`}>{t}</button>
            ))}
        </div>

        {/* 1. Teams History */}
        {historyTab === 'TEAMS' && (
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs uppercase">
                    <thead className="bg-slate-900 text-slate-500"><tr><th className="p-4 w-8">#</th><th className="p-4">Team</th><th className="p-4 text-center">W/D/L</th><th className="p-4 text-right">Pts</th></tr></thead>
                    <tbody>
                        {historyData.teams.slice(0, 20).map((t:any, i:number) => (
                            <tr key={i} className="border-b border-slate-800/50">
                                <td className="p-4 text-center text-slate-600">{i+1}</td>
                                <td className="p-4 font-bold text-white flex items-center gap-2">
                                    <img src={t.logo} className="w-6 h-6 object-contain bg-white rounded-full p-0.5" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG}/>{t.name} <span className="text-[9px] text-slate-500">({t.owner})</span>
                                </td>
                                <td className="p-4 text-center text-slate-400">{t.win}W {t.draw}D {t.loss}L</td>
                                <td className="p-4 text-right text-emerald-400 font-bold">{t.points}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* 2. Owners History */}
        {historyTab === 'OWNERS' && (
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs uppercase">
                    <thead className="bg-slate-900 text-slate-500">
                        <tr><th className="p-4 w-8">#</th><th className="p-4">Owner</th><th className="p-4 text-center">W/D/L</th><th className="p-4 text-center">Awards</th><th className="p-4 text-right">Prize</th></tr>
                    </thead>
                    <tbody>
                        {historyData.owners.map((o:any, i:number) => (
                            <tr key={i} className="border-b border-slate-800/50">
                                <td className={`p-4 text-center font-bold ${i<3?'text-yellow-400':'text-slate-600'}`}>{i+1}</td>
                                <td className="p-4 font-bold text-white">{o.name}</td>
                                <td className="p-4 text-center text-slate-400">{o.win}W {o.draw}D {o.loss}L</td>
                                <td className="p-4 text-center">
                                    {o.golds>0 && <span className="mr-1">🥇{o.golds}</span>}
                                    {o.silvers>0 && <span className="mr-1">🥈{o.silvers}</span>}
                                    {o.bronzes>0 && <span>🥉{o.bronzes}</span>}
                                    {o.golds+o.silvers+o.bronzes===0 && <span className="text-slate-700">-</span>}
                                </td>
                                <td className="p-4 text-right text-slate-300">₩ {o.prize.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* 3. Players History */}
        {historyTab === 'PLAYERS' && (
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                <div className="flex bg-slate-950 border-b border-slate-800">
                    <button onClick={()=>setHistPlayerMode('GOAL')} className={`flex-1 py-3 text-xs font-bold ${histPlayerMode==='GOAL'?'text-yellow-400 bg-slate-900':'text-slate-500'}`}>⚽ TOP SCORERS</button>
                    <button onClick={()=>setHistPlayerMode('ASSIST')} className={`flex-1 py-3 text-xs font-bold ${histPlayerMode==='ASSIST'?'text-blue-400 bg-slate-900':'text-slate-500'}`}>🅰️ TOP ASSISTS</button>
                </div>
                <table className="w-full text-left text-xs uppercase">
                    <thead className="bg-slate-900 text-slate-500"><tr><th className="p-3 w-8">#</th><th className="p-3">Player</th><th className="p-3">Team</th><th className="p-3 text-right">{histPlayerMode}</th></tr></thead>
                    <tbody>
                        {historyData.players
                            .filter((p:any) => histPlayerMode === 'GOAL' ? p.goals > 0 : p.assists > 0)
                            .sort((a:any,b:any) => histPlayerMode === 'GOAL' ? b.goals - a.goals : b.assists - a.assists)
                            .slice(0, 20).map((p:any, i:number) => (
                            <tr key={i} className="border-b border-slate-800/50">
                                <td className="p-3 text-center text-slate-600">{i+1}</td>
                                <td className="p-3 font-bold text-white">{p.name} <span className="text-[9px] text-slate-500 font-normal ml-1">({p.owner})</span></td>
                                <td className="p-3 text-slate-400 flex items-center gap-2">
                                    <img src={p.teamLogo} className="w-5 h-5 object-contain rounded-full bg-white p-0.5" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /><span>{p.team}</span>
                                </td>
                                <td className={`p-3 text-right font-bold ${histPlayerMode==='GOAL'?'text-yellow-400':'text-blue-400'}`}>{histPlayerMode==='GOAL'?p.goals:p.assists}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
  );
};