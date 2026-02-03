import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Season, Owner, League, MasterTeam, Banner } from '../types';
import { AdminLeagueManager, AdminTeamManager } from './AdminTeamManagement';
import { AdminBannerManager } from './AdminBannerManager';
import { AdminSeasonCreate } from './AdminSeasonCreate';
import { AdminOwnerManager } from './AdminOwnerManager';
import { AdminTeamMatching } from './AdminTeamMatching'; // 새로 만든 것

interface AdminViewProps {
    adminTab: number | 'NEW' | 'OWNER' | 'BANNER' | 'LEAGUES' | 'TEAMS';
    setAdminTab: (tab: any) => void;
    seasons: Season[];
    owners: Owner[];
    leagues: League[];
    masterTeams: MasterTeam[];
    banners: Banner[];
    onAdminLogin: (pw: string) => boolean;
    onCreateSeason: (name: string, type: string, mode: string, prize: number, prizesObj: any) => void; // legacy support
    onSaveOwner: (name: string, photo: string, editId: string | null) => void; // legacy support
    onNavigateToSchedule: (seasonId: number) => void;
}

export const AdminView = ({
    adminTab, setAdminTab, seasons, owners, leagues, masterTeams, banners,
    onAdminLogin, onNavigateToSchedule
}: AdminViewProps) => {
    const [adminUnlocked, setAdminUnlocked] = useState(false);
    const [adminPwInput, setAdminPwInput] = useState('');

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

    const handleDeleteSeason = async (seasonId: number) => {
        if (!confirm("시즌을 삭제할 경우, 모든 기록이 삭제됩니다. 삭제하시겠습니까?")) return;
        await deleteDoc(doc(db, "seasons", String(seasonId)));
        setAdminTab('NEW');
        alert("시즌 삭제 완료");
    };

    const handleDeleteSchedule = async (seasonId: number) => {
        if (!confirm("해당 시즌의 스케줄만 삭제하시겠습니까?")) return;
        await updateDoc(doc(db, "seasons", String(seasonId)), { rounds: [] });
        alert("스케줄 삭제 완료");
    };

    if (!adminUnlocked) return <div className="flex flex-col items-center justify-center py-20 space-y-4"><div className="text-4xl animate-bounce">🔒</div><input type="password" value={adminPwInput} onChange={e => setAdminPwInput(e.target.value)} className="bg-slate-950 border border-slate-700 p-3 rounded-xl text-center text-white" placeholder="Password" /><button onClick={handleLogin} className="bg-slate-800 px-6 py-2 rounded-xl font-bold text-emerald-400">LOGIN</button></div>;

    // 1. 시즌 선택 또는 메뉴 선택 핸들러
    const handleTabChange = (val: string) => {
        setAdminTab(isNaN(Number(val)) ? val : Number(val));
    };

    return (
        <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 animate-in fade-in">
            <select value={adminTab} onChange={(e) => handleTabChange(e.target.value)} className="w-full bg-slate-950 p-4 rounded-xl border border-slate-700 text-sm mb-4 h-14 font-bold text-white">
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
            {adminTab === 'BANNER' && <AdminBannerManager banners={banners} />}
            {adminTab === 'OWNER' && <AdminOwnerManager owners={owners} />}
            {adminTab === 'NEW' && <AdminSeasonCreate onCreateSuccess={(id) => setAdminTab(id)} />}

            {typeof adminTab === 'number' && (() => {
                const targetSeason = seasons.find(s => s.id === adminTab);
                if (!targetSeason) return <div>Season Not Found</div>;
                return (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <button onClick={() => setAdminTab('NEW')} className="text-slate-500 hover:text-white">← Back</button>
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-bold text-emerald-400">Manage: {targetSeason.name}</h2>
                                <button onClick={() => handleDeleteSeason(targetSeason.id)} className="bg-red-900/80 px-3 py-1 rounded text-xs font-bold hover:bg-red-700 text-red-200">Season Delete</button>
                            </div>
                        </div>
                        {/* 🔥 핵심: 팀 매칭 기능을 전용 컴포넌트로 위임 */}
                        <AdminTeamMatching 
                            targetSeason={targetSeason}
                            owners={owners}
                            leagues={leagues}
                            masterTeams={masterTeams}
                            onNavigateToSchedule={onNavigateToSchedule}
                            onDeleteSchedule={() => handleDeleteSchedule(targetSeason.id)}
                        />
                    </div>
                );
            })()}
        </div>
    );
};