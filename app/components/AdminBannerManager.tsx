import React, { useState } from 'react';
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
import { Banner } from '../types'; 

export const AdminBannerManager = ({ banners }: { banners: Banner[] }) => {
    const [url, setUrl] = useState('');
    const [desc, setDesc] = useState('');

    const handleAdd = async () => {
        if(!url) return alert("URL을 입력해주세요.");
        await addDoc(collection(db, "banners"), { id: Date.now(), url, description: desc });
        setUrl(''); setDesc('');
    };
    
    const handleDel = async (id: string) => { if(confirm("삭제?")) await deleteDoc(doc(db,"banners",id)); };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-white font-bold text-sm">Add New Banner</h3>
                <div className="flex flex-col gap-2">
                     <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Image or YouTube URL" className="bg-slate-900 p-3 rounded text-sm text-white border border-slate-700"/>
                     <div className="flex gap-2">
                        <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description (Optional)" className="flex-1 bg-slate-900 p-3 rounded text-sm text-white border border-slate-700"/>
                        <button onClick={handleAdd} className="bg-emerald-600 px-6 rounded font-bold text-white hover:bg-emerald-500">Add</button>
                     </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {banners.map(b => (
                    <div key={b.id} className="bg-slate-950 p-3 rounded-xl flex gap-4 border border-slate-800 relative group hover:border-emerald-500 transition-all">
                        <div className="w-24 h-16 bg-black rounded-lg overflow-hidden flex-shrink-0 border border-slate-800">
                             {!b.url.includes('youtube') && <img src={b.url} className="w-full h-full object-cover" alt="" />}
                             {b.url.includes('youtube') && <div className="w-full h-full flex items-center justify-center text-red-500 font-bold bg-slate-900 text-xs">VIDEO</div>}
                        </div>
                        <div className="flex flex-col justify-center flex-1 min-w-0">
                            <span className="text-xs text-emerald-400 font-bold truncate mb-1">{b.description || 'No Description'}</span>
                            <span className="text-[10px] text-slate-500 truncate block bg-slate-900 p-1 rounded">{b.url}</span>
                        </div>
                        <button onClick={()=>b.docId && handleDel(b.docId)} className="absolute top-2 right-2 text-slate-600 hover:text-red-500 font-bold bg-black rounded-full w-6 h-6 flex items-center justify-center">×</button>
                    </div>
                ))}
                {banners.length === 0 && <p className="text-slate-500 text-center col-span-2 py-4">등록된 배너가 없습니다.</p>}
            </div>
        </div>
    );
};