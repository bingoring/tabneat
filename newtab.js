document.addEventListener('DOMContentLoaded', async () => {
    // 새 탭 오버라이드 설정 확인
    const settings = await chrome.storage.sync.get(['newTabOverride']);
    if (settings.newTabOverride === false) {
        // 새 탭 오버라이드가 비활성화된 경우 백그라운드 스크립트에 요청
        chrome.runtime.sendMessage({ action: 'openChromeNewTab' });
        return;
    }

    const closedSessionsContainer = document.getElementById('closedSessions');
    const autoSavedSessionsContainer = document.getElementById('autoSavedSessions');

    // Google 헤더 메뉴 초기화
    initializeGoogleHeader();

    // 검색 기능 초기화
    initializeSearch();

    // 바로가기 사이트 로드
    await loadTopSites();

    // 일괄 제거 버튼 이벤트 리스너 추가
    document.querySelectorAll('.clear-all-btn').forEach(btn => {
        btn.addEventListener('click', handleClearAll);
    });

    // 초기 로드
    await loadAllSessions();

    async function loadAllSessions() {
        try {
            const [closedSessions, autoSavedSessions] = await Promise.all([
                loadClosedSessions(),
                loadAutoSavedSessions()
            ]);

            renderSessions(closedSessionsContainer, closedSessions, 'closed');
            renderSessions(autoSavedSessionsContainer, autoSavedSessions, 'auto');
        } catch (error) {
            console.error('Error loading sessions:', error);
        }
    }

    async function loadClosedSessions() {
        try {
            const result = await chrome.storage.local.get(['closedSessions']);
            return result.closedSessions || [];
        } catch (error) {
            console.error('Error loading closed sessions:', error);
            return [];
        }
    }

    async function loadAutoSavedSessions() {
        try {
            const result = await chrome.storage.local.get(['autoSavedSessions']);
            return result.autoSavedSessions || [];
        } catch (error) {
            console.error('Error loading auto-saved sessions:', error);
            return [];
        }
    }

    function renderSessions(container, sessions, type) {
        if (sessions.length === 0) {
            container.innerHTML = `
                <div class="no-sessions">
                    ${type === 'closed' ? 'No recently closed sessions' : 'No auto-saved sessions'}
                </div>
            `;
            return;
        }

                        if (type === 'closed') {
            // 닫힌 세션은 개별 아이템으로 렌더링
            container.innerHTML = sessions.map(session => createClosedSessionItem(session)).join('');

            // 닫힌 세션 아이템 이벤트 리스너
            container.querySelectorAll('.closed-tab-item').forEach(item => {
                item.addEventListener('click', handleClosedTabRestore);
            });

            container.querySelectorAll('.delete-closed-btn').forEach(btn => {
                btn.addEventListener('click', handleClosedItemDelete);
            });
        } else {
            // 일반 세션은 기존 방식으로 렌더링
            container.innerHTML = sessions.map(session => createSessionCard(session, type)).join('');

            // 이벤트 리스너 추가
            container.querySelectorAll('.session-header').forEach(header => {
                header.addEventListener('click', toggleSessionContent);
            });

            container.querySelectorAll('.tab-item').forEach(item => {
                item.addEventListener('click', handleTabRestore);
            });

            container.querySelectorAll('.group-item').forEach(item => {
                item.addEventListener('click', handleGroupRestore);
            });

            container.querySelectorAll('.restore-btn').forEach(btn => {
                btn.addEventListener('click', handleSessionRestore);
            });

            container.querySelectorAll('.delete-session-btn').forEach(btn => {
                btn.addEventListener('click', handleSessionDelete);
            });
        }
    }

    function createSessionCard(session, type) {
        const date = new Date(session.createdAt).toLocaleDateString();
        const time = new Date(session.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        // 그룹별로 탭 분류
        const tabsByGroup = new Map();
        const ungroupedTabs = [];

        session.tabs.forEach(tab => {
            if (tab.groupId && tab.groupId !== -1) {
                if (!tabsByGroup.has(tab.groupId)) {
                    tabsByGroup.set(tab.groupId, []);
                }
                tabsByGroup.get(tab.groupId).push(tab);
            } else {
                ungroupedTabs.push(tab);
            }
        });

        // 그룹 정보 매핑
        const groupsMap = new Map();
        session.groups.forEach(group => {
            groupsMap.set(group.id, group);
        });

        return `
            <div class="session-item" data-session-id="${session.id}">
                <div class="session-header">
                    <div class="session-header-left">
                        <div class="session-title">${escapeHtml(session.name)}</div>
                        <div class="session-info">
                            📑 ${session.tabCount} tabs • 📁 ${session.groupCount} groups
                            ${session.windowCount > 1 ? ` • 🪟 ${session.windowCount} windows` : ''}
                        </div>
                    </div>
                    <div class="session-header-right">
                        <div class="session-time">${date} ${time}</div>
                        <button class="delete-session-btn" data-session-id="${session.id}" data-type="${type}" title="Delete session">🗑️</button>
                    </div>
                </div>

                <div class="session-content">
                    <div class="tabs-groups-container">
                        ${(session.isClosedSession && ungroupedTabs.length === 0) ? '' : `
                        <div class="tabs-section">
                            <h4>📑 Individual Tabs (${ungroupedTabs.length})</h4>
                            <div class="tabs-list">
                                ${ungroupedTabs.map(tab => createTabItem(tab)).join('')}
                                ${ungroupedTabs.length === 0 ? '<div style="color: #999; font-size: 12px;">No individual tabs</div>' : ''}
                            </div>
                        </div>
                        `}

                        ${(session.isClosedSession && session.groupCount === 0) ? '' : `
                        <div class="groups-section">
                            <h4>📁 Tab Groups (${session.groupCount})</h4>
                            <div class="groups-list">
                                ${session.groups.map(group => createGroupItem(group, tabsByGroup.get(group.id) || [])).join('')}
                                ${session.groupCount === 0 ? '<div style="color: #999; font-size: 12px;">No tab groups</div>' : ''}
                            </div>
                        </div>
                        `}
                    </div>

                    <div class="restore-buttons">
                        <button class="restore-btn primary" data-action="restore-all" data-session-id="${session.id}">
                            🔄 Restore All
                        </button>
                        <button class="restore-btn secondary" data-action="restore-new-window" data-session-id="${session.id}">
                            📱 New Window
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function createTabItem(tab) {
        const faviconUrl = tab.favicon || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMy41IDJDMi42NzE1NyAyIDIgMi42NzE1NyAyIDMuNVYxMi41QzIgMTMuMzI4NCAyLjY3MTU3IDE0IDMuNSAxNEgxMi41QzEzLjMyODQgMTQgMTQgMTMuMzI4NCAxNDEyLjVWMy41QzE0IDIuNjcxNTcgMTMuMzI4NCAyIDEyLjUgMkgzLjVaTTMuNSAzSDEyLjVDMTIuNzc2MSAzIDEzIDMuMjIzODYgMTMgMy41VjEyLjVDMTMgMTIuNzc2MSAxMi43NzYxIDEzIDEyLjUgMTNIMy41QzMuMjIzODYgMTMgMyAxMi43NzYxIDMgMTIuNVYzLjVDMyAzLjIyMzg2IDMuMjIzODYgMyAzLjUgM1oiIGZpbGw9IiM5OTk5OTkiLz48L3N2Zz4=';

        return `
            <div class="tab-item" data-tab-url="${escapeHtml(tab.url)}" data-tab-title="${escapeHtml(tab.title)}">
                <img class="tab-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none'">
                <div class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</div>
            </div>
        `;
    }

    function createGroupItem(group, tabs) {
        return `
            <div class="group-item" data-group-id="${group.id}" data-group-title="${escapeHtml(group.title)}">
                <div class="group-color group-color-${group.color}"></div>
                <div class="group-title">${escapeHtml(group.title) || 'Unnamed Group'}</div>
                <div class="group-count">${tabs.length}</div>
            </div>
        `;
    }

        function createClosedSessionItem(session) {
        const time = new Date(session.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        // 모든 닫힌 세션을 개별 탭으로 렌더링 (그룹 여부에 관계없이)
        if (session.tabCount > 0 && session.tabs.length > 0) {
            const tab = session.tabs[0];
            const faviconUrl = tab.favicon || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMy41IDJDMi42NzE1NyAyIDIgMi42NzE1NyAyIDMuNVYxMi41QzIgMTMuMzI4NCAyLjY3MTU3IDE0IDMuNSAxNEgxMi41QzEzLjMyODQgMTQgMTQgMTMuMzI4NCAxNDEyLjVWMy41QzE0IDIuNjcxNTcgMTMuMzI4NCAyIDEyLjUgMkgzLjVaTTMuNSAzSDEyLjVDMTIuNzc2MSAzIDEzIDMuMjIzODYgMTMgMy41VjEyLjVDMTMgMTIuNzc2MSAxMi43NzYxIDEzIDEyLjUgMTNIMy41QzMuMjIzODYgMTMgMyAxMi43NzYxIDMgMTIuNVYzLjVDMyAzLjIyMzg2IDMuMjIzODYgMyAzLjUgM1oiIGZpbGw9IiM5OTk5OTkiLz48L3N2Zz4=';

            return `
                <div class="closed-tab-item" data-session-id="${session.id}" data-tab-url="${escapeHtml(tab.url)}">
                    <div class="closed-item-content">
                        <div class="closed-item-icon">
                            <img class="tab-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none'">
                        </div>
                        <div class="closed-item-info">
                            <div class="closed-item-title">${escapeHtml(tab.title)}</div>
                            <div class="closed-item-detail">${time}</div>
                        </div>
                        <button class="delete-closed-btn" data-session-id="${session.id}" title="Delete">🗑️</button>
                    </div>
                </div>
            `;
        }

        return '';
    }

    function toggleSessionContent(event) {
        const sessionItem = event.target.closest('.session-item');
        const content = sessionItem.querySelector('.session-content');

        content.classList.toggle('expanded');
    }

    async function handleTabRestore(event) {
        event.stopPropagation();

        const tabItem = event.target.closest('.tab-item');
        const tabUrl = tabItem.dataset.tabUrl;
        const tabTitle = tabItem.dataset.tabTitle;

        try {
            await chrome.tabs.create({
                url: tabUrl,
                active: true
            });

            showNotification(`Restored tab: ${tabTitle}`);
        } catch (error) {
            console.error('Error restoring tab:', error);
            showNotification('Failed to restore tab', 'error');
        }
    }

        async function handleGroupRestore(event) {
        event.stopPropagation();

        const groupItem = event.target.closest('.group-item');
        const sessionItem = event.target.closest('.session-item');
        const sessionId = sessionItem.dataset.sessionId;
        const groupId = groupItem.dataset.groupId;
        const groupTitle = groupItem.dataset.groupTitle;

        // 버튼 비활성화 및 로딩 표시
        const originalText = groupItem.innerHTML;
        groupItem.style.opacity = '0.5';
        groupItem.style.pointerEvents = 'none';

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'restoreGroup',
                sessionId: sessionId,
                groupId: groupId,
                openInNewWindow: false // 현재 창에서 열기
            });

            if (response.success) {
                const restoredTitle = response.groupTitle || groupTitle;
                showNotification(`Restored group: ${restoredTitle} (${response.tabCount} tabs)`);
            } else {
                console.error('Group restore failed:', response.error);
                showNotification(`Failed to restore group: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error restoring group:', error);
            showNotification(`Failed to restore group: ${error.message}`, 'error');
        } finally {
            // 버튼 상태 복원
            groupItem.style.opacity = '1';
            groupItem.style.pointerEvents = 'auto';
            groupItem.innerHTML = originalText;
        }
    }

    async function handleSessionRestore(event) {
        event.stopPropagation();

        const btn = event.target;
        const action = btn.dataset.action;
        const sessionId = btn.dataset.sessionId;
        const openInNewWindow = action === 'restore-new-window';

        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Restoring...';

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'restoreSession',
                sessionId: sessionId,
                openInNewWindow
            });

            if (response.success) {
                showNotification(`Session restored successfully! (${response.tabCount} tabs)`);
            } else {
                showNotification(`Failed to restore session: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error restoring session:', error);
            showNotification('Failed to restore session', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

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
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#dc3545' : '#28a745'};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            font-size: 14px;
            max-width: 300px;
            word-wrap: break-word;
        `;

        document.body.appendChild(notification);

        // 3초 후 제거
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    async function handleSessionDelete(event) {
        event.stopPropagation();

        const btn = event.target;
        const sessionId = btn.dataset.sessionId;
        const type = btn.dataset.type;

        if (!confirm('Are you sure you want to delete this session?')) {
            return;
        }

        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = '⏳';

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'deleteSession',
                sessionId: sessionId,
                type: type
            });

            if (response.success) {
                // 해당 세션 아이템 제거
                const sessionItem = btn.closest('.session-item');
                sessionItem.remove();

                // 섹션이 비어있는지 확인하고 업데이트
                const container = type === 'closed' ? closedSessionsContainer : autoSavedSessionsContainer;
                if (container.children.length === 0) {
                    container.innerHTML = `
                        <div class="no-sessions">
                            ${type === 'closed' ? 'No recently closed sessions' : 'No auto-saved sessions'}
                        </div>
                    `;
                }

                showNotification('Session deleted successfully!');
            } else {
                showNotification(`Failed to delete session: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error deleting session:', error);
            showNotification('Failed to delete session', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    async function handleClearAll(event) {
        const btn = event.target;
        const type = btn.dataset.type;

        if (!confirm(`Are you sure you want to clear all ${type === 'closed' ? 'closed' : 'auto-saved'} sessions?`)) {
            return;
        }

        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = '⏳ Clearing...';

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'clearAllSessions',
                type: type
            });

            if (response.success) {
                // 해당 컨테이너 비우기
                const container = type === 'closed' ? closedSessionsContainer : autoSavedSessionsContainer;
                container.innerHTML = `
                    <div class="no-sessions">
                        ${type === 'closed' ? 'No recently closed sessions' : 'No auto-saved sessions'}
                    </div>
                `;

                showNotification(`All ${type === 'closed' ? 'closed' : 'auto-saved'} sessions cleared!`);
            } else {
                showNotification(`Failed to clear sessions: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error clearing sessions:', error);
            showNotification('Failed to clear sessions', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    // 닫힌 탭 복원
    async function handleClosedTabRestore(event) {
        // 삭제 버튼 클릭 시 복원 방지
        if (event.target.classList.contains('delete-closed-btn')) {
            return;
        }

        event.stopPropagation();

        const tabItem = event.target.closest('.closed-tab-item');
        const tabUrl = tabItem.dataset.tabUrl;

        try {
            await chrome.tabs.create({ url: tabUrl });
            showNotification('Tab restored successfully!');
        } catch (error) {
            console.error('Error restoring closed tab:', error);
            showNotification('Failed to restore tab', 'error');
        }
    }

    // 닫힌 그룹 복원 (그룹 헤더 클릭 시 전체 그룹 복원)
    async function handleClosedGroupRestore(event) {
        // 삭제 버튼이나 화살표 클릭 시 복원 방지
        if (event.target.classList.contains('delete-closed-btn') ||
            event.target.classList.contains('expand-arrow')) {
            return;
        }

        event.stopPropagation();

        const container = event.target.closest('.closed-group-container');
        const sessionId = container.dataset.sessionId;
        const groupId = container.dataset.groupId;

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'restoreGroup',
                sessionId: sessionId,
                groupId: groupId,
                openInNewWindow: false // 현재 창에서 열기
            });

            if (response.success) {
                showNotification(`Group restored: ${response.groupTitle || 'Restored Group'} (${response.tabCount} tabs)`);
            } else {
                showNotification(`Failed to restore group: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error restoring closed group:', error);
            showNotification('Failed to restore group', 'error');
        }
    }

    // 닫힌 아이템 삭제
    async function handleClosedItemDelete(event) {
        event.stopPropagation();

        const btn = event.target;
        const sessionId = btn.dataset.sessionId;
        const item = btn.closest('.closed-tab-item, .closed-group-item');

        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = '⏳';

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'deleteSession',
                sessionId: sessionId,
                type: 'closed'
            });

            if (response.success) {
                // UI에서 아이템 제거
                item.remove();

                // 섹션이 비어있는지 확인
                if (closedSessionsContainer.children.length === 0) {
                    closedSessionsContainer.innerHTML = '<div class="no-sessions">No recently closed sessions</div>';
                }

                showNotification('Item deleted successfully!');
            } else {
                showNotification(`Failed to delete item: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error deleting closed item:', error);
            showNotification('Failed to delete item', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    // 그룹 펼치기/접기 (화살표 클릭 시만)
    function handleGroupToggle(event) {
        // 화살표가 아니면 무시
        if (!event.target.classList.contains('expand-arrow')) {
            return;
        }

        event.stopPropagation();

        const container = event.target.closest('.closed-group-container');
        const tabsContainer = container.querySelector('.closed-group-tabs');
        const arrow = container.querySelector('.expand-arrow');

        if (tabsContainer.style.display === 'none') {
            // 펼치기
            tabsContainer.style.display = 'block';
            arrow.textContent = '▼';
            container.classList.add('expanded');
        } else {
            // 접기
            tabsContainer.style.display = 'none';
            arrow.textContent = '▶';
            container.classList.remove('expanded');
        }
    }

    // 그룹 내 개별 탭 복원
    async function handleGroupTabRestore(event) {
        event.stopPropagation();

        const tabItem = event.target.closest('.closed-group-tab-item');
        const tabUrl = tabItem.dataset.tabUrl;

        try {
            await chrome.tabs.create({ url: tabUrl });
            showNotification('Tab restored successfully!');
        } catch (error) {
            console.error('Error restoring group tab:', error);
            showNotification('Failed to restore tab', 'error');
        }
    }

        // 검색 기능 초기화
    function initializeSearch() {
        const searchInput = document.getElementById('searchInput');
        const dropdown = document.getElementById('searchHistoryDropdown');
        let highlightedIndex = -1;

        // 검색 기록 로드
        loadSearchHistory();

        // 검색 실행
        searchInput.addEventListener('keydown', async (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const query = searchInput.value.trim();
                if (query) {
                    await saveSearchHistory(query);
                    handleSearch(query);
                }
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                navigateHistory(1);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                navigateHistory(-1);
            } else if (event.key === 'Escape') {
                hideSearchHistory();
            }
        });

        // 검색창 포커스 시 기록 표시
        searchInput.addEventListener('focus', () => {
            showSearchHistory();
        });

        // 검색창 값 변경 시 필터링 및 자동완성
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim();

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                if (query.length > 0) {
                    await loadSuggestionsAndHistory(query);
                } else {
                    await loadSearchHistory();
                }
            }, 300); // 300ms 디바운스
        });

        // 문서 클릭 시 드롭다운 숨기기
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.search-container')) {
                hideSearchHistory();
            }
        });

                // 키보드 네비게이션
        function navigateHistory(direction) {
            const items = dropdown.querySelectorAll('.search-suggestion-item, .search-history-item');
            if (items.length === 0) return;

            // 이전 하이라이트 제거
            items.forEach(item => item.classList.remove('highlighted'));

            // 새 인덱스 계산
            highlightedIndex += direction;
            if (highlightedIndex < 0) highlightedIndex = items.length - 1;
            if (highlightedIndex >= items.length) highlightedIndex = 0;

            // 새 아이템 하이라이트
            items[highlightedIndex].classList.add('highlighted');

            // 검색창에 텍스트 입력
            const textElement = items[highlightedIndex].querySelector('.search-suggestion-text, .search-history-text');
            if (textElement) {
                const query = textElement.textContent;
                searchInput.value = query;
            }
        }
    }

    // 검색 처리
    function handleSearch(query) {
        if (!query) return;

        // 입력된 값이 URL인지 확인
        if (isValidUrl(query)) {
            // URL인 경우 해당 사이트로 이동
            const url = query.startsWith('http') ? query : `https://${query}`;
            window.location.href = url;
        } else {
            // URL이 아닌 경우 Google 검색
            const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            window.location.href = googleSearchUrl;
        }
    }

    // URL 유효성 검사
    function isValidUrl(string) {
        try {
            // 완전한 URL 체크 (http:// 또는 https://로 시작)
            if (string.startsWith('http://') || string.startsWith('https://')) {
                new URL(string);
                return true;
            }

            // 도메인 패턴 체크 (더 엄격하게)
            const domainPattern = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:[0-9]+)?(\/.*)?$/;
            if (domainPattern.test(string)) {
                // 한국어나 특수문자가 포함된 경우 URL이 아닌 것으로 판단
                if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(string)) {
                    return false;
                }

                // 점(.)이 있고 적절한 도메인 형식인지 확인
                const parts = string.split('.');
                if (parts.length >= 2 && parts[parts.length - 1].length >= 2) {
                    try {
                        new URL(`https://${string}`);
                        return true;
                    } catch (_) {
                        return false;
                    }
                }
            }

            return false;
        } catch (_) {
            return false;
        }
    }

        // 바로가기 사이트 로드
    async function loadTopSites() {
        try {
            const sites = await chrome.topSites.get();
            const shortcutsContainer = document.getElementById('shortcutsContainer');

            if (sites.length === 0) {
                shortcutsContainer.innerHTML = '<div style="text-align: center; color: rgba(255, 255, 255, 0.7); grid-column: 1 / -1;">No shortcuts available</div>';
                return;
            }

            // 최대 8개의 사이트만 표시
            const topSites = sites.slice(0, 8);

            shortcutsContainer.innerHTML = topSites.map(site => {
                const domain = new URL(site.url).hostname;
                const title = site.title || domain;

                return `
                    <a href="${site.url}" class="shortcut-item">
                        <div class="shortcut-icon" data-domain="${domain}">
                            ${getDomainIcon(domain)}
                        </div>
                        <div class="shortcut-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
                    </a>
                `;
            }).join('');

            // 파비콘 로드 시도
            topSites.forEach(async (site, index) => {
                const domain = new URL(site.url).hostname;
                const iconElement = shortcutsContainer.children[index].querySelector('.shortcut-icon');

                try {
                    const faviconUrl = await getFaviconUrl(domain);
                    if (faviconUrl) {
                        iconElement.innerHTML = `<img src="${faviconUrl}" alt="" style="width: 32px; height: 32px; border-radius: 4px;" onerror="this.parentElement.innerHTML='${getDomainIcon(domain)}';">`;
                    }
                } catch (error) {
                    console.log(`Failed to load favicon for ${domain}:`, error);
                    // 기본 아이콘 유지
                }
            });
        } catch (error) {
            console.error('Error loading top sites:', error);
            const shortcutsContainer = document.getElementById('shortcutsContainer');
            shortcutsContainer.innerHTML = '<div style="text-align: center; color: rgba(255, 255, 255, 0.7); grid-column: 1 / -1;">Unable to load shortcuts</div>';
        }
    }

    // 파비콘 URL 가져오기 (여러 서비스 fallback)
    async function getFaviconUrl(domain) {
        const services = [
            `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
            `https://favicon.yandex.net/favicon/${domain}`,
            `https://icons.duckduckgo.com/ip3/${domain}.ico`,
            `https://${domain}/favicon.ico`
        ];

        for (const service of services) {
            try {
                const response = await fetch(service, {
                    method: 'HEAD',
                    mode: 'cors',
                    credentials: 'omit',
                    referrer: 'no-referrer'
                });

                if (response.ok) {
                    return service;
                }
            } catch (error) {
                // 다음 서비스 시도
                continue;
            }
        }

        return null;
    }

    // 도메인별 기본 아이콘 반환
    function getDomainIcon(domain) {
        const domainIcons = {
            'google.com': '🔍',
            'youtube.com': '📺',
            'facebook.com': '👥',
            'instagram.com': '📸',
            'twitter.com': '🐦',
            'x.com': '🐦',
            'linkedin.com': '💼',
            'github.com': '🐙',
            'stackoverflow.com': '📚',
            'reddit.com': '🤖',
            'netflix.com': '🎬',
            'amazon.com': '🛒',
            'ebay.com': '🛍️',
            'paypal.com': '💳',
            'microsoft.com': '🏢',
            'apple.com': '🍎',
            'wikipedia.org': '📖',
            'naver.com': '🟢',
            'daum.net': '📧',
            'kakao.com': '💬',
            'tistory.com': '✍️',
            'blog.naver.com': '📝',
            'yes24.com': '📚',
            'coupang.com': '🛒',
            'baidu.com': '🔍',
            'taobao.com': '🛍️',
            'weibo.com': '🐦',
            'bilibili.com': '📺'
        };

        return domainIcons[domain] || '🌐';
    }

    // 검색 기록 저장
    async function saveSearchHistory(query) {
        try {
            const result = await chrome.storage.local.get(['searchHistory']);
            let history = result.searchHistory || [];

            // 중복 제거
            history = history.filter(item => item !== query);

            // 맨 앞에 추가
            history.unshift(query);

            // 최대 20개까지 유지
            if (history.length > 20) {
                history = history.slice(0, 20);
            }

            await chrome.storage.local.set({ searchHistory: history });
        } catch (error) {
            console.error('Error saving search history:', error);
        }
    }

    // 검색 기록 로드
    async function loadSearchHistory() {
        try {
            const result = await chrome.storage.local.get(['searchHistory']);
            const history = result.searchHistory || [];
            renderSearchHistory(history);
        } catch (error) {
            console.error('Error loading search history:', error);
        }
    }

    // 검색 기록 표시
    function showSearchHistory() {
        const dropdown = document.getElementById('searchHistoryDropdown');
        dropdown.classList.add('visible');
        loadSearchHistory();
    }

    // 검색 기록 숨기기
    function hideSearchHistory() {
        const dropdown = document.getElementById('searchHistoryDropdown');
        dropdown.classList.remove('visible');
    }

        // 검색 기록 필터링
    async function filterSearchHistory(query) {
        try {
            const result = await chrome.storage.local.get(['searchHistory']);
            const history = result.searchHistory || [];

            const filtered = query ?
                history.filter(item => item.toLowerCase().includes(query.toLowerCase())) :
                history;

            renderSearchHistory(filtered);
        } catch (error) {
            console.error('Error filtering search history:', error);
        }
    }

    // 자동완성과 검색 기록을 함께 로드
    async function loadSuggestionsAndHistory(query) {
        try {
            // 자동완성 결과와 검색 기록을 병렬로 가져오기
            const [suggestions, historyResult] = await Promise.all([
                getGoogleSuggestions(query),
                chrome.storage.local.get(['searchHistory'])
            ]);

            const history = historyResult.searchHistory || [];
            const filteredHistory = history.filter(item =>
                item.toLowerCase().includes(query.toLowerCase())
            );

            renderSuggestionsAndHistory(suggestions, filteredHistory, query);
        } catch (error) {
            console.error('Error loading suggestions and history:', error);
            // 오류 발생 시 검색 기록만 표시
            await filterSearchHistory(query);
        }
    }

    // Google Suggest API에서 자동완성 결과 가져오기
    async function getGoogleSuggestions(query) {
        try {
            // 여러 Google Suggest API 엔드포인트 시도
            const endpoints = [
                `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`,
                `https://clients1.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`
            ];

            for (const endpoint of endpoints) {
                try {
                    const response = await fetch(endpoint, {
                        method: 'GET',
                        mode: 'cors',
                        credentials: 'omit'
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
                            return data[1].slice(0, 8); // 최대 8개 제안
                        }
                    }
                } catch (error) {
                    console.log(`Failed to fetch from ${endpoint}:`, error);
                    continue;
                }
            }

            // CORS 문제가 있는 경우 JSONP 방식 시도
            return await getGoogleSuggestionsJSONP(query);
        } catch (error) {
            console.error('Error fetching Google suggestions:', error);
            return [];
        }
    }

    // JSONP 방식으로 Google Suggest API 호출
    async function getGoogleSuggestionsJSONP(query) {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            const callbackName = 'google_suggest_callback_' + Date.now();

            // 글로벌 콜백 함수 생성
            window[callbackName] = function(data) {
                try {
                    if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
                        resolve(data[1].slice(0, 8));
                    } else {
                        resolve([]);
                    }
                } catch (error) {
                    resolve([]);
                }

                // 정리
                document.head.removeChild(script);
                delete window[callbackName];
            };

            // 5초 타임아웃
            setTimeout(() => {
                if (window[callbackName]) {
                    window[callbackName]([]);
                }
            }, 5000);

            script.src = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}&callback=${callbackName}`;
            document.head.appendChild(script);
        });
    }

        // 자동완성과 검색 기록을 함께 렌더링
    function renderSuggestionsAndHistory(suggestions, history, query) {
        const dropdown = document.getElementById('searchHistoryDropdown');
        let html = '';

        // 자동완성 결과 섹션
        if (suggestions.length > 0) {
            html += '<div class="search-suggestions-section">';
            html += '<div class="search-suggestions-header">Search suggestions</div>';
            html += suggestions.map(suggestion => {
                const highlightedText = highlightQuery(suggestion, query);
                return `
                    <div class="search-suggestion-item" data-query="${escapeHtml(suggestion)}">
                        <div class="search-suggestion-icon">🔍</div>
                        <div class="search-suggestion-text">${highlightedText}</div>
                    </div>
                `;
            }).join('');
            html += '</div>';
        }

        // 검색 기록 섹션
        if (history.length > 0) {
            html += '<div class="search-history-section">';
            if (suggestions.length > 0) {
                html += '<div class="search-suggestions-header">Recent searches</div>';
            }
            html += history.map(historyQuery => {
                const isUrl = isValidUrl(historyQuery);
                const icon = isUrl ? '🌐' : '🔍';
                const highlightedText = highlightQuery(historyQuery, query);

                return `
                    <div class="search-history-item" data-query="${escapeHtml(historyQuery)}">
                        <div class="search-history-icon">${icon}</div>
                        <div class="search-history-text">${highlightedText}</div>
                        <div class="search-history-delete" title="Delete">×</div>
                    </div>
                `;
            }).join('');
            html += '</div>';
        }

        // 결과가 없는 경우
        if (suggestions.length === 0 && history.length === 0) {
            html = '<div class="search-history-empty">No suggestions or history</div>';
        }

        dropdown.innerHTML = html;

        // 이벤트 리스너 추가
        addSearchItemEventListeners();
    }

    // 검색 기록만 렌더링
    function renderSearchHistory(history) {
        const dropdown = document.getElementById('searchHistoryDropdown');

        if (history.length === 0) {
            dropdown.innerHTML = '<div class="search-history-empty">No search history</div>';
            return;
        }

        dropdown.innerHTML = history.map(query => {
            const isUrl = isValidUrl(query);
            const icon = isUrl ? '🌐' : '🔍';

            return `
                <div class="search-history-item" data-query="${escapeHtml(query)}">
                    <div class="search-history-icon">${icon}</div>
                    <div class="search-history-text">${escapeHtml(query)}</div>
                    <div class="search-history-delete" title="Delete">×</div>
                </div>
            `;
        }).join('');

        // 이벤트 리스너 추가
        addSearchItemEventListeners();
    }

    // 검색 아이템 이벤트 리스너 추가
    function addSearchItemEventListeners() {
        const dropdown = document.getElementById('searchHistoryDropdown');

        // 자동완성 및 검색 기록 클릭 이벤트
        dropdown.querySelectorAll('.search-suggestion-item, .search-history-item').forEach(item => {
            item.addEventListener('click', async (event) => {
                if (event.target.classList.contains('search-history-delete')) {
                    return; // 삭제 버튼 클릭 시 무시
                }

                const query = item.dataset.query;
                const searchInput = document.getElementById('searchInput');
                searchInput.value = query;

                await saveSearchHistory(query);
                handleSearch(query);
            });
        });

        // 검색 기록 삭제 버튼 이벤트
        dropdown.querySelectorAll('.search-history-delete').forEach(deleteBtn => {
            deleteBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                const query = deleteBtn.closest('.search-history-item').dataset.query;
                await deleteSearchHistoryItem(query);

                // 현재 검색어가 있으면 자동완성과 함께 다시 로드
                const searchInput = document.getElementById('searchInput');
                const currentQuery = searchInput.value.trim();
                if (currentQuery) {
                    await loadSuggestionsAndHistory(currentQuery);
                } else {
                    await loadSearchHistory();
                }
            });
        });
    }

    // 검색어 하이라이트 처리
    function highlightQuery(text, query) {
        if (!query) return escapeHtml(text);

        const escapedText = escapeHtml(text);
        const escapedQuery = escapeHtml(query);

        try {
            const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            return escapedText.replace(regex, '<span class="highlight">$1</span>');
        } catch (error) {
            return escapedText;
        }
    }

    // 검색 기록 개별 삭제
    async function deleteSearchHistoryItem(queryToDelete) {
        try {
            const result = await chrome.storage.local.get(['searchHistory']);
            let history = result.searchHistory || [];

            history = history.filter(item => item !== queryToDelete);

            await chrome.storage.local.set({ searchHistory: history });
        } catch (error) {
            console.error('Error deleting search history item:', error);
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Google 헤더 메뉴 초기화
    function initializeGoogleHeader() {
        const googleAppsBtn = document.querySelector('.google-apps-btn');
        const googleAppsDropdown = document.getElementById('googleAppsDropdown');

        // Google 앱 메뉴 클릭 이벤트
        if (googleAppsBtn && googleAppsDropdown) {
            googleAppsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                googleAppsDropdown.classList.toggle('visible');
            });

            // 드롭다운 외부 클릭 시 닫기
            document.addEventListener('click', (e) => {
                if (!googleAppsBtn.contains(e.target) && !googleAppsDropdown.contains(e.target)) {
                    googleAppsDropdown.classList.remove('visible');
                }
            });

            // 드롭다운 내부 클릭 시 전파 방지 (링크는 제외)
            googleAppsDropdown.addEventListener('click', (e) => {
                if (e.target.tagName === 'A' || e.target.closest('a')) {
                    // 링크 클릭 시 드롭다운 닫기
                    googleAppsDropdown.classList.remove('visible');
                } else {
                    e.stopPropagation();
                }
            });
        }

        // Search Labs 클릭 이벤트
        const searchLabsBtn = document.querySelector('[title="Search Labs"]');
        if (searchLabsBtn) {
            searchLabsBtn.addEventListener('click', () => {
                window.open('https://labs.google.com/search?source=ntp', '_blank');
            });
        }

        // 프로필 버튼 클릭 이벤트
        const profileBtn = document.querySelector('.header-profile-btn');
        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                window.open('https://myaccount.google.com/', '_blank');
            });
        }
    }
});
