document.addEventListener("DOMContentLoaded", async function () {
  const toggle = document.getElementById("groupTabsToggle");

  // 저장된 값 불러오기
  chrome.storage.sync.get("groupTabs", (data) => {
      toggle.checked = data.groupTabs ?? false; // 기본값: false
  });

  // 토글 변경 시 값 저장
  toggle.addEventListener("change", () => {
      chrome.storage.sync.set({ groupTabs: toggle.checked });
  });
});
