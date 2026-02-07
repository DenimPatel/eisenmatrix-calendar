import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Trash2, History, Link as LinkIcon, Repeat, Calendar as CalendarIcon, Edit2, CheckCircle, RefreshCw, BarChart3, Clock, CalendarCheck } from 'lucide-react';
import { Task, TaskStatus, Urgency, Importance, HistoryEntry, Frequency } from '../types';
import { cn, formatDateTimeReadable, getStatusColor, getPeriodKey, formatDate, getRecurrenceDeadline, getTaskStatus, parseLocalTaskDate } from '../lib/utils';
import { endOfWeek, endOfMonth } from 'date-fns';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onSave: (task: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
  defaultDate: string;
  contextDate?: Date;
}

export const TaskModal: React.FC<TaskModalProps> = ({ 
  isOpen, 
  onClose, 
  task, 
  onSave, 
  onDelete,
  defaultDate,
  contextDate = new Date()
}) => {
  const [formData, setFormData] = useState<Partial<Task>>({
    title: '',
    description: '',
    status: TaskStatus.TODO,
    urgency: Urgency.LOW,
    importance: Importance.LOW,
    frequency: Frequency.NONE,
    date: defaultDate,
    completionHistory: {}
  });
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'analytics'>('details');
  const [isEditingDate, setIsEditingDate] = useState(false);

  useEffect(() => {
    if (task) {
      // Determine status based on context date for recurring tasks
      const currentStatus = getTaskStatus(task, contextDate);
      
      setFormData({
        ...task,
        status: currentStatus,
        frequency: task.frequency || Frequency.NONE,
        completionHistory: task.completionHistory || {},
        recurrenceEndedAt: task.recurrenceEndedAt
      });
    } else {
      setFormData({
        title: '',
        description: '',
        status: TaskStatus.TODO,
        urgency: Urgency.LOW,
        importance: Importance.LOW,
        frequency: Frequency.NONE,
        date: defaultDate,
        completionHistory: {}
      });
    }
    setActiveTab('details');
    setIsEditingDate(false);
  }, [task, isOpen, defaultDate, contextDate]);

  // When frequency changes, auto-update date if applicable
  const handleFrequencyChange = (newFreq: Frequency) => {
    let newDate = formData.date;
    
    // If switching to a recurring frequency from None, or changing recurrence type
    // Auto-set the deadline based on current context date or existing date
    if (newFreq !== Frequency.NONE && newFreq !== formData.frequency) {
        const baseDate = formData.date ? parseLocalTaskDate(formData.date) : new Date();
        const deadline = getRecurrenceDeadline(baseDate, newFreq);
        newDate = formatDate(deadline);
    }

    setFormData(prev => ({ 
        ...prev, 
        frequency: newFreq,
        date: newDate || prev.date
    }));
  };

  const handleCompleteSeries = (e: React.MouseEvent) => {
    e.preventDefault(); 
    
    const now = Date.now();
    const finalData = { 
      ...formData, 
      recurrenceEndedAt: now,
      status: TaskStatus.DONE
    };

    if (finalData.frequency && finalData.frequency !== Frequency.NONE) {
      const key = getPeriodKey(contextDate, finalData.frequency);
      finalData.completionHistory = {
        ...finalData.completionHistory,
        [key]: TaskStatus.DONE
      };
    }

    onSave(finalData);
    onClose();
  };

  const handleResumeSeries = (e: React.MouseEvent) => {
    e.preventDefault();
    
    const finalData = { 
      ...formData, 
      recurrenceEndedAt: undefined,
      status: TaskStatus.TODO
    };
    onSave(finalData);
    onClose();
  };

  const handleDelete = () => {
     if (task?.id && confirm('Are you sure you want to delete this task completely?')) {
        onDelete(task.id);
     }
  }

  // Analytics Computation
  const analytics = useMemo(() => {
    if (!task?.completionHistory) return null;
    
    const historyValues = Object.values(task.completionHistory);
    const totalTracked = historyValues.length;
    const completedCount = historyValues.filter(s => s === TaskStatus.DONE).length;
    const completionRate = totalTracked > 0 ? Math.round((completedCount / totalTracked) * 100) : 0;
    
    // Sort keys to show recent history
    const sortedKeys = Object.keys(task.completionHistory).sort().reverse();
    const recentHistory = sortedKeys.slice(0, 10).map(key => ({
        period: key,
        status: task.completionHistory![key]
    }));

    return { totalTracked, completedCount, completionRate, recentHistory };
  }, [task]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalData = { ...formData };

    if (finalData.frequency !== Frequency.NONE) {
       const key = getPeriodKey(contextDate, finalData.frequency!);
       finalData.completionHistory = {
         ...finalData.completionHistory,
         [key]: finalData.status as TaskStatus
       };
    }

    onSave(finalData);
    onClose();
  };

  const isSeriesEnded = !!formData.recurrenceEndedAt;
  const isRecurring = formData.frequency && formData.frequency !== Frequency.NONE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">
            {task?.id ? 'Edit Task' : 'New Task'}
          </h2>
          <div className="flex items-center space-x-2">
            {task?.id && (
              <button 
                onClick={handleDelete}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Task"
                type="button"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        {task?.id && (
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab('details')}
              className={cn(
                "flex-1 py-3 text-sm font-medium transition-colors border-b-2",
                activeTab === 'details' ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
              )}
              type="button"
            >
              Details
            </button>
            {isRecurring && (
              <button
                onClick={() => setActiveTab('analytics')}
                className={cn(
                  "flex-1 py-3 text-sm font-medium transition-colors border-b-2",
                  activeTab === 'analytics' ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                )}
                type="button"
              >
                Analytics
              </button>
            )}
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                "flex-1 py-3 text-sm font-medium transition-colors border-b-2",
                activeTab === 'history' ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
              )}
              type="button"
            >
              History ({task.history?.length || 0})
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' ? (
            <div className="flex flex-col h-full">
              <form id="task-form" onSubmit={handleSubmit} className="space-y-6 flex-1">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Task Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all",
                      isSeriesEnded && "bg-slate-50 text-slate-500"
                    )}
                    placeholder="What needs to be done?"
                    disabled={isSeriesEnded}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Urgency</label>
                    <div className={cn("flex p-1 bg-slate-100 rounded-lg", isSeriesEnded && "opacity-60 pointer-events-none")}>
                      {Object.values(Urgency).map(u => (
                        <button
                          type="button"
                          key={u}
                          disabled={isSeriesEnded}
                          onClick={() => setFormData(prev => ({ ...prev, urgency: u }))}
                          className={cn(
                            "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                            formData.urgency === u ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                          )}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Importance</label>
                    <div className={cn("flex p-1 bg-slate-100 rounded-lg", isSeriesEnded && "opacity-60 pointer-events-none")}>
                      {Object.values(Importance).map(i => (
                        <button
                          type="button"
                          key={i}
                          disabled={isSeriesEnded}
                          onClick={() => setFormData(prev => ({ ...prev, importance: i }))}
                          className={cn(
                            "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                            formData.importance === i ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                          )}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                      <Repeat size={14} /> Frequency
                    </label>
                    <select
                      value={formData.frequency}
                      disabled={isSeriesEnded}
                      onChange={(e) => handleFrequencyChange(e.target.value as Frequency)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      {Object.values(Frequency).map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex justify-between items-center">
                      Date
                      {formData.frequency !== Frequency.NONE && !isEditingDate && !isSeriesEnded && (
                        <button 
                          type="button" 
                          onClick={() => setIsEditingDate(true)}
                          className="text-indigo-600 text-xs flex items-center gap-1 hover:underline"
                        >
                          <Edit2 size={10} /> Edit
                        </button>
                      )}
                    </label>
                    
                    {formData.frequency !== Frequency.NONE && !isEditingDate ? (
                      <div className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 flex items-center gap-2">
                          <CalendarIcon size={16} className="text-slate-400" />
                          <span>Deadline: {formData.date}</span>
                      </div>
                    ) : (
                      <input
                        type="date"
                        value={formData.date}
                        disabled={isSeriesEnded}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50 disabled:text-slate-500"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Status {formData.frequency !== Frequency.NONE && <span className="text-xs text-slate-400 font-normal">(for this period)</span>}
                    </label>
                    <select
                      value={formData.status}
                      disabled={isSeriesEnded}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as TaskStatus }))}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      {Object.values(TaskStatus).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {isRecurring && task?.id && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700">Recurring Series</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {isSeriesEnded 
                            ? "This series is marked as completed." 
                            : "This task repeats regularly."}
                        </p>
                      </div>
                      {isSeriesEnded ? (
                        <button
                          type="button"
                          onClick={handleResumeSeries}
                          className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 shadow-sm rounded-md text-slate-700 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center gap-1.5"
                        >
                          <RefreshCw size={12} />
                          Resume Series
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleCompleteSeries}
                          className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 shadow-sm rounded-md text-slate-700 hover:text-green-600 hover:border-green-200 transition-all flex items-center gap-1.5"
                        >
                          <CheckCircle size={12} />
                          Complete Series
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Description</label>
                  <textarea
                    value={formData.description}
                    disabled={isSeriesEnded}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="Add details, links, or notes..."
                  />
                  <p className="text-xs text-slate-400">URLs starting with http/https will be clickable in read mode.</p>
                </div>
              </form>

              {/* Task Metadata */}
              {task?.id && (
                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <CalendarCheck size={12} />
                    <span>Created: {formatDateTimeReadable(task.createdAt)}</span>
                  </div>
                  {(task.recurrenceEndedAt || task.completedAt) && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <CheckCircle size={12} />
                      <span>Closed: {formatDateTimeReadable(task.recurrenceEndedAt || task.completedAt!)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'analytics' ? (
             <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                     <div className="flex items-center gap-2 text-indigo-600 mb-2">
                       <BarChart3 size={18} />
                       <span className="font-semibold text-sm">Completion Rate</span>
                     </div>
                     <div className="text-3xl font-bold text-slate-800">
                       {analytics?.completionRate}%
                     </div>
                     <div className="text-xs text-slate-500 mt-1">
                       {analytics?.completedCount} completed of {analytics?.totalTracked} tracked
                     </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                     <div className="flex items-center gap-2 text-slate-600 mb-2">
                       <History size={18} />
                       <span className="font-semibold text-sm">Total Occurrences</span>
                     </div>
                     <div className="text-3xl font-bold text-slate-800">
                       {analytics?.totalTracked}
                     </div>
                     <div className="text-xs text-slate-500 mt-1">
                       Active periods tracked
                     </div>
                  </div>
                </div>

                <div>
                   <h3 className="font-semibold text-slate-800 mb-3 text-sm">Recent Activity</h3>
                   <div className="space-y-2">
                      {analytics?.recentHistory.map((h, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg">
                           <span className="text-sm font-medium text-slate-600 font-mono">{h.period}</span>
                           <span className={cn(
                             "text-xs px-2 py-1 rounded-full font-medium border",
                             getStatusColor(h.status)
                           )}>
                             {h.status}
                           </span>
                        </div>
                      ))}
                      {(!analytics?.recentHistory || analytics.recentHistory.length === 0) && (
                        <div className="text-center py-6 text-slate-400 text-sm">
                          No activity recorded yet.
                        </div>
                      )}
                   </div>
                </div>
             </div>
          ) : (
            <div className="space-y-4">
              {task?.history?.slice().reverse().map((entry) => (
                <div key={entry.id} className="flex gap-4 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="mt-1">
                    <History size={16} className="text-slate-400" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">
                      Changed <span className="font-semibold text-slate-800">{entry.field}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 line-through decoration-red-400">
                        {entry.oldValue || 'Empty'}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100 font-medium">
                        {entry.newValue || 'Empty'}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      {formatDateTimeReadable(entry.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              {(!task?.history || task.history.length === 0) && (
                <div className="text-center py-8 text-slate-400">No history available</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'details' && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
            <button
              type="submit"
              form="task-form"
              className={cn(
                "flex items-center space-x-2 px-6 py-2.5 rounded-lg font-medium transition-all shadow-lg active:scale-95",
                isSeriesEnded 
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200"
              )}
              disabled={isSeriesEnded}
            >
              <Save size={18} />
              <span>Save Task</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};