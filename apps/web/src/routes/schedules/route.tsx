// ============================================================================
// Scheduled Jobs Page - List and manage scheduled AST runs
// ============================================================================

import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { Clock, Play, X, ExternalLink, RefreshCw } from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { getSchedules, cancelSchedule, runScheduleNow, type Schedule } from '../../services/schedules';

// ============================================================================
// Route Definition
// ============================================================================

export const Route = createFileRoute('/schedules')({
    component: SchedulesPage,
});

// ============================================================================
// Component
// ============================================================================

function SchedulesPage(): React.ReactNode {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSchedules = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getSchedules();
            setSchedules(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchSchedules();
    }, [fetchSchedules]);

    const handleCancel = async (scheduleId: string) => {
        try {
            await cancelSchedule(scheduleId);
            void fetchSchedules();
        } catch {
            // Ignore errors for now
        }
    };

    const handleRun = async (scheduleId: string) => {
        try {
            await runScheduleNow(scheduleId);
            void fetchSchedules();
        } catch {
            // Ignore errors for now
        }
    };

    const formatDateTime = (isoString: string, timezone: string) => {
        try {
            return new Date(isoString).toLocaleString('en-US', {
                timeZone: timezone,
                dateStyle: 'medium',
                timeStyle: 'short',
            });
        } catch {
            return isoString;
        }
    };

    const getStatusColor = (status: Schedule['status']) => {
        switch (status) {
            case 'pending':
                return 'text-yellow-600 dark:text-yellow-400';
            case 'running':
                return 'text-blue-600 dark:text-blue-400';
            case 'completed':
                return 'text-green-600 dark:text-green-400';
            case 'failed':
                return 'text-red-600 dark:text-red-400';
            case 'cancelled':
                return 'text-gray-600 dark:text-gray-400';
            default:
                return '';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                            Scheduled Jobs
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-zinc-400">
                            View and manage your scheduled AST runs
                        </p>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void fetchSchedules()}
                        disabled={loading}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {loading && schedules.length === 0 ? (
                    <Card title="" description="">
                        <div className="flex items-center justify-center py-12 text-gray-500 dark:text-zinc-400">
                            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                            Loading schedules...
                        </div>
                    </Card>
                ) : schedules.length === 0 ? (
                    <Card title="" description="">
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-zinc-400">
                            <Clock className="w-12 h-12 mb-4 opacity-50" />
                            <p>No scheduled jobs yet</p>
                            <p className="text-sm mt-1">
                                Use the &quot;Schedule for Later&quot; option when running an AST
                            </p>
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {schedules.map((schedule) => (
                            <div
                                key={schedule.scheduleId}
                                className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-4"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-gray-900 dark:text-zinc-100">
                                                {schedule.astName}
                                            </span>
                                            <span className={`text-xs font-medium ${getStatusColor(schedule.status)}`}>
                                                {schedule.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-zinc-400">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5" />
                                                {formatDateTime(schedule.scheduledTime, schedule.timezone)}
                                            </span>
                                            <span className="text-xs opacity-75">{schedule.timezone}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {schedule.status === 'pending' && (
                                            <>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => void handleRun(schedule.scheduleId)}
                                                >
                                                    <Play className="w-3.5 h-3.5 mr-1" />
                                                    Run Now
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => void handleCancel(schedule.scheduleId)}
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </Button>
                                            </>
                                        )}
                                        {schedule.sessionId && (
                                            <Link to={`/?sessionId=${schedule.sessionId}`}>
                                                <Button variant="secondary" size="sm">
                                                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                                    View Terminal
                                                </Button>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
