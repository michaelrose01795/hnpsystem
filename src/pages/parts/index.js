import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function PartsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/stock-catalogue');
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '1.2rem',
      color: 'var(--text-secondary)'
    }}>
      Redirecting to Stock Catalogue...
    </div>
  );
}
