/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { db } from '../firebase';
import { updateDoc, addDoc, collection, doc } from 'firebase/firestore';
import { Owner } from '../types';

export const AdminOwnerManager = ({ owners }: { owners: Owner[] }) => {
    const [name, setName] = useState('');
    const [photo, setPhoto] = useState('');
    const [editId, setEditId] = useState<string | null>(null);

    const handleSave = async () => {
        if (!name) return alert("이름을 입력하세요.");
        if (editId) {
            await updateDoc(doc(db, "users", editId), { nickname: name, photo });
            setEditId(null);
        } else {
            await addDoc(collection(db, "users"), { id: Date.now(), nickname: name, photo });
        }
        setName(''); setPhoto('');
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex gap-2 mb-4">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Owner Name" className="bg-slate-950 p-3 rounded w-full text-base text-white border border-slate-700" />
                <input value={photo} onChange={e => setPhoto(e.target.value)} placeholder="Photo URL" className="bg-slate-950 p-3 rounded w-full text-base text-white border border-slate-700" />
                <button onClick={handleSave} className="bg-purple-600 px-6 rounded font-bold hover:bg-purple-500">Save</button>
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                {owners.map(o => (
                    <div key={o.id} onClick={() => { setEditId(o.docId!); setName(o.nickname); setPhoto(o.photo); }} className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer border transition-colors ${editId === o.docId ? 'bg-purple-900/30 border-purple-500' : 'bg-slate-950 border-slate-800 hover:border-emerald-500'}`}>
                        <img src={o.photo} className="w-10 h-10 rounded-full object-cover" alt="" />
                        <span className="font-bold text-white">{o.nickname}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};