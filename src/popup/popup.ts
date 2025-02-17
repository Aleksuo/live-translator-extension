document.getElementById("openOptionsBtn")?.addEventListener("click", () => {
  const url = chrome.runtime.getURL("options_ui/page.html");
  chrome.windows.create({
    url: url,
    type: "popup",
    width: 400,
    height: 500,
  });
});
