import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';
import { ThemeProvider } from '../components/theme-provider';

export const metadata: Metadata = {
  title: 'Discord Bot Dashboard',
  description: 'Manage your Discord bot and servers from one place.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4f46e5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
