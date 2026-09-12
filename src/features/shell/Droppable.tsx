import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/cn';
import type { DropData } from './dnd';

export interface DroppableProps {
  id: string;
  data: DropData;
  className?: string;
  activeClassName?: string;
  children: React.ReactNode | ((isOver: boolean) => React.ReactNode);
}

export function Droppable({ id, data, className, activeClassName, children }: DroppableProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && activeClassName)}>
      {typeof children === 'function' ? children(isOver) : children}
    </div>
  );
}
