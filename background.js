// ============== Auto Session Save System ==============

let autoSaveInterval = null;
let lastSaveTime = 0;
let autoSaveSettings = {
  enabled: true,
  trigger: "time", // "time" or "change"
  interval: 60, // seconds for time-based saving
  detectTabClose: true,
  detectTabCreate: true,
  detectUrlChange: true
};

// 탭 정보 캐시 (탭 닫힘 감지를 위해)
let tabCache = new Map();
let groupCache = new Map();

// 사용하지 않는 변수 제거됨

// 탭과 그룹 정보 캐시 업데이트
async function updateTabCache() {
  try {
    const tabs = await chrome.tabs.query({});
    // 기존 캐시를 완전히 지우지 말고 업데이트만 하기
    tabs.forEach(tab => {
      // chrome:// URL이나 확장 프로그램 페이지는 캐시하지 않기
      if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        tabCache.set(tab.id, {
          id: tab.id,
          url: tab.url,
          title: tab.title,
          index: tab.index,
          active: tab.active,
          pinned: tab.pinned,
          groupId: tab.groupId,
          windowId: tab.windowId,
          favicon: tab.favIconUrl
        });
      }
    });

    // 그룹 정보도 캐시
    const groups = await chrome.tabGroups.query({});
    groups.forEach(group => {
      groupCache.set(group.id, {
        id: group.id,
        title: group.title,
        color: group.color,
        collapsed: group.collapsed,
        windowId: group.windowId
      });
    });
  } catch (error) {
    console.error("Error updating tab/group cache:", error);
  }
}

// 탭 생성/업데이트 감지
chrome.tabs.onCreated.addListener(async (tab) => {
  // 새로 생성된 탭만 캐시에 추가
  if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    tabCache.set(tab.id, {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      index: tab.index,
      active: tab.active,
      pinned: tab.pinned,
      groupId: tab.groupId,
      windowId: tab.windowId,
      favicon: tab.favIconUrl
    });

    // 변경 감지 기반 자동 저장
    if (autoSaveSettings.enabled && autoSaveSettings.trigger === "change" && autoSaveSettings.detectTabCreate) {
      // 새 탭이 실제로 어떤 웹사이트로 이동했을 때만 저장 (chrome://newtab이 아닌 경우)
      if (tab.url && tab.url !== 'chrome://newtab/' && !tab.url.startsWith('chrome://')) {
        setTimeout(async () => {
          try {
            const { autoSaveAllWindows } = await chrome.storage.sync.get(['autoSaveAllWindows']);
            await autoSaveCurrentSession(autoSaveAllWindows === true);
          } catch (error) {
            console.error("Auto-save on tab create error:", error);
          }
        }, 1000); // 1초 후에 저장 (페이지 로딩 대기)
      }
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // URL이 chrome:// 등으로 변경되면 캐시를 업데이트하지 않음
  if (changeInfo.url && (changeInfo.url.startsWith('chrome://') || changeInfo.url.startsWith('chrome-extension://'))) {
    console.log(`Ignoring update to ${changeInfo.url} for tab ${tabId}`);
    return;
  }

  // 유효한 URL로 업데이트되는 경우에만 캐시 갱신
  if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    const oldTabInfo = tabCache.get(tabId);

    tabCache.set(tab.id, {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      index: tab.index,
      active: tab.active,
      pinned: tab.pinned,
      groupId: tab.groupId,
      windowId: tab.windowId,
      favicon: tab.favIconUrl
    });

    // 변경 감지 기반 자동 저장 (URL이나 도메인이 변경되었을 때)
    if (autoSaveSettings.enabled && autoSaveSettings.trigger === "change" && autoSaveSettings.detectUrlChange) {
      if (changeInfo.url && oldTabInfo && oldTabInfo.url !== changeInfo.url) {
        // 도메인이나 경로가 실제로 변경되었는지 확인
        try {
          const oldDomain = new URL(oldTabInfo.url).hostname;
          const newDomain = new URL(changeInfo.url).hostname;
          const oldPath = new URL(oldTabInfo.url).pathname;
          const newPath = new URL(changeInfo.url).pathname;

          if (oldDomain !== newDomain || oldPath !== newPath) {
            setTimeout(async () => {
              try {
                const { autoSaveAllWindows } = await chrome.storage.sync.get(['autoSaveAllWindows']);
                await autoSaveCurrentSession(autoSaveAllWindows === true);
              } catch (error) {
                console.error("Auto-save on URL change error:", error);
              }
            }, 1000); // 1초 후에 저장 (페이지 로딩 대기)
          }
        } catch (error) {
          console.error("Error parsing URLs for change detection:", error);
        }
      }
    }
  }
});

chrome.tabs.onMoved.addListener(() => updateTabCache());
chrome.tabs.onAttached.addListener(() => updateTabCache());
chrome.tabs.onDetached.addListener(() => updateTabCache());

// 그룹 변경 감지
chrome.tabGroups.onCreated.addListener(() => updateTabCache());
chrome.tabGroups.onUpdated.addListener(() => updateTabCache());
chrome.tabGroups.onMoved.addListener(() => updateTabCache());

// 그룹 제거 감지
chrome.tabGroups.onRemoved.addListener(async (group) => {
  try {
    console.log(`Group removed - ID: ${group.id}`);

    // 그룹에 속한 탭들을 개별 탭으로 저장하도록 표시
    const groupTabs = [];
    for (const [tabId, tabInfo] of tabCache.entries()) {
      if (tabInfo.groupId === group.id) {
        groupTabs.push(tabId);
        // 개별 탭으로 저장하기 위해 그룹 ID 제거
        tabInfo.groupId = -1;
        tabCache.set(tabId, tabInfo);
      }
    }
    console.log(`Found ${groupTabs.length} tabs from deleted group, will save as individual tabs`);

  } catch (error) {
    console.error("Error in group remove handler:", error);
  }
});

// 자동 세션 저장 시작 (설정에 따라 분기)
function startAutoSave() {
  if (!autoSaveSettings.enabled) return;

  if (autoSaveSettings.trigger === "time") {
    startTimeBasedAutoSave();
  }
  // change-based는 이벤트 리스너에서 자동 처리됨
}

// 시간 기반 자동 저장 시작
function startTimeBasedAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
  }

  autoSaveInterval = setInterval(async () => {
    try {
      if (autoSaveSettings.enabled && autoSaveSettings.trigger === "time") {
        const { autoSaveAllWindows } = await chrome.storage.sync.get(['autoSaveAllWindows']);
        await autoSaveCurrentSession(autoSaveAllWindows === true);
      }
    } catch (error) {
      console.error("Auto-save error:", error);
    }
  }, autoSaveSettings.interval * 1000);
}

// 자동 세션 저장 중지
function stopAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}

