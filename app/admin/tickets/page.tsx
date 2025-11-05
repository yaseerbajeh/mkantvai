'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { 
  Loader2, 
  Search, 
  MessageCircle,
  Send,
  CheckCircle2,
  XCircle,
  Mail,
  User,
  Clock,
  RefreshCw,
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface Ticket {
  id: string;
  order_id: string | null;
  user_email: string;
  subject: string;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  messages?: TicketMessage[];
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_email: string;
  sender_type: 'user' | 'admin';
  message: string;
  created_at: string;
}

export default function AdminTicketsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  
  // Selected ticket for viewing
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          toast({
            title: 'خطأ',
            description: 'حدث خطأ أثناء التحقق من الجلسة',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        if (!session?.user) {
          router.push('/auth');
          return;
        }

        const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
        if (!adminEmailsStr) {
          if (process.env.NODE_ENV === 'production') {
            toast({
              title: 'خطأ في الإعدادات',
              description: 'إعدادات الإدارة غير متوفرة. يرجى الاتصال بالدعم الفني.',
              variant: 'destructive',
            });
            router.push('/');
            return;
          }
        } else {
          const adminEmails = adminEmailsStr.split(',').map(e => e.trim()).filter(Boolean);
          if (adminEmails.length > 0 && !adminEmails.includes(session.user.email || '')) {
            toast({
              title: 'غير مصرح',
              description: 'ليس لديك صلاحية للوصول إلى هذه الصفحة',
              variant: 'destructive',
            });
            router.push('/');
            return;
          }
        }

        setUser(session.user);
        fetchTickets();
      } catch (error: any) {
        console.error('Auth check error:', error);
        toast({
          title: 'خطأ',
          description: error.message || 'حدث خطأ أثناء التحقق من الصلاحيات',
          variant: 'destructive',
        });
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, toast]);

  // Filter tickets
  useEffect(() => {
    let filtered = [...tickets];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.subject.toLowerCase().includes(query) ||
        t.user_email.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query)
      );
    }

    // Sort by updated_at descending (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.updated_at).getTime();
      const dateB = new Date(b.updated_at).getTime();
      return dateB - dateA;
    });

    setFilteredTickets(filtered);
  }, [tickets, searchQuery, statusFilter]);

  const fetchTickets = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      const response = await fetch('/api/tickets', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في جلب التذاكر');
      }

      setTickets(result.tickets || []);
    } catch (error: any) {
      console.error('Error fetching tickets:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء جلب التذاكر',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTicket = async (ticket: Ticket) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      const response = await fetch(`/api/tickets/${ticket.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في جلب التذكرة');
      }

      setSelectedTicket(result.ticket);
      setTicketDialogOpen(true);
      setNewMessage('');
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء فتح التذكرة',
        variant: 'destructive',
      });
    }
  };

  const handleSendMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال رسالة',
        variant: 'destructive',
      });
      return;
    }

    setSendingMessage(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      const response = await fetch(`/api/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: newMessage.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في إرسال الرسالة');
      }

      // Refresh ticket data
      await handleOpenTicket(selectedTicket);
      setNewMessage('');
      toast({
        title: 'نجح',
        description: 'تم إرسال الرسالة بنجاح',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إرسال الرسالة',
        variant: 'destructive',
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;

    setClosingTicket(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      const response = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          status: 'closed',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في إغلاق التذكرة');
      }

      setSelectedTicket({ ...selectedTicket, status: 'closed' });
      await fetchTickets();
      toast({
        title: 'نجح',
        description: 'تم إغلاق التذكرة بنجاح',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إغلاق التذكرة',
        variant: 'destructive',
      });
    } finally {
      setClosingTicket(false);
    }
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <main className="container mx-auto px-4 py-24 pt-32">
          <div className="max-w-6xl mx-auto text-center">
            <Loader2 className="h-8 w-8 animate-spin text-white mx-auto" />
            <p className="text-slate-300 mt-4">جاري التحميل...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Header />
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">إدارة التذاكر</h1>
            <p className="text-slate-300">عرض والرد على تذاكر الدعم الفني</p>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">إجمالي التذاكر</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">مفتوحة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-400">{stats.open}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">مغلقة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">{stats.closed}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="البحث في التذاكر..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'open' | 'closed')}
              className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-md text-white"
            >
              <option value="all">جميع الحالات</option>
              <option value="open">مفتوحة</option>
              <option value="closed">مغلقة</option>
            </select>
            <Button
              onClick={fetchTickets}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
          </div>

          {/* Tickets Table */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">الموضوع</TableHead>
                      <TableHead className="text-slate-300">البريد الإلكتروني</TableHead>
                      <TableHead className="text-slate-300">الحالة</TableHead>
                      <TableHead className="text-slate-300">تاريخ الإنشاء</TableHead>
                      <TableHead className="text-slate-300">آخر تحديث</TableHead>
                      <TableHead className="text-slate-300">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                          لا توجد تذاكر
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTickets.map((ticket) => (
                        <TableRow key={ticket.id} className="border-slate-700">
                          <TableCell className="text-white font-medium">
                            {ticket.subject}
                          </TableCell>
                          <TableCell className="text-slate-300">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              {ticket.user_email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={ticket.status === 'open' ? 'default' : 'secondary'}
                              className={
                                ticket.status === 'open'
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-slate-700 text-slate-300'
                              }
                            >
                              {ticket.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-300">
                            {format(new Date(ticket.created_at), 'yyyy-MM-dd HH:mm', { locale: ar })}
                          </TableCell>
                          <TableCell className="text-slate-300">
                            {format(new Date(ticket.updated_at), 'yyyy-MM-dd HH:mm', { locale: ar })}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => handleOpenTicket(ticket)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <MessageCircle className="h-4 w-4 mr-2" />
                              عرض
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Ticket Dialog */}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-5xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-700">
            <DialogTitle className="text-xl">تذكرة الدعم</DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedTicket && (
                <div className="flex items-center gap-4 mt-2">
                  <Badge
                    variant={selectedTicket.status === 'open' ? 'default' : 'secondary'}
                    className={
                      selectedTicket.status === 'open'
                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/50'
                        : 'bg-slate-700 text-slate-400 border-slate-600'
                    }
                  >
                    {selectedTicket.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                  </Badge>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm">{selectedTicket.user_email}</span>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTicket && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Ticket Header */}
              <div className="px-6 py-4 bg-slate-900/50 border-b border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <MessageCircle className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-lg">{selectedTicket.subject}</p>
                    <p className="text-slate-400 text-sm">
                      رقم التذكرة: {selectedTicket.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gradient-to-b from-slate-900/50 to-slate-800/50">
                {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                  selectedTicket.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === 'user' ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2`}
                    >
                      <div className="flex flex-col max-w-[75%]">
                        <div className="flex items-center gap-2 mb-1 px-2">
                          {msg.sender_type === 'user' && (
                            <>
                              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                                <User className="w-3 h-3 text-white" />
                              </div>
                              <span className="text-xs text-slate-400">{msg.sender_email}</span>
                            </>
                          )}
                          {msg.sender_type === 'admin' && (
                            <>
                              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                                <CheckCircle2 className="w-3 h-3 text-white" />
                              </div>
                              <span className="text-xs text-slate-400">أنت (المدير)</span>
                            </>
                          )}
                        </div>
                        <div
                          className={`rounded-2xl px-4 py-3 shadow-lg ${
                            msg.sender_type === 'user'
                              ? 'bg-slate-700 text-white rounded-bl-sm border border-slate-600'
                              : 'bg-blue-600 text-white rounded-br-sm'
                          }`}
                        >
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.message}</p>
                        </div>
                        <span className="text-xs text-slate-500 mt-1 px-2">
                          {format(new Date(msg.created_at), 'yyyy-MM-dd HH:mm', { locale: ar })}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">لا توجد رسائل بعد</p>
                  </div>
                )}
              </div>
              
              {/* Input Area */}
              {selectedTicket.status === 'open' && (
                <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-700">
                  <div className="space-y-3">
                    <div className="flex gap-3 items-end">
                      <div className="flex-1 relative">
                        <Textarea
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="اكتب ردك هنا... (Ctrl+Enter للإرسال)"
                          className="bg-slate-800 border-slate-600 text-white min-h-[120px] resize-none pr-12 focus:ring-2 focus:ring-blue-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                        />
                        <div className="absolute bottom-2 left-2 text-xs text-slate-500">
                          Ctrl + Enter
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleSendMessage}
                        disabled={sendingMessage || !newMessage.trim()}
                        className="bg-blue-600 hover:bg-blue-700 flex-1 h-12"
                        size="lg"
                      >
                        {sendingMessage ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            جاري الإرسال...
                          </>
                        ) : (
                          <>
                            <Send className="h-5 w-5 mr-2" />
                            إرسال الرد
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleCloseTicket}
                        disabled={closingTicket}
                        variant="outline"
                        className="border-red-600 text-red-400 hover:bg-red-600/10 h-12 px-6"
                      >
                        {closingTicket ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="h-5 w-5 mr-2" />
                            إغلاق التذكرة
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="px-6 pb-6 border-t border-slate-700 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setTicketDialogOpen(false);
                setSelectedTicket(null);
                setNewMessage('');
              }}
              className="border-slate-600 text-slate-300"
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}

