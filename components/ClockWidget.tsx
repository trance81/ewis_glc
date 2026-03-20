// 시계 위젯 컴포넌트
// 시계 표시, 배터리 상태 표시, 새로고침 버튼을 포함하는 위젯입니다.

import React, { useRef } from 'react';
import { RefreshCw, Battery, BatteryCharging } from 'lucide-react';
import { BatteryStatus } from '../types';
import { formatTime } from '../utils/time';

/**
 * ClockWidget Props 타입 정의
 */
interface ClockWidgetProps {
  /** 현재 시간 (Date 객체) */
  time: Date;
  /** 배터리 상태 */
  battery: BatteryStatus;
  /** 로딩 중인지 여부 */
  loading: boolean;
  /** 시계 영역의 flex 비율 */
  clockFlex: number;
  /** 시계 폰트 크기 (rem 단위) */
  clockFontSize: number;
  /** 설정 모달을 여는 함수 (시계 클릭 시 호출) */
  onSettingsClick: () => void;
  /** 날씨 새로고침 함수 (새로고침 버튼 클릭 시 호출) */
  onRefreshClick: () => void;
}

/**
 * 시계 위젯 컴포넌트
 * 시계 표시, 배터리 상태, 새로고침 버튼을 포함합니다.
 */
export const ClockWidget: React.FC<ClockWidgetProps> = ({
  time,
  battery,
  loading,
  clockFlex,
  clockFontSize,
  onSettingsClick,
  onRefreshClick
}) => {
  // 시간 포맷팅 (시, 분, 초를 문자열로 변환)
  const { h, m } = formatTime(time);
  const seconds = time.getSeconds();
  // 초 진행률: 현재 분 안에서 0~59초 범위를 0~100%로 매핑
  const secondsProgress = Math.max(0, Math.min(1, seconds / 59));

  // 번인 방지 패턴 랜덤화: 페이지 로드 시 랜덤하게 패턴 선택 (픽셀 편중 방지)
  // useRef를 사용하여 컴포넌트 재렌더링 시에도 같은 값 유지
  const burnInPatternRef = useRef(Math.floor(Math.random() * 4)); // 0~3 중 랜덤
  const burnInPatternClass = burnInPatternRef.current === 0 
    ? 'burn-in-prevention-clock' 
    : `burn-in-prevention-clock-alt-${burnInPatternRef.current}`;

  return (
    <div 
      className="bg-[#0d0d0d] rounded-[2rem] md:rounded-[2.5rem] border border-white/5 flex items-center justify-center relative overflow-hidden group"
      style={{ flex: `${clockFlex}` }}
    >
      {/* 좌측 상단: 배터리 상태 표시기 */}
      <div 
        className="absolute top-2 left-4 z-20 burn-in-prevention-buttons"
        style={{ willChange: 'transform' }}
      >
        <div className="p-1.5 bg-white/5 rounded-full border border-white/5 text-gray-400 hover:text-white transition-all active:scale-95 flex items-center gap-1.5">
          <span className="text-[10px] font-bold tabular-nums">{battery.level}%</span>
          <div className="relative">
            {battery.charging ? (
              <BatteryCharging className="w-4 h-4 text-green-500" />
            ) : (
              <div className="relative flex items-center">
                <Battery className={`w-4 h-4 ${battery.level <= 15 ? 'text-red-500' : 'text-gray-400'}`} />
                <div 
                  className="absolute left-[2px] top-[4.5px] h-[7px] bg-white rounded-[1px] transition-all"
                  style={{ width: `${Math.max(1, (battery.level / 100) * 10)}px` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 우측 상단: 새로고침 버튼 */}
      <div 
        className="absolute top-2 right-4 z-20 burn-in-prevention-buttons"
        style={{ willChange: 'transform' }}
      >
        <button 
          onClick={onRefreshClick}
          className="p-1.5 bg-white/5 rounded-full border border-white/5 text-gray-400 hover:text-white transition-all active:scale-95"
        >
          {/* 로딩 중이면 스피너 애니메이션 적용 */}
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
        </button>
      </div>

      {/* 시계 표시 영역 - 클릭하면 설정 팝업이 나타납니다 */}
      <div 
        className="flex flex-col items-center cursor-pointer" 
        onClick={onSettingsClick}
      >
        {/* 시계 숫자 표시 */}
        <div 
          className={`flex items-baseline font-bold tracking-tighter ${burnInPatternClass}`}
          style={{ 
            fontSize: `${clockFontSize}rem`, 
            color: '#cfcfcf',
            willChange: 'transform'
          }}
        >
          {/* 시 (Hours) */}
          <span className="leading-none">{h}</span>
          
          {/* 시와 분 사이의 구분자 (:) */}
          <span className="font-thin mx-1 opacity-20 leading-none" style={{ fontSize: '0.6em' }}>:</span>
          
          {/* 분 (Minutes) */}
          <span className="leading-none">{m}</span>
          
          {/* 초 (Seconds) - 세로 진행률 표시 */}
          <div
            className="ml-2 sm:ml-4 self-baseline"
            role="progressbar"
            aria-label={`초 진행률 ${seconds} / 59`}
            aria-valuemin={0}
            aria-valuemax={59}
            aria-valuenow={seconds}
          >
            <div className="relative w-[15px]" style={{ height: '0.7em' }}>
              {/* 시작/끝 위치를 보여주는 얇은 라인 (막대 폭보다 넓게) */}
              <div
                className="absolute top-0 left-0 w-full h-[1px] bg-white/20 z-[2]"
                aria-hidden="true"
              />
              <div
                className="absolute bottom-0 left-0 w-full h-[1px] bg-white/20 z-[2]"
                aria-hidden="true"
              />

              {/* 실제 트랙/채움은 가운데 3px */}
              <div className="absolute left-1/2 -translate-x-1/2 w-[11px] bg-white/5 rounded-full overflow-hidden h-full relative">
                <div
                  className="absolute bottom-0 left-0 w-full bg-blue-400/70 rounded-full transition-all duration-300"
                  style={{ height: `${secondsProgress * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
