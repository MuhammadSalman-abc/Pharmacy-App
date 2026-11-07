import type { Metadata } from 'next';
import './globals.css';
import './customer-search.css';
import './stock-feedback.css';
import './delete-medicine.css';
import './theme.css';
export const metadata: Metadata = { title: 'MediStock · Pharmacy Workspace', description: 'Offline pharmacy inventory and point of sale.' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
