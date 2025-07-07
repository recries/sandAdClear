// 백그라운드 스크립트 (Service Worker)

// 설치 시 기본 규칙 설정
chrome.runtime.onInstalled.addListener(() => {
  updateDynamicRules();
});

// 활성 탭 변경 시 (URL 변경 시)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateDynamicRules();
  }
});

// 탭 활성화 시 (탭 전환 시)
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      updateDynamicRules();
    }
  });
});

async function updateDynamicRules() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    console.log("No active tab or URL found.");
    return;
  }

  const url = new URL(tab.url);
  const hostname = url.hostname;

  chrome.storage.sync.get('whitelist', async (data) => {
    const whitelist = data.whitelist || [];
    const isWhitelisted = whitelist.includes(hostname);

    // 기존 동적 규칙 제거
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIdsToRemove = existingRules.map(rule => rule.id);
    if (ruleIdsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIdsToRemove
      });
      console.log(`Removed ${ruleIdsToRemove.length} existing dynamic rules.`);
    }

    if (isWhitelisted) {
      console.log(`Hostname ${hostname} is whitelisted. No blocking rules applied.`);
      // 화이트리스트에 있으면 아무 규칙도 추가하지 않음 (차단 비활성화)
    } else {
      // rules.json에서 규칙 로드
      const response = await fetch(chrome.runtime.getURL('rules.json'));
      const rules = await response.json();

      // 새 동적 규칙 추가
      const dynamicRules = rules.map(rule => ({
        ...rule,
        id: rule.id + 1000 // 기존 규칙 ID와 겹치지 않도록 조정
      }));
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: dynamicRules
      });
      console.log(`Added ${dynamicRules.length} dynamic rules for ${hostname}.`);
    }
  });
}

let domBlockedCountsPerTab = {}; // 탭별 DOM 차단된 요소 수를 저장할 인메모리 객체

// 배지 텍스트를 업데이트하는 헬퍼 함수
async function updateBadgeText(tabId) {
  let networkBlockedCount = 0;
  try {
    const matchedRules = await chrome.declarativeNetRequest.getMatchedRules({ tabId });
    networkBlockedCount = matchedRules.rulesMatchedInfo.length;
  } catch (e) {
    //console.error("Error getting matched rules for badge:", e);
  }

  const domBlockedCount = domBlockedCountsPerTab[tabId] || 0;
  const totalBlockedCount = networkBlockedCount + domBlockedCount;
  //console.log(`[back.js] updateBadgeText: tabId=${tabId}, networkBlockedCount=${networkBlockedCount}, domBlockedCount=${domBlockedCount}, totalBlockedCount=${totalBlockedCount}`);

  if (totalBlockedCount > 0) {
    await chrome.action.setBadgeText({ tabId: tabId, text: totalBlockedCount.toString() });
    await chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#f9ccd9' });
  } else {
    await chrome.action.setBadgeText({ tabId: tabId, text: '' });
  }

  // 팝업이 열려있다면 업데이트된 카운트를 팝업으로 전송
  chrome.runtime.sendMessage({
    type: 'updatePopupCount',
    count: totalBlockedCount
  }).catch(e => {
    // 팝업이 닫혀있거나 컨텍스트가 무효화된 경우 발생하는 오류는 무시
    // console.warn("Error sending updatePopupCount message to popup:", e);
  });
}

// 페이지 이동 시작 시 해당 탭의 이전 차단 내역 초기화
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0) { // 메인 프레임만 처리
    domBlockedCountsPerTab[details.tabId] = 0;
    chrome.action.setBadgeText({ tabId: details.tabId, text: '' }); // 배지 초기화
  }
});

// 페이지 로딩 완료 시 호출
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return; // 메인 프레임만 처리

  const tabId = details.tabId;
  const url = new URL(details.url);
  const hostname = url.hostname;

  chrome.storage.sync.get('whitelist', async (data) => {
    const whitelist = data.whitelist || [];
    const isWhitelisted = whitelist.includes(hostname);

    if (isWhitelisted) {
      // 화이트리스트 사이트: 배지 끄고, 규칙 비활성화
      await chrome.action.setBadgeText({ tabId: tabId, text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#808080' }); // 회색
    } else {
      // 일반 사이트: 규칙 활성화 및 배지 업데이트
      updateBadgeText(tabId); 
    }
  });
});

// 탭이 닫힐 때 해당 탭의 데이터 정리
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.action.setBadgeText({ tabId: tabId, text: '' });
  delete domBlockedCountsPerTab[tabId];
});

// 팝업에서 차단된 요청 데이터를 요청할 때 응답
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'getBlockedRequests') {
    let currentTabId;
    if (sender.tab) {
      currentTabId = sender.tab.id;
    } else {
      // 팝업에서 메시지를 보낸 경우 sender.tab이 없을 수 있으므로, 현재 활성화된 탭을 찾습니다.
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        currentTabId = tabs[0].id;
      } else {
        console.warn("Could not determine active tab for getBlockedRequests.");
        sendResponse({ totalBlockedCount: 0 });
        return;
      }
    }
    const tabId = currentTabId;
    
    // 현재 탭의 네트워크 차단 수와 DOM 차단 수를 합산하여 반환
    (async () => {
        let networkBlockedCount = 0;
        try {
            const matchedRules = await chrome.declarativeNetRequest.getMatchedRules({ tabId });
            networkBlockedCount = matchedRules.rulesMatchedInfo.length;
        } catch (e) {
           // console.error("Error getting matched rules for popup:", e);
        }
        const domBlockedCount = domBlockedCountsPerTab[tabId] || 0;
        const totalBlockedCount = networkBlockedCount + domBlockedCount;
        sendResponse({ totalBlockedCount });
    })();
    return true; // 비동기 응답을 위해 true 반환
  } else if (message.type === 'updateDomBlockedCount') {
    const tabId = sender.tab.id;
    if (tabId === -1) return; // 탭과 관련 없는 요청은 무시
    domBlockedCountsPerTab[tabId] = message.count;
    updateBadgeText(tabId);
  } else if (message.type === 'updateRules') {
    updateDynamicRules();
  }
});