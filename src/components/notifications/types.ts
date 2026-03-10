export type Kind = 'general' | 'message' | 'schedule' | 'test';

export type RecipientMode = 'all' | 'students' | 'classes';

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  created_at: string;
  // Recipient info returned by the RPC
  recipient_mode?: RecipientMode | null;        // 'all' | 'students' | 'classes'
  recipient_names?: string[] | null;            // list of student/class names
};

export type StudentOption = {
  id: string;
  full_name: string;
};

export type ClassOption = {
  id: string;
  title: string;
};