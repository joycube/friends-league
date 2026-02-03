import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { setDoc, doc } from 'firebase/firestore';
import { Season } from '../types';

interface AdminSeasonCreateProps {
    onCreateSuccess: (id: number) => void;
}

const parseNumber = (str: string) => Number(str.replace(/,/g, ''));
const formatNumber = (num: number) => num.toLocaleString();

export const AdminSeasonCreate = ({ onCreateSuccess }: AdminSeasonCreateProps) => {
    const [name, setName] = useState('');
    const [type, setType] = useState('LEAGUE');
    const [mode, setMode] = useState('SINGLE');
    const [totalPrize, setTotalPrize] = useState(100000);
    const [displayPrize, setDisplayPrize] = useState('100,000');
    const [prizes, setPrizes] = useState({ first: 45000, second: 25000, third: 10000, scorer: 10000, assist: 10000 });
    const [isAuto, setIsAuto] = useState(true);

    const handlePrizeChange = (val: string) => {
        const num = parseNumber(val);
        if (!isNaN(num)) { setTotalPrize(num); setDisplayPrize(formatNumber(num)); }
        else if (val === '') { setTotalPrize(0); setDisplayPrize(''); }
    };

    useEffect(() => {
        if (isAuto) {
            setPrizes({
                first: Math.floor(totalPrize * 0.45), second: Math.floor(totalPrize * 0.25), third: Math.floor(totalPrize * 0.10),
                scorer: Math.floor(totalPrize * 0.10), assist: Math.floor(totalPrize * 0.10)
            });
        }
    }, [totalPrize, isAuto]);

    const handleCreate = async () => {
        if (!name) return alert("시즌 이름을 입력하세요.");
        const id = Date.now();
        const newSeason: Season = {
            id, name, type: type as any, leagueMode: mode as any, isActive: true,
            teams: [], rounds: [], prizes
        };
        await setDoc(doc(db, "seasons", String(id)), newSeason);
        alert("시즌 생성 완료!");
        onCreateSuccess(id);
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="space-y-1"><label className="text-xs text-slate-400 font-bold">1. Season Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="예: 2026 Season 1" className="bg-slate-950 w-full p-4 rounded border border-slate-700 text-base text-white" /></div>
            <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold">2. Type & Mode</label>
                <div className="flex gap-2">
                    <select value={type} onChange={e => setType(e.target.value)} className="bg-slate-950 p-4 rounded border border-slate-700 flex-1 h-14 text-base text-white"><option value="LEAGUE">LEAGUE</option><option value="TOURNAMENT">TOURNAMENT</option></select>
                    {type === 'LEAGUE' && <select value={mode} onChange={e => setMode(e.target.value)} className="bg-slate-950 p-4 rounded border border-slate-700 flex-1 h-14 text-base text-white"><option value="SINGLE">SINGLE Round</option><option value="DOUBLE">DOUBLE Round</option></select>}
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-xs text-slate-400 font-bold flex justify-between items-center">3. Prizes (Total)<button onClick={() => setIsAuto(!isAuto)} className={`text-xs px-2 py-1 rounded border ${isAuto ? 'border-emerald-500 text-emerald-400' : 'border-orange-500 text-orange-400'}`}>{isAuto ? '⚡ Auto Calc' : '✏️ Manual Input'}</button></label>
                <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">₩</span><input type="text" value={displayPrize} onChange={e => handlePrizeChange(e.target.value)} className="bg-slate-950 w-full p-4 pl-8 rounded border border-slate-700 text-right text-lg font-bold text-emerald-400 mb-2" placeholder="Total Prize" /></div>
                <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded border border-slate-800">
                    <div className="space-y-2"><p className="text-[10px] text-slate-500 font-bold border-b border-slate-700 pb-1">🏆 TEAM PRIZES</p><div><label className="text-[10px] text-slate-500">🥇 1st</label><input type="number" value={prizes.first} onChange={e => setPrizes({ ...prizes, first: Number(e.target.value) })} readOnly={isAuto} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAuto ? 'opacity-50 cursor-not-allowed' : ''}`} /></div><div><label className="text-[10px] text-slate-500">🥈 2nd</label><input type="number" value={prizes.second} onChange={e => setPrizes({ ...prizes, second: Number(e.target.value) })} readOnly={isAuto} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAuto ? 'opacity-50 cursor-not-allowed' : ''}`} /></div><div><label className="text-[10px] text-slate-500">🥉 3rd</label><input type="number" value={prizes.third} onChange={e => setPrizes({ ...prizes, third: Number(e.target.value) })} readOnly={isAuto} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAuto ? 'opacity-50 cursor-not-allowed' : ''}`} /></div></div>
                    <div className="space-y-2"><p className="text-[10px] text-slate-500 font-bold border-b border-slate-700 pb-1">👤 PLAYER PRIZES</p><div><label className="text-[10px] text-slate-500">👟 Scorer</label><input type="number" value={prizes.scorer} onChange={e => setPrizes({ ...prizes, scorer: Number(e.target.value) })} readOnly={isAuto} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAuto ? 'opacity-50 cursor-not-allowed' : ''}`} /></div><div><label className="text-[10px] text-slate-500">🅰️ Assist</label><input type="number" value={prizes.assist} onChange={e => setPrizes({ ...prizes, assist: Number(e.target.value) })} readOnly={isAuto} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAuto ? 'opacity-50 cursor-not-allowed' : ''}`} /></div></div>
                </div>
            </div>
            <button onClick={handleCreate} className="w-full bg-emerald-600 py-4 rounded-xl font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-900/50">Create Season</button>
        </div>
    );
};