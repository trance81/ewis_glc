// App.tsx - 메인 애플리케이션 컴포넌트
// 시계, 날씨, 달력을 표시하는 대시보드 애플리케이션입니다.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import CalendarWidget from './components/CalendarWidget';
import { ClockWidget } from './components/ClockWidget';
import { WeatherWidget } from './components/WeatherWidget';
import { SettingsModal } from './components/SettingsModal';
import { INITIAL_WEATHER, TOMORROW_WEATHER, DAY_AFTER_WEATHER } from './constants';
import { DeviceLayoutSettings, BatteryStatus } from './types';
import { getDeviceType } from './utils/device';
import { loadLayoutSettings, saveLayoutSettings } from './utils/layoutSettings';
import { mapWmoToCondition } from './utils/weather';

/**
 * App 컴포넌트
 * 애플리케이션의 메인 컴포넌트로, 시계, 날씨, 달력 위젯을 조합합니다.
 */
const App: React.FC = () => {
  // ============================================================
  // 상태 변수 선언
  // ============================================================
  
  // 현재 시간 상태 (1초마다 업데이트)
  const [time, setTime] = useState(new Date());
  
  // 현재 날씨 정보 상태
  const [weather, setWeather] = useState(INITIAL_WEATHER);
  
  // 예보 정보 상태 (내일, 모레)
  const [forecast, setForecast] = useState({ 
    tomorrow: TOMORROW_WEATHER, 
    dayAfter: DAY_AFTER_WEATHER 
  });
  
  // 날씨 데이터 로딩 상태
  const [loading, setLoading] = useState(false);
  
  // 배터리 상태
  const [battery, setBattery] = useState<BatteryStatus>({ 
    level: 100, 
    charging: false 
  });
  
  // 레이아웃 설정 상태
  const [layoutSettings, setLayoutSettings] = useState<DeviceLayoutSettings>(loadLayoutSettings);
  
  // 설정 모달 표시 여부
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // 전체화면 + 화면 켜짐 상태(사용자 동작으로만 활성화)
  const [immersiveActive, setImmersiveActive] = useState(false);

  // 현재 디바이스 타입에 맞는 레이아웃 설정
  const currentLayout = layoutSettings[getDeviceType()];
  
  // Wake Lock Sentinel 보관용 ref
  const wakeLockRef = useRef<any>(null);
  // 상태값을 이벤트 핸들러 closure에서 안정적으로 참조하기 위한 ref
  const immersiveActiveRef = useRef(false);

  // 로딩 중복 호출 방지를 위한 ref
  const loadingRef = useRef(false);
  
  // 상태 변경 시 ref도 함께 동기화
  const setImmersiveActiveSafe = (next: boolean) => {
    immersiveActiveRef.current = next;
    setImmersiveActive(next);
  };

  // ============================================================
  // 실시간 시계 업데이트 (1초마다)
  // ============================================================
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  // ============================================================
  // 배터리 상태 API
  // ============================================================
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((batteryManager: any) => {
        const updateBattery = () => setBattery({ 
          level: Math.round(batteryManager.level * 100),
          charging: batteryManager.charging
        });
        
        // 초기 배터리 상태 가져오기
        updateBattery();
        
        // 배터리 상태 변경 이벤트 리스너 등록
        batteryManager.addEventListener('levelchange', updateBattery);
        batteryManager.addEventListener('chargingchange', updateBattery);
      });
    }
  }, []);
  
  // ============================================================
  // 날씨 데이터 가져오기 함수
  // ============================================================
  const fetchWeather = useCallback(async (force = false) => {
    // 이미 로딩 중이고 강제 모드가 아니면 중복 호출 방지
    if (loadingRef.current && !force) return;
    
    // 로딩 상태 설정
    loadingRef.current = true;
    setLoading(true);
    
    try {
      // 사용자 위치 가져오기 (실패 시 서울 좌표 사용)
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      }).catch(() => null);
      
      // 위치 정보 (기본값: 서울)
      const lat = pos?.coords.latitude || 37.5665;
      const lon = pos?.coords.longitude || 126.9780;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // 날씨 API와 대기질 API 병렬 호출
      const [weatherRes, airRes] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=${encodeURIComponent(timezone)}`),
        fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5`)
      ]);
      
      // JSON 응답 파싱
      const wData = await weatherRes.json();
      const aData = await airRes.json();
      
      // 날씨 데이터가 유효한지 확인
      if (wData.current && wData.daily) {
        // 현재 날씨 정보 업데이트
        setWeather({
          temp: Math.round(wData.current.temperature_2m),
          low: Math.round(wData.daily.temperature_2m_min[0]),
          high: Math.round(wData.daily.temperature_2m_max[0]),
          condition: mapWmoToCondition(wData.current.weather_code),
          humidity: wData.current.relative_humidity_2m,
          location: timezone.split('/').pop()?.replace('_', ' ') || 'My Location',
          pm10: Math.round(aData.current.pm10 || 0),
          pm25: Math.round(aData.current.pm2_5 || 0)
        });
        
        // 예보 정보 업데이트
        setForecast({
          tomorrow: {
            temp: Math.round(wData.daily.temperature_2m_max[1]),
            low: Math.round(wData.daily.temperature_2m_min[1]),
            high: Math.round(wData.daily.temperature_2m_max[1]),
            condition: mapWmoToCondition(wData.daily.weather_code[1])
          },
          dayAfter: {
            temp: Math.round(wData.daily.temperature_2m_max[2]),
            low: Math.round(wData.daily.temperature_2m_min[2]),
            high: Math.round(wData.daily.temperature_2m_max[2]),
            condition: mapWmoToCondition(wData.daily.weather_code[2])
          }
        });
      }
    } catch (error) {
      console.error("Weather fetch error:", error);
    } finally {
      // 로딩 상태 해제
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);
  
  // ============================================================
  // 날씨 데이터 자동 새로고침 (4시간마다)
  // ============================================================
  useEffect(() => {
    // 초기 로드 시 날씨 데이터 가져오기
    fetchWeather();
    
    // 4시간마다 자동 새로고침
    const interval = setInterval(() => {
      fetchWeather(true); // 강제 모드
    }, 4 * 60 * 60 * 1000); // 4시간 = 14,400,000ms
    
    return () => clearInterval(interval);
  }, [fetchWeather]);
  
  // ============================================================
  // Fullscreen API + Screen Wake Lock API (사용자 제스처 기반)
  // ============================================================

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
      }
    } catch (err) {
      // 일부 브라우저에서 release 호출 실패가 날 수 있어 무시
      console.debug('Wake Lock release error:', err);
    } finally {
      wakeLockRef.current = null;
    }
  };

  const requestWakeLock = async () => {
    if (!('wakeLock' in navigator)) return null;
    if (wakeLockRef.current) return wakeLockRef.current;

    try {
      const sentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockRef.current = sentinel;
      sentinel.addEventListener('release', () => {
        wakeLockRef.current = null;
      });
      return sentinel;
    } catch (err) {
      console.error('Wake Lock request error:', err);
      return null;
    }
  };

  const requestFullscreen = async () => {
    if (document.fullscreenElement) return;
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.error('Fullscreen request error:', err);
    }
  };

  const handleStartImmersive = async () => {
    // 사용자 클릭 제스처에서 호출되어야 함(브라우저 정책)
    await Promise.all([requestFullscreen(), requestWakeLock()]);
    setImmersiveActiveSafe(true);
  };

  useEffect(() => {
    const onFullscreenChange = async () => {
      if (document.fullscreenElement === null) {
        // 전체화면 종료 시 Wake Lock도 해제하고 오버레이를 다시 표시
        setImmersiveActiveSafe(false);
        await releaseWakeLock();
      }
    };

    const onVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!immersiveActiveRef.current) return;
      // 전체화면이 아닐 때는 재요청하지 않음(정책/UX 이슈 방지)
      if (document.fullscreenElement === null) return;
      if (wakeLockRef.current) return;

      await requestWakeLock();
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // StrictMode 더블 마운트에서도 안전하게 cleanup
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      releaseWakeLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // 레이아웃 설정 변경 핸들러
  // ============================================================
  const handleLayoutSettingsChange = (newSettings: DeviceLayoutSettings) => {
    saveLayoutSettings(newSettings); // localStorage에 저장
    setLayoutSettings(newSettings);  // 상태 업데이트
  };
  
  // ============================================================
  // UI 렌더링
  // ============================================================
  return (
    <div className="relative w-full h-screen bg-black flex p-3 md:p-4 gap-3 md:gap-4 overflow-hidden select-none">
      {/* 왼쪽 영역: 시계, 날씨 위젯들 */}
      <div className="flex-1 flex flex-col gap-3 md:gap-4 h-full">
        {/* 시계 위젯 */}
        <ClockWidget
          time={time}
          battery={battery}
          loading={loading}
          clockFlex={currentLayout.clock}
          clockFontSize={currentLayout.clockFontSize}
          onSettingsClick={() => setShowSettingsModal(true)}
          onRefreshClick={() => fetchWeather()}
        />
        
        {/* 날씨 위젯 */}
        <WeatherWidget
          weather={weather}
          forecast={forecast}
          loading={loading}
          weatherFlex={currentLayout.weather}
        />
      </div>
      
      {/* 오른쪽 영역: 달력 위젯 */}
      <div 
        className="bg-[#0d0d0d] rounded-[2rem] md:rounded-[2.5rem] border border-white/5 overflow-hidden flex flex-col h-full shadow-inner"
        style={{ width: `${currentLayout.calendar}%` }}
      >
        <CalendarWidget />
      </div>
      
      {/* 하단 중앙: 인디케이터 바 (장식용) */}
      <div 
        className="absolute bottom-1 md:bottom-2 left-1/2 -translate-x-1/2 w-24 md:w-32 h-1 bg-white/10 rounded-full pointer-events-none burn-in-prevention-buttons"
        style={{ willChange: 'transform' }}
      />

      {/* 사용자 시작(전체화면 + Wake Lock) 오버레이 */}
      {!immersiveActive && !showSettingsModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
          <div className="w-full px-4">
            <div className="mx-auto max-w-md bg-[#0d0d0d] border border-white/10 rounded-[2rem] p-5 md:p-6">
              <div className="text-center">
                <div className="text-base font-semibold text-white mb-4">
                  전체화면 및 화면 켜기
                </div>
                <div className="text-xs text-gray-400 mb-5 leading-relaxed">
                  버튼을 눌러 Fullscreen과 Screen Wake Lock을 활성화해 주세요.
                </div>
                <button
                  onClick={handleStartImmersive}
                  className="w-full py-3 rounded-full bg-white/10 border border-white/15 text-white hover:bg-white/15 active:scale-[0.99] transition-all"
                >
                  시작
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 설정 모달 */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        layoutSettings={layoutSettings}
        onSettingsChange={handleLayoutSettingsChange}
      />
    </div>
  );
};

export default App;