// 자동 세션 저장 함수
async function autoSaveCurrentSession(saveAllWindows = false) {
  try {
    const now = Date.now();

    // 너무 자주 저장하는 것을 방지 (최소 5초 간격)
    if (now - lastSaveTime < 5000) {
      return;
    }

    let allTabs = [];
    let allGroups = [];

    if (saveAllWindows) {
      // 모든 창의 탭과 그룹 가져오기
      const windows = await chrome.windows.getAll();

      for (const window of windows) {
        const tabs = await chrome.tabs.query({ windowId: window.id });
        const groups = await chrome.tabGroups.query({ windowId: window.id });

        // 탭에 windowId 추가
        const tabsWithWindow = tabs.map(tab => ({
          ...tab,
          sourceWindowId: window.id
        }));

        // 그룹에 windowId 추가
        const groupsWithWindow = groups.map(group => ({
          ...group,
          sourceWindowId: window.id
        }));

        allTabs = allTabs.concat(tabsWithWindow);
        allGroups = allGroups.concat(groupsWithWindow);
      }
    } else {
      // 현재 활성 창의 탭과 그룹만 가져오기
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (activeTab) {
        allTabs = await chrome.tabs.query({ windowId: activeTab.windowId });
        allGroups = await chrome.tabGroups.query({ windowId: activeTab.windowId });
      }
    }

    if (allTabs.length === 0) {
      return;
    }

    // 세션 데이터 생성
    const sessionData = {
      id: `auto_${now}`,
      name: `Auto-saved ${new Date(now).toLocaleString()}`,
      createdAt: now,
      isAutoSaved: true,
      saveAllWindows: saveAllWindows,
      tabs: allTabs.map(tab => ({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        index: tab.index,
        active: tab.active,
        pinned: tab.pinned,
        groupId: tab.groupId,
        favicon: tab.favIconUrl || null,
        sourceWindowId: tab.sourceWindowId || tab.windowId
      })),
      groups: allGroups.map(group => ({
        id: group.id,
        title: group.title,
        color: group.color,
        collapsed: group.collapsed,
        sourceWindowId: group.sourceWindowId || group.windowId
      })),
      tabCount: allTabs.length,
      groupCount: allGroups.length,
      windowCount: saveAllWindows ? (await chrome.windows.getAll()).length : 1
    };

    // 자동 저장 세션 목록 관리
    const result = await chrome.storage.local.get(['autoSavedSessions']);
    let autoSavedSessions = result.autoSavedSessions || [];

    // 최신 세션 추가
    autoSavedSessions.unshift(sessionData);

    // 최대 50개 자동 저장 세션 유지
    if (autoSavedSessions.length > 50) {
      autoSavedSessions = autoSavedSessions.slice(0, 50);
    }

    await chrome.storage.local.set({ autoSavedSessions });

    lastSaveTime = now;
    console.log("Auto-saved session:", sessionData.id);

  } catch (error) {
    console.error("Error in auto-save:", error);
  }
}



// 확장 프로그램 시작 시 탭 캐시 초기화
setTimeout(async () => {
  await updateTabCache();
  console.log("Initial tab cache populated:", tabCache.size, "tabs");
  console.log("Initial group cache populated:", groupCache.size, "groups");

  // 현재 그룹 정보 로그
  for (const [groupId, groupInfo] of groupCache.entries()) {
    console.log(`Group ${groupId}: ${groupInfo.title} (${groupInfo.color})`);
  }
}, 1000);

// 주기적으로 캐시 업데이트 (그룹 정보 유지)
setInterval(async () => {
  await updateTabCache();
}, 10000); // 10초마다

// 탭 닫힘 감지 및 마지막 세션 저장
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  try {
    console.log(`Tab removed - ID: ${tabId}, Window: ${removeInfo.windowId}, IsWindowClosing: ${removeInfo.isWindowClosing}`);

    // 캐시된 탭 정보가 있는지 먼저 확인
    const cachedTab = tabCache.get(tabId);
    console.log("Cached tab info before removal:", cachedTab);

    // 변경 감지 기반 자동 저장 (탭 닫힘)
    if (autoSaveSettings.enabled && autoSaveSettings.trigger === "change" && autoSaveSettings.detectTabClose) {
      const { autoSaveAllWindows } = await chrome.storage.sync.get(['autoSaveAllWindows']);
      await autoSaveCurrentSession(autoSaveAllWindows === true);
    }

    // 기존 자동 저장 로직도 유지 (시간 기반인 경우)
    if (autoSaveSettings.enabled && autoSaveSettings.trigger === "time") {
      const { autoSaveAllWindows } = await chrome.storage.sync.get(['autoSaveAllWindows']);

      // 먼저 현재 상태를 자동 저장하여 최신 정보 확보
      await autoSaveCurrentSession(autoSaveAllWindows === true);

      // 모든 탭을 개별 탭으로 저장
      await saveClosedTab(tabId, removeInfo.windowId, removeInfo.isWindowClosing);
    }
  } catch (error) {
    console.error("Error in tab close handler:", error);
  }
});

