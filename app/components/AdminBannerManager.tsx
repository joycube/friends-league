import React, { useState } from 'react';
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
// 👇 [수정] 타입과 함수 분리
import { Banner } from '../types'; 
import { getBannerContent } from '../utils/helpers'; 

export const AdminBannerManager = ({ banners }: { banners: Banner[] }) => {
    const [url, setUrl] = useState('');
    const [desc, setDesc] = useState('');

    const handleAdd = async () => {
        if(!url) return;
        await addDoc(collection(db, "banners"), { id: Date.now(), url, description: desc });
        setUrl(''); setDesc('');
    };
    
    // 👇 docId 타입 에러 해결됨 (types.ts 수정 덕분)
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
                        <span className="text-xs truncate w-1/2">{b.url}</span>
                        <button onClick={()=>b.docId && handleDel(b.docId)} className="text-red-500">×</button>
                    </div>
                ))}
            </div>
        </div>
    );
};