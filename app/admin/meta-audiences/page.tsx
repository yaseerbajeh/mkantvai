'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
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
  Plus,
  Pencil,
  Trash2,
  Send,
  ChevronDown,
  ChevronUp,
  Users,
  Tag,
  ArrowLeft,
  Merge,
  Search,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface MetaAudience {
  id: string;
  name: string;
  source_tag: string | null;
  phone_numbers: string[];
  created_at: string;
  updated_at: string;
}

function MetaAudiencesPageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [audiences, setAudiences] = useState<MetaAudience[]>([]);
  const [loadingAudiences, setLoadingAudiences] = useState(false);

  // Search/filter
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded preview
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAudience, setEditingAudience] = useState<MetaAudience | null>(null);
  const [formName, setFormName] = useState('');
  const [formSourceTag, setFormSourceTag] = useState('');
  const [formNumbers, setFormNumbers] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAudience, setDeletingAudience] = useState<MetaAudience | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Merge dialog
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeSelected, setMergeSelected] = useState<string[]>([]);
  const [mergeName, setMergeName] = useState('');
  const [merging, setMerging] = useState(false);

  // Auth
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin'); return; }
      const allowed = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
      if (!allowed.includes(user.email?.toLowerCase() || '')) { router.push('/admin'); return; }
      setUser(user);
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  const fetchAudiences = useCallback(async () => {
    setLoadingAudiences(true);
    try {
      const res = await fetch('/api/admin/meta-audiences');
      const data = await res.json();
      if (data.audiences) setAudiences(data.audiences);
    } catch {
      toast({ title: 'خطأ في جلب الجماهير', variant: 'destructive' });
    }
    setLoadingAudiences(false);
  }, [toast]);

  useEffect(() => {
    if (user) fetchAudiences();
  }, [user, fetchAudiences]);

  // Filtered audiences
  const filteredAudiences = audiences.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      (a.source_tag || '').toLowerCase().includes(q)
    );
  });

  // Open create dialog
  function openCreate() {
    setEditingAudience(null);
    setFormName('');
    setFormSourceTag('');
    setFormNumbers('');
    setDialogOpen(true);
  }

  // Open edit dialog
  function openEdit(audience: MetaAudience) {
    setEditingAudience(audience);
    setFormName(audience.name);
    setFormSourceTag(audience.source_tag || '');
    setFormNumbers(audience.phone_numbers.join('\n'));
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formNumbers.trim()) {
      toast({ title: 'الاسم وأرقام الهواتف مطلوبة', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        source_tag: formSourceTag.trim(),
        phone_numbers_raw: formNumbers,
      };

      let res;
      if (editingAudience) {
        res = await fetch('/api/admin/meta-audiences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingAudience.id, ...body }),
        });
      } else {
        res = await fetch('/api/admin/meta-audiences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || 'حدث خطأ', variant: 'destructive' });
      } else {
        toast({ title: editingAudience ? 'تم التحديث' : 'تم الإنشاء' });
        setDialogOpen(false);
        fetchAudiences();
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' });
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deletingAudience) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/meta-audiences?id=${deletingAudience.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || 'حدث خطأ', variant: 'destructive' });
      } else {
        toast({ title: 'تم الحذف' });
        setDeleteDialogOpen(false);
        setDeletingAudience(null);
        fetchAudiences();
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' });
    }
    setDeleting(false);
  }

  // Send to campaigns page — numbers formatted as digits-only, comma-separated
  function sendToCampaigns(audience: MetaAudience) {
    const phones = audience.phone_numbers.join(',');
    router.push(`/admin/campaigns?phones=${encodeURIComponent(phones)}`);
  }

  // Merge
  function openMerge() {
    setMergeSelected([]);
    setMergeName('');
    setMergeDialogOpen(true);
  }

  function toggleMergeSelect(id: string) {
    setMergeSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleMerge() {
    if (mergeSelected.length < 2) {
      toast({ title: 'اختر جمهورين على الأقل للدمج', variant: 'destructive' });
      return;
    }
    if (!mergeName.trim()) {
      toast({ title: 'أدخل اسم الجمهور الجديد', variant: 'destructive' });
      return;
    }
    setMerging(true);
    try {
      // Deduplicate across selected audiences
      const allNumbers = mergeSelected.flatMap(id => {
        const a = audiences.find(x => x.id === id);
        return a ? a.phone_numbers : [];
      });
      const unique = [...new Set(allNumbers)];

      const res = await fetch('/api/admin/meta-audiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mergeName.trim(),
          source_tag: '',
          phone_numbers_raw: unique.join('\n'),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || 'حدث خطأ', variant: 'destructive' });
      } else {
        toast({ title: `تم الدمج — ${unique.length} رقم فريد` });
        setMergeDialogOpen(false);
        fetchAudiences();
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' });
    }
    setMerging(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-24 pt-32">
          <div className="max-w-6xl mx-auto text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto" />
            <p className="text-gray-600 mt-4">جاري التحميل...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Button variant="ghost" size="sm" onClick={() => router.push('/admin')} className="text-gray-500 hover:text-gray-700 p-1">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-3xl font-bold text-gray-900">Meta حملات</h1>
              </div>
              <p className="text-gray-500 text-sm">إدارة جماهير الأرقام من حملاتك الإعلانية المدفوعة</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={openMerge} className="gap-2">
                <Merge className="h-4 w-4" />
                دمج جماهير
              </Button>
              <Button onClick={openCreate} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4" />
                إضافة جمهور
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="ابحث بالاسم أو المصدر..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pr-10 text-right"
            />
          </div>

          {/* Stats bar */}
          <div className="flex gap-4 text-sm text-gray-500">
            <span>{audiences.length} جمهور</span>
            <span>•</span>
            <span>{audiences.reduce((sum, a) => sum + a.phone_numbers.length, 0).toLocaleString('ar-SA')} رقم إجمالي</span>
            {searchQuery && (
              <>
                <span>•</span>
                <span>{filteredAudiences.length} نتيجة</span>
              </>
            )}
          </div>

          {/* Audience list */}
          {loadingAudiences ? (
            <div className="text-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
            </div>
          ) : filteredAudiences.length === 0 ? (
            <Card className="bg-white border-gray-200">
              <CardContent className="py-16 text-center text-gray-500">
                {searchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد جماهير بعد — أضف جمهورك الأول'}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredAudiences.map(audience => {
                const isExpanded = expandedId === audience.id;
                return (
                  <Card key={audience.id} className="bg-white border-gray-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        {/* Left: info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-lg text-gray-900">{audience.name}</CardTitle>
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Users className="h-3 w-3" />
                              {audience.phone_numbers.length.toLocaleString('ar-SA')} رقم
                            </Badge>
                            {audience.source_tag && (
                              <Badge variant="outline" className="gap-1 text-xs text-blue-600 border-blue-200 bg-blue-50">
                                <Tag className="h-3 w-3" />
                                {audience.source_tag}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(audience.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                        </div>

                        {/* Right: actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="gap-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                            onClick={() => sendToCampaigns(audience)}
                          >
                            <Send className="h-3.5 w-3.5" />
                            إرسال حملة
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(audience)} className="p-2">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setDeletingAudience(audience); setDeleteDialogOpen(true); }}
                            className="p-2 text-red-500 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpandedId(isExpanded ? null : audience.id)}
                            className="p-2 text-gray-400"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {/* Expandable numbers preview */}
                    {isExpanded && (
                      <CardContent className="pt-0 border-t border-gray-100">
                        <div className="mt-3">
                          <p className="text-xs text-gray-500 mb-2">أرقام الهواتف ({audience.phone_numbers.length})</p>
                          <div className="bg-gray-50 rounded-lg p-3 max-h-56 overflow-y-auto">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                              {audience.phone_numbers.map((num, i) => (
                                <span key={i} className="text-xs font-mono bg-white border border-gray-200 rounded px-2 py-1 text-gray-700 truncate" dir="ltr">
                                  {num}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingAudience ? 'تعديل الجمهور' : 'إضافة جمهور جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>اسم الجمهور *</Label>
              <Input
                placeholder="مثال: جمهور رمضان 2026"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="text-right"
              />
            </div>
            <div className="space-y-1.5">
              <Label>مصدر الحملة <span className="text-gray-400 font-normal text-xs">(اختياري)</span></Label>
              <Input
                placeholder="مثال: إعلان فيسبوك - مارس 2026"
                value={formSourceTag}
                onChange={e => setFormSourceTag(e.target.value)}
                className="text-right"
              />
            </div>
            <div className="space-y-1.5">
              <Label>أرقام الهواتف * <span className="text-gray-400 font-normal text-xs">(مفصولة بسطر جديد أو فاصلة)</span></Label>
              <Textarea
                placeholder={`+966 56 192 8487\n966561928487\n+966-56-192-8487`}
                value={formNumbers}
                onChange={e => setFormNumbers(e.target.value)}
                className="min-h-[160px] font-mono text-sm text-right"
                dir="ltr"
              />
              {formNumbers && (
                <p className="text-xs text-gray-500">
                  {formNumbers.split(/[\n,;]+/).filter(n => n.replace(/\D/g, '').length >= 7).length} رقم صالح
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              {editingAudience ? 'حفظ التعديلات' : 'إنشاء الجمهور'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>حذف الجمهور</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600 text-sm py-2">
            هل أنت متأكد من حذف جمهور <span className="font-semibold">"{deletingAudience?.name}"</span>؟
            <br />
            <span className="text-red-500">لا يمكن التراجع عن هذا الإجراء.</span>
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleDelete} disabled={deleting} variant="destructive">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>دمج جماهير</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">اختر الجماهير التي تريد دمجها في جمهور واحد جديد. سيتم إزالة الأرقام المكررة تلقائيًا.</p>
            <div className="space-y-1.5">
              <Label>اسم الجمهور الجديد *</Label>
              <Input
                placeholder="مثال: جمهور مدمج - رمضان"
                value={mergeName}
                onChange={e => setMergeName(e.target.value)}
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label>اختر الجماهير ({mergeSelected.length} محدد)</Label>
              <div className="max-h-60 overflow-y-auto space-y-1.5 border border-gray-200 rounded-lg p-2">
                {audiences.map(a => {
                  const selected = mergeSelected.includes(a.id);
                  return (
                    <div
                      key={a.id}
                      onClick={() => toggleMergeSelect(a.id)}
                      className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                        selected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                          {selected && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                        <span className="text-sm font-medium text-gray-800">{a.name}</span>
                        {a.source_tag && <span className="text-xs text-gray-400">{a.source_tag}</span>}
                      </div>
                      <Badge variant="secondary" className="text-xs">{a.phone_numbers.length} رقم</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
            {mergeSelected.length >= 2 && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                سيتم دمج ~{[...new Set(mergeSelected.flatMap(id => audiences.find(x => x.id === id)?.phone_numbers || []))].length.toLocaleString('ar-SA')} رقم فريد
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleMerge} disabled={merging || mergeSelected.length < 2} className="bg-blue-600 hover:bg-blue-700 text-white">
              {merging ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              دمج وإنشاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default dynamic(() => Promise.resolve(MetaAudiencesPageContent), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-5xl mx-auto text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto" />
          <p className="text-gray-600 mt-4">جاري التحميل...</p>
        </div>
      </main>
      <Footer />
    </div>
  ),
});
