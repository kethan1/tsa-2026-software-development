import { Phone } from 'lucide-react';

export default function EmergencyBanner() {
  return (
    <div className="bg-red-600 text-white px-4 py-2 text-sm font-medium">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6">
        <span className="font-bold uppercase tracking-wider">Need help now?</span>
        <div className="flex items-center gap-4">
          <a href="tel:911" className="flex items-center gap-1 hover:underline">
            <Phone size={14} /> Emergency: 911
          </a>
          <a href="tel:988" className="flex items-center gap-1 hover:underline">
            <Phone size={14} /> Crisis Lifeline: 988
          </a>
        </div>
      </div>
    </div>
  );
}
