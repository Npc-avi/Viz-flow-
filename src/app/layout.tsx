import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GitCode Flow - Interactive GitHub Architecture & Route Visualizer',
  description: 'Convert GitHub Express & TypeScript repositories into interactive visual call graphs with exact source line slicing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
