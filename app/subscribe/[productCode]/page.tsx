'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Sparkles, Zap, Crown, Star, Check, ArrowRight, ImageIcon, CheckCircle2 } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';
import { formatPriceWithSar } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

// Product data with descriptions (fallback data)
const fallbackProductsData: { [key: string]: any } = {
  'SUB-BASIC-1M': {
    id: 'PROD-001',
    name: 'اشتراك IPTV - 1 شهر',
    price: 49,
    duration: '1 شهر',
    code: 'SUB-BASIC-1M',
    description: 'اشتراك IPTV لمدة شهر واحد',
    icon: Sparkles,
    image: 'https://a.top4top.io/p_3592o24r01.png',
    image2: 'https://b.top4top.io/p_3592ftqff2.png',
    gradient: 'from-purple-500 to-blue-500',
    badgeColor: 'bg-purple-500',
    fullDescription: `
      <h3>اشتراك IPTV - شهر واحد</h3>
      <p>اشتراك IPTV مثالي للبدء في رحلتك مع مكان TV</p>
      <ul>
        <li>وصول كامل إلى جميع المحتويات</li>
        <li>جودة عالية HD</li>
        <li>دعم فني متواصل</li>
        <li>تجربة مشاهدة ممتازة</li>
      </ul>
      <p>السعر: 49 ريال لمدة شهر واحد</p>
    `,
  },
  'SUB-BASIC-3M': {
    id: 'PROD-002',
    name: 'اشتراك IPTV - 3 أشهر',
    price: 129,
    duration: '3 أشهر',
    code: 'SUB-BASIC-3M',
    description: 'اشتراك IPTV لمدة 3 أشهر',
    icon: Sparkles,
    image: 'https://a.top4top.io/p_3592o24r01.png',
    image2: 'https://b.top4top.io/p_3592ftqff2.png',
    gradient: 'from-purple-500 to-blue-500',
    badgeColor: 'bg-purple-500',
    fullDescription: `
      <h3>اشتراك IPTV - 3 أشهر</h3>
      <p>وفر أكثر مع اشتراك IPTV لمدة 3 أشهر</p>
      <ul>
        <li>جميع ميزات الاشتراك الأساسي</li>
        <li>توفير 18 ريال مقارنة بالاشتراك الشهري</li>
        <li>وصول فوري إلى المحتوى</li>
        <li>دعم فني مجاني</li>
      </ul>
      <p>السعر: 129 ريال لمدة 3 أشهر (43 ريال/شهر)</p>
    `,
  },
  'SUB-BASIC-6M': {
    id: 'PROD-003',
    name: 'اشتراك IPTV - 6 أشهر',
    price: 229,
    duration: '6 أشهر',
    code: 'SUB-BASIC-6M',
    description: 'اشتراك IPTV لمدة 6 أشهر',
    icon: Sparkles,
    image: 'https://a.top4top.io/p_3592o24r01.png',
    image2: 'https://b.top4top.io/p_3592ftqff2.png',
    gradient: 'from-purple-500 to-blue-500',
    badgeColor: 'bg-purple-500',
    fullDescription: `
      <h3>اشتراك IPTV - 6 أشهر</h3>
      <p>أفضل قيمة لاشتراك IPTV</p>
      <ul>
        <li>جميع ميزات الاشتراك الأساسي</li>
        <li>توفير 65 ريال مقارنة بالاشتراك الشهري</li>
        <li>ضمان استقرار السعر لمدة 6 أشهر</li>
        <li>أولوية في الدعم الفني</li>
      </ul>
      <p>السعر: 229 ريال لمدة 6 أشهر (38 ريال/شهر)</p>
    `,
  },
  'SUB-PREMIUM-1M': {
    id: 'PROD-004',
    name: 'اشتراك مميز - 1 شهر',
    price: 79,
    duration: '1 شهر',
    code: 'SUB-PREMIUM-1M',
    description: 'اشتراك مميز مع ميزات إضافية',
    icon: Star,
    image: '/logos/netflix.svg',
    gradient: 'from-red-500 to-rose-200',
    badgeColor: 'bg-red-500',
    fullDescription: `
      <h3>الاشتراك المميز - شهر واحد</h3>
      <p>تجربة مشاهدة متقدمة مع ميزات حصرية</p>
      <ul>
        <li>جميع ميزات الاشتراك الأساسي</li>
        <li>جودة فائقة 4K</li>
        <li>تحميل للمشاهدة دون اتصال</li>
        <li>دعم فني أولوية</li>
        <li>محتوى حصري إضافي</li>
      </ul>
      <p>السعر: 79 ريال لمدة شهر واحد</p>
    `,
  },
  'SUB-PREMIUM-3M': {
    id: 'PROD-005',
    name: 'اشتراك مميز - 3 أشهر',
    price: 199,
    duration: '3 أشهر',
    code: 'SUB-PREMIUM-3M',
    description: 'اشتراك مميز مع ميزات إضافية',
    icon: Star,
    image: '/logos/netflix.svg',
    gradient: 'from-red-500 to-rose-200',
    badgeColor: 'bg-red-500',
    fullDescription: `
      <h3>الاشتراك المميز - 3 أشهر</h3>
      <p>وفر مع الاشتراك المميز</p>
      <ul>
        <li>جميع ميزات الاشتراك المميز</li>
        <li>توفير 38 ريال مقارنة بالاشتراك الشهري</li>
        <li>وصول فوري إلى المحتوى الحصري</li>
        <li>دعم فني متقدم</li>
      </ul>
      <p>السعر: 199 ريال لمدة 3 أشهر (66 ريال/شهر)</p>
    `,
  },
  'SUB-PREMIUM-6M': {
    id: 'PROD-006',
    name: 'اشتراك مميز - 6 أشهر',
    price: 349,
    duration: '6 أشهر',
    code: 'SUB-PREMIUM-6M',
    description: 'اشتراك مميز مع ميزات إضافية',
    icon: Star,
    image: '/logos/netflix.svg',
    gradient: 'from-red-500 to-rose-200',
    badgeColor: 'bg-red-500',
    fullDescription: `
      <h3>الاشتراك المميز - 6 أشهر</h3>
      <p>أفضل قيمة للاشتراك المميز</p>
      <ul>
        <li>جميع ميزات الاشتراك المميز</li>
        <li>توفير 125 ريال مقارنة بالاشتراك الشهري</li>
        <li>ضمان استقرار السعر</li>
        <li>دعم فني مخصص</li>
      </ul>
      <p>السعر: 349 ريال لمدة 6 أشهر (58 ريال/شهر)</p>
    `,
  },
  'SUB-PLUS-1M': {
    id: 'PROD-007',
    name: 'اشتراك بلس - 1 شهر',
    price: 99,
    duration: '1 شهر',
    code: 'SUB-PLUS-1M',
    description: 'اشتراك بلس مع جميع الميزات',
    icon: Zap,
    image: '',
    gradient: 'from-orange-500 to-red-500',
    badgeColor: 'bg-orange-500',
    fullDescription: `
      <h3>اشتراك بلس - شهر واحد</h3>
      <p>تجربة كاملة مع جميع الميزات</p>
      <ul>
        <li>جميع ميزات الاشتراك المميز</li>
        <li>مشاهدة متعددة الأجهزة (5 أجهزة)</li>
        <li>جودة فائقة 4K UHD</li>
        <li>تحميل غير محدود</li>
        <li>دعم فني 24/7</li>
        <li>محتوى حصري حصري</li>
      </ul>
      <p>السعر: 99 ريال لمدة شهر واحد</p>
    `,
  },
  'SUB-PLUS-3M': {
    id: 'PROD-008',
    name: 'اشتراك بلس - 3 أشهر',
    price: 249,
    duration: '3 أشهر',
    code: 'SUB-PLUS-3M',
    description: 'اشتراك بلس مع جميع الميزات',
    icon: Zap,
    image: '',
    gradient: 'from-orange-500 to-red-500',
    badgeColor: 'bg-orange-500',
    fullDescription: `
      <h3>اشتراك بلس - 3 أشهر</h3>
      <p>وفر مع اشتراك بلس</p>
      <ul>
        <li>جميع ميزات اشتراك بلس</li>
        <li>توفير 48 ريال مقارنة بالاشتراك الشهري</li>
        <li>وصول فوري إلى جميع الميزات</li>
        <li>دعم فني متميز</li>
      </ul>
      <p>السعر: 249 ريال لمدة 3 أشهر (83 ريال/شهر)</p>
    `,
  },
  'SUB-PLUS-6M': {
    id: 'PROD-009',
    name: 'اشتراك بلس - 6 أشهر',
    price: 449,
    duration: '6 أشهر',
    code: 'SUB-PLUS-6M',
    description: 'اشتراك بلس مع جميع الميزات',
    icon: Zap,
    image: '',
    gradient: 'from-orange-500 to-red-500',
    badgeColor: 'bg-orange-500',
    fullDescription: `
      <h3>اشتراك بلس - 6 أشهر</h3>
      <p>أفضل قيمة لاشتراك بلس</p>
      <ul>
        <li>جميع ميزات اشتراك بلس</li>
        <li>توفير 145 ريال مقارنة بالاشتراك الشهري</li>
        <li>ضمان استقرار السعر</li>
        <li>دعم فني استثنائي</li>
      </ul>
      <p>السعر: 449 ريال لمدة 6 أشهر (75 ريال/شهر)</p>
    `,
  },
  'SUB-VIP-1M': {
    id: 'PROD-010',
    name: 'اشتراك VIP - 1 شهر',
    price: 149,
    duration: '1 شهر',
    code: 'SUB-VIP-1M',
    description: 'اشتراك VIP حصري',
    icon: Crown,
    image: '',
    gradient: 'from-yellow-500 to-amber-500',
    badgeColor: 'bg-yellow-500',
    fullDescription: `
      <h3>اشتراك VIP - شهر واحد</h3>
      <p>تجربة VIP حصرية مع جميع الميزات المميزة</p>
      <ul>
        <li>جميع ميزات اشتراك بلس</li>
        <li>مشاهدة غير محدودة (10 أجهزة)</li>
        <li>جودة فائقة 4K UHD HDR</li>
        <li>تحميل غير محدود</li>
        <li>دعم فني مخصص 24/7</li>
        <li>محتوى حصري VIP</li>
        <li>وصول مبكر للمحتوى الجديد</li>
      </ul>
      <p>السعر: 149 ريال لمدة شهر واحد</p>
    `,
  },
  'SUB-VIP-3M': {
    id: 'PROD-011',
    name: 'اشتراك VIP - 3 أشهر',
    price: 399,
    duration: '3 أشهر',
    code: 'SUB-VIP-3M',
    description: 'اشتراك VIP حصري',
    icon: Crown,
    image: '',
    gradient: 'from-yellow-500 to-amber-500',
    badgeColor: 'bg-yellow-500',
    fullDescription: `
      <h3>اشتراك VIP - 3 أشهر</h3>
      <p>وفر مع اشتراك VIP</p>
      <ul>
        <li>جميع ميزات اشتراك VIP</li>
        <li>توفير 48 ريال مقارنة بالاشتراك الشهري</li>
        <li>وصول فوري إلى المحتوى الحصري</li>
        <li>دعم فني متميز</li>
      </ul>
      <p>السعر: 399 ريال لمدة 3 أشهر (133 ريال/شهر)</p>
    `,
  },
  'SUB-VIP-6M': {
    id: 'PROD-012',
    name: 'اشتراك VIP - 6 أشهر',
    price: 699,
    duration: '6 أشهر',
    code: 'SUB-VIP-6M',
    description: 'اشتراك VIP حصري',
    icon: Crown,
    image: '',
    gradient: 'from-yellow-500 to-amber-500',
    badgeColor: 'bg-yellow-500',
    fullDescription: `
      <h3>اشتراك VIP - 6 أشهر</h3>
      <p>أفضل قيمة لاشتراك VIP</p>
      <ul>
        <li>جميع ميزات اشتراك VIP</li>
        <li>توفير 195 ريال مقارنة بالاشتراك الشهري</li>
        <li>ضمان استقرار السعر</li>
        <li>دعم فني استثنائي</li>
      </ul>
      <p>السعر: 699 ريال لمدة 6 أشهر (117 ريال/شهر)</p>
    `,
  },
  'SUB-ANNUAL-BASIC': {
    id: 'PROD-013',
    name: 'اشتراك سنوي - أساسي',
    price: 399,
    duration: '12 شهر',
    code: 'SUB-ANNUAL-BASIC',
    description: 'اشتراك سنوي أساسي',
    icon: Check,
    image: 'https://c.top4top.io/p_35923vyyf1.jpeg',
    gradient: 'from-green-500 to-emerald-500',
    badgeColor: 'bg-green-500',
    fullDescription: `
      <h3>الاشتراك السنوي الأساسي</h3>
      <p>وفر مع الاشتراك السنوي</p>
      <ul>
        <li>جميع ميزات الاشتراك الأساسي</li>
        <li>توفير 189 ريال مقارنة بالاشتراك الشهري</li>
        <li>ضمان استقرار السعر لمدة عام</li>
        <li>دعم فني مجاني</li>
        <li>هدية شهر إضافي مجاني</li>
      </ul>
      <p>السعر: 399 ريال لمدة 12 شهر (33 ريال/شهر)</p>
    `,
  },
  'SUB-ANNUAL-PREMIUM': {
    id: 'PROD-014',
    name: 'اشتراك سنوي - مميز',
    price: 699,
    duration: '12 شهر',
    code: 'SUB-ANNUAL-PREMIUM',
    description: 'اشتراك سنوي مميز',
    icon: Check,
    image: 'https://c.top4top.io/p_35923vyyf1.jpeg',
    gradient: 'from-green-500 to-emerald-500',
    badgeColor: 'bg-green-500',
    fullDescription: `
      <h3>الاشتراك السنوي المميز</h3>
      <p>وفر مع الاشتراك السنوي المميز</p>
      <ul>
        <li>جميع ميزات الاشتراك المميز</li>
        <li>توفير 249 ريال مقارنة بالاشتراك الشهري</li>
        <li>ضمان استقرار السعر</li>
        <li>دعم فني متقدم</li>
        <li>هدية شهرين إضافيين مجانيين</li>
      </ul>
      <p>السعر: 699 ريال لمدة 12 شهر (58 ريال/شهر)</p>
    `,
  },
  'SUB-ANNUAL-VIP': {
    id: 'PROD-015',
    name: 'اشتراك سنوي - VIP',
    price: 1199,
    duration: '12 شهر',
    code: 'SUB-ANNUAL-VIP',
    description: 'اشتراك سنوي VIP',
    icon: Check,
    image: 'https://c.top4top.io/p_35923vyyf1.jpeg',
    gradient: 'from-green-500 to-emerald-500',
    badgeColor: 'bg-green-500',
    fullDescription: `
      <h3>الاشتراك السنوي VIP</h3>
      <p>أفضل قيمة مع الاشتراك السنوي VIP</p>
      <ul>
        <li>جميع ميزات اشتراك VIP</li>
        <li>توفير 589 ريال مقارنة بالاشتراك الشهري</li>
        <li>ضمان استقرار السعر لمدة عام</li>
        <li>دعم فني مخصص</li>
        <li>هدية 3 أشهر إضافية مجانية</li>
        <li>محتوى حصري حصري</li>
      </ul>
      <p>السعر: 1199 ريال لمدة 12 شهر (100 ريال/شهر)</p>
    `,
  },
  'SUB-PACKAGE-PREMIUM': {
    id: 'PROD-016',
    name: 'البكج الفاخر',
    price: 299,
    duration: 'باقة متكاملة',
    code: 'SUB-PACKAGE-PREMIUM',
    description: 'باقة متكاملة تشمل Netflix و Shahid و IPTV مع ميزات حصرية',
    icon: Crown,
    logos: ['/logos/netflix.svg', 'https://c.top4top.io/p_35923vyyf1.jpeg', '/logos/iptv.png'],
    gradient: 'from-blue-500 via-cyan-500 to-teal-500',
    badgeColor: 'bg-blue-500',
    fullDescription: `
      <h3>البكج الفاخر - باقة متكاملة</h3>
      <p>باقة شاملة تجمع أفضل الخدمات في مكان واحد</p>
      <ul>
        <li><strong>Netflix Premium:</strong> وصول كامل لمكتبة Netflix الضخمة بجودة 4K</li>
        <li><strong>Shahid VIP:</strong> محتوى عربي حصري ومميز من منصة Shahid</li>
        <li><strong>IPTV Premium:</strong> آلاف القنوات المباشرة من جميع أنحاء العالم</li>
        <li>دعم فني متواصل على مدار الساعة</li>
        <li>جودة فائقة 4K لجميع المحتويات</li>
        <li>مشاهدة متعددة الأجهزة في نفس الوقت</li>
        <li>محتوى حصري ومميز</li>
        <li>تحديثات مستمرة وإضافة محتوى جديد</li>
      </ul>
      <p><strong>السعر: 299 ريال - قيمة استثنائية لثلاث خدمات في باقة واحدة</strong></p>
    `,
  },
  'SUB-PACKAGE-LEGENDARY': {
    id: 'PROD-017',
    name: 'البكج الاسطوري',
    price: 199,
    duration: 'باقة مميزة',
    code: 'SUB-PACKAGE-LEGENDARY',
    description: 'باقة حصرية تجمع Netflix و Shahid في باقة واحدة',
    icon: Crown,
    logos: ['/logos/netflix.svg', 'https://c.top4top.io/p_35923vyyf1.jpeg'],
    gradient: 'from-emerald-500 via-green-500 to-teal-500',
    badgeColor: 'bg-emerald-500',
    fullDescription: `
      <h3>البكج الاسطوري - باقة حصرية</h3>
      <p>باقة أسطورية تجمع أفضل منصتين للمحتوى</p>
      <ul>
        <li><strong>Netflix Premium:</strong> وصول كامل لمكتبة Netflix العالمية بجودة HD فائقة</li>
        <li><strong>Shahid VIP:</strong> محتوى عربي حصري ومميز من منصة Shahid الرائدة</li>
        <li>محتوى حصري ومميز من كلا المنصتين</li>
        <li>دعم فني متقدم وسريع</li>
        <li>جودة HD فائقة لجميع المحتويات</li>
        <li>مشاهدة على أجهزة متعددة</li>
        <li>تحديثات مستمرة ومحتوى جديد</li>
        <li>تجربة مشاهدة ممتازة</li>
      </ul>
      <p><strong>السعر: 199 ريال - باقة أسطورية بتكلفة مميزة</strong></p>
    `,
  },
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productCode = params.productCode as string;
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await fetch('/api/products', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'فشل في جلب المنتج');
        }

        // Find product by product_code
        const foundProduct = result.products.find((p: any) => p.product_code === productCode);
        
        if (foundProduct) {
          // Map database product to display format
          setProduct({
            id: foundProduct.id,
            name: foundProduct.name,
            price: foundProduct.price,
            duration: foundProduct.duration,
            code: foundProduct.product_code,
            description: foundProduct.description,
            gradient: foundProduct.gradient || 'from-blue-500 to-cyan-500',
            badgeColor: foundProduct.badge_color || 'bg-blue-500',
            image: foundProduct.image,
            image2: foundProduct.image2,
            logos: foundProduct.logos,
            features: foundProduct.features,
            icon: foundProduct.icon_name === 'crown' ? Crown : foundProduct.icon_name === 'star' ? Star : foundProduct.icon_name === 'zap' ? Zap : Sparkles,
            fullDescription: foundProduct.full_description || foundProduct.description,
          });
        } else {
          // Fallback to hardcoded data if not found in database
          setProduct(fallbackProductsData[productCode]);
        }
      } catch (error: any) {
        console.error('Error fetching product:', error);
        // Fallback to hardcoded data on error
        setProduct(fallbackProductsData[productCode]);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <main className="container mx-auto px-4 py-24 pt-32">
          <div className="max-w-4xl mx-auto text-center">
            <Loader2 className="h-8 w-8 animate-spin text-white mx-auto" />
            <p className="text-slate-300 mt-4">جاري تحميل المنتج...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <main className="container mx-auto px-4 py-24 pt-32">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-red-900/20 border-red-700">
              <CardContent className="pt-6">
                <p className="text-red-400 text-center">المنتج غير موجود</p>
                <Link href="/subscribe">
                  <Button className="mt-4 w-full">العودة إلى صفحة الاشتراكات</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const Icon = product.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Header />
      <main className="container mx-auto px-4 py-12 pt-28">
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <Link href="/subscribe" className="inline-flex items-center text-slate-400 hover:text-white mb-8 transition-colors">
            <ArrowRight className="ml-2 h-5 w-5" />
            العودة إلى الخطط
          </Link>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Product Image Section */}
            <div className="relative">
              <Card className="group relative overflow-hidden bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/50 h-full">
                <div className={`absolute inset-0 bg-gradient-to-br ${product.gradient} opacity-5`} />
                <div className="relative h-96 md:h-full min-h-[400px] w-full overflow-hidden bg-gradient-to-br from-slate-700 to-slate-800">
                  {/* Package products with logos */}
                  {'logos' in product && product.logos ? (
                    <div className={`h-full w-full ${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'bg-gradient-to-br from-slate-700 to-slate-800' : `bg-gradient-to-br ${product.gradient}`} p-8 md:p-12 flex flex-col items-center justify-center`}>
                      <div className="flex items-center justify-center gap-6 md:gap-8 flex-wrap mb-8">
                        {product.logos.map((logo: string, idx: number) => (
                          <div key={idx} className={`${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'bg-slate-600/50' : 'bg-white/10'} backdrop-blur-sm rounded-2xl p-6 md:p-8 border ${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'border-slate-500/30' : 'border-white/20'}`}>
                            <img
                              src={logo}
                              alt={`${product.name} logo ${idx + 1}`}
                              className={`h-16 w-16 md:h-24 md:w-24 object-contain ${logo.endsWith('.png') || logo.endsWith('.jpeg') || logo.endsWith('.jpg') ? '' : 'brightness-0 invert'}`}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="text-center">
                        <h3 className="text-3xl md:text-4xl font-extrabold text-white mb-4">{product.name}</h3>
                        <p className={`${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'text-slate-200' : 'text-white/90'} text-lg md:text-xl`}>{product.description}</p>
                      </div>
                    </div>
                  ) : 'image2' in product && product.image2 ? (
                    // Section 1: Two images side by side
                    <div className="h-full w-full flex relative">
                      {/* Left image */}
                      <div className="relative w-1/2 h-full overflow-hidden">
                        <Image
                          src={product.image}
                          alt={`${product.name} - Image 1`}
                          fill
                          className="object-cover md:scale-90"
                          priority
                        />
                      </div>
                      {/* Right image */}
                      <div className="relative w-1/2 h-full overflow-hidden">
                        <Image
                          src={product.image2}
                          alt={`${product.name} - Image 2`}
                          fill
                          className="object-cover md:scale-90"
                          priority
                        />
                      </div>
                      {/* IPTV Logo overlay for Section 1 */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <img
                          src="/logos/iptv.png"
                          alt="IPTV"
                          className="h-20 w-20 md:h-24 md:w-24 object-contain opacity-80"
                        />
                      </div>
                    </div>
                  ) : product.image ? (
                    // Section 2 & 3: Single image or logo
                    product.image.endsWith('.svg') ? (
                      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800 p-8">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-32 md:h-48 w-auto object-contain opacity-90"
                        />
                      </div>
                    ) : (
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover"
                        priority
                      />
                    )
                  ) : (
                    <div className={`h-full w-full bg-gradient-to-br ${product.gradient} flex items-center justify-center`}>
                      <div className="text-center">
                        <ImageIcon className="w-24 h-24 text-white/30 mx-auto mb-4" />
                        <p className="text-white/50 text-sm">سيتم إضافة الصورة قريباً</p>
                      </div>
                    </div>
                  )}
                  {/* Badge */}
                  <div className="absolute top-6 right-6 z-10">
                    <span className={`${product.badgeColor} text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg`}>
                      {product.duration}
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Product Info Section */}
            <div className="flex flex-col justify-center">
              <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/50 p-8">
                <div className="mb-6">
                  <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
                    {product.name}
                  </h1>
                  <p className="text-xl text-slate-300 mb-6">
                    {product.description}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-8 p-6 bg-gradient-to-br from-slate-700/50 to-slate-800/50 rounded-2xl border border-slate-600/50">
                  {(() => {
                    const { usdPrice } = formatPriceWithSar(product.price);
                    return (
                      <>
                        <div className="flex items-baseline gap-3 mb-2">
                          <span className="text-6xl font-extrabold text-white">{product.price}</span>
                          <span className="text-2xl text-slate-400">ريال</span>
                        </div>
                        <p className="text-slate-400 text-base mb-2">
                          ما يساوي ${usdPrice} دولار أمريكي
                        </p>
                        {product.duration !== '1 شهر' && (
                          <p className="text-slate-400 text-lg">
                            {Math.round(product.price / (product.duration.includes('3') ? 3 : product.duration.includes('6') ? 6 : 12))} ريال/شهر
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* CTA Button */}
                <Link href={`/order/${productCode}`} className="block">
                  <Button className={`w-full ${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'bg-slate-600 hover:bg-slate-700 border border-slate-500' : `bg-gradient-to-r ${product.gradient} hover:opacity-90`} text-white font-bold py-7 text-xl shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105`}>
                    <span>اطلب الآن</span>
                    <ArrowRight className="mr-2 h-6 w-6" />
                  </Button>
                </Link>
              </Card>
            </div>
          </div>

          {/* Product Description */}
          <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/50 mb-8">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-1 h-8 bg-gradient-to-b ${product.gradient} rounded-full`} />
                <CardTitle className="text-3xl text-white">تفاصيل الباقة</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div 
                className="text-slate-300 prose prose-invert max-w-none prose-headings:text-white prose-strong:text-white prose-ul:list-disc prose-ul:mr-6 prose-li:text-slate-300 prose-li:mb-2"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.fullDescription || '', {
                  ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'span'],
                  ALLOWED_ATTR: ['class', 'style']
                }) }}
                style={{
                  lineHeight: '2',
                  fontSize: '1.1rem',
                }}
              />
            </CardContent>
          </Card>

          {/* Features Highlight */}
          <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/50">
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center p-4">
                  <div className={`w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br ${product.gradient} flex items-center justify-center`}>
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">جودة عالية</h3>
                  <p className="text-slate-400 text-sm">محتوى عالي الجودة</p>
                </div>
                <div className="text-center p-4">
                  <div className={`w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br ${product.gradient} flex items-center justify-center`}>
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">دعم فني</h3>
                  <p className="text-slate-400 text-sm">دعم فني متواصل</p>
                </div>
                <div className="text-center p-4">
                  <div className={`w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br ${product.gradient} flex items-center justify-center`}>
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">محتوى حصري</h3>
                  <p className="text-slate-400 text-sm">وصول فوري للمحتوى</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

