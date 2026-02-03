/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; 
import { updateDoc, doc, deleteDoc } from 'firebase/firestore'; // deleteDoc 추가
import { Season, Owner, League, MasterTeam, Team, Banner } from '../types'; // Banner 추가
import { AdminLeagueManager, AdminTeamManager } from './AdminTeamManagement'; 
import { AdminBannerManager } from './AdminBannerManager'; 
import { generateRoundsLogic } from '../utils/scheduler';
import { getSortedLeagues, getSortedTeamsLogic, getTierBadgeColor } from '../utils/helpers';

interface AdminViewProps {
  adminTab: number | 'NEW' | 'OWNER' | 'BANNER' | 'LEAGUES' | 'TEAMS';
  setAdminTab: (tab: any) => void;
  seasons: Season[];
  owners: Owner[];
  leagues: League[];
  masterTeams: MasterTeam[];
  // 👇 banners props 추가
  banners: Banner[];
  onAdminLogin: (pw: string) => boolean;
  onCreateSeason: (name: string, type: string, mode: string, prize: number, prizesObj: any) => void;
  onSaveOwner: (name: string, photo: string, editId: string | null) => void;
  onNavigateToSchedule: (seasonId: number) => void;
}

const formatNumber = (num: number) => num.toLocaleString();
const parseNumber = (str: string) => Number(str.replace(/,/g, ''));