// 닫힌 탭 저장
async function saveClosedTab(closedTabId, closedWindowId, isWindowClosing = false) {
  try {
    const now = Date.now();

    // 현재 남은 탭들과 그룹들을 조회 (창이 닫혔을 수도 있으므로 예외 처리)
    let currentTabs = [];
    let currentGroups = [];

    try {
      if (!isWindowClosing) {
        currentTabs = await chrome.tabs.query({ windowId: closedWindowId });
        currentGroups = await chrome.tabGroups.query({ windowId: closedWindowId });
      }
    } catch (error) {
      console.log("Window already closed, using empty current tabs list");
    }

    // 최근 자동 저장된 세션에서 해당 창의 정보 가져오기
    const result = await chrome.storage.local.get(['autoSavedSessions']);
    const autoSavedSessions = result.autoSavedSessions || [];

    let closedTabs = [];
    let closedGroups = [];
    let sessionName = "";

    if (isWindowClosing) {
      // 창 전체가 닫힌 경우
      if (autoSavedSessions.length > 0) {
        const lastSession = autoSavedSessions[0];
        closedTabs = lastSession.tabs.filter(tab => tab.sourceWindowId === closedWindowId);
        closedGroups = lastSession.groups.filter(group => group.sourceWindowId === closedWindowId);
      }
      sessionName = `Closed window ${new Date(now).toLocaleString()}`;
    } else {
             // 개별 탭이 닫힌 경우 - 최근 세션에서 닫힌 탭 찾기
       if (autoSavedSessions.length > 0) {
         const lastSession = autoSavedSessions[0];

         console.log("Looking for closed tab ID:", closedTabId);
         console.log("Available tabs in last session:", lastSession.tabs.map(tab => `${tab.id}: ${tab.title}`));

         // 닫힌 탭 ID로 직접 검색
         const closedTab = lastSession.tabs.find(tab =>
           tab.id === closedTabId && tab.sourceWindowId === closedWindowId
         );

         if (closedTab) {
           console.log("Found closed tab:", closedTab);
           closedTabs = [closedTab];

           // 닫힌 탭이 속한 그룹이 있다면 그 그룹 정보도 포함
           if (closedTab.groupId && closedTab.groupId !== -1) {
             const relatedGroup = lastSession.groups.find(group =>
               group.id === closedTab.groupId && group.sourceWindowId === closedWindowId
             );
             if (relatedGroup) {
               closedGroups = [relatedGroup];
               console.log("Found related group:", relatedGroup);
             }
           }

           sessionName = `Closed tab: ${closedTab.title || 'Untitled'}`;
         } else {
           console.log("Could not find tab with ID", closedTabId, "in last session");
         }
       }

             // 자동 저장된 세션에서 찾지 못한 경우, 캐시된 탭 정보 사용
       if (closedTabs.length === 0) {
         const cachedTab = tabCache.get(closedTabId);
         console.log("Looking for tab in cache. Cache size:", tabCache.size);
         console.log("Available cached tab IDs:", Array.from(tabCache.keys()));

         if (cachedTab) {
           console.log("Using cached tab info:", cachedTab);
           closedTabs = [{
             id: cachedTab.id,
             url: cachedTab.url,
             title: cachedTab.title,
             index: cachedTab.index,
             active: cachedTab.active,
             pinned: cachedTab.pinned,
             groupId: cachedTab.groupId,
             sourceWindowId: cachedTab.windowId,
             favicon: cachedTab.favicon
           }];
           sessionName = `Closed tab: ${cachedTab.title || 'Untitled'}`;

           // 그룹 정보도 캐시에서 확인
           if (cachedTab.groupId && cachedTab.groupId !== -1) {
             const cachedGroup = groupCache.get(cachedTab.groupId);
             if (cachedGroup) {
               console.log("Found cached group info:", cachedGroup);
               closedGroups = [{
                 id: cachedGroup.id,
                 title: cachedGroup.title,
                 color: cachedGroup.color,
                 collapsed: cachedGroup.collapsed,
                 sourceWindowId: cachedGroup.windowId
               }];
             }
           }
         } else {
           // 캐시에도 없는 경우 기본 정보 생성
           const timestamp = new Date(now).toLocaleTimeString([], {
             hour: '2-digit',
             minute: '2-digit'
           });
           closedTabs = [{
             id: closedTabId,
             url: 'chrome://newtab/',
             title: `Closed tab (${timestamp})`,
             index: 0,
             active: false,
             pinned: false,
             groupId: -1,
             sourceWindowId: closedWindowId,
             favicon: null
           }];
           sessionName = `Closed tab: ${timestamp}`;
         }

         // 사용된 캐시 삭제
         tabCache.delete(closedTabId);
       }
    }

    if (closedTabs.length === 0) {
      return;
    }

    // 닫힌 세션 데이터 생성
    const closedSessionData = {
      id: `closed_${now}`,
      name: sessionName,
      createdAt: now,
      isClosedSession: true,
      tabs: closedTabs,
      groups: closedGroups,
      tabCount: closedTabs.length,
      groupCount: closedGroups.length,
      windowCount: isWindowClosing ? 1 : 0
    };

    // 닫힌 세션 목록 관리
    const closedResult = await chrome.storage.local.get(['closedSessions']);
    let closedSessions = closedResult.closedSessions || [];

    // 최신 닫힌 세션 추가
    closedSessions.unshift(closedSessionData);

    // 최대 20개 닫힌 세션 유지
    if (closedSessions.length > 20) {
      closedSessions = closedSessions.slice(0, 20);
    }

    await chrome.storage.local.set({ closedSessions });

    console.log("Saved closed session:", closedSessionData.id, "isWindowClosing:", isWindowClosing, "tabs:", closedTabs.length);
    console.log("Closed session data:", JSON.stringify(closedSessionData, null, 2));

  } catch (error) {
    console.error("Error saving closed session:", error);
  }
}

// saveClosedGroup 함수 제거됨 (더 이상 사용하지 않음)

// 사용하지 않는 함수 제거됨

async function getOptions() {
  let data = await chrome.storage.sync.get("groupTabs");
  return data.groupTabs ?? false;
}

async function getSortOrder() {
  let data = await chrome.storage.sync.get(["sortOrder", "customDomainOrder"]);
  return {
    sortOrder: data.sortOrder ?? "alphabetical",
    customDomainOrder: data.customDomainOrder ?? []
  };
}

async function getExistingGroupId(domain) {
  const groups = await chrome.tabGroups.query({});
  const tabsPromises = groups.map(group =>
    chrome.tabs.query({ groupId: group.id })
      .then(tabs => ({ group, tabs }))
  );

  const results = await Promise.all(tabsPromises);

  for (const { group, tabs } of results) {
    if (tabs.length > 0) {
      const groupDomain = getCleanDomainName(tabs[0].url);
      if (groupDomain.toLowerCase() === domain.toLowerCase()) {
        return group.id;
      }
    }
  }
  return null;
}

// 도메인 정렬 함수
function sortDomains(domainMap, sortOrder, customDomainOrder = []) {
  const domains = Array.from(domainMap.keys());

  switch (sortOrder) {
    case "alphabetical":
      return domains.sort();

    case "recent":
      // 최근 방문순 정렬 (각 도메인의 가장 최근 탭 기준)
      return domains.sort((a, b) => {
        const tabsA = domainMap.get(a);
        const tabsB = domainMap.get(b);

        // 각 도메인에서 가장 최근에 접근한 탭의 시간을 찾기
        const maxLastAccessedA = Math.max(...tabsA.map(tab => tab.lastAccessed || 0));
        const maxLastAccessedB = Math.max(...tabsB.map(tab => tab.lastAccessed || 0));

        return maxLastAccessedB - maxLastAccessedA; // 내림차순 (최근이 먼저)
      });

    case "custom":
      // 사용자 지정 순서
      if (customDomainOrder.length === 0) {
        return domains.sort(); // 사용자 지정 순서가 없으면 알파벳순
      }

      return domains.sort((a, b) => {
        const indexA = customDomainOrder.indexOf(a);
        const indexB = customDomainOrder.indexOf(b);

        // 둘 다 사용자 지정 순서에 있는 경우
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }

        // A만 사용자 지정 순서에 있는 경우
        if (indexA !== -1 && indexB === -1) {
          return -1;
        }

        // B만 사용자 지정 순서에 있는 경우
        if (indexA === -1 && indexB !== -1) {
          return 1;
        }

        // 둘 다 사용자 지정 순서에 없는 경우 알파벳순
        return a.localeCompare(b);
      });

    default:
      return domains.sort();
  }
}

function getDomainName(url) {
  try {
    let hostname = new URL(url).hostname;
    hostname = hostname.replace(/^www\./, '');

    const domainParts = hostname.split('.');

    // 도메인 파트가 2개 이하면 그대로 반환
    if (domainParts.length <= 2) {
      return hostname;
    }

    // 최상위 도메인(TLD)이 2개의 파트로 구성된 경우 (예: co.uk, co.kr 등)
    if (domainParts.length >= 3 && domainParts[domainParts.length - 2].length <= 3) {
      return domainParts.slice(-3).join('.');
    }

    // 그 외의 경우는 마지막 두 파트를 반환
    return domainParts.slice(-2).join('.');
  } catch (error) {
    console.error("Invalid URL:", url, error);
    return "unknown";
  }
}

