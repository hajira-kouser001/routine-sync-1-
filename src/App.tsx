/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useId } from 'react';
import {
  Plus,
  Clock,
  BookOpen,
  Dumbbell,
  HeartHandshake,
  Calendar,
  BarChart3,
  Sparkles,
  Download,
  Trash2,
  CheckCircle2,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Settings2,
  X,
  RefreshCw,
  Info,
} from 'lucide-react';

export type Category = 'Study' | 'Exercise' | 'Other';

export interface Activity {
  id: string;
  name: string;
  category: Category;
  user_id: string;
  is_preset: number;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  activity_id: string;
  activity_name: string;
  category: Category;
  date: string;
  duration_minutes: number;
  notes?: string;
  created_at: string;
}

export interface DayTrend {
  date: string;
  dayName: string;
  study_mins: number;
  exercise_mins: number;
  other_mins: number;
  total_mins: number;
}

export interface WeeklyAnalytics {
  start_date: string;
  end_date: string;
  total_minutes: number;
  study_mins: number;
  exercise_mins: number;
  other_mins: number;
  percentages: {
    study: number;
    exercise: number;
    other: number;
  };
  daily_trends: DayTrend[];
  comparison: {
    this_week_hours: number;
    last_week_hours: number;
    difference_hours: number;
  };
  consistency: {
    logged_days: number;
    total_days: number;
    streak_days: number;
  };
}

export interface StudyWindow {
  time_window: string;
  focus_area: string;
  reason: string;
}

