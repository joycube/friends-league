"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc } from 'firebase/firestore';

// --- 인터페이스 정의 ---
interface Season { 
  id: number; name: string; type: 'LEAGUE' | 'TOURNAMENT'; leagueMode?: 'SINGLE' | 'DOUBLE'; isActive: boolean;
  teams?: Team[]; rounds?: Round[]; 
  prizes: { total: number; first: number; second: number; third: number; scorer: number; };
}
interface Owner { id: number; nickname: string; photo: string; docId?: string; }
interface MasterTeam { id?: string; name: string; logo: string; category: 'CLUB' | 'NATIONAL'; region: string; tier: 'S' | 'A' | 'B' | 'C'; }
interface Team { id: number; seasonId: number; name: string; logo: string; ownerName: string; win: number; draw: number; loss: number; points: number; tier: string; }
interface Round { round: number; matches: any[]; seasonId: number; name?: string; }

export default function FootballLeagueApp() {
  const [currentView, setCurrentView] = useState<'RANKING' | 'RECORD' | 'TEAMS'>('RANKING');
  const [recordTab, setRecordTab] = useState<number | 'NEW' | 'OWNER'>(0);

  // DB 데이터 상태
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currentSeasonId, setCurrentSeasonId] = useState<number>(0);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // 시즌/오너 생성 상태
  const [inputSeasonName, setInputSeasonName] = useState('');
  const [inputSeasonType, setInputSeasonType] = useState<'LEAGUE' | 'TOURNAMENT'>('LEAGUE');
  const [inputLeagueMode, setInputLeagueMode] = useState<'SINGLE' | 'DOUBLE'>('SINGLE');
  const [inputTotalPrize, setInputTotalPrize] = useState(100000);
  const [prizes, setPrizes] = useState({ first: 50000, second: 30000, third: 10000, scorer: 10000 });
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPhoto, setNewOwnerPhoto] = useState('');

  // [팀 배정] 필터 상태
  const [selOwnerId, setSelOwnerId] = useState<number | ''>('');
  const [selCategory, setSelCategory] = useState<'CLUB' | 'NATIONAL'>('CLUB');
  const [selTier, setSelTier] = useState<string>('ALL');
  const [selRegion, setSelRegion] = useState<string>('ALL');
  const [selTeamName, setSelTeamName] = useState<string>('');

  // [팀 관리] 등록 및 수정 상태 🔥 (복구됨)
  const [manageTab, setManageTab] = useState<'CLUB' | 'NATIONAL'>('CLUB');
  const [manageTier, setManageTier] = useState('ALL');
  const [manageRegion, setManageRegion] = useState('ALL');
  const [manageSearch, setManageSearch] = useState('');
  
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [manualTeam, setManualTeam] = useState<MasterTeam>({
    name: '', logo: '', category: 'CLUB', region: '', tier: 'A'
  });
  const manualFormRef = useRef<HTMLDivElement>(null);

  // --- 상금 자동 계산 ---
  useEffect(() => {
    setPrizes({
      first: Math.floor(inputTotalPrize * 0.5), second: Math.floor(inputTotalPrize * 0.3),
      third: Math.floor(inputTotalPrize * 0.1), scorer: Math.floor(inputTotalPrize * 0.1),
    });
  }, [inputTotalPrize]);

  // --- DB 실시간 동기화 ---
  useEffect(() => {
    onSnapshot(query(collection(db, "users"), orderBy("id", "asc")), (s) => setOwners(s.docs.map(d => ({ ...d.data(), docId: d.id } as Owner))));
    onSnapshot(collection(db, "master_teams"), (s) => setMasterTeams(s.docs.map(d => ({ id: d.id, ...d.data() } as MasterTeam))));
    onSnapshot(query(collection(db, "seasons"), orderBy("id", "desc")), (s) => {
      const data = s.docs.map(d => d.data() as Season);
      setSeasons(data);
      if (data.length > 0 && currentSeasonId === 0) { setCurrentSeasonId(data[0].id); setRecordTab(data[0].id); }
    });
  }, []);

  // --- 오너 및 시즌 관리 함수 ---
  const handleAddOwner = async () => {
    if (!newOwnerName.trim()) return alert("닉네임을 입력하세요.");
    const photo = newOwnerPhoto.trim() || `https://api.dicebear.com/7.x/adventurer/svg?seed=${newOwnerName}`;
    await addDoc(collection(db, "users"), { id: Date.now(), nickname: newOwnerName, photo });
    setNewOwnerName(''); setNewOwnerPhoto('');
  };

  const handleCreateSeason = async () => {
    if (!inputSeasonName.trim()) return alert("시즌명을 입력하세요.");
    const id = Date.now();
    await setDoc(doc(db, "seasons", String(id)), {
      id, name: inputSeasonName, type: inputSeasonType,
      leagueMode: inputSeasonType === 'LEAGUE' ? inputLeagueMode : 'SINGLE',
      isActive: true, teams: [], rounds: [], prizes: { total: inputTotalPrize, ...prizes }
    });
    setRecordTab(id); setInputSeasonName('');
  };

  // --- 팀 관리 전용 함수 (수정/등록) 🔥 ---
  const handleSelectTeamForEdit = (team: MasterTeam) => {
    setEditTeamId(team.id || null);
    setManualTeam({ ...team });
    manualFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSaveMasterTeam = async () => {
    if (!manualTeam.name || !manualTeam.region) return alert("팀 이름과 지역을 입력하세요.");
    
    try {
      if (editTeamId) {
        // 수정 모드
        const teamRef = doc(db, "master_teams", editTeamId);
        await updateDoc(teamRef, { ...manualTeam });
        alert("팀 정보가 성공적으로 수정되었습니다.");
      } else {
        // 신규 등록 모드
        await addDoc(collection(db, "master_teams"), { ...manualTeam });
        alert("새로운 팀이 등록되었습니다.");
      }
      handleCancelEdit();
    } catch (e) {
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  const handleCancelEdit = () => {
    setEditTeamId(null);
    setManualTeam({ name: '', logo: '', category: manageTab, region: '', tier: 'A' });
  };

  const handleDeleteMasterTeam = async (id: string) => {
    if (confirm("정말 이 마스터 팀을 데이터베이스에서 영구 삭제하시겠습니까?")) {
      await deleteDoc(doc(db, "master_teams", id));
      handleCancelEdit();
    }
  };

  // --- 팀 필터링 로직 ---
  const recordActiveSeason = seasons.find(s => s.id === recordTab);
  const takenTeamNames = useMemo(() => (recordActiveSeason?.teams || []).map(t => t.name), [recordActiveSeason]);

  const stepFilteredTeams = useMemo(() => {
    return masterTeams.filter(mt => {
      const isAvailable = !takenTeamNames.includes(mt.name);
      const matchCat = mt.category === selCategory;
      const matchTier = selTier === 'ALL' || mt.tier === selTier;
      const matchReg = selRegion === 'ALL' || mt.region === selRegion;
      return isAvailable && matchCat && matchTier && matchReg;
    });
  }, [masterTeams, takenTeamNames, selCategory, selTier, selRegion]);

  const manageDisplayTeams = useMemo(() => {
    return masterTeams.filter(mt => {
      const matchCat = mt.category === manageTab;
      const matchTier = manageTier === 'ALL' || mt.tier === manageTier;
      const matchReg = manageRegion === 'ALL' || mt.region === manageRegion;
      const matchSearch = mt.name.toLowerCase().includes(manageSearch.toLowerCase());
      return matchCat && matchTier && matchReg && matchSearch;
    });
  }, [masterTeams, manageTab, manageTier, manageRegion, manageSearch]);

  const manageRegions = useMemo(() => {
    return Array.from(new Set(masterTeams.filter(m => m.category === manageTab).map(m => m.region)));
  }, [masterTeams, manageTab]);

  return (
    <div className="min-h-screen bg-[#020617] text-white font-black italic tracking-tighter overflow-x-hidden pb-20">
      
      {/* 1. 상단 배너 */}
      <div className="w-full h-[225px] md:h-[330px] relative border-b border-slate-800 shadow-2xl">
        <img src="https://www.konami.com/efootball/s/img/main_page_1.png?v=903" className="w-full h-full object-cover opacity-80" alt="Banner" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent"></div>
        <div className="absolute bottom-6 left-6">
          <h1 className="text-4xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">eFOOTBALL LEAGUE<sup className="text-sm ml-1">TM</sup></h1>
          <p className="text-emerald-400 text-sm tracking-widest font-sans not-italic mt-1 uppercase">Advanced Management System</p>
        </div>
      </div>

      {/* 2. 네비게이션 */}
      <div className="flex justify-center mt-6 mb-8">
        <div className="flex bg-slate-900 border border-slate-700 p-1.5 rounded-2xl shadow-xl">
          {[{ id: 'RANKING', label: '🏆 랭킹' }, { id: 'RECORD', label: '📝 기록실' }, { id: 'TEAMS', label: '⚙️ 팀 관리' }].map((tab) => (
            <button key={tab.id} onClick={() => setCurrentView(tab.id as any)} className={`px-8 py-2 rounded-xl text-xs transition-all ${currentView === tab.id ? `bg-blue-600 text-white shadow-lg scale-105` : 'text-slate-400 hover:text-white'}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* ==================== VIEW 2: 기록실 (오너/시즌 관리) ==================== */}
        {currentView === 'RECORD' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row gap-4 bg-slate-900/80 p-5 rounded-3xl border border-slate-800">
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 mb-1.5 block font-bold uppercase">Selection Console</label>
                <select value={recordTab} onChange={(e) => setRecordTab(e.target.value === 'NEW' || e.target.value === 'OWNER' ? e.target.value : Number(e.target.value))} className="w-full bg-slate-950 p-4 rounded-xl border border-slate-700 text-sm font-sans not-italic">
                  <optgroup label="Core Options">
                    <option value="NEW">➕ CREATE NEW SEASON</option>
                    <option value="OWNER">👤 MANAGE OWNERS</option>
                  </optgroup>
                  <optgroup label="Active Seasons">
                    {seasons.map(s => <option key={s.id} value={s.id}>🏆 {s.name} ({s.type})</option>)}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* 오너 등록 양식 */}
            {recordTab === 'OWNER' && (
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-purple-500/30 space-y-6">
                <h3 className="text-purple-400 text-lg">OWNER REGISTRATION</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans not-italic">
                  <input type="text" value={newOwnerName} onChange={e => setNewOwnerName(e.target.value)} placeholder="NICKNAME" className="bg-slate-950 p-4 rounded-xl border border-slate-800" />
                  <input type="text" value={newOwnerPhoto} onChange={e => setNewOwnerPhoto(e.target.value)} placeholder="PHOTO URL (OPTIONAL)" className="bg-slate-950 p-4 rounded-xl border border-slate-800" />
                </div>
                <button onClick={handleAddOwner} className="w-full bg-purple-600 py-4 rounded-xl font-bold shadow-lg">REGISTER</button>
              </div>
            )}

            {/* 시즌 생성 양식 */}
            {recordTab === 'NEW' && (
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-emerald-500/30 space-y-6">
                <h3 className="text-emerald-400 text-lg">NEW SEASON SETUP</h3>
                <input type="text" value={inputSeasonName} onChange={e => setInputSeasonName(e.target.value)} placeholder="SEASON NAME" className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 font-sans not-italic" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans not-italic">
                  <select value={inputSeasonType} onChange={e => setInputSeasonType(e.target.value as any)} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <option value="LEAGUE">LEAGUE</option><option value="TOURNAMENT">TOURNAMENT</option>
                  </select>
                  {inputSeasonType === 'LEAGUE' && (
                    <select value={inputLeagueMode} onChange={e => setInputLeagueMode(e.target.value as any)} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <option value="SINGLE">SINGLE</option><option value="DOUBLE">HOME & AWAY</option>
                    </select>
                  )}
                </div>
                <button onClick={handleCreateSeason} className="w-full bg-emerald-600 py-4 rounded-xl font-bold">CREATE</button>
              </div>
            )}
          </div>
        )}

        {/* ==================== VIEW 3: 팀 관리 (등록/수정 기능 복구) ==================== */}
        {currentView === 'TEAMS' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* 🔥 팀 등록 및 수정 폼 (복구됨) */}
            <section ref={manualFormRef} className={`p-6 rounded-3xl border transition-all shadow-2xl ${editTeamId ? 'bg-blue-900/20 border-blue-500' : 'bg-slate-900/60 border-slate-800'}`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className={`text-xl font-black ${editTeamId ? 'text-blue-400' : 'text-emerald-400'}`}>
                  {editTeamId ? `⚙️ MODIFY TEAM: ${manualTeam.name}` : '➕ REGISTER NEW TEAM'}
                </h3>
                {editTeamId && (
                  <button onClick={handleCancelEdit} className="text-xs text-slate-400 underline font-sans not-italic">CANCEL EDIT</button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 font-sans not-italic">
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 ml-1">CATEGORY</p>
                  <select value={manualTeam.category} onChange={e => setManualTeam({...manualTeam, category: e.target.value as any})} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 text-sm">
                    <option value="CLUB">CLUB</option><option value="NATIONAL">NATIONAL</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 ml-1">TIER</p>
                  <select value={manualTeam.tier} onChange={e => setManualTeam({...manualTeam, tier: e.target.value as any})} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 text-sm">
                    <option value="S">S TIER</option><option value="A">A TIER</option><option value="B">B TIER</option><option value="C">C TIER</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 ml-1">REGION / LEAGUE</p>
                  <input type="text" value={manualTeam.region} onChange={e => setManualTeam({...manualTeam, region: e.target.value})} placeholder="e.g. Premier League" className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 text-sm" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 ml-1">TEAM NAME</p>
                  <input type="text" value={manualTeam.name} onChange={e => setManualTeam({...manualTeam, name: e.target.value})} placeholder="Team Name" className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 text-sm" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 ml-1">LOGO URL</p>
                  <input type="text" value={manualTeam.logo} onChange={e => setManualTeam({...manualTeam, logo: e.target.value})} placeholder="Image URL" className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 text-sm" />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={handleSaveMasterTeam} className={`flex-1 py-4 rounded-xl font-bold shadow-lg transition-all ${editTeamId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                  {editTeamId ? 'UPDATE TEAM INFO' : 'REGISTER TEAM'}
                </button>
                {editTeamId && (
                  <button onClick={() => handleDeleteMasterTeam(editTeamId)} className="px-8 bg-red-900/50 text-red-500 border border-red-800 rounded-xl font-bold hover:bg-red-900 transition-all">DELETE</button>
                )}
              </div>
            </section>

            {/* 필터 및 리스트 영역 */}
            <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 w-full md:w-auto">
                  <button onClick={() => {setManageTab('CLUB'); handleCancelEdit();}} className={`flex-1 md:px-8 py-2 rounded-lg text-xs transition-all ${manageTab === 'CLUB' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>CLUBS</button>
                  <button onClick={() => {setManageTab('NATIONAL'); handleCancelEdit();}} className={`flex-1 md:px-8 py-2 rounded-lg text-xs transition-all ${manageTab === 'NATIONAL' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>NATIONALS</button>
                </div>
                <div className="grid grid-cols-2 md:flex gap-2 w-full md:w-auto font-sans not-italic">
                  <select value={manageTier} onChange={e => setManageTier(e.target.value)} className="bg-slate-950 px-4 py-2 rounded-lg border border-slate-700 text-xs">
                    <option value="ALL">TIER (ALL)</option>
                    {['S','A','B','C'].map(t => <option key={t} value={t}>{t} TIER</option>)}
                  </select>
                  <select value={manageRegion} onChange={e => setManageRegion(e.target.value)} className="bg-slate-950 px-4 py-2 rounded-lg border border-slate-700 text-xs">
                    <option value="ALL">REGION (ALL)</option>
                    {manageRegions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div className="relative">
                <input type="text" value={manageSearch} onChange={e => setManageSearch(e.target.value)} placeholder="SEARCH TEAM NAME..." className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 text-sm pl-12 font-sans not-italic focus:border-blue-500 outline-none" />
                <span className="absolute left-5 top-4.5 text-slate-600">🔍</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {manageDisplayTeams.map(mt => (
                  <div key={mt.id} onClick={() => handleSelectTeamForEdit(mt)} className={`bg-slate-950 p-4 rounded-2xl border flex flex-col items-center gap-3 group cursor-pointer transition-all hover:scale-105 ${editTeamId === mt.id ? 'border-blue-500 ring-2 ring-blue-500/50 shadow-blue-500/20 shadow-2xl' : 'border-slate-800 hover:border-slate-600'}`}>
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center p-2 shadow-inner">
                      <img src={mt.logo} className="w-full h-full object-contain" alt="logo" />
                    </div>
                    <div className="text-center w-full">
                      <p className="text-[11px] h-8 flex items-center justify-center font-black truncate leading-tight">{mt.name}</p>
                      <div className="flex justify-center gap-1 mt-1 font-sans not-italic">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${mt.tier === 'S' ? 'bg-yellow-500 text-black' : mt.tier === 'A' ? 'bg-slate-300 text-black' : 'bg-slate-800 text-slate-400'}`}>{mt.tier}</span>
                        <span className="text-[8px] px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-500 truncate max-w-[50px]">{mt.region}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