// TLD를 제거하여 깔끔한 도메인 이름 반환
function getCleanDomainName(url) {
  try {
    const fullDomain = getDomainName(url);

    // 일반적인 TLD 패턴들을 정규식으로 제거
    const tldPatterns = [
      // 복합 TLD (2-part) - 먼저 처리
      /\.(co|com|org|net|edu|gov|mil|ac|ad)\.(kr|uk|jp|au|nz|za|in|th|sg|my|ph|vn|tw|hk|cn|br|mx|ar|cl|pe|co|ve|ec|bo|py|uy|gf|sr|gy|fk|gs)$/i,

      // 일반적인 단일 TLD
      /\.(com|org|net|edu|gov|mil|int|arpa|io|ai|tech|dev|app|info|biz|name|mobi|travel|museum|aero|coop|pro|xxx|jobs|cat|post|tel|asia|kr|jp|cn|de|fr|uk|ca|au|in|br|ru|it|es|mx|nl|se|no|dk|fi|pl|tr|gr|pt|cz|hu|ro|bg|hr|si|sk|ee|lv|lt|lu|be|at|ch|li|is|ie|mt|cy|md|mc|ad|sm|va|by|ua|ru|kz|uz|tj|tm|kg|am|az|ge|af|pk|bd|np|bt|lk|mv|mm|kh|la|vn|th|my|sg|id|bn|ph|tw|hk|mo|mn|kp|kr|jp|cn|fm|pw|mh|mp|gu|as|vi|pr|vg|ai|ag|bb|bs|bz|cr|cu|dm|do|gd|gt|ht|hn|jm|kn|ky|lc|ms|ni|pa|sv|tc|tt|vc)$/i
    ];

    let cleanDomain = fullDomain;

    // 각 패턴을 순서대로 적용
    for (const pattern of tldPatterns) {
      const match = cleanDomain.match(pattern);
      if (match) {
        cleanDomain = cleanDomain.replace(pattern, '');
        break; // 첫 번째 매치에서 중단
      }
    }

    // 빈 문자열이거나 점만 남은 경우 원래 도메인 반환
    if (!cleanDomain || cleanDomain === '.' || cleanDomain.length === 0) {
      return fullDomain;
    }

    return cleanDomain;
  } catch (error) {
    console.error("Error cleaning domain name:", url, error);
    return getDomainName(url);
  }
}

async function ensureOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({});
  const hasOffscreen = contexts.some((c) => c.contextType === "OFFSCREEN_DOCUMENT");

  if (!hasOffscreen) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["DOM_SCRAPING"],
      justification: "Extract favicon colors"
    });
  }
}

// 도메인별 기본 색상 반환 함수
function getDefaultColorForDomain(domain) {
  const defaultColors = {
    // 구글 서비스
    'google': 'blue', 'google.com': 'blue', 'gmail': 'red', 'gmail.com': 'red',
    'youtube': 'red', 'youtube.com': 'red', 'drive': 'yellow', 'drive.google.com': 'yellow',
    'docs': 'blue', 'docs.google.com': 'blue', 'sheets': 'green', 'sheets.google.com': 'green',
    'slides': 'yellow', 'slides.google.com': 'yellow',

    // 소셜 미디어
    'facebook': 'blue', 'facebook.com': 'blue', 'twitter': 'blue', 'twitter.com': 'blue',
    'instagram': 'purple', 'instagram.com': 'purple', 'linkedin': 'blue', 'linkedin.com': 'blue',
    'tiktok': 'red', 'tiktok.com': 'red', 'snapchat': 'yellow', 'snapchat.com': 'yellow',
    'discord': 'purple', 'discord.com': 'purple', 'telegram': 'blue', 'telegram.org': 'blue',
    'whatsapp': 'green', 'whatsapp.com': 'green',

    // 개발/기술
    'github': 'grey', 'github.com': 'grey', 'stackoverflow': 'orange', 'stackoverflow.com': 'orange',
    'codepen': 'grey', 'codepen.io': 'grey', 'jsfiddle': 'blue', 'jsfiddle.net': 'blue',
    'replit': 'orange', 'replit.com': 'orange', 'vercel': 'grey', 'vercel.com': 'grey',
    'netlify': 'cyan', 'netlify.com': 'cyan', 'heroku': 'purple', 'heroku.com': 'purple',

    // 한국 사이트
    'naver': 'green', 'naver.com': 'green', 'daum': 'orange', 'daum.net': 'orange',
    'kakao': 'yellow', 'kakao.com': 'yellow', 'coupang': 'red', 'coupang.com': 'red',
    'baemin': 'cyan', 'baemin.com': 'cyan', 'yogiyo': 'red', 'yogiyo.co.kr': 'red',
    'toss': 'blue', 'toss.im': 'blue', 'kakaopay': 'yellow', 'kakaopay.com': 'yellow',
    '11st': 'red', '11st.co.kr': 'red', 'gmarket': 'red', 'gmarket.co.kr': 'red',
    'interpark': 'blue', 'interpark.com': 'blue',

    // 쇼핑/이커머스
    'amazon': 'orange', 'amazon.com': 'orange', 'ebay': 'yellow', 'ebay.com': 'yellow',
    'aliexpress': 'orange', 'aliexpress.com': 'orange', 'shopify': 'green', 'shopify.com': 'green',
    'etsy': 'orange', 'etsy.com': 'orange',

    // 엔터테인먼트
    'netflix': 'red', 'netflix.com': 'red', 'spotify': 'green', 'spotify.com': 'green',
    'apple': 'grey', 'apple.com': 'grey', 'microsoft': 'blue', 'microsoft.com': 'blue',
    'steam': 'blue', 'steampowered.com': 'blue', 'twitch': 'purple', 'twitch.tv': 'purple',

    // 뉴스/정보
    'cnn': 'red', 'cnn.com': 'red', 'bbc': 'red', 'bbc.com': 'red', 'reuters': 'orange', 'reuters.com': 'orange',
    'nytimes': 'grey', 'nytimes.com': 'grey', 'washingtonpost': 'blue', 'washingtonpost.com': 'blue',
    'guardian': 'blue', 'theguardian.com': 'blue', 'medium': 'grey', 'medium.com': 'grey',
    'reddit': 'orange', 'reddit.com': 'orange',

    // 기타
    'paypal': 'blue', 'paypal.com': 'blue', 'stripe': 'purple', 'stripe.com': 'purple',
    'slack': 'purple', 'slack.com': 'purple', 'zoom': 'blue', 'zoom.us': 'blue',
    'notion': 'grey', 'notion.so': 'grey', 'trello': 'blue', 'trello.com': 'blue',
    'asana': 'red', 'asana.com': 'red', 'dropbox': 'blue', 'dropbox.com': 'blue',
    'onedrive': 'blue', 'onedrive.live.com': 'blue', 'icloud': 'blue', 'icloud.com': 'blue'
  };

  let defaultColor = defaultColors[domain.toLowerCase()];

  // 도메인에 특정 키워드가 포함된 경우 색상 추정
  if (!defaultColor) {
    if (domain.includes('google') || domain.includes('gmail')) defaultColor = 'blue';
    else if (domain.includes('youtube')) defaultColor = 'red';
    else if (domain.includes('facebook') || domain.includes('fb')) defaultColor = 'blue';
    else if (domain.includes('instagram')) defaultColor = 'purple';
    else if (domain.includes('twitter')) defaultColor = 'blue';
    else if (domain.includes('github')) defaultColor = 'grey';
    else if (domain.includes('naver')) defaultColor = 'green';
    else if (domain.includes('kakao')) defaultColor = 'yellow';
    else if (domain.includes('amazon')) defaultColor = 'orange';
    else if (domain.includes('netflix')) defaultColor = 'red';
    else if (domain.includes('spotify')) defaultColor = 'green';
    else if (domain.includes('reddit')) defaultColor = 'orange';
    else if (domain.includes('shop') || domain.includes('store')) defaultColor = 'orange';
    else if (domain.includes('blog') || domain.includes('news')) defaultColor = 'grey';
    else if (domain.includes('video') || domain.includes('tv')) defaultColor = 'red';
    else if (domain.includes('music') || domain.includes('sound')) defaultColor = 'green';
    else if (domain.includes('game')) defaultColor = 'blue';
    else if (domain.includes('pay') || domain.includes('bank')) defaultColor = 'blue';
    else defaultColor = 'grey';
  }

  return defaultColor;
}

