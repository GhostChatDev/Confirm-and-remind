import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Confirm & Remind', description: 'Write it down. Confirm what matters. Get reminded.', manifest: '/manifest.webmanifest' };
export const viewport: Viewport = { themeColor: '#28634c', width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
