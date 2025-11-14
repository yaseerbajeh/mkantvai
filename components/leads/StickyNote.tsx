'use client';

import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale/ar';
import { Pin } from 'lucide-react';

interface Comment {
  text: string;
  added_by: string;
  added_at: string;
}

interface StickyNoteProps {
  comment: Comment;
  index: number;
}

export default function StickyNote({ comment, index }: StickyNoteProps) {
  // Color variations for sticky notes
  const colors = [
    'bg-yellow-200 text-yellow-900 border-yellow-300',
    'bg-pink-200 text-pink-900 border-pink-300',
    'bg-blue-200 text-blue-900 border-blue-300',
    'bg-green-200 text-green-900 border-green-300',
    'bg-purple-200 text-purple-900 border-purple-300',
  ];
  
  const colorClass = colors[index % colors.length];
  
  // Calculate rotation angle (slight random rotation for natural look)
  const rotation = (index % 3 - 1) * 2; // -2, 0, or 2 degrees

  return (
    <div
      className={`relative ${colorClass} border-2 rounded-sm p-3 shadow-lg transform transition-transform hover:scale-105`}
      style={{
        transform: `rotate(${rotation}deg)`,
        maxWidth: '200px',
      }}
    >
      {/* Pin icon at top */}
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
        <Pin className="w-4 h-4 text-slate-600" fill="currentColor" />
      </div>
      
      {/* Comment text */}
      <p className="text-sm font-medium mb-2 mt-1 leading-relaxed">
        {comment.text}
      </p>
      
      {/* Author and timestamp */}
      <div className="text-xs opacity-75 border-t border-current pt-2 mt-2">
        <p className="font-semibold">{comment.added_by}</p>
        <p className="text-xs">
          {formatDistanceToNow(new Date(comment.added_at), { 
            addSuffix: true, 
            locale: ar 
          })}
        </p>
      </div>
    </div>
  );
}

