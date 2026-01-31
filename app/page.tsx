/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc, getDocs, writeBatch, where } from 'firebase/firestore';

// --- 인터페이스 ---
interface Season { 
  id: number; name: string; type: 'LEAGUE' | 'TOURNAMENT'; leagueMode?: 'SINGLE' | 'DOUBLE'; isActive: boolean;
  teams?: Team[]; rounds?: Round[]; 
  prizes: { total: number; first: number; second: number; third: number; scorer: number; };
}
interface Owner { id: number; nickname: string; photo: string; docId?: string; }
interface League { id?: string; name: string; logo: string; category: 'CLUB' | 'NATIONAL'; }
interface MasterTeam { id?: string; name: string; logo: string; category: 'CLUB' | 'NATIONAL'; region: string; tier: 'S' | 'A' | 'B' | 'C'; }
interface Team { id: number; seasonId: number; name: string; logo: string; ownerName: string; region: string; tier: string; win: number; draw: number; loss: number; points: number; gf: number; ga: number; gd: number; }
interface MatchRecord { id: number; name: string; count: number; teamLogo?: string; }
interface Match {
  id: string; seasonId: number; home: string; away: string; homeLogo: string; awayLogo: string;
  homeOwner: string; awayOwner: string; homeScore: string; awayScore: string;
  homeScorers: MatchRecord[]; awayScorers: MatchRecord[]; homeAssists: MatchRecord[]; awayAssists: MatchRecord[];
  status: 'UPCOMING' | 'FINISHED' | 'BYE'; youtubeUrl: string; stage?: string; matchLabel?: string;
}
interface Round { round: number; matches: Match[]; seasonId: number; name?: string; }
interface Banner { id?: string; title: string; url: string; order: number; }

// --- [상수] 기본 데이터 ---
const DEFAULT_LEAGUES = [
  "무소속",
  "Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1", 
  "K League", "J League", "MLS", "Saudi Pro League",
  "Asia/Oceania", "Europe", "South America", "North America", "Africa", "Others"
];
const FALLBACK_IMG = "https://www.konami.com/efootball/s/img/main_page_1.png?v=903";

