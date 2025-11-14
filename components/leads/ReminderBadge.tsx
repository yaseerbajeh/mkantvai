'use client';

import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { ar } from 'date-fns/locale/ar';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ReminderBadgeProps {
  reminderDate: string;
  onClick?: () => void;
}

export default function ReminderBadge({ reminderDate, onClick }: ReminderBadgeProps) {
  if (!reminderDate) return null;

  const date = new Date(reminderDate);
  const isOverdue = isPast(date) && !isToday(date);
  const isTodayReminder = isToday(date);
  const isTomorrowReminder = isTomorrow(date);

  // Determine color based on urgency
  let colorClass = 'bg-blue-900/50 text-blue-400 border-blue-700';
  let icon = <Calendar className="h-3 w-3" />;
  
  if (isOverdue) {
    colorClass = 'bg-red-900/50 text-red-400 border-red-700';
    icon = <AlertCircle className="h-3 w-3" />;
  } else if (isTodayReminder) {
    colorClass = 'bg-orange-900/50 text-orange-400 border-orange-700';
    icon = <Clock className="h-3 w-3" />;
  } else if (isTomorrowReminder) {
    colorClass = 'bg-yellow-900/50 text-yellow-400 border-yellow-700';
    icon = <Clock className="h-3 w-3" />;
  }

  const displayText = isOverdue
    ? `متأخر: ${format(date, 'dd/MM/yyyy', { locale: ar })}`
    : isTodayReminder
    ? 'اليوم'
    : isTomorrowReminder
    ? 'غداً'
    : format(date, 'dd/MM/yyyy', { locale: ar });

  return (
    <Badge
      className={`${colorClass} cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 text-xs`}
      onClick={onClick}
    >
      {icon}
      {displayText}
    </Badge>
  );
}

