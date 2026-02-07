import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Clock, AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import { Task, TaskStatus } from '../types';
import { cn, getStatusColor } from '../lib/utils';

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: task
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const StatusIcon = {
    [TaskStatus.TODO]: Circle,
    [TaskStatus.IN_PROGRESS]: Clock,
    [TaskStatus.DONE]: CheckCircle2,
  }[task.status];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative p-3 mb-3 bg-white rounded-lg border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all",
        isDragging ? "opacity-50 z-50 rotate-3 scale-105" : "opacity-100",
        task.status === TaskStatus.DONE ? "border-slate-100 bg-slate-50" : "border-slate-200"
      )}
    >
      <div 
        onClick={(e) => {
          // Prevent click when dragging
          if (!isDragging) {
            e.stopPropagation();
            onClick(task);
          }
        }}
        className="block"
      >
        <div className="flex justify-between items-start mb-2">
          <h4 className={cn(
            "text-sm font-semibold text-slate-800 line-clamp-2",
            task.status === TaskStatus.DONE && "line-through text-slate-400"
          )}>
            {task.title}
          </h4>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <span className={cn(
            "text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium border",
            getStatusColor(task.status)
          )}>
            <StatusIcon size={10} />
            {task.status}
          </span>
          <span className="text-xs text-slate-400">
            {(task.history?.length || 0) > 0 ? `${task.history.length} updates` : 'New'}
          </span>
        </div>
      </div>
    </div>
  );
};