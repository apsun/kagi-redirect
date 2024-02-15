if (typeof browser === "undefined") {
  globalThis.browser = chrome;
}

async function reload() {
  const storageKey = "session-link";
  const sessionLink = (await browser.storage.local.get(storageKey))[storageKey];
  const pattern = sessionLink ? sessionLink + "&q=\\2" : "https://kagi.com/search?q=\\2";
  const oldRules = await browser.declarativeNetRequest.getDynamicRules();
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRules.map(rule => rule.id),
    addRules: [{
      id: 1,
      condition: {
        regexFilter: "^https://www.google.com/search\\?(q=|.*&q=)([^&]+).*",
        resourceTypes: ["main_frame"],
      },
      action: {
        type: "redirect",
        redirect: {
          regexSubstitution: pattern,
        },
      },
    }],
  });
}

browser.runtime.onInstalled.addListener(reload);
browser.storage.local.onChanged.addListener(reload);
