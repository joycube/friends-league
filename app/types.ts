import React from 'react';

// --- Interfaces ---
export interface Season { 
  id: number; name: string; type: 'LEAGUE' | 'TOURNAMENT'; leagueMode?: 'SINGLE' | 'DOUBLE'; isActive: boolean;
  teams?: Team[]; rounds?: Round[]; 
  prizes: { total: number; first: number; second: number; third: number; scorer: number; assist: number; };
}
export interface Owner { id: number; nickname: string; photo: string; docId?: string; }
export interface League { id?: string; name: string; logo: string; category: 'CLUB' | 'NATIONAL'; }
export interface MasterTeam { id?: string; name: string; logo: string; category: 'CLUB' | 'NATIONAL'; region: string; tier: 'S' | 'A' | 'B' | 'C'; }
export interface Team { id: number; seasonId: number; name: string; logo: string; ownerName: string; region: string; tier: string; win: number; draw: number; loss: number; points: number; gf: number; ga: number; gd: number; rank?: number; currentPrize?: number; }
export interface MatchRecord { id: number; name: string; count: number; teamLogo?: string; }
export interface Match {
  id: string; seasonId: number; home: string; away: string; homeLogo: string; awayLogo: string;
  homeOwner: string; awayOwner: string; homeScore: string; awayScore: string;
  homeScorers: MatchRecord[]; awayScorers: MatchRecord[]; homeAssists: MatchRecord[]; awayAssists: MatchRecord[];
  status: 'UPCOMING' | 'FINISHED' | 'BYE'; youtubeUrl: string; stage?: string; matchLabel?: string; 
  nextMatchId?: string | null;
}
export interface Round { round: number; matches: Match[]; seasonId: number; name?: string; }
export interface Banner { id?: string; title: string; url: string; order: number; }

// --- Constants ---
export const LEAGUE_RANK: { [key: string]: number } = {
  "Premier League": 1, "La Liga": 2, "Bundesliga": 3, "Serie A": 4, "Ligue 1": 5, 
  "K League": 6, "J League": 7, "MLS": 8, "Saudi Pro League": 9,
  "Europe": 1, "South America": 2, "Asia/Oceania": 3, "North America": 4, "Africa": 5,
  "Others": 99, "무소속": 100
};

export const DEFAULT_LEAGUES = [
  "Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1", 
  "K League", "J League", "MLS", "Saudi Pro League",
  "Asia/Oceania", "Europe", "South America", "North America", "Africa", "Others", "무소속"
];
export const FALLBACK_IMG = "https://www.konami.com/efootball/s/img/main_page_1.png?v=903";

// --- Helper Functions ---
export const getBannerContent = (b: Banner) => {
  if(b.url.includes('youtube') || b.url.includes('youtu.be')) {
    const vId = b.url.includes('youtu.be') ? b.url.split('/').pop() : b.url.split('v=')[1]?.split('&')[0];
    return React.createElement('iframe', { className: "w-full h-full", src: `https://www.youtube.com/embed/${vId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${vId}`, frameBorder: "0", allow: "autoplay; encrypted-media", title: b.title });
  }
  return React.createElement('img', { src: b.url, alt: b.title, className: "w-full h-full object-cover opacity-80", onError: (e: any)=>{e.currentTarget.src=FALLBACK_IMG} });
};

export const getSortedTeamsLogic = (teams: MasterTeam[], search: string) => {
  let base = teams;
  if(search) base = base.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  return base.sort((a, b) => a.name.localeCompare(b.name));
};

export const getSortedLeagues = (leagueNames: string[]) => {
  return leagueNames.sort((a, b) => (LEAGUE_RANK[a] || 50) - (LEAGUE_RANK[b] || 50));
};

export const getTierColor = (tier: string = 'C') => {
  switch(tier) {
    case 'S': return 'bg-purple-600 text-white border-purple-400';
    case 'A': return 'bg-red-600 text-white border-red-400';
    case 'B': return 'bg-blue-600 text-white border-blue-400';
    case 'C': return 'bg-slate-600 text-slate-300 border-slate-500';
    default: return 'bg-slate-800 text-slate-500';
  }
};

export const getTierBadgeColor = (tier: string = 'C') => {
  switch(tier) {
    case 'S': return 'bg-purple-600 text-white';
    case 'A': return 'bg-red-600 text-white';
    case 'B': return 'bg-blue-600 text-white';
    case 'C': return 'bg-slate-600 text-slate-300';
    default: return 'bg-slate-800 text-slate-500';
  }
};

export const getTournamentStageName = (totalTeams: number, currentMatchCount: number) => {
  if (currentMatchCount === 1) return "Final (결승)";
  if (currentMatchCount === 2) return "Semi-Final (4강)";
  if (currentMatchCount === 4) return "Quarter-Final (8강)";
  if (currentMatchCount === 8) return "Round of 16 (16강)";
  return `Round of ${currentMatchCount * 2} (${currentMatchCount * 2}강)`;
};