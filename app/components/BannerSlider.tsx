/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo } from 'react';
import { Banner } from '../types';

interface BannerSliderProps {
  banners: Banner[];
}

export const BannerSlider = ({ banners }: BannerSliderProps) => {
  const [bannerIdx, setBannerIdx] = useState<number>(0); 
  const [isBannerInitialized, setIsBannerInitialized] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const renderBannerContent = (b: Banner) => {
    // URL이 없는 경우 대비
    const url = b.url || '';

    if (url.includes('youtube') || url.includes('youtu.be')) {
        let vId = url.split('v=')[1];
        
        // 🔥 [수정] .pop() 결과가 undefined일 수 있으므로 || '' 추가하여 타입 에러 해결
        if (!vId && url.includes('youtu.be')) {
            vId = url.split('/').pop() || '';
        }
        
        if (vId && vId.includes('&')) {
            vId = vId.split('&')[0];
        }
        
        // vId 추출 실패 시 렌더링 안 함
        if (!vId) return null;

        const embedUrl = `https://www.youtube.com/embed/${vId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${vId}&playsinline=1`;
        
        return (
            <div className="w-full h-full bg-black">
                 <iframe 
                    src={embedUrl} 
                    className="w-full h-full object-cover pointer-events-none opacity-60" 
                    allow="autoplay; encrypted-media" 
                    title={b.description || 'Banner Video'} 
                 />
                 <div className="absolute inset-0 z-20" />
            </div>
        );
    } else {
        return <img src={url} className="w-full h-full object-cover opacity-60" alt={b.description || 'Banner'} />;
    }
  };

  const sortedBannersDisplay = useMemo(() => {
      if (!banners) return [];
      return [...banners].sort((a,b) => {
        const urlA = a.url || '';
        const urlB = b.url || '';
        const aIsVid = urlA.includes('youtube') || urlA.includes('youtu.be');
        const bIsVid = urlB.includes('youtube') || urlB.includes('youtu.be');
        return (aIsVid === bIsVid) ? 0 : aIsVid ? -1 : 1;
    });
  }, [banners]);

  useEffect(() => {
    if (!sortedBannersDisplay || sortedBannersDisplay.length === 0) return;

    if (!isBannerInitialized) {
        const videoIndices = sortedBannersDisplay.map((b, i) => {
            const url = b.url || '';
            return (url.includes('youtube') || url.includes('youtu.be')) ? i : -1;
        }).filter(i => i !== -1);

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

    const url = currentBanner.url || '';
    const isVideo = url.includes('youtube') || url.includes('youtu.be');
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
                {renderBannerContent(b)}
            </div>
        )) : null}
        
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent z-10 pointer-events-none" />
        
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