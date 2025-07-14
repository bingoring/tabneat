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
          const domains = [...new Set(tabs.map(tab => getDomainName(tab.url)))].sort();
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
