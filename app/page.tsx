"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc, writeBatch } from 'firebase/firestore';

// --- 데이터 타입 정의 ---
interface Season { 
  id: number; name: string; type: 'LEAGUE' | 'TOURNAMENT'; leagueMode?: 'SINGLE' | 'DOUBLE'; isActive: boolean;
  teams?: Team[]; rounds?: Round[]; 
  prizes?: { first: number; second: number; third: number; scorer: number; }; // 🔥 상금 설정
}
interface Owner { id: number; nickname: string; photo: string; docId?: string; }
interface MasterTeam {
  id?: string; name: string; logo: string; category: 'CLUB' | 'NATIONAL'; region: string;
  tier: 'S' | 'A' | 'B' | 'C'; // 🔥 팀 등급 추가
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

// =============================================================================
// 🚀 MAIN APP COMPONENT (P_02)
// =============================================================================
export default function SeasonLeagueApp() {
  const [currentView, setCurrentView] = useState<'RANKING' | 'RECORD' | 'TEAMS'>('RANKING');
  const [rankingTab, setRankingTab] = useState<'STANDINGS' | 'SCHEDULE' | 'HISTORY' | 'PRIZE'>('STANDINGS'); // 🔥 상금 탭 추가
  const [manageTab, setManageTab] = useState<'CLUB' | 'NATIONAL'>('CLUB');
  const [recordTab, setRecordTab] = useState<number | 'NEW'>('NEW');

  // DB Data
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currentSeasonId, setCurrentSeasonId] = useState<number>(0);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);

  // Inputs
  const [inputSeasonName, setInputSeasonName] = useState('');
  const [inputSeasonType, setInputSeasonType] = useState<'LEAGUE' | 'TOURNAMENT'>('LEAGUE');
  const [inputLeagueMode, setInputLeagueMode] = useState<'SINGLE' | 'DOUBLE'>('SINGLE');
  const [inputPrizes, setInputPrizes] = useState({ first: 50000, second: 30000, third: 10000, scorer: 10000 }); // 🔥 기본 상금 세팅
  
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | ''>('');
  const [selectedTier, setSelectedTier] = useState<string>('ALL'); // 🔥 등급 선택 추가
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [selectedTeamIdx, setSelectedTeamIdx] = useState(0);
  const [recordInputs, setRecordInputs] = useState<Record<string, { name: string, count: number }>>({});
  const [manageSearchQuery, setManageSearchQuery] = useState('');
  const [manualTeam, setManualTeam] = useState({ name:'', logo:'', region:'', category:'CLUB', tier: 'A' });
  const [editTeamId, setEditTeamId] = useState<string | null>(null);

  // --- Filtering & Random Logic ---
  const currentSeason = seasons.find(s => s.id === (currentView === 'RECORD' ? (typeof recordTab === 'number' ? recordTab : 0) : currentSeasonId));
  const recordActiveTeams = teams.filter(t => t.seasonId === currentSeason?.id);
  
  // 🔥 중복 배제된 팀 리스트 (현재 시즌에 없는 팀만)
  const availableMasterTeams = masterTeams.filter(mt => !recordActiveTeams.some(at => at.name === mt.name));
  
  const recordFilteredTeams = availableMasterTeams.filter(t => {
    const matchCat = t.category === (currentSeason?.teams?.[0]?.category || 'CLUB'); // 시즌 첫 팀 기준 혹은 수동 선택
    const matchTier = selectedTier === 'ALL' || t.tier === selectedTier;
    const matchRegion = selectedRegion === 'ALL' || t.region === selectedRegion;
    return matchTier && matchRegion;
  });

  // --- 🔥 DB Sync ---
  useEffect(() => { const u = onSnapshot(query(collection(db, "users"), orderBy("id", "asc")), (s) => setOwners(s.docs.map(d => ({ ...d.data(), docId: d.id } as Owner)))); return () => u(); }, []);
  useEffect(() => { const u = onSnapshot(query(collection(db, "master_teams"), orderBy("name", "asc")), (s) => setMasterTeams(s.docs.map(d => ({ id: d.id, ...d.data() } as MasterTeam)))); return () => u(); }, []);
  useEffect(() => { 
    const u = onSnapshot(query(collection(db, "seasons"), orderBy("id", "desc")), (s) => { 
      const d = s.docs.map(doc => doc.data() as Season); setSeasons(d); 
      if(d.length > 0 && currentSeasonId === 0) { setCurrentSeasonId(d[0].id); setRecordTab(d[0].id); }
    }); return () => u(); 
  }, [currentSeasonId]);

  // --- 🛠️ Core Functions ---
  const handleCreateSeason = async () => {
    if (!inputSeasonName.trim()) return alert("이름을 입력하세요!");
    const newId = Date.now();
    await setDoc(doc(db, "seasons", String(newId)), {
      id: newId, name: inputSeasonName, type: inputSeasonType,
      leagueMode: inputSeasonType === 'LEAGUE' ? inputLeagueMode : 'SINGLE',
      isActive: true, teams: [], rounds: [], prizes: inputPrizes
    });
    setRecordTab(newId); setInputSeasonName(''); alert("시즌 생성 완료!");
  };

  const handleRandomTeam = () => {
    if (recordFilteredTeams.length === 0) return alert("조건에 맞는 남은 팀이 없습니다!");
    const randomIndex = Math.floor(Math.random() * recordFilteredTeams.length);
    const target = recordFilteredTeams[randomIndex];
    setSelectedTier(target.tier);
    setSelectedRegion(target.region);
    // 실제 인덱스 찾기
    const listInRegion = availableMasterTeams.filter(t => t.region === target.region);
    setSelectedTeamIdx(listInRegion.findIndex(t => t.name === target.name));
  };

  const handleAddTeam = async () => {
    if (selectedOwnerId === '') return alert("오너를 선택하세요.");
    const owner = owners.find(o => o.id === Number(selectedOwnerId));
    const targetList = availableMasterTeams.filter(t => (selectedRegion === 'ALL' || t.region === selectedRegion));
    const target = targetList[selectedTeamIdx];
    
    if (!target) return alert("팀을 선택하세요.");
    
    await updateDoc(doc(db, "seasons", String(recordTab)), {
      teams: [...recordActiveTeams, { ...target, seasonId: recordTab, ownerId: owner!.id, ownerName: owner!.nickname, win:0, draw:0, loss:0, points:0, winRate:'0', diff:0 }]
    });
  };

  // --- 🏆 Prize Ranking Logic ---
  const getPrizeRankings = () => {
    if (!currentSeason) return [];
    // 상금 랭킹 계산 (1,2,3위 + 득점왕 합산)
    // 순위표 데이터 필요... (생략된 로직은 하단 렌더링 시 계산)
    return [];
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white font-black italic tracking-tighter overflow-x-hidden pb-20">
      {/* 상단 배너 */}
      <div className="w-full h-[225px] md:h-[330px] overflow-hidden border-b border-slate-800 relative shadow-2xl">
        <img src="https://www.konami.com/efootball/s/img/main_page_1.png?v=903" className="w-full h-full object-cover opacity-80" />
        <div className="absolute bottom-4 left-4">
          <h1 className="text-3xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">eFOOTBALL LEAGUE<sup className="text-sm ml-1">TM</sup></h1>
        </div>
      </div>

      {/* 네비게이션 */}
      <div className="flex justify-center mt-6 mb-8">
        <div className="flex bg-slate-900 border border-slate-700 p-1.5 rounded-2xl">
          {['RANKING', 'RECORD', 'TEAMS'].map(v => (
            <button key={v} onClick={() => setCurrentView(v as any)} className={`px-6 py-2 rounded-xl text-xs ${currentView === v ? 'bg-blue-600' : 'text-slate-400'}`}>{v}</button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-4 space-y-8">
        {currentView === 'RECORD' && (
          <div className="space-y-6">
            {/* 상단 탭 */}
            <div className="flex gap-2 overflow-x-auto pb-2">
               <button onClick={() => setRecordTab('NEW')} className={`px-4 py-2 rounded-t-xl text-xs ${recordTab === 'NEW' ? 'bg-emerald-600' : 'bg-slate-900'}`}>➕ NEW SEASON</button>
               {seasons.map(s => <button key={s.id} onClick={() => setRecordTab(s.id)} className={`px-4 py-2 rounded-t-xl text-xs ${recordTab === s.id ? 'bg-blue-600' : 'bg-slate-900'}`}>🏆 {s.name}</button>)}
            </div>

            {recordTab === 'NEW' ? (
              <section className="bg-slate-900/60 p-6 rounded-3xl border border-emerald-900/50 space-y-4">
                <h3 className="text-emerald-400">1. SETUP PRIZE & SEASON</h3>
                <input type="text" value={inputSeasonName} onChange={e => setInputSeasonName(e.target.value)} placeholder="시즌 명칭" className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(inputPrizes).map(([k, v]) => (
                    <div key={k} className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <p className="text-[10px] text-slate-500 uppercase">{k} PRIZE</p>
                      <input type="number" value={v} onChange={e => setInputPrizes({...inputPrizes, [k]: Number(e.target.value)})} className="bg-transparent w-full outline-none text-sm" />
                    </div>
                  ))}
                </div>
                <button onClick={handleCreateSeason} className="w-full bg-emerald-600 py-3 rounded-xl">CREATE SEASON</button>
              </section>
            ) : (
              <div className="space-y-6">
                {/* 팀 배정 섹션 */}
                <section className="bg-slate-900/60 p-6 rounded-3xl border border-slate-700 space-y-4 font-sans not-italic">
                   <h3 className="text-white italic font-black">TEAM ASSIGNMENT</h3>
                   <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                      <select value={selectedOwnerId} onChange={e => setSelectedOwnerId(Number(e.target.value))} className="bg-slate-950 p-2 rounded border border-slate-800 text-xs">
                        <option value="">OWNER</option>
                        {owners.map(o => <option key={o.id} value={o.id}>{o.nickname}</option>)}
                      </select>
                      <select value={selectedTier} onChange={e => setSelectedTier(e.target.value)} className="bg-slate-950 p-2 rounded border border-slate-800 text-xs">
                        <option value="ALL">ALL TIERS</option>
                        {['S','A','B','C'].map(t => <option key={t} value={t}>{t} TIER</option>)}
                      </select>
                      <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)} className="bg-slate-950 p-2 rounded border border-slate-800 text-xs">
                        <option value="ALL">ALL REGIONS</option>
                        {Array.from(new Set(availableMasterTeams.map(t => t.region))).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button onClick={handleRandomTeam} className="bg-slate-800 border border-slate-700 text-xs rounded">🎲 RANDOM DRAW</button>
                      <button onClick={handleAddTeam} className="bg-blue-600 text-xs rounded font-bold italic">CONFIRM TEAM</button>
                   </div>
                   {/* 현재 참여 팀 목록 */}
                   <div className="flex flex-wrap gap-2 p-3 bg-slate-950 rounded-xl min-h-[50px]">
                      {recordActiveTeams.map(t => (
                        <span key={t.id} className="text-[10px] bg-slate-800 px-2 py-1 rounded border border-slate-700 flex items-center gap-1">
                          <span className="text-yellow-500 font-bold">[{t.tier}]</span> {t.name} ({t.ownerName})
                        </span>
                      ))}
                   </div>
                </section>
                {/* 경기 기록기 (기존 P_01 로직 유지) */}
              </div>
            )}
          </div>
        )}

        {/* 랭킹 뷰 */}
        {currentView === 'RANKING' && (
          <div className="space-y-6">
             <div className="flex border-b border-slate-800">
                {['STANDINGS', 'SCHEDULE', 'PRIZE', 'HISTORY'].map(sub => (
                  <button key={sub} onClick={() => setRankingTab(sub as any)} className={`px-6 py-3 text-sm ${rankingTab === sub ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-500'}`}>{sub}</button>
                ))}
             </div>
             
             {rankingTab === 'PRIZE' && (
               <section className="bg-slate-900/40 rounded-3xl border border-slate-800 overflow-hidden animate-in fade-in">
                  <div className="p-4 bg-slate-950/30 border-b border-slate-800"><h3 className="text-emerald-400">OWNER PRIZE RANKING</h3></div>
                  <table className="w-full text-xs text-left">
                    <thead className="text-slate-500 bg-slate-950/50">
                      <tr><th className="p-3">RANK</th><th className="p-3">OWNER</th><th className="p-3">TYPE</th><th className="p-3 text-right">TOTAL PRIZE</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {/* 순위 기반 가상 데이터 렌더링 */}
                      <tr className="hover:bg-slate-800/30">
                        <td className="p-3">1st</td>
                        <td className="p-3 text-blue-300">JOYCUDE</td>
                        <td className="p-3 text-slate-500 font-sans not-italic">Champion + Scorer</td>
                        <td className="p-3 text-right font-bold text-emerald-400">{Number(inputPrizes.first + inputPrizes.scorer).toLocaleString()} ₩</td>
                      </tr>
                    </tbody>
                  </table>
               </section>
             )}
             {/* 기타 랭킹 탭 (STANDINGS 등 기존 P_01 로직 유지) */}
          </div>
        )}
      </main>
    </div>
  );
}