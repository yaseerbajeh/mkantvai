import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'أفضل الأفلام تقييماً - مكان TV',
  description: 'اكتشف أفضل الأفلام تقييماً على الإطلاق',
};

export default function TopMoviesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

