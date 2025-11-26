'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Settings, User, Key, Code, Plug } from 'lucide-react';

interface SettingsNavProps {
  userRole?: string;
}

export function SettingsNav({ userRole }: SettingsNavProps) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Profile', href: '/settings/profile', icon: User },
    { name: 'Integrations', href: '/settings/integrations', icon: Plug },
  ];

  // Add API Keys for developers only
  if (userRole === 'DEVELOPER') {
    navItems.push({ name: 'API Keys', href: '/settings/api-keys', icon: Key });
  }

  // Add Developer Settings for developers only
  if (userRole === 'DEVELOPER') {
    navItems.push({ name: 'Developer', href: '/settings/developer', icon: Code });
  }

  return (
    <nav className="flex flex-col space-y-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}

