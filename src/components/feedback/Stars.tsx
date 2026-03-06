import { Star } from 'lucide-react';
import { clampRating } from './utils';

interface StarsProps {
  value: number;
  size?: 'sm' | 'lg';
}

export function Stars({ value, size = 'sm' }: StarsProps) {
  const rating = clampRating(value);
  const cls = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${cls} ${i < rating ? '' : 'text-slate-600'}`}
          style={i < rating ? { color: 'var(--color-accent)' } : {}}
          fill={i < rating ? 'currentColor' : 'none'} />
      ))}
    </div>
  );
}
