import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { getLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of using Buen Tiro for tournaments, clinics, and lessons.",
  alternates: { canonical: "/terms" },
};

export default async function TermsOfServicePage() {
  const locale = await getLocale();
  const updated = "April 28, 2026";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-emerald-500">
          {locale === "es" ? "Términos del Servicio" : "Terms of Service"}
        </p>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {locale === "es" ? "Términos de uso de Buen Tiro" : "Buen Tiro terms of use"}
        </h1>
        <p className="mb-8 text-sm text-zinc-500">
          {locale === "es" ? "Actualizados el" : "Last updated"} {updated}
        </p>

        {locale === "es" ? <SpanishTerms /> : <EnglishTerms />}
      </main>
      <PublicFooter />
    </div>
  );
}

function EnglishTerms() {
  return (
    <div className="space-y-8 text-zinc-300 leading-relaxed [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-zinc-200 [&_p]:mb-4 [&_li]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_a]:text-emerald-400 [&_a]:underline">
      <p>
        These terms govern your use of Buen Tiro at buentiro.app. By creating an account, registering
        for an event, or otherwise using the service, you agree to them.
      </p>

      <h2>The service</h2>
      <p>
        Buen Tiro is a platform that connects pickleball players with tournaments, clinics, and
        coaches in Puerto Rico. We provide the software; the events themselves are operated by the
        clubs, organizers, and coaches who post them. Buen Tiro is not the organizer of those
        events and is not responsible for how they&apos;re run.
      </p>

      <h2>Eligibility</h2>
      <p>
        You must be at least 13 years old to use Buen Tiro. If you&apos;re registering a minor,
        you confirm you&apos;re a parent or legal guardian and accept these terms on their behalf.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You&apos;re responsible for the email address tied to your account.</li>
        <li>Sign-in is via magic link — keep your inbox secure and don&apos;t share your link.</li>
        <li>
          The information you provide (name, email, phone, skill rating) must be accurate. Other
          players and organizers rely on it.
        </li>
      </ul>

      <h2>Communications</h2>
      <p>
        By registering you consent to receive operational messages by email, SMS, and WhatsApp at
        the addresses and phone numbers you provide. Full details are in the{" "}
        <Link href="/privacy">Privacy Policy</Link>. You can opt out of WhatsApp and SMS by replying
        STOP, or close your account at any time.
      </p>

      <h2>Tournaments, clinics, and lessons</h2>
      <ul>
        <li>
          Each event is run by an independent organizer or coach. Their rules, format, prize
          structure, and refund policy are set by them.
        </li>
        <li>
          Payments are handled directly between you and the organizer or coach (Venmo, ATH Móvil,
          cash, etc.). Buen Tiro does not process payments and is not a party to the transaction.
        </li>
        <li>
          Cancellation, refunds, weather/court delays, and disputes about play or seeding are
          decided by the organizer.
        </li>
        <li>
          Pickleball involves physical activity. <strong>You play at your own risk.</strong>{" "}
          Buen Tiro is not liable for injuries, lost or damaged equipment, or property issues at
          the venue.
        </li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Register someone else without their permission, or use a fake identity.</li>
        <li>Harass other players, coaches, or organizers through any messages sent via Buen Tiro.</li>
        <li>Try to access another user&apos;s account, scrape the platform at scale, or interfere with the service&apos;s operation.</li>
        <li>Misrepresent your skill rating in a way that disrupts an event or category.</li>
      </ul>
      <p>
        We can suspend or remove accounts that violate these rules, with or without notice depending
        on severity.
      </p>

      <h2>Coach + organizer responsibilities</h2>
      <p>
        If you operate a workspace on Buen Tiro (run a club, run a tournament, or list yourself as a
        coach), you also agree to:
      </p>
      <ul>
        <li>Use the contact information of registered players only for the operation of the events they signed up for.</li>
        <li>Honor the registration and refund expectations you set on your event listing.</li>
        <li>Run events safely and maintain accurate event info on the platform.</li>
        <li>Comply with applicable Puerto Rico law for any in-person event you organize.</li>
      </ul>

      <h2>Intellectual property</h2>
      <p>
        Buen Tiro, the wordmark, and the platform code are ours. Event flyers, photos, and copy you
        upload remain yours, but you grant us a license to display them on the platform for the
        purpose of running your event listing.
      </p>

      <h2>Disclaimers</h2>
      <p>
        The service is provided &ldquo;as is&rdquo; without warranties of any kind. We don&apos;t
        guarantee uninterrupted availability or that the service will meet every need. To the
        maximum extent permitted by law, our total liability for any claim related to the service
        is limited to the amount you paid us in the 12 months before the claim — which is typically
        zero, since registration is free.
      </p>

      <h2>Termination</h2>
      <p>
        You can stop using Buen Tiro any time, and request account deletion as described in the
        Privacy Policy. We can suspend access for violations of these terms.
      </p>

      <h2>Changes</h2>
      <p>
        Material changes to these terms will be reflected here with an updated date and announced
        by email when they affect active users. Continued use after a change means you accept the
        new terms.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the Commonwealth of Puerto Rico, without regard to
        conflicts of law.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <a href="mailto:hola@buentiro.app">hola@buentiro.app</a>.
      </p>
    </div>
  );
}

