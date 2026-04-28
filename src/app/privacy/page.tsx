import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { getLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Buen Tiro collects, uses, and protects your information.",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPolicyPage() {
  const locale = await getLocale();
  const updated = "April 28, 2026";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-emerald-500">
          {locale === "es" ? "Política de Privacidad" : "Privacy Policy"}
        </p>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {locale === "es" ? "Tu privacidad en Buen Tiro" : "Your privacy at Buen Tiro"}
        </h1>
        <p className="mb-8 text-sm text-zinc-500">
          {locale === "es" ? "Actualizada el" : "Last updated"} {updated}
        </p>

        {locale === "es" ? <SpanishPrivacy /> : <EnglishPrivacy />}
      </main>
      <PublicFooter />
    </div>
  );
}

function EnglishPrivacy() {
  return (
    <div className="space-y-8 text-zinc-300 leading-relaxed [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-zinc-200 [&_p]:mb-4 [&_li]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_a]:text-emerald-400 [&_a]:underline">
      <p>
        Buen Tiro (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates buentiro.app — a platform for
        pickleball tournaments, clinics, and lessons in Puerto Rico. This page explains what we
        collect, why, and how we use it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Identity:</strong> first name, last name, email, phone number — provided when you
          register for a tournament, sign up for a clinic, request a lesson, or are signed up by a
          partner/coach.
        </li>
        <li>
          <strong>Skill / event data:</strong> self-reported skill rating, partner pairings, lesson
          goals or scheduling preferences, registration timestamps and statuses (registered,
          waitlisted, cancelled), and payment confirmation entered by event organizers.
        </li>
        <li>
          <strong>Account data:</strong> when you sign in via magic link, the auth session and
          last-sign-in time are stored.
        </li>
        <li>
          <strong>Push subscriptions (optional):</strong> if you enable PWA notifications, the
          subscription endpoint and keys provided by your browser.
        </li>
        <li>
          <strong>Service logs:</strong> standard request logs (IP, user agent) retained briefly for
          security and abuse prevention.
        </li>
      </ul>

      <h2 id="communications">Communications consent</h2>
      <p>
        <strong>
          By registering on Buen Tiro — for a tournament, clinic, lesson, or account — you agree
          that we may contact you at the email address and phone number you provide via:
        </strong>
      </p>
      <ul>
        <li>
          <strong>Email</strong> — registration confirmations, magic-link sign-in, reminders,
          schedule changes, lesson invites with calendar attachments, and replies from your coach
          or event organizer.
        </li>
        <li>
          <strong>SMS</strong> — last-minute alerts, day-of reminders, and operational updates
          about events you&apos;re part of.
        </li>
        <li>
          <strong>WhatsApp</strong> — registration confirmations, lesson scheduling, day-before
          reminders, and direct conversations with your coach or event organizer (initiated by us
          or by them through the platform).
        </li>
      </ul>
      <p>
        These are transactional messages required to deliver the service you signed up for. We
        don&apos;t use your contact info for unrelated marketing. You can:
      </p>
      <ul>
        <li>
          Reply <strong>STOP</strong> to any WhatsApp or SMS message to opt out of that channel.
        </li>
        <li>Email <a href="mailto:hola@buentiro.app">hola@buentiro.app</a> to remove your phone number or close your account entirely.</li>
        <li>Disable PWA notifications in your browser at any time.</li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>To run the events you sign up for (rosters, brackets, payments, schedule).</li>
        <li>To send the operational messages described above.</li>
        <li>To match registrations to your account by email when you sign in.</li>
        <li>
          To show your registration history on your profile (<Link href="/me">/me</Link>) and notify
          your coach or event organizer when you reply.
        </li>
        <li>To diagnose abuse, fraud, or service problems.</li>
      </ul>

      <h2>Who we share with</h2>
      <p>
        We use trusted service providers to run the platform. Each of them processes only the data
        needed to deliver their part of the service:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — Postgres database + auth. Stores all of the data above in the
          US-East region.
        </li>
        <li>
          <strong>Resend</strong> — outbound email + the lesson-reply inbound relay (
          <code>replies.buentiro.app</code>). Sees the contents of emails sent and received through
          our coaching CRM.
        </li>
        <li>
          <strong>Vercel</strong> — hosting and CDN. Sees standard request metadata.
        </li>
        <li>
          <strong>Meta Platforms (WhatsApp Business)</strong> — when WhatsApp messaging is enabled,
          your phone number and message contents are processed by Meta to deliver the message.
          Subject to Meta&apos;s own policies.
        </li>
        <li>
          <strong>Twilio</strong> — used for some operational phone-number setup; no end-user data
          is sent through Twilio for normal app traffic.
        </li>
      </ul>
      <p>
        We do not sell or rent your information to anyone. We don&apos;t share with advertisers.
      </p>

      <h2>Cookies and tracking</h2>
      <p>
        We use a small number of strictly-necessary cookies: an active workspace selector for
        coaches/admins, a language preference, and Supabase&apos;s authentication session cookie.
        We don&apos;t use third-party advertising or analytics cookies.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>
          <strong>Access:</strong> sign in at <Link href="/me">/me</Link> to see every registration
          and lesson tied to your email.
        </li>
        <li>
          <strong>Deletion:</strong> email <a href="mailto:hola@buentiro.app">hola@buentiro.app</a>
          {" "}from the address on file; we&apos;ll remove your account, registrations, and contact
          details, and confirm in writing.
        </li>
        <li>
          <strong>Correction:</strong> contact your event organizer or coach to correct registration
          details.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        Buen Tiro is not directed at children under 13. If a parent or guardian registers a minor
        for an event, the parent provides the contact information used for communications.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change how we collect or use your information in a meaningful way, we&apos;ll update
        this page and the &ldquo;Last updated&rdquo; date above. Material changes will also be
        announced by email to active users.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests:{" "}
        <a href="mailto:hola@buentiro.app">hola@buentiro.app</a>.
      </p>
    </div>
  );
}

function SpanishPrivacy() {
  return (
    <div className="space-y-8 text-zinc-300 leading-relaxed [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-zinc-200 [&_p]:mb-4 [&_li]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_a]:text-emerald-400 [&_a]:underline">
      <p>
        Buen Tiro (&ldquo;nosotros&rdquo;) opera buentiro.app — una plataforma para torneos,
        clínicas y lecciones de pickleball en Puerto Rico. Esta página explica qué recopilamos, por
        qué, y cómo lo usamos.
      </p>

      <h2>Qué recopilamos</h2>
      <ul>
        <li>
          <strong>Identidad:</strong> nombre, apellido, correo, número de teléfono — recopilados
          cuando te inscribes en un torneo, clínica, solicitas una lección, o cuando un compañero o
          coach te inscribe.
        </li>
        <li>
          <strong>Datos de juego:</strong> nivel de habilidad (auto-reportado), parejas, objetivos
          de lecciones o disponibilidad, fecha de inscripción y estado (inscrito, en lista de
          espera, cancelado), y confirmación de pago ingresada por el organizador.
        </li>
        <li>
          <strong>Datos de cuenta:</strong> al iniciar sesión con un enlace mágico, se guarda la
          sesión y la fecha del último inicio.
        </li>
        <li>
          <strong>Suscripciones de notificaciones (opcional):</strong> si activas notificaciones
          PWA, el endpoint y las claves que provee tu navegador.
        </li>
        <li>
          <strong>Registros de servicio:</strong> registros estándar de solicitudes (IP, navegador)
          retenidos brevemente por seguridad.
        </li>
      </ul>

      <h2>Consentimiento de comunicaciones</h2>
      <p>
        <strong>
          Al registrarte en Buen Tiro — para un torneo, clínica, lección o cuenta — aceptas que
          podemos contactarte al correo y número de teléfono que proporcionaste mediante:
        </strong>
      </p>
      <ul>
        <li>
          <strong>Correo electrónico</strong> — confirmaciones de inscripción, enlace mágico,
          recordatorios, cambios de horario, invitaciones a lecciones con archivos de calendario, y
          respuestas de tu coach u organizador.
        </li>
        <li>
          <strong>SMS</strong> — alertas de último momento, recordatorios el día del evento y
          actualizaciones operativas.
        </li>
        <li>
          <strong>WhatsApp</strong> — confirmaciones de inscripción, agendado de lecciones,
          recordatorios el día antes, y conversaciones directas con tu coach u organizador
          (iniciadas por nosotros o por ellos a través de la plataforma).
        </li>
      </ul>
      <p>
        Estos son mensajes transaccionales necesarios para entregar el servicio. No usamos tu
        información de contacto para mercadeo no relacionado. Puedes:
      </p>
      <ul>
        <li>
          Responder <strong>STOP</strong> a cualquier mensaje de WhatsApp o SMS para optar por no
          recibir más en ese canal.
        </li>
        <li>
          Escribir a <a href="mailto:hola@buentiro.app">hola@buentiro.app</a> para eliminar tu
          número o cerrar tu cuenta completamente.
        </li>
        <li>Desactivar las notificaciones PWA en tu navegador en cualquier momento.</li>
      </ul>

      <h2>Cómo usamos tu información</h2>
      <ul>
        <li>Para operar los eventos en los que te inscribes (rosters, brackets, pagos, horario).</li>
        <li>Para enviar los mensajes operativos descritos arriba.</li>
        <li>Para asociar tus inscripciones a tu cuenta por correo cuando inicias sesión.</li>
        <li>
          Para mostrar tu historial de inscripciones en tu perfil (<Link href="/me">/me</Link>) y
          notificar a tu coach u organizador cuando respondes.
        </li>
        <li>Para diagnosticar abuso, fraude o problemas de servicio.</li>
      </ul>

      <h2>Con quién compartimos</h2>
      <p>
        Usamos proveedores de servicios confiables para operar la plataforma. Cada uno procesa solo
        la información necesaria para su parte del servicio:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — base de datos Postgres + autenticación. Guarda todos los
          datos en la región US-East.
        </li>
        <li>
          <strong>Resend</strong> — envío de correo + relay de respuestas para lecciones (
          <code>replies.buentiro.app</code>). Procesa el contenido de los correos enviados y
          recibidos.
        </li>
        <li>
          <strong>Vercel</strong> — hosting y CDN. Ve metadatos estándar de las solicitudes.
        </li>
        <li>
          <strong>Meta (WhatsApp Business)</strong> — cuando WhatsApp está activado, tu número y el
          contenido de los mensajes son procesados por Meta para entregarlos. Sujeto a las
          políticas de Meta.
        </li>
        <li>
          <strong>Twilio</strong> — usado para configuración operativa de números; no se envía
          información de usuarios por Twilio en el tráfico normal de la app.
        </li>
      </ul>
      <p>
        No vendemos ni alquilamos tu información a nadie. No compartimos con anunciantes.
      </p>

      <h2>Cookies y rastreo</h2>
      <p>
        Usamos un número pequeño de cookies estrictamente necesarias: selector de espacio de
        trabajo activo (para coaches/admins), preferencia de idioma, y la cookie de sesión de
        Supabase. No usamos cookies de publicidad ni de analytics de terceros.
      </p>

      <h2>Tus derechos</h2>
      <ul>
        <li>
          <strong>Acceso:</strong> inicia sesión en <Link href="/me">/me</Link> para ver cada
          inscripción y lección asociada a tu correo.
        </li>
        <li>
          <strong>Eliminación:</strong> escribe a{" "}
          <a href="mailto:hola@buentiro.app">hola@buentiro.app</a> desde el correo registrado;
          eliminaremos tu cuenta, inscripciones y datos de contacto, y te lo confirmaremos por
          escrito.
        </li>
        <li>
          <strong>Corrección:</strong> contacta a tu organizador o coach para corregir detalles de
          inscripción.
        </li>
      </ul>

      <h2>Menores</h2>
      <p>
        Buen Tiro no está dirigido a menores de 13 años. Si un padre, madre o tutor inscribe a un
        menor en un evento, el padre/tutor proporciona la información de contacto para las
        comunicaciones.
      </p>

      <h2>Cambios a esta política</h2>
      <p>
        Si cambiamos cómo recopilamos o usamos tu información de manera significativa, actualizaremos
        esta página y la fecha de &ldquo;Última actualización&rdquo;. Cambios materiales también se
        anunciarán por correo a usuarios activos.
      </p>

      <h2>Contacto</h2>
      <p>
        Preguntas o solicitudes:{" "}
        <a href="mailto:hola@buentiro.app">hola@buentiro.app</a>.
      </p>
    </div>
  );
}
