import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  ArrowUpDown, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Circle,
  ArrowUp,
  ArrowDown,
  Repeat
} from 'lucide-react';
import { Task, Urgency, Importance, TaskStatus, Frequency } from '../types';
import { cn, getStatusColor } from '../lib/utils';

interface TaskListViewProps {
  tasks: Task[];
  onTaskClick: (task: Task, date?: Date) => void;
  onAddTask: () => void;
}

export const TaskListView: React.FC<TaskListViewProps> = ({ tasks, onTaskClick, onAddTask }) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'All'>('All');
  const [filterUrgency, setFilterUrgency] = useState<Urgency | 'All'>('All');
  const [filterImportance, setFilterImportance] = useState<Importance | 'All'>('All');
  const [filterFrequency, setFilterFrequency] = useState<Frequency | 'All'>('All');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'priority'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredAndSortedTasks = useMemo(() => {
    return tasks
      .filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase()) || 
                              task.description.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = filterStatus === 'All' || task.status === filterStatus;
        const matchesUrgency = filterUrgency === 'All' || task.urgency === filterUrgency;
        const matchesImportance = filterImportance === 'All' || task.importance === filterImportance;
        const matchesFrequency = filterFrequency === 'All' || task.frequency === filterFrequency;
        
        return matchesSearch && matchesStatus && matchesUrgency && matchesImportance && matchesFrequency;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'date') {
            // Use string comparison for YYYY-MM-DD to avoid timezone conversion issues
            comparison = a.date.localeCompare(b.date);
        } else if (sortBy === 'title') {
            comparison = a.title.localeCompare(b.title);
        } else if (sortBy === 'priority') {
            // High/High = 4, Low/High = 3, High/Low = 2, Low/Low = 1
            const getScore = (t: Task) => {
                let score = 0;
                if (t.importance === Importance.HIGH) score += 2;
                if (t.urgency === Urgency.HIGH) score += 1;
                return score;
            }
            comparison = getScore(a) - getScore(b);
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [tasks, search, filterStatus, filterUrgency, filterImportance, filterFrequency, sortBy, sortOrder]);

  const toggleSort = (field: 'date' | 'title' | 'priority') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: 'date' | 'title' | 'priority' }) => {
    if (sortBy !== field) return <ArrowUpDown size={14} className="text-slate-400 ml-1" />;
    return sortOrder === 'asc' 
      ? <ArrowUp size={14} className="text-indigo-600 ml-1" />
      : <ArrowDown size={14} className="text-indigo-600 ml-1" />;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-200px)] min-h-[600px]">
      {/* Filters Toolbar */}
      <div className="p-4 border-b border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button 
            onClick={onAddTask}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={18} />
            <span>Add Task</span>
          </button>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 text-sm text-slate-600 mr-2">
            <Filter size={16} />
            <span className="font-medium">Filters:</span>
          </div>
          
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-1.5 rounded-md border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="All">All Statuses</option>
            {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select 
            value={filterUrgency}
            onChange={(e) => setFilterUrgency(e.target.value as any)}
            className="px-3 py-1.5 rounded-md border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="All">All Urgency</option>
            {Object.values(Urgency).map(u => <option key={u} value={u}>{u} Urgency</option>)}
          </select>

          <select 
            value={filterImportance}
            onChange={(e) => setFilterImportance(e.target.value as any)}
            className="px-3 py-1.5 rounded-md border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="All">All Importance</option>
            {Object.values(Importance).map(i => <option key={i} value={i}>{i} Importance</option>)}
          </select>

          <select 
            value={filterFrequency}
            onChange={(e) => setFilterFrequency(e.target.value as any)}
            className="px-3 py-1.5 rounded-md border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="All">All Frequencies</option>
            {Object.values(Frequency).map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          
          <div className="ml-auto text-sm text-slate-500">
            Showing {filteredAndSortedTasks.length} tasks
          </div>
        </div>
      </div>

      {/* Tasks Table Header */}
      <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:grid">
        <div className="col-span-4 flex items-center cursor-pointer hover:text-slate-800" onClick={() => toggleSort('title')}>
          Task <SortIcon field="title" />
        </div>
        <div className="col-span-2">Frequency</div>
        <div className="col-span-2 flex items-center cursor-pointer hover:text-slate-800" onClick={() => toggleSort('priority')}>
          Priority <SortIcon field="priority" />
        </div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2 flex items-center cursor-pointer hover:text-slate-800" onClick={() => toggleSort('date')}>
          Date <SortIcon field="date" />
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto">
        {filteredAndSortedTasks.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredAndSortedTasks.map(task => (
              <div 
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 md:px-6 py-4 hover:bg-slate-50 cursor-pointer transition-colors group items-start md:items-center"
              >
                <div className="col-span-1 md:col-span-4">
                  <div className={cn("font-medium text-slate-900 group-hover:text-indigo-700 transition-colors", task.status === TaskStatus.DONE && "line-through text-slate-400")}>
                    {task.title}
                  </div>
                  {task.description && (
                    <div className="text-xs text-slate-500 truncate mt-0.5 max-w-[90%] hidden md:block">
                      {task.description}
                    </div>
                  )}
                </div>

                <div className="col-span-1 md:col-span-2 flex items-center mt-1 md:mt-0">
                   <span className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border",
                      task.frequency !== Frequency.NONE ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-slate-50 text-slate-500 border-slate-100"
                    )}>
                      {task.frequency !== Frequency.NONE && <Repeat size={12} />}
                      {task.frequency}
                   </span>
                </div>
                
                <div className="col-span-1 md:col-span-2 flex flex-row md:flex-col gap-2 md:gap-1 mt-1 md:mt-0">
                  <span className={cn(
                    "inline-flex w-fit px-2 py-0.5 rounded text-[10px] font-medium border",
                    task.urgency === Urgency.HIGH ? "bg-red-50 text-red-700 border-red-100" : "bg-blue-50 text-blue-700 border-blue-100"
                  )}>
                    {task.urgency === Urgency.HIGH ? 'Urgent' : 'Not Urgent'}
                  </span>
                  <span className={cn(
                    "inline-flex w-fit px-2 py-0.5 rounded text-[10px] font-medium border",
                    task.importance === Importance.HIGH ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-slate-50 text-slate-600 border-slate-100"
                  )}>
                    {task.importance === Importance.HIGH ? 'Important' : 'Not Important'}
                  </span>
                </div>
                
                <div className="col-span-1 md:col-span-2 mt-1 md:mt-0">
                   <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                      getStatusColor(task.status)
                    )}>
                      {task.status === TaskStatus.DONE && <CheckCircle2 size={12} />}
                      {task.status === TaskStatus.IN_PROGRESS && <Clock size={12} />}
                      {task.status === TaskStatus.TODO && <Circle size={12} />}
                      {task.status}
                   </span>
                </div>
                
                <div className="col-span-1 md:col-span-2 flex items-center gap-2 text-sm text-slate-600 mt-1 md:mt-0">
                  <Calendar size={14} className="text-slate-400" />
                  {task.date}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
             <div className="bg-slate-50 p-4 rounded-full mb-3">
                <Search size={24} className="text-slate-300" />
             </div>
             <p>No tasks found matching your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};