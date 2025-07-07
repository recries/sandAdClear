document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;

  const url = new URL(tab.url);
  const hostname = url.hostname;

  const toggle = document.getElementById('whitelist-toggle');
  const toggleLabel = document.getElementById('whitelist-toggle-label');

  // 백그라운드 스크립트로부터 업데이트 메시지를 수신 (더 이상 사용되지 않음)
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'updatePopupCount') {
      // console.log(`[popup.js] Received updatePopupCount: ${message.count}`);
      // adCountElement.textContent = message.count.toString(); // 제거됨
    }
  });

  // 1. 스토리지에서 화이트리스트 정보 가져오기
  chrome.storage.sync.get('whitelist', (data) => {
    const whitelist = data.whitelist || [];
    const isWhitelisted = whitelist.includes(hostname);

    // 2. UI 상태 설정
    toggle.checked = !isWhitelisted; // 활성화 상태이므로, 화이트리스트에 없으면 checked
    toggleLabel.textContent = isWhitelisted ? "이 사이트에서 차단 비활성화됨" : "이 사이트에서 차단 활성화됨";
    
    if (isWhitelisted) {
        // adCountElement.textContent = "OFF"; // 제거됨
    } else {
        // 백그라운드 스크립트에서 총 차단된 광고 수 가져오기 (더 이상 사용되지 않음)
        // chrome.runtime.sendMessage({ type: 'getBlockedRequests' }, (response) => {
        //     adCountElement.textContent = response.totalBlockedCount.toString(); // 제거됨
        // });
    }
  });

  // 4. 토글 스위치에 이벤트 리스너 추가
  toggle.addEventListener('change', () => {
    chrome.storage.sync.get('whitelist', (data) => {
      let whitelist = data.whitelist || [];
      const isWhitelisted = whitelist.includes(hostname);

      if (isWhitelisted) {
        // 화이트리스트에서 제거 (차단 활성화)
        whitelist = whitelist.filter(site => site !== hostname);
      } else {
        // 화이트리스트에 추가 (차단 비활성화)
        whitelist.push(hostname);
      }

      chrome.storage.sync.set({ whitelist }, () => {
        // 변경사항 적용을 위해 탭 새로고침
        chrome.tabs.reload(tab.id);
        chrome.runtime.sendMessage({ type: 'updateRules' });
        window.close(); // 팝업 닫기
      });
    });
  });
});