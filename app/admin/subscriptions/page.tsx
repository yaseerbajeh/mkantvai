'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  Search,
  Plus,
  Upload,
  RefreshCw,
  Calendar as CalendarIcon,
  Phone,
  Mail,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Download,
  FileText,
  X,
  Sparkles,
  PenSquare,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { calculateExpirationDate, parseDurationToDays } from '@/lib/subscription-utils';

interface ActiveSubscription {
  id: string;
  order_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  subscription_code: string;
  subscription_type: string; // Now accepts any string (category name)
  subscription_duration: string;
  expiration_date: string;
  due_days: number;
  start_date: string;
  product_code: string | null;
  reminder_sent: boolean;
  reminder_sent_at: string | null;
  last_contacted_at: string | null;
  renewed_from_subscription_id: string | null;
  is_renewed: boolean;
  renewal_count: number;
  created_at: string;
  updated_at: string;
}

export default function AdminSubscriptionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<ActiveSubscription[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<ActiveSubscription[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; name_en?: string }>>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Dialogs
  const [manualEntryDialogOpen, setManualEntryDialogOpen] = useState(false);
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<ActiveSubscription | null>(null);
  const [renewalDuration, setRenewalDuration] = useState<string>('');
  
  // Refresh subscription dialog
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const [refreshingSubscription, setRefreshingSubscription] = useState(false);
  
  // Subscription code view dialog
  const [viewCodeDialogOpen, setViewCodeDialogOpen] = useState(false);
  const [viewingSubscriptionCode, setViewingSubscriptionCode] = useState<string>('');
  
  // Edit subscription dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<ActiveSubscription | null>(null);
  
  // Manual entry form
  const [manualForm, setManualForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    subscription_code: '',
    subscription_type: '', // Now accepts any category name
    subscription_duration: '1 شهر',
    start_date: new Date(),
    expiration_date: new Date(),
    product_code: '',
  });
  
  // CSV import
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  
  // Actions
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());

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
        fetchSubscriptions();
        fetchCategories();
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

  // Filter and sort subscriptions
  useEffect(() => {
    let filtered = [...subscriptions];

    // Filter by type (category name exact match)
    if (typeFilter !== 'all') {
      filtered = filtered.filter(sub => sub.subscription_type === typeFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(sub =>
        (sub.id && sub.id.toLowerCase().includes(query)) ||
        (sub.customer_name && sub.customer_name.toLowerCase().includes(query)) ||
        (sub.customer_email && sub.customer_email.toLowerCase().includes(query)) ||
        (sub.customer_phone && sub.customer_phone.toLowerCase().includes(query)) ||
        (sub.subscription_code && sub.subscription_code.toLowerCase().includes(query))
      );
    }

    // Sort by expiration date (soonest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.expiration_date).getTime();
      const dateB = new Date(b.expiration_date).getTime();
      return dateA - dateB;
    });

    setFilteredSubscriptions(filtered);
  }, [subscriptions, searchQuery, typeFilter]);

  const calculateDueDays = (expirationDate: string): number => {
    const now = new Date();
    const expiration = new Date(expirationDate);
    const diffTime = expiration.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Fetch categories for manual entry form
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, name_en')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching categories:', error);
        return;
      }

      setCategories(data || []);
      
      // Set default category if form is empty (only if form hasn't been initialized yet)
      // Only set default when dialog is closed to avoid overriding user selections
      if (data && data.length > 0 && !manualEntryDialogOpen) {
        setManualForm(prev => {
          // Only set default if subscription_type is empty
          if (!prev.subscription_type) {
            return { ...prev, subscription_type: data[0].name };
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Fetch product details by product_code to get duration
  const fetchProductByCode = async (productCode: string) => {
    if (!productCode || productCode.trim() === '') {
      return null;
    }
    
    try {
      const response = await fetch('/api/admin/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      const { products, error } = await response.json();
      if (error) {
        console.error('Error fetching products:', error);
        return null;
      }

      // Find product by product_code
      const product = (products || []).find((p: any) => p.product_code === productCode.trim());
      return product || null;
    } catch (error) {
      console.error('Error fetching product:', error);
      return null;
    }
  };

  // Helper function to get subscription type from category name
  // Use category name directly as subscription_type (no mapping)
  const getSubscriptionTypeFromCategory = (
    categoryName: string | null | undefined,
    productCode: string | null | undefined
  ): string => {
    // Use category name directly if available
    if (categoryName) {
      return categoryName;
    }
    
    // Fallback: if no category, use a default based on product code
    // This should rarely happen if products are properly categorized
    if (productCode) {
      const productCodeUpper = productCode.toUpperCase();
      if (productCodeUpper.startsWith('SUB-PREMIUM-')) {
        return 'الاشتراكات المميزة'; // Default category name
      }
      if (productCodeUpper.includes('PACKAGE')) {
        return 'البكجات'; // Default category name
      }
      if (productCodeUpper.includes('SHAHID')) {
        return 'شاهد'; // Default category name
      }
      if (productCodeUpper.includes('BASIC') || productCodeUpper.includes('ANNUAL')) {
        return 'اشتراكات IPTV'; // Default category name
      }
    }
    
    // Final fallback
    return 'اشتراكات IPTV';
  };

  const fetchSubscriptions = async () => {
    try {
      // Fetch subscriptions
      const { data: subscriptionsData, error: subscriptionsError } = await supabase
        .from('active_subscriptions')
        .select('*')
        .order('expiration_date', { ascending: true });

      if (subscriptionsError) {
        console.error('Error fetching subscriptions:', subscriptionsError);
        toast({
          title: 'خطأ',
          description: subscriptionsError.message || 'حدث خطأ أثناء جلب الاشتراكات',
          variant: 'destructive',
        });
        return;
      }

      // Fetch all valid category names to check if manually set categories are valid
      const { data: validCategories } = await supabase
        .from('categories')
        .select('name, name_en')
        .eq('is_active', true);

      // Create a set of valid category names (both Arabic and English)
      const validCategoryNames = new Set<string>();
      if (validCategories) {
        validCategories.forEach((cat) => {
          if (cat.name) validCategoryNames.add(cat.name);
          if (cat.name_en) validCategoryNames.add(cat.name_en);
        });
      }

      // Helper function to check if a subscription_type is a valid category name
      const isValidCategoryName = (subscriptionType: string | null | undefined): boolean => {
        if (!subscriptionType) return false;
        return validCategoryNames.has(subscriptionType);
      };

      // Old format subscription types that should be overridden
      const oldFormats = ['iptv', 'shahid', 'netflix', 'package'];

      // Get unique product codes from subscriptions
      const productCodes = [...new Set((subscriptionsData || [])
        .map((sub: any) => sub.product_code)
        .filter(Boolean))];

      // Fetch products with categories and durations for those product codes
      let productsMap: { [key: string]: any } = {};
      let productsDurationMap: { [key: string]: string } = {};
      if (productCodes.length > 0) {
        const { data: productsData } = await supabase
          .from('products')
          .select(`
            product_code,
            duration,
            category_id,
            categories:category_id (
              name,
              name_en
            )
          `)
          .in('product_code', productCodes);

        // Create maps of product_code -> category and product_code -> duration
        if (productsData) {
          productsData.forEach((product: any) => {
            productsMap[product.product_code] = product.categories;
            if (product.duration) {
              productsDurationMap[product.product_code] = product.duration;
            }
          });
        }
      }

      // Process subscriptions: calculate due_days, fix expiration_date if needed, and override subscription_type from category
      const subscriptionsToUpdate: Array<{ id: string; expiration_date: string; subscription_duration: string }> = [];
      
      const subscriptionsWithDueDays = (subscriptionsData || []).map((sub: any) => {
        // Get category from products map (fetched from categories table)
        const category = productsMap[sub.product_code] || null;
        // Priority: use Arabic name first, then English name
        const categoryName = category?.name || category?.name_en || null;
        
        // Determine subscription type from category name (from categories table) and product code
        // Category name is the primary source of truth
        const correctSubscriptionType = getSubscriptionTypeFromCategory(
          categoryName,
          sub.product_code
        );
        
        // Check if current subscription_type should be preserved or overridden
        const currentSubscriptionType = sub.subscription_type;
        const isCurrentTypeValid = isValidCategoryName(currentSubscriptionType);
        const isCurrentTypeOldFormat = currentSubscriptionType && oldFormats.includes(currentSubscriptionType.toLowerCase());
        
        // Only override if:
        // 1. Current type is empty/null
        // 2. Current type is an old format (iptv, shahid, netflix, package)
        // 3. Current type is not a valid category name
        let finalSubscriptionType = currentSubscriptionType;
        if (!currentSubscriptionType || isCurrentTypeOldFormat || !isCurrentTypeValid) {
          // Override with the correct type from product category
          finalSubscriptionType = correctSubscriptionType;
        }
        // Otherwise, preserve the manually set valid category
        
        // Check if expiration_date needs to be recalculated based on product duration
        let expirationDate = sub.expiration_date;
        
        if (sub.product_code && productsDurationMap[sub.product_code] && sub.start_date) {
          // Get product duration
          const productDuration = productsDurationMap[sub.product_code];
          
          // Calculate correct expiration date based on start_date + product duration
          const correctExpirationDate = calculateExpirationDate(sub.start_date, productDuration);
          const currentExpirationDate = new Date(sub.expiration_date);
          const correctExpirationDateObj = new Date(correctExpirationDate);
          
          // Check if expiration date is incorrect (more than 2 days difference)
          const daysDifference = Math.abs((correctExpirationDateObj.getTime() - currentExpirationDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDifference > 2) {
            // Expiration date is incorrect, mark for update
            expirationDate = correctExpirationDate.toISOString();
            subscriptionsToUpdate.push({
              id: sub.id,
              expiration_date: expirationDate,
              subscription_duration: productDuration
            });
            
            console.log(`Subscription ${sub.id} expiration date needs update:`, {
              productCode: sub.product_code,
              currentExpiration: sub.expiration_date,
              correctExpiration: expirationDate,
              productDuration: productDuration,
              daysDifference: daysDifference.toFixed(1)
            });
          }
        }
        
        // Debug logging (can be removed in production)
        if (sub.product_code && categoryName) {
          console.log('Subscription type determination:', {
            productCode: sub.product_code,
            categoryName: categoryName,
            currentType: currentSubscriptionType,
            isCurrentTypeValid: isCurrentTypeValid,
            determinedType: correctSubscriptionType,
            finalType: finalSubscriptionType
          });
        }
        
        return {
          ...sub,
          expiration_date: expirationDate,
          due_days: calculateDueDays(expirationDate),
          subscription_type: finalSubscriptionType, // Preserve valid manually set categories, override only if needed
        };
      });

      // Update subscriptions with corrected expiration dates
      if (subscriptionsToUpdate.length > 0) {
        console.log(`Updating ${subscriptionsToUpdate.length} subscriptions with corrected expiration dates...`);
        for (const update of subscriptionsToUpdate) {
          const { error: updateError } = await supabase
            .from('active_subscriptions')
            .update({ 
              expiration_date: update.expiration_date,
              subscription_duration: update.subscription_duration
            })
            .eq('id', update.id);
          
          if (updateError) {
            console.error(`Error updating subscription ${update.id}:`, updateError);
          }
        }
        console.log(`Updated ${subscriptionsToUpdate.length} subscriptions.`);
      }

      setSubscriptions(subscriptionsWithDueDays);
    } catch (error: any) {
      console.error('Error fetching subscriptions:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء جلب الاشتراكات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntry = async () => {
    try {
      const { error } = await supabase
        .from('active_subscriptions')
        .insert({
          customer_name: manualForm.customer_name,
          customer_email: manualForm.customer_email,
          customer_phone: manualForm.customer_phone || null,
          subscription_code: manualForm.subscription_code,
          subscription_type: manualForm.subscription_type,
          subscription_duration: manualForm.subscription_duration,
          start_date: manualForm.start_date.toISOString(),
          expiration_date: manualForm.expiration_date.toISOString(),
          product_code: manualForm.product_code || null,
        });

      if (error) throw error;

      toast({
        title: 'نجح',
        description: 'تم إضافة الاشتراك بنجاح',
      });

      setManualEntryDialogOpen(false);
      setManualForm({
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        subscription_code: '',
        subscription_type: categories.length > 0 ? categories[0].name : '',
        subscription_duration: '1 شهر',
        start_date: new Date(),
        expiration_date: new Date(),
        product_code: '',
      });
      fetchSubscriptions();
    } catch (error: any) {
      console.error('Error adding subscription:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إضافة الاشتراك',
        variant: 'destructive',
      });
    }
  };

  const downloadCSVTemplate = () => {
    // CSV template with headers and example row
    const headers = [
      'customer_name',
      'customer_email',
      'customer_phone',
      'subscription_code',
      'subscription_type',
      'subscription_duration',
      'expiration_date',
      'start_date',
      'product_code'
    ];
    
    // Example data row
    // Note: If product_code (SUB-BASIC-3M) is provided, duration and expiration_date will be auto-calculated
    const exampleRow = [
      'محمد أحمد',
      'email@example.com',
      '966501234567',
      'SUB-001',
      'اشتراكات IPTV',
      '3 أشهر',
      '2025-04-15',
      '2025-01-15',
      'SUB-BASIC-3M'
    ];
    
    // Create CSV content with BOM for UTF-8 support
    const csvContent = [
      headers.join(','),
      exampleRow.join(','),
      '', // Empty row for clarity
      '# ملاحظات:',
      '# - customer_name و customer_email و customer_phone و product_code حقول اختيارية',
      '# - product_code: إذا تم إدخاله، سيتم جلب المدة من جدول المنتجات تلقائياً',
      '# - product_code: عند استخدامه، سيتم حساب expiration_date تلقائياً بناءً على start_date والمدة',
      '# - subscription_type: يمكن أن يكون اسم التصنيف (مثل "اشتراكات IPTV" أو "نتـFlix") أو الأنواع القديمة (iptv, shahid, netflix, package)',
      '# - subscription_duration: مثال: "1 شهر", "3 أشهر", "6 أشهر", "12 شهر", "مدى الحياة"',
      '# - subscription_duration: إذا تم إدخال product_code، سيتم استبدال هذا الحقل تلقائياً بالمدة من المنتج',
      '# - expiration_date: سيتم إعادة حسابه تلقائياً إذا تم إدخال product_code',
      '# - التواريخ بصيغة: YYYY-MM-DD (مثال: 2025-04-15)',
      '# - يُنصح بإدخال product_code لتحديث المدة والتواريخ تلقائياً'
    ].join('\n');
    
    // Create blob with UTF-8 BOM for Excel compatibility
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'subscriptions-template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleCSVImport = async () => {
    if (!csvFile) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار ملف CSV',
        variant: 'destructive',
      });
      return;
    }

    // Validate file type
    if (!csvFile.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار ملف CSV صحيح',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    try {
      // Read file content
      const csvText = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve(e.target?.result as string);
        };
        reader.onerror = (e) => {
          reject(new Error('فشل في قراءة الملف'));
        };
        reader.readAsText(csvFile, 'UTF-8');
      });

      const response = await fetch('/api/admin/subscriptions/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل استيراد البيانات');
      }

      toast({
        title: 'نجح',
        description: `تم استيراد ${result.imported} اشتراك بنجاح`,
      });

      setCsvImportDialogOpen(false);
      setCsvFile(null);
      fetchSubscriptions();
    } catch (error: any) {
      console.error('Error importing CSV:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء استيراد البيانات',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleRenew = async (subscription: ActiveSubscription) => {
    setSelectedSubscription(subscription);
    setRenewalDuration(subscription.subscription_duration); // Default to current duration
    setRenewDialogOpen(true);
  };

  const confirmRenew = async () => {
    if (!selectedSubscription) return;

    // Ensure we use the selected renewal duration, not the original
    const durationToSend = renewalDuration || selectedSubscription.subscription_duration;
    
    console.log('Frontend - Renewal preparation:', {
      subscriptionId: selectedSubscription.id,
      renewalDurationState: renewalDuration,
      selectedSubscriptionDuration: selectedSubscription.subscription_duration,
      durationToSend: durationToSend,
      isEmpty: !renewalDuration || renewalDuration === '',
    });

    setActionLoading(prev => new Set(prev).add(selectedSubscription.id));
    try {
      const requestBody = {
        subscriptionId: selectedSubscription.id,
        newDuration: durationToSend,
      };
      
      console.log('Sending renewal request:', requestBody);
      
      const response = await fetch('/api/admin/subscriptions/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      console.log('Renewal response:', result);

      if (!response.ok) {
        throw new Error(result.error || 'فشل تجديد الاشتراك');
      }

      toast({
        title: 'نجح',
        description: 'تم تجديد الاشتراك بنجاح',
      });

      setRenewDialogOpen(false);
      setSelectedSubscription(null);
      setRenewalDuration('');
      
      // Force refresh subscriptions immediately
      // Clear any cached data first
      setSubscriptions([]);
      
      // Small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await fetchSubscriptions();
      console.log('Subscriptions refreshed after renewal');
      console.log('Renewed subscription should have expiration:', result.renewalDetails?.newExpirationDate);
      console.log('Updated subscription data:', result.subscription);
      
      // Verify the subscription was updated in the fetched data
      // Wait a bit more for state to update
      setTimeout(() => {
        const updated = subscriptions.find(s => s.id === result.subscription?.id);
        if (updated) {
          console.log('Found updated subscription in list:', {
            id: updated.id,
            expiration: updated.expiration_date,
            startDate: updated.start_date,
            expectedExpiration: result.renewalDetails?.newExpirationDate,
            expectedStartDate: result.renewalDetails?.newStartDate,
            expirationMatches: updated.expiration_date === result.renewalDetails?.newExpirationDate || 
                              Math.abs(new Date(updated.expiration_date).getTime() - new Date(result.renewalDetails?.newExpirationDate || 0).getTime()) < 1000,
            startDateMatches: updated.start_date === result.renewalDetails?.newStartDate ||
                             Math.abs(new Date(updated.start_date).getTime() - new Date(result.renewalDetails?.newStartDate || 0).getTime()) < 1000,
          });
        } else {
          console.warn('Updated subscription not found in list after refresh');
        }
      }, 500);
    } catch (error: any) {
      console.error('Error renewing subscription:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء تجديد الاشتراك',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedSubscription.id);
        return newSet;
      });
    }
  };

  const handleReminderSent = async (subscription: ActiveSubscription) => {
    setActionLoading(prev => new Set(prev).add(subscription.id));
    try {
      const response = await fetch('/api/admin/subscriptions/update-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subscription.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل تحديث حالة التذكير');
      }

      toast({
        title: 'نجح',
        description: 'تم تحديث حالة التذكير',
      });

      fetchSubscriptions();
    } catch (error: any) {
      console.error('Error updating reminder:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء تحديث حالة التذكير',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(subscription.id);
        return newSet;
      });
    }
  };

  const handleCleanupExpired = async () => {
    try {
      const response = await fetch('/api/admin/subscriptions/cleanup-expired', {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل نقل الاشتراكات المنتهية');
      }

      toast({
        title: 'نجح',
        description: `تم نقل ${result.movedCount} اشتراك منتهي`,
      });

      fetchSubscriptions();
    } catch (error: any) {
      console.error('Error cleaning up expired:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء نقل الاشتراكات المنتهية',
        variant: 'destructive',
      });
    }
  };

  const handleRefreshSubscription = async (subscription: ActiveSubscription) => {
    setSelectedSubscription(subscription);
    setRefreshDialogOpen(true);
  };

  const confirmRefreshSubscription = async () => {
    if (!selectedSubscription) return;

    setRefreshingSubscription(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: 'خطأ',
          description: 'يرجى تسجيل الدخول',
          variant: 'destructive',
        });
        return;
      }

      // Use order_id if available, otherwise use active_subscription_id
      const requestBody: any = {};
      if (selectedSubscription.order_id) {
        requestBody.order_id = selectedSubscription.order_id;
      } else {
        requestBody.active_subscription_id = selectedSubscription.id;
      }

      const response = await fetch('/api/admin/subscriptions/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في تحديث الاشتراك');
      }

      toast({
        title: 'نجح',
        description: 'تم تحديث الاشتراك بنجاح وإرسال التفاصيل للعميل',
      });

      setRefreshDialogOpen(false);
      setSelectedSubscription(null);
      
      // Refresh subscriptions list
      await fetchSubscriptions();
    } catch (error: any) {
      console.error('Error refreshing subscription:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء تحديث الاشتراك',
        variant: 'destructive',
      });
    } finally {
      setRefreshingSubscription(false);
    }
  };

  const handleDeleteSubscription = async (subscription: ActiveSubscription) => {
    if (!confirm(`هل أنت متأكد من حذف اشتراك ${subscription.customer_name}؟ سيتم نقله إلى الاشتراكات المنتهية.`)) {
      return;
    }

    setActionLoading(prev => new Set(prev).add(subscription.id));
    try {
      const response = await fetch('/api/admin/subscriptions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subscription.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل حذف الاشتراك');
      }

      toast({
        title: 'نجح',
        description: 'تم نقل الاشتراك إلى الاشتراكات المنتهية',
      });

      fetchSubscriptions();
    } catch (error: any) {
      console.error('Error deleting subscription:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء حذف الاشتراك',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(subscription.id);
        return newSet;
      });
    }
  };

  const exportToCSV = () => {
    const headers = [
      'اسم العميل',
      'البريد الإلكتروني',
      'رقم الهاتف',
      'رمز الاشتراك',
      'نوع الاشتراك',
      'مدة الاشتراك',
      'تاريخ البدء',
      'تاريخ الانتهاء',
      'الأيام المتبقية',
      'رمز المنتج',
      'عدد التجديدات',
      'تم إرسال التذكير',
    ];
    
    const rows = filteredSubscriptions.map(sub => [
      sub.customer_name || '',
      sub.customer_email || '',
      sub.customer_phone || '',
      sub.subscription_code || '',
      sub.subscription_type || '',
      sub.subscription_duration || '',
      format(new Date(sub.start_date), 'yyyy-MM-dd', { locale: ar }),
      sub.expiration_date ? format(new Date(sub.expiration_date), 'yyyy-MM-dd', { locale: ar }) : '',
      sub.due_days.toString(),
      sub.product_code || '',
      (sub.renewal_count || 0).toString(),
      sub.reminder_sent ? 'نعم' : 'لا',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `subscriptions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    toast({
      title: 'نجح',
      description: `تم تصدير ${filteredSubscriptions.length} اشتراك`,
    });
  };

  const handleEditSubscription = (subscription: ActiveSubscription) => {
    setEditingSubscription(subscription);
    setManualForm({
      customer_name: subscription.customer_name,
      customer_email: subscription.customer_email,
      customer_phone: subscription.customer_phone || '',
      subscription_code: subscription.subscription_code,
      subscription_type: subscription.subscription_type,
      subscription_duration: subscription.subscription_duration,
      start_date: new Date(subscription.start_date),
      expiration_date: new Date(subscription.expiration_date),
      product_code: subscription.product_code || '',
    });
    setEditDialogOpen(true);
  };

  const handleUpdateSubscription = async () => {
    if (!editingSubscription) return;

    try {
      const { error } = await supabase
        .from('active_subscriptions')
        .update({
          customer_name: manualForm.customer_name,
          customer_email: manualForm.customer_email,
          customer_phone: manualForm.customer_phone || null,
          subscription_code: manualForm.subscription_code,
          subscription_type: manualForm.subscription_type,
          subscription_duration: manualForm.subscription_duration,
          start_date: manualForm.start_date.toISOString(),
          expiration_date: manualForm.expiration_date.toISOString(),
          product_code: manualForm.product_code || null,
        })
        .eq('id', editingSubscription.id);

      if (error) throw error;

      toast({
        title: 'نجح',
        description: 'تم تحديث الاشتراك بنجاح',
      });

      setEditDialogOpen(false);
      setEditingSubscription(null);
      setManualForm({
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        subscription_code: '',
        subscription_type: categories.length > 0 ? categories[0].name : '',
        subscription_duration: '1 شهر',
        start_date: new Date(),
        expiration_date: new Date(),
        product_code: '',
      });
      fetchSubscriptions();
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء تحديث الاشتراك',
        variant: 'destructive',
      });
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const total = subscriptions.length;
    const expiringSoon = subscriptions.filter(s => s.due_days <= 4 && s.due_days > 0).length;
    const expired = subscriptions.filter(s => s.due_days <= 0).length;
    const byType = {
      // Count subscriptions by category name (dynamic based on actual category names)
      iptv: subscriptions.filter(s => 
        s.subscription_type?.includes('IPTV') || s.subscription_type?.includes('iptv') || 
        s.subscription_type === 'اشتراكات IPTV'
      ).length,
      shahid: subscriptions.filter(s => 
        s.subscription_type?.includes('شاهد') || s.subscription_type?.includes('Shahid') || 
        s.subscription_type?.includes('shahid')
      ).length,
      netflix: subscriptions.filter(s => 
        s.subscription_type?.includes('نتـFlix') || s.subscription_type?.includes('نتفليكس') || 
        s.subscription_type?.includes('Netflix') || s.subscription_type?.includes('netflix') ||
        s.subscription_type?.includes('مميزة') || s.subscription_type === 'الاشتراكات المميزة'
      ).length,
      package: subscriptions.filter(s => 
        s.subscription_type?.includes('باقة') || s.subscription_type?.includes('package') || 
        s.subscription_type?.includes('بكجات') || s.subscription_type === 'البكجات'
      ).length,
    };
    const renewed = subscriptions.filter(s => (s.renewal_count || 0) > 0).length;
    const renewalRate = total > 0 ? ((renewed / total) * 100).toFixed(1) : '0';

    return {
      total,
      expiringSoon,
      expired,
      byType,
      renewed,
      renewalRate,
    };
  }, [subscriptions]);

  // Expiring soon subscriptions (4 days)
  const expiringSoon = useMemo(() => {
    return subscriptions.filter(s => s.due_days <= 4 && s.due_days > 0);
  }, [subscriptions]);

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';

  const getWhatsAppUrl = (phone: string | null) => {
    if (!phone) return '';
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent('مرحباً، نود تذكيرك بأن اشتراكك على وشك الانتهاء. يرجى التواصل معنا لتجديد الاشتراك.');
    return `https://wa.me/${cleanPhone}?text=${message}`;
  };

  const getEmailUrl = (email: string) => {
    const subject = encodeURIComponent('تجديد الاشتراك');
    const body = encodeURIComponent('مرحباً، نود تذكيرك بأن اشتراكك على وشك الانتهاء. يرجى التواصل معنا لتجديد الاشتراك.');
    return `mailto:${email}?subject=${subject}&body=${body}`;
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
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">إدارة الإشتراكات</h1>
            <p className="text-slate-300">إدارة وتتبع اشتراكات العملاء</p>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">إجمالي الاشتراكات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">على وشك الانتهاء (4 أيام)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-400">{stats.expiringSoon}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">منتهية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">{stats.expired}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">معدل التجديد</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">{stats.renewalRate}%</div>
                <div className="text-xs text-slate-400 mt-1">{stats.renewed} من {stats.total}</div>
              </CardContent>
            </Card>
          </div>

          {/* Expiring Soon Banner */}
          {expiringSoon.length > 0 && (
            <Card className="bg-orange-500/10 border-orange-500/50 mb-6">
              <CardHeader>
                <CardTitle className="text-orange-400 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  اشتراكات على وشك الانتهاء ({expiringSoon.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {expiringSoon.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="text-white font-medium">{sub.customer_name}</div>
                        <div className="text-sm text-slate-300">{sub.customer_email}</div>
                        <div className="text-xs text-slate-400">
                          {sub.subscription_type || 'غير محدد'} • ينتهي في {sub.due_days} يوم
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {sub.customer_phone && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-500 text-green-400 hover:bg-green-500/10"
                            onClick={() => window.open(getWhatsAppUrl(sub.customer_phone), '_blank')}
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
                          onClick={() => window.open(getEmailUrl(sub.customer_email), '_blank')}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={sub.reminder_sent ? 'default' : 'outline'}
                          onClick={() => handleReminderSent(sub)}
                          disabled={actionLoading.has(sub.id)}
                        >
                          {actionLoading.has(sub.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <MessageSquare className="h-4 w-4 mr-1" />
                              {sub.reminder_sent ? 'تم الإرسال' : 'إرسال تذكير'}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions Bar */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="بحث برقم الاشتراك (#)، الاسم، البريد الإلكتروني، أو رمز الاشتراك..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700 text-white">
                <SelectValue placeholder="نوع الاشتراك" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأنواع</SelectItem>
                {/* Show unique category names from subscriptions */}
                {Array.from(new Set(subscriptions.map(s => s.subscription_type).filter(Boolean))).map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => setManualEntryDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              إضافة يدوي
            </Button>
            <Button
              onClick={() => setCsvImportDialogOpen(true)}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <Upload className="h-4 w-4 mr-2" />
              استيراد CSV
            </Button>
            <Button
              onClick={handleCleanupExpired}
              variant="outline"
              className="border-red-600 text-red-400 hover:bg-red-600/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              نقل المنتهية
            </Button>
            <Button
              onClick={fetchSubscriptions}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              تحديث
            </Button>
            <Button
              onClick={exportToCSV}
              variant="outline"
              className="border-green-600 text-green-400 hover:bg-green-600/10"
              disabled={filteredSubscriptions.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              تصدير CSV
            </Button>
          </div>

          {/* Subscriptions Table */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">العميل</TableHead>
                      <TableHead className="text-slate-300">نوع الاشتراك</TableHead>
                      <TableHead className="text-slate-300">رمز الاشتراك</TableHead>
                      <TableHead className="text-slate-300">تاريخ البدء</TableHead>
                      <TableHead className="text-slate-300">تاريخ الانتهاء</TableHead>
                      <TableHead className="text-slate-300">الأيام المتبقية</TableHead>
                      <TableHead className="text-slate-300">التجديد</TableHead>
                      <TableHead className="text-slate-300">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubscriptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                          لا توجد اشتراكات
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSubscriptions.map((sub) => (
                        <TableRow key={sub.id} className="border-slate-700">
                          <TableCell>
                            <div>
                              <div className="text-white font-medium">{sub.customer_name}</div>
                              <div className="text-sm text-slate-400">{sub.customer_email}</div>
                              {sub.customer_phone && (
                                <div className="text-xs text-slate-500">{sub.customer_phone}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                // Dynamic badge styling based on category name content
                                sub.subscription_type?.includes('IPTV') || sub.subscription_type?.includes('iptv')
                                  ? 'border-purple-500 text-purple-400'
                                  : sub.subscription_type?.includes('نتـFlix') || sub.subscription_type?.includes('نتفليكس') || sub.subscription_type?.includes('Netflix') || sub.subscription_type?.includes('netflix') || sub.subscription_type?.includes('مميزة')
                                  ? 'border-red-500 text-red-400'
                                  : sub.subscription_type?.includes('شاهد') || sub.subscription_type?.includes('Shahid') || sub.subscription_type?.includes('shahid')
                                  ? 'border-blue-500 text-blue-400'
                                  : sub.subscription_type?.includes('باقة') || sub.subscription_type?.includes('package') || sub.subscription_type?.includes('بكجات')
                                  ? 'border-green-500 text-green-400'
                                  : 'border-gray-500 text-gray-400' // Default for unknown categories
                              }
                            >
                              {sub.subscription_type || 'غير محدد'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-300">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 text-slate-400 hover:text-white"
                              onClick={() => {
                                setViewingSubscriptionCode(sub.subscription_code);
                                setViewCodeDialogOpen(true);
                              }}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              عرض
                            </Button>
                          </TableCell>
                          <TableCell className="text-slate-300">
                            {format(new Date(sub.start_date), 'yyyy-MM-dd', { locale: ar })}
                          </TableCell>
                          <TableCell className="text-slate-300">
                            {sub.expiration_date ? format(new Date(sub.expiration_date), 'yyyy-MM-dd', { locale: ar }) : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                sub.due_days <= 0
                                  ? 'destructive'
                                  : sub.due_days <= 4
                                  ? 'default'
                                  : 'outline'
                              }
                              className={
                                sub.due_days <= 0
                                  ? 'bg-red-500'
                                  : sub.due_days <= 4
                                  ? 'bg-orange-500'
                                  : 'border-slate-600 text-slate-300'
                              }
                            >
                              {sub.due_days <= 0 ? 'منتهي' : `${sub.due_days} يوم`}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-300">
                            {(sub.renewal_count || 0) > 0 ? (
                              <Badge variant="outline" className="border-green-500 text-green-400">
                                تم التجديد ({sub.renewal_count})
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {sub.customer_phone && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => window.open(getWhatsAppUrl(sub.customer_phone), '_blank')}
                                  className="text-green-400 hover:text-green-300"
                                >
                                  <Phone className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(getEmailUrl(sub.customer_email), '_blank')}
                                className="text-blue-400 hover:text-blue-300"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRenew(sub)}
                                disabled={actionLoading.has(sub.id)}
                                className="text-purple-400 hover:text-purple-300"
                                title="تجديد الاشتراك"
                              >
                                {actionLoading.has(sub.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRefreshSubscription(sub)}
                                disabled={actionLoading.has(sub.id)}
                                className="text-blue-400 hover:text-blue-300"
                                title="إرسال اشتراك محدث"
                              >
                                {actionLoading.has(sub.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleReminderSent(sub)}
                                disabled={actionLoading.has(sub.id)}
                                className={
                                  sub.reminder_sent
                                    ? 'text-green-400 hover:text-green-300'
                                    : 'text-slate-400 hover:text-slate-300'
                                }
                              >
                                {actionLoading.has(sub.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : sub.reminder_sent ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  <MessageSquare className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditSubscription(sub)}
                                disabled={actionLoading.has(sub.id)}
                                className="text-yellow-400 hover:text-yellow-300"
                                title="تعديل الاشتراك"
                              >
                                {actionLoading.has(sub.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <PenSquare className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteSubscription(sub)}
                                disabled={actionLoading.has(sub.id)}
                                className="text-red-400 hover:text-red-300"
                                title="حذف ونقل إلى الاشتراكات المنتهية"
                              >
                                {actionLoading.has(sub.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
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

      {/* Manual Entry Dialog */}
      <Dialog open={manualEntryDialogOpen} onOpenChange={setManualEntryDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة اشتراك يدوياً</DialogTitle>
            <DialogDescription className="text-slate-400">
              أضف اشتراك جديد يدوياً
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>اسم العميل *</Label>
              <Input
                value={manualForm.customer_name}
                onChange={(e) => setManualForm({ ...manualForm, customer_name: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label>البريد الإلكتروني *</Label>
              <Input
                type="email"
                value={manualForm.customer_email}
                onChange={(e) => setManualForm({ ...manualForm, customer_email: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label>رقم الهاتف</Label>
              <Input
                value={manualForm.customer_phone}
                onChange={(e) => setManualForm({ ...manualForm, customer_phone: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label>رمز الاشتراك *</Label>
              <Input
                value={manualForm.subscription_code}
                onChange={(e) => setManualForm({ ...manualForm, subscription_code: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label>نوع الاشتراك (التصنيف) *</Label>
              <Select
                value={manualForm.subscription_type}
                onValueChange={(value: string) =>
                  setManualForm({ ...manualForm, subscription_type: value })
                }
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="اختر التصنيف" />
                </SelectTrigger>
                <SelectContent>
                  {categories && categories.length > 0 ? (
                    categories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="" disabled>جاري تحميل التصنيفات...</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>مدة الاشتراك *</Label>
              <Input
                value={manualForm.subscription_duration}
                onChange={(e) => {
                  const duration = e.target.value;
                  setManualForm({
                    ...manualForm,
                    subscription_duration: duration,
                    expiration_date: calculateExpirationDate(manualForm.start_date, duration),
                  });
                }}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="مثال: 3 أشهر"
              />
            </div>
            <div>
              <Label>تاريخ البدء *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-slate-700 border-slate-600 text-white"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(manualForm.start_date, 'yyyy-MM-dd', { locale: ar })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700">
                  <Calendar
                    mode="single"
                    selected={manualForm.start_date}
                    onSelect={(date) => {
                      if (date) {
                        setManualForm({
                          ...manualForm,
                          start_date: date,
                          expiration_date: calculateExpirationDate(date, manualForm.subscription_duration),
                        });
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>تاريخ الانتهاء *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-slate-700 border-slate-600 text-white"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(manualForm.expiration_date, 'yyyy-MM-dd', { locale: ar })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700">
                  <Calendar
                    mode="single"
                    selected={manualForm.expiration_date}
                    onSelect={(date) => {
                      if (date) {
                        setManualForm({ ...manualForm, expiration_date: date });
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="col-span-2">
              <Label>رمز المنتج (اختياري)</Label>
              <Input
                value={manualForm.product_code}
                onChange={async (e) => {
                  const productCode = e.target.value;
                  // Store the current subscription_type before fetching product
                  const currentSubscriptionType = manualForm.subscription_type;
                  
                  setManualForm({ ...manualForm, product_code: productCode });
                  
                  // Fetch product and update duration if found
                  if (productCode && productCode.trim() !== '') {
                    const product = await fetchProductByCode(productCode);
                    if (product) {
                      // Get product category name (Arabic first, then English)
                      const productCategoryName = product.categories?.name || product.categories?.name_en || null;
                      
                      // Update duration and recalculate expiration date
                      const updates: any = {
                        product_code: productCode,
                      };
                      
                      if (product.duration) {
                        const newDuration = product.duration;
                        const newExpirationDate = calculateExpirationDate(manualForm.start_date, newDuration);
                        updates.subscription_duration = newDuration;
                        updates.expiration_date = newExpirationDate;
                        
                        toast({
                          title: 'تم تحديث المدة',
                          description: `تم تعيين المدة من المنتج: ${newDuration}`,
                        });
                      }
                      
                      // Only update subscription_type if:
                      // 1. User hasn't manually selected a category (empty or default)
                      // 2. Product has a valid category
                      const isDefaultOrEmpty = !currentSubscriptionType || 
                        (categories.length > 0 && currentSubscriptionType === categories[0].name);
                      
                      if (isDefaultOrEmpty && productCategoryName) {
                        updates.subscription_type = productCategoryName;
                      }
                      
                      setManualForm(prev => ({
                        ...prev,
                        ...updates,
                      }));
                    }
                  }
                }}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="أدخل رمز المنتج للحصول على المدة تلقائياً"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setManualEntryDialogOpen(false)}
              className="border-slate-600 text-slate-300"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleManualEntry}
              disabled={
                !manualForm.customer_name ||
                !manualForm.customer_email ||
                !manualForm.subscription_code
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subscription Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل اشتراك</DialogTitle>
            <DialogDescription className="text-slate-400">
              تعديل بيانات الاشتراك
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>اسم العميل *</Label>
              <Input
                value={manualForm.customer_name}
                onChange={(e) => setManualForm({ ...manualForm, customer_name: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label>البريد الإلكتروني *</Label>
              <Input
                type="email"
                value={manualForm.customer_email}
                onChange={(e) => setManualForm({ ...manualForm, customer_email: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label>رقم الهاتف</Label>
              <Input
                value={manualForm.customer_phone}
                onChange={(e) => setManualForm({ ...manualForm, customer_phone: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label>رمز الاشتراك *</Label>
              <Input
                value={manualForm.subscription_code}
                onChange={(e) => setManualForm({ ...manualForm, subscription_code: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label>نوع الاشتراك (التصنيف) *</Label>
              <Select
                value={manualForm.subscription_type}
                onValueChange={(value: string) =>
                  setManualForm({ ...manualForm, subscription_type: value })
                }
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="اختر التصنيف" />
                </SelectTrigger>
                <SelectContent>
                  {categories && categories.length > 0 ? (
                    categories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="" disabled>جاري تحميل التصنيفات...</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>مدة الاشتراك *</Label>
              <Input
                value={manualForm.subscription_duration}
                onChange={(e) => {
                  const duration = e.target.value;
                  setManualForm({
                    ...manualForm,
                    subscription_duration: duration,
                    expiration_date: calculateExpirationDate(manualForm.start_date, duration),
                  });
                }}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="مثال: 3 أشهر"
              />
            </div>
            <div>
              <Label>تاريخ البدء *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-slate-700 border-slate-600 text-white"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(manualForm.start_date, 'yyyy-MM-dd', { locale: ar })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700">
                  <Calendar
                    mode="single"
                    selected={manualForm.start_date}
                    onSelect={(date) => {
                      if (date) {
                        setManualForm({
                          ...manualForm,
                          start_date: date,
                          expiration_date: calculateExpirationDate(date, manualForm.subscription_duration),
                        });
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>تاريخ الانتهاء *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-slate-700 border-slate-600 text-white"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(manualForm.expiration_date, 'yyyy-MM-dd', { locale: ar })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700">
                  <Calendar
                    mode="single"
                    selected={manualForm.expiration_date}
                    onSelect={(date) => {
                      if (date) {
                        setManualForm({ ...manualForm, expiration_date: date });
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="col-span-2">
              <Label>رمز المنتج (اختياري)</Label>
              <Input
                value={manualForm.product_code}
                onChange={async (e) => {
                  const productCode = e.target.value;
                  // Store the current subscription_type before fetching product
                  const currentSubscriptionType = manualForm.subscription_type;
                  
                  setManualForm({ ...manualForm, product_code: productCode });
                  
                  // Fetch product and update duration if found
                  if (productCode && productCode.trim() !== '') {
                    const product = await fetchProductByCode(productCode);
                    if (product) {
                      // Get product category name (Arabic first, then English)
                      const productCategoryName = product.categories?.name || product.categories?.name_en || null;
                      
                      // Update duration and recalculate expiration date
                      const updates: any = {
                        product_code: productCode,
                      };
                      
                      if (product.duration) {
                        const newDuration = product.duration;
                        const newExpirationDate = calculateExpirationDate(manualForm.start_date, newDuration);
                        updates.subscription_duration = newDuration;
                        updates.expiration_date = newExpirationDate;
                        
                        toast({
                          title: 'تم تحديث المدة',
                          description: `تم تعيين المدة من المنتج: ${newDuration}`,
                        });
                      }
                      
                      // Only update subscription_type if:
                      // 1. User hasn't manually selected a category (empty or default)
                      // 2. Product has a valid category
                      const isDefaultOrEmpty = !currentSubscriptionType || 
                        (categories.length > 0 && currentSubscriptionType === categories[0].name);
                      
                      if (isDefaultOrEmpty && productCategoryName) {
                        updates.subscription_type = productCategoryName;
                      }
                      
                      setManualForm(prev => ({
                        ...prev,
                        ...updates,
                      }));
                    }
                  }
                }}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="أدخل رمز المنتج للحصول على المدة تلقائياً"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditingSubscription(null);
                setManualForm({
                  customer_name: '',
                  customer_email: '',
                  customer_phone: '',
                  subscription_code: '',
                  subscription_type: categories.length > 0 ? categories[0].name : '',
                  subscription_duration: '1 شهر',
                  start_date: new Date(),
                  expiration_date: new Date(),
                  product_code: '',
                });
              }}
              className="border-slate-600 text-slate-300"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleUpdateSubscription}
              disabled={
                !manualForm.customer_name ||
                !manualForm.customer_email ||
                !manualForm.subscription_code
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              تحديث
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={csvImportDialogOpen} onOpenChange={setCsvImportDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>استيراد CSV</DialogTitle>
            <DialogDescription className="text-slate-400">
              اختر ملف CSV لاستيراد الاشتراكات
              <br />
              <Button
                type="button"
                variant="link"
                onClick={downloadCSVTemplate}
                className="text-blue-400 hover:text-blue-300 p-0 h-auto mt-2 text-sm underline"
              >
                <Download className="w-4 h-4 ml-1" />
                تحميل قالب CSV
              </Button>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="csv-file-input">اختر ملف CSV</Label>
              <div className="mt-2">
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setCsvFile(file);
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="csv-file-input"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-700 hover:bg-slate-600 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 mb-3 text-slate-400" />
                    <p className="mb-2 text-sm text-slate-300">
                      <span className="font-semibold">انقر لاختيار ملف</span> أو اسحب الملف هنا
                    </p>
                    <p className="text-xs text-slate-400">CSV فقط</p>
                  </div>
                </label>
                {csvFile && (
                  <div className="mt-2 p-3 bg-slate-700 rounded-lg border border-slate-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <FileText className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-white">{csvFile.name}</p>
                          <p className="text-xs text-slate-400">
                            {(csvFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCsvFile(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCsvImportDialogOpen(false);
                setCsvFile(null);
              }}
              className="border-slate-600 text-slate-300"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleCSVImport}
              disabled={importing || !csvFile}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  جاري الاستيراد...
                </>
              ) : (
                'استيراد'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renew Dialog */}
      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>تجديد الاشتراك</DialogTitle>
            <DialogDescription className="text-slate-400">
              قم بتحديث الاشتراك بتاريخ بدء جديد. يمكنك اختيار مدة جديدة للاشتراك.
            </DialogDescription>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div>
                  <span className="text-slate-400">العميل:</span>{' '}
                  <span className="text-white">{selectedSubscription.customer_name}</span>
                </div>
                        <div>
                          <span className="text-slate-400">نوع الاشتراك:</span>{' '}
                          <span className="text-white">
                            {selectedSubscription.subscription_type || 'غير محدد'}
                          </span>
                        </div>
                <div>
                  <span className="text-slate-400">المدة الحالية:</span>{' '}
                  <span className="text-white">{selectedSubscription.subscription_duration}</span>
                </div>
                <div>
                  <span className="text-slate-400">تاريخ الانتهاء الحالي:</span>{' '}
                  <span className="text-white">
                    {format(new Date(selectedSubscription.expiration_date), 'yyyy-MM-dd', { locale: ar })}
                  </span>
                </div>
              </div>
              
              <div>
                <Label>مدة التجديد *</Label>
                <Select
                  value={renewalDuration}
                  onValueChange={(value) => {
                    console.log('Duration changed to:', value);
                    setRenewalDuration(value);
                  }}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-2">
                    <SelectValue placeholder="اختر المدة">
                      {renewalDuration || 'اختر المدة'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1 شهر">1 شهر</SelectItem>
                    <SelectItem value="3 أشهر">3 أشهر</SelectItem>
                    <SelectItem value="6 أشهر">6 أشهر</SelectItem>
                    <SelectItem value="12 شهر">12 شهر</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400 mt-1">
                  المدة المختارة: <strong>{renewalDuration || 'غير محدد'}</strong>
                  <br />
                  التاريخ الجديد: {renewalDuration && selectedSubscription ? (() => {
                    // Calculate new expiration: current expiration + selected duration
                    const currentExpiration = new Date(selectedSubscription.expiration_date);
                    const daysToAdd = parseDurationToDays(renewalDuration);
                    const newExpiration = new Date(currentExpiration.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
                    return format(newExpiration, 'yyyy-MM-dd', { locale: ar });
                  })() : 'يرجى اختيار المدة'}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenewDialogOpen(false);
                setRenewalDuration('');
              }}
              className="border-slate-600 text-slate-300"
            >
              إلغاء
            </Button>
            <Button
              onClick={confirmRenew}
              disabled={actionLoading.has(selectedSubscription?.id || '') || !renewalDuration || renewalDuration.trim() === ''}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {actionLoading.has(selectedSubscription?.id || '') ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  جاري التجديد...
                </>
              ) : (
                'تجديد'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refresh Subscription Dialog */}
      <Dialog open={refreshDialogOpen} onOpenChange={setRefreshDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>إرسال اشتراك محدث</DialogTitle>
            <DialogDescription className="text-slate-400">
              سيتم جلب اشتراك جديد من المخزون وإرساله للعميل. سيتم تحديث الاشتراك في جميع الصفحات.
            </DialogDescription>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div>
                  <span className="text-slate-400">العميل:</span>{' '}
                  <span className="text-white">{selectedSubscription.customer_name}</span>
                </div>
                <div>
                  <span className="text-slate-400">البريد الإلكتروني:</span>{' '}
                  <span className="text-white">{selectedSubscription.customer_email}</span>
                </div>
                <div>
                  <span className="text-slate-400">الاشتراك الحالي:</span>{' '}
                  <span className="text-white font-mono">{selectedSubscription.subscription_code}</span>
                </div>
                <div>
                  <span className="text-slate-400">رمز المنتج:</span>{' '}
                  <span className="text-white">{selectedSubscription.product_code || 'غير محدد'}</span>
                </div>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
                <p className="text-yellow-300 text-sm">
                  سيتم جلب اشتراك جديد من المخزون يطابق رمز المنتج. سيتم تحديث الاشتراك في:
                </p>
                <ul className="list-disc list-inside text-yellow-200 text-sm mt-2 space-y-1">
                  <li>صفحة طلباتي</li>
                  <li>صفحة إدارة الاشتراكات</li>
                  <li>جميع الصفحات ذات الصلة</li>
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRefreshDialogOpen(false);
                setSelectedSubscription(null);
              }}
              className="border-slate-600 text-slate-300"
              disabled={refreshingSubscription}
            >
              إلغاء
            </Button>
            <Button
              onClick={confirmRefreshSubscription}
              disabled={refreshingSubscription}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {refreshingSubscription ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  جاري التحديث...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  إرسال اشتراك محدث
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Subscription Code Dialog */}
      <Dialog open={viewCodeDialogOpen} onOpenChange={setViewCodeDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">رمز الاشتراك</DialogTitle>
            <DialogDescription className="text-slate-400">
              رمز الاشتراك الكامل
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <pre className="text-white font-mono text-sm whitespace-pre-wrap break-words overflow-x-auto max-h-[400px] overflow-y-auto">
                {viewingSubscriptionCode}
              </pre>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(viewingSubscriptionCode);
                toast({
                  title: 'تم النسخ',
                  description: 'تم نسخ رمز الاشتراك إلى الحافظة',
                });
              }}
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              نسخ إلى الحافظة
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewCodeDialogOpen(false)}
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

