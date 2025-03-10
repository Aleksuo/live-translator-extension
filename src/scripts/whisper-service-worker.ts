import { pipeline, env } from "@huggingface/transformers";
import type {
  AutomaticSpeechRecognitionConfig,
  AutomaticSpeechRecognitionPipeline,
  ProgressCallback,
} from "@huggingface/transformers";
import type {
  RequestMessage,
  ResponseMessage,
  TranscribeRequestMessage,
  TranscribeResponseMessage,
} from "../types/message.type.ts";
import { concatenateFloat32Array } from "../utils/audio-utils";

env.allowLocalModels = false;
if (env?.backends?.onnx?.wasm?.numThreads) {
  env.backends.onnx.wasm.numThreads = 1;
}

class Pipeline {
  readonly task = "automatic-speech-recognition";
  readonly model = "Xenova/whisper-tiny";
  whisperConfiguration: Partial<AutomaticSpeechRecognitionConfig> = {
    language: undefined,
    task: "transcribe",
  };
  buffer: Float32Array<ArrayBufferLike> = new Float32Array(0);
  processing = false;
  instance: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

  async initialize() {
    const options = await chrome.storage.local.get("options");
    const { task, language } = options;
    const config: Partial<AutomaticSpeechRecognitionConfig> = {
      task,
      language,
    };
    if (language === "Auto") {
      config.language = undefined;
    }
    pipelineInstance.setWhisperConfiguration(config);
  }

  setWhisperConfiguration(
    config: Partial<AutomaticSpeechRecognitionConfig>,
  ): void {
    this.whisperConfiguration = config;
  }

  async getInstance(
    progress_callback?: ProgressCallback | undefined,
  ): Promise<AutomaticSpeechRecognitionPipeline> {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, {
        progress_callback,
        device: "webgpu",
      });
    }
    return this.instance;
  }
}

const pipelineInstance = new Pipeline();
await pipelineInstance.initialize();

const transcribe = async (audioChunk: Float32Array<ArrayBufferLike>) => {
  pipelineInstance.buffer = concatenateFloat32Array(
    pipelineInstance.buffer,
    audioChunk,
  );
  if (pipelineInstance.processing) {
    return;
  }
  pipelineInstance.processing = true;
  const model = await pipelineInstance.getInstance();
  const result = await model(
    pipelineInstance.buffer,
    pipelineInstance.whisperConfiguration,
  );
  model;
  pipelineInstance.processing = false;
  return result;
};

type RequestMessageListenerSignature = (
  message: RequestMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: ResponseMessage) => void,
) => void;
function RequestMessageListener(): RequestMessageListenerSignature {
  return (message, sender, sendResponse) => {
    if (message.type) {
      switch (message.type) {
        case "STOP":
          console.log("received stop message");
          break;
        case "START":
          (async () => {
            console.log("received start message");
            const model = await pipelineInstance.getInstance();
            sendResponse({
              type: "START_RESPONSE",
            });
          })();
          return true;
        case "TRANSCRIBE":
          (async () => {
            console.log("received transcribe message");
            const msg = message as TranscribeRequestMessage;
            const audioChunk = new Float32Array(msg.message);

            let truncate = false;
            const bufferLength = pipelineInstance.buffer.length;

            const result = await transcribe(audioChunk);

            if (bufferLength / 16000 > 25) {
              pipelineInstance.buffer = pipelineInstance.buffer.slice(
                bufferLength - 4096,
                pipelineInstance.buffer.length,
              );
              truncate = true;
            }

            sendResponse(<TranscribeResponseMessage>{
              type: "TRANSCRIBE_RESPONSE",
              message: result,
              truncate,
            });
          })();
          return true;
      }
    }
  };
}
chrome.storage.local.onChanged.addListener((changes) => {
  const options = changes?.options.newValue as {
    task: string;
    language: string;
  };
  if (options) {
    const { task, language } = options;
    const config: Partial<AutomaticSpeechRecognitionConfig> = {
      task,
      language,
    };
    if (language === "Auto") {
      config.language = undefined;
    }
    pipelineInstance.setWhisperConfiguration(config);
  }
});
chrome.runtime.onMessage.addListener(RequestMessageListener());
