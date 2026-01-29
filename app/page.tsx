/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc } from 'firebase/firestore';

// --- 인터페이스 ---
interface Season { 
  id: number; name: string; type: 'LEAGUE' | 'TOURNAMENT'; leagueMode?: 'SINGLE' | 'DOUBLE'; isActive: boolean;
  teams?: Team[]; rounds?: Round[]; 
  prizes: { total: number; first: number; second: number; third: number; scorer: number; };
}
interface Owner { id: number; nickname: string; photo: string; docId?: string; }
interface MasterTeam { id?: string; name: string; logo: string; category: 'CLUB' | 'NATIONAL'; region: string; tier: 'S' | 'A' | 'B' | 'C'; }
interface Team { id: number; seasonId: number; name: string; logo: string; ownerName: string; win: number; draw: number; loss: number; points: number; tier: string; gf: number; ga: number; gd: number; }
interface MatchRecord { id: number; name: string; count: number; teamLogo?: string; }
interface Match {
  id: string; seasonId: number; home: string; away: string; homeLogo: string; awayLogo: string;
  homeOwner: string; awayOwner: string; homeScore: string; awayScore: string;
  homeScorers: MatchRecord[]; awayScorers: MatchRecord[]; homeAssists: MatchRecord[]; awayAssists: MatchRecord[];
  status: 'UPCOMING' | 'FINISHED' | 'BYE'; youtubeUrl: string; stage?: string;
}
interface Round { round: number; matches: Match[]; seasonId: number; name?: string; }

// --- [컴포넌트] 기록 입력기 (디자인 개선) ---
const RecordInput = ({ type, inputValue, onInputChange, onAdd, onRemove, records, label, colorClass }: any) => {
  return (
    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
      <p className={`text-xs font-bold mb-2 uppercase ${colorClass}`}>{label}</p>
      <div className="flex gap-2 mb-2">
        <input type="text" value={inputValue.name} onChange={(e) => onInputChange(type, 'name', e.target.value)} placeholder="Player Name" className="flex-1 bg-slate-900 text-sm p-2 rounded-lg border border-slate-600 focus:border-blue-500 outline-none text-white placeholder-slate-600" />
        <input type="number" value={inputValue.count} onChange={(e) => onInputChange(type, 'count', e.target.value)} className="w-12 bg-slate-900 text-sm p-2 rounded-lg border border-slate-600 focus:border-blue-500 outline-none text-center text-white" />
        <button onClick={() => onAdd(type)} className="bg-slate-700 text-white w-8 h-9 rounded-lg font-bold hover:bg-slate-600 transition-colors flex items-center justify-center">+</button>
      </div>
      <div className="flex flex-wrap gap-2 min-h-[24px]">
        {(records || []).map((r:any) => (
          <span key={r.id} className="text-[10px] bg-slate-900 px-2 py-1 rounded-md border border-slate-700 text-slate-300 flex items-center gap-1">
            {r.name} <b className="text-white">x{r.count}</b> <button onClick={() => onRemove(type, r.id)} className="text-red-400 hover:text-red-300 ml-1">×</button>
          </span>
        ))}
      </div>
    </div>
  );
};

