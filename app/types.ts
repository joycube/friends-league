// app/types.ts
export const FALLBACK_IMG = "https://img.icons8.com/ios-filled/50/ffffff/football.png";

export interface Season {
  id: number;
  name: string;
  type: 'LEAGUE' | 'TOURNAMENT';
  leagueMode: 'SINGLE' | 'DOUBLE';
  isActive: boolean;
  teams: Team[];
  rounds: Round[];
  prizes: any;
}

export interface Team {
  id: number;
  seasonId: number;
  name: string;
  logo: string;
  ownerName: string;
  region: string;
  tier: string;
  win: number;
  draw: number;
  loss: number;
  points: number;
  gf: number;
  ga: number;
  gd: number;
  rank?: number;
  currentPrize?: number;
}

export interface Match {
  id: string;
  seasonId: number;
  home: string;
  away: string;
  homeLogo: string;
  awayLogo: string;
  homeOwner: string;
  awayOwner: string;
  homeScore: string;
  awayScore: string;
  status: 'UPCOMING' | 'FINISHED' | 'BYE';
  youtubeUrl: string;
  stage: string;
  matchLabel: string;
  homeScorers: any[];
  awayScorers: any[];
  homeAssists: any[];
  awayAssists: any[];
  nextMatchId?: string | null;
}

export interface Round {
  round: number;
  name: string;
  seasonId: number;
  matches: Match[];
}

export interface Owner {
  id: number;
  nickname: string;
  photo: string;
  docId?: string; // 🔥 추가됨
}

export interface League {
  id: number;
  name: string;
  logo: string;
  category: 'CLUB' | 'NATIONAL';
  docId?: string; // 🔥 추가됨
}

export interface MasterTeam {
  id: number;
  name: string;
  logo: string;
  region: string;
  tier: string;
  category: string;
  docId?: string; // 🔥 추가됨
}

export interface Banner {
  id: number;
  url: string;
  description: string;
  docId?: string; // 🔥 추가됨
}