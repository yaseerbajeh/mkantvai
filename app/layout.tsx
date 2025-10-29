import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'مكان AI',
  description: 'لا تستطيع تحديد ماذا تشاهد؟ احصل على اقتراحات أفلام ومسلسلات مخصصة بناءً على تفضيلاتك. فلترة حسب التصنيف، السنة، المنصة، والمزيد.',
  keywords: ['اقتراحات أفلام', 'ماذا أشاهد', 'البحث عن أفلام', 'توصيات مسلسلات', 'دليل البث'],
  icons: {
    icon: '/logos/logo.png',
    shortcut: '/logos/logo.png',
    apple: '/logos/logo.png',
  },
  openGraph: {
    title: 'مكان AI',
    description: 'احصل على اقتراحات أفلام ومسلسلات مخصصة بناءً على تفضيلاتك',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
