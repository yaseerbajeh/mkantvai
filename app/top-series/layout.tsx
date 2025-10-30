import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'أفضل المسلسلات تقييماً - مكان TV',
  description: 'اكتشف أفضل المسلسلات تقييماً على الإطلاق',
};

export default function TopSeriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

