import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  username: string;
  created_at: string;
}

export interface Activity {
  id: string;
  name: string;
  category: 'Study' | 'Exercise' | 'Other';
  user_id: string;
  is_preset: number;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  activity_id: string;
  activity_name?: string;
  category?: 'Study' | 'Exercise' | 'Other';
  date: string; // YYYY-MM-DD
  duration_minutes: number;
  notes?: string;
  created_at: string;
}

let dbInstance: Database | null = null;
const DB_FILE_PATH = path.resolve(process.cwd(), 'routine_sync.sqlite');

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE_PATH);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.warn('Failed to load existing SQLite file, creating fresh DB:', err);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Create tables
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Study', 'Exercise', 'Other')),
      user_id TEXT NOT NULL,
      is_preset INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      activity_id TEXT NOT NULL,
      date TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weekly_summary (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      week_start_date TEXT NOT NULL,
      study_mins INTEGER DEFAULT 0,
      exercise_mins INTEGER DEFAULT 0,
      other_mins INTEGER DEFAULT 0
    );
  `);

  // Seed default user and preset activities if empty
  const userCheck = dbInstance.exec("SELECT id FROM users WHERE id = 'user_hajira'");
  if (userCheck.length === 0 || userCheck[0].values.length === 0) {
    const nowIso = new Date().toISOString();
    dbInstance.run(
      "INSERT INTO users (id, username, created_at) VALUES ('user_hajira', 'Hajira Kouser', ?)",
      [nowIso]
    );

    const defaultPresets = [
      { id: 'act_ds', name: 'Data Structures', category: 'Study' },
      { id: 'act_algo', name: 'Algorithms', category: 'Study' },
      { id: 'act_web', name: 'Web Dev', category: 'Study' },
      { id: 'act_rev', name: 'Revision', category: 'Study' },
      { id: 'act_run', name: 'Morning Run', category: 'Exercise' },
      { id: 'act_gym', name: 'Gym', category: 'Exercise' },
      { id: 'act_yoga', name: 'Yoga', category: 'Exercise' },
      { id: 'act_walk', name: 'Walking', category: 'Exercise' },
      { id: 'act_tuit', name: 'Tuition', category: 'Other' },
      { id: 'act_vol', name: 'Volunteering', category: 'Other' },
      { id: 'act_admin', name: 'Admin work', category: 'Other' },
    ];

    for (const p of defaultPresets) {
      dbInstance.run(
        'INSERT INTO activities (id, name, category, user_id, is_preset, created_at) VALUES (?, ?, ?, ?, 1, ?)',
        [p.id, p.name, p.category, 'user_hajira', nowIso]
      );
    }

    // Seed sample routine logs for recent days to provide instant rich insights for the BCA student
    seedSampleLogs(dbInstance);
  }

  saveDb();
  return dbInstance;
}

function seedSampleLogs(db: Database) {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const todayStr = formatDate(now);

  const sampleLogs: Array<{
    dayOffset: number;
    activityId: string;
    duration: number;
    notes: string;
  }> = [
    // Today
    { dayOffset: 0, activityId: 'act_run', duration: 40, notes: '5k park run at 6:30 AM' },
    { dayOffset: 0, activityId: 'act_ds', duration: 110, notes: 'Binary search tree traversals & practice' },
    { dayOffset: 0, activityId: 'act_vol', duration: 90, notes: 'Community youth code camp mentoring' },
    { dayOffset: 0, activityId: 'act_web', duration: 75, notes: 'React hooks refactor and state management' },
    // Yesterday
    { dayOffset: -1, activityId: 'act_gym', duration: 50, notes: 'Upper body resistance workout' },
    { dayOffset: -1, activityId: 'act_algo', duration: 120, notes: 'Dynamic programming memoization problems' },
    { dayOffset: -1, activityId: 'act_tuit', duration: 60, notes: 'Math tuition for junior batch' },
    { dayOffset: -1, activityId: 'act_rev', duration: 45, notes: 'Operating Systems semaphore review' },
    // 2 days ago
    { dayOffset: -2, activityId: 'act_yoga', duration: 35, notes: 'Morning mobility & breathing' },
    { dayOffset: -2, activityId: 'act_ds', duration: 135, notes: 'Graph representations and BFS/DFS' },
    { dayOffset: -2, activityId: 'act_admin', duration: 30, notes: 'College club budget submission' },
    // 3 days ago
    { dayOffset: -3, activityId: 'act_run', duration: 45, notes: 'Morning trail run' },
    { dayOffset: -3, activityId: 'act_web', duration: 90, notes: 'FastAPI and SQLite integration' },
    { dayOffset: -3, activityId: 'act_vol', duration: 60, notes: 'Community library drive organizing' },
    // 4 days ago
    { dayOffset: -4, activityId: 'act_walk', duration: 30, notes: 'Evening brisk walk' },
    { dayOffset: -4, activityId: 'act_algo', duration: 105, notes: 'Divide and conquer algorithms' },
    { dayOffset: -4, activityId: 'act_tuit', duration: 60, notes: 'Data structures tutoring session' },
    // 5 days ago
    { dayOffset: -5, activityId: 'act_gym', duration: 55, notes: 'Core & cardio session' },
    { dayOffset: -5, activityId: 'act_ds', duration: 120, notes: 'Linked list cycles and reversal algorithms' },
    // 6 days ago
    { dayOffset: -6, activityId: 'act_run', duration: 40, notes: 'Morning interval run' },
    { dayOffset: -6, activityId: 'act_rev', duration: 90, notes: 'DBMS SQL normalization review' },
    { dayOffset: -6, activityId: 'act_vol', duration: 90, notes: 'Weekend peer study group' },
  ];

  sampleLogs.forEach((item, idx) => {
    const logDate = new Date(now);
    logDate.setDate(now.getDate() + item.dayOffset);
    const dateStr = formatDate(logDate);
    const createdIso = new Date(logDate.getTime() + (idx * 3600000)).toISOString();
    const logId = `log_seed_${Date.now()}_${idx}`;

    db.run(
      'INSERT INTO logs (id, user_id, activity_id, date, duration_minutes, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [logId, 'user_hajira', item.activityId, dateStr, item.duration, item.notes, createdIso]
    );
  });
}

export function saveDb() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE_PATH, buffer);
  } catch (err) {
    console.error('Error saving SQLite database to disk:', err);
  }
}
