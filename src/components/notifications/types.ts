export type Kind = 'general' | 'message' | 'schedule' | 'test';

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  created_at: string;
};