export const AdminView = ({ 
  adminTab, setAdminTab, seasons, owners, leagues, masterTeams, banners,
  onAdminLogin, onCreateSeason, onSaveOwner, onNavigateToSchedule
}: AdminViewProps) => {
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPwInput, setAdminPwInput] = useState('');
  
  // ... (기존 State 생략)
  const [inputSeasonName, setInputSeasonName] = useState('');
  const [inputSeasonType, setInputSeasonType] = useState('LEAGUE');
  const [inputLeagueMode, setInputLeagueMode] = useState('SINGLE');
  const [inputTotalPrize, setInputTotalPrize] = useState(100000);
  const [displayPrize, setDisplayPrize] = useState('100,000');
  const [prizes, setPrizes] = useState({ first: 45000, second: 25000, third: 10000, scorer: 10000, assist: 10000 });
  const [isAutoPrize, setIsAutoPrize] = useState(true);

  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPhoto, setNewOwnerPhoto] = useState('');
  const [editOwnerId, setEditOwnerId] = useState<string | null>(null);

  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [selectedMasterTeamId, setSelectedMasterTeamId] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL'); 
  const [filterLeague, setFilterLeague] = useState('ALL');
  const [searchTeam, setSearchTeam] = useState('');

  // ... (로그인 및 useEffect 로직 유지)
  useEffect(() => {
    const loginTime = localStorage.getItem('adminLoginTime');
    if (loginTime && Date.now() - Number(loginTime) < 3 * 60 * 60 * 1000) setAdminUnlocked(true);
  }, []);

  const handleLogin = () => {
      if (onAdminLogin(adminPwInput)) {
          setAdminUnlocked(true);
          localStorage.setItem('adminLoginTime', String(Date.now())); 
          setAdminPwInput('');
      } else alert("비밀번호가 일치하지 않습니다.");
  };

  const handlePrizeChange = (val: string) => {
      const num = parseNumber(val);
      if (!isNaN(num)) { setInputTotalPrize(num); setDisplayPrize(formatNumber(num)); } 
      else if (val === '') { setInputTotalPrize(0); setDisplayPrize(''); }
  };

  useEffect(() => {
      if (isAutoPrize) {
          setPrizes({ 
            first: Math.floor(inputTotalPrize * 0.45), second: Math.floor(inputTotalPrize * 0.25), third: Math.floor(inputTotalPrize * 0.10), 
            scorer: Math.floor(inputTotalPrize * 0.10), assist: Math.floor(inputTotalPrize * 0.10) 
          });
      }
  }, [inputTotalPrize, isAutoPrize]);

  // 🔥 [추가] 랜덤 팀 선택 로직
  const handleRandomTeam = (seasonId: number) => {
      const season = seasons.find(s => s.id === seasonId);
      if (!season) return;

      // 1. 현재 필터링 조건에 맞는 팀들 가져오기
      let candidates = masterTeams;
      if (filterCategory !== 'ALL') candidates = candidates.filter(t => filterCategory === 'CLUB' ? t.category !== 'NATIONAL' : t.category === 'NATIONAL');
      if (filterLeague !== 'ALL') candidates = candidates.filter(t => t.region === filterLeague);

      // 2. 이미 시즌에 배정된 팀 제외
      const assignedNames = new Set(season.teams?.map(t => t.name) || []);
      candidates = candidates.filter(t => !assignedNames.has(t.name));

      if (candidates.length === 0) return alert("조건에 맞는 남은 팀이 없습니다.");

      // 3. 랜덤 픽
      const randomTeam = candidates[Math.floor(Math.random() * candidates.length)];
      setSelectedMasterTeamId(String(randomTeam.id)); // 선택값 반영
  };

  const handleAddTeamToSeason = async (seasonId: number) => {
      if (!selectedOwnerId || !selectedMasterTeamId) return alert("오너와 팀을 선택하세요.");
      const season = seasons.find(s => s.id === seasonId);
      if (!season) return;
      const owner = owners.find(o => String(o.id) === selectedOwnerId);
      const mTeam = masterTeams.find(t => String(t.id) === selectedMasterTeamId);
      if (!owner || !mTeam) return;
      const newTeam: Team = {
          id: Date.now(), seasonId, name: mTeam.name, logo: mTeam.logo, ownerName: owner.nickname,
          region: mTeam.region, tier: mTeam.tier, win: 0, draw: 0, loss: 0, points: 0, gf: 0, ga: 0, gd: 0
      };
      const updatedTeams = [...(season.teams || []), newTeam];
      await updateDoc(doc(db, "seasons", String(seasonId)), { teams: updatedTeams });
      // alert(`${mTeam.name} 팀이 추가되었습니다.`); // 알림 생략 (빠른 추가 위해)
  };

  const handleRemoveTeamFromSeason = async (seasonId: number, teamId: number, teamName: string) => {
      if (!confirm(`정말 '${teamName}' 팀을 삭제하시겠습니까?`)) return;
      const season = seasons.find(s => s.id === seasonId);
      if (!season) return;
      const updatedTeams = season.teams.filter(t => t.id !== teamId);
      let updatedRounds = season.rounds ? [...season.rounds] : [];
      if (updatedRounds.length > 0) {
          updatedRounds = updatedRounds.map(r => ({
              ...r, matches: r.matches.filter(m => m.home !== teamName && m.away !== teamName)
          })).filter(r => r.matches.length > 0); 
      }
      await updateDoc(doc(db, "seasons", String(seasonId)), { teams: updatedTeams, rounds: updatedRounds });
  };

  const handleGenerateSchedule = async (seasonId: number, isRegenerate = false) => {
      const season = seasons.find(s => s.id === seasonId);
      if (!season || season.teams.length < 2) return alert("최소 2팀 이상 필요합니다.");
      if (isRegenerate && !confirm("기존 스케줄을 삭제하고 다시 생성하시겠습니까?")) return;
      const rounds = generateRoundsLogic(season);
      await updateDoc(doc(db, "seasons", String(seasonId)), { rounds });
      if (confirm("스케줄이 생성 되었습니다. 해당 스케줄로 이동할까요?")) onNavigateToSchedule(seasonId);
  };

  // 🔥 [추가] 시즌 삭제
  const handleDeleteSeason = async (seasonId: number) => {
      if (!confirm("시즌을 삭제할 경우, 모든 경기 기록과 스케쥴이 삭제가 됩니다. 삭제 하시겠습니까?")) return;
      await deleteDoc(doc(db, "seasons", String(seasonId)));
      setAdminTab('NEW');
      alert("시즌이 삭제되었습니다.");
  };

  const handleDeleteSchedule = async (seasonId: number) => {
      if (!confirm("해당 시즌의 스케줄만 삭제하시겠습니까?")) return;
      await updateDoc(doc(db, "seasons", String(seasonId)), { rounds: [] });
      alert("스케줄이 삭제되었습니다.");
  };

  if (!adminUnlocked) {
      return (
         <div className="flex flex-col items-center justify-center py-20 space-y-4">
             <div className="text-4xl animate-bounce">🔒</div>
             <h3 className="text-lg font-bold text-white">관리자 권한 필요</h3>
             <input type="password" value={adminPwInput} onChange={e=>setAdminPwInput(e.target.value)} className="bg-slate-950 border border-slate-700 p-3 rounded-xl text-center text-white w-48 text-base" placeholder="Password" />
             <button onClick={handleLogin} className="bg-slate-800 px-6 py-2 rounded-xl font-bold text-emerald-400">LOGIN</button>
         </div>
      );
  }

  // 시즌 관리 UI
  if (typeof adminTab === 'number') {
      const targetSeason = seasons.find(s => s.id === adminTab);
      if (!targetSeason) return <div>Season Not Found</div>;
      let filteredMasterTeams = masterTeams;
      if (filterCategory !== 'ALL') filteredMasterTeams = filteredMasterTeams.filter(t => filterCategory === 'CLUB' ? t.category !== 'NATIONAL' : t.category === 'NATIONAL');
      if (filterLeague !== 'ALL') filteredMasterTeams = filteredMasterTeams.filter(t => t.region === filterLeague);
      filteredMasterTeams = getSortedTeamsLogic(filteredMasterTeams, searchTeam);
      const hasSchedule = targetSeason.rounds && targetSeason.rounds.length > 0;

      return (
          <div className="space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setAdminTab('NEW')} className="text-slate-500 hover:text-white">← Back</button>
                  <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-emerald-400">Manage: {targetSeason.name}</h2>
                      <button onClick={() => handleDeleteSeason(targetSeason.id)} className="bg-red-900/80 px-3 py-1 rounded text-xs font-bold hover:bg-red-700 text-red-200">Season Delete</button>
                  </div>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-4 max-w-full overflow-hidden">
                  <h3 className="text-white font-bold text-sm border-b border-slate-800 pb-2">Step 1. 팀 & 오너 매칭</h3>
                  <div className="flex flex-col gap-3 w-full">
                      <select value={selectedOwnerId} onChange={e=>setSelectedOwnerId(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-white w-full text-sm">
                          <option value="">👤 Select Owner</option>
                          {owners.map(o => <option key={o.id} value={o.id}>{o.nickname}</option>)}
                      </select>
                      <div className="flex gap-2 w-full">
                          <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-slate-400 text-xs flex-1 min-w-0">
                              <option value="ALL">Category</option>
                              <option value="CLUB">Club</option>
                              <option value="NATIONAL">National</option>
                          </select>
                          <select value={filterLeague} onChange={e=>setFilterLeague(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-slate-400 text-xs flex-1 min-w-0">
                              <option value="ALL">All Leagues</option>
                              {getSortedLeagues(leagues.map(l=>l.name)).map(l=><option key={l} value={l}>{l}</option>)}
                          </select>
                      </div>
                      
                      <div className="flex gap-2">
                          <select value={selectedMasterTeamId} onChange={e=>setSelectedMasterTeamId(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-white w-full text-sm flex-1">
                              <option value="">🛡️ Select Team ({filteredMasterTeams.length})</option>
                              {filteredMasterTeams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.tier})</option>)}
                          </select>
                          {/* 🔥 랜덤 버튼 */}
                          <button onClick={() => handleRandomTeam(targetSeason.id)} className="bg-purple-700 px-4 rounded font-bold text-white hover:bg-purple-600 text-xs whitespace-nowrap">🎲 Random</button>
                      </div>

                      <input type="text" value={searchTeam} onChange={e=>setSearchTeam(e.target.value)} placeholder="🔍 팀 이름 검색..." className="bg-slate-900 p-3 rounded border border-slate-700 text-white w-full text-sm"/>
                      <button onClick={() => handleAddTeamToSeason(targetSeason.id)} className="bg-emerald-600 py-3 font-bold rounded hover:bg-emerald-500 w-full shadow-lg">매칭 완료 (Add Team)</button>
                  </div>
              </div>
              <div className="bg-black p-4 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                      <h3 className="text-white font-bold text-sm">Step 2. 참가 팀 관리</h3>
                      <div className="flex gap-2">
                          {hasSchedule ? (
                              <>
                                <button onClick={() => handleGenerateSchedule(targetSeason.id, true)} className="bg-blue-600 px-2 py-1.5 rounded-[4px] text-[10px] font-bold hover:bg-blue-500">🔄 재생성</button>
                                <button onClick={() => handleDeleteSchedule(targetSeason.id)} className="bg-red-900 px-2 py-1.5 rounded-[4px] text-[10px] font-bold hover:bg-red-700">🗑️ 삭제</button>
                              </>
                          ) : (
                              <button onClick={() => handleGenerateSchedule(targetSeason.id, false)} className="bg-purple-600 px-3 py-2 rounded text-xs font-bold hover:bg-purple-500 shadow-lg shadow-purple-900/50">⚡ 스케줄 생성</button>
                          )}
                      </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {targetSeason.teams?.map(t => (
                          <div key={t.id} className="flex items-center gap-3 bg-slate-900 p-2 rounded border border-slate-800 relative group">
                              <img src={t.logo} className="w-8 h-8 object-contain" alt=""/>
                              <div className="overflow-hidden">
                                  <p className="text-xs font-bold text-white truncate">{t.name}</p>
                                  <p className="text-[10px] text-slate-500">{t.ownerName}</p>
                              </div>
                              <span className={`absolute top-1 right-8 px-1 rounded text-[8px] ${getTierBadgeColor(t.tier)}`}>{t.tier}</span>
                              <button onClick={(e) => { e.stopPropagation(); handleRemoveTeamFromSeason(targetSeason.id, t.id, t.name); }} className="absolute top-1 right-1 text-slate-600 hover:text-red-500 font-bold p-1">✕</button>
                          </div>
                      ))}
                      {(!targetSeason.teams || targetSeason.teams.length === 0) && <p className="text-slate-600 text-xs col-span-4 text-center py-4">No teams assigned yet.</p>}
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 animate-in fade-in">
        <select value={adminTab} onChange={(e) => setAdminTab(e.target.value === 'NEW' || e.target.value === 'OWNER' || e.target.value === 'BANNER' || e.target.value === 'LEAGUES' || e.target.value === 'TEAMS' ? e.target.value : Number(e.target.value))} className="w-full bg-slate-950 p-4 rounded-xl border border-slate-700 text-sm mb-4 h-14 font-bold text-white">
            <option value="NEW">➕ Create New Season</option>
            <option value="LEAGUES">🏳️ League Management</option>
            <option value="TEAMS">🛡️ Team Management</option>
            <option value="OWNER">👤 Owner Management</option>
            <option value="BANNER">🖼️ Banner Management</option>
            <optgroup label="Select Season to Manage">
                {seasons.map(s => <option key={s.id} value={s.id}>🏆 {s.name}</option>)}
            </optgroup>
        </select>

        {adminTab === 'LEAGUES' && <AdminLeagueManager leagues={leagues} masterTeams={masterTeams} />}
        {adminTab === 'TEAMS' && <AdminTeamManager leagues={leagues} masterTeams={masterTeams} />}
        {/* 🔥 [수정] 배너 데이터 전달 */}
        {adminTab === 'BANNER' && <AdminBannerManager banners={banners} />}

        {adminTab === 'NEW' && (
            <div className="space-y-6">
                <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">1. Season Name</label>
                    <input value={inputSeasonName} onChange={e=>setInputSeasonName(e.target.value)} placeholder="예: 2026 Season 1" className="bg-slate-950 w-full p-4 rounded border border-slate-700 text-base text-white"/>
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold">2. Type & Mode</label>
                    <div className="flex gap-2">
                        <select value={inputSeasonType} onChange={e=>setInputSeasonType(e.target.value)} className="bg-slate-950 p-4 rounded border border-slate-700 flex-1 h-14 text-base text-white">
                            <option value="LEAGUE">LEAGUE</option>
                            <option value="TOURNAMENT">TOURNAMENT</option>
                        </select>
                        {inputSeasonType === 'LEAGUE' && (
                            <select value={inputLeagueMode} onChange={e=>setInputLeagueMode(e.target.value)} className="bg-slate-950 p-4 rounded border border-slate-700 flex-1 h-14 text-base text-white">
                                <option value="SINGLE">SINGLE Round</option>
                                <option value="DOUBLE">DOUBLE Round</option>
                            </select>
                        )}
                    </div>
                </div>
                
                <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold flex justify-between items-center">
                        3. Prizes (Total)
                        <button onClick={()=>setIsAutoPrize(!isAutoPrize)} className={`text-xs px-2 py-1 rounded border ${isAutoPrize?'border-emerald-500 text-emerald-400':'border-orange-500 text-orange-400'}`}>{isAutoPrize?'⚡ Auto Calc':'✏️ Manual Input'}</button>
                    </label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">₩</span>
                        <input type="text" value={displayPrize} onChange={e => handlePrizeChange(e.target.value)} className="bg-slate-950 w-full p-4 pl-8 rounded border border-slate-700 text-right text-lg font-bold text-emerald-400 mb-2" placeholder="Total Prize" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded border border-slate-800">
                        <div className="space-y-2">
                            <p className="text-[10px] text-slate-500 font-bold border-b border-slate-700 pb-1">🏆 TEAM PRIZES</p>
                            <div><label className="text-[10px] text-slate-500">🥇 1st</label><input type="number" value={prizes.first} onChange={e=>setPrizes({...prizes, first:Number(e.target.value)})} readOnly={isAutoPrize} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAutoPrize?'opacity-50 cursor-not-allowed':''}`}/></div>
                            <div><label className="text-[10px] text-slate-500">🥈 2nd</label><input type="number" value={prizes.second} onChange={e=>setPrizes({...prizes, second:Number(e.target.value)})} readOnly={isAutoPrize} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAutoPrize?'opacity-50 cursor-not-allowed':''}`}/></div>
                            <div><label className="text-[10px] text-slate-500">🥉 3rd</label><input type="number" value={prizes.third} onChange={e=>setPrizes({...prizes, third:Number(e.target.value)})} readOnly={isAutoPrize} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAutoPrize?'opacity-50 cursor-not-allowed':''}`}/></div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-[10px] text-slate-500 font-bold border-b border-slate-700 pb-1">👤 PLAYER PRIZES</p>
                            <div><label className="text-[10px] text-slate-500">👟 Scorer</label><input type="number" value={prizes.scorer} onChange={e=>setPrizes({...prizes, scorer:Number(e.target.value)})} readOnly={isAutoPrize} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAutoPrize?'opacity-50 cursor-not-allowed':''}`}/></div>
                            <div><label className="text-[10px] text-slate-500">🅰️ Assist</label><input type="number" value={prizes.assist} onChange={e=>setPrizes({...prizes, assist:Number(e.target.value)})} readOnly={isAutoPrize} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAutoPrize?'opacity-50 cursor-not-allowed':''}`}/></div>
                        </div>
                    </div>
                </div>
                <button onClick={() => onCreateSeason(inputSeasonName, inputSeasonType, inputLeagueMode, inputTotalPrize, prizes)} className="w-full bg-emerald-600 py-4 rounded-xl font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-900/50">Create Season</button>
            </div>
        )}

        {adminTab === 'OWNER' && (
            <>
                <div className="flex gap-2 mb-4">
                    <input value={newOwnerName} onChange={e=>setNewOwnerName(e.target.value)} placeholder="Owner Name" className="bg-slate-950 p-3 rounded w-full text-base text-white border border-slate-700"/>
                    <input value={newOwnerPhoto} onChange={e=>setNewOwnerPhoto(e.target.value)} placeholder="Photo URL" className="bg-slate-950 p-3 rounded w-full text-base text-white border border-slate-700"/>
                    <button onClick={() => { onSaveOwner(newOwnerName, newOwnerPhoto, editOwnerId); setNewOwnerName(''); setNewOwnerPhoto(''); setEditOwnerId(null); }} className="bg-purple-600 px-6 rounded font-bold hover:bg-purple-500">Save</button>
                </div>
                <div className="grid grid-cols-2 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                    {owners.map(o => (
                        <div key={o.id} onClick={() => { setEditOwnerId(o.docId!); setNewOwnerName(o.nickname); setNewOwnerPhoto(o.photo); }} className="p-3 bg-slate-950 rounded-xl flex items-center gap-3 cursor-pointer border border-slate-800 hover:border-emerald-500 transition-colors">
                            <img src={o.photo} className="w-10 h-10 rounded-full object-cover" alt="" />
                            <span className="font-bold text-white">{o.nickname}</span>
                        </div>
                    ))}
                </div>
            </>
        )}
    </div>
  );
};