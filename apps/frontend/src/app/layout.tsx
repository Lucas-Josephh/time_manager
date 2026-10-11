import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import AppProvider from '@/components/providers/AppProvider';
import './globals.scss';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Time Manager',
  description: 'Employee time tracking',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
