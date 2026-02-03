/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { Match, FALLBACK_IMG } from '../types';
import { RecordInput } from './RecordInput'; // 기존 파일 재사용

interface MatchEditModalProps {
  match: Match;
  onClose: () => void;
  onSave: (matchId: string, hScore: string, aScore: string, yt: string, records: any, manualWinner: 'HOME'|'AWAY'|null) => void;
  isTournament: boolean;
  teamPlayers: (team: string) => string[];
}

export const MatchEditModal = ({ match, onClose, onSave, isTournament, teamPlayers }: MatchEditModalProps) => {
  const [inputs, setInputs] = useState({ homeScore: match.homeScore || '0', awayScore: match.awayScore || '0', youtube: match.youtubeUrl || '' });
  const [records, setRecords] = useState({
      homeScorers: match.homeScorers || [], awayScorers: match.awayScorers || [],
      homeAssists: match.homeAssists || [], awayAssists: match.awayAssists || []
  });
  const [recordInput, setRecordInput] = useState({ homeScorer:{name:'',count:'1'}, awayScorer:{name:'',count:'1'}, homeAssist:{name:'',count:'1'}, awayAssist:{name:'',count:'1'} });
  const [manualWinner, setManualWinner] = useState<'HOME' | 'AWAY' | null>(null);

  const handleRecordAdd = (type: keyof typeof recordInput, targetListKey: keyof typeof records) => {
      const name = recordInput[type].name.trim();
      const count = Number(recordInput[type].count);
      if(!name) return alert("이름을 입력하세요");
      
      // Auto Score Update
      if(type==='homeScorer') setInputs(p=>({...p, homeScore:String(Number(p.homeScore)+count)}));
      if(type==='awayScorer') setInputs(p=>({...p, awayScore:String(Number(p.awayScore)+count)}));

      setRecords(p => ({...p, [targetListKey]: [...p[targetListKey], {id:Date.now(), name, count}]}));
      setRecordInput(p => ({...p, [type]: {...p[type], name:''}}));
  };

  const handleRecordRemove = (targetListKey: keyof typeof records, id: number, isHome: boolean) => {
      const item = records[targetListKey].find((r:any)=>r.id===id);
      if(item && targetListKey.includes('Scorer')) {
          if(isHome) setInputs(p=>({...p, homeScore:String(Math.max(0,Number(p.homeScore)-item.count))}));
          else setInputs(p=>({...p, awayScore:String(Math.max(0,Number(p.awayScore)-item.count))}));
      }
      setRecords(p => ({...p, [targetListKey]: p[targetListKey].filter((r:any)=>r.id!==id)}));
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] p-4">
       <div className="bg-slate-900 p-6 rounded-3xl border border-slate-700 w-full max-w-5xl relative max-h-[90vh] overflow-y-auto">
          <button onClick={onClose} className="absolute top-4 right-4 text-white text-2xl">✕</button>
          
          <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-slate-300 italic">{match.matchLabel}</h3>
              <p className="text-sm text-slate-500">{match.stage}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
              {/* Home */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="flex flex-col items-center mb-4"><img src={match.homeLogo} className="w-12 h-12 mb-2 object-contain" alt="" /><span className="font-bold text-white">{match.home}</span></div>
                  <datalist id="homeTeamPlayers">{teamPlayers(match.home).map((name, i) => <option key={i} value={name} />)}</datalist>
                  <div className="space-y-4">
                      <RecordInput type="homeScorer" inputValue={recordInput.homeScorer} onInputChange={(t,f,v)=>setRecordInput(p=>({...p,[t]:{...(p as any)[t],[f]:v}}))} onAdd={()=>handleRecordAdd('homeScorer','homeScorers')} onRemove={(t,id)=>handleRecordRemove('homeScorers',id,true)} records={records.homeScorers} label="⚽ Scorers" colorClass="text-emerald-400" datalistId="homeTeamPlayers" />
                      <RecordInput type="homeAssist" inputValue={recordInput.homeAssist} onInputChange={(t,f,v)=>setRecordInput(p=>({...p,[t]:{...(p as any)[t],[f]:v}}))} onAdd={()=>handleRecordAdd('homeAssist','homeAssists')} onRemove={(t,id)=>handleRecordRemove('homeAssists',id,true)} records={records.homeAssists} label="🅰️ Assists" colorClass="text-blue-400" datalistId="homeTeamPlayers" />
                  </div>
              </div>

              {/* Center */}
              <div className="flex flex-col items-center justify-center space-y-6">
                  <div className="flex items-center gap-4">
                      <input type="number" value={inputs.homeScore} onChange={e=>setInputs({...inputs, homeScore:e.target.value})} className="w-20 h-20 text-center text-4xl font-black bg-black rounded-2xl border border-slate-700 text-white focus:border-emerald-500 outline-none" />
                      <span className="text-slate-600 text-2xl">:</span>
                      <input type="number" value={inputs.awayScore} onChange={e=>setInputs({...inputs, awayScore:e.target.value})} className="w-20 h-20 text-center text-4xl font-black bg-black rounded-2xl border border-slate-700 text-white focus:border-emerald-500 outline-none" />
                  </div>
                  
                  {isTournament && Number(inputs.homeScore) === Number(inputs.awayScore) && inputs.homeScore !== '' && (
                      <div className="bg-red-900/50 p-2 rounded-xl border border-red-500 text-center animate-pulse">
                          <p className="text-[10px] text-red-200 font-bold mb-1">⚠️ 동점: 다음 라운드 진출 팀 선택</p>
                          <div className="flex gap-2 justify-center">
                              <button onClick={()=>setManualWinner('HOME')} className={`px-2 py-1 text-xs rounded border ${manualWinner==='HOME'?'bg-red-600 text-white border-red-400':'bg-black text-red-400 border-red-800'}`}>Home 승</button>
                              <button onClick={()=>setManualWinner('AWAY')} className={`px-2 py-1 text-xs rounded border ${manualWinner==='AWAY'?'bg-red-600 text-white border-red-400':'bg-black text-red-400 border-red-800'}`}>Away 승</button>
                          </div>
                      </div>
                  )}

                  <div className="w-full">
                      <label className="text-xs text-slate-500 mb-1 block text-center">YouTube Highlights URL</label>
                      <input value={inputs.youtube} onChange={e=>setInputs({...inputs,youtube:e.target.value})} placeholder="https://youtube.com/..." className="w-full bg-black p-3 rounded-xl text-center text-xs border border-slate-700 text-white text-base"/>
                  </div>
                  <button onClick={() => onSave(match.id, inputs.homeScore, inputs.awayScore, inputs.youtube, records, manualWinner)} className="bg-emerald-600 w-full py-4 rounded-xl font-black text-lg hover:bg-emerald-500 shadow-lg shadow-emerald-900/20">SAVE RESULT</button>
              </div>

              {/* Away */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="flex flex-col items-center mb-4"><img src={match.awayLogo} className="w-12 h-12 mb-2 object-contain" alt="" /><span className="font-bold text-white">{match.away}</span></div>
                  <datalist id="awayTeamPlayers">{teamPlayers(match.away).map((name, i) => <option key={i} value={name} />)}</datalist>
                  <div className="space-y-4">
                      <RecordInput type="awayScorer" inputValue={recordInput.awayScorer} onInputChange={(t,f,v)=>setRecordInput(p=>({...p,[t]:{...(p as any)[t],[f]:v}}))} onAdd={()=>handleRecordAdd('awayScorer','awayScorers')} onRemove={(t,id)=>handleRecordRemove('awayScorers',id,false)} records={records.awayScorers} label="⚽ Scorers" colorClass="text-emerald-400" datalistId="awayTeamPlayers" />
                      <RecordInput type="awayAssist" inputValue={recordInput.awayAssist} onInputChange={(t,f,v)=>setRecordInput(p=>({...p,[t]:{...(p as any)[t],[f]:v}}))} onAdd={()=>handleRecordAdd('awayAssist','awayAssists')} onRemove={(t,id)=>handleRecordRemove('awayAssists',id,false)} records={records.awayAssists} label="🅰️ Assists" colorClass="text-blue-400" datalistId="awayTeamPlayers" />
                  </div>
              </div>
          </div>
       </div>
    </div>
  );
};