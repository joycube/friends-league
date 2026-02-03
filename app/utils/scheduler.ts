import { Season, Team, Match, Round, FALLBACK_IMG } from '../types';

// 🔥 [수정] DEFAULT_LEAGUES를 여기서 직접 정의합니다.
const DEFAULT_LEAGUES = ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'K League'];

// 토너먼트 단계명 생성기 (8강, 4강 등)
export const getTournamentStageName = (totalTeams: number, matchIndex: number): string => {
    // 8강 (4경기) -> 4강 (2경기) -> 결승 (1경기)
    if (totalTeams === 8) {
        if (matchIndex < 4) return 'Quarter-Final';
        if (matchIndex < 6) return 'Semi-Final';
        return 'Final';
    }
    // 4강 시작인 경우
    if (totalTeams === 4) {
        if (matchIndex < 2) return 'Semi-Final';
        return 'Final';
    }
    return `Round ${Math.floor(matchIndex / (totalTeams / 2)) + 1}`;
};

// 라운드/대진표 생성 로직 (핵심)
export const generateRoundsLogic = (season: Season): Round[] => {
    const teams = season.teams || [];
    const teamCount = teams.length;
    if (teamCount < 2) return [];

    let rounds: Round[] = [];

    // 1. 리그 모드 (풀리그)
    if (season.type === 'LEAGUE') {
        const isDouble = season.leagueMode === 'DOUBLE';
        const totalRounds = (teamCount % 2 === 0 ? teamCount - 1 : teamCount) * (isDouble ? 2 : 1);
        const matchesPerRound = Math.floor(teamCount / 2);
        
        // 팀 배열 복사 및 더미 팀 추가 (홀수일 경우)
        let leagueTeams = [...teams];
        if (teamCount % 2 !== 0) {
            leagueTeams.push({ name: 'BYE', logo: FALLBACK_IMG, ownerName: '-', id: -1, seasonId: season.id, region: '', tier: '', win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 });
        }
        const numTeams = leagueTeams.length;

        for (let r = 0; r < totalRounds; r++) {
            const roundMatches: Match[] = [];
            for (let i = 0; i < numTeams / 2; i++) {
                const home = leagueTeams[i];
                const away = leagueTeams[numTeams - 1 - i];
                
                // BYE 매칭 처리
                if (home.name === 'BYE' || away.name === 'BYE') continue;

                // 더블 라운드 처리 (절반 이후에는 홈/어웨이 반전)
                const isSecondHalf = r >= (totalRounds / (isDouble ? 2 : 1));
                
                roundMatches.push({
                    id: `${season.id}_R${r+1}_M${i}`,
                    seasonId: season.id,
                    home: isSecondHalf ? away.name : home.name,
                    away: isSecondHalf ? home.name : away.name,
                    homeLogo: isSecondHalf ? away.logo : home.logo,
                    awayLogo: isSecondHalf ? home.logo : away.logo,
                    homeOwner: isSecondHalf ? away.ownerName : home.ownerName,
                    awayOwner: isSecondHalf ? home.ownerName : away.ownerName,
                    homeScore: '', awayScore: '',
                    status: 'UPCOMING', youtubeUrl: '',
                    stage: 'Regular Season',
                    matchLabel: `R${r+1}`,
                    homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: []
                });
            }
            rounds.push({ round: r + 1, name: `Round ${r + 1}`, seasonId: season.id, matches: roundMatches });

            // 라운드 로빈 회전 (첫 팀 고정, 나머지 회전)
            leagueTeams = [leagueTeams[0], ...leagueTeams.slice(-1), ...leagueTeams.slice(1, -1)];
        }
    } 
    // 2. 토너먼트 모드
    else {
        // 8강, 4강 등 2의 제곱수로 맞춤 (부전승 처리 필요 시 사용)
        const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(teamCount)));
        let tourneyTeams = [...teams];
        
        // BYE 팀 채우기
        while(tourneyTeams.length < nextPowerOf2) {
             tourneyTeams.push({ name: 'BYE', logo: FALLBACK_IMG, ownerName: '-', id: -1, seasonId: season.id, region: '', tier: '', win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 });
        }

        const totalMatches = nextPowerOf2 - 1; // 8강이면 총 7경기 (4+2+1)
        const matches: Match[] = [];
        
        // 초기 1라운드 (8강 or 4강) 매칭 생성
        for (let i = 0; i < totalMatches; i++) {
            const isFirstRound = i < nextPowerOf2 / 2;
            let home = { name: 'TBD', logo: FALLBACK_IMG, owner: 'TBD' };
            let away = { name: 'TBD', logo: FALLBACK_IMG, owner: 'TBD' };

            // 첫 라운드는 실제 팀 배정
            if (isFirstRound) {
                home = { 
                    name: tourneyTeams[i * 2].name, 
                    logo: tourneyTeams[i * 2].logo, 
                    owner: tourneyTeams[i * 2].ownerName 
                };
                away = { 
                    name: tourneyTeams[i * 2 + 1].name, 
                    logo: tourneyTeams[i * 2 + 1].logo, 
                    owner: tourneyTeams[i * 2 + 1].ownerName 
                };
            }

            matches.push({
                id: `${season.id}_M${i}`,
                seasonId: season.id,
                home: home.name, away: away.name,
                homeLogo: home.logo, awayLogo: away.logo,
                homeOwner: home.owner, awayOwner: away.owner,
                homeScore: '', awayScore: '',
                status: (home.name === 'BYE' || away.name === 'BYE') ? 'BYE' : 'UPCOMING',
                youtubeUrl: '',
                stage: getTournamentStageName(nextPowerOf2, i),
                matchLabel: `Match ${i+1}`,
                homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [],
                // 다음 경기 ID 연결 (승자가 어디로 갈지)
                nextMatchId: i < totalMatches - 1 ? `${season.id}_M${Math.floor(nextPowerOf2 / 2 + i / 2)}` : null
            });
        }

        // 라운드별로 묶기 (UI 표현용)
        // 여기서는 편의상 Round 1에 다 몰아넣거나, 단계별로 나눌 수 있음.
        // UI가 단순 리스트라면 하나에 다 넣어도 무방.
        rounds.push({ round: 1, name: 'Tournament Bracket', seasonId: season.id, matches: matches });
    }

    return rounds;
};