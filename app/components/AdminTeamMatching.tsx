/* eslint-disable @next/next/no-img-element */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { Season, Owner, League, MasterTeam, Team, FALLBACK_IMG } from '../types';
import { generateRoundsLogic } from '../utils/scheduler';
import { getSortedLeagues, getSortedTeamsLogic, getTierBadgeColor } from '../utils/helpers';

interface Props {
    targetSeason: Season;
    owners: Owner[];
    leagues: League[];
    masterTeams: MasterTeam[];
    onNavigateToSchedule: (id: number) => void;
    onDeleteSchedule: (id: number) => void;
}

export const AdminTeamMatching = ({ targetSeason, owners, leagues, masterTeams, onNavigateToSchedule, onDeleteSchedule }: Props) => {
    // 1. 상태 관리
    const [selectedOwnerId, setSelectedOwnerId] = useState('');
    const [selectedMasterTeamDocId, setSelectedMasterTeamDocId] = useState('');
    const [randomResult, setRandomResult] = useState<MasterTeam | null>(null);
    const [isRolling, setIsRolling] = useState(false);

    // 필터 옵션
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterLeague, setFilterLeague] = useState('');
    const [filterTier, setFilterTier] = useState('ALL');
    const [searchTeam, setSearchTeam] = useState('');

    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // 🔥 스케줄 존재 여부 확인 (안전장치 트리거)
    const hasSchedule = targetSeason.rounds && targetSeason.rounds.length > 0;

    useEffect(() => { 
        if (randomResult && !isRolling) setRandomResult(null); 
    }, [filterCategory, filterLeague, filterTier, searchTeam]);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // 2. 팀 후보군 계산
    const availableTeams = useMemo(() => {
        const assignedNames = new Set(targetSeason.teams?.map(t => t.name) || []);
        let teams = masterTeams.filter(t => !assignedNames.has(t.name));

        if (filterCategory !== 'ALL') teams = teams.filter(t => filterCategory === 'CLUB' ? t.category !== 'NATIONAL' : t.category === 'NATIONAL');
        if (filterLeague) teams = teams.filter(t => t.region === filterLeague);
        if (filterTier !== 'ALL') teams = teams.filter(t => t.tier?.trim() === filterTier);
        if (searchTeam) teams = teams.filter(t => t.name.toLowerCase().includes(searchTeam.toLowerCase()));

        return getSortedTeamsLogic(teams, '');
    }, [masterTeams, targetSeason, filterCategory, filterLeague, filterTier, searchTeam]);

    // 3. 룰렛 로직
    const handleRandom = () => {
        if (hasSchedule) return alert("🚫 스케줄이 이미 생성되어 팀을 추가할 수 없습니다.\n먼저 스케줄을 삭제해주세요.");
        if (!selectedOwnerId) return alert("오너를 먼저 선택해주세요.");
        if (availableTeams.length === 0) return alert("조건에 맞는 남은 팀이 없습니다.");
        if (isRolling) return;

        setIsRolling(true);
        setRandomResult(null);

        const winnerIndex = Math.floor(Math.random() * availableTeams.length);
        const finalWinner = availableTeams[winnerIndex];

        intervalRef.current = setInterval(() => {
            const tempIndex = Math.floor(Math.random() * availableTeams.length);
            setRandomResult(availableTeams[tempIndex]);
        }, 50);

        setTimeout(() => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setRandomResult(finalWinner);
            setSelectedMasterTeamDocId(finalWinner.docId || String(finalWinner.id));
            setIsRolling(false);
            setTimeout(() => {
                document.getElementById(`team-card-${finalWinner.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }, 2000);
    };

    // 4. 매칭 확정 (안전장치 적용)
    const handleAddTeam = async () => {
        if (hasSchedule) return alert("🚫 스케줄이 생성된 상태에서는 팀을 추가할 수 없습니다.\n[Step 2]에서 스케줄을 먼저 삭제(초기화)해주세요.");
        if (isRolling) return;
        
        if (!selectedOwnerId || !selectedMasterTeamDocId) return alert("오너와 팀을 선택하세요.");
        const owner = owners.find(o => String(o.id) === selectedOwnerId);
        const mTeam = masterTeams.find(t => (t.docId || String(t.id)) === selectedMasterTeamDocId);
        if (!owner || !mTeam) return;

        const newTeam: Team = {
            id: Date.now(), seasonId: targetSeason.id, name: mTeam.name, logo: mTeam.logo, ownerName: owner.nickname,
            region: mTeam.region, tier: mTeam.tier, win: 0, draw: 0, loss: 0, points: 0, gf: 0, ga: 0, gd: 0
        };
        const updatedTeams = [...(targetSeason.teams || []), newTeam];
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { teams: updatedTeams });
        
        setSelectedMasterTeamDocId('');
        setRandomResult(null);
    };

    // 5. 팀 삭제 (안전장치 적용)
    const handleRemoveTeam = async (teamId: number, teamName: string) => {
        if (hasSchedule) return alert("🚫 스케줄이 생성된 상태에서는 팀을 삭제할 수 없습니다.\n[Step 2]에서 스케줄을 먼저 삭제(초기화)해주세요.");
        
        if (!confirm("정말 삭제하시겠습니까?")) return;
        const updatedTeams = targetSeason.teams.filter(t => t.id !== teamId);
        let updatedRounds = targetSeason.rounds ? [...targetSeason.rounds] : [];
        if (updatedRounds.length > 0) {
            updatedRounds = updatedRounds.map(r => ({
                ...r, matches: r.matches.filter(m => m.home !== teamName && m.away !== teamName)
            })).filter(r => r.matches.length > 0);
        }
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { teams: updatedTeams, rounds: updatedRounds });
    };

    const handleGenerateSchedule = async (isRegen = false) => {
        if (targetSeason.teams.length < 2) return alert("최소 2팀 이상 필요.");
        if (isRegen && !confirm("기존 스케줄을 덮어씌우시겠습니까?")) return;
        const rounds = generateRoundsLogic(targetSeason);
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { rounds });
        if (confirm("스케줄 생성 완료. 이동하시겠습니까?")) onNavigateToSchedule(targetSeason.id);
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Step 1 */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-4">
                <h3 className="text-white font-bold text-sm border-b border-slate-800 pb-2">Step 1. 팀 & 오너 매칭</h3>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 font-bold">1. Select Owner</label>
                    <select value={selectedOwnerId} onChange={e => setSelectedOwnerId(e.target.value)} disabled={isRolling} className="bg-slate-950 p-3 rounded border border-slate-700 text-white w-full text-sm">
                        <option value="">👤 Select Owner</option>
                        {owners.map(o => <option key={o.id} value={o.id}>{o.nickname}</option>)}
                    </select>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-slate-500 font-bold">2. Search Options</label>
                        <button 
                            onClick={handleRandom} 
                            disabled={isRolling || hasSchedule} // 스케줄 있으면 룰렛도 막음
                            className={`px-4 py-2 rounded text-xs font-bold text-white shadow-lg border border-purple-500 flex items-center gap-2 transition-all ${isRolling || hasSchedule ? 'bg-purple-900 cursor-not-allowed opacity-50' : 'bg-purple-700 hover:bg-purple-600 active:scale-95'}`}
                        >
                            {isRolling ? <span className="animate-spin">🎲</span> : '🎲'} 
                            {isRolling ? 'Rolling...' : 'Random Pick'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} disabled={isRolling} className="bg-black p-2 rounded border border-slate-700 text-slate-300 text-xs"><option value="ALL">All Categories</option><option value="CLUB">Club</option><option value="NATIONAL">National</option></select>
                        <select value={filterLeague} onChange={e => setFilterLeague(e.target.value)} disabled={isRolling} className="bg-black p-2 rounded border border-slate-700 text-slate-300 text-xs"><option value="">All Leagues</option>{getSortedLeagues(leagues.map(l => l.name)).map(l => <option key={l} value={l}>{l}</option>)}</select>
                        <select value={filterTier} onChange={e => setFilterTier(e.target.value)} disabled={isRolling} className="bg-black p-2 rounded border border-slate-700 text-slate-300 text-xs"><option value="ALL">All Tiers</option><option value="S">S Tier</option><option value="A">A Tier</option><option value="B">B Tier</option><option value="C">C Tier</option></select>
                        <input type="text" value={searchTeam} onChange={e => setSearchTeam(e.target.value)} disabled={isRolling} placeholder="🔍 Name..." className="bg-black p-2 rounded border border-slate-700 text-white text-xs" />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-slate-500 font-bold">3. Select Team</label>
                        {!isRolling && (filterLeague || randomResult) && <button onClick={() => { setFilterLeague(''); setRandomResult(null); }} className="text-[10px] text-slate-400 border border-slate-700 px-2 rounded hover:text-white">↩ Show All Leagues</button>}
                    </div>

                    {randomResult ? (
                        <div className="flex justify-center py-6">
                            <div className={`relative bg-emerald-900/20 p-6 rounded-2xl border-2 border-emerald-500 flex flex-col items-center gap-3 shadow-[0_0_30px_rgba(16,185,129,0.3)] min-w-[200px] transition-all duration-300 ${isRolling ? 'scale-95 opacity-80 blur-[1px]' : 'scale-110 opacity-100'}`}>
                                <div className={`absolute -top-3 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg transition-colors ${isRolling ? 'bg-purple-600 animate-pulse' : 'bg-emerald-600'}`}>{isRolling ? '🎰 Rolling...' : '✨ Random Picked!'}</div>
                                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center p-3 shadow-lg overflow-hidden"><img src={randomResult.logo} className={`w-full h-full object-contain transition-transform ${isRolling ? 'animate-pulse scale-90' : 'scale-100'}`} alt="" onError={(e: any) => e.target.src = FALLBACK_IMG} /></div>
                                <div className="text-center"><p className="text-xl font-black text-white">{randomResult.name}</p><div className="flex items-center justify-center gap-2 mt-1"><span className="text-xs text-slate-400">{randomResult.region}</span><span className={`text-[10px] px-2 py-0.5 rounded font-bold ${getTierBadgeColor(randomResult.tier)}`}>{randomResult.tier}</span></div></div>
                            </div>
                        </div>
                    ) : (
                        !filterLeague && !searchTeam ? (
                            <div className="space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar p-1">
                                {(filterCategory === 'ALL' || filterCategory === 'CLUB') && (
                                    <div>
                                        <p className="text-[10px] text-emerald-500 font-bold mb-2 ml-1 border-b border-emerald-900/30 pb-1">⚽ CLUB LEAGUES</p>
                                        <div className="grid grid-cols-4 md:grid-cols-5 gap-3">{getSortedLeagues(leagues.filter(l => l.category === 'CLUB').map(l => l.name)).map(name => {
                                            const l = leagues.find(l => l.name === name); if (!l) return null; const count = masterTeams.filter(t => t.region === l.name).length;
                                            return (<div key={l.id} onClick={() => setFilterLeague(l.name)} className="bg-slate-900 p-3 rounded-xl border border-slate-800 cursor-pointer hover:border-emerald-500 flex flex-col items-center gap-2 group transition-all hover:bg-slate-800 shadow-lg"><div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-1.5 shadow-sm"><img src={l.logo} className="w-full h-full object-contain" alt="" /></div><div className="text-center w-full"><p className="text-[10px] text-white font-bold group-hover:text-emerald-400 truncate w-full">{l.name}</p><p className="text-[9px] text-slate-500 font-medium">{count} Teams</p></div></div>);
                                        })}</div>
                                    </div>
                                )}
                                {(filterCategory === 'ALL' || filterCategory === 'NATIONAL') && (
                                    <div>
                                        <p className="text-[10px] text-blue-500 font-bold mb-2 ml-1 border-b border-blue-900/30 pb-1">🌍 NATIONAL TEAMS</p>
                                        <div className="grid grid-cols-4 md:grid-cols-5 gap-3">{getSortedLeagues(leagues.filter(l => l.category === 'NATIONAL').map(l => l.name)).map(name => {
                                            const l = leagues.find(l => l.name === name); if (!l) return null; const count = masterTeams.filter(t => t.region === l.name).length;
                                            return (<div key={l.id} onClick={() => setFilterLeague(l.name)} className="bg-slate-900 p-3 rounded-xl border border-slate-800 cursor-pointer hover:border-blue-500 flex flex-col items-center gap-2 group transition-all hover:bg-slate-800 shadow-lg"><div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-1.5 shadow-sm"><img src={l.logo} className="w-full h-full object-contain" alt="" /></div><div className="text-center w-full"><p className="text-[10px] text-white font-bold group-hover:text-blue-400 truncate w-full">{l.name}</p><p className="text-[9px] text-slate-500 font-medium">{count} Teams</p></div></div>);
                                        })}</div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar p-1">
                                {availableTeams.map(t => {
                                    const isSelected = selectedMasterTeamDocId === (t.docId || String(t.id));
                                    return (<div id={`team-card-${t.id}`} key={t.id} onClick={() => setSelectedMasterTeamDocId(t.docId || String(t.id))} className={`relative bg-slate-900 p-3 rounded-xl border flex flex-col items-center cursor-pointer group transition-all ${isSelected ? 'border-emerald-500 ring-2 ring-emerald-500 bg-emerald-900/10' : 'border-slate-800 hover:border-slate-600'}`}><div className="w-12 h-12 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-sm p-1.5 mb-2"><img src={t.logo} className="w-full h-full object-contain" alt="" onError={(e: any) => e.target.src = FALLBACK_IMG} /></div><span className="text-[10px] text-center text-slate-300 w-full truncate font-bold group-hover:text-white">{t.name}</span><span className={`text-[8px] px-1.5 py-0.5 rounded mt-1 font-bold ${getTierBadgeColor(t.tier)}`}>{t.tier}</span></div>);
                                })}
                                {availableTeams.length === 0 && <p className="col-span-full text-center text-slate-500 text-xs py-4">No available teams found.</p>}
                            </div>
                        )
                    )}
                </div>
                {/* 🔥 추가 버튼 안전장치 적용: 스케줄 있으면 Locked */}
                <button 
                    onClick={handleAddTeam} 
                    disabled={isRolling || hasSchedule} 
                    className={`w-full py-3 font-bold rounded shadow-lg text-sm transition-all ${isRolling || hasSchedule ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                >
                    {hasSchedule ? '🔒 Schedule Locked (Cannot Add Teams)' : (isRolling ? 'Wait for Result...' : '✅ Confirm Match')}
                </button>
            </div>

            {/* Step 2 */}
            <div className="bg-black p-4 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                    <h3 className="text-white font-bold text-sm">Step 2. 참가 팀 관리 ({targetSeason.teams?.length || 0})</h3>
                    <div className="flex gap-2">{hasSchedule ? (<><button onClick={() => handleGenerateSchedule(true)} className="bg-blue-600 px-2 py-1.5 rounded-[4px] text-[10px] font-bold hover:bg-blue-500">🔄 재생성</button><button onClick={() => onDeleteSchedule(targetSeason.id)} className="bg-red-900 px-2 py-1.5 rounded-[4px] text-[10px] font-bold hover:bg-red-700">🗑️ 삭제</button></>) : (<button onClick={() => handleGenerateSchedule(false)} className="bg-purple-600 px-3 py-2 rounded text-xs font-bold hover:bg-purple-500 shadow-lg shadow-purple-900/50">⚡ 스케줄 생성</button>)}</div>
                </div>
                <div className="grid grid-cols-4 md:grid-cols-5 gap-3">
                    {targetSeason.teams?.map(t => (
                        <div key={t.id} className="flex flex-col items-center bg-slate-900 p-2 rounded-lg border border-slate-800 relative group">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 p-1.5 mb-1"><img src={t.logo} className="w-full h-full object-contain" alt="" /></div>
                            <div className="w-full text-center"><p className="text-[10px] font-bold text-white truncate w-full">{t.name}</p><div className="flex items-center justify-center gap-1 mt-1 flex-wrap"><span className="text-[9px] text-emerald-400 font-bold">{t.ownerName}</span><span className="text-[8px] text-slate-500">|</span><span className="text-[8px] text-slate-400 truncate max-w-[40px]">{t.region}</span><span className={`text-[7px] px-1.5 rounded ${getTierBadgeColor(t.tier)}`}>{t.tier}</span></div></div>
                            {/* 🔥 삭제 버튼 안전장치 적용: 스케줄 있으면 🔒 */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleRemoveTeam(t.id, t.name); }} 
                                className={`absolute top-1 right-1 font-bold p-1 ${hasSchedule ? 'text-slate-700 cursor-not-allowed' : 'text-slate-600 hover:text-red-500'}`}
                            >
                                {hasSchedule ? '🔒' : '✕'}
                            </button>
                        </div>
                    ))}
                    {(!targetSeason.teams || targetSeason.teams.length === 0) && <p className="text-slate-600 text-xs col-span-4 text-center py-4">No teams assigned yet.</p>}
                </div>
            </div>
        </div>
    );
};