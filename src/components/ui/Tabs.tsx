import React, { createContext, useContext, useId, useRef } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: React.ReactNode;
}

export interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  children?: React.ReactNode;
}

interface TabsContextValue {
  value: string;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function tabId(baseId: string, value: string): string {
  return `${baseId}-tab-${value}`;
}

function panelId(baseId: string, value: string): string {
  return `${baseId}-panel-${value}`;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  children,
}: TabsProps<T>) {
  const baseId = useId();
  const buttonRefs = useRef(new Map<T, HTMLButtonElement>());

  // A tab can disappear (e.g. the Analytics tab when a rule is removed) while it is the
  // active one; falling back to the first tab keeps exactly one tab reachable by Tab.
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.value === value),
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!tabs.length) return;
    let next = activeIndex;
    if (event.key === 'ArrowRight') next = (activeIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (activeIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    const target = tabs[next].value;
    onChange(target);
    buttonRefs.current.get(target)?.focus();
  };

  return (
    <>
      <div
        role="tablist"
        className={cn('flex gap-1 border-b border-border', className)}
        onKeyDown={onKeyDown}
      >
        {tabs.map((tab, index) => {
          const selected = value === tab.value;
          return (
            <button
              key={tab.value}
              ref={(el) => {
                if (el) buttonRefs.current.set(tab.value, el);
                else buttonRefs.current.delete(tab.value);
              }}
              type="button"
              role="tab"
              id={tabId(baseId, tab.value)}
              aria-selected={selected}
              aria-controls={selected ? panelId(baseId, tab.value) : undefined}
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => onChange(tab.value)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                selected
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-fg',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <TabsContext.Provider value={{ value, baseId }}>{children}</TabsContext.Provider>
    </>
  );
}

export interface TabPanelProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

/** Associates the rendered content with its tab via `role="tabpanel"` and matching ids. */
export function TabPanel({ value, className, children }: TabPanelProps) {
  const context = useContext(TabsContext);
  if (!context || context.value !== value) return null;
  return (
    <div
      role="tabpanel"
      id={panelId(context.baseId, value)}
      aria-labelledby={tabId(context.baseId, value)}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
