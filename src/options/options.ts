let capturing = false;
let stream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let processor: ScriptProcessorNode | null = null;
let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let inputBuffer = null;
let silent = false;

const defaultSettings = {
  transcriptionLanguage: "en",
};
/*
const settings = await chrome.storage.sync.get().then((items) => {
  return { ...defaultSettings, ...items };
});*/

const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
const stopBtn = document.getElementById("stopBtn") as HTMLButtonElement;
const clearBtn = document.getElementById("clearBtn") as HTMLButtonElement;
const transcriptContainer = document.getElementById(
  "transcriptContainer",
) as HTMLDivElement;

const settingsBtn = document.getElementById("settingsBtn") as HTMLButtonElement;
const settingsDialog = document.getElementById(
  "settingsDialog",
) as HTMLDialogElement;
const languageSelect = document.getElementById(
  "languageSelect",
) as HTMLSelectElement;
const cancelSettingsBtn = document.getElementById("cancelSettingsBtn");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");

startBtn?.addEventListener("click", startCapture);
stopBtn?.addEventListener("click", stopCapture);
clearBtn?.addEventListener("click", clearTranscript);

settingsBtn?.addEventListener("click", () => {
  settingsDialog?.showModal();
});

cancelSettingsBtn?.addEventListener("click", () => {
  settingsDialog.close();
});

saveSettingsBtn?.addEventListener("click", () => {
  const language = languageSelect?.value;
  chrome.storage.local.set({ transcriptionLanguage: language }, () => {
    console.log(`Language set to ${language}`);
  });
  settingsDialog.close();
});

function clearTranscript() {
  if (transcriptContainer) {
    transcriptContainer.innerHTML = "";
  }
}

function startCapture() {
  if (capturing) return;
  capturing = true;

  startBtn.disabled = true;
  stopBtn.disabled = false;
  clearBtn.disabled = true;

  // Prompt the user to share a tab (or entire screen)
  // In Chrome, if user selects a tab and checks "Share tab audio",
  // you'll get that tab's audio in `stream`.
  navigator.mediaDevices
    .getDisplayMedia({
      audio: true, // allow tab audio
      video: true, // or "true" in some cases if Chrome demands at least one video track
    })
    .then((capturedStream) => {
      console.log("[Options] getDisplayMedia stream:", capturedStream);
      stream = capturedStream;

      // Start the 16k pipeline
      setupAudioProcessing(stream);
      openWebSocket();
    })
    .catch((err) => {
      console.error("Could not capture tab:", err);
      alert(`Failed to capture audio: ${err.message}`);
      resetUI();
    });
}

function stopCapture() {
  if (!capturing) return;
  capturing = false;

  startBtn.disabled = false;
  stopBtn.disabled = true;
  clearBtn.disabled = false;

  if (processor) {
    processor.disconnect();
    processor.onaudioprocess = null;
    processor = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
  if (stream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
    stream = null;
  }
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
  }
}

function resetUI() {
  capturing = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  clearBtn.disabled = false;
}

function setupAudioProcessing(stream: MediaStream) {
  audioCtx = new AudioContext({ sampleRate: 16000 });
  processor = audioCtx.createScriptProcessor(4096, 1, 1);

  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(processor);
  processor.connect(audioCtx.destination);

  processor.onaudioprocess = (event) => {
    inputBuffer = event.inputBuffer.getChannelData(0);
    silent = isSilent(inputBuffer);
    console.log(silent);
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Check volume or detect if it's basically the same as the last chunk
      if (!silent) {
        ws.send(floatTo16BitPCM(inputBuffer));
      }
    }
  };
}

function openWebSocket() {
  if (!capturing) return;
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
  }

  const language = "en";
  const responseFormat = "json";
  const url = `ws://localhost:8000/v1/audio/transcriptions?language=${encodeURIComponent(language)}&response_format=${encodeURIComponent(responseFormat)}`;

  ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";

  console.log("[WS] Opening:", url);

  let partialText = "";
  let sessionDiv: HTMLDivElement | null = null;

  ws.onopen = () => {
    console.log("[WS] Connected.");
    // Create a new session block
    sessionDiv = document.createElement("div");
    sessionDiv.className = "transcription-session";

    const header = document.createElement("h4");
    header.textContent = "Current Session:";
    sessionDiv.appendChild(header);

    const content = document.createElement("div");
    content.className = "session-content";
    sessionDiv.appendChild(content);

    transcriptContainer.appendChild(sessionDiv);
    autoScrollToBottom();
  };

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    partialText = data.text || "";

    if (sessionDiv) {
      const contentDiv = sessionDiv.querySelector(".session-content");
      if (contentDiv) {
        contentDiv.textContent = partialText;
        autoScrollToBottom();
      }
    }
  };

  ws.onerror = (err) => {
    console.warn("[WS] Error:", err);
  };

  ws.onclose = () => {
    console.log("[WS] Closed. Final text:", partialText);
    if (sessionDiv) {
      const note = document.createElement("div");
      note.textContent = "Session closed.";
      note.className = "session-closed-note";
      sessionDiv.appendChild(note);
      autoScrollToBottom();
    }

    // Reconnect if capturing
    if (capturing) {
      reconnectTimer = setInterval(() => {
        if (!silent) {
          openWebSocket();
        }
      }, 500);
    }
  };
}

function floatTo16BitPCM(float32Array: Float32Array) {
  const len = float32Array.length;
  const output = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    output[i] = s;
  }
  return output.buffer;
}

function isSilent(float32Array: Float32Array, threshold = 0.0005) {
  // Option A: compute RMS volume. If below threshold, treat as silence.
  // e.g. threshold ~ 0.0005 => very quiet
  let sum = 0;
  for (let i = 0; i < float32Array.length; i++) {
    sum += float32Array[i] * float32Array[i];
  }
  const rms = Math.sqrt(sum / float32Array.length);
  return rms < threshold;
}

function autoScrollToBottom() {
  transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
}
