// app/components/AdminBannerManager.tsx
import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Banner } from '../types';

interface Props {
  banners: Banner[];
}

export const AdminBannerManager = ({ banners }: Props) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const getThumbnail = (url: string) => {
    if (url.includes('youtube') || url.includes('youtu.be')) {
      const vId = url.includes('youtu.be') ? url.split('/').pop() : url.split('v=')[1]?.split('&')[0];
      return `https://img.youtube.com/vi/${vId}/mqdefault.jpg`;
    }
    return url;
  };

  const handleSave = async () => {
    if (!title || !url) return alert("제목과 URL을 입력하세요.");
    if (editId) {
      await updateDoc(doc(db, "banners", editId), { title, url });
      resetForm();
    } else {
      await addDoc(collection(db, "banners"), { title, url, order: Date.now() });
      resetForm();
    }
  };

  const handleDelete = async () => {
    if (!editId) return;
    if (confirm("삭제하시겠습니까?")) {
      await deleteDoc(doc(db, "banners", editId));
      resetForm();
    }
  };

  const handleEditClick = (b: Banner) => {
    setEditId(b.id!); setTitle(b.title); setUrl(b.url);
  };

  const resetForm = () => {
    setEditId(null); setTitle(''); setUrl('');
  };

  return (
    <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-700 space-y-6 animate-in fade-in">
      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <h4 className={`${editId ? 'text-orange-400' : 'text-blue-400'} text-xs font-bold`}>{editId ? '🖼️ 배너 수정' : '🖼️ 배너 등록'}</h4>
          {editId && <button onClick={resetForm} className="text-[10px] text-slate-500 underline">취소</button>}
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-1"><label className="text-xs text-slate-500 ml-1">제목</label><input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-900 p-3 rounded-xl border border-slate-700 text-white text-sm outline-none" /></div>
          <div className="flex-[2] w-full space-y-1"><label className="text-xs text-slate-500 ml-1">URL (유튜브/이미지)</label><input value={url} onChange={e => setUrl(e.target.value)} className="w-full bg-slate-900 p-3 rounded-xl border border-slate-700 text-white text-sm outline-none" /></div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={handleSave} className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm ${editId ? 'bg-orange-600' : 'bg-blue-600'}`}>{editId ? '수정' : '등록'}</button>
            {editId && <button onClick={handleDelete} className="px-4 py-3 rounded-xl font-bold text-sm bg-red-900/50 text-red-500 border border-red-900">삭제</button>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {banners.map(b => (
          <div key={b.id} onClick={() => handleEditClick(b)} className={`relative group cursor-pointer rounded-xl overflow-hidden border transition-all aspect-video ${editId === b.id ? 'border-orange-500 ring-2' : 'border-slate-800'}`}>
            <img src={getThumbnail(b.url)} alt={b.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-100" onError={(e:any)=>e.target.src="https://via.placeholder.com/300x169?text=No+Image"} />
            <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2"><p className="text-[10px] text-white font-bold truncate">{b.title}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
};