export interface AISuggestions {
  source: string;
  optimal_study_windows: StudyWindow[];
  routine_insights: string[];
  weekly_advice: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'today' | 'weekly' | 'library' | 'ai'>('today');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [todayLogs, setTodayLogs] = useState<ActivityLog[]>([]);
  const [todayStats, setTodayStats] = useState({
    total_minutes: 0,
    study_mins: 0,
    exercise_mins: 0,
    other_mins: 0,
    log_count: 0,
  });
  const [weeklyData, setWeeklyData] = useState<WeeklyAnalytics | null>(null);
  const [aiData, setAiData] = useState<AISuggestions | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quick Log Modal State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logCategory, setLogCategory] = useState<Category>('Study');
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  const [logDuration, setLogDuration] = useState<number>(60);
  const [logNotes, setLogNotes] = useState<string>('');
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);

  // New Custom Activity State
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityCategory, setNewActivityCategory] = useState<Category>('Study');
  const [isCreatingActivity, setIsCreatingActivity] = useState(false);

  const newActivityNameInputId = useId();
  const customDurationInputId = useId();
  const logDateInputId = useId();
  const logNotesInputId = useId();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Fetch activities
  const fetchActivities = async () => {
    try {
      const res = await fetch('/api/activities');
      if (res.ok) {
        const data = await res.json();
        setActivities(data);
        if (data.length > 0 && !selectedActivityId) {
          setSelectedActivityId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading activities', err);
    }
  };

  // Fetch today's summary & logs
  const fetchTodayData = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/analytics/today?date=${todayStr}`);
      if (res.ok) {
        const data = await res.json();
        setTodayStats({
          total_minutes: data.total_minutes || 0,
          study_mins: data.study_mins || 0,
          exercise_mins: data.exercise_mins || 0,
          other_mins: data.other_mins || 0,
          log_count: data.log_count || 0,
        });
        setTodayLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching today summary', err);
    }
  };

  // Fetch weekly analytics
  const fetchWeeklyData = async () => {
    try {
      const res = await fetch('/api/analytics/week');
      if (res.ok) {
        const data = await res.json();
        setWeeklyData(data);
      }
    } catch (err) {
      console.error('Error fetching weekly data', err);
    }
  };

  // Fetch AI suggestions
  const fetchAiSuggestions = async () => {
    setLoadingAi(true);
    try {
      const res = await fetch('/api/ai/study-suggestions', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAiData(data);
      }
    } catch (err) {
      console.error('Error loading AI insights', err);
    } finally {
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    fetchTodayData();
    fetchWeeklyData();
  }, []);

  // Update selected activity when category changes in log modal
  useEffect(() => {
    const matching = activities.filter((a) => a.category === logCategory);
    if (matching.length > 0) {
      setSelectedActivityId(matching[0].id);
    }
  }, [logCategory, activities]);

  // Handle Log Submit (<15 second flow)
  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivityId) {
      alert('Please choose an activity.');
      return;
    }
    if (logDuration < 1 || logDuration > 600) {
      alert('Duration must be between 1 and 600 minutes.');
      return;
    }

    setIsSubmittingLog(true);
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: selectedActivityId,
          date: logDate,
          duration_minutes: logDuration,
          notes: logNotes,
        }),
      });

      if (res.ok) {
        showToast('Activity logged successfully');
        setIsLogModalOpen(false);
        setLogNotes('');
        fetchTodayData();
        fetchWeeklyData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to record activity log');
      }
    } catch (err) {
      console.error('Submit log error', err);
    } finally {
      setIsSubmittingLog(false);
    }
  };

  // Delete Log
  const handleDeleteLog = async (logId: string) => {
    try {
      const res = await fetch(`/api/logs/${logId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Activity log removed');
        fetchTodayData();
        fetchWeeklyData();
      }
    } catch (err) {
      console.error('Delete error', err);
    }
  };

  // Create Custom Activity
  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityName.trim()) return;

    setIsCreatingActivity(true);
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newActivityName.trim(),
          category: newActivityCategory,
        }),
      });
      if (res.ok) {
        setNewActivityName('');
        showToast(`Added "${newActivityName.trim()}" to ${newActivityCategory}`);
        fetchActivities();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create activity');
      }
    } catch (err) {
      console.error('Error adding activity', err);
    } finally {
      setIsCreatingActivity(false);
    }
  };

  // Delete Custom Activity
  const handleDeleteActivity = async (actId: string) => {
    try {
      const res = await fetch(`/api/activities/${actId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Activity deleted from library');
        fetchActivities();
      }
    } catch (err) {
      console.error('Delete activity error', err);
    }
  };

  const formatHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const getCategoryColor = (category: Category) => {
    switch (category) {
      case 'Study':
        return 'text-gray-900 bg-gray-100 border-gray-300';
      case 'Exercise':
        return 'text-gray-800 bg-gray-200 border-gray-400';
      case 'Other':
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getCategoryBarColor = (category: Category) => {
    switch (category) {
      case 'Study':
        return 'bg-gray-800';
      case 'Exercise':
        return 'bg-gray-600';
      case 'Other':
        return 'bg-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-800 antialiased font-sans flex flex-col">
      {/* Top Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-900 text-white rounded flex items-center justify-center font-bold text-sm tracking-wide">
              RS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 tracking-tight leading-none">
                  Routine Sync
                </h1>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                  BCA Academic Tracker
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Academics • Fitness • Volunteering & Tuition
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              id="export-csv-btn"
              href="/api/analytics/export"
              download="routine_sync_logs.csv"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:text-gray-900 transition-colors"
              title="Download CSV for personal records"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </a>

            <button
              id="header-quick-log-btn"
              onClick={() => {
                setLogDate(new Date().toISOString().split('T')[0]);
                setIsLogModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log Activity</span>
            </button>
          </div>
        </div>

        {/* Minimal Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 border-t border-gray-100">
          <button
            id="tab-today"
            onClick={() => setActiveTab('today')}
            className={`py-2.5 px-3.5 text-xs font-medium border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'today'
                ? 'border-gray-900 text-gray-900 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Today's Summary</span>
            {todayLogs.length > 0 && (
              <span className="ml-1 text-[10px] bg-gray-200 text-gray-700 rounded-full px-1.5 py-0.2">
                {todayLogs.length}
              </span>
            )}
          </button>

          <button
            id="tab-weekly"
            onClick={() => setActiveTab('weekly')}
            className={`py-2.5 px-3.5 text-xs font-medium border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'weekly'
                ? 'border-gray-900 text-gray-900 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Weekly Insights</span>
          </button>

          <button
            id="tab-library"
            onClick={() => setActiveTab('library')}
            className={`py-2.5 px-3.5 text-xs font-medium border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'library'
                ? 'border-gray-900 text-gray-900 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Activity Library</span>
          </button>

          <button
            id="tab-ai"
            onClick={() => {
              setActiveTab('ai');
              if (!aiData && !loadingAi) fetchAiSuggestions();
            }}
            className={`py-2.5 px-3.5 text-xs font-medium border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'ai'
                ? 'border-gray-900 text-gray-900 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>AI Study Optimizer</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Toast Alert */}
        {toastMessage && (
          <div
            id="toast-notification"
            className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white px-4 py-2.5 rounded shadow-lg flex items-center gap-2 text-xs border border-gray-700 animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 1: TODAY'S DASHBOARD                             */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'today' && (
          <div className="space-y-6">
            {/* Quick Summary Cards per PRD */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                  Total Time Today
                </span>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {formatHours(todayStats.total_minutes)}
                </div>
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  <span>{todayStats.log_count} logged sessions</span>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Study (Academics)
                  </span>
                  <BookOpen className="w-3.5 h-3.5 text-gray-700" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {formatHours(todayStats.study_mins)}
                </div>
                <p className="text-xs text-gray-500 mt-1">DSA, Web Dev, Theory</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Exercise (Fitness)
                  </span>
                  <Dumbbell className="w-3.5 h-3.5 text-gray-700" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {formatHours(todayStats.exercise_mins)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Run, Gym, Mobility</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Misc & Other
                  </span>
                  <HeartHandshake className="w-3.5 h-3.5 text-gray-700" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {formatHours(todayStats.other_mins)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Tuition, Volunteering</p>
              </div>
            </section>

            {/* Visual breakdown bar per PRD */}
            <section className="bg-gray-50 border border-gray-200 rounded p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-gray-700">Today's Category Breakdown</span>
                <span className="text-gray-500">
                  {todayStats.total_minutes > 0
                    ? `${todayStats.total_minutes} mins total`
                    : 'No sessions logged yet'}
                </span>
              </div>

              {todayStats.total_minutes > 0 ? (
                <div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden flex">
                    <div
                      style={{
                        width: `${(todayStats.study_mins / todayStats.total_minutes) * 100}%`,
                      }}
                      className="bg-gray-900 transition-all duration-300"
                      title={`Study: ${todayStats.study_mins}m`}
                    />
                    <div
                      style={{
                        width: `${(todayStats.exercise_mins / todayStats.total_minutes) * 100}%`,
                      }}
                      className="bg-gray-600 transition-all duration-300"
                      title={`Exercise: ${todayStats.exercise_mins}m`}
                    />
                    <div
                      style={{
                        width: `${(todayStats.other_mins / todayStats.total_minutes) * 100}%`,
                      }}
                      className="bg-gray-400 transition-all duration-300"
                      title={`Other: ${todayStats.other_mins}m`}
                    />
                  </div>

                  <div className="flex items-center gap-5 mt-3 text-xs text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-gray-900" />
                      <span>
                        Study: {Math.round((todayStats.study_mins / todayStats.total_minutes) * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-gray-600" />
                      <span>
                        Exercise:{' '}
                        {Math.round((todayStats.exercise_mins / todayStats.total_minutes) * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-gray-400" />
                      <span>
                        Other: {Math.round((todayStats.other_mins / todayStats.total_minutes) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500 italic py-1">
                  Click "Log Activity" above to record your first study, workout, or volunteer session.
                </div>
              )}
            </section>

            {/* Quick Log Presets Row for 1-Click Fast Logging */}
            <section className="border border-gray-200 rounded p-4 bg-white">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Quick Presets (Fast 1-Click Start)
                </h3>
                <span className="text-[11px] text-gray-500">Tap to pre-fill log</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {activities.slice(0, 7).map((act) => (
                  <button
                    key={act.id}
                    onClick={() => {
                      setLogCategory(act.category);
                      setSelectedActivityId(act.id);
                      setIsLogModalOpen(true);
                    }}
                    className="px-3 py-1.5 border border-gray-200 bg-gray-50 rounded text-xs font-medium text-gray-800 hover:bg-gray-100 hover:border-gray-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        act.category === 'Study'
                          ? 'bg-gray-900'
                          : act.category === 'Exercise'
                          ? 'bg-gray-600'
                          : 'bg-gray-400'
                      }`}
                    />
                    <span>{act.name}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Chronological Activity Feed */}
            <section className="border border-gray-200 rounded overflow-hidden bg-white">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                    Today's Activity Feed
                  </h3>
                  <span className="text-xs text-gray-500 font-normal">
                    ({new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                  </span>
                </div>
                <span className="text-xs text-gray-500">Chronological list</span>
              </div>

              {todayLogs.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-xs">
                  <Clock className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p className="font-medium text-gray-700">No activities logged yet today</p>
                  <p className="text-gray-400 mt-0.5">
                    Log your morning routine, DSA study session, or workout.
                  </p>
                  <button
                    onClick={() => setIsLogModalOpen(true)}
                    className="mt-3 px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 cursor-pointer"
                  >
                    Log Activity Now
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {todayLogs.map((log) => (
                    <div
                      key={log.id}
                      className="px-4 py-3 flex items-start justify-between hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 p-1.5 rounded border ${getCategoryColor(
                            log.category
                          )}`}
                        >
                          {log.category === 'Study' && <BookOpen className="w-3.5 h-3.5" />}
                          {log.category === 'Exercise' && <Dumbbell className="w-3.5 h-3.5" />}
                          {log.category === 'Other' && <HeartHandshake className="w-3.5 h-3.5" />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {log.activity_name}
                            </span>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 border border-gray-200">
                              {log.category}
                            </span>
                          </div>

                          {log.notes && (
                            <p className="text-xs text-gray-600 mt-1 max-w-xl">{log.notes}</p>
                          )}

                          <div className="text-[11px] text-gray-400 mt-1">
                            Logged at{' '}
                            {new Date(log.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900 block">
                            {formatHours(log.duration_minutes)}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {log.duration_minutes} mins
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 2: WEEKLY OVERVIEW & ANALYTICS                   */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'weekly' && weeklyData && (
          <div className="space-y-6">
            {/* Header / Week Range */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">7-Day Performance Overview</h2>
                <p className="text-xs text-gray-500">
                  Window: {weeklyData.start_date} to {weeklyData.end_date}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded border border-gray-200">
                  <Flame className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-semibold text-gray-800">
                    {weeklyData.consistency.streak_days} Day Streak
                  </span>
                </div>
                <div className="text-gray-600">
                  Logged <span className="font-bold text-gray-900">{weeklyData.consistency.logged_days}</span> of 7 days
                </div>
              </div>
            </div>

            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                  Total Weekly Hours
                </span>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {weeklyData.comparison.this_week_hours} hrs
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs">
                  {weeklyData.comparison.difference_hours >= 0 ? (
                    <span className="text-emerald-700 flex items-center font-medium">
                      <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                      +{weeklyData.comparison.difference_hours}h vs last week
                    </span>
                  ) : (
                    <span className="text-gray-600 flex items-center font-medium">
                      <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                      {weeklyData.comparison.difference_hours}h vs last week
                    </span>
                  )}
                  <span className="text-gray-400">({weeklyData.comparison.last_week_hours}h prev)</span>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                  Weekly Balance
                </span>
                <div className="text-xs text-gray-700 mt-2 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Study ({weeklyData.percentages.study}%)</span>
                    <span>{formatHours(weeklyData.study_mins)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Exercise ({weeklyData.percentages.exercise}%)</span>
                    <span>{formatHours(weeklyData.exercise_mins)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Other ({weeklyData.percentages.other}%)</span>
                    <span>{formatHours(weeklyData.other_mins)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                    Consistency Score
                  </span>
                  <div className="text-2xl font-bold text-gray-900 mt-1">
                    {Math.round((weeklyData.consistency.logged_days / 7) * 100)}%
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Target: Log at least once every day for discipline
                  </p>
                </div>
                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-3">
                  <div
                    className="bg-gray-900 h-full rounded-full"
                    style={{
                      width: `${(weeklyData.consistency.logged_days / 7) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Day-by-day Grid (Mon-Sun) per PRD */}
            <div className="border border-gray-200 rounded bg-white p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                  Day-by-Day Hours per Category (Mon - Sun)
                </h3>
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-gray-900" />
                    <span>Study</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-gray-600" />
                    <span>Exercise</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-gray-400" />
                    <span>Other</span>
                  </div>
                </div>
              </div>

              {/* Responsive Bar Grid */}
              <div className="grid grid-cols-7 gap-2 pt-6 pb-2 border-b border-gray-100">
                {weeklyData.daily_trends.map((day) => {
                  const maxMins = 360; // 6 hours scale reference
                  const studyPct = Math.min((day.study_mins / maxMins) * 100, 100);
                  const exPct = Math.min((day.exercise_mins / maxMins) * 100, 100);
                  const otherPct = Math.min((day.other_mins / maxMins) * 100, 100);

                  return (
                    <div key={day.date} className="flex flex-col items-center">
                      <div className="text-[11px] font-semibold text-gray-800 mb-1">
                        {day.total_mins > 0 ? formatHours(day.total_mins) : '-'}
                      </div>

                      {/* Stacked Vertical Bar */}
                      <div className="w-full max-w-[36px] h-36 bg-gray-100 rounded flex flex-col-reverse p-0.5 gap-0.5">
                        {day.study_mins > 0 && (
                          <div
                            style={{ height: `${studyPct}%` }}
                            className="w-full bg-gray-900 rounded-sm"
                            title={`Study: ${day.study_mins}m`}
                          />
                        )}
                        {day.exercise_mins > 0 && (
                          <div
                            style={{ height: `${exPct}%` }}
                            className="w-full bg-gray-600 rounded-sm"
                            title={`Exercise: ${day.exercise_mins}m`}
                          />
                        )}
                        {day.other_mins > 0 && (
                          <div
                            style={{ height: `${otherPct}%` }}
                            className="w-full bg-gray-400 rounded-sm"
                            title={`Other: ${day.other_mins}m`}
                          />
                        )}
                      </div>

                      <span className="text-xs font-medium text-gray-700 mt-2">
                        {day.dayName}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {day.date.split('-').slice(1).join('/')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Tabular Breakdown for Accessibility */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-200">
                      <th className="py-1.5 font-medium">Day</th>
                      <th className="py-1.5 font-medium">Study</th>
                      <th className="py-1.5 font-medium">Exercise</th>
                      <th className="py-1.5 font-medium">Other</th>
                      <th className="py-1.5 font-medium text-right">Daily Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {weeklyData.daily_trends.map((day) => (
                      <tr key={day.date} className="hover:bg-gray-50">
                        <td className="py-2 font-semibold text-gray-900">
                          {day.dayName}, {day.date}
                        </td>
                        <td className="py-2 text-gray-700">{formatHours(day.study_mins)}</td>
                        <td className="py-2 text-gray-700">{formatHours(day.exercise_mins)}</td>
                        <td className="py-2 text-gray-700">{formatHours(day.other_mins)}</td>
                        <td className="py-2 text-right font-bold text-gray-900">
                          {formatHours(day.total_mins)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 3: ACTIVITY LIBRARY                              */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'library' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">Activity Library</h2>
                <p className="text-xs text-gray-500">
                  Pre-set templates & customized activity items for your BCA routine
                </p>
              </div>
            </div>

            {/* Create Custom Activity Form */}
            <form
              onSubmit={handleCreateActivity}
              className="bg-gray-50 border border-gray-200 rounded p-4"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3">
                Add Custom Activity
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-6">
                  <label htmlFor={newActivityNameInputId} className="block text-xs font-medium text-gray-700 mb-1">
                    Activity Name
                  </label>
                  <input
                    id={newActivityNameInputId}
                    type="text"
                    required
                    placeholder="e.g. Machine Learning Prep, Linear Algebra..."
                    value={newActivityName}
                    onChange={(e) => setNewActivityName(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newActivityCategory}
                    onChange={(e) => setNewActivityCategory(e.target.value as Category)}
                    className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-gray-900"
                  >
                    <option value="Study">Study (Academics & ML)</option>
                    <option value="Exercise">Exercise (Fitness & Health)</option>
                    <option value="Other">Other (Tuition, Volunteer, Admin)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={isCreatingActivity || !newActivityName.trim()}
                    className="w-full py-1.5 px-3 bg-gray-900 text-white rounded text-xs font-semibold hover:bg-gray-800 disabled:opacity-50 cursor-pointer"
                  >
                    {isCreatingActivity ? 'Adding...' : 'Add Activity'}
                  </button>
                </div>
              </div>
            </form>

            {/* Activity Lists Grouped by Category */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(['Study', 'Exercise', 'Other'] as Category[]).map((cat) => {
                const filtered = activities.filter((a) => a.category === cat);
                return (
                  <div key={cat} className="border border-gray-200 rounded overflow-hidden bg-white">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {cat === 'Study' && <BookOpen className="w-3.5 h-3.5 text-gray-900" />}
                        {cat === 'Exercise' && <Dumbbell className="w-3.5 h-3.5 text-gray-700" />}
                        {cat === 'Other' && <HeartHandshake className="w-3.5 h-3.5 text-gray-600" />}
                        <h4 className="text-xs font-bold text-gray-900">{cat}</h4>
                      </div>
                      <span className="text-[11px] text-gray-500 font-medium">
                        {filtered.length} items
                      </span>
                    </div>

                    <div className="divide-y divide-gray-100 p-1">
                      {filtered.map((act) => (
                        <div
                          key={act.id}
                          className="px-3 py-2 flex items-center justify-between text-xs hover:bg-gray-50 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">{act.name}</span>
                            {act.is_preset === 1 ? (
                              <span className="text-[10px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded">
                                preset
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">
                                custom
                              </span>
                            )}
                          </div>

                          {act.is_preset === 0 && (
                            <button
                              onClick={() => handleDeleteActivity(act.id)}
                              className="text-gray-400 hover:text-red-600 p-1 rounded"
                              title="Delete custom activity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 4: AI STUDY OPTIMIZER (LEARNING & ML PIVOT)      */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-gray-900">
                    AI Study Schedule Optimizer
                  </h2>
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    ML Pivot Scope
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Pattern analysis grounded in your logged workout, study, and volunteer routines
                </p>
              </div>

              <button
                onClick={fetchAiSuggestions}
                disabled={loadingAi}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-800 bg-gray-50 border border-gray-300 rounded hover:bg-gray-100 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAi ? 'animate-spin' : ''}`} />
                <span>{loadingAi ? 'Analyzing Patterns...' : 'Re-analyze Logs'}</span>
              </button>
            </div>

            {loadingAi ? (
              <div className="p-12 text-center text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded">
                <RefreshCw className="w-6 h-6 mx-auto mb-2 text-gray-400 animate-spin" />
                <p className="font-semibold text-gray-800">
                  Synthesizing cognitive energy curves and logged habits...
                </p>
                <p className="text-gray-400 mt-1">
                  Evaluating data structures sessions, workout timing, and tuition commitments
                </p>
              </div>
            ) : aiData ? (
              <div className="space-y-5">
                {/* Optimal Study Slots */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gray-900" />
                    <span>Recommended Deep Work Study Windows</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {aiData.optimal_study_windows?.map((win, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-gray-200 rounded p-4 hover:border-gray-400 transition-colors"
                      >
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                          <span className="text-xs font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                            {win.time_window}
                          </span>
                          <span className="text-[11px] font-semibold text-gray-600">
                            Slot #{idx + 1}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-gray-900 mt-2.5">
                          {win.focus_area}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                          {win.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pattern Insights */}
                <div className="bg-gray-50 border border-gray-200 rounded p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-2.5 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-gray-600" />
                    <span>Logged Habit Observations</span>
                  </h3>
                  <ul className="space-y-2 text-xs text-gray-700">
                    {aiData.routine_insights?.map((insight, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-gray-400 font-bold">•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Tactical Sprint Advice */}
                {aiData.weekly_advice && (
                  <div className="border border-gray-300 rounded p-4 bg-white flex items-start gap-3">
                    <div className="p-1.5 bg-gray-900 text-white rounded">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                        BCA & ML Pivot Weekly Sprint Advice
                      </h4>
                      <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                        {aiData.weekly_advice}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </main>

      {/* ---------------------------------------------------- */}
      {/* QUICK LOG MODAL (Flow 1: <15 seconds to log)         */}
      {/* ---------------------------------------------------- */}
      {isLogModalOpen && (
        <div
          id="log-activity-modal-overlay"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setIsLogModalOpen(false)}
        >
          <div
            id="log-activity-modal"
            className="bg-white rounded border border-gray-300 w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-800" />
                <h3 className="text-sm font-bold text-gray-900">Log Daily Routine Session</h3>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogSubmit} className="p-5 space-y-4">
              {/* Category Choice */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  1. Select Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Study', 'Exercise', 'Other'] as Category[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setLogCategory(cat)}
                      className={`py-2 px-3 text-xs font-medium rounded border text-center transition-colors cursor-pointer ${
                        logCategory === cat
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity Choice */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  2. Choose Activity ({logCategory})
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 border border-gray-200 rounded bg-gray-50">
                  {activities
                    .filter((a) => a.category === logCategory)
                    .map((act) => (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => setSelectedActivityId(act.id)}
                        className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                          selectedActivityId === act.id
                            ? 'bg-gray-900 text-white border-gray-900 font-semibold'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {act.name}
                      </button>
                    ))}
                </div>
              </div>

              {/* Duration Choice */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor={customDurationInputId} className="text-xs font-semibold text-gray-700">
                    3. Time Spent
                  </label>
                  <span className="text-xs font-bold text-gray-900">
                    {formatHours(logDuration)} ({logDuration} mins)
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5 mb-2">
                  {[15, 30, 45, 60, 90, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setLogDuration(mins)}
                      className={`py-1 text-xs rounded border text-center font-medium cursor-pointer ${
                        logDuration === mins
                          ? 'bg-gray-800 text-white border-gray-800'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
                <input
                  id={customDurationInputId}
                  type="number"
                  min={1}
                  max={600}
                  value={logDuration}
                  onChange={(e) => setLogDuration(Number(e.target.value) || 0)}
                  placeholder="Custom minutes (1-600)"
                  className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-gray-900"
                />
              </div>

              {/* Date & Optional Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={logDateInputId} className="block text-xs font-semibold text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    id={logDateInputId}
                    type="date"
                    max={new Date().toISOString().split('T')[0]}
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-gray-900"
                  />
                </div>

                <div>
                  <label htmlFor={logNotesInputId} className="block text-xs font-semibold text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <input
                    id={logNotesInputId}
                    type="text"
                    maxLength={500}
                    placeholder="e.g. Tree traversals, pace 5:20..."
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLog || !selectedActivityId}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-gray-900 rounded hover:bg-gray-800 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isSubmittingLog ? 'Saving...' : 'Record Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Floating Action Button (FAB) for Log Activity per PRD Section 7.6 */}
      <button
        id="mobile-fab-log"
        onClick={() => {
          setLogDate(new Date().toISOString().split('T')[0]);
          setIsLogModalOpen(true);
        }}
        className="sm:hidden fixed bottom-5 right-5 z-40 bg-gray-900 text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:bg-gray-800 active:scale-95 transition-transform"
        title="Quick Log Activity"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Footer per PRD Minimalist Style */}
      <footer className="border-t border-gray-200 bg-gray-50 py-4 mt-auto text-center text-xs text-gray-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Routine Sync • Designed for BCA Students</span>
          <span className="text-[11px] text-gray-400">
            SQLite Persistence • Fast 15-second logging • ML Pivot Scope
          </span>
        </div>
      </footer>
    </div>
  );
}