async function getDominantColor(domain) {
  await ensureOffscreenDocument();

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      const fallbackColor = getDefaultColorForDomain(domain);
      console.warn(`Timeout for domain ${domain}, using fallback: ${fallbackColor}`);
      resolve(fallbackColor);
    }, 3000); // 3초 타임아웃으로 단축

    chrome.runtime.sendMessage({ action: "fetchFavicon", domain }, (response) => {
      clearTimeout(timeout);

      if (chrome.runtime.lastError) {
        const fallbackColor = getDefaultColorForDomain(domain);
        console.error(`Runtime error for ${domain}:`, chrome.runtime.lastError);
        console.log(`Using fallback color for ${domain}: ${fallbackColor}`);
        resolve(fallbackColor);
        return;
      }

      if (!response || !response.color) {
        const fallbackColor = getDefaultColorForDomain(domain);
        console.warn(`No color response for ${domain}, using fallback: ${fallbackColor}`);
        resolve(fallbackColor);
      } else {
        console.log(`Got color for ${domain}: ${response.color}`);
        resolve(response.color);
      }
    });
  });
}

chrome.action.onClicked.addListener(async () => {
  const [tabs, groupTabs, collapseGroups, sortSettings] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    getOptions(),
    chrome.storage.sync.get("collapseGroups").then(data => data.collapseGroups ?? false),
    getSortOrder()
  ]);

  const domainMap = new Map();
  for (const tab of tabs) {
    const domain = getCleanDomainName(tab.url);
    if (!domainMap.has(domain)) {
      domainMap.set(domain, []);
    }
    domainMap.get(domain).push(tab);
  }

  // 사용자 설정에 따른 정렬
  const sortedDomains = sortDomains(domainMap, sortSettings.sortOrder, sortSettings.customDomainOrder);
  console.log(`Sorted domains (${sortSettings.sortOrder}):`, sortedDomains);
  let index = 0;

  // 🔹 그룹화가 끝난 후 모든 탭 정렬 실행
  for (const domain of sortedDomains) {
    const tabArray = domainMap.get(domain);
    await Promise.all(tabArray.map(tab =>
      chrome.tabs.move(tab.id, { index: index++ })
    ));
  }

  for (const domain of sortedDomains) {
    const tabArray = domainMap.get(domain);
    const tabIds = tabArray.map(tab => tab.id).filter(Boolean);

    if (tabIds.length < 2 || !groupTabs) {
      // await Promise.all(tabArray.map(tab =>
      //   chrome.tabs.move(tab.id, { index: index++ })
      // ));
      continue;
    }

    try {
      const existingGroupId = await getExistingGroupId(domain);

      if (!existingGroupId) {
        console.log(`Creating new group for domain: ${domain}, tabs:`, tabIds);
        const groupId = await chrome.tabs.group({ tabIds });

        if (groupId) {
          // 그룹 기본 정보 설정
          await chrome.tabGroups.update(groupId, {
            title: domain,
            collapsed: collapseGroups
          });

          // 색상 추출 및 설정 (빠른 fallback 포함)
          try {
            console.log(`Fetching color for domain: ${domain}`);

            // 기본 색상을 먼저 설정 (즉시 시각적 피드백)
            const fallbackColor = getDefaultColorForDomain(domain);
            await chrome.tabGroups.update(groupId, { color: fallbackColor });
            console.log(`Set fallback color for ${domain}: ${fallbackColor}`);

            // 그 다음 favicon 색상 추출 시도 (원래 도메인 사용)
            const originalDomain = getDomainName(tabArray[0].url);
            console.log(`Domain for favicon request: ${originalDomain} (clean domain: ${domain})`);
            const dominantColor = await getDominantColor(originalDomain);
            if (dominantColor !== fallbackColor) {
              console.log(`Updating to extracted color for ${domain} (from ${originalDomain}): ${dominantColor}`);
              await chrome.tabGroups.update(groupId, { color: dominantColor });
            }
          } catch (error) {
            console.error(`Failed to set color for ${domain}:`, error);
            // 이미 fallback 색상이 설정되어 있으므로 추가 처리 불필요
          }
        }
      } else {
        console.log(`Adding tabs to existing group ${existingGroupId} for domain: ${domain}, tabs:`, tabIds);
        await chrome.tabs.group({ tabIds, groupId: existingGroupId });
      }

      // 50ms로 줄임 (필요한 경우에만 사용)
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`Failed to group tabs for ${domain}:`, error);
    }
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  console.log("Command received:", command);

  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!currentTab) return;

  const currentWindow = await chrome.windows.get(currentTab.windowId);
  const displays = await chrome.system.display.getInfo();
  const primaryDisplay = displays.find(display => display.isPrimary);

  if (!primaryDisplay) return;

  const screenWidth = primaryDisplay.workArea.width;
  const screenHeight = primaryDisplay.workArea.height;
  const halfWidth = Math.floor(screenWidth / 2);
  const halfHeight = Math.floor(screenHeight / 2);

  const updateProperties = {};

  switch (command) {
    case "resize-left":
      if(currentWindow.width === halfWidth && currentWindow.height === screenHeight) {
        updateProperties.left = 0;
      }else {
        updateProperties.left = 0;
        updateProperties.top = 0;
        updateProperties.width = halfWidth;
        updateProperties.height = screenHeight;
      }
      break;
    case "resize-right":
      if (currentWindow.width === halfWidth && currentWindow.height === halfHeight) {
        updateProperties.left = halfWidth;
      } else {
        updateProperties.left = halfWidth;
        updateProperties.top = 0;
        updateProperties.width = halfWidth;
        updateProperties.height = screenHeight;
      }
      break;
    case "resize-up":
      if (currentWindow.left === 0 && currentWindow.width === halfWidth) {
        updateProperties.left = 0;
        updateProperties.top = 0;
        updateProperties.width = halfWidth;
        updateProperties.height = halfHeight;
      } else if (currentWindow.top === halfHeight && currentWindow.height === halfHeight) {
        updateProperties.top = 0;
      } else {
        updateProperties.left = 0;
        updateProperties.top = 0;
        updateProperties.width = screenWidth;
        updateProperties.height = halfHeight;
      }
      break;
    case "resize-down":
      if (currentWindow.left === 0 && currentWindow.width === halfWidth) {
        updateProperties.left = 0;
        updateProperties.top = halfHeight;
        updateProperties.width = halfWidth;
        updateProperties.height = halfHeight;
      } else if (currentWindow.top === 0 && currentWindow.height === halfHeight) {
        updateProperties.top = halfHeight;
      } else {
        updateProperties.left = 0;
        updateProperties.top = halfHeight;
        updateProperties.width = screenWidth;
        updateProperties.height = halfHeight;
      }
      break;
  }

  chrome.windows.update(currentTab.windowId, updateProperties);
});

// ============== Session Management Functions ==============

