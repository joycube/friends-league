import { useState, useEffect } from 'react';
import { db } from '../firebase';
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
        // 1. Owners
        const u1 = onSnapshot(query(collection(db, "users"), orderBy("id", "asc")), s => 
            setOwners(s.docs.map(d => ({ ...d.data(), docId: d.id } as unknown as Owner)))
        );

        // 2. Master Teams (수정됨: id를 덮어쓰지 않고 docId만 추가)
        const u2 = onSnapshot(collection(db, "master_teams"), s => 
            setMasterTeams(s.docs.map(d => ({ ...d.data(), docId: d.id } as unknown as MasterTeam)))
        );

        // 3. Seasons
        const u3 = onSnapshot(query(collection(db, "seasons"), orderBy("id", "desc")), s => { 
            setSeasons(s.docs.map(doc => doc.data() as Season)); 
            setIsLoaded(true);
        });

        // 4. Banners (수정됨: id를 덮어쓰지 않고 docId만 추가)
        const u4 = onSnapshot(collection(db, "banners"), s => 
            setBanners(s.docs.map(d => ({ ...d.data(), docId: d.id } as unknown as Banner)))
        );

        // 5. Leagues (수정됨: id를 덮어쓰지 않고 docId만 추가)
        const u5 = onSnapshot(collection(db, "leagues"), s => 
            setLeagues(s.docs.map(d => ({ ...d.data(), docId: d.id } as unknown as League)))
        );
        
        return () => { u1(); u2(); u3(); u4(); u5(); };
    }, []);

    return { seasons, owners, masterTeams, leagues, banners, isLoaded };
};