"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc, writeBatch } from 'firebase/firestore';

// -----------------------------------------------------------------------------
// 📢 [설정] 배너 이미지 및 레이아웃 설정
// -----------------------------------------------------------------------------
const RANKING_BANNER_IMG = "https://www.konami.com/efootball/s/img/main_page_1.png?v=903"; 

// --- 데이터 타입 정의 ---
interface Season { 
  id: number; name: string; type: 'LEAGUE' | 'TOURNAMENT'; leagueMode?: 'SINGLE' | 'DOUBLE'; isActive: boolean;
  teams?: Team[]; rounds?: Round[]; 
  prizes: { total: number; first: number; second: number; third: number; scorer: number; };
}
interface Owner { id: number; nickname: string; photo: string; docId?: string; }
interface MasterTeam {
  id?: string; name: string; logo: string; category: 'CLUB' | 'NATIONAL'; region: string;
  tier: 'S' | 'A' | 'B' | 'C';
}
interface Team {
  id: number; seasonId: number; name: string; logo: string; category: 'CLUB' | 'NATIONAL'; region: string;
  ownerId: number; ownerName: string; win: number; draw: number; loss: number; points: number; winRate: string; diff: number;
  tier: string;
}
interface MatchRecord { id: number; name: string; count: number; teamLogo?: string; }
interface Match {
  id: string; seasonId: number; home: string; away: string; homeLogo: string; awayLogo: string;
  homeOwner: string; awayOwner: string; homeScore: string; awayScore: string;
  homeScorers: MatchRecord[]; awayScorers: MatchRecord[]; homeAssists: MatchRecord[]; awayAssists: MatchRecord[];
  status: 'UPCOMING' | 'FINISHED' | 'BYE'; youtubeUrl: string; stage?: string;
}
interface PlayerStat { name: string; count: number; ownerName: string; teamLogo?: string; } 
interface Round { round: number; matches: Match[]; seasonId: number; name?: string; }

// --- Helper Functions ---
const getYoutubeId = (url: string) => {
  if (!url) return null;
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return (match && match[2].length === 11) ? match[2] : null;
};

const getStageName = (teamCount: number) => {
  if (teamCount === 2) return "🏆 FINAL (결승)";
  if (teamCount === 4) return "SEMI-FINALS (4강)";
  if (teamCount === 8) return "QUARTER-FINALS (8강)";
  if (teamCount === 16) return "ROUND OF 16 (16강)";
  return `ROUND OF ${teamCount}`;
};

