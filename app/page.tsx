"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

  // [팀 배정] 단계별 필터 상태
  const [selOwnerId, setSelOwnerId] = useState<number | ''>('');
  const [selCategory, setSelCategory] = useState<'CLUB' | 'NATIONAL'>('CLUB');
  const [selTier, setSelTier] = useState<string>('ALL');
  const [selRegion, setSelRegion] = useState<string>('ALL');
  const [selTeamName, setSelTeamName] = useState<string>('');

  // [팀 관리] 필터 및 검색 상태
  const [manageTab, setManageTab] = useState<'CLUB' | 'NATIONAL'>('CLUB');
  const [manageTier, setManageTier] = useState('ALL');
  const [manageRegion, setManageRegion] = useState('ALL');
  const [manageSearch, setManageSearch] = useState('');

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

  // --- [핵심] 팀 선택 및 필터링 로직 ---
  const recordActiveSeason = seasons.find(s => s.id === recordTab);
  
  // 현재 시즌에 이미 등록된 팀 이름 목록
  const takenTeamNames = useMemo(() => {
    const currentS = seasons.find(s => s.id === recordTab);
    return (currentS?.teams || []).map(t => t.name);
  }, [seasons, recordTab]);

  // 선택 단계에 따른 팀 리스트 필터링
  const stepFilteredTeams = useMemo(() => {
    return masterTeams.filter(mt => {
      const isAvailable = !takenTeamNames.includes(mt.name);
      const matchCat = mt.category === selCategory;
      const matchTier = selTier === 'ALL' || mt.tier === selTier;
      const matchReg = selRegion === 'ALL' || mt.region === selRegion;
      return isAvailable && matchCat && matchTier && matchReg;
    });
  }, [masterTeams, takenTeamNames, selCategory, selTier, selRegion]);

  const handleRandomDraw = () => {
    if (stepFilteredTeams.length === 0) return alert("조건에 맞는 남은 팀이 없습니다.");
    const rand = stepFilteredTeams[Math.floor(Math.random() * stepFilteredTeams.length)];
    setSelRegion(rand.region);
    setSelTier(rand.tier);
    setSelTeamName(rand.name);
    alert(`랜덤 추첨 결과: [${rand.tier}티어] ${rand.name}`);
  };

  const handleConfirmTeam = async () => {
    if (!selOwnerId) return alert("오너를 먼저 선택하세요.");
    if (!selTeamName) return alert("팀을 선택하거나 랜덤 추첨을 진행하세요.");
    
    const owner = owners.find(o => o.id === Number(selOwnerId));
    const master = masterTeams.find(mt => mt.name === selTeamName);
    
    if (!owner || !master) return alert("데이터 오류가 발생했습니다.");

    const newTeamEntry: Team = {
      id: Date.now(),
      seasonId: Number(recordTab),
      name: master.name,
      logo: master.logo,
      ownerName: owner.nickname,
      tier: master.tier,
      win: 0, draw: 0, loss: 0, points: 0
    };

    const updatedTeams = [...(recordActiveSeason?.teams || []), newTeamEntry];
    await updateDoc(doc(db, "seasons", String(recordTab)), { teams: updatedTeams });
    alert(`${owner.nickname} 오너에게 ${master.name} 팀이 배정되었습니다.`);
    setSelTeamName(''); // 초기화
  };

  // --- 팀 관리 페이지 필터링 로직 ---
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
      <div className="w-full h-[225px] md:h-[330px] relative border-b border-slate-800">
        <img src="https://www.konami.com/efootball/s/img/main_page_1.png?v=903" className="w-full h-full object-cover opacity-80" alt="Banner" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent"></div>
        <div className="absolute bottom-4 left-4">
          <h1 className="text-3xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 font-black italic">eFOOTBALL LEAGUE<sup className="text-sm align-top ml-1">TM</sup></h1>
          <p className="text-emerald-400 text-sm tracking-widest font-sans not-italic">Official Community Manager</p>
        </div>
      </div>

      {/* 2. 네비게이션 */}
      <div className="flex justify-center mt-6 mb-8">
        <div className="flex bg-slate-900 border border-slate-700 p-1.5 rounded-2xl shadow-xl">
          {[{ id: 'RANKING', label: '🏆 랭킹' }, { id: 'RECORD', label: '📝 기록실' }, { id: 'TEAMS', label: '⚙️ 팀 관리' }].map((tab) => (
            <button key={tab.id} onClick={() => setCurrentView(tab.id as any)} className={`px-6 py-2 rounded-xl text-xs transition-all ${currentView === tab.id ? `bg-blue-600 text-white shadow-lg scale-105` : 'text-slate-400 hover:text-white'}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* ==================== VIEW 2: 기록실 (팀 배정 로직 포함) ==================== */}
        {currentView === 'RECORD' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* 상단 통합 관리 셀렉터 */}
            <div className="flex flex-col md:flex-row gap-4 bg-slate-900/80 p-5 rounded-3xl border border-slate-800 shadow-xl">
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 mb-1.5 block font-bold uppercase">Management Console</label>
                <select 
                  value={recordTab} 
                  onChange={(e) => setRecordTab(e.target.value === 'NEW' || e.target.value === 'OWNER' ? e.target.value : Number(e.target.value))}
                  className="w-full bg-slate-950 p-3.5 rounded-xl border border-slate-700 text-sm font-sans not-italic focus:border-blue-500 outline-none"
                >
                  <optgroup label="System">
                    <option value="NEW">➕ CREATE NEW SEASON</option>
                    <option value="OWNER">👤 MANAGE OWNERS</option>
                  </optgroup>
                  <optgroup label="Seasons">
                    {seasons.map(s => <option key={s.id} value={s.id}>🏆 {s.name} ({s.type})</option>)}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* 오너 관리 섹션 */}
            {recordTab === 'OWNER' && (
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-purple-500/30 space-y-6">
                <h3 className="text-purple-400 text-lg">OWNER REGISTRATION</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans not-italic">
                  <input type="text" value={newOwnerName} onChange={e => setNewOwnerName(e.target.value)} placeholder="NICKNAME" className="bg-slate-950 p-3.5 rounded-xl border border-slate-800" />
                  <input type="text" value={newOwnerPhoto} onChange={e => setNewOwnerPhoto(e.target.value)} placeholder="PHOTO URL (OPTIONAL)" className="bg-slate-950 p-3.5 rounded-xl border border-slate-800" />
                </div>
                <button onClick={handleAddOwner} className="w-full bg-purple-600 py-4 rounded-xl font-bold shadow-lg hover:bg-purple-500">ADD NEW OWNER</button>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  {owners.map(o => (
                    <div key={o.id} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-4 relative group">
                      <img src={o.photo} className="w-12 h-12 rounded-full border-2 border-slate-700" alt="profile" />
                      <span className="text-sm truncate">{o.nickname}</span>
                      <button onClick={() => deleteDoc(doc(db,"users",o.docId!))} className="ml-auto text-red-500 font-bold hover:scale-125 transition-transform">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 신규 시즌 생성 섹션 */}
            {recordTab === 'NEW' && (
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-emerald-500/30 space-y-6">
                <h3 className="text-emerald-400 text-lg">NEW SEASON CONFIGURATION</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans not-italic">
                  <div className="space-y-4">
                    <input type="text" value={inputSeasonName} onChange={e => setInputSeasonName(e.target.value)} placeholder="SEASON NAME" className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800" />
                    <div className="flex gap-2">
                      <select value={inputSeasonType} onChange={e => setInputSeasonType(e.target.value as any)} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex-1">
                        <option value="LEAGUE">LEAGUE MODE</option><option value="TOURNAMENT">TOURNAMENT</option>
                      </select>
                      {inputSeasonType === 'LEAGUE' && (
                        <select value={inputLeagueMode} onChange={e => setInputLeagueMode(e.target.value as any)} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex-1">
                          <option value="SINGLE">SINGLE ROUND</option><option value="DOUBLE">HOME & AWAY</option>
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
                    <p className="text-xs text-emerald-500 font-bold uppercase tracking-widest text-center">Prize Pool Summary</p>
                    <input type="number" value={inputTotalPrize} onChange={e => setInputTotalPrize(Number(e.target.value))} className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-sm" />
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                      <div className="bg-slate-900 p-2 rounded">1ST: {prizes.first.toLocaleString()}₩</div>
                      <div className="bg-slate-900 p-2 rounded">2ND: {prizes.second.toLocaleString()}₩</div>
                      <div className="bg-slate-900 p-2 rounded">3RD: {prizes.third.toLocaleString()}₩</div>
                      <div className="bg-slate-900 p-2 rounded">TOP SCORER: {prizes.scorer.toLocaleString()}₩</div>
                    </div>
                  </div>
                </div>
                <button onClick={handleCreateSeason} className="w-full bg-emerald-600 py-4 rounded-xl font-bold shadow-lg">START SEASON</button>
              </div>
            )}

            {/* 시즌별 팀 배정 로직 (복구 및 개선) */}
            {typeof recordTab === 'number' && (
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-blue-500/30 space-y-6">
                <h3 className="text-blue-400 text-lg">TEAM ASSIGNMENT (STEP-BY-STEP)</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 font-sans not-italic">
                  {/* 1. 오너 선택 */}
                  <select value={selOwnerId} onChange={e => setSelOwnerId(Number(e.target.value))} className="bg-slate-950 p-3 rounded-xl border border-slate-700 text-xs">
                    <option value="">1. SELECT OWNER</option>
                    {owners.map(o => <option key={o.id} value={o.id}>{o.nickname}</option>)}
                  </select>
                  {/* 2. 카테고리 선택 */}
                  <select value={selCategory} onChange={e => {setSelCategory(e.target.value as any); setSelRegion('ALL'); setSelTeamName('');}} className="bg-slate-950 p-3 rounded-xl border border-slate-700 text-xs">
                    <option value="CLUB">2. CLUB</option>
                    <option value="NATIONAL">2. NATIONAL</option>
                  </select>
                  {/* 3. 티어 선택 */}
                  <select value={selTier} onChange={e => {setSelTier(e.target.value); setSelTeamName('');}} className="bg-slate-950 p-3 rounded-xl border border-slate-700 text-xs">
                    <option value="ALL">3. TIER (ALL)</option>
                    {['S','A','B','C'].map(t => <option key={t} value={t}>{t} TIER</option>)}
                  </select>
                  {/* 4. 지역 선택 */}
                  <select value={selRegion} onChange={e => {setSelRegion(e.target.value); setSelTeamName('');}} className="bg-slate-950 p-3 rounded-xl border border-slate-700 text-xs">
                    <option value="ALL">4. REGION (ALL)</option>
                    {Array.from(new Set(masterTeams.filter(m => m.category === selCategory).map(m => m.region))).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {/* 5. 랜덤 추첨 버튼 */}
                  <button onClick={handleRandomDraw} className="bg-slate-800 border border-slate-600 rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors">🎲 RANDOM DRAW</button>
                </div>

                <div className="flex flex-col md:flex-row gap-4 mt-4">
                  <div className="flex-1">
                    <select value={selTeamName} onChange={e => setSelTeamName(e.target.value)} className="w-full bg-slate-950 p-4 rounded-xl border border-slate-700 text-sm font-sans not-italic text-blue-400 font-bold">
                      <option value="">--- CHOOSE TEAM FROM LIST ---</option>
                      {stepFilteredTeams.map(mt => <option key={mt.id} value={mt.name}>[{mt.tier}] {mt.name} ({mt.region})</option>)}
                    </select>
                  </div>
                  <button onClick={handleConfirmTeam} className="bg-blue-600 px-10 rounded-xl font-bold italic shadow-lg hover:bg-blue-500 transition-all">CONFIRM ASSIGNMENT</button>
                </div>

                <div className="pt-6 border-t border-slate-800">
                  <p className="text-[10px] text-slate-500 mb-3 font-bold">CURRENTLY ASSIGNED TEAMS IN THIS SEASON</p>
                  <div className="flex flex-wrap gap-2">
                    {(recordActiveSeason?.teams || []).map(t => (
                      <span key={t.id} className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] flex items-center gap-2">
                        <img src={t.logo} className="w-4 h-4 object-contain bg-white rounded-full p-0.5" />
                        <span className="text-yellow-500">[{t.tier}]</span> {t.name} <span className="text-slate-500 font-sans not-italic">({t.ownerName})</span>
                      </span>
                    ))}
                    {(recordActiveSeason?.teams || []).length === 0 && <p className="text-xs text-slate-700 py-4">No teams assigned yet.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== VIEW 3: 팀 관리 (전면 개선 및 복구) ==================== */}
        {currentView === 'TEAMS' && (
          <div className="bg-slate-900/60 p-6 rounded-3xl border border-red-500/30 space-y-8 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h3 className="text-red-500 text-xl font-black italic">MASTER TEAM MANAGEMENT</h3>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button onClick={() => setManageTab('CLUB')} className={`px-6 py-1.5 rounded-lg text-xs transition-all ${manageTab === 'CLUB' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>CLUBS</button>
                <button onClick={() => setManageTab('NATIONAL')} className={`px-6 py-1.5 rounded-lg text-xs transition-all ${manageTab === 'NATIONAL' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>NATIONALS</button>
              </div>
            </div>

            {/* 필터 바 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-sans not-italic">
              <select value={manageTier} onChange={e => setManageTier(e.target.value)} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                <option value="ALL">TIER (ALL)</option>
                {['S','A','B','C'].map(t => <option key={t} value={t}>{t} TIER</option>)}
              </select>
              <select value={manageRegion} onChange={e => setManageRegion(e.target.value)} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                <option value="ALL">REGION (ALL)</option>
                {manageRegions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <div className="md:col-span-2 relative">
                <input type="text" value={manageSearch} onChange={e => setManageSearch(e.target.value)} placeholder="SEARCH TEAM NAME..." className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs pl-10 focus:border-red-500 outline-none" />
                <span className="absolute left-4 top-3 text-slate-600">🔍</span>
              </div>
            </div>

            {/* 결과 리스트 */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {manageDisplayTeams.map(mt => (
                <div key={mt.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col items-center gap-3 group hover:border-red-500/50 transition-all cursor-default shadow-md">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center p-2 shadow-inner group-hover:scale-110 transition-transform">
                    <img src={mt.logo} className="w-full h-full object-contain" alt="logo" />
                  </div>
                  <div className="text-center w-full">
                    <p className="text-[11px] h-8 flex items-center justify-center font-black truncate">{mt.name}</p>
                    <div className="flex justify-center gap-1 mt-1">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${mt.tier === 'S' ? 'bg-yellow-500 text-black' : mt.tier === 'A' ? 'bg-slate-300 text-black' : 'bg-slate-800 text-slate-400'}`}>{mt.tier} TIER</span>
                      <span className="text-[8px] px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-500 font-sans not-italic truncate max-w-[60px]">{mt.region}</span>
                    </div>
                  </div>
                </div>
              ))}
              {manageDisplayTeams.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-700 font-sans not-italic">
                  No matching teams found in the database.
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
