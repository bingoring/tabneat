document.addEventListener('DOMContentLoaded', async () => {
  // 요소들 가져오기
  const sortTabsBtn = document.getElementById('sortTabsBtn');
  const groupToggle = document.getElementById('groupToggle');
  const collapseToggle = document.getElementById('collapseToggle');
  const openOptionsBtn = document.getElementById('openOptionsBtn');

  // 설정 로드
  await loadSettings();

  // 이벤트 리스너 설정
  sortTabsBtn.addEventListener('click', handleSortTabs);
  groupToggle.addEventListener('click', handleGroupToggle);
  collapseToggle.addEventListener('click', handleCollapseToggle);
  openOptionsBtn.addEventListener('click', handleOpenOptions);

  // 설정 로드 함수
  async function loadSettings() {
    try {
      const settings = await chrome.storage.sync.get(['groupTabs', 'collapseGroups']);

      // 그룹화 설정 (기본값: true)
      const groupTabs = settings.groupTabs ?? true;
      groupToggle.classList.toggle('active', groupTabs);

      // 그룹 접기 설정 (기본값: false)
      const collapseGroups = settings.collapseGroups ?? false;
      collapseToggle.classList.toggle('active', collapseGroups);

    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  // 탭 정렬 처리
  async function handleSortTabs() {
    try {
      // 버튼 비활성화 및 로딩 표시
      sortTabsBtn.disabled = true;
      sortTabsBtn.textContent = '🔄 Sorting...';

      // 현재 탭에서 확장프로그램 액션 트리거
      await chrome.action.setPopup({ popup: '' }); // 팝업 일시적으로 제거

      // background script에 메시지 전송 (액션 클릭 시뮬레이션)
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab) {
        // chrome.action.onClicked 이벤트 트리거
        await chrome.runtime.sendMessage({ action: 'triggerTabSorting' });
      }

      // 잠시 후 팝업 복구
      setTimeout(() => {
        chrome.action.setPopup({ popup: 'popup.html' });
      }, 1000);

      showNotification('Tabs sorted and grouped successfully!', 'success');

      // 1초 후 팝업 닫기
      setTimeout(() => {
        window.close();
      }, 1000);

    } catch (error) {
      console.error('Error sorting tabs:', error);
      showNotification('Failed to sort tabs', 'error');
    } finally {
      // 버튼 상태 복구
      sortTabsBtn.disabled = false;
      sortTabsBtn.textContent = '🔄 Sort & Group Tabs';
    }
  }

  // 그룹화 토글 처리
  async function handleGroupToggle() {
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
    }
  }

  // 그룹 접기 토글 처리
  async function handleCollapseToggle() {
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
    }
  }

  // 옵션 페이지 열기
  function handleOpenOptions() {
    chrome.runtime.openOptionsPage();
    window.close();
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
});
