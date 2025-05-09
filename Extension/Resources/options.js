if (typeof browser === "undefined") {
  globalThis.browser = chrome;
}

async function init() {
  const storageKey = "session-link";
  const sessionLink = (await browser.storage.local.get(storageKey))[storageKey];
  const input = document.getElementById("session-link-input");
  input.value = sessionLink || "";
  input.addEventListener("input", async () => {
    if (input.validity.valid) {
      await browser.storage.local.set({
        [storageKey]: input.value
      });
    }
  });
}

init();