function SpanishTerms() {
  return (
    <div className="space-y-8 text-zinc-300 leading-relaxed [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-zinc-200 [&_p]:mb-4 [&_li]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_a]:text-emerald-400 [&_a]:underline">
      <p>
        Estos términos rigen tu uso de Buen Tiro en buentiro.app. Al crear una cuenta, inscribirte
        en un evento, o usar el servicio de cualquier forma, los aceptas.
      </p>

      <h2>El servicio</h2>
      <p>
        Buen Tiro es una plataforma que conecta jugadores de pickleball con torneos, clínicas y
        coaches en Puerto Rico. Nosotros proveemos el software; los eventos son operados por los
        clubes, organizadores y coaches que los publican. Buen Tiro no es el organizador y no es
        responsable de cómo se llevan a cabo.
      </p>

      <h2>Elegibilidad</h2>
      <p>
        Debes tener al menos 13 años. Si inscribes a un menor, confirmas que eres su padre, madre o
        tutor legal y aceptas estos términos en su nombre.
      </p>

      <h2>Tu cuenta</h2>
      <ul>
        <li>Eres responsable del correo asociado a tu cuenta.</li>
        <li>El inicio de sesión es por enlace mágico — mantén tu correo seguro y no compartas el enlace.</li>
        <li>
          La información que proporcionas (nombre, correo, teléfono, nivel) debe ser correcta. Otros
          jugadores y organizadores dependen de ella.
        </li>
      </ul>

      <h2>Comunicaciones</h2>
      <p>
        Al registrarte aceptas recibir mensajes operativos por correo, SMS y WhatsApp a las
        direcciones y números que proporciones. Los detalles están en la{" "}
        <Link href="/privacy">Política de Privacidad</Link>. Puedes optar por no recibir mensajes
        de WhatsApp o SMS respondiendo STOP, o cerrar tu cuenta en cualquier momento.
      </p>

      <h2>Torneos, clínicas y lecciones</h2>
      <ul>
        <li>
          Cada evento es operado por un organizador o coach independiente. Sus reglas, formato,
          premios y política de reembolsos los establecen ellos.
        </li>
        <li>
          Los pagos se manejan directamente entre tú y el organizador o coach (Venmo, ATH Móvil,
          efectivo, etc.). Buen Tiro no procesa pagos y no es parte de la transacción.
        </li>
        <li>
          Cancelaciones, reembolsos, demoras por clima o canchas, y disputas sobre el juego o
          seeding las decide el organizador.
        </li>
        <li>
          El pickleball es actividad física. <strong>Juegas bajo tu propio riesgo.</strong> Buen
          Tiro no es responsable por lesiones, equipo perdido o dañado, o problemas de propiedad
          en la cancha.
        </li>
      </ul>

      <h2>Uso aceptable</h2>
      <p>Aceptas no:</p>
      <ul>
        <li>Inscribir a otra persona sin su permiso, o usar una identidad falsa.</li>
        <li>Acosar a otros jugadores, coaches u organizadores en mensajes enviados por Buen Tiro.</li>
        <li>
          Intentar acceder a la cuenta de otro usuario, hacer scraping a gran escala, o interferir
          con la operación del servicio.
        </li>
        <li>Tergiversar tu nivel de juego de manera que afecte un evento o categoría.</li>
      </ul>
      <p>
        Podemos suspender o eliminar cuentas que violen estas reglas, con o sin previo aviso según
        la gravedad.
      </p>

      <h2>Responsabilidades de coaches y organizadores</h2>
      <p>
        Si operas un workspace en Buen Tiro (un club, un torneo, o una lista como coach), también
        aceptas:
      </p>
      <ul>
        <li>Usar la información de contacto de los jugadores inscritos solo para operar los eventos en los que se inscribieron.</li>
        <li>Cumplir con las expectativas de inscripción y reembolso que publiques en tu evento.</li>
        <li>Operar eventos de manera segura y mantener información correcta en la plataforma.</li>
        <li>Cumplir con la ley de Puerto Rico aplicable a cualquier evento presencial que organices.</li>
      </ul>

      <h2>Propiedad intelectual</h2>
      <p>
        Buen Tiro, su nombre y el código de la plataforma son nuestros. Los flyers, fotos y textos
        que subas siguen siendo tuyos, pero nos otorgas una licencia para mostrarlos en la
        plataforma para operar tu evento.
      </p>

      <h2>Limitaciones</h2>
      <p>
        El servicio se provee &ldquo;tal cual&rdquo; sin garantías. No garantizamos disponibilidad
        ininterrumpida ni que el servicio cubra todas las necesidades. Hasta el máximo permitido
        por la ley, nuestra responsabilidad total por cualquier reclamo se limita al monto que nos
        pagaste en los 12 meses previos al reclamo — que normalmente es cero, ya que el registro
        es gratuito.
      </p>

      <h2>Terminación</h2>
      <p>
        Puedes dejar de usar Buen Tiro en cualquier momento y solicitar la eliminación de tu cuenta
        como se describe en la Política de Privacidad. Podemos suspender el acceso por violaciones
        de estos términos.
      </p>

      <h2>Cambios</h2>
      <p>
        Cambios materiales a estos términos se reflejarán aquí con la fecha actualizada y se
        anunciarán por correo cuando afecten a usuarios activos. El uso continuado después de un
        cambio significa que aceptas los nuevos términos.
      </p>

      <h2>Ley aplicable</h2>
      <p>
        Estos términos se rigen por las leyes del Estado Libre Asociado de Puerto Rico, sin
        consideración a conflictos de leyes.
      </p>

      <h2>Contacto</h2>
      <p>
        Preguntas: <a href="mailto:hola@buentiro.app">hola@buentiro.app</a>.
      </p>
    </div>
  );
}
