document.addEventListener('DOMContentLoaded', async () => {
  // 요소들 가져오기
  const groupToggle = document.getElementById('groupToggle');
  const collapseToggle = document.getElementById('collapseToggle');
  const sortRadios = document.querySelectorAll('input[name="sortOrder"]');

  // 설정 로드
  await loadSettings();

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
});
