/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc } from 'firebase/firestore';
import { Season, Owner, League, MasterTeam, Team, Match, Round, Banner, MatchRecord, DEFAULT_LEAGUES, FALLBACK_IMG, getBannerContent, getSortedTeamsLogic, getTournamentStageName, getSortedLeagues, getTierBadgeColor } from './types';
import { RecordInput } from './components/RecordInput';
import { AdminLeagueManager, AdminTeamManager } from './components/AdminTeamManagement'; 
import { AdminBannerManager } from './components/AdminBannerManager'; 

export default function FootballLeagueApp() {
  const [currentView, setCurrentView] = useState<'RANKING' | 'SCHEDULE' | 'HISTORY' | 'ADMIN' | 'TUTORIAL'>('RANKING');
  const [rankingTab, setRankingTab] = useState<'STANDINGS' | 'SCHEDULE' | 'OWNERS' | 'PLAYERS' | 'HIGHLIGHTS'>('STANDINGS');
  const [historyTab, setHistoryTab] = useState<'OWNERS' | 'TEAMS'>('OWNERS');
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
  const [prizes, setPrizes] = useState({ first: 50000, second: 20000, third: 10000, scorer: 10000, assist: 10000 });
  const [isAutoPrize, setIsAutoPrize] = useState(true);

  // Admin Basic
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPhoto, setNewOwnerPhoto] = useState('');
  const [editOwnerId, setEditOwnerId] = useState<string | null>(null);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  // Assignments Filters
  const [selOwnerId, setSelOwnerId] = useState<number | ''>('');
  const [assignCategory, setAssignCategory] = useState<'CLUB' | 'NATIONAL' | 'ALL'>('ALL'); 
  const [assignRegion, setAssignRegion] = useState<string>('ALL'); 
  const [assignTier, setAssignTier] = useState<string>('ALL'); 
  const [assignSearch, setAssignSearch] = useState<string>(''); 

  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [matchInputs, setMatchInputs] = useState({ homeScore:'', awayScore:'', youtube:'' });
  const [recordInputs, setRecordInputs] = useState({ homeScorer:{name:'',count:'1'}, awayScorer:{name:'',count:'1'}, homeAssist:{name:'',count:'1'}, awayAssist:{name:'',count:'1'} });

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date().toLocaleString()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (banners.length === 0) return;
    const t = setTimeout(() => setBannerIdx((prev) => (prev + 1) % banners.length), 5000);
    return () => clearTimeout(t);
  }, [bannerIdx, banners]);

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

  // --- Memos: Current Ranking ---
  const activeRankingData = useMemo(() => {
    const targetSeason = seasons.find(s => s.id === viewSeasonId);
    if(!targetSeason?.teams) return { teams: [], owners: [], players: [], highlights: [] };
    
    const teamStats = new Map<string, Team>();
    targetSeason.teams.forEach(t => teamStats.set(t.name, { ...t, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 }));
    const playerStats = new Map<string, any>(); 
    
    targetSeason.rounds?.forEach(r => r.matches.forEach(m => {
      if(m.status === 'FINISHED' || m.status === 'BYE') {
        const h = Number(m.homeScore || 0), a = Number(m.awayScore || 0);
        const ht = teamStats.get(m.home);
        const at = teamStats.get(m.away);
        if(ht) { ht.gf+=h; ht.ga+=a; ht.gd = ht.gf - ht.ga; if(h>a) { ht.win++; ht.points+=3; } else if(h<a) { ht.loss++; } else { ht.draw++; ht.points++; } }
        if(at && m.away !== 'BYE (부전승)') { at.gf+=a; at.ga+=h; at.gd = at.gf - at.ga; if(a>h) { at.win++; at.points+=3; } else if(a<h) { at.loss++; } else { at.draw++; at.points++; } }
      }
      if(m.status === 'FINISHED') {
        [...m.homeScorers, ...m.awayScorers].forEach(s => { const k = `${s.name}-${m.home}-${m.seasonId}`; if(!playerStats.has(k)) playerStats.set(k, {name:s.name, team: m.homeScorers.includes(s)?m.home:m.away, owner: m.homeScorers.includes(s)?m.homeOwner:m.awayOwner, goals:0, assists:0}); playerStats.get(k).goals += s.count; });
        [...m.homeAssists, ...m.awayAssists].forEach(s => { const k = `${s.name}-${m.home}-${m.seasonId}`; if(!playerStats.has(k)) playerStats.set(k, {name:s.name, team: m.homeAssists.includes(s)?m.home:m.away, owner: m.homeAssists.includes(s)?m.homeOwner:m.awayOwner, goals:0, assists:0}); playerStats.get(k).assists += s.count; });
      }
    }));

    const teams = Array.from(teamStats.values()).sort((a,b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf).map((t, i) => ({ 
        ...t, rank: i+1, 
        currentPrize: i===0?targetSeason.prizes.first:i===1?targetSeason.prizes.second:i===2?targetSeason.prizes.third:0 
    }));

    // Owners with W/D/L
    const ownerMap = new Map<string, any>();
    teams.forEach(t => { 
        if(!ownerMap.has(t.ownerName)) ownerMap.set(t.ownerName, {name:t.ownerName, win:0, draw:0, loss:0, points:0, prize:0, teamsCount:0}); 
        const o = ownerMap.get(t.ownerName); 
        o.win+=t.win; o.draw+=t.draw; o.loss+=t.loss; o.points+=t.points; o.prize+=(t.currentPrize||0); o.teamsCount++;
    });

    const highlights = targetSeason.rounds?.flatMap(r => r.matches).filter(m => m.youtubeUrl) || [];

    return { 
        teams, 
        owners: Array.from(ownerMap.values()).sort((a,b)=>b.points-a.points || b.prize-a.prize), 
        players: Array.from(playerStats.values()).sort((a,b) => b.goals - a.goals || b.assists - a.assists), 
        highlights 
    };
  }, [seasons, viewSeasonId]);

  // 🔥 [Core Logic] History Aggregation (All Time)
  const historyData = useMemo(() => {
      const ownerHist = new Map<string, any>(); // { name, win, draw, loss, points, prize, titles }
      // const teamHist = new Map<string, any>(); // (If needed later)

      seasons.forEach(s => {
          if(!s.teams) return;
          // Calculate rank for this season to find Champion
          // Re-calculate basic stats per season since `teams` in DB might be initial state (better to recalc from rounds if possible, but for now assuming we update teams or using logic)
          // *Note*: In this simplified version, we'll assume `activeRankingData` logic needs to be applied to ALL seasons. 
          // Since that's heavy, we will approximate using the `teams` array in season if we were updating it.
          // However, we are NOT updating `teams` array in DB with match results in this code (only `rounds`).
          // So we must re-calc stats from rounds for history.
          
          const sTeamStats = new Map<string, any>();
          s.teams.forEach(t => sTeamStats.set(t.name, { ...t, win:0, draw:0, loss:0, points:0 }));
          
          s.rounds?.forEach(r => r.matches.forEach(m => {
              if(m.status === 'FINISHED' || m.status === 'BYE') {
                  const h = Number(m.homeScore||0), a = Number(m.awayScore||0);
                  const ht = sTeamStats.get(m.home), at = sTeamStats.get(m.away);
                  if(ht) { if(h>a) {ht.win++; ht.points+=3;} else if(h<a) ht.loss++; else {ht.draw++; ht.points++;} }
                  if(at && m.away!=='BYE (부전승)') { if(a>h) {at.win++; at.points+=3;} else if(a<h) at.loss++; else {at.draw++; at.points++;} }
              }
          }));

          const sortedSeasonTeams = Array.from(sTeamStats.values()).sort((a,b)=>b.points-a.points);
          
          sortedSeasonTeams.forEach((t, idx) => {
              if(!ownerHist.has(t.ownerName)) ownerHist.set(t.ownerName, {name:t.ownerName, win:0, draw:0, loss:0, points:0, prize:0, titles:0, seasons:0});
              const o = ownerHist.get(t.ownerName);
              o.win += t.win; o.draw += t.draw; o.loss += t.loss; o.points += t.points; o.seasons++;
              // Prize approximation
              if(idx===0) { o.titles++; o.prize+=s.prizes.first; }
              else if(idx===1) o.prize+=s.prizes.second;
              else if(idx===2) o.prize+=s.prizes.third;
          });
      });

      return {
          owners: Array.from(ownerHist.values()).sort((a,b) => b.points - a.points || b.titles - a.titles)
      };
  }, [seasons]);

  const { availableTeams, assignmentRegions, clubLeagues, nationalLeagues } = useMemo(() => {
    const currentSeason = seasons.find(s => s.id === adminTab);
    const assignedTeamNames = (currentSeason?.teams || []).map(t => t.name);
    let filtered = masterTeams.filter(t => !assignedTeamNames.includes(t.name)); 
    if (assignCategory !== 'ALL') filtered = filtered.filter(t => t.category === assignCategory);
    if (assignRegion !== 'ALL') filtered = filtered.filter(t => t.region === assignRegion);
    if (assignTier !== 'ALL') filtered = filtered.filter(t => t.tier === assignTier);
    if (assignSearch) filtered = filtered.filter(t => t.name.toLowerCase().includes(assignSearch.toLowerCase()));

    const regions = Array.from(new Set(masterTeams.filter(t => assignCategory === 'ALL' || t.category === assignCategory).map(t => t.region)));
    const cList = regions.filter(r => { const l = leagues.find(lg => lg.name === r); return l ? l.category === 'CLUB' : !['Europe','South America','Asia/Oceania','Africa','North America'].includes(r); });
    const nList = regions.filter(r => !cList.includes(r));

    return { availableTeams: getSortedTeamsLogic(filtered, ''), assignmentRegions: getSortedLeagues(regions), clubLeagues: getSortedLeagues(cList), nationalLeagues: getSortedLeagues(nList) };
  }, [masterTeams, seasons, adminTab, assignCategory, assignRegion, assignTier, assignSearch, leagues]);

  // --- Handlers ---
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const handleTouchEnd = () => { if (!touchStart || !touchEnd) return; const dist = touchStart - touchEnd; if (dist > 50) setBannerIdx((p) => (p + 1) % banners.length); if (dist < -50) setBannerIdx((p) => (p - 1 + banners.length) % banners.length); setTouchStart(0); setTouchEnd(0); };

  const handleRecordInputChange = (type: string, field: string, value: string) => { setRecordInputs(prev => ({ ...prev, [type]: { ...(prev as any)[type], [field]: value } })); };
  const handleSaveOwner = async () => { if(newOwnerName) { if(editOwnerId) await updateDoc(doc(db,"users",editOwnerId),{nickname:newOwnerName,photo:newOwnerPhoto}); else await addDoc(collection(db,"users"),{id:Date.now(),nickname:newOwnerName,photo:newOwnerPhoto}); setNewOwnerName(''); setNewOwnerPhoto(''); setEditOwnerId(null); }};
  const handleEditOwnerClick = (o: Owner) => { setEditOwnerId(o.docId!); setNewOwnerName(o.nickname); setNewOwnerPhoto(o.photo); };
  const handleCreateSeason = async () => { if(inputSeasonName) { const id=Date.now(); await setDoc(doc(db,"seasons",String(id)),{ id, name:inputSeasonName, type:inputSeasonType, leagueMode:inputSeasonType==='LEAGUE'?inputLeagueMode:'SINGLE', isActive:true, teams:[], rounds:[], prizes:{total:inputTotalPrize, ...prizes} }); setAdminTab(id); setViewSeasonId(id); setInputSeasonName(''); alert("게임 생성 완료! 팀을 배정해주세요."); } else { alert("시즌 이름 입력 필요"); } };
  const handleSaveBanner = async () => { if(bannerTitle && bannerUrl) { await addDoc(collection(db,"banners"),{title:bannerTitle,url:bannerUrl,order:Date.now()}); setBannerTitle(''); setBannerUrl(''); }};
  const handleDeleteBanner = async (id:string) => { if(confirm("배너 삭제?")) await deleteDoc(doc(db,"banners",id)); };
  
  const handleQuickAssign = async (team: MasterTeam) => {
      if(!selOwnerId) return alert("먼저 팀을 배정받을 오너를 선택해주세요! 👆");
      const o = owners.find(u=>u.id===Number(selOwnerId));
      if(team && o) {
          if(confirm(`[${o.nickname}] 오너에게 [${team.name}] 팀을 배정하시겠습니까?`)) {
              const nt: Team = {id:Date.now(), seasonId:Number(adminTab), name:team.name, logo:team.logo, ownerName:o.nickname, region:team.region, tier:team.tier, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0}; 
              await updateDoc(doc(db,"seasons",String(adminTab)), {teams:[...(seasons.find(s=>s.id===adminTab)?.teams||[]), nt]}); 
          }
      }
  };

  const handleRandomFromFilter = async () => {
      if(!selOwnerId) return alert("오너 선택 필요"); if(availableTeams.length === 0) return alert("팀 없음");
      const randomIndex = Math.floor(Math.random() * availableTeams.length); const randomTeam = availableTeams[randomIndex]; const o = owners.find(u=>u.id===Number(selOwnerId));
      if(randomTeam && o && confirm(`🎲 [${randomTeam.name}] 팀을 [${o.nickname}]에게 배정합니까?`)) {
          const nt: Team = {id:Date.now(), seasonId:Number(adminTab), name:randomTeam.name, logo:randomTeam.logo, ownerName:o.nickname, region:randomTeam.region, tier:randomTeam.tier, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0}; 
          await updateDoc(doc(db,"seasons",String(adminTab)), {teams:[...(seasons.find(s=>s.id===adminTab)?.teams||[]), nt]}); 
      }
  };

  const generateRoundsLogic = (s: Season, teams: Team[]) => {
    let shuffled = [...teams].sort(() => Math.random() - 0.5);
    const rounds: Round[] = [];
    if(s.type === 'TOURNAMENT') {
        for(let i=0; i<shuffled.length-1; i+=2) { if(shuffled[i].ownerName === shuffled[i+1]?.ownerName) { for(let j=i+2; j<shuffled.length; j++) { if(shuffled[j].ownerName !== shuffled[i].ownerName) { const temp = shuffled[i+1]; shuffled[i+1] = shuffled[j]; shuffled[j] = temp; break; } } } }
        const nextPow2 = Math.pow(2, Math.ceil(Math.log2(shuffled.length))); const matchCount = nextPow2 / 2; let matches: Match[] = [];
        for(let i=0; i<matchCount; i++) { const h = shuffled[i*2], a = shuffled[i*2+1]; const stageName = getTournamentStageName(nextPow2, matchCount);
           matches.push(a ? { id: `${s.id}_R1_M${i}`, seasonId: s.id, home: h.name, away: a.name, homeLogo: h.logo, awayLogo: a.logo, homeOwner: h.ownerName, awayOwner: a.ownerName, homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'UPCOMING', youtubeUrl: '', stage: stageName, matchLabel: `Match ${i+1}`, nextMatchId: `${s.id}_R2_M${Math.floor(i/2)}` } : { id: `${s.id}_R1_M${i}`, seasonId: s.id, home: h.name, away: 'BYE (부전승)', homeLogo: h.logo, awayLogo: FALLBACK_IMG, homeOwner: h.ownerName, awayOwner: '-', homeScore: '1', awayScore: '0', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'BYE', youtubeUrl: '', stage: stageName, matchLabel: `Match ${i+1}`, nextMatchId: `${s.id}_R2_M${Math.floor(i/2)}` });
        }
        rounds.push({ round: 1, matches, seasonId: s.id, name: getTournamentStageName(nextPow2, matchCount) });
        let rIdx = 2; let currentCount = matchCount / 2;
        while(currentCount >= 0.5) {
            let nextMatches: Match[] = []; const stageName = getTournamentStageName(nextPow2, currentCount);
            for(let i=0; i < Math.ceil(currentCount); i++) { nextMatches.push({ id: `${s.id}_R${rIdx}_M${i}`, seasonId: s.id, home: 'TBD', away: 'TBD', homeLogo: FALLBACK_IMG, awayLogo: FALLBACK_IMG, homeOwner: '-', awayOwner: '-', homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'UPCOMING', youtubeUrl: '', stage: stageName, matchLabel: `Match ${i+1}`, nextMatchId: currentCount > 0.5 ? `${s.id}_R${rIdx+1}_M${Math.floor(i/2)}` : undefined }); }
            rounds.push({ round: rIdx, matches: nextMatches, seasonId: s.id, name: stageName }); if(currentCount === 0.5) break; currentCount /= 2; rIdx++;
        }
    } else {
        if(shuffled.length % 2 !== 0) shuffled.push({id:0, seasonId:0, name:'BYE', logo:FALLBACK_IMG, ownerName:'-', region:'', tier:'', win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0});
        const numRounds = shuffled.length - 1; const half = shuffled.length / 2; let allRoundMatches = []; let tempTeams = [...shuffled];
        for(let r=0; r<numRounds; r++) { let roundMatches: Match[] = []; for(let i=0; i<half; i++) { const home = tempTeams[i], away = tempTeams[shuffled.length - 1 - i]; if(home.name !== 'BYE' && away.name !== 'BYE') { roundMatches.push({ id: `${s.id}_R${r+1}_M${i}`, seasonId: s.id, home: home.name, away: away.name, homeLogo: home.logo, awayLogo: away.logo, homeOwner: home.ownerName, awayOwner: away.ownerName, homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'UPCOMING', youtubeUrl: '', stage: `Round ${r+1}`, matchLabel: `Game ${i+1}` }); } } allRoundMatches.push(roundMatches); tempTeams.splice(1, 0, tempTeams.pop()!); }
        allRoundMatches.forEach((rm, idx) => rounds.push({round: idx+1, matches: rm, seasonId: s.id, name: `Round ${idx+1}`}));
        if(s.leagueMode === 'DOUBLE') { const firstHalfLen = rounds.length; allRoundMatches.forEach((rm, idx) => { const returnMatches = rm.map(m => ({ ...m, id: m.id + '_return', home: m.away, away: m.home, homeLogo: m.awayLogo, awayLogo: m.homeLogo, homeOwner: m.awayOwner, awayOwner: m.homeOwner, stage: `Round ${firstHalfLen + idx + 1}` })); rounds.push({round: firstHalfLen + idx + 1, matches: returnMatches, seasonId: s.id, name: `Round ${firstHalfLen + idx + 1}`}); }); }
    }
    return rounds;
  };

  const handleFinishAssignment = async () => {
      const s = seasons.find(s => s.id === adminTab); if(!s) return;
      if((s.teams||[]).length < 2) return alert("최소 2팀 이상 배정해야 합니다.");
      if(s.rounds && s.rounds.length > 0) { if(confirm("스케줄 페이지로 이동하시겠습니까?")) { setCurrentView('SCHEDULE'); setViewSeasonId(s.id); } } 
      else { if(confirm("팀 배정을 완료하고 대진표를 생성하여 스케줄로 이동하시겠습니까?")) { const rounds = generateRoundsLogic(s, s.teams || []); await updateDoc(doc(db, "seasons", String(adminTab)), { rounds }); alert("대진표 생성 완료! 스케줄 화면으로 이동합니다."); setCurrentView('SCHEDULE'); setViewSeasonId(s.id); } }
  };

  const handleGenerateSchedule = async () => {
    const s = seasons.find(s => s.id === adminTab);
    if(!s || (s.teams||[]).length < 2) return alert("팀이 부족합니다 (최소 2팀)");
    if(!confirm("기존 스케줄이 초기화되고 새로 생성됩니다. 진행하시겠습니까?")) return;
    const rounds = generateRoundsLogic(s, s.teams || []); await updateDoc(doc(db, "seasons", String(adminTab)), { rounds }); alert(`스케줄 생성 완료!`);
  };

  const handleRemoveTeamFromSeason = async (tid:number) => { if(confirm("제외하시겠습니까?")) await updateDoc(doc(db,"seasons",String(adminTab)), {teams:seasons.find(s=>s.id===adminTab)?.teams?.filter(t=>t.id!==tid)}); };
  const handleMatchClick = (m: Match) => { setEditingMatch({...m}); setMatchInputs({homeScore:m.homeScore||'0',awayScore:m.awayScore||'0',youtube:m.youtubeUrl}); };
  const saveMatchResult = async () => {
    if(!editingMatch) return; const s = seasons.find(se => se.id === editingMatch.seasonId);
    if(s && s.rounds) { let newRounds = [...s.rounds]; newRounds = newRounds.map(r => ({ ...r, matches: r.matches.map(m => m.id === editingMatch.id ? { ...editingMatch, homeScore: matchInputs.homeScore, awayScore: matchInputs.awayScore, youtubeUrl: matchInputs.youtube, status: 'FINISHED' as const } : m) }));
       if (s.type === 'TOURNAMENT' && editingMatch.nextMatchId) { const winner = Number(matchInputs.homeScore) > Number(matchInputs.awayScore) ? {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner} : {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner}; newRounds = newRounds.map(r => ({ ...r, matches: r.matches.map(m => { if(m.id === editingMatch.nextMatchId) { const isHomeSlot = Number(editingMatch.id.split('_M')[1]) % 2 === 0; return isHomeSlot ? { ...m, home: winner.name, homeLogo: winner.logo, homeOwner: winner.owner } : { ...m, away: winner.name, awayLogo: winner.logo, awayOwner: winner.owner }; } return m; }) })); }
       await updateDoc(doc(db, "seasons", String(s.id)), { rounds: newRounds }); setEditingMatch(null);
    }
  };
  
  const handleRecordAdd = (type: string) => { if(!editingMatch)return; const k = type as keyof typeof recordInputs; const count = Number(recordInputs[k].count); if(type==='homeScorer') setMatchInputs(p=>({...p,homeScore:String(Number(p.homeScore)+count)})); if(type==='awayScorer') setMatchInputs(p=>({...p,awayScore:String(Number(p.awayScore)+count)})); const f=type+'s' as keyof Match; const list=(editingMatch[f] as MatchRecord[])||[]; setEditingMatch({...editingMatch,[f]:[...list,{id:Date.now(),name:recordInputs[k].name,count}]}); };
  const handleRecordRemove = (type: string, id: number) => { if(!editingMatch)return; const f=type+'s' as keyof Match; const list=(editingMatch[f] as MatchRecord[])||[]; const item=list.find(r=>r.id===id); if(item){ if(type==='homeScorer') setMatchInputs(p=>({...p,homeScore:String(Math.max(0,Number(p.homeScore)-item.count))})); if(type==='awayScorer') setMatchInputs(p=>({...p,awayScore:String(Math.max(0,Number(p.awayScore)-item.count))})); } setEditingMatch({...editingMatch,[f]:list.filter(r=>r.id!==id)}); };
  const handleDeleteSeason = async () => { if(confirm("⚠️ 경고: 게임 삭제 시 모든 데이터 영구 삭제. 진행합니까?")) { await deleteDoc(doc(db,"seasons",String(adminTab))); setAdminTab('NEW'); setViewSeasonId(0); } };
  const renderBanners = () => banners.map((b, i) => (<div key={b.id || i} className={`absolute inset-0 transition-opacity duration-1000 ${i === bannerIdx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>{getBannerContent(b)}</div>));

  return (
    <div className="min-h-screen bg-[#020617] text-white font-black italic tracking-tighter overflow-x-hidden pb-20">
      <div className="w-full h-[225px] md:h-[330px] relative border-b border-slate-800 shadow-2xl overflow-hidden bg-black" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {renderBanners()}
        <div className="absolute bottom-6 left-6 uppercase z-20 pointer-events-none">
          <h1 className="text-2xl md:text-4xl text-white font-black italic">ⓔFOOTBALL SUPER LEAGUE™</h1>
          <p className="text-emerald-400 text-[10px] md:text-xs font-sans not-italic tracking-widest mt-1">ver. P_02_10_UI_History</p>
        </div>
      </div>
      
      <div className="flex justify-center flex-wrap gap-2 mt-6 mb-8 px-4">
        {['RANKING', 'SCHEDULE', 'HISTORY', 'TUTORIAL', 'ADMIN'].map(t => (
          <button key={t} onClick={() => setCurrentView(t as any)} className={`px-6 py-3 rounded-xl border text-xs transition-all shadow-lg ${currentView === t ? 'bg-blue-600 border-blue-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>{t}</button>
        ))}
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-8 space-y-8">
        
        {/* VIEW: RANKING */}
        {currentView === 'RANKING' && (
           <div className="space-y-6 animate-in fade-in">
              <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col gap-4">
                <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700">{seasons.map(s => <option key={s.id} value={s.id}>🏆 {s.name}</option>)}</select>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {['STANDINGS', 'OWNERS', 'PLAYERS', 'HIGHLIGHTS'].map(sub => (
                        <button key={sub} onClick={() => setRankingTab(sub as any)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${rankingTab === sub ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{sub}</button>
                    ))}
                </div>
              </div>

              {rankingTab === 'STANDINGS' && (
                <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                  <table className="w-full text-left text-xs uppercase border-collapse">
                      <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                          <tr><th className="p-4 w-8">#</th><th className="p-4">Club</th><th className="p-4 text-center">W</th><th className="p-4 text-center">D</th><th className="p-4 text-center">L</th><th className="p-4 text-center">GD</th><th className="p-4 text-center text-emerald-400">Pts</th></tr>
                      </thead>
                      <tbody>
                          {activeRankingData.teams.map((t, i) => (
                              <tr key={t.id} className={`border-b border-slate-800/50 ${i<3 ? 'bg-emerald-900/10' : ''}`}>
                                  <td className={`p-4 text-center font-bold ${i===0?'text-yellow-400':i===1?'text-slate-300':i===2?'text-orange-400':'text-slate-600'}`}>{i+1}</td>
                                  <td className="p-4 flex items-center gap-3"><img src={t.logo} className="w-8 h-8 rounded-full bg-white object-contain p-0.5" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/><div className="flex flex-col"><span className="font-bold">{t.name}</span><span className="text-[9px] text-slate-500">{t.ownerName}</span></div></td>
                                  <td className="p-4 text-center text-slate-400">{t.win}</td><td className="p-4 text-center text-slate-400">{t.draw}</td><td className="p-4 text-center text-slate-400">{t.loss}</td><td className="p-4 text-center text-slate-500">{t.gd>0?`+${t.gd}`:t.gd}</td>
                                  <td className="p-4 text-center text-emerald-400 font-bold text-sm">{t.points}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                </div>
              )}

              {/* 🔥 [Updated] Owner Ranking with W/D/L */}
              {rankingTab === 'OWNERS' && (
                  <div className="grid gap-3">
                      {activeRankingData.owners.map((o, i) => (
                          <div key={i} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                  <span className={`text-lg font-black italic w-6 ${i===0?'text-yellow-400':i===1?'text-slate-300':'text-slate-600'}`}>{i+1}</span>
                                  <div>
                                      <p className="font-bold text-sm">{o.name}</p>
                                      <p className="text-[10px] text-slate-500">{o.win}W {o.draw}D {o.loss}L ({o.teamsCount} teams)</p>
                                  </div>
                              </div>
                              <div className="text-right"><p className="text-xl font-bold text-emerald-400">{o.points} <span className="text-xs text-slate-500">pts</span></p><p className="text-[10px] text-yellow-500">₩ {o.prize.toLocaleString()}</p></div>
                          </div>
                      ))}
                  </div>
              )}

              {rankingTab === 'PLAYERS' && (
                  <div className="grid md:grid-cols-2 gap-6">
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <h4 className="text-yellow-400 font-bold mb-4 flex items-center gap-2">⚽ TOP SCORERS</h4>
                          {activeRankingData.players.filter(p=>p.goals>0).slice(0,10).map((p,i)=>(
                              <div key={i} className="flex justify-between py-2 border-b border-slate-800/50 text-xs"><span className="w-6 text-slate-500">{i+1}</span><span className="flex-1">{p.name} <span className="text-slate-600">({p.team})</span></span><span className="font-bold text-yellow-400">{p.goals}</span></div>
                          ))}
                      </div>
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <h4 className="text-blue-400 font-bold mb-4 flex items-center gap-2">🅰️ TOP ASSISTS</h4>
                          {activeRankingData.players.sort((a,b)=>b.assists-a.assists).filter(p=>p.assists>0).slice(0,10).map((p,i)=>(
                              <div key={i} className="flex justify-between py-2 border-b border-slate-800/50 text-xs"><span className="w-6 text-slate-500">{i+1}</span><span className="flex-1">{p.name} <span className="text-slate-600">({p.team})</span></span><span className="font-bold text-blue-400">{p.assists}</span></div>
                          ))}
                      </div>
                  </div>
              )}

              {rankingTab === 'HIGHLIGHTS' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {activeRankingData.highlights.map(m => (
                          <div key={m.id} className="bg-black rounded-xl overflow-hidden border border-slate-800 group">
                              <iframe className="w-full aspect-video" src={`https://www.youtube.com/embed/${m.youtubeUrl.split('/').pop()}?controls=0`} title="Highlight" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
                              <div className="p-2 text-center"><p className="text-[10px] font-bold text-slate-300">{m.home} vs {m.away}</p><p className="text-[9px] text-slate-500">{m.stage || 'Group Stage'}</p></div>
                          </div>
                      ))}
                      {activeRankingData.highlights.length === 0 && <div className="col-span-3 text-center py-10 text-slate-500">등록된 하이라이트 영상이 없습니다.</div>}
                  </div>
              )}
           </div>
        )}

        {/* 🔥 [VIEW 2] SCHEDULE (Improved Design & Exposed Info) */}
        {currentView === 'SCHEDULE' && (
            <div className="space-y-8 animate-in fade-in">
                <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
                    <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700">{seasons.map(s => <option key={s.id} value={s.id}>🗓️ {s.name}</option>)}</select>
                </div>
                
                {seasons.find(s=>s.id===viewSeasonId)?.rounds?.map((r, rIdx) => (
                    <div key={rIdx} className="space-y-4">
                        <h3 className="text-lg font-black text-slate-200 pl-4 border-l-4 border-emerald-500 italic">{r.name}</h3>
                        <div className="grid md:grid-cols-1 gap-6">
                            {r.matches.map(m => (
                                <div key={m.id} onClick={() => handleMatchClick(m)} className={`relative bg-slate-950 p-6 rounded-3xl border ${m.status==='FINISHED'?'border-slate-800':'border-slate-700'} hover:border-emerald-500 cursor-pointer shadow-2xl group transition-all`}>
                                    {/* Header */}
                                    <div className="flex justify-between items-center mb-6">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-900 px-3 py-1 rounded-full">{m.matchLabel || 'Match'}</span>
                                        {m.youtubeUrl && <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 animate-pulse">▶ REPLAY</span>}
                                    </div>
                                    
                                    {/* Scoreboard Main */}
                                    <div className="flex justify-between items-center mb-6">
                                        {/* Home */}
                                        <div className="flex flex-col items-center w-1/3 gap-3">
                                            <img src={m.homeLogo} className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white object-contain p-1 shadow-lg" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
                                            <div className="text-center">
                                                <p className="text-lg md:text-2xl font-black text-white leading-tight">{m.home}</p>
                                                <p className="text-xs text-slate-500 font-bold mt-1">{m.homeOwner}</p>
                                            </div>
                                        </div>
                                        {/* Score */}
                                        <div className="flex flex-col items-center">
                                            {m.status === 'FINISHED' ? (
                                                <div className="flex items-center gap-4 text-5xl md:text-6xl font-black italic text-white tracking-tighter">
                                                    <span className={Number(m.homeScore)>Number(m.awayScore)?'text-emerald-400':''}>{m.homeScore}</span>
                                                    <span className="text-slate-700 text-3xl">:</span>
                                                    <span className={Number(m.awayScore)>Number(m.homeScore)?'text-emerald-400':''}>{m.awayScore}</span>
                                                </div>
                                            ) : (
                                                <div className="bg-slate-800 px-6 py-2 rounded-xl text-xl font-bold text-slate-500 tracking-widest">VS</div>
                                            )}
                                        </div>
                                        {/* Away */}
                                        <div className="flex flex-col items-center w-1/3 gap-3">
                                            <img src={m.awayLogo} className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white object-contain p-1 shadow-lg" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
                                            <div className="text-center">
                                                <p className="text-lg md:text-2xl font-black text-white leading-tight">{m.away}</p>
                                                <p className="text-xs text-slate-500 font-bold mt-1">{m.awayOwner}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 🔥 [New] Exposed Info (Scorers & Assists) */}
                                    {m.status === 'FINISHED' && (
                                        <div className="border-t border-slate-800 pt-4 grid grid-cols-2 gap-4 text-[10px] md:text-xs">
                                            {/* Home Stats */}
                                            <div className="text-right space-y-1">
                                                {m.homeScorers.map((s, idx)=><div key={`hg-${idx}`} className="text-slate-300">⚽ {s.name} {s.count>1 && `(${s.count})`}</div>)}
                                                {m.homeAssists.map((s, idx)=><div key={`ha-${idx}`} className="text-slate-500">🅰️ {s.name} {s.count>1 && `(${s.count})`}</div>)}
                                            </div>
                                            {/* Away Stats */}
                                            <div className="text-left space-y-1">
                                                {m.awayScorers.map((s, idx)=><div key={`ag-${idx}`} className="text-slate-300">⚽ {s.name} {s.count>1 && `(${s.count})`}</div>)}
                                                {m.awayAssists.map((s, idx)=><div key={`aa-${idx}`} className="text-slate-500">🅰️ {s.name} {s.count>1 && `(${s.count})`}</div>)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* 🔥 [VIEW 3] HISTORY (All Time Stats) */}
        {currentView === 'HISTORY' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 text-center">
                    <h2 className="text-2xl font-black italic text-white mb-2">🏆 HALL OF FAME</h2>
                    <p className="text-xs text-slate-500">역대 모든 시즌의 통합 기록입니다.</p>
                </div>
                {/* 1. Owners All-Time */}
                <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                    <div className="bg-slate-950 p-4 border-b border-slate-800 font-bold text-slate-400 text-sm">👑 역대 구단주 랭킹</div>
                    <table className="w-full text-left text-xs uppercase">
                        <thead className="bg-slate-900 text-slate-500 font-bold border-b border-slate-800">
                            <tr><th className="p-4 w-8">#</th><th className="p-4">Owner</th><th className="p-4 text-center">Titles</th><th className="p-4 text-center">Pts</th><th className="p-4 text-right">Prize</th></tr>
                        </thead>
                        <tbody>
                            {historyData.owners.map((o, i) => (
                                <tr key={i} className="border-b border-slate-800/50">
                                    <td className="p-4 text-center font-bold text-slate-600">{i+1}</td>
                                    <td className="p-4 font-bold text-white">{o.name} <span className="text-[9px] text-slate-500 block">{o.win}W {o.draw}D {o.loss}L</span></td>
                                    <td className="p-4 text-center text-yellow-400 font-bold">{o.titles > 0 ? `🏆 ${o.titles}` : '-'}</td>
                                    <td className="p-4 text-center text-emerald-400 font-bold">{o.points}</td>
                                    <td className="p-4 text-right text-slate-300">₩ {o.prize.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* ADMIN VIEW */}
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
                     <div className="space-y-1"><label className="text-xs text-slate-400 font-bold">1. Season Name</label><input value={inputSeasonName} onChange={e=>setInputSeasonName(e.target.value)} placeholder="예: 2026 Season 1" className="bg-slate-800 w-full p-4 rounded border border-slate-700"/></div>
                     <div className="space-y-1"><label className="text-xs text-slate-400 font-bold">2. Type & Mode</label><div className="flex gap-2"><select value={inputSeasonType} onChange={e=>setInputSeasonType(e.target.value as any)} className="bg-slate-800 p-4 rounded border border-slate-700 flex-1"><option value="LEAGUE">LEAGUE</option><option value="TOURNAMENT">TOURNAMENT</option></select>{inputSeasonType === 'LEAGUE' && <select value={inputLeagueMode} onChange={e=>setInputLeagueMode(e.target.value as any)} className="bg-slate-800 p-4 rounded border border-slate-700 flex-1"><option value="SINGLE">SINGLE</option><option value="DOUBLE">DOUBLE</option></select>}</div></div>
                     <div className="space-y-1"><label className="text-xs text-slate-400 font-bold flex justify-between">3. Prizes <span className="text-emerald-500 cursor-pointer" onClick={()=>setIsAutoPrize(!isAutoPrize)}>{isAutoPrize?'⚡ Auto (50/20/10)':'✏️ Manual'}</span></label><input type="number" value={inputTotalPrize} onChange={e=>{setInputTotalPrize(Number(e.target.value)); setIsAutoPrize(true);}} className="bg-slate-800 w-full p-4 rounded border border-slate-700 text-right text-lg font-bold text-emerald-400 mb-2"/><div className="grid grid-cols-2 gap-2 text-xs"><div className="bg-slate-950 p-2 rounded flex justify-between"><span>🥇 1st (50%)</span><span>{prizes.first.toLocaleString()}</span></div><div className="bg-slate-950 p-2 rounded flex justify-between"><span>🥈 2nd (20%)</span><span>{prizes.second.toLocaleString()}</span></div></div></div>
                     <button onClick={handleCreateSeason} className="w-full bg-emerald-600 py-4 rounded-xl font-bold">Create Season</button>
                 </div>
             )}
             
             {typeof adminTab === 'number' && (
                <div className="space-y-6">
                   <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 sticky top-0 z-20 shadow-xl">
                       <h3 className="text-sm font-bold text-slate-400 mb-2">👤 오너 배정 설정</h3>
                       <div className="flex gap-2 items-center mb-4">
                           <select value={selOwnerId} onChange={e=>setSelOwnerId(Number(e.target.value))} className={`flex-1 p-3 rounded-xl border font-bold text-sm ${selOwnerId ? 'bg-indigo-900 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}><option value="">👤 배정할 오너 선택 (필수)</option>{owners.map(o=><option key={o.id} value={o.id}>{o.nickname}</option>)}</select>
                           <button onClick={handleRandomFromFilter} className="bg-purple-600 px-4 py-3 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform" title="랜덤 배정">🎲</button>
                       </div>
                       <div className="grid grid-cols-3 gap-1 mb-1">
                           <select value={assignCategory} onChange={e=>{setAssignCategory(e.target.value as any); setAssignRegion('ALL');}} className="bg-slate-900 border border-slate-700 p-2 rounded text-[10px]"><option value="ALL">전체 타입</option><option value="CLUB">클럽</option><option value="NATIONAL">국가대표</option></select>
                           <select value={assignTier} onChange={e=>setAssignTier(e.target.value)} className="bg-slate-900 border border-slate-700 p-2 rounded text-[10px]"><option value="ALL">전체 등급</option>{['S','A','B','C'].map(t=><option key={t} value={t}>{t}급</option>)}</select>
                           <select value={assignRegion} onChange={e=>setAssignRegion(e.target.value)} className="bg-slate-900 border border-slate-700 p-2 rounded text-[10px]"><option value="ALL">전체 리그/지역</option><optgroup label="[ 클럽 리그 ]">{clubLeagues.map(r=><option key={r} value={r}>{r}</option>)}</optgroup><optgroup label="[ 국가대표 지역 ]">{nationalLeagues.map(r=><option key={r} value={r}>{r}</option>)}</optgroup></select>
                       </div>
                       <input value={assignSearch} onChange={e=>setAssignSearch(e.target.value)} placeholder="팀 이름 검색..." className="bg-slate-900 border border-slate-700 p-3 rounded text-xs w-full" />
                   </div>

                   <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 min-h-[300px]">
                       <h4 className="text-xs font-bold text-slate-400 mb-3 flex justify-between"><span>👇 {assignRegion === 'ALL' && !assignSearch ? '리그/지역을 선택하세요' : `팀을 클릭하여 배정 (${availableTeams.length})`}</span>{selOwnerId && <span className="text-emerald-400">To: {owners.find(o=>o.id===selOwnerId)?.nickname}</span>}</h4>
                       
                       {assignRegion === 'ALL' && !assignSearch ? (
                           <div className="space-y-6">
                               {(assignCategory === 'ALL' || assignCategory === 'CLUB') && (<div><p className="text-[10px] text-slate-500 font-bold mb-2 ml-1">[ 클럽 리그 ]</p><div className="grid grid-cols-4 gap-3">{clubLeagues.map((l, i) => (<div key={i} onClick={() => setAssignRegion(l)} className="flex flex-col items-center gap-1 cursor-pointer hover:scale-105 transition-transform"><img src={leagues.find(lg=>lg.name===l)?.logo || FALLBACK_IMG} className="w-12 h-12 rounded-full bg-white object-contain p-1.5 shadow-md" /><span className="text-[9px] text-slate-400 text-center leading-tight">{l}</span></div>))}</div></div>)}
                               {(assignCategory === 'ALL' || assignCategory === 'NATIONAL') && (<div><p className="text-[10px] text-slate-500 font-bold mb-2 ml-1">[ 국가대표 지역 ]</p><div className="grid grid-cols-4 gap-3">{nationalLeagues.map((l, i) => (<div key={i} onClick={() => setAssignRegion(l)} className="flex flex-col items-center gap-1 cursor-pointer hover:scale-105 transition-transform"><img src={leagues.find(lg=>lg.name===l)?.logo || FALLBACK_IMG} className="w-12 h-12 rounded-full bg-white object-cover shadow-md" /><span className="text-[9px] text-slate-400 text-center leading-tight">{l}</span></div>))}</div></div>)}
                           </div>
                       ) : (
                           <div>
                               <div className="grid grid-cols-4 md:grid-cols-6 gap-3">{availableTeams.map(t => (<div key={t.id} onClick={() => handleQuickAssign(t)} className="relative aspect-square bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-900/20 transition-all active:scale-95 group"><img src={t.logo} className={`w-10 h-10 shadow-md ${t.category==='NATIONAL'?'rounded-full object-cover':'object-contain'}`} onError={(e:any)=>e.target.src=FALLBACK_IMG} /><div className="absolute bottom-1 w-full text-center px-1"><p className="text-[9px] truncate text-slate-400 group-hover:text-white font-bold">{t.name}</p></div><span className={`absolute top-1 right-1 text-[8px] px-1 rounded ${getTierBadgeColor(t.tier || 'C')}`}>{t.tier || 'C'}</span></div>))}</div>
                               <button onClick={() => {setAssignRegion('ALL'); setAssignSearch('');}} className="w-full mt-6 py-3 bg-slate-800 text-slate-400 text-xs rounded-xl hover:bg-slate-700">← 리그 목록으로 돌아가기</button>
                           </div>
                       )}
                   </div>

                   <div className="border-t border-slate-800 pt-4">
                       <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-emerald-400">배정된 팀 ({seasons.find(s=>s.id===adminTab)?.teams?.length || 0})</span><button onClick={handleFinishAssignment} className="text-xs bg-emerald-600 px-4 py-2 rounded font-bold hover:bg-emerald-500">✅ 배정 완료 & 스케줄 이동</button></div>
                       <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto mb-4">{seasons.find(s=>s.id===adminTab)?.teams?.map(t=>(<div key={t.id} className="text-xs bg-slate-950 p-2 rounded flex justify-between items-center border border-slate-800"><div className="flex items-center gap-2"><img src={t.logo} className="w-4 h-4 rounded-full"/><span>{t.name}</span><span className="text-slate-500">({t.ownerName})</span></div><button onClick={()=>handleRemoveTeamFromSeason(t.id)} className="text-red-500 font-bold px-2">×</button></div>))}</div>
                       <div className="flex gap-2"><button onClick={handleGenerateSchedule} className="flex-1 bg-slate-800 py-3 rounded text-xs font-bold text-slate-400 border border-slate-700 hover:bg-slate-700">🔄 스케줄 재생성</button><button onClick={handleDeleteSeason} className="flex-1 bg-red-900/30 py-3 rounded text-xs font-bold text-red-500 border border-red-900 hover:bg-red-900/50">⚠️ 시즌 삭제</button></div>
                   </div>
                </div>
             )}

             {adminTab === 'OWNER' && <div className="flex gap-2"><input value={newOwnerName} onChange={e=>setNewOwnerName(e.target.value)} placeholder="Owner Name" className="bg-slate-950 p-3 rounded w-full"/><input value={newOwnerPhoto} onChange={e=>setNewOwnerPhoto(e.target.value)} placeholder="Photo URL" className="bg-slate-950 p-3 rounded w-full"/><button onClick={handleSaveOwner} className="bg-purple-600 px-6 rounded font-bold">Save</button></div>}
             {adminTab === 'OWNER' && <div className="grid grid-cols-2 gap-2 mt-4">{owners.map(o => <div key={o.id} onClick={()=>handleEditOwnerClick(o)} className="p-2 bg-black rounded flex items-center gap-2 cursor-pointer"><img src={o.photo} className="w-8 h-8 rounded-full" /><span>{o.nickname}</span></div>)}</div>}
           </div>
        )}
      </main>

      {/* 🔥 [Updated] Improved Score Input Modal */}
      {editingMatch && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] p-4">
           <div className="bg-slate-900 p-6 rounded-3xl border border-slate-700 w-full max-w-5xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setEditingMatch(null)} className="absolute top-4 right-4 text-white text-2xl">✕</button>
              
              <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-slate-300 italic">{editingMatch.matchLabel}</h3>
                  <p className="text-sm text-slate-500">{editingMatch.stage}</p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                  {/* Home Input */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="flex flex-col items-center mb-4">
                          <img src={editingMatch.homeLogo} className="w-12 h-12 mb-2"/>
                          <span className="font-bold text-white">{editingMatch.home}</span>
                      </div>
                      <div className="space-y-4">
                          <RecordInput type="homeScorer" inputValue={recordInputs.homeScorer} onInputChange={handleRecordInputChange} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.homeScorers} label="⚽ Scorers" colorClass="text-emerald-400" />
                          <RecordInput type="homeAssist" inputValue={recordInputs.homeAssist} onInputChange={handleRecordInputChange} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.homeAssists} label="🅰️ Assists" colorClass="text-blue-400" />
                      </div>
                  </div>

                  {/* Center Control */}
                  <div className="flex flex-col items-center justify-center space-y-6">
                      <div className="flex items-center gap-4">
                          <input type="number" value={matchInputs.homeScore} onChange={e=>setMatchInputs({...matchInputs, homeScore:e.target.value})} className="w-20 h-20 text-center text-4xl font-black bg-black rounded-2xl border border-slate-700 text-white focus:border-emerald-500 outline-none" />
                          <span className="text-slate-600 text-2xl">:</span>
                          <input type="number" value={matchInputs.awayScore} onChange={e=>setMatchInputs({...matchInputs, awayScore:e.target.value})} className="w-20 h-20 text-center text-4xl font-black bg-black rounded-2xl border border-slate-700 text-white focus:border-emerald-500 outline-none" />
                      </div>
                      <div className="w-full">
                          <label className="text-xs text-slate-500 mb-1 block text-center">YouTube Highlights URL</label>
                          <input value={matchInputs.youtube} onChange={e=>setMatchInputs({...matchInputs,youtube:e.target.value})} placeholder="https://youtube.com/..." className="w-full bg-black p-3 rounded-xl text-center text-xs border border-slate-700 text-white"/>
                      </div>
                      <button onClick={saveMatchResult} className="bg-emerald-600 w-full py-4 rounded-xl font-black text-lg hover:bg-emerald-500 shadow-lg shadow-emerald-900/20">SAVE RESULT</button>
                  </div>

                  {/* Away Input */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="flex flex-col items-center mb-4">
                          <img src={editingMatch.awayLogo} className="w-12 h-12 mb-2"/>
                          <span className="font-bold text-white">{editingMatch.away}</span>
                      </div>
                      <div className="space-y-4">
                          <RecordInput type="awayScorer" inputValue={recordInputs.awayScorer} onInputChange={handleRecordInputChange} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.awayScorers} label="⚽ Scorers" colorClass="text-emerald-400" />
                          <RecordInput type="awayAssist" inputValue={recordInputs.awayAssist} onInputChange={handleRecordInputChange} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.awayAssists} label="🅰️ Assists" colorClass="text-blue-400" />
                      </div>
                  </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}