// 세션 저장 함수
async function saveCurrentSession(sessionName) {
  try {
    console.log("Saving current session:", sessionName);

    // 현재 창의 모든 탭 가져오기
    const tabs = await chrome.tabs.query({ currentWindow: true });

    // 현재 창의 모든 그룹 가져오기
    const groups = await chrome.tabGroups.query({ windowId: tabs[0].windowId });

    // 그룹 정보 매핑
    const groupsMap = new Map();
    for (const group of groups) {
      groupsMap.set(group.id, {
        id: group.id,
        title: group.title,
        color: group.color,
        collapsed: group.collapsed
      });
    }

    // 탭 정보 수집
    const tabsData = tabs.map(tab => ({
      url: tab.url,
      title: tab.title,
      index: tab.index,
      active: tab.active,
      pinned: tab.pinned,
      groupId: tab.groupId !== -1 ? tab.groupId : null,
      favicon: tab.favIconUrl || null
    }));

    // 세션 데이터 생성
    const sessionData = {
      id: `session_${Date.now()}`,
      name: sessionName,
      createdAt: Date.now(),
      tabs: tabsData,
      groups: Array.from(groupsMap.values()),
      tabCount: tabs.length,
      groupCount: groups.length
    };

    // 기존 세션 목록 가져오기
    const result = await chrome.storage.local.get(['savedSessions']);
    const savedSessions = result.savedSessions || [];

    // 새 세션 추가
    savedSessions.push(sessionData);

    // 저장 (최대 20개 세션 유지)
    if (savedSessions.length > 20) {
      savedSessions.shift();
    }

    await chrome.storage.local.set({ savedSessions });

    console.log("Session saved successfully:", sessionData.id);
    return { success: true, sessionId: sessionData.id };

  } catch (error) {
    console.error("Error saving session:", error);
    return { success: false, error: error.message };
  }
}

// 세션 복원 함수
async function restoreSession(sessionId, openInNewWindow = true) {
  try {
    console.log("Restoring session:", sessionId);

    // 세션 데이터 가져오기 (수동 저장, 자동 저장, 닫힌 세션 모두 확인)
    const [manualResult, autoResult, closedResult] = await Promise.all([
      chrome.storage.local.get(['savedSessions']),
      chrome.storage.local.get(['autoSavedSessions']),
      chrome.storage.local.get(['closedSessions'])
    ]);

    let sessionData = null;

    // 수동 저장된 세션에서 찾기
    const savedSessions = manualResult.savedSessions || [];
    sessionData = savedSessions.find(session => session.id === sessionId);

    // 자동 저장된 세션에서 찾기
    if (!sessionData) {
      const autoSavedSessions = autoResult.autoSavedSessions || [];
      sessionData = autoSavedSessions.find(session => session.id === sessionId);
    }

    // 닫힌 세션에서 찾기
    if (!sessionData) {
      const closedSessions = closedResult.closedSessions || [];
      sessionData = closedSessions.find(session => session.id === sessionId);
    }

    if (!sessionData) {
      throw new Error("Session not found");
    }

    console.log("Found session data:", sessionData);

    // 새 창 생성 또는 현재 창 사용
    let windowId;
    if (openInNewWindow) {
      const newWindow = await chrome.windows.create({
        focused: true,
        state: "normal"
      });
      windowId = newWindow.id;

      // 창이 제대로 생성되었는지 확인
      const windowInfo = await chrome.windows.get(windowId);
      if (!windowInfo) {
        throw new Error("Failed to create new window");
      }

      console.log("Created new window:", windowId);
    } else {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab) {
        throw new Error("No active tab found");
      }
      windowId = currentTab.windowId;
    }

    // 탭 생성 (그룹 생성 전에 먼저 탭을 생성)
    const createdTabs = [];
    const validTabs = sessionData.tabs.filter(tabInfo => {
      // 접근할 수 없는 URL 필터링
      if (tabInfo.url.startsWith('chrome://') ||
          tabInfo.url.startsWith('chrome-extension://') ||
          tabInfo.url.startsWith('edge://') ||
          tabInfo.url.startsWith('about:')) {
        console.log("Skipping restricted URL:", tabInfo.url);
        return false;
      }
      return true;
    });

    console.log(`Creating ${validTabs.length} tabs from ${sessionData.tabs.length} total tabs`);

    for (const tabInfo of validTabs) {
      try {
        const newTab = await chrome.tabs.create({
          windowId,
          url: tabInfo.url,
          pinned: tabInfo.pinned,
          active: false
        });

        createdTabs.push({
          tab: newTab,
          originalGroupId: tabInfo.groupId,
          originalIndex: tabInfo.index,
          wasActive: tabInfo.active
        });

        // 탭 생성 간격 조정
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error("Error creating tab:", tabInfo.url, error);
      }
    }

    console.log(`Successfully created ${createdTabs.length} tabs`);

    // 그룹 생성 및 탭 할당
    const groupIdMap = new Map();

    for (const groupInfo of sessionData.groups) {
      try {
        // 이 그룹에 속하는 탭들 찾기
        const tabsForGroup = createdTabs.filter(item => item.originalGroupId === groupInfo.id);

        if (tabsForGroup.length === 0) {
          console.log("No tabs for group:", groupInfo.title);
          continue;
        }

        const tabIds = tabsForGroup.map(item => item.tab.id);

        // 그룹 생성 시 탭 ID 배열을 함께 전달
        const newGroupId = await chrome.tabs.group({
          tabIds: tabIds,
          createProperties: { windowId }
        });

        // 그룹 속성 설정
        await chrome.tabGroups.update(newGroupId, {
          title: groupInfo.title,
          color: groupInfo.color,
          collapsed: groupInfo.collapsed
        });

        groupIdMap.set(groupInfo.id, newGroupId);
        console.log(`Created group: ${groupInfo.title} with ${tabIds.length} tabs`);

      } catch (error) {
        console.error("Error creating group:", groupInfo.title, error);
      }
    }

    // 활성 탭 설정
    const activeTabItem = createdTabs.find(item => item.wasActive);
    if (activeTabItem) {
      try {
        await chrome.tabs.update(activeTabItem.tab.id, { active: true });
        console.log("Set active tab:", activeTabItem.tab.id);
      } catch (error) {
        console.error("Error setting active tab:", error);
      }
    }

    // 새 창에서 생성된 경우, 기본 빈 탭 제거
    if (openInNewWindow) {
      try {
        const allTabs = await chrome.tabs.query({ windowId });
        const blankTabs = allTabs.filter(tab =>
          tab.url === 'chrome://newtab/' ||
          tab.url === 'about:blank' ||
          tab.url === ''
        );

        // 생성된 탭이 있고, 빈 탭이 있으면 제거
        if (createdTabs.length > 0 && blankTabs.length > 0) {
          for (const blankTab of blankTabs) {
            // 생성된 탭이 아닌 빈 탭만 제거
            if (!createdTabs.some(item => item.tab.id === blankTab.id)) {
              await chrome.tabs.remove(blankTab.id);
            }
          }
        }
      } catch (error) {
        console.error("Error removing blank tabs:", error);
      }
    }

    console.log("Session restored successfully");
    return { success: true, tabCount: createdTabs.length };

  } catch (error) {
    console.error("Error restoring session:", error);
    return { success: false, error: error.message };
  }
}

