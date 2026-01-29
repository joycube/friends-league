"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, setDoc, writeBatch } from 'firebase/firestore';

// -----------------------------------------------------------------------------
// 📢 [설정] 배너 이미지
// -----------------------------------------------------------------------------
const RANKING_BANNER_IMG = "https://www.konami.com/efootball/s/img/main_page_1.png?v=903"; 
// -----------------------------------------------------------------------------

// --- 데이터 타입 정의 ---
interface Season { 
  id: number; name: string; type: 'LEAGUE' | 'TOURNAMENT'; leagueMode?: 'SINGLE' | 'DOUBLE'; isActive: boolean;
  teams?: Team[]; rounds?: Round[]; 
}
interface Owner { id: number; nickname: string; photo: string; docId?: string; }
interface MasterTeam {
  id?: string; name: string; logo: string; category: 'CLUB' | 'NATIONAL'; region: string;
}
interface Team {
  id: number; seasonId: number; name: string; logo: string; category: 'CLUB' | 'NATIONAL'; region: string;
  ownerId: number; ownerName: string; win: number; draw: number; loss: number; points: number; winRate: string; diff: number;
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
  
  // Tabs & Filters
  const [rankingTab, setRankingTab] = useState<'STANDINGS' | 'SCHEDULE' | 'HISTORY'>('STANDINGS');
  const [statsTab, setStatsTab] = useState<'GOALS' | 'ASSISTS'>('GOALS');
  const [manageTab, setManageTab] = useState<'CLUB' | 'NATIONAL'>('CLUB');
  const [manageRegionFilter, setManageRegionFilter] = useState('ALL');
  
  // Search State
  const [manageSearchQuery, setManageSearchQuery] = useState('');

  // Record Tab State
  const [recordTab, setRecordTab] = useState<number | 'NEW'>('NEW');

