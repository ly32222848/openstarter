import { defineExtensionMessaging } from "@webext-core/messaging";

interface ProtocolMap {
  hello(data: { name: string }): string;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
