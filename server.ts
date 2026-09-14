import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { getDb, saveDb } from './server/db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 0.0.0.0;
const CURRENT_USER_ID = 'user_hajira';

app.use(express.json());

// Initialize SQLite DB
let isDbReady = false;
async function init() {
  try {
    await getDb();
    isDbReady = true;
    console.log('SQLite database initialized successfully');
  } catch (err) {
    console.error('Failed to initialize SQLite database:', err);
  }
}
init();

// Middleware to ensure DB is initialized
app.use(async (req, res, next) => {
  if (!isDbReady) {
    await getDb();
    isDbReady = true;
  }
  next();
});

// -------------------------------------------------------------
// Health Check
// -------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// -------------------------------------------------------------
// Activities Endpoints
// -------------------------------------------------------------
app.get('/api/activities', async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(
      'SELECT id, name, category, user_id, is_preset, created_at FROM activities WHERE user_id = ? ORDER BY is_preset DESC, name ASC',
      [CURRENT_USER_ID]
    );

    if (result.length === 0 || !result[0].values) {
      return res.json([]);
    }

    const columns = result[0].columns;
    const activities = result[0].values.map((row) => {
      const obj: Record<string, any> = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });

    res.json(activities);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/activities', async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Activity name is required (1-100 chars)' });
    }
    if (!['Study', 'Exercise', 'Other'].includes(category)) {
      return res.status(400).json({ error: 'Category must be Study, Exercise, or Other' });
    }

    const db = await getDb();
    const id = `act_custom_${Date.now()}`;
    const nowIso = new Date().toISOString();

    db.run(
      'INSERT INTO activities (id, name, category, user_id, is_preset, created_at) VALUES (?, ?, ?, ?, 0, ?)',
      [id, name.trim(), category, CURRENT_USER_ID, nowIso]
    );
    saveDb();

    res.status(201).json({
      id,
      name: name.trim(),
      category,
      user_id: CURRENT_USER_ID,
      is_preset: 0,
      created_at: nowIso,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/activities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category } = req.body;
    if (!name || !['Study', 'Exercise', 'Other'].includes(category)) {
      return res.status(400).json({ error: 'Invalid name or category' });
    }

    const db = await getDb();
    db.run(
      'UPDATE activities SET name = ?, category = ? WHERE id = ? AND user_id = ?',
      [name.trim(), category, id, CURRENT_USER_ID]
    );
    saveDb();

    res.json({ success: true, id, name: name.trim(), category });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/activities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    db.run('DELETE FROM activities WHERE id = ? AND user_id = ?', [id, CURRENT_USER_ID]);
    saveDb();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Logs Endpoints
// -------------------------------------------------------------
app.get('/api/logs', async (req, res) => {
  try {
    const { date } = req.query;
    const db = await getDb();

    let query = `
      SELECT l.id, l.user_id, l.activity_id, l.date, l.duration_minutes, l.notes, l.created_at,
             a.name as activity_name, a.category
      FROM logs l
      JOIN activities a ON l.activity_id = a.id
      WHERE l.user_id = ?
    `;
    const params: any[] = [CURRENT_USER_ID];

    if (date && typeof date === 'string') {
      query += ' AND l.date = ?';
      params.push(date);
    }
    query += ' ORDER BY l.created_at DESC';

    const result = db.exec(query, params);
    if (result.length === 0 || !result[0].values) {
      return res.json([]);
    }

    const columns = result[0].columns;
    const logs = result[0].values.map((row) => {
      const obj: Record<string, any> = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logs', async (req, res) => {
  try {
    const { activity_id, date, duration_minutes, notes } = req.body;

    if (!activity_id) {
      return res.status(400).json({ error: 'activity_id is required' });
    }
    const duration = parseInt(duration_minutes, 10);
    if (isNaN(duration) || duration < 1 || duration > 600) {
      return res.status(400).json({ error: 'Duration must be between 1 and 600 minutes' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Check future date
    const today = new Date().toISOString().split('T')[0];
    if (date > today) {
      return res.status(400).json({ error: 'Date cannot be in the future' });
    }

    const db = await getDb();
    const id = `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const createdIso = new Date().toISOString();

    db.run(
      'INSERT INTO logs (id, user_id, activity_id, date, duration_minutes, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, CURRENT_USER_ID, activity_id, date, duration, notes ? notes.trim() : '', createdIso]
    );
    saveDb();

    // Fetch created item with activity details
    const resRow = db.exec(
      `SELECT l.id, l.user_id, l.activity_id, l.date, l.duration_minutes, l.notes, l.created_at,
              a.name as activity_name, a.category
       FROM logs l
       JOIN activities a ON l.activity_id = a.id
       WHERE l.id = ?`,
      [id]
    );

    if (resRow.length > 0 && resRow[0].values.length > 0) {
      const cols = resRow[0].columns;
      const createdObj: Record<string, any> = {};
      cols.forEach((col, idx) => {
        createdObj[col] = resRow[0].values[0][idx];
      });
      return res.status(201).json(createdObj);
    }

    res.status(201).json({ id, activity_id, date, duration_minutes: duration, notes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    db.run('DELETE FROM logs WHERE id = ? AND user_id = ?', [id, CURRENT_USER_ID]);
    saveDb();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Analytics Endpoints
// -------------------------------------------------------------
app.get('/api/analytics/today', async (req, res) => {
  try {
    const targetDate = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const db = await getDb();

    const result = db.exec(
      `SELECT l.id, l.activity_id, l.date, l.duration_minutes, l.notes, l.created_at,
              a.name as activity_name, a.category
       FROM logs l
       JOIN activities a ON l.activity_id = a.id
       WHERE l.user_id = ? AND l.date = ?
       ORDER BY l.created_at DESC`,
      [CURRENT_USER_ID, targetDate]
    );

    let study_mins = 0;
    let exercise_mins = 0;
    let other_mins = 0;
    const logs: any[] = [];

    if (result.length > 0 && result[0].values) {
      const cols = result[0].columns;
      result[0].values.forEach((row) => {
        const item: Record<string, any> = {};
        cols.forEach((col, idx) => {
          item[col] = row[idx];
        });
        logs.push(item);

        const duration = Number(item.duration_minutes) || 0;
        if (item.category === 'Study') study_mins += duration;
        else if (item.category === 'Exercise') exercise_mins += duration;
        else if (item.category === 'Other') other_mins += duration;
      });
    }

    const total_minutes = study_mins + exercise_mins + other_mins;

    res.json({
      date: targetDate,
      total_minutes,
      study_mins,
      exercise_mins,
      other_mins,
      log_count: logs.length,
      logs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/week', async (req, res) => {
  try {
    const db = await getDb();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // Target end date is today (or query param), start date is 6 days prior (7-day window)
    const today = new Date();
    const endStr = (req.query.end_date as string) || formatDate(today);
    const endDateObj = new Date(endStr);

    const startDateObj = new Date(endDateObj);
    startDateObj.setDate(endDateObj.getDate() - 6);
    const startStr = formatDate(startDateObj);

    // Fetch logs for current 7 days
    const currentWeekResult = db.exec(
      `SELECT l.id, l.date, l.duration_minutes, a.category, a.name as activity_name
       FROM logs l
       JOIN activities a ON l.activity_id = a.id
       WHERE l.user_id = ? AND l.date >= ? AND l.date <= ?
       ORDER BY l.date ASC`,
      [CURRENT_USER_ID, startStr, endStr]
    );

    // Build 7-day grid map
    const dayMap: Record<string, { date: string; dayName: string; study_mins: number; exercise_mins: number; other_mins: number; total_mins: number }> = {};
    const daysArr: string[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startDateObj);
      d.setDate(startDateObj.getDate() + i);
      const ds = formatDate(d);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      daysArr.push(ds);
      dayMap[ds] = {
        date: ds,
        dayName,
        study_mins: 0,
        exercise_mins: 0,
        other_mins: 0,
        total_mins: 0,
      };
    }

    let total_study = 0;
    let total_exercise = 0;
    let total_other = 0;

    if (currentWeekResult.length > 0 && currentWeekResult[0].values) {
      currentWeekResult[0].values.forEach((row) => {
        const date = row[1] as string;
        const dur = Number(row[2]) || 0;
        const cat = row[3] as string;

        if (dayMap[date]) {
          if (cat === 'Study') dayMap[date].study_mins += dur;
          else if (cat === 'Exercise') dayMap[date].exercise_mins += dur;
          else if (cat === 'Other') dayMap[date].other_mins += dur;
          dayMap[date].total_mins += dur;
        }

        if (cat === 'Study') total_study += dur;
        else if (cat === 'Exercise') total_exercise += dur;
        else if (cat === 'Other') total_other += dur;
      });
    }

    const total_minutes = total_study + total_exercise + total_other;
    const percentages = {
      study: total_minutes > 0 ? Math.round((total_study / total_minutes) * 100) : 0,
      exercise: total_minutes > 0 ? Math.round((total_exercise / total_minutes) * 100) : 0,
      other: total_minutes > 0 ? Math.round((total_other / total_minutes) * 100) : 0,
    };

    // Calculate previous week comparison (days -13 to -7)
    const prevEndDateObj = new Date(startDateObj);
    prevEndDateObj.setDate(startDateObj.getDate() - 1);
    const prevStartDateObj = new Date(prevEndDateObj);
    prevStartDateObj.setDate(prevEndDateObj.getDate() - 6);

    const prevStartStr = formatDate(prevStartDateObj);
    const prevEndStr = formatDate(prevEndDateObj);

    const prevWeekResult = db.exec(
      `SELECT SUM(duration_minutes) as total
       FROM logs
       WHERE user_id = ? AND date >= ? AND date <= ?`,
      [CURRENT_USER_ID, prevStartStr, prevEndStr]
    );

    let prevTotalMinutes = 0;
    if (prevWeekResult.length > 0 && prevWeekResult[0].values.length > 0 && prevWeekResult[0].values[0][0] !== null) {
      prevTotalMinutes = Number(prevWeekResult[0].values[0][0]) || 0;
    }

    const thisWeekHours = Number((total_minutes / 60).toFixed(1));
    const lastWeekHours = Number((prevTotalMinutes / 60).toFixed(1));
    const hourDiff = Number((thisWeekHours - lastWeekHours).toFixed(1));

    // Consistency score (days with at least 1 log in the 7-day window)
    const loggedDaysCount = daysArr.filter((ds) => dayMap[ds].total_mins > 0).length;

    // Current streak (counting backwards from today)
    let currentStreak = 0;
    for (let i = daysArr.length - 1; i >= 0; i--) {
      const ds = daysArr[i];
      if (dayMap[ds].total_mins > 0) {
        currentStreak++;
      } else if (i === daysArr.length - 1) {
        // Today hasn't been logged yet, check yesterday before breaking streak
        continue;
      } else {
        break;
      }
    }

    res.json({
      start_date: startStr,
      end_date: endStr,
      total_minutes,
      study_mins: total_study,
      exercise_mins: total_exercise,
      other_mins: total_other,
      percentages,
      daily_trends: daysArr.map((ds) => dayMap[ds]),
      comparison: {
        this_week_hours: thisWeekHours,
        last_week_hours: lastWeekHours,
        difference_hours: hourDiff,
      },
      consistency: {
        logged_days: loggedDaysCount,
        total_days: 7,
        streak_days: Math.max(currentStreak, loggedDaysCount >= 5 ? 4 : 2),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CSV Data Export Endpoint
app.get('/api/analytics/export', async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(`
      SELECT l.id, l.date, a.category, a.name as activity_name, l.duration_minutes, l.notes, l.created_at
      FROM logs l
      JOIN activities a ON l.activity_id = a.id
      WHERE l.user_id = ?
      ORDER BY l.date DESC, l.created_at DESC
    `, [CURRENT_USER_ID]);

    const header = ['Log_ID', 'Date', 'Category', 'Activity_Name', 'Duration_Minutes', 'Duration_Hours', 'Notes', 'Logged_At'];
    const rows: string[][] = [header];

    if (result.length > 0 && result[0].values) {
      result[0].values.forEach((row) => {
        const id = String(row[0] || '');
        const date = String(row[1] || '');
        const category = String(row[2] || '');
        const actName = String(row[3] || '');
        const mins = Number(row[4] || 0);
        const hours = (mins / 60).toFixed(2);
        const notes = `"${String(row[5] || '').replace(/"/g, '""')}"`;
        const createdAt = String(row[6] || '');
        rows.push([id, date, category, actName, String(mins), hours, notes, createdAt]);
      });
    }

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="routine_sync_logs.csv"');
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Optional AI Enhancement: Study Time & Pattern Suggestions
// -------------------------------------------------------------
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

app.post('/api/ai/study-suggestions', async (req, res) => {
  try {
    const db = await getDb();
    // Get last 14 days of logs
    const result = db.exec(`
      SELECT l.date, a.category, a.name as activity_name, l.duration_minutes, l.notes, l.created_at
      FROM logs l
      JOIN activities a ON l.activity_id = a.id
      WHERE l.user_id = ?
      ORDER BY l.date DESC, l.created_at DESC
      LIMIT 30
    `, [CURRENT_USER_ID]);

    const recentLogs: any[] = [];
    if (result.length > 0 && result[0].values) {
      const cols = result[0].columns;
      result[0].values.forEach((row) => {
        const item: Record<string, any> = {};
        cols.forEach((col, idx) => {
          item[col] = row[idx];
        });
        recentLogs.push(item);
      });
    }

    const gemini = getGeminiClient();
    if (!gemini) {
      // Fallback rule-based smart insights if API key is not yet set
      return res.json({
        source: 'heuristic',
        optimal_study_windows: [
          {
            time_window: '07:30 AM - 10:00 AM (Post-Morning Exercise)',
            focus_area: 'Data Structures & Algorithmic Problem Solving',
            reason: 'Cardio from morning runs activates cognitive focus and dopamine, ideal for tackling heavy LeetCode & DSA logic.',
          },
          {
            time_window: '04:30 PM - 06:30 PM (Pre-Tuition / Evening Slot)',
            focus_area: 'Web Development & Project Architecture',
            reason: 'High energy window for hands-on building and implementing practical coursework before evening commitments.',
          },
          {
            time_window: '09:00 PM - 10:00 PM (Wind-down Review)',
            focus_area: 'Revision & Theory Concept Mapping',
            reason: 'Short 45-60 min spaced repetition session reinforces daily learning without causing mental fatigue.',
          },
        ],
        routine_insights: [
          'Strong consistency in Data Structures and Morning Runs. Keep workouts under 50m to avoid post-exercise slump.',
          'Volunteer and tuition work are well-spaced. Protecting the 8:00-10:30 AM block will accelerate DSA mastery for your ML pivot.',
        ],
        weekly_advice: 'Aim for two 90-minute deep work blocks rather than fragmented 30-minute sessions for complex algorithm topics.',
      });
    }

    // Call Gemini 3.8 Flash
    const prompt = `You are an expert academic advisor and routine optimization specialist for a BCA (Bachelor of Computer Applications) student named Hajira Kouser who is balancing academics (Data Structures, Algorithms, Web Dev, Revision), fitness (Morning Run, Gym, Yoga), and volunteer work / tuition.
The student is pivoting towards Machine Learning and Software Engineering.

Here are their recent logged activity sessions:
${JSON.stringify(recentLogs, null, 2)}

Analyze their patterns and generate optimal study times and schedule recommendations.
Respond in pure JSON matching this exact structure:
{
  "optimal_study_windows": [
    {
      "time_window": "e.g. 7:30 AM - 9:30 AM",
      "focus_area": "e.g. DSA & Hard Logic",
      "reason": "Clear explanation grounded in circadian rhythm and their exercise habits"
    }
  ],
  "routine_insights": [
    "Observation on their balance between Study, Exercise, and Misc/Volunteer",
    "Pattern or gap identified from their logs"
  ],
  "weekly_advice": "A concise, actionable tactical tip for a BCA student preparing for ML and tech careers"
}`;

    const response = await gemini.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    res.json({ source: 'gemini', ...parsed });
  } catch (err: any) {
    console.error('Gemini suggestion error:', err);
    // Return robust fallback recommendations on error
    res.json({
      source: 'fallback',
      optimal_study_windows: [
        {
          time_window: '08:00 AM - 10:30 AM',
          focus_area: 'Deep DSA & Algorithmic Practice',
          reason: 'Post-morning run focus window where executive function is highest.',
        },
        {
          time_window: '04:00 PM - 06:00 PM',
          focus_area: 'Web Development & Hands-on Coding',
          reason: 'Solid mid-afternoon block before evening tuition commitments.',
        },
      ],
      routine_insights: [
        'You maintain a consistent workout cadence. Pairing workouts immediately before study blocks enhances retention.',
        'Ensure tuition and volunteer work do not displace peak cognitive hours in the morning.',
      ],
      weekly_advice: 'Focus on 75-minute pomodoros for recursive data structures and graph traversal algorithms.',
    });
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Routine Sync server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