// 개별 그룹 복원 함수
async function restoreGroup(sessionId, groupId, openInNewWindow = true) {
  try {
    console.log("Restoring group:", groupId, "from session:", sessionId);

    // 세션 데이터 가져오기
    const [manualResult, autoResult, closedResult] = await Promise.all([
      chrome.storage.local.get(['savedSessions']),
      chrome.storage.local.get(['autoSavedSessions']),
      chrome.storage.local.get(['closedSessions'])
    ]);

    let sessionData = null;
    let sessionSource = null;

    // 모든 세션 타입에서 찾기 (더 자세한 검색)
    const savedSessions = manualResult.savedSessions || [];
    const autoSavedSessions = autoResult.autoSavedSessions || [];
    const closedSessions = closedResult.closedSessions || [];

    sessionData = savedSessions.find(session => session.id === sessionId);
    if (sessionData) sessionSource = 'manual';

    if (!sessionData) {
      sessionData = autoSavedSessions.find(session => session.id === sessionId);
      if (sessionData) sessionSource = 'auto';
    }

    if (!sessionData) {
      sessionData = closedSessions.find(session => session.id === sessionId);
      if (sessionData) sessionSource = 'closed';
    }

    if (!sessionData) {
      throw new Error("Session not found");
    }

    console.log(`Found session from ${sessionSource} storage:`, sessionData.name);
    console.log(`Session groups:`, sessionData.groups.map(g => `${g.id}: ${g.title}`));
    console.log(`Looking for group ID: ${groupId} (type: ${typeof groupId})`);

    // 그룹 ID 타입 안전 비교를 위한 함수
    const groupIdMatches = (group, targetId) => {
      return group.id === targetId ||
             group.id == targetId ||
             String(group.id) === String(targetId) ||
             Number(group.id) === Number(targetId);
    };

    // 해당 그룹 정보 찾기 (타입 안전 비교)
    const groupInfo = sessionData.groups.find(group => groupIdMatches(group, groupId));

    if (!groupInfo) {
      console.error(`Group ${groupId} not found in session. Available groups:`,
                    sessionData.groups.map(g => `${g.id}: ${g.title} (type: ${typeof g.id})`));

      // 그룹이 없는 경우 해당 그룹 ID를 가진 탭들을 찾아서 대체 그룹 생성 (타입 안전 비교)
      const groupTabs = sessionData.tabs.filter(tab =>
        tab.groupId === groupId ||
        tab.groupId == groupId ||
        String(tab.groupId) === String(groupId) ||
        Number(tab.groupId) === Number(groupId)
      );

      if (groupTabs.length === 0) {
        throw new Error(`No tabs found for group ${groupId}. The group may have been removed.`);
      }

      // 대체 그룹 정보 생성
      const fallbackGroupInfo = {
        id: groupId,
        title: `Restored Group (${groupTabs.length} tabs)`,
        color: 'blue',
        collapsed: false
      };

      console.log(`Creating fallback group info:`, fallbackGroupInfo);
      return await restoreGroupWithInfo(sessionId, fallbackGroupInfo, groupTabs, openInNewWindow);
    }

    console.log(`Found group: ${groupInfo.title} (ID: ${groupInfo.id})`);

    // 해당 그룹의 탭들 찾기 (타입 안전 비교)
    const groupTabs = sessionData.tabs.filter(tab => {
      return tab.groupId === groupId ||
             tab.groupId == groupId ||
             String(tab.groupId) === String(groupId) ||
             Number(tab.groupId) === Number(groupId);
    });

    console.log(`Filtering tabs for group ${groupId}:`);
    console.log(`Available tabs:`, sessionData.tabs.map(t => `${t.title} (groupId: ${t.groupId}, type: ${typeof t.groupId})`));
    console.log(`Matched tabs:`, groupTabs.map(t => `${t.title} (groupId: ${t.groupId})`));

    if (groupTabs.length === 0) {
      throw new Error(`No tabs found in group "${groupInfo.title}"`);
    }

    console.log(`Found ${groupTabs.length} tabs in group: ${groupInfo.title}`);

    return await restoreGroupWithInfo(sessionId, groupInfo, groupTabs, openInNewWindow);

  } catch (error) {
    console.error("Error restoring group:", error);
    return { success: false, error: error.message };
  }
}

// 그룹 정보와 탭 정보를 받아서 실제 복원을 수행하는 헬퍼 함수
async function restoreGroupWithInfo(sessionId, groupInfo, groupTabs, openInNewWindow = true) {
  try {
    console.log(`Starting group restore: ${groupInfo.title} with ${groupTabs.length} tabs`);

    // 새 창 생성 또는 현재 창 사용
    let windowId;
    if (openInNewWindow) {
      console.log("Creating new window for group restoration...");
      const newWindow = await chrome.windows.create({
        focused: true,
        state: "normal"
      });
      windowId = newWindow.id;
      console.log(`New window created with ID: ${windowId}`);

      // 생성 확인
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        await chrome.windows.get(windowId);
        console.log(`Window ${windowId} confirmed to exist`);
      } catch (e) {
        throw new Error(`Failed to create window: ${e.message}`);
      }
    } else {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab) {
        throw new Error("No active tab found");
      }
      windowId = currentTab.windowId;
      console.log(`Using current window ID: ${windowId}`);
    }

    // 탭 생성
    const createdTabs = [];
    const validTabs = groupTabs.filter(tabInfo => {
      // 접근할 수 없는 URL 필터링
      if (tabInfo.url.startsWith('chrome://') ||
          tabInfo.url.startsWith('chrome-extension://') ||
          tabInfo.url.startsWith('edge://') ||
          tabInfo.url.startsWith('about:')) {
        console.log("Skipping restricted URL:", tabInfo.url);
        return false;
      }
      return true;
    });

    console.log(`Creating ${validTabs.length} valid tabs out of ${groupTabs.length} total tabs`);

    for (const tabInfo of validTabs) {
      try {
        console.log(`Creating tab: ${tabInfo.title} (${tabInfo.url}) in window ${windowId}`);

        // Window가 여전히 존재하는지 확인
        try {
          await chrome.windows.get(windowId);
        } catch (e) {
          throw new Error(`Window ${windowId} no longer exists`);
        }

        const newTab = await chrome.tabs.create({
          windowId: windowId,
          url: tabInfo.url,
          pinned: tabInfo.pinned || false,
          active: false
        });

        createdTabs.push(newTab);
        console.log(`Tab created successfully: ${newTab.id}`);

        // 탭 생성 간격 조정
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`Error creating tab: ${tabInfo.url}`, error);
        console.error(`Error details:`, error.message);
      }
    }

    if (createdTabs.length === 0) {
      throw new Error("No tabs could be created");
    }

    console.log(`Successfully created ${createdTabs.length} tabs`);

    // 빈 탭 제거 (새 창인 경우에만)
    if (openInNewWindow) {
      try {
        const blankTabs = await chrome.tabs.query({
          windowId: windowId,
          url: ["chrome://newtab/", "about:blank", ""]
        });

        // 생성된 탭이 아닌 빈 탭만 제거
        const blankTabsToRemove = blankTabs.filter(tab =>
          !createdTabs.some(created => created.id === tab.id)
        );

        if (blankTabsToRemove.length > 0) {
          console.log(`Removing ${blankTabsToRemove.length} blank tabs`);
          await chrome.tabs.remove(blankTabsToRemove.map(tab => tab.id));
        }
      } catch (error) {
        console.error("Error removing blank tabs:", error);
      }
    }

    // 그룹 생성 및 탭 할당
    const tabIds = createdTabs.map(tab => tab.id);
    console.log(`Creating group with tab IDs:`, tabIds);

    const newGroupId = await chrome.tabs.group({
      tabIds: tabIds,
      createProperties: { windowId: windowId }
    });

    console.log(`Group created with ID: ${newGroupId}`);

    // 그룹 속성 설정
    await chrome.tabGroups.update(newGroupId, {
      title: groupInfo.title || 'Restored Group',
      color: groupInfo.color || 'blue',
      collapsed: groupInfo.collapsed || false
    });

    console.log(`Group properties set: ${groupInfo.title} (${groupInfo.color})`);

    // 첫 번째 탭 활성화
    if (createdTabs.length > 0) {
      await chrome.tabs.update(createdTabs[0].id, { active: true });
      console.log(`Activated first tab: ${createdTabs[0].id}`);
    }

    console.log(`=== Group restored successfully: ${groupInfo.title} (${createdTabs.length} tabs) ===`);
    return { success: true, tabCount: createdTabs.length, groupTitle: groupInfo.title };

  } catch (error) {
    console.error("Error in restoreGroupWithInfo:", error);
    return { success: false, error: error.message };
  }
}

