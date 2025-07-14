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
