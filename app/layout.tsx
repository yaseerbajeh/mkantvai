import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import Script from 'next/script';
import { CartProvider } from '@/lib/cart-context';

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Amiri:wght@400;700&display=swap" rel="stylesheet" />
        {process.env.NODE_ENV === 'development' && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
            data-enabled="true"
          />
        )}
      </head>
      <body className={inter.className}>
        <CartProvider>
          {children}
        </CartProvider>
        <Toaster />
      </body>
    </html>
  );
}
