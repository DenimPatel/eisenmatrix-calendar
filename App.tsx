import React, { useState, useEffect, useMemo } from 'react';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
  endOfDay, 
  endOfWeek, 
  endOfMonth, 
  endOfYear,
  eachDayOfInterval,
  isSameDay
} from 'date-fns';
import { LayoutGrid, Calendar as CalendarIcon, ListTodo } from 'lucide-react';
import { 
  Task, 
  ViewMode, 
  Urgency, 
  Importance, 
  QUADRANTS, 
  QuadrantId, 
  HistoryEntry,
  Frequency,
  TaskStatus
} from './types';
import { generateId, formatDate, cn, isTaskActiveOnDate, getTaskStatus, startOfWeek, parseLocalTaskDate } from './lib/utils';
import { CalendarControl } from './components/CalendarControl';
import { MatrixGrid } from './components/MatrixGrid';
import { CalendarView } from './components/CalendarView';
import { TaskListView } from './components/TaskListView';
import { TaskModal } from './components/TaskModal';
import { TaskCard } from './components/TaskCard';

const STORAGE_KEY = 'eisenmatrix-tasks';

type Tab = 'matrix' | 'calendar' | 'list';

export default function App() {
  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.WEEK);
  const [activeTab, setActiveTab] = useState<Tab>('matrix');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);
  const [selectedContextDate, setSelectedContextDate] = useState<Date | null>(null);

  // Initialize from storage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Sanitize loaded data to ensure history and frequency exist
          const sanitized = parsed.map((t: any) => ({
            ...t,
            history: Array.isArray(t.history) ? t.history : [],
            frequency: t.frequency || Frequency.NONE,
            completionHistory: t.completionHistory || {}
          }));
          setTasks(sanitized);
        }
      } catch (e) {
        console.error("Failed to parse tasks", e);
      }
    }
  }, []);

  // Save to storage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  // Filtering Logic
  const filteredTasks = useMemo(() => {
    // Determine the current view interval
    let interval: { start: Date; end: Date };

    switch (viewMode) {
      case ViewMode.DAY: {
        const start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        interval = { start, end: endOfDay(currentDate) };
        break;
      }
      case ViewMode.WEEK: {
        interval = { 
          start: startOfWeek(currentDate, { weekStartsOn: 1 }), 
          end: endOfWeek(currentDate, { weekStartsOn: 1 }) 
        };
        break;
      }
      case ViewMode.MONTH: {
        const start = new Date(currentDate);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        interval = { start, end: endOfMonth(currentDate) };
        break;
      }
      case ViewMode.YEAR: {
        const start = new Date(currentDate);
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        interval = { start, end: endOfYear(currentDate) };
        break;
      }
      default:
        // Fallback to today
        interval = { start: new Date(), end: new Date() };
    }

    return tasks.filter(task => {
      // HIERARCHY FILTERING: 
      // Daily tasks only show in Day view
      if (task.frequency === Frequency.DAILY && viewMode !== ViewMode.DAY) {
        return false;
      }
      
      // Weekly tasks only show in Day and Week views
      if (task.frequency === Frequency.WEEKLY && (viewMode === ViewMode.MONTH || viewMode === ViewMode.YEAR)) {
        return false;
      }

      // Monthly tasks only show in Day, Week, and Month views
      if (task.frequency === Frequency.MONTHLY && viewMode === ViewMode.YEAR) {
        return false;
      }

      // If task has no frequency, simple interval check
      if (!task.frequency || task.frequency === Frequency.NONE) {
        // Use helper to parse date strictly as local YYYY-MM-DD
        const taskDate = parseLocalTaskDate(task.date);
        
        return taskDate >= interval.start && 
               taskDate <= interval.end;
      }

      // Optimization for Year view (recurrence is very likely to fall in a year)
      if (viewMode === ViewMode.YEAR) {
        const [y, m, d] = task.date.split('-').map(Number);
        const taskStart = new Date(y, m - 1, d);
        return taskStart <= interval.end;
      }

      // For shorter intervals, check if task occurs on ANY day within the interval
      const days = eachDayOfInterval(interval);
      return days.some(day => isTaskActiveOnDate(task, day));
    }).map(task => ({
      ...task,
      // Inject the computed status for the CURRENT DATE CONTEXT into the task object
      // This ensures cards in Matrix and List view show status relative to the current view date
      status: getTaskStatus(task, currentDate)
    }));
  }, [tasks, currentDate, viewMode]);

  // Logic for List View: Show all tasks, but injected with status relative to current date context
  const allTasksWithStatus = useMemo(() => {
    return tasks.map(task => ({
      ...task,
      status: getTaskStatus(task, currentDate)
    }));
  }, [tasks, currentDate]);

  // CRUD Operations
  const handleSaveTask = (taskData: Partial<Task>) => {
    const timestamp = Date.now();
    
    if (editingTask && editingTask.id) {
      // Update existing
      const updatedTasks = tasks.map(t => {
        if (t.id === editingTask.id) {
          const changes: HistoryEntry[] = [];
          
          // Detect changes for history
          (Object.keys(taskData) as Array<keyof Task>).forEach(key => {
            if (key === 'history') return;
            const newValue = taskData[key];
            const oldValue = t[key];
            
            // Special handling for objects like completionHistory - only compare if reference changed or deep compare (omitted for simplicity)
            // For simple fields:
            if (key !== 'completionHistory' && newValue !== undefined && newValue !== oldValue) {
              changes.push({
                id: generateId(),
                timestamp,
                field: key.charAt(0).toUpperCase() + key.slice(1),
                oldValue: String(oldValue),
                newValue: String(newValue),
                user: 'User'
              });
            }
          });

          // Logic for completedAt on single tasks
          let newCompletedAt = t.completedAt;
          if (taskData.frequency === Frequency.NONE || (!taskData.frequency && t.frequency === Frequency.NONE)) {
            if (taskData.status === TaskStatus.DONE && t.status !== TaskStatus.DONE) {
              newCompletedAt = timestamp;
            } else if (taskData.status && taskData.status !== TaskStatus.DONE) {
              newCompletedAt = undefined;
            }
          }

          return {
            ...t,
            ...taskData,
            updatedAt: timestamp,
            completedAt: newCompletedAt,
            history: [...(t.history || []), ...changes]
          };
        }
        return t;
      });
      setTasks(updatedTasks);
    } else {
      // Create new
      const newTask: Task = {
        id: generateId(),
        title: taskData.title || 'Untitled Task',
        description: taskData.description || '',
        status: taskData.status || 'To Do',
        urgency: taskData.urgency || Urgency.LOW,
        importance: taskData.importance || Importance.LOW,
        frequency: taskData.frequency || Frequency.NONE,
        date: taskData.date || formatDate(currentDate),
        createdAt: timestamp,
        updatedAt: timestamp,
        history: [],
        completionHistory: taskData.completionHistory || {}
      } as Task;

      if (newTask.status === TaskStatus.DONE && newTask.frequency === Frequency.NONE) {
        newTask.completedAt = timestamp;
      }

      setTasks([...tasks, newTask]);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    setIsModalOpen(false);
  };

  const handleOpenModal = (task?: Task, date?: Date) => {
    setEditingTask(task || null);
    // If a specific date context was passed (e.g. from calendar cell), use it.
    // Otherwise fallback to null (TaskModal will default to currentDate)
    setSelectedContextDate(date || null);
    setIsModalOpen(true);
  };

  const handleAddTaskToQuadrant = (qid: QuadrantId) => {
    const q = QUADRANTS[qid];
    setEditingTask({
      urgency: q.urgency,
      importance: q.importance,
      frequency: Frequency.NONE,
      history: [],
      completionHistory: {}
    } as Task); 
    setSelectedContextDate(currentDate);
    setIsModalOpen(true);
  };

  const handleAddTaskGeneric = () => {
    setEditingTask({
      urgency: Urgency.LOW,
      importance: Importance.LOW,
      status: TaskStatus.TODO,
      frequency: Frequency.NONE,
      history: [],
      completionHistory: {}
    } as Task);
    setSelectedContextDate(currentDate);
    setIsModalOpen(true);
  };

  // Drag and Drop Logic
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragTask(event.active.data.current as Task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragTask(null);

    if (over && active.id !== over.id) {
      const taskId = active.id as string;
      const quadrantId = over.id as QuadrantId;
      const targetQuadrant = QUADRANTS[quadrantId];

      if (targetQuadrant) {
        setTasks(prevTasks => prevTasks.map(t => {
          if (t.id === taskId) {
            // Only update if changed
            if (t.urgency === targetQuadrant.urgency && t.importance === targetQuadrant.importance) {
              return t;
            }
            
            const historyEntry: HistoryEntry = {
              id: generateId(),
              timestamp: Date.now(),
              field: 'Matrix Position',
              oldValue: `${t.urgency} / ${t.importance}`,
              newValue: `${targetQuadrant.urgency} / ${targetQuadrant.importance}`,
              user: 'User'
            };

            return {
              ...t,
              urgency: targetQuadrant.urgency,
              importance: targetQuadrant.importance,
              history: [...(t.history || []), historyEntry],
              updatedAt: Date.now()
            };
          }
          return t;
        }));
      }
    }
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">EisenMatrix Calendar</h1>
          <p className="text-slate-500 mt-2">Prioritize your time by Urgency and Importance.</p>
        </header>

        <div className="mb-6 flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('matrix')}
            className={cn(
              "flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all",
              activeTab === 'matrix' 
                ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            <LayoutGrid size={18} />
            <span>Matrix View</span>
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={cn(
              "flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all",
              activeTab === 'calendar' 
                ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            <CalendarIcon size={18} />
            <span>Calendar View</span>
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={cn(
              "flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all",
              activeTab === 'list' 
                ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            <ListTodo size={18} />
            <span>Task View</span>
          </button>
        </div>

        {activeTab !== 'list' && (
          <CalendarControl 
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        )}

        {activeTab === 'matrix' ? (
          <DndContext 
            sensors={sensors} 
            onDragStart={handleDragStart} 
            onDragEnd={handleDragEnd}
          >
            <MatrixGrid 
              tasks={filteredTasks} 
              onTaskClick={handleOpenModal}
              onAddTask={handleAddTaskToQuadrant}
            />
            
            <DragOverlay dropAnimation={dropAnimation}>
              {activeDragTask ? <TaskCard task={activeDragTask} onClick={() => {}} /> : null}
            </DragOverlay>
          </DndContext>
        ) : activeTab === 'calendar' ? (
          <CalendarView 
            tasks={filteredTasks} // These are pre-processed to have correct status for 'currentDate'
            currentDate={currentDate}
            viewMode={viewMode}
            onTaskClick={handleOpenModal}
          />
        ) : (
          <TaskListView 
            tasks={allTasksWithStatus} // Use all tasks for list view
            onTaskClick={handleOpenModal}
            onAddTask={handleAddTaskGeneric}
          />
        )}

      </div>

      <TaskModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        task={editingTask}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        defaultDate={formatDate(currentDate)}
        contextDate={selectedContextDate || currentDate}
      />
    </div>
  );
}