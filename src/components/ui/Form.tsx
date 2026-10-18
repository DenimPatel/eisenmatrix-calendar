import React, { useId } from 'react';
import { cn } from '@/lib/cn';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}

export function Select({ options, className, ...props }: SelectProps) {
  return (
    <select className={cn('input appearance-none pr-8', className)} {...props}>
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}

/** Tags a plain element can carry a native `<label for>` association for. */
const LABELABLE_TAGS = new Set(['input', 'select', 'textarea']);

/**
 * A single control can take the field's id. Custom controls (`Select`) forward their
 * props to the element they render, so they qualify too; layout wrappers do not.
 */
function isLabelableChild(node: React.ReactNode): node is React.ReactElement<{ id?: string }> {
  if (!React.isValidElement(node)) return false;
  if (typeof node.type === 'string') return LABELABLE_TAGS.has(node.type);
  return true;
}

export function Field({ label, hint, children, className, htmlFor }: FieldProps) {
  const autoId = useId();
  const controlId = htmlFor ?? autoId;
  const labelable = isLabelableChild(children);
  // Cloning the id onto the control turns the sibling label into its accessible name; a
  // wrapper child (a group of inputs) keeps the label presentational and names its own
  // controls, because one `for` cannot point at several inputs.
  const control = labelable
    ? React.cloneElement(children, { id: children.props.id ?? controlId })
    : children;
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={labelable ? controlId : htmlFor}
          className="block text-xs font-medium text-muted"
        >
          {label}
        </label>
      )}
      {control}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'h-4 w-4 cursor-pointer rounded border-border bg-surface text-accent accent-[rgb(var(--accent))] focus:ring-accent',
        className,
      )}
      {...props}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-border',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}
