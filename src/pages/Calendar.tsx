import { Pill, Car, CalendarClock } from 'lucide-react';

export default function Calendar() {
  // Mock monthly structure (just showing dates conceptually for MVP)
  const days = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Shared Care Calendar</h1>
        <p className="text-textSecondary">Unified schedule to prevent double-booking.</p>
      </header>

      {/* Minimalism concept: A clean readable grid */}
      <div className="grid grid-cols-7 gap-px bg-surfaceSecondary rounded-2xl overflow-hidden border border-surfaceSecondary">
        {/* Days of week */}
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="bg-surface/80 p-2 text-center text-xs font-semibold text-textSecondary uppercase tracking-wider backdrop-blur-sm">
            {d}
          </div>
        ))}
        
        {/* Date cells */}
        {days.map((day) => (
          <div key={day} className="bg-surface min-h-[100px] p-2 hover:bg-surface/80 transition-colors">
            <span className="text-sm font-medium text-textSecondary mb-2 block">{day}</span>
            <div className="space-y-1.5">
              {/* Mocking specific events for visual demonstration */}
              {day === 12 && (
                <div className="flex items-center gap-1.5 bg-success/20 text-success p-1 rounded-md text-xs font-medium">
                  <Pill className="w-3 h-3" /> Rx Refill
                </div>
              )}
              {day === 15 && (
                <div className="flex items-center gap-1.5 bg-primary/20 text-primary p-1 rounded-md text-xs font-medium">
                  <Car className="w-3 h-3" /> Dr. Visit
                </div>
              )}
              {day === 22 && (
                <div className="flex items-center gap-1.5 bg-warning/20 text-warning p-1 rounded-md text-xs font-medium">
                  <CalendarClock className="w-3 h-3" /> Therapy
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
