import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import Script from 'next/script';
import { CartProvider } from '@/lib/cart-context';

const inter = Inter({ subsets: ['latin'] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mkantvplus.com/';
const defaultOgImage = 'https://f.top4top.io/p_3601uhadl1.png';
const faviconUrl = 'https://www.mkantvplus.com/img/svg/logo.svg';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'مكان AI',
  description:
    'لا تستطيع تحديد ماذا تشاهد؟ احصل على اقتراحات أفلام ومسلسلات مخصصة بناءً على تفضيلاتك. فلترة حسب التصنيف، السنة، المنصة، والمزيد.',
  keywords: ['اقتراحات أفلام', 'ماذا أشاهد', 'البحث عن أفلام', 'توصيات مسلسلات', 'دليل البث'],
  alternates: {
    canonical: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
  },
  themeColor: '#0b132b',
  icons: {
    icon: [
      { url: faviconUrl, type: 'image/svg+xml', sizes: 'any' },
      { url: defaultOgImage, type: 'image/png', sizes: '32x32' },
      { url: defaultOgImage, type: 'image/png', sizes: '16x16' },
    ],
    shortcut: [{ url: faviconUrl, type: 'image/svg+xml', sizes: 'any' }],
    apple: [{ url: defaultOgImage, type: 'image/png', sizes: '180x180' }],
  },
  openGraph: {
    title: 'مكان AI',
    description: 'احصل على اقتراحات أفلام ومسلسلات مخصصة بناءً على تفضيلاتك',
    type: 'website',
    url: siteUrl,
    siteName: 'مكان TV',
    locale: 'ar_SA',
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: 'مكان TV' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'مكان AI',
    description: 'احصل على اقتراحات أفلام ومسلسلات مخصصة بناءً على تفضيلاتك',
    images: [defaultOgImage],
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
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Amiri:wght@400;700&family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        {/* Organization JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'مكان TV',
              url: siteUrl,
              logo: defaultOgImage,
              sameAs: ['https://www.instagram.com/maakaantv'],
            }),
          }}
        />
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
