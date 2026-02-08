import React, { useState } from 'react';
import { Task, TaskStatus } from '../types';
import { cn, getStatusColor } from '../lib/utils';
import { X, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface ImportResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    parsedTasks: Partial<Task>[];
    onMerge: (selectedTasks: Partial<Task>[]) => void;
    onReplace: (selectedTasks: Partial<Task>[]) => void;
}

export function ImportResolutionModal({
    isOpen,
    onClose,
    parsedTasks,
    onMerge,
    onReplace
}: ImportResolutionModalProps) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(
        new Set(parsedTasks.map((_, index) => index))
    );

    if (!isOpen) return null;

    const toggleTask = (index: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
        }
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (selectedIds.size === parsedTasks.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(parsedTasks.map((_, index) => index)));
        }
    };

    const getSelectedTasks = () => {
        return parsedTasks.filter((_, index) => selectedIds.has(index));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">

                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                            <FileSpreadsheet size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Import Tasks</h2>
                            <p className="text-sm text-slate-500">{parsedTasks.length} tasks found in CSV</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <button
                            onClick={toggleAll}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                        >
                            {selectedIds.size === parsedTasks.length ? 'Deselect All' : 'Select All'}
                        </button>
                        <span className="text-sm text-slate-500">
                            {selectedIds.size} of {parsedTasks.length} selected
                        </span>
                    </div>

                    <div className="space-y-3">
                        {parsedTasks.map((task, index) => (
                            <div
                                key={index}
                                onClick={() => toggleTask(index)}
                                className={cn(
                                    "p-4 rounded-xl border transition-all cursor-pointer flex items-center space-x-4",
                                    selectedIds.has(index)
                                        ? "border-indigo-200 bg-indigo-50/30"
                                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                                )}
                            >
                                <div className={cn(
                                    "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                    selectedIds.has(index) ? "bg-indigo-600 border-indigo-600" : "border-slate-300"
                                )}>
                                    {selectedIds.has(index) && <CheckCircle2 size={14} className="text-white" />}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2">
                                        <h4 className="font-semibold text-slate-900 truncate">{task.title || 'Untitled Task'}</h4>
                                        {task.status && (
                                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", getStatusColor(task.status))}>
                                                {task.status}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-3 mt-1">
                                        <span className="text-xs text-slate-500">{task.date}</span>
                                        <span className="text-[10px] text-slate-400">•</span>
                                        <span className="text-xs text-slate-500">{task.urgency} / {task.importance}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={() => onMerge(getSelectedTasks())}
                        disabled={selectedIds.size === 0}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        Merge Selected
                    </button>
                    <button
                        onClick={() => onReplace(getSelectedTasks())}
                        disabled={selectedIds.size === 0}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Replace All Existing
                    </button>
                </div>

                {selectedIds.size > 0 && (
                    <div className="px-6 pb-6 pt-0 bg-slate-50/50">
                        <div className="flex items-start space-x-2 p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-xs">
                            <AlertCircle size={14} className="mt-0.5 shrink-0" />
                            <p>
                                <strong>Replace All</strong> will permanently delete your current tasks and replace them with the {selectedIds.size} tasks you've selected.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
