import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Task, QUADRANTS, QuadrantId } from '../types';
import { TaskCard } from './TaskCard';
import { cn } from '../lib/utils';
import { Plus } from 'lucide-react';

interface MatrixGridProps {
  tasks: Task[];
  onTaskClick: (task: Task, date?: Date) => void;
  onAddTask: (quadrantId: QuadrantId) => void;
}

const Quadrant: React.FC<{
  id: QuadrantId;
  title: string;
  tasks: Task[];
  onTaskClick: (task: Task, date?: Date) => void;
  color: string;
  onAdd: () => void;
}> = ({ id, title, tasks, onTaskClick, color, onAdd }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: id
  });

  const getHeaderColor = () => {
    switch (color) {
      case 'red': return 'bg-red-50 text-red-700 border-red-200';
      case 'blue': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'yellow': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'gray': return 'bg-slate-50 text-slate-700 border-slate-200';
      default: return 'bg-slate-50';
    }
  };

  const getContainerColor = () => {
     switch (color) {
      case 'red': return isOver ? 'bg-red-50/50 ring-2 ring-red-200' : 'bg-white';
      case 'blue': return isOver ? 'bg-sky-50/50 ring-2 ring-sky-200' : 'bg-white';
      case 'yellow': return isOver ? 'bg-amber-50/50 ring-2 ring-amber-200' : 'bg-white';
      case 'gray': return isOver ? 'bg-slate-50/50 ring-2 ring-slate-200' : 'bg-white';
      default: return 'bg-white';
    }
  }

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "flex flex-col h-full rounded-xl border transition-all duration-200",
        getContainerColor(),
        "border-slate-200"
      )}
    >
      <div className={cn(
        "p-3 rounded-t-xl border-b flex justify-between items-center",
        getHeaderColor()
      )}>
        <h3 className="font-semibold text-sm uppercase tracking-wide">{title}</h3>
        <span className="text-xs font-bold px-2 py-0.5 bg-white/50 rounded-full">
          {tasks.length}
        </span>
      </div>
      
      <div className="flex-1 p-3 overflow-y-auto min-h-[200px]">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} onClick={(t) => onTaskClick(t)} />
        ))}
        {tasks.length === 0 && !isOver && (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 text-sm italic">
            <p>Drop tasks here</p>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-100">
        <button
          onClick={onAdd}
          className="w-full py-2 flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg border border-dashed border-slate-300 hover:border-indigo-300 transition-all"
        >
          <Plus size={16} />
          Add Task
        </button>
      </div>
    </div>
  );
};

export const MatrixGrid: React.FC<MatrixGridProps> = ({ tasks, onTaskClick, onAddTask }) => {
  const getTasksForQuadrant = (qid: QuadrantId) => {
    const q = QUADRANTS[qid];
    return tasks.filter(t => t.urgency === q.urgency && t.importance === q.importance);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[calc(100vh-200px)] min-h-[600px]">
      {/* Q1: Urgent & Important */}
      <Quadrant 
        id="q1" 
        title={QUADRANTS.q1.title} 
        color={QUADRANTS.q1.color}
        tasks={getTasksForQuadrant('q1')} 
        onTaskClick={onTaskClick}
        onAdd={() => onAddTask('q1')}
      />
      
      {/* Q2: Not Urgent & Important */}
      <Quadrant 
        id="q2" 
        title={QUADRANTS.q2.title} 
        color={QUADRANTS.q2.color}
        tasks={getTasksForQuadrant('q2')} 
        onTaskClick={onTaskClick}
        onAdd={() => onAddTask('q2')}
      />
      
      {/* Q3: Urgent & Not Important */}
      <Quadrant 
        id="q3" 
        title={QUADRANTS.q3.title} 
        color={QUADRANTS.q3.color}
        tasks={getTasksForQuadrant('q3')} 
        onTaskClick={onTaskClick}
        onAdd={() => onAddTask('q3')}
      />
      
      {/* Q4: Not Urgent & Not Important */}
      <Quadrant 
        id="q4" 
        title={QUADRANTS.q4.title} 
        color={QUADRANTS.q4.color}
        tasks={getTasksForQuadrant('q4')} 
        onTaskClick={onTaskClick}
        onAdd={() => onAddTask('q4')}
      />
    </div>
  );
};