'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { 
  Loader2, 
  Search,
  Plus,
  Mail,
  MessageCircle,
  Edit,
  Trash2,
  EyeOff,
  Eye,
  Phone,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  status: 'new' | 'contacted' | 'client thinking about it' | 'converted' | 'lost' | 'non_converted';
  importance?: 'low' | 'medium' | 'high' | 'urgent';
  reminder_date?: string;
  converted_at?: string;
  non_converted_at?: string;
  source_reference_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface ExpiredSubscription {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  subscription_type: string;
  subscription_code: string;
  start_date: string;
  expiration_date: string;
  expired_at: string;
}

interface ProductOption {
  id: string;
  product_code: string;
  name: string;
  price: number;
}

type TabType = 'pipeline' | 'subscriptions' | 'unconverted';

const COLUMNS = [
  { id: 'new', status: 'new' as const, title: 'New Lead' },
  { id: 'contacted', status: 'contacted' as const, title: 'Contacted' },
  { id: 'in_progress', status: 'client thinking about it' as const, title: 'In Progress' },
  { id: 'closed', status: 'converted' as const, title: 'Closed' },
];

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] ${isOver ? 'bg-blue-50 dark:bg-blue-900/20 rounded-lg transition-colors' : ''}`}
    >
      {children}
    </div>
  );
}

function LeadCard({ 
  lead, 
  onUpdateNotes,
  onDelete,
  onEdit,
  onHide,
  onContactEmail,
  onContactWhatsApp,
}: {
  lead: Lead;
  onUpdateNotes: (leadId: string, notes: string) => void;
  onDelete: (leadId: string) => void;
  onEdit: (lead: Lead) => void;
  onHide: (leadId: string) => void;
  onContactEmail: (email: string) => void;
  onContactWhatsApp: (whatsapp: string) => void;
}) {
  const [notes, setNotes] = useState(lead.notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleNotesBlur = () => {
    if (notes !== (lead.notes || '')) {
      onUpdateNotes(lead.id, notes);
    }
    setIsEditingNotes(false);
  };

  const getSourceLabel = () => {
    if (lead.source === 'abandoned_cart') return 'Abandoned Cart Lead';
    if (lead.source === 'whatsapp') return 'WhatsApp Lead';
    return 'Manual Lead';
  };

  const getImportanceBadge = () => {
    const importance = lead.importance || 'medium';
    const badges: Record<string, { label: string; className: string }> = {
      high: { label: 'High', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
      medium: { label: 'Medium', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
      low: { label: 'Low', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
      urgent: { label: 'High', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
    };
    const badge = badges[importance] || badges.medium;
    
    if (lead.status === 'converted') {
      return { label: 'Won', className: 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300' };
    }
    
    return badge;
  };

  const badge = getImportanceBadge();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-background-dark border-b border-[#E9ECEF] dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
    >
      <div className="py-2 px-4">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          onMouseDown={(e) => {
            // Only start drag if clicking on the content area, not buttons
            const target = e.target as HTMLElement;
            if (target.closest('button') || target.closest('svg') || target.closest('textarea')) {
              e.stopPropagation();
              return;
            }
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <p className="text-gray-800 dark:text-gray-100 text-sm font-medium leading-normal w-[40%] truncate">
              {lead.name}
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-[10px] font-normal leading-normal w-[30%] truncate">
              {getSourceLabel()}
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-normal leading-normal w-[15%] truncate">
              ${lead.total_amount.toLocaleString()}
            </p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-[15%] text-center flex-shrink-0 ${badge.className}`}>
              {badge.label}
            </span>
          </div>
        </div>
        {/* Buttons row under the name */}
        <div className="flex items-center gap-1 mt-1.5" onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (lead.email) {
                onContactEmail(lead.email);
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={!lead.email}
            className={`p-1 rounded-full transition-colors ${
              lead.email
                ? 'text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700'
                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50'
            }`}
            title={lead.email ? "Contact via Email" : "No email available"}
          >
            <Mail className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (lead.whatsapp) {
                onContactWhatsApp(lead.whatsapp);
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={!lead.whatsapp}
            className={`p-1 rounded-full transition-colors ${
              lead.whatsapp
                ? 'text-gray-500 dark:text-gray-400 hover:text-green-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50'
            }`}
            title={lead.whatsapp ? "Contact via WhatsApp" : "No WhatsApp available"}
          >
            <MessageCircle className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(lead);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Edit lead"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onHide(lead.id);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-gray-500 dark:text-gray-400 hover:text-orange-600 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Hide lead"
          >
            <EyeOff className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(lead.id);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-gray-500 dark:text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Delete lead"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* Notes section - always visible below the card */}
      <div className="w-full px-4 pb-2">
        {isEditingNotes ? (
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                handleNotesBlur();
              }
            }}
            placeholder="Add notes..."
            className="text-xs min-h-[50px] bg-[#F8F9FA] dark:bg-gray-800/50 text-gray-800 dark:text-gray-100"
            autoFocus
          />
        ) : (
          <div
            onClick={() => setIsEditingNotes(true)}
            className="text-xs text-gray-500 dark:text-gray-400 cursor-text min-h-[20px] p-1 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded"
          >
            {notes || 'Click to add notes...'}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CRMLeadsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [expiredSubscriptions, setExpiredSubscriptions] = useState<ExpiredSubscription[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType | string>('pipeline');
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  
  // Subscription edit/delete state
  const [editingSubscription, setEditingSubscription] = useState<ExpiredSubscription | null>(null);
  const [subscriptionEditDialogOpen, setSubscriptionEditDialogOpen] = useState(false);
  const [subscriptionEditForm, setSubscriptionEditForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    subscription_type: '',
  });
  const [deletingSubscriptionId, setDeletingSubscriptionId] = useState<string | null>(null);
  
  // Manual lead creation dialog
  const [manualLeadDialogOpen, setManualLeadDialogOpen] = useState(false);
  const [creatingLead, setCreatingLead] = useState(false);
  const [manualLeadForm, setManualLeadForm] = useState({
    name: '',
    email: '',
    whatsapp: '',
    products: [] as Product[],
    total_amount: 0,
    importance: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    reminder_date: '',
  });
  const [selectedProduct, setSelectedProduct] = useState<{ product: ProductOption | null; quantity: number }>({
    product: null,
    quantity: 1,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.user) {
          router.push('/auth');
          return;
        }

        const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
        if (adminEmailsStr) {
          const adminEmails = adminEmailsStr.split(',').map(e => e.trim()).filter(Boolean);
          if (adminEmails.length > 0 && !adminEmails.includes(session.user.email || '')) {
            router.push('/');
            return;
          }
        }

        setUser(session.user);
        await Promise.all([fetchLeads(), fetchProducts(), fetchExpiredSubscriptions()]);
      } catch (error: any) {
        console.error('Auth check error:', error);
        toast({
          title: 'خطأ',
          description: error.message || 'حدث خطأ أثناء التحقق من الصلاحيات',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, toast]);

  const fetchLeads = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/admin/leads', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'فشل جلب العملاء المحتملين');
      }

      const { leads: fetchedLeads } = await response.json();
      setLeads(fetchedLeads || []);
    } catch (error: any) {
      console.error('Fetch leads error:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء جلب العملاء المحتملين',
        variant: 'destructive',
      });
    }
  };

  const fetchExpiredSubscriptions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/admin/subscriptions/expired', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('فشل جلب الاشتراكات المنتهية');
      }

      const { subscriptions } = await response.json();
      setExpiredSubscriptions(subscriptions || []);
    } catch (error: any) {
      console.error('Fetch expired subscriptions error:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/admin/products', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const { products: fetchedProducts } = await response.json();
        setProducts(fetchedProducts || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleUpdateNotes = async (leadId: string, notes: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'حدث خطأ أثناء تحديث الملاحظات');
      }

      await fetchLeads();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء تحديث الملاحظات',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العميل المحتمل؟')) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'حدث خطأ أثناء حذف العميل المحتمل');
      }

      toast({
        title: 'نجح',
        description: 'تم حذف العميل المحتمل بنجاح',
      });

      await fetchLeads();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء حذف العميل المحتمل',
        variant: 'destructive',
      });
    }
  };

  const handleHideLead = async (leadId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch(`/api/admin/leads/${leadId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: 'non_converted' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'حدث خطأ أثناء إخفاء العميل المحتمل');
      }

      toast({
        title: 'نجح',
        description: 'تم نقل العميل إلى قائمة غير المحولين',
      });

      await fetchLeads();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إخفاء العميل المحتمل',
        variant: 'destructive',
      });
    }
  };

  const handleUnhideLead = async (leadId: string, originalStatus: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch(`/api/admin/leads/${leadId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: originalStatus || 'new' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'حدث خطأ أثناء إظهار العميل المحتمل');
      }

      toast({
        title: 'نجح',
        description: 'تم إظهار العميل المحتمل',
      });

      await fetchLeads();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إظهار العميل المحتمل',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateStatus = async (leadId: string, status: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch(`/api/admin/leads/${leadId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'حدث خطأ أثناء تحديث الحالة');
      }

      await fetchLeads();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء تحديث الحالة',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = leads.find(l => l.id === active.id);
    setDraggedLead(lead || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedLead(null);

    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    const column = COLUMNS.find(col => col.id === overId);
    if (column) {
      const lead = leads.find(l => l.id === leadId);
      if (!lead || lead.status === column.status) return;

      try {
        await handleUpdateStatus(leadId, column.status);
      } catch (error) {
        // Error already handled in handleUpdateStatus
      }
      return;
    }

    // Check if dropped on another lead (get its column)
    const droppedOnLead = leads.find(l => l.id === overId);
    if (droppedOnLead) {
      // Find which column this lead belongs to
      const targetColumn = COLUMNS.find(col => col.status === droppedOnLead.status);
      if (targetColumn) {
        const lead = leads.find(l => l.id === leadId);
        if (!lead || lead.status === targetColumn.status) return;

        try {
          await handleUpdateStatus(leadId, targetColumn.status);
        } catch (error) {
          // Error already handled in handleUpdateStatus
        }
      }
    }
  };

  const handleContactEmail = (email: string) => {
    const subject = encodeURIComponent('Follow up on your inquiry');
    const body = encodeURIComponent('Hello,\n\nI wanted to follow up on your recent inquiry. Please let me know if you have any questions.\n\nBest regards');
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleContactWhatsApp = (whatsapp: string) => {
    const cleanPhone = whatsapp.replace(/[^0-9]/g, '');
    const message = encodeURIComponent('Hello, I wanted to follow up on your recent inquiry. Please let me know if you have any questions.');
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const handleEditSubscription = (subscription: ExpiredSubscription) => {
    setEditingSubscription(subscription);
    setSubscriptionEditForm({
      customer_name: subscription.customer_name,
      customer_email: subscription.customer_email,
      customer_phone: subscription.customer_phone || '',
      subscription_type: subscription.subscription_type,
    });
    setSubscriptionEditDialogOpen(true);
  };

  const handleUpdateSubscription = async () => {
    if (!editingSubscription) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/admin/subscriptions/expired/${editingSubscription.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(subscriptionEditForm),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'فشل تحديث الاشتراك');
      }

      toast({
        title: 'نجح',
        description: 'تم تحديث الاشتراك بنجاح',
      });

      setSubscriptionEditDialogOpen(false);
      setEditingSubscription(null);
      await fetchExpiredSubscriptions();
    } catch (error: any) {
      console.error('Update subscription error:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء تحديث الاشتراك',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteSubscription = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to delete this subscription?')) {
      return;
    }

    setDeletingSubscriptionId(subscriptionId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/admin/subscriptions/expired/${subscriptionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'فشل حذف الاشتراك');
      }

      toast({
        title: 'نجح',
        description: 'تم حذف الاشتراك بنجاح',
      });

      await fetchExpiredSubscriptions();
    } catch (error: any) {
      console.error('Delete subscription error:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء حذف الاشتراك',
        variant: 'destructive',
      });
    } finally {
      setDeletingSubscriptionId(null);
    }
  };

  const handleEditLead = (lead: Lead) => {
    setActiveLead(lead);
    // Open edit dialog - you can implement this
    toast({
      title: 'تعديل',
      description: 'ميزة التعديل قيد التطوير',
    });
  };

  const handleAddProductToManualLead = () => {
    if (!selectedProduct.product) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار منتج',
        variant: 'destructive',
      });
      return;
    }

    const newProduct: Product = {
      product_name: selectedProduct.product.name,
      product_code: selectedProduct.product.product_code,
      price: selectedProduct.product.price,
      quantity: selectedProduct.quantity,
    };

    setManualLeadForm(prev => ({
      ...prev,
      products: [...prev.products, newProduct],
      total_amount: prev.total_amount + (selectedProduct.product!.price * selectedProduct.quantity),
    }));

    setSelectedProduct({ product: null, quantity: 1 });
  };

  const handleRemoveProductFromManualLead = (index: number) => {
    const product = manualLeadForm.products[index];
    setManualLeadForm(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index),
      total_amount: prev.total_amount - (product.price * product.quantity),
    }));
  };

  const handleCreateManualLead = async () => {
    if (!manualLeadForm.name.trim()) {
      toast({
        title: 'خطأ',
        description: 'الاسم مطلوب',
        variant: 'destructive',
      });
      return;
    }

    setCreatingLead(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          source: 'manual',
          name: manualLeadForm.name,
          email: manualLeadForm.email || null,
          whatsapp: manualLeadForm.whatsapp || null,
          products: manualLeadForm.products,
          total_amount: manualLeadForm.total_amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء إنشاء العميل المحتمل');
      }

      toast({
        title: 'نجح',
        description: 'تم إنشاء العميل المحتمل بنجاح',
      });

      setManualLeadDialogOpen(false);
      setManualLeadForm({
        name: '',
        email: '',
        whatsapp: '',
        products: [],
        total_amount: 0,
        importance: 'medium',
        reminder_date: '',
      });
      await fetchLeads();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إنشاء العميل المحتمل',
        variant: 'destructive',
      });
    } finally {
      setCreatingLead(false);
    }
  };

  const getLeadsByStatus = (status: string, leadsToFilter: Lead[] = leads) => {
    return leadsToFilter.filter(lead => {
      if (status === 'new') return lead.status === 'new';
      if (status === 'contacted') return lead.status === 'contacted';
      if (status === 'client thinking about it') return lead.status === 'client thinking about it';
      if (status === 'converted') return lead.status === 'converted';
      return false;
    });
  };

  const filteredLeads = useMemo(() => {
    let filtered = [...leads];

    if (activeTab === 'unconverted') {
      filtered = filtered.filter(lead => lead.status === 'non_converted');
    } else if (activeTab === 'pipeline') {
      filtered = filtered.filter(lead => 
        ['new', 'contacted', 'client thinking about it', 'converted'].includes(lead.status)
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(lead => 
        lead.name.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.whatsapp?.toLowerCase().includes(query) ||
        lead.products.some(p => p.product_name.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [leads, activeTab, searchQuery]);

  const expiredSubscriptionsByType = useMemo(() => {
    const grouped: { [key: string]: ExpiredSubscription[] } = {};
    
    // Remove duplicates based on phone number
    // If phone number is the same, keep only one subscription
    const seenPhoneNumbers = new Set<string>();
    
    const uniqueSubscriptions = expiredSubscriptions.filter(sub => {
      const phone = (sub.customer_phone || '').trim();
      
      // If no phone number, keep the subscription (can't filter by phone)
      if (!phone) return true;
      
      // If phone number already seen, skip this subscription (duplicate)
      if (seenPhoneNumbers.has(phone)) {
        return false; // Duplicate by phone number
      }
      
      seenPhoneNumbers.add(phone);
      return true;
    });
    
    uniqueSubscriptions.forEach(sub => {
      const type = (sub.subscription_type || '').trim();
      
      // Normalize category names to exact matches (case-insensitive and handle variations)
      let normalizedType: string | null = null;
      
      const typeLower = type.toLowerCase();
      const typeNormalized = type.replace(/\s+/g, ' ').trim(); // Normalize whitespace
      
      // Check for نتـFlix (various spellings)
      if (type.includes('نتـFlix') || type.includes('نتفليكس') || typeLower.includes('netflix')) {
        normalizedType = 'نتـFlix';
      } 
      // Check for شاهـ د (with space) - check this before checking for "شاهد" alone
      else if (type.includes('شاهـ د') || typeNormalized.includes('شاهد') || typeLower.includes('shahid')) {
        normalizedType = 'شاهـ د';
      } 
      // Check for أروما - be very flexible with matching
      else if (type.includes('أروما') || type.includes('اروما') || typeLower.includes('aroma') || typeLower === 'aroma') {
        normalizedType = 'أروما';
      } 
      // Check for البكجات
      else if (type.includes('البكجات') || type.includes('بكجات') || typeLower.includes('package') || type.includes('باقة')) {
        normalizedType = 'البكجات';
      }
      
      // Skip if not one of the allowed categories
      if (!normalizedType) {
        // Debug: log unmatched types to help identify issues
        if (type) {
          console.log('Unmatched subscription type:', type);
        }
        return;
      }
      
      if (!grouped[normalizedType]) {
        grouped[normalizedType] = [];
      }
      grouped[normalizedType].push(sub);
    });
    return grouped;
  }, [expiredSubscriptions]);

  const filteredExpiredSubscriptions = useMemo(() => {
    if (!searchQuery) return expiredSubscriptions;
    const query = searchQuery.toLowerCase();
    return expiredSubscriptions.filter(sub =>
      sub.customer_name.toLowerCase().includes(query) ||
      sub.customer_email.toLowerCase().includes(query) ||
      (sub.customer_phone && sub.customer_phone.toLowerCase().includes(query)) ||
      sub.subscription_type.toLowerCase().includes(query)
    );
  }, [expiredSubscriptions, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark">
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getUserAvatar = () => {
    // Use a default avatar or generate from email
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'User')}&background=4A90E2&color=fff&size=40`;
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark" dir="ltr">
      <div className="layout-container flex h-full grow flex-col">
        {/* Header */}
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-[#E9ECEF] dark:border-gray-700 px-6 sm:px-10 py-3 bg-white dark:bg-background-dark">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 text-gray-800 dark:text-gray-100">
              <div className="size-6 text-primary">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21 8c-1.45 0-2.26 1.44-1.93 2.51l-3.55 12.99c-.2.74-.92 1.5-1.93 1.5-.95 0-1.66-.7-1.87-1.5L8.93 10.51C8.6 9.44 7.45 8 6 8H3c-1.1 0-2 .9-2 2s.9 2 2 2h1.5l1.5 5.5c.5 1.84 2.16 3.5 4 3.5h8c1.84 0 3.5-1.66 3.5-3.5L21.5 10H23c1.1 0 2-.9 2-2s-.9-2-2-2h-2z"/>
                </svg>
              </div>
              <h2 className="text-gray-800 dark:text-gray-100 text-lg font-bold leading-tight tracking-[-0.015em]">CRM Panel</h2>
            </div>
            <label className="hidden md:flex flex-col min-w-40 !h-10 max-w-64">
              <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                <div className="text-gray-500 dark:text-gray-400 flex bg-[#F8F9FA] dark:bg-gray-800/50 items-center justify-center pl-3 rounded-l-lg border-r-0">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-800 dark:text-gray-100 focus:outline-0 focus:ring-0 border-none bg-[#F8F9FA] dark:bg-gray-800/50 h-full placeholder:text-gray-500 dark:placeholder:text-gray-400 px-4 rounded-l-none border-l-0 pl-2 text-sm font-normal leading-normal"
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </label>
          </div>
          <div className="flex flex-1 justify-end items-center gap-4">
            <Button
              onClick={() => setManualLeadDialogOpen(true)}
              className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em]"
            >
              <span className="truncate">Add New Client</span>
            </Button>
            <button className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 gap-2 text-sm font-bold leading-normal tracking-[0.015em] min-w-0 px-2.5">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
              </svg>
            </button>
            <div
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10"
              style={{ backgroundImage: `url("${getUserAvatar()}")` }}
            />
          </div>
        </header>

        <main className="flex-1 px-6 sm:px-10 py-5">
          {/* Tabs */}
          <div className="pb-3">
            <div className="flex border-b border-[#E9ECEF] dark:border-gray-700 px-4 gap-8">
              <button
                onClick={() => setActiveTab('pipeline')}
                className={`flex flex-col items-center justify-center border-b-[3px] pb-[13px] pt-4 ${
                  activeTab === 'pipeline'
                    ? 'border-b-primary text-gray-800 dark:text-gray-100'
                    : 'border-b-transparent text-gray-500 dark:text-gray-400'
                }`}
              >
                <p className="text-sm font-bold leading-normal tracking-[0.015em]">Pipeline</p>
              </button>
              <button
                onClick={() => {
                  const firstCategory = Object.keys(expiredSubscriptionsByType)[0];
                  setActiveTab(firstCategory || 'subscriptions');
                }}
                className={`flex flex-col items-center justify-center border-b-[3px] pb-[13px] pt-4 ${
                  activeTab === 'subscriptions' || Object.keys(expiredSubscriptionsByType).includes(activeTab as string)
                    ? 'border-b-primary text-gray-800 dark:text-gray-100'
                    : 'border-b-transparent text-gray-500 dark:text-gray-400'
                }`}
              >
                <p className="text-sm font-bold leading-normal tracking-[0.015em]">Subscriptions Data</p>
              </button>
              <button
                onClick={() => setActiveTab('unconverted')}
                className={`flex flex-col items-center justify-center border-b-[3px] pb-[13px] pt-4 ${
                  activeTab === 'unconverted'
                    ? 'border-b-primary text-gray-800 dark:text-gray-100'
                    : 'border-b-transparent text-gray-500 dark:text-gray-400'
                }`}
              >
                <p className="text-sm font-bold leading-normal tracking-[0.015em]">Unconverted Leads</p>
              </button>
            </div>
          </div>

          {/* Pipeline Tab */}
          {activeTab === 'pipeline' && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
                {COLUMNS.map((column) => {
                  const columnLeads = getLeadsByStatus(column.status, filteredLeads);
                  return (
                    <div key={column.id} className="flex flex-col gap-2">
                      <h3 className="text-gray-800 dark:text-gray-100 text-lg font-bold leading-tight tracking-[-0.015em] px-2">
                        {column.title}
                      </h3>
                      <DroppableColumn id={column.id}>
                        <div className="flex flex-col rounded-xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
                          <SortableContext
                            items={columnLeads.map(l => l.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {columnLeads.map((lead) => (
                              <div key={lead.id} className="group">
                                <LeadCard
                                  lead={lead}
                                  onUpdateNotes={handleUpdateNotes}
                                  onDelete={handleDeleteLead}
                                  onEdit={handleEditLead}
                                  onHide={handleHideLead}
                                  onContactEmail={handleContactEmail}
                                  onContactWhatsApp={handleContactWhatsApp}
                                />
                              </div>
                            ))}
                          </SortableContext>
                          {columnLeads.length === 0 && (
                            <div className="bg-white dark:bg-background-dark py-8 px-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                              No leads
                            </div>
                          )}
                        </div>
                      </DroppableColumn>
                    </div>
                  );
                })}
              </div>
              <DragOverlay>
                {draggedLead ? (
                  <div className="bg-white dark:bg-background-dark py-2 px-4 flex items-center gap-2 opacity-90 shadow-lg rounded">
                    <p className="text-gray-800 dark:text-gray-100 text-sm font-medium">{draggedLead.name}</p>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {/* Subscriptions Data Tab */}
          {(activeTab === 'subscriptions' || Object.keys(expiredSubscriptionsByType).includes(activeTab as string)) && (
            <div className="pt-6">
              {/* Title */}
              <div className="mb-6">
                <h2 className="text-gray-800 dark:text-gray-100 text-xl font-bold">
                  الاشتراكات المنتهية تنقل الى هنا
                </h2>
              </div>
              {/* Category Tabs */}
              <div className="flex border-b border-[#E9ECEF] dark:border-gray-700 mb-4 gap-4 overflow-x-auto">
                {Object.keys(expiredSubscriptionsByType).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setActiveTab(type);
                    }}
                    className={`flex-shrink-0 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                      activeTab === type
                        ? 'border-primary text-gray-800 dark:text-gray-100'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {type} ({expiredSubscriptionsByType[type].length})
                  </button>
                ))}
              </div>

              {/* Excel-like Table */}
              {Object.entries(expiredSubscriptionsByType).map(([type, subscriptions]) => {
                const filteredSubs = subscriptions.filter(sub => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    sub.customer_name.toLowerCase().includes(query) ||
                    sub.customer_email.toLowerCase().includes(query) ||
                    (sub.customer_phone && sub.customer_phone.toLowerCase().includes(query))
                  );
                });

                // Show first category by default if no category is selected
                const isFirstCategory = Object.keys(expiredSubscriptionsByType)[0] === type;
                const shouldShow = activeTab === type || (activeTab === 'subscriptions' && isFirstCategory);
                if (!shouldShow) return null;

                return (
                  <div key={type} className="bg-white dark:bg-background-dark rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#F8F9FA] dark:bg-gray-800/50 border-b-2 border-[#E9ECEF] dark:border-gray-700">
                            <th className="text-left px-3 py-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-300 border-r border-[#E9ECEF] dark:border-gray-700 whitespace-nowrap">Name</th>
                            <th className="text-left px-3 py-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-300 border-r border-[#E9ECEF] dark:border-gray-700 whitespace-nowrap">Email</th>
                            <th className="text-left px-3 py-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-300 border-r border-[#E9ECEF] dark:border-gray-700 whitespace-nowrap">Phone</th>
                            <th className="text-left px-3 py-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-300 border-r border-[#E9ECEF] dark:border-gray-700 whitespace-nowrap">Type</th>
                            <th className="text-left px-3 py-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSubs.map((subscription, index) => (
                            <tr
                              key={subscription.id}
                              className={`border-b border-[#E9ECEF] dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/10 ${
                                index % 2 === 0 ? 'bg-white dark:bg-background-dark' : 'bg-[#F8F9FA] dark:bg-gray-800/30'
                              }`}
                            >
                              <td className="px-3 py-1.5 text-[12px] text-gray-800 dark:text-gray-100 border-r border-[#E9ECEF] dark:border-gray-700">
                                {subscription.customer_name}
                              </td>
                              <td className="px-3 py-1.5 text-[12px] text-gray-600 dark:text-gray-400 border-r border-[#E9ECEF] dark:border-gray-700">
                                {subscription.customer_email}
                              </td>
                              <td className="px-3 py-1.5 text-[12px] text-gray-600 dark:text-gray-400 border-r border-[#E9ECEF] dark:border-gray-700">
                                {subscription.customer_phone || '-'}
                              </td>
                              <td className="px-3 py-1.5 text-[12px] text-gray-600 dark:text-gray-400 border-r border-[#E9ECEF] dark:border-gray-700">
                                {type}
                              </td>
                              <td className="px-3 py-1.5">
                                <div className="flex items-center gap-1">
                                  {subscription.customer_phone && (
                                    <Button
                                      onClick={() => handleContactWhatsApp(subscription.customer_phone!)}
                                      className="bg-green-600 hover:bg-green-700 text-white h-6 px-2 text-[11px]"
                                      size="sm"
                                    >
                                      <MessageCircle className="h-3 w-3 mr-1" />
                                      WhatsApp
                                    </Button>
                                  )}
                                  <Button
                                    onClick={() => handleEditSubscription(subscription)}
                                    className="text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary h-6 w-6 p-0"
                                    size="sm"
                                    title="Edit subscription"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    onClick={() => handleDeleteSubscription(subscription.id)}
                                    disabled={deletingSubscriptionId === subscription.id}
                                    className="text-gray-500 dark:text-gray-400 hover:text-red-600 h-6 w-6 p-0"
                                    size="sm"
                                    title="Delete subscription"
                                  >
                                    {deletingSubscriptionId === subscription.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredSubs.length === 0 && (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                          No subscriptions found
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {Object.keys(expiredSubscriptionsByType).length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  No expired subscriptions found
                </div>
              )}
            </div>
          )}

          {/* Unconverted Leads Tab */}
          {activeTab === 'unconverted' && (
            <div className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white dark:bg-background-dark rounded-xl p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
                  >
                    <div className="space-y-2">
                      <p className="text-gray-800 dark:text-gray-100 font-medium">{lead.name}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        {lead.source === 'abandoned_cart' ? 'Abandoned Cart Lead' : lead.source === 'whatsapp' ? 'WhatsApp Lead' : 'Manual Lead'}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">${lead.total_amount.toLocaleString()}</p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleUnhideLead(lead.id, 'new')}
                          size="sm"
                          variant="outline"
                          className="flex-1"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Unhide
                        </Button>
                        <Button
                          onClick={() => handleDeleteLead(lead.id)}
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {filteredLeads.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  No unconverted leads
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Add New Client Dialog */}
      <Dialog open={manualLeadDialogOpen} onOpenChange={setManualLeadDialogOpen}>
        <DialogContent className="bg-white dark:bg-background-dark max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-800 dark:text-gray-100 text-2xl">Add New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Name *</Label>
                <Input
                  value={manualLeadForm.name}
                  onChange={(e) => setManualLeadForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Client name"
                  className="bg-[#F8F9FA] dark:bg-gray-800/50"
                />
              </div>
              <div>
                <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Email</Label>
                <Input
                  type="email"
                  value={manualLeadForm.email}
                  onChange={(e) => setManualLeadForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                  className="bg-[#F8F9FA] dark:bg-gray-800/50"
                />
              </div>
              <div>
                <Label className="text-gray-700 dark:text-gray-300 mb-2 block">WhatsApp</Label>
                <Input
                  value={manualLeadForm.whatsapp}
                  onChange={(e) => setManualLeadForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                  placeholder="+966501234567"
                  className="bg-[#F8F9FA] dark:bg-gray-800/50"
                />
              </div>
              <div>
                <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Importance</Label>
                <Select
                  value={manualLeadForm.importance}
                  onValueChange={(value: any) => setManualLeadForm(prev => ({ ...prev, importance: value }))}
                >
                  <SelectTrigger className="bg-[#F8F9FA] dark:bg-gray-800/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Products</Label>
              <div className="flex gap-2">
                <select
                  value={selectedProduct.product?.id || ''}
                  onChange={(e) => {
                    const product = products.find(p => p.id === e.target.value);
                    setSelectedProduct(prev => ({ ...prev, product: product || null }));
                  }}
                  className="flex-1 bg-[#F8F9FA] dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2"
                >
                  <option value="">Select product</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} - ${product.price}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min="1"
                  value={selectedProduct.quantity}
                  onChange={(e) => setSelectedProduct(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  placeholder="Qty"
                  className="w-24 bg-[#F8F9FA] dark:bg-gray-800/50"
                />
                <Button
                  onClick={handleAddProductToManualLead}
                  disabled={!selectedProduct.product}
                  className="bg-primary hover:bg-primary/90"
                >
                  Add
                </Button>
              </div>
              {manualLeadForm.products.length > 0 && (
                <div className="mt-3 space-y-2">
                  {manualLeadForm.products.map((product, index) => (
                    <div key={index} className="flex items-center justify-between bg-[#F8F9FA] dark:bg-gray-800/50 p-3 rounded">
                      <span className="text-gray-700 dark:text-gray-300 text-sm">
                        {product.product_name} (x{product.quantity}) - ${(product.price * product.quantity).toLocaleString()}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveProductFromManualLead(index)}
                        className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="text-gray-700 dark:text-gray-300 font-semibold mt-3 text-lg">
                    Total: ${manualLeadForm.total_amount.toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={handleCreateManualLead}
                disabled={creatingLead || !manualLeadForm.name.trim()}
                className="bg-primary hover:bg-primary/90 text-white flex-1"
              >
                {creatingLead ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Lead'
                )}
              </Button>
              <Button
                onClick={() => setManualLeadDialogOpen(false)}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Subscription Dialog */}
      <Dialog open={subscriptionEditDialogOpen} onOpenChange={setSubscriptionEditDialogOpen}>
        <DialogContent className="bg-white dark:bg-background-dark max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-800 dark:text-gray-100 text-xl">Edit Subscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Customer Name</Label>
              <Input
                value={subscriptionEditForm.customer_name}
                onChange={(e) => setSubscriptionEditForm(prev => ({ ...prev, customer_name: e.target.value }))}
                className="bg-[#F8F9FA] dark:bg-gray-800/50"
                placeholder="Customer name"
              />
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Customer Email</Label>
              <Input
                type="email"
                value={subscriptionEditForm.customer_email}
                onChange={(e) => setSubscriptionEditForm(prev => ({ ...prev, customer_email: e.target.value }))}
                className="bg-[#F8F9FA] dark:bg-gray-800/50"
                placeholder="Customer email"
              />
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Customer Phone</Label>
              <Input
                value={subscriptionEditForm.customer_phone}
                onChange={(e) => setSubscriptionEditForm(prev => ({ ...prev, customer_phone: e.target.value }))}
                className="bg-[#F8F9FA] dark:bg-gray-800/50"
                placeholder="Customer phone"
              />
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Subscription Type</Label>
              <Select
                value={subscriptionEditForm.subscription_type}
                onValueChange={(value) => setSubscriptionEditForm(prev => ({ ...prev, subscription_type: value }))}
              >
                <SelectTrigger className="bg-[#F8F9FA] dark:bg-gray-800/50">
                  <SelectValue placeholder="Select subscription type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="نتـFlix">نتـFlix</SelectItem>
                  <SelectItem value="شاهـ د">شاهـ د</SelectItem>
                  <SelectItem value="أروما">أروما</SelectItem>
                  <SelectItem value="البكجات">البكجات</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
            <Button
              onClick={handleUpdateSubscription}
              className="bg-primary hover:bg-primary/90 text-white flex-1"
            >
              Update Subscription
            </Button>
            <Button
              onClick={() => setSubscriptionEditDialogOpen(false)}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
