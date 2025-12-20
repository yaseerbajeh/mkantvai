
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import {
    Loader2,
    Trash2,
    Star,
    MessageCircle,
    ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

// Helper for relative time
function timeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " سنة";

    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " شهر";

    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " يوم";

    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " ساعة";

    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " دقيقة";

    return Math.floor(seconds) + " ثانية";
}

interface Review {
    id: string;
    created_at: string;
    order_id: string;
    product_code: string;
    user_email: string;
    rating: number;
    comment: string | null;
}

export default function AdminRatingsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);

    const fetchReviews = async () => {
        try {
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.push('/auth');
                return;
            }

            const response = await fetch('/api/admin/reviews', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setReviews(data.reviews || []);
            } else {
                const error = await response.json();
                toast({
                    title: 'خطأ',
                    description: error.error || 'فشل في جلب التقييمات',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Error fetching reviews:', error);
            toast({
                title: 'خطأ',
                description: 'حدث خطأ غير متوقع',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا التقييم؟ لا يمكن التراجع عن هذا الإجراء.')) {
            return;
        }

        try {
            setActionLoading(id);
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) return;

            const response = await fetch(`/api/admin/reviews?id=${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            if (response.ok) {
                toast({
                    title: 'تم بنجاح',
                    description: 'تم حذف التقييم',
                    className: 'bg-green-500 text-white',
                });
                // Remove from list
                setReviews(prev => prev.filter(r => r.id !== id));
            } else {
                const error = await response.json();
                toast({
                    title: 'خطأ',
                    description: error.error || 'فشل في حذف التقييم',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Error deleting review:', error);
            toast({
                title: 'خطأ',
                description: 'حدث خطأ أثناء الحذف',
                variant: 'destructive',
            });
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Header />
                <main className="container mx-auto px-4 py-24 pt-32">
                    <div className="flex justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <main className="container mx-auto px-4 py-24 pt-32">
                <div className="max-w-6xl mx-auto">

                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">إدارة التقييمات</h1>
                            <p className="text-gray-600">عرض وحذف تقييمات العملاء</p>
                        </div>
                        <Link href="/admin">
                            <Button variant="outline" className="gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                عودة للوحة التحكم
                            </Button>
                        </Link>
                    </div>

                    <div className="grid gap-6">
                        {reviews.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center text-gray-500">
                                    <Star className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                    <p>لا توجد تقييمات حتى الآن</p>
                                </CardContent>
                            </Card>
                        ) : (
                            reviews.map((review) => (
                                <Card key={review.id} className="overflow-hidden">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="flex">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <Star
                                                                key={star}
                                                                className={`w-4 h-4 ${star <= review.rating
                                                                        ? 'fill-yellow-400 text-yellow-400'
                                                                        : 'text-gray-300'
                                                                    }`}
                                                            />
                                                        ))}
                                                    </div>
                                                    <span className="text-sm text-gray-400">•</span>
                                                    <span className="text-sm font-medium text-gray-900">{review.user_email}</span>
                                                </div>

                                                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                                                    <p className="text-gray-700 italic">
                                                        {review.comment ? `"${review.comment}"` : <span className="text-gray-400 not-italic">بدون تعليق</span>}
                                                    </p>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                                        Product: {review.product_code}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        منذ {timeAgo(review.created_at)}
                                                    </span>
                                                    <span>
                                                        ID: {review.id}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 self-end md:self-start">
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => handleDelete(review.id)}
                                                    disabled={actionLoading === review.id}
                                                    className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                                                >
                                                    {actionLoading === review.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                    <span className="mr-2">حذف</span>
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
