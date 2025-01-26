import { User as NeynarUser } from "@neynar/nodejs-sdk/build/api";

export type User = {
  id: string;
  fid: number;
  notificationsEnabled: boolean;
  notificationType: "all" | "hourly";
  neynarUser: NeynarUser;
};
