import { AlertTriangle, MapPin, HeartHandshake, PhoneCall } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function GetHelp() {
  const navigate = useNavigate();

  const handleNeeds = (category: string) => {
    navigate(`/resources?category=${encodeURIComponent(category)}`);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 text-center">
      <div className="mb-10">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-6">
          <AlertTriangle size={32} className="text-red-600" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 md:text-5xl tracking-tight mb-4">
          I need help now
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
          You are not alone. Please select what you are looking for below, or use the emergency numbers if you are in immediate danger.
        </p>
      </div>

      {/* Decision Wizard */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-left mb-12">
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">What do you need assistance with today?</h2>
        </div>
        <div className="p-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <button 
              onClick={() => handleNeeds('Housing & Shelter')}
              className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition-all text-left bg-white shadow-sm"
            >
              <div className="bg-indigo-100 text-indigo-600 p-3 rounded-full shrink-0">
                <MapPin size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">A safe place to sleep</h3>
                <p className="text-sm text-slate-500 mt-1">Shelters, transitional housing</p>
              </div>
            </button>

            <button 
              onClick={() => handleNeeds('Food & Nutrition')}
              className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-rose-500 hover:ring-1 hover:ring-rose-500 transition-all text-left bg-white shadow-sm"
            >
              <div className="bg-rose-100 text-rose-600 p-3 rounded-full shrink-0">
                <HeartHandshake size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Food for myself or family</h3>
                <p className="text-sm text-slate-500 mt-1">Food pantries, hot meals, SNAP</p>
              </div>
            </button>
            
            <button 
               onClick={() => handleNeeds('Healthcare & Mental Health')}
               className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-teal-500 hover:ring-1 hover:ring-teal-500 transition-all text-left bg-white shadow-sm"
            >
              <div className="bg-teal-100 text-teal-600 p-3 rounded-full shrink-0">
                 <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Mental health support</h3>
                <p className="text-sm text-slate-500 mt-1">Counseling, crisis intervention</p>
              </div>
            </button>

            <button 
               onClick={() => handleNeeds('Legal Aid')}
               className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-slate-500 hover:ring-1 hover:ring-slate-500 transition-all text-left bg-white shadow-sm"
            >
              <div className="bg-slate-100 text-slate-600 p-3 rounded-full shrink-0">
                 <PhoneCall size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Protection or legal help</h3>
                <p className="text-sm text-slate-500 mt-1">Domestic violence, eviction defense</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 24/7 Hotlines */}
      <h3 className="text-2xl font-bold text-slate-900 mb-6 border-b pb-4 border-slate-200">24/7 Free & Confidential Hotlines</h3>
      <div className="grid md:grid-cols-2 gap-4 text-left">
        <div className="bg-slate-900 text-white p-6 rounded-xl relative overflow-hidden">
           <div className="relative z-10">
             <h4 className="text-lg font-bold mb-1">National Suicide & Crisis Lifeline</h4>
             <p className="text-slate-400 text-sm mb-4">English and Spanish.</p>
             <a href="tel:988" className="inline-flex items-center gap-2 bg-white text-slate-900 font-bold px-4 py-2 rounded-lg hover:bg-slate-100 transition">
               <PhoneCall size={18} /> Call or Text 988
             </a>
           </div>
        </div>

        <div className="bg-rose-600 text-white p-6 rounded-xl relative overflow-hidden">
           <div className="relative z-10">
             <h4 className="text-lg font-bold mb-1">Domestic Violence Hotline</h4>
             <p className="text-rose-200 text-sm mb-4">Call for immediate safety planning.</p>
             <a href="tel:1-800-799-7233" className="inline-flex items-center gap-2 bg-white text-rose-600 font-bold px-4 py-2 rounded-lg hover:bg-rose-50 transition">
               <PhoneCall size={18} /> 1-800-799-SAFE
             </a>
           </div>
        </div>
      </div>
    </div>
  );
}
