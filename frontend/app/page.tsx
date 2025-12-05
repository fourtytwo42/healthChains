import { redirect } from 'next/navigation';

/**
 * Root Page - Redirects to dashboard
 */
export default function Home() {
  redirect('/dashboard');
}
