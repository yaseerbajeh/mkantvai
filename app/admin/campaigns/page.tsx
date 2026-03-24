'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  Send,
  Phone,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  X,
  Trash2,
  RefreshCw,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock,
  ArrowLeft,
  RotateCcw,
  Megaphone,
  Copy,
  Download,
  Save,
  BookOpen,
  PenSquare,
  Calendar as CalendarIcon,
  Timer,
  ImageIcon,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface Campaign {
  id: string;
  name: string;
  message: string;
  image_url: string | null;
  status: string;
  total_count: number;
  sent_count: number;
  error_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  scheduled_at: string | null;
}

interface CampaignMessage {
  id: string;
  campaign_id: string;
  phone_number: string;
  status: string;
  error: string | null;
  sent_at: string | null;
  created_at: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export default function AdminCampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Campaign form
  const [campaignName, setCampaignName] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');
  const [phoneNumbersText, setPhoneNumbersText] = useState('');
  const [creating, setCreating] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Send progress
  const [sendProgress, setSendProgress] = useState<{
    current: number;
    total: number;
    sent: number;
    errors: number;
    campaignId: string;
  } | null>(null);
  const sendAbortRef = useRef(false);

  // Campaigns list
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Expanded campaign detail
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [campaignMessages, setCampaignMessages] = useState<CampaignMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Resend failed
  const [resending, setResending] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Schedule check interval
  const scheduleIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/admin');
        return;
      }

      const allowedEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
      if (!allowedEmails.includes(user.email?.toLowerCase() || '')) {
        router.push('/admin');
        return;
      }

      setUser(user);
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  // Pre-fill phone numbers from ?phones= query param (from Meta audiences page)
  useEffect(() => {
    const phones = searchParams.get('phones');
    if (phones) {
      setPhoneNumbersText(phones.split(',').join('\n'));
    }
  }, [searchParams]);

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const res = await fetch('/api/admin/campaigns');
      const data = await res.json();
      if (data.campaigns) {
        setCampaigns(data.campaigns);
      }
    } catch {
      toast({ title: 'خطأ في جلب الحملات', variant: 'destructive' });
    }
    setLoadingCampaigns(false);
  }, [toast]);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/campaign-templates');
      const data = await res.json();
      if (data.templates) {
        setTemplates(data.templates);
      }
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchCampaigns();
      fetchTemplates();
    }
  }, [user, fetchCampaigns, fetchTemplates]);

  // Check for scheduled campaigns that should start
  useEffect(() => {
    const checkScheduled = async () => {
      const now = new Date();
      const scheduledReady = campaigns.filter(
        c => c.status === 'scheduled' && c.scheduled_at && new Date(c.scheduled_at) <= now
      );

      for (const campaign of scheduledReady) {
        // Auto-start this campaign
        const detailRes = await fetch(`/api/admin/campaigns/${campaign.id}`);
        const detailData = await detailRes.json();
        const messages: CampaignMessage[] = detailData.messages || [];

        if (messages.length > 0 && !sendProgress) {
          toast({ title: `بدأت الحملة المجدولة: ${campaign.name}` });
          await sendCampaignMessages(campaign.id, messages);
          await fetchCampaigns();
        }
      }
    };

    scheduleIntervalRef.current = setInterval(checkScheduled, 30000);
    return () => {
      if (scheduleIntervalRef.current) clearInterval(scheduleIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns]);

  // Fetch campaign messages when expanding
  const fetchCampaignMessages = async (campaignId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}`);
      const data = await res.json();
      if (data.messages) {
        setCampaignMessages(data.messages);
      }
    } catch {
      toast({ title: 'خطأ في جلب تفاصيل الحملة', variant: 'destructive' });
    }
    setLoadingMessages(false);
  };

  const toggleCampaignExpand = (campaignId: string) => {
    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null);
      setCampaignMessages([]);
    } else {
      setExpandedCampaignId(campaignId);
      fetchCampaignMessages(campaignId);
    }
  };

  // Parse phone numbers from text
  const parsePhoneNumbers = (text: string): string[] => {
    return text
      .split(/[,\n\r;]+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  };

  const parsedNumbers = useMemo(() => parsePhoneNumbers(phoneNumbersText), [phoneNumbersText]);

  // Create campaign and send messages
  const handleCreateAndSend = async () => {
    if (!campaignName.trim() || !campaignMessage.trim() || parsedNumbers.length === 0) {
      toast({ title: 'يرجى ملء جميع الحقول', variant: 'destructive' });
      return;
    }

    const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();

    setCreating(true);
    sendAbortRef.current = false;

    try {
      // Step 1: Create campaign
      const createRes = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: campaignName.trim(),
          message: campaignMessage.trim(),
          phoneNumbers: parsedNumbers,
          scheduledAt: isScheduled ? new Date(scheduledAt).toISOString() : null,
          imageUrl: imageUrl.trim() || null,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        toast({ title: createData.error || 'خطأ في إنشاء الحملة', variant: 'destructive' });
        setCreating(false);
        return;
      }

      const campaign = createData.campaign;

      // Refresh to get the campaign in the list
      await fetchCampaigns();

      if (isScheduled) {
        toast({ title: `تم جدولة الحملة بنجاح في ${format(new Date(scheduledAt), 'yyyy-MM-dd HH:mm')}` });
      } else {
        // Step 2: Get message records
        const detailRes = await fetch(`/api/admin/campaigns/${campaign.id}`);
        const detailData = await detailRes.json();
        const messages: CampaignMessage[] = detailData.messages || [];

        // Step 3: Send one-by-one with 30s delay
        await sendCampaignMessages(campaign.id, messages);

        toast({ title: 'تم إنشاء وإرسال الحملة بنجاح' });
      }

      // Clear form
      setCampaignName('');
      setCampaignMessage('');
      setPhoneNumbersText('');
      setScheduledAt('');
      setImageUrl('');

      await fetchCampaigns();
    } catch {
      toast({ title: 'خطأ في إنشاء الحملة', variant: 'destructive' });
    }

    setCreating(false);
  };

  // Send campaign messages one-by-one with 30s delay
  const sendCampaignMessages = async (campaignId: string, messages: CampaignMessage[]) => {
    const pendingMessages = messages.filter(m => m.status === 'pending');
    if (pendingMessages.length === 0) return;

    let sent = 0;
    let errors = 0;

    setSendProgress({ current: 0, total: pendingMessages.length, sent: 0, errors: 0, campaignId });

    for (let i = 0; i < pendingMessages.length; i++) {
      if (sendAbortRef.current) break;

      const msg = pendingMessages[i];
      setSendProgress({ current: i + 1, total: pendingMessages.length, sent, errors, campaignId });

      try {
        const sendRes = await fetch('/api/admin/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_one',
            campaignId,
            messageId: msg.id,
          }),
        });

        const sendData = await sendRes.json();
        if (sendData.success) {
          sent++;
        } else {
          errors++;
        }
      } catch {
        errors++;
      }

      setSendProgress({ current: i + 1, total: pendingMessages.length, sent, errors, campaignId });

      // 30-second delay between messages (skip after last)
      if (i < pendingMessages.length - 1 && !sendAbortRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }
    }

    // Mark campaign as completed
    const finalStatus = sendAbortRef.current ? 'paused' : (errors > 0 && sent === 0 ? 'failed' : 'completed');
    await fetch('/api/admin/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', campaignId, status: finalStatus }),
    });

    setSendProgress(null);
    await fetchCampaigns();
  };

  // Resend failed messages
  const handleResendFailed = async (campaign: Campaign) => {
    setResending(true);
    sendAbortRef.current = false;

    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`);
      const data = await res.json();
      const allMessages: CampaignMessage[] = data.messages || [];

      const failedMessages = allMessages.filter(m => m.status === 'failed');
      if (failedMessages.length === 0) {
        toast({ title: 'لا توجد رسائل فاشلة لإعادة الإرسال' });
        setResending(false);
        return;
      }

      await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', campaignId: campaign.id, status: 'sending' }),
      });

      await sendCampaignMessages(campaign.id, failedMessages.map(m => ({ ...m, status: 'pending' as const })));

      toast({ title: `تمت إعادة إرسال ${failedMessages.length} رسالة` });
    } catch {
      toast({ title: 'خطأ في إعادة الإرسال', variant: 'destructive' });
    }

    setResending(false);
    await fetchCampaigns();
  };

  // Delete campaign
  const handleDeleteCampaign = async () => {
    if (!deletingCampaign) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/admin/campaigns/${deletingCampaign.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'تم حذف الحملة بنجاح' });
        if (expandedCampaignId === deletingCampaign.id) {
          setExpandedCampaignId(null);
          setCampaignMessages([]);
        }
        await fetchCampaigns();
      } else {
        toast({ title: 'خطأ في حذف الحملة', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ في حذف الحملة', variant: 'destructive' });
    }

    setDeleting(false);
    setDeleteDialogOpen(false);
    setDeletingCampaign(null);
  };

  // Duplicate campaign — fill form with campaign data
  const handleDuplicateCampaign = async (campaign: Campaign) => {
    // Fetch the numbers from the original campaign
    const res = await fetch(`/api/admin/campaigns/${campaign.id}`);
    const data = await res.json();
    const messages: CampaignMessage[] = data.messages || [];

    setCampaignName(`${campaign.name} (نسخة)`);
    setCampaignMessage(campaign.message);
    setPhoneNumbersText(messages.map(m => m.phone_number).join(', '));
    setImageUrl(campaign.image_url || '');
    setScheduledAt('');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({ title: 'تم نسخ بيانات الحملة إلى النموذج' });
  };

  // Export campaign as CSV
  const handleExportCSV = async (campaign: Campaign) => {
    const res = await fetch(`/api/admin/campaigns/${campaign.id}`);
    const data = await res.json();
    const messages: CampaignMessage[] = data.messages || [];

    if (messages.length === 0) {
      toast({ title: 'لا توجد رسائل للتصدير', variant: 'destructive' });
      return;
    }

    // BOM for Arabic support in Excel
    const bom = '\uFEFF';
    const header = 'رقم الهاتف,الحالة,وقت الإرسال,الخطأ';
    const rows = messages.map(m => {
      const status = m.status === 'sent' ? 'تم الإرسال' : m.status === 'failed' ? 'فشل' : 'قيد الانتظار';
      const sentTime = m.sent_at ? format(new Date(m.sent_at), 'yyyy-MM-dd HH:mm:ss') : '';
      const error = (m.error || '').replace(/,/g, ' ');
      return `${m.phone_number},${status},${sentTime},${error}`;
    });

    const csv = bom + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `campaign-${campaign.name}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: 'تم تصدير التقرير بنجاح' });
  };

  // Template: save current message as template
  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !templateBody.trim()) {
      toast({ title: 'يرجى إدخال اسم ونص القالب', variant: 'destructive' });
      return;
    }

    setSavingTemplate(true);
    try {
      if (editingTemplate) {
        // Update existing
        await fetch('/api/admin/campaign-templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTemplate.id, name: templateName.trim(), body: templateBody.trim() }),
        });
        toast({ title: 'تم تحديث القالب' });
      } else {
        // Create new
        await fetch('/api/admin/campaign-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: templateName.trim(), body: templateBody.trim() }),
        });
        toast({ title: 'تم حفظ القالب' });
      }

      setTemplateName('');
      setTemplateBody('');
      setEditingTemplate(null);
      await fetchTemplates();
    } catch {
      toast({ title: 'خطأ في حفظ القالب', variant: 'destructive' });
    }
    setSavingTemplate(false);
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await fetch(`/api/admin/campaign-templates?id=${id}`, { method: 'DELETE' });
      toast({ title: 'تم حذف القالب' });
      await fetchTemplates();
    } catch {
      toast({ title: 'خطأ في حذف القالب', variant: 'destructive' });
    }
  };

  const handleUseTemplate = (template: MessageTemplate) => {
    setCampaignMessage(template.body);
    setTemplatesOpen(false);
    toast({ title: `تم تحميل قالب: ${template.name}` });
  };

  // Analytics computations
  const analytics = useMemo(() => {
    if (campaigns.length === 0) return null;

    const totalCampaigns = campaigns.length;
    const totalMessages = campaigns.reduce((sum, c) => sum + c.total_count, 0);
    const totalSent = campaigns.reduce((sum, c) => sum + c.sent_count, 0);
    const totalErrors = campaigns.reduce((sum, c) => sum + c.error_count, 0);
    const deliveryRate = totalMessages > 0 ? ((totalSent / totalMessages) * 100).toFixed(1) : '0';
    const activeCampaigns = campaigns.filter(c => c.status === 'sending').length;
    const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;
    const scheduledCampaigns = campaigns.filter(c => c.status === 'scheduled').length;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentCampaigns = campaigns.filter(c => new Date(c.created_at) >= sevenDaysAgo);
    const recentSent = recentCampaigns.reduce((sum, c) => sum + c.sent_count, 0);

    return {
      totalCampaigns,
      totalMessages,
      totalSent,
      totalErrors,
      deliveryRate,
      activeCampaigns,
      completedCampaigns,
      scheduledCampaigns,
      recentCampaigns: recentCampaigns.length,
      recentSent,
    };
  }, [campaigns]);

  // Status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">قيد الانتظار</Badge>;
      case 'sending': return <Badge className="bg-blue-100 text-blue-800 border-blue-300">جاري الإرسال</Badge>;
      case 'completed': return <Badge className="bg-green-100 text-green-800 border-green-300">مكتملة</Badge>;
      case 'paused': return <Badge className="bg-orange-100 text-orange-800 border-orange-300">متوقفة</Badge>;
      case 'failed': return <Badge className="bg-red-100 text-red-800 border-red-300">فشلت</Badge>;
      case 'scheduled': return <Badge className="bg-purple-100 text-purple-800 border-purple-300">مجدولة</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getMsgStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-yellow-600 border-yellow-300">قيد الانتظار</Badge>;
      case 'sent': return <Badge variant="outline" className="text-green-600 border-green-300">تم الإرسال</Badge>;
      case 'failed': return <Badge variant="outline" className="text-red-600 border-red-300">فشل</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Megaphone className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">حملات واتساب</h1>
              <p className="text-gray-500 text-sm">إرسال رسائل جماعية عبر واتساب</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setTemplatesOpen(true)}
              className="gap-2"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">القوالب</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/admin/subscriptions')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              الاشتراكات
            </Button>
          </div>
        </div>

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <Card className="bg-white border-gray-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Megaphone className="h-4 w-4 text-blue-500" />
                  <p className="text-sm text-gray-500">إجمالي الحملات</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalCampaigns}</p>
                <p className="text-xs text-gray-400 mt-1">{analytics.recentCampaigns} آخر 7 أيام</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Send className="h-4 w-4 text-green-500" />
                  <p className="text-sm text-gray-500">الرسائل المرسلة</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalSent}</p>
                <p className="text-xs text-gray-400 mt-1">{analytics.recentSent} آخر 7 أيام</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <p className="text-sm text-gray-500">الرسائل الفاشلة</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalErrors}</p>
                <p className="text-xs text-gray-400 mt-1">من أصل {analytics.totalMessages}</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="h-4 w-4 text-purple-500" />
                  <p className="text-sm text-gray-500">نسبة التسليم</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{analytics.deliveryRate}%</p>
                <p className="text-xs text-gray-400 mt-1">{analytics.completedCampaigns} مكتملة · {analytics.activeCampaigns} نشطة</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Timer className="h-4 w-4 text-indigo-500" />
                  <p className="text-sm text-gray-500">مجدولة</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{analytics.scheduledCampaigns}</p>
                <p className="text-xs text-gray-400 mt-1">تنتظر الإرسال</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Send Progress Bar */}
        {sendProgress && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    جاري إرسال الرسائل... {sendProgress.current}/{sendProgress.total}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-green-700">✓ {sendProgress.sent} نجح</span>
                  {sendProgress.errors > 0 && (
                    <span className="text-xs text-red-700">✗ {sendProgress.errors} فشل</span>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { sendAbortRef.current = true; }}
                    className="h-7"
                  >
                    <X className="h-3 w-3 ml-1" />
                    إيقاف
                  </Button>
                </div>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-blue-700 mt-2">
                <Clock className="h-3 w-3 inline ml-1" />
                30 ثانية بين كل رسالة · الوقت المتبقي: ~{Math.max(0, (sendProgress.total - sendProgress.current) * 30)} ثانية
              </p>
            </CardContent>
          </Card>
        )}

        {/* New Campaign Form */}
        <Card className="mb-8 bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              حملة جديدة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Campaign Name */}
            <div className="space-y-2">
              <Label className="text-gray-700">اسم الحملة *</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="مثال: حملة رمضان 2026"
                className="bg-gray-50 border-gray-300 text-gray-900"
              />
            </div>

            {/* Message with template buttons */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-gray-700">نص الرسالة *</Label>
                <div className="flex items-center gap-2">
                  {campaignMessage.trim() && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setTemplateName('');
                        setTemplateBody(campaignMessage);
                        setEditingTemplate(null);
                        setTemplatesOpen(true);
                      }}
                      className="h-7 text-xs gap-1 text-blue-600 hover:text-blue-700"
                    >
                      <Save className="h-3 w-3" />
                      حفظ كقالب
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setTemplatesOpen(true)}
                    className="h-7 text-xs gap-1 text-purple-600 hover:text-purple-700"
                  >
                    <BookOpen className="h-3 w-3" />
                    اختيار قالب
                  </Button>
                </div>
              </div>
              <Textarea
                value={campaignMessage}
                onChange={(e) => setCampaignMessage(e.target.value)}
                placeholder="اكتب رسالتك هنا..."
                className="bg-gray-50 border-gray-300 text-gray-900 min-h-[120px]"
                dir="rtl"
              />
              <p className="text-xs text-gray-400">{campaignMessage.length} حرف</p>
            </div>

            {/* Image URL (optional) */}
            <div className="space-y-2">
              <Label className="text-gray-700 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                رابط الصورة <span className="text-gray-400 font-normal">(اختياري — سيتم إرسالها مع الرسالة)</span>
              </Label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="bg-gray-50 border-gray-300 text-gray-900"
                dir="ltr"
              />
              {imageUrl.trim() && (
                <div className="flex items-start gap-3 p-2 bg-gray-100 rounded-lg border border-gray-200">
                  <img
                    src={imageUrl.trim()}
                    alt="معاينة"
                    className="w-20 h-20 object-cover rounded border border-gray-300"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    onLoad={(e) => { (e.target as HTMLImageElement).style.display = 'block'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-green-600 font-medium">سيتم إرسال الصورة مع النص كتعليق</p>
                    <p className="text-xs text-gray-400 truncate mt-1" dir="ltr">{imageUrl.trim()}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setImageUrl('')}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Phone Numbers */}
            <div className="space-y-2">
              <Label className="text-gray-700 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                أرقام الهواتف * <span className="text-gray-400 font-normal">(مفصولة بفاصلة أو سطر جديد)</span>
              </Label>
              <Textarea
                value={phoneNumbersText}
                onChange={(e) => setPhoneNumbersText(e.target.value)}
                placeholder="966501234567, 966509876543, 966551112222&#10;أو كل رقم في سطر جديد"
                className="bg-gray-50 border-gray-300 text-gray-900 min-h-[100px] font-mono text-sm"
                dir="ltr"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {parsedNumbers.length > 0 ? (
                    <span className="text-blue-600 font-medium">{parsedNumbers.length} رقم</span>
                  ) : (
                    'لم يتم إدخال أرقام'
                  )}
                </p>
                {parsedNumbers.length > 0 && (
                  <p className="text-xs text-gray-400">
                    الوقت المقدر: ~{Math.ceil(parsedNumbers.length * 30 / 60)} دقيقة
                  </p>
                )}
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-2">
              <Label className="text-gray-700 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                جدولة الإرسال <span className="text-gray-400 font-normal">(اختياري — اتركه فارغاً للإرسال فوراً)</span>
              </Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="bg-gray-50 border-gray-300 text-gray-900 max-w-xs"
                dir="ltr"
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
              />
              {scheduledAt && new Date(scheduledAt) > new Date() && (
                <p className="text-xs text-purple-600">
                  <Timer className="h-3 w-3 inline ml-1" />
                  سيتم إرسال الحملة في: {format(new Date(scheduledAt), 'yyyy-MM-dd HH:mm')}
                </p>
              )}
            </div>

            {/* Send Button */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleCreateAndSend}
                disabled={creating || !!sendProgress || !campaignName.trim() || !campaignMessage.trim() || parsedNumbers.length === 0}
                className={`gap-2 ${scheduledAt && new Date(scheduledAt) > new Date() ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : scheduledAt && new Date(scheduledAt) > new Date() ? (
                  <Timer className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {scheduledAt && new Date(scheduledAt) > new Date() ? 'جدولة الحملة' : 'إنشاء وإرسال الحملة'}
              </Button>
              {(campaignName || campaignMessage || phoneNumbersText || scheduledAt || imageUrl) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setCampaignName('');
                    setCampaignMessage('');
                    setPhoneNumbersText('');
                    setScheduledAt('');
                    setImageUrl('');
                  }}
                  className="text-gray-600"
                >
                  مسح
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Campaigns History */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                سجل الحملات
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchCampaigns}
                disabled={loadingCampaigns}
                className="gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${loadingCampaigns ? 'animate-spin' : ''}`} />
                تحديث
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingCampaigns ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد حملات بعد</p>
                <p className="text-sm">أنشئ أول حملة من النموذج أعلاه</p>
              </div>
            ) : (
              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Campaign Row */}
                    <div
                      className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => toggleCampaignExpand(campaign.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {expandedCampaignId === campaign.id ? (
                          <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{campaign.name}</p>
                          <p className="text-xs text-gray-500">
                            {format(new Date(campaign.created_at), 'yyyy-MM-dd HH:mm', { locale: ar })}
                            {campaign.scheduled_at && campaign.status === 'scheduled' && (
                              <span className="text-purple-600 mr-2">
                                · مجدولة: {format(new Date(campaign.scheduled_at), 'yyyy-MM-dd HH:mm')}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Stats */}
                        <div className="hidden sm:flex items-center gap-3 text-sm">
                          <span className="text-gray-500">{campaign.total_count} رقم</span>
                          <span className="text-green-600">✓ {campaign.sent_count}</span>
                          {campaign.error_count > 0 && (
                            <span className="text-red-600">✗ {campaign.error_count}</span>
                          )}
                        </div>

                        {getStatusBadge(campaign.status)}

                        {/* Actions */}
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {/* Resend failed */}
                          {campaign.error_count > 0 && campaign.status !== 'sending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResendFailed(campaign)}
                              disabled={resending || !!sendProgress}
                              className="h-8 gap-1 text-orange-600 border-orange-300 hover:bg-orange-50"
                              title="إعادة إرسال الفاشلة"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span className="hidden sm:inline">إعادة ({campaign.error_count})</span>
                            </Button>
                          )}
                          {/* Duplicate */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDuplicateCampaign(campaign)}
                            className="h-8 w-8 p-0 text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                            title="تكرار الحملة"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          {/* Export CSV */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleExportCSV(campaign)}
                            className="h-8 w-8 p-0 text-green-400 hover:text-green-600 hover:bg-green-50"
                            title="تصدير CSV"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          {/* Delete */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDeletingCampaign(campaign);
                              setDeleteDialogOpen(true);
                            }}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                            title="حذف"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {expandedCampaignId === campaign.id && (
                      <div className="border-t border-gray-200 bg-gray-50 p-4">
                        {/* Campaign message preview */}
                        <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                          {campaign.image_url && (
                            <div className="mb-2">
                              <p className="text-xs text-gray-400 mb-1">الصورة المرفقة:</p>
                              <img
                                src={campaign.image_url}
                                alt="صورة الحملة"
                                className="max-w-[200px] max-h-[200px] object-cover rounded border border-gray-300"
                              />
                            </div>
                          )}
                          <p className="text-xs text-gray-400 mb-1">نص الرسالة:</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{campaign.message}</p>
                        </div>

                        {/* Campaign mini stats */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="text-center p-2 bg-white rounded border border-gray-200">
                            <p className="text-lg font-bold text-gray-900">{campaign.total_count}</p>
                            <p className="text-xs text-gray-500">إجمالي</p>
                          </div>
                          <div className="text-center p-2 bg-white rounded border border-green-200">
                            <p className="text-lg font-bold text-green-600">{campaign.sent_count}</p>
                            <p className="text-xs text-gray-500">نجح</p>
                          </div>
                          <div className="text-center p-2 bg-white rounded border border-red-200">
                            <p className="text-lg font-bold text-red-600">{campaign.error_count}</p>
                            <p className="text-xs text-gray-500">فشل</p>
                          </div>
                        </div>

                        {/* Action buttons row */}
                        <div className="flex gap-2 mb-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleExportCSV(campaign)}
                            className="gap-1 text-green-700 border-green-300 hover:bg-green-50"
                          >
                            <Download className="h-3 w-3" />
                            تصدير CSV
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDuplicateCampaign(campaign)}
                            className="gap-1 text-blue-700 border-blue-300 hover:bg-blue-50"
                          >
                            <Copy className="h-3 w-3" />
                            تكرار الحملة
                          </Button>
                          {campaign.error_count > 0 && campaign.status !== 'sending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResendFailed(campaign)}
                              disabled={resending || !!sendProgress}
                              className="gap-1 text-orange-700 border-orange-300 hover:bg-orange-50"
                            >
                              <RotateCcw className="h-3 w-3" />
                              إعادة إرسال الفاشلة ({campaign.error_count})
                            </Button>
                          )}
                        </div>

                        {/* Messages table */}
                        {loadingMessages ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                          </div>
                        ) : campaignMessages.length > 0 ? (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gray-100">
                                  <TableHead className="text-right text-gray-600">#</TableHead>
                                  <TableHead className="text-right text-gray-600">رقم الهاتف</TableHead>
                                  <TableHead className="text-right text-gray-600">الحالة</TableHead>
                                  <TableHead className="text-right text-gray-600">وقت الإرسال</TableHead>
                                  <TableHead className="text-right text-gray-600">الخطأ</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {campaignMessages.map((msg, idx) => (
                                  <TableRow key={msg.id} className="hover:bg-white">
                                    <TableCell className="text-gray-500 text-sm">{idx + 1}</TableCell>
                                    <TableCell className="font-mono text-sm text-gray-900" dir="ltr">
                                      {msg.phone_number}
                                    </TableCell>
                                    <TableCell>{getMsgStatusBadge(msg.status)}</TableCell>
                                    <TableCell className="text-gray-500 text-sm">
                                      {msg.sent_at
                                        ? format(new Date(msg.sent_at), 'HH:mm:ss', { locale: ar })
                                        : '-'
                                      }
                                    </TableCell>
                                    <TableCell className="text-red-500 text-xs max-w-[200px] truncate">
                                      {msg.error || '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-center text-gray-400 text-sm py-4">لا توجد رسائل</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              حذف الحملة
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              هل أنت متأكد من حذف الحملة &quot;{deletingCampaign?.name}&quot;؟ سيتم حذف جميع سجلات الرسائل أيضاً.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-gray-300"
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCampaign}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حذف'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Templates Library Dialog */}
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-600" />
              مكتبة قوالب الرسائل
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              احفظ رسائلك المتكررة كقوالب لإعادة استخدامها
            </DialogDescription>
          </DialogHeader>

          {/* Save/Edit template form */}
          <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
            <p className="text-sm font-medium text-gray-700">
              {editingTemplate ? 'تعديل القالب' : 'حفظ قالب جديد'}
            </p>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="اسم القالب"
              className="bg-white border-gray-300 text-gray-900"
            />
            <Textarea
              value={templateBody}
              onChange={(e) => setTemplateBody(e.target.value)}
              placeholder="نص الرسالة..."
              className="bg-white border-gray-300 text-gray-900 min-h-[80px]"
              dir="rtl"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveTemplate}
                disabled={savingTemplate || !templateName.trim() || !templateBody.trim()}
                className="bg-purple-600 hover:bg-purple-700 gap-1"
              >
                {savingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                {editingTemplate ? 'تحديث' : 'حفظ'}
              </Button>
              {editingTemplate && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingTemplate(null);
                    setTemplateName('');
                    setTemplateBody('');
                  }}
                >
                  إلغاء التعديل
                </Button>
              )}
            </div>
          </div>

          {/* Templates list */}
          <div className="space-y-2 mt-4">
            {templates.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">
                لا توجد قوالب محفوظة
              </p>
            ) : (
              templates.map((template) => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-3 bg-white hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-medium text-gray-900 text-sm">{template.name}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUseTemplate(template)}
                        className="h-7 text-xs gap-1 text-green-600 hover:bg-green-50"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        استخدام
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingTemplate(template);
                          setTemplateName(template.name);
                          setTemplateBody(template.body);
                        }}
                        className="h-7 w-7 p-0 text-blue-400 hover:text-blue-600"
                      >
                        <PenSquare className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 whitespace-pre-wrap line-clamp-3">{template.body}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {format(new Date(template.created_at), 'yyyy-MM-dd', { locale: ar })}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
