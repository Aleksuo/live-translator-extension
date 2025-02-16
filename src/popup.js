document.getElementById("openOptionsBtn").addEventListener("click", () => {
    const url = chrome.runtime.getURL("options_ui/page.html");
    // Store that tab ID somehow, maybe in chrome.storage or pass it as a URL param
    // Then open your options page in a new window or tab
    chrome.windows.create({
      url: url,
      type: "popup",
      width: 400,
      height: 500,
    });
});
