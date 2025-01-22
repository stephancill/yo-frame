export type User = {
  id: string;
  fid: number;
  notificationsEnabled: boolean;
  notificationType: "all" | "hourly";
};
