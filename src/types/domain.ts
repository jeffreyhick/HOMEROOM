export type CommitmentCategory = 'technical' | 'career' | 'personal' | 'school';
export type CommitmentStatus = 'active' | 'stalled' | 'done' | 'archived';

export interface Commitment {
  id: string;
  user_id: string;
  name: string;
  category: CommitmentCategory;
  color: string;
  icon: string;
  cadence_days: number;
  importance: number;
  last_progress_at: string | null;
  status: CommitmentStatus;
  stalled_at: string | null;
  context: string | null;
  created_at: string;
}

export type NewCommitment = Pick<Commitment, 'name' | 'category'> &
  Partial<Pick<Commitment, 'cadence_days' | 'importance'>>;

export interface Subtask {
  id: string;
  user_id: string;
  commitment_id: string;
  title: string;
  done: boolean;
  created_at: string;
  done_at: string | null;
}

export interface ProgressLog {
  id: string;
  user_id: string;
  commitment_id: string | null;
  assignment_id: string | null;
  note: string | null;
  created_at: string;
}

export type PendingActionSource = 'voice' | 'text';
export type PendingActionStatus = 'proposed' | 'confirmed' | 'rejected' | 'expired';

export interface PendingAction {
  id: string;
  user_id: string;
  action: { fn: string; args: Record<string, unknown> };
  source: PendingActionSource;
  status: PendingActionStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface Settings {
  id: boolean;
  user_id: string;
  /**
   * Generated in the database from `canvas_ics_url`. The URL itself is a capability
   * secret and is never selected into the browser — the Settings field is write-only
   * and this flag is all the UI needs to render "set ✓".
   */
  canvas_ics_url_set: boolean;
  notify_email: string | null;
  digest_hour_local: number;
  deadline_alert_hours: number;
  stale_deadline_days: number;
  gym_days: number[];
  left_off_note: string | null;
  left_off_at: string | null;
}

/** What the Settings form may write. `canvas_ics_url` is write-only: never read back. */
export type SettingsPatch = Partial<
  Omit<Settings, 'id' | 'user_id' | 'canvas_ics_url_set'> & { canvas_ics_url: string | null }
>;

export type AssignmentStatus = 'upcoming' | 'done' | 'dismissed';

export interface Assignment {
  id: string;
  user_id: string;
  canvas_uid: string | null;
  course: string;
  title: string;
  due_at: string;
  status: AssignmentStatus;
  is_exam: boolean;
  last_touched_at: string | null;
  first_seen_at: string;
  last_synced_at: string;
}

export interface Course {
  id: string;
  user_id: string;
  code: string;
  /** Class-identity colour from the design.md §identity palette. Never a status hue. */
  color: string;
  /** Key into the shared ICONS map. Inline SVG, never emoji. */
  icon: string;
}

export type AttentionItem =
  | { kind: 'assignment'; score: number | 'overdue'; item: Assignment }
  | { kind: 'commitment'; score: number; item: Commitment };
