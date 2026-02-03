import { useState, useEffect } from 'react';
import { db } from '../firebase'; // 경로가 맞는지 확인 필요 (app 폴더 내부에 있으면 ../firebase)
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Season, Owner, League, MasterTeam, Banner } from '../types';

export const useLeagueData = () => {
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [owners, setOwners] = useState<Owner[]>([]);
    const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);
    const [leagues, setLeagues] = useState<League[]>([]);
    const [banners, setBanners] = useState<Banner[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const u1 = onSnapshot(query(collection(db, "users"), orderBy("id", "asc")), s => setOwners(s.docs.map(d => ({...d.data(), docId: d.id} as Owner))));
        const u2 = onSnapshot(collection(db, "master_teams"), s => setMasterTeams(s.docs.map(d => ({id:d.id, ...d.data()} as MasterTeam))));
        const u3 = onSnapshot(query(collection(db, "seasons"), orderBy("id", "desc")), s => { 
            setSeasons(s.docs.map(doc => doc.data() as Season)); 
            setIsLoaded(true);
        });
        const u4 = onSnapshot(collection(db, "banners"), s => setBanners(s.docs.map(d => ({id:d.id, ...d.data()} as Banner))));
        const u5 = onSnapshot(collection(db, "leagues"), s => setLeagues(s.docs.map(d => ({id:d.id, ...d.data()} as League))));
        
        return () => { u1(); u2(); u3(); u4(); u5(); };
    }, []);

    return { seasons, owners, masterTeams, leagues, banners, isLoaded };
};