import { Generated } from "kysely";

export type UserRow = {
  id: Generated<string>;
  fid: number;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
  notificationUrl: string | null;
  notificationToken: string | null;
};

export interface UserSessionRow {
  id: string;
  userId: string;
  expiresAt: Date;
}

export interface MessageRow {
  id: Generated<string>;
  fromUserId: string;
  toUserId: string;
  message: string;
  createdAt: Generated<Date>;
}

export interface UnassignedMessageRow {
  id: Generated<string>;
  fromUserId: string;
  toFid: number;
  message: string;
  createdAt: Generated<Date>;
}

export type Tables = {
  users: UserRow;
  userSession: UserSessionRow;
  messages: MessageRow;
  unassignedMessages: UnassignedMessageRow;
};
