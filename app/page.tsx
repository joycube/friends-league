"use client";

import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc } from 'firebase/firestore';

// --- 인터페이스 정의 ---
interface Season { 
  id: number; name: string; type: 'LEAGUE' | 'TOURNAMENT'; isActive: boolean;
  prizes: { total: number; first: number; second: number; third: number; scorer: number; };
}
interface Owner { id: number; nickname: string; docId?: string; }
interface MasterTeam { id?: string; name: string; logo: string; category: 'CLUB' | 'NATIONAL'; region: string; tier: 'S' | 'A' | 'B' | 'C'; }
interface Team { id: number; seasonId: number; name: string; logo: string; ownerName: string; win: number; draw: number; loss: number; points: number; tier: string; }

export default function FootballLeagueApp() {
  const [currentView, setCurrentView] = useState<'RANKING' | 'RECORD' | 'TEAMS'>('RANKING');
  const [recordTab, setRecordTab] = useState<number | 'NEW' | 'OWNER'>('NEW');
  
  // 데이터 상태
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // 시즌 생성 입력
  const [inputSeasonName, setInputSeasonName] = useState('');
  const [inputTotalPrize, setInputTotalPrize] = useState(100000);
  const [prizes, setPrizes] = useState({ first: 50000, second: 30000, third: 10000, scorer: 10000 });

  // 오너 생성 입력
  const [newOwnerName, setNewOwnerName] = useState('');

  // 팀 선택 필터링 상태
  const [selCategory, setSelCategory] = useState<'CLUB' | 'NATIONAL'>('CLUB');
  const [selRegion, setSelRegion] = useState('ALL');
  const [selTier, setSelTier] = useState('ALL');
  const [selTeamId, setSelTeamId] = useState('ALL');
  const [selOwnerId, setSelOwnerId] = useState<number | ''>('');

  // --- 상금 자동 계산 로직 ---
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
    onSnapshot(query(collection(db, "seasons"), orderBy("id", "desc")), (s) => setSeasons(s.docs.map(d => d.data() as Season)));
    onSnapshot(query(collection(db, "users"), orderBy("id", "asc")), (s) => setOwners(s.docs.map(d => ({ ...d.data(), docId: d.id } as Owner))));
    onSnapshot(collection(db, "master_teams"), (s) => setMasterTeams(s.docs.map(d => ({ id: d.id, ...d.data() } as MasterTeam))));
  }, []);

  // --- 기능 함수 ---
  const handleCreateSeason = async () => {
    if (!inputSeasonName) return alert("시즌명을 입력하세요.");
    const id = Date.now();
    await setDoc(doc(db, "seasons", String(id)), { id, name: inputSeasonName, type: 'LEAGUE', isActive: true, prizes: { total: inputTotalPrize, ...prizes } });
    setRecordTab(id); setInputSeasonName('');
  };

  const handleDeleteSeason = async (id: number) => {
    if (confirm("정말 이 시즌을 삭제하시겠습니까?")) {
      await deleteDoc(doc(db, "seasons", String(id)));
      setRecordTab('NEW');
    }
  };

  const handleAddOwner = async () => {
    if (!newOwnerName) return;
    await addDoc(collection(db, "users"), { id: Date.now(), nickname: newOwnerName });
    setNewOwnerName('');
  };

  const handleDeleteOwner = async (docId: string) => {
    if (confirm("오너를 삭제하시겠습니까?")) await deleteDoc(doc(db, "users", docId));
  };

  // --- 팀 선택 로직 (필터링) ---
  const currentSeasonTeams = teams.filter(t => t.seasonId === recordTab);
  const filteredMasterTeams = masterTeams.filter(mt => {
    const isAvailable = !currentSeasonTeams.some(ct => ct.name === mt.name);
    const matchCat = mt.category === selCategory;
    const matchReg = selRegion === 'ALL' || mt.region === selRegion;
    const matchTier = selTier === 'ALL' || mt.tier === selTier;
    return isAvailable && matchCat && matchReg && matchTier;
  });

  const handleRandomDraw = () => {
    if (filteredMasterTeams.length === 0) return alert("조건에 맞는 남은 팀이 없습니다.");
    const rand = filteredMasterTeams[Math.floor(Math.random() * filteredMasterTeams.length)];
    setSelRegion(rand.region);
    setSelTier(rand.tier);
    setSelTeamId(rand.name);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white font-black italic tracking-tighter pb-20">
      {/* 배너 */}
      <div className="w-full h-48 md:h-64 relative border-b border-slate-800">
        <img src="https://www.konami.com/efootball/s/img/main_page_1.png?v=903" className="w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="text-4xl md:text-6xl text-white drop-shadow-lg">eFOOTBALL LEAGUE™</h1>
        </div>
      </div>

      {/* 메인 네비게이션 */}
      <div className="flex justify-center gap-4 my-8">
        {['RANKING', 'RECORD', 'TEAMS'].map(v => (
          <button key={v} onClick={() => setCurrentView(v as any)} className={`px-8 py-2 rounded-full border ${currentView === v ? 'bg-blue-600 border-blue-400' : 'bg-slate-900 border-slate-700'}`}>{v}</button>
        ))}
      </div>

      <main className="max-w-5xl mx-auto px-4">
        {currentView === 'RECORD' && (
          <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto">
              <button onClick={() => setRecordTab('NEW')} className={`px-4 py-2 rounded-t-lg ${recordTab === 'NEW' ? 'bg-emerald-600' : 'bg-slate-800'}`}>시즌 생성</button>
              <button onClick={() => setRecordTab('OWNER')} className={`px-4 py-2 rounded-t-lg ${recordTab === 'OWNER' ? 'bg-purple-600' : 'bg-slate-800'}`}>오너 관리</button>
              {seasons.map(s => (
                <div key={s.id} className="flex shrink-0">
                  <button onClick={() => setRecordTab(s.id)} className={`px-4 py-2 rounded-tl-lg ${recordTab === s.id ? 'bg-blue-600' : 'bg-slate-800'}`}>{s.name}</button>
                  <button onClick={() => handleDeleteSeason(s.id)} className="bg-red-900 px-2 rounded-tr-lg text-[10px]">X</button>
                </div>
              ))}
            </div>

            {recordTab === 'NEW' && (
              <div className="bg-slate-900 p-6 rounded-2xl border border-emerald-500/30 space-y-4">
                <input type="text" value={inputSeasonName} onChange={e => setInputSeasonName(e.target.value)} placeholder="시즌 명칭 (예: 2026 WINTER)" className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-emerald-400 text-xs">총상금 입력 (원)</label>
                    <input type="number" value={inputTotalPrize} onChange={e => setInputTotalPrize(Number(e.target.value))} className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-slate-950 p-2 rounded">1위: {prizes.first.toLocaleString()}</div>
                    <div className="bg-slate-950 p-2 rounded">2위: {prizes.second.toLocaleString()}</div>
                    <div className="bg-slate-950 p-2 rounded">3위: {prizes.third.toLocaleString()}</div>
                    <div className="bg-slate-950 p-2 rounded">득점왕: {prizes.scorer.toLocaleString()}</div>
                  </div>
                </div>
                <button onClick={handleCreateSeason} className="w-full bg-emerald-600 py-4 rounded-xl font-bold">시즌 시작하기</button>
              </div>
            )}

            {recordTab === 'OWNER' && (
              <div className="bg-slate-900 p-6 rounded-2xl space-y-4">
                <div className="flex gap-2">
                  <input type="text" value={newOwnerName} onChange={e => setNewOwnerName(e.target.value)} placeholder="새 오너 이름" className="flex-1 bg-slate-950 p-3 rounded-xl border border-slate-800" />
                  <button onClick={handleAddOwner} className="bg-purple-600 px-6 rounded-xl">추가</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {owners.map(o => (
                    <div key={o.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                      <span>{o.nickname}</span>
                      <button onClick={() => handleDeleteOwner(o.docId!)} className="text-red-500 text-xs">삭제</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {typeof recordTab === 'number' && (
              <div className="bg-slate-900 p-6 rounded-2xl border border-blue-500/30 space-y-6">
                <h3 className="text-blue-400">팀 선택 및 랜덤 추첨</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <select value={selCategory} onChange={e => setSelCategory(e.target.value as any)} className="bg-slate-950 p-2 rounded-lg border border-slate-700 text-xs">
                    <option value="CLUB">클럽</option><option value="NATIONAL">국대</option>
                  </select>
                  <select value={selRegion} onChange={e => setSelRegion(e.target.value)} className="bg-slate-950 p-2 rounded-lg border border-slate-700 text-xs">
                    <option value="ALL">지역/리그 (전체)</option>
                    {Array.from(new Set(masterTeams.filter(m => m.category === selCategory).map(m => m.region))).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <select value={selTier} onChange={e => setSelTier(e.target.value)} className="bg-slate-950 p-2 rounded-lg border border-slate-700 text-xs">
                    <option value="ALL">티어 (전체)</option>
                    {['S','A','B','C'].map(t => <option key={t} value={t}>{t} 티어</option>)}
                  </select>
                  <button onClick={handleRandomDraw} className="bg-slate-800 border border-slate-600 text-xs rounded-lg">🎲 랜덤 선택</button>
                  <select value={selOwnerId} onChange={e => setSelOwnerId(Number(e.target.value))} className="bg-slate-950 p-2 rounded-lg border border-slate-700 text-xs">
                    <option value="">참여 오너 선택</option>
                    {owners.map(o => <option key={o.id} value={o.id}>{o.nickname}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {currentView === 'RANKING' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <section className="bg-slate-900/50 rounded-3xl border border-slate-800 overflow-hidden">
              <div className="p-4 bg-blue-900/20 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-blue-400">STANDING</h2>
              </div>
              <div className="p-6">
                {/* 순위표 렌더링... */}
                <div className="mt-8 pt-8 border-t border-slate-800">
                   <h3 className="text-emerald-400 mb-4">💰 실시간 예상 상금 (Owner Prize)</h3>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-950 p-4 rounded-2xl border border-yellow-600/30">
                        <p className="text-[10px] text-slate-500">CHAMPION</p>
                        <p className="text-xl">JOYCUDE</p>
                        <p className="text-emerald-400 text-sm">{prizes.first.toLocaleString()} ₩</p>
                      </div>
                      {/* ... 추가 상금 목록 */}
                   </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}