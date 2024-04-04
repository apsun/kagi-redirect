if (typeof browser === "undefined") {
  globalThis.browser = chrome;
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

function getSearchQueryPattern(key) {
  return "\\?(?:.*&)?" + key + "=([^&]+)"
}

function getRedirectRules(sessionLink) {
  // Disabled because Safari is broken beyond repair when it comes to
  // handling DNR redirects. We use the webNavigation + tabs API instead.
  return [];

  const substitution = sessionLink ? sessionLink + "&q=\\1" : "https://kagi.com/search?q=\\1";
  return [
    {
      condition: {
        regexFilter: "^https://www.google.com/search" + getSearchQueryPattern("q"),
        resourceTypes: ["main_frame"],
      },
      action: {
        type: "redirect",
        redirect: {
          regexSubstitution: substitution,
        },
      },
    },
    {
      condition: {
        regexFilter: "^https://duckduckgo.com/" + getSearchQueryPattern("q"),
        resourceTypes: ["main_frame"],
      },
      action: {
        type: "redirect",
        redirect: {
          regexSubstitution: substitution,
        },
      },
    },
  ];
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

function getSearchQuery(urlString) {
  const url = new URL(urlString)
  if (url.host == "www.google.com" && url.pathname == "/search") {
    return url.searchParams.get("q");
  } else if (url.host == "duckduckgo.com" && url.pathname == "/") {
    return url.searchParams.get("q");
  } else {
    return null;
  }
}

async function onBeforeNavigate(details) {
  const q = getSearchQuery(details.url);
  if (q) {
    const url = new URL("https://kagi.com/search");
    url.searchParams.set("q", q);
    await browser.tabs.update(details.tabId, {
      url: url.toString(),
    });
  }
}

async function reloadWebRequestRules() {
  const sessionLink = await getSessionLink();

  const oldRules = await browser.declarativeNetRequest.getDynamicRules();
  const rules = getRedirectRules(sessionLink).concat(getAuthRules(sessionLink));
  rules.forEach((rule, index) => rule.id = index + 1);

  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRules.map(rule => rule.id),
    addRules: rules,
  });
}

browser.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
browser.runtime.onInstalled.addListener(reloadWebRequestRules);
browser.storage.local.onChanged.addListener(reloadWebRequestRules);
