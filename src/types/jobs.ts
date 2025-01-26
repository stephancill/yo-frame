export type NotificationsBulkJobData = {
  notifications: {
    fid?: number;
    token: string;
  }[];
  url: string;
  title: string;
  body: string;
  targetUrl: string;
  notificationId?: string;
};

export type OnchainMessageJobData = {
  transactionHash: `0x${string}`;
  fromAddress: `0x${string}`;
  toAddress: `0x${string}`;
  amount: string;
  data: `0x${string}`;
};