  // DB Data
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currentSeasonId, setCurrentSeasonId] = useState<number>(0);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);

  // Stats
  const [topScorers, setTopScorers] = useState<PlayerStat[]>([]);
  const [topAssists, setTopAssists] = useState<PlayerStat[]>([]);
  const [historyOwners, setHistoryOwners] = useState<any[]>([]);
  const [historyTeams, setHistoryTeams] = useState<any[]>([]);
  const [allTimeScorers, setAllTimeScorers] = useState<PlayerStat[]>([]);
  const [allTimeAssists, setAllTimeAssists] = useState<PlayerStat[]>([]);

  // Inputs & Edit States
  const [inputSeasonName, setInputSeasonName] = useState('');
  const [inputSeasonType, setInputSeasonType] = useState<'LEAGUE' | 'TOURNAMENT'>('LEAGUE');
  const [inputLeagueMode, setInputLeagueMode] = useState<'SINGLE' | 'DOUBLE'>('SINGLE');
  const [inputOwnerName, setInputOwnerName] = useState('');
  const [inputOwnerPhoto, setInputOwnerPhoto] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | ''>('');
  const [selectedCategory, setSelectedCategory] = useState<'CLUB' | 'NATIONAL'>('CLUB');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedTeamIdx, setSelectedTeamIdx] = useState(0);
  const [recordInputs, setRecordInputs] = useState<Record<string, { name: string, count: number }>>({});
  
  // Team Manager Inputs
  const [excelInput, setExcelInput] = useState('');
  const [manualTeam, setManualTeam] = useState({ name:'', logo:'', region:'', category:'CLUB' });
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  
  // Season Delete Select
  const [seasonToDeleteId, setSeasonToDeleteId] = useState<string>('');

  const manualFormRef = useRef<HTMLDivElement>(null);

  // --- Helpers ---
  const activeTeams = teams.filter(t => t.seasonId === currentSeasonId);
  const activeRounds = rounds.filter(r => r.seasonId === currentSeasonId);

  const recordActiveSeasonId = typeof recordTab === 'number' ? recordTab : 0;
  const recordActiveSeason = seasons.find(s => s.id === recordActiveSeasonId);
  const recordActiveTeams = teams.filter(t => t.seasonId === recordActiveSeasonId);
  const recordActiveRounds = rounds.filter(r => r.seasonId === recordActiveSeasonId);

  const recordFilteredTeams = masterTeams.filter(t => t.category === selectedCategory);
  const recordAvailableRegions = Array.from(new Set(recordFilteredTeams.map(t => t.region)));
  const recordCurrentTeamList = recordFilteredTeams.filter(t => t.region === selectedRegion);
  
  // Team Management Filter
  const manageFilteredTeams = masterTeams.filter(t => t.category === manageTab);
  const manageAvailableRegions = Array.from(new Set(manageFilteredTeams.map(t => t.region)));
  
  const manageDisplayTeams = manageFilteredTeams.filter(t => {
    const matchRegion = manageRegionFilter === 'ALL' || t.region === manageRegionFilter;
    const matchSearch = t.name.toLowerCase().includes(manageSearchQuery.toLowerCase());
    return matchRegion && matchSearch;
  });

  // --- 🔥 DB Sync ---
  useEffect(() => { const u = onSnapshot(query(collection(db, "users"), orderBy("id", "asc")), (s) => setOwners(s.docs.map(d => ({ ...d.data(), docId: d.id } as Owner)))); return () => u(); }, []);
  useEffect(() => { const u = onSnapshot(query(collection(db, "master_teams"), orderBy("name", "asc")), (s) => setMasterTeams(s.docs.map(d => ({ id: d.id, ...d.data() } as MasterTeam)))); return () => u(); }, []);
  useEffect(() => { 
    const u = onSnapshot(query(collection(db, "seasons"), orderBy("id", "desc")), (s) => { 
      const d = s.docs.map(doc => doc.data() as Season); 
      setSeasons(d); 
      if(d.length > 0 && currentSeasonId === 0) {
         setCurrentSeasonId(d[0].id); 
         setRecordTab(d[0].id);
      }
    }); 
    return () => u(); 
  }, [currentSeasonId]);

  useEffect(() => { 
    const targetId = currentView === 'RECORD' && typeof recordTab === 'number' ? recordTab : currentSeasonId;
    if(!targetId) return; 
    const u = onSnapshot(doc(db, "seasons", String(targetId)), (s) => { 
      if(s.exists()) { 
        const d = s.data(); 
        if(d.teams) setTeams(prev => { const others = prev.filter(t=>t.seasonId !== targetId); return [...others, ...d.teams]; }); 
        if(d.rounds) setRounds(prev => { const others = prev.filter(r=>r.seasonId !== targetId); return [...others, ...d.rounds]; }); 
      } 
    }); 
    return () => u(); 
  }, [currentSeasonId, recordTab, currentView]);

  useEffect(() => { 
    if (recordAvailableRegions.length > 0 && !recordAvailableRegions.includes(selectedRegion)) { 
      setSelectedRegion(recordAvailableRegions[0]); 
      setSelectedTeamIdx(0); 
    } 
  }, [selectedCategory, recordAvailableRegions, selectedRegion]);
  
  useEffect(() => { calculateSeasonStats(); }, [rounds, currentSeasonId]);
  useEffect(() => { if(seasons.length > 0 && owners.length > 0) calculateGlobalHistory(); }, [seasons, owners]);

  // --- 📈 Stats Logic ---
  const calculateSeasonStats = () => { if (!currentSeasonId) return; const sMap:any={}, aMap:any={}; activeRounds.forEach(r=>r.matches.forEach(m=>{if(m.status==='FINISHED'){ (m.homeScorers||[]).forEach(s=>{sMap[s.name]={count:(sMap[s.name]?.count||0)+Number(s.count),ownerName:m.homeOwner,teamLogo:s.teamLogo}}); (m.awayScorers||[]).forEach(s=>{sMap[s.name]={count:(sMap[s.name]?.count||0)+Number(s.count),ownerName:m.awayOwner,teamLogo:s.teamLogo}}); (m.homeAssists||[]).forEach(s=>{aMap[s.name]={count:(aMap[s.name]?.count||0)+Number(s.count),ownerName:m.homeOwner,teamLogo:s.teamLogo}}); (m.awayAssists||[]).forEach(s=>{aMap[s.name]={count:(aMap[s.name]?.count||0)+Number(s.count),ownerName:m.awayOwner,teamLogo:s.teamLogo}}); }})); setTopScorers(Object.entries(sMap).map(([n,d]:any)=>({name:n,...d})).sort((a,b)=>b.count-a.count)); setTopAssists(Object.entries(aMap).map(([n,d]:any)=>({name:n,...d})).sort((a,b)=>b.count-a.count)); };
  
  const calculateGlobalHistory = () => { 
    const hOwnerMap:any = {}; const hTeamMap:any = {}; const sMap:any={}, aMap:any={}; 
    const validOwnerIds = new Set(owners.map(o => o.id));
    seasons.forEach(season => { 
        if (!season.teams || !season.rounds) return; 
        const sTeams = season.teams.map(t => ({...t, win:0, draw:0, loss:0, points:0})); 
        season.rounds.forEach(r => r.matches.forEach(m => { 
            if (m.status === 'FINISHED') { 
                const h = sTeams.find(t => t.name === m.home); const a = sTeams.find(t => t.name === m.away); 
                const hValid = validOwnerIds.has(h?.ownerId || -1); const aValid = validOwnerIds.has(a?.ownerId || -1);
                if (h && a && hValid && aValid) { 
                    const hs = Number(m.homeScore); const as = Number(m.awayScore); 
                    if (hs > as) { h.win++; h.points+=3; a.loss++; } else if (hs < as) { a.win++; a.points+=3; h.loss++; } else { h.draw++; h.points++; a.draw++; a.points++; } 
                } 
                (m.homeScorers||[]).forEach(s=>{sMap[s.name]={count:(sMap[s.name]?.count||0)+Number(s.count),ownerName:m.homeOwner,teamLogo:s.teamLogo}}); (m.awayScorers||[]).forEach(s=>{sMap[s.name]={count:(sMap[s.name]?.count||0)+Number(s.count),ownerName:m.awayOwner,teamLogo:s.teamLogo}}); (m.homeAssists||[]).forEach(s=>{aMap[s.name]={count:(aMap[s.name]?.count||0)+Number(s.count),ownerName:m.homeOwner,teamLogo:s.teamLogo}}); (m.awayAssists||[]).forEach(s=>{aMap[s.name]={count:(aMap[s.name]?.count||0)+Number(s.count),ownerName:m.awayOwner,teamLogo:s.teamLogo}}); 
            } 
        })); 
        sTeams.forEach(t => { 
            if (validOwnerIds.has(t.ownerId)) {
                if (!hOwnerMap[t.ownerId]) hOwnerMap[t.ownerId] = { nickname: t.ownerName, photo: owners.find(o=>o.id===t.ownerId)?.photo, win:0, draw:0, loss:0, points:0 }; 
                hOwnerMap[t.ownerId].win += t.win; hOwnerMap[t.ownerId].draw += t.draw; hOwnerMap[t.ownerId].loss += t.loss; hOwnerMap[t.ownerId].points += t.points; 
                const teamKey = `${t.name}-${t.ownerId}`; 
                if (!hTeamMap[teamKey]) hTeamMap[teamKey] = { name: t.name, logo: t.logo, ownerName: t.ownerName, win:0, draw:0, loss:0, points:0 }; 
                hTeamMap[teamKey].win += t.win; hTeamMap[teamKey].draw += t.draw; hTeamMap[teamKey].loss += t.loss; hTeamMap[teamKey].points += t.points; 
            }
        }); 
    }); 
    setHistoryOwners(Object.values(hOwnerMap).map((o:any) => ({ ...o, winRate: (o.win+o.draw+o.loss)>0?((o.win/(o.win+o.draw+o.loss))*100).toFixed(0):'0' })).sort((a:any,b:any) => b.points - a.points)); 
    setHistoryTeams(Object.values(hTeamMap).map((t:any) => ({ ...t, winRate: (t.win+t.draw+t.loss)>0?((t.win/(t.win+t.draw+t.loss))*100).toFixed(0):'0' })).sort((a:any,b:any) => b.points - a.points)); 
    setAllTimeScorers(Object.entries(sMap).map(([n,d]:any)=>({name:n,...d})).sort((a,b)=>b.count-a.count)); 
    setAllTimeAssists(Object.entries(aMap).map(([n,d]:any)=>({name:n,...d})).sort((a,b)=>b.count-a.count)); 
  };

  const getComputedTeams = () => { const cT=teams.filter(t=>t.seasonId===currentSeasonId).map(t=>({...t,win:0,draw:0,loss:0,points:0,winRate:'0',diff:0})); activeRounds.forEach(r=>r.matches.forEach(m=>{if(m.status==='FINISHED'){ const h=cT.find(t=>t.name===m.home), a=cT.find(t=>t.name===m.away); if(h&&a){ const hs=Number(m.homeScore), as=Number(m.awayScore); h.diff+=hs-as; a.diff+=as-hs; if(hs>as){h.win++;h.points+=3;a.loss++;}else if(hs<as){a.win++;a.points+=3;h.loss++;}else{h.draw++;h.points++;a.draw++;a.points++;}}}})); cT.forEach(t=>{const to=t.win+t.draw+t.loss; t.winRate=to>0?((t.win/to)*100).toFixed(0):'0';}); return cT.sort((a,b)=>b.points-a.points||b.diff-a.diff); };
  const getOwnerStats=(id:number)=>{ const tt=getComputedTeams().filter(t=>t.ownerId===id); const w=tt.reduce((a,b)=>a+b.win,0), d=tt.reduce((a,b)=>a+b.draw,0), l=tt.reduce((a,b)=>a+b.loss,0), p=tt.reduce((a,b)=>a+b.points,0), t=w+d+l; return {win:w,draw:d,loss:l,points:p,winRate:t>0?((w/t)*100).toFixed(0):'0',teamCount:tt.length}; };
  const computedActiveTeams = getComputedTeams();
  const seasonOwners = [...owners].map(o=>({...o,...getOwnerStats(o.id)})).filter(o=>o.teamCount>0).sort((a,b)=>b.points-a.points);

  // --- 🛠️ Record Page Functions ---
  const handleCreateSeason = async () => { 
    if (!inputSeasonName.trim()) return alert("이름 입력!"); 
    try {
      const newId = Date.now(); 
      await setDoc(doc(db, "seasons", String(newId)), { 
          id: newId, name: inputSeasonName, type: inputSeasonType, 
          leagueMode: inputSeasonType === 'LEAGUE' ? inputLeagueMode : 'SINGLE', 
          isActive: true, teams: [], rounds: [] 
      }); 
      setRecordTab(newId); setInputSeasonName(''); alert("시즌 생성 완료! 탭으로 이동합니다."); 
    } catch(e) { alert("시즌 생성 중 오류가 발생했습니다."); }
  };

  const handleDeleteSelectedSeason = async () => { 
    if(!seasonToDeleteId) return alert("삭제할 시즌을 선택하세요.");
    const targetSeason = seasons.find(s => String(s.id) === seasonToDeleteId);
    if(confirm(`⚠️ 정말 [${targetSeason?.name}] 시즌을 삭제하시겠습니까? (복구 불가)`)) { 
      try {
        await deleteDoc(doc(db, "seasons", seasonToDeleteId)); 
        setSeasonToDeleteId(''); 
        if (Number(seasonToDeleteId) === currentSeasonId) setCurrentSeasonId(0);
        alert("시즌이 삭제되었습니다.");
      } catch(e) { alert("삭제 중 오류 발생"); }
    } 
  };

  const handleDeleteSeason = async () => { 
    if(!recordActiveSeason) return; 
    if(confirm(`⚠️ 정말 [${recordActiveSeason.name}] 시즌을 삭제하시겠습니까? (복구 불가)`)) { 
      try {
        await deleteDoc(doc(db, "seasons", String(recordActiveSeason.id))); 
        setRecordTab('NEW'); 
        if (recordActiveSeason.id === currentSeasonId) setCurrentSeasonId(0);
        alert("시즌이 삭제되었습니다.");
      } catch(e) { alert("삭제 중 오류 발생"); }
    } 
  };

  const handleAddOwner = async () => { if (!inputOwnerName.trim()) return alert("오너 입력!"); const finalPhoto = inputOwnerPhoto.trim() || `https://api.dicebear.com/7.x/adventurer/svg?seed=${inputOwnerName}`; await addDoc(collection(db, "users"), { id: Date.now(), nickname: inputOwnerName, photo: finalPhoto }); setInputOwnerName(''); setInputOwnerPhoto(''); };
  const handleDeleteOwner = async (docId: string, id: number) => { if(teams.some(t => t.ownerId === id)) { if(!confirm("⚠️ 진행 중인 시즌에 참여 중인 오너입니다.\n삭제 시 순위표에서 제외됩니다. 계속하시겠습니까?")) return; } else { if(!confirm("오너를 삭제하시겠습니까?")) return; } await deleteDoc(doc(db, "users", docId)); };
  
  const handleAddTeam = async () => { if (selectedOwnerId === '' || recordCurrentTeamList.length === 0) return alert("오너와 팀을 선택하세요."); const target = recordCurrentTeamList[selectedTeamIdx]; if (recordActiveTeams.find(t => t.name === target.name)) return alert("이미 등록된 팀입니다!"); const owner = owners.find(o => o.id === Number(selectedOwnerId)); if (!owner) return alert("오너 정보를 찾을 수 없습니다."); await updateDoc(doc(db, "seasons", String(recordActiveSeasonId)), { teams: [...recordActiveTeams, { id: Date.now(), seasonId: recordActiveSeasonId, name: target.name, logo: target.logo, category: target.category, region: target.region, ownerId: owner.id, ownerName: owner.nickname, win:0, draw:0, loss:0, points:0, winRate:'0', diff:0 }] }); setSelectedTeamIdx(selectedTeamIdx + 1 < recordCurrentTeamList.length ? selectedTeamIdx + 1 : 0); };
  const removeTeam = async (id: number) => { if(confirm("해당 팀을 리그에서 제외하시겠습니까?")) { await updateDoc(doc(db, "seasons", String(recordActiveSeasonId)), { teams: recordActiveTeams.filter(t => t.id !== id) }); } };
  const handleRandomRegion = () => { if(recordAvailableRegions.length===0)return; setSelectedRegion(recordAvailableRegions[Math.floor(Math.random()*recordAvailableRegions.length)]); setSelectedTeamIdx(0); };
  const handleRandomTeam = () => { const c = recordFilteredTeams.filter(t=>!recordActiveTeams.some(at=>at.name===t.name)); if(c.length===0)return; const p = c[Math.floor(Math.random()*c.length)]; setSelectedRegion(p.region); const list = recordFilteredTeams.filter(t=>t.region===p.region); setSelectedTeamIdx(list.findIndex(t=>t.name===p.name)); };
  
  const handleGenerateSchedule = async () => { if (recordActiveTeams.length < 2) return alert("최소 2팀"); let roundsArr: Round[] = []; if (recordActiveSeason?.type === 'LEAGUE') { let t = [...recordActiveTeams]; if(t.length%2!==0) t.push({ id:-1, seasonId:recordActiveSeasonId, name:'BYE', logo:'', category:'CLUB', region:'', ownerId:-1, ownerName:'-', win:0, draw:0, loss:0, points:0, winRate:'-', diff:0 }); const n=t.length, half=n/2; let idxs=t.map((_,i)=>i); for(let r=0; r<n-1; r++) { const matches: Match[] = []; for(let i=0; i<half; i++) { const t1=t[idxs[i]], t2=t[idxs[n-1-i]]; if(t1.id!==-1 && t2.id!==-1 && t1.ownerId!==t2.ownerId) matches.push({ id:`${Date.now()}-${Math.random()}`, seasonId:recordActiveSeasonId, home:t1.name, away:t2.name, homeLogo:t1.logo, awayLogo:t2.logo, homeOwner:t1.ownerName, awayOwner:t2.ownerName, homeScore:'0', awayScore:'0', homeScorers:[], awayScorers:[], homeAssists:[], awayAssists:[], status:'UPCOMING', youtubeUrl:'' }); } roundsArr.push({ round:r+1, matches, seasonId:recordActiveSeasonId }); idxs.splice(1, 0, idxs.pop()!); } if(recordActiveSeason.leagueMode==='DOUBLE') roundsArr=[...roundsArr, ...roundsArr.map(r=>({ round:r.round+n-1, seasonId:recordActiveSeasonId, matches:r.matches.map(m=>({...m, home:m.away, away:m.home, homeLogo:m.awayLogo, awayLogo:m.homeLogo, homeOwner:m.awayOwner, awayOwner:m.homeOwner, id:`${Date.now()}-${Math.random()}`})) }))]; } else { let shuffled = [...recordActiveTeams].sort(() => 0.5 - Math.random()); let powerOfTwo = 1; while(powerOfTwo < shuffled.length) powerOfTwo *= 2; while(shuffled.length < powerOfTwo) { shuffled.push({ id: -99, seasonId: recordActiveSeasonId, name: 'BYE', logo: 'https://placehold.co/100x100?text=BYE', category:'CLUB', region:'', ownerId: -99, ownerName: '-', win:0, draw:0, loss:0, points:0, winRate:'-', diff:0 }); } const matches: Match[] = []; const stageName = getStageName(powerOfTwo); for(let i=0; i<shuffled.length; i+=2) { const t1 = shuffled[i]; const t2 = shuffled[i+1]; let match: Match = { id: `${Date.now()}-${Math.random()}`, seasonId: recordActiveSeasonId, home: t1.name, away: t2.name, homeLogo: t1.logo, awayLogo: t2.logo, homeOwner: t1.ownerName, awayOwner: t2.ownerName, homeScore:'0', awayScore:'0', homeScorers:[], awayScorers:[], homeAssists:[], awayAssists:[], status: 'UPCOMING', stage: stageName, youtubeUrl: '' }; if (t1.name === 'BYE' || t2.name === 'BYE') { match.status = 'BYE'; if (t1.name === 'BYE') { match.home = t2.name; match.homeLogo = t2.logo; match.homeOwner = t2.ownerName; match.away = "부전승"; match.awayLogo = ""; match.awayOwner = "-"; } else { match.away = "부전승"; match.awayLogo = ""; match.awayOwner = "-"; } } matches.push(match); } roundsArr.push({ round: 1, matches, seasonId: recordActiveSeasonId, name: stageName }); } await updateDoc(doc(db, "seasons", String(recordActiveSeasonId)), { rounds: roundsArr }); };
  const handleRecordInputChange = useCallback((r:number,m:number,t:string,f:string,v:string)=>setRecordInputs(p=>({...p, [`${r}-${m}-${t}`]:{...(p[`${r}-${m}-${t}`]||{name:'',count:0}),[f]:v}})),[]);
  
  const addRecord = useCallback(async(rIdx:number,mIdx:number,type:any,name:string,count:number)=>{ 
    if(!name.trim())return; 
    const uR=recordActiveRounds.map(r=>{if(r.seasonId===recordActiveSeasonId&&r.round===recordActiveRounds[rIdx].round){return{...r,matches:r.matches.map((m,i)=>i===mIdx?{...m,[type]:[...( (m as any)[type] || [] ),{id:Date.now(),name,count:Number(count),teamLogo:type.startsWith('home')?m.homeLogo:m.awayLogo}]}:m)}}return r}); 
    uR.forEach(r=>r.matches.forEach(m=>{ if(type==='homeScorers') m.homeScore=String((m.homeScorers||[]).reduce((a,b)=>a+b.count,0)); if(type==='awayScorers') m.awayScore=String((m.awayScorers||[]).reduce((a,b)=>a+b.count,0)); })); 
    await updateDoc(doc(db,"seasons",String(recordActiveSeasonId)),{rounds:uR}); 
    setRecordInputs(p=>({...p,[`${rIdx}-${mIdx}-${type}`]:{name:'',count:0}})); 
  },[recordActiveSeasonId,recordActiveRounds,rounds]);

  const removeRecord=useCallback(async(rI:number,mI:number,t:any,id:number)=>{ const uR=recordActiveRounds.map(r=>{if(r.seasonId===recordActiveSeasonId&&r.round===recordActiveRounds[rI].round){return{...r,matches:r.matches.map((m,i)=>i===mI?{...m,[t]:((m as any)[t]||[]).filter((x:any)=>x.id!==id)}:m)}}return r}); uR.forEach(r=>r.matches.forEach(m=>{ if(t==='homeScorers') m.homeScore=String(m.homeScorers.reduce((a,b)=>a+b.count,0)); if(t==='awayScorers') m.awayScore=String(m.awayScorers.reduce((a,b)=>a+b.count,0)); })); await updateDoc(doc(db,"seasons",String(recordActiveSeasonId)),{rounds:uR}); },[recordActiveSeasonId,recordActiveRounds,rounds]);
  
  const handleMatchMetaChange = (rIdx: number, mIdx: number, field: string, value: string) => {
    const newRounds = [...rounds];
    const globalRoundIdx = rounds.findIndex(ro => ro.seasonId === recordActiveSeasonId && ro.round === recordActiveRounds[rIdx].round);
    if(globalRoundIdx === -1) return;
    newRounds[globalRoundIdx].matches[mIdx] = { ...newRounds[globalRoundIdx].matches[mIdx], [field]: value };
    setRounds(newRounds); 
  };

  const handleSaveMatch=async(rIdx:number,mIdx:number)=>{ 
    const currentRound = recordActiveRounds[rIdx];
    const match = currentRound.matches[mIdx];
    if (recordActiveSeason?.type === 'TOURNAMENT' && match.homeScore === match.awayScore) return alert("토너먼트에서는 무승부가 불가능합니다.");
    
    if(confirm(`[결과 확정]\n\n${match.home} (${match.homeScore}) vs (${match.awayScore}) ${match.away}\n\n저장하시겠습니까?`)){ 
      try {
        let updatedRounds = [...rounds];
        const globalRoundIdx = rounds.findIndex(ro => ro.seasonId === recordActiveSeasonId && ro.round === currentRound.round);
        updatedRounds[globalRoundIdx] = { ...updatedRounds[globalRoundIdx], matches: updatedRounds[globalRoundIdx].matches.map((ma, i) => i === mIdx ? { ...ma, status: 'FINISHED' } : ma) };
        if (recordActiveSeason?.type === 'TOURNAMENT') { 
            const thisRoundMatches = updatedRounds[globalRoundIdx].matches;
            const isRoundFinished = thisRoundMatches.every(m => m.status === 'FINISHED' || m.status === 'BYE');
            const nextRoundExists = rounds.some(ro => ro.seasonId === recordActiveSeasonId && ro.round === currentRound.round + 1);
            if (isRoundFinished && !nextRoundExists && thisRoundMatches.length > 1) {
                const winners: { name: string, logo: string, owner: string }[] = [];
                thisRoundMatches.forEach(m => {
                    if (m.status === 'BYE') { if (m.home !== 'BYE' && m.away === '부전승') winners.push({ name: m.home, logo: m.homeLogo, owner: m.homeOwner }); else if (m.away !== 'BYE' && m.home === '부전승') winners.push({ name: m.away, logo: m.awayLogo, owner: m.awayOwner }); } 
                    else { if (Number(m.homeScore) > Number(m.awayScore)) winners.push({ name: m.home, logo: m.homeLogo, owner: m.homeOwner }); else winners.push({ name: m.away, logo: m.awayLogo, owner: m.awayOwner }); }
                });
                if (winners.length > 0) {
                    const nextMatches: Match[] = [];
                    const nextStageName = getStageName(winners.length);
                    for (let i = 0; i < winners.length; i += 2) { const t1 = winners[i]; const t2 = winners[i+1]; if (t1 && t2) { nextMatches.push({ id: `${Date.now()}-${Math.random()}`, seasonId: recordActiveSeasonId, home: t1.name, away: t2.name, homeLogo: t1.logo, awayLogo: t2.logo, homeOwner: t1.owner, awayOwner: t2.owner, homeScore: '0', awayScore: '0', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'UPCOMING', stage: nextStageName, youtubeUrl: '' }); } }
                    updatedRounds.push({ round: currentRound.round + 1, matches: nextMatches, seasonId: recordActiveSeasonId, name: nextStageName });
                    alert(`🎉 [${nextStageName}] 대진표가 생성되었습니다!`);
                } else if (thisRoundMatches.length === 1) { alert(`🏆 우승: ${thisRoundMatches[0].homeScore > thisRoundMatches[0].awayScore ? thisRoundMatches[0].home : thisRoundMatches[0].away} !!`); }
            }
        }
        await updateDoc(doc(db, "seasons", String(recordActiveSeasonId)), { rounds: updatedRounds }); 
      } catch(e) { alert("저장 중 오류가 발생했습니다."); }
    }
  };

  // --- 🛠️ Team Manager Logic ---
  const handleSelectTeamForEdit = (team: MasterTeam) => { setEditTeamId(team.id || null); setManualTeam({ name: team.name, logo: team.logo, region: team.region, category: team.category as any }); manualFormRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  const handleSaveManualTeam = async () => { if (!manualTeam.name || !manualTeam.region) return alert("필수 입력!"); if (editTeamId) { await updateDoc(doc(db, "master_teams", editTeamId), { ...manualTeam, logo: manualTeam.logo || '⚽' }); setEditTeamId(null); alert("수정 완료!"); } else { await addDoc(collection(db, "master_teams"), { ...manualTeam, logo: manualTeam.logo || '⚽' }); alert("추가 완료!"); } setManualTeam({ name:'', logo:'', region:'', category:'CLUB' }); };
  const handleCancelEdit = () => { setEditTeamId(null); setManualTeam({ name:'', logo:'', region:'', category:'CLUB' }); };
  const handleDeleteMasterTeam = async (id: string) => { if(confirm("정말 삭제하시겠습니까?")) { await deleteDoc(doc(db, "master_teams", id)); handleCancelEdit(); } };
  const handleExcelUpload = async () => { if (!excelInput.trim()) return alert("내용 없음"); const rows = excelInput.trim().split('\n'); const batch = writeBatch(db); let count = 0; rows.forEach(row => { const cols = row.split('\t'); if (cols.length >= 3) { const [categoryInput, region, name, logo] = cols; const docRef = doc(collection(db, "master_teams")); batch.set(docRef, { category: (categoryInput?.trim() === 'NATIONAL' ? 'NATIONAL' : 'CLUB') as any, region: region?.trim() || 'Etc', name: name?.trim() || 'Unknown', logo: logo?.trim() || '⚽' }); count++; } }); if (count > 0) { await batch.commit(); alert(`✅ ${count}개 등록 완료!`); setExcelInput(''); } else { alert("형식 확인!"); } };

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans uppercase font-black italic tracking-tighter overflow-x-hidden pb-20">
      
      {/* 1. 상단 배너 (높이 1.5배 조정) */}
      <div className="w-full max-w-6xl mx-auto">
        <div className="w-full h-[225px] md:h-[330px] overflow-hidden border-b border-slate-800 relative shadow-2xl">
          <img src={RANKING_BANNER_IMG} className="w-full h-full object-cover opacity-80" alt="Banner" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent"></div>
          <div className="absolute bottom-4 left-4">
            <h1 className="text-3xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 font-black italic drop-shadow-lg">eFOOTBALL LEAGUE<sup className="text-sm align-top ml-1">TM</sup></h1>
            <p className="text-emerald-400 text-sm tracking-widest font-sans not-italic">Official Licensed Data</p>
          </div>
        </div>
      </div>

      {/* 2. 탭 네비게이션 */}
      <div className="flex justify-center mt-6 mb-8">
        <div className="flex bg-slate-900 border border-slate-700 p-1.5 rounded-2xl shadow-xl">
          {[{ id: 'RANKING', label: '🏆 랭킹', color: 'blue' }, { id: 'RECORD', label: '📝 기록실', color: 'emerald' }, { id: 'TEAMS', label: '⚙️ 팀 관리', color: 'red' }].map((tab) => (
            <button key={tab.id} onClick={() => setCurrentView(tab.id as any)} className={`px-4 md:px-8 py-2 md:py-3 rounded-xl text-xs md:text-sm transition-all duration-200 ${currentView === tab.id ? `bg-${tab.color}-600 text-white shadow-lg scale-105` : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* ==================================================================================== */}
        {/* VIEW 1: 랭킹 페이지 */}
        {/* ==================================================================================== */}
        {currentView === 'RANKING' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="flex justify-end">
              {/* 히스토리 탭에서는 시즌 선택 숨김 */}
              {rankingTab !== 'HISTORY' && (
                <select value={currentSeasonId} onChange={(e) => setCurrentSeasonId(Number(e.target.value))} className="bg-slate-900 text-white border border-slate-700 rounded-lg p-2 text-xs">
                  {seasons.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
                </select>
              )}
            </div>
            <div className="flex border-b border-slate-800">
              {['STANDINGS', 'SCHEDULE', 'HISTORY'].map(sub => (
                <button key={sub} onClick={() => setRankingTab(sub as any)} className={`px-6 py-3 text-sm border-b-2 transition-colors ${rankingTab === sub ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-600 hover:text-slate-400'}`}>{sub}</button>
              ))}
            </div>
            {rankingTab === 'STANDINGS' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <section className="bg-slate-900/40 rounded-3xl border border-slate-800 overflow-hidden"><div className="p-4 border-b border-slate-800 bg-slate-950/30"><h3 className="text-white text-lg">LEAGUE TABLE</h3></div><table className="w-full text-left text-[10px] md:text-xs"><thead className="text-slate-500 border-b border-slate-800 bg-slate-950/50"><tr><th className="p-3 text-center">#</th><th className="p-3">TEAM</th><th className="p-3 text-center">W-D-L</th><th className="p-3 text-center text-slate-400">W%</th><th className="p-3 text-center">PTS</th></tr></thead><tbody className="divide-y divide-slate-800/50">{computedActiveTeams.map((t, i) => (<tr key={t.id} className="hover:bg-slate-800/30"><td className="p-3 text-center text-slate-600">{i+1}</td><td className="p-3 flex items-center gap-2"><img src={t.logo} className="w-5 h-5"/><span>{t.name} <span className="text-slate-500 text-[9px]">({t.ownerName})</span></span></td><td className="p-3 text-center text-slate-400">{t.win}-{t.draw}-{t.loss}</td><td className="p-3 text-center text-slate-500">{t.winRate}%</td><td className="p-3 text-center font-bold text-blue-400 text-base">{t.points}</td></tr>))}</tbody></table></section>
                  <section className="bg-slate-900/40 rounded-3xl border border-slate-800 overflow-hidden"><div className="p-4 border-b border-slate-800 bg-slate-950/30"><h3 className="text-emerald-400 text-lg">OWNER RANKING</h3></div><table className="w-full text-left text-[10px] md:text-xs"><thead className="text-slate-500 border-b border-slate-800 bg-slate-950/50"><tr><th className="p-3 text-center">#</th><th className="p-3">OWNER</th><th className="p-3 text-center">W-D-L</th><th className="p-3 text-center text-slate-400">W%</th><th className="p-3 text-center">PTS</th></tr></thead><tbody className="divide-y divide-slate-800/50">{seasonOwners.map((o, i) => (<tr key={o.id} className="hover:bg-slate-800/30"><td className="p-3 text-center text-slate-600">{i+1}</td><td className="p-3 flex items-center gap-2"><img src={o.photo} className="w-5 h-5 rounded-full"/><span>{o.nickname}</span></td><td className="p-3 text-center text-slate-400">{o.win}-{o.draw}-{o.loss}</td><td className="p-3 text-center text-slate-500">{o.winRate}%</td><td className="p-3 text-center font-bold text-emerald-400 text-base">{o.points}</td></tr>))}</tbody></table></section>
                </div>
                <div className="bg-slate-900/40 rounded-3xl border border-slate-800 overflow-hidden shadow-xl"><div className="flex border-b border-slate-800"><button onClick={() => setStatsTab('GOALS')} className={`flex-1 py-3 text-sm font-black italic ${statsTab === 'GOALS' ? 'text-yellow-500 bg-yellow-500/10' : 'text-slate-500'}`}>SCORERS</button><button onClick={() => setStatsTab('ASSISTS')} className={`flex-1 py-3 text-sm font-black italic ${statsTab === 'ASSISTS' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500'}`}>ASSISTS</button></div><div className="p-3 min-h-[200px]">{(statsTab === 'GOALS' ? topScorers : topAssists).map((p, i) => (<div key={`${p.name}-${i}`} className="flex justify-between items-center p-3 border-b border-slate-800/50 font-black italic"><div className="flex items-center gap-3"><span className="text-lg text-slate-600 w-5 text-center">{i+1}</span><div className="flex items-center gap-2">{p.teamLogo && (<div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center bg-white border border-slate-600">{p.teamLogo.includes('http') ? <img src={p.teamLogo} className="w-full h-full object-cover" alt="" /> : <span className="text-xs">{p.teamLogo}</span>}</div>)}<div><p className="text-sm text-slate-200">{p.name}</p><p className="text-[9px] text-slate-500 font-sans not-italic">({p.ownerName})</p></div></div></div><span className={`text-lg italic ${statsTab === 'GOALS' ? 'text-yellow-500' : 'text-blue-400'}`}>{p.count}</span></div>))}</div></div>
              </div>
            )}
            {rankingTab === 'SCHEDULE' && (
              <div className="space-y-6">{activeRounds.map(r => (<div key={r.round} className="bg-slate-900/40 rounded-2xl border border-slate-800 p-4"><h4 className="text-blue-400 mb-3 text-sm">{r.name || `ROUND ${r.round}`}</h4><div className="grid gap-2">{r.matches.map(m => (<div key={m.id} className="bg-slate-950 p-3 rounded-xl flex flex-col gap-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2 w-1/3 justify-end text-right"><div className="text-right"><span className="text-xs md:text-sm truncate block">{m.home}</span><span className="text-[9px] text-slate-500">({m.homeOwner})</span></div><img src={m.homeLogo} className="w-6 h-6 bg-white rounded-full p-0.5"/></div><div className="px-2 font-mono text-lg font-bold text-slate-500">{m.status==='FINISHED' ? <span className="text-white">{m.homeScore}:{m.awayScore}</span> : 'VS'}</div><div className="flex items-center gap-2 w-1/3 justify-start text-left"><img src={m.awayLogo} className="w-6 h-6 bg-white rounded-full p-0.5"/><div className="text-left"><span className="text-xs md:text-sm truncate block">{m.away}</span><span className="text-[9px] text-slate-500">({m.awayOwner})</span></div></div></div>{m.status==='FINISHED'&&(m.homeScorers?.length>0||m.awayScorers?.length>0||m.homeAssists?.length>0||m.awayAssists?.length>0)&&(<div className="bg-slate-900/50 rounded-lg p-2 mt-1 grid grid-cols-2 gap-4 text-[9px] text-slate-400"><div className="text-right space-y-0.5">{m.homeScorers?.length>0&&<div>⚽ {m.homeScorers.map(s=>`${s.name}(${s.count})`).join(', ')}</div>}{m.homeAssists?.length>0&&<div>🎯 {m.homeAssists.map(s=>`${s.name}(${s.count})`).join(', ')}</div>}</div><div className="text-left space-y-0.5">{m.awayScorers?.length>0&&<div>⚽ {m.awayScorers.map(s=>`${s.name}(${s.count})`).join(', ')}</div>}{m.awayAssists?.length>0&&<div>🎯 {m.awayAssists.map(s=>`${s.name}(${s.count})`).join(', ')}</div>}</div></div>)}{m.youtubeUrl&&(<div className="flex justify-center border-t border-slate-800 pt-1.5"><a href={m.youtubeUrl} target="_blank" className="flex items-center gap-1 text-red-400 hover:text-red-300 text-[10px] font-bold"><span>📺</span> MATCH HIGHLIGHT</a></div>)}</div>))}</div></div>))}</div>
            )}
            {rankingTab === 'HISTORY' && (
              <div className="space-y-12 animate-in fade-in duration-300">
                <section className="bg-slate-900/40 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden border-t-4 border-emerald-500/50"><div className="p-4 bg-emerald-950/20 text-center border-b border-slate-800 leading-none"><h3 className="text-emerald-400 text-lg font-black italic uppercase">🏆 HALL OF FAME: OWNERS</h3></div><div className="px-1 pb-4"><table className="w-full text-left table-fixed italic font-black leading-none"><thead className="text-[10px] text-slate-500 bg-slate-950/50 border-b border-slate-800"><tr><th className="w-[10%] px-0.5 text-center py-3">#</th><th className="w-[35%] px-0.5">OWNER</th><th className="w-[25%] text-center">W-D-L</th><th className="w-[15%] text-center text-slate-400">W%</th><th className="w-[15%] text-right pr-2 text-emerald-400">PTS</th></tr></thead><tbody className="divide-y divide-slate-800/50">{historyOwners.map((o, idx) => (<tr key={idx} className="hover:bg-slate-800/30 transition-all font-black"><td className="px-0.5 py-4 text-center text-lg text-slate-600 italic">{idx + 1 === 1 ? '🥇' : idx + 1 === 2 ? '🥈' : idx + 1 === 3 ? '🥉' : idx + 1}</td><td className="px-0.5 py-4 flex items-center space-x-1.5"><img src={o.photo} className="w-8 h-8 rounded-full border-2 border-emerald-500/30 object-cover" /><div><p className="text-xs text-emerald-50 truncate tracking-tighter">{o.nickname}</p></div></td><td className="text-center text-slate-300 text-[10px] font-mono whitespace-nowrap tracking-tighter"><span className="text-white">{o.win}</span>-<span className="text-slate-500">{o.draw}</span>-<span className="text-red-400">{o.loss}</span></td><td className="text-center text-slate-400 text-[10px] font-mono">{o.winRate}%</td><td className="text-right pr-4 text-2xl text-emerald-400 italic">{o.points}</td></tr>))}</tbody></table></div></section>
                <section className="bg-slate-900/40 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden border-t-4 border-indigo-500/50"><div className="p-4 bg-indigo-950/20 text-center border-b border-slate-800 leading-none"><h3 className="text-indigo-400 text-lg font-black italic uppercase">🌍 HALL OF FAME: TEAMS</h3></div><div className="px-1 pb-4"><table className="w-full text-left table-fixed italic font-black leading-none"><thead className="text-[10px] text-slate-500 bg-slate-950/50 border-b border-slate-800"><tr><th className="w-[10%] px-0.5 text-center py-3">#</th><th className="w-[35%] px-0.5">TEAM</th><th className="w-[25%] text-center">W-D-L</th><th className="w-[15%] text-center text-slate-400">W%</th><th className="w-[15%] text-right pr-2 text-indigo-400">PTS</th></tr></thead><tbody className="divide-y divide-slate-800/50">{historyTeams.map((t, idx) => (<tr key={idx} className="hover:bg-slate-800/30 transition-all font-black"><td className="px-0.5 py-4 text-center text-lg text-slate-600 italic">{idx + 1 === 1 ? '🥇' : idx + 1 === 2 ? '🥈' : idx + 1 === 3 ? '🥉' : idx + 1}</td><td className="px-0.5 py-4 flex items-center space-x-1.5 overflow-hidden"><div className="w-8 h-8 bg-white rounded-full flex items-center justify-center p-0.5 border border-slate-700 shrink-0 overflow-hidden">{t.logo.includes('http') ? <img src={t.logo} className="w-full h-full object-contain" /> : <span className="text-[10px]">{t.logo}</span>}</div><div className="min-w-0"><p className="text-xs text-indigo-50 truncate tracking-tighter">{t.name}</p><p className="text-[9px] text-slate-500 font-sans not-italic truncate tracking-tighter">({t.ownerName})</p></div></td><td className="text-center text-slate-300 text-[10px] font-mono whitespace-nowrap tracking-tighter"><span className="text-white">{t.win}</span>-<span className="text-slate-500">{t.draw}</span>-<span className="text-red-400">{t.loss}</span></td><td className="text-center text-slate-400 text-[10px] font-mono">{t.winRate}%</td><td className="text-right pr-2 text-xl text-indigo-400 italic">{t.points}</td></tr>))}</tbody></table></div></section>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <section className="bg-slate-900/40 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden border-t-4 border-yellow-500/50"><div className="p-4 bg-yellow-950/20 text-center border-b border-slate-800 leading-none"><h3 className="text-yellow-500 text-lg font-black italic uppercase">👟 ALL-TIME SCORERS</h3></div><div className="p-2">{allTimeScorers.slice(0, 10).map((p, i) => (<div key={`${p.name}-${i}`} className="flex justify-between items-center p-3 border-b border-slate-800/30 last:border-0"><div className="flex items-center gap-3"><span className={`text-lg w-6 text-center font-black italic ${i < 3 ? 'text-yellow-400' : 'text-slate-600'}`}>{i + 1}</span><div className="flex items-center gap-2">{p.teamLogo && (<div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-white border border-slate-600">{p.teamLogo.includes('http') ? <img src={p.teamLogo} className="w-full h-full object-cover" alt="" /> : <span className="text-[9px] text-black font-bold">{p.teamLogo}</span>}</div>)}<div><p className="text-sm text-slate-200 font-black italic">{p.name}</p><p className="text-[9px] text-slate-500 font-sans not-italic">({p.ownerName})</p></div></div></div><span className="text-xl text-yellow-500 font-black italic">{p.count}</span></div>))}</div></section>
                  <section className="bg-slate-900/40 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden border-t-4 border-blue-500/50"><div className="p-4 bg-blue-950/20 text-center border-b border-slate-800 leading-none"><h3 className="text-blue-400 text-lg font-black italic uppercase">🎯 ALL-TIME ASSISTS</h3></div><div className="p-2">{allTimeAssists.slice(0, 10).map((p, i) => (<div key={`${p.name}-${i}`} className="flex justify-between items-center p-3 border-b border-slate-800/30 last:border-0"><div className="flex items-center gap-3"><span className={`text-lg w-6 text-center font-black italic ${i < 3 ? 'text-blue-400' : 'text-slate-600'}`}>{i + 1}</span><div className="flex items-center gap-2">{p.teamLogo && (<div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-white border border-slate-600">{p.teamLogo.includes('http') ? <img src={p.teamLogo} className="w-full h-full object-cover" alt="" /> : <span className="text-[9px] text-black font-bold">{p.teamLogo}</span>}</div>)}<div><p className="text-sm text-slate-200 font-black italic">{p.name}</p><p className="text-[9px] text-slate-500 font-sans not-italic">({p.ownerName})</p></div></div></div><span className="text-xl text-blue-400 font-black italic">{p.count}</span></div>))}</div></section>
                </div>
              </div>
            )}
            
            {/* 🔥 [NEW] 유튜브 하이라이트 섹션 (랭킹 탭 하단) */}
            {currentView === 'RANKING' && (
              <section className="mt-12 animate-in fade-in slide-in-from-bottom-8 duration-500">
                <div className="flex items-center justify-center mb-6">
                  <h3 className="text-red-500 text-xl font-black italic uppercase tracking-widest border-b-2 border-red-600 pb-2">▶ MATCH HIGHLIGHTS</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeRounds.flatMap(r => r.matches).filter(m => m.youtubeUrl && getYoutubeId(m.youtubeUrl)).map(m => {
                    const vid = getYoutubeId(m.youtubeUrl!);
                    return (
                      <a key={m.id} href={m.youtubeUrl} target="_blank" className="block bg-slate-900 rounded-2xl overflow-hidden group hover:ring-2 hover:ring-red-600 transition-all shadow-xl">
                        <div className="relative aspect-video">
                          <img src={`https://img.youtube.com/vi/${vid}/hqdefault.jpg`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="thumbnail" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 bg-red-600/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform text-white text-xl pl-1">▶</div>
                          </div>
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded">HIGHLIGHT</div>
                        </div>
                        <div className="p-4 flex gap-3 items-center">
                          <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border border-slate-700 flex items-center justify-center shrink-0">
                            {m.homeLogo.includes('http') ? <img src={m.homeLogo} className="w-full h-full object-cover" alt="" /> : <span className="text-xs">{m.homeLogo}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-bold truncate">{m.home} vs {m.away}</p>
                            <p className="text-slate-500 text-xs truncate">{m.stage || `Round ${activeRounds.find(r=>r.matches.includes(m))?.round}`} • {m.homeOwner} vs {m.awayOwner}</p>
                          </div>
                        </div>
                      </a>
                    )
                  })}
                  {activeRounds.flatMap(r => r.matches).filter(m => m.youtubeUrl).length === 0 && <div className="col-span-full text-center text-slate-600 text-xs py-10">등록된 하이라이트 영상이 없습니다.</div>}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ==================================================================================== */}
        {/* VIEW 2: 기록 페이지 (RECORD) */}
        {/* ==================================================================================== */}
        {currentView === 'RECORD' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* 🔥 [NEW] 시즌 선택 탭 바 */}
            <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-800 pb-2 overflow-x-auto">
              <button onClick={() => setRecordTab('NEW')} className={`px-4 py-2 rounded-t-xl text-xs font-black italic transition-all ${recordTab === 'NEW' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500 hover:text-white'}`}>➕ 신규 생성 / 관리</button>
              {seasons.map(s => (
                <button key={s.id} onClick={() => setRecordTab(s.id)} className={`px-4 py-2 rounded-t-xl text-xs font-black italic transition-all ${recordTab === s.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500 hover:text-white'}`}>🏆 {s.name}</button>
              ))}
            </div>

            {/* 🅰️ 신규 생성 모드 */}
            {recordTab === 'NEW' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in zoom-in duration-300">
                <section className="bg-slate-900/60 p-6 rounded-3xl border border-emerald-900/50">
                  <h3 className="text-emerald-400 mb-4 border-b border-slate-800 pb-2">1. NEW SEASON</h3>
                  <div className="flex gap-2 mb-2 font-sans not-italic">
                    <input type="text" value={inputSeasonName} onChange={(e)=>setInputSeasonName(e.target.value)} placeholder="새 시즌 이름 (예: 2026 Season 1)" className="bg-slate-950 text-white text-xs p-3 rounded-xl w-full border border-slate-800"/>
                    <select value={inputSeasonType} onChange={(e)=>setInputSeasonType(e.target.value as any)} className="bg-slate-950 text-white text-xs p-3 rounded-xl border border-slate-800"><option value="LEAGUE">리그</option><option value="TOURNAMENT">토너먼트</option></select>
                  </div>
                  <button onClick={handleCreateSeason} className="w-full bg-emerald-600 text-white text-xs py-3 rounded-xl font-bold hover:bg-emerald-500 transition-colors">새 시즌 생성</button>
                  
                  {/* 🔥 [NEW] 시즌 삭제 콤보박스 */}
                  <div className="pt-4 border-t border-slate-800 mt-4">
                    <p className="text-[10px] text-slate-500 mb-2 font-bold">⚠️ DELETE EXISTING SEASON</p>
                    <div className="flex gap-2 font-sans not-italic">
                      <select value={seasonToDeleteId} onChange={(e) => setSeasonToDeleteId(e.target.value)} className="bg-slate-950 text-white text-xs p-2 rounded-xl border border-slate-800 flex-1">
                        <option value="">삭제할 시즌 선택...</option>
                        {seasons.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
                      </select>
                      <button onClick={handleDeleteSelectedSeason} className="bg-red-900/50 text-red-400 border border-red-800 px-4 rounded-xl text-xs font-bold hover:bg-red-900">DELETE</button>
                    </div>
                  </div>
                </section>

                <section className="bg-slate-800/80 p-6 rounded-3xl border-2 border-blue-500/50 shadow-2xl">
                  <h3 className="text-blue-400 text-lg mb-4 border-b border-slate-700 pb-2 flex items-center gap-2"><span>2. OWNER REGISTRATION</span><span className="text-xs text-slate-400 font-sans not-italic ml-auto">선수 등록</span></h3>
                  <div className="flex flex-col gap-2 mb-4 font-sans not-italic">
                    <input type="text" value={inputOwnerName} onChange={(e)=>setInputOwnerName(e.target.value)} placeholder="닉네임 (필수)" className="bg-slate-950 text-white text-sm p-3 rounded-xl w-full border border-slate-700 focus:border-blue-500 outline-none"/>
                    <input type="text" value={inputOwnerPhoto} onChange={(e)=>setInputOwnerPhoto(e.target.value)} placeholder="이미지 URL (비우면 랜덤 생성)" className="bg-slate-950 text-white text-xs p-3 rounded-xl w-full border border-slate-700 focus:border-blue-500 outline-none text-slate-400"/>
                  </div>
                  <button onClick={handleAddOwner} className="w-full bg-blue-600 text-white text-sm py-3 rounded-xl font-bold hover:bg-blue-500 transition-colors shadow-lg">오너 등록 (ADD)</button>
                  <div className="mt-6 grid grid-cols-3 md:grid-cols-4 gap-3">
                    {owners.map(o => (
                      <div key={o.id} className="relative bg-slate-900 border border-slate-700 rounded-xl p-2 flex flex-col items-center gap-2 group hover:border-blue-500 transition-all">
                        <img src={o.photo} className="w-12 h-12 rounded-full object-cover bg-slate-800 border-2 border-slate-600" alt="avatar"/>
                        <span className="text-[10px] text-slate-300 font-bold truncate w-full text-center">{o.nickname}</span>
                        <button onClick={() => handleDeleteOwner(o.docId!, o.id)} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:scale-110">×</button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* 🅱️ 개별 시즌 관리 모드 */}
            {recordTab !== 'NEW' && recordActiveSeason && (
              <div className="animate-in fade-in slide-in-from-right-8 duration-300 space-y-8">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-2xl font-black italic text-blue-400">{recordActiveSeason.name} <span className="text-sm text-slate-500 not-italic font-normal">({recordActiveSeason.type})</span></h2>
                    <p className="text-xs text-slate-500 mt-1">참가 팀: {recordActiveTeams.length}팀 / 진행: {recordActiveRounds.length}라운드</p>
                  </div>
                  <button onClick={handleDeleteSeason} className="bg-red-900/30 text-red-500 border border-red-900/50 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-900 hover:text-white transition-colors">⚠️ 시즌 삭제</button>
                </div>

                <section className="bg-slate-900/60 p-5 rounded-3xl border border-slate-700">
                    <h3 className="text-white mb-4 border-b border-slate-800 pb-2">팀 등록 및 스케쥴</h3>
                    <div className="flex flex-col md:flex-row gap-2 mb-4 font-sans not-italic">
                      <select value={selectedOwnerId} onChange={(e)=>setSelectedOwnerId(Number(e.target.value))} className="bg-slate-950 text-white text-xs p-2 rounded border border-slate-800 flex-1"><option value="">오너 선택</option>{owners.map(o=><option key={o.id} value={o.id}>{o.nickname}</option>)}</select>
                      <select value={selectedCategory} onChange={(e)=>setSelectedCategory(e.target.value as any)} className="bg-slate-950 text-white text-xs p-2 rounded border border-slate-800 w-24"><option value="CLUB">CLUB</option><option value="NATIONAL">NATIONAL</option></select>
                      <select value={selectedRegion} onChange={(e)=>setSelectedRegion(e.target.value)} className="bg-slate-950 text-white text-xs p-2 rounded border border-slate-800 flex-1">{recordAvailableRegions.map(r=><option key={r} value={r}>{r}</option>)}</select>
                      <button onClick={handleRandomRegion} className="bg-slate-800 text-[10px] px-2 rounded border border-slate-700">🎲</button>
                      <select value={selectedTeamIdx} onChange={(e)=>setSelectedTeamIdx(Number(e.target.value))} className="bg-slate-950 text-white text-xs p-2 rounded border border-slate-800 flex-[2]">{recordCurrentTeamList.map((t,i)=><option key={t.id} value={i}>{t.name}</option>)}</select>
                      <button onClick={handleRandomTeam} className="bg-slate-800 text-[10px] px-2 rounded border border-slate-700">🎲</button>
                      <button onClick={handleAddTeam} className="bg-white text-black text-xs px-4 rounded font-bold hover:bg-slate-200">등록</button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4 p-3 bg-slate-950 rounded-xl min-h-[50px]">
                      {recordActiveTeams.map(t=>(<span key={t.id} onClick={()=>removeTeam(t.id)} className="text-[10px] bg-slate-800 px-2 py-1 rounded flex items-center gap-1 cursor-pointer hover:bg-red-900 border border-slate-700"><img src={t.logo} className="w-4 h-4 bg-white rounded-full object-contain"/>{t.name}<span className="text-slate-500">({t.ownerName})</span></span>))}
                      {recordActiveTeams.length===0 && <span className="text-slate-600 text-xs flex items-center justify-center w-full h-full">등록된 팀이 없습니다.</span>}
                    </div>
                    <button onClick={handleGenerateSchedule} className="w-full bg-yellow-600 text-black text-xs py-3 rounded-xl font-bold hover:bg-yellow-500 shadow-lg">대진표 생성 (GENERATE SCHEDULE)</button>
                </section>

                <div className="space-y-4">
                  {recordActiveRounds.map((r, rIdx) => (
                    <div key={r.round} className="space-y-2">
                        <p className="text-xs text-blue-400 font-bold">{r.name || `ROUND ${r.round}`}</p>
                        {r.matches.map((m, mIdx) => (
                          <div key={m.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-md">
                            {m.status==='BYE' ? <div className="text-center text-slate-600 text-xs py-2">BYE - {m.home}</div> : (
                              <>
                                <div className="flex justify-between items-center mb-4">
                                  <div className="text-center w-1/3"><img src={m.homeLogo} className="w-10 h-10 mx-auto bg-white rounded-full p-0.5 mb-1 object-contain"/><p className="text-xs font-bold text-slate-300">{m.home}</p><p className="text-[9px] text-slate-500">{m.homeOwner}</p></div>
                                  <div className="flex flex-col items-center"><span className="text-2xl font-black italic tracking-widest text-white">{m.homeScore} : {m.awayScore}</span><span className={`text-[10px] px-2 py-0.5 rounded-full mt-1 ${m.status==='FINISHED'?'bg-blue-900 text-blue-300':'bg-slate-800 text-slate-500'}`}>{m.status}</span></div>
                                  <div className="text-center w-1/3"><img src={m.awayLogo} className="w-10 h-10 mx-auto bg-white rounded-full p-0.5 mb-1 object-contain"/><p className="text-xs font-bold text-slate-300">{m.away}</p><p className="text-[9px] text-slate-500">{m.awayOwner}</p></div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mb-2 font-sans not-italic">
                                  <RecordInput rIdx={rIdx} mIdx={mIdx} type="homeScorers" label="HOME GOAL" inputValue={recordInputs[`${rIdx}-${mIdx}-homeScorers`]||{name:'',count:0}} onInputChange={handleRecordInputChange} onAdd={addRecord} onRemove={removeRecord} records={m.homeScorers} />
                                  <RecordInput rIdx={rIdx} mIdx={mIdx} type="awayScorers" label="AWAY GOAL" inputValue={recordInputs[`${rIdx}-${mIdx}-awayScorers`]||{name:'',count:0}} onInputChange={handleRecordInputChange} onAdd={addRecord} onRemove={removeRecord} records={m.awayScorers} />
                                  {/* 🔥 [어시스트 복구] */}
                                  <RecordInput rIdx={rIdx} mIdx={mIdx} type="homeAssists" label="HOME ASSIST" inputValue={recordInputs[`${rIdx}-${mIdx}-homeAssists`]||{name:'',count:0}} onInputChange={handleRecordInputChange} onAdd={addRecord} onRemove={removeRecord} records={m.homeAssists} />
                                  <RecordInput rIdx={rIdx} mIdx={mIdx} type="awayAssists" label="AWAY ASSIST" inputValue={recordInputs[`${rIdx}-${mIdx}-awayAssists`]||{name:'',count:0}} onInputChange={handleRecordInputChange} onAdd={addRecord} onRemove={removeRecord} records={m.awayAssists} />
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-900 flex gap-2">
                                  <input type="text" value={m.youtubeUrl || ''} onChange={(e) => handleMatchMetaChange(rIdx, mIdx, 'youtubeUrl', e.target.value)} placeholder="YouTube URL 붙여넣기" className="flex-1 bg-slate-900 text-white text-[10px] p-2 rounded border border-slate-800 focus:border-red-600 outline-none text-blue-400 font-sans"/>
                                  <button onClick={()=>handleSaveMatch(rIdx, mIdx)} className={`px-4 py-1 text-[10px] rounded font-bold transition-colors shrink-0 ${m.status==='FINISHED'?'bg-slate-800 text-slate-400 hover:bg-slate-700':'bg-blue-600 text-white hover:bg-blue-500'}`}>{m.status==='FINISHED'?'수정':'확정'}</button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                    </div>
                  ))}
                  {recordActiveRounds.length === 0 && <div className="text-center py-10 text-slate-500 text-xs">아직 생성된 스케쥴이 없습니다.</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================================== */}
        {/* VIEW 3: 팀 관리 페이지 (TEAMS) */}
        {/* ==================================================================================== */}
        {currentView === 'TEAMS' && (
          <div className="space-y-8 animate-in fade-in duration-500 font-black italic">
            {/* 1. 팀 목록 */}
            <section className="bg-slate-900/60 p-6 rounded-3xl border border-slate-700">
              <h3 className="text-lg text-white border-b border-slate-800 pb-2 flex justify-between items-center">
                <span>1. REGISTERED TEAMS</span>
                <span className="text-xs text-slate-500 font-sans not-italic">Total: {masterTeams.length}</span>
              </h3>
              
              <div className="flex flex-col gap-2 mt-4 mb-4 font-sans not-italic">
                <div className="flex gap-2">
                  <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                    <button onClick={() => { setManageTab('CLUB'); setManageRegionFilter('ALL'); }} className={`px-4 py-1 text-xs rounded transition-colors ${manageTab==='CLUB'?'bg-blue-600 text-white':'text-slate-500'}`}>CLUB</button>
                    <button onClick={() => { setManageTab('NATIONAL'); setManageRegionFilter('ALL'); }} className={`px-4 py-1 text-xs rounded transition-colors ${manageTab==='NATIONAL'?'bg-red-600 text-white':'text-slate-500'}`}>NATIONAL</button>
                  </div>
                  <select value={manageRegionFilter} onChange={(e) => setManageRegionFilter(e.target.value)} className="bg-slate-950 text-white text-xs p-2 rounded-lg border border-slate-800 flex-1">
                    <option value="ALL">ALL REGIONS</option>
                    {manageAvailableRegions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <input type="text" value={manageSearchQuery} onChange={(e)=>setManageSearchQuery(e.target.value)} placeholder="🔍 팀 이름 검색..." className="bg-slate-950 text-white text-xs p-3 rounded-lg border border-slate-800 w-full focus:border-blue-500 outline-none"/>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[300px] overflow-y-auto p-1">
                {manageDisplayTeams.map(t => (
                  <div key={t.id} onClick={() => handleSelectTeamForEdit(t)} className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all hover:bg-slate-800 ${editTeamId === t.id ? 'bg-blue-900/50 border-blue-500 ring-2 ring-blue-500' : 'bg-slate-950 border-slate-800'}`}>
                    <div className="flex items-center gap-2 overflow-hidden">
                      <img src={t.logo} className="w-6 h-6 bg-white rounded-full p-0.5 object-contain flex-shrink-0" alt=""/>
                      <div className="min-w-0">
                        <p className="text-[10px] text-white truncate">{t.name}</p>
                        <p className="text-[9px] text-slate-500 truncate font-sans not-italic">{t.region}</p>
                      </div>
                    </div>
                    {editTeamId === t.id && <span className="text-[10px] text-blue-300 font-bold">EDIT</span>}
                  </div>
                ))}
              </div>
            </section>

            {/* 2. 개별 수동 등록 및 수정 창 */}
            <section ref={manualFormRef} className={`p-6 rounded-3xl border transition-colors duration-300 ${editTeamId ? 'bg-blue-900/20 border-blue-500' : 'bg-slate-900/60 border-slate-700'}`}>
              <h3 className={`text-lg border-b pb-2 flex justify-between ${editTeamId ? 'text-blue-400 border-blue-500' : 'text-emerald-400 border-slate-800'}`}>
                <span>{editTeamId ? `2. EDIT TEAM : ${manualTeam.name}` : '2. ADD NEW TEAM'}</span>
                {editTeamId && <button onClick={handleCancelEdit} className="text-xs text-slate-400 underline hover:text-white">CANCEL EDIT</button>}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4 font-sans not-italic">
                <select value={manualTeam.category} onChange={(e)=>setManualTeam({...manualTeam, category:e.target.value})} className="bg-slate-950 text-white text-xs p-3 rounded-xl border border-slate-800"><option value="CLUB">CLUB</option><option value="NATIONAL">NATIONAL</option></select>
                <input type="text" value={manualTeam.region} onChange={(e)=>setManualTeam({...manualTeam, region:e.target.value})} placeholder="지역 (예: Premier League)" className="bg-slate-950 text-white text-xs p-3 rounded-xl border border-slate-800"/>
                <input type="text" value={manualTeam.name} onChange={(e)=>setManualTeam({...manualTeam, name:e.target.value})} placeholder="팀 이름" className="bg-slate-950 text-white text-xs p-3 rounded-xl border border-slate-800"/>
                <input type="text" value={manualTeam.logo} onChange={(e)=>setManualTeam({...manualTeam, logo:e.target.value})} placeholder="로고 URL" className="bg-slate-950 text-white text-xs p-3 rounded-xl border border-slate-800"/>
              </div>
              
              <div className="flex gap-2 mt-4">
                <button onClick={handleSaveManualTeam} className={`flex-1 py-3 rounded-xl font-bold text-sm text-white transition-colors ${editTeamId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{editTeamId ? 'UPDATE TEAM INFO' : 'ADD TEAM'}</button>
                {editTeamId && (<button onClick={() => handleDeleteMasterTeam(editTeamId)} className="w-24 bg-red-900/50 text-red-400 border border-red-800 py-3 rounded-xl font-bold text-xs hover:bg-red-900">DELETE</button>)}
              </div>
            </section>

            {/* 3. 엑셀 일괄 업로드 */}
            <section className="bg-slate-900/60 p-6 rounded-3xl border border-slate-700">
              <h3 className="text-lg text-slate-400 border-b border-slate-800 pb-2">3. 엑셀 일괄 업로드 (BULK UPLOAD)</h3>
              <p className="text-[10px] text-slate-500 mt-2 mb-2 font-sans not-italic">
                엑셀에서 <strong>[분류] [지역] [팀명] [로고URL]</strong> 순서로 복사(Ctrl+C) 후 붙여넣기(Ctrl+V) 하세요.
              </p>
              <textarea 
                value={excelInput} 
                onChange={(e) => setExcelInput(e.target.value)} 
                placeholder={`예시:\nCLUB\tPremier League\tMan City\thttps://...\nNATIONAL\tEurope\tFrance\thttps://...`}
                className="w-full h-24 bg-slate-950 text-slate-300 text-xs p-3 rounded-xl border border-slate-800 resize-none font-mono focus:border-emerald-500 outline-none"
              />
              <button onClick={handleExcelUpload} className="w-full mt-3 bg-slate-800 text-slate-300 py-3 rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors">
                업로드 실행
              </button>
            </section>

          </div>
        )}

      </main>
    </div>
  );
}