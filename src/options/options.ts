import type { AutomaticSpeechRecognitionOutput } from "@huggingface/transformers";
import type {
  RequestMessage,
  ResponseMessage,
  TranscribeRequestMessage,
  TranscribeResponseMessage,
} from "../types/message.type.ts";
import { isSilent } from "../utils/audio-utils";

let capturing = false;
let stream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let processor: ScriptProcessorNode | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let sessionDiv: HTMLDivElement | null = null;
let inputBuffer = null;
let silent = false;

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
const taskSelect = document.getElementById("taskSelect") as HTMLSelectElement;
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
  const task = taskSelect?.value;
  chrome.storage.local.set(
    {
      options: {
        language: language,
        task: task,
      },
    },
    () => {
      console.log(`Language set to ${language}`);
      console.log(`Task set to ${task}`);
    },
  );
  settingsDialog.close();
});

function sendMessageToWhisperWorker(
  message: RequestMessage,
): Promise<ResponseMessage> {
  return chrome.runtime.sendMessage(message);
}

function clearTranscript() {
  if (transcriptContainer) {
    transcriptContainer.innerHTML = "";
  }
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
    if (!silent) {
      sendMessageToWhisperWorker(<TranscribeRequestMessage>{
        type: "TRANSCRIBE",
        message: Array.from(inputBuffer),
      }).then((response: ResponseMessage) => {
        handleTranscribeResponse(response as TranscribeResponseMessage);
      });
    }
  };
}

function handleTranscribeResponse(message: TranscribeResponseMessage) {
  const msg = message as TranscribeResponseMessage;
  if (!sessionDiv || msg.truncate) {
    sessionDiv = createNewSessionDiv();
    const contentDiv = sessionDiv.querySelector(".session-content");
    if (contentDiv && msg.message) {
      contentDiv.textContent = (
        msg.message as AutomaticSpeechRecognitionOutput
      ).text;
      autoScrollToBottom();
    }
  } else {
    const contentDiv = sessionDiv.querySelector(".session-content");
    if (contentDiv && message.message) {
      contentDiv.textContent = (
        msg.message as AutomaticSpeechRecognitionOutput
      ).text;
      autoScrollToBottom();
    }
  }
}

function startCapture() {
  if (capturing) return;
  sendMessageToWhisperWorker({
    type: "START",
  }).then(() => {
    capturing = true;

    startBtn.disabled = true;
    stopBtn.disabled = false;
    clearBtn.disabled = true;
    navigator.mediaDevices
      .getDisplayMedia({
        audio: true, // allow tab audio
        video: true, // or "true" in some cases if Chrome demands at least one video track
      })
      .then((capturedStream) => {
        console.log("[Options] getDisplayMedia stream:", capturedStream);
        stream = capturedStream;
        setupAudioProcessing(stream);
      })
      .catch((err) => {
        console.error("Could not capture tab:", err);
        alert(`Failed to capture audio: ${err.message}`);
        resetUI();
      });
  });
}

function stopCapture() {
  if (!capturing) return;
  sendMessageToWhisperWorker({
    type: "STOP",
  }).then(() => {
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
    if (reconnectTimer) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    }
  });
}

function createNewSessionDiv() {
  const sessionDiv = document.createElement("div");
  sessionDiv.className = "transcription-session";

  const header = document.createElement("h4");
  header.textContent = "Current Session:";
  sessionDiv.appendChild(header);

  const content = document.createElement("div");
  content.className = "session-content";
  sessionDiv.appendChild(content);

  transcriptContainer.appendChild(sessionDiv);
  autoScrollToBottom();

  return sessionDiv;
}

function resetUI() {
  capturing = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  clearBtn.disabled = false;
}

function autoScrollToBottom() {
  transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
}
