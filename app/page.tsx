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
  // Navigation
  const [currentView, setCurrentView] = useState<'RANKING' | 'SCHEDULE' | 'HISTORY' | 'ADMIN' | 'TUTORIAL'>('RANKING');
  
  // Tabs
  const [rankingTab, setRankingTab] = useState<'STANDINGS' | 'SCHEDULE' | 'OWNERS' | 'PLAYERS' | 'HIGHLIGHTS'>('STANDINGS');
  const [historyTab, setHistoryTab] = useState<'TEAMS' | 'OWNERS' | 'PLAYERS'>('OWNERS');
  const [adminTab, setAdminTab] = useState<number | 'NEW' | 'OWNER' | 'BANNER' | 'LEAGUES' | 'TEAMS'>('NEW');
  
  // Toggles
  const [rankPlayerMode, setRankPlayerMode] = useState<'GOAL' | 'ASSIST'>('GOAL');
  const [histPlayerMode, setHistPlayerMode] = useState<'GOAL' | 'ASSIST'>('GOAL');

  // Admin Security
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPwInput, setAdminPwInput] = useState('');

  const [currentTime, setCurrentTime] = useState<string>('');

  // Data State
  const [viewSeasonId, setViewSeasonId] = useState<number>(0); 
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  
  // 🔥 Banner State
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerIdx, setBannerIdx] = useState<number>(0); 

  // 🔥 [Fix] Restore Touch States (for Swipe)
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // Inputs & Filters
  const [inputSeasonName, setInputSeasonName] = useState('');
  const [inputSeasonType, setInputSeasonType] = useState<'LEAGUE' | 'TOURNAMENT'>('LEAGUE');
  const [inputLeagueMode, setInputLeagueMode] = useState<'SINGLE' | 'DOUBLE'>('SINGLE');
  const [inputTotalPrize, setInputTotalPrize] = useState(100000);
  
  // Prize States
  const [prizes, setPrizes] = useState({ first: 50000, second: 30000, third: 10000, scorer: 10000, assist: 0 });
  const [isAutoPrize, setIsAutoPrize] = useState(true);

  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPhoto, setNewOwnerPhoto] = useState('');
  const [editOwnerId, setEditOwnerId] = useState<string | null>(null);

  const [selOwnerId, setSelOwnerId] = useState<number | ''>('');
  const [assignCategory, setAssignCategory] = useState<'CLUB' | 'NATIONAL' | 'ALL'>('ALL'); 
  const [assignRegion, setAssignRegion] = useState<string>('ALL'); 
  const [assignTier, setAssignTier] = useState<string>('ALL'); 
  const [assignSearch, setAssignSearch] = useState<string>(''); 

  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [matchInputs, setMatchInputs] = useState({ homeScore:'', awayScore:'', youtube:'' });
  const [recordInputs, setRecordInputs] = useState({ homeScorer:{name:'',count:'1'}, awayScorer:{name:'',count:'1'}, homeAssist:{name:'',count:'1'}, awayAssist:{name:'',count:'1'} });

  // --- Effects ---
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date().toLocaleString()), 1000);
    return () => clearInterval(t);
  }, []);

  // 🔥 [Logic] Banner Sorting (Videos First) & Rotation
  const sortedBannersDisplay = useMemo(() => {
    if (!banners || banners.length === 0) return [];
    // Sort: Videos come first
    return [...banners].sort((a,b) => {
      const aIsVid = a.url.includes('youtube') || a.url.includes('youtu.be');
      const bIsVid = b.url.includes('youtube') || b.url.includes('youtu.be');
      return (aIsVid === bIsVid) ? 0 : aIsVid ? -1 : 1;
    });
  }, [banners]);

  useEffect(() => {
    if (sortedBannersDisplay.length === 0) return;

    const currentBanner = sortedBannersDisplay[bannerIdx];
    if (!currentBanner) return;

    const isVideo = currentBanner.url.includes('youtube') || currentBanner.url.includes('youtu.be');
    const delay = isVideo ? 15000 : 5000; // 15s for video, 5s for image

    const t = setTimeout(() => {
        // After first play (idx 0), pick random
        let nextIdx = Math.floor(Math.random() * sortedBannersDisplay.length);
        // Avoid repeating same banner immediately if possible
        if (sortedBannersDisplay.length > 1 && nextIdx === bannerIdx) {
            nextIdx = (nextIdx + 1) % sortedBannersDisplay.length;
        }
        setBannerIdx(nextIdx);
    }, delay);

    return () => clearTimeout(t);
  }, [sortedBannersDisplay, bannerIdx]);

  // 🔥 [Logic] Deep Linking
  useEffect(() => {
      if (viewSeasonId > 0) {
          const params = new URLSearchParams(window.location.search);
          params.set('view', currentView);
          params.set('season', String(viewSeasonId));
          window.history.replaceState(null, '', `?${params.toString()}`);
      }
  }, [currentView, viewSeasonId]);

  // 🔥 [Logic] Initial Load
  useEffect(() => {
      if (seasons.length === 0) return; 

      const params = new URLSearchParams(window.location.search);
      const paramView = params.get('view');
      const paramSeasonId = Number(params.get('season'));

      if (paramView && ['RANKING', 'SCHEDULE', 'HISTORY', 'TUTORIAL', 'ADMIN'].includes(paramView)) {
          setCurrentView(paramView as any);
      }

      if (paramSeasonId) {
          const targetSeason = seasons.find(s => s.id === paramSeasonId);
          if (targetSeason) {
              setViewSeasonId(targetSeason.id);
          } else {
              alert("현재 해당 시즌을 찾을 수가 없습니다. 메인 페이지로 이동합니다.");
              setViewSeasonId(seasons[0].id);
              const newParams = new URLSearchParams(window.location.search);
              newParams.delete('season');
              window.history.replaceState(null, '', `?${newParams.toString()}`);
          }
      } else if (viewSeasonId === 0) {
          setViewSeasonId(seasons[0].id);
      }
  }, [seasons]); 

  // Prize Logic
  useEffect(() => { 
    if (isAutoPrize) {
      setPrizes({ 
        first: Math.floor(inputTotalPrize * 0.5), 
        second: Math.floor(inputTotalPrize * 0.3), 
        third: Math.floor(inputTotalPrize * 0.1), 
        scorer: Math.floor(inputTotalPrize * 0.1), 
        assist: 0 
      }); 
    }
  }, [inputTotalPrize, isAutoPrize]);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "users"), orderBy("id", "asc")), s => setOwners(s.docs.map(d => ({...d.data(), docId: d.id} as Owner))));
    const u2 = onSnapshot(collection(db, "master_teams"), s => setMasterTeams(s.docs.map(d => ({id:d.id, ...d.data()} as MasterTeam))));
    const u3 = onSnapshot(query(collection(db, "seasons"), orderBy("id", "desc")), s => { 
        const d = s.docs.map(doc => doc.data() as Season); setSeasons(d); 
    });
    const u4 = onSnapshot(collection(db, "banners"), s => setBanners(s.docs.map(d => ({id:d.id, ...d.data()} as Banner))));
    const u5 = onSnapshot(collection(db, "leagues"), s => setLeagues(s.docs.map(d => ({id:d.id, ...d.data()} as League))));
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  const getYouTubeThumbnail = (url: string) => {
    if (!url) return FALLBACK_IMG;
    const vId = url.includes('youtu.be') ? url.split('/').pop() : url.split('v=')[1]?.split('&')[0];
    return vId ? `https://img.youtube.com/vi/${vId}/mqdefault.jpg` : FALLBACK_IMG;
  };

  const getPlayerKey = (name: string, team: string, owner: string) => `${name.trim()}-${team}-${owner}`;

  // --- Ranking Data ---
  const activeRankingData = useMemo(() => {
    const targetSeason = seasons.find(s => s.id === viewSeasonId);
    if(!targetSeason?.teams) return { teams: [], owners: [], players: [], highlights: [] };
    
    const teamStats = new Map<string, Team>();
    targetSeason.teams.forEach(t => teamStats.set(t.name, { ...t, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 }));
    const playerStatsMap = new Map<string, any>(); 
    
    targetSeason.rounds?.forEach(r => r.matches.forEach(m => {
      if(m.status === 'FINISHED' || m.status === 'BYE') {
        const h = Number(m.homeScore || 0), a = Number(m.awayScore || 0);
        const ht = teamStats.get(m.home); const at = teamStats.get(m.away);
        if(ht) { ht.gf+=h; ht.ga+=a; ht.gd = ht.gf - ht.ga; if(h>a) { ht.win++; ht.points+=3; } else if(h<a) { ht.loss++; } else { ht.draw++; ht.points++; } }
        if(at && m.away !== 'BYE (부전승)') { at.gf+=a; at.ga+=h; at.gd = at.gf - at.ga; if(a>h) { at.win++; at.points+=3; } else if(a<h) { at.loss++; } else { at.draw++; at.points++; } }
      }
      if(m.status === 'FINISHED') {
        [...m.homeScorers, ...m.awayScorers].forEach(s => { 
            const teamName = m.homeScorers.includes(s) ? m.home : m.away;
            const ownerName = m.homeScorers.includes(s) ? m.homeOwner : m.awayOwner;
            const teamLogo = m.homeScorers.includes(s) ? m.homeLogo : m.awayLogo;
            const key = getPlayerKey(s.name, teamName, ownerName);
            if(!playerStatsMap.has(key)) playerStatsMap.set(key, {name:s.name.trim(), team: teamName, teamLogo, owner: ownerName, goals:0, assists:0}); 
            playerStatsMap.get(key).goals += s.count; 
        });
        [...m.homeAssists, ...m.awayAssists].forEach(s => { 
            const teamName = m.homeAssists.includes(s) ? m.home : m.away;
            const ownerName = m.homeAssists.includes(s) ? m.homeOwner : m.awayOwner;
            const teamLogo = m.homeAssists.includes(s) ? m.homeLogo : m.awayLogo;
            const key = getPlayerKey(s.name, teamName, ownerName);
            if(!playerStatsMap.has(key)) playerStatsMap.set(key, {name:s.name.trim(), team: teamName, teamLogo, owner: ownerName, goals:0, assists:0}); 
            playerStatsMap.get(key).assists += s.count; 
        });
      }
    }));

    const teams = Array.from(teamStats.values()).sort((a,b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf).map((t, i) => {
        const played = t.win + t.draw + t.loss;
        let prize = 0;
        if (played > 0) {
            if(i === 0) prize = targetSeason.prizes.first;
            else if(i === 1) prize = targetSeason.prizes.second;
            else if(i === 2) prize = targetSeason.prizes.third;
        }
        return { ...t, rank: i+1, currentPrize: prize };
    });

    const ownerMap = new Map<string, any>();
    teams.forEach(t => { 
        if(!ownerMap.has(t.ownerName)) ownerMap.set(t.ownerName, {name:t.ownerName, win:0, draw:0, loss:0, points:0, prize:0, teamsCount:0}); 
        const o = ownerMap.get(t.ownerName); 
        o.win+=t.win; o.draw+=t.draw; o.loss+=t.loss; o.points+=t.points; o.prize+=(t.currentPrize||0); o.teamsCount++; 
    });
    
    const highlights = targetSeason.rounds?.flatMap(r => r.matches).filter(m => m.youtubeUrl).map(m => {
        const winner = Number(m.homeScore) > Number(m.awayScore) ? m.home : Number(m.awayScore) > Number(m.homeScore) ? m.away : 'DRAW';
        const winnerLogo = winner === m.home ? m.homeLogo : winner === m.away ? m.awayLogo : FALLBACK_IMG;
        return { ...m, winner, winnerLogo };
    }) || [];

    return { teams, owners: Array.from(ownerMap.values()).sort((a,b)=>b.points-a.points || b.prize-a.prize), players: Array.from(playerStatsMap.values()).sort((a:any,b:any) => b.goals - a.goals || b.assists - a.assists), highlights };
  }, [seasons, viewSeasonId]);

  // --- History Data ---
  const historyData = useMemo(() => {
      const ownerHist = new Map<string, any>(); const teamHist = new Map<string, any>(); const playerHistMap = new Map<string, any>();
      seasons.forEach(s => {
          if(!s.teams) return;
          const sTeamStats = new Map<string, any>();
          s.teams.forEach(t => sTeamStats.set(t.name, { ...t, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 }));
          s.rounds?.forEach(r => r.matches.forEach(m => {
              if(m.status === 'FINISHED' || m.status === 'BYE') {
                  const h = Number(m.homeScore||0), a = Number(m.awayScore||0);
                  const ht = sTeamStats.get(m.home), at = sTeamStats.get(m.away);
                  if(ht) { ht.gf+=h; ht.ga+=a; ht.gd=ht.gf-ht.ga; if(h>a) {ht.win++; ht.points+=3;} else if(h<a) ht.loss++; else {ht.draw++; ht.points++;} }
                  if(at && m.away!=='BYE (부전승)') { at.gf+=a; at.ga+=h; at.gd=at.gf-at.ga; if(a>h) {at.win++; at.points+=3;} else if(a<h) at.loss++; else {at.draw++; at.points++;} }
              }
              if(m.status === 'FINISHED') {
                  [...m.homeScorers, ...m.awayScorers].forEach(p => { 
                      const teamName = m.homeScorers.includes(p) ? m.home : m.away;
                      const ownerName = m.homeScorers.includes(p) ? m.homeOwner : m.awayOwner;
                      const teamLogo = m.homeScorers.includes(p) ? m.homeLogo : m.awayLogo;
                      const key = getPlayerKey(p.name, teamName, ownerName);
                      if(!playerHistMap.has(key)) playerHistMap.set(key, {name:p.name.trim(), team: teamName, teamLogo, owner: ownerName, goals:0, assists:0}); 
                      playerHistMap.get(key).goals += p.count; 
                  });
                  [...m.homeAssists, ...m.awayAssists].forEach(p => { 
                      const teamName = m.homeAssists.includes(p) ? m.home : m.away;
                      const ownerName = m.homeAssists.includes(p) ? m.homeOwner : m.awayOwner;
                      const teamLogo = m.homeAssists.includes(p) ? m.homeLogo : m.awayLogo;
                      const key = getPlayerKey(p.name, teamName, ownerName);
                      if(!playerHistMap.has(key)) playerHistMap.set(key, {name:p.name.trim(), team: teamName, teamLogo, owner: ownerName, goals:0, assists:0}); 
                      playerHistMap.get(key).assists += p.count; 
                  });
              }
          }));
          const sortedSeasonTeams = Array.from(sTeamStats.values()).sort((a,b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
          sortedSeasonTeams.forEach((t, idx) => {
              const played = t.win + t.draw + t.loss;
              if(!ownerHist.has(t.ownerName)) ownerHist.set(t.ownerName, {name:t.ownerName, win:0, draw:0, loss:0, points:0, prize:0, golds:0, silvers:0, bronzes:0});
              const o = ownerHist.get(t.ownerName);
              o.win += t.win; o.draw += t.draw; o.loss += t.loss; o.points += t.points;
              if (played > 0) {
                  if(idx===0) { o.golds++; o.prize+=s.prizes.first; } else if(idx===1) { o.silvers++; o.prize+=s.prizes.second; } else if(idx===2) { o.bronzes++; o.prize+=s.prizes.third; }
              }
              if(!teamHist.has(t.name)) teamHist.set(t.name, {name:t.name, logo:t.logo, owner:t.ownerName, win:0, draw:0, loss:0, points:0});
              const tm = teamHist.get(t.name); tm.win+=t.win; tm.draw+=t.draw; tm.loss+=t.loss; tm.points+=t.points;
          });
      });
      return { owners: Array.from(ownerHist.values()).sort((a,b) => b.points - a.points || b.prize - a.prize), teams: Array.from(teamHist.values()).sort((a,b) => b.points - a.points), players: Array.from(playerHistMap.values()).sort((a:any,b:any) => b.goals - a.goals || b.assists - a.assists) };
  }, [seasons]);

  const getTeamPlayers = (teamName: string) => {
    const players = new Set<string>();
    activeRankingData.players.forEach((p:any) => { if(p.team === teamName) players.add(p.name); });
    return Array.from(players);
  };

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

  // 🔥 [Fix] Restore Swipe Handlers
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const handleTouchEnd = () => { 
    if (!touchStart || !touchEnd) return; 
    const dist = touchStart - touchEnd; 
    if (dist > 50) setBannerIdx((p) => (p + 1) % sortedBannersDisplay.length); 
    if (dist < -50) setBannerIdx((p) => (p - 1 + sortedBannersDisplay.length) % sortedBannersDisplay.length); 
    setTouchStart(0); setTouchEnd(0); 
  };

  const handleRecordInputChange = (type: string, field: string, value: string) => { setRecordInputs(prev => ({ ...prev, [type]: { ...(prev as any)[type], [field]: value } })); };
  const handleSaveOwner = async () => { if(newOwnerName) { if(editOwnerId) await updateDoc(doc(db,"users",editOwnerId),{nickname:newOwnerName,photo:newOwnerPhoto}); else await addDoc(collection(db,"users"),{id:Date.now(),nickname:newOwnerName,photo:newOwnerPhoto}); setNewOwnerName(''); setNewOwnerPhoto(''); setEditOwnerId(null); }};
  const handleEditOwnerClick = (o: Owner) => { setEditOwnerId(o.docId!); setNewOwnerName(o.nickname); setNewOwnerPhoto(o.photo); };
  const handleCreateSeason = async () => { if(inputSeasonName) { const id=Date.now(); await setDoc(doc(db,"seasons",String(id)),{ id, name:inputSeasonName, type:inputSeasonType, leagueMode:inputSeasonType==='LEAGUE'?inputLeagueMode:'SINGLE', isActive:true, teams:[], rounds:[], prizes:{total:inputTotalPrize, ...prizes} }); setAdminTab(id); setViewSeasonId(id); setInputSeasonName(''); alert("게임 생성 완료! 팀을 배정해주세요."); } else { alert("시즌 이름 입력 필요"); } };
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
        const nextPow2 = Math.pow(2, Math.ceil(Math.log2(shuffled.length))); const matchCount = nextPow2 / 2; 
        
        // 🔥 [Fix] Type Annotation
        let matches: Match[] = [];

        for(let i=0; i<matchCount; i++) { const h = shuffled[i*2], a = shuffled[i*2+1]; const stageName = getTournamentStageName(nextPow2, matchCount);
           matches.push(a ? { id: `${s.id}_R1_M${i}`, seasonId: s.id, home: h.name, away: a.name, homeLogo: h.logo, awayLogo: a.logo, homeOwner: h.ownerName, awayOwner: a.ownerName, homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'UPCOMING', youtubeUrl: '', stage: stageName, matchLabel: `Match ${i+1}`, nextMatchId: `${s.id}_R2_M${Math.floor(i/2)}` } : { id: `${s.id}_R1_M${i}`, seasonId: s.id, home: h.name, away: 'BYE (부전승)', homeLogo: h.logo, awayLogo: FALLBACK_IMG, homeOwner: h.ownerName, awayOwner: '-', homeScore: '1', awayScore: '0', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'BYE', youtubeUrl: '', stage: stageName, matchLabel: `Match ${i+1}`, nextMatchId: `${s.id}_R2_M${Math.floor(i/2)}` });
        }
        rounds.push({ round: 1, matches, seasonId: s.id, name: getTournamentStageName(nextPow2, matchCount) });
        let rIdx = 2; let currentCount = matchCount / 2;
        while(currentCount >= 0.5) {
            let nextMatches: Match[] = []; const stageName = getTournamentStageName(nextPow2, currentCount);
            for(let i=0; i < Math.ceil(currentCount); i++) {
                const nextId = currentCount > 0.5 ? `${s.id}_R${rIdx+1}_M${Math.floor(i/2)}` : null; 
                nextMatches.push({ id: `${s.id}_R${rIdx}_M${i}`, seasonId: s.id, home: 'TBD', away: 'TBD', homeLogo: FALLBACK_IMG, awayLogo: FALLBACK_IMG, homeOwner: '-', awayOwner: '-', homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'UPCOMING', youtubeUrl: '', stage: stageName, matchLabel: `Match ${i+1}`, nextMatchId: nextId }); 
            }
            rounds.push({ round: rIdx, matches: nextMatches, seasonId: s.id, name: stageName });
            if(currentCount === 0.5) break; currentCount /= 2; rIdx++;
        }
    } else {
        if(shuffled.length % 2 !== 0) shuffled.push({id:0, seasonId:0, name:'BYE', logo:FALLBACK_IMG, ownerName:'-', region:'', tier:'', win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0});
        const numRounds = shuffled.length - 1; const half = shuffled.length / 2; let allRoundMatches = []; let tempTeams = [...shuffled];
        for(let r=0; r<numRounds; r++) { 
            let roundMatches: Match[] = []; 
            for(let i=0; i<half; i++) { 
                const home = tempTeams[i], away = tempTeams[shuffled.length - 1 - i]; 
                if(home.name !== 'BYE' && away.name !== 'BYE') { 
                    roundMatches.push({
                        id: `${s.id}_R${r+1}_M${i}`, seasonId: s.id, home: home.name, away: away.name, homeLogo: home.logo, awayLogo: away.logo, homeOwner: home.ownerName, awayOwner: away.ownerName,
                        homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'UPCOMING', youtubeUrl: '', stage: `Round ${r+1}`, matchLabel: `Game ${i+1}`
                    }); 
                } 
            } 
            allRoundMatches.push(roundMatches); 
            tempTeams.splice(1, 0, tempTeams.pop()!); 
        }
        allRoundMatches.forEach((rm, idx) => rounds.push({round: idx+1, matches: rm, seasonId: s.id, name: `Round ${idx+1}`}));
        if(s.leagueMode === 'DOUBLE') { const firstHalfLen = rounds.length; allRoundMatches.forEach((rm, idx) => { const returnMatches = rm.map(m => ({ ...m, id: m.id + '_return', home: m.away, away: m.home, homeLogo: m.awayLogo, awayLogo: m.homeLogo, homeOwner: m.awayOwner, awayOwner: m.homeOwner, stage: `Round ${firstHalfLen + idx + 1}` })); rounds.push({round: firstHalfLen + idx + 1, matches: returnMatches, seasonId: s.id, name: `Round ${firstHalfLen + idx + 1}` }); }); }
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
  const handleMatchClick = (m: Match) => { 
      setEditingMatch({...m}); 
      setMatchInputs({homeScore:m.homeScore||'0',awayScore:m.awayScore||'0',youtube:m.youtubeUrl});
      setRecordInputs({ homeScorer:{name:'',count:'1'}, awayScorer:{name:'',count:'1'}, homeAssist:{name:'',count:'1'}, awayAssist:{name:'',count:'1'} });
  };
  
  const saveMatchResult = async () => {
    if(!editingMatch) return; const s = seasons.find(se => se.id === editingMatch.seasonId);
    if(s && s.rounds) { let newRounds = [...s.rounds]; newRounds = newRounds.map(r => ({ ...r, matches: r.matches.map(m => m.id === editingMatch.id ? { ...editingMatch, homeScore: matchInputs.homeScore, awayScore: matchInputs.awayScore, youtubeUrl: matchInputs.youtube, status: 'FINISHED' as const } : m) }));
       if (s.type === 'TOURNAMENT' && editingMatch.nextMatchId) { const winner = Number(matchInputs.homeScore) > Number(matchInputs.awayScore) ? {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner} : {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner}; newRounds = newRounds.map(r => ({ ...r, matches: r.matches.map(m => { if(m.id === editingMatch.nextMatchId) { const isHomeSlot = Number(editingMatch.id.split('_M')[1]) % 2 === 0; return isHomeSlot ? { ...m, home: winner.name, homeLogo: winner.logo, homeOwner: winner.owner } : { ...m, away: winner.name, awayLogo: winner.logo, awayOwner: winner.owner }; } return m; }) })); }
       await updateDoc(doc(db, "seasons", String(s.id)), { rounds: newRounds }); setEditingMatch(null);
    }
  };
  
  const handleRecordAdd = (type: string) => { 
      if(!editingMatch)return; 
      const k = type as keyof typeof recordInputs; 
      const count = Number(recordInputs[k].count);
      const name = recordInputs[k].name.trim(); // 🔥 Auto Trim
      if(!name) return alert("선수 이름을 입력하세요");

      if(type==='homeScorer') setMatchInputs(p=>({...p,homeScore:String(Number(p.homeScore)+count)})); 
      if(type==='awayScorer') setMatchInputs(p=>({...p,awayScore:String(Number(p.awayScore)+count)})); 
      
      const f=type+'s' as keyof Match; 
      const list=(editingMatch[f] as MatchRecord[])||[]; 
      setEditingMatch({...editingMatch,[f]:[...list,{id:Date.now(),name:recordInputs[k].name.trim(),count}]}); 
      setRecordInputs(prev => ({...prev, [type]: {...prev[type as keyof typeof prev], name: ''}})); 
  };

  const handleRecordRemove = (type: string, id: number) => { if(!editingMatch)return; const f=type+'s' as keyof Match; const list=(editingMatch[f] as MatchRecord[])||[]; const item=list.find(r=>r.id===id); if(item){ if(type==='homeScorer') setMatchInputs(p=>({...p,homeScore:String(Math.max(0,Number(p.homeScore)-item.count))})); if(type==='awayScorer') setMatchInputs(p=>({...p,awayScore:String(Math.max(0,Number(p.awayScore)-item.count))})); } setEditingMatch({...editingMatch,[f]:list.filter(r=>r.id!==id)}); };
  const handleDeleteSeason = async () => { if(confirm("⚠️ 경고: 게임 삭제 시 모든 데이터 영구 삭제. 진행합니까?")) { await deleteDoc(doc(db,"seasons",String(adminTab))); setAdminTab('NEW'); setViewSeasonId(0); } };
  
  // 🔥 [Fix] Added Safety Check for Banners Map
  const renderBanners = () => (sortedBannersDisplay && sortedBannersDisplay.length > 0) ? sortedBannersDisplay.map((b, i) => (<div key={b.id || i} className={`absolute inset-0 transition-opacity duration-1000 ${i === (bannerIdx % sortedBannersDisplay.length) ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>{getBannerContent(b)}</div>)) : null;

  const handleShareLink = () => { navigator.clipboard.writeText(window.location.href); alert("🔗 링크가 복사되었습니다!"); };
  const handleAdminLogin = () => { if(adminPwInput === '0705') { setAdminUnlocked(true); setAdminPwInput(''); } else { alert("비밀번호가 일치하지 않습니다."); } };

  return (
    <div className="min-h-screen bg-[#020617] text-white font-black italic tracking-tighter overflow-x-hidden pb-20">
      <div className="w-full h-[225px] md:h-[330px] relative border-b border-slate-800 shadow-2xl overflow-hidden bg-black" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {renderBanners()}
        <div className="absolute bottom-6 left-6 uppercase z-20 pointer-events-none">
          <h1 className="text-2xl md:text-4xl text-white font-black italic">eFootball™ Live evolution™</h1>
          <p className="text-emerald-400 text-[10px] md:text-xs font-sans not-italic tracking-widest mt-1">ver. P_10_27_Final_Clean</p>
        </div>
        <button onClick={handleShareLink} className="absolute top-4 right-4 z-30 bg-slate-900/80 p-2 rounded-full border border-slate-700 hover:bg-emerald-900 transition-colors"><img src="https://img.icons8.com/ios-filled/50/ffffff/share.png" className="w-5 h-5" alt="share"/></button>
      </div>
      
      <div className="max-w-6xl mx-auto px-4 mt-6 mb-8">
          <div className="grid grid-cols-5 gap-2">
              {['RANKING', 'SCHEDULE', 'HISTORY', 'TUTORIAL', 'ADMIN'].map(t => (
                  <button key={t} onClick={() => setCurrentView(t as any)} className={`h-14 md:h-16 rounded-xl border border-slate-800 flex flex-col items-center justify-center transition-all active:scale-95 shadow-lg ${currentView===t ? 'bg-gradient-to-br from-emerald-900 to-slate-900 border-emerald-500 text-emerald-400' : 'bg-slate-950 text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}><span className="text-[10px] md:text-xs font-black tracking-widest">{t}</span></button>
              ))}
          </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-8 space-y-8">
        
        {/* VIEW 1: RANKING */}
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
                                  <td className="p-4 flex items-center gap-3"><img src={t.logo} className="w-8 h-8 rounded-full bg-white object-contain p-0.5" alt="" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/><div className="flex flex-col"><span className="font-bold">{t.name}</span><span className="text-[9px] text-slate-500">{t.ownerName}</span></div></td>
                                  <td className="p-4 text-center text-slate-400">{t.win}</td><td className="p-4 text-center text-slate-400">{t.draw}</td><td className="p-4 text-center text-slate-400">{t.loss}</td><td className="p-4 text-center text-slate-500">{t.gd>0?`+${t.gd}`:t.gd}</td>
                                  <td className="p-4 text-center text-emerald-400 font-bold text-sm">{t.points}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                </div>
              )}

              {rankingTab === 'OWNERS' && (
                  <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                      <table className="w-full text-left text-xs uppercase border-collapse">
                          <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                              <tr><th className="p-4 w-8">#</th><th className="p-4">Owner</th><th className="p-4 text-center">W/D/L</th><th className="p-4 text-center">Pts</th><th className="p-4 text-right">Prize</th></tr>
                          </thead>
                          <tbody>
                              {activeRankingData.owners.map((o, i) => (
                                  <tr key={i} className="border-b border-slate-800/50">
                                      <td className={`p-4 text-center font-bold ${i===0?'text-yellow-400':i===1?'text-slate-300':i===2?'text-orange-400':'text-slate-600'}`}>{i+1}</td>
                                      <td className="p-4 font-bold text-white">{o.name}</td>
                                      <td className="p-4 text-center text-slate-400">{o.win}W {o.draw}D {o.loss}L</td>
                                      <td className="p-4 text-center text-emerald-400 font-bold">{o.points}</td>
                                      <td className="p-4 text-right text-yellow-500 font-bold">₩ {o.prize.toLocaleString()}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}

              {rankingTab === 'PLAYERS' && (
                  <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                      <div className="flex bg-slate-950 border-b border-slate-800">
                          <button onClick={()=>setRankPlayerMode('GOAL')} className={`flex-1 py-3 text-xs font-bold ${rankPlayerMode==='GOAL'?'text-yellow-400 bg-slate-900':'text-slate-500'}`}>⚽ TOP SCORERS</button>
                          <button onClick={()=>setRankPlayerMode('ASSIST')} className={`flex-1 py-3 text-xs font-bold ${rankPlayerMode==='ASSIST'?'text-blue-400 bg-slate-900':'text-slate-500'}`}>🅰️ TOP ASSISTS</button>
                      </div>
                      <table className="w-full text-left text-xs uppercase">
                          <thead className="bg-slate-900 text-slate-500"><tr><th className="p-3 w-8">#</th><th className="p-3">Player</th><th className="p-3">Team</th><th className="p-3 text-right">{rankPlayerMode}</th></tr></thead>
                          <tbody>
                              {activeRankingData.players
                                  .filter(p => rankPlayerMode === 'GOAL' ? p.goals > 0 : p.assists > 0)
                                  .sort((a:any,b:any) => rankPlayerMode === 'GOAL' ? b.goals - a.goals : b.assists - a.assists)
                                  .slice(0, 20).map((p:any,i:number)=>(
                                  <tr key={i} className="border-b border-slate-800/50">
                                      <td className={`p-3 text-center ${i<3?'text-emerald-400 font-bold':'text-slate-600'}`}>{i+1}</td>
                                      <td className="p-3 font-bold text-white">{p.name} <span className="text-[9px] text-slate-500 font-normal ml-1">({p.owner})</span></td>
                                      <td className="p-3 text-slate-400 flex items-center gap-2"><img src={p.teamLogo} className="w-5 h-5 object-contain rounded-full bg-white p-0.5" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /><span>{p.team}</span></td>
                                      <td className={`p-3 text-right font-bold ${rankPlayerMode==='GOAL'?'text-yellow-400':'text-blue-400'}`}>{rankPlayerMode==='GOAL'?p.goals:p.assists}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}

              {rankingTab === 'HIGHLIGHTS' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {activeRankingData.highlights.map((m, idx) => (
                          <div key={idx} className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 group hover:border-emerald-500 transition-all cursor-pointer" onClick={() => window.open(m.youtubeUrl, '_blank')}>
                              <div className="relative aspect-video">
                                  <img src={getYouTubeThumbnail(m.youtubeUrl)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                                  <div className="absolute inset-0 flex items-center justify-center"><div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-110 transition-transform">▶</div></div>
                              </div>
                              <div className="p-3 flex items-center gap-3">
                                  <img src={m.winnerLogo} className="w-8 h-8 rounded-full bg-white object-contain p-0.5" alt="" />
                                  <div className="flex-1 min-w-0">
                                      <p className="text-[10px] text-slate-500 font-bold uppercase">{m.stage} • {m.matchLabel}</p>
                                      <p className="text-xs font-bold text-white truncate">{m.home} <span className="text-emerald-400">{m.homeScore}:{m.awayScore}</span> {m.away}</p>
                                  </div>
                              </div>
                          </div>
                      ))}
                      {activeRankingData.highlights.length === 0 && <div className="col-span-3 text-center py-10 text-slate-500">등록된 하이라이트가 없습니다.</div>}
                  </div>
              )}
           </div>
        )}

        {/* VIEW 2: SCHEDULE */}
        {currentView === 'SCHEDULE' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
                    <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700">{seasons.map(s => <option key={s.id} value={s.id}>🗓️ {s.name}</option>)}</select>
                </div>
                
                {seasons.find(s=>s.id===viewSeasonId)?.rounds?.map((r, rIdx) => (
                    <div key={rIdx} className="space-y-2">
                        <h3 className="text-xs font-bold text-slate-500 pl-2 border-l-2 border-emerald-500">{r.name}</h3>
                        <div className="grid md:grid-cols-1 gap-2">
                            {r.matches.map(m => (
                                <div key={m.id} onClick={() => handleMatchClick(m)} className={`relative bg-slate-950 p-3 rounded-xl border ${m.status==='FINISHED'?'border-slate-800':'border-slate-700'} hover:border-emerald-500 cursor-pointer shadow-md group`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[9px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded">{m.matchLabel || 'Match'}</span>
                                        {/* 🔥 [Fix] YouTube Button Center & Clickable */}
                                        {m.youtubeUrl && (
                                            <span 
                                                className="text-[9px] text-red-500 font-bold flex items-center gap-1 z-20 cursor-pointer hover:underline"
                                                onClick={(e) => { e.stopPropagation(); window.open(m.youtubeUrl, '_blank'); }}
                                            >
                                                <img src="https://img.icons8.com/ios-filled/50/ff0000/youtube-play.png" className="w-3 h-3" alt="YT"/> 하이라이트
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex flex-col items-center w-1/3 gap-1">
                                            <img src={m.homeLogo} className="w-10 h-10 rounded-full bg-white object-contain p-0.5 shadow" alt="" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
                                            <span className="text-[10px] font-bold text-white leading-tight truncate w-full text-center">{m.home}</span>
                                            {/* 🔥 [UI Fix] Owner Name */}
                                            <span className="text-[9px] text-slate-500">{m.homeOwner}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            {m.status === 'FINISHED' ? (
                                                <div className="flex items-center gap-2 text-3xl font-black italic text-white tracking-tighter">
                                                    <span className={Number(m.homeScore)>Number(m.awayScore)?'text-emerald-400':''}>{m.homeScore}</span>
                                                    <span className="text-slate-700 text-xl">:</span>
                                                    <span className={Number(m.awayScore)>Number(m.homeScore)?'text-emerald-400':''}>{m.awayScore}</span>
                                                </div>
                                            ) : (
                                                <div className="bg-slate-900 px-3 py-1 rounded text-xs font-bold text-slate-500">VS</div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-center w-1/3 gap-1">
                                            <img src={m.awayLogo} className="w-10 h-10 rounded-full bg-white object-contain p-0.5 shadow" alt="" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
                                            <span className="text-[10px] font-bold text-white leading-tight truncate w-full text-center">{m.away}</span>
                                            {/* 🔥 [UI Fix] Owner Name */}
                                            <span className="text-[9px] text-slate-500">{m.awayOwner}</span>
                                        </div>
                                    </div>
                                    {/* 🔥 [UI Fix] Score Count */}
                                    {m.status === 'FINISHED' && (
                                        <div className="border-t border-slate-800 pt-2 mt-2 grid grid-cols-2 gap-2 text-[9px]">
                                            <div className="text-center space-y-0.5">
                                                {m.homeScorers.map((s, idx)=><div key={`hg-${idx}`} className="text-slate-300">⚽ {s.name} {s.count>1 && `(${s.count})`}</div>)}
                                                {m.homeAssists.map((s, idx)=><div key={`ha-${idx}`} className="text-slate-500">🅰️ {s.name} {s.count>1 && `(${s.count})`}</div>)}
                                            </div>
                                            <div className="text-center space-y-0.5">
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

        {/* VIEW 3: HISTORY */}
        {currentView === 'HISTORY' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-blue-900/20" />
                    <h2 className="text-2xl font-black italic text-white mb-1 relative z-10">👑 HALL OF FAME 👑</h2>
                    <p className="text-xs text-slate-400 relative z-10">역대 모든 시즌의 통합 기록입니다.</p>
                </div>

                <div className="bg-slate-900/80 p-2 rounded-2xl border border-slate-800 flex justify-center gap-1">
                    {['TEAMS', 'OWNERS', 'PLAYERS'].map(t => (
                        <button key={t} onClick={() => setHistoryTab(t as any)} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${historyTab === t ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-950 text-slate-500'}`}>{t}</button>
                    ))}
                </div>

                {/* 1. Teams History */}
                {historyTab === 'TEAMS' && (
                    <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                        <table className="w-full text-left text-xs uppercase">
                            <thead className="bg-slate-900 text-slate-500"><tr><th className="p-4 w-8">#</th><th className="p-4">Team</th><th className="p-4 text-center">W/D/L</th><th className="p-4 text-right">Pts</th></tr></thead>
                            <tbody>
                                {historyData.teams.slice(0, 20).map((t, i) => (
                                    <tr key={i} className="border-b border-slate-800/50">
                                        <td className="p-4 text-center text-slate-600">{i+1}</td>
                                        <td className="p-4 font-bold text-white flex items-center gap-2"><img src={t.logo} className="w-6 h-6 object-contain bg-white rounded-full p-0.5" alt=""/>{t.name} <span className="text-[9px] text-slate-500">({t.owner})</span></td>
                                        <td className="p-4 text-center text-slate-400">{t.win}W {t.draw}D {t.loss}L</td>
                                        <td className="p-4 text-right text-emerald-400 font-bold">{t.points}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* 2. Owners History */}
                {historyTab === 'OWNERS' && (
                    <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                        <table className="w-full text-left text-xs uppercase">
                            <thead className="bg-slate-900 text-slate-500">
                                <tr>
                                    <th className="p-4 w-8">#</th>
                                    <th className="p-4">Owner</th>
                                    <th className="p-4 text-center">W/D/L</th>
                                    <th className="p-4 text-center">Awards</th>
                                    <th className="p-4 text-right">Prize</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyData.owners.map((o, i) => (
                                    <tr key={i} className="border-b border-slate-800/50">
                                        <td className={`p-4 text-center font-bold ${i<3?'text-yellow-400':'text-slate-600'}`}>{i+1}</td>
                                        <td className="p-4 font-bold text-white">{o.name}</td>
                                        <td className="p-4 text-center text-slate-400">{o.win}W {o.draw}D {o.loss}L</td>
                                        <td className="p-4 text-center">
                                            {o.golds>0 && <span className="mr-1">🥇{o.golds}</span>}
                                            {o.silvers>0 && <span className="mr-1">🥈{o.silvers}</span>}
                                            {o.bronzes>0 && <span>🥉{o.bronzes}</span>}
                                            {o.golds+o.silvers+o.bronzes===0 && <span className="text-slate-700">-</span>}
                                        </td>
                                        <td className="p-4 text-right text-slate-300">₩ {o.prize.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* 3. Players History */}
                {historyTab === 'PLAYERS' && (
                    <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                        <div className="flex bg-slate-950 border-b border-slate-800">
                            <button onClick={()=>setHistPlayerMode('GOAL')} className={`flex-1 py-3 text-xs font-bold ${histPlayerMode==='GOAL'?'text-yellow-400 bg-slate-900':'text-slate-500'}`}>⚽ TOP SCORERS</button>
                            <button onClick={()=>setHistPlayerMode('ASSIST')} className={`flex-1 py-3 text-xs font-bold ${histPlayerMode==='ASSIST'?'text-blue-400 bg-slate-900':'text-slate-500'}`}>🅰️ TOP ASSISTS</button>
                        </div>
                        <table className="w-full text-left text-xs uppercase">
                            <thead className="bg-slate-900 text-slate-500"><tr><th className="p-3 w-8">#</th><th className="p-3">Player</th><th className="p-3">Team</th><th className="p-3 text-right">{histPlayerMode}</th></tr></thead>
                            <tbody>
                                {historyData.players
                                    .filter((p:any) => histPlayerMode === 'GOAL' ? p.goals > 0 : p.assists > 0)
                                    .sort((a:any,b:any) => histPlayerMode === 'GOAL' ? b.goals - a.goals : b.assists - a.assists)
                                    .slice(0, 20).map((p:any, i:number) => (
                                    <tr key={i} className="border-b border-slate-800/50">
                                        <td className="p-3 text-center text-slate-600">{i+1}</td>
                                        {/* 🔥 Updated: Player + Owner */}
                                        <td className="p-3 font-bold text-white">{p.name} <span className="text-[9px] text-slate-500 font-normal ml-1">({p.owner})</span></td>
                                        <td className="p-3 text-slate-400 flex items-center gap-2"><img src={p.teamLogo} className="w-5 h-5 object-contain rounded-full bg-white p-0.5" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /><span>{p.team}</span></td>
                                        <td className={`p-3 text-right font-bold ${histPlayerMode==='GOAL'?'text-yellow-400':'text-blue-400'}`}>{histPlayerMode==='GOAL'?p.goals:p.assists}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}

        {/* VIEW 4: TUTORIAL */}
        {currentView === 'TUTORIAL' && (
            <div className="space-y-6 animate-in fade-in">
                <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800">
                    <h2 className="text-xl font-bold text-emerald-400 mb-4">📘 리그 운영 가이드</h2>
                    <div className="space-y-6 text-sm text-slate-300">
                        <div><h3 className="text-white font-bold mb-1">1. 오너 생성 (ADMIN)</h3><p>어드민 메뉴의 &apos;오너 관리&apos; 탭에서 참가할 오너(플레이어)를 먼저 등록하세요.</p></div>
                        <div><h3 className="text-white font-bold mb-1">2. 시즌/게임 생성</h3><p>&apos;새 시즌&apos; 탭에서 시즌 이름, 타입(리그/토너먼트), 상금을 설정하고 생성합니다.</p></div>
                        <div><h3 className="text-white font-bold mb-1">3. 팀 배정</h3><p>생성된 시즌 ID를 선택하고, 오너에게 팀을 배정합니다. 필터를 사용하여 원하는 리그의 팀을 찾거나 랜덤 배정 기능을 활용하세요.</p></div>
                        <div><h3 className="text-white font-bold mb-1">4. 스케줄 & 기록</h3><p>팀 배정이 완료되면 자동으로 대진표가 생성됩니다. &apos;SCHEDULE&apos; 메뉴에서 각 경기를 클릭하여 스코어, 득점자, 어시스트, 유튜브 링크를 입력하세요.</p></div>
                    </div>
                </div>
            </div>
        )}

        {/* ADMIN VIEW */}
        {currentView === 'ADMIN' && (
           <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 animate-in fade-in">
             {!adminUnlocked ? (
                 <div className="flex flex-col items-center justify-center py-10 space-y-4">
                     <div className="text-4xl">🔒</div>
                     <h3 className="text-lg font-bold text-white">관리자 권한 필요</h3>
                     <input type="password" value={adminPwInput} onChange={e=>setAdminPwInput(e.target.value)} className="bg-slate-950 border border-slate-700 p-3 rounded-xl text-center text-white w-48 text-base" placeholder="Password" />
                     <button onClick={handleAdminLogin} className="bg-slate-800 px-6 py-2 rounded-xl font-bold text-emerald-400">LOGIN</button>
                 </div>
             ) : (
                 <>
                    <select value={adminTab} onChange={(e) => setAdminTab(e.target.value === 'NEW' || e.target.value === 'OWNER' || e.target.value === 'BANNER' || e.target.value === 'LEAGUES' || e.target.value === 'TEAMS' ? e.target.value : Number(e.target.value))} className="w-full bg-slate-950 p-4 rounded-xl border border-slate-700 text-sm mb-4 h-14">
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
                            <div className="space-y-1"><label className="text-xs text-slate-400 font-bold">1. Season Name</label><input value={inputSeasonName} onChange={e=>setInputSeasonName(e.target.value)} placeholder="예: 2026 Season 1" className="bg-slate-800 w-full p-4 rounded border border-slate-700 text-base"/></div>
                            <div className="space-y-1"><label className="text-xs text-slate-400 font-bold">2. Type & Mode</label><div className="flex gap-2"><select value={inputSeasonType} onChange={e=>setInputSeasonType(e.target.value as any)} className="bg-slate-800 p-4 rounded border border-slate-700 flex-1 h-14 text-base"><option value="LEAGUE">LEAGUE</option><option value="TOURNAMENT">TOURNAMENT</option></select>{inputSeasonType === 'LEAGUE' && <select value={inputLeagueMode} onChange={e=>setInputLeagueMode(e.target.value as any)} className="bg-slate-800 p-4 rounded border border-slate-700 flex-1 h-14 text-base"><option value="SINGLE">SINGLE</option><option value="DOUBLE">DOUBLE</option></select>}</div></div>
                            {/* 🔥 [Fix] Manual Prize Input UI - Fixed Manual Toggle Bug */}
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 font-bold flex justify-between items-center">
                                    3. Prizes (상금 설정)
                                    <button onClick={()=>setIsAutoPrize(!isAutoPrize)} className={`text-xs px-2 py-1 rounded border ${isAutoPrize?'border-emerald-500 text-emerald-400':'border-orange-500 text-orange-400'}`}>{isAutoPrize?'⚡ Auto Mode':'✏️ Manual Mode'}</button>
                                </label>
                                {isAutoPrize ? (
                                    <>
                                        <input type="number" value={inputTotalPrize} onChange={e=>setInputTotalPrize(Number(e.target.value))} className="bg-slate-800 w-full p-4 rounded border border-slate-700 text-right text-lg font-bold text-emerald-400 mb-2 text-base" placeholder="Total Prize"/>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="bg-slate-950 p-2 rounded flex justify-between"><span>🥇 1st (50%)</span><span>{prizes.first.toLocaleString()}</span></div>
                                            <div className="bg-slate-950 p-2 rounded flex justify-between"><span>🥈 2nd (30%)</span><span>{prizes.second.toLocaleString()}</span></div>
                                            <div className="bg-slate-950 p-2 rounded flex justify-between"><span>🥉 3rd (10%)</span><span>{prizes.third.toLocaleString()}</span></div>
                                            <div className="bg-slate-950 p-2 rounded flex justify-between"><span>👟 Scorer (10%)</span><span>{prizes.scorer.toLocaleString()}</span></div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><label className="text-[10px] text-slate-500">🥇 1st</label><input type="number" value={prizes.first} onChange={e=>setPrizes({...prizes, first:Number(e.target.value)})} className="bg-slate-800 w-full p-2 rounded border border-slate-700 text-right text-sm"/></div>
                                        <div><label className="text-[10px] text-slate-500">🥈 2nd</label><input type="number" value={prizes.second} onChange={e=>setPrizes({...prizes, second:Number(e.target.value)})} className="bg-slate-800 w-full p-2 rounded border border-slate-700 text-right text-sm"/></div>
                                        <div><label className="text-[10px] text-slate-500">🥉 3rd</label><input type="number" value={prizes.third} onChange={e=>setPrizes({...prizes, third:Number(e.target.value)})} className="bg-slate-800 w-full p-2 rounded border border-slate-700 text-right text-sm"/></div>
                                        <div><label className="text-[10px] text-slate-500">👟 Scorer</label><input type="number" value={prizes.scorer} onChange={e=>setPrizes({...prizes, scorer:Number(e.target.value)})} className="bg-slate-800 w-full p-2 rounded border border-slate-700 text-right text-sm"/></div>
                                    </div>
                                )}
                            </div>
                            <button onClick={handleCreateSeason} className="w-full bg-emerald-600 py-4 rounded-xl font-bold">Create Season</button>
                        </div>
                    )}
                    
                    {typeof adminTab === 'number' && (
                        <div className="space-y-6">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 sticky top-0 z-20 shadow-xl">
                            <h3 className="text-sm font-bold text-slate-400 mb-2">👤 오너 배정 설정</h3>
                            <div className="flex gap-2 items-center mb-4">
                                <select value={selOwnerId} onChange={e=>setSelOwnerId(Number(e.target.value))} className={`flex-1 p-3 h-12 rounded-xl border font-bold text-sm ${selOwnerId ? 'bg-indigo-900 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}><option value="">👤 배정할 오너 선택 (필수)</option>{owners.map(o=><option key={o.id} value={o.id}>{o.nickname}</option>)}</select>
                                <button onClick={handleRandomFromFilter} className="bg-purple-600 px-4 h-12 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform" title="랜덤 배정">🎲</button>
                            </div>
                            <div className="grid grid-cols-3 gap-1 mb-1">
                                <select value={assignCategory} onChange={e=>{setAssignCategory(e.target.value as any); setAssignRegion('ALL');}} className="bg-slate-900 border border-slate-700 p-2 rounded text-[10px] h-10"><option value="ALL">전체 타입</option><option value="CLUB">클럽</option><option value="NATIONAL">국가대표</option></select>
                                <select value={assignTier} onChange={e=>setAssignTier(e.target.value)} className="bg-slate-900 border border-slate-700 p-2 rounded text-[10px] h-10"><option value="ALL">전체 등급</option>{['S','A','B','C'].map(t=><option key={t} value={t}>{t}급</option>)}</select>
                                <select value={assignRegion} onChange={e=>setAssignRegion(e.target.value)} className="bg-slate-900 border border-slate-700 p-2 rounded text-[10px] h-10"><option value="ALL">전체 리그/지역</option><optgroup label="[ 클럽 리그 ]">{clubLeagues.map(r=><option key={r} value={r}>{r}</option>)}</optgroup><optgroup label="[ 국가대표 지역 ]">{nationalLeagues.map(r=><option key={r} value={r}>{r}</option>)}</optgroup></select>
                            </div>
                            <input value={assignSearch} onChange={e=>setAssignSearch(e.target.value)} placeholder="팀 이름 검색..." className="bg-slate-900 border border-slate-700 p-3 rounded text-xs w-full h-10" />
                        </div>

                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 min-h-[300px]">
                            <h4 className="text-xs font-bold text-slate-400 mb-3 flex justify-between"><span>👇 {assignRegion === 'ALL' && !assignSearch ? '리그/지역을 선택하세요' : `팀을 클릭하여 배정 (${availableTeams.length})`}</span>{selOwnerId && <span className="text-emerald-400">To: {owners.find(o=>o.id===selOwnerId)?.nickname}</span>}</h4>
                            
                            {assignRegion === 'ALL' && !assignSearch ? (
                                <div className="space-y-6">
                                    {(assignCategory === 'ALL' || assignCategory === 'CLUB') && (<div><p className="text-[10px] text-slate-500 font-bold mb-2 ml-1">[ 클럽 리그 ]</p><div className="grid grid-cols-4 gap-3">{clubLeagues.map((l, i) => (<div key={i} onClick={() => setAssignRegion(l)} className="flex flex-col items-center gap-1 cursor-pointer hover:scale-105 transition-transform"><img src={leagues.find(lg=>lg.name===l)?.logo || FALLBACK_IMG} className="w-12 h-12 rounded-full bg-white object-contain p-1.5 shadow-md" alt="" /><span className="text-[9px] text-slate-400 text-center leading-tight">{l}</span></div>))}</div></div>)}
                                    {(assignCategory === 'ALL' || assignCategory === 'NATIONAL') && (<div><p className="text-[10px] text-slate-500 font-bold mb-2 ml-1">[ 국가대표 지역 ]</p><div className="grid grid-cols-4 gap-3">{nationalLeagues.map((l, i) => (<div key={i} onClick={() => setAssignRegion(l)} className="flex flex-col items-center gap-1 cursor-pointer hover:scale-105 transition-transform"><img src={leagues.find(lg=>lg.name===l)?.logo || FALLBACK_IMG} className="w-12 h-12 rounded-full bg-white object-cover shadow-md" alt="" /><span className="text-[9px] text-slate-400 text-center leading-tight">{l}</span></div>))}</div></div>)}
                                </div>
                            ) : (
                                <div>
                                    <div className="grid grid-cols-4 md:grid-cols-6 gap-3">{availableTeams.map(t => (<div key={t.id} onClick={() => handleQuickAssign(t)} className="relative aspect-square bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-900/20 transition-all active:scale-95 group"><img src={t.logo} className={`w-10 h-10 shadow-md ${t.category==='NATIONAL'?'rounded-full object-cover':'object-contain'}`} onError={(e:any)=>e.target.src=FALLBACK_IMG} alt="" /><div className="absolute bottom-1 w-full text-center px-1"><p className="text-[9px] truncate text-slate-400 group-hover:text-white font-bold">{t.name}</p></div><span className={`absolute top-1 right-1 text-[8px] px-1 rounded ${getTierBadgeColor(t.tier || 'C')}`}>{t.tier || 'C'}</span></div>))}</div>
                                    <button onClick={() => {setAssignRegion('ALL'); setAssignSearch('');}} className="w-full mt-6 py-3 bg-slate-800 text-slate-400 text-xs rounded-xl hover:bg-slate-700">← 리그 목록으로 돌아가기</button>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-slate-800 pt-4">
                            <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-emerald-400">배정된 팀 ({seasons.find(s=>s.id===adminTab)?.teams?.length || 0})</span><button onClick={handleFinishAssignment} className="text-xs bg-emerald-600 px-4 py-2 rounded font-bold hover:bg-emerald-500">✅ 배정 완료 & 스케줄 이동</button></div>
                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto mb-4">{seasons.find(s=>s.id===adminTab)?.teams?.map(t=>(<div key={t.id} className="text-xs bg-slate-950 p-2 rounded flex justify-between items-center border border-slate-800"><div className="flex items-center gap-2"><img src={t.logo} className="w-4 h-4 rounded-full" alt="" /><span>{t.name}</span><span className="text-slate-500">({t.ownerName})</span></div><button onClick={()=>handleRemoveTeamFromSeason(t.id)} className="text-red-500 font-bold px-2">×</button></div>))}</div>
                            <div className="flex gap-2"><button onClick={handleGenerateSchedule} className="flex-1 bg-slate-800 py-3 rounded text-xs font-bold text-slate-400 border border-slate-700 hover:bg-slate-700">🔄 스케줄 재생성</button><button onClick={handleDeleteSeason} className="flex-1 bg-red-900/30 py-3 rounded text-xs font-bold text-red-500 border border-red-900 hover:bg-red-900/50">⚠️ 시즌 삭제</button></div>
                        </div>
                        </div>
                    )}

                    {adminTab === 'OWNER' && <div className="flex gap-2"><input value={newOwnerName} onChange={e=>setNewOwnerName(e.target.value)} placeholder="Owner Name" className="bg-slate-950 p-3 rounded w-full text-base"/><input value={newOwnerPhoto} onChange={e=>setNewOwnerPhoto(e.target.value)} placeholder="Photo URL" className="bg-slate-950 p-3 rounded w-full text-base"/><button onClick={handleSaveOwner} className="bg-purple-600 px-6 rounded font-bold">Save</button></div>}
                    {adminTab === 'OWNER' && <div className="grid grid-cols-2 gap-2 mt-4">{owners.map(o => <div key={o.id} onClick={()=>handleEditOwnerClick(o)} className="p-2 bg-black rounded flex items-center gap-2 cursor-pointer"><img src={o.photo} className="w-8 h-8 rounded-full" alt="" /><span>{o.nickname}</span></div>)}</div>}
                 </>
             )}
           </div>
        )}
      </main>

      {editingMatch && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] p-4">
           <div className="bg-slate-900 p-6 rounded-3xl border border-slate-700 w-full max-w-5xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setEditingMatch(null)} className="absolute top-4 right-4 text-white text-2xl">✕</button>
              
              <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-slate-300 italic">{editingMatch.matchLabel}</h3>
                  <p className="text-sm text-slate-500">{editingMatch.stage}</p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="flex flex-col items-center mb-4"><img src={editingMatch.homeLogo} className="w-12 h-12 mb-2" alt="" /><span className="font-bold text-white">{editingMatch.home}</span></div>
                      <div className="space-y-4">
                          {/* 🔥 [Feature] Autocomplete Datalist */}
                          <datalist id="homeTeamPlayers">
                              {getTeamPlayers(editingMatch.home).map((name, i) => <option key={i} value={name} />)}
                          </datalist>
                          <RecordInput type="homeScorer" inputValue={recordInputs.homeScorer} onInputChange={handleRecordInputChange} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.homeScorers} label="⚽ Scorers" colorClass="text-emerald-400" datalistId="homeTeamPlayers" />
                          <RecordInput type="homeAssist" inputValue={recordInputs.homeAssist} onInputChange={handleRecordInputChange} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.homeAssists} label="🅰️ Assists" colorClass="text-blue-400" datalistId="homeTeamPlayers" />
                      </div>
                  </div>

                  <div className="flex flex-col items-center justify-center space-y-6">
                      <div className="flex items-center gap-4">
                          <input type="number" value={matchInputs.homeScore} onChange={e=>setMatchInputs({...matchInputs, homeScore:e.target.value})} className="w-20 h-20 text-center text-4xl font-black bg-black rounded-2xl border border-slate-700 text-white focus:border-emerald-500 outline-none" />
                          <span className="text-slate-600 text-2xl">:</span>
                          <input type="number" value={matchInputs.awayScore} onChange={e=>setMatchInputs({...matchInputs, awayScore:e.target.value})} className="w-20 h-20 text-center text-4xl font-black bg-black rounded-2xl border border-slate-700 text-white focus:border-emerald-500 outline-none" />
                      </div>
                      <div className="w-full">
                          <label className="text-xs text-slate-500 mb-1 block text-center">YouTube Highlights URL</label>
                          <input value={matchInputs.youtube} onChange={e=>setMatchInputs({...matchInputs,youtube:e.target.value})} placeholder="https://youtube.com/..." className="w-full bg-black p-3 rounded-xl text-center text-xs border border-slate-700 text-white text-base"/>
                      </div>
                      <button onClick={saveMatchResult} className="bg-emerald-600 w-full py-4 rounded-xl font-black text-lg hover:bg-emerald-500 shadow-lg shadow-emerald-900/20">SAVE RESULT</button>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="flex flex-col items-center mb-4"><img src={editingMatch.awayLogo} className="w-12 h-12 mb-2" alt="" /><span className="font-bold text-white">{editingMatch.away}</span></div>
                      <div className="space-y-4">
                          {/* 🔥 [Feature] Autocomplete Datalist */}
                          <datalist id="awayTeamPlayers">
                              {getTeamPlayers(editingMatch.away).map((name, i) => <option key={i} value={name} />)}
                          </datalist>
                          <RecordInput type="awayScorer" inputValue={recordInputs.awayScorer} onInputChange={handleRecordInputChange} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.awayScorers} label="⚽ Scorers" colorClass="text-emerald-400" datalistId="awayTeamPlayers" />
                          <RecordInput type="awayAssist" inputValue={recordInputs.awayAssist} onInputChange={handleRecordInputChange} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.awayAssists} label="🅰️ Assists" colorClass="text-blue-400" datalistId="awayTeamPlayers" />
                      </div>
                  </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}