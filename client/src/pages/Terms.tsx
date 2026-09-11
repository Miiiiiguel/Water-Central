import { Link } from 'wouter';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Terms() {
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
          {language === 'es' ? 'Términos y Condiciones' : 'Terms & Conditions'}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {language === 'es' ? `Última actualización: ${updated}` : `Last updated: ${updated}`}
        </p>

        <div className="flex items-start gap-3 p-4 rounded-2xl bg-orange-50 border border-orange-100 text-sm text-orange-900 mb-10">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <p>
            {language === 'es'
              ? 'Esta es una plantilla base. Te recomendamos que la revise un abogado antes de publicarla, especialmente en lo referente a pagos, reembolsos y garantías de resultados.'
              : 'This is a base template. We recommend having a lawyer review it before publishing, especially regarding payments, refunds, and results guarantees.'}
          </p>
        </div>

        <div className="prose prose-sm md:prose-base max-w-none text-foreground space-y-8">
          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '1. Aceptación' : '1. Acceptance'}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {language === 'es'
                ? 'Al usar easycomex.com o crear una cuenta, aceptas estos términos. Si no estás de acuerdo, por favor no uses el sitio.'
                : 'By using easycomex.com or creating an account, you agree to these terms. If you disagree, please do not use the site.'}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '2. Nuestros servicios' : '2. Our services'}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {language === 'es'
                ? 'Ofrecemos servicios de asesoría, logística y estrategia para ayudar a marcas a vender en Estados Unidos. Los diagnósticos, planes y análisis son estimaciones basadas en la información que nos proporcionas — no constituyen una garantía de resultados o ventas.'
                : "We offer advisory, logistics, and strategy services to help brands sell in the United States. Diagnoses, plans, and analyses are estimates based on the information you provide — they do not constitute a guarantee of results or sales."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '3. Cuentas' : '3. Accounts'}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {language === 'es'
                ? 'Eres responsable de la confidencialidad de tu contraseña y de la actividad de tu cuenta. Avísanos de inmediato si sospechas un uso no autorizado.'
                : 'You are responsible for keeping your password confidential and for your account activity. Notify us immediately if you suspect unauthorized use.'}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '4. Pagos y reembolsos' : '4. Payments and refunds'}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {language === 'es'
                ? 'Los pagos se procesan a través de Stripe. Los precios se muestran en dólares (USD) salvo que se indique lo contrario. [Completa aquí tu política real de reembolsos antes de publicar.]'
                : 'Payments are processed through Stripe. Prices are shown in US dollars unless otherwise stated. [Fill in your real refund policy here before publishing.]'}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '5. Programa de referidos' : '5. Referral program'}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {language === 'es'
                ? 'Si compartes tu link de referido, podemos rastrear qué cuentas se registraron a través de él. Las condiciones de cualquier comisión o beneficio se comunicarán por separado.'
                : 'If you share your referral link, we may track which accounts signed up through it. The terms of any commission or benefit will be communicated separately.'}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '6. Propiedad intelectual' : '6. Intellectual property'}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {language === 'es'
                ? 'El contenido, marca y materiales de Easycomex son propiedad de Easycomex y no pueden reproducirse sin autorización.'
                : "Easycomex's content, brand, and materials are owned by Easycomex and may not be reproduced without authorization."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '7. Limitación de responsabilidad' : '7. Limitation of liability'}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {language === 'es'
                ? 'Easycomex no garantiza resultados específicos de ventas o facturación. En la máxima medida permitida por la ley, no somos responsables por pérdidas indirectas derivadas del uso de nuestros servicios.'
                : 'Easycomex does not guarantee specific sales or revenue results. To the maximum extent permitted by law, we are not liable for indirect losses arising from the use of our services.'}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '8. Cambios' : '8. Changes'}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {language === 'es'
                ? 'Podemos actualizar estos términos ocasionalmente. Seguir usando el sitio después de un cambio implica aceptación de los nuevos términos.'
                : 'We may update these terms occasionally. Continuing to use the site after a change implies acceptance of the new terms.'}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">{language === 'es' ? '9. Contacto' : '9. Contact'}</h2>
            <p className="text-muted-foreground leading-relaxed">
              <a href="mailto:info@easycomex.com" className="text-accent font-semibold hover:underline">info@easycomex.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
