// app/components/AdminTeamManagement.tsx
import React, { useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { League, MasterTeam, DEFAULT_LEAGUES, FALLBACK_IMG, getTierColor, getSortedTeamsLogic } from '../types';

interface Props {
  leagues: League[];
  masterTeams: MasterTeam[];
}

export const AdminTeamManagement = ({ leagues, masterTeams }: Props) => {
  const [activeTab, setActiveTab] = useState<'LEAGUES' | 'TEAMS'>('LEAGUES');
  
  // --- League States ---
  const [leagueManageTab, setLeagueManageTab] = useState<'CLUB' | 'NATIONAL'>('CLUB');
  const [leagueName, setLeagueName] = useState('');
  const [leagueLogo, setLeagueLogo] = useState('');
  const [editLeagueId, setEditLeagueId] = useState<string | null>(null);
  
  // --- Team States ---
  const [manageTab, setManageTab] = useState<'CLUB' | 'NATIONAL'>('CLUB');
  const [manageTier, setManageTier] = useState('ALL');
  const [manageRegion, setManageRegion] = useState('ALL');
  const [manageSearch, setManageSearch] = useState('');
  const [isTierEditMode, setIsTierEditMode] = useState(false);
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [manualTeam, setManualTeam] = useState<MasterTeam>({ name: '', logo: '', category: 'CLUB', region: '', tier: 'A' });
  const [bulkInput, setBulkInput] = useState('');
  const [visibleCount, setVisibleCount] = useState(18);

  const leagueFormRef = useRef<HTMLDivElement>(null);
  const teamFormRef = useRef<HTMLDivElement>(null);

  // --- Handlers: League ---
  const handleSaveLeague = async () => {
    if (!leagueName || !leagueLogo) return alert("이름과 로고를 입력하세요.");
    if (editLeagueId) {
      await updateDoc(doc(db, "leagues", editLeagueId), { name: leagueName, logo: leagueLogo, category: leagueManageTab });
      setEditLeagueId(null);
    } else {
      await addDoc(collection(db, "leagues"), { name: leagueName, logo: leagueLogo, category: leagueManageTab });
    }
    setLeagueName(''); setLeagueLogo('');
  };

  const handleDeleteLeague = async (l: League) => {
    if (confirm(`'${l.name}' 리그를 삭제하시겠습니까?\n소속 팀은 '무소속'이 됩니다.`)) {
      const batch = writeBatch(db);
      masterTeams.filter(t => t.region === l.name).forEach(t => {
        if(t.id) batch.update(doc(db, "master_teams", t.id), { region: '무소속' });
      });
      await batch.commit();
      if(l.id) await deleteDoc(doc(db, "leagues", l.id));
    }
  };

  const handleEditLeagueClick = (l: League) => {
    setEditLeagueId(l.id!); setLeagueName(l.name); setLeagueLogo(l.logo); setLeagueManageTab(l.category);
    leagueFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // --- Handlers: Team ---
  const handleSaveMaster = async () => {
    if (!manualTeam.name) return alert("팀 이름을 입력하세요.");
    if (editTeamId) await updateDoc(doc(db, "master_teams", editTeamId), manualTeam as any);
    else await addDoc(collection(db, "master_teams"), manualTeam);
    setEditTeamId(null); setManualTeam({ name: '', logo: '', category: 'CLUB', region: '', tier: 'A' });
  };

  const handleDeleteMasterTeam = async (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) await deleteDoc(doc(db, "master_teams", id));
  };

  const handleQuickTierUpdate = async (id: string, tier: any) => {
    await updateDoc(doc(db, "master_teams", id), { tier });
  };

  const handleResetAllTiers = async () => {
    if (!confirm("⚠️ 모든 팀을 C등급으로 초기화하시겠습니까?")) return;
    const batch = writeBatch(db);
    let count = 0;
    masterTeams.forEach(t => {
      if(t.id) {
        batch.update(doc(db, "master_teams", t.id), { tier: 'C' });
        count++;
      }
    });
    await batch.commit();
    alert(`완료! ${count}개 팀 초기화.`);
  };

  const handleBulk = async () => {
    try {
      const d = JSON.parse(bulkInput);
      if (!Array.isArray(d)) throw new Error("배열 형식이 아닙니다.");
      for (const i of d) await addDoc(collection(db, "master_teams"), { ...i });
      setBulkInput(''); alert("등록 완료");
    } catch (e) { alert("JSON 오류: " + e); }
  };

  // --- Filter Logic ---
  const targetTeams = masterTeams.filter(t => t.category === manageTab);
  const currentLeagues = leagues.filter(l => l.category === manageTab);
  const regions = Array.from(new Set([...currentLeagues.map(l => l.name), ...targetTeams.map(t => t.region), '무소속'])).sort();
  
  const filteredTeams = getSortedTeamsLogic(
    targetTeams.filter(t => 
      (manageRegion === 'ALL' || t.region === manageRegion) &&
      (manageTier === 'ALL' || t.tier === manageTier) &&
      t.name.toLowerCase().includes(manageSearch.toLowerCase())
    ), ''
  );

  return (
    <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-700 space-y-6">
      <div className="flex gap-2 border-b border-slate-700 pb-4">
        <button onClick={() => setActiveTab('LEAGUES')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'LEAGUES' ? 'bg-yellow-600 text-black' : 'text-slate-400'}`}>🏳️ 리그 관리</button>
        <button onClick={() => setActiveTab('TEAMS')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'TEAMS' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>🛡️ 팀 관리</button>
      </div>

      {activeTab === 'LEAGUES' && (
        <div className="space-y-6 animate-in fade-in">
           <div className="flex gap-2">
             <button onClick={() => setLeagueManageTab('CLUB')} className={`px-4 py-1 rounded-full text-xs ${leagueManageTab==='CLUB'?'bg-white text-black':'bg-slate-800 text-slate-500'}`}>CLUB</button>
             <button onClick={() => setLeagueManageTab('NATIONAL')} className={`px-4 py-1 rounded-full text-xs ${leagueManageTab==='NATIONAL'?'bg-white text-black':'bg-slate-800 text-slate-500'}`}>NATIONAL</button>
           </div>
           
           <div className="bg-black/40 p-4 rounded-xl flex flex-col md:flex-row gap-2" ref={leagueFormRef}>
             <input value={leagueName} onChange={e=>setLeagueName(e.target.value)} placeholder="리그 이름" className="bg-slate-800 p-3 rounded text-sm w-full md:w-1/3" />
             <input value={leagueLogo} onChange={e=>setLeagueLogo(e.target.value)} placeholder="로고 URL" className="bg-slate-800 p-3 rounded text-sm w-full md:w-1/3" />
             <button onClick={handleSaveLeague} className="bg-yellow-600 text-black px-6 py-3 rounded font-bold text-xs whitespace-nowrap">{editLeagueId?'수정':'등록'}</button>
           </div>

           <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
             {leagues.filter(l => l.category === leagueManageTab).map(l => (
               <div key={l.id} onClick={() => handleEditLeagueClick(l)} className={`relative p-3 rounded-xl border cursor-pointer hover:border-yellow-500 flex flex-col items-center gap-2 ${editLeagueId===l.id?'border-yellow-500 bg-yellow-900/20':'border-slate-800 bg-slate-950'}`}>
                 <img src={l.logo} className="w-8 h-8 object-contain" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                 <span className="text-[10px] text-center font-bold">{l.name}</span>
                 <button onClick={(e)=>{e.stopPropagation(); handleDeleteLeague(l)}} className="absolute top-1 right-1 text-red-500 text-xs">×</button>
               </div>
             ))}
           </div>
        </div>
      )}

      {activeTab === 'TEAMS' && (
        <div className="space-y-6 animate-in fade-in">
           <div className="flex justify-between items-center">
             <div className="flex gap-2">
               <button onClick={() => setManageTab('CLUB')} className={`px-4 py-1 rounded-full text-xs ${manageTab==='CLUB'?'bg-white text-black':'bg-slate-800 text-slate-500'}`}>CLUB</button>
               <button onClick={() => setManageTab('NATIONAL')} className={`px-4 py-1 rounded-full text-xs ${manageTab==='NATIONAL'?'bg-white text-black':'bg-slate-800 text-slate-500'}`}>NATIONAL</button>
             </div>
             <button onClick={() => setIsTierEditMode(!isTierEditMode)} className={`px-3 py-1 rounded text-xs font-bold ${isTierEditMode?'bg-purple-600 text-white animate-pulse':'bg-slate-800 text-purple-400'}`}>⚡ 등급모드</button>
           </div>

           <div className="flex flex-wrap gap-2">
             <select value={manageRegion} onChange={e=>setManageRegion(e.target.value)} className="bg-slate-800 p-2 rounded text-xs"><option value="ALL">전체 리그</option>{regions.map(r=><option key={r} value={r}>{r}</option>)}</select>
             <select value={manageTier} onChange={e=>setManageTier(e.target.value)} className="bg-slate-800 p-2 rounded text-xs"><option value="ALL">전체 등급</option>{['S','A','B','C'].map(t=><option key={t} value={t}>{t}</option>)}</select>
             <input value={manageSearch} onChange={e=>setManageSearch(e.target.value)} placeholder="검색..." className="bg-slate-800 p-2 rounded text-xs w-32" />
           </div>

           <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
             {filteredTeams.slice(0, visibleCount).map(t => (
               <div key={t.id} onClick={() => { if(!isTierEditMode) { setEditTeamId(t.id!); setManualTeam(t); teamFormRef.current?.scrollIntoView({behavior:'smooth'}); }}} className={`relative p-3 rounded-xl border cursor-pointer hover:border-blue-500 flex flex-col items-center gap-2 ${editTeamId===t.id?'border-blue-500 bg-blue-900/20':'border-slate-800 bg-slate-950'}`}>
                 <img src={t.logo} className="w-8 h-8 object-contain" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                 <span className="text-[10px] text-center font-bold truncate w-full">{t.name}</span>
                 {isTierEditMode ? (
                   <div className="flex gap-0.5">{['S','A','B','C'].map(tier=><button key={tier} onClick={(e)=>{e.stopPropagation(); handleQuickTierUpdate(t.id!, tier)}} className={`w-4 h-4 text-[8px] rounded ${t.tier===tier?getTierColor(tier):'bg-slate-800'}`}>{tier}</button>)}</div>
                 ) : (
                   <span className={`text-[9px] font-bold ${getTierColor(t.tier).split(' ')[1]}`}>{t.tier}</span>
                 )}
                 {!isTierEditMode && <button onClick={(e)=>{e.stopPropagation(); handleDeleteMasterTeam(t.id!)}} className="absolute top-1 right-1 text-red-500 text-xs">×</button>}
               </div>
             ))}
           </div>
           {filteredTeams.length > visibleCount && <button onClick={()=>setVisibleCount(p=>p+18)} className="w-full py-2 bg-slate-800 text-slate-500 text-xs rounded-lg">더 보기 👇</button>}

           <div className="bg-black/40 p-6 rounded-xl space-y-4" ref={teamFormRef}>
             <h4 className="text-sm font-bold text-slate-400">{editTeamId ? '팀 수정' : '새 팀 등록'}</h4>
             <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
               <select value={manualTeam.category} onChange={e=>setManualTeam({...manualTeam, category:e.target.value as any})} className="bg-slate-800 p-2 rounded text-xs"><option value="CLUB">CLUB</option><option value="NATIONAL">NATIONAL</option></select>
               <select value={manualTeam.tier} onChange={e=>setManualTeam({...manualTeam, tier:e.target.value as any})} className="bg-slate-800 p-2 rounded text-xs"><option value="S">S</option><option value="A">A</option><option value="B">B</option><option value="C">C</option></select>
               <select value={manualTeam.region} onChange={e=>setManualTeam({...manualTeam, region:e.target.value})} className="bg-slate-800 p-2 rounded text-xs"><option value="">리그 선택</option>{leagues.filter(l=>l.category===manualTeam.category).map(l=><option key={l.id} value={l.name}>{l.name}</option>)}<optgroup label="기본">{DEFAULT_LEAGUES.map(d=><option key={d} value={d}>{d}</option>)}</optgroup></select>
               <input value={manualTeam.name} onChange={e=>setManualTeam({...manualTeam, name:e.target.value})} placeholder="팀 이름" className="bg-slate-800 p-2 rounded text-xs" />
               <input value={manualTeam.logo} onChange={e=>setManualTeam({...manualTeam, logo:e.target.value})} placeholder="로고 URL" className="bg-slate-800 p-2 rounded text-xs" />
             </div>
             <button onClick={handleSaveMaster} className="w-full bg-blue-600 py-3 rounded font-bold text-sm">{editTeamId?'수정 저장':'등록'}</button>
           </div>
           
           <div className="border-t border-slate-800 pt-4 mt-8">
             <details className="text-xs text-slate-500 cursor-pointer"><summary>JSON 대량 등록</summary>
               <textarea value={bulkInput} onChange={e=>setBulkInput(e.target.value)} className="w-full h-24 bg-slate-950 mt-2 p-2 rounded border border-slate-800" placeholder='[{"name":"Team","logo":"url","category":"CLUB","region":"EPL","tier":"A"}, ...]' />
               <button onClick={handleBulk} className="mt-2 bg-orange-700 text-white px-4 py-2 rounded">JSON 등록</button>
             </details>
             <button onClick={handleResetAllTiers} className="mt-4 text-red-500 underline text-xs">전체 팀 C등급 초기화 (주의)</button>
           </div>
        </div>
      )}
    </div>
  );
};