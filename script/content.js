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
    '[id^="ad-"]', // 추가: 'ad-'로 시작하는 ID
    '[class^="ad-"]', // 추가: 'ad-'로 시작하는 클래스
    '[class*="-ad-"]',
    '[class*="sponsor"]', '[id*="sponsor"]',
    '.ad-container', '.ad-wrapper', '.ad-slot', '.ad-banner', '.ad-box',
    '[data-ad_]', '[data-ad-]', '[data-ads-]', '[data-ads_]',
    '[class$="-ad"]', '[class$="_ad"]', '[class$="-ads"]', '[class$="_ads"]',
    '[id$="-ad"]', '[id$="_ad"]', '[id$="-ads"]', '[id$="_ads"]',
    'div.cmtext_ad', // 추가: 특정 클래스를 가진 div
    'div[data-ad-node]', // 추가: data-ad-node 속성을 가진 div
    'ins', // 추가: ins 태그
    'ins.kakao_ad_area', // 추가: kakao_ad_area 클래스를 가진 ins 태그
  ];

  // DOM에서 광고 요소를 찾아 제거하는 함수
  function removeAdElements() {
    let currentBatchRemoved = 0;
    const parentsToCheck = new Set(); // 부모 요소를 저장할 Set

    adSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if (el.parentNode) {
            parentsToCheck.add(el.parentNode); // 부모 요소 추적
            el.parentNode.removeChild(el); // 요소 제거
            currentBatchRemoved++;
          }
      });
    });

    // src 속성에 'ad.' 또는 'ads.'가 포함된 태그의 부모 삭제
    document.querySelectorAll('[src*="ad."], [src*="ads."]').forEach(el => {
      if (el.parentNode) {
        parentsToCheck.add(el.parentNode); // 부모 요소 추적
        el.parentNode.removeChild(el);
        currentBatchRemoved++;
      }
    });

    // 추적된 부모 요소들 중 비어있는 것을 삭제
    parentsToCheck.forEach(parent => {
        // 부모 요소가 DOM에 여전히 존재하고, 자식이 없으며, 텍스트 내용도 비어있는 경우
        if (document.body.contains(parent) && parent.children.length === 0 && parent.textContent.trim() === '') {
            if (parent.parentNode) {
                parent.parentNode.removeChild(parent);
                currentBatchRemoved++;
            }
        }
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