import React from 'react';

export const TutorialView = () => {
  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800">
            <h2 className="text-xl font-bold text-emerald-400 mb-4">📘 리그 운영 가이드</h2>
            <div className="space-y-6 text-sm text-slate-300">
                <div><h3 className="text-white font-bold mb-1">1. 오너 생성 (ADMIN)</h3><p>어드민 메뉴의 &apos;오너 관리&apos; 탭에서 참가할 오너(플레이어)를 먼저 등록하세요.</p></div>
                <div><h3 className="text-white font-bold mb-1">2. 시즌/게임 생성</h3><p>&apos;새 시즌&apos; 탭에서 시즌 이름, 타입(리그/토너먼트), 상금을 설정하고 생성합니다.</p></div>
                <div><h3 className="text-white font-bold mb-1">3. 팀 배정</h3><p>생성된 시즌 ID를 선택하고, 오너에게 팀을 배정합니다. 필터를 사용하여 원하는 리그의 팀을 찾거나 랜덤 배정 기능을 활용하세요.</p></div>
                <div><h3 className="text-white font-bold mb-1">4. 스케줄 & 기록</h3><p>팀 배정이 완료되면 자동으로 대진표가 생성됩니다. &apos;SCHEDULE&apos; 메뉴에서 각 경기를 클릭하여 스코어, 득점자, 어시스트, 유튜브 링크를 입력하세요.</p></div>
            </div>
        </div>
    </div>
  );
};