/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
import { League, MasterTeam, FALLBACK_IMG } from '../types'; 
import { getSortedLeagues, getTierBadgeColor } from '../utils/helpers'; 

// 1. 리그 관리자
export const AdminLeagueManager = ({ leagues }: { leagues: League[], masterTeams: MasterTeam[] }) => {
    const [newLeagueName, setNewLeagueName] = useState('');
    const [newLeagueLogo, setNewLeagueLogo] = useState('');
    const [newLeagueCat, setNewLeagueCat] = useState<'CLUB'|'NATIONAL'>('CLUB');

    const handleAddLeague = async () => {
        if (!newLeagueName) return alert("리그 이름 입력");
        await addDoc(collection(db, "leagues"), { id: Date.now(), name: newLeagueName, logo: newLeagueLogo, category: newLeagueCat });
        setNewLeagueName(''); setNewLeagueLogo('');
    };
    
    const handleDeleteLeague = async (id: string) => { if(confirm("삭제?")) await deleteDoc(doc(db,"leagues",id)); };

    return (
        <div className="grid md:grid-cols-2 gap-6 animate-in fade-in">
            <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800 h-fit">
                <h3 className="text-emerald-400 font-bold text-sm mb-2">➕ New League</h3>
                <input value={newLeagueName} onChange={e=>setNewLeagueName(e.target.value)} placeholder="League Name (e.g. Premier League)" className="w-full bg-slate-900 p-3 rounded text-sm border border-slate-700"/>
                <input value={newLeagueLogo} onChange={e=>setNewLeagueLogo(e.target.value)} placeholder="Logo URL" className="w-full bg-slate-900 p-3 rounded text-sm border border-slate-700"/>
                <select value={newLeagueCat} onChange={e=>setNewLeagueCat(e.target.value as any)} className="w-full bg-slate-900 p-3 rounded text-sm border border-slate-700">
                    <option value="CLUB">Club Team</option>
                    <option value="NATIONAL">National Team</option>
                </select>
                <button onClick={handleAddLeague} className="w-full bg-emerald-600 py-3 rounded font-bold hover:bg-emerald-500 transition-colors">Add League</button>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {leagues.map(l => (
                    <div key={l.id} className="bg-slate-900 p-3 rounded-xl flex items-center justify-between border border-slate-800 group hover:border-emerald-500 transition-colors">
                        <div className="flex items-center gap-3">
                            <img src={l.logo || FALLBACK_IMG} className="w-10 h-10 object-contain bg-white rounded-full p-1" alt=""/>
                            <div>
                                <p className="font-bold text-sm text-white">{l.name}</p>
                                <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded">{l.category}</span>
                            </div>
                        </div>
                        <button onClick={()=>l.docId && handleDeleteLeague(l.docId)} className="text-slate-600 hover:text-red-500 transition-colors p-2">✕</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// 2. 팀 관리자
export const AdminTeamManager = ({ leagues, masterTeams }: { leagues: League[], masterTeams: MasterTeam[] }) => {
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamLogo, setNewTeamLogo] = useState('');
    const [newTeamRegion, setNewTeamRegion] = useState('');
    const [newTeamTier, setNewTeamTier] = useState('C');

    const handleAddTeam = async () => {
        if(!newTeamName || !newTeamRegion) return alert("정보 입력 필요");
        const league = leagues.find(l=>l.name===newTeamRegion);
        await addDoc(collection(db,"master_teams"), { 
            id:Date.now(), name:newTeamName, logo:newTeamLogo, 
            region:newTeamRegion, tier:newTeamTier, 
            category: league?.category || 'CLUB' 
        });
        setNewTeamName(''); setNewTeamLogo('');
    };
    
    const handleDeleteTeam = async (id: string) => { if(confirm("정말 삭제하시겠습니까?")) await deleteDoc(doc(db,"master_teams",id)); };

    // 🔥 [수정] Set 대신 filter를 사용하여 호환성 문제 해결
    const allRegions = masterTeams.map(t => t.region);
    const uniqueRegions = allRegions.filter((val, idx) => allRegions.indexOf(val) === idx);
    const groupedTeams = getSortedLeagues(uniqueRegions);

    return (
        <div className="grid md:grid-cols-12 gap-6 animate-in fade-in">
            <div className="md:col-span-4 space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800 h-fit sticky top-4">
                <h3 className="text-emerald-400 font-bold text-sm mb-2">➕ Add Master Team</h3>
                <input value={newTeamName} onChange={e=>setNewTeamName(e.target.value)} placeholder="Team Name" className="w-full bg-slate-900 p-3 rounded text-sm border border-slate-700"/>
                <input value={newTeamLogo} onChange={e=>setNewTeamLogo(e.target.value)} placeholder="Logo URL" className="w-full bg-slate-900 p-3 rounded text-sm border border-slate-700"/>
                
                <div className="grid grid-cols-2 gap-2">
                    <select value={newTeamRegion} onChange={e=>setNewTeamRegion(e.target.value)} className="bg-slate-900 p-3 rounded text-sm border border-slate-700">
                        <option value="">League...</option>
                        {getSortedLeagues(leagues.map(l=>l.name)).map(l=><option key={l} value={l}>{l}</option>)}
                    </select>
                    <select value={newTeamTier} onChange={e=>setNewTeamTier(e.target.value)} className="bg-slate-900 p-3 rounded text-sm border border-slate-700">
                        <option value="S">S Tier</option>
                        <option value="A">A Tier</option>
                        <option value="B">B Tier</option>
                        <option value="C">C Tier</option>
                    </select>
                </div>
                <button onClick={handleAddTeam} className="w-full bg-emerald-600 py-3 rounded font-bold hover:bg-emerald-500 transition-colors">Add Team</button>
            </div>

            <div className="md:col-span-8 space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                {groupedTeams.map(leagueName => {
                    const teamsInLeague = masterTeams.filter(t => t.region === leagueName);
                    if(teamsInLeague.length === 0) return null;

                    return (
                        <div key={leagueName} className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                            <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 font-bold text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                                {leagueName} <span className="text-emerald-600 ml-1">({teamsInLeague.length})</span>
                            </div>
                            <div className="p-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                {teamsInLeague.map(t => (
                                    <div key={t.id} className="relative bg-black p-2 rounded-lg border border-slate-800 flex flex-col items-center group hover:border-emerald-500/50 transition-all">
                                        <img src={t.logo} className="w-10 h-10 object-contain mb-2" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG}/>
                                        <span className="text-[10px] text-center text-slate-300 w-full truncate font-bold">{t.name}</span>
                                        <div className={`absolute top-1 right-1 px-1 rounded text-[8px] font-bold ${getTierBadgeColor(t.tier)}`}>{t.tier}</div>
                                        <button onClick={()=>t.docId && handleDeleteTeam(t.docId)} className="absolute top-1 left-1 text-slate-700 hover:text-red-500">✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};