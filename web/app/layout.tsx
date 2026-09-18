import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MnU — Restaurant Technology Platform',
  description: 'QR menus, table ordering, and restaurant management.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
