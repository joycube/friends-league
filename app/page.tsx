/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { doc, updateDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { Season, Match } from './types';

import { TopBar } from './components/TopBar';
import { NavTabs } from './components/NavTabs';
import { BannerSlider } from './components/BannerSlider';
import { Footer } from './components/Footer';
import { RankingView } from './components/RankingView';
import { ScheduleView } from './components/ScheduleView';
import { HistoryView } from './components/HistoryView';
import { TutorialView } from './components/TutorialView';
import { AdminView } from './components/AdminView';
import { MatchEditModal } from './components/MatchEditModal';

import { useLeagueData } from './hooks/useLeagueData';
import { useLeagueStats } from './hooks/useLeagueStats';

export default function FootballLeagueApp() {
  const { seasons, owners, masterTeams, leagues, banners, isLoaded } = useLeagueData();
  const [currentView, setCurrentView] = useState<'RANKING' | 'SCHEDULE' | 'HISTORY' | 'ADMIN' | 'TUTORIAL'>('RANKING');
  const [viewSeasonId, setViewSeasonId] = useState<number>(0);
  const [adminTab, setAdminTab] = useState<any>('NEW'); 
  
  const { activeRankingData, historyData } = useLeagueStats(seasons, viewSeasonId);
  
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  useEffect(() => {
    if (seasons.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const paramView = params.get('view');
    const paramSeasonId = Number(params.get('season'));

    if (paramView && ['RANKING', 'SCHEDULE', 'HISTORY', 'TUTORIAL', 'ADMIN'].includes(paramView)) {
        setCurrentView(paramView as any);
    }
    
    if (paramSeasonId && seasons.find(s => s.id === paramSeasonId)) {
        setViewSeasonId(paramSeasonId);
    } else if (viewSeasonId === 0) {
        setViewSeasonId(seasons[0].id);
    }
  }, [seasons]);

  useEffect(() => {
    if (viewSeasonId > 0) {
        const params = new URLSearchParams(window.location.search);
        params.set('view', currentView);
        params.set('season', String(viewSeasonId));
        window.history.replaceState(null, '', `?${params.toString()}`);
    }
  }, [currentView, viewSeasonId]);

  const handleMatchClick = (m: Match) => setEditingMatch(m);

  const handleSaveMatchResult = async (matchId: string, hScore: string, aScore: string, yt: string, records: any, manualWinner: 'HOME'|'AWAY'|null) => {
      if(!editingMatch) return;
      const s = seasons.find(se => se.id === editingMatch.seasonId);
      if(!s || !s.rounds) return;

      let newRounds = [...s.rounds];
      newRounds = newRounds.map(r => ({
          ...r,
          matches: r.matches.map(m => m.id === matchId ? { 
              ...m, 
              homeScore: hScore, awayScore: aScore, youtubeUrl: yt, status: 'FINISHED',
              homeScorers: records.homeScorers, awayScorers: records.awayScorers,
              homeAssists: records.homeAssists, awayAssists: records.awayAssists
          } : m)
      }));

      if (s.type === 'TOURNAMENT' && editingMatch.nextMatchId) {
          let winningTeam: {name: string, logo: string, owner: string} | null = null;
          const h = Number(hScore); const a = Number(aScore);
          
          if (h > a) winningTeam = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner};
          else if (a > h) winningTeam = {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner};
          else if (manualWinner) {
             winningTeam = manualWinner === 'HOME' 
                ? {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner}
                : {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner};
          } else {
              return alert("⚠️ 무승부입니다! 승부차기 승리팀을 선택해주세요.");
          }

          if (winningTeam) {
              newRounds = newRounds.map(r => ({ ...r, matches: r.matches.map(m => { 
                  if(m.id === editingMatch.nextMatchId) { 
                      const isHomeSlot = Number(editingMatch.id.split('_M')[1]) % 2 === 0; 
                      return isHomeSlot ? { ...m, home: winningTeam!.name, homeLogo: winningTeam!.logo, homeOwner: winningTeam!.owner } : { ...m, away: winningTeam!.name, awayLogo: winningTeam!.logo, awayOwner: winningTeam!.owner }; 
                  } 
                  return m; 
              }) }));
          }
      }

      await updateDoc(doc(db, "seasons", String(s.id)), { rounds: newRounds });
      setEditingMatch(null);
  };

  const handleCreateSeason = async (name: string, type: string, mode: string, prize: number, prizesObj: any) => {
      if(!name) return alert("시즌 이름을 입력하세요.");
      const id = Date.now();
      const newSeason: Season = { 
          id, name, type: type as any, leagueMode: mode as any, isActive: true, 
          teams: [], rounds: [], prizes: prizesObj 
      };
      await setDoc(doc(db, "seasons", String(id)), newSeason);
      setAdminTab(id); setViewSeasonId(id);
      alert("게임 생성 완료! 팀을 배정해주세요.");
  };

  const handleSaveOwner = async (name: string, photo: string, editId: string | null) => {
      if(!name) return;
      if (editId) {
          await updateDoc(doc(db, "users", editId), { nickname: name, photo });
          alert("오너 정보 수정 완료");
      } else {
          await addDoc(collection(db, "users"), { id: Date.now(), nickname: name, photo });
          alert("새 오너 등록 완료");
      }
  };

  const getTeamPlayers = (teamName: string) => {
      const players = new Set<string>();
      activeRankingData.players.forEach((p:any) => { if(p.team === teamName) players.add(p.name); });
      return Array.from(players);
  };

  const handleNavigateToSchedule = (seasonId: number) => {
      setCurrentView('SCHEDULE');
      setViewSeasonId(seasonId);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white font-black italic tracking-tighter overflow-x-hidden pb-20">
      <div className="relative">
          <BannerSlider banners={banners} />
          <TopBar />
      </div>

      <NavTabs currentView={currentView} setCurrentView={setCurrentView} />

      <main className="max-w-6xl mx-auto px-4 md:px-8 space-y-8">
        {currentView === 'RANKING' && (
            <RankingView 
                seasons={seasons} 
                viewSeasonId={viewSeasonId} 
                setViewSeasonId={setViewSeasonId} 
                activeRankingData={activeRankingData} 
            />
        )}

        {currentView === 'SCHEDULE' && (
            <ScheduleView 
                seasons={seasons} 
                viewSeasonId={viewSeasonId} 
                setViewSeasonId={setViewSeasonId} 
                onMatchClick={handleMatchClick}
                activeRankingData={activeRankingData}
                historyData={historyData}
            />
        )}

        {currentView === 'HISTORY' && (
            <HistoryView historyData={historyData} />
        )}

        {currentView === 'TUTORIAL' && (
            <TutorialView />
        )}

        {currentView === 'ADMIN' && (
            <AdminView 
                adminTab={adminTab}
                setAdminTab={setAdminTab}
                seasons={seasons}
                owners={owners}
                leagues={leagues}
                masterTeams={masterTeams}
                banners={banners} // 🔥 [추가] 여기!
                onAdminLogin={(pw) => pw === '0705'}
                onCreateSeason={handleCreateSeason}
                onSaveOwner={handleSaveOwner}
                onNavigateToSchedule={handleNavigateToSchedule} 
            />
        )}
      </main>

      <Footer />

      {editingMatch && (
          <MatchEditModal 
              match={editingMatch} 
              onClose={() => setEditingMatch(null)} 
              onSave={handleSaveMatchResult}
              isTournament={seasons.find(s=>s.id===editingMatch.seasonId)?.type === 'TOURNAMENT'}
              teamPlayers={getTeamPlayers}
          />
      )}
    </div>
  );
}