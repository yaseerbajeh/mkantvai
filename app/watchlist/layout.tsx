import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'قائمة المشاهدة - اقتراحات الأفلام',
  description: 'قائمة المشاهدة الخاصة بك - الأفلام والمسلسلات المحفوظة',
};

export default function WatchlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

