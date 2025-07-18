document.addEventListener('DOMContentLoaded', async () => {
    const closedSessionsContainer = document.getElementById('closedSessions');
    const autoSavedSessionsContainer = document.getElementById('autoSavedSessions');
    const openOptionsBtn = document.getElementById('openOptionsBtn');

    // 초기 로드
    await loadAllSessions();

    // 설정 페이지 열기
    openOptionsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    async function loadAllSessions() {
        try {
            const [closedSessions, autoSavedSessions] = await Promise.all([
                loadClosedSessions(),
                loadAutoSavedSessions()
            ]);

            renderSessions(closedSessionsContainer, closedSessions.slice(0, 3), 'closed'); // 최대 3개만 표시
            renderSessions(autoSavedSessionsContainer, autoSavedSessions.slice(0, 3), 'auto'); // 최대 3개만 표시
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
                    ${type === 'closed' ? 'No recent sessions' : 'No auto-saved sessions'}
                </div>
            `;
            return;
        }

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
            if (tab.groupId) {
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

        // 탭과 그룹 수를 제한하여 표시
        const maxTabsToShow = 3;
        const maxGroupsToShow = 3;

        const displayTabs = ungroupedTabs.slice(0, maxTabsToShow);
        const displayGroups = session.groups.slice(0, maxGroupsToShow);

        return `
            <div class="session-item" data-session-id="${session.id}">
                <div class="session-header">
                    <div>
                        <div class="session-title">${escapeHtml(session.name)}</div>
                        <div class="session-info">
                            📑 ${session.tabCount} tabs • 📁 ${session.groupCount} groups
                        </div>
                    </div>
                    <div>
                        <span class="session-time">${time}</span>
                        <span class="expand-icon">▶</span>
                    </div>
                </div>

                <div class="session-content">
                    <div class="tabs-groups-grid">
                        <div class="tabs-section">
                            <div class="section-title">📑 Tabs</div>
                            <div class="tabs-list">
                                ${displayTabs.map(tab => createTabItem(tab)).join('')}
                                ${ungroupedTabs.length === 0 ? '<div style="color: #999; font-size: 10px;">No individual tabs</div>' : ''}
                                ${ungroupedTabs.length > maxTabsToShow ? `<div style="color: #999; font-size: 10px;">+${ungroupedTabs.length - maxTabsToShow} more</div>` : ''}
                            </div>
                        </div>

                        <div class="groups-section">
                            <div class="section-title">📁 Groups</div>
                            <div class="groups-list">
                                ${displayGroups.map(group => createGroupItem(group, tabsByGroup.get(group.id) || [])).join('')}
                                ${session.groupCount === 0 ? '<div style="color: #999; font-size: 10px;">No groups</div>' : ''}
                                ${session.groupCount > maxGroupsToShow ? `<div style="color: #999; font-size: 10px;">+${session.groupCount - maxGroupsToShow} more</div>` : ''}
                            </div>
                        </div>
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

    function toggleSessionContent(event) {
        const sessionItem = event.target.closest('.session-item');
        const content = sessionItem.querySelector('.session-content');
        const expandIcon = sessionItem.querySelector('.expand-icon');

        content.classList.toggle('expanded');
        expandIcon.classList.toggle('expanded');
        expandIcon.textContent = content.classList.contains('expanded') ? '▼' : '▶';
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

            showNotification(`Restored: ${tabTitle}`);
            window.close(); // 팝업 닫기
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

        // 로딩 표시
        const originalText = groupItem.innerHTML;
        groupItem.style.opacity = '0.5';
        groupItem.style.pointerEvents = 'none';

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'restoreGroup',
                sessionId: sessionId,
                groupId: groupId
            });

            if (response.success) {
                const restoredTitle = response.groupTitle || groupTitle;
                showNotification(`Restored: ${restoredTitle}`);
                window.close(); // 팝업 닫기
            } else {
                console.error('Group restore failed:', response.error);
                showNotification(`Failed: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error restoring group:', error);
            showNotification(`Error: ${error.message}`, 'error');
        } finally {
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
                openInNewWindow: openInNewWindow
            });

            if (response.success) {
                showNotification(`Restored ${response.tabCount} tabs`);
                window.close(); // 팝업 닫기
            } else {
                showNotification(`Failed: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error restoring session:', error);
            showNotification(`Error: ${error.message}`, 'error');
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

        document.body.appendChild(notification);

        // 2초 후 제거
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 2000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
