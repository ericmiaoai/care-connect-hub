import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle } from 'lucide-react';

type Task = {
  id: string;
  time: string;
  title: string;
  assignedTo: 'Mom' | 'Nurse';
};

const INITIAL_TASKS: Task[] = [
  { id: '1', time: '08:00 AM', title: 'Lisinopril 10mg', assignedTo: 'Mom' },
  { id: '2', time: '09:00 AM', title: 'Physical Therapy Exercises', assignedTo: 'Nurse' },
  { id: '3', time: '12:00 PM', title: 'Check Blood Pressure', assignedTo: 'Mom' },
  { id: '4', time: '06:00 PM', title: 'Atorvastatin 20mg', assignedTo: 'Nurse' },
];

export default function MyDay() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [completedTask, setCompletedTask] = useState<Task | null>(null);

  // Auto-hide toast after 5s
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (completedTask) {
      timer = setTimeout(() => {
        setCompletedTask(null);
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [completedTask]);

  const completeTask = (taskId: string) => {
    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex > -1) {
      setCompletedTask(tasks[taskIndex]);
      setTasks(tasks.filter((t) => t.id !== taskId));
    }
  };

  const undoLastAction = () => {
    if (completedTask) {
      // Restore task and sort by time
      const newTasks = [...tasks, completedTask].sort(
        (a, b) => a.id.localeCompare(b.id)
      );
      setTasks(newTasks);
      setCompletedTask(null);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto h-full flex flex-col relative">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">My Day</h1>
        <p className="text-textSecondary">Stay on top of today's schedule.</p>
      </header>

      <div className="flex-1 space-y-4">
        <AnimatePresence>
          {tasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-textSecondary mt-20"
            >
              All caught up for today!
            </motion.div>
          ) : (
            tasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: -50 }}
                transition={{ duration: 0.2 }}
                className={`flex items-center justify-between p-5 rounded-2xl bg-surface/50 backdrop-blur-xl border border-surfaceSecondary shadow-lg relative overflow-hidden group`}
              >
                {/* Global Color-Coding Border (Mom = Blue, Nurse = Emerald) */}
                <div 
                  className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    task.assignedTo === 'Mom' ? 'bg-primary' : 'bg-emerald-500'
                  }`}
                />
                
                <div className="pl-4 flex flex-col">
                  <span className="text-sm font-semibold tracking-wide text-textSecondary uppercase mb-1">
                    {task.time} &middot; {task.assignedTo}
                  </span>
                  <span className="text-lg font-medium text-white">{task.title}</span>
                </div>

                {/* Large Touchable Checkbox (min 44x44px target) */}
                <button
                  onClick={() => completeTask(task.id)}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-surfaceSecondary/50 hover:bg-success/20 hover:text-success transition-colors group-hover:scale-105 active:scale-95"
                  aria-label="Complete Task"
                >
                  <Circle className="w-7 h-7 text-textSecondary group-hover:hidden" />
                  <CheckCircle2 className="w-7 h-7 hidden group-hover:block" />
                </button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Persistent Undo Toast via Framer Motion */}
      <AnimatePresence>
        {completedTask && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-50 fixed md:absolute"
          >
            <div className="bg-surfaceSecondary border border-zinc-700 shadow-2xl rounded-2xl p-4 flex items-center justify-between">
              <span className="text-white font-medium">Task Completed</span>
              <button
                onClick={undoLastAction}
                className="text-primary font-bold hover:text-blue-400 p-2 uppercase tracking-wide text-sm"
              >
                Undo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
