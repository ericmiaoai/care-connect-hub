import { NavLink, Outlet } from 'react-router-dom';
import { Calendar, LayoutDashboard, MessageSquare, ScanLine } from 'lucide-react';
import { ReactNode } from 'react';

const NAV_ITEMS = [
  { name: 'My Day', path: '/', icon: LayoutDashboard },
  { name: 'Calendar', path: '/calendar', icon: Calendar },
  { name: 'Updates', path: '/updates', icon: MessageSquare },
  { name: 'Scan AVS', path: '/scan', icon: ScanLine },
];

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-background text-textPrimary overflow-hidden font-sans">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-surfaceSecondary bg-surface p-6">
        <div className="font-extrabold text-2xl tracking-tight mb-10 text-white">
          CareSync
        </div>
        <nav className="flex-1 space-y-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-primary/10 text-primary font-semibold' 
                    : 'text-textSecondary hover:bg-surfaceSecondary hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-24 md:pb-12 scroll-smooth">
          <Outlet />
        </div>
        
        {/* Dislaimer (Persistent Bottom) */}
        <div className="sticky bottom-0 md:bottom-0 p-3 bg-background/80 backdrop-blur-md border-t border-surfaceSecondary text-center pb-[5.5rem] md:pb-3 z-0">
          <p className="text-[10px] sm:text-xs text-textSecondary uppercase tracking-wider font-medium opacity-70">
            CareSync is an administrative organizational tool, not a substitute for professional medical advice.
          </p>
        </div>

        {/* Mobile Bottom Tab Navigation */}
        <nav className="md:hidden absolute bottom-0 left-0 right-0 h-16 bg-surface/90 backdrop-blur-xl border-t border-surfaceSecondary flex items-center justify-around z-50 pb-safe">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-full h-full space-y-1 transition-all ${
                  isActive ? 'text-primary' : 'text-textSecondary'
                }`
              }
            >
              <item.icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </main>
    </div>
  );
}
