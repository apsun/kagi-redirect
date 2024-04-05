if (typeof browser === "undefined") {
  globalThis.browser = chrome;
}

function getSearchQueryPatterns(base, q, t) {
  // No way to distinguish searches from address bar vs. !bang, always redirect
  if (!t) {
    // google.com/search?q=foo
    return [`^${base}\\?(?:.*&)?${q}=([^&]+).*`];
  }

  // Only redirect if the search was initiated via address bar to avoid !bang loops
  // WebKit blocks lookahead DNR rules, so we need one regex for each ordering
  // https://github.com/WebKit/WebKit/blob/0d834ddfd6bb278d8074b0757594dc6698614ad5/Source/WebKit/UIProcess/API/APIContentRuleList.cpp#L63-L75
  return [
    // google.com/search?q=foo&client=bar
    `^${base}\\?(?:.*&)?${q}=([^&]+).*&${t}=.*`,
    // google.com/search?client=bar&q=foo
    `^${base}\\?(?:.*&)?${t}=.*&${q}=([^&]+).*`,
  ];
}

function getRedirectRules() {
  const patterns = [
    getSearchQueryPatterns("https://www.google.com/search", "q", "client"),
    getSearchQueryPatterns("https://duckduckgo.com/", "q", "t"),
  ].flat();

  return patterns.map((pattern) => ({
    condition: {
      regexFilter: pattern,
      resourceTypes: ["main_frame"],
    },
    action: {
      type: "redirect",
      redirect: {
        // Use www.kagi.com instead of kagi.com to work around Safari bug
        // See https://github.com/kagisearch/browser_extensions/pull/59#issuecomment-1876520441
        regexSubstitution: "https://www.kagi.com/search?q=\\1",
      },
    },
  }));
}

async function getSessionLink() {
  const storageKey = "session-link";
  const sessionLink = (await browser.storage.local.get(storageKey))[storageKey];
  return sessionLink;
}

function getSessionToken(sessionLink) {
  const pattern = /https:\/\/kagi.com\/search\?token=([A-Za-z0-9._-]+)/;
  const match = sessionLink.match(pattern);
  if (!match) {
    return null;
  }
  return match[1];
}

function getAuthRules(sessionLink) {
  if (!sessionLink) {
    return [];
  }

  return [{
    condition: {
      requestDomains: ["kagi.com"],
      resourceTypes: ["main_frame"],
    },
    action: {
      type: "modifyHeaders",
      requestHeaders: [{
        header: "Authorization",
        operation: "set",
        value: getSessionToken(sessionLink),
      }],
    },
  }];
}

async function reloadWebRequestRules() {
  const sessionLink = await getSessionLink();

  const oldRules = await browser.declarativeNetRequest.getDynamicRules();
  const rules = getRedirectRules().concat(getAuthRules(sessionLink));
  rules.forEach((rule, index) => rule.id = index + 1);

  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRules.map(rule => rule.id),
    addRules: rules,
  });
}

browser.runtime.onInstalled.addListener(reloadWebRequestRules);
browser.storage.local.onChanged.addListener(reloadWebRequestRules);
