// file location: src/pages/parts/index.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import PartsRedirectUi from "@/components/page-ui/parts/parts-ui"; // Extracted presentation layer.
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";

export default function PartsRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (isPresentationMode()) return;
    router.replace('/stock-catalogue');
  }, [router]);

  return <PartsRedirectUi view="section1" />;











}
