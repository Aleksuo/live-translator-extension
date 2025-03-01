
export type RequestMessageType = "STOP" | "START" | "TRANSCRIBE";

export interface RequestMessage {
  type: RequestMessageType;
}

export interface TranscribeRequestMessage extends RequestMessage {
  type: "TRANSCRIBE";
  message: Float32Array<ArrayBufferLike>;
}

export type ResponseMessageType = "TRANSCRIBE_RESPONSE";
export interface ResponseMessage {
  type: ResponseMessageType;
}

export interface TranscribeResponseMessage extends ResponseMessage {
  type: "TRANSCRIBE_RESPONSE";
  message: string;
}