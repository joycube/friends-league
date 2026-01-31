/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc, getDoc } from 'firebase/firestore';

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
  status: 'UPCOMING' | 'FINISHED' | 'BYE'; youtubeUrl: string; stage?: string; matchLabel?: string;
}
interface Round { round: number; matches: Match[]; seasonId: number; name?: string; }
interface Banner { id?: string; title: string; url: string; order: number; }

// --- [상수] 리그 우선순위 정렬용 ---
const POPULAR_LEAGUES = [
  "Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1", 
  "K League", "J League", "MLS", "Saudi Pro League"
];

// --- [컴포넌트] 기록 입력기 ---
const RecordInput = ({ type, inputValue, onInputChange, onAdd, onRemove, records, label, colorClass }: any) => {
  return (
    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 h-full flex flex-col relative z-10">
      <p className={`text-xs font-bold mb-2 uppercase ${colorClass} border-b border-slate-700/50 pb-1`}>{label}</p>
      <div className="flex gap-2 mb-3">
        <input type="text" value={inputValue.name} onChange={(e) => onInputChange(type, 'name', e.target.value)} placeholder="선수명" className="flex-1 bg-slate-900 text-base p-2 rounded-lg border border-slate-600 focus:border-blue-500 outline-none text-white w-full" />
        <input type="number" value={inputValue.count} onChange={(e) => onInputChange(type, 'count', e.target.value)} className="w-12 bg-slate-900 text-base p-2 rounded-lg border border-slate-600 focus:border-blue-500 outline-none text-center text-white" />
        <button onClick={() => onAdd(type)} className="bg-slate-700 text-white w-10 h-10 rounded-lg font-bold hover:bg-slate-600 transition-colors flex items-center justify-center text-xl touch-manipulation">+</button>
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto max-h-[100px] flex-1">
        {(records || []).map((r:any) => (
          <div key={r.id} className="flex justify-between items-center bg-slate-900 px-3 py-2 rounded-md border border-slate-700">
            <span className="text-sm text-slate-300">{r.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white bg-slate-700 px-2 py-0.5 rounded">{r.count}</span>
              <button onClick={() => onRemove(type, r.id)} className="text-red-400 hover:text-red-300 text-sm px-2">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function FootballLeagueApp() {
  const [currentView, setCurrentView] = useState<'RANKING' | 'SCHEDULE' | 'HISTORY' | 'ADMIN' | 'TUTORIAL'>('RANKING');
  const [rankingTab, setRankingTab] = useState<'STANDINGS' | 'OWNERS' | 'PLAYERS' | 'HIGHLIGHTS'>('STANDINGS');
  const [historyTab, setHistoryTab] = useState<'TEAMS' | 'OWNERS' | 'PLAYERS'>('TEAMS');
  const [adminTab, setAdminTab] = useState<number | 'NEW' | 'OWNER' | 'BANNER' | 'TEAMS'>('NEW');
  
  const [viewSeasonId, setViewSeasonId] = useState<number>(0); 
  const [statView, setStatView] = useState<'GOAL' | 'ASSIST'>('GOAL');
  const [historyStatView, setHistoryStatView] = useState<'GOAL' | 'ASSIST'>('GOAL');
  const [currentTime, setCurrentTime] = useState<string>('');

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);
  
  // Banner States
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [bannerDelay, setBannerDelay] = useState(5000);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // Inputs
  const [inputSeasonName, setInputSeasonName] = useState('');
  const [inputSeasonType, setInputSeasonType] = useState<'LEAGUE' | 'TOURNAMENT'>('LEAGUE');
  const [inputLeagueMode, setInputLeagueMode] = useState<'SINGLE' | 'DOUBLE'>('SINGLE');
  const [inputTotalPrize, setInputTotalPrize] = useState(100000);
  const [prizes, setPrizes] = useState({ first: 50000, second: 30000, third: 10000, scorer: 10000 });
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPhoto, setNewOwnerPhoto] = useState('');
  const [editOwnerId, setEditOwnerId] = useState<string | null>(null);

  const [selOwnerId, setSelOwnerId] = useState<number | ''>('');
  const [selCategory, setSelCategory] = useState<'CLUB' | 'NATIONAL' | 'ALL'>('ALL');
  const [selTier, setSelTier] = useState<string>('ALL');
  const [selRegion, setSelRegion] = useState<string>('ALL');
  const [selTeamName, setSelTeamName] = useState<string>('');

  const [manageTab, setManageTab] = useState<'CLUB' | 'NATIONAL' | 'ALL'>('ALL');
  const [manageTier, setManageTier] = useState('ALL');
  const [manageRegion, setManageRegion] = useState('ALL');
  const [manageSearch, setManageSearch] = useState('');
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [manualTeam, setManualTeam] = useState<MasterTeam>({ name: '', logo: '', category: 'CLUB', region: '', tier: 'A' });
  const [bulkInput, setBulkInput] = useState('');
  const [visibleTeamCount, setVisibleTeamCount] = useState(18);
  const manualFormRef = useRef<HTMLDivElement>(null);

  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [matchInputs, setMatchInputs] = useState({ homeScore:'', awayScore:'', youtube:'' });
  const [recordInputs, setRecordInputs] = useState({ homeScorer:{name:'',count:'1'}, awayScorer:{name:'',count:'1'}, homeAssist:{name:'',count:'1'}, awayAssist:{name:'',count:'1'} });

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${year}.${month}.${day} ${hours}:${minutes}:${seconds}`);
    };
    updateTime(); 
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Banner Logic
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setTimeout(() => {
      setBannerIdx((prev) => (prev + 1) % banners.length);
      setBannerDelay(5000);
    }, bannerDelay);
    return () => clearTimeout(timer);
  }, [bannerIdx, banners.length, bannerDelay]);

  // Handle Swipe
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe) { setBannerIdx((prev) => (prev + 1) % (banners.length || 1)); setBannerDelay(5000); }
    if (isRightSwipe) { setBannerIdx((prev) => (prev - 1 + (banners.length || 1)) % (banners.length || 1)); setBannerDelay(5000); }
    setTouchStart(0); setTouchEnd(0);
  };

  useEffect(() => { 
    setPrizes({ first: Math.floor(inputTotalPrize*0.5), second: Math.floor(inputTotalPrize*0.3), third: Math.floor(inputTotalPrize*0.1), scorer: Math.floor(inputTotalPrize*0.1) }); 
  }, [inputTotalPrize]);
  
  useEffect(() => { setVisibleTeamCount(18); }, [manageTab, manageTier, manageRegion, manageSearch]);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "users"), orderBy("id", "asc")), s => setOwners(s.docs.map(d => ({...d.data(), docId: d.id} as Owner))));
    const u2 = onSnapshot(collection(db, "master_teams"), s => setMasterTeams(s.docs.map(d => ({id:d.id, ...d.data()} as MasterTeam))));
    const u3 = onSnapshot(query(collection(db, "seasons"), orderBy("id", "desc")), s => {
      const d = s.docs.map(doc => doc.data() as Season); 
      setSeasons(d);
      if(d.length > 0) {
        if(viewSeasonId === 0) {
          setViewSeasonId(d[0].id);
          if(typeof adminTab === 'number') setAdminTab(d[0].id);
        }
      } else {
        setAdminTab('NEW');
        setViewSeasonId(0);
      }
    });

    const u4 = onSnapshot(collection(db, "banners"), s => {
      const rawBanners = s.docs.map(d => ({id:d.id, ...d.data()} as Banner));
      const videos = rawBanners.filter(b => b.url.includes('youtube') || b.url.includes('youtu.be'));
      const images = rawBanners.filter(b => !b.url.includes('youtube') && !b.url.includes('youtu.be')).sort(() => Math.random() - 0.5);
      
      let finalBanners: Banner[] = [];
      let initialDelay = 5000;
      if (videos.length > 0) {
        const randomVideo = videos[Math.floor(Math.random() * videos.length)];
        finalBanners = [randomVideo, ...shuffledImages];
        initialDelay = 30000;
      } else {
        finalBanners = images;
      }
      setBanners(finalBanners);
      setBannerIdx(0);
      setBannerDelay(initialDelay);
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const activeRankingData = useMemo(() => {
    const targetSeason = seasons.find(s => s.id === viewSeasonId);
    if(!targetSeason?.teams) return { teams: [], owners: [], players: [], highlights: [] };
    
    const teamStats = new Map<string, Team>();
    targetSeason.teams.forEach(t => teamStats.set(t.name, { ...t, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 }));

    targetSeason.rounds?.forEach(r => {
      r.matches.forEach(m => {
        if(m.status === 'FINISHED' && m.homeScore !== '' && m.awayScore !== '') {
          const h = Number(m.homeScore), a = Number(m.awayScore);
          const ht = teamStats.get(m.home), at = teamStats.get(m.away);
          if(ht && at) {
            ht.gf+=h; ht.ga+=a; ht.gd+=(h-a); at.gf+=a; at.ga+=h; at.gd+=(a-h);
            if(h>a) { ht.win++; ht.points+=3; at.loss++; } 
            else if(h<a) { at.win++; at.points+=3; ht.loss++; } 
            else { ht.draw++; at.draw++; ht.points++; at.points++; }
          }
        }
      });
    });

    const teams = Array.from(teamStats.values()).sort((a,b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf).map((t, idx) => {
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
    const tMap = new Map<string, {name:string, owner:string, logo:string, w:number, d:number, l:number, pts:number}>();
    const oMap = new Map<string, {name:string, w:number, d:number, l:number, pts:number, prize:number}>();
    const pMap = new Map<string, {name:string, owner:string, goals:number, assists:number}>();

    seasons.forEach(s => {
      const seasonTeams = new Map<string, Team>();
      s.teams?.forEach(t => seasonTeams.set(t.name, { ...t, win:0, draw:0, loss:0, points:0 }));
      
      s.rounds?.forEach(r => r.matches.forEach(m => {
        if(m.status==='FINISHED' && m.homeScore && m.awayScore) {
          const h=Number(m.homeScore), a=Number(m.awayScore);
          const ht=seasonTeams.get(m.home), at=seasonTeams.get(m.away);
          if(ht && at) {
            if(h>a) { ht.win++; ht.points+=3; at.loss++; }
            else if(h<a) { at.win++; at.points+=3; ht.loss++; }
            else { ht.draw++; at.draw++; ht.points++; at.points++; }
          }
          const addP = (list:MatchRecord[], type:'goals'|'assists', o:string) => list.forEach(i => {
            if(!pMap.has(i.name)) pMap.set(i.name, {name:i.name, owner:o, goals:0, assists:0});
            pMap.get(i.name)![type] += i.count;
          });
          addP(m.homeScorers||[], 'goals', m.homeOwner); addP(m.awayScorers||[], 'goals', m.awayOwner);
          addP(m.homeAssists||[], 'assists', m.homeOwner); addP(m.awayAssists||[], 'assists', m.awayOwner);
        }
      }));

      const rankedTeams = Array.from(seasonTeams.values()).sort((a,b) => b.points - a.points);
      rankedTeams.forEach((t, idx) => {
        if(!tMap.has(t.name)) tMap.set(t.name, {name:t.name, owner:t.ownerName, logo:t.logo, w:0, d:0, l:0, pts:0});
        const tm = tMap.get(t.name)!;
        tm.w+=t.win; tm.d+=t.draw; tm.l+=t.loss; tm.pts+=t.points;

        if(!oMap.has(t.ownerName)) oMap.set(t.ownerName, {name:t.ownerName, w:0, d:0, l:0, pts:0, prize:0});
        const om = oMap.get(t.ownerName)!;
        om.w+=t.win; om.d+=t.draw; om.l+=t.loss; om.pts+=t.points;
        if(idx===0) om.prize+=s.prizes.first;
        if(idx===1) om.prize+=s.prizes.second;
        if(idx===2) om.prize+=s.prizes.third;
      });
    });

    return { 
      teams: Array.from(tMap.values()), 
      owners: Array.from(oMap.values()).filter(o => o.w > 0 || o.pts > 0 || o.prize > 0), 
      players: Array.from(pMap.values()).filter(p => p.goals > 0 || p.assists > 0)
    };
  }, [seasons]);

  const handleSaveOwner = async () => {
    if(!newOwnerName.trim()) return alert("입력하세요");
    const photo = newOwnerPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(newOwnerName)}`;
    if(editOwnerId) { await updateDoc(doc(db, "users", editOwnerId), { nickname: newOwnerName, photo }); setEditOwnerId(null); } 
    else { await addDoc(collection(db, "users"), { id: Date.now(), nickname: newOwnerName, photo }); }
    setNewOwnerName(''); setNewOwnerPhoto('');
  };
  const handleEditOwnerClick = (o: Owner) => { setEditOwnerId(o.docId!); setNewOwnerName(o.nickname); setNewOwnerPhoto(o.photo); };
  const handleCreateSeason = async () => {
    if(!inputSeasonName) return alert("시즌명 입력");
    const id = Date.now();
    await setDoc(doc(db, "seasons", String(id)), { id, name: inputSeasonName, type: inputSeasonType, leagueMode: inputSeasonType==='LEAGUE'?inputLeagueMode:'SINGLE', isActive: true, teams: [], rounds: [], prizes: { total: inputTotalPrize, ...prizes } });
    setAdminTab(id); setViewSeasonId(id); setInputSeasonName('');
  };
  const handleDeleteSeason = async () => {
    if(typeof adminTab !== 'number') return;
    if(confirm("⚠️ 삭제하시겠습니까?")) { 
      await deleteDoc(doc(db, "seasons", String(adminTab))); 
      setAdminTab('NEW'); 
      setViewSeasonId(0); 
      setInputSeasonName('');
      alert("삭제되었습니다. 새로운 게임을 생성하세요."); 
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

  const handleRemoveTeamFromSeason = async (teamId: number) => {
    if(!recordActiveS) return;
    if(confirm("이 시즌에서 팀을 삭제하시겠습니까?\n(이미 진행된 경기 기록에 영향을 줄 수 있습니다.)")) {
      const newTeams = recordActiveS.teams?.filter(t => t.id !== teamId) || [];
      await updateDoc(doc(db, "seasons", String(recordActiveS.id)), { teams: newTeams });
    }
  };

  const getStageName = (teamCount: number) => {
    if(teamCount === 2) return "Final";
    if(teamCount === 4) return "Semi-finals";
    if(teamCount <= 8) return "Quarter-finals";
    return `Round of ${teamCount}`;
  };

  const handleGenerateSchedule = async () => {
    if(!recordActiveS || !recordActiveS.teams || recordActiveS.teams.length < 2) return alert("팀 2개 이상 필요");
    const isTournament = recordActiveS.type === 'TOURNAMENT';
    
    if(confirm(`${isTournament ? '🏆 토너먼트' : '⚽ 리그'} 스케줄을 생성하시겠습니까?`)) {
      const teams = [...recordActiveS.teams];
      const isDouble = recordActiveS.leagueMode === 'DOUBLE';
      const rounds: Round[] = [];

      if(isTournament) {
        const shuffled = teams.sort(() => Math.random() - 0.5);
        const matches: Match[] = [];
        for(let i=0; i<shuffled.length; i+=2) {
          if(i+1 < shuffled.length) {
            matches.push({
              id: `${recordActiveS.id}_R1_M${i/2}`, seasonId: recordActiveS.id,
              home: shuffled[i].name, away: shuffled[i+1].name,
              homeLogo: shuffled[i].logo, awayLogo: shuffled[i+1].logo,
              homeOwner: shuffled[i].ownerName, awayOwner: shuffled[i+1].ownerName,
              homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [],
              status: 'UPCOMING', youtubeUrl: '', stage: getStageName(teams.length), matchLabel: `${getStageName(teams.length)} - Match ${(i/2)+1}`
            });
          }
        }
        rounds.push({ round: 1, matches, seasonId: recordActiveS.id, name: getStageName(teams.length) });
      } else {
        let allMatches: {home:Team, away:Team}[] = [];
        for(let i=0; i<teams.length; i++) {
          for(let j=i+1; j<teams.length; j++) {
            if(teams[i].ownerName !== teams[j].ownerName) {
              allMatches.push({ home: teams[i], away: teams[j] });
              if(isDouble) allMatches.push({ home: teams[j], away: teams[i] });
            }
          }
        }
        allMatches = allMatches.sort(() => Math.random() - 0.5);
        while(allMatches.length > 0) {
          const roundMatches: Match[] = [];
          const busyTeams = new Set<string>();
          const pendingMatches: typeof allMatches = [];
          for (const match of allMatches) {
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
            } else pendingMatches.push(match);
          }
          rounds.push({ round: rounds.length + 1, matches: roundMatches, seasonId: recordActiveS.id });
          allMatches = pendingMatches;
        }
      }

      await updateDoc(doc(db, "seasons", String(adminTab)), { rounds });
      if(confirm("스케줄 생성 완료! 스케줄 메뉴로 이동하시겠습니까?")) {
        setCurrentView('SCHEDULE');
        setViewSeasonId(recordActiveS.id);
      }
    }
  };

  const handleMatchClick = (m: Match) => { 
    setEditingMatch({ ...m, homeScorers: m.homeScorers || [], awayScorers: m.awayScorers || [], homeAssists: m.homeAssists || [], awayAssists: m.awayAssists || [] }); 
    setMatchInputs({ homeScore: m.homeScore || '0', awayScore: m.awayScore || '0', youtube: m.youtubeUrl }); 
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
    setRecordInputs({ ...recordInputs, [k]: {name:'', count:'1'} });
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

  const saveMatchResult = async () => {
    if(!editingMatch) return;
    
    const summary = `[경기 결과 확인]\n\n${editingMatch.home} ${matchInputs.homeScore} : ${matchInputs.awayScore} ${editingMatch.away}\n\n[홈 득점]\n${editingMatch.homeScorers.map(s=>`${s.name}(${s.count})`).join(', ') || '없음'}\n\n[원정 득점]\n${editingMatch.awayScorers.map(s=>`${s.name}(${s.count})`).join(', ') || '없음'}\n\n이대로 저장하시겠습니까?`;
    if(!confirm(summary)) return;

    const targetSeason = seasons.find(s => s.id === editingMatch.seasonId);
    if(!targetSeason) return;
    
    const finalMatch = { 
      ...editingMatch, 
      homeScore: matchInputs.homeScore, 
      awayScore: matchInputs.awayScore, 
      youtubeUrl: matchInputs.youtube, 
      status: 'FINISHED' as const
    };

    let updatedRounds = targetSeason.rounds!.map(r => ({ ...r, matches: r.matches.map(m => m.id === editingMatch.id ? finalMatch : m) }));

    if(targetSeason.type === 'TOURNAMENT') {
      const currentRoundIdx = updatedRounds.findIndex(r => r.matches.some(m => m.id === editingMatch.id));
      const currentRound = updatedRounds[currentRoundIdx];
      const isRoundComplete = currentRound.matches.every(m => m.status === 'FINISHED');

      if(isRoundComplete) {
        const winners: Team[] = [];
        const losers: Team[] = [];

        currentRound.matches.forEach(m => {
          const h = Number(m.homeScore);
          const a = Number(m.awayScore);
          const homeTeam = targetSeason.teams!.find(t=>t.name===m.home)!;
          const awayTeam = targetSeason.teams!.find(t=>t.name===m.away)!;
          if(h > a) { winners.push(homeTeam); losers.push(awayTeam); }
          else { winners.push(awayTeam); losers.push(homeTeam); }
        });

        updatedRounds = updatedRounds.filter(r => r.round <= currentRound.round);

        const nextRoundMatches: Match[] = [];
        if(winners.length === 2) {
          nextRoundMatches.push({
            id: `${targetSeason.id}_FINAL`, seasonId: targetSeason.id,
            home: winners[0].name, away: winners[1].name,
            homeLogo: winners[0].logo, awayLogo: winners[1].logo,
            homeOwner: winners[0].ownerName, awayOwner: winners[1].ownerName,
            homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [],
            status: 'UPCOMING', youtubeUrl: '', stage: 'Final', matchLabel: '🏆 FINAL'
          });
          nextRoundMatches.push({
            id: `${targetSeason.id}_3RD`, seasonId: targetSeason.id,
            home: losers[0].name, away: losers[1].name,
            homeLogo: losers[0].logo, awayLogo: losers[1].logo,
            homeOwner: losers[0].ownerName, awayOwner: losers[1].ownerName,
            homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [],
            status: 'UPCOMING', youtubeUrl: '', stage: '3rd Place', matchLabel: '🥉 3rd Place Match'
          });
          updatedRounds.push({ round: currentRound.round + 1, matches: nextRoundMatches, seasonId: targetSeason.id, name: 'Finals' });
        } 
        else if (winners.length > 2) {
          for(let i=0; i<winners.length; i+=2) {
            nextRoundMatches.push({
              id: `${targetSeason.id}_R${currentRound.round+1}_M${i/2}`, seasonId: targetSeason.id,
              home: winners[i].name, away: winners[i+1].name,
              homeLogo: winners[i].logo, awayLogo: winners[i+1].logo,
              homeOwner: winners[i].ownerName, awayOwner: winners[i+1].ownerName,
              homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [],
              status: 'UPCOMING', youtubeUrl: '', stage: getStageName(winners.length), matchLabel: `${getStageName(winners.length)} - Match ${(i/2)+1}`
            });
          }
          updatedRounds.push({ round: currentRound.round + 1, matches: nextRoundMatches, seasonId: targetSeason.id, name: getStageName(winners.length) });
        }
      }
    }

    await updateDoc(doc(db, "seasons", String(targetSeason.id)), { rounds: updatedRounds });
    setEditingMatch(null); 
    alert("✅ 경기 결과가 저장되었습니다.");
  };

  const handleSaveMaster = async () => { 
    try {
      let oldName = '';
      if(editTeamId) {
        const oldDoc = await getDoc(doc(db, "master_teams", editTeamId));
        if(oldDoc.exists()) oldName = oldDoc.data().name;
      }

      if(editTeamId) await updateDoc(doc(db,"master_teams",editTeamId), manualTeam as any); 
      else await addDoc(collection(db,"master_teams"), manualTeam); 

      if(editTeamId && oldName && (oldName !== manualTeam.name || manualTeam.logo)) {
        for(const s of seasons) {
          let sChanged = false;
          const newTeams = s.teams?.map(t => {
            if(t.name === oldName) { sChanged=true; return {...t, name: manualTeam.name, logo: manualTeam.logo || t.logo}; }
            return t;
          });
          const newRounds = s.rounds?.map(r => ({
            ...r,
            matches: r.matches.map(m => {
              let mChanged = false;
              let newM = {...m};
              if(m.home === oldName) { newM.home = manualTeam.name; newM.homeLogo = manualTeam.logo || m.homeLogo; mChanged=true; }
              if(m.away === oldName) { newM.away = manualTeam.name; newM.awayLogo = manualTeam.logo || m.awayLogo; mChanged=true; }
              if(mChanged) sChanged = true;
              return newM;
            })
          }));

          if(sChanged) await updateDoc(doc(db, "seasons", String(s.id)), { teams: newTeams, rounds: newRounds });
        }
      }

      setEditTeamId(null); 
      setManualTeam({name:'',logo:'',category:'CLUB',region:'',tier:'A'}); 
      alert("저장 및 동기화 완료"); 
    } catch(e) { console.error(e); alert("실패"); } 
  };

  const handleSaveBanner = async () => {
    if(!bannerTitle || !bannerUrl) return alert("제목과 URL을 입력하세요");
    await addDoc(collection(db, "banners"), { title: bannerTitle, url: bannerUrl, order: Date.now() });
    setBannerTitle(''); setBannerUrl(''); alert("배너 등록 완료");
  };
  const handleDeleteBanner = async (id: string) => {
    if(confirm("배너를 삭제하시겠습니까?")) await deleteDoc(doc(db, "banners", id));
  };
  const getBannerContent = (b: Banner) => {
    if(b.url.includes('youtube') || b.url.includes('youtu.be')) {
      const vId = b.url.includes('youtu.be') ? b.url.split('/').pop() : b.url.split('v=')[1]?.split('&')[0];
      return <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${vId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${vId}`} frameBorder="0" allow="autoplay; encrypted-media"></iframe>;
    }
    return <img src={b.url} alt={b.title} className="w-full h-full object-cover opacity-80" />;
  };

  const handleDeleteMasterTeam = async (id: string) => { if(confirm("팀을 삭제하시겠습니까?")) { await deleteDoc(doc(db, "master_teams", id)); manualFormRef.current?.scrollIntoView({behavior:'smooth'}); } };
  const handleBulk = async () => { try { const d=JSON.parse(bulkInput); for(const i of d) await addDoc(collection(db,"master_teams"),{name:i.name,logo:i.logo||'',category:i.category||'CLUB',region:i.region||'',tier:i.tier||'A'}); setBulkInput(''); alert("완료"); } catch { alert("JSON 오류"); } };
  const handleInitCreateTeam = () => { setEditTeamId(null); setManualTeam({name:'',logo:'',category:'CLUB',region:'',tier:'A'}); manualFormRef.current?.scrollIntoView({behavior:'smooth'}); };
  const handleAdminAccess = () => {
    const pw = prompt("관리자 비밀번호를 입력하세요");
    if(pw === '#5093') setCurrentView('ADMIN');
    else alert("비밀번호가 일치하지 않습니다.");
  };

  // 🔥 [Fix] Improved Team Sorting Logic (Safe Version)
  const filteredTeams = useMemo(() => {
    const base = masterTeams.filter(t => (manageTab==='ALL'||t.category===manageTab) && (manageTier==='ALL'||t.tier===manageTier) && (manageRegion==='ALL'||t.region===manageRegion) && t.name.toLowerCase().includes(manageSearch.toLowerCase()));
    
    // Sort logic separated for safety
    return base.sort((a, b) => {
      // 1. Category: Club First
      if (a.category !== b.category) return a.category === 'CLUB' ? -1 : 1;
      
      // 2. Club: Sort by Popular League
      if (a.category === 'CLUB') {
        const idxA = POPULAR_LEAGUES.indexOf(a.region);
        const idxB = POPULAR_LEAGUES.indexOf(b.region);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
      }

      // 3. National: Group Asia/Oceania
      if (a.category === 'NATIONAL' && a.region !== b.region) {
        const regA = (a.region === 'Asia' || a.region === 'Oceania') ? 'Asia/Oceania' : a.region;
        const regB = (b.region === 'Asia' || b.region === 'Oceania') ? 'Asia/Oceania' : b.region;
        return regA.localeCompare(regB);
      }

      return a.name.localeCompare(b.name);
    });
  }, [masterTeams, manageTab, manageTier, manageRegion, manageSearch]);

  const allManageRegions = Array.from(new Set(
    (manageTab === 'ALL' ? masterTeams : masterTeams.filter(t => t.category === manageTab))
    .map(t => t.region)
  )).sort();

  return (
    <div className="min-h-screen bg-[#020617] text-white font-black italic tracking-tighter overflow-x-hidden pb-20">
      
      {/* Banner */}
      <div 
        className="w-full h-[225px] md:h-[330px] relative border-b border-slate-800 shadow-2xl overflow-hidden bg-black"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {banners.length > 0 ? (
          banners.map((b, i) => (
            <div key={b.id} className={`absolute inset-0 transition-opacity duration-1000 ${i === bannerIdx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
              {getBannerContent(b)}
              <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent pointer-events-none"></div>
            </div>
          ))
        ) : (
          <div className="absolute inset-0">
            <img src="https://www.konami.com/efootball/s/img/main_page_1.png?v=903" alt="default" className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent"></div>
          </div>
        )}
        
        <div className="absolute bottom-6 left-6 uppercase z-20 pointer-events-none">
          <h1 className="text-2xl md:text-4xl text-white font-black italic">ⓔFOOTBALL SUPER LEAGUE™</h1>
          <p className="text-emerald-400 text-[10px] md:text-xs font-sans not-italic tracking-widest mt-1">ver. League Master P_42</p>
          <div className="mt-2 px-3 py-1 bg-black/50 rounded-lg inline-block border border-emerald-900/50">
            <span className="text-emerald-300 font-mono text-[10px] md:text-xs tracking-widest">{currentTime}</span>
          </div>
        </div>

        {banners.length > 1 && (
          <div className="absolute bottom-4 right-4 flex gap-2 z-20">
            {banners.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i === bannerIdx ? 'bg-white' : 'bg-slate-600'}`} />
            ))}
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <div className="flex justify-center flex-wrap gap-2 mt-6 mb-8 px-4">
        {[{id:'RANKING',l:'🏆 RANKING'}, {id:'SCHEDULE',l:'📅 SCHEDULE'}, {id:'HISTORY',l:'📜 ALL TIME'}, {id:'TUTORIAL',l:'📘 TUTORIAL'}].map(tab => (
          <button key={tab.id} onClick={() => setCurrentView(tab.id as any)} className={`px-6 py-3 rounded-xl border text-xs transition-all shadow-lg ${currentView === tab.id ? 'bg-blue-600 border-blue-400 text-white scale-105' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}>{tab.l}</button>
        ))}
        <button onClick={handleAdminAccess} className={`px-6 py-3 rounded-xl border text-xs transition-all shadow-lg ${currentView === 'ADMIN' ? 'bg-purple-600 border-purple-400 text-white scale-105' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}>⚙️ ADMIN</button>
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-8 space-y-8">
        
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

            {/* 🔥 [UI Update] Less Rounded Tables */}
            {rankingTab === 'STANDINGS' && (
              <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                <table className="w-full text-left text-xs uppercase border-collapse">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-1 md:p-4 text-center w-6 md:w-8 text-[10px] md:text-xs">#</th>
                      <th className="py-3 px-1 md:p-4 w-auto text-[10px] md:text-xs">Club</th>
                      <th className="py-3 px-1 md:p-4 text-center w-6 md:w-8 text-[10px] md:text-xs">P</th>
                      <th className="py-3 px-1 md:p-4 text-center w-6 md:w-8 text-[10px] md:text-xs">W</th>
                      <th className="py-3 px-1 md:p-4 text-center w-6 md:w-8 text-[10px] md:text-xs">D</th>
                      <th className="py-3 px-1 md:p-4 text-center w-6 md:w-8 text-[10px] md:text-xs">L</th>
                      <th className="py-3 px-1 md:p-4 text-center w-8 hidden md:table-cell text-[10px] md:text-xs">GF</th>
                      <th className="py-3 px-1 md:p-4 text-center w-8 hidden md:table-cell text-[10px] md:text-xs">GA</th>
                      <th className="py-3 px-1 md:p-4 text-center w-8 md:w-10 text-[10px] md:text-xs">GD</th>
                      <th className="py-3 px-1 md:p-4 text-center w-8 md:w-12 text-emerald-400 text-[10px] md:text-xs">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="font-sans not-italic font-medium">
                    {activeRankingData.teams.map((t, i) => (
                      <tr key={t.id} className="border-b border-slate-800/50 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-1 md:p-4 text-center text-slate-500 text-[10px] md:text-sm">{i+1}</td>
                        <td className="py-3 px-1 md:p-4 flex items-center gap-2 md:gap-3">
                          <img src={t.logo} alt="team" className="w-6 h-6 md:w-8 md:h-8 object-contain" />
                          <div className="flex flex-col">
                            <span className="text-white font-bold text-[10px] md:text-sm truncate max-w-[80px] md:max-w-none">{t.name}</span>
                            <span className="text-[9px] md:text-[10px] text-slate-500 uppercase">{t.ownerName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-1 md:p-4 text-center text-white text-[10px] md:text-sm">{t.win+t.draw+t.loss}</td>
                        <td className="py-3 px-1 md:p-4 text-center text-slate-300 text-[10px] md:text-sm">{t.win}</td>
                        <td className="py-3 px-1 md:p-4 text-center text-slate-300 text-[10px] md:text-sm">{t.draw}</td>
                        <td className="py-3 px-1 md:p-4 text-center text-slate-300 text-[10px] md:text-sm">{t.loss}</td>
                        <td className="py-3 px-1 md:p-4 text-center text-slate-400 hidden md:table-cell text-[10px] md:text-sm">{t.gf}</td>
                        <td className="py-3 px-1 md:p-4 text-center text-slate-400 hidden md:table-cell text-[10px] md:text-sm">{t.ga}</td>
                        <td className={`py-3 px-1 md:p-4 text-center font-bold text-[10px] md:text-sm ${t.gd>0?'text-green-400':t.gd<0?'text-red-400':'text-slate-400'}`}>{t.gd>0?`+${t.gd}`:t.gd}</td>
                        <td className="py-3 px-1 md:p-4 text-center font-black text-emerald-400 text-xs md:text-base">{t.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {rankingTab === 'OWNERS' && (<div className="bg-slate-900/40 rounded-xl border border-purple-500/20 overflow-hidden"><table className="w-full text-left text-xs uppercase"><thead className="bg-slate-950/80 text-purple-400"><tr><th className="p-4">#</th><th className="p-4">Owner</th><th className="p-4 text-center">Record</th><th className="p-4 text-center">Pts</th><th className="p-4 text-right">Prize</th></tr></thead><tbody>{activeRankingData.owners.filter(o => o.win > 0 || o.points > 0 || o.currentPrize > 0).map((t, i) => (<tr key={t.id} className="border-b border-slate-800/50 hover:bg-white/5 font-sans not-italic"><td className="p-4">{i+1}</td><td className="p-4 font-bold text-white">{t.ownerName}</td><td className="p-4 text-center">{t.win}-{t.draw}-{t.loss}</td><td className="p-4 text-center font-bold text-yellow-500">{t.points}</td><td className="p-4 text-right text-emerald-400">{t.currentPrize>0?`₩${t.currentPrize.toLocaleString()}`:'-'}</td></tr>))}</tbody></table></div>)}
            {rankingTab === 'PLAYERS' && (<div className="space-y-4"><div className="flex justify-center gap-2"><button onClick={() => setStatView('GOAL')} className={`px-4 py-1 rounded-full text-xs font-bold ${statView==='GOAL'?'bg-emerald-600':'bg-slate-800 text-slate-500'}`}>⚽ GOALS</button><button onClick={() => setStatView('ASSIST')} className={`px-4 py-1 rounded-full text-xs font-bold ${statView==='ASSIST'?'bg-blue-600':'bg-slate-800 text-slate-500'}`}>👟 ASSISTS</button></div><div className="bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden"><table className="w-full text-left text-xs uppercase"><thead className="bg-slate-950/80 text-slate-500"><tr><th className="p-4">#</th><th className="p-4">Player</th><th className="p-4">Owner</th><th className="p-4 text-center">Count</th></tr></thead><tbody>{activeRankingData.players.filter(p => (statView==='GOAL' ? p.goals>0 : p.assists>0)).sort((a,b) => statView==='GOAL' ? b.goals-a.goals : b.assists-a.assists).slice(0, 20).map((p, i) => (<tr key={i} className="border-b border-slate-800/50 font-sans not-italic"><td className="p-4">{i+1}</td><td className="p-4 font-bold text-white">{p.name}</td><td className="p-4 text-slate-500 text-[10px]">{p.owner}</td><td className={`p-4 text-center font-bold text-lg ${statView==='GOAL'?'text-emerald-400':'text-blue-400'}`}>{statView==='GOAL'?p.goals:p.assists}</td></tr>))}</tbody></table></div></div>)}
            {rankingTab === 'HIGHLIGHTS' && (<div className="grid grid-cols-1 md:grid-cols-3 gap-4">{activeRankingData.highlights.map((m, i) => { const hScore = Number(m.homeScore); const aScore = Number(m.awayScore); const winnerLogo = hScore > aScore ? m.homeLogo : (aScore > hScore ? m.awayLogo : null); return (<div key={i} className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-slate-600 transition-all group"><div className="aspect-video bg-black relative"><iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${m.youtubeUrl.split('v=')[1]||m.youtubeUrl.split('/').pop()}`} frameBorder="0" allowFullScreen></iframe></div><div className="p-3 flex items-center justify-between bg-slate-950"><div className="flex items-center gap-3">{winnerLogo ? <img src={winnerLogo} alt="winner" className="w-8 h-8 object-contain" /> : <div className="flex -space-x-2"><img src={m.homeLogo} alt="home" className="w-6 h-6 object-contain rounded-full bg-white p-0.5" /><img src={m.awayLogo} alt="away" className="w-6 h-6 object-contain rounded-full bg-white p-0.5" /></div>}<div className="flex flex-col"><span className="text-white font-bold text-sm tracking-tight">{m.home} vs {m.away}</span><span className="text-emerald-400 text-xs font-bold">{m.homeScore} : {m.awayScore}</span></div></div></div></div>); })}</div>)}
          </div>
        )}

        {/* ================= VIEW: SCHEDULE ================= */}
        {currentView === 'SCHEDULE' && (
          <div className="animate-in fade-in space-y-6">
            <div className="flex justify-end mb-4">
              <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700 outline-none font-sans not-italic text-right">
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            
            {/* 🔥 [Fix] Empty Schedule State */}
            {(!seasons.find(s=>s.id===viewSeasonId)?.rounds || seasons.find(s=>s.id===viewSeasonId)?.rounds?.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-50">
                <span className="text-6xl mb-4">📅</span>
                <p className="text-xl font-bold">매치 스케줄이 생성되지 않았습니다.</p>
              </div>
            ) : (
              (seasons.find(s=>s.id===viewSeasonId)?.rounds || []).map(r => (
                <div key={r.round} className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
                  <h3 className="text-sm text-slate-500 font-bold mb-4 uppercase tracking-widest">{r.name || `Round ${r.round}`}</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {r.matches.map(m => (
                      <div key={m.id} onClick={() => handleMatchClick(m)} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-4 cursor-pointer hover:border-blue-500 hover:bg-slate-900/80 transition-all">
                        {m.matchLabel && <span className="text-center text-xs text-orange-400 font-bold -mb-2">{m.matchLabel}</span>}
                        <div className="flex justify-between items-center w-full">
                          <div className="flex items-center gap-3 w-[40%] overflow-hidden justify-start">
                            <img src={m.homeLogo} alt="home" className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-full p-1 shrink-0"/>
                            <div className="flex flex-col items-start overflow-hidden">
                              <span className="text-sm md:text-base font-bold text-white truncate w-full text-left">{m.home}</span>
                              <span className="text-[10px] md:text-xs text-slate-500 font-sans not-italic truncate w-full text-left">{m.homeOwner}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-center justify-center w-[20%]">
                            <span className={`text-2xl md:text-3xl font-black ${m.status==='FINISHED'?'text-white':'text-slate-600'}`}>{m.status==='FINISHED'?`${m.homeScore} : ${m.awayScore}`:'VS'}</span>
                          </div>
                          <div className="flex items-center gap-3 w-[40%] overflow-hidden justify-end">
                            <div className="flex flex-col items-end overflow-hidden">
                              <span className="text-sm md:text-base font-bold text-white truncate w-full text-right">{m.away}</span>
                              <span className="text-[10px] md:text-xs text-slate-500 font-sans not-italic truncate w-full text-right">{m.awayOwner}</span>
                            </div>
                            <img src={m.awayLogo} alt="away" className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-full p-1 shrink-0"/>
                          </div>
                        </div>
                        {m.status === 'FINISHED' && (
                          <div className="border-t border-slate-800 pt-3 flex flex-col gap-2 font-sans not-italic">
                            {(m.homeScorers||[]).map((s, i) => <div key={`h${i}`} className="text-xs text-left text-blue-300">⚽ {s.name} {s.count>1&&`(${s.count})`}</div>)}
                            {(m.awayScorers||[]).map((s, i) => <div key={`a${i}`} className="text-xs text-right text-red-300">⚽ {s.name} {s.count>1&&`(${s.count})`}</div>)}
                          </div>
                        )}
                        {m.youtubeUrl && <a href={m.youtubeUrl} target="_blank" onClick={e=>e.stopPropagation()} className="block text-center text-xs text-red-400 hover:underline mt-2">▶ Watch Highlight</a>}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ================= VIEW: ALL TIME ================= */}
        {currentView === 'HISTORY' && (
          <div className="animate-in fade-in space-y-6">
            <div className="flex gap-2 border-b border-slate-800 pb-2 overflow-x-auto" style={{scrollbarWidth:'none', msOverflowStyle:'none'}}>
              {['TEAMS', 'OWNERS', 'PLAYERS'].map(sub => (
                <button key={sub} onClick={() => setHistoryTab(sub as any)} className={`px-6 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-colors ${historyTab === sub ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{sub}</button>
              ))}
            </div>
            {historyTab === 'TEAMS' && (
              <div className="bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs uppercase">
                  <thead className="bg-slate-950/80 text-orange-400"><tr><th className="p-4">Rank</th><th className="p-4">Team</th><th className="p-4 text-center">W-D-L</th><th className="p-4 text-center">PTS</th></tr></thead>
                  <tbody>
                    {historyData.teams.sort((a,b) => b.pts - a.pts).map((t, i) => (
                      <tr key={i} className="border-b border-slate-800/50 font-sans not-italic">
                        <td className="p-4">{i+1}</td>
                        <td className="p-4 flex items-center gap-2">
                          <img src={t.logo} alt="team" className="w-8 h-8 bg-white rounded-full p-0.5"/>
                          <div className="flex flex-col">
                            <span className="text-white font-bold">{t.name}</span>
                            <span className="text-[10px] text-slate-500 uppercase">{t.owner}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">{t.w}-{t.d}-{t.l}</td>
                        <td className="p-4 text-center font-bold text-orange-500">{t.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {historyTab === 'OWNERS' && (<div className="bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden"><table className="w-full text-left text-xs uppercase"><thead className="bg-slate-950/80 text-orange-400"><tr><th className="p-4">Rank</th><th className="p-4">Owner</th><th className="p-4 text-center">Total Record</th><th className="p-4 text-center">Total PTS</th><th className="p-4 text-right">Accumulated Prize</th></tr></thead><tbody>{historyData.owners.sort((a,b) => b.pts - a.pts).map((t, i) => (<tr key={i} className="border-b border-slate-800/50 font-sans not-italic"><td className="p-4">{i+1}</td><td className="p-4 font-bold text-white">{t.name}</td><td className="p-4 text-center">{t.w}-{t.d}-{t.l}</td><td className="p-4 text-center font-bold text-orange-500">{t.pts}</td><td className="p-4 text-right text-emerald-400">{t.prize>0?`₩${t.prize.toLocaleString()}`:'-'}</td></tr>))}</tbody></table></div>)}
            {historyTab === 'PLAYERS' && (<div className="space-y-4"><div className="flex justify-center gap-2"><button onClick={() => setHistoryStatView('GOAL')} className={`px-4 py-1 rounded-full text-xs font-bold ${historyStatView==='GOAL'?'bg-orange-600':'bg-slate-800 text-slate-500'}`}>⚽ GOALS</button><button onClick={() => setHistoryStatView('ASSIST')} className={`px-4 py-1 rounded-full text-xs font-bold ${historyStatView==='ASSIST'?'bg-blue-600':'bg-slate-800 text-slate-500'}`}>👟 ASSISTS</button></div><div className="bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden"><table className="w-full text-left text-xs uppercase"><thead className="bg-slate-950/80 text-orange-400"><tr><th className="p-4">Rank</th><th className="p-4">Player</th><th className="p-4">Owner</th><th className="p-4 text-center">Total Count</th></tr></thead><tbody>{historyData.players.filter(p => (historyStatView==='GOAL'?p.goals>0:p.assists>0)).sort((a,b) => historyStatView==='GOAL' ? b.goals-a.goals : b.assists-a.assists).slice(0, 30).map((p, i) => (<tr key={i} className="border-b border-slate-800/50 font-sans not-italic"><td className="p-4">{i+1}</td><td className="p-4 font-bold text-white">{p.name}</td><td className="p-4 text-center text-emerald-400 font-bold">{p.goals}</td><td className="p-4 text-center text-blue-400 font-bold">{p.assists}</td></tr>))}</tbody></table></div></div>)}
          </div>
        )}

        {/* ================= VIEW: TUTORIAL ================= */}
        {currentView === 'TUTORIAL' && (
          <div className="animate-in fade-in space-y-8">
            <h2 className="text-3xl font-black italic text-center mb-8 text-blue-400">LEAGUE GUIDEBOOK</h2>
            <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 space-y-4"><h3 className="text-xl font-bold text-white flex items-center gap-2">👤 1. 오너(참가자) 등록</h3><p className="text-slate-400 text-sm leading-relaxed"><b>[⚙️ ADMIN]</b> 메뉴 진입(비밀번호 필요) &gt; <b>[👤 오너 만들기]</b>에서 참가자를 등록하세요.</p></div>
            <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 space-y-4"><h3 className="text-xl font-bold text-white flex items-center gap-2">🛡️ 2. 팀 관리</h3><p className="text-slate-400 text-sm leading-relaxed"><b>[⚙️ ADMIN] &gt; [🛡️ 팀 관리]</b>에서 사용할 팀들을 미리 등록하세요.<br/>[새로운 팀 등록하기] 버튼을 눌러 팀을 추가할 수 있습니다.</p></div>
            <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 space-y-4"><h3 className="text-xl font-bold text-white flex items-center gap-2">🏆 3. 게임 생성 및 배정</h3><p className="text-slate-400 text-sm leading-relaxed"><b>[⚙️ ADMIN] &gt; [➕ 새로운 게임 만들기]</b>에서 시즌을 생성하고,<br/>팀 배정 메뉴에서 오너에게 팀을 할당한 뒤 스케줄을 생성하세요.</p></div>
          </div>
        )}

        {/* ================= VIEW: ADMIN ================= */}
        {currentView === 'ADMIN' && (
          <div className="animate-in fade-in space-y-10">
            {currentView === 'ADMIN' ? (
              <>
              <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col md:flex-row gap-4 items-center">
                <select value={adminTab} onChange={(e) => setAdminTab(e.target.value === 'NEW' || e.target.value === 'OWNER' || e.target.value === 'BANNER' || e.target.value === 'TEAMS' ? e.target.value : Number(e.target.value))} className="w-full bg-slate-950 p-4 rounded-xl border border-slate-700 text-sm font-sans not-italic">
                  <optgroup label="Core Options">
                    <option value="NEW">➕ 새로운 게임 만들기</option>
                    <option value="OWNER">👤 오너 만들기</option>
                    <option value="BANNER">🖼️ 배너 관리</option>
                    <option value="TEAMS">🛡️ 팀 관리</option>
                  </optgroup>
                  <optgroup label="Active Seasons">{seasons.map(s => <option key={s.id} value={s.id}>🏆 {s.name}</option>)}</optgroup>
                </select>
                {typeof adminTab === 'number' && <button onClick={handleDeleteSeason} className="w-full md:w-auto px-6 py-4 bg-red-900/50 border border-red-800 text-red-400 rounded-xl font-bold hover:bg-red-900 transition-colors whitespace-nowrap">🗑️ 게임 삭제하기</button>}
              </div>
              
              {/* Banner Manage */}
              {adminTab === 'BANNER' && (
                <div className="bg-slate-900/60 p-8 rounded-3xl border border-blue-500/30 space-y-4">
                  <h3 className="text-blue-400 font-bold">배너 이미지/영상 관리</h3>
                  <div className="flex gap-4 flex-col md:flex-row">
                    <input value={bannerTitle} onChange={e=>setBannerTitle(e.target.value)} placeholder="배너 제목" className="bg-slate-950 p-3 rounded w-full border border-slate-800"/>
                    <input value={bannerUrl} onChange={e=>setBannerUrl(e.target.value)} placeholder="이미지 또는 유튜브 URL" className="bg-slate-950 p-3 rounded w-full border border-slate-800"/>
                    <button onClick={handleSaveBanner} className="bg-blue-600 px-6 py-3 rounded font-bold whitespace-nowrap">등록하기</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {banners.map(b => (
                      <div key={b.id} className="relative group rounded-xl overflow-hidden border border-slate-700 aspect-video">
                        {getBannerContent(b)}
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleDeleteBanner(b.id!)} className="bg-red-600 text-white px-4 py-2 rounded font-bold">삭제</button>
                        </div>
                        <span className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 text-xs rounded z-20">{b.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminTab === 'OWNER' && <div className="bg-slate-900/60 p-8 rounded-3xl border border-purple-500/30 space-y-4"><h3 className="text-purple-400 font-bold">오너 관리</h3><div className="flex gap-4 flex-col md:flex-row"><input value={newOwnerName} onChange={e=>setNewOwnerName(e.target.value)} placeholder="닉네임" className="bg-slate-950 p-3 rounded w-full border border-slate-800"/><input value={newOwnerPhoto} onChange={e=>setNewOwnerPhoto(e.target.value)} placeholder="이미지 URL (선택사항)" className="bg-slate-950 p-3 rounded w-full border border-slate-800"/><button onClick={handleSaveOwner} className={`px-6 py-3 rounded font-bold whitespace-nowrap ${editOwnerId ? 'bg-blue-600' : 'bg-purple-600'}`}>{editOwnerId ? 'UPDATE' : 'ADD'}</button>{editOwnerId && <button onClick={()=>{setEditOwnerId(null); setNewOwnerName(''); setNewOwnerPhoto('')}} className="bg-slate-700 px-6 rounded">CANCEL</button>}</div><div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">{owners.map(o => (<div key={o.id} onClick={() => handleEditOwnerClick(o)} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-4 relative group cursor-pointer hover:border-blue-500"><img src={o.photo} alt="owner" className="w-12 h-12 rounded-full border-2 border-slate-700" /><span className="text-sm truncate">{o.nickname}</span><button onClick={(e) => {e.stopPropagation(); if(confirm('삭제?')) deleteDoc(doc(db,"users",o.docId!));}} className="ml-auto text-red-500 font-bold opacity-0 group-hover:opacity-100">×</button></div>))}</div></div>}
              {adminTab === 'NEW' && <div className="bg-slate-900/60 p-8 rounded-3xl border border-emerald-500/30 space-y-6"><h3 className="text-emerald-400 font-bold">새로운 시즌 만들기</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input value={inputSeasonName} onChange={e=>setInputSeasonName(e.target.value)} placeholder="시즌 이름" className="bg-slate-950 p-3 rounded w-full border border-slate-800"/><div className="flex gap-2"><select value={inputSeasonType} onChange={e=>setInputSeasonType(e.target.value as any)} className="bg-slate-950 p-3 rounded w-full border border-slate-800"><option value="LEAGUE">리그</option><option value="TOURNAMENT">토너먼트</option></select>{inputSeasonType==='LEAGUE' && <select value={inputLeagueMode} onChange={e=>setInputLeagueMode(e.target.value as any)} className="bg-slate-950 p-3 rounded w-full border border-slate-800"><option value="SINGLE">싱글</option><option value="DOUBLE">홈&어웨이</option></select>}</div></div><div className="bg-slate-950 p-4 rounded-xl border border-slate-800"><p className="text-xs text-slate-500 mb-2">Total Prize Pool</p><input type="number" value={inputTotalPrize} onChange={e=>setInputTotalPrize(Number(e.target.value))} className="bg-slate-900 p-2 rounded w-full border border-slate-700 mb-2 text-white" /><div className="flex justify-between text-xs text-slate-400 gap-2 overflow-x-auto"><div className="flex flex-col"><label>1st</label><input value={prizes.first} onChange={e=>setPrizes({...prizes, first:Number(e.target.value)})} className="bg-slate-900 w-20 p-1 text-center border border-slate-700 rounded"/></div><div className="flex flex-col"><label>2nd</label><input value={prizes.second} onChange={e=>setPrizes({...prizes, second:Number(e.target.value)})} className="bg-slate-900 w-20 p-1 text-center border border-slate-700 rounded"/></div><div className="flex flex-col"><label>3rd</label><input value={prizes.third} onChange={e=>setPrizes({...prizes, third:Number(e.target.value)})} className="bg-slate-900 w-20 p-1 text-center border border-slate-700 rounded"/></div><div className="flex flex-col"><label>Scorer</label><input value={prizes.scorer} onChange={e=>setPrizes({...prizes, scorer:Number(e.target.value)})} className="bg-slate-900 w-20 p-1 text-center border border-slate-700 rounded"/></div></div></div><button onClick={handleCreateSeason} className="w-full bg-emerald-600 py-3 rounded font-bold">시즌 생성하기</button></div>}
            
            {/* Team Management (Inside Admin) */}
            {adminTab === 'TEAMS' && (
              <>
              <div className="flex justify-between items-center mb-4 px-2"><h3 className="text-lg font-bold italic text-slate-400">TEAM MANAGEMENT</h3><button onClick={handleInitCreateTeam} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-500 transition-colors shadow-lg">➕ 새로운 팀 등록하기</button></div>
              <div className="bg-slate-900/60 p-8 rounded-3xl border border-slate-800 space-y-6"><div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-sans not-italic"><select value={manageTab} onChange={e => setManageTab(e.target.value as any)} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs"><option value="ALL">전체 팀 보기</option><option value="CLUB">클럽</option><option value="NATIONAL">국가대표</option></select><select value={manageTier} onChange={e => setManageTier(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs"><option value="ALL">전체 등급</option>{['S','A','B','C'].map(t=><option key={t} value={t}>{t}등급</option>)}</select><select value={manageRegion} onChange={e => setManageRegion(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs"><option value="ALL">리그/지역</option>{allManageRegions.map(r=><option key={r} value={r}>{r}</option>)}</select><input value={manageSearch} onChange={e => setManageSearch(e.target.value)} placeholder="팀을 검색해보세요" className="bg-slate-950 p-3 rounded border border-slate-700 text-xs" /></div><div className="grid grid-cols-2 md:grid-cols-6 gap-4">{filteredTeams.slice(0, visibleTeamCount).map(mt => (<div key={mt.id} onClick={() => {setEditTeamId(mt.id!); setManualTeam(mt); manualFormRef.current?.scrollIntoView({behavior:'smooth'})}} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-500 transition-all relative group"><img src={mt.logo} alt="team" className="w-10 h-10 object-contain bg-white rounded-full p-1" /><p className="text-[10px] font-bold truncate w-full text-center">{mt.name}</p><button onClick={(e) => {e.stopPropagation(); handleDeleteMasterTeam(mt.id!);}} className="absolute top-2 right-2 text-red-500 font-bold opacity-0 group-hover:opacity-100">×</button></div>))}</div>{visibleTeamCount < filteredTeams.length && (<button onClick={() => setVisibleTeamCount(prev => prev + 18)} className="w-full py-3 bg-slate-800 text-slate-400 font-bold text-xs rounded-xl hover:bg-slate-700 transition-colors">👇 더 많은 팀 보기</button>)}</div>
              <section ref={manualFormRef} className="p-8 rounded-3xl border bg-slate-900/60 border-slate-800"><h3 className="text-xl mb-4 font-bold">{editTeamId ? '팀 수정하기' : '새로운 팀 등록'}</h3><div className="grid grid-cols-1 md:grid-cols-5 gap-4 font-sans not-italic mb-4"><select value={manualTeam.category} onChange={e => setManualTeam({...manualTeam, category: e.target.value as any})} className="bg-slate-950 p-3 rounded border border-slate-700 text-sm"><option value="CLUB">클럽</option><option value="NATIONAL">국가대표</option></select><select value={manualTeam.tier} onChange={e => setManualTeam({...manualTeam, tier: e.target.value as any})} className="bg-slate-950 p-3 rounded border border-slate-700 text-sm"><option value="S">S등급</option><option value="A">A등급</option><option value="B">B등급</option><option value="C">C등급</option></select><input value={manualTeam.region} onChange={e => setManualTeam({...manualTeam, region: e.target.value})} placeholder="지역 / 리그" className="bg-slate-950 p-3 rounded border border-slate-700 text-sm" /><input value={manualTeam.name} onChange={e => setManualTeam({...manualTeam, name: e.target.value})} placeholder="팀 이름" className="bg-slate-950 p-3 rounded border border-slate-700 text-sm" /><input value={manualTeam.logo} onChange={e => setManualTeam({...manualTeam, logo: e.target.value})} placeholder="로고 URL" className="bg-slate-950 p-3 rounded border border-slate-700 text-sm" /></div><button onClick={handleSaveMaster} className="w-full bg-emerald-600 py-3 rounded font-bold">{editTeamId ? '수정 저장하기' : '등록하기'}</button></section><section className="bg-slate-900/60 p-8 rounded-3xl border border-orange-500/30"><h3 className="text-orange-400 font-bold mb-4">한번에 등록하기</h3><textarea value={bulkInput} onChange={e => setBulkInput(e.target.value)} className="w-full h-24 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs mb-4" /><button onClick={handleBulk} className="w-full bg-orange-600 py-3 rounded font-bold">등록하기</button></section>
              </>
            )}

            {typeof adminTab === 'number' && <div className="bg-slate-900/60 p-8 rounded-3xl border border-blue-500/30 space-y-6"><div className="flex justify-between items-center"><h3 className="text-blue-400 font-bold">팀 배정</h3></div><div className="grid grid-cols-1 md:grid-cols-5 gap-2 font-sans not-italic"><select value={selOwnerId} onChange={e => setSelOwnerId(Number(e.target.value))} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs text-white"><option value="">오너 선택</option>{owners.map(o=><option key={o.id} value={o.id}>{o.nickname}</option>)}</select><select value={selCategory} onChange={e => {setSelCategory(e.target.value as any); setSelRegion('ALL');}} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs text-white"><option value="ALL">전체</option><option value="CLUB">클럽</option><option value="NATIONAL">국가대표</option></select><select value={selTier} onChange={e => setSelTier(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs text-white"><option value="ALL">전체 등급</option>{['S','A','B','C'].map(t=><option key={t} value={t}>{t}등급</option>)}</select><select value={selRegion} onChange={e => setSelRegion(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs text-white"><option value="ALL">리그/지역</option>{Array.from(new Set((selCategory==='ALL'?masterTeams:masterTeams.filter(m=>m.category===selCategory)).map(m=>m.region))).sort().map(r=><option key={r} value={r}>{r}</option>)}</select><button onClick={handleRandomDraw} className="bg-slate-800 border border-slate-600 rounded text-xs font-bold">🎲</button></div><div className="flex gap-2"><select value={selTeamName} onChange={e => setSelTeamName(e.target.value)} className="flex-1 bg-slate-950 p-3 rounded border border-blue-500 text-blue-400 font-bold font-sans not-italic"><option value="">팀 선택...</option>{stepTeams.map(mt => <option key={mt.id} value={mt.name}>{mt.name}</option>)}</select><button onClick={handleConfirmTeam} className="bg-blue-600 px-6 rounded font-bold">배정</button></div><div className="pt-6 border-t border-slate-800"><p className="text-[10px] text-slate-500 mb-4 font-bold">현재 배정된 팀 ({(recordActiveS?.teams || []).length})</p><div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2">{(recordActiveS?.teams || []).map(t => (<span key={t.id} className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-[11px] flex items-center gap-2"><img src={t.logo} alt="team" className="w-5 h-5 object-contain bg-white rounded-full p-0.5" /><span className="text-white font-bold">{t.name}</span><span className="text-slate-500 text-[9px] uppercase">{t.tier} • {t.ownerName}</span><button onClick={() => handleRemoveTeamFromSeason(t.id)} className="ml-2 text-red-500 hover:text-red-300 font-bold">×</button></span>))}</div></div><div className="border-t border-slate-800 pt-6 mt-4"><button onClick={handleGenerateSchedule} className="w-full bg-slate-800 text-emerald-400 border border-emerald-900 py-3 rounded-xl text-sm font-bold hover:bg-emerald-900/20 transition-all">📅 스케쥴 만들기</button></div></div>}
              </>
            ) : (
              <>
              {/* 🔥 [New Feature] Add Team Button */}
              <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="text-lg font-bold italic text-slate-400">TEAM MANAGEMENT</h3>
                <button onClick={handleInitCreateTeam} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-500 transition-colors shadow-lg">➕ 새로운 팀 등록하기</button>
              </div>

              <div className="bg-slate-900/60 p-8 rounded-3xl border border-slate-800 space-y-6"><div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-sans not-italic"><select value={manageTab} onChange={e => setManageTab(e.target.value as any)} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs"><option value="ALL">전체 팀 보기</option><option value="CLUB">클럽</option><option value="NATIONAL">국가대표</option></select><select value={manageTier} onChange={e => setManageTier(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs"><option value="ALL">전체 등급</option>{['S','A','B','C'].map(t=><option key={t} value={t}>{t}등급</option>)}</select><select value={manageRegion} onChange={e => setManageRegion(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs"><option value="ALL">리그/지역</option>{allManageRegions.map(r=><option key={r} value={r}>{r}</option>)}</select><input value={manageSearch} onChange={e => setManageSearch(e.target.value)} placeholder="팀을 검색해보세요" className="bg-slate-950 p-3 rounded border border-slate-700 text-xs" /></div><div className="grid grid-cols-2 md:grid-cols-6 gap-4">{filteredTeams.slice(0, visibleTeamCount).map(mt => (<div key={mt.id} onClick={() => {setEditTeamId(mt.id!); setManualTeam(mt); manualFormRef.current?.scrollIntoView({behavior:'smooth'})}} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-500 transition-all relative group"><img src={mt.logo} alt="team" className="w-10 h-10 object-contain bg-white rounded-full p-1" /><p className="text-[10px] font-bold truncate w-full text-center">{mt.name}</p><button onClick={(e) => {e.stopPropagation(); handleDeleteMasterTeam(mt.id!);}} className="absolute top-2 right-2 text-red-500 font-bold opacity-0 group-hover:opacity-100">×</button></div>))}</div>{visibleTeamCount < filteredTeams.length && (<button onClick={() => setVisibleTeamCount(prev => prev + 18)} className="w-full py-3 bg-slate-800 text-slate-400 font-bold text-xs rounded-xl hover:bg-slate-700 transition-colors">👇 더 많은 팀 보기</button>)}</div>
              <section ref={manualFormRef} className="p-8 rounded-3xl border bg-slate-900/60 border-slate-800"><h3 className="text-xl mb-4 font-bold">{editTeamId ? '팀 수정하기' : '새로운 팀 등록'}</h3><div className="grid grid-cols-1 md:grid-cols-5 gap-4 font-sans not-italic mb-4"><select value={manualTeam.category} onChange={e => setManualTeam({...manualTeam, category: e.target.value as any})} className="bg-slate-950 p-3 rounded border border-slate-700 text-sm"><option value="CLUB">클럽</option><option value="NATIONAL">국가대표</option></select><select value={manualTeam.tier} onChange={e => setManualTeam({...manualTeam, tier: e.target.value as any})} className="bg-slate-950 p-3 rounded border border-slate-700 text-sm"><option value="S">S등급</option><option value="A">A등급</option><option value="B">B등급</option><option value="C">C등급</option></select><input value={manualTeam.region} onChange={e => setManualTeam({...manualTeam, region: e.target.value})} placeholder="지역 / 리그" className="bg-slate-950 p-3 rounded border border-slate-700 text-sm" /><input value={manualTeam.name} onChange={e => setManualTeam({...manualTeam, name: e.target.value})} placeholder="팀 이름" className="bg-slate-950 p-3 rounded border border-slate-700 text-sm" /><input value={manualTeam.logo} onChange={e => setManualTeam({...manualTeam, logo: e.target.value})} placeholder="로고 URL" className="bg-slate-950 p-3 rounded border border-slate-700 text-sm" /></div><button onClick={handleSaveMaster} className="w-full bg-emerald-600 py-3 rounded font-bold">{editTeamId ? '수정 저장하기' : '등록하기'}</button></section><section className="bg-slate-900/60 p-8 rounded-3xl border border-orange-500/30"><h3 className="text-orange-400 font-bold mb-4">한번에 등록하기</h3><textarea value={bulkInput} onChange={e => setBulkInput(e.target.value)} className="w-full h-24 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs mb-4" /><button onClick={handleBulk} className="w-full bg-orange-600 py-3 rounded font-bold">등록하기</button></section>
              </>
            )}
          </div>
        )}

        {/* Modal: Match Edit */}
        {editingMatch && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] p-4 overflow-y-auto">
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-700 w-full max-w-5xl space-y-6 my-auto shadow-2xl relative">
              <button onClick={() => setEditingMatch(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white text-2xl touch-manipulation">✕</button>
              <h3 className="text-center text-xl font-black italic tracking-tighter text-slate-400 border-b border-slate-800 pb-4">MATCH RESULT</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col items-center bg-slate-950 p-6 rounded-2xl border border-slate-800">
                    <img src={editingMatch.homeLogo} alt="home" className="w-20 h-20 bg-white rounded-full p-2 object-contain mb-4"/>
                    <span className="text-xl font-bold text-center text-white">{editingMatch.home}</span>
                    <span className="text-xs text-blue-400 font-bold uppercase mt-1">{editingMatch.homeOwner}</span>
                  </div>
                  <div className="space-y-3">
                    <RecordInput label="Goals" type="homeScorer" colorClass="text-blue-400" inputValue={recordInputs.homeScorer} onInputChange={(t:any,f:any,v:any)=>setRecordInputs({...recordInputs,[t]:{...recordInputs.homeScorer,[f]:v}})} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.homeScorers} />
                    <RecordInput label="Assists" type="homeAssist" colorClass="text-blue-300" inputValue={recordInputs.homeAssist} onInputChange={(t:any,f:any,v:any)=>setRecordInputs({...recordInputs,[t]:{...recordInputs.homeAssist,[f]:v}})} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.homeAssists} />
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center h-full gap-4 py-4">
                  <div className="flex items-center gap-4">
                    <input type="number" value={matchInputs.homeScore} onChange={e=>setMatchInputs({...matchInputs,homeScore:e.target.value})} className="w-24 h-24 text-5xl text-center bg-slate-950 rounded-2xl border-2 border-slate-700 focus:border-blue-500 outline-none text-white font-black" placeholder="0" />
                    <span className="text-4xl font-black text-slate-600">:</span>
                    <input type="number" value={matchInputs.awayScore} onChange={e=>setMatchInputs({...matchInputs,awayScore:e.target.value})} className="w-24 h-24 text-5xl text-center bg-slate-950 rounded-2xl border-2 border-slate-700 focus:border-red-500 outline-none text-white font-black" placeholder="0" />
                  </div>
                  <input value={matchInputs.youtube} onChange={e=>setMatchInputs({...matchInputs,youtube:e.target.value})} placeholder="YouTube Link" className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-base text-center focus:border-emerald-500 outline-none"/>
                  <button onClick={saveMatchResult} className="w-full bg-emerald-600 py-4 rounded-xl font-bold text-lg hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20 mt-4 touch-manipulation">CONFIRM & SAVE</button>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col items-center bg-slate-950 p-6 rounded-2xl border border-slate-800">
                    <img src={editingMatch.awayLogo} alt="away" className="w-20 h-20 bg-white rounded-full p-2 object-contain mb-4"/>
                    <span className="text-xl font-bold text-center text-white">{editingMatch.away}</span>
                    <span className="text-xs text-red-400 font-bold uppercase mt-1">{editingMatch.awayOwner}</span>
                  </div>
                  <div className="space-y-3">
                    <RecordInput label="Goals" type="awayScorer" colorClass="text-red-400" inputValue={recordInputs.awayScorer} onInputChange={(t:any,f:any,v:any)=>setRecordInputs({...recordInputs,[t]:{...recordInputs.awayScorer,[f]:v}})} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.awayScorers} />
                    <RecordInput label="Assists" type="awayAssist" colorClass="text-red-300" inputValue={recordInputs.awayAssist} onInputChange={(t:any,f:any,v:any)=>setRecordInputs({...recordInputs,[t]:{...recordInputs.awayAssist,[f]:v}})} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.awayAssists} />
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}