/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; 
import { updateDoc, doc } from 'firebase/firestore';
import { Season, Owner, League, MasterTeam, Team } from '../types';
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
  onAdminLogin: (pw: string) => boolean;
  onCreateSeason: (name: string, type: string, mode: string, prize: number, prizesObj: any) => void;
  onSaveOwner: (name: string, photo: string, editId: string | null) => void;
}

// 상금 포맷팅 함수
const formatNumber = (num: number) => num.toLocaleString();
const parseNumber = (str: string) => Number(str.replace(/,/g, ''));

export const AdminView = ({ 
  adminTab, setAdminTab, seasons, owners, leagues, masterTeams,
  onAdminLogin, onCreateSeason, onSaveOwner 
}: AdminViewProps) => {
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPwInput, setAdminPwInput] = useState('');
  
  // 새 시즌 생성 state
  const [inputSeasonName, setInputSeasonName] = useState('');
  const [inputSeasonType, setInputSeasonType] = useState('LEAGUE');
  const [inputLeagueMode, setInputLeagueMode] = useState('SINGLE');
  const [inputTotalPrize, setInputTotalPrize] = useState(100000); // 숫자 저장
  const [displayPrize, setDisplayPrize] = useState('100,000'); // 화면 표시용 (콤마)
  const [prizes, setPrizes] = useState({ first: 45000, second: 25000, third: 10000, scorer: 10000, assist: 10000 });
  const [isAutoPrize, setIsAutoPrize] = useState(true);

  // 오너 관리 state
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPhoto, setNewOwnerPhoto] = useState('');
  const [editOwnerId, setEditOwnerId] = useState<string | null>(null);

  // 시즌 세부 관리 state (팀 배정용)
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [selectedMasterTeamId, setSelectedMasterTeamId] = useState('');
  const [filterLeague, setFilterLeague] = useState('ALL');

  const handleLogin = () => {
      if (onAdminLogin(adminPwInput)) {
          setAdminUnlocked(true);
          setAdminPwInput('');
      } else {
          alert("비밀번호가 일치하지 않습니다.");
      }
  };

  // 상금 입력 핸들러 (콤마 처리)
  const handlePrizeChange = (val: string) => {
      const num = parseNumber(val);
      if (!isNaN(num)) {
          setInputTotalPrize(num);
          setDisplayPrize(formatNumber(num));
      } else if (val === '') {
          setInputTotalPrize(0);
          setDisplayPrize('');
      }
  };

  useEffect(() => {
      if (isAutoPrize) {
          setPrizes({ 
            first: Math.floor(inputTotalPrize * 0.45), 
            second: Math.floor(inputTotalPrize * 0.25), 
            third: Math.floor(inputTotalPrize * 0.10), 
            scorer: Math.floor(inputTotalPrize * 0.10), 
            assist: Math.floor(inputTotalPrize * 0.10) 
          });
      }
  }, [inputTotalPrize, isAutoPrize]);

  // 시즌에 팀 추가 함수
  const handleAddTeamToSeason = async (seasonId: number) => {
      if (!selectedOwnerId || !selectedMasterTeamId) return alert("오너와 팀을 선택하세요.");
      const season = seasons.find(s => s.id === seasonId);
      if (!season) return;

      const owner = owners.find(o => String(o.id) === selectedOwnerId);
      const mTeam = masterTeams.find(t => String(t.id) === selectedMasterTeamId);
      if (!owner || !mTeam) return;

      const newTeam: Team = {
          id: Date.now(), seasonId, name: mTeam.name, logo: mTeam.logo, ownerName: owner.nickname,
          region: mTeam.region, tier: mTeam.tier,
          win: 0, draw: 0, loss: 0, points: 0, gf: 0, ga: 0, gd: 0
      };

      const updatedTeams = [...(season.teams || []), newTeam];
      await updateDoc(doc(db, "seasons", String(seasonId)), { teams: updatedTeams });
  };

  // 시즌 팀 삭제
  const handleRemoveTeamFromSeason = async (seasonId: number, teamId: number) => {
      const season = seasons.find(s => s.id === seasonId);
      if (!season) return;
      const updatedTeams = season.teams.filter(t => t.id !== teamId);
      await updateDoc(doc(db, "seasons", String(seasonId)), { teams: updatedTeams });
  };

  // 스케줄 생성
  const handleGenerateSchedule = async (seasonId: number) => {
      const season = seasons.find(s => s.id === seasonId);
      if (!season || season.teams.length < 2) return alert("최소 2팀 이상 필요합니다.");
      if (!confirm("기존 스케줄이 초기화됩니다. 계속하시겠습니까?")) return;

      const rounds = generateRoundsLogic(season);
      await updateDoc(doc(db, "seasons", String(seasonId)), { rounds });
      alert("스케줄 생성 완료!");
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

  // 시즌 상세 관리 뷰 (복구된 부분)
  if (typeof adminTab === 'number') {
      const targetSeason = seasons.find(s => s.id === adminTab);
      if (!targetSeason) return <div>Season Not Found</div>;
      
      const filteredMasterTeams = getSortedTeamsLogic(masterTeams.filter(t => filterLeague === 'ALL' || t.region === filterLeague), '');

      return (
          <div className="space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setAdminTab('NEW')} className="text-slate-500 hover:text-white">← Back</button>
                  <h2 className="text-xl font-bold text-emerald-400">Manage: {targetSeason.name}</h2>
              </div>

              {/* 팀 배정 컨트롤 패널 */}
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <select value={selectedOwnerId} onChange={e=>setSelectedOwnerId(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-white">
                          <option value="">1. Select Owner</option>
                          {owners.map(o => <option key={o.id} value={o.id}>{o.nickname}</option>)}
                      </select>
                      <div className="flex gap-2">
                          <select value={filterLeague} onChange={e=>setFilterLeague(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-slate-400 w-1/3">
                              <option value="ALL">All Leagues</option>
                              {getSortedLeagues(leagues.map(l=>l.name)).map(l=><option key={l} value={l}>{l}</option>)}
                          </select>
                          <select value={selectedMasterTeamId} onChange={e=>setSelectedMasterTeamId(e.target.value)} className="bg-slate-950 p-3 rounded border border-slate-700 text-white w-2/3">
                              <option value="">2. Select Team</option>
                              {filteredMasterTeams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.tier})</option>)}
                          </select>
                      </div>
                      <button onClick={() => handleAddTeamToSeason(targetSeason.id)} className="bg-emerald-600 font-bold rounded hover:bg-emerald-500">Add Team to Season</button>
                  </div>
              </div>

              {/* 현재 배정된 팀 목록 */}
              <div className="bg-black p-4 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-white font-bold">Participating Teams ({targetSeason.teams?.length || 0})</h3>
                      <button onClick={() => handleGenerateSchedule(targetSeason.id)} className="bg-purple-600 px-4 py-2 rounded text-xs font-bold hover:bg-purple-500 shadow-lg shadow-purple-900/50">⚡ Generate Schedule</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {targetSeason.teams?.map(t => (
                          <div key={t.id} className="flex items-center gap-3 bg-slate-900 p-2 rounded border border-slate-800 relative group">
                              <img src={t.logo} className="w-8 h-8 object-contain" alt=""/>
                              <div className="overflow-hidden">
                                  <p className="text-xs font-bold text-white truncate">{t.name}</p>
                                  <p className="text-[10px] text-slate-500">{t.ownerName}</p>
                              </div>
                              <span className={`absolute top-1 right-1 px-1 rounded text-[8px] ${getTierBadgeColor(t.tier)}`}>{t.tier}</span>
                              <button onClick={() => handleRemoveTeamFromSeason(targetSeason.id, t.id)} className="absolute inset-0 bg-red-900/80 text-white font-bold opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">Remove</button>
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
        {adminTab === 'BANNER' && <AdminBannerManager banners={[]} />}

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
                    
                    {/* 상금 입력 (콤마 적용) */}
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">₩</span>
                        <input 
                            type="text" 
                            value={displayPrize} 
                            onChange={e => handlePrizeChange(e.target.value)} 
                            className="bg-slate-950 w-full p-4 pl-8 rounded border border-slate-700 text-right text-lg font-bold text-emerald-400 mb-2" 
                            placeholder="Total Prize"
                        />
                    </div>

                    {isAutoPrize ? (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-slate-900 p-2 rounded flex justify-between border border-slate-800"><span>🥇 1st (45%)</span><span className="text-emerald-400">{formatNumber(prizes.first)}</span></div>
                            <div className="bg-slate-900 p-2 rounded flex justify-between border border-slate-800"><span>🥈 2nd (25%)</span><span>{formatNumber(prizes.second)}</span></div>
                            <div className="bg-slate-900 p-2 rounded flex justify-between border border-slate-800"><span>🥉 3rd (10%)</span><span>{formatNumber(prizes.third)}</span></div>
                            <div className="col-span-2 grid grid-cols-2 gap-2">
                                <div className="bg-slate-900 p-2 rounded flex justify-between border border-slate-800"><span>👟 Scorer (10%)</span><span>{formatNumber(prizes.scorer)}</span></div>
                                <div className="bg-slate-900 p-2 rounded flex justify-between border border-slate-800"><span>🅰️ Assist (10%)</span><span>{formatNumber(prizes.assist)}</span></div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-xs text-orange-400">Manual mode selected. Prizes will be set to 0 initially.</div>
                    )}
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