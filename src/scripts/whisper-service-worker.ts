import { pipeline } from "@huggingface/transformers";
import type { RequestMessage, ResponseMessage } from "../types/message.type.ts";

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
          console.log("received start message");
          break;
        case "TRANSCRIBE":
          console.log("received transcribe message");
          break;
      }
    }
  };
}
chrome.runtime.onMessage.addListener(RequestMessageListener());
