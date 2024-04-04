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

async function reload() {
  const sessionLink = await getSessionLink();
  console.log(sessionLink);

  const oldRules = await browser.declarativeNetRequest.getDynamicRules();
  const rules = getRedirectRules(sessionLink).concat(getAuthRules(sessionLink));
  rules.forEach((rule, index) => rule.id = index + 1);
  console.log(rules);

  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRules.map(rule => rule.id),
    addRules: rules,
  });
}

browser.runtime.onInstalled.addListener(reload);
browser.storage.local.onChanged.addListener(reload);
