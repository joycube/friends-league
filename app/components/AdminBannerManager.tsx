import React, { useState } from 'react';
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
import { Banner } from '../types'; 

// ❌ [삭제] getBannerContent import 제거 (에러 원인)

export const AdminBannerManager = ({ banners }: { banners: Banner[] }) => {
    const [url, setUrl] = useState('');
    const [desc, setDesc] = useState('');

    const handleAdd = async () => {
        if(!url) return;
        await addDoc(collection(db, "banners"), { id: Date.now(), url, description: desc });
        setUrl(''); setDesc('');
    };
    
    // docId가 있는 경우에만 삭제 수행
    const handleDel = async (id: string) => { if(confirm("삭제?")) await deleteDoc(doc(db,"banners",id)); };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Image or YouTube URL" className="flex-1 bg-slate-800 p-2 rounded text-xs"/>
                <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description" className="flex-1 bg-slate-800 p-2 rounded text-xs"/>
                <button onClick={handleAdd} className="bg-emerald-600 px-4 rounded text-xs font-bold">Add</button>
            </div>
            <div className="space-y-2">
                {banners.map(b => (
                    <div key={b.id} className="bg-slate-950 p-2 rounded flex justify-between items-center border border-slate-800">
                        <div className="flex flex-col w-3/4">
                             {/* 미리보기 대신 텍스트 정보 표시로 변경하여 에러 방지 */}
                            <span className="text-[10px] text-emerald-400 font-bold truncate">{b.description || 'No Description'}</span>
                            <span className="text-[10px] text-slate-500 truncate">{b.url}</span>
                        </div>
                        <button onClick={()=>b.docId && handleDel(b.docId)} className="text-red-500 font-bold px-2">×</button>
                    </div>
                ))}
            </div>
        </div>
    );
};