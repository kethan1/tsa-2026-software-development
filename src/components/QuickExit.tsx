import { X } from 'lucide-react';

export default function QuickExit() {
  const handleExit = () => {
    // Quick exit pattern - redirect immediately and decisively
    window.location.replace('https://www.google.com');
  };

  return (
    <button
      onClick={handleExit}
      title="Quick Exit - Leave site immediately"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 font-semibold text-white shadow-xl transition-all hover:bg-red-700 hover:scale-105 active:scale-95 sm:bottom-8 sm:right-8"
      aria-label="Quick Exit"
    >
      <X size={20} className="stroke-2" />
      <span>Quick Exit</span>
    </button>
  );
}