// 세션 목록 가져오기
async function getSavedSessions() {
  try {
    const result = await chrome.storage.local.get(['savedSessions']);
    const savedSessions = result.savedSessions || [];

    // 최신순 정렬
    return savedSessions.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error("Error getting saved sessions:", error);
    return [];
  }
}

// 세션 삭제
async function deleteSession(sessionId) {
  try {
    const result = await chrome.storage.local.get(['savedSessions']);
    const savedSessions = result.savedSessions || [];

    const filteredSessions = savedSessions.filter(session => session.id !== sessionId);

    await chrome.storage.local.set({ savedSessions: filteredSessions });

    console.log("Session deleted:", sessionId);
    return { success: true };
  } catch (error) {
    console.error("Error deleting session:", error);
    return { success: false, error: error.message };
  }
}

// 세션 이름 변경
async function renameSession(sessionId, newName) {
  try {
    const result = await chrome.storage.local.get(['savedSessions']);
    const savedSessions = result.savedSessions || [];

    const sessionIndex = savedSessions.findIndex(session => session.id === sessionId);
    if (sessionIndex === -1) {
      throw new Error("Session not found");
    }

    savedSessions[sessionIndex].name = newName;

    await chrome.storage.local.set({ savedSessions });

    console.log("Session renamed:", sessionId, "->", newName);
    return { success: true };
  } catch (error) {
    console.error("Error renaming session:", error);
    return { success: false, error: error.message };
  }
}

// 메시지 리스너에 세션 관리 기능 추가
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleAutoSave") {
    autoSaveSettings.enabled = request.enabled;
    chrome.storage.sync.set({ autoSaveEnabled: request.enabled });

    if (request.enabled) {
      startAutoSave();
    } else {
      stopAutoSave();
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "toggleNewTabOverride") {
    chrome.storage.sync.set({ newTabOverride: request.enabled });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "openChromeNewTab") {
    // chrome://newtab/ 접근이 불가능하므로 Google 홈페이지로 이동
    chrome.tabs.update(sender.tab.id, { url: 'https://www.google.com' });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "updateAutoSaveSettings") {
    autoSaveSettings.trigger = request.trigger;

    if (request.trigger === "time") {
      autoSaveSettings.interval = request.interval;
      stopAutoSave();
      if (autoSaveSettings.enabled) {
        startTimeBasedAutoSave();
      }
    } else if (request.trigger === "change") {
      autoSaveSettings.detectTabClose = request.detectTabClose;
      autoSaveSettings.detectTabCreate = request.detectTabCreate;
      autoSaveSettings.detectUrlChange = request.detectUrlChange;
      stopAutoSave();
      // Change-based saving은 이벤트 리스너에서 자동으로 처리됨
    }

    sendResponse({ success: true });
    return true;
  }

  if (request.action === "saveSession") {
    saveCurrentSession(request.sessionName)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "restoreSession") {
    restoreSession(request.sessionId, request.openInNewWindow)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "restoreGroup") {
    const openInNewWindow = request.openInNewWindow !== false; // 기본값 true
    restoreGroup(request.sessionId, request.groupId, openInNewWindow)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "getSavedSessions") {
    getSavedSessions()
      .then(sessions => sendResponse({ success: true, sessions }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "deleteSession") {
    deleteSessionById(request.sessionId, request.type)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "clearAllSessions") {
    clearAllSessions(request.type)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "renameSession") {
    renameSession(request.sessionId, request.newName)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// 개별 세션 삭제 함수
async function deleteSessionById(sessionId, type) {
  try {
    const storageKey = type === 'closed' ? 'closedSessions' : 'autoSavedSessions';
    const result = await chrome.storage.local.get([storageKey]);
    let sessions = result[storageKey] || [];

    // 해당 세션 찾기
    const sessionIndex = sessions.findIndex(session => session.id === sessionId);

    if (sessionIndex === -1) {
      return { success: false, error: 'Session not found' };
    }

    // 세션 삭제
    sessions.splice(sessionIndex, 1);

    // 스토리지 업데이트
    await chrome.storage.local.set({ [storageKey]: sessions });

    console.log(`Deleted session: ${sessionId} from ${type} sessions`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting session:', error);
    return { success: false, error: error.message };
  }
}

// 모든 세션 삭제 함수
async function clearAllSessions(type) {
  try {
    const storageKey = type === 'closed' ? 'closedSessions' : 'autoSavedSessions';

    // 빈 배열로 설정
    await chrome.storage.local.set({ [storageKey]: [] });

    console.log(`Cleared all ${type} sessions`);
    return { success: true };
  } catch (error) {
    console.error('Error clearing sessions:', error);
    return { success: false, error: error.message };
  }
}

// ============== Extension Initialization ==============

// 확장 프로그램 시작 시 설정 로드
async function loadAutoSaveSettings() {
  try {
    const settings = await chrome.storage.sync.get([
      'autoSaveEnabled',
      'autoSaveTrigger',
      'autoSaveInterval',
      'detectTabClose',
      'detectTabCreate',
      'detectUrlChange'
    ]);

    autoSaveSettings.enabled = settings.autoSaveEnabled ?? true;
    autoSaveSettings.trigger = settings.autoSaveTrigger ?? "time";
    autoSaveSettings.interval = settings.autoSaveInterval ?? 60;
    autoSaveSettings.detectTabClose = settings.detectTabClose ?? true;
    autoSaveSettings.detectTabCreate = settings.detectTabCreate ?? true;
    autoSaveSettings.detectUrlChange = settings.detectUrlChange ?? true;

    console.log("Auto save settings loaded:", autoSaveSettings);

    // 설정에 따라 자동 저장 시작
    startAutoSave();
  } catch (error) {
    console.error("Error loading auto save settings:", error);
  }
}

// 확장 프로그램 설치/시작 시 설정 로드
chrome.runtime.onStartup.addListener(() => {
  loadAutoSaveSettings();
});

chrome.runtime.onInstalled.addListener(() => {
  loadAutoSaveSettings();
});

// 즉시 설정 로드 (서비스 워커 재시작 시)
loadAutoSaveSettings();
