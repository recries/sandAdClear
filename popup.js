chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  chrome.tabs.sendMessage(tabs[0].id, 'getAdCount', function (response) {
    // if (chrome.runtime.lastError || !response) {
    //   document.getElementById('message').textContent = 'adCount를 불러올 수 없습니다.';
    //   return;
    // }
    // const count = response.adCount;
    // document.getElementById('message').textContent =
    //   `이 페이지에서 광고 ${count}개를 제거했습니다.`;
  });
});