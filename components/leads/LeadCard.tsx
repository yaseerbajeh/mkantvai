'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale/ar';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import StickyNote from './StickyNote';
import ReminderBadge from './ReminderBadge';
import {
  Mail,
  MessageCircle,
  MessageSquare,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  AlertCircle,
  X,
  Flame,
  Phone,
} from 'lucide-react';

interface Product {
  id?: string;
  product_code?: string;
  product_name: string;
  price: number;
  quantity: number;
}

interface Comment {
  text: string;
  added_by: string;
  added_at: string;
}

interface Lead {
  id: string;
  source: 'abandoned_cart' | 'whatsapp' | 'manual';
  name: string;
  email?: string;
  whatsapp?: string;
  products: Product[];
  total_amount: number;
  comments: Comment[];
  status: 'new' | 'contacted' | 'converted' | 'lost' | 'non_converted';
  importance?: 'low' | 'medium' | 'high' | 'urgent';
  reminder_date?: string;
  created_at: string;
  updated_at: string;
}

interface LeadCardProps {
  lead: Lead;
  onUpdate: () => void;
  onDelete: (id: string) => void;
  onAddComment: (id: string, comment: string) => Promise<void>;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
  onUpdateImportance: (id: string, importance: string) => Promise<void>;
  onUpdateReminder: (id: string, reminderDate: string | null) => Promise<void>;
}

const importanceColors = {
  low: 'bg-slate-600 text-slate-200',
  medium: 'bg-blue-600 text-blue-200',
  high: 'bg-orange-600 text-orange-200',
  urgent: 'bg-red-600 text-red-200',
};

const importanceLabels = {
  low: 'منخفض',
  medium: 'متوسط',
  high: 'عالي',
  urgent: 'عاجل',
};

const sourceColors = {
  abandoned_cart: 'bg-orange-900/50 text-orange-400 border-orange-700',
  whatsapp: 'bg-green-900/50 text-green-400 border-green-700',
  manual: 'bg-purple-900/50 text-purple-400 border-purple-700',
};

const sourceLabels = {
  abandoned_cart: 'سلة متروكة',
  whatsapp: 'واتساب',
  manual: 'يدوي',
};

