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

const searchQueryPatterns = [
  getSearchQueryPatterns("https://www.google.com/search", "q", "client"),
  getSearchQueryPatterns("https://duckduckgo.com/", "q", "t"),
].flat();

const redirectBaseUrl = "https://kagi.com/search?q=";

function getRedirectRules() {
  // We redirect to a data: URL containing a script and append the query parameter as a fragment.
  // The script reads the fragment and uses it to build the destination URL.
  // This works around some horribly broken Safari behavior when handling DNR redirects.
  //
  // Known issue: we can't redirect from sites which have a CSP blocking data: scripts, since
  // Safari executes the script in the context of the current page (???) - if that happens the
  // webNavigation onBeforeNavigate() handler will act as a fallback. We still want the DNR
  // redirect though, since it's blocking (webNavigation is asynchronous).
  const script = `window.location.replace('${redirectBaseUrl}' + window.location.hash.substring(1));`;
  const style = ":root { color-scheme: light dark; }";
  const substitution = `data:text/html,<style>${style}</style><script>${script}</script>#\\1`;

  return searchQueryPatterns.map((pattern) => ({
    condition: {
      regexFilter: pattern,
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

async function getKagiSessionLink() {
  const storageKey = "session-link";
  const sessionLink = (await browser.storage.local.get(storageKey))[storageKey];
  return sessionLink;
}

function getKagiSessionToken(sessionLink) {
  const pattern = /https:\/\/kagi.com\/search\?token=([A-Za-z0-9._-]+)/;
  const match = sessionLink.match(pattern);
  if (!match) {
    return null;
  }
  return match[1];
}

function getKagiAuthRules(sessionLink) {
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
        value: getKagiSessionToken(sessionLink),
      }],
    },
  }];
}

async function reloadWebRequestRules() {
  const sessionLink = await getKagiSessionLink();

  const oldRules = await browser.declarativeNetRequest.getDynamicRules();
  const rules = getRedirectRules().concat(getKagiAuthRules(sessionLink));
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
