// app/utils/helpers.ts
import { MasterTeam, FALLBACK_IMG } from '../types';

// 팀 정렬 및 검색 로직
export const getSortedTeamsLogic = (teams: MasterTeam[], search: string) => {
    let filtered = teams;
    if (search) {
        filtered = teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
    }
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
};

// 리그 목록 정렬 (유럽 5대 리그 우선)
export const getSortedLeagues = (leagues: string[]) => {
    const priority = ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1'];
    return leagues.sort((a, b) => {
        const idxA = priority.indexOf(a);
        const idxB = priority.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });
};

// 티어 뱃지 색상 반환
export const getTierBadgeColor = (tier: string) => {
    switch (tier) {
        case 'S': return 'bg-purple-600 text-white border-purple-400';
        case 'A': return 'bg-emerald-600 text-white border-emerald-400';
        case 'B': return 'bg-blue-600 text-white border-blue-400';
        case 'C': return 'bg-slate-600 text-white border-slate-400';
        default: return 'bg-slate-800 text-slate-500';
    }
};

// 유튜브 썸네일 추출 함수
export const getYouTubeThumbnail = (url: string) => {
    if (!url) return FALLBACK_IMG;
    const vId = url.includes('youtu.be') 
        ? url.split('/').pop() 
        : url.split('v=')[1]?.split('&')[0];
    return vId ? `https://img.youtube.com/vi/${vId}/mqdefault.jpg` : FALLBACK_IMG;
};