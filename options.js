document.addEventListener('DOMContentLoaded', async () => {
  // 요소들 가져오기
  const groupToggle = document.getElementById('groupToggle');
  const collapseToggle = document.getElementById('collapseToggle');
  const sortRadios = document.querySelectorAll('input[name="sortOrder"]');

  // 테마 적용
  await applyTheme();

  // 설정 로드
  await loadSettings();

  // 페이지 로드 완료 후 transition 활성화
  setTimeout(() => {
    document.body.classList.add('loaded');
  }, 100);

    // 이벤트 리스너 설정
  const groupPropertyItem = document.getElementById('groupPropertyItem');
  const collapsePropertyItem = document.getElementById('collapsePropertyItem');

  // 전체 property item 클릭으로 토글 가능하도록
  groupPropertyItem.addEventListener('click', handleGroupToggle);
  collapsePropertyItem.addEventListener('click', handleCollapseToggle);

  // 토글 버튼 직접 클릭도 처리
  groupToggle.addEventListener('click', (e) => {
    e.stopPropagation(); // 부모 이벤트 중복 방지
    handleGroupToggle(e);
  });
  collapseToggle.addEventListener('click', (e) => {
    e.stopPropagation(); // 부모 이벤트 중복 방지
    handleCollapseToggle(e);
  });

  sortRadios.forEach(radio => {
    radio.addEventListener('change', handleSortOrderChange);
  });

  // 설정 로드 함수
  async function loadSettings() {
    try {
      const settings = await chrome.storage.sync.get([
        'groupTabs',
        'collapseGroups',
        'sortOrder'
      ]);

      // 그룹화 설정 (기본값: true)
      const groupTabs = settings.groupTabs ?? true;
      groupToggle.classList.toggle('active', groupTabs);

      // 그룹 접기 설정 (기본값: false)
      const collapseGroups = settings.collapseGroups ?? false;
      collapseToggle.classList.toggle('active', collapseGroups);

      // 정렬 순서 설정 (기본값: alphabetical)
      const sortOrder = settings.sortOrder ?? 'alphabetical';
      const sortRadio = document.getElementById(sortOrder);
      if (sortRadio) {
        sortRadio.checked = true;
      }

    } catch (error) {
      console.error('Error loading settings:', error);
      showNotification('Failed to load settings', 'error');
    }
  }

  // 그룹화 토글 처리 (클릭 이벤트를 부모 요소에서도 처리)
  async function handleGroupToggle(event) {
    // 실제 토글 버튼이 아닌 부모 요소 클릭 시에도 작동하도록
    if (event.target.closest('#groupPropertyItem')) {
      event.preventDefault();
    }

    try {
      const isActive = groupToggle.classList.contains('active');
      const newValue = !isActive;

      groupToggle.classList.toggle('active', newValue);
      await chrome.storage.sync.set({ groupTabs: newValue });

      showNotification(
        `Tab grouping ${newValue ? 'enabled' : 'disabled'}`,
        'success'
      );

    } catch (error) {
      console.error('Error updating group setting:', error);
      showNotification('Failed to update setting', 'error');
      // 오류 발생 시 토글 상태 원복
      groupToggle.classList.toggle('active');
    }
  }

  // 그룹 접기 토글 처리 (클릭 이벤트를 부모 요소에서도 처리)
  async function handleCollapseToggle(event) {
    // 실제 토글 버튼이 아닌 부모 요소 클릭 시에도 작동하도록
    if (event.target.closest('#collapsePropertyItem')) {
      event.preventDefault();
    }

    try {
      const isActive = collapseToggle.classList.contains('active');
      const newValue = !isActive;

      collapseToggle.classList.toggle('active', newValue);
      await chrome.storage.sync.set({ collapseGroups: newValue });

      showNotification(
        `Group collapsing ${newValue ? 'enabled' : 'disabled'}`,
        'success'
      );

    } catch (error) {
      console.error('Error updating collapse setting:', error);
      showNotification('Failed to update setting', 'error');
      // 오류 발생 시 토글 상태 원복
      collapseToggle.classList.toggle('active');
    }
  }

  // 정렬 순서 변경 처리
  async function handleSortOrderChange(event) {
    try {
      const sortOrder = event.target.value;

      if (sortOrder === 'custom') {
        showNotification('Custom ordering coming soon!', 'error');
        // 이전 설정으로 되돌리기
        const settings = await chrome.storage.sync.get(['sortOrder']);
        const currentOrder = settings.sortOrder ?? 'alphabetical';
        const currentRadio = document.getElementById(currentOrder);
        if (currentRadio) {
          currentRadio.checked = true;
        }
        return;
      }

      await chrome.storage.sync.set({ sortOrder });

      const orderLabels = {
        alphabetical: 'Alphabetical (A-Z)',
        recent: 'Recent activity (Most recent first)',
        tabCount: 'Tab count (Most tabs first)'
      };

      showNotification(
        `Sort order changed to: ${orderLabels[sortOrder]}`,
        'success'
      );

    } catch (error) {
      console.error('Error updating sort order:', error);
      showNotification('Failed to update sort order', 'error');
    }
  }

  // 알림 표시 함수
  function showNotification(message, type = 'success') {
    // 기존 알림 제거
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    // 새 알림 생성
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // 애니메이션을 위한 지연
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    // 3초 후 제거
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.remove('show');
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }
    }, 3000);
  }

  // Chrome 테마 감지 및 적용 함수
  async function applyTheme(forceUpdate = false) {
    try {
      let isDarkTheme = false;
      let detectedTheme = null;

      // Chrome 테마 API 사용 가능한 경우
      if (chrome.theme && chrome.theme.getCurrent) {
        try {
          const theme = await chrome.theme.getCurrent();
          isDarkTheme = detectDarkTheme(theme);
          detectedTheme = isDarkTheme ? 'dark' : 'light';
          console.log('Detected theme from Chrome:', detectedTheme);
        } catch (error) {
          console.log('Chrome theme API failed, falling back to system preference');
          isDarkTheme = detectSystemDarkTheme();
          detectedTheme = isDarkTheme ? 'dark' : 'light';
        }
      } else {
        // Chrome 테마 API 사용 불가능한 경우 시스템 설정 사용
        isDarkTheme = detectSystemDarkTheme();
        detectedTheme = isDarkTheme ? 'dark' : 'light';
        console.log('Detected theme from system:', detectedTheme);
      }

      // 저장된 테마와 비교해서 변경된 경우에만 업데이트
      const savedTheme = localStorage.getItem('tabneat-theme');
      if (forceUpdate || savedTheme !== detectedTheme) {
        console.log('Theme changed from', savedTheme, 'to', detectedTheme);
        applyThemeToDocument(isDarkTheme);
      } else {
        console.log('Theme unchanged:', detectedTheme);
      }

    } catch (error) {
      console.error('Error applying theme:', error);
      // 기본적으로 시스템 설정 사용
      applyThemeToDocument(detectSystemDarkTheme());
    }
  }

  // Chrome 테마에서 다크 모드 감지
  function detectDarkTheme(theme) {
    if (!theme || !theme.colors) {
      return detectSystemDarkTheme();
    }

    const colors = theme.colors;

    // 주요 배경색상들 확인
    const backgroundColors = [
      colors.frame,           // 브라우저 프레임
      colors.toolbar,         // 툴바
      colors.ntp_background,  // 새 탭 배경
      colors.tab_background_text // 탭 배경
    ].filter(color => color);

    if (backgroundColors.length === 0) {
      return detectSystemDarkTheme();
    }

    // 색상 밝기 분석
    for (const color of backgroundColors) {
      const brightness = calculateBrightness(color);
      if (brightness < 128) { // 어두운 색상이면 다크 테마
        return true;
      }
    }

    return false;
  }

  // 색상 밝기 계산 (0-255)
  function calculateBrightness(color) {
    // RGB 배열인 경우
    if (Array.isArray(color) && color.length >= 3) {
      const [r, g, b] = color;
      return (r * 299 + g * 587 + b * 114) / 1000;
    }

    // 문자열 색상인 경우 (#RRGGBB 또는 rgb(r,g,b))
    if (typeof color === 'string') {
      let r, g, b;

      if (color.startsWith('#')) {
        // #RRGGBB 형식
        const hex = color.slice(1);
        r = parseInt(hex.substr(0, 2), 16);
        g = parseInt(hex.substr(2, 2), 16);
        b = parseInt(hex.substr(4, 2), 16);
      } else if (color.startsWith('rgb')) {
        // rgb(r,g,b) 형식
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
          r = parseInt(match[1]);
          g = parseInt(match[2]);
          b = parseInt(match[3]);
        }
      }

      if (r !== undefined && g !== undefined && b !== undefined) {
        return (r * 299 + g * 587 + b * 114) / 1000;
      }
    }

    // 분석 실패 시 중간값 반환 (라이트 테마로 간주)
    return 200;
  }

  // 시스템 다크 모드 감지
  function detectSystemDarkTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // 문서에 테마 적용
  function applyThemeToDocument(isDark) {
    const theme = isDark ? 'dark' : 'light';

    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    // 로컬 스토리지에 테마 저장 (다음 로드 시 즉시 적용용)
    try {
      localStorage.setItem('tabneat-theme', theme);
    } catch (error) {
      console.log('Could not save theme to localStorage:', error);
    }
  }

  // 시스템 테마 변경 감지
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', async () => {
      // Chrome 테마가 없으면 시스템 설정 변경에 따라 업데이트
      if (!chrome.theme || !chrome.theme.getCurrent) {
        applyThemeToDocument(mediaQuery.matches);
      } else {
        // Chrome 테마가 있으면 다시 감지해서 업데이트
        await applyTheme();
      }
    });
  }
});
