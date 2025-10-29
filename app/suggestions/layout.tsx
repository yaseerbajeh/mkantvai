import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Movie Suggestions - MovieSuggester',
  description: 'Personalized movie and series suggestions based on your preferences. Discover your next favorite watch.',
  openGraph: {
    title: 'Your Movie Suggestions - MovieSuggester',
    description: 'Personalized movie and series suggestions based on your preferences.',
  },
};

export default function SuggestionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
