if (typeof browser === "undefined") {
  globalThis.browser = chrome;
}

function getSearchQueryPatterns(base, q, t) {
  // No way to distinguish searches from address bar vs. !bang, always redirect
  if (!t) {
    // google.com/search?q=foo
    return [new RegExp(`^${base}\\?(?:.*&)?${q}=([^&]+).*`)];
  }

  // Only redirect if the search was initiated via address bar to avoid !bang loops
  // WebKit blocks lookahead DNR rules, so we need one regex for each ordering
  // https://github.com/WebKit/WebKit/blob/0d834ddfd6bb278d8074b0757594dc6698614ad5/Source/WebKit/UIProcess/API/APIContentRuleList.cpp#L63-L75
  return [
    // google.com/search?q=foo&client=bar
    new RegExp(`^${base}\\?(?:.*&)?${q}=([^&]+).*&${t}=.*`),
    // google.com/search?client=bar&q=foo
    new RegExp(`^${base}\\?(?:.*&)?${t}=.*&${q}=([^&]+).*`),
  ];
}

const searchQueryPatterns = [
  getSearchQueryPatterns("https://www.google.com/search", "q", "client"),
  getSearchQueryPatterns("https://duckduckgo.com/", "q", "t"),
].flat();

const redirectBaseUrl = "https://kagi.com/search?q=";

function getRedirectRules() {
  // DNR redirect doesn't work by itself because WebKit is horribly broken and behaves as if the
  // destination is loaded in the context of the source page (meaning CSP, cookie domains, etc. are
  // applied based on the source page). Therefore, we combine it with onBeforeNavigate(), which
  // works but is asynchronous and so leaks the search request to the source page. The DNR redirect
  // serves to ensure that the original search request doesn't go through while we wait for
  // onBeforeNavigate() to kick in. Note that for some reason, blackholing the request to 0.0.0.0
  // in the DNR redirect doesn't work. For more info see:
  // https://github.com/kagisearch/browser_extensions/pull/59#issuecomment-1876520441
  return searchQueryPatterns.map((pattern) => ({
    condition: {
      regexFilter: pattern.source,
      resourceTypes: ["main_frame"],
    },
    action: {
      type: "redirect",
      redirect: {
        regexSubstitution: redirectBaseUrl + "\\1",
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

async function onBeforeNavigate(details) {
  for (const pattern of searchQueryPatterns) {
    const match = details.url.match(pattern);
    if (match) {
      const url = redirectBaseUrl + match[1];
      await browser.tabs.update(details.tabId, {url});
      break;
    }
  }
}

browser.runtime.onInstalled.addListener(reloadWebRequestRules);
browser.storage.local.onChanged.addListener(reloadWebRequestRules);
browser.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
