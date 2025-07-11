document.addEventListener("DOMContentLoaded", async () => {
  const groupTabsToggle = document.getElementById("groupTabsToggle");
  const collapseGroupsToggle = document.getElementById("collapseGroupsToggle");

  // 저장된 설정 불러오기
  chrome.storage.sync.get(["groupTabs", "collapseGroups"], (data) => {
      groupTabsToggle.checked = data.groupTabs ?? true;
      collapseGroupsToggle.checked = data.collapseGroups ?? false;
  });

  // 변경 시 저장
  groupTabsToggle.addEventListener("change", () => {
      chrome.storage.sync.set({ groupTabs: groupTabsToggle.checked });
  });

  collapseGroupsToggle.addEventListener("change", () => {
      chrome.storage.sync.set({ collapseGroups: collapseGroupsToggle.checked });
  });
});
