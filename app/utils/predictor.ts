// app/utils/predictor.ts

// 승률 계산 로직
export const getPrediction = (
    homeName: string, 
    awayName: string, 
    activeRankingData: any = { teams: [] }, 
    historyData: any = { teams: [] }
  ) => {
      const getTeamScore = (name: string) => {
          if (name === 'TBD' || name === 'BYE') return 0;
          
          // 현재 시즌 성적 (가중치 70%)
          const current = activeRankingData?.teams?.find((t: any) => t.name === name);
          const currentPts = current 
              ? (current.points / (current.win + current.draw + current.loss || 1)) * 20 
              : 10; 
          
          // 역대 기록 성적 (가중치 30%)
          const hist = historyData?.teams?.find((t: any) => t.name === name);
          const histWinRate = hist 
              ? (hist.win / (hist.win + hist.draw + hist.loss || 1)) * 100 
              : 30; 
          
          return (currentPts * 0.7) + (histWinRate * 0.3);
      };
  
      const hPower = getTeamScore(homeName);
      const aPower = getTeamScore(awayName);
      const total = hPower + aPower;
  
      // 데이터 부족 시 50:50
      if (total === 0) return { hRate: 50, aRate: 50 };
  
      const hRate = Math.round((hPower / total) * 100);
      const aRate = 100 - hRate;
  
      return { hRate, aRate };
  };