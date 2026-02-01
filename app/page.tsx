/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc } from 'firebase/firestore';
import { Season, Owner, League, MasterTeam, Team, Match, Round, Banner, MatchRecord, DEFAULT_LEAGUES, FALLBACK_IMG, getBannerContent, getSortedTeamsLogic, getTournamentStageName } from './types';
import { RecordInput } from './components/RecordInput';
import { AdminLeagueManager, AdminTeamManager } from './components/AdminTeamManagement'; 
import { AdminBannerManager } from './components/AdminBannerManager'; 

export default function FootballLeagueApp() {
  const [currentView, setCurrentView] = useState<'RANKING' | 'SCHEDULE' | 'HISTORY' | 'ADMIN' | 'TUTORIAL'>('RANKING');
  const [rankingTab, setRankingTab] = useState<'STANDINGS' | 'SCHEDULE' | 'OWNERS' | 'PLAYERS' | 'HIGHLIGHTS'>('STANDINGS');
  const [historyTab, setHistoryTab] = useState<'TEAMS' | 'OWNERS' | 'PLAYERS'>('TEAMS');
  const [adminTab, setAdminTab] = useState<number | 'NEW' | 'OWNER' | 'BANNER' | 'LEAGUES' | 'TEAMS'>('NEW');
  
  const [viewSeasonId, setViewSeasonId] = useState<number>(0); 
  const [currentTime, setCurrentTime] = useState<string>('');
  
  // Data
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerIdx, setBannerIdx] = useState(0);

  // Touch
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // New Season Input
  const [inputSeasonName, setInputSeasonName] = useState('');
  const [inputSeasonType, setInputSeasonType] = useState<'LEAGUE' | 'TOURNAMENT'>('LEAGUE');
  const [inputLeagueMode, setInputLeagueMode] = useState<'SINGLE' | 'DOUBLE'>('SINGLE');
  const [inputTotalPrize, setInputTotalPrize] = useState(100000);
  // 🔥 [Update] 어시스트 상금 추가
  const [prizes, setPrizes] = useState({ first: 50000, second: 20000, third: 10000, scorer: 10000, assist: 10000 });
  const [isAutoPrize, setIsAutoPrize] = useState(true);

  // Admin & Team Assignment
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPhoto, setNewOwnerPhoto] = useState('');
  const [editOwnerId, setEditOwnerId] = useState<string | null>(null);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [selOwnerId, setSelOwnerId] = useState<number | ''>('');
  const [selTeamName, setSelTeamName] = useState<string>('');

  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [matchInputs, setMatchInputs] = useState({ homeScore:'', awayScore:'', youtube:'' });
  const [recordInputs, setRecordInputs] = useState({ homeScorer:{name:'',count:'1'}, awayScorer:{name:'',count:'1'}, homeAssist:{name:'',count:'1'}, awayAssist:{name:'',count:'1'} });

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date().toLocaleString()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (banners.length === 0) return;
    const currentBanner = banners[bannerIdx];
    if(!currentBanner) return;
    const isVideo = currentBanner.url.includes('youtube') || currentBanner.url.includes('youtu.be');
    const delay = isVideo ? 15000 : 5000;
    const t = setTimeout(() => setBannerIdx((prev) => (prev + 1) % banners.length), delay);
    return () => clearTimeout(t);
  }, [bannerIdx, banners]);

  // 🔥 [Update] 상금 자동 계산 로직 (50/20/10/10/10)
  useEffect(() => { 
    if (isAutoPrize) {
      setPrizes({ 
        first: Math.floor(inputTotalPrize * 0.5), 
        second: Math.floor(inputTotalPrize * 0.2), 
        third: Math.floor(inputTotalPrize * 0.1), 
        scorer: Math.floor(inputTotalPrize * 0.1),
        assist: Math.floor(inputTotalPrize * 0.1) 
      }); 
    }
  }, [inputTotalPrize, isAutoPrize]);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "users"), orderBy("id", "asc")), s => setOwners(s.docs.map(d => ({...d.data(), docId: d.id} as Owner))));
    const u2 = onSnapshot(collection(db, "master_teams"), s => setMasterTeams(s.docs.map(d => ({id:d.id, ...d.data()} as MasterTeam))));
    const u3 = onSnapshot(query(collection(db, "seasons"), orderBy("id", "desc")), s => { 
        const d = s.docs.map(doc => doc.data() as Season); setSeasons(d); 
        if(d.length > 0 && viewSeasonId === 0) setViewSeasonId(d[0].id);
    });
    const u4 = onSnapshot(collection(db, "banners"), s => setBanners(s.docs.map(d => ({id:d.id, ...d.data()} as Banner))));
    const u5 = onSnapshot(collection(db, "leagues"), s => setLeagues(s.docs.map(d => ({id:d.id, ...d.data()} as League))));
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  const activeRankingData = useMemo(() => {
    const targetSeason = seasons.find(s => s.id === viewSeasonId);
    if(!targetSeason?.teams) return { teams: [], owners: [], players: [], highlights: [] };
    const teamStats = new Map<string, Team>();
    targetSeason.teams.forEach(t => teamStats.set(t.name, { ...t, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 }));
    const pMap = new Map<string, any>();
    
    targetSeason.rounds?.forEach(r => r.matches.forEach(m => {
      if(m.status === 'FINISHED' || m.status === 'BYE') {
        const h = Number(m.homeScore || 0), a = Number(m.awayScore || 0);
        const ht = teamStats.get(m.home), at = teamStats.get(m.away);
        if(ht) { ht.gf+=h; ht.ga+=a; ht.gd+=(h-a); if(h>a) { ht.win++; ht.points+=3; } else if(h<a) { ht.loss++; } else { ht.draw++; ht.points++; } }
        if(at && m.away !== 'BYE (부전승)') { at.gf+=a; at.ga+=h; at.gd+=(a-h); if(a>h) { at.win++; at.points+=3; } else if(a<h) { at.loss++; } else { at.draw++; at.points++; } }
      }
      if(m.status === 'FINISHED') {
        [...m.homeScorers, ...m.awayScorers].forEach(s => { const k=`${s.name}-${m.homeOwner}`; if(!pMap.has(k)) pMap.set(k, {name:s.name, team:m.home, owner:m.homeOwner, goals:0, assists:0}); pMap.get(k).goals+=s.count; });
        [...m.homeAssists, ...m.awayAssists].forEach(s => { const k=`${s.name}-${m.homeOwner}`; if(!pMap.has(k)) pMap.set(k, {name:s.name, team:m.home, owner:m.homeOwner, goals:0, assists:0}); pMap.get(k).assists+=s.count; });
      }
    }));

    const teams = Array.from(teamStats.values()).sort((a,b) => b.points - a.points || b.gd - a.gd).map((t, i) => ({ ...t, rank: i+1, currentPrize: i===0?targetSeason.prizes.first:i===1?targetSeason.prizes.second:i===2?targetSeason.prizes.third:0 }));
    return { teams, owners: [], players: Array.from(pMap.values()), highlights: targetSeason.rounds?.flatMap(r => r.matches).filter(m => m.youtubeUrl) || [] };
  }, [seasons, viewSeasonId]);

  const { assignmentTeams } = useMemo(() => {
    const recordActiveS = seasons.find(s => s.id === adminTab);
    const activeTeamNames = (recordActiveS?.teams || []).map(at => at.name);
    const available = masterTeams.filter(t => !activeTeamNames.includes(t.name));
    return { assignmentTeams: getSortedTeamsLogic(available, '') };
  }, [masterTeams, seasons, adminTab]);

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const handleTouchEnd = () => { if (!touchStart || !touchEnd) return; const dist = touchStart - touchEnd; if (dist > 50) setBannerIdx((p) => (p + 1) % banners.length); if (dist < -50) setBannerIdx((p) => (p - 1 + banners.length) % banners.length); setTouchStart(0); setTouchEnd(0); };

  const handleRecordInputChange = (type: string, field: string, value: string) => { setRecordInputs(prev => ({ ...prev, [type]: { ...(prev as any)[type], [field]: value } })); };
  const handleSaveOwner = async () => { if(newOwnerName) { if(editOwnerId) await updateDoc(doc(db,"users",editOwnerId),{nickname:newOwnerName,photo:newOwnerPhoto}); else await addDoc(collection(db,"users"),{id:Date.now(),nickname:newOwnerName,photo:newOwnerPhoto}); setNewOwnerName(''); setNewOwnerPhoto(''); setEditOwnerId(null); }};
  const handleEditOwnerClick = (o: Owner) => { setEditOwnerId(o.docId!); setNewOwnerName(o.nickname); setNewOwnerPhoto(o.photo); };
  
  // 🔥 [Update] 게임 생성 완료 후 스케줄 탭 이동
  const handleCreateSeason = async () => { 
    if(inputSeasonName) { 
      if(confirm("신규 게임을 생성하시겠습니까?")) {
        const id=Date.now(); 
        await setDoc(doc(db,"seasons",String(id)),{ id, name:inputSeasonName, type:inputSeasonType, leagueMode:inputSeasonType==='LEAGUE'?inputLeagueMode:'SINGLE', isActive:true, teams:[], rounds:[], prizes:{total:inputTotalPrize, ...prizes} }); 
        setAdminTab(id); setViewSeasonId(id); setInputSeasonName(''); 
        setCurrentView('SCHEDULE'); // 이동
      }
    } else { alert("시즌 이름을 입력해주세요."); }
  };
  
  const handleSaveBanner = async () => { if(bannerTitle && bannerUrl) { await addDoc(collection(db,"banners"),{title:bannerTitle,url:bannerUrl,order:Date.now()}); setBannerTitle(''); setBannerUrl(''); }};
  const handleDeleteBanner = async (id:string) => { if(confirm("배너 삭제?")) await deleteDoc(doc(db,"banners",id)); };
  
  const handleConfirmTeam = async () => { if(selOwnerId && selTeamName) { const m = masterTeams.find(t=>t.name===selTeamName); const o = owners.find(u=>u.id===Number(selOwnerId)); if(m && o) { const nt: Team = {id:Date.now(), seasonId:Number(adminTab), name:m.name, logo:m.logo, ownerName:o.nickname, region:m.region, tier:m.tier, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0}; await updateDoc(doc(db,"seasons",String(adminTab)), {teams:[...(seasons.find(s=>s.id===adminTab)?.teams||[]), nt]}); } } };
  const handleRemoveTeamFromSeason = async (tid:number) => { if(confirm("제외하시겠습니까?")) await updateDoc(doc(db,"seasons",String(adminTab)), {teams:seasons.find(s=>s.id===adminTab)?.teams?.filter(t=>t.id!==tid)}); };
  
  // 🔥 [Algorithm] Advanced Schedule Generator
  const handleGenerateSchedule = async () => {
    const s = seasons.find(s => s.id === adminTab);
    if(!s || (s.teams||[]).length < 2) return alert("팀이 부족합니다 (최소 2팀)");
    if(!confirm("기존 스케줄이 초기화되고 새로 생성됩니다. 진행하시겠습니까?")) return;

    // 1. Shuffle
    let teams = [...(s.teams||[])].sort(() => Math.random() - 0.5);
    const rounds: Round[] = [];

    // --- [TOURNAMENT LOGIC] ---
    if(s.type === 'TOURNAMENT') {
        // [Constraint Check] 동일 오너 대진 최소화 (Shuffle 후 인접 인덱스 체크)
        for(let i=0; i<teams.length-1; i+=2) {
            if(teams[i].ownerName === teams[i+1]?.ownerName) {
                // Swap candidate search
                for(let j=i+2; j<teams.length; j++) {
                    if(teams[j].ownerName !== teams[i].ownerName) {
                        const temp = teams[i+1]; teams[i+1] = teams[j]; teams[j] = temp;
                        break;
                    }
                }
            }
        }

        const nextPow2 = Math.pow(2, Math.ceil(Math.log2(teams.length)));
        const matchCount = nextPow2 / 2;
        let matches: Match[] = [];
        
        for(let i=0; i<matchCount; i++) {
           const h = teams[i*2];
           const a = teams[i*2+1];
           const stageName = getTournamentStageName(nextPow2, matchCount); // Use Helper
           if (!a) {
             matches.push({ 
                 id: `${s.id}_R1_M${i}`, seasonId: s.id, home: h.name, away: 'BYE (부전승)', homeLogo: h.logo, awayLogo: FALLBACK_IMG, homeOwner: h.ownerName, awayOwner: '-', homeScore: '1', awayScore: '0', 
                 homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'BYE', youtubeUrl: '', stage: stageName, matchLabel: `Match ${i+1}`, nextMatchId: `${s.id}_R2_M${Math.floor(i/2)}` 
             });
           } else {
             matches.push({ 
                 id: `${s.id}_R1_M${i}`, seasonId: s.id, home: h.name, away: a.name, homeLogo: h.logo, awayLogo: a.logo, homeOwner: h.ownerName, awayOwner: a.ownerName, homeScore: '', awayScore: '', 
                 homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'UPCOMING', youtubeUrl: '', stage: stageName, matchLabel: `Match ${i+1}`, nextMatchId: `${s.id}_R2_M${Math.floor(i/2)}` 
             });
           }
        }
        rounds.push({ round: 1, matches, seasonId: s.id, name: getTournamentStageName(nextPow2, matchCount) });

        let rIdx = 2; let currentCount = matchCount / 2;
        while(currentCount >= 0.5) {
            let nextMatches: Match[] = [];
            const stageName = getTournamentStageName(nextPow2, currentCount);
            for(let i=0; i < Math.ceil(currentCount); i++) {
                nextMatches.push({ id: `${s.id}_R${rIdx}_M${i}`, seasonId: s.id, home: 'TBD', away: 'TBD', homeLogo: FALLBACK_IMG, awayLogo: FALLBACK_IMG, homeOwner: '-', awayOwner: '-', homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'UPCOMING', youtubeUrl: '', stage: stageName, matchLabel: `Match ${i+1}`, nextMatchId: currentCount > 0.5 ? `${s.id}_R${rIdx+1}_M${Math.floor(i/2)}` : undefined });
            }
            rounds.push({ round: rIdx, matches: nextMatches, seasonId: s.id, name: stageName });
            if(currentCount === 0.5) break; currentCount /= 2; rIdx++;
        }
    } 
    // --- [LEAGUE LOGIC] ---
    else {
        if(teams.length % 2 !== 0) teams.push({id:0, seasonId:0, name:'BYE', logo:FALLBACK_IMG, ownerName:'-', region:'', tier:'', win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0});
        const numRounds = teams.length - 1; const half = teams.length / 2;
        let tempTeams = [...teams];
        
        let allRoundMatches = [];
        for(let r=0; r<numRounds; r++) {
            let roundMatches: Match[] = [];
            for(let i=0; i<half; i++) {
                const home = tempTeams[i], away = tempTeams[teams.length - 1 - i];
                if(home.name !== 'BYE' && away.name !== 'BYE') {
                    // [Constraint] 오너 충돌 체크 (단순 경고 혹은 로직 - 여기서는 그대로 생성하되 UI에서 오너 표시)
                    roundMatches.push({ id: `${s.id}_R${r+1}_M${i}`, seasonId: s.id, home: home.name, away: away.name, homeLogo: home.logo, awayLogo: away.logo, homeOwner: home.ownerName, awayOwner: away.ownerName, homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'UPCOMING', youtubeUrl: '', stage: `Round ${r+1}`, matchLabel: `Game ${i+1}` });
                }
            }
            allRoundMatches.push(roundMatches);
            // Circle Method Rotation
            tempTeams.splice(1, 0, tempTeams.pop()!);
        }
        allRoundMatches.forEach((rm, idx) => rounds.push({round: idx+1, matches: rm, seasonId: s.id, name: `Round ${idx+1}`}));
        
        // Double Round Logic (Home & Away)
        if(s.leagueMode === 'DOUBLE') {
            const firstHalfLen = rounds.length;
            allRoundMatches.forEach((rm, idx) => {
                const returnMatches = rm.map(m => ({ ...m, id: m.id + '_return', home: m.away, away: m.home, homeLogo: m.awayLogo, awayLogo: m.homeLogo, homeOwner: m.awayOwner, awayOwner: m.homeOwner, stage: `Round ${firstHalfLen + idx + 1}` }));
                rounds.push({round: firstHalfLen + idx + 1, matches: returnMatches, seasonId: s.id, name: `Round ${firstHalfLen + idx + 1}`});
            });
        }
    }
    await updateDoc(doc(db, "seasons", String(adminTab)), { rounds });
    alert(`스케줄 생성 완료!`);
  };

  const handleMatchClick = (m: Match) => { setEditingMatch({...m}); setMatchInputs({homeScore:m.homeScore||'0',awayScore:m.awayScore||'0',youtube:m.youtubeUrl}); };
  const saveMatchResult = async () => {
    if(!editingMatch) return;
    const s = seasons.find(se => se.id === editingMatch.seasonId);
    if(s && s.rounds) {
       let newRounds = [...s.rounds];
       newRounds = newRounds.map(r => ({ ...r, matches: r.matches.map(m => m.id === editingMatch.id ? { ...editingMatch, homeScore: matchInputs.homeScore, awayScore: matchInputs.awayScore, youtubeUrl: matchInputs.youtube, status: 'FINISHED' as const } : m) }));
       if (s.type === 'TOURNAMENT' && editingMatch.nextMatchId) {
          const winner = Number(matchInputs.homeScore) > Number(matchInputs.awayScore) ? {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner} : {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner};
          newRounds = newRounds.map(r => ({ ...r, matches: r.matches.map(m => { if(m.id === editingMatch.nextMatchId) { const isHomeSlot = Number(editingMatch.id.split('_M')[1]) % 2 === 0; return isHomeSlot ? { ...m, home: winner.name, homeLogo: winner.logo, homeOwner: winner.owner } : { ...m, away: winner.name, awayLogo: winner.logo, awayOwner: winner.owner }; } return m; }) }));
       }
       await updateDoc(doc(db, "seasons", String(s.id)), { rounds: newRounds });
       setEditingMatch(null);
    }
  };
  
  const handleRecordAdd = (type: string) => {
    if(!editingMatch) return;
    const k = type as keyof typeof recordInputs;
    if(!recordInputs[k].name) return;
    const count = Number(recordInputs[k].count);
    if(type === 'homeScorer') setMatchInputs(p => ({...p, homeScore: String(Number(p.homeScore||0) + count) }));
    if(type === 'awayScorer') setMatchInputs(p => ({...p, awayScore: String(Number(p.awayScore||0) + count) }));
    const f = type + 's' as keyof Match;
    const list = (editingMatch[f] as MatchRecord[]) || [];
    setEditingMatch({ ...editingMatch, [f]: [...list, { id: Date.now(), name: recordInputs[k].name, count }] });
    setRecordInputs(p => ({ ...p, [k]: {name:'', count:'1'} }));
  };

  const handleRecordRemove = (type: string, id: number) => {
    if(!editingMatch) return;
    const f = type + 's' as keyof Match;
    const list = (editingMatch[f] as MatchRecord[]) || [];
    const item = list.find(r => r.id === id);
    if(item) {
      if(type === 'homeScorer') setMatchInputs(p => ({...p, homeScore: String(Math.max(0, Number(p.homeScore||0) - item.count)) }));
      if(type === 'awayScorer') setMatchInputs(p => ({...p, awayScore: String(Math.max(0, Number(p.awayScore||0) - item.count)) }));
    }
    setEditingMatch({ ...editingMatch, [f]: list.filter(r => r.id !== id) });
  };

  const handleDeleteSeason = async () => { if(confirm("시즌 삭제?")) { await deleteDoc(doc(db,"seasons",String(adminTab))); setAdminTab('NEW'); setViewSeasonId(0); } };
  const renderBanners = () => banners.map((b, i) => (<div key={b.id || i} className={`absolute inset-0 transition-opacity duration-1000 ${i === bannerIdx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>{getBannerContent(b)}</div>));

  return (
    <div className="min-h-screen bg-[#020617] text-white font-black italic tracking-tighter overflow-x-hidden pb-20">
      <div className="w-full h-[225px] md:h-[330px] relative border-b border-slate-800 shadow-2xl overflow-hidden bg-black" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {renderBanners()}
        <div className="absolute bottom-6 left-6 uppercase z-20 pointer-events-none">
          <h1 className="text-2xl md:text-4xl text-white font-black italic">ⓔFOOTBALL SUPER LEAGUE™</h1>
          <p className="text-emerald-400 text-[10px] md:text-xs font-sans not-italic tracking-widest mt-1">ver. P_01_02_01</p>
        </div>
      </div>
      
      <div className="flex justify-center flex-wrap gap-2 mt-6 mb-8 px-4">
        {['RANKING', 'SCHEDULE', 'HISTORY', 'TUTORIAL', 'ADMIN'].map(t => (
          <button key={t} onClick={() => setCurrentView(t as any)} className={`px-6 py-3 rounded-xl border text-xs transition-all shadow-lg ${currentView === t ? 'bg-blue-600 border-blue-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>{t}</button>
        ))}
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-8 space-y-8">
        {currentView === 'RANKING' && (
           <div className="space-y-6 animate-in fade-in">
              <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col gap-4">
                <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700">{seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <div className="flex gap-2 overflow-x-auto">{['STANDINGS', 'SCHEDULE', 'OWNERS', 'PLAYERS', 'HIGHLIGHTS'].map(sub => <button key={sub} onClick={() => setRankingTab(sub as any)} className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-800 text-slate-500">{sub}</button>)}</div>
              </div>
              {rankingTab === 'STANDINGS' && (
                <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                  <table className="w-full text-left text-xs uppercase border-collapse"><thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800"><tr><th className="p-4 w-8">#</th><th className="p-4">Club</th><th className="p-4 text-center">Pts</th></tr></thead><tbody>{activeRankingData.teams.map((t, i) => (<tr key={t.id} className="border-b border-slate-800/50"><td className="p-4 text-center">{i+1}</td><td className="p-4 flex items-center gap-3"><img src={t.logo} className="w-8 h-8 rounded-full bg-white object-cover p-0.5" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/><span>{t.name}</span></td><td className="p-4 text-center text-emerald-400 font-bold">{t.points}</td></tr>))}</tbody></table>
                </div>
              )}
               {rankingTab === 'SCHEDULE' && (
                 <div className="space-y-4">
                    {seasons.find(s=>s.id===viewSeasonId)?.rounds?.map(r => (
                        <div key={r.round} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <h3 className="text-xs text-slate-500 font-bold mb-2">{r.name}</h3>
                            <div className="grid gap-2">
                                {r.matches.map(m => (
                                    <div key={m.id} className="flex justify-between items-center bg-black p-3 rounded-lg" onClick={()=>handleMatchClick(m)}>
                                        <div className="flex flex-col items-center w-1/3"><img src={m.homeLogo} className="w-8 h-8 rounded-full bg-white p-0.5"/><span className="text-[10px] mt-1">{m.home}</span></div>
                                        <div className="flex flex-col items-center"><span className="text-[9px] text-slate-500 mb-1">{m.matchLabel}</span><div className="text-xl font-bold">{m.status==='FINISHED' ? `${m.homeScore}:${m.awayScore}` : 'VS'}</div></div>
                                        <div className="flex flex-col items-center w-1/3"><img src={m.awayLogo} className="w-8 h-8 rounded-full bg-white p-0.5"/><span className="text-[10px] mt-1">{m.away}</span></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                 </div>
               )}
           </div>
        )}
        {currentView === 'ADMIN' && (
           <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 animate-in fade-in">
             <select value={adminTab} onChange={(e) => setAdminTab(e.target.value === 'NEW' || e.target.value === 'OWNER' || e.target.value === 'BANNER' || e.target.value === 'LEAGUES' || e.target.value === 'TEAMS' ? e.target.value : Number(e.target.value))} className="w-full bg-slate-950 p-4 rounded-xl border border-slate-700 text-sm mb-4">
                <option value="NEW">➕ New Season</option>
                <option value="LEAGUES">🏳️ League Management</option>
                <option value="TEAMS">🛡️ Team Management</option>
                <option value="OWNER">👤 Owner Management</option>
                <option value="BANNER">🖼️ Banner Management</option>
                <optgroup label="Seasons">{seasons.map(s => <option key={s.id} value={s.id}>🏆 {s.name}</option>)}</optgroup>
             </select>

             {adminTab === 'LEAGUES' && <AdminLeagueManager leagues={leagues} masterTeams={masterTeams} />}
             {adminTab === 'TEAMS' && <AdminTeamManager leagues={leagues} masterTeams={masterTeams} />}
             {adminTab === 'BANNER' && <AdminBannerManager banners={banners} />}

             {adminTab === 'NEW' && (
                 <div className="space-y-4">
                     <div className="space-y-1">
                         <label className="text-xs text-slate-400 font-bold">1. Season Name</label>
                         <input value={inputSeasonName} onChange={e=>setInputSeasonName(e.target.value)} placeholder="예: 2026 Season 1" className="bg-slate-800 w-full p-4 rounded border border-slate-700"/>
                     </div>
                     <div className="space-y-1">
                         <label className="text-xs text-slate-400 font-bold">2. Type & Mode</label>
                         <div className="flex gap-2">
                             <select value={inputSeasonType} onChange={e=>setInputSeasonType(e.target.value as any)} className="bg-slate-800 p-4 rounded border border-slate-700 flex-1"><option value="LEAGUE">LEAGUE</option><option value="TOURNAMENT">TOURNAMENT</option></select>
                             {inputSeasonType === 'LEAGUE' && <select value={inputLeagueMode} onChange={e=>setInputLeagueMode(e.target.value as any)} className="bg-slate-800 p-4 rounded border border-slate-700 flex-1"><option value="SINGLE">SINGLE</option><option value="DOUBLE">DOUBLE</option></select>}
                         </div>
                     </div>
                     <div className="space-y-1">
                         <label className="text-xs text-slate-400 font-bold flex justify-between">3. Prizes <span className="text-emerald-500 cursor-pointer" onClick={()=>setIsAutoPrize(!isAutoPrize)}>{isAutoPrize?'⚡ Auto (50/20/10)':'✏️ Manual'}</span></label>
                         <input type="number" value={inputTotalPrize} onChange={e=>{setInputTotalPrize(Number(e.target.value)); setIsAutoPrize(true);}} className="bg-slate-800 w-full p-4 rounded border border-slate-700 text-right text-lg font-bold text-emerald-400 mb-2"/>
                         <div className="grid grid-cols-2 gap-2 text-xs">
                             <div className="bg-slate-950 p-2 rounded flex justify-between"><span>🥇 1st (50%)</span><span>{prizes.first.toLocaleString()}</span></div>
                             <div className="bg-slate-950 p-2 rounded flex justify-between"><span>🥈 2nd (20%)</span><span>{prizes.second.toLocaleString()}</span></div>
                             <div className="bg-slate-950 p-2 rounded flex justify-between"><span>🥉 3rd (10%)</span><span>{prizes.third.toLocaleString()}</span></div>
                             <div className="bg-slate-950 p-2 rounded flex justify-between"><span>👟 Score (10%)</span><span>{prizes.scorer.toLocaleString()}</span></div>
                             <div className="bg-slate-950 p-2 rounded flex justify-between"><span>🅰️ Assist (10%)</span><span>{prizes.assist.toLocaleString()}</span></div>
                         </div>
                         {!isAutoPrize && <div className="text-[10px] text-orange-400">* 수동 모드: 상금 배분을 직접 입력하려면 위 값을 무시하고 내부 로직을 수정해야 합니다. (현재 자동 계산 우선)</div>}
                     </div>
                     <button onClick={handleCreateSeason} className="w-full bg-emerald-600 py-4 rounded-xl font-bold">Create Season</button>
                 </div>
             )}
             
             {typeof adminTab === 'number' && (
                <div className="space-y-4">
                   <div className="grid grid-cols-5 gap-2"><select value={selOwnerId} onChange={e=>setSelOwnerId(Number(e.target.value))} className="bg-slate-950 p-2 text-xs"><option>Owner</option>{owners.map(o=><option key={o.id} value={o.id}>{o.nickname}</option>)}</select><select value={selTeamName} onChange={e=>setSelTeamName(e.target.value)} className="col-span-3 bg-slate-950 p-2 text-xs"><option>Team</option>{assignmentTeams.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}</select><button onClick={handleConfirmTeam} className="bg-blue-600 rounded text-xs font-bold">Add</button></div>
                   <button onClick={handleGenerateSchedule} className="w-full bg-blue-600 py-4 rounded-xl font-bold">Generate Schedule</button>
                   <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">{seasons.find(s=>s.id===adminTab)?.teams?.map(t=><span key={t.id} className="text-xs bg-slate-950 p-1 rounded flex justify-between">{t.name} <button onClick={()=>handleRemoveTeamFromSeason(t.id)} className="text-red-500">x</button></span>)}</div>
                   <button onClick={handleDeleteSeason} className="w-full bg-red-900/50 py-3 rounded text-red-500 text-xs">Delete Season</button>
                </div>
             )}

             {adminTab === 'OWNER' && <div className="flex gap-2"><input value={newOwnerName} onChange={e=>setNewOwnerName(e.target.value)} placeholder="Owner Name" className="bg-slate-950 p-3 rounded w-full"/><input value={newOwnerPhoto} onChange={e=>setNewOwnerPhoto(e.target.value)} placeholder="Photo URL" className="bg-slate-950 p-3 rounded w-full"/><button onClick={handleSaveOwner} className="bg-purple-600 px-6 rounded font-bold">Save</button></div>}
             {adminTab === 'OWNER' && <div className="grid grid-cols-2 gap-2 mt-4">{owners.map(o => <div key={o.id} onClick={()=>handleEditOwnerClick(o)} className="p-2 bg-black rounded flex items-center gap-2 cursor-pointer"><img src={o.photo} className="w-8 h-8 rounded-full" /><span>{o.nickname}</span></div>)}</div>}
           </div>
        )}
      </main>

      {editingMatch && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] p-4">
           <div className="bg-slate-900 p-6 rounded-3xl border border-slate-700 w-full max-w-5xl relative">
              <button onClick={() => setEditingMatch(null)} className="absolute top-4 right-4 text-white">✕</button>
              <div className="flex justify-center mb-6 text-xl font-bold italic">{editingMatch.home} vs {editingMatch.away}</div>
              <div className="grid grid-cols-3 gap-4">
                 <RecordInput type="homeScorer" inputValue={recordInputs.homeScorer} onInputChange={handleRecordInputChange} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.homeScorers} label="Home Goals" colorClass="text-blue-400" />
                 <div className="flex flex-col justify-center items-center gap-4"><div className="flex gap-2"><input type="number" value={matchInputs.homeScore} onChange={e=>setMatchInputs({...matchInputs, homeScore:e.target.value})} className="w-16 h-16 text-center text-2xl bg-black rounded" /><input type="number" value={matchInputs.awayScore} onChange={e=>setMatchInputs({...matchInputs, awayScore:e.target.value})} className="w-16 h-16 text-center text-2xl bg-black rounded" /></div><input value={matchInputs.youtube} onChange={e=>setMatchInputs({...matchInputs,youtube:e.target.value})} placeholder="YouTube Link" className="w-full bg-black p-2 rounded text-center text-xs"/><button onClick={saveMatchResult} className="bg-emerald-600 px-6 py-2 rounded font-bold">SAVE</button></div>
                 <RecordInput type="awayScorer" inputValue={recordInputs.awayScorer} onInputChange={handleRecordInputChange} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.awayScorers} label="Away Goals" colorClass="text-red-400" />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                 <RecordInput type="homeAssist" inputValue={recordInputs.homeAssist} onInputChange={handleRecordInputChange} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.homeAssists} label="Home Assists" colorClass="text-blue-300" />
                 <RecordInput type="awayAssist" inputValue={recordInputs.awayAssist} onInputChange={handleRecordInputChange} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.awayAssists} label="Away Assists" colorClass="text-red-300" />
              </div>
           </div>
        </div>
      )}
    </div>
  );
}