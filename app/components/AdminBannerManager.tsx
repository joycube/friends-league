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

  // 유튜브 썸네일 추출 헬퍼
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
      alert("배너가 수정되었습니다.");
      resetForm();
    } else {
      await addDoc(collection(db, "banners"), { title, url, order: Date.now() });
      alert("새 배너가 등록되었습니다.");
      resetForm();
    }
  };

  const handleDelete = async () => {
    if (!editId) return;
    if (confirm("정말 이 배너를 삭제하시겠습니까?")) {
      await deleteDoc(doc(db, "banners", editId));
      resetForm();
    }
  };

  const handleEditClick = (b: Banner) => {
    setEditId(b.id!);
    setTitle(b.title);
    setUrl(b.url);
    // 상단으로 스크롤 이동하지 않도록 동작 수정 (팝업이나 모달 형태가 아니므로 자연스럽게)
  };

  const resetForm = () => {
    setEditId(null);
    setTitle('');
    setUrl('');
  };

  return (
    <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-700 space-y-6 animate-in fade-in">
      {/* 1. 업로드/수정 폼 (가로 배열) */}
      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <h4 className={`${editId ? 'text-orange-400' : 'text-blue-400'} text-xs font-bold flex items-center gap-2`}>
            {editId ? '🖼️ 배너 정보 수정' : '🖼️ 새 배너 등록'}
          </h4>
          {editId && <button onClick={resetForm} className="text-[10px] text-slate-500 underline">신규 등록으로 전환</button>}
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-1">
            <label className="text-xs text-slate-500 ml-1">배너 제목</label>
            <input 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="예: 2026 시즌 오픈" 
              className="w-full bg-slate-900 p-3 rounded-xl border border-slate-700 text-white text-sm outline-none focus:border-blue-500" 
            />
          </div>
          <div className="flex-[2] w-full space-y-1">
            <label className="text-xs text-slate-500 ml-1">미디어 URL (이미지 또는 유튜브)</label>
            <input 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              placeholder="https://..." 
              className="w-full bg-slate-900 p-3 rounded-xl border border-slate-700 text-white text-sm outline-none focus:border-blue-500" 
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={handleSave} 
              className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-colors ${editId ? 'bg-orange-600 text-white hover:bg-orange-500' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
            >
              {editId ? '수정 저장' : '등록'}
            </button>
            {editId && (
              <button 
                onClick={handleDelete} 
                className="px-4 py-3 rounded-xl font-bold text-sm bg-red-900/50 text-red-500 border border-red-900 hover:bg-red-900"
              >
                삭제
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. 등록된 배너 리스트 (썸네일 노출) */}
      <div>
        <p className="text-xs text-slate-500 mb-2 font-bold ml-1">등록된 배너 ({banners.length}) - 클릭하여 수정</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {banners.map(b => (
            <div 
              key={b.id} 
              onClick={() => handleEditClick(b)} 
              className={`relative group cursor-pointer rounded-xl overflow-hidden border transition-all aspect-video ${editId === b.id ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-slate-800 hover:border-blue-500'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={getThumbnail(b.url)} 
                alt={b.title} 
                className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" 
                onError={(e: any) => e.target.src = "https://via.placeholder.com/300x169?text=No+Image"}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2">
                <p className="text-[10px] text-white font-bold truncate">{b.title}</p>
                <p className="text-[8px] text-slate-400 truncate">{b.url}</p>
              </div>
              {/* Active Indicator */}
              {editId === b.id && (
                <div className="absolute top-2 right-2 bg-orange-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">
                  EDITING
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};