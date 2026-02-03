import { Season, Team, Match, Round, DEFAULT_LEAGUES, FALLBACK_IMG } from '../types';

// 토너먼트 단계명 생성기 (8강, 4강 등)
export const getTournamentStageName = (totalTeams: number, matchIndex: number): string => {
    if (totalTeams === 2) return "FINAL";
    if (totalTeams === 4) return "SEMI FINAL";
    if (totalTeams === 8) return "QUARTER FINAL";
    if (totalTeams === 16) return "ROUND OF 16";
    return `ROUND OF ${totalTeams}`;
};

// 🔥 핵심 스케줄 생성 로직
export const generateRoundsLogic = (s: Season, teams: Team[]): Round[] => {
    let rounds: Round[] = [];

    // --- 1. LEAGUE LOGIC ---
    if (s.type === 'LEAGUE') {
        const teamsByOwner: Record<string, Team[]> = {};
        teams.forEach(t => {
            if (!teamsByOwner[t.ownerName]) teamsByOwner[t.ownerName] = [];
            teamsByOwner[t.ownerName].push(t);
        });
        const ownerKeys = Object.keys(teamsByOwner);
        const maxTeamsPerOwner = Math.max(...Object.values(teamsByOwner).map(t => t.length));
        
        // Smart Avoidance Condition (Symmetric: Even Owners, Equal Teams)
        const isSymmetric = ownerKeys.length > 0 && ownerKeys.length % 2 === 0 && ownerKeys.every(o => teamsByOwner[o].length === maxTeamsPerOwner);

        if (isSymmetric) {
            console.log("⚡ Generating Smart Avoidance Schedule...");
            const numOwners = ownerKeys.length;
            const teamsPerOwner = maxTeamsPerOwner;
            let currentOwnerList = [...ownerKeys]; 
            let roundCounter = 1;

            for (let r = 0; r < numOwners - 1; r++) {
                const ownerPairs: [string, string][] = [];
                for(let i=0; i<numOwners/2; i++) {
                    ownerPairs.push([currentOwnerList[i], currentOwnerList[numOwners-1-i]]);
                }

                for (let sub = 0; sub < teamsPerOwner; sub++) {
                    let subRoundMatches: Match[] = [];
                    ownerPairs.forEach(pair => {
                        const ownerA = pair[0];
                        const ownerB = pair[1];
                        const teamsA = teamsByOwner[ownerA];
                        const teamsB = teamsByOwner[ownerB];

                        for (let t = 0; t < teamsPerOwner; t++) {
                            const team1 = teamsA[t];
                            const team2 = teamsB[(t + sub) % teamsPerOwner];
                            
                            // H/A Alternation Logic (Smart)
                            const isHome = (r + sub + t) % 2 === 0;
                            const h = isHome ? team1 : team2;
                            const a = isHome ? team2 : team1;

                            subRoundMatches.push({
                                id: `${s.id}_R${roundCounter}_M${subRoundMatches.length}`, seasonId: s.id,
                                home: h.name, away: a.name,
                                homeLogo: h.logo, awayLogo: a.logo,
                                homeOwner: h.ownerName, awayOwner: a.ownerName,
                                homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'UPCOMING', youtubeUrl: '', stage: `Round ${roundCounter}`, matchLabel: `Match`
                            });
                        }
                    });
                    
                    if (subRoundMatches.length > 0) {
                        rounds.push({ round: roundCounter, matches: subRoundMatches, seasonId: s.id, name: `Round ${roundCounter}` });
                        roundCounter++;
                    }
                }
                // Rotate Owners
                const first = currentOwnerList[1];
                const rest = currentOwnerList.slice(2);
                currentOwnerList = [currentOwnerList[0], ...rest, first];
            }

        } else {
            // Standard Shuffle (Fallback)
            console.log("🎲 Generating Standard Schedule...");
            let shuffled: Team[] = [];
            const teamsByOwner: { [key: string]: Team[] } = {};
            teams.forEach(t => { if(!teamsByOwner[t.ownerName]) teamsByOwner[t.ownerName] = []; teamsByOwner[t.ownerName].push(t); });
            const ownerNames = Object.keys(teamsByOwner).sort(() => Math.random() - 0.5);
            let maxTeams = 0; Object.values(teamsByOwner).forEach(arr => maxTeams = Math.max(maxTeams, arr.length));
            for(let i=0; i<maxTeams; i++) { ownerNames.forEach(owner => { if(teamsByOwner[owner][i]) shuffled.push(teamsByOwner[owner][i]); }); }
            
            const dummyTeam = {id:0, seasonId:s.id, name:'BYE', logo:FALLBACK_IMG, ownerName:'-', region:'', tier:'', win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0};
            if(shuffled.length % 2 !== 0) shuffled.push(dummyTeam as Team);
            const numTeams = shuffled.length; const numRounds = numTeams - 1; const half = numTeams / 2;
            let teamsArr = [...shuffled];

            for(let r = 0; r < numRounds; r++) { 
                let roundMatches: Match[] = []; 
                for(let i=0; i<half; i++) { 
                    const t1 = teamsArr[i]; 
                    const t2 = teamsArr[numTeams - 1 - i]; 
                    
                    // Checkerboard H/A
                    let home, away;
                    if ((r + i) % 2 === 0) { home = t1; away = t2; }
                    else { home = t2; away = t1; }

                    if(home.name !== 'BYE' && away.name !== 'BYE') { 
                        roundMatches.push({
                            id: `${s.id}_R${r+1}_M${i}`, seasonId: s.id, home: home.name, away: away.name, homeLogo: home.logo, awayLogo: away.logo, homeOwner: home.ownerName, awayOwner: away.ownerName,
                            homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'UPCOMING', youtubeUrl: '', stage: `Round ${r+1}`, matchLabel: `Game ${i+1}`
                        }); 
                    } 
                } 
                rounds.push({round: r+1, matches: roundMatches, seasonId: s.id, name: `Round ${r+1}`});
                const first = teamsArr[0]; const rest = teamsArr.slice(1);
                teamsArr = [first, rest[rest.length - 1], ...rest.slice(0, rest.length - 1)];
            }
        }

        if(s.leagueMode === 'DOUBLE') { 
            const initialRoundsCount = rounds.length; 
            const newRounds: Round[] = []; 
            rounds.forEach((r, idx) => { 
                const returnMatches = r.matches.map(m => ({ ...m, id: m.id + '_return', home: m.away, away: m.home, homeLogo: m.awayLogo, awayLogo: m.homeLogo, homeOwner: m.awayOwner, awayOwner: m.homeOwner, stage: `Round ${initialRoundsCount + idx + 1}` })); 
                newRounds.push({round: initialRoundsCount + idx + 1, matches: returnMatches, seasonId: s.id, name: `Round ${initialRoundsCount + idx + 1}` }); 
            }); 
            newRounds.forEach((r, idx) => { r.name = `Round ${initialRoundsCount + idx + 1}`; });
            rounds.push(...newRounds);
        }
    } 
    
    // --- 2. TOURNAMENT LOGIC ---
    else {
        let shuffled = [...teams].sort(() => Math.random() - 0.5);
        for(let i=0; i<shuffled.length-1; i+=2) { if(shuffled[i].ownerName === shuffled[i+1]?.ownerName) { for(let j=i+2; j<shuffled.length; j++) { if(shuffled[j].ownerName !== shuffled[i].ownerName) { const temp = shuffled[i+1]; shuffled[i+1] = shuffled[j]; shuffled[j] = temp; break; } } } }
        const nextPow2 = Math.pow(2, Math.ceil(Math.log2(shuffled.length))); const matchCount = nextPow2 / 2; 
        let matches: Match[] = [];
        for(let i=0; i<matchCount; i++) { const h = shuffled[i*2], a = shuffled[i*2+1]; const stageName = getTournamentStageName(nextPow2, matchCount);
           matches.push(a ? { id: `${s.id}_R1_M${i}`, seasonId: s.id, home: h.name, away: a.name, homeLogo: h.logo, awayLogo: a.logo, homeOwner: h.ownerName, awayOwner: a.ownerName, homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'UPCOMING', youtubeUrl: '', stage: stageName, matchLabel: `Match ${i+1}`, nextMatchId: `${s.id}_R2_M${Math.floor(i/2)}` } : { id: `${s.id}_R1_M${i}`, seasonId: s.id, home: h.name, away: 'BYE (부전승)', homeLogo: h.logo, awayLogo: FALLBACK_IMG, homeOwner: h.ownerName, awayOwner: '-', homeScore: '1', awayScore: '0', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'BYE', youtubeUrl: '', stage: stageName, matchLabel: `Match ${i+1}`, nextMatchId: `${s.id}_R2_M${Math.floor(i/2)}` });
        }
        rounds.push({ round: 1, matches, seasonId: s.id, name: getTournamentStageName(nextPow2, matchCount) });
        let rIdx = 2; let currentCount = matchCount / 2;
        while(currentCount >= 0.5) {
            let nextMatches: Match[] = []; const stageName = getTournamentStageName(nextPow2, currentCount);
            for(let i=0; i < Math.ceil(currentCount); i++) {
                const nextId = currentCount > 0.5 ? `${s.id}_R${rIdx+1}_M${Math.floor(i/2)}` : null; 
                nextMatches.push({ id: `${s.id}_R${rIdx}_M${i}`, seasonId: s.id, home: 'TBD', away: 'TBD', homeLogo: FALLBACK_IMG, awayLogo: FALLBACK_IMG, homeOwner: '-', awayOwner: '-', homeScore: '', awayScore: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], status: 'UPCOMING', youtubeUrl: '', stage: stageName, matchLabel: `Match ${i+1}`, nextMatchId: nextId }); 
            }
            rounds.push({ round: rIdx, matches: nextMatches, seasonId: s.id, name: stageName });
            if(currentCount === 0.5) break; currentCount /= 2; rIdx++;
        }
    }
    return rounds;
};