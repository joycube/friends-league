// app/components/RecordInput.tsx
import React from 'react';

export const RecordInput = ({ type, inputValue, onInputChange, onAdd, onRemove, records, label, colorClass }: any) => {
  return (
    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 h-full flex flex-col relative z-10">
      <p className={`text-xs font-bold mb-2 uppercase ${colorClass} border-b border-slate-700/50 pb-1`}>{label}</p>
      <div className="flex gap-2 mb-3">
        <input type="text" value={inputValue.name} onChange={(e) => onInputChange(type, 'name', e.target.value)} placeholder="Player Name" className="flex-1 bg-slate-900 text-base p-2 rounded-lg border border-slate-600 focus:border-blue-500 outline-none text-white w-full" />
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