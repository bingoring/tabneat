// ============== Tab Sorting and Grouping Functions ==============

async function getOptions() {
  let data = await chrome.storage.sync.get("groupTabs");
  return data.groupTabs ?? true;
}

async function getSortOrder() {
  const data = await chrome.storage.sync.get(['sortOrder', 'customDomainOrder']);
  return {
    sortOrder: data.sortOrder ?? 'alphabetical',
    customDomainOrder: data.customDomainOrder ?? []
  };
}

function getDomainName(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return 'other';
  }
}

function getCleanDomainName(url) {
  const domain = getDomainName(url);
  const parts = domain.split('.');

  if (parts.length < 2) {
    return domain;
  }

  // 특별한 경우들 처리
  const specialDomains = {
    'chrome-extension': 'chrome',
    'moz-extension': 'firefox',
    'edge-extension': 'edge'
  };

  if (specialDomains[parts[0]]) {
    return specialDomains[parts[0]];
  }

  // 한국 및 기타 복합 TLD 처리
  const complexTlds = ['co.kr', 'or.kr', 'ne.kr', 'go.kr', 'ac.kr', 'co.uk', 'org.uk', 'ac.uk', 'com.au', 'org.au'];

  if (parts.length >= 3) {
    const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (complexTlds.includes(lastTwo)) {
      // wanted.co.kr → wanted
      return parts[parts.length - 3];
    }
  }

  // 일반적인 경우: 마지막에서 두 번째 부분 반환 (주 도메인명)
  // google.com → google, naver.com → naver
  return parts[parts.length - 2];
}

function sortDomains(domainMap, sortOrder, customOrder = []) {
  const domains = Array.from(domainMap.keys());

  switch (sortOrder) {
    case 'alphabetical':
      return domains.sort();

    case 'tabCount':
      return domains.sort((a, b) => domainMap.get(b).length - domainMap.get(a).length);

    case 'recent':
      return domains.sort((a, b) => {
        const aTabs = domainMap.get(a);
        const bTabs = domainMap.get(b);

        // 각 도메인에서 가장 최근에 접속한 탭의 시간 찾기
        const aLatest = Math.max(...aTabs.map(tab => tab.lastAccessed || 0));
        const bLatest = Math.max(...bTabs.map(tab => tab.lastAccessed || 0));

        // 최근 접속 시간이 늦은 것부터 정렬 (내림차순)
        return bLatest - aLatest;
      });

    case 'custom':
      const customSet = new Set(customOrder);
      const customDomains = customOrder.filter(domain => domains.includes(domain));
      const otherDomains = domains.filter(domain => !customSet.has(domain)).sort();
      return [...customDomains, ...otherDomains];

    default:
      return domains.sort();
  }
}

function getDefaultColorForDomain(domain) {
  const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

  // 도메인별 고정 색상 매핑
  const domainColors = {
    'google.com': 'blue',
    'youtube.com': 'red',
    'facebook.com': 'blue',
    'instagram.com': 'pink',
    'twitter.com': 'blue',
    'x.com': 'grey',
    'linkedin.com': 'blue',
    'github.com': 'grey',
    'stackoverflow.com': 'orange',
    'reddit.com': 'orange',
    'discord.com': 'purple',
    'slack.com': 'purple',
    'notion.so': 'grey',
    'figma.com': 'purple',
    'dribbble.com': 'pink',
    'behance.net': 'blue',
    'medium.com': 'green',
    'dev.to': 'grey',
    'codepen.io': 'grey',
    'jsfiddle.net': 'blue',
    'codesandbox.io': 'yellow',
    'replit.com': 'orange',
    'netlify.app': 'cyan',
    'vercel.app': 'grey',
    'heroku.com': 'purple',
    'aws.amazon.com': 'orange',
    'cloud.google.com': 'blue',
    'azure.microsoft.com': 'blue',
    'dropbox.com': 'blue',
    'drive.google.com': 'blue',
    'onedrive.live.com': 'blue',
    'icloud.com': 'grey',
    'naver.com': 'green',
    'daum.net': 'blue',
    'kakao.com': 'yellow',
    'tistory.com': 'orange',
    'blog.naver.com': 'green',
    'velog.io': 'green',
    'netflix.com': 'red',
    'disney.com': 'blue',
    'amazon.com': 'orange',
    'ebay.com': 'blue',
    'coupang.com': 'red',
    'yes24.com': 'blue',
    'wikipedia.org': 'grey'
  };

  if (domainColors[domain]) {
    return domainColors[domain];
  }

  // 도메인 문자열을 기반으로 일관된 색상 선택
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    const char = domain.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return colors[Math.abs(hash) % colors.length];
}

