var adCount = 0;
var adRemoveTimeout = null;
var alertShown = false;

// 1. 초기 광고 제거 및 카운트 집계
$(window).on('load', function() {
  adCount += $('ins').length;
  $('ins').remove();

  adCount += $('.commercial-unit-desktop-rhs').length;
  $('.commercial-unit-desktop-rhs').remove();

  adCount += $('[id^="ad"]').length;
  $('[id^="ad"]').each(function() {
    const $parent = $(this).parent('a');
    if ($parent.length) {
      $parent.remove();
    }
  });
  $('[id^="ad"]').remove(); 
  
  $('[class^="ad"]').each(function() {
  const $parent = $(this).parent('a');
  if ($parent.length) {
    $parent.remove();
  }
});

  $('[class^="ad"]').remove(); 

  // 동적 광고 제거 후 알림 출력을 위해 타이머 초기화
  //resetAdRemoveTimer();
});

// 2. 동적 광고 제거 감지용 MutationObserver
const observer = new MutationObserver(mutations => {
  let removedThisBatch = false;

  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;

      // iframe 직접 추가된 경우
      if (node.tagName === 'IFRAME') {
        if (handleIframe($(node))) removedThisBatch = true;
      }

      // 하위 iframe 포함 여부 확인
      $(node).find('iframe').each(function () {
        if (handleIframe($(this))) removedThisBatch = true;
      });
    });
  });

  if (removedThisBatch) {
    //resetAdRemoveTimer();
  }
});

function resetAdRemoveTimer() {
  if (adRemoveTimeout) clearTimeout(adRemoveTimeout);
  adRemoveTimeout = setTimeout(() => {
    if (!alertShown && adCount > 0) {
      showCustomAlert(`광고 ${adCount}개를 삭제했습니다.`);
      alertShown = true;
    }
  }, 2000); // 3초 동안 추가 광고가 없으면 알림
}

function handleIframe($iframe) {
  const src = $iframe.attr('src') || '';
  const classOrId = ($iframe.attr('class') || '') + ' ' + ($iframe.attr('id') || '') + ' ' + ($iframe.attr('title') || '');

  const isAd = /ads|doubleclick|googlesyndication|shopping|adservice|taboola/i.test(src) ||
               /ad|banner|sponsored/i.test(classOrId);

  if (isAd) {
    const $parent = $iframe.parent();
    if ($parent.is('div')) {
      $parent.remove();
    } else {
      $iframe.remove();
    }
    adCount++;
    return true;
  }
  return false;
}

observer.observe(document.body, { childList: true, subtree: true });

// 알림 함수는 기존 코드 그대로 사용
function showCustomAlert(messages, interval = 1000, stayTime = 4000) {
  $('.custom-alert').remove();

  const $alert = $('<div></div>', {
    class: 'custom-alert',
    css: {
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: '#f9ccd9',
      color: '#333',
      'border-radius': '10px',
      padding: '12px 18px',
      'font-size': '14px',
      'z-index': 9999,
      'box-shadow': '0 4px 10px rgba(0,0,0,0.2)',
      'max-width': '220px',
      'word-break': 'break-word',
      opacity: 0
    }
  }).appendTo('body');

  $alert.animate({ opacity: 1, right: '30px' }, 500);
  $alert.text(messages);
  $alert.delay(stayTime);
  $alert.animate({ opacity: 0, right: '0px' }, 500, function () {
    $(this).remove();
  });
}

// 팝업에서 메시지 받았을 때 응답
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message === 'getAdCount') {
    if (adCount > 0) {
      showCustomAlert(`이 페이지에서 광고 ${adCount}개를 제거했습니다.`);
    } else {
      showCustomAlert('광고가 제거되지 않았습니다.');
    }
    sendResponse({ adCount });  // 선택적으로 응답
  }
});