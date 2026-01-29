"use client";

import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc } from 'firebase/firestore';

// --- 인터페이스 ---
interface Season { 
  id: number; name: string; type: 'LEAGUE' | 'TOURNAMENT'; leagueMode?: 'SINGLE' | 'DOUBLE'; isActive: boolean;
  prizes: { total: number; first: number; second: number; third: number; scorer: number; };
}
interface Owner { id: number; nickname: string; photo: string; docId?: string; }
interface MasterTeam { id?: string; name: string; logo: string; category: 'CLUB' | 'NATIONAL'; region: string; tier: 'S' | 'A' | 'B' | 'C'; }
interface Team { id: number; seasonId: number; name: string; logo: string; ownerName: string; win: number; draw: number; loss: number; points: number; tier: string; }

export default function FootballLeagueApp() {
  const [currentView, setCurrentView] = useState<'RANKING' | 'RECORD' | 'TEAMS'>('RANKING');
  const [recordTab, setRecordTab] = useState<number | 'NEW' | 'OWNER'>(0);
  
  // 데이터 상태
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // 시즌 생성 입력
  const [inputSeasonName, setInputSeasonName] = useState('');
  const [inputSeasonType, setInputSeasonType] = useState<'LEAGUE' | 'TOURNAMENT'>('LEAGUE');
  const [inputLeagueMode, setInputLeagueMode] = useState<'SINGLE' | 'DOUBLE'>('SINGLE');
  const [inputTotalPrize, setInputTotalPrize] = useState(100000);
  const [prizes, setPrizes] = useState({ first: 50000, second: 30000, third: 10000, scorer: 10000 });

  // 오너 생성 입력
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPhoto, setNewOwnerPhoto] = useState('');

  // 필터링 상태
  const [selCategory, setSelCategory] = useState<'CLUB' | 'NATIONAL'>('CLUB');
  const [selRegion, setSelRegion] = useState('ALL');
  const [selTier, setSelTier] = useState('ALL');
  const [selTeamId, setSelTeamId] = useState('ALL');
  const [selOwnerId, setSelOwnerId] = useState<number | ''>('');

  // --- 상금 자동 계산 ---
  useEffect(() => {
    setPrizes({
      first: Math.floor(inputTotalPrize * 0.5), second: Math.floor(inputTotalPrize * 0.3),
      third: Math.floor(inputTotalPrize * 0.1), scorer: Math.floor(inputTotalPrize * 0.1),
    });
  }, [inputTotalPrize]);

  // --- DB 동기화 ---
  useEffect(() => {
    onSnapshot(query(collection(db, "seasons"), orderBy("id", "desc")), (s) => {
      const data = s.docs.map(d => d.data() as Season);
      setSeasons(data);
      if (data.length > 0 && recordTab === 0) setRecordTab(data[0].id);
    });
    onSnapshot(query(collection(db, "users"), orderBy("id", "asc")), (s) => setOwners(s.docs.map(d => ({ ...d.data(), docId: d.id } as Owner))));
    onSnapshot(collection(db, "master_teams"), (s) => setMasterTeams(s.docs.map(d => ({ id: d.id, ...d.data() } as MasterTeam))));
  }, []);

  // --- 오너 관리 ---
  const handleAddOwner = async () => {
    if (!newOwnerName) return;
    const photo = newOwnerPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${newOwnerName}`;
    await addDoc(collection(db, "users"), { id: Date.now(), nickname: newOwnerName, photo });
    setNewOwnerName(''); setNewOwnerPhoto('');
  };

  // --- 시즌 생성 ---
  const handleCreateSeason = async () => {
    if (!inputSeasonName) return alert("시즌명을 입력하세요.");
    const id = Date.now();
    await setDoc(doc(db, "seasons", String(id)), { 
      id, name: inputSeasonName, type: inputSeasonType, 
      leagueMode: inputSeasonType === 'LEAGUE' ? inputLeagueMode : null,
      isActive: true, prizes: { total: inputTotalPrize, ...prizes } 
    });
    setRecordTab(id); setInputSeasonName('');
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white font-black italic tracking-tighter pb-20">
      {/* 배너 */}
      <div className="w-full h-[225px] md:h-[330px] relative border-b border-slate-800">
        <img src="https://www.konami.com/efootball/s/img/main_page_1.png?v=903" className="w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <h1 className="text-4xl md:text-6xl text-white drop-shadow-lg">eFOOTBALL LEAGUE™</h1>
          <p className="text-emerald-400 text-sm mt-2 font-sans not-italic">Official Community Manager</p>
        </div>
      </div>

      {/* 네비게이션 */}
      <div className="flex justify-center gap-4 my-8">
        {['RANKING', 'RECORD', 'TEAMS'].map(v => (
          <button key={v} onClick={() => setCurrentView(v as any)} className={`px-8 py-2 rounded-full border transition-all ${currentView === v ? 'bg-blue-600 border-blue-400 scale-105 shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>{v}</button>
        ))}
      </div>

      <main className="max-w-5xl mx-auto px-4">
        {currentView === 'RECORD' && (
          <div className="space-y-6">
            {/* 개선된 시즌 선택 (콤보박스) */}
            <div className="flex flex-col md:flex-row gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 mb-1 block">SELECT SEASON OR MANAGE</label>
                <select 
                  value={recordTab} 
                  onChange={(e) => setRecordTab(e.target.value === 'NEW' || e.target.value === 'OWNER' ? e.target.value : Number(e.target.value))}
                  className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 text-sm"
                >
                  <optgroup label="System">
                    <option value="NEW">➕ CREATE NEW SEASON</option>
                    <option value="OWNER">👤 MANAGE OWNERS</option>
                  </optgroup>
                  <optgroup label="Existing Seasons">
                    {seasons.map(s => <option key={s.id} value={s.id}>🏆 {s.name} ({s.type})</option>)}
                  </optgroup>
                </select>
              </div>
              {typeof recordTab === 'number' && (
                <button onClick={() => {if(confirm("시즌을 삭제하시겠습니까?")) deleteDoc(doc(db,"seasons",String(recordTab)))}} className="bg-red-900/30 text-red-500 border border-red-900/50 px-4 rounded-xl text-xs hover:bg-red-900 hover:text-white transition-all">DELETE SEASON</button>
              )}
            </div>

            {/* 오너 관리 섹션 */}
            {recordTab === 'OWNER' && (
              <div className="bg-slate-900 p-6 rounded-2xl border border-purple-500/30 space-y-4 animate-in fade-in">
                <h3 className="text-purple-400">OWNER REGISTRATION</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input type="text" value={newOwnerName} onChange={e => setNewOwnerName(e.target.value)} placeholder="NICKNAME" className="bg-slate-950 p-3 rounded-xl border border-slate-800" />
                  <input type="text" value={newOwnerPhoto} onChange={e => setNewOwnerPhoto(e.target.value)} placeholder="PHOTO URL (OPTIONAL)" className="bg-slate-950 p-3 rounded-xl border border-slate-800" />
                </div>
                <button onClick={handleAddOwner} className="w-full bg-purple-600 py-3 rounded-xl font-bold">ADD OWNER</button>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  {owners.map(o => (
                    <div key={o.id} className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center gap-3">
                      <img src={o.photo} className="w-10 h-10 rounded-full border border-slate-700" />
                      <span className="text-xs truncate">{o.nickname}</span>
                      <button onClick={() => deleteDoc(doc(db,"users",o.docId!))} className="ml-auto text-red-500 px-2">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 시즌 생성 섹션 (기능 복구) */}
            {recordTab === 'NEW' && (
              <div className="bg-slate-900 p-6 rounded-2xl border border-emerald-500/30 space-y-4 animate-in fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" value={inputSeasonName} onChange={e => setInputSeasonName(e.target.value)} placeholder="SEASON NAME" className="bg-slate-950 p-3 rounded-xl border border-slate-800" />
                  <div className="flex gap-2">
                    <select value={inputSeasonType} onChange={e => setInputSeasonType(e.target.value as any)} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex-1">
                      <option value="LEAGUE">LEAGUE</option><option value="TOURNAMENT">TOURNAMENT</option>
                    </select>
                    {inputSeasonType === 'LEAGUE' && (
                      <select value={inputLeagueMode} onChange={e => setInputLeagueMode(e.target.value as any)} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex-1">
                        <option value="SINGLE">SINGLE</option><option value="DOUBLE">HOME & AWAY</option>
                      </select>
                    )}
                  </div>
                </div>
                {/* 상금 설정 로직 생략(P_03 유지) */}
                <button onClick={handleCreateSeason} className="w-full bg-emerald-600 py-4 rounded-xl font-bold">START NEW SEASON</button>
              </div>
            )}
          </div>
        )}

        {/* 팀 관리 섹션 (복구) */}
        {currentView === 'TEAMS' && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-red-500/30 space-y-6">
            <h3 className="text-red-500">MASTER TEAM DATA</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {masterTeams.map(mt => (
                <div key={mt.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col items-center gap-2">
                  <img src={mt.logo} className="w-12 h-12 object-contain bg-white rounded-full p-1" />
                  <span className="text-[10px] text-center h-8 flex items-center">{mt.name}</span>
                  <span className="text-[8px] px-2 py-0.5 bg-slate-800 rounded text-slate-500">{mt.region}</span>
                </div>
              ))}
              {masterTeams.length === 0 && <p className="col-span-full text-center text-slate-600 py-10 font-sans not-italic">등록된 팀 데이터가 없습니다. 엑셀 업로드 기능을 사용해 보세요.</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}