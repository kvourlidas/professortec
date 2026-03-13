import { CalendarDays, Clock, Repeat } from 'lucide-react';
import type { PackageType } from './types';

export function TypeIcon({ type, className }: { type: PackageType; className?: string }) {
  if (type === 'hourly')  return <Clock className={className} />;
  if (type === 'monthly') return <CalendarDays className={className} />;
  return <Repeat className={className} />;
}
