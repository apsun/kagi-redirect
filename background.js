if (typeof browser === "undefined") {
  globalThis.browser = chrome;
}

async function getSessionToken() {
  const key = "session-link";
  const link = (await browser.storage.local.get(key))[key];
  if (!link) {
    return null;
  }
  const pattern = /https:\/\/kagi.com\/search\?token=([A-Za-z0-9._-]+)/;
  const match = link.match(pattern);
  if (!match) {
    return null;
  }
  return match[1];
}

function getRedirectRules() {
  return [
    {
      condition: {
        urlFilter: "||google.com/search?",
        resourceTypes: ["main_frame"],
      },
      action: {
        type: "redirect",
        redirect: {
          transform: {
            host: "kagi.com",
          },
        },
      },
    },
    {
      condition: {
        urlFilter: "||duckduckgo.com/",
        resourceTypes: ["main_frame"],
      },
      action: {
        type: "redirect",
        redirect: {
          transform: {
            host: "kagi.com",
            path: "/search",
          },
        },
      },
    },
  ];
}

function getAuthRule(sessionToken) {
  if (!sessionToken) {
    return null;
  }

  return {
    condition: {
      requestDomains: ["kagi.com"],
      resourceTypes: ["main_frame"],
    },
    action: {
      type: "modifyHeaders",
      requestHeaders: [{
        header: "Authorization",
        operation: "set",
        value: sessionToken,
      }],
    },
  };
}

async function reload() {
  const sessionToken = await getSessionToken();
  const oldRules = await browser.declarativeNetRequest.getDynamicRules();
  const rules = getRedirectRules();
  if (sessionToken) {
    rules.push(getAuthRule(sessionToken));
  }
  rules.forEach((rule, index) => rule.id = index + 1);

  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRules.map(rule => rule.id),
    addRules: rules,
  });
}

browser.runtime.onInstalled.addListener(reload);
browser.storage.local.onChanged.addListener(reload);
