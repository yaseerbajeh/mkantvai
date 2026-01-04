'use client';

import React, { useEffect, useState } from 'react';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
    Loader2,
    Search,
    Plus,
    Edit,
    Trash2,
    Eye,
    EyeOff,
    Copy,
    Calendar as CalendarIcon,
    ShieldAlert
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

// Interface for Account Stock
interface AccountStock {
    id: string;
    email: string;
    password?: string;
    expiration_date?: string;
    renew_until?: string;
    type?: string;
    notes?: string;
    created_at: string;
}

export default function AccountsStockPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<AccountStock[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Dialog states
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentAccount, setCurrentAccount] = useState<Partial<AccountStock>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Password visibility state map
    const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error || !session?.user) {
                    router.push('/auth');
                    return;
                }

                // Verify admin access
                const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
                if (adminEmailsStr) {
                    const adminEmails = adminEmailsStr.split(',').map(e => e.trim()).filter(Boolean);
                    if (adminEmails.length > 0 && !adminEmails.includes(session.user.email || '')) {
                        router.push('/');
                        return;
                    }
                }

                setUser(session.user);
                await fetchAccounts();
            } catch (error) {
                console.error('Auth error:', error);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, [router]);

    const fetchAccounts = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch('/api/admin/accounts-stock', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch accounts');

            const data = await response.json();
            setAccounts(data.accounts || []);
        } catch (error: any) {
            toast({
                title: 'خطأ',
                description: error.message || 'فشل جلب الحسابات',
                variant: 'destructive',
            });
        }
    };

    const handleSave = async () => {
        if (!currentAccount.email || !currentAccount.password) {
            toast({
                title: 'خطأ',
                description: 'البريد الإلكتروني وكلمة المرور مطلوبان',
                variant: 'destructive',
            });
            return;
        }

        setIsSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const method = isEditing ? 'PUT' : 'POST';
            const body = isEditing ? { id: currentAccount.id, ...currentAccount } : currentAccount;

            const response = await fetch('/api/admin/accounts-stock', {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) throw new Error('Failed to save account');

            toast({
                title: 'نجح',
                description: isEditing ? 'تم تحديث الحساب بنجاح' : 'تم إضافة الحساب بنجاح',
            });

            setIsDialogOpen(false);
            setCurrentAccount({});
            setIsEditing(false);
            await fetchAccounts();
        } catch (error: any) {
            toast({
                title: 'خطأ',
                description: error.message || 'فشل حفظ الحساب',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا الحساب؟')) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch(`/api/admin/accounts-stock?id=${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) throw new Error('Failed to delete account');

            toast({
                title: 'نجح',
                description: 'تم حذف الحساب بنجاح',
            });

            await fetchAccounts();
        } catch (error: any) {
            toast({
                title: 'خطأ',
                description: error.message || 'فشل حذف الحساب',
                variant: 'destructive',
            });
        }
    };

    const togglePasswordVisibility = (id: string) => {
        setVisiblePasswords(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: 'تم النسخ',
            description: 'تم نسخ النص للحافظة',
        });
    };

    const filteredAccounts = accounts.filter(acc =>
        acc.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.notes?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!user) return null;

    const sortedAccounts = [...filteredAccounts].sort((a, b) => {
        if (!a.expiration_date) return 1;
        if (!b.expiration_date) return -1;
        return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
    });

    return (
        <div className="min-h-screen bg-[#F8F9FA]">
            <Header />

            <main className="container mx-auto px-4 py-24 pt-32">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">مخزون الحسابات</h1>
                        <p className="text-gray-500">إدارة ومراقبة مخزون الحسابات والاشتراكات</p>
                    </div>

                    <Button
                        onClick={() => {
                            setCurrentAccount({});
                            setIsEditing(false);
                            setIsDialogOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <Plus className="h-4 w-4 ml-2" />
                        إضافة حساب جديد
                    </Button>
                </div>

                {/* Filters & Search */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="بحث بالبريد، النوع، أو الملاحظات..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pr-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-gray-50">
                                <TableRow>
                                    <TableHead className="text-right font-semibold text-gray-700">البريد الإلكتروني</TableHead>
                                    <TableHead className="text-right font-semibold text-gray-700">كلمة المرور</TableHead>
                                    <TableHead className="text-right font-semibold text-gray-700">تاريخ الانتهاء</TableHead>
                                    <TableHead className="text-right font-semibold text-gray-700">تجديد حتى</TableHead>
                                    <TableHead className="text-right font-semibold text-gray-700">النوع</TableHead>
                                    <TableHead className="text-center font-semibold text-gray-700">الإجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedAccounts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                                            لا توجد حسابات حالياً
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedAccounts.map((account) => {
                                        const isExpiringSoon = account.expiration_date &&
                                            Math.ceil((new Date(account.expiration_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 3;

                                        return (
                                            <TableRow key={account.id} className="hover:bg-gray-50 transition-colors">
                                                <TableCell className="font-medium text-gray-900 dir-ltr text-left">
                                                    <div className="flex items-center gap-2">
                                                        <span className="truncate max-w-[200px]" title={account.email}>{account.email}</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0 hover:bg-gray-200"
                                                            onClick={() => copyToClipboard(account.email)}
                                                        >
                                                            <Copy className="h-3 w-3 text-gray-400" />
                                                        </Button>
                                                    </div>
                                                    {account.notes && (
                                                        <p className="text-xs text-gray-500 mt-1 truncate max-w-[200px]">{account.notes}</p>
                                                    )}
                                                </TableCell>
                                                <TableCell className="dir-ltr text-left">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm min-w-[100px] block text-center">
                                                            {visiblePasswords[account.id] ? account.password : '••••••••'}
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => togglePasswordVisibility(account.id)}
                                                        >
                                                            {visiblePasswords[account.id] ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-gray-500" />}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => copyToClipboard(account.password || '')}
                                                        >
                                                            <Copy className="h-4 w-4 text-gray-500" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {account.expiration_date ? (
                                                        <div className={`flex items-center gap-2 text-sm px-2 py-1 rounded-md w-fit ${isExpiringSoon ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 'text-gray-600'}`}>
                                                            <CalendarIcon className={`h-4 w-4 ${isExpiringSoon ? 'text-yellow-600' : 'text-gray-400'}`} />
                                                            {format(new Date(account.expiration_date), 'yyyy-MM-dd')}
                                                            {isExpiringSoon && <span className="text-xs font-semibold mr-1">(ينتهي قريباً)</span>}
                                                        </div>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {account.renew_until ? (
                                                        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full w-fit">
                                                            <ShieldAlert className="h-3 w-3" />
                                                            {format(new Date(account.renew_until), 'yyyy-MM-dd')}
                                                        </div>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {account.type ? (
                                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                                            {account.type}
                                                        </Badge>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex justify-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setCurrentAccount(account);
                                                                setIsEditing(true);
                                                                setIsDialogOpen(true);
                                                            }}
                                                            className="hover:text-blue-600 hover:bg-blue-50"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(account.id)}
                                                            className="hover:text-red-600 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </main>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'تعديل الحساب' : 'إضافة حساب جديد'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">البريد الإلكتروني</Label>
                            <Input
                                id="email"
                                value={currentAccount.email || ''}
                                onChange={(e) => setCurrentAccount({ ...currentAccount, email: e.target.value })}
                                className="dir-ltr"
                                placeholder="name@example.com"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">كلمة المرور</Label>
                            <Input
                                id="password"
                                value={currentAccount.password || ''}
                                onChange={(e) => setCurrentAccount({ ...currentAccount, password: e.target.value })}
                                className="dir-ltr"
                                placeholder="********"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="expiration">تاريخ الانتهاء</Label>
                                <Input
                                    id="expiration"
                                    type="date"
                                    value={currentAccount.expiration_date || ''}
                                    onChange={(e) => setCurrentAccount({ ...currentAccount, expiration_date: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="renew_until">تجديد حتى</Label>
                                <Input
                                    id="renew_until"
                                    type="date"
                                    value={currentAccount.renew_until || ''}
                                    onChange={(e) => setCurrentAccount({ ...currentAccount, renew_until: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="type">النوع</Label>
                            <Input
                                id="type"
                                value={currentAccount.type || ''}
                                onChange={(e) => setCurrentAccount({ ...currentAccount, type: e.target.value })}
                                placeholder="مثال: Premium, Basic, Netflix..."
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="notes">ملاحظات</Label>
                            <Textarea
                                id="notes"
                                value={currentAccount.notes || ''}
                                onChange={(e) => setCurrentAccount({ ...currentAccount, notes: e.target.value })}
                                placeholder="ملاحظات إضافية..."
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                            حفظ
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <Footer />
        </div>
    );
}
