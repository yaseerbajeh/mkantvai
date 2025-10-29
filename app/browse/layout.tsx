import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Browse Movies & Series - MovieSuggester',
  description: 'Browse and filter movies and series by genre, year, platform, and more. Find your perfect watch with our advanced filtering system.',
  openGraph: {
    title: 'Browse Movies & Series - MovieSuggester',
    description: 'Browse and filter movies and series by genre, year, platform, and more.',
  },
};

export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
