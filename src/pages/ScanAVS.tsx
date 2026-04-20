import { UploadCloud, FileText, CheckCircle } from 'lucide-react';

const MOCK_PARSED_DATA = [
  { med: 'Lisinopril', dosage: '10mg', time: '08:00 AM' },
  { med: 'Atorvastatin', dosage: '20mg', time: '06:00 PM' },
];

export default function ScanAVS() {
  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto h-full flex flex-col space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Scan AVS</h1>
        <p className="text-textSecondary">Digitize physical After Visit Summaries instantly via AI.</p>
      </header>

      {/* Top: Dropzone */}
      <div className="border-2 border-dashed border-surfaceSecondary rounded-3xl p-10 flex flex-col items-center justify-center bg-surface/20 hover:bg-surface/40 transition-colors cursor-pointer group">
        <div className="bg-surfaceSecondary p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
          <UploadCloud className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-white font-medium text-lg mb-1">Upload AVS Document</h3>
        <p className="text-textSecondary text-sm text-center">Drag and drop your PDF or image here, or click to browse files.</p>
      </div>

      {/* Middle: Parsed Results Staging Table */}
      <div className="bg-surface border border-surfaceSecondary rounded-2xl overflow-hidden shadow-lg">
        <div className="bg-surfaceSecondary/50 p-4 border-b border-surfaceSecondary flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">AI Parsed Results (Staging)</h3>
        </div>
        <div className="px-4 py-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-textSecondary border-b border-surfaceSecondary">
                <th className="pb-2 pt-2 font-medium">Medication</th>
                <th className="pb-2 pt-2 font-medium">Dosage</th>
                <th className="pb-2 pt-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_PARSED_DATA.map((row, i) => (
                <tr key={i} className="border-b border-surfaceSecondary/50 last:border-0 text-sm text-white">
                  <td className="py-4 font-medium">{row.med}</td>
                  <td className="py-4 text-textSecondary">{row.dosage}</td>
                  <td className="py-4 text-textSecondary">{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom: Human In The Loop CTA Action */}
      <div className="mt-auto space-y-3 pt-6">
        <button className="w-full bg-primary hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-2xl flex justify-center items-center gap-2 transition-all active:scale-95 shadow-lg shadow-primary/20">
          <CheckCircle className="w-5 h-5" />
          Approve & Add to Schedule
        </button>
        <button className="w-full bg-transparent border border-surfaceSecondary text-textSecondary hover:text-white hover:bg-surfaceSecondary/50 font-semibold py-4 px-6 rounded-2xl transition-all active:scale-95">
          Reject / Edit Data
        </button>
      </div>
    </div>
  );
}
