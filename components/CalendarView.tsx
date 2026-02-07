import React, { useMemo } from 'react';
import { 
  format, 
  endOfWeek, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  endOfYear,
  eachMonthOfInterval
} from 'date-fns';
import { Task, ViewMode, TaskStatus, Frequency } from '../types';
import { cn, getStatusColor, isTaskActiveOnDate, getTaskStatus, startOfWeek, startOfMonth, startOfYear } from '../lib/utils';
import { Clock, CheckCircle2, Circle, Repeat } from 'lucide-react';

interface CalendarViewProps {
  tasks: Task[];
  currentDate: Date;
  viewMode: ViewMode;
  onTaskClick: (task: Task, date?: Date) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ 
  tasks, 
  currentDate, 
  viewMode, 
  onTaskClick 
}) => {
  
  const calendarDays = useMemo(() => {
    switch (viewMode) {
      case ViewMode.MONTH: {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
        return eachDayOfInterval({ start: startDate, end: endDate });
      }
      case ViewMode.WEEK: {
        const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
        const endDate = endOfWeek(currentDate, { weekStartsOn: 1 });
        return eachDayOfInterval({ start: startDate, end: endDate });
      }
      case ViewMode.DAY: {
        return [currentDate];
      }
      default:
        return [];
    }
  }, [currentDate, viewMode]);

  const getTasksForDate = (date: Date) => {
    // We map the tasks here to ensure the status displayed corresponds to the specific calendar day 'date',
    // not just the 'currentDate' selected in the global control.
    // The 'tasks' prop passed from App already has status injected for 'currentDate', 
    // but for the calendar grid, each cell needs its own context.
    return tasks
      .filter(task => isTaskActiveOnDate(task, date))
      .map(task => ({
        ...task,
        status: getTaskStatus(task, date)
      }));
  };

  const StatusIcon = ({ status }: { status: TaskStatus }) => {
    switch (status) {
      case TaskStatus.DONE: return <CheckCircle2 size={12} />;
      case TaskStatus.IN_PROGRESS: return <Clock size={12} />;
      default: return <Circle size={12} />;
    }
  };

  // Year View Implementation
  if (viewMode === ViewMode.YEAR) {
    const months = eachMonthOfInterval({
      start: startOfYear(currentDate),
      end: endOfYear(currentDate)
    });

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 h-[calc(100vh-200px)] overflow-y-auto p-1">
        {months.map(month => {
          const monthTasks = tasks.filter(t => {
             // Logic for Year view summary...
             if (t.frequency === Frequency.NONE) {
               const [y, m] = t.date.split('-').map(Number);
               return m - 1 === month.getMonth() && y === month.getFullYear();
             }
             // For recurring, just check if it's active in the month
             const checkDates = [
               new Date(month.getFullYear(), month.getMonth(), 1),
               new Date(month.getFullYear(), month.getMonth(), 28)
             ];
             return checkDates.some(d => isTaskActiveOnDate(t, d));
          }).map(t => ({
             ...t,
             status: getTaskStatus(t, new Date(month.getFullYear(), month.getMonth(), 1)) // Approximate status for month start
          }));
          
          return (
            <div key={month.toString()} className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-slate-800 mb-2">{format(month, 'MMMM')}</h3>
              <div className="space-y-1">
                {monthTasks.slice(0, 5).map(task => (
                  <button
                    key={task.id}
                    onClick={() => onTaskClick(task, new Date(month.getFullYear(), month.getMonth(), 1))} // Best guess for date context in year view
                    className="w-full text-left text-xs truncate px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 flex items-center gap-2"
                  >
                    <StatusIcon status={task.status} />
                    <span className={task.status === TaskStatus.DONE ? "line-through text-slate-400" : ""}>
                      {task.title}
                    </span>
                    {task.frequency !== Frequency.NONE && <Repeat size={10} className="text-slate-400" />}
                  </button>
                ))}
                {monthTasks.length > 5 && (
                  <div className="text-xs text-slate-400 pl-2">
                    + {monthTasks.length - 5} more
                  </div>
                )}
                {monthTasks.length === 0 && (
                  <div className="text-xs text-slate-300 italic">No tasks</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Day View Implementation
  if (viewMode === ViewMode.DAY) {
    const date = calendarDays[0];
    const dayTasks = getTasksForDate(date);
    
    return (
      <div className="bg-white rounded-xl border border-slate-200 min-h-[500px] p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">{format(date, 'EEEE, MMMM do')}</h2>
        <div className="space-y-3">
          {dayTasks.map(task => (
            <div 
              key={task.id}
              onClick={() => onTaskClick(task, date)}
              className={cn(
                "p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md flex items-center gap-4",
                task.status === TaskStatus.DONE ? "bg-slate-50 border-slate-100" : "bg-white border-slate-200"
              )}
            >
              <div className={cn("p-2 rounded-full", getStatusColor(task.status))}>
                <StatusIcon status={task.status} />
              </div>
              <div className="flex-1">
                <h4 className={cn("font-medium flex items-center gap-2", task.status === TaskStatus.DONE && "line-through text-slate-400")}>
                  {task.title}
                  {task.frequency !== Frequency.NONE && (
                    <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Repeat size={10} /> {task.frequency}
                    </span>
                  )}
                </h4>
                {task.description && <p className="text-sm text-slate-500 truncate mt-1">{task.description}</p>}
              </div>
              <div className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600">
                {task.urgency} / {task.importance}
              </div>
            </div>
          ))}
          {dayTasks.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              No tasks scheduled for today
            </div>
          )}
        </div>
      </div>
    );
  }

  // Month & Week View Implementation
  const isMonth = viewMode === ViewMode.MONTH;
  const gridCols = isMonth ? "grid-cols-7" : "grid-cols-7"; // Both use 7 columns
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-200px)] min-h-[600px]">
      {/* Header Days */}
      <div className={`grid ${gridCols} border-b border-slate-200`}>
        {dayNames.map(day => (
          <div key={day} className="py-3 text-center text-sm font-semibold text-slate-600 bg-slate-50">
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className={`grid ${gridCols} flex-1 overflow-y-auto`}>
        {calendarDays.map((date, i) => {
          const dayTasks = getTasksForDate(date);
          const isCurrentMonth = isSameMonth(date, currentDate);
          const isTodayDate = isToday(date);
          
          return (
            <div 
              key={date.toString()} 
              className={cn(
                "min-h-[100px] p-2 border-b border-r border-slate-100 transition-colors hover:bg-slate-50/50 flex flex-col gap-1",
                !isCurrentMonth && isMonth && "bg-slate-50/30 text-slate-400",
                isTodayDate && "bg-indigo-50/30"
              )}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={cn(
                  "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                  isTodayDate ? "bg-indigo-600 text-white" : "text-slate-700"
                )}>
                  {format(date, 'd')}
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  {dayTasks.length > 0 && dayTasks.length}
                </span>
              </div>
              
              <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                {dayTasks.map(task => (
                  <button
                    key={task.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskClick(task, date); 
                    }}
                    className={cn(
                      "text-left text-xs px-1.5 py-1 rounded truncate flex items-center gap-1.5 group border",
                      task.status === TaskStatus.DONE 
                        ? "bg-slate-100 text-slate-400 border-transparent" 
                        : "bg-white border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md"
                    )}
                    title={task.title}
                  >
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0", 
                      task.urgency === 'High' ? 'bg-red-500' : 'bg-blue-500'
                    )} />
                    <span className={cn("truncate", task.status === TaskStatus.DONE && "line-through")}>
                      {task.title}
                    </span>
                    {task.frequency !== Frequency.NONE && <Repeat size={8} className="text-slate-400 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};