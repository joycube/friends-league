import { Match } from '../types';
import { COMMENTARY_POOL } from '../commentaryData'; // 경로 확인 필요

export const getMatchCommentary = (m: Match): string | null => {
    if (m.status !== 'FINISHED') return null;
    
    const homeScore = Number(m.homeScore);
    const awayScore = Number(m.awayScore);
    const diff = Math.abs(homeScore - awayScore);
    const totalGoals = homeScore + awayScore;
    const winnerName = homeScore > awayScore ? m.home : m.away;
    const loserName = homeScore > awayScore ? m.away : m.home;
    
    const pick = (arr: string[]) => {
        if (!arr || arr.length === 0) return "멋진 경기였습니다!";
        let text = arr[Math.floor(Math.random() * arr.length)];
        // Replace Placeholders
        text = text.replace(/\[WIN\]/g, winnerName)
                   .replace(/\[LOSE\]/g, loserName)
                   .replace(/\[HOME\]/g, m.home)
                   .replace(/\[AWAY\]/g, m.away);
        return text;
    };

    if (diff >= 4) return pick(COMMENTARY_POOL.THRASHING);
    if (totalGoals >= 5 && diff === 1) return pick(COMMENTARY_POOL.GOAL_FEST);
    if (diff === 1) return pick(COMMENTARY_POOL.NARROW_WIN);
    if (diff === 0 && totalGoals > 0) return pick(COMMENTARY_POOL.SCORING_DRAW);
    if (totalGoals === 0) return pick(COMMENTARY_POOL.BORE_DRAW);
    
    return pick(COMMENTARY_POOL.GENERAL_WIN);
};