async function getExistingGroupId(domain) {
  try {
    const groups = await chrome.tabGroups.query({ title: domain });
    return groups.length > 0 ? groups[0].id : null;
  } catch (error) {
    console.error("Error getting existing group:", error);
    return null;
  }
}


// 탭 정렬 함수 (재사용 가능하도록 분리)
async function performTabSorting() {
  try {
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

    // 모든 탭 정렬 실행
    for (const domain of sortedDomains) {
      const tabArray = domainMap.get(domain);
      await Promise.all(tabArray.map(tab =>
        chrome.tabs.move(tab.id, { index: index++ })
      ));
    }

    // 그룹화 실행 (옵션이 활성화된 경우)
    if (groupTabs) {
      console.log('Starting intelligent grouping process...');

      // 1. 현재 모든 그룹 정보 수집
      const currentGroups = await chrome.tabGroups.query({ windowId: tabs[0].windowId });
      const domainGroups = new Map(); // domain -> groupId

      for (const group of currentGroups) {
        if (group.title && sortedDomains.includes(group.title)) {
          domainGroups.set(group.title, group.id);
        }
      }

      console.log('Existing domain groups:', Array.from(domainGroups.entries()));

      // 2. 각 도메인별로 스마트 그룹화 처리
      for (const domain of sortedDomains) {
        const tabArray = domainMap.get(domain);

        if (tabArray.length < 2) {
          continue;
        }

        try {
          console.log(`Processing domain: ${domain} with ${tabArray.length} tabs`);

          const existingGroupId = domainGroups.get(domain);
          const tabIds = tabArray.map(tab => tab.id);

          if (existingGroupId) {
            // 기존 그룹이 있는 경우: 해당 그룹에 속하지 않은 탭들만 추가
            const tabsNotInGroup = tabArray.filter(tab => tab.groupId !== existingGroupId);

            if (tabsNotInGroup.length > 0) {
              console.log(`Adding ${tabsNotInGroup.length} tabs to existing group: ${domain}`);
              const tabsToAdd = tabsNotInGroup.map(tab => tab.id);

              // 다른 그룹에 속한 탭들은 먼저 해제
              const tabsToUngroup = tabsNotInGroup.filter(tab => tab.groupId !== -1);
              if (tabsToUngroup.length > 0) {
                await chrome.tabs.ungroup(tabsToUngroup.map(tab => tab.id));
                await new Promise(resolve => setTimeout(resolve, 50));
              }

              await chrome.tabs.group({
                tabIds: tabsToAdd,
                groupId: existingGroupId
              });
            } else {
              console.log(`All tabs already in correct group for domain: ${domain}`);
            }
          } else {
            // 기존 그룹이 없는 경우: 새 그룹 생성
            console.log(`Creating new group for domain: ${domain}`);

            // 다른 그룹에 속한 탭들은 먼저 해제
            const tabsToUngroup = tabArray.filter(tab => tab.groupId !== -1);
            if (tabsToUngroup.length > 0) {
              await chrome.tabs.ungroup(tabsToUngroup.map(tab => tab.id));
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            const groupId = await chrome.tabs.group({ tabIds });

            if (groupId) {
              // 그룹 기본 정보 설정
              const color = getDefaultColorForDomain(domain);
              await chrome.tabGroups.update(groupId, {
                title: domain,
                color: color,
                collapsed: collapseGroups
              });

              // 새로 생성된 그룹 추가
              domainGroups.set(domain, groupId);
              console.log(`Created group for ${domain} with color: ${color}`);
            }
          }

          // 처리 간격 조정
          await new Promise(resolve => setTimeout(resolve, 50));

        } catch (error) {
          console.error(`Failed to group tabs for ${domain}:`, error);
        }
      }

      console.log('Intelligent grouping process completed');
    }

    console.log("Tab sorting and grouping completed successfully");
    return { success: true };
  } catch (error) {
    console.error("Error in tab sorting and grouping:", error);
    return { success: false, error: error.message };
  }
}

// 메인 탭 정렬 및 그룹화 기능 (확장프로그램 아이콘 클릭 시)
chrome.action.onClicked.addListener(async () => {
  await performTabSorting();
});

// 메시지 리스너 (설정 관련 및 탭 정렬 트리거)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "triggerTabSorting") {
    // 팝업에서 탭 정렬 트리거
    performTabSorting()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "updateGroupSettings") {
    // 그룹화 설정 업데이트 처리
    chrome.storage.sync.set({
      groupTabs: request.groupTabs,
      collapseGroups: request.collapseGroups
    });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "updateSortSettings") {
    // 정렬 설정 업데이트 처리
    chrome.storage.sync.set({
      sortOrder: request.sortOrder,
      customDomainOrder: request.customDomainOrder
    });
    sendResponse({ success: true });
    return true;
  }

  // 기타 요청은 처리하지 않음
  sendResponse({ success: false, error: "Unknown action" });
  return false;
});
