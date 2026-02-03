/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo } from 'react';
import { Banner } from '../types';
// 👇 [수정] getBannerContent 제거 (이제 안 씁니다)

interface BannerSliderProps {
  banners: Banner[];
}

export const BannerSlider = ({ banners }: BannerSliderProps) => {
  const [bannerIdx, setBannerIdx] = useState<number>(0); 
  const [isBannerInitialized, setIsBannerInitialized] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // 🔥 [핵심] 배너 그리는 함수를 컴포넌트 안으로 가져왔습니다.
  const renderBannerContent = (b: Banner) => {
    if (b.url.includes('youtube') || b.url.includes('youtu.be')) {
        let vId = b.url.split('v=')[1];
        if (!vId && b.url.includes('youtu.be')) vId = b.url.split('/').pop();
        if (vId && vId.includes('&')) vId = vId.split('&')[0]; // 파라미터 제거
        
        const embedUrl = `https://www.youtube.com/embed/${vId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${vId}&playsinline=1`;
        
        return (
            <div className="w-full h-full bg-black">
                 <iframe 
                    src={embedUrl} 
                    className="w-full h-full object-cover pointer-events-none opacity-60" 
                    allow="autoplay; encrypted-media" 
                    title={b.description} 
                 />
                 {/* 터치 스크롤을 위한 투명 레이어 */}
                 <div className="absolute inset-0 z-20" />
            </div>
        );
    } else {
        return <img src={b.url} className="w-full h-full object-cover opacity-60" alt={b.description} />;
    }
  };

  const sortedBannersDisplay = useMemo(() => {
      return [...banners].sort((a,b) => {
        const aIsVid = a.url.includes('youtube') || a.url.includes('youtu.be');
        const bIsVid = b.url.includes('youtube') || b.url.includes('youtu.be');
        return (aIsVid === bIsVid) ? 0 : aIsVid ? -1 : 1;
    });
  }, [banners]);

  useEffect(() => {
    if (!sortedBannersDisplay || sortedBannersDisplay.length === 0) return;

    if (!isBannerInitialized) {
        const videoIndices = sortedBannersDisplay.map((b, i) => (b.url.includes('youtube') || b.url.includes('youtu.be')) ? i : -1).filter(i => i !== -1);
        if (videoIndices.length > 0) {
            const randomVideoIdx = videoIndices[Math.floor(Math.random() * videoIndices.length)];
            setBannerIdx(randomVideoIdx);
        } else {
            setBannerIdx(Math.floor(Math.random() * sortedBannersDisplay.length));
        }
        setIsBannerInitialized(true);
        return;
    }

    const currentBanner = sortedBannersDisplay[bannerIdx];
    if (!currentBanner) return;

    const isVideo = currentBanner.url.includes('youtube') || currentBanner.url.includes('youtu.be');
    const delay = isVideo ? 15000 : 5000; 

    const t = setTimeout(() => {
        let nextIdx = Math.floor(Math.random() * sortedBannersDisplay.length);
        if (sortedBannersDisplay.length > 1 && nextIdx === bannerIdx) {
            nextIdx = (nextIdx + 1) % sortedBannersDisplay.length;
        }
        setBannerIdx(nextIdx);
    }, delay);

    return () => clearTimeout(t);
  }, [sortedBannersDisplay, bannerIdx, isBannerInitialized]);

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const handleTouchEnd = () => { 
    if (!touchStart || !touchEnd) return; 
    const dist = touchStart - touchEnd; 
    if (dist > 50) setBannerIdx((p) => (p + 1) % sortedBannersDisplay.length); 
    if (dist < -50) setBannerIdx((p) => (p - 1 + sortedBannersDisplay.length) % sortedBannersDisplay.length); 
    setTouchStart(0); setTouchEnd(0); 
  };

  return (
    <div 
        className="w-full h-[225px] md:h-[330px] relative border-b border-slate-800 shadow-2xl overflow-hidden bg-black" 
        onTouchStart={handleTouchStart} 
        onTouchMove={handleTouchMove} 
        onTouchEnd={handleTouchEnd}
    >
        {sortedBannersDisplay.length > 0 ? sortedBannersDisplay.map((b, i) => (
            <div key={b.id || i} className={`absolute inset-0 transition-opacity duration-1000 ${i === (bannerIdx % sortedBannersDisplay.length) ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                {/* 👇 내부 함수 호출로 변경 */}
                {renderBannerContent(b)}
            </div>
        )) : null}
        
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent z-10 pointer-events-none" />
        
        {/* 배너 텍스트 (옵션) */}
        {sortedBannersDisplay[bannerIdx] && (
            <div className="absolute bottom-12 left-6 z-20">
                <p className="text-white text-xs font-bold bg-black/50 px-2 py-1 rounded backdrop-blur-sm border border-slate-700/50">
                    {sortedBannersDisplay[bannerIdx].description}
                </p>
            </div>
        )}
    </div>
  );
};