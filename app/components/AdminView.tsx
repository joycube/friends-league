import React, { useState, useEffect } from 'react'; // useEffect 추가됨
import { Season, Owner, League, MasterTeam } from '../types';
import { AdminLeagueManager, AdminTeamManager } from './AdminTeamManagement'; 
import { AdminBannerManager } from './AdminBannerManager'; 

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

// 🔥 중요: 반드시 'export const'여야 합니다! ('export default' 금지)
export const AdminView = ({ 
  adminTab, setAdminTab, seasons, owners, leagues, masterTeams,
  onAdminLogin, onCreateSeason, onSaveOwner 
}: AdminViewProps) => {
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPwInput, setAdminPwInput] = useState('');
  
  const [inputSeasonName, setInputSeasonName] = useState('');
  const [inputSeasonType, setInputSeasonType] = useState('LEAGUE');
  const [inputLeagueMode, setInputLeagueMode] = useState('SINGLE');
  const [inputTotalPrize, setInputTotalPrize] = useState(100000);
  const [prizes, setPrizes] = useState({ first: 45000, second: 25000, third: 10000, scorer: 10000, assist: 10000 });
  const [isAutoPrize, setIsAutoPrize] = useState(true);

  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPhoto, setNewOwnerPhoto] = useState('');
  const [editOwnerId, setEditOwnerId] = useState<string | null>(null);

  const handleLogin = () => {
      if (onAdminLogin(adminPwInput)) {
          setAdminUnlocked(true);
          setAdminPwInput('');
      } else {
          alert("비밀번호가 일치하지 않습니다.");
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

  if (!adminUnlocked) {
      return (
         <div className="flex flex-col items-center justify-center py-10 space-y-4">
             <div className="text-4xl">🔒</div>
             <h3 className="text-lg font-bold text-white">관리자 권한 필요</h3>
             <input type="password" value={adminPwInput} onChange={e=>setAdminPwInput(e.target.value)} className="bg-slate-950 border border-slate-700 p-3 rounded-xl text-center text-white w-48 text-base" placeholder="Password" />
             <button onClick={handleLogin} className="bg-slate-800 px-6 py-2 rounded-xl font-bold text-emerald-400">LOGIN</button>
         </div>
      );
  }

  return (
    <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 animate-in fade-in">
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
        {adminTab === 'BANNER' && <AdminBannerManager banners={[]} />}

        {adminTab === 'NEW' && (
            <div className="space-y-4">
                <div className="space-y-1"><label className="text-xs text-slate-400 font-bold">1. Season Name</label><input value={inputSeasonName} onChange={e=>setInputSeasonName(e.target.value)} placeholder="예: 2026 Season 1" className="bg-slate-800 w-full p-4 rounded border border-slate-700 text-base"/></div>
                <div className="space-y-1"><label className="text-xs text-slate-400 font-bold">2. Type & Mode</label><div className="flex gap-2"><select value={inputSeasonType} onChange={e=>setInputSeasonType(e.target.value)} className="bg-slate-800 p-4 rounded border border-slate-700 flex-1 h-14 text-base"><option value="LEAGUE">LEAGUE</option><option value="TOURNAMENT">TOURNAMENT</option></select>{inputSeasonType === 'LEAGUE' && <select value={inputLeagueMode} onChange={e=>setInputLeagueMode(e.target.value)} className="bg-slate-800 p-4 rounded border border-slate-700 flex-1 h-14 text-base"><option value="SINGLE">SINGLE</option><option value="DOUBLE">DOUBLE</option></select>}</div></div>
                
                <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold flex justify-between items-center">
                        3. Prizes (상금 설정)
                        <button onClick={()=>setIsAutoPrize(!isAutoPrize)} className={`text-xs px-2 py-1 rounded border ${isAutoPrize?'border-emerald-500 text-emerald-400':'border-orange-500 text-orange-400'}`}>{isAutoPrize?'⚡ Auto Mode':'✏️ Manual Mode'}</button>
                    </label>
                    {isAutoPrize ? (
                        <>
                            <input type="number" value={inputTotalPrize} onChange={e=>setInputTotalPrize(Number(e.target.value))} className="bg-slate-800 w-full p-4 rounded border border-slate-700 text-right text-lg font-bold text-emerald-400 mb-2 text-base" placeholder="Total Prize"/>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-slate-950 p-2 rounded flex justify-between border border-slate-800"><span>🥇 1st (45%)</span><span className="text-emerald-400">{prizes.first.toLocaleString()}</span></div>
                                <div className="bg-slate-950 p-2 rounded flex justify-between border border-slate-800"><span>🥈 2nd (25%)</span><span>{prizes.second.toLocaleString()}</span></div>
                                <div className="bg-slate-950 p-2 rounded flex justify-between border border-slate-800"><span>🥉 3rd (10%)</span><span>{prizes.third.toLocaleString()}</span></div>
                                <div className="col-span-2 grid grid-cols-2 gap-2">
                                    <div className="bg-slate-950 p-2 rounded flex justify-between border border-slate-800"><span>👟 Scorer (10%)</span><span>{prizes.scorer.toLocaleString()}</span></div>
                                    <div className="bg-slate-950 p-2 rounded flex justify-between border border-slate-800"><span>🅰️ Assist (10%)</span><span>{prizes.assist.toLocaleString()}</span></div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <p className="text-[10px] text-slate-500 font-bold border-b border-slate-700 pb-1">🏆 TEAM PRIZES</p>
                                <div><label className="text-[10px] text-slate-500">🥇 1st</label><input type="number" value={prizes.first} onChange={e=>setPrizes({...prizes, first:Number(e.target.value)})} className="bg-slate-800 w-full p-2 rounded border border-slate-700 text-right text-sm"/></div>
                                <div><label className="text-[10px] text-slate-500">🥈 2nd</label><input type="number" value={prizes.second} onChange={e=>setPrizes({...prizes, second:Number(e.target.value)})} className="bg-slate-800 w-full p-2 rounded border border-slate-700 text-right text-sm"/></div>
                                <div><label className="text-[10px] text-slate-500">🥉 3rd</label><input type="number" value={prizes.third} onChange={e=>setPrizes({...prizes, third:Number(e.target.value)})} className="bg-slate-800 w-full p-2 rounded border border-slate-700 text-right text-sm"/></div>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] text-slate-500 font-bold border-b border-slate-700 pb-1">👤 PLAYER PRIZES</p>
                                <div><label className="text-[10px] text-slate-500">👟 Scorer</label><input type="number" value={prizes.scorer} onChange={e=>setPrizes({...prizes, scorer:Number(e.target.value)})} className="bg-slate-800 w-full p-2 rounded border border-slate-700 text-right text-sm"/></div>
                                <div><label className="text-[10px] text-slate-500">🅰️ Assist</label><input type="number" value={prizes.assist} onChange={e=>setPrizes({...prizes, assist:Number(e.target.value)})} className="bg-slate-800 w-full p-2 rounded border border-slate-700 text-right text-sm"/></div>
                            </div>
                        </div>
                    )}
                </div>
                <button onClick={() => onCreateSeason(inputSeasonName, inputSeasonType, inputLeagueMode, inputTotalPrize, prizes)} className="w-full bg-emerald-600 py-4 rounded-xl font-bold">Create Season</button>
            </div>
        )}

        {adminTab === 'OWNER' && (
            <>
                <div className="flex gap-2">
                    <input value={newOwnerName} onChange={e=>setNewOwnerName(e.target.value)} placeholder="Owner Name" className="bg-slate-950 p-3 rounded w-full text-base"/>
                    <input value={newOwnerPhoto} onChange={e=>setNewOwnerPhoto(e.target.value)} placeholder="Photo URL" className="bg-slate-950 p-3 rounded w-full text-base"/>
                    <button onClick={() => { onSaveOwner(newOwnerName, newOwnerPhoto, editOwnerId); setNewOwnerName(''); setNewOwnerPhoto(''); setEditOwnerId(null); }} className="bg-purple-600 px-6 rounded font-bold">Save</button>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                    {owners.map(o => (
                        <div key={o.id} onClick={() => { setEditOwnerId(o.docId!); setNewOwnerName(o.nickname); setNewOwnerPhoto(o.photo); }} className="p-2 bg-black rounded flex items-center gap-2 cursor-pointer border border-transparent hover:border-emerald-500">
                            <img src={o.photo} className="w-8 h-8 rounded-full" alt="" />
                            <span>{o.nickname}</span>
                        </div>
                    ))}
                </div>
            </>
        )}
    </div>
  );
};