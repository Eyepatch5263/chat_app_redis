export type MessageType = "text" | "image" | "video" | "pdf";

export interface Message {
	id: string;
	senderId: string;
	content: string;
	messageType: MessageType;
	timeStamp: number | string | Date;
}