// --- [공통 컴포넌트] 기록 입력기 ---
const RecordInput = React.memo(({ rIdx, mIdx, type, label, inputValue, onInputChange, onAdd, onRemove, records }: any) => {
  const increment = () => onInputChange(rIdx, mIdx, type, 'count', String(Number(inputValue.count) + 1));
  const decrement = () => onInputChange(rIdx, mIdx, type, 'count', String(Math.max(0, Number(inputValue.count) - 1)));
  const safeRecords = records || []; 

  return (
    <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800 h-full flex flex-col justify-between">
      <p className="text-[10px] text-slate-500 mb-1.5 font-bold uppercase tracking-wider text-center">{label}</p>
      <div className="flex gap-1 mb-2">
        <input type="text" value={inputValue.name} onChange={(e) => onInputChange(rIdx, mIdx, type, 'name', e.target.value)} placeholder="이름" className="flex-1 w-full bg-slate-950 border border-slate-700 text-white text-[11px] p-1.5 rounded focus:border-blue-500 outline-none min-w-0" />
        <div className="flex items-center">
          <button onClick={decrement} className="hidden md:flex w-6 h-full items-center justify-center bg-slate-800 text-slate-400 hover:bg-slate-700 rounded-l border border-slate-700 text-xs">-</button>
          <input type="number" min="0" value={inputValue.count} onChange={(e) => onInputChange(rIdx, mIdx, type, 'count', e.target.value)} className="w-8 md:w-10 bg-slate-950 border border-slate-700 text-white text-[11px] p-1.5 rounded md:rounded-none text-center focus:border-blue-500 outline-none shrink-0" />
          <button onClick={increment} className="hidden md:flex w-6 h-full items-center justify-center bg-slate-800 text-slate-400 hover:bg-slate-700 rounded-r border border-slate-700 text-xs">+</button>
        </div>
        <button onClick={() => onAdd(rIdx, mIdx, type, inputValue.name, inputValue.count)} className="bg-blue-600 text-white text-[10px] px-2.5 rounded hover:bg-blue-500 font-bold shrink-0 shadow-lg">+</button>
      </div>
      <div className="flex flex-wrap gap-1 content-start min-h-[20px]">
        {safeRecords.map((r:any) => (
          <span key={r.id} className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-full flex items-center gap-1 border border-slate-700">
            {r.teamLogo && <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center bg-white">{r.teamLogo.includes('http') ? <img src={r.teamLogo} className="w-full h-full object-cover" alt="" /> : <span className="text-[9px]">{r.teamLogo}</span>}</div>}
            <span className="truncate max-w-[60px]">{r.name}</span><span className="text-yellow-500 font-bold">{r.count}</span>
            <button onClick={() => onRemove(rIdx, mIdx, type, r.id)} className="text-red-400 hover:text-red-300 font-bold ml-0.5 text-xs">×</button>
          </span>
        ))}
      </div>
    </div>
  );
});
RecordInput.displayName = "RecordInput";

// =============================================================================
// 🚀 MAIN APP COMPONENT
// =============================================================================
export default function SeasonLeagueApp() {
  const [currentView, setCurrentView] = useState<'RANKING' | 'RECORD' | 'TEAMS'>('RANKING');
  const [rankingTab, setRankingTab] = useState<'STANDINGS' | 'SCHEDULE' | 'HISTORY' | 'PRIZE'>('STANDINGS');
  const [recordTab, setRecordTab] = useState<number | 'NEW' | 'OWNER'>(0);

  // DB Data
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currentSeasonId, setCurrentSeasonId] = useState<number>(0);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);

  // 시즌 생성 Inputs
  const [inputSeasonName, setInputSeasonName] = useState('');
  const [inputSeasonType, setInputSeasonType] = useState<'LEAGUE' | 'TOURNAMENT'>('LEAGUE');
  const [inputLeagueMode, setInputLeagueMode] = useState<'SINGLE' | 'DOUBLE'>('SINGLE');
  const [inputTotalPrize, setInputTotalPrize] = useState(100000);
  const [prizes, setPrizes] = useState({ first: 50000, second: 30000, third: 10000, scorer: 10000 });

  // 오너 관리 Inputs
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPhoto, setNewOwnerPhoto] = useState('');

  // 팀 선택 필터
  const [selCategory, setSelCategory] = useState<'CLUB' | 'NATIONAL'>('CLUB');
  const [selRegion, setSelRegion] = useState('ALL');
  const [selTier, setSelTier] = useState('ALL');
  const [selOwnerId, setSelOwnerId] = useState<number | ''>('');
  const [recordInputs, setRecordInputs] = useState<Record<string, { name: string, count: number }>>({});

  // --- 상금 자동 계산 ---
  useEffect(() => {
    setPrizes({
      first: Math.floor(inputTotalPrize * 0.5),
      second: Math.floor(inputTotalPrize * 0.3),
      third: Math.floor(inputTotalPrize * 0.1),
      scorer: Math.floor(inputTotalPrize * 0.1),
    });
  }, [inputTotalPrize]);

  // --- DB 실시간 동기화 ---
  useEffect(() => {
    onSnapshot(query(collection(db, "users"), orderBy("id", "asc")), (s) => setOwners(s.docs.map(d => ({ ...d.data(), docId: d.id } as Owner))));
    onSnapshot(collection(db, "master_teams"), (s) => setMasterTeams(s.docs.map(d => ({ id: d.id, ...d.data() } as MasterTeam))));
    onSnapshot(query(collection(db, "seasons"), orderBy("id", "desc")), (s) => {
      const data = s.docs.map(d => d.data() as Season);
      setSeasons(data);
      if (data.length > 0 && currentSeasonId === 0) {
        setCurrentSeasonId(data[0].id);
        setRecordTab(data[0].id);
      }
    });
  }, [currentSeasonId]);

  useEffect(() => {
    const targetId = currentView === 'RECORD' && typeof recordTab === 'number' ? recordTab : currentSeasonId;
    if (!targetId) return;
    const u = onSnapshot(doc(db, "seasons", String(targetId)), (s) => {
      if (s.exists()) {
        const d = s.data();
        if (d.teams) setTeams(d.teams);
        if (d.rounds) setRounds(d.rounds);
      }
    });
    return () => u();
  }, [currentSeasonId, recordTab, currentView]);

  // --- 기능 함수들 ---
  const handleAddOwner = async () => {
    if (!newOwnerName.trim()) return alert("닉네임을 입력하세요.");
    const photo = newOwnerPhoto.trim() || `https://api.dicebear.com/7.x/adventurer/svg?seed=${newOwnerName}`;
    await addDoc(collection(db, "users"), { id: Date.now(), nickname: newOwnerName, photo });
    setNewOwnerName(''); setNewOwnerPhoto('');
  };

  const handleDeleteOwner = async (docId: string) => {
    if (confirm("이 오너를 삭제하시겠습니까?")) await deleteDoc(doc(db, "users", docId));
  };

  const handleCreateSeason = async () => {
    if (!inputSeasonName.trim()) return alert("시즌명을 입력하세요.");
    const id = Date.now();
    await setDoc(doc(db, "seasons", String(id)), {
      id, name: inputSeasonName, type: inputSeasonType,
      leagueMode: inputSeasonType === 'LEAGUE' ? inputLeagueMode : 'SINGLE',
      isActive: true, teams: [], rounds: [],
      prizes: { total: inputTotalPrize, ...prizes }
    });
    setRecordTab(id); setInputSeasonName('');
  };

  const handleDeleteSeason = async (id: number) => {
    if (confirm("⚠️ 이 시즌을 영구적으로 삭제하시겠습니까?")) {
      await deleteDoc(doc(db, "seasons", String(id)));
      setRecordTab('NEW');
    }
  };

  // --- 팀 선택 & 랜덤 로직 ---
  const availableTeams = masterTeams.filter(mt => {
    const isTaken = teams.some(t => t.name === mt.name);
    const matchCat = mt.category === selCategory;
    const matchReg = selRegion === 'ALL' || mt.region === selRegion;
    const matchTier = selTier === 'ALL' || mt.tier === selTier;
    return !isTaken && matchCat && matchReg && matchTier;
  });

  const handleRandomDraw = () => {
    if (availableTeams.length === 0) return alert("조건에 맞는 팀이 없습니다.");
    const rand = availableTeams[Math.floor(Math.random() * availableTeams.length)];
    setSelRegion(rand.region); setSelTier(rand.tier); // UI 업데이트를 위해 필터 변경
    // 이후 등록 로직은 대표님께서 직접 '팀 확정' 버튼을 누르는 흐름으로 유지하거나 자동 등록 가능
    alert(`추첨 결과: [${rand.tier}티어] ${rand.name}입니다!`);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white font-black italic tracking-tighter overflow-x-hidden pb-20">
      
      {/* 1. 상단 배너 */}
      <div className="w-full max-w-6xl mx-auto">
        <div className="w-full h-[225px] md:h-[330px] overflow-hidden border-b border-slate-800 relative shadow-2xl">
          <img src={RANKING_BANNER_IMG} className="w-full h-full object-cover opacity-80" alt="Banner" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent"></div>
          <div className="absolute bottom-4 left-4">
            <h1 className="text-3xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">eFOOTBALL LEAGUE<sup className="text-sm align-top ml-1">TM</sup></h1>
            <p className="text-emerald-400 text-sm tracking-widest font-sans not-italic">Official Community Manager</p>
          </div>
        </div>
      </div>

      {/* 2. 메인 탭 */}
      <div className="flex justify-center mt-6 mb-8">
        <div className="flex bg-slate-900 border border-slate-700 p-1.5 rounded-2xl shadow-xl">
          {[{ id: 'RANKING', label: '🏆 랭킹' }, { id: 'RECORD', label: '📝 기록실' }, { id: 'TEAMS', label: '⚙️ 팀 관리' }].map((tab) => (
            <button key={tab.id} onClick={() => setCurrentView(tab.id as any)} className={`px-6 py-2 rounded-xl text-xs transition-all ${currentView === tab.id ? `bg-blue-600 text-white shadow-lg scale-105` : 'text-slate-400 hover:text-white'}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* -------------------- VIEW 1: RANKING -------------------- */}
        {currentView === 'RANKING' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="flex justify-end">
              {rankingTab !== 'HISTORY' && (
                <select value={currentSeasonId} onChange={(e) => setCurrentSeasonId(Number(e.target.value))} className="bg-slate-900 text-white border border-slate-700 rounded-lg p-2 text-xs">
                  {seasons.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
                </select>
              )}
            </div>
            <div className="flex border-b border-slate-800">
              {['STANDINGS', 'SCHEDULE', 'PRIZE', 'HISTORY'].map(sub => (
                <button key={sub} onClick={() => setRankingTab(sub as any)} className={`px-6 py-3 text-sm border-b-2 transition-colors ${rankingTab === sub ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-600'}`}>{sub}</button>
              ))}
            </div>
            {/* 랭킹 상세 탭별 내용은 데이터가 있을 때 출력됨 */}
          </div>
        )}

        {/* -------------------- VIEW 2: RECORD (기능 복구 핵심) -------------------- */}
        {currentView === 'RECORD' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* 시즌 이동 콤보박스 관리 */}
            <div className="flex flex-col md:flex-row gap-4 bg-slate-900/80 p-5 rounded-3xl border border-slate-800 shadow-xl">
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 mb-1.5 block font-bold">MANAGE SELECTOR</label>
                <select 
                  value={recordTab} 
                  onChange={(e) => setRecordTab(e.target.value === 'NEW' || e.target.value === 'OWNER' ? e.target.value : Number(e.target.value))}
                  className="w-full bg-slate-950 p-3.5 rounded-xl border border-slate-700 text-sm font-sans not-italic"
                >
                  <optgroup label="SYSTEM">
                    <option value="NEW">➕ CREATE NEW SEASON</option>
                    <option value="OWNER">👤 MANAGE OWNERS</option>
                  </optgroup>
                  <optgroup label="SEASONS">
                    {seasons.map(s => <option key={s.id} value={s.id}>🏆 {s.name} ({s.type})</option>)}
                  </optgroup>
                </select>
              </div>
              {typeof recordTab === 'number' && (
                <button onClick={() => handleDeleteSeason(Number(recordTab))} className="bg-red-900/20 text-red-500 border border-red-900/50 px-6 rounded-xl text-xs font-bold hover:bg-red-900 hover:text-white transition-all">DELETE SEASON</button>
              )}
            </div>

            {/* A. 오너 관리 섹션 (복구) */}
            {recordTab === 'OWNER' && (
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-purple-500/30 space-y-6">
                <h3 className="text-purple-400 text-lg">OWNER REGISTRATION</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans not-italic">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500 ml-2">NICKNAME</p>
                    <input type="text" value={newOwnerName} onChange={e => setNewOwnerName(e.target.value)} placeholder="닉네임 입력" className="w-full bg-slate-950 p-3.5 rounded-xl border border-slate-800" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500 ml-2">PROFILE PHOTO URL (OPTIONAL)</p>
                    <input type="text" value={newOwnerPhoto} onChange={e => setNewOwnerPhoto(e.target.value)} placeholder="이미지 주소 붙여넣기" className="w-full bg-slate-950 p-3.5 rounded-xl border border-slate-800" />
                  </div>
                </div>
                <button onClick={handleAddOwner} className="w-full bg-purple-600 py-4 rounded-xl font-bold shadow-lg hover:bg-purple-500 transition-colors">REGISTER OWNER</button>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                  {owners.map(o => (
                    <div key={o.id} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-4 relative group">
                      <img src={o.photo} className="w-12 h-12 rounded-full border-2 border-slate-700 bg-slate-800" alt="profile" />
                      <span className="text-sm truncate">{o.nickname}</span>
                      <button onClick={() => handleDeleteOwner(o.docId!)} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* B. 신규 시즌 생성 (기능 복구) */}
            {recordTab === 'NEW' && (
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-emerald-500/30 space-y-6">
                <h3 className="text-emerald-400 text-lg">CREATE NEW SEASON</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans not-italic">
                  <div className="space-y-4">
                    <input type="text" value={inputSeasonName} onChange={e => setInputSeasonName(e.target.value)} placeholder="시즌 명칭" className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800" />
                    <div className="flex gap-2">
                      <select value={inputSeasonType} onChange={e => setInputSeasonType(e.target.value as any)} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex-1">
                        <option value="LEAGUE">LEAGUE MODE</option><option value="TOURNAMENT">TOURNAMENT MODE</option>
                      </select>
                      {inputSeasonType === 'LEAGUE' && (
                        <select value={inputLeagueMode} onChange={e => setInputLeagueMode(e.target.value as any)} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex-1">
                          <option value="SINGLE">SINGLE ROUND</option><option value="DOUBLE">HOME & AWAY</option>
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
                    <p className="text-xs text-emerald-500 font-bold uppercase">Prize Pool Setting</p>
                    <input type="number" value={inputTotalPrize} onChange={e => setInputTotalPrize(Number(e.target.value))} className="w-full bg-slate-900 p-2 rounded border border-slate-700 text-sm" />
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                      <div>1ST: {prizes.first.toLocaleString()}</div><div>2ND: {prizes.second.toLocaleString()}</div>
                      <div>3RD: {prizes.third.toLocaleString()}</div><div>SCORER: {prizes.scorer.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
                <button onClick={handleCreateSeason} className="w-full bg-emerald-600 py-4 rounded-xl font-bold shadow-lg">LAUNCH SEASON</button>
              </div>
            )}

            {/* C. 팀 배정 & 랜덤 (복구) */}
            {typeof recordTab === 'number' && (
              <div className="bg-slate-900/60 p-6 rounded-3xl border border-blue-500/30 space-y-6">
                <h3 className="text-blue-400">ASSIGN TEAMS TO SEASON</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-sans not-italic">
                  <select value={selCategory} onChange={e => setSelCategory(e.target.value as any)} className="bg-slate-950 p-3 rounded-xl border border-slate-700 text-xs text-white">
                    <option value="CLUB">CLUB</option><option value="NATIONAL">NATIONAL</option>
                  </select>
                  <select value={selRegion} onChange={e => setSelRegion(e.target.value)} className="bg-slate-950 p-3 rounded-xl border border-slate-700 text-xs text-white">
                    <option value="ALL">REGION (ALL)</option>
                    {Array.from(new Set(masterTeams.filter(m => m.category === selCategory).map(m => m.region))).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <select value={selTier} onChange={e => setSelTier(e.target.value as any)} className="bg-slate-950 p-3 rounded-xl border border-slate-700 text-xs text-white">
                    <option value="ALL">TIER (ALL)</option>
                    {['S','A','B','C'].map(t => <option key={t} value={t}>{t} TIER</option>)}
                  </select>
                  <button onClick={handleRandomDraw} className="bg-slate-800 border border-slate-600 rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors">🎲 RANDOM</button>
                  <select value={selOwnerId} onChange={e => setSelOwnerId(Number(e.target.value))} className="bg-slate-950 p-3 rounded-xl border border-slate-700 text-xs text-white">
                    <option value="">SELECT OWNER</option>
                    {owners.map(o => <option key={o.id} value={o.id}>{o.nickname}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------- VIEW 3: TEAMS (데이터 복구) -------------------- */}
        {currentView === 'TEAMS' && (
          <div className="bg-slate-900/60 p-8 rounded-3xl border border-red-500/30 space-y-8 animate-in fade-in">
            <h3 className="text-red-500 text-xl font-black">MASTER TEAM DATABASE</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {masterTeams.map(mt => (
                <div key={mt.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col items-center gap-3 hover:border-red-500/50 transition-all">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center p-2 shadow-inner">
                    <img src={mt.logo} className="w-full h-full object-contain" alt="logo" />
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] h-8 flex items-center justify-center">{mt.name}</p>
                    <p className="text-[9px] text-slate-500 mt-1 font-sans not-italic uppercase tracking-tighter">{mt.region} • {mt.tier} TIER</p>
                  </div>
                </div>
              ))}
              {masterTeams.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-600 font-sans not-italic">
                  <p>데이터베이스가 비어 있습니다.</p>
                  <p className="text-xs mt-2">팀 관리 탭의 엑셀 업로드를 통해 팀을 등록해 주세요.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}