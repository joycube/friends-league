import React from 'react';

interface RecordInputProps {
  type: string;
  inputValue: { name: string, count: string };
  onInputChange: (type: string, field: string, value: string) => void;
  onAdd: (type: string) => void;
  onRemove: (type: string, id: number) => void;
  records: any[];
  label: string;
  colorClass: string;
  datalistId: string;
}

// 🔥 [핵심] export const 로 시작해야 다른 파일에서 찾을 수 있습니다.
export const RecordInput = ({ type, inputValue, onInputChange, onAdd, onRemove, records, label, colorClass, datalistId }: RecordInputProps) => {
  return (
    <div className="space-y-2">
      <label className={`text-xs font-bold ${colorClass}`}>{label}</label>
      <div className="flex gap-1">
        <input 
          list={datalistId}
          value={inputValue.name} 
          onChange={(e) => onInputChange(type, 'name', e.target.value)} 
          placeholder="Player Name" 
          className="bg-black border border-slate-700 p-2 rounded flex-1 text-white text-xs"
        />
        <input 
          type="number" 
          value={inputValue.count} 
          onChange={(e) => onInputChange(type, 'count', e.target.value)} 
          className="bg-black border border-slate-700 p-2 rounded w-12 text-center text-white text-xs"
        />
        <button onClick={() => onAdd(type)} className={`px-3 rounded font-bold text-xs ${colorClass === 'text-emerald-400' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-blue-900/50 text-blue-400'}`}>+</button>
      </div>
      <div className="space-y-1">
        {records.map((r: any) => (
          <div key={r.id} className="flex justify-between items-center bg-slate-900 px-2 py-1 rounded border border-slate-800">
            <span className="text-white text-[10px]">{r.name} ({r.count})</span>
            <button onClick={() => onRemove(type, r.id)} className="text-red-500 font-bold text-[10px]">×</button>
          </div>
        ))}
      </div>
    </div>
  );
};