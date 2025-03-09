import type { AutomaticSpeechRecognitionOutput } from "@huggingface/transformers";

export type RequestMessageType = "STOP" | "START" | "TRANSCRIBE";

export interface RequestMessage {
  type: RequestMessageType;
}

export interface TranscribeRequestMessage extends RequestMessage {
  type: "TRANSCRIBE";
  message: number[];
}

export type ResponseMessageType = "TRANSCRIBE_RESPONSE" | "START_RESPONSE";
export interface ResponseMessage {
  type: ResponseMessageType;
}

export interface TranscribeResponseMessage extends ResponseMessage {
  type: "TRANSCRIBE_RESPONSE";
  message:
    | AutomaticSpeechRecognitionOutput
    | AutomaticSpeechRecognitionOutput[];
  truncate: boolean;
}

export interface StartResponseMessage extends ResponseMessage {
  type: "START_RESPONSE";
}
