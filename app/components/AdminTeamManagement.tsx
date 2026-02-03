/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { League, MasterTeam, FALLBACK_IMG } from '../types'; 
import { getSortedLeagues, getTierBadgeColor } from '../utils/helpers'; 

// 1. 리그 관리자
export const AdminLeagueManager = ({ leagues, masterTeams }: { leagues: League[], masterTeams: MasterTeam[] }) => {
    const [name, setName] = useState('');
    const [logo, setLogo] = useState('');
    const [cat, setCat] = useState<'CLUB'|'NATIONAL'>('CLUB');
    const [editId, setEditId] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const handleSave = async () => {
        if (!name) return alert("리그 이름을 입력하세요.");
        
        if (editId) {
            // 수정
            await updateDoc(doc(db, "leagues", editId), { name, logo, category: cat });
            setEditId(null);
        } else {
            // 생성
            await addDoc(collection(db, "leagues"), { id: Date.now(), name, logo, category: cat });
        }
        setName(''); setLogo('');
    };

    const handleEdit = (l: League) => {
        setEditId(l.docId!);
        setName(l.name);
        setLogo(l.logo);
        setCat(l.category);
    };

    const handleDelete = async (l: League) => {
        if (!confirm(`'${l.name}' 리그를 삭제하시겠습니까?\n소속된 팀들은 'Unassigned'로 변경됩니다.`)) return;
        
        // 1. 소속 팀 정보 업데이트 (Unassigned 처리)
        const teamsToUpdate = masterTeams.filter(t => t.region === l.name);
        const batch = writeBatch(db);
        teamsToUpdate.forEach(t => {
            if(t.docId) batch.update(doc(db, "master_teams", t.docId), { region: 'Unassigned' });
        });
        await batch.commit();

        // 2. 리그 삭제
        if (l.docId) await deleteDoc(doc(db, "leagues", l.docId));
        
        // 폼 초기화
        if (editId === l.docId) { setEditId(null); setName(''); setLogo(''); }
    };

    const filteredLeagues = leagues.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-6">
            {/* 입력 폼 */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
                <h3 className="text-emerald-400 font-bold text-sm mb-2">{editId ? '✏️ Edit League' : '➕ New League'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input value={name} onChange={e=>setName(e.target.value)} placeholder="League Name" className="bg-slate-900 p-3 rounded text-sm border border-slate-700 text-white"/>
                    <input value={logo} onChange={e=>setLogo(e.target.value)} placeholder="Logo URL" className="bg-slate-900 p-3 rounded text-sm border border-slate-700 text-white"/>
                    <select value={cat} onChange={e=>setCat(e.target.value as any)} className="bg-slate-900 p-3 rounded text-sm border border-slate-700 text-white">
                        <option value="CLUB">Club Team</option>
                        <option value="NATIONAL">National Team</option>
                    </select>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSave} className={`flex-1 py-3 rounded font-bold ${editId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{editId ? 'Update League' : 'Create League'}</button>
                    {editId && <button onClick={()=>{setEditId(null); setName(''); setLogo('');}} className="px-4 bg-slate-800 rounded text-slate-400 hover:text-white">Cancel</button>}
                </div>
            </div>

            {/* 리스트 & 검색 */}
            <div className="space-y-2">
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 리그 이름을 검색해보세요..." className="w-full bg-slate-900 p-3 rounded border border-slate-700 text-sm text-white mb-2"/>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {filteredLeagues.map(l => (
                        <div key={l.id} onClick={() => handleEdit(l)} className={`p-3 rounded-xl flex items-center justify-between border cursor-pointer transition-colors ${editId === l.docId ? 'bg-blue-900/30 border-blue-500' : 'bg-slate-900 border-slate-800 hover:border-emerald-500'}`}>
                            <div className="flex items-center gap-3">
                                <img src={l.logo || FALLBACK_IMG} className="w-8 h-8 object-contain bg-white rounded-full p-0.5" alt=""/>
                                <div>
                                    <p className="font-bold text-sm text-white">{l.name}</p>
                                    <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">{l.category}</span>
                                </div>
                            </div>
                            <button onClick={(e)=>{e.stopPropagation(); handleDelete(l);}} className="text-slate-600 hover:text-red-500 p-2 font-bold">✕</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// 2. 팀 관리자 (구조 대개편)
export const AdminTeamManager = ({ leagues, masterTeams }: { leagues: League[], masterTeams: MasterTeam[] }) => {
    const [selectedLeague, setSelectedLeague] = useState<string | null>(null); // 선택된 리그 (null이면 리그 목록 보여줌)
    
    // 팀 생성/수정 State
    const [tName, setTName] = useState('');
    const [tLogo, setTLogo] = useState('');
    const [tRegion, setTRegion] = useState('');
    const [tTier, setTTier] = useState('C');
    const [editTeamId, setEditTeamId] = useState<string | null>(null);

    // 팀 저장
    const handleSaveTeam = async () => {
        if(!tName || !tRegion) return alert("팀 이름과 리그를 선택하세요.");
        const leagueInfo = leagues.find(l => l.name === tRegion);
        
        if (editTeamId) {
            await updateDoc(doc(db, "master_teams", editTeamId), { name: tName, logo: tLogo, region: tRegion, tier: tTier, category: leagueInfo?.category || 'CLUB' });
            setEditTeamId(null);
        } else {
            await addDoc(collection(db, "master_teams"), { id: Date.now(), name: tName, logo: tLogo, region: tRegion, tier: tTier, category: leagueInfo?.category || 'CLUB' });
        }
        setTName(''); setTLogo(''); 
    };

    // 팀 삭제
    const handleDeleteTeam = async (id: string) => { if(confirm("정말 삭제하시겠습니까?")) await deleteDoc(doc(db,"master_teams",id)); };

    // 일괄 등급 변경
    const handleBulkTier = async (targetTier: string) => {
        if (!selectedLeague) return;
        if (!confirm(`현재 리그(${selectedLeague})의 모든 팀 등급을 '${targetTier}'로 변경하시겠습니까?`)) return;
        
        const targets = masterTeams.filter(t => t.region === selectedLeague);
        const batch = writeBatch(db);
        targets.forEach(t => { if(t.docId) batch.update(doc(db, "master_teams", t.docId), { tier: targetTier }); });
        await batch.commit();
        alert("변경 완료");
    };

    // 리그 선택 시 초기화
    const handleSelectLeague = (leagueName: string) => {
        setSelectedLeague(leagueName);
        setTRegion(leagueName); // 입력 폼 기본값 설정
        setEditTeamId(null); setTName(''); setTLogo(''); setTTier('C');
    };

    // 뒤로 가기
    const handleBack = () => { setSelectedLeague(null); };

    // 1. 리그 목록 뷰 (초기 화면)
    if (!selectedLeague) {
        const clubLeagues = leagues.filter(l => l.category === 'CLUB');
        const nationLeagues = leagues.filter(l => l.category === 'NATIONAL');

        return (
            <div className="space-y-6 animate-in fade-in">
                <div className="space-y-2">
                    <h3 className="text-white font-bold text-sm border-b border-slate-800 pb-2">⚽ Club Leagues</h3>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                        {clubLeagues.map(l => (
                            <div key={l.id} onClick={() => handleSelectLeague(l.name)} className="bg-slate-900 p-3 rounded-xl border border-slate-800 hover:border-emerald-500 cursor-pointer flex flex-col items-center gap-2 group transition-all">
                                <img src={l.logo || FALLBACK_IMG} className="w-12 h-12 object-contain bg-white rounded-full p-1" alt=""/>
                                <span className="text-xs text-center text-slate-300 font-bold group-hover:text-white">{l.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-2">
                    <h3 className="text-white font-bold text-sm border-b border-slate-800 pb-2">🌍 National Teams</h3>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                        {nationLeagues.map(l => (
                            <div key={l.id} onClick={() => handleSelectLeague(l.name)} className="bg-slate-900 p-3 rounded-xl border border-slate-800 hover:border-blue-500 cursor-pointer flex flex-col items-center gap-2 group transition-all">
                                <img src={l.logo || FALLBACK_IMG} className="w-12 h-12 object-contain bg-white rounded-full p-1" alt=""/>
                                <span className="text-xs text-center text-slate-300 font-bold group-hover:text-white">{l.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // 2. 팀 목록 & 관리 뷰 (리그 선택 후)
    const currentLeagueTeams = masterTeams.filter(t => t.region === selectedLeague);
    const currentLeagueInfo = leagues.find(l => l.name === selectedLeague);

    return (
        <div className="space-y-4 animate-in fade-in">
            {/* 헤더 */}
            <div className="flex items-center gap-3 mb-2">
                <button onClick={handleBack} className="bg-slate-800 p-2 rounded text-slate-400 hover:text-white">← Back</button>
                <div className="flex items-center gap-2">
                    <img src={currentLeagueInfo?.logo || FALLBACK_IMG} className="w-8 h-8 object-contain bg-white rounded-full p-0.5" alt=""/>
                    <h2 className="text-xl font-bold text-white">{selectedLeague} <span className="text-emerald-500 text-sm">({currentLeagueTeams.length} Teams)</span></h2>
                </div>
            </div>

            {/* 입력 폼 (고정 해제) */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-emerald-400 font-bold text-sm">{editTeamId ? '✏️ Edit Team' : '➕ Add Team'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input value={tName} onChange={e=>setTName(e.target.value)} placeholder="Team Name" className="bg-slate-900 p-2 rounded border border-slate-700 text-white text-sm"/>
                    <input value={tLogo} onChange={e=>setTLogo(e.target.value)} placeholder="Logo URL" className="bg-slate-900 p-2 rounded border border-slate-700 text-white text-sm"/>
                    <select value={tRegion} onChange={e=>setTRegion(e.target.value)} className="bg-slate-900 p-2 rounded border border-slate-700 text-white text-sm" disabled>
                        <option value={selectedLeague}>{selectedLeague}</option>
                    </select>
                    <select value={tTier} onChange={e=>setTTier(e.target.value)} className="bg-slate-900 p-2 rounded border border-slate-700 text-white text-sm">
                        <option value="S">Tier S</option><option value="A">Tier A</option><option value="B">Tier B</option><option value="C">Tier C</option>
                    </select>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSaveTeam} className={`flex-1 py-2 rounded font-bold text-sm ${editTeamId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{editTeamId ? 'Update' : 'Add'}</button>
                    {editTeamId && <button onClick={()=>{setEditTeamId(null); setTName(''); setTLogo(''); setTTier('C');}} className="px-4 bg-slate-800 rounded text-slate-400 text-sm">Cancel</button>}
                </div>
            </div>

            {/* 일괄 작업 버튼 */}
            <div className="flex gap-2 justify-end">
                <button onClick={()=>handleBulkTier('C')} className="bg-slate-800 px-3 py-1 rounded text-[10px] text-slate-400 hover:bg-slate-700 hover:text-white">All to 'C'</button>
            </div>

            {/* 팀 리스트 Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {currentLeagueTeams.map(t => (
                    <div key={t.id} onClick={()=>{setEditTeamId(t.docId!); setTName(t.name); setTLogo(t.logo); setTRegion(t.region); setTTier(t.tier);}} className={`relative bg-slate-900 p-3 rounded-lg border flex flex-col items-center cursor-pointer group hover:border-emerald-500 transition-all ${editTeamId===t.docId ? 'border-emerald-500 bg-emerald-900/20' : 'border-slate-800'}`}>
                        <img src={t.logo} className="w-10 h-10 object-contain mb-2" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG}/>
                        <span className="text-[10px] text-center text-slate-300 w-full truncate font-bold">{t.name}</span>
                        <div className={`absolute top-1 right-1 px-1 rounded text-[8px] font-bold ${getTierBadgeColor(t.tier)}`}>{t.tier}</div>
                        <button onClick={(e)=>{e.stopPropagation(); t.docId && handleDeleteTeam(t.docId);}} className="absolute top-1 left-1 text-slate-700 hover:text-red-500 px-1">✕</button>
                    </div>
                ))}
                {currentLeagueTeams.length === 0 && <p className="col-span-full text-center text-slate-600 text-xs py-10">No teams in this league.</p>}
            </div>
        </div>
    );
};