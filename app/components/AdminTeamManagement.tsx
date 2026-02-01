/* eslint-disable @next/next/no-img-element */
// app/components/AdminTeamManagement.tsx
import React, { useState, useRef, useMemo } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { League, MasterTeam, DEFAULT_LEAGUES, FALLBACK_IMG, getTierColor, getSortedTeamsLogic, getSortedLeagues } from '../types';

// ==========================================
// 1. 리그/지역 관리자
// ==========================================
interface LeagueProps {
  leagues: League[];
  masterTeams: MasterTeam[];
}

export const AdminLeagueManager = ({ leagues, masterTeams }: LeagueProps) => {
  const [categoryTab, setCategoryTab] = useState<'CLUB' | 'NATIONAL'>('CLUB');
  const [leagueName, setLeagueName] = useState('');
  const [leagueLogo, setLeagueLogo] = useState('');
  const [editLeagueId, setEditLeagueId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const filteredLeagues = useMemo(() => {
    const list = leagues.filter(l => l.category === categoryTab);
    return list.sort((a,b) => {
       const rankA = DEFAULT_LEAGUES.indexOf(a.name);
       const rankB = DEFAULT_LEAGUES.indexOf(b.name);
       return (rankA === -1 ? 99 : rankA) - (rankB === -1 ? 99 : rankB);
    });
  }, [leagues, categoryTab]);

  const handleSave = async () => {
    if (!leagueName || !leagueLogo) return alert("이름과 로고를 입력하세요.");
    const data = { name: leagueName, logo: leagueLogo, category: categoryTab };
    if (editLeagueId) {
      await updateDoc(doc(db, "leagues", editLeagueId), data);
      setEditLeagueId(null);
    } else {
      await addDoc(collection(db, "leagues"), data);
    }
    setLeagueName(''); setLeagueLogo('');
  };

  const handleDelete = async (l: League) => {
    if (confirm(`'${l.name}' 리그를 삭제하시겠습니까?\n⚠️ 소속된 팀들은 모두 '무소속'으로 변경됩니다.`)) {
      const batch = writeBatch(db);
      masterTeams.filter(t => t.region === l.name).forEach(t => {
        if(t.id) batch.update(doc(db, "master_teams", t.id), { region: '무소속' });
      });
      await batch.commit();
      if(l.id) await deleteDoc(doc(db, "leagues", l.id));
      setEditLeagueId(null); setLeagueName(''); setLeagueLogo('');
    }
  };

  const handleEdit = (l: League) => {
    setEditLeagueId(l.id!); setLeagueName(l.name); setLeagueLogo(l.logo);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getLeagueLogoStyle = (isNational: boolean) => isNational ? "w-12 h-12 rounded-full bg-white object-cover shadow-lg" : "w-12 h-12 rounded-full bg-white object-contain p-1.5 shadow-lg";

  return (
    <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-700 space-y-6 animate-in fade-in">
      <div className="flex justify-center mb-4">
        <div className="bg-slate-950 p-1 rounded-full border border-slate-800 flex">
          <button onClick={() => setCategoryTab('CLUB')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${categoryTab === 'CLUB' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>🏢 CLUB</button>
          <button onClick={() => setCategoryTab('NATIONAL')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${categoryTab === 'NATIONAL' ? 'bg-red-600 text-white' : 'text-slate-500'}`}>🏳️ NATIONAL</button>
        </div>
      </div>

      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800" ref={formRef}>
        <div className="flex justify-between items-center mb-4">
           <h4 className={`${editLeagueId ? 'text-orange-400' : 'text-yellow-400'} text-xs font-bold`}>{editLeagueId ? '✏️ 리그 수정' : '✨ 신규 리그 등록'}</h4>
           {editLeagueId && <button onClick={()=>{setEditLeagueId(null); setLeagueName(''); setLeagueLogo('');}} className="text-[10px] text-slate-500 underline">취소</button>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input value={leagueName} onChange={e=>setLeagueName(e.target.value)} className="bg-slate-900 p-3 rounded-xl border border-slate-700 text-sm outline-none focus:border-yellow-500" placeholder="리그 이름" />
          <div className="flex gap-2">
            <input value={leagueLogo} onChange={e=>setLeagueLogo(e.target.value)} className="w-full bg-slate-900 p-3 rounded-xl border border-slate-700 text-sm outline-none focus:border-yellow-500" placeholder="로고 URL" />
            {leagueLogo && <img src={leagueLogo} className={getLeagueLogoStyle(categoryTab==='NATIONAL')} alt="preview" onError={(e:any)=>e.target.src=FALLBACK_IMG} />}
          </div>
        </div>
        <button onClick={handleSave} className={`w-full mt-4 py-3 rounded-xl font-bold text-black ${editLeagueId ? 'bg-orange-500' : 'bg-yellow-600'}`}>{editLeagueId ? '수정 저장' : '등록하기'}</button>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {filteredLeagues.map(l => (
          <div key={l.id} onClick={() => handleEdit(l)} className={`relative p-3 rounded-xl border cursor-pointer flex flex-col items-center gap-2 ${editLeagueId===l.id ? 'border-orange-500 bg-orange-900/20' : 'border-slate-800 bg-slate-950 hover:border-yellow-500'}`}>
            <img src={l.logo} className={getLeagueLogoStyle(categoryTab==='NATIONAL')} alt={l.name} onError={(e:any)=>e.target.src=FALLBACK_IMG} />
            <span className="text-[10px] text-center font-bold text-slate-300">{l.name}</span>
            <button onClick={(e)=>{e.stopPropagation(); handleDelete(l)}} className="absolute top-1 right-1 text-slate-600 hover:text-red-500 text-lg leading-none">×</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// 2. 팀 관리자
// ==========================================
interface TeamProps {
  leagues: League[];
  masterTeams: MasterTeam[];
}

export const AdminTeamManager = ({ leagues, masterTeams }: TeamProps) => {
  const [categoryTab, setCategoryTab] = useState<'CLUB' | 'NATIONAL'>('CLUB');
  const [manageTier, setManageTier] = useState('ALL');
  const [manageRegion, setManageRegion] = useState('ALL');
  const [manageSearch, setManageSearch] = useState('');
  const [isTierEditMode, setIsTierEditMode] = useState(false);
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [manualTeam, setManualTeam] = useState<MasterTeam>({ name: '', logo: '', category: 'CLUB', region: '', tier: 'A' });
  const [bulkInput, setBulkInput] = useState('');
  const [visibleCount, setVisibleCount] = useState(18);
  const [showAllTeams, setShowAllTeams] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const handleCategoryChange = (cat: 'CLUB' | 'NATIONAL') => {
    setCategoryTab(cat); setManageRegion('ALL'); setManageSearch(''); setEditTeamId(null); setIsTierEditMode(false); setShowAllTeams(false);
    setManualTeam({ name: '', logo: '', category: cat, region: '', tier: 'A' });
  };

  const leagueRegions = useMemo(() => {
    const names = Array.from(new Set([...leagues.filter(l=>l.category===categoryTab).map(l=>l.name), '무소속']));
    return getSortedLeagues(names);
  }, [leagues, categoryTab]);
  
  const leagueGridData = useMemo(() => {
    return leagueRegions.map(r => {
        const lInfo = leagues.find(l => l.name === r);
        const count = masterTeams.filter(t => t.region === r && t.category === categoryTab).length;
        return { name: r, logo: lInfo?.logo || FALLBACK_IMG, count };
    }).filter(g => g.name !== '' && g.count > 0);
  }, [leagueRegions, leagues, masterTeams, categoryTab]);

  const filteredTeams = useMemo(() => {
    let base = masterTeams.filter(t => t.category === categoryTab);
    if (manageRegion !== 'ALL') base = base.filter(t => t.region === manageRegion);
    if (manageTier !== 'ALL') base = base.filter(t => t.tier === manageTier);
    if (manageSearch) base = base.filter(t => t.name.toLowerCase().includes(manageSearch.toLowerCase()));
    return getSortedTeamsLogic(base, '');
  }, [masterTeams, categoryTab, manageRegion, manageTier, manageSearch]);

  const getLogoStyle = (isNational: boolean) => isNational ? "w-10 h-10 rounded-full bg-white object-cover shadow-md" : "w-10 h-10 rounded-full bg-white object-contain p-1 shadow-md";
  const getLeagueLogoStyle = (isNational: boolean) => isNational ? "w-12 h-12 rounded-full bg-white object-cover shadow-lg" : "w-12 h-12 rounded-full bg-white object-contain p-1.5 shadow-lg";

  const handleSave = async () => {
    if (!manualTeam.name) return alert("팀 이름을 입력하세요.");
    const payload = { ...manualTeam, category: categoryTab };
    if (editTeamId) await updateDoc(doc(db, "master_teams", editTeamId), payload as any);
    else await addDoc(collection(db, "master_teams"), payload);
    setEditTeamId(null); setManualTeam({ name: '', logo: '', category: categoryTab, region: '', tier: 'A' });
  };

  const handleDelete = async (id: string) => { if (confirm("정말 삭제하시겠습니까?")) await deleteDoc(doc(db, "master_teams", id)); };
  const handleQuickTier = async (id: string, tier: any) => { await updateDoc(doc(db, "master_teams", id), { tier }); };
  
  const handleBulk = async () => {
    try {
      const d = JSON.parse(bulkInput);
      if (!Array.isArray(d)) throw new Error("배열 형식 아님");
      for (const i of d) await addDoc(collection(db, "master_teams"), { ...i, category: categoryTab });
      setBulkInput(''); alert("완료");
    } catch (e) { alert("JSON 오류: " + e); }
  };

  const handleResetTiers = async () => {
    if(!confirm("현재 목록의 모든 팀을 C등급으로 초기화?")) return;
    const batch = writeBatch(db);
    filteredTeams.forEach(t => { if(t.id) batch.update(doc(db,"master_teams",t.id), {tier:'C'}); });
    await batch.commit();
  };

  const isLeagueGridView = manageRegion === 'ALL' && !showAllTeams && !manageSearch;

  return (
    <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-700 space-y-6 animate-in fade-in">
      <div className="flex justify-center mb-4">
        <div className="bg-slate-950 p-1 rounded-full border border-slate-800 flex">
          <button onClick={() => handleCategoryChange('CLUB')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${categoryTab === 'CLUB' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>🏢 CLUB</button>
          <button onClick={() => handleCategoryChange('NATIONAL')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${categoryTab === 'NATIONAL' ? 'bg-red-600 text-white' : 'text-slate-500'}`}>🏳️ NATIONAL</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end bg-slate-950 p-4 rounded-xl border border-slate-800">
         <div className="flex flex-col gap-1"><label className="text-[10px] text-slate-500 font-bold ml-1">리그 필터</label><select value={manageRegion} onChange={e=>{setManageRegion(e.target.value); setShowAllTeams(false);}} className="bg-slate-900 border border-slate-700 p-2 rounded-lg text-xs outline-none focus:border-emerald-500"><option value="ALL">전체 보기</option>{leagueRegions.map(r=><option key={r} value={r}>{r}</option>)}</select></div>
         <div className="flex flex-col gap-1"><label className="text-[10px] text-slate-500 font-bold ml-1">등급 필터</label><select value={manageTier} onChange={e=>setManageTier(e.target.value)} className="bg-slate-900 border border-slate-700 p-2 rounded-lg text-xs outline-none focus:border-emerald-500"><option value="ALL">전체</option>{['S','A','B','C'].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
         <div className="flex flex-col gap-1 flex-1 min-w-[150px]"><label className="text-[10px] text-slate-500 font-bold ml-1">검색</label><input value={manageSearch} onChange={e=>setManageSearch(e.target.value)} placeholder="검색어를 입력하세요" className="bg-slate-900 border border-slate-700 p-2 rounded-lg text-xs w-full outline-none focus:border-emerald-500" /></div>
         <button onClick={() => setIsTierEditMode(!isTierEditMode)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all h-[34px] ${isTierEditMode?'bg-purple-600 text-white animate-pulse':'bg-slate-800 text-purple-400 border border-purple-900'}`}>⚡ 등급 변경 모드</button>
      </div>

      {isLeagueGridView && (
        <div className="animate-in fade-in">
            <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-xs text-slate-400 font-bold">📂 리그를 선택하여 팀을 관리하세요</span>
                <button onClick={() => setShowAllTeams(true)} className="text-xs text-emerald-400 font-bold hover:underline">📋 전체 팀 리스트 보기</button>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {leagueGridData.map((l, idx) => (
                    <div key={idx} onClick={() => setManageRegion(l.name)} className="relative p-4 rounded-xl border border-slate-800 bg-slate-950 flex flex-col items-center gap-2 cursor-pointer hover:border-emerald-500 transition-all hover:scale-105">
                        <img src={l.logo} className={getLeagueLogoStyle(categoryTab === 'NATIONAL')} alt={l.name} onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                        <span className="text-[10px] text-center font-bold text-slate-300">{l.name}</span>
                        <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-500">{l.count} teams</span>
                    </div>
                ))}
            </div>
        </div>
      )}

      {!isLeagueGridView && (
        <div className="animate-in fade-in">
            {manageRegion !== 'ALL' && (
                <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setManageRegion('ALL')} className="text-xs bg-slate-800 px-3 py-1 rounded text-slate-400 hover:text-white">← 뒤로가기</button>
                    <span className="text-sm font-bold text-emerald-400">{manageRegion} <span className="text-slate-500">({filteredTeams.length})</span></span>
                </div>
            )}
            
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {filteredTeams.slice(0, visibleCount).map(t => (
                <div key={t.id} onClick={() => { if(!isTierEditMode) { setEditTeamId(t.id!); setManualTeam(t); formRef.current?.scrollIntoView({behavior:'smooth'}); }}} className={`relative p-3 rounded-xl border cursor-pointer flex flex-col items-center gap-2 ${editTeamId===t.id?'border-emerald-500 bg-emerald-900/10':'border-slate-800 bg-slate-950 hover:border-emerald-500'}`}>
                    <img src={t.logo} className={getLogoStyle(t.category==='NATIONAL')} alt={t.name} onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                    <span className="text-[10px] text-center font-bold truncate w-full text-slate-300">{t.name}</span>
                    {isTierEditMode ? <div className="flex gap-0.5">{['S','A','B','C'].map(tier=><button key={tier} onClick={(e)=>{e.stopPropagation(); handleQuickTier(t.id!, tier)}} className={`w-4 h-4 text-[8px] rounded ${t.tier===tier?getTierColor(tier):'bg-slate-800 border border-slate-700 text-slate-500'}`}>{tier}</button>)}</div> : <div className="flex items-center gap-1"><span className="text-[9px] text-slate-500">{t.region}</span><span className={`text-[9px] font-bold px-1 rounded ${getTierColor(t.tier).replace('border-','text-').replace('bg-','bg-opacity-20 ')}`}>{t.tier}</span></div>}
                    {!isTierEditMode && <button onClick={(e)=>{e.stopPropagation(); handleDelete(t.id!)}} className="absolute top-1 right-1 text-slate-700 hover:text-red-500 text-lg leading-none">×</button>}
                </div>
                ))}
            </div>
            {filteredTeams.length > visibleCount && <button onClick={()=>setVisibleCount(p=>p+18)} className="w-full py-3 bg-slate-800 text-slate-400 font-bold text-xs rounded-xl mt-4">더 보기 ({filteredTeams.length - visibleCount}+)</button>}
        </div>
      )}

      {!isLeagueGridView && (
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 mt-6" ref={formRef}>
             <div className="flex justify-between items-center mb-4">
                <h4 className={`${editTeamId ? 'text-orange-400' : 'text-emerald-400'} text-xs font-bold`}>{editTeamId ? '🛡️ 팀 정보 수정' : '🛡️ 신규 팀 등록'}</h4>
                {editTeamId && <button onClick={()=>{setEditTeamId(null); setManualTeam({ name: '', logo: '', category: categoryTab, region: '', tier: 'A' })}} className="text-[10px] text-slate-500 underline">취소</button>}
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1"><label className="text-xs text-slate-500 ml-1">소속 리그 (이동 가능)</label><select value={manualTeam.region} onChange={e=>setManualTeam({...manualTeam, region:e.target.value})} className="w-full bg-slate-900 p-3 rounded-lg border border-slate-700 text-xs outline-none"><option value="">선택하세요</option>{leagueRegions.map(r=><option key={r} value={r}>{r}</option>)}<optgroup label="기본">{DEFAULT_LEAGUES.map(d=><option key={d} value={d}>{d}</option>)}</optgroup></select></div>
                <div className="space-y-1"><label className="text-xs text-slate-500 ml-1">등급</label><select value={manualTeam.tier} onChange={e=>setManualTeam({...manualTeam, tier:e.target.value as any})} className="w-full bg-slate-900 p-3 rounded-lg border border-slate-700 text-xs outline-none"><option value="S">S Class</option><option value="A">A Class</option><option value="B">B Class</option><option value="C">C Class</option></select></div>
                <div className="space-y-1"><label className="text-xs text-slate-500 ml-1">팀 이름</label><input value={manualTeam.name} onChange={e=>setManualTeam({...manualTeam, name:e.target.value})} className="w-full bg-slate-900 p-3 rounded-lg border border-slate-700 text-xs outline-none" /></div>
                <div className="space-y-1"><label className="text-xs text-slate-500 ml-1">로고 URL</label><input value={manualTeam.logo} onChange={e=>setManualTeam({...manualTeam, logo:e.target.value})} className="w-full bg-slate-900 p-3 rounded-lg border border-slate-700 text-xs outline-none" /></div>
             </div>
             <button onClick={handleSave} className={`w-full mt-4 text-white py-3 rounded-xl font-bold transition-colors text-sm ${editTeamId ? 'bg-orange-600' : 'bg-emerald-600'}`}>{editTeamId?'수정사항 저장':'팀 등록하기'}</button>
          </div>
      )}

      {!isLeagueGridView && (
          <div className="border-t border-slate-800 pt-4 mt-8">
             <details className="text-xs text-slate-500 cursor-pointer"><summary>🔧 고급 도구</summary>
               <textarea value={bulkInput} onChange={e=>setBulkInput(e.target.value)} className="w-full h-24 bg-slate-950 mt-2 p-3 rounded border border-slate-800 text-slate-300" placeholder='JSON Array' />
               <button onClick={handleBulk} className="mt-2 bg-orange-700 text-white px-4 py-2 rounded font-bold">일괄 등록</button>
             </details>
             <button onClick={handleResetTiers} className="mt-4 text-red-500 underline text-[10px]">현재 목록 팀 등급 초기화</button>
          </div>
      )}
    </div>
  );
};