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

function getRedirectRules() {
  // We redirect to a data: URL containing a script and append the query parameter as a fragment.
  // The script reads the fragment and uses it to build the destination URL.
  // This works around some horribly broken Safari behavior when handling DNR redirects.
  const baseUrl = "https://kagi.com/search?q=";
  const script = `window.location.replace('${baseUrl}' + window.location.hash.substring(1));`;
  const style = ":root { color-scheme: light dark; }";
  const substitution = `data:text/html,<style>${style}</style><script>${script}</script>#\\1`;

  // TODO: only match if the query comes from the address bar, so that we don't redirect
  // !bang searches in a loop
  const filters = [
    "^https://www.google.com/search" + getSearchQueryPattern("q"),
    "^https://duckduckgo.com/" + getSearchQueryPattern("q"),
  ];

  return filters.map((filter) => ({
    condition: {
      regexFilter: filter,
      resourceTypes: ["main_frame"],
    },
    action: {
      type: "redirect",
      redirect: {
        regexSubstitution: substitution,
      },
    },
  }));
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
