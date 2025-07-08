const hostname = window.location.hostname;

let domBlockedCount = 0; // DOM에서 차단된 요소 수

chrome.storage.sync.get('whitelist', (data) => {
  const whitelist = data.whitelist || [];
  if (whitelist.includes(hostname)) {
    console.log('Sand Ad Clear: 이 사이트는 화이트리스트에 등록되어 광고 차단이 비활성화되었습니다.');
    return; // 화이트리스트 사이트에서는 아무 작업도 하지 않음
  }

  // 이하 광고 차단 로직 실행
  main();
});

function main() {
  // 광고 선택자 목록
  const adSelectors = [
    '[id*="-ad-"]:not(#thread-bottom)', '[id^="ad_"]:not(#thread-bottom)',
    '[id^="ads-"]:not(#thread-bottom)', '[class^="ads-"]',
    '[class*="-ad-"]',
    '[class*="sponsor"]', '[id*="sponsor"]',
    '.ad-container', '.ad-wrapper', '.ad-slot', '.ad-banner', '.ad-box',
    
  ];

  // DOM에서 광고 요소를 찾아 제거하는 함수
  function removeAdElements() {
    let currentBatchRemoved = 0;
    adSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        // 너무 큰 영역이 삭제되는 것을 방지하기 위한 간단한 보호 장치
        if (el.style.display !== 'none') { // 이미 숨겨진 요소는 다시 세지 않음
            el.style.display = 'none'; // 즉시 숨김
            currentBatchRemoved++;
          }
      });
    });
    if (currentBatchRemoved > 0) {
      domBlockedCount += currentBatchRemoved;
      // 백그라운드 스크립트로 DOM 차단 수 업데이트 메시지 전송
      chrome.runtime.sendMessage({ type: 'updateDomBlockedCount', count: domBlockedCount }, function() {
        if (chrome.runtime.lastError) {
          // console.warn("Error sending updateDomBlockedCount message:", chrome.runtime.lastError.message);
          // 컨텍스트가 무효화되었으므로, 이 메시지에 대해 더 이상 재시도하거나 작업을 수행할 필요가 없습니다.
        }
      });
    }
    return currentBatchRemoved > 0;
  }

  // 동적 콘텐츠 변경을 감지하는 MutationObserver
  const observer = new MutationObserver((mutations) => {
    let removedThisBatch = false;
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        if (removeAdElements()) {
          removedThisBatch = true;
        }
      }
    });
  });

  // 초기 광고 제거 실행
  window.addEventListener('load', () => {
    removeAdElements();
  });

  // Observer 시작
  observer.observe(document.body, { childList: true, subtree: true });

  // 팝업 메시지 리스너 (기존 기능 유지)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message === 'getAdCount') {
      sendResponse({ status: "Ad element remover is active." });
    }
  });
}