export default function LeadCard({
  lead,
  onUpdate,
  onDelete,
  onAddComment,
  onUpdateStatus,
  onUpdateImportance,
  onUpdateReminder,
}: LeadCardProps) {
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingImportance, setUpdatingImportance] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderDate, setReminderDate] = useState(() => {
    if (lead.reminder_date) {
      // Convert ISO string to datetime-local format
      const date = new Date(lead.reminder_date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    return '';
  });

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    
    setAddingComment(true);
    try {
      await onAddComment(lead.id, commentText);
      setCommentText('');
      setCommentDialogOpen(false);
    } finally {
      setAddingComment(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`هل أنت متأكد من تغيير الحالة إلى "${newStatus}"؟`)) {
      return;
    }
    
    setUpdatingStatus(true);
    try {
      await onUpdateStatus(lead.id, newStatus);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleImportanceChange = async (newImportance: string) => {
    setUpdatingImportance(true);
    try {
      await onUpdateImportance(lead.id, newImportance);
    } finally {
      setUpdatingImportance(false);
    }
  };

  const handleSetReminder = async () => {
    const dateToSend = reminderDate ? new Date(reminderDate).toISOString() : null;
    await onUpdateReminder(lead.id, dateToSend);
    setReminderDialogOpen(false);
  };

  const getWhatsAppLink = () => {
    if (!lead.whatsapp) return '#';
    const phone = lead.whatsapp.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(`مرحباً ${lead.name}`);
    return `https://wa.me/${phone}?text=${message}`;
  };

  const getEmailLink = () => {
    if (!lead.email) return '#';
    const subject = encodeURIComponent(`استفسار عن الطلب`);
    return `mailto:${lead.email}?subject=${subject}`;
  };

  // Check if lead is fresh (new status, WhatsApp/abandoned_cart source, within 24 hours)
  const isFreshLead = () => {
    if (lead.status !== 'new') return false;
    if (lead.source !== 'whatsapp' && lead.source !== 'abandoned_cart') return false;
    const createdDate = new Date(lead.created_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 24;
  };

  const handleContacted = async () => {
    setUpdatingStatus(true);
    try {
      await onUpdateStatus(lead.id, 'contacted');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <>
      <Card className="relative bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-bold text-white truncate">{lead.name}</h3>
                {isFreshLead() && (
                  <Badge className="bg-orange-600 text-white border-orange-500 flex items-center gap-1 animate-pulse" title="عميل جديد - أقل من 24 ساعة">
                    <Flame className="h-3 w-3" />
                    جديد
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Badge className={sourceColors[lead.source]}>
                  {sourceLabels[lead.source]}
                </Badge>
                {lead.importance && (
                  <Badge className={importanceColors[lead.importance]}>
                    {importanceLabels[lead.importance]}
                  </Badge>
                )}
                {lead.status === 'converted' && (
                  <Badge className="bg-green-900/50 text-green-400 border-green-700">
                    محول
                  </Badge>
                )}
                {lead.status === 'non_converted' && (
                  <Badge className="bg-red-900/50 text-red-400 border-red-700">
                    غير محول
                  </Badge>
                )}
              </div>
            </div>
            <Select
              value={lead.importance || 'medium'}
              onValueChange={handleImportanceChange}
              disabled={updatingImportance}
            >
              <SelectTrigger className="w-24 h-7 text-xs bg-slate-900 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="low" className="text-white focus:bg-slate-700">منخفض</SelectItem>
                <SelectItem value="medium" className="text-white focus:bg-slate-700">متوسط</SelectItem>
                <SelectItem value="high" className="text-white focus:bg-slate-700">عالي</SelectItem>
                <SelectItem value="urgent" className="text-white focus:bg-slate-700">عاجل</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-3">
          {/* Contact Info */}
          <div className="space-y-1.5">
            {lead.email && (
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Mail className="h-4 w-4 text-slate-400" />
                <span className="truncate">{lead.email}</span>
              </div>
            )}
            {lead.whatsapp && (
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <MessageCircle className="h-4 w-4 text-slate-400" />
                <span>{lead.whatsapp}</span>
              </div>
            )}
          </div>

          {/* Products */}
          {lead.products.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-semibold">المنتجات:</p>
              {lead.products.map((product, idx) => (
                <div key={idx} className="text-xs text-slate-300 bg-slate-900/50 p-2 rounded">
                  • {product.product_name} {product.quantity > 1 && `(x${product.quantity})`}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">لا توجد منتجات</p>
          )}

          {/* Total Amount */}
          <div className="text-lg font-bold text-white">
            {lead.total_amount ? `${lead.total_amount.toLocaleString()} ريال` : '0 ريال'}
          </div>

          {/* Reminder Badge */}
          {lead.reminder_date && (
            <div onClick={() => setReminderDialogOpen(true)}>
              <ReminderBadge reminderDate={lead.reminder_date} />
            </div>
          )}

          {/* Sticky Notes for Comments */}
          {lead.comments && lead.comments.length > 0 && (
            <div className="relative min-h-[100px] p-2 bg-slate-900/30 rounded">
              <div className="flex flex-wrap gap-2">
                {lead.comments.slice(-3).map((comment, idx) => (
                  <StickyNote key={idx} comment={comment} index={idx} />
                ))}
                {lead.comments.length > 3 && (
                  <div className="text-xs text-slate-400 self-end">
                    +{lead.comments.length - 3} أكثر
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Time */}
          <p className="text-xs text-slate-500">
            منذ {formatDistanceToNow(new Date(lead.created_at), { addSuffix: false, locale: ar })}
          </p>
        </CardContent>

        <CardFooter className="flex flex-wrap gap-2 pt-3 border-t border-slate-700">
          {/* Contact Buttons */}
          {lead.whatsapp && (
            <Button
              size="sm"
              variant="outline"
              className="bg-green-600 hover:bg-green-700 text-white border-green-700 h-8 text-xs flex-1"
              onClick={() => window.open(getWhatsAppLink(), '_blank')}
            >
              <MessageCircle className="h-3 w-3 ml-1" />
              واتساب
            </Button>
          )}
          {lead.email && (
            <Button
              size="sm"
              variant="outline"
              className="bg-blue-600 hover:bg-blue-700 text-white border-blue-700 h-8 text-xs flex-1"
              onClick={() => window.location.href = getEmailLink()}
            >
              <Mail className="h-3 w-3 ml-1" />
              بريد
            </Button>
          )}

          {/* Action Buttons */}
          {lead.status === 'new' && (
            <Button
              size="sm"
              variant="outline"
              className="bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700 h-8 text-xs"
              onClick={handleContacted}
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Phone className="h-3 w-3 ml-1" />
                  تم الاتصال
                </>
              )}
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            className="bg-purple-600 hover:bg-purple-700 text-white border-purple-700 h-8 text-xs"
            onClick={() => setCommentDialogOpen(true)}
          >
            <MessageSquare className="h-3 w-3 ml-1" />
            تعليق
          </Button>

          {!lead.reminder_date && (
            <Button
              size="sm"
              variant="outline"
              className="bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-700 h-8 text-xs"
              onClick={() => setReminderDialogOpen(true)}
            >
              <Calendar className="h-3 w-3 ml-1" />
            </Button>
          )}

          {lead.status !== 'converted' && (
            <Button
              size="sm"
              variant="outline"
              className="bg-green-600 hover:bg-green-700 text-white border-green-700 h-8 text-xs"
              onClick={() => handleStatusChange('converted')}
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3 ml-1" />
              )}
            </Button>
          )}

          {lead.status !== 'non_converted' && (
            <Button
              size="sm"
              variant="outline"
              className="bg-red-600 hover:bg-red-700 text-white border-red-700 h-8 text-xs"
              onClick={() => handleStatusChange('non_converted')}
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <XCircle className="h-3 w-3 ml-1" />
              )}
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            className="bg-red-600 hover:bg-red-700 text-white border-red-700 h-8 text-xs"
            onClick={() => onDelete(lead.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </CardFooter>
      </Card>

      {/* Comment Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">إضافة تعليق</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="اكتب تعليقك هنا..."
              className="bg-slate-900 border-slate-700 text-white min-h-[100px]"
            />
            {lead.comments && lead.comments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-slate-400 font-semibold">التعليقات السابقة:</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {lead.comments.map((comment, idx) => (
                    <div key={idx} className="bg-slate-900 p-3 rounded text-xs">
                      <p className="text-slate-300">{comment.text}</p>
                      <p className="text-slate-500 text-xs mt-1">
                        {comment.added_by} - {formatDistanceToNow(new Date(comment.added_at), { addSuffix: true, locale: ar })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button
              onClick={handleAddComment}
              disabled={addingComment || !commentText.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white w-full"
            >
              {addingComment ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جاري الإضافة...
                </>
              ) : (
                'إضافة تعليق'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reminder Dialog */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">تعيين تذكير</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <input
              type="datetime-local"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-md px-3 py-2"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSetReminder}
                className="bg-yellow-600 hover:bg-yellow-700 text-white flex-1"
              >
                حفظ
              </Button>
              <Button
                onClick={() => {
                  setReminderDate('');
                  onUpdateReminder(lead.id, null);
                  setReminderDialogOpen(false);
                }}
                variant="outline"
                className="border-slate-700 text-slate-300"
              >
                إلغاء التذكير
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