// --- [Helper Functions] ---
const getBannerContent = (b: Banner) => {
  if(b.url.includes('youtube') || b.url.includes('youtu.be')) {
    const vId = b.url.includes('youtu.be') ? b.url.split('/').pop() : b.url.split('v=')[1]?.split('&')[0];
    return <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${vId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${vId}`} frameBorder="0" allow="autoplay; encrypted-media" title={b.title}></iframe>;
  }
  return <img src={b.url} alt={b.title} className="w-full h-full object-cover opacity-80" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}} />;
};

const getSortedTeamsLogic = (teams: MasterTeam[], search: string) => {
  let base = teams;
  if(search) base = base.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  return base.sort((a, b) => a.name.localeCompare(b.name));
};

// --- [Component] RecordInput ---
const RecordInput = ({ type, inputValue, onInputChange, onAdd, onRemove, records, label, colorClass }: any) => {
  return (
    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 h-full flex flex-col relative z-10">
      <p className={`text-xs font-bold mb-2 uppercase ${colorClass} border-b border-slate-700/50 pb-1`}>{label}</p>
      <div className="flex gap-2 mb-3">
        <input type="text" value={inputValue.name} onChange={(e) => onInputChange(type, 'name', e.target.value)} placeholder="Player" className="flex-1 bg-slate-900 text-base p-2 rounded-lg border border-slate-600 focus:border-blue-500 outline-none text-white w-full" />
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

// ================= MAIN COMPONENT =================
export default function FootballLeagueApp() {
  const [currentView, setCurrentView] = useState<'RANKING' | 'SCHEDULE' | 'HISTORY' | 'ADMIN' | 'TUTORIAL'>('RANKING');
  const [rankingTab, setRankingTab] = useState<'STANDINGS' | 'OWNERS' | 'PLAYERS' | 'HIGHLIGHTS'>('STANDINGS');
  const [historyTab, setHistoryTab] = useState<'TEAMS' | 'OWNERS' | 'PLAYERS'>('TEAMS');
  const [adminTab, setAdminTab] = useState<number | 'NEW' | 'OWNER' | 'BANNER' | 'LEAGUES' | 'TEAMS'>('NEW');
  
  const [viewSeasonId, setViewSeasonId] = useState<number>(0); 
  const [statView, setStatView] = useState<'GOAL' | 'ASSIST'>('GOAL');
  const [historyStatView, setHistoryStatView] = useState<'GOAL' | 'ASSIST'>('GOAL');
  const [currentTime, setCurrentTime] = useState<string>('');

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  
  const [bannerIdx, setBannerIdx] = useState(0);
  const [bannerDelay, setBannerDelay] = useState(5000);
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

  // League Management State
  const [leagueManageTab, setLeagueManageTab] = useState<'CLUB' | 'NATIONAL'>('CLUB');
  const [leagueName, setLeagueName] = useState('');
  const [leagueLogo, setLeagueLogo] = useState('');
  const [leagueCategory, setLeagueCategory] = useState<'CLUB' | 'NATIONAL'>('CLUB');
  const [editLeagueId, setEditLeagueId] = useState<string | null>(null);

  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  // Team Management
  const [selOwnerId, setSelOwnerId] = useState<number | ''>('');
  const [selCategory, setSelCategory] = useState<'CLUB' | 'NATIONAL' | 'ALL'>('ALL');
  const [selTier, setSelTier] = useState<string>('ALL');
  const [selRegion, setSelRegion] = useState<string>('ALL');
  const [selTeamName, setSelTeamName] = useState<string>('');

  // Manage State
  const [manageTab, setManageTab] = useState<'CLUB' | 'NATIONAL'>('CLUB');
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

  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date();
      setCurrentTime(`${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setTimeout(() => { setBannerIdx((p) => (p + 1) % banners.length); setBannerDelay(5000); }, bannerDelay);
    return () => clearTimeout(t);
  }, [bannerIdx, banners, bannerDelay]);

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const dist = touchStart - touchEnd;
    if (dist > 50) { setBannerIdx((p) => (p + 1) % (banners.length || 1)); setBannerDelay(5000); }
    if (dist < -50) { setBannerIdx((p) => (p - 1 + (banners.length || 1)) % (banners.length || 1)); setBannerDelay(5000); }
    setTouchStart(0); setTouchEnd(0);
  };

  useEffect(() => { setPrizes({ first: Math.floor(inputTotalPrize*0.5), second: Math.floor(inputTotalPrize*0.3), third: Math.floor(inputTotalPrize*0.1), scorer: Math.floor(inputTotalPrize*0.1) }); }, [inputTotalPrize]);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "users"), orderBy("id", "asc")), s => setOwners(s.docs.map(d => ({...d.data(), docId: d.id} as Owner))));
    const u2 = onSnapshot(collection(db, "master_teams"), s => setMasterTeams(s.docs.map(d => ({id:d.id, ...d.data()} as MasterTeam))));
    const u3 = onSnapshot(query(collection(db, "seasons"), orderBy("id", "desc")), s => {
      const d = s.docs.map(doc => doc.data() as Season); 
      setSeasons(d);
      if(d.length > 0 && viewSeasonId === 0) { setViewSeasonId(d[0].id); if(typeof adminTab === 'number') setAdminTab(d[0].id); }
      else if(d.length === 0) { setAdminTab('NEW'); setViewSeasonId(0); }
    });
    const u4 = onSnapshot(collection(db, "banners"), s => {
      const raw = s.docs.map(d => ({id:d.id, ...d.data()} as Banner));
      const videos = raw.filter(b => b.url.includes('youtube'));
      const images = raw.filter(b => !b.url.includes('youtube')).sort(() => Math.random() - 0.5);
      setBanners(videos.length > 0 ? [videos[0], ...images] : images);
    });
    const u5 = onSnapshot(collection(db, "leagues"), s => setLeagues(s.docs.map(d => ({id:d.id, ...d.data()} as League))));
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  const activeRankingData = useMemo(() => {
    const targetSeason = seasons.find(s => s.id === viewSeasonId);
    if(!targetSeason?.teams) return { teams: [], owners: [], players: [], highlights: [] };
    const teamStats = new Map<string, Team>();
    targetSeason.teams.forEach(t => teamStats.set(t.name, { ...t, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 }));
    targetSeason.rounds?.forEach(r => r.matches.forEach(m => {
      if(m.status === 'FINISHED' && m.homeScore && m.awayScore) {
        const h = Number(m.homeScore), a = Number(m.awayScore);
        const ht = teamStats.get(m.home), at = teamStats.get(m.away);
        if(ht && at) {
          ht.gf+=h; ht.ga+=a; ht.gd+=(h-a); at.gf+=a; at.ga+=h; at.gd+=(a-h);
          if(h>a) { ht.win++; ht.points+=3; at.loss++; } else if(h<a) { at.win++; at.points+=3; ht.loss++; } else { ht.draw++; at.draw++; ht.points++; at.points++; }
        }
      }
    }));
    const teams = Array.from(teamStats.values()).sort((a,b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf).map((t, i) => ({ ...t, rank: i+1, currentPrize: i===0?targetSeason.prizes.first:i===1?targetSeason.prizes.second:i===2?targetSeason.prizes.third:0 }));
    const pMap = new Map<string, any>();
    targetSeason.rounds?.forEach(r => r.matches.forEach(m => {
      if(m.status === 'FINISHED') {
        [...m.homeScorers, ...m.awayScorers].forEach(s => { const k=`${s.name}-${m.homeOwner}`; if(!pMap.has(k)) pMap.set(k, {name:s.name, team:m.home, owner:m.homeOwner, goals:0, assists:0}); pMap.get(k).goals+=s.count; });
        [...m.homeAssists, ...m.awayAssists].forEach(s => { const k=`${s.name}-${m.homeOwner}`; if(!pMap.has(k)) pMap.set(k, {name:s.name, team:m.home, owner:m.homeOwner, goals:0, assists:0}); pMap.get(k).assists+=s.count; });
      }
    }));
    return { teams, owners: teams, players: Array.from(pMap.values()), highlights: targetSeason.rounds?.flatMap(r => r.matches).filter(m => m.youtubeUrl) || [] };
  }, [seasons, viewSeasonId]);

  const historyData = useMemo(() => {
    const tMap = new Map<string, any>(), oMap = new Map<string, any>(), pMap = new Map<string, any>();
    seasons.forEach(s => {
      const seasonTeams = new Map<string, Team>();
      s.teams?.forEach(t => seasonTeams.set(t.name, { ...t, win:0, draw:0, loss:0, points:0 }));
      s.rounds?.forEach(r => r.matches.forEach(m => {
        if(m.status==='FINISHED' && m.homeScore && m.awayScore) {
          const h=Number(m.homeScore), a=Number(m.awayScore);
          const ht=seasonTeams.get(m.home), at=seasonTeams.get(m.away);
          if(ht && at) { if(h>a) { ht.win++; ht.points+=3; at.loss++; } else if(h<a) { at.win++; at.points+=3; ht.loss++; } else { ht.draw++; at.draw++; ht.points++; at.points++; } }
          [...m.homeScorers, ...m.awayScorers].forEach(p => { if(!pMap.has(p.name)) pMap.set(p.name, {name:p.name, goals:0, assists:0}); pMap.get(p.name).goals+=p.count; });
          [...m.homeAssists, ...m.awayAssists].forEach(p => { if(!pMap.has(p.name)) pMap.set(p.name, {name:p.name, goals:0, assists:0}); pMap.get(p.name).assists+=p.count; });
        }
      }));
      Array.from(seasonTeams.values()).sort((a,b) => b.points-a.points).forEach((t, i) => {
        if(!tMap.has(t.name)) tMap.set(t.name, {name:t.name, owner:t.ownerName, logo:t.logo, w:0, d:0, l:0, pts:0});
        const tm = tMap.get(t.name); tm.w+=t.win; tm.d+=t.draw; tm.l+=t.loss; tm.pts+=t.points;
        if(!oMap.has(t.ownerName)) oMap.set(t.ownerName, {name:t.ownerName, w:0, d:0, l:0, pts:0, prize:0});
        const om = oMap.get(t.ownerName); om.w+=t.win; om.d+=t.draw; om.l+=t.loss; om.pts+=t.points;
        if(i<3) om.prize += (i===0?s.prizes.first:i===1?s.prizes.second:s.prizes.third);
      });
    });
    return { teams: Array.from(tMap.values()), owners: Array.from(oMap.values()), players: Array.from(pMap.values()) };
  }, [seasons]);

  // --- Handlers ---
  const handleSaveOwner = async () => { if(newOwnerName) { if(editOwnerId) await updateDoc(doc(db,"users",editOwnerId),{nickname:newOwnerName,photo:newOwnerPhoto}); else await addDoc(collection(db,"users"),{id:Date.now(),nickname:newOwnerName,photo:newOwnerPhoto}); setNewOwnerName(''); setNewOwnerPhoto(''); setEditOwnerId(null); }};
  const handleEditOwnerClick = (o: Owner) => { setEditOwnerId(o.docId!); setNewOwnerName(o.nickname); setNewOwnerPhoto(o.photo); };
  
  const handleCreateSeason = async () => { if(inputSeasonName) { const id=Date.now(); await setDoc(doc(db,"seasons",String(id)),{id,name:inputSeasonName,type:inputSeasonType,leagueMode:inputSeasonType==='LEAGUE'?inputLeagueMode:'SINGLE',isActive:true,teams:[],rounds:[],prizes:{total:inputTotalPrize,...prizes}}); setAdminTab(id); setViewSeasonId(id); setInputSeasonName(''); }};
  const handleDeleteSeason = async () => { if(typeof adminTab==='number' && confirm("삭제?")) { await deleteDoc(doc(db,"seasons",String(adminTab))); setAdminTab('NEW'); setViewSeasonId(0); }};
  const handleSaveBanner = async () => { if(bannerTitle && bannerUrl) { await addDoc(collection(db,"banners"),{title:bannerTitle,url:bannerUrl,order:Date.now()}); setBannerTitle(''); setBannerUrl(''); }};
  const handleDeleteBanner = async (id:string) => { if(confirm("삭제?")) await deleteDoc(doc(db,"banners",id)); };
  
  // League Handlers
  const handleSaveLeague = async () => { 
    if(!leagueName || !leagueLogo) return alert("입력하세요");
    if(editLeagueId) {
      const oldLeague = leagues.find(l => l.id === editLeagueId);
      if(oldLeague && oldLeague.name !== leagueName) {
        if(confirm(`리그명을 변경하시겠습니까? 소속된 팀들의 정보도 함께 변경됩니다.`)) {
           const batch = writeBatch(db);
           masterTeams.filter(t => t.region === oldLeague.name).forEach(t => {
             batch.update(doc(db, "master_teams", t.id!), { region: leagueName });
           });
           await batch.commit();
        }
      }
      await updateDoc(doc(db, "leagues", editLeagueId), { name: leagueName, logo: leagueLogo, category: leagueCategory });
      setEditLeagueId(null);
    } else {
      await addDoc(collection(db, "leagues"), {name:leagueName,logo:leagueLogo,category:leagueCategory}); 
    }
    setLeagueName(''); setLeagueLogo('');
  };

  const handleDeleteLeague = async (l: League) => { 
    if(confirm(`'${l.name}' 리그를 삭제하시겠습니까?\n소속된 팀들은 '무소속'으로 변경됩니다.`)) {
      const batch = writeBatch(db);
      masterTeams.filter(t => t.region === l.name).forEach(t => {
        batch.update(doc(db, "master_teams", t.id!), { region: '무소속' });
      });
      await batch.commit();
      await deleteDoc(doc(db, "leagues", l.id!));
    } 
  };

  const handleLeagueSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if(selectedId === 'NEW') {
      setEditLeagueId(null); setLeagueName(''); setLeagueLogo('');
    } else {
      const l = leagues.find(x => x.id === selectedId);
      if(l) {
        setEditLeagueId(l.id!); setLeagueName(l.name); setLeagueLogo(l.logo); setLeagueCategory(l.category);
      }
    }
  };

  const handleEditLeagueClick = (l: League) => {
    setEditLeagueId(l.id!); 
    setLeagueName(l.name); 
    setLeagueLogo(l.logo); 
    setLeagueCategory(l.category);
  };

  // Team Handlers
  const handleSaveMaster = async () => { 
    if(editTeamId) await updateDoc(doc(db,"master_teams",editTeamId), manualTeam as any); 
    else await addDoc(collection(db,"master_teams"), manualTeam); 
    setEditTeamId(null); setManualTeam({name:'',logo:'',category:'CLUB',region:'',tier:'A'}); 
  };
  const handleDeleteMasterTeam = async (id:string) => { if(confirm("삭제?")) await deleteDoc(doc(db,"master_teams",id)); };
  const handleBulk = async () => { try { const d=JSON.parse(bulkInput); for(const i of d) await addDoc(collection(db,"master_teams"),{...i}); setBulkInput(''); } catch {} };
  const handleInitCreateTeam = () => { setEditTeamId(null); setManualTeam({name:'',logo:'',category:'CLUB',region:'',tier:'A'}); manualFormRef.current?.scrollIntoView({behavior:'smooth'}); };

  // Team Assignment Handlers
  const recordActiveS = seasons.find(s => s.id === adminTab);
  const handleConfirmTeam = async () => {
    if(selOwnerId && selTeamName) {
      const m = masterTeams.find(t=>t.name===selTeamName);
      const o = owners.find(u=>u.id===Number(selOwnerId));
      if(m && o) {
        const nt: Team = {id:Date.now(), seasonId:Number(adminTab), name:m.name, logo:m.logo, ownerName:o.nickname, region:m.region, tier:m.tier, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0};
        await updateDoc(doc(db,"seasons",String(adminTab)), {teams:[...(recordActiveS?.teams||[]), nt]});
      }
    }
  };
  const handleRemoveTeamFromSeason = async (tid:number) => { if(confirm("삭제?")) await updateDoc(doc(db,"seasons",String(adminTab)), {teams:recordActiveS?.teams?.filter(t=>t.id!==tid)}); };
  const handleRandomDraw = () => {
    const assigned = (recordActiveS?.teams||[]).map(t=>t.name);
    const available = masterTeams.filter(t=>!assigned.includes(t.name) && (selCategory==='ALL'||t.category===selCategory) && (selTier==='ALL'||t.tier===selTier) && (selRegion==='ALL'||t.region===selRegion));
    if(available.length>0) { const r=available[Math.floor(Math.random()*available.length)]; setSelTeamName(r.name); }
  };
  
  const handleGenerateSchedule = async () => {
    if(!recordActiveS || (recordActiveS.teams||[]).length<2) return alert("팀 부족");
    if(confirm("스케줄 생성?")) {
      const teams = [...(recordActiveS.teams||[])];
      const rounds: Round[] = [];
      if(recordActiveS.type==='TOURNAMENT') {
         const shuffled = teams.sort(()=>Math.random()-0.5);
         const matches: Match[] = [];
         for(let i=0; i<shuffled.length; i+=2) {
           if(i+1<shuffled.length) matches.push({id:`${recordActiveS.id}_R1_${i}`, seasonId:recordActiveS.id, home:shuffled[i].name, away:shuffled[i+1].name, homeLogo:shuffled[i].logo, awayLogo:shuffled[i+1].logo, homeOwner:shuffled[i].ownerName, awayOwner:shuffled[i+1].ownerName, homeScore:'', awayScore:'', homeScorers:[], awayScorers:[], homeAssists:[], awayAssists:[], status:'UPCOMING', youtubeUrl:''});
         }
         rounds.push({round:1, matches, seasonId:recordActiveS.id, name:'Round 1'});
      } else {
        let pairs = [];
        for(let i=0; i<teams.length; i++) for(let j=i+1; j<teams.length; j++) if(teams[i].ownerName!==teams[j].ownerName) { pairs.push({h:teams[i],a:teams[j]}); if(recordActiveS.leagueMode==='DOUBLE') pairs.push({h:teams[j],a:teams[i]}); }
        pairs = pairs.sort(()=>Math.random()-0.5);
        let r=1;
        while(pairs.length>0) {
          const roundMatches: Match[] = [];
          const used = new Set();
          const nextPairs = [];
          for(const p of pairs) {
             if(!used.has(p.h.name) && !used.has(p.a.name)) {
               used.add(p.h.name); used.add(p.a.name);
               roundMatches.push({id:`${recordActiveS.id}_R${r}_${p.h.name}`, seasonId:recordActiveS.id, home:p.h.name, away:p.a.name, homeLogo:p.h.logo, awayLogo:p.a.logo, homeOwner:p.h.ownerName, awayOwner:p.a.ownerName, homeScore:'', awayScore:'', homeScorers:[], awayScorers:[], homeAssists:[], awayAssists:[], status:'UPCOMING', youtubeUrl:''});
             } else nextPairs.push(p);
          }
          if(roundMatches.length>0) { rounds.push({round:r, matches:roundMatches, seasonId:recordActiveS.id}); r++; }
          pairs = nextPairs;
        }
      }
      await updateDoc(doc(db,"seasons",String(adminTab)), {rounds});
    }
  };

  const handleMatchClick = (m: Match) => { setEditingMatch({...m}); setMatchInputs({homeScore:m.homeScore||'0',awayScore:m.awayScore||'0',youtube:m.youtubeUrl}); };
  const saveMatchResult = async () => {
    if(!editingMatch) return;
    const s = seasons.find(s=>s.id===editingMatch.seasonId);
    if(s && s.rounds) {
      const newRounds = s.rounds.map(r => ({...r, matches: r.matches.map(m => m.id===editingMatch.id ? {...editingMatch, homeScore:matchInputs.homeScore, awayScore:matchInputs.awayScore, youtubeUrl:matchInputs.youtube, status:'FINISHED' as const} : m)}));
      await updateDoc(doc(db,"seasons",String(s.id)), {rounds:newRounds});
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

  const handleAdminAccess = () => {
    const auth = sessionStorage.getItem('ef_admin_auth');
    const time = sessionStorage.getItem('ef_auth_time');
    if (auth === 'true' && time && (Date.now() - Number(time) < 3 * 60 * 60 * 1000)) {
      setCurrentView('ADMIN');
    } else {
      const pw = prompt("관리자 비밀번호");
      if(pw === '#5093') {
        sessionStorage.setItem('ef_admin_auth', 'true');
        sessionStorage.setItem('ef_auth_time', String(Date.now()));
        setCurrentView('ADMIN');
      } else alert("불일치");
    }
  };

  // Variables for View
  const targetTeamsBase = masterTeams.filter(t => t.category === manageTab);
  
  // 1. Get ALL unique regions
  const existingTeamRegions = Array.from(new Set(targetTeamsBase.map(t => t.region)));
  const registeredLeagues = leagues.filter(l => l.category === manageTab);
  const registeredLeagueNames = registeredLeagues.map(l => l.name);
  const allUniqueRegions = Array.from(new Set([...registeredLeagueNames, ...existingTeamRegions, '무소속'])).sort();

  // 2. Construct Group Data
  const groupData = allUniqueRegions.map(regionName => {
    const registeredLeague = leagues.find(l => l.name === regionName);
    return {
      name: regionName,
      logo: registeredLeague?.logo || FALLBACK_IMG, 
      count: targetTeamsBase.filter(t => t.region === regionName).length
    };
  }).filter(g => g.name !== '' && (g.count > 0 || registeredLeagueNames.includes(g.name))); 

  // 🔥 [Fix] Ensure teams are properly filtered for List View
  const teamsToDisplay = targetTeamsBase.filter(t => 
    (manageRegion === 'ALL' || t.region === manageRegion) &&
    (manageTier === 'ALL' || t.tier === manageTier) &&
    t.name.toLowerCase().includes(manageSearch.toLowerCase())
  );
  
  const filteredTeams = getSortedTeamsLogic(teamsToDisplay, '', '', '', '');

  const resetFilters = () => {
    setManageRegion('ALL');
    setManageTier('ALL');
    setManageSearch('');
  };

  const showGrid = manageRegion === 'ALL' && manageSearch === '' && manageTier === 'ALL';
  const groupsToRender = manageRegion === 'ALL' ? groupData : groupData.filter(g => g.name === manageRegion);

  const teamsInEditLeague = editLeagueId ? masterTeams.filter(t => t.region === leagueName) : [];

  const assignmentTeams = getSortedTeamsLogic(
    masterTeams.filter(t => !(recordActiveS?.teams || []).map(at => at.name).includes(t.name) && (selCategory==='ALL' || t.category===selCategory) && (selTier==='ALL' || t.tier===selTier) && (selRegion==='ALL' || t.region===selRegion)),
    '', '', '', ''
  );
  
  const assignmentRegions = Array.from(new Set(masterTeams.filter(t => selCategory==='ALL' || t.category===selCategory).map(t => t.region))).sort();

  return (
    <div className="min-h-screen bg-[#020617] text-white font-black italic tracking-tighter overflow-x-hidden pb-20">
      <div className="w-full h-[225px] md:h-[330px] relative border-b border-slate-800 shadow-2xl overflow-hidden bg-black" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {banners.map((b, i) => (<div key={b.id} className={`absolute inset-0 transition-opacity duration-1000 ${i===bannerIdx?'opacity-100 z-10':'opacity-0 z-0'}`}>{getBannerContent(b)}<div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent pointer-events-none"></div></div>))}
        <div className="absolute bottom-6 left-6 uppercase z-20 pointer-events-none"><h1 className="text-2xl md:text-4xl text-white font-black italic">ⓔFOOTBALL SUPER LEAGUE™</h1><p className="text-emerald-400 text-[10px] md:text-xs font-sans not-italic tracking-widest mt-1">ver. League Master P_75_Final</p><div className="mt-2 px-3 py-1 bg-black/50 rounded-lg inline-block border border-emerald-900/50"><span className="text-emerald-300 font-mono text-[10px] md:text-xs tracking-widest">{currentTime}</span></div></div>
      </div>

      <div className="flex justify-center flex-wrap gap-2 mt-6 mb-8 px-4">
        {[{id:'RANKING',l:'🏆 RANKING'}, {id:'SCHEDULE',l:'📅 SCHEDULE'}, {id:'HISTORY',l:'📜 ALL TIME'}, {id:'TUTORIAL',l:'📘 TUTORIAL'}].map(t => (<button key={t.id} onClick={() => setCurrentView(t.id as any)} className={`px-6 py-3 rounded-xl border text-xs transition-all shadow-lg ${currentView===t.id?'bg-blue-600 border-blue-400 text-white scale-105':'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}>{t.l}</button>))}
        <button onClick={handleAdminAccess} className={`px-6 py-3 rounded-xl border text-xs transition-all shadow-lg ${currentView==='ADMIN'?'bg-purple-600 border-purple-400 text-white scale-105':'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}>⚙️ ADMIN</button>
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-8 space-y-8">
        {currentView === 'RANKING' && (
          <div className="animate-in fade-in space-y-6">
            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col gap-4">
              <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700 outline-none font-sans not-italic">{seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <div className="flex gap-2 overflow-x-auto">{['STANDINGS', 'OWNERS', 'PLAYERS', 'HIGHLIGHTS'].map(sub => (<button key={sub} onClick={() => setRankingTab(sub as any)} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${rankingTab === sub ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{sub}</button>))}</div>
            </div>
            {rankingTab === 'STANDINGS' && <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl"><table className="w-full text-left text-xs uppercase border-collapse"><thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800"><tr><th className="p-4 w-8">#</th><th className="p-4">Club</th><th className="p-4 text-center">P</th><th className="p-4 text-center">W</th><th className="p-4 text-center">D</th><th className="p-4 text-center">L</th><th className="p-4 text-center">Pts</th></tr></thead><tbody>{activeRankingData.teams.map((t, i) => (<tr key={t.id} className="border-b border-slate-800/50"><td className="p-4 text-center">{i+1}</td><td className="p-4 flex items-center gap-3"><img src={t.logo} alt={t.name} className="w-8 h-8 object-contain" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/><span className="font-bold">{t.name}</span></td><td className="p-4 text-center text-white">{t.win+t.draw+t.loss}</td><td className="p-4 text-center text-slate-300">{t.win}</td><td className="p-4 text-center text-slate-300">{t.draw}</td><td className="p-4 text-center text-slate-300">{t.loss}</td><td className="p-4 text-center text-emerald-400 font-bold">{t.points}</td></tr>))}</tbody></table></div>}
            {rankingTab === 'OWNERS' && <div className="bg-slate-900/40 rounded-xl border border-purple-500/20"><table className="w-full text-xs uppercase"><thead className="bg-slate-950/80 text-purple-400"><tr><th className="p-4">Owner</th><th className="p-4 text-right">Pts</th></tr></thead><tbody>{activeRankingData.owners.map(o => (<tr key={o.id} className="border-b border-slate-800/50"><td className="p-4">{o.ownerName}</td><td className="p-4 text-right">{o.points}</td></tr>))}</tbody></table></div>}
            {rankingTab === 'PLAYERS' && <div className="space-y-4"><div className="flex justify-center gap-2"><button onClick={() => setStatView('GOAL')} className={`px-4 py-1 rounded-full text-xs font-bold ${statView==='GOAL'?'bg-emerald-600':'bg-slate-800'}`}>GOALS</button><button onClick={() => setStatView('ASSIST')} className={`px-4 py-1 rounded-full text-xs font-bold ${statView==='ASSIST'?'bg-blue-600':'bg-slate-800'}`}>ASSISTS</button></div><div className="bg-slate-900/40 rounded-xl border border-slate-800"><table className="w-full text-xs uppercase"><thead className="bg-slate-950/80 text-slate-500"><tr><th className="p-4">Player</th><th className="p-4 text-right">Count</th></tr></thead><tbody>{activeRankingData.players.sort((a,b)=>statView==='GOAL'?b.goals-a.goals:b.assists-a.assists).slice(0,20).map((p,i)=>(<tr key={i} className="border-b border-slate-800/50"><td className="p-4">{p.name} <span className="text-[9px] text-slate-500">({p.team})</span></td><td className="p-4 text-right font-bold text-white">{statView==='GOAL'?p.goals:p.assists}</td></tr>))}</tbody></table></div></div>}
            {rankingTab === 'HIGHLIGHTS' && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{activeRankingData.highlights.map((m, i) => (<div key={i} className="aspect-video bg-black"><iframe className="w-full h-full" src={`https://www.youtube.com/embed/${m.youtubeUrl.split('v=')[1]}`} frameBorder="0" allowFullScreen title={m.home}></iframe></div>))}</div>}
          </div>
        )}

        {currentView === 'SCHEDULE' && (
          <div className="animate-in fade-in space-y-6">
            <div className="flex justify-end mb-4"><select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700 outline-none font-sans not-italic text-right">{seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            {(!seasons.find(s=>s.id===viewSeasonId)?.rounds || seasons.find(s=>s.id===viewSeasonId)?.rounds?.length === 0) ? <div className="flex flex-col items-center justify-center py-20 opacity-50"><span className="text-6xl mb-4">📅</span><p className="text-xl font-bold">매치 스케줄이 생성되지 않았습니다.</p></div> : (seasons.find(s=>s.id===viewSeasonId)?.rounds || []).map(r => (<div key={r.round} className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800"><h3 className="text-sm text-slate-500 font-bold mb-4 uppercase tracking-widest">{r.name || `Round ${r.round}`}</h3><div className="grid grid-cols-1 gap-4">{r.matches.map(m => (<div key={m.id} onClick={() => handleMatchClick(m)} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center cursor-pointer hover:border-blue-500"><div className="flex items-center gap-3 w-[40%]"><img src={m.homeLogo} alt={m.home} className="w-8 h-8 bg-white rounded-full p-1" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/><span className="text-sm font-bold truncate">{m.home}</span></div><div className="w-[20%] text-center font-black text-2xl">{m.status==='FINISHED' ? `${m.homeScore}:${m.awayScore}` : 'VS'}</div><div className="flex items-center gap-3 w-[40%] justify-end"><span className="text-sm font-bold truncate">{m.away}</span><img src={m.awayLogo} alt={m.away} className="w-8 h-8 bg-white rounded-full p-1" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/></div></div>))}</div></div>))}
          </div>
        )}

        {currentView === 'ADMIN' && (
          <div className="animate-in fade-in space-y-10">
            <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col md:flex-row gap-4 items-center">
              <select value={adminTab} onChange={(e) => setAdminTab(e.target.value === 'NEW' || e.target.value === 'OWNER' || e.target.value === 'BANNER' || e.target.value === 'LEAGUES' || e.target.value === 'TEAMS' ? e.target.value : Number(e.target.value))} className="w-full bg-slate-950 p-4 rounded-xl border border-slate-700 text-sm font-sans not-italic">
                <optgroup label="Core Options"><option value="NEW">➕ 새로운 게임 만들기</option><option value="OWNER">👤 오너 만들기</option><option value="BANNER">🖼️ 배너 관리</option><option value="LEAGUES">🏳️ 리그 관리</option><option value="TEAMS">🛡️ 팀 관리</option></optgroup>
                <optgroup label="Active Seasons">{seasons.map(s => <option key={s.id} value={s.id}>🏆 {s.name}</option>)}</optgroup>
              </select>
              {typeof adminTab === 'number' && <button onClick={handleDeleteSeason} className="w-full md:w-auto px-6 py-4 bg-red-900/50 border border-red-800 text-red-400 rounded-xl font-bold hover:bg-red-900 transition-colors whitespace-nowrap">🗑️ 게임 삭제하기</button>}
            </div>
            
            {adminTab === 'LEAGUES' && (
              <div className="bg-slate-900/60 p-8 rounded-3xl border border-yellow-500/30 space-y-4">
                <h3 className="text-yellow-400 font-bold">리그/지역 관리</h3>
                
                {/* Toggle */}
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setLeagueManageTab('CLUB')} className={`px-6 py-2 rounded-full text-xs font-bold ${leagueManageTab==='CLUB'?'bg-yellow-600 text-black':'bg-slate-800 text-slate-500'}`}>🏢 CLUB</button>
                  <button onClick={() => setLeagueManageTab('NATIONAL')} className={`px-6 py-2 rounded-full text-xs font-bold ${leagueManageTab==='NATIONAL'?'bg-red-600 text-white':'bg-slate-800 text-slate-500'}`}>🏳️ NATIONAL</button>
                </div>

                <div className="flex gap-4 flex-col md:flex-row items-center bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                  <select onChange={handleLeagueSelect} value={editLeagueId || 'NEW'} className="bg-slate-950 p-3 rounded w-full md:w-48 border border-slate-700 text-sm">
                    <option value="NEW">✨ 새로운 리그 등록</option>
                    <optgroup label="등록된 리그">
                      {leagues.filter(l => l.category === leagueManageTab).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </optgroup>
                  </select>

                  <div className="flex-1 flex gap-2 w-full">
                     <input value={leagueName} onChange={e=>setLeagueName(e.target.value)} placeholder="리그 이름 (예: Premier League)" className="bg-slate-950 p-3 rounded w-full border border-slate-800 text-sm"/>
                     <input value={leagueLogo} onChange={e=>setLeagueLogo(e.target.value)} placeholder="로고 URL" className="bg-slate-950 p-3 rounded w-full border border-slate-800 text-sm"/>
                  </div>
                  <button onClick={handleSaveLeague} className="bg-yellow-600 text-black px-6 py-3 rounded font-bold whitespace-nowrap text-sm">{editLeagueId ? '수정 저장' : '새로 등록'}</button>
                </div>

                {editLeagueId && (
                  <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <p className="text-xs text-slate-500 mb-2 font-bold">소속된 팀 목록 ({teamsInEditLeague.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {teamsInEditLeague.length > 0 ? teamsInEditLeague.map(t => (
                        <span key={t.id} className="bg-slate-900 px-3 py-1 rounded border border-slate-800 text-xs flex items-center gap-1">
                          <img src={t.logo} alt={t.name} className="w-4 h-4 object-contain" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/> {t.name}
                        </span>
                      )) : <span className="text-xs text-slate-600">소속된 팀이 없습니다.</span>}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mt-6">
                  {leagues.filter(l => l.category === leagueManageTab).map(l => (
                    <div key={l.id} onClick={() => handleEditLeagueClick(l)} className={`bg-slate-950 p-4 rounded-xl border ${editLeagueId===l.id ? 'border-yellow-500 bg-yellow-900/10' : 'border-slate-800'} flex flex-col items-center gap-2 relative group cursor-pointer hover:border-yellow-500`}>
                      <img src={l.logo} alt={l.name} className="w-10 h-10 object-contain bg-white rounded-full p-1" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
                      <span className="text-[10px] font-bold text-center">{l.name}</span>
                      <button onClick={(e) => {e.stopPropagation(); handleDeleteLeague(l);}} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {adminTab === 'TEAMS' && (
              <>
                <div className="flex justify-between items-center mb-4 px-2"><h3 className="text-lg font-bold italic text-slate-400">TEAM MANAGEMENT</h3><button onClick={handleInitCreateTeam} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-500 transition-colors shadow-lg">➕ 새로운 팀 등록하기</button></div>
                <div className="bg-slate-900/60 p-4 rounded-3xl border border-slate-800 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="flex gap-2">
                    <button onClick={() => { setManageTab('CLUB'); resetFilters(); }} className={`px-6 py-2 rounded-full text-xs font-bold ${manageTab==='CLUB'?'bg-blue-600 text-white':'bg-slate-800 text-slate-500'}`}>🏢 CLUB</button>
                    <button onClick={() => { setManageTab('NATIONAL'); resetFilters(); }} className={`px-6 py-2 rounded-full text-xs font-bold ${manageTab==='NATIONAL'?'bg-red-600 text-white':'bg-slate-800 text-slate-500'}`}>🏳️ NATIONAL</button>
                  </div>
                  <div className="flex gap-2 flex-1 w-full justify-end">
                    <select value={manageTier} onChange={e => setManageTier(e.target.value)} className="bg-slate-950 p-2 rounded-xl border border-slate-700 text-xs"><option value="ALL">등급 전체</option><option value="S">S등급</option><option value="A">A등급</option><option value="B">B등급</option><option value="C">C등급</option></select>
                    {/* 🔥 [Fix] Dropdown updates Grid/List */}
                    <select value={manageRegion} onChange={e => setManageRegion(e.target.value)} className="bg-slate-950 p-2 rounded-xl border border-slate-700 text-xs w-32"><option value="ALL">리그 전체</option>{groupData.map((g,i)=><option key={i} value={g.name}>{g.name}</option>)}</select>
                    <input value={manageSearch} onChange={e=>setManageSearch(e.target.value)} placeholder="팀 이름 검색..." className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-700 text-xs w-full md:w-48"/>
                  </div>
                </div>

                {/* 🔥 [Updated] Grouped List View */}
                {showGrid ? (
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-8">
                    {groupData.map((l, idx) => (<div key={idx} onClick={() => setManageRegion(l.name)} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-500 hover:bg-slate-800 transition-all"><img src={l.logo} alt={l.name} className="w-10 h-10 object-contain bg-white rounded-full p-1" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/><span className="text-[10px] font-bold text-center leading-tight">{l.name}</span><span className="text-[8px] text-slate-500">({l.count})</span></div>))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(manageSearch ? [{name:'검색 결과', logo:'', count:teamsToDisplay.length}] : groupsToRender).map((group, idx) => {
                      const leagueTeams = manageSearch ? filteredTeams : filteredTeams.filter(t => t.region === group.name);
                      if (leagueTeams.length === 0) return null;
                      return (
                        <div key={idx} className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800">
                          <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-800">
                            {group.logo && <img src={group.logo} alt={group.name} className="w-8 h-8 object-contain" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>}
                            <h4 className="text-blue-400 font-bold text-lg">{group.name} <span className="text-slate-500 text-xs ml-2">({leagueTeams.length})</span></h4>
                            {manageRegion !== 'ALL' && idx === 0 && <button onClick={resetFilters} className="ml-auto text-xs text-slate-400 underline">전체 리그 보기</button>}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                            {leagueTeams.slice(0, visibleTeamCount).map(mt => (
                              <div key={mt.id} onClick={() => {setEditTeamId(mt.id!); setManualTeam(mt); manualFormRef.current?.scrollIntoView({behavior:'smooth'})}} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-500 transition-all relative group">
                                <img src={mt.logo} alt={mt.name} className="w-10 h-10 object-contain bg-white rounded-full p-1" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
                                <p className="text-[10px] font-bold truncate w-full text-center">{mt.name}</p>
                                <p className="text-[9px] text-slate-500 truncate w-full text-center">{mt.region} • {mt.tier}등급</p>
                                <button onClick={(e) => {e.stopPropagation(); handleDeleteMasterTeam(mt.id!);}} className="absolute top-2 right-2 text-red-500 font-bold opacity-0 group-hover:opacity-100">×</button>
                              </div>
                            ))}
                          </div>
                          {leagueTeams.length > visibleTeamCount && <button onClick={() => setVisibleTeamCount(prev => prev + 18)} className="w-full py-3 bg-slate-800 text-slate-400 font-bold text-xs rounded-xl hover:bg-slate-700 transition-colors mt-4">👇 더 보기</button>}
                        </div>
                      );
                    })}
                    {filteredTeams.length === 0 && <div className="text-center py-20 text-slate-500 font-bold">조건에 맞는 팀이 없습니다.</div>}
                  </div>
                )}
                
                <section ref={manualFormRef} className="p-8 rounded-3xl border bg-slate-900/60 border-slate-800 mt-8">
                  <h3 className="text-xl mb-4 font-bold">{editTeamId ? '팀 수정하기' : '새로운 팀 등록'}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 font-sans not-italic mb-4">
                    <select value={manualTeam.category} onChange={e => setManualTeam({...manualTeam, category: e.target.value as any})} className="bg-slate-950 p-3 rounded border border-slate-700 text-sm"><option value="CLUB">클럽</option><option value="NATIONAL">국가대표</option></select>
                    <select value={manualTeam.tier} onChange={e => setManualTeam({...manualTeam, tier: e.target.value as any})} className="bg-slate-950 p-3 rounded border border-slate-700 text-sm"><option value="S">S등급</option><option value="A">A등급</option><option value="B">B등급</option><option value="C">C등급</option></select>
                    {/* 🔥 [Fix] Fallback for Combobox */}
                    <select value={manualTeam.region} onChange={e => setManualTeam({...manualTeam, region: e.target.value})} className="bg-slate-950 p-3 rounded border border-slate-700 text-sm">
                      <option value="">리그/지역 선택</option>
                      <optgroup label="등록된 리그">{leagues.filter(l=>l.category===manualTeam.category).map(l=><option key={l.id} value={l.name}>{l.name}</option>)}</optgroup>
                      <optgroup label="기본 옵션">{DEFAULT_LEAGUES.map(r=><option key={r} value={r}>{r}</option>)}</optgroup>
                    </select>
                    <input value={manualTeam.name} onChange={e => setManualTeam({...manualTeam, name: e.target.value})} placeholder="팀 이름" className="bg-slate-950 p-3 rounded border border-slate-700 text-sm" />
                    <input value={manualTeam.logo} onChange={e => setManualTeam({...manualTeam, logo: e.target.value})} placeholder="로고 URL" className="bg-slate-950 p-3 rounded border border-slate-700 text-sm" />
                  </div>
                  <button onClick={handleSaveMaster} className="w-full bg-emerald-600 py-3 rounded font-bold">{editTeamId ? '수정 저장하기' : '등록하기'}</button>
                </section>
                <section className="bg-slate-900/60 p-8 rounded-3xl border border-orange-500/30 mt-4"><h3 className="text-orange-400 font-bold mb-4">한번에 등록하기 (JSON)</h3><textarea value={bulkInput} onChange={e => setBulkInput(e.target.value)} className="w-full h-24 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs mb-4" /><button onClick={handleBulk} className="w-full bg-orange-600 py-3 rounded font-bold">등록하기</button></section>
              </>
            )}

            {typeof adminTab === 'number' && (
              <div className="bg-slate-900/60 p-8 rounded-3xl border border-blue-500/30 space-y-6">
                <div className="flex justify-between items-center"><h3 className="text-blue-400 font-bold">팀 배정</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 font-sans not-italic">
                  <select value={selOwnerId} onChange={e => setSelOwnerId(Number(e.target.value))} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs text-white"><option value="">오너 선택</option>{owners.map(o=><option key={o.id} value={o.id}>{o.nickname}</option>)}</select>
                  <select value={selCategory} onChange={e => {setSelCategory(e.target.value as any); setSelRegion('ALL');}} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs text-white"><option value="ALL">전체</option><option value="CLUB">클럽</option><option value="NATIONAL">국가대표</option></select>
                  <select value={selTier} onChange={e => setSelTier(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs text-white"><option value="ALL">전체 등급</option>{['S','A','B','C'].map(t=><option key={t} value={t}>{t}등급</option>)}</select>
                  <select value={selRegion} onChange={e => setSelRegion(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-xs text-white"><option value="ALL">리그/지역</option>{assignmentRegions.map(r=><option key={r} value={r}>{r}</option>)}</select>
                  <button onClick={handleRandomDraw} className="bg-slate-800 border border-slate-600 rounded text-xs font-bold">🎲</button>
                </div>
                <div className="flex gap-2">
                  <select value={selTeamName} onChange={e => setSelTeamName(e.target.value)} className="flex-1 bg-slate-950 p-3 rounded border border-blue-500 text-blue-400 font-bold font-sans not-italic"><option value="">팀 선택...</option>{assignmentTeams.map(mt => <option key={mt.id} value={mt.name}>{mt.name}</option>)}</select>
                  <button onClick={handleConfirmTeam} className="bg-blue-600 px-6 rounded font-bold">배정</button>
                </div>
                <div className="pt-6 border-t border-slate-800">
                  <p className="text-[10px] text-slate-500 mb-4 font-bold">현재 배정된 팀 ({(recordActiveS?.teams || []).length})</p>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2">
                    {(recordActiveS?.teams || []).map(t => (
                      <span key={t.id} className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-[11px] flex items-center gap-2">
                        <img src={t.logo} alt="team" className="w-5 h-5 object-contain bg-white rounded-full p-0.5" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
                        <div className="flex flex-col"><span className="text-white font-bold">{t.name}</span><span className="text-slate-500 text-[9px] uppercase">{t.region} • {t.tier} • {t.ownerName}</span></div>
                        <button onClick={() => handleRemoveTeamFromSeason(t.id)} className="ml-2 text-red-500 hover:text-red-300 font-bold">×</button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="border-t border-slate-800 pt-6 mt-4"><button onClick={handleGenerateSchedule} className="w-full bg-slate-800 text-emerald-400 border border-emerald-900 py-3 rounded-xl text-sm font-bold hover:bg-emerald-900/20 transition-all">📅 스케쥴 만들기</button></div>
              </div>
            )}
            
            {adminTab === 'BANNER' && (<div className="bg-slate-900/60 p-8 rounded-3xl border border-blue-500/30 space-y-4"><h3 className="text-blue-400 font-bold">배너 이미지/영상 관리</h3><div className="flex gap-4 flex-col md:flex-row"><input value={bannerTitle} onChange={e=>setBannerTitle(e.target.value)} placeholder="제목" className="bg-slate-950 p-3 rounded w-full border border-slate-800"/><input value={bannerUrl} onChange={e=>setBannerUrl(e.target.value)} placeholder="URL" className="bg-slate-950 p-3 rounded w-full border border-slate-800"/><button onClick={handleSaveBanner} className="bg-blue-600 px-6 py-3 rounded font-bold whitespace-nowrap">등록</button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">{banners.map(b => (<div key={b.id} className="relative group rounded-xl overflow-hidden border border-slate-700 aspect-video">{getBannerContent(b)}<div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleDeleteBanner(b.id!)} className="bg-red-600 text-white px-4 py-2 rounded font-bold">삭제</button></div></div>))}</div></div>)}
            {adminTab === 'NEW' && (<div className="bg-slate-900/60 p-8 rounded-3xl border border-emerald-500/30 space-y-6"><h3 className="text-emerald-400 font-bold">새로운 시즌 만들기</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input value={inputSeasonName} onChange={e=>setInputSeasonName(e.target.value)} placeholder="시즌 이름" className="bg-slate-950 p-3 rounded w-full border border-slate-800"/><div className="flex gap-2"><select value={inputSeasonType} onChange={e=>setInputSeasonType(e.target.value as any)} className="bg-slate-950 p-3 rounded w-full border border-slate-800"><option value="LEAGUE">리그</option><option value="TOURNAMENT">토너먼트</option></select>{inputSeasonType==='LEAGUE' && <select value={inputLeagueMode} onChange={e=>setInputLeagueMode(e.target.value as any)} className="bg-slate-950 p-3 rounded w-full border border-slate-800"><option value="SINGLE">싱글</option><option value="DOUBLE">홈&어웨이</option></select>}</div></div><button onClick={handleCreateSeason} className="w-full bg-emerald-600 py-3 rounded font-bold">시즌 생성하기</button></div>)}
            {adminTab === 'OWNER' && (<div className="bg-slate-900/60 p-8 rounded-3xl border border-purple-500/30 space-y-4"><h3 className="text-purple-400 font-bold">오너 관리</h3><div className="flex gap-4 flex-col md:flex-row"><input value={newOwnerName} onChange={e=>setNewOwnerName(e.target.value)} placeholder="닉네임" className="bg-slate-950 p-3 rounded w-full border border-slate-800"/><input value={newOwnerPhoto} onChange={e=>setNewOwnerPhoto(e.target.value)} placeholder="이미지 URL" className="bg-slate-950 p-3 rounded w-full border border-slate-800"/><button onClick={handleSaveOwner} className="bg-blue-600 px-6 py-3 rounded font-bold">{editOwnerId?'UPDATE':'ADD'}</button>{editOwnerId && <button onClick={()=>{setEditOwnerId(null); setNewOwnerName('');}} className="bg-slate-700 px-6 rounded">CANCEL</button>}</div><div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">{owners.map(o => (<div key={o.id} onClick={() => handleEditOwnerClick(o)} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-4 cursor-pointer hover:border-blue-500"><img src={o.photo} alt={o.nickname} className="w-12 h-12 rounded-full border-2 border-slate-700" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/><span className="text-sm">{o.nickname}</span></div>))}</div></div>)}
          </div>
        )}
      </main>

      {/* Modal: Match Edit */}
      {editingMatch && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] p-4 overflow-y-auto">
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-700 w-full max-w-5xl space-y-6 my-auto relative">
            <button onClick={() => setEditingMatch(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white text-2xl">✕</button>
            <h3 className="text-center text-xl font-black italic text-slate-400 border-b border-slate-800 pb-4">MATCH RESULT</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              <div className="flex flex-col gap-4 items-center bg-slate-950 p-6 rounded-2xl border border-slate-800"><img src={editingMatch.homeLogo} alt={editingMatch.home} className="w-20 h-20" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/><span className="text-xl font-bold">{editingMatch.home}</span><RecordInput label="Goals" type="homeScorer" colorClass="text-blue-400" inputValue={recordInputs.homeScorer} onInputChange={(t:any,f:any,v:any)=>setRecordInputs({...recordInputs,[t]:{...recordInputs.homeScorer,[f]:v}})} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.homeScorers} /></div>
              <div className="flex flex-col items-center justify-center h-full gap-4 py-4"><div className="flex items-center gap-4"><input type="number" value={matchInputs.homeScore} onChange={e=>setMatchInputs({...matchInputs,homeScore:e.target.value})} className="w-24 h-24 text-5xl text-center bg-slate-950 rounded-2xl border-2 border-slate-700 text-white" /><span className="text-4xl">:</span><input type="number" value={matchInputs.awayScore} onChange={e=>setMatchInputs({...matchInputs,awayScore:e.target.value})} className="w-24 h-24 text-5xl text-center bg-slate-950 rounded-2xl border-2 border-slate-700 text-white" /></div><input value={matchInputs.youtube} onChange={e=>setMatchInputs({...matchInputs,youtube:e.target.value})} placeholder="YouTube Link" className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-center"/><button onClick={saveMatchResult} className="w-full bg-emerald-600 py-4 rounded-xl font-bold text-lg hover:bg-emerald-500">SAVE</button></div>
              <div className="flex flex-col gap-4 items-center bg-slate-950 p-6 rounded-2xl border border-slate-800"><img src={editingMatch.awayLogo} alt={editingMatch.away} className="w-20 h-20" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/><span className="text-xl font-bold">{editingMatch.away}</span><RecordInput label="Goals" type="awayScorer" colorClass="text-red-400" inputValue={recordInputs.awayScorer} onInputChange={(t:any,f:any,v:any)=>setRecordInputs({...recordInputs,[t]:{...recordInputs.awayScorer,[f]:v}})} onAdd={handleRecordAdd} onRemove={handleRecordRemove} records={editingMatch.awayScorers} /></div>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-slate-950 py-10 mt-12 border-t border-slate-900">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div><h4 className="text-white font-bold text-lg mb-2">eFOOTBALL SUPER LEAGUE</h4><p className="text-slate-500 text-sm">본 리그는 KONAMI eFOOTBALL로 진행 됩니다.<br/>대회 참가문의: joycube@gmail.com</p></div>
          <div className="flex flex-col gap-2 md:items-end"><a href="#" className="text-slate-400 hover:text-emerald-400 text-sm">eFOOTBALL 공식 홈페이지</a></div>
        </div>
      </footer>
    </div>
  );
}