import { Link } from 'wouter';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PrivacyPolicy() {
  const { language } = useLanguage();
  const updated = new Date().toLocaleDateString(language === 'es' ? 'es-CO' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-white">
      <div className="container max-w-3xl py-12 md:py-20">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-accent transition-colors mb-8">
          <ArrowLeft size={16} />
          {language === 'es' ? 'Volver al inicio' : 'Back to home'}
        </Link>

        <h1 className="text-3xl md:text-4xl font-black text-primary mb-2">
          {language === 'es' ? 'Política de Privacidad' : 'Privacy Policy'}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {language === 'es' ? `Última actualización: ${updated}` : `Last updated: ${updated}`}
        </p>

        <div className="flex items-start gap-3 p-4 rounded-2xl bg-orange-50 border border-orange-100 text-sm text-orange-900 mb-10">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <p>
            {language === 'es'
              ? 'Esta es una plantilla base generada automáticamente a partir de lo que el sitio realmente hace. Te recomendamos que la revise un abogado antes de publicarla, especialmente si vas a operar en la Unión Europea (GDPR) o con menores de edad.'
              : 'This is a base template auto-generated from what the site actually does. We recommend having a lawyer review it before publishing, especially if you operate in the EU (GDPR) or with minors.'}
          </p>
        </div>

        <div className="prose prose-sm md:prose-base max-w-none text-foreground space-y-8">
          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '1. Quiénes somos' : '1. Who we are'}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {language === 'es'
                ? 'Easycomex ("nosotros") opera easycomex.com y su aplicación asociada para ayudar a marcas latinoamericanas a vender en Estados Unidos. Puedes contactarnos en info@easycomex.com.'
                : 'Easycomex ("we") operates easycomex.com and its associated app to help Latin American brands sell in the United States. You can reach us at info@easycomex.com.'}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '2. Qué datos recopilamos' : '2. What data we collect'}</h2>
            <ul className="list-disc pl-5 text-muted-foreground leading-relaxed space-y-1">
              <li>{language === 'es' ? 'Datos de contacto: nombre, email, teléfono, empresa, país, cuando completas el formulario de contacto o la calculadora de fletes.' : 'Contact details: name, email, phone, company, country, when you fill out the contact form or freight calculator.'}</li>
              <li>{language === 'es' ? 'Datos de cuenta: email y contraseña (gestionada de forma segura por Supabase, nunca la vemos en texto plano) si te registras.' : 'Account data: email and password (securely managed by Supabase, we never see it in plain text) if you register.'}</li>
              <li>{language === 'es' ? 'Datos de pago: si compras un plan, el pago lo procesa Wompi (o Stripe, según el plan) directamente — no almacenamos números de tarjeta en nuestros servidores.' : 'Payment data: if you purchase a plan, Wompi (or Stripe, depending on the plan) processes it directly — we do not store card numbers on our servers.'}</li>
              <li>{language === 'es' ? 'Datos de uso y publicidad: si tenemos píxeles de Meta, TikTok o Google Analytics activos, estos recopilan datos de navegación según sus propias políticas.' : 'Usage and advertising data: if we have Meta, TikTok, or Google Analytics pixels active, they collect browsing data per their own policies.'}</li>
              <li>{language === 'es' ? 'Conversaciones con el chatbot: si usas el asistente virtual, tus mensajes pueden procesarse por un proveedor de inteligencia artificial (Anthropic) para generar respuestas.' : "Chatbot conversations: if you use the virtual assistant, your messages may be processed by an AI provider (Anthropic) to generate responses."}</li>
              <li>{language === 'es' ? 'Análisis de producto: si le tomas una foto a una etiqueta, la foto se procesa con el mismo proveedor de inteligencia artificial para leerla, y la descripción del producto (no tus datos personales) puede enviarse a un servicio de clasificación arancelaria para sugerir partidas.' : 'Product analysis: if you photograph a label, the photo is processed by the same AI provider to read it, and the product description (not your personal data) may be sent to a tariff classification service to suggest tariff lines.'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '3. Cómo usamos tus datos' : '3. How we use your data'}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {language === 'es'
                ? 'Usamos tus datos para responder tus solicitudes, darte cotizaciones, gestionar tu cuenta, procesar pagos, mejorar nuestros servicios y, si aceptaste recibir comunicaciones, enviarte información sobre crecimiento ecommerce.'
                : 'We use your data to respond to your requests, provide quotes, manage your account, process payments, improve our services, and, if you opted in, send you ecommerce growth content.'}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '4. Con quién compartimos datos' : '4. Who we share data with'}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {language === 'es' ? 'No vendemos tus datos. Los compartimos únicamente con los proveedores que nos ayudan a operar el servicio:' : "We don't sell your data. We only share it with the providers that help us run the service:"}
            </p>
            <ul className="list-disc pl-5 text-muted-foreground leading-relaxed space-y-1 mt-2">
              <li>Supabase ({language === 'es' ? 'base de datos y autenticación' : 'database and authentication'})</li>
              <li>Wompi ({language === 'es' ? 'procesamiento de pagos en Colombia' : 'payment processing in Colombia'})</li>
              <li>Stripe ({language === 'es' ? 'procesamiento de pagos internacionales' : 'international payment processing'})</li>
              <li>Anthropic ({language === 'es' ? 'chatbot con inteligencia artificial, opcional' : 'AI chatbot, optional'})</li>
              <li>Meta, TikTok, Google ({language === 'es' ? 'medición de campañas publicitarias, opcional' : 'ad campaign measurement, optional'})</li>
              <li>Calendly / Cal.com ({language === 'es' ? 'agendamiento de consultorías, opcional' : 'consultation scheduling, optional'})</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '5. Tus derechos' : '5. Your rights'}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {language === 'es'
                ? 'Puedes pedirnos acceder, corregir o eliminar tus datos escribiendo a info@easycomex.com. Puedes eliminar tu cuenta desde el dashboard o solicitándolo por email.'
                : 'You can ask us to access, correct, or delete your data by writing to info@easycomex.com. You can delete your account from the dashboard or by requesting it via email.'}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '6. Cookies y almacenamiento local' : '6. Cookies and local storage'}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {language === 'es'
                ? 'Usamos localStorage del navegador para recordar tu idioma preferido y, si llegaste por un link de referido, el código de quien te refirió. No usamos cookies de seguimiento propias más allá de las que instalan los píxeles de publicidad, si están activos.'
                : "We use browser localStorage to remember your preferred language and, if you arrived via a referral link, the referrer's code. We don't use our own tracking cookies beyond what advertising pixels install, if active."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '7. Menores de edad' : '7. Children'}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {language === 'es'
                ? 'Nuestros servicios están dirigidos a empresas y no están destinados a menores de 18 años.'
                : 'Our services are directed at businesses and are not intended for anyone under 18.'}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '8. Contacto' : '8. Contact'}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {language === 'es' ? 'Preguntas sobre esta política: ' : 'Questions about this policy: '}
              <a href="mailto:info@easycomex.com" className="text-accent font-semibold hover:underline">info@easycomex.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
