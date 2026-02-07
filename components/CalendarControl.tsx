import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, addDays, addWeeks, addMonths, addYears, endOfWeek } from 'date-fns';
import { ViewMode } from '../types';
import { cn, startOfWeek } from '../lib/utils';

interface CalendarControlProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const CalendarControl: React.FC<CalendarControlProps> = ({
  currentDate,
  onDateChange,
  viewMode,
  onViewModeChange
}) => {
  const handlePrev = () => {
    switch (viewMode) {
      case ViewMode.DAY: return onDateChange(addDays(currentDate, -1));
      case ViewMode.WEEK: return onDateChange(addWeeks(currentDate, -1));
      case ViewMode.MONTH: return onDateChange(addMonths(currentDate, -1));
      case ViewMode.YEAR: return onDateChange(addYears(currentDate, -1));
    }
  };

  const handleNext = () => {
    switch (viewMode) {
      case ViewMode.DAY: return onDateChange(addDays(currentDate, 1));
      case ViewMode.WEEK: return onDateChange(addWeeks(currentDate, 1));
      case ViewMode.MONTH: return onDateChange(addMonths(currentDate, 1));
      case ViewMode.YEAR: return onDateChange(addYears(currentDate, 1));
    }
  };

  const formatTitle = () => {
    switch (viewMode) {
      case ViewMode.DAY: return format(currentDate, 'MMMM d, yyyy');
      case ViewMode.WEEK: {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
      }
      case ViewMode.MONTH: return format(currentDate, 'MMMM yyyy');
      case ViewMode.YEAR: return format(currentDate, 'yyyy');
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 gap-4">
      <div className="flex items-center space-x-4">
        <div className="flex items-center bg-slate-100 rounded-lg p-1">
          <button onClick={handlePrev} className="p-2 hover:bg-white rounded-md transition-colors text-slate-600">
            <ChevronLeft size={20} />
          </button>
          <div className="px-4 font-semibold text-slate-800 min-w-[200px] text-center">
            {formatTitle()}
          </div>
          <button onClick={handleNext} className="p-2 hover:bg-white rounded-md transition-colors text-slate-600">
            <ChevronRight size={20} />
          </button>
        </div>
        <button 
          onClick={() => onDateChange(new Date())}
          className="text-sm font-medium text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          Today
        </button>
      </div>

      <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg">
        {Object.values(ViewMode).map((mode) => (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-all",
              viewMode === mode 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
};
