/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
// 👇 [수정] 필요한 타입과 함수들을 올바른 곳에서 가져옵니다.
import { League, MasterTeam, FALLBACK_IMG } from '../types'; 
import { getSortedLeagues, getSortedTeamsLogic, getTierBadgeColor } from '../utils/helpers'; 

// 1. 리그 관리자
export const AdminLeagueManager = ({ leagues, masterTeams }: { leagues: League[], masterTeams: MasterTeam[] }) => {
    const [newLeagueName, setNewLeagueName] = useState('');
    const [newLeagueLogo, setNewLeagueLogo] = useState('');
    const [newLeagueCat, setNewLeagueCat] = useState<'CLUB'|'NATIONAL'>('CLUB');

    const handleAddLeague = async () => {
        if (!newLeagueName) return alert("리그 이름 입력");
        await addDoc(collection(db, "leagues"), { id: Date.now(), name: newLeagueName, logo: newLeagueLogo, category: newLeagueCat });
        setNewLeagueName(''); setNewLeagueLogo('');
    };
    
    // 👇 [수정] (l as any).docId 로 강제 접근 (타입 에러 해결)
    const handleDeleteLeague = async (id: string) => { if(confirm("삭제?")) await deleteDoc(doc(db,"leagues",id)); };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <input value={newLeagueName} onChange={e=>setNewLeagueName(e.target.value)} placeholder="League Name" className="flex-1 bg-slate-800 p-2 rounded text-xs"/>
                <input value={newLeagueLogo} onChange={e=>setNewLeagueLogo(e.target.value)} placeholder="Logo URL" className="flex-1 bg-slate-800 p-2 rounded text-xs"/>
                <select value={newLeagueCat} onChange={e=>setNewLeagueCat(e.target.value as any)} className="bg-slate-800 p-2 rounded text-xs"><option value="CLUB">Club</option><option value="NATIONAL">National</option></select>
                <button onClick={handleAddLeague} className="bg-emerald-600 px-4 rounded text-xs font-bold">Add</button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {leagues.map(l => (
                    <div key={l.id} className="bg-slate-950 p-2 rounded flex items-center justify-between border border-slate-800">
                        <div className="flex items-center gap-2"><img src={l.logo || FALLBACK_IMG} className="w-6 h-6 object-contain" alt=""/><span className="text-xs">{l.name}</span></div>
                        <button onClick={()=>handleDeleteLeague((l as any).docId)} className="text-red-500">×</button>
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
    const [filterRegion, setFilterRegion] = useState('ALL');

    const handleAddTeam = async () => {
        if(!newTeamName || !newTeamRegion) return alert("정보 입력 필요");
        const league = leagues.find(l=>l.name===newTeamRegion);
        await addDoc(collection(db,"master_teams"), { id:Date.now(), name:newTeamName, logo:newTeamLogo, region:newTeamRegion, tier:newTeamTier, category: league?.category || 'CLUB' });
        setNewTeamName(''); setNewTeamLogo('');
    };
    
    // 👇 [수정] (t as any).docId 사용
    const handleDeleteTeam = async (id: string) => { if(confirm("삭제?")) await deleteDoc(doc(db,"master_teams",id)); };

    const sortedTeams = getSortedTeamsLogic(masterTeams.filter(t => filterRegion === 'ALL' || t.region === filterRegion), '');

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
                <input value={newTeamName} onChange={e=>setNewTeamName(e.target.value)} placeholder="Team Name" className="bg-slate-800 p-2 rounded text-xs"/>
                <input value={newTeamLogo} onChange={e=>setNewTeamLogo(e.target.value)} placeholder="Logo URL" className="bg-slate-800 p-2 rounded text-xs"/>
                <select value={newTeamRegion} onChange={e=>setNewTeamRegion(e.target.value)} className="bg-slate-800 p-2 rounded text-xs"><option value="">Select League</option>{getSortedLeagues(leagues.map(l=>l.name)).map(l=><option key={l} value={l}>{l}</option>)}</select>
                <select value={newTeamTier} onChange={e=>setNewTeamTier(e.target.value)} className="bg-slate-800 p-2 rounded text-xs"><option value="S">S Tier</option><option value="A">A Tier</option><option value="B">B Tier</option><option value="C">C Tier</option></select>
                <button onClick={handleAddTeam} className="col-span-2 bg-emerald-600 p-2 rounded text-xs font-bold">Add Team</button>
            </div>
            <select value={filterRegion} onChange={e=>setFilterRegion(e.target.value)} className="w-full bg-slate-900 p-2 rounded text-xs border border-slate-700"><option value="ALL">All Leagues</option>{getSortedLeagues(leagues.map(l=>l.name)).map(l=><option key={l} value={l}>{l}</option>)}</select>
            <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {sortedTeams.map(t => (
                    <div key={t.id} className="bg-slate-950 p-2 rounded flex flex-col items-center border border-slate-800 relative">
                        <img src={t.logo} className="w-8 h-8 object-contain mb-1" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG}/>
                        <span className="text-[10px] text-center truncate w-full">{t.name}</span>
                        <span className={`text-[8px] px-1 rounded absolute top-1 right-1 ${getTierBadgeColor(t.tier)}`}>{t.tier}</span>
                        <button onClick={()=>handleDeleteTeam((t as any).docId)} className="text-red-500 text-xs absolute top-1 left-1">×</button>
                    </div>
                ))}
            </div>
        </div>
    );
};