import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';

const growthData = [
  { mes: 'M1', sinEC: 4, conEC: 4 },
  { mes: 'M2', sinEC: 4.3, conEC: 7 },
  { mes: 'M3', sinEC: 4.6, conEC: 12 },
  { mes: 'M4', sinEC: 4.8, conEC: 19 },
  { mes: 'M5', sinEC: 5.1, conEC: 27 },
  { mes: 'M6', sinEC: 5.3, conEC: 38 },
];

const channelData = [
  { canal: 'Amazon', valor: 42 },
  { canal: 'TikTok Shop', valor: 31 },
  { canal: 'Shopify', valor: 18 },
  { canal: 'Otros', valor: 9 },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl app-shadow border border-gray-100 px-3 py-2 text-xs">
      <p className="font-bold text-primary mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export default function ImpactSection() {
  const { language } = useLanguage();

  return (
    <section className="py-20 md:py-32 bg-white relative overflow-hidden">
      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="text-4xl md:text-5xl font-black text-primary mb-4">
            {language === 'es' ? 'El impacto de' : 'The impact of'}
            <span className="text-accent"> {language === 'es' ? 'hacerlo bien' : 'doing it right'}</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {language === 'es'
              ? 'Así se ve una expansión a USA planeada vs. una improvisada. Datos ilustrativos basados en trayectorias típicas de marcas que trabajan con nosotros.'
              : "This is what a planned US expansion looks like vs. an improvised one. Illustrative data based on typical trajectories of brands that work with us."}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Growth chart */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-3 bg-white rounded-3xl border border-gray-100 app-shadow p-6 md:p-8"
          >
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <h3 className="font-bold text-primary">
                {language === 'es' ? 'Facturación mensual estimada (USD miles)' : 'Estimated monthly revenue (USD thousands)'}
              </h3>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1 text-accent"><span className="w-2.5 h-2.5 rounded-full bg-accent inline-block"></span>{language === 'es' ? 'Con Easycomex' : 'With Easycomex'}</span>
                <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block"></span>{language === 'es' ? 'Sin estrategia' : 'Without a strategy'}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">{language === 'es' ? 'Ejemplo ilustrativo, no es una garantía de resultados.' : 'Illustrative example, not a guarantee of results.'}</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="conEC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF5A36" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#FF5A36" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFEFF4" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#6B6B85' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#6B6B85' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="sinEC" name={language === 'es' ? 'Sin estrategia' : 'Without strategy'} stroke="#C9C9D6" strokeWidth={2} fill="transparent" />
                  <Area type="monotone" dataKey="conEC" name={language === 'es' ? 'Con Easycomex' : 'With Easycomex'} stroke="#FF5A36" strokeWidth={3} fill="url(#conEC)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Channel mix chart */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 app-shadow p-6 md:p-8"
          >
            <h3 className="font-bold text-primary mb-1">
              {language === 'es' ? 'Mezcla de canales típica' : 'Typical channel mix'}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">{language === 'es' ? '% de ventas por canal' : '% of sales by channel'}</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="canal" type="category" tick={{ fontSize: 12, fill: '#1B1A45', fontWeight: 700 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#FFF1EA' }} />
                  <Bar dataKey="valor" name="%" fill="#FF5A36" radius={[0, 8, 8, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
