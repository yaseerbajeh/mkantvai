'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type ProgressOwnProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number | null;
  max?: number;
  getValueLabel?: (value: number, max: number) => string;
};

const Progress = React.forwardRef<HTMLDivElement, ProgressOwnProps>(
  ({ className, value = null, max = 100, getValueLabel, ...props }, ref) => {
    const numericMax = Number(max);
    const sanitizedMax =
      Number.isFinite(numericMax) && numericMax > 0 ? numericMax : 100;

    const numericValue = typeof value === 'number' ? value : Number(value);
    const sanitizedValue =
      Number.isFinite(numericValue) && numericValue >= 0
        ? Math.min(numericValue, sanitizedMax)
        : null;

    const percentage =
      typeof sanitizedValue === 'number' && sanitizedMax > 0
        ? Math.min(100, Math.max(0, (sanitizedValue / sanitizedMax) * 100))
        : 0;

    const ariaValueText =
      typeof sanitizedValue === 'number' && typeof getValueLabel === 'function'
        ? getValueLabel(sanitizedValue, sanitizedMax)
        : undefined;

    const state =
      sanitizedValue === null
        ? 'indeterminate'
        : sanitizedValue >= sanitizedMax
          ? 'complete'
          : 'loading';

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={sanitizedMax}
        aria-valuenow={typeof sanitizedValue === 'number' ? sanitizedValue : undefined}
        aria-valuetext={ariaValueText}
        data-state={state}
        data-value={sanitizedValue ?? undefined}
        data-max={sanitizedMax}
        className={cn(
          'relative h-4 w-full overflow-hidden rounded-full bg-secondary',
          className
        )}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-primary transition-all"
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </div>
    );
  }
);

Progress.displayName = 'Progress';

export { Progress };