export default function FootballLeagueApp() {
  const [currentView, setCurrentView] = useState<'RANKING' | 'SCHEDULE' | 'HISTORY' | 'ADMIN' | 'TEAMS'>('RANKING');
  const [rankingTab, setRankingTab] = useState<'STANDINGS' | 'OWNERS' | 'PLAYERS' | 'HIGHLIGHTS'>('STANDINGS');
  const [historyTab, setHistoryTab] = useState<'TEAMS' | 'OWNERS' | 'PLAYERS'>('TEAMS');
  const [adminTab, setAdminTab] = useState<number | 'NEW' | 'OWNER'>(0);
  
  const [viewSeasonId, setViewSeasonId] = useState<number>(0); 
  const [statView, setStatView] = useState<'GOAL' | 'ASSIST'>('GOAL');

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);

  // Season Creation
  const [inputSeasonName, setInputSeasonName] = useState('');
  const [inputSeasonType, setInputSeasonType] = useState<'LEAGUE' | 'TOURNAMENT'>('LEAGUE');
  const [inputLeagueMode, setInputLeagueMode] = useState<'SINGLE' | 'DOUBLE'>('SINGLE');
  const [inputTotalPrize, setInputTotalPrize] = useState(100000);
  const [prizes, setPrizes] = useState({ first: 50000, second: 30000, third: 10000, scorer: 10000 });
  
  // Owner Manage
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPhoto, setNewOwnerPhoto] = useState('');
  const [editOwnerId, setEditOwnerId] = useState<string | null>(null);

  // Assign Filter
  const [selOwnerId, setSelOwnerId] = useState<number | ''>('');
  const [selCategory, setSelCategory] = useState<'CLUB' | 'NATIONAL' | 'ALL'>('ALL');
  const [selTier, setSelTier] = useState<string>('ALL');
  const [selRegion, setSelRegion] = useState<string>('ALL');
  const [selTeamName, setSelTeamName] = useState<string>('');

  // Team Manage (UX Optimization)
  const [manageTab, setManageTab] = useState<'CLUB' | 'NATIONAL' | 'ALL'>('ALL');
  const [manageTier, setManageTier] = useState('ALL');
  const [manageRegion, setManageRegion] = useState('ALL');
  const [manageSearch, setManageSearch] = useState('');
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [manualTeam, setManualTeam] = useState<MasterTeam>({ name: '', logo: '', category: 'CLUB', region: '', tier: 'A' });
  const [bulkInput, setBulkInput] = useState('');
  const [visibleTeamCount, setVisibleTeamCount] = useState(18);
  const manualFormRef = useRef<HTMLDivElement>(null);

  // Match Editing
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [matchInputs, setMatchInputs] = useState({ homeScore:'', awayScore:'', youtube:'' });
  const [recordInputs, setRecordInputs] = useState({ homeScorer:{name:'',count:'1'}, awayScorer:{name:'',count:'1'}, homeAssist:{name:'',count:'1'}, awayAssist:{name:'',count:'1'} });

  useEffect(() => { 
    setPrizes({ 
      first: Math.floor(inputTotalPrize*0.5), 
      second: Math.floor(inputTotalPrize*0.3), 
      third: Math.floor(inputTotalPrize*0.1), 
      scorer: Math.floor(inputTotalPrize*0.1) 
    }); 
  }, [inputTotalPrize]);
  
  useEffect(() => {
    setVisibleTeamCount(18);
  }, [manageTab, manageTier, manageRegion, manageSearch]);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "users"), orderBy("id", "asc")), s => setOwners(s.docs.map(d => ({...d.data(), docId: d.id} as Owner))));
    const u2 = onSnapshot(collection(db, "master_teams"), s => setMasterTeams(s.docs.map(d => ({id:d.id, ...d.data()} as MasterTeam))));
    const u3 = onSnapshot(query(collection(db, "seasons"), orderBy("id", "desc")), s => {
      const d = s.docs.map(doc => doc.data() as Season); setSeasons(d);
      if(d.length > 0 && viewSeasonId === 0) {
        setViewSeasonId(d[0].id);
        setAdminTab(d[0].id);
      }
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  const activeRankingData = useMemo(() => {
    const targetSeason = seasons.find(s => s.id === viewSeasonId);
    if(!targetSeason?.teams) return { teams: [], owners: [], players: [], highlights: [] };
    
    const teams = [...targetSeason.teams].sort((a,b) => b.points - a.points || b.gd - a.gd).map((t, idx) => {
      let prize = 0;
      if(idx === 0) prize = targetSeason.prizes.first;
      if(idx === 1) prize = targetSeason.prizes.second;
      if(idx === 2) prize = targetSeason.prizes.third;
      return { ...t, rank: idx + 1, currentPrize: prize };
    });

    const pMap = new Map<string, {name:string, team:string, owner:string, goals:number, assists:number}>();
    targetSeason.rounds?.forEach(r => {
      r.matches.forEach(m => {
        if(m.status !== 'FINISHED') return;
        const add = (list: MatchRecord[], type: 'goals'|'assists', team: string, owner: string) => {
          list.forEach(i => {
            const k = `${i.name}-${team}`;
            if(!pMap.has(k)) pMap.set(k, {name:i.name, team, owner, goals:0, assists:0});
            pMap.get(k)![type] += i.count;
          });
        };
        add(m.homeScorers || [], 'goals', m.home, m.homeOwner);
        add(m.awayScorers || [], 'goals', m.away, m.awayOwner);
        add(m.homeAssists || [], 'assists', m.home, m.homeOwner);
        add(m.awayAssists || [], 'assists', m.away, m.awayOwner);
      });
    });
    
    const highlights = targetSeason.rounds?.flatMap(r => r.matches).filter(m => m.youtubeUrl && m.youtubeUrl.length > 5) || [];
    return { teams, owners: teams, players: Array.from(pMap.values()), highlights }; 
  }, [seasons, viewSeasonId]);

  const historyData = useMemo(() => {
    const tMap = new Map<string, {name:string, owner:string, logo:string, w:number, d:number, l:number, pts:number, seasons:number}>();
    const oMap = new Map<string, {name:string, w:number, d:number, l:number, pts:number, prize:number}>();
    const pMap = new Map<string, {name:string, goals:number, assists:number}>();

    seasons.forEach(s => {
      s.teams?.forEach(t => {
        if(!tMap.has(t.name)) tMap.set(t.name, {name:t.name, owner:t.ownerName, logo:t.logo, w:0, d:0, l:0, pts:0, seasons:0});
        const tm = tMap.get(t.name)!;
        tm.w+=t.win; tm.d+=t.draw; tm.l+=t.loss; tm.pts+=t.points; tm.seasons++;

        if(!oMap.has(t.ownerName)) oMap.set(t.ownerName, {name:t.ownerName, w:0, d:0, l:0, pts:0, prize:0});
        const om = oMap.get(t.ownerName)!;
        om.w+=t.win; om.d+=t.draw; om.l+=t.loss; om.pts+=t.points;
      });

      const ranked = [...(s.teams || [])].sort((a,b) => b.points - a.points || b.gd - a.gd);
      ranked.forEach((t, idx) => {
        if(oMap.has(t.ownerName)) {
          if(idx===0) oMap.get(t.ownerName)!.prize += s.prizes.first;
          if(idx===1) oMap.get(t.ownerName)!.prize += s.prizes.second;
          if(idx===2) oMap.get(t.ownerName)!.prize += s.prizes.third;
        }
      });

      s.rounds?.forEach(r => {
        r.matches.forEach(m => {
          if(m.status!=='FINISHED') return;
          const add = (list: MatchRecord[], type: 'goals'|'assists') => {
            list.forEach(i => {
              if(!pMap.has(i.name)) pMap.set(i.name, {name:i.name, goals:0, assists:0});
              pMap.get(i.name)![type] += i.count;
            });
          };
          add(m.homeScorers||[], 'goals'); add(m.awayScorers||[], 'goals');
          add(m.homeAssists||[], 'assists'); add(m.awayAssists||[], 'assists');
        });
      });
    });

    return { teams: Array.from(tMap.values()), owners: Array.from(oMap.values()), players: Array.from(pMap.values()) };
  }, [seasons]);

  const handleSaveOwner = async () => {
    if(!newOwnerName.trim()) return alert("입력하세요");
    const photo = newOwnerPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(newOwnerName)}`;
    
    if(editOwnerId) {
      await updateDoc(doc(db, "users", editOwnerId), { nickname: newOwnerName, photo });
      setEditOwnerId(null);
    } else {
      await addDoc(collection(db, "users"), { id: Date.now(), nickname: newOwnerName, photo });
    }
    setNewOwnerName(''); setNewOwnerPhoto('');
  };

  const handleEditOwnerClick = (o: Owner) => {
    setEditOwnerId(o.docId!);
    setNewOwnerName(o.nickname);
    setNewOwnerPhoto(o.photo);
  };

  const handleCreateSeason = async () => {
    if(!inputSeasonName) return alert("시즌명 입력");
    const id = Date.now();
    await setDoc(doc(db, "seasons", String(id)), {
      id, name: inputSeasonName, type: inputSeasonType, leagueMode: inputSeasonType==='LEAGUE'?inputLeagueMode:'SINGLE', isActive: true, teams: [], rounds: [], prizes: { total: inputTotalPrize, ...prizes }
    });
    setAdminTab(id); setViewSeasonId(id); setInputSeasonName('');
  };

  const handleDeleteSeason = async () => {
    if(typeof adminTab !== 'number') return;
    if(confirm("⚠️ 경고: 이 시즌과 관련된 모든 데이터(경기, 기록)가 삭제됩니다.\n정말 삭제하시겠습니까?")) {
      await deleteDoc(doc(db, "seasons", String(adminTab)));
      setAdminTab(0); 
      setViewSeasonId(0);
      alert("시즌이 삭제되었습니다.");
    }
  };
  
  const recordActiveS = seasons.find(s => s.id === adminTab);
  const assignedNames = useMemo(() => (recordActiveS?.teams || []).map(t => t.name), [recordActiveS]);
  const stepTeams = useMemo(() => masterTeams.filter(mt => !assignedNames.includes(mt.name) && (selCategory==='ALL'||mt.category===selCategory) && (selTier==='ALL'||mt.tier===selTier) && (selRegion==='ALL'||mt.region===selRegion)), [masterTeams, assignedNames, selCategory, selTier, selRegion]);
  
  const handleRandomDraw = () => {
    if(stepTeams.length===0) return alert("팀 없음");
    const r = stepTeams[Math.floor(Math.random()*stepTeams.length)];
    if(selCategory==='ALL') setSelCategory(r.category);
    setSelRegion(r.region); setSelTier(r.tier); setSelTeamName(r.name);
  };
  
  const handleConfirmTeam = async () => {
    if(!selOwnerId || !selTeamName) return alert("선택 필수");
    const o = owners.find(i => i.id===Number(selOwnerId));
    const m = masterTeams.find(i => i.name===selTeamName);
    if(o && m) {
      const nt: Team = { id:Date.now(), seasonId:Number(adminTab), name:m.name, logo:m.logo||'', ownerName:o.nickname, tier:m.tier||'A', win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 };
      await updateDoc(doc(db, "seasons", String(adminTab)), { teams: [...(recordActiveS?.teams||[]), nt] });
      setSelTeamName('');
    }
  };

  // 🔥 [ALGORITHM] Improved Round-Robin w/ Owner Constraints
  const handleGenerateSchedule = async () => {
    if(!recordActiveS || !recordActiveS.teams || recordActiveS.teams.length < 2) return alert("팀 2개 이상 필요");
    if(confirm(`[${recordActiveS.leagueMode}] 스케줄을 생성하시겠습니까?\n⚠️ 모든 라운드에 경기가 균등하게 배정됩니다.`)) {
      const teams = [...recordActiveS.teams];
      const isDouble = recordActiveS.leagueMode === 'DOUBLE';
      
      // 1. Generate ALL Valid Matchups
      let allMatches: {home:Team, away:Team}[] = [];
      for(let i=0; i<teams.length; i++) {
        for(let j=i+1; j<teams.length; j++) {
          // Constraint: Same Owner teams CANNOT play each other
          if(teams[i].ownerName !== teams[j].ownerName) {
            allMatches.push({ home: teams[i], away: teams[j] });
            if(isDouble) allMatches.push({ home: teams[j], away: teams[i] });
          }
        }
      }

      // Shuffle for randomness
      allMatches = allMatches.sort(() => Math.random() - 0.5);

      // 2. Distribute to Rounds (Greedy Packing for Max Density)
      const rounds: Round[] = [];
      
      while(allMatches.length > 0) {
        const roundMatches: Match[] = [];
        const busyTeams = new Set<string>(); // Teams playing in this round
        const pendingMatches: typeof allMatches = []; // Matches that couldn't fit in this round

        for (const match of allMatches) {
          // Check if either team is already playing in this round
          if (!busyTeams.has(match.home.name) && !busyTeams.has(match.away.name)) {
            roundMatches.push({
              id: `${recordActiveS.id}_R${rounds.length + 1}_${Date.now()}_${Math.random()}`,
              seasonId: recordActiveS.id,
              home: match.home.name, away: match.away.name,
              homeLogo: match.home.logo, awayLogo: match.away.logo,
              homeOwner: match.home.ownerName, awayOwner: match.away.ownerName,
              homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [],
              status: 'UPCOMING', youtubeUrl: ''
            });
            busyTeams.add(match.home.name);
            busyTeams.add(match.away.name);
          } else {
            pendingMatches.push(match);
          }
        }

        rounds.push({ round: rounds.length + 1, matches: roundMatches, seasonId: recordActiveS.id });
        allMatches = pendingMatches; // Remaining matches go to next round
      }

      await updateDoc(doc(db, "seasons", String(adminTab)), { rounds });
      alert(`스케줄 생성 완료! (총 ${rounds.length} 라운드 / 라운드당 평균 ${Math.round(rounds.reduce((acc,r)=>acc+r.matches.length,0)/rounds.length)}경기)`);
    }
  };

  const handleMatchClick = (m: Match) => { 
    setEditingMatch({
      ...m,
      homeScorers: m.homeScorers || [], awayScorers: m.awayScorers || [],
      homeAssists: m.homeAssists || [], awayAssists: m.awayAssists || []
    }); 
    setMatchInputs({ homeScore: m.homeScore, awayScore: m.awayScore, youtube: m.youtubeUrl }); 
  };
  
  const handleRecordAdd = (type: string) => {
    if(!editingMatch) return;
    const k = type as keyof typeof recordInputs;
    if(!recordInputs[k].name) return;
    const f = type + 's' as keyof Match;
    const list = (editingMatch[f] as MatchRecord[]) || [];
    setEditingMatch({ ...editingMatch, [f]: [...list, { id: Date.now(), name: recordInputs[k].name, count: Number(recordInputs[k].count) }] });
    setRecordInputs({ ...recordInputs, [k]: {name:'', count:'1'} });
  };
  
  const handleRecordRemove = (type: string, id: number) => {
    if(!editingMatch) return;
    const f = type + 's' as keyof Match;
    const list = (editingMatch[f] as MatchRecord[]) || [];
    setEditingMatch({ ...editingMatch, [f]: list.filter(r => r.id !== id) });
  };

  const saveMatchResult = async () => {
    if(!editingMatch) return;
    const targetSeason = seasons.find(s => s.id === editingMatch.seasonId);
    if(!targetSeason) return;
    const updatedRounds = targetSeason.rounds!.map(r => ({ ...r, matches: r.matches.map(m => m.id === editingMatch.id ? { ...editingMatch, homeScore: matchInputs.homeScore, awayScore: matchInputs.awayScore, youtubeUrl: matchInputs.youtube, status: 'FINISHED' } : m) })) as Round[];
    
    const newTeams = targetSeason.teams!.map(t => ({ ...t, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 }));
    updatedRounds.forEach(r => r.matches.forEach(m => {
      if(m.status === 'FINISHED' && m.homeScore !== '') {
        const h = Number(m.homeScore), a = Number(m.awayScore);
        const ht = newTeams.find(t => t.name === m.home), at = newTeams.find(t => t.name === m.away);
        if(ht && at) {
          ht.gf+=h; ht.ga+=a; ht.gd+=(h-a); at.gf+=a; at.ga+=h; at.gd+=(a-h);
          if(h>a) { ht.win++; ht.points+=3; at.loss++; } else if(h<a) { at.win++; at.points+=3; ht.loss++; } else { ht.draw++; at.draw++; ht.points++; at.points++; }
        }
      }
    }));
    await updateDoc(doc(db, "seasons", String(targetSeason.id)), { rounds: updatedRounds, teams: newTeams });
    setEditingMatch(null); alert("저장 완료");
  };

  const handleSaveMaster = async () => { 
    try {
      if(editTeamId) await updateDoc(doc(db,"master_teams",editTeamId), manualTeam as any); 
      else await addDoc(collection(db,"master_teams"), manualTeam); 
      setEditTeamId(null); 
      setManualTeam({name:'',logo:'',category:'CLUB',region:'',tier:'A'}); 
      alert("저장 완료");
    } catch(e) { console.error(e); alert("저장 실패"); }
  };

  const handleBulk = async () => { try { const d=JSON.parse(bulkInput); for(const i of d) await addDoc(collection(db,"master_teams"),{name:i.name,logo:i.logo||'',category:i.category||'CLUB',region:i.region||'',tier:i.tier||'A'}); setBulkInput(''); alert("완료"); } catch { alert("JSON 오류"); } };
  const filteredTeams = masterTeams.filter(t => (manageTab==='ALL'||t.category===manageTab) && (manageTier==='ALL'||t.tier===manageTier) && (manageRegion==='ALL'||t.region===manageRegion) && t.name.toLowerCase().includes(manageSearch.toLowerCase()));
  const allManageRegions = Array.from(new Set((manageTab==='ALL'?masterTeams:masterTeams.filter(t=>t.category===manageTab)).map(t=>t.region))).sort();

  return (
    <div className="min-h-screen bg-[#020617] text-white font-black italic tracking-tighter overflow-x-hidden pb-20">
      
      {/* Banner */}
      <div className="w-full h-[225px] md:h-[330px] relative border-b border-slate-800 shadow-2xl">
        <img src="https://www.konami.com/efootball/s/img/main_page_1.png?v=903" alt="banner" className="w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent"></div>
        <div className="absolute bottom-6 left-6 uppercase">
          <h1 className="text-4xl md:text-6xl text-white font-black italic">eFOOTBALL LEAGUE™</h1>
          <p className="text-emerald-400 text-sm font-sans not-italic tracking-widest mt-1">League Master P_27</p>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex justify-center flex-wrap gap-2 mt-6 mb-8 px-4">
        {[{id:'RANKING',l:'🏆 RANKING'}, {id:'SCHEDULE',l:'📅 SCHEDULE'}, {id:'HISTORY',l:'📜 HISTORY'}, {id:'ADMIN',l:'⚙️ ADMIN'}, {id:'TEAMS',l:'🛡️ TEAMS'}].map(tab => (
          <button key={tab.id} onClick={() => setCurrentView(tab.id as any)} className={`px-6 py-3 rounded-xl border text-xs transition-all shadow-lg ${currentView === tab.id ? 'bg-blue-600 border-blue-400 text-white scale-105' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}>{tab.l}</button>
        ))}
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-8 space-y-8">
        {/* ... (RANKING, HISTORY, ADMIN, TEAMS 뷰는 이전과 동일, 생략 없이 전체 코드 포함됨) ... */}
        
        {/* ================= VIEW: RANKING ================= */}
        {currentView === 'RANKING' && (
          <div className="animate-in fade-in space-y-6">
            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col gap-4">
              <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700 outline-none font-sans not-italic">
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="flex gap-2 overflow-x-auto" style={{scrollbarWidth:'none', msOverflowStyle:'none'}}>
                {['STANDINGS', 'OWNERS', 'PLAYERS', 'HIGHLIGHTS'].map(sub => (
                  <button key={sub} onClick={() => setRankingTab(sub as any)} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${rankingTab === sub ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{sub}</button>
                ))}
              </div>
            </div>

            {rankingTab === 'STANDINGS' && (
              <div className="bg-slate-900/40 rounded-3xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs uppercase">
                  <thead className="bg-slate-950/80 text-slate-500"><tr><th className="p-4">#</th><th className="p-4">Team</th><th className="p-4">Owner</th><th className="p-4 text-center">W-D-L</th><th className="p-4 text-center">GD</th><th className="p-4 text-center">PTS</th></tr></thead>
                  <tbody>
                    {activeRankingData.teams.map((t, i) => (
                      <tr key={t.id} className="border-b border-slate-800/50 hover:bg-white/5 font-sans not-italic">
                        <td className="p-4 font-bold">{i+1}</td>
                        <td className="p-4 flex items-center gap-2"><img src={t.logo} alt="team" className="w-6 h-6 object-contain bg-white rounded-full p-0.5" />{t.name}</td>
                        <td className="p-4 text-slate-400">{t.ownerName}</td>
                        <td className="p-4 text-center">{t.win}-{t.draw}-{t.loss}</td>
                        <td className="p-4 text-center">{t.gd>0?`+${t.gd}`:t.gd}</td>
                        <td className="p-4 text-center font-bold text-yellow-500 text-lg">{t.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {rankingTab === 'OWNERS' && (
              <div className="bg-slate-900/40 rounded-3xl border border-purple-500/20 overflow-hidden">
                <table className="w-full text-left text-xs uppercase">
                  <thead className="bg-slate-950/80 text-purple-400"><tr><th className="p-4">#</th><th className="p-4">Owner</th><th className="p-4 text-center">Record</th><th className="p-4 text-center">Pts</th><th className="p-4 text-right">Prize</th></tr></thead>
                  <tbody>
                    {activeRankingData.owners.map((t, i) => (
                      <tr key={t.id} className="border-b border-slate-800/50 hover:bg-white/5 font-sans not-italic">
                        <td className="p-4">{i+1}</td>
                        <td className="p-4 font-bold text-white">{t.ownerName}</td>
                        <td className="p-4 text-center">{t.win}-{t.draw}-{t.loss}</td>
                        <td className="p-4 text-center font-bold text-yellow-500">{t.points}</td>
                        <td className="p-4 text-right text-emerald-400">{t.currentPrize>0?`₩${t.currentPrize.toLocaleString()}`:'-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {rankingTab === 'PLAYERS' && (
              <div className="space-y-4">
                <div className="flex justify-center gap-2">
                  <button onClick={() => setStatView('GOAL')} className={`px-4 py-1 rounded-full text-xs font-bold ${statView==='GOAL'?'bg-emerald-600':'bg-slate-800 text-slate-500'}`}>⚽ GOALS</button>
                  <button onClick={() => setStatView('ASSIST')} className={`px-4 py-1 rounded-full text-xs font-bold ${statView==='ASSIST'?'bg-blue-600':'bg-slate-800 text-slate-500'}`}>👟 ASSISTS</button>
                </div>
                <div className="bg-slate-900/40 rounded-3xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-xs uppercase">
                    <thead className="bg-slate-950/80 text-slate-500"><tr><th className="p-4">#</th><th className="p-4">Player</th><th className="p-4">Team</th><th className="p-4">Owner</th><th className="p-4 text-center">Count</th></tr></thead>
                    <tbody>
                      {activeRankingData.players.sort((a,b) => statView==='GOAL' ? b.goals-a.goals : b.assists-a.assists).slice(0, 20).map((p, i) => (
                        <tr key={i} className="border-b border-slate-800/50 font-sans not-italic">
                          <td className="p-4">{i+1}</td>
                          <td className="p-4 font-bold text-white">{p.name}</td>
                          <td className="p-4 text-slate-400">{p.team}</td>
                          <td className="p-4 text-slate-500 text-[10px]">{p.owner}</td>
                          <td className={`p-4 text-center font-bold text-lg ${statView==='GOAL'?'text-emerald-400':'text-blue-400'}`}>{statView==='GOAL'?p.goals:p.assists}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {rankingTab === 'HIGHLIGHTS' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {activeRankingData.highlights.map((m, i) => {
                  const hScore = Number(m.homeScore);
                  const aScore = Number(m.awayScore);
                  const winnerLogo = hScore > aScore ? m.homeLogo : (aScore > hScore ? m.awayLogo : null);
                  return (
                    <div key={i} className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-slate-600 transition-all group">
                      <div className="aspect-video bg-black relative"><iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${m.youtubeUrl.split('v=')[1]||m.youtubeUrl.split('/').pop()}`} frameBorder="0" allowFullScreen></iframe></div>
                      <div className="p-3 flex items-center justify-between bg-slate-950">
                        <div className="flex items-center gap-3">
                          {winnerLogo ? <img src={winnerLogo} alt="winner" className="w-8 h-8 object-contain" /> : <div className="flex -space-x-2"><img src={m.homeLogo} alt="home" className="w-6 h-6 object-contain rounded-full bg-white p-0.5" /><img src={m.awayLogo} alt="away" className="w-6 h-6 object-contain rounded-full bg-white p-0.5" /></div>}
                          <div className="flex flex-col"><span className="text-white font-bold text-sm tracking-tight">{m.home} vs {m.away}</span><span className="text-emerald-400 text-xs font-bold">{m.homeScore} : {m.awayScore}</span></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= VIEW: SCHEDULE ================= */}
        {currentView === 'SCHEDULE' && (
          <div className="animate-in fade-in space-y-6">
            <div className="flex justify-end mb-4">
              <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700 outline-none font-sans not-italic">
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {(seasons.find(s=>s.id===viewSeasonId)?.rounds || []).map(r => (
              <div key={r.round} className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
                <h3 className="text-sm text-slate-500 font-bold mb-4 uppercase tracking-widest">Round {r.round}</h3>
                <div className="grid grid-cols-1 gap-4">
                  {r.matches.map(m => (
                    <div key={m.id} onClick={() => handleMatchClick(m)} className="bg-slate-950 p-6 rounded-xl border border-slate-800 flex flex-col gap-4 cursor-pointer hover:border-blue-500 hover:bg-slate-900/80 transition-all">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4 w-5/12"><img src={m.homeLogo} alt="home" className="w-10 h-10 bg-white rounded-full p-1"/><div className="flex flex-col"><span className="text-base font-bold text-white">{m.home}</span><span className="text-xs text-slate-500 font-sans not-italic">{m.homeOwner}</span></div></div>
                        <div className="flex flex-col items-center w-2/12"><span className={`text-2xl font-black ${m.status==='FINISHED'?'text-white':'text-slate-600'}`}>{m.status==='FINISHED'?`${m.homeScore} : ${m.awayScore}`:'VS'}</span></div>
                        <div className="flex items-center gap-4 w-5/12 justify-end"><div className="flex flex-col items-end"><span className="text-base font-bold text-white">{m.away}</span><span className="text-xs text-slate-500 font-sans not-italic">{m.awayOwner}</span></div><img src={m.awayLogo} alt="away" className="w-10 h-10 bg-white rounded-full p-1"/></div>
                      </div>
                      {m.status === 'FINISHED' && (
                        <div className="border-t border-slate-800 pt-3 flex flex-col gap-2 font-sans not-italic">
                          <div className="flex justify-between text-xs text-slate-400">
                            <div>{(m.homeScorers||[]).map(s=>`⚽ ${s.name} `)}{(m.homeAssists||[]).map(s=>`👟 ${s.name} `)}</div>
                            <div>{(m.awayScorers||[]).map(s=>`⚽ ${s.name} `)}{(m.awayAssists||[]).map(s=>`👟 ${s.name} `)}</div>
                          </div>
                          {m.youtubeUrl && <a href={m.youtubeUrl} target="_blank" onClick={e=>e.stopPropagation()} className="text-center text-xs text-red-400 hover:underline">▶ Watch Highlight</a>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= VIEW: HISTORY ================= */}
        {currentView === 'HISTORY' && (
          <div className="animate-in fade-in space-y-6">
            <div className="flex gap-2 border-b border-slate-800 pb-2 overflow-x-auto" style={{scrollbarWidth:'none', msOverflowStyle:'none'}}>
              {['TEAMS', 'OWNERS', 'PLAYERS'].map(sub => (
                <button key={sub} onClick={() => setHistoryTab(sub as any)} className={`px-6 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${historyTab === sub ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{sub}</button>
              ))}
            </div>
            {historyTab === 'TEAMS' && (<div className="bg-slate-900/40 rounded-3xl border border-slate-800 overflow-hidden"><table className="w-full text-left text-xs uppercase"><thead className="bg-slate-950/80 text-orange-400"><tr><th className="p-4">Rank</th><th className="p-4">Team</th><th className="p-4 text-center">Seasons</th><th className="p-4 text-center">W-D-L</th><th className="p-4 text-center">PTS</th></tr></thead><tbody>{historyData.teams.sort((a,b) => b.pts - a.pts).map((t, i) => (<tr key={i} className="border-b border-slate-800/50 font-sans not-italic"><td className="p-4">{i+1}</td><td className="p-4 flex items-center gap-2"><img src={t.logo} alt="team" className="w-5 h-5 bg-white rounded-full p-0.5"/>{t.name}</td><td className="p-4 text-center text-slate-500">{t.seasons}</td><td className="p-4 text-center">{t.w}-{t.d}-{t.l}</td><td className="p-4 text-center font-bold text-orange-500">{t.pts}</td></tr>))}</tbody></table></div>)}
            {historyTab === 'OWNERS' && (<div className="bg-slate-900/40 rounded-3xl border border-slate-800 overflow-hidden"><table className="w-full text-left text-xs uppercase"><thead className="bg-slate-950/80 text-orange-400"><tr><th className="p-4">Rank</th><th className="p-4">Owner</th><th className="p-4 text-center">Total Record</th><th className="p-4 text-center">Total PTS</th><th className="p-4 text-right">Accumulated Prize</th></tr></thead><tbody>{historyData.owners.sort((a,b) => b.pts - a.pts).map((t, i) => (<tr key={i} className="border-b border-slate-800/50 font-sans not-italic"><td className="p-4">{i+1}</td><td className="p-4 font-bold text-white">{t.name}</td><td className="p-4 text-center">{t.w}-{t.d}-{t.l}</td><td className="p-4 text-center font-bold text-orange-500">{t.pts}</td><td className="p-4 text-right text-emerald-400">{t.prize>0?`₩${t.prize.toLocaleString()}`:'-'}</td></tr>))}</tbody></table></div>)}
            {historyTab === 'PLAYERS' && (<div className="bg-slate-900/40 rounded-3xl border border-slate-800 overflow-hidden"><table className="w-full text-left text-xs uppercase"><thead className="bg-slate-950/80 text-orange-400"><tr><th className="p-4">Rank</th><th className="p-4">Player</th><th className="p-4 text-center">Goals</th><th className="p-4 text-center">Assists</th></tr></thead><tbody>{historyData.players.sort((a,b) => (b.goals+b.assists) - (a.goals+a.assists)).slice(0, 30).map((p, i) => (<tr key={i} className="border-b border-slate-800/50 font-sans not-italic"><td className="p-4">{i+1}</td><td className="p-4 font-bold text-white">{p.name}</td><td className="p-4 text-center text-emerald-400 font-bold">{p.goals}</td><td className="p-4 text-center text-blue-400 font-bold">{p.assists}</td></tr>))}</tbody></table></div>)}
          </div>
        )}

        {/* ================= VIEW: ADMIN ================= */}
        {currentView === 'ADMIN' && (
          <div className="animate-in fade-in space-y-10">
            <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col md:flex-row gap-4 items-center">
              <select value={adminTab} onChange={(e) => setAdminTab(e.target.value === 'NEW' || e.target.value === 'OWNER' ? e.target.value : Number(e.target.value))} className="w-full bg-slate-950 p-4 rounded-xl border border-slate-700 text-sm font-sans not-italic">
                <optgroup label="Core Options"><option value="NEW">➕ CREATE NEW SEASON</option><option value="OWNER">👤 MANAGE OWNERS</option></optgroup>
                <optgroup label="Active Seasons">{seasons.map(s => <option key={s.id} value={s.id}>🏆 {s.name}</option>)}</optgroup>
              </select>
              {typeof adminTab === 'number' && (
                <button onClick={handleDeleteSeason} className="w-full md:w-auto px-6 py-4 bg-red-900/50 border border-red-800 text-red-400 rounded-xl font-bold hover:bg-red-900 transition-colors whitespace-nowrap">🗑️ DELETE SEASON</button>
              )}
            </div>
            {adminTab === 'OWNER' && (
              <div className="bg-slate-900/60 p-8 rounded-3xl border border-purple-500/30 space-y-4">
                <h3 className="text-purple-400 font-bold">OWNER MANAGEMENT</h3>
                <div className="flex gap-4 flex-col md:flex-row"><input value={newOwnerName} onChange={e=>setNewOwnerName(e.target.value)} placeholder="Nickname" className="bg-slate-950 p-3 rounded w-full border border-slate-800"/><input value={newOwnerPhoto} onChange={e=>setNewOwnerPhoto(e.target.value)} placeholder="Image URL (Optional)" className="bg-slate-950 p-3 rounded w-full border border-slate-800"/><button onClick={handleSaveOwner} className={`px-6 py-3 rounded font-bold whitespace-nowrap ${editOwnerId ? 'bg-blue-600' : 'bg-purple-600'}`}>{editOwnerId ? 'UPDATE' : 'ADD'}</button>{editOwnerId && <button onClick={()=>{setEditOwnerId(null); setNewOwnerName(''); setNewOwnerPhoto('')}} className="bg-slate-700 px-6 rounded">CANCEL</button>}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">{owners.map(o => (<div key={o.id} onClick={() => handleEditOwnerClick(o)} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-4 relative group cursor-pointer hover:border-blue-500"><img src={o.photo} alt="owner" className="w-12 h-12 rounded-full border-2 border-slate-700" /><span className="text-sm truncate">{o.nickname}</span><button onClick={(e) => {e.stopPropagation(); if(confirm('삭제?')) deleteDoc(doc(db,"users",o.docId!));}} className="ml-auto text-red-500 font-bold opacity-0 group-hover:opacity-100">×</button></div>))}</div>
              </div>
            )}
            {adminTab === 'NEW' && (
              <div className="bg-slate-900/60 p-8 rounded-3xl border border-emerald-500/30 space-y-6">
                <h3 className="text-emerald-400 font-bold">CREATE NEW SEASON</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input value={inputSeasonName} onChange={e=>setInputSeasonName(e.target.value)} placeholder="Season Name" className="bg-slate-950 p-3 rounded w-full border border-slate-800"/><div className="flex gap-2"><select value={inputSeasonType} onChange={e=>setInputSeasonType(e.target.value as any)} className="bg-slate-950 p-3 rounded w-full border border-slate-800"><option value="LEAGUE">League</option><option value="TOURNAMENT">Tournament</option></select>{inputSeasonType==='LEAGUE' && <select value={inputLeagueMode} onChange={e=>setInputLeagueMode(e.target.value as any)} className="bg-slate-950 p-3 rounded w-full border border-slate-800"><option value="SINGLE">Single</option><option value="DOUBLE">Home&Away</option></select>}</div></div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800"><p className="text-xs text-slate-500 mb-2">Total Prize Pool</p><input type="number" value={inputTotalPrize} onChange={e=>setInputTotalPrize(Number(e.target.value))} className="bg-slate-900 p-2 rounded w-full border border-slate-700 mb-2 text-white" /><div className="flex justify-between text-xs text-slate-400"><span>1st: {prizes.first.toLocaleString()}</span><span>2nd: {prizes.second.toLocaleString()}</span><span>3rd: {prizes.third.toLocaleString()}</span><span>Scorer: {prizes.scorer.toLocaleString()}</span></div></div>
                <button onClick={handleCreateSeason} className="w-full bg-emerald-600 py-3 rounded font-bold">CREATE SEASON</button>
              </div>
            )}
            {typeof adminTab === 'number' && (
              <div className="bg-slate-900/60 p-8 rounded-3xl border border-blue-500/30 space-y-6">
                <div className="flex justify-between items-center"><h3 className="text-blue-400 font-bold">ASSIGN TEAMS</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 font-sans not-italic"><select value={selOwnerId} onChange={e => setSelOwnerId(Number(e.target.value))} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs text-white"><option value="">Owner</option>{owners.map(o=><option key={o.id} value={o.id}>{o.nickname}</option>)}</select><select value={selCategory} onChange={e => {setSelCategory(e.target.value as any); setSelRegion('ALL');}} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs text-white"><option value="ALL">All Cat</option><option value="CLUB">Club</option><option value="NATIONAL">National</option></select><select value={selTier} onChange={e => setSelTier(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs text-white"><option value="ALL">All Tier</option>{['S','A','B','C'].map(t=><option key={t} value={t}>{t}</option>)}</select><select value={selRegion} onChange={e => setSelRegion(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs text-white"><option value="ALL">All Region</option>{Array.from(new Set((selCategory==='ALL'?masterTeams:masterTeams.filter(m=>m.category===selCategory)).map(m=>m.region))).sort().map(r=><option key={r} value={r}>{r}</option>)}</select><button onClick={handleRandomDraw} className="bg-slate-800 border border-slate-600 rounded text-xs font-bold">🎲</button></div>
                <div className="flex gap-2"><select value={selTeamName} onChange={e => setSelTeamName(e.target.value)} className="flex-1 bg-slate-950 p-3 rounded border border-blue-500 text-blue-400 font-bold font-sans not-italic"><option value="">Select Team...</option>{stepTeams.map(mt => <option key={mt.id} value={mt.name}>{mt.name}</option>)}</select><button onClick={handleConfirmTeam} className="bg-blue-600 px-6 rounded font-bold">ASSIGN</button></div>
                <div className="pt-6 border-t border-slate-800"><p className="text-[10px] text-slate-500 mb-4 font-bold">CURRENT ROSTER ({(recordActiveS?.teams || []).length})</p><div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2">{(recordActiveS?.teams || []).map(t => (<span key={t.id} className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-[11px] flex items-center gap-2"><img src={t.logo} alt="team" className="w-5 h-5 object-contain bg-white rounded-full p-0.5" /><span className="text-white font-bold">{t.name}</span><span className="text-slate-500 text-[9px] uppercase">{t.tier} • {t.ownerName}</span></span>))}</div></div>
                <div className="border-t border-slate-800 pt-6 mt-4"><button onClick={handleGenerateSchedule} className="w-full bg-slate-800 text-emerald-400 border border-emerald-900 py-3 rounded-xl text-sm font-bold hover:bg-emerald-900/20 transition-all">📅 GENERATE SCHEDULE (Equal Round Distribution)</button></div>
              </div>
            )}
          </div>
        )}

        {/* ================= VIEW: TEAMS ================= */}
        {currentView === 'TEAMS' && (
          <div className="animate-in fade-in space-y-6">
            <div className="bg-slate-900/60 p-8 rounded-3xl border border-slate-800 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-sans not-italic"><select value={manageTab} onChange={e => setManageTab(e.target.value as any)} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs"><option value="ALL">All Cat</option><option value="CLUB">Club</option><option value="NATIONAL">National</option></select><select value={manageTier} onChange={e => setManageTier(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs"><option value="ALL">All Tier</option>{['S','A','B','C'].map(t=><option key={t} value={t}>{t}</option>)}</select><select value={manageRegion} onChange={e => setManageRegion(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs"><option value="ALL">All Region</option>{allManageRegions.map(r=><option key={r} value={r}>{r}</option>)}</select><input value={manageSearch} onChange={e => setManageSearch(e.target.value)} placeholder="Search..." className="bg-slate-950 p-3 rounded border border-slate-700 text-xs" /></div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">{filteredTeams.slice(0, visibleTeamCount).map(mt => (<div key={mt.id} onClick={() => {setEditTeamId(mt.id!); setManualTeam(mt); manualFormRef.current?.scrollIntoView({behavior:'smooth'})}} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-500 transition-all"><img src={mt.logo} alt="team" className="w-10 h-10 object-contain bg-white rounded-full p-1" /><p className="text-[10px] font-bold truncate w-full text-center">{mt.name}</p></div>))}</div>
              {visibleTeamCount < filteredTeams.length && (<button onClick={() => setVisibleTeamCount(prev => prev + 18)} className="w-full py-3 bg-slate-800 text-slate-400 font-bold text-xs rounded-xl hover:bg-slate-700 transition-colors">👇 LOAD MORE TEAMS ({filteredTeams.length - visibleTeamCount} remaining)</button>)}
            </div>
            <section ref={manualFormRef} className="p-8 rounded-3xl border bg-slate-900/60 border-slate-800">
              <h3 className="text-xl mb-4 font-bold">{editTeamId ? 'EDIT TEAM' : 'ADD TEAM'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 font-sans not-italic mb-4"><select value={manualTeam.category} onChange={e => setManualTeam({...manualTeam, category: e.target.value as any})} className="bg-slate-950 p-3 rounded border border-slate-700 text-sm"><option value="CLUB">Club</option><option value="NATIONAL">National</option></select><select value={manualTeam.tier} onChange={e => setManualTeam({...manualTeam, tier: e.target.value as any})} className="bg-slate-950 p-3 rounded border border-slate-700 text-sm"><option value="S">S</option><option value="A">A</option><option value="B">B</option><option value="C">C</option></select><input value={manualTeam.region} onChange={e => setManualTeam({...manualTeam, region: e.target.value})} placeholder="Region" className="bg-slate-950 p-3 rounded border border-slate-700 text-sm" /><input value={manualTeam.name} onChange={e => setManualTeam({...manualTeam, name: e.target.value})} placeholder="Name" className="bg-slate-950 p-3 rounded border border-slate-700 text-sm" /><input value={manualTeam.logo} onChange={e => setManualTeam({...manualTeam, logo: e.target.value})} placeholder="Logo URL" className="bg-slate-950 p-3 rounded border border-slate-700 text-sm" /></div>
              <button onClick={handleSaveMaster} className="w-full bg-emerald-600 py-3 rounded font-bold">SAVE</button>
            </section>
            <section className="bg-slate-900/60 p-8 rounded-3xl border border-orange-500/30">
              <h3 className="text-orange-400 font-bold mb-4">BULK IMPORT</h3>
              <textarea value={bulkInput} onChange={e => setBulkInput(e.target.value)} className="w-full h-24 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs mb-4" />
              <button onClick={handleBulk} className="w-full bg-orange-600 py-3 rounded font-bold">IMPORT</button>
            </section>
          </div>
        )}

        {/* 🔥 [UX] Modal: Match Edit (Responsive & Logic Updated) */}
        {editingMatch && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 w-full max-w-4xl space-y-6 my-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <h3 className="text-xl font-bold">MATCH RESULT</h3>
                <button onClick={() => setEditingMatch(null)} className="text-2xl">✕</button>
              </div>
              
              {/* Responsive Match Header & Input Area */}
              <div className="flex flex-col md:grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
                
                {/* Home Team Section */}
                <div className="flex flex-col items-center gap-3 w-full">
                  <span className="text-lg font-bold text-center truncate w-full px-2">{editingMatch.home}</span>
                  <img src={editingMatch.homeLogo} alt="home" className="w-20 h-20 bg-white rounded-full p-2 object-contain shadow-lg"/>
                  <input type="number" value={matchInputs.homeScore} onChange={e=>setMatchInputs({...matchInputs,homeScore:e.target.value})} className="w-24 h-16 text-4xl text-center bg-slate-950 rounded-xl border-2 border-slate-700 focus:border-blue-500 outline-none text-white font-bold" placeholder="0" />
                  
                  {/* Home Records Input */}
                  <div className="w-full space-y-2 mt-2">
                    <RecordInput label="Home Goals" type="homeScorer" colorClass="text-blue-400" inputValue={recordInputs.homeScorer} onInputChange={(t:any,f:any,v:any)=>setRecordInputs({...recordInputs,[t]:{...recordInputs.homeScorer,[f]:v}})} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.homeScorers} />
                    <RecordInput label="Home Assists" type="homeAssist" colorClass="text-blue-300" inputValue={recordInputs.homeAssist} onInputChange={(t:any,f:any,v:any)=>setRecordInputs({...recordInputs,[t]:{...recordInputs.homeAssist,[f]:v}})} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.homeAssists} />
                  </div>
                </div>

                {/* VS Divider (Hidden on small mobile if needed, or vertical on mobile) */}
                <div className="text-4xl font-black text-slate-700 hidden md:block">VS</div>
                <div className="md:hidden w-full h-px bg-slate-800 my-2"></div>

                {/* Away Team Section */}
                <div className="flex flex-col items-center gap-3 w-full">
                  <span className="text-lg font-bold text-center truncate w-full px-2">{editingMatch.away}</span>
                  <img src={editingMatch.awayLogo} alt="away" className="w-20 h-20 bg-white rounded-full p-2 object-contain shadow-lg"/>
                  <input type="number" value={matchInputs.awayScore} onChange={e=>setMatchInputs({...matchInputs,awayScore:e.target.value})} className="w-24 h-16 text-4xl text-center bg-slate-950 rounded-xl border-2 border-slate-700 focus:border-red-500 outline-none text-white font-bold" placeholder="0" />
                  
                  {/* Away Records Input */}
                  <div className="w-full space-y-2 mt-2">
                    <RecordInput label="Away Goals" type="awayScorer" colorClass="text-red-400" inputValue={recordInputs.awayScorer} onInputChange={(t:any,f:any,v:any)=>setRecordInputs({...recordInputs,[t]:{...recordInputs.awayScorer,[f]:v}})} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.awayScorers} />
                    <RecordInput label="Away Assists" type="awayAssist" colorClass="text-red-300" inputValue={recordInputs.awayAssist} onInputChange={(t:any,f:any,v:any)=>setRecordInputs({...recordInputs,[t]:{...recordInputs.awayAssist,[f]:v}})} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.awayAssists} />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <input value={matchInputs.youtube} onChange={e=>setMatchInputs({...matchInputs,youtube:e.target.value})} placeholder="YouTube Link (Optional)" className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm focus:border-emerald-500 outline-none mb-4"/>
                <button onClick={saveMatchResult} className="w-full bg-emerald-600 py-4 rounded-xl font-bold text-lg hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20">SAVE MATCH RESULT</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}