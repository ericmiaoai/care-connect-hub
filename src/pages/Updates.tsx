import { motion } from 'framer-motion';

const MOCK_UPDATES = [
  {
    id: 'u1',
    admin: 'Sarah (Admin)',
    timestamp: 'Today at 10:45 AM',
    content: "Dad's physical therapy went really well this morning. He managed 15 minutes on the bike without any knee pain. We're keeping the current medication routine.",
    color: 'bg-primary'
  },
  {
    id: 'u2',
    admin: 'Sarah (Admin)',
    timestamp: 'Yesterday at 4:10 PM',
    content: "Just picked up the new Lisinopril prescription from CVS. It's in the top drawer of the med cabinet. Everyone please make sure to mark it in 'My Day' when administered.",
    color: 'bg-primary'
  }
];

export default function Updates() {
  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Status Updates</h1>
        <p className="text-textSecondary">Centralized broadcasts from family admins.</p>
      </header>

      <div className="flex-1 space-y-6">
        {MOCK_UPDATES.map((update, index) => (
          <motion.div 
            key={update.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-5 rounded-2xl bg-surface/50 backdrop-blur-xl border border-surfaceSecondary relative overflow-hidden"
          >
            {/* Admin Color bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${update.color}`} />
            
            <div className="pl-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-white">{update.admin}</span>
                <span className="text-xs font-medium text-textSecondary uppercase tracking-wider">{update.timestamp}</span>
              </div>
              <p className="text-textSecondary leading-relaxed">
                {update.content}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
