import { Generated } from "kysely";

export type UserRow = {
  id: Generated<string>;
  fid: number;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
  registeredAt: Date | null;
  notificationUrl: string | null;
  notificationToken: string | null;
  notificationType: Generated<"all" | "hourly" | "semi_daily">;
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
  isOnchain: Generated<boolean>;
  transactionHash: `0x${string}` | null;
}

export type Tables = {
  users: UserRow;
  userSession: UserSessionRow;
  messages: MessageRow;
};
