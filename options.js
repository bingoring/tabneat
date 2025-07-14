document.addEventListener("DOMContentLoaded", async () => {
  const groupTabsToggle = document.getElementById("groupTabsToggle");
  const collapseGroupsToggle = document.getElementById("collapseGroupsToggle");
  const sortOptions = document.querySelectorAll('input[name="sortOrder"]');
  const customOrderSection = document.getElementById("customOrderSection");
  const domainList = document.getElementById("domainList");
  const resetCustomOrderBtn = document.getElementById("resetCustomOrder");

  // 저장된 설정 불러오기
  chrome.storage.sync.get(["groupTabs", "collapseGroups", "sortOrder", "customDomainOrder"], (data) => {
      groupTabsToggle.checked = data.groupTabs ?? true;
      collapseGroupsToggle.checked = data.collapseGroups ?? false;

      // 정렬 옵션 설정 (기본값: alphabetical)
      const sortOrder = data.sortOrder ?? "alphabetical";
      const sortRadio = document.getElementById(`sort${sortOrder.charAt(0).toUpperCase() + sortOrder.slice(1)}`);
      if (sortRadio) {
          sortRadio.checked = true;
      }

      // 사용자 지정 순서 섹션 표시/숨김
      toggleCustomOrderSection(sortOrder === "custom");

      // 사용자 지정 도메인 순서 로드
      if (sortOrder === "custom") {
          loadCustomDomainOrder(data.customDomainOrder || []);
      }
  });

  // 기본 토글 변경 시 저장
  groupTabsToggle.addEventListener("change", () => {
      chrome.storage.sync.set({ groupTabs: groupTabsToggle.checked });
  });

  collapseGroupsToggle.addEventListener("change", () => {
      chrome.storage.sync.set({ collapseGroups: collapseGroupsToggle.checked });
  });

  // 정렬 옵션 변경 시 저장
  sortOptions.forEach(option => {
      option.addEventListener("change", (e) => {
          if (e.target.checked) {
              const sortOrder = e.target.value;
              chrome.storage.sync.set({ sortOrder });
              toggleCustomOrderSection(sortOrder === "custom");

              if (sortOrder === "custom") {
                  loadCurrentDomains();
              }
          }
      });
  });

  // 사용자 지정 순서 리셋 버튼
  resetCustomOrderBtn.addEventListener("click", () => {
      chrome.storage.sync.set({ customDomainOrder: [] });
      loadCurrentDomains();
  });

  // 사용자 지정 순서 섹션 표시/숨김
  function toggleCustomOrderSection(show) {
      customOrderSection.style.display = show ? "block" : "none";
  }

  // 현재 열린 탭들의 도메인 목록 가져오기
  async function loadCurrentDomains() {
      try {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          const domains = [...new Set(tabs.map(tab => getCleanDomainName(tab.url)))].sort();
          loadCustomDomainOrder(domains);
      } catch (error) {
          console.error("Error loading current domains:", error);
      }
  }

  // 도메인 이름 추출 함수 (background.js와 동일)
  function getDomainName(url) {
      try {
          let hostname = new URL(url).hostname;
          hostname = hostname.replace(/^www\./, '');

          const domainParts = hostname.split('.');

          if (domainParts.length <= 2) {
              return hostname;
          }

          if (domainParts.length >= 3 && domainParts[domainParts.length - 2].length <= 3) {
              return domainParts.slice(-3).join('.');
          }

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

  // 사용자 지정 도메인 순서 로드 및 렌더링
  function loadCustomDomainOrder(domains) {
      domainList.innerHTML = "";

      domains.forEach((domain, index) => {
          const domainItem = document.createElement("div");
          domainItem.className = "domain-item";
          domainItem.draggable = true;
          domainItem.dataset.domain = domain;

          domainItem.innerHTML = `
              <span class="domain-name">${domain}</span>
              <span class="drag-handle">⋮⋮</span>
          `;

          // 드래그 앤 드롭 이벤트
          domainItem.addEventListener("dragstart", handleDragStart);
          domainItem.addEventListener("dragover", handleDragOver);
          domainItem.addEventListener("drop", handleDrop);
          domainItem.addEventListener("dragend", handleDragEnd);

          domainList.appendChild(domainItem);
      });
  }

  // 드래그 앤 드롭 핸들러들
  let draggedElement = null;

  function handleDragStart(e) {
      draggedElement = e.target;
      e.target.style.opacity = "0.5";
  }

  function handleDragOver(e) {
      e.preventDefault();
  }

  function handleDrop(e) {
      e.preventDefault();
      if (draggedElement !== e.target && e.target.classList.contains("domain-item")) {
          const allItems = [...domainList.children];
          const draggedIndex = allItems.indexOf(draggedElement);
          const targetIndex = allItems.indexOf(e.target);

          if (draggedIndex < targetIndex) {
              domainList.insertBefore(draggedElement, e.target.nextSibling);
          } else {
              domainList.insertBefore(draggedElement, e.target);
          }

          // 새로운 순서 저장
          saveCustomDomainOrder();
      }
  }

  function handleDragEnd(e) {
      e.target.style.opacity = "1";
      draggedElement = null;
  }

  // 사용자 지정 도메인 순서 저장
  function saveCustomDomainOrder() {
      const domains = [...domainList.children].map(item => item.dataset.domain);
      chrome.storage.sync.set({ customDomainOrder: domains });
  }
});
