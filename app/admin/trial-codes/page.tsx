'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  Search,
  Key,
  Users,
  BarChart3,
  Mail,
  Eye,
  EyeOff,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface TrialCode {
  id: string;
  trial_code: string;
  expires_at: string;
  is_assigned: boolean;
  assigned_to_user_id?: string;
  assigned_at?: string;
  username?: string;
  password?: string;
  link?: string;
  created_at: string;
  status?: 'available' | 'assigned' | 'expired';
  is_expired?: boolean;
  is_available?: boolean;
}

interface TrialUser {
  id: string;
  user_id: string;
  user_email?: string;
  trial_code: string;
  expires_at: string;
  assigned_at: string;
  username?: string;
  password?: string;
  link?: string;
  is_expired: boolean;
  has_purchased: boolean;
  status: 'active' | 'expired' | 'purchased' | 'not_purchased';
}

type SortField = 'trial_code' | 'expires_at' | 'created_at' | 'status';
type UserSortField = 'trial_code' | 'expires_at' | 'assigned_at' | 'status';
type SortDirection = 'asc' | 'desc';

export default function AdminTrialCodesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('codes');
  
  // Trial Codes State
  const [trialCodes, setTrialCodes] = useState<TrialCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codeSearchQuery, setCodeSearchQuery] = useState('');
  const [codeStatusFilter, setCodeStatusFilter] = useState<string>('all');
  const [showExpiredCodes, setShowExpiredCodes] = useState(false);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<TrialCode | null>(null);
  const [deletingCodeId, setDeletingCodeId] = useState<string | null>(null);
  const [codeForm, setCodeForm] = useState({
    expiry_duration: '12', // Default to 12 hours
    username: '',
    password: '',
    link: '',
  });
  const [codeCounts, setCodeCounts] = useState({
    total: 0,
    available: 0,
    assigned: 0,
    expired: 0,
  });

  // Trial Users State
  const [trialUsers, setTrialUsers] = useState<TrialUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('all');
  const [userSortField, setUserSortField] = useState<UserSortField>('assigned_at');
  const [userSortDirection, setUserSortDirection] = useState<SortDirection>('desc');
  const [userCounts, setUserCounts] = useState({
    total: 0,
    active: 0,
    expired: 0,
    purchased: 0,
    not_purchased: 0,
  });

  // Analytics State
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

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

        const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim());
        if (adminEmails.length > 0 && !adminEmails.includes(session.user.email || '')) {
          router.push('/');
          return;
        }

        setUser(session.user);
      } catch (error: any) {
        console.error('Auth check error:', error);
        router.push('/auth');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, toast]);

  useEffect(() => {
    if (user) {
      if (activeTab === 'codes') {
        fetchTrialCodes();
      } else if (activeTab === 'users') {
        fetchTrialUsers();
      } else if (activeTab === 'analytics') {
        fetchAnalytics();
      }
    }
  }, [user, activeTab]);

  const fetchTrialCodes = async () => {
    try {
      setCodesLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams();
      if (codeStatusFilter !== 'all') {
        params.append('status', codeStatusFilter);
      }
      if (showExpiredCodes) {
        params.append('showExpired', 'true');
      }

      const response = await fetch(`/api/admin/trial-codes?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في جلب رموز التجربة');
      }

      setTrialCodes(result.trialCodes || []);
      setCodeCounts(result.counts || { total: 0, available: 0, assigned: 0, expired: 0 });
    } catch (error: any) {
      console.error('Fetch trial codes error:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في جلب رموز التجربة',
        variant: 'destructive',
      });
    } finally {
      setCodesLoading(false);
    }
  };

  const fetchTrialUsers = async () => {
    try {
      setUsersLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams();
      if (userStatusFilter !== 'all') {
        params.append('status', userStatusFilter);
      }
      if (userSearchQuery) {
        params.append('search', userSearchQuery);
      }

      const response = await fetch(`/api/admin/trial-codes/users?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في جلب طلبات التجربة');
      }

      setTrialUsers(result.users || []);
      setUserCounts(result.counts || { total: 0, active: 0, expired: 0, purchased: 0, not_purchased: 0 });
    } catch (error: any) {
      console.error('Fetch trial users error:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في جلب طلبات التجربة',
        variant: 'destructive',
      });
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/admin/trial-codes/analytics', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في جلب بيانات التحليلات');
      }

      setAnalytics(result);
    } catch (error: any) {
      console.error('Fetch analytics error:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في جلب بيانات التحليلات',
        variant: 'destructive',
      });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleCreateCode = () => {
    setEditingCode(null);
    setCodeForm({
      expiry_duration: '12', // Default to 12 hours
      username: '',
      password: '',
      link: '',
    });
    setCodeDialogOpen(true);
  };

  const handleEditCode = (code: TrialCode) => {
    setEditingCode(code);
    // Calculate hours until expiry for edit mode
    const expiresAt = new Date(code.expires_at);
    const now = new Date();
    const hoursUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    // Find closest duration option
    let expiryDuration = '12';
    if (hoursUntilExpiry <= 3) expiryDuration = '3';
    else if (hoursUntilExpiry <= 6) expiryDuration = '6';
    else if (hoursUntilExpiry <= 12) expiryDuration = '12';
    else expiryDuration = '24';
    
    setCodeForm({
      expiry_duration: expiryDuration,
      username: code.username || '',
      password: code.password || '',
      link: code.link || '',
    });
    setCodeDialogOpen(true);
  };

  const handleSaveCode = async () => {
    if (!codeForm.expiry_duration) {
      toast({
        title: 'خطأ',
        description: 'مدة الانتهاء مطلوبة',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      // Calculate expiry date based on selected duration
      const hours = parseInt(codeForm.expiry_duration);
      const expiresAtDate = new Date();
      expiresAtDate.setHours(expiresAtDate.getHours() + hours);

      // Generate a unique trial code if creating new
      let trialCode = '';
      if (!editingCode) {
        // Generate a random trial code
        const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        const timestamp = Date.now().toString(36).toUpperCase();
        trialCode = `TRIAL-${randomCode}-${timestamp}`;
      } else {
        trialCode = editingCode.trial_code;
      }

      const payload = {
        ...(editingCode && { id: editingCode.id }),
        ...(!editingCode && { trial_code: trialCode }),
        expires_at: expiresAtDate.toISOString(),
        username: codeForm.username.trim() || null,
        password: codeForm.password.trim() || null,
        link: codeForm.link.trim() || null,
      };

      const url = editingCode ? '/api/admin/trial-codes' : '/api/admin/trial-codes';
      const method = editingCode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في حفظ رمز التجربة');
      }

      toast({
        title: 'نجح',
        description: editingCode ? 'تم تحديث رمز التجربة بنجاح' : 'تم إنشاء رمز التجربة بنجاح',
      });

      setCodeDialogOpen(false);
      fetchTrialCodes();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حفظ رمز التجربة',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      const response = await fetch(`/api/admin/trial-codes?id=${codeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في حذف رمز التجربة');
      }

      toast({
        title: 'نجح',
        description: 'تم حذف رمز التجربة بنجاح',
      });

      setDeletingCodeId(null);
      fetchTrialCodes();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حذف رمز التجربة',
        variant: 'destructive',
      });
    }
  };

  const handleSortUsers = (field: UserSortField) => {
    if (userSortField === field) {
      setUserSortDirection(userSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setUserSortField(field);
      setUserSortDirection('desc');
    }
  };

  const sortedUsers = [...trialUsers].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    if (userSortField === 'assigned_at') {
      aValue = new Date(a.assigned_at).getTime();
      bValue = new Date(b.assigned_at).getTime();
    } else if (userSortField === 'expires_at') {
      aValue = new Date(a.expires_at).getTime();
      bValue = new Date(b.expires_at).getTime();
    } else if (userSortField === 'trial_code') {
      aValue = a.trial_code;
      bValue = b.trial_code;
    } else {
      aValue = a.status;
      bValue = b.status;
    }

    if (aValue < bValue) return userSortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return userSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredCodes = trialCodes.filter((code) => {
    const matchesSearch = codeSearchQuery === '' || 
      code.trial_code.toLowerCase().includes(codeSearchQuery.toLowerCase());
    return matchesSearch;
  });

  const filteredUsers = sortedUsers.filter((user) => {
    const matchesSearch = userSearchQuery === '' || 
      (user.user_email?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
       user.trial_code.toLowerCase().includes(userSearchQuery.toLowerCase()));
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <main className="container mx-auto px-4 py-24 pt-32">
          <div className="flex items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
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
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">إدارة رموز التجربة</h1>
              <p className="text-slate-300">إدارة رموز التجربة وطلبات المستخدمين والتحليلات</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-800/50">
              <TabsTrigger value="codes" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                رموز التجربة
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                طلبات المستخدمين
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                التحليلات
              </TabsTrigger>
            </TabsList>

            {/* Trial Codes Tab */}
            <TabsContent value="codes" className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-white">{codeCounts.total}</div>
                    <p className="text-slate-400 text-sm">إجمالي الرموز</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-900/30 border-green-700">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-400">{codeCounts.available}</div>
                    <p className="text-slate-400 text-sm">متاحة</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-900/30 border-blue-700">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-400">{codeCounts.assigned}</div>
                    <p className="text-slate-400 text-sm">مستخدمة</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-900/30 border-red-700">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-red-400">{codeCounts.expired}</div>
                    <p className="text-slate-400 text-sm">منتهية</p>
                  </CardContent>
                </Card>
              </div>

              {/* Filters and Actions */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-1 gap-4 w-full md:w-auto">
                      <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="ابحث عن رمز التجربة..."
                          value={codeSearchQuery}
                          onChange={(e) => setCodeSearchQuery(e.target.value)}
                          className="bg-slate-700 border-slate-600 text-white pr-10"
                        />
                      </div>
                      <Select value={codeStatusFilter} onValueChange={setCodeStatusFilter}>
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white w-full md:w-[180px]">
                          <SelectValue placeholder="تصفية حسب الحالة" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          <SelectItem value="available">متاحة</SelectItem>
                          <SelectItem value="assigned">مستخدمة</SelectItem>
                          <SelectItem value="expired">منتهية</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="show-expired" className="text-white cursor-pointer">
                          إظهار المنتهية
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowExpiredCodes(!showExpiredCodes)}
                          className="text-slate-400 hover:text-white"
                        >
                          {showExpiredCodes ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button onClick={handleCreateCode} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-4 w-4 ml-2" />
                        إضافة رمز تجربة
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Trial Codes Table */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  {codesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                  ) : filteredCodes.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      لا توجد رموز تجربة
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700">
                            <TableHead className="text-slate-300">رمز التجربة</TableHead>
                            <TableHead className="text-slate-300">اسم المستخدم</TableHead>
                            <TableHead className="text-slate-300">كلمة المرور</TableHead>
                            <TableHead className="text-slate-300">الرابط</TableHead>
                            <TableHead className="text-slate-300">تاريخ الانتهاء</TableHead>
                            <TableHead className="text-slate-300">الحالة</TableHead>
                            <TableHead className="text-slate-300">الإجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCodes.map((code) => (
                            <TableRow key={code.id} className="border-slate-700">
                              <TableCell className="text-white font-mono">{code.trial_code}</TableCell>
                              <TableCell className="text-slate-300">{code.username || '-'}</TableCell>
                              <TableCell className="text-slate-300">{code.password ? '••••••' : '-'}</TableCell>
                              <TableCell className="text-slate-300">
                                {code.link ? (
                                  <a href={code.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate max-w-[200px] block">
                                    {code.link}
                                  </a>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="text-slate-300">
                                {format(new Date(code.expires_at), 'yyyy-MM-dd HH:mm', { locale: ar })}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    code.status === 'available'
                                      ? 'bg-green-600'
                                      : code.status === 'assigned'
                                      ? 'bg-blue-600'
                                      : 'bg-red-600'
                                  }
                                >
                                  {code.status === 'available' ? 'متاح' : code.status === 'assigned' ? 'مستخدم' : 'منتهي'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditCode(code)}
                                    className="text-blue-400 hover:text-blue-300"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  {!code.is_assigned && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeletingCodeId(code.id)}
                                      className="text-red-400 hover:text-red-300"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-white">{userCounts.total}</div>
                    <p className="text-slate-400 text-sm">إجمالي الطلبات</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-900/30 border-green-700">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-400">{userCounts.active}</div>
                    <p className="text-slate-400 text-sm">نشطة</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-900/30 border-red-700">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-red-400">{userCounts.expired}</div>
                    <p className="text-slate-400 text-sm">منتهية</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-900/30 border-blue-700">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-400">{userCounts.purchased}</div>
                    <p className="text-slate-400 text-sm">اشتروا</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-700/50 border-slate-600">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-slate-400">{userCounts.not_purchased}</div>
                    <p className="text-slate-400 text-sm">لم يشتروا</p>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="ابحث بالبريد الإلكتروني أو رمز التجربة..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="bg-slate-700 border-slate-600 text-white pr-10"
                      />
                    </div>
                    <Select value={userStatusFilter} onValueChange={setUserStatusFilter}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white w-full md:w-[200px]">
                        <SelectValue placeholder="تصفية حسب الحالة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="active">نشطة</SelectItem>
                        <SelectItem value="expired">منتهية</SelectItem>
                        <SelectItem value="purchased">اشتروا</SelectItem>
                        <SelectItem value="not_purchased">لم يشتروا</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Users Table */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  {usersLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      لا توجد طلبات تجربة
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700">
                            <TableHead className="text-slate-300 cursor-pointer" onClick={() => handleSortUsers('assigned_at')}>
                              <div className="flex items-center gap-1">
                                تاريخ الطلب
                                {userSortField === 'assigned_at' && (
                                  userSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                )}
                                {userSortField !== 'assigned_at' && <ArrowUpDown className="h-4 w-4 opacity-50" />}
                              </div>
                            </TableHead>
                            <TableHead className="text-slate-300">البريد الإلكتروني</TableHead>
                            <TableHead className="text-slate-300 cursor-pointer" onClick={() => handleSortUsers('trial_code')}>
                              <div className="flex items-center gap-1">
                                رمز التجربة
                                {userSortField === 'trial_code' && (
                                  userSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                )}
                                {userSortField !== 'trial_code' && <ArrowUpDown className="h-4 w-4 opacity-50" />}
                              </div>
                            </TableHead>
                            <TableHead className="text-slate-300 cursor-pointer" onClick={() => handleSortUsers('expires_at')}>
                              <div className="flex items-center gap-1">
                                تاريخ الانتهاء
                                {userSortField === 'expires_at' && (
                                  userSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                )}
                                {userSortField !== 'expires_at' && <ArrowUpDown className="h-4 w-4 opacity-50" />}
                              </div>
                            </TableHead>
                            <TableHead className="text-slate-300 cursor-pointer" onClick={() => handleSortUsers('status')}>
                              <div className="flex items-center gap-1">
                                الحالة
                                {userSortField === 'status' && (
                                  userSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                )}
                                {userSortField !== 'status' && <ArrowUpDown className="h-4 w-4 opacity-50" />}
                              </div>
                            </TableHead>
                            <TableHead className="text-slate-300">الإجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map((trialUser) => (
                            <TableRow key={trialUser.id} className="border-slate-700">
                              <TableCell className="text-slate-300">
                                {format(new Date(trialUser.assigned_at), 'yyyy-MM-dd HH:mm', { locale: ar })}
                              </TableCell>
                              <TableCell className="text-white">{trialUser.user_email || '-'}</TableCell>
                              <TableCell className="text-slate-300 font-mono">{trialUser.trial_code}</TableCell>
                              <TableCell className="text-slate-300">
                                {format(new Date(trialUser.expires_at), 'yyyy-MM-dd HH:mm', { locale: ar })}
                                {trialUser.is_expired && (
                                  <Badge className="bg-red-600 mr-2">منتهية</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {trialUser.has_purchased ? (
                                    <Badge className="bg-blue-600 w-fit">BOUGHT OR SUBSCRIBED</Badge>
                                  ) : (
                                    <Badge className="bg-slate-600 w-fit">لم يشتر</Badge>
                                  )}
                                  {trialUser.is_expired && (
                                    <Badge className="bg-red-600 w-fit">انتهت التجربة</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {trialUser.user_email && (
                                  <a
                                    href={`mailto:${trialUser.user_email}`}
                                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                                  >
                                    <Mail className="h-4 w-4" />
                                    إرسال بريد
                                  </a>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              {analyticsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : analytics ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-slate-800/50 border-slate-700">
                      <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-white">{analytics.summary.totalRequests}</div>
                        <p className="text-slate-400 text-sm">إجمالي الطلبات</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-900/30 border-green-700">
                      <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-green-400">{analytics.summary.purchasedCount}</div>
                        <p className="text-slate-400 text-sm">اشتروا</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-900/30 border-red-700">
                      <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-red-400">{analytics.summary.notPurchasedCount}</div>
                        <p className="text-slate-400 text-sm">لم يشتروا</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-900/30 border-blue-700">
                      <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-blue-400">{analytics.summary.conversionRate.toFixed(1)}%</div>
                        <p className="text-slate-400 text-sm">معدل التحويل</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Charts Placeholder */}
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white">التحليلات والرسوم البيانية</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-12 text-slate-400">
                        <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p>سيتم إضافة الرسوم البيانية قريباً</p>
                        <p className="text-sm mt-2">البيانات جاهزة للعرض</p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  لا توجد بيانات تحليلات
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Add/Edit Code Dialog */}
          <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
            <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {editingCode ? 'تعديل رمز التجربة' : 'إضافة رمز تجربة جديد'}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  أدخل مدة الانتهاء وبيانات الدخول المرتبطة برمز التجربة
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="expiry_duration">مدة الانتهاء *</Label>
                  <Select
                    value={codeForm.expiry_duration}
                    onValueChange={(value) => setCodeForm({ ...codeForm, expiry_duration: value })}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="اختر مدة الانتهاء" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 ساعات</SelectItem>
                      <SelectItem value="6">6 ساعات</SelectItem>
                      <SelectItem value="12">12 ساعة</SelectItem>
                      <SelectItem value="24">24 ساعة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="username">اسم المستخدم (يوزر)</Label>
                  <Input
                    id="username"
                    value={codeForm.username}
                    onChange={(e) => setCodeForm({ ...codeForm, username: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    placeholder="username123"
                  />
                </div>
                <div>
                  <Label htmlFor="password">كلمة المرور</Label>
                  <Input
                    id="password"
                    type="password"
                    value={codeForm.password}
                    onChange={(e) => setCodeForm({ ...codeForm, password: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    placeholder="password123"
                  />
                </div>
                <div>
                  <Label htmlFor="link">الرابط</Label>
                  <Input
                    id="link"
                    value={codeForm.link}
                    onChange={(e) => setCodeForm({ ...codeForm, link: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCodeDialogOpen(false)}
                  className="border-slate-600 text-slate-300"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleSaveCode}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  حفظ
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={!!deletingCodeId} onOpenChange={(open) => !open && setDeletingCodeId(null)}>
            <DialogContent className="bg-slate-800 border-slate-700 text-white">
              <DialogHeader>
                <DialogTitle>تأكيد الحذف</DialogTitle>
                <DialogDescription className="text-slate-400">
                  هل أنت متأكد من حذف رمز التجربة هذا؟
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeletingCodeId(null)}
                  className="border-slate-600 text-slate-300"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={() => deletingCodeId && handleDeleteCode(deletingCodeId)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  حذف
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
      <Footer />
    </div>
  );
}

