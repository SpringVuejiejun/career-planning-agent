// components/Layout.tsx
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/app-sidebar';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider className='h-svh w-full overflow-hidden'>
        <AppSidebar />
        <SidebarInset className='min-w-0 bg-background'>
          <div className='flex h-full min-h-0 w-full'>{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
