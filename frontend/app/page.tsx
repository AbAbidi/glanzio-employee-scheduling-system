"use client";

/* eslint-disable @next/next/no-img-element -- Vinext's local image optimizer requires an unavailable ASSETS binding. */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  API_BASE_URL,
  responseMessage,
  restoreSession,
  signOut,
  type AuthenticationResult,
} from "./lib/auth-client";
import GlassStory from "./glass-story";
import CustomerFeedback from "./customer-feedback";
import { openCookiePreferences } from "./lib/cookie-preferences";
import StandardsNetwork from "./standards-network";
import CompanyBenefits from "./company-benefits";
import HomeBrandIntro from "./home-brand-intro";
import FeedbackPrivacyNote from "./feedback-privacy-note";

const services = [
  {
    title: "Building cleaning",
    text: "Professional cleaning for private and commercial customers at the highest level.",
    details: "We clean entrance areas, floors, sanitary facilities and communal spaces according to a plan tailored to your property.",
    image: "/service-building-2026.png",
    alt: "Glanzio-Team bei der professionellen Gebäudereinigung in einer modernen Empfangshalle",
  },
  {
    title: "Stairwell cleaning",
    text: "Clean stairwells that present your property at its best to residents and guests.",
    details: "Steps, landings, railings and entrance areas are cleaned thoroughly at agreed intervals for a consistently well-kept appearance.",
    image: "/service-stairwell-2026.png",
    alt: "Glanzio-Mitarbeiterin reinigt Stufen und Geländer eines hellen Treppenhauses",
  },
  {
    title: "Maintenance cleaning",
    text: "Regular cleaning for permanently clean rooms and a well-maintained atmosphere.",
    details: "Flexible cleaning schedules keep offices, practices and commercial spaces reliably clean without disrupting daily operations.",
    image: "/service-maintenance-2026.png",
    alt: "Regelmäßige Unterhaltsreinigung mit Staubsauger und Oberflächenpflege in einem Büro",
  },
  {
    title: "Glass and window cleaning",
    text: "Streak-free windows for more light and a clear atmosphere in your property.",
    details: "We clean glass surfaces, frames and accessible rebates with suitable equipment for a clear, streak-free result.",
    image: "/service-windows-2026.png",
    alt: "Glanzio-Mitarbeiter reinigt eine große Glasfront mit Abzieher und Teleskopstange",
  },
  {
    title: "Caretaker service",
    text: "Comprehensive care and maintenance for your property, giving you maximum peace of mind.",
    details: "Regular inspections, small maintenance tasks and rapid reporting of defects help preserve the value and safety of your property.",
    image: "/service-caretaker-2026.png",
    alt: "Hausmeister führt mit Werkzeug eine Wartung an einer Eingangstür durch",
  },
  {
    title: "Winter service",
    text: "Reliable clearing and gritting services to keep your property safe in ice and snow.",
    details: "We clear agreed paths and entrances and apply grit when required so that your property remains safely accessible in winter.",
    image: "/service-winter-2026.png",
    alt: "Glanzio-Winterdienst räumt Schnee und streut einen Gebäudeeingang",
  },
];

type Service = (typeof services)[number];

const trustCriteria = [
  {
    icon: "consultation",
    title: "Enquiry and consultation",
    text: "Contact us without obligation. We analyse your needs and advise you comprehensively.",
  },
  {
    icon: "inspection",
    title: "Inspection and quotation",
    text: "After a short inspection, you receive a transparent fixed-price quotation.",
  },
  {
    icon: "cleaning",
    title: "Professional cleaning",
    text: "Our trained team carries out the cleaning on schedule and with the highest precision.",
  },
  {
    icon: "acceptance",
    title: "Quality acceptance",
    text: "We inspect the property together and are only satisfied when you are satisfied.",
  },
] as const;

function JourneyGlyph({ kind }: { kind: (typeof trustCriteria)[number]["icon"] }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === "consultation" ? <><path d="M20 11a7 7 0 0 1-7 7H8l-5 3 1.5-5A7 7 0 1 1 20 11Z" /><path d="M8 9h8M8 13h5" /></> : null}
      {kind === "inspection" ? <><rect x="5" y="4" width="14" height="17" rx="2" /><rect x="9" y="2" width="6" height="4" rx="1" /><path d="m8 12 2 2 5-5M8 18h8" /></> : null}
      {kind === "cleaning" ? <><path d="m14 3 1.8 5.2L21 10l-5.2 1.8L14 17l-1.8-5.2L7 10l5.2-1.8L14 3ZM5 14l1.2 3.8L10 19l-3.8 1.2L5 24l-1.2-3.8L0 19l3.8-1.2L5 14Z" transform="translate(1 -1) scale(.95)" /></> : null}
      {kind === "acceptance" ? <><path d="m12 2 8 3v6c0 5-8 10-8 10S4 16 4 11V5l8-3Z" /><path d="m8 11 3 3 5-6" /></> : null}
    </svg>
  );
}

const companyPhone = "+49 176 83446967";
const companyEmail = "info@glanzio-reinigung.de";
const companyAddress = "Bruckfelder Straße 6, 88662 Überlingen";

type ContactIconName = "email" | "location" | "clock";
type LegalPanel = "impressum" | "privacy";

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20.4 11.6a8.4 8.4 0 0 1-12.5 7.3L3.5 20l1.2-4.2a8.4 8.4 0 1 1 15.7-4.2Z" />
      <path d="M8.1 7.5c.3-.3.7-.2.9.1l1.1 2c.2.3.1.7-.1.9l-.8.8c.7 1.5 1.9 2.7 3.5 3.4l.8-.9c.2-.3.6-.3.9-.2l2.1 1c.4.2.5.6.3 1-.5 1.1-1.6 1.8-2.8 1.7-3.7-.4-6.8-3.2-7.4-6.9-.2-1.1.4-2.2 1.5-2.9Z" />
    </svg>
  );
}

function ContactIcon({ name }: { name: ContactIconName }) {
  return (
    <span className="contactIcon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        {name === "email" ? (
          <>
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="m5 8 7 5 7-5" />
          </>
        ) : null}
        {name === "location" ? (
          <>
            <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />
            <circle cx="12" cy="10" r="2.2" />
          </>
        ) : null}
        {name === "clock" ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.5 2" />
          </>
        ) : null}
      </svg>
    </span>
  );
}

function LegalDialog({
  panel,
  onClose,
}: {
  panel: LegalPanel;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const title = panel === "impressum" ? "Impressum" : "Datenschutzerklärung";

  return (
    <div
      className="legalModalBackdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby={`legal-${panel}-title`}
        aria-modal="true"
        className="legalModal"
        role="dialog"
      >
        <header className="legalModalHeader">
          <div>
            <span>Glanzio Reinigung</span>
            <h2 id={`legal-${panel}-title`}>{title}</h2>
          </div>
          <button
            aria-label="Schließen"
            className="legalModalClose"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="legalModalContent">
          {panel === "impressum" ? (
            <>
              <section>
                <h3>Angaben gemäß § 5 DDG</h3>
                <p>
                  Glanzio Reinigung GbR<br />
                  Waldweg 38<br />
                  88960 Uhldigen-Mühlofen
                </p>
              </section>
              <section>
                <h3>Vertreten durch</h3>
                <p>
                  Abdessalem Akrout<br />
                  Mohanned Goucha
                </p>
              </section>
              <section>
                <h3>Kontakt</h3>
                <p>
                  Telefon: <a href="tel:+4917683446967">+49 176 83446967</a><br />
                  E-Mail: <a href={`mailto:${companyEmail}`}>{companyEmail}</a>
                </p>
              </section>
              <section>
                <h3>Verbraucherstreitbeilegung / Universalschlichtungsstelle</h3>
                <p>
                  Wir nehmen nicht an Streitbeilegungsverfahren vor einer
                  Verbraucherschlichtungsstelle teil und sind dazu auch nicht verpflichtet.
                </p>
              </section>
            </>
          ) : (
            <>
              <section>
                <h3>1. Datenschutz auf einen Blick</h3>
                <h4>Allgemeine Hinweise</h4>
                <p>
                  Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit
                  Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen.
                  Personenbezogene Daten sind alle Daten, mit denen Sie persönlich
                  identifiziert werden können. Ausführliche Informationen zum Thema
                  Datenschutz entnehmen Sie unserer unter diesem Text aufgeführten
                  Datenschutzerklärung.
                </p>
                <h4>Datenerfassung auf dieser Website</h4>
                <h5>Wer ist verantwortlich für die Datenerfassung auf dieser Website?</h5>
                <p>
                  Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber.
                  Dessen Kontaktdaten können Sie dem Abschnitt „Hinweis zur Verantwortlichen
                  Stelle“ in dieser Datenschutzerklärung entnehmen.
                </p>
                <h5>Wie erfassen wir Ihre Daten?</h5>
                <p>
                  Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen.
                  Hierbei kann es sich z. B. um Daten handeln, die Sie in ein Kontaktformular
                  eingeben. Andere Daten werden automatisch oder nach Ihrer Einwilligung beim
                  Besuch der Website durch unsere IT-Systeme erfasst. Das sind vor allem
                  technische Daten (z. B. Internetbrowser, Betriebssystem oder Uhrzeit des
                  Seitenaufrufs). Die Erfassung dieser Daten erfolgt automatisch, sobald Sie
                  diese Website betreten.
                </p>
                <h5>Wofür nutzen wir Ihre Daten?</h5>
                <p>
                  Ein Teil der Daten wird erhoben, um eine fehlerfreie Bereitstellung der
                  Website zu gewährleisten. Andere Daten können zur Analyse Ihres
                  Nutzerverhaltens verwendet werden.
                </p>
                <h5>Welche Rechte haben Sie bezüglich Ihrer Daten?</h5>
                <p>
                  Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft,
                  Empfänger und Zweck Ihrer gespeicherten personenbezogenen Daten zu erhalten.
                  Sie haben außerdem ein Recht, die Berichtigung oder Löschung dieser Daten zu
                  verlangen. Wenn Sie eine Einwilligung zur Datenverarbeitung erteilt haben,
                  können Sie diese Einwilligung jederzeit für die Zukunft widerrufen. Außerdem
                  haben Sie das Recht, unter bestimmten Umständen die Einschränkung der
                  Verarbeitung Ihrer personenbezogenen Daten zu verlangen. Des Weiteren steht
                  Ihnen ein Beschwerderecht bei der zuständigen Aufsichtsbehörde zu.
                </p>
              </section>

              <section>
                <h3>2. Hosting</h3>
                <p>Wir hosten die Inhalte unserer Website bei folgendem Anbieter:</p>
                <p>
                  Die Website wird auf Servern in Deutschland gehostet. Die personenbezogenen
                  Daten, die auf dieser Website erfasst werden, werden auf den Servern des
                  Hosters gespeichert. Hierbei kann es sich v. a. um IP-Adressen,
                  Kontaktanfragen, Meta- und Kommunikationsdaten, Vertragsdaten, Kontaktdaten,
                  Namen, Websitezugriffe und sonstige Daten, die über eine Website generiert
                  werden, handeln.
                </p>
              </section>

              <section>
                <h3>3. Allgemeine Hinweise und Pflichtinformationen</h3>
                <h4>Datenschutz</h4>
                <p>
                  Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr
                  ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend
                  den gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.
                </p>
                <p>
                  Wenn Sie diese Website benutzen, werden verschiedene personenbezogene Daten
                  erhoben. Personenbezogene Daten sind Daten, mit denen Sie persönlich
                  identifiziert werden können. Die vorliegende Datenschutzerklärung erläutert,
                  welche Daten wir erheben und wofür wir sie nutzen. Sie erläutert auch, wie und
                  zu welchem Zweck das geschieht.
                </p>
                <p>
                  Wir weisen darauf hin, dass die Datenübertragung im Internet (z. B. bei der
                  Kommunikation per E-Mail) Sicherheitslücken aufweisen kann. Ein lückenloser
                  Schutz der Daten vor dem Zugriff durch Dritte ist nicht möglich.
                </p>
                <h4>Hinweis zur Verantwortlichen Stelle</h4>
                <p>Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:</p>
                <p>
                  Glanzio Reinigung GbR<br />
                  Waldweg 38<br />
                  88960 Uhldigen-Mühlofen
                </p>
                <p>
                  Telefon: <a href="tel:+4917683446967">+49 176 83446967</a><br />
                  E-Mail: <a href={`mailto:${companyEmail}`}>{companyEmail}</a>
                </p>
                <p>
                  Verantwortliche Stelle ist die natürliche oder juristische Person, die allein
                  oder gemeinsam mit anderen über die Zwecke und Mittel der Verarbeitung von
                  personenbezogenen Daten (z. B. Namen, E-Mail-Adressen o. Ä.) entscheidet.
                </p>
                <h4>Speicherdauer</h4>
                <p>
                  Soweit innerhalb dieser Datenschutzerklärung keine speziellere Speicherdauer
                  genannt wurde, verbleiben Ihre personenbezogenen Daten bei uns, bis der Zweck
                  für die Datenverarbeitung entfällt. Wenn Sie ein berechtigtes Löschersuchen
                  geltend machen oder eine Einwilligung zur Datenverarbeitung widerrufen, werden
                  Ihre Daten gelöscht, sofern wir keine anderen rechtlich zulässigen Gründe für
                  die Speicherung Ihrer personenbezogenen Daten haben.
                </p>
                <h4>Widerruf Ihrer Einwilligung zur Datenverarbeitung</h4>
                <p>
                  Viele Datenverarbeitungsvorgänge sind nur mit Ihrer ausdrücklichen Einwilligung
                  möglich. Sie können eine bereits erteilte Einwilligung jederzeit widerrufen.
                  Die Rechtmäßigkeit der bis zum Widerruf erfolgten Datenverarbeitung bleibt vom
                  Widerruf unberührt.
                </p>
                <h4>Beschwerderecht bei der zuständigen Aufsichtsbehörde</h4>
                <p>
                  Im Falle von Verstößen gegen die DSGVO steht den Betroffenen ein
                  Beschwerderecht bei einer Aufsichtsbehörde, insbesondere in dem Mitgliedstaat
                  ihres gewöhnlichen Aufenthalts, ihres Arbeitsplatzes oder des Orts des
                  mutmaßlichen Verstoßes zu. Das Beschwerderecht besteht unbeschadet anderweitiger
                  verwaltungsrechtlicher oder gerichtlicher Rechtsbehelfe.
                </p>
                <h4>Recht auf Datenübertragbarkeit</h4>
                <p>
                  Sie haben das Recht, Daten, die wir auf Grundlage Ihrer Einwilligung oder in
                  Erfüllung eines Vertrags automatisiert verarbeiten, an sich oder an einen
                  Dritten in einem gängigen, maschinenlesbaren Format aushändigen zu lassen.
                  Sofern Sie die direkte Übertragung der Daten an einen anderen Verantwortlichen
                  verlangen, erfolgt dies nur, soweit es technisch machbar ist.
                </p>
                <h4>Auskunft, Löschung und Berichtigung</h4>
                <p>
                  Sie haben im Rahmen der geltenden gesetzlichen Bestimmungen jederzeit das
                  Recht auf unentgeltliche Auskunft über Ihre gespeicherten personenbezogenen
                  Daten, deren Herkunft und Empfänger und den Zweck der Datenverarbeitung und
                  ggf. ein Recht auf Berichtigung oder Löschung dieser Daten. Hierzu sowie zu
                  weiteren Fragen zum Thema personenbezogene Daten können Sie sich jederzeit an
                  uns wenden.
                </p>
                <h4>Recht auf Einschränkung der Verarbeitung</h4>
                <p>
                  Sie haben das Recht, die Einschränkung der Verarbeitung Ihrer
                  personenbezogenen Daten zu verlangen. Hierzu können Sie sich jederzeit an uns
                  wenden.
                </p>
              </section>

              <section>
                <h3>4. Datenerfassung auf dieser Website</h3>
                <h4>Kontaktformular</h4>
                <p>
                  Wenn Sie uns per Kontaktformular Anfragen zukommen lassen, werden Ihre Angaben
                  aus dem Anfrageformular inklusive der von Ihnen dort angegebenen Kontaktdaten
                  zwecks Bearbeitung der Anfrage und für den Fall von Anschlussfragen bei uns
                  gespeichert. Diese Daten geben wir nicht ohne Ihre Einwilligung weiter.
                </p>
                <p>
                  Die Verarbeitung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b
                  DSGVO, sofern Ihre Anfrage mit der Erfüllung eines Vertrags zusammenhängt oder
                  zur Durchführung vorvertraglicher Maßnahmen erforderlich ist. In allen übrigen
                  Fällen beruht die Verarbeitung auf unserem berechtigten Interesse an der
                  effektiven Bearbeitung der an uns gerichteten Anfragen (Art. 6 Abs. 1 lit. f
                  DSGVO) oder auf Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) sofern diese
                  abgefragt wurde.
                </p>
                <p>
                  Die von Ihnen im Kontaktformular eingegebenen Daten verbleiben bei uns, bis Sie
                  uns zur Löschung auffordern, Ihre Einwilligung zur Speicherung widerrufen oder
                  der Zweck für die Datenspeicherung entfällt (z. B. nach abgeschlossener
                  Bearbeitung Ihrer Anfrage). Zwingende gesetzliche Bestimmungen – insbesondere
                  Aufbewahrungsfristen – bleiben unberührt.
                </p>
                <h4>Anfrage per E-Mail, Telefon oder Telefax</h4>
                <p>
                  Wenn Sie uns per E-Mail, Telefon oder Telefax kontaktieren, wird Ihre Anfrage
                  inklusive aller daraus hervorgehenden personenbezogenen Daten (Name, Anfrage)
                  zum Zwecke der Bearbeitung Ihres Anliegens bei uns gespeichert und verarbeitet.
                  Diese Daten geben wir nicht ohne Ihre Einwilligung weiter.
                </p>
                <p>
                  Die Verarbeitung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b
                  DSGVO, sofern Ihre Anfrage mit der Erfüllung eines Vertrags zusammenhängt oder
                  zur Durchführung vorvertraglicher Maßnahmen erforderlich ist. In allen übrigen
                  Fällen beruht die Verarbeitung auf unserem berechtigten Interesse an der
                  effektiven Bearbeitung der an uns gerichteten Anfragen (Art. 6 Abs. 1 lit. f
                  DSGVO) oder auf Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) sofern diese
                  abgefragt wurde.
                </p>
              </section>
            </>
          )}
          {panel === "privacy" ? <FeedbackPrivacyNote /> : null}
        </div>
        <footer className="legalModalFooter">
          <button onClick={onClose} type="button">Schließen</button>
        </footer>
      </section>
    </div>
  );
}

function ServiceDialog({
  service,
  onClose,
  translate,
}: {
  service: Service;
  onClose: () => void;
  translate: (text: string) => string;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="serviceDialogBackdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="service-dialog-title"
        aria-modal="true"
        className="serviceDialog"
        role="dialog"
      >
        <button
          aria-label="Schließen"
          className="serviceDialogClose"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
        <img alt="" aria-hidden="true" src={service.image} />
        <div className="serviceDialogContent">
          <span>{translate("Service details")}</span>
          <h2 id="service-dialog-title">{translate(service.title)}</h2>
          <p>{translate(service.details)}</p>
          <a href="#contact" onClick={onClose}>
            {translate("Contact us about this service")}
          </a>
        </div>
      </section>
    </div>
  );
}
const whatsappNumber =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() || companyPhone;
const whatsappHref = whatsappNumber
  ? `https://wa.me/${whatsappNumber.replace(/\D/g, "")}`
  : "#contact";

type PublicSection = "top" | "about" | "services" | "why-us" | "contact";
type FloatingWhatsAppGeometry = {
  left: number;
  top: number;
  width: number;
  height: number;
  docked: boolean;
  hidden: boolean;
};

const germanCopy: Record<string, string> = {
  Home: "Startseite",
  "About us": "Über uns",
  Services: "Leistungen",
  Process: "Ablauf",
  "Contact us": "Kontakt",
  "Main navigation": "Hauptnavigation",
  "WhatsApp contact": "WhatsApp-Kontakt",
  "Chat with our team": "Mit unserem Team chatten",
  Dashboard: "Dashboard",
  "Sign out": "Abmelden",
  "Sign in": "Anmelden",
  "Checking access...": "Zugriff wird geprüft...",
  "Excellence in cleaning": "Exzellenz in der Reinigung",
  "Cleanliness.": "Sauberkeit.",
  "Trust. Quality.": "Vertrauen. Qualität.",
  "Your reliable partner for professional building cleaning in the Lake Constance region. Luxury standards for every property.":
    "Ihr zuverlässiger Partner für professionelle Gebäudereinigung in der Region Bodensee. Luxus-Standard für jedes Objekt.",
  "Request a free quote": "Kostenloses Angebot",
  "Request a quote": "Angebot anfordern",
  "Our promise": "Unser Versprechen",
  "Precision you can feel.": "Präzision, die man fühlt.",
  "Individual concepts": "Individuelle Konzepte",
  "Tailored to your property": "Auf Ihr Objekt abgestimmt",
  "Premium products": "Premium-Produkte",
  "Environmentally friendly and modern": "Umweltschonend und modern",
  "Trained specialists": "Geschultes Fachpersonal",
  "Reliable, discreet and secure": "Zuverlässig, diskret und sicher",
  "Our services": "Unsere Leistungen",
  "Comprehensive cleaning services at the highest level—for homes and businesses.":
    "Umfassende Reinigungsleistungen auf höchstem Niveau – für Wohnen und Gewerbe.",
  "Cleaning services": "Reinigungsleistungen",
  "Learn more": "Mehr erfahren",
  "Building cleaning": "Gebäudereinigung",
  "Professional cleaning for private and commercial customers at the highest level.":
    "Professionelle Reinigung für Privat- und Geschäftskunden auf höchstem Niveau.",
  "We clean entrance areas, floors, sanitary facilities and communal spaces according to a plan tailored to your property.":
    "Wir reinigen Eingangsbereiche, Böden, Sanitär- und Gemeinschaftsräume nach einem individuell auf Ihr Objekt abgestimmten Plan.",
  "Stairwell cleaning": "Treppenhausreinigung",
  "Clean stairwells that present your property at its best to residents and guests.":
    "Saubere Treppenhäuser als Visitenkarte Ihrer Immobilie für Bewohner und Gäste.",
  "Steps, landings, railings and entrance areas are cleaned thoroughly at agreed intervals for a consistently well-kept appearance.":
    "Stufen, Podeste, Geländer und Eingangsbereiche werden in vereinbarten Intervallen gründlich gereinigt – für ein dauerhaft gepflegtes Erscheinungsbild.",
  "Maintenance cleaning": "Unterhaltsreinigung",
  "Regular cleaning for permanently clean rooms and a well-maintained atmosphere.":
    "Regelmäßige Reinigung für dauerhaft saubere Räume und ein gepflegtes Ambiente.",
  "Flexible cleaning schedules keep offices, practices and commercial spaces reliably clean without disrupting daily operations.":
    "Flexible Reinigungspläne halten Büros, Praxen und Gewerbeflächen zuverlässig sauber, ohne den täglichen Betrieb zu stören.",
  "Glass and window cleaning": "Glas- und Fensterreinigung",
  "Streak-free windows for more light and a clear atmosphere in your property.":
    "Streifenfreie Fenster für mehr Licht und eine klare Atmosphäre in Ihrem Objekt.",
  "We clean glass surfaces, frames and accessible rebates with suitable equipment for a clear, streak-free result.":
    "Wir reinigen Glasflächen, Rahmen und zugängliche Falze mit passender Ausrüstung für ein klares, streifenfreies Ergebnis.",
  "Caretaker service": "Hausmeisterservice",
  "Comprehensive care and maintenance for your property, giving you maximum peace of mind.":
    "Umfassende Betreuung und Instandhaltung Ihrer Immobilie für maximale Sorgenfreiheit.",
  "Regular inspections, small maintenance tasks and rapid reporting of defects help preserve the value and safety of your property.":
    "Regelmäßige Kontrollgänge, kleinere Instandhaltungsarbeiten und eine schnelle Mängelmeldung erhalten Wert und Sicherheit Ihrer Immobilie.",
  "Winter service": "Winterdienst",
  "Reliable clearing and gritting services to keep your property safe in ice and snow.":
    "Sicherheit bei Eis und Schnee durch zuverlässige Räum- und Streudienste.",
  "We clear agreed paths and entrances and apply grit when required so that your property remains safely accessible in winter.":
    "Wir räumen vereinbarte Wege und Eingänge und streuen bei Bedarf, damit Ihr Objekt auch im Winter sicher zugänglich bleibt.",
  "Show details": "Details anzeigen",
  "Hide details": "Details schließen",
  "Service details": "Leistungsdetails",
  "Contact us about this service": "Kontakt aufnehmen",
  "About Glanzio": "Über Glanzio",
  "We redefine": "Wir definieren",
  "cleanliness.": "Sauberkeit neu.",
  "Glanzio cleaning services": "Glanzio Reinigungsservice",
  "Glanzio stands for excellent cleaning services at Lake Constance.":
    "Glanzio steht für exzellente Reinigungsdienstleistungen am Bodensee.",
  "Our aim is not only to clean, but to preserve value and create feel-good atmospheres.":
    "Unser Anspruch ist es, nicht nur zu reinigen, sondern Werte zu erhalten und Wohlfühlatmosphären zu schaffen.",
  "Clean. Reliable. Professional.": "Sauber. Zuverlässig. Professionell.",
  "The Glanzio process": "Der Glanzio-Prozess",
  "The Glanzio process guarantees consistent quality through digital checklists, modern cleaning technologies and trained specialists.":
    "Unser Glanzio-Prozess garantiert konstante Qualität durch digitale Checklisten, moderne Reinigungstechnologien und geschultes Fachpersonal.",
  "Digital checklists. Modern technology. Trained specialists.":
    "Digitale Checklisten. Moderne Technik. Geschultes Fachpersonal.",
  "Needs analysis": "Bedarfsanalyse",
  "Individual coordination tailored to your specific requirements and premises.":
    "Individuelle Abstimmung auf Ihre spezifischen Anforderungen und Räumlichkeiten.",
  "Professional execution": "Fachgerechte Ausführung",
  "Environmentally friendly premium products and state-of-the-art equipment.":
    "Einsatz von umweltschonenden Premium-Produkten und modernstem Equipment.",
  "Quality assurance": "Qualitätssicherung",
  "Digital checklists and regular inspections for consistent excellence.":
    "Digitale Checklisten und regelmäßige Kontrollen für konstante Exzellenz.",
  "Your path to a brighter result": "Ihr Weg zum Glanz",
  "Transparent, efficient and reliable. Four simple steps to your clean property.":
    "Transparent, effizient und zuverlässig. In vier einfachen Schritten zu Ihrem sauberen Objekt.",
  "Enquiry and consultation": "Anfrage & Beratung",
  "Contact us without obligation. We analyse your needs and advise you comprehensively.":
    "Sie kontaktieren uns unverbindlich. Wir analysieren Ihren Bedarf und beraten Sie umfassend.",
  "Inspection and quotation": "Besichtigung & Angebot",
  "After a short inspection, you receive a transparent fixed-price quotation.":
    "Nach einer kurzen Besichtigung erhalten Sie ein transparentes Festpreisangebot.",
  "Professional cleaning": "Professionelle Reinigung",
  "Our trained team carries out the cleaning on schedule and with the highest precision.":
    "Unser geschultes Team führt die Reinigung termingerecht und mit höchster Präzision aus.",
  "Quality acceptance": "Qualitätsabnahme",
  "We inspect the property together and are only satisfied when you are satisfied.":
    "Gemeinsame Abnahme des Objekts. Wir sind erst zufrieden, wenn Sie es sind.",
  "Why Glanzio": "Warum Glanzio",
  "Individual cleaning concepts": "Individuelle Reinigungskonzepte",
  "Every service is tailored to your requirements, premises and priorities.":
    "Jede Leistung wird individuell auf Ihre Anforderungen, Räumlichkeiten und Prioritäten abgestimmt.",
  "Environmentally friendly premium products": "Umweltschonende Premium-Produkte",
  "Modern equipment and carefully selected products protect people and property.":
    "Modernes Equipment und sorgfältig ausgewählte Produkte schützen Menschen und Immobilie.",
  "Trained and reliable specialists": "Geschultes & zuverlässiges Fachpersonal",
  "Our trained team works on schedule and with the highest precision.":
    "Unser geschultes Team arbeitet termingerecht und mit höchster Präzision.",
  "Maximum discretion and security": "Höchste Diskretion und Sicherheit",
  "Your property is handled responsibly, discreetly and securely.":
    "Ihre Immobilie wird verantwortungsvoll, diskret und sicher behandelt.",
  "Our quality standards": "Unsere Qualitätsstandards",
  Contact: "Kontakt",
  "Ready for a new shine?": "Bereit für den neuen Glanz?",
  "Request your no-obligation premium quotation now and experience the difference.":
    "Fordern Sie jetzt Ihr unverbindliches Premium-Angebot an und erleben Sie den Unterschied.",
  "Telephone and WhatsApp": "Telefon & WhatsApp",
  Email: "E-Mail",
  Address: "Adresse",
  "Service hours": "Servicezeiten",
  "Monday–Friday: 08:00–18:00": "Mo–Fr: 08:00–18:00",
  "Full name": "Vollständiger Name",
  "Email address": "E-Mail-Adresse",
  "Service interest": "Gewünschte Leistung",
  "Select a service": "Leistung auswählen",
  "Property location": "Objektstandort",
  "City / postal code": "Stadt / PLZ",
  "Your message (optional)": "Ihre Nachricht (optional)",
  "By submitting this form, you agree to our privacy policy.":
    "Mit dem Absenden dieses Formulars erklären Sie sich mit unserer Datenschutzerklärung einverstanden.",
  "Your request is prepared. Please contact us directly by email, telephone or WhatsApp.":
    "Ihre Anfrage ist vorbereitet. Kontaktieren Sie uns bitte direkt per E-Mail, Telefon oder WhatsApp.",
  "Team portal": "Teamportal",
  "Cleanliness, trust and quality—this is our promise.":
    "Sauberkeit, Vertrauen und Qualität – das ist unser Versprechen.",
  "Glanzio stands for excellent cleaning services in the Lake Constance region.":
    "Glanzio steht für exzellente Reinigungsdienstleistungen in der Region Bodensee.",
  "Glanzio quality standards": "Glanzio Qualitätsstandards",
  "Glanzio standard": "Glanzio Standard",
  "Reliable staff deliver every cleaning service on schedule and with precision.":
    "Zuverlässiges Fachpersonal führt jede Reinigung termingerecht und präzise aus.",
  "Discretion and security": "Diskretion und Sicherheit",
  "Your property is treated with the highest discretion, care and responsibility.":
    "Ihre Immobilie wird mit höchster Diskretion, Sorgfalt und Verantwortung behandelt.",
  "Legal notice": "Impressum",
  Privacy: "Datenschutz",
};

export default function Home() {
  const [session, setSession] = useState<AuthenticationResult | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [enquiryReady, setEnquiryReady] = useState(false);
  const [enquirySending, setEnquirySending] = useState(false);
  const [enquiryError, setEnquiryError] = useState("");
  const enquiryAttempt = useRef<{ content: string; key: string } | null>(null);
  const enquiryInFlight = useRef(false);
  const [legalPanel, setLegalPanel] = useState<LegalPanel | null>(null);
  const closeLegalPanel = useCallback(() => setLegalPanel(null), []);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const panel = new URLSearchParams(window.location.search).get("legal");
      if (panel === "privacy" || panel === "impressum") setLegalPanel(panel);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const closeServiceDialog = useCallback(() => setSelectedService(null), []);
  const serviceCarouselRef = useRef<HTMLDivElement>(null);
  const [valuesVisible, setValuesVisible] = useState(false);
  const valuesSectionRef = useRef<HTMLElement>(null);
  const [contactVisible, setContactVisible] = useState(false);
  const contactSectionRef = useRef<HTMLElement>(null);
  const siteFooterRef = useRef<HTMLElement>(null);
  const whatsappDockRef = useRef<HTMLSpanElement>(null);
  const [whatsappGeometry, setWhatsappGeometry] =
    useState<FloatingWhatsAppGeometry | null>(null);
  const [activeSection, setActiveSection] = useState<PublicSection>("top");
  const t = (text: string) => germanCopy[text] ?? text;

  useEffect(() => {
    const carousel = serviceCarouselRef.current;
    if (!carousel) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const baseVelocity = -0.018;
    let animationFrame = 0;
    let resumeTimer = 0;
    let lastTimestamp = 0;
    let paused = selectedService !== null;
    let focusInside = false;
    let keyboardInteraction = false;
    let dragging = false;
    let temporarilyPaused = false;
    let velocity = baseVelocity;
    let dragPointerId: number | null = null;
    let dragStartX = 0;
    let dragStartScrollLeft = 0;
    let dragLastX = 0;
    let dragLastTimestamp = 0;

    const getCycleWidth = () => {
      const firstOriginal = carousel.querySelector<HTMLElement>(
        ".serviceCard.hasMedia:not([data-service-copy])",
      );
      const firstCopy = carousel.querySelector<HTMLElement>(
        '.serviceCard.hasMedia[data-service-copy="true"]',
      );
      return firstOriginal && firstCopy
        ? firstOriginal.offsetLeft - firstCopy.offsetLeft
        : carousel.scrollWidth / 2;
    };

    const normalizePosition = (position: number) => {
      const cycleWidth = getCycleWidth();
      if (cycleWidth <= 0) return position;
      let normalized = position;
      while (normalized < 0) normalized += cycleWidth;
      while (normalized >= cycleWidth) normalized -= cycleWidth;
      return normalized;
    };

    if (!carousel.dataset.loopInitialized) {
      carousel.scrollLeft = getCycleWidth();
      carousel.dataset.loopInitialized = "true";
    }

    let automaticScrollLeft = carousel.scrollLeft;

    if (paused) carousel.classList.add("isInteracting");

    const syncInteractionState = () => {
      paused = Boolean(
        selectedService ||
          focusInside ||
          dragging ||
          temporarilyPaused,
      );
      carousel.classList.toggle("isInteracting", paused);
      if (!paused) {
        automaticScrollLeft = carousel.scrollLeft;
      }
    };

    const resumeShortly = () => {
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        temporarilyPaused = false;
        syncInteractionState();
      }, 1400);
    };

    const handleWheel = (event: WheelEvent) => {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        !target.closest(".serviceCard.hasMedia")
      ) {
        return;
      }

      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (delta === 0) return;

      keyboardInteraction = false;
      focusInside = false;
      syncInteractionState();
      event.preventDefault();
      automaticScrollLeft = normalizePosition(carousel.scrollLeft + delta);
      carousel.scrollLeft = automaticScrollLeft;
      velocity = Math.max(-2.4, Math.min(2.4, delta / 18));
    };

    const activateDetailsFromTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      const detailsButton = target.closest<HTMLButtonElement>(
        ".serviceDetailsButton",
      );
      if (!detailsButton) return false;

      const serviceIndex = Number(detailsButton.dataset.serviceIndex);
      const service = services[serviceIndex];
      if (service) setSelectedService(service);
      return true;
    };

    const handleMouseDown = (event: MouseEvent) => {
      activateDetailsFromTarget(event.target);
    };

    const handlePointerDown = (event: PointerEvent) => {
      keyboardInteraction = false;
      focusInside = false;
      syncInteractionState();
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest(".serviceCard.hasMedia")) return;

      if (activateDetailsFromTarget(event.target)) return;

      if (event.target.closest("a")) {
        return;
      }

      if (event.pointerType !== "mouse" || event.button !== 0) return;

      dragging = true;
      dragPointerId = event.pointerId;
      dragStartX = event.clientX;
      dragStartScrollLeft = carousel.scrollLeft;
      dragLastX = event.clientX;
      dragLastTimestamp = event.timeStamp;
      try {
        carousel.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic pointer events may not establish browser-level capture.
      }
      carousel.classList.add("isDragging");
      syncInteractionState();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== dragPointerId) return;
      const distance = dragStartX - event.clientX;
      const elapsed = Math.max(event.timeStamp - dragLastTimestamp, 1);
      if (Math.abs(distance) > 2) event.preventDefault();
      automaticScrollLeft = normalizePosition(dragStartScrollLeft + distance);
      carousel.scrollLeft = automaticScrollLeft;
      velocity = Math.max(
        -2.4,
        Math.min(2.4, (dragLastX - event.clientX) / elapsed),
      );
      dragLastX = event.clientX;
      dragLastTimestamp = event.timeStamp;
    };

    const finishPointerDrag = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== dragPointerId) return;
      if (carousel.hasPointerCapture(event.pointerId)) {
        carousel.releasePointerCapture(event.pointerId);
      }
      dragging = false;
      dragPointerId = null;
      carousel.classList.remove("isDragging");
      syncInteractionState();
    };

    const handleFocusIn = () => {
      // Mouse/drag focus must not leave autoplay paused indefinitely. Only
      // keyboard-visible focus pauses moving targets for keyboard navigation.
      focusInside = keyboardInteraction;
      syncInteractionState();
    };

    const handleFocusOut = () => {
      window.setTimeout(() => {
        focusInside = keyboardInteraction && carousel.contains(document.activeElement);
        syncInteractionState();
      }, 0);
    };

    const handleKeyboardInteraction = (event: KeyboardEvent) => {
      if (event.key !== "Tab" && !(event.target instanceof Node && carousel.contains(event.target))) return;
      keyboardInteraction = true;
      focusInside = carousel.contains(document.activeElement);
      syncInteractionState();
    };

    const handleTouchStart = () => {
      keyboardInteraction = false;
      focusInside = false;
      temporarilyPaused = true;
      syncInteractionState();
      window.clearTimeout(resumeTimer);
    };

    const handleTouchEnd = () => {
      automaticScrollLeft = normalizePosition(carousel.scrollLeft);
      carousel.scrollLeft = automaticScrollLeft;
      velocity = baseVelocity;
      resumeShortly();
    };

    const moveSlowly = (timestamp: number) => {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const elapsed = Math.min(timestamp - lastTimestamp, 50);
      lastTimestamp = timestamp;

      if (!paused && !reducedMotion) {
        const decay = 1 - Math.exp(-elapsed / 180);
        velocity += (baseVelocity - velocity) * decay;
        automaticScrollLeft = normalizePosition(
          automaticScrollLeft + velocity * elapsed,
        );
        carousel.scrollLeft = automaticScrollLeft;
      }

      animationFrame = window.requestAnimationFrame(moveSlowly);
    };

    carousel.addEventListener("wheel", handleWheel, { passive: false });
    carousel.addEventListener("mousedown", handleMouseDown);
    carousel.addEventListener("pointerdown", handlePointerDown);
    carousel.addEventListener("pointermove", handlePointerMove);
    carousel.addEventListener("pointerup", finishPointerDrag);
    carousel.addEventListener("pointercancel", finishPointerDrag);
    carousel.addEventListener("focusin", handleFocusIn);
    carousel.addEventListener("focusout", handleFocusOut);
    carousel.addEventListener("touchstart", handleTouchStart, { passive: true });
    carousel.addEventListener("touchend", handleTouchEnd, { passive: true });
    carousel.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    window.addEventListener("keydown", handleKeyboardInteraction, true);
    carousel.dataset.motionReady = "true";
    animationFrame = window.requestAnimationFrame(moveSlowly);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      delete carousel.dataset.motionReady;
      window.clearTimeout(resumeTimer);
      carousel.classList.remove("isInteracting");
      carousel.classList.remove("isDragging");
      carousel.removeEventListener("wheel", handleWheel);
      carousel.removeEventListener("mousedown", handleMouseDown);
      carousel.removeEventListener("pointerdown", handlePointerDown);
      carousel.removeEventListener("pointermove", handlePointerMove);
      carousel.removeEventListener("pointerup", finishPointerDrag);
      carousel.removeEventListener("pointercancel", finishPointerDrag);
      carousel.removeEventListener("focusin", handleFocusIn);
      carousel.removeEventListener("focusout", handleFocusOut);
      carousel.removeEventListener("touchstart", handleTouchStart);
      carousel.removeEventListener("touchend", handleTouchEnd);
      carousel.removeEventListener("touchcancel", handleTouchEnd);
      window.removeEventListener("keydown", handleKeyboardInteraction, true);
    };
  }, [selectedService]);

  useEffect(() => {
    const section = contactSectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setContactVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let animationFrame = 0;
    let targetMotionFrame = 0;
    let targetMotionDeadline = 0;

    const updateWhatsAppPosition = () => {
      const target = whatsappDockRef.current;
      const contactSection = contactSectionRef.current;
      const siteFooter = siteFooterRef.current;
      const compact = window.innerWidth <= 640;
      const floatingWidth = compact ? 58 : 214;
      const floatingHeight = compact ? 58 : 68;
      const edge = compact ? 14 : 24;
      let nextGeometry: FloatingWhatsAppGeometry = {
        left: window.innerWidth - floatingWidth - edge,
        top: window.innerHeight - floatingHeight - edge,
        width: floatingWidth,
        height: floatingHeight,
        docked: false,
        hidden: false,
      };

      if (target && contactSection) {
        const targetBounds = target.getBoundingClientRect();
        const contactBounds = contactSection.getBoundingClientRect();
        const footerBounds = siteFooter?.getBoundingClientRect();
        const footerIsVisible = Boolean(
          footerBounds &&
          footerBounds.top < window.innerHeight &&
          footerBounds.bottom > 0,
        );
        const targetIsVisible =
          targetBounds.top < window.innerHeight - edge &&
          targetBounds.bottom > 96 &&
          contactBounds.top < window.innerHeight &&
          contactBounds.bottom > 96;

        if (targetIsVisible) {
          nextGeometry = {
            left: targetBounds.left,
            top: targetBounds.top,
            width: targetBounds.width,
            height: targetBounds.height,
            docked: true,
            hidden: false,
          };
        } else if (
          footerIsVisible ||
          (contactBounds.top < window.innerHeight && contactBounds.bottom > 0)
        ) {
          nextGeometry.hidden = true;
        }
      }

      nextGeometry = {
        ...nextGeometry,
        left: Math.round(nextGeometry.left),
        top: Math.round(nextGeometry.top),
        width: Math.round(nextGeometry.width),
        height: Math.round(nextGeometry.height),
      };

      setWhatsappGeometry((current) =>
        current &&
        current.left === nextGeometry.left &&
        current.top === nextGeometry.top &&
        current.width === nextGeometry.width &&
        current.height === nextGeometry.height &&
        current.docked === nextGeometry.docked &&
        current.hidden === nextGeometry.hidden
          ? current
          : nextGeometry,
      );
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateWhatsAppPosition);
    };

    const trackTargetMotion = () => {
      updateWhatsAppPosition();
      if (performance.now() < targetMotionDeadline) {
        targetMotionFrame = window.requestAnimationFrame(trackTargetMotion);
      }
    };

    const startTrackingTargetMotion = () => {
      targetMotionDeadline = performance.now() + 800;
      window.cancelAnimationFrame(targetMotionFrame);
      targetMotionFrame = window.requestAnimationFrame(trackTargetMotion);
    };

    const finishTrackingTargetMotion = () => {
      targetMotionDeadline = 0;
      window.cancelAnimationFrame(targetMotionFrame);
      scheduleUpdate();
    };

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    if (whatsappDockRef.current) resizeObserver.observe(whatsappDockRef.current);
    if (contactSectionRef.current) resizeObserver.observe(contactSectionRef.current);
    if (siteFooterRef.current) resizeObserver.observe(siteFooterRef.current);
    const dockCard = whatsappDockRef.current?.parentElement;
    dockCard?.addEventListener("transitionrun", startTrackingTargetMotion);
    dockCard?.addEventListener("transitionend", finishTrackingTargetMotion);
    updateWhatsAppPosition();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(targetMotionFrame);
      resizeObserver.disconnect();
      dockCard?.removeEventListener("transitionrun", startTrackingTargetMotion);
      dockCard?.removeEventListener("transitionend", finishTrackingTargetMotion);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  useEffect(() => {
    const sectionIds: PublicSection[] = [
      "top",
      "services",
      "about",
      "why-us",
      "contact",
    ];
    let animationFrame = 0;

    const updateActiveSection = () => {
      const readingLine = window.scrollY + Math.min(window.innerHeight * 0.34, 280);
      let currentSection: PublicSection = "top";

      for (const sectionId of sectionIds) {
        const section = document.getElementById(sectionId);
        if (section && section.offsetTop <= readingLine) {
          currentSection = sectionId;
        }
      }

      setActiveSection(currentSection);
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    restoreSession()
      .then((result) => {
        if (isActive) setSession(result);
      })
      .catch(() => undefined)
      .finally(() => {
        if (isActive) setSessionReady(true);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const section = valuesSectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setValuesVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.28 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  async function handleSignOut() {
    await signOut();
    setSession(null);
  }

  async function handleEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enquiryInFlight.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const data = {
      fullName: String(fields.get("fullName") ?? "").trim(),
      email: String(fields.get("email") ?? "").trim().toLowerCase(),
      service: String(fields.get("service") ?? "").trim(),
      location: String(fields.get("location") ?? "").trim(),
      message: String(fields.get("message") ?? "").trim(),
      companyWebsite: String(fields.get("companyWebsite") ?? ""),
    };
    const content = JSON.stringify(data);
    if (enquiryAttempt.current?.content !== content) {
      enquiryAttempt.current = { content, key: crypto.randomUUID() };
    }
    enquiryInFlight.current = true;
    setEnquirySending(true); setEnquiryError(""); setEnquiryReady(false);
    try {
      const response = await fetch(`${API_BASE_URL}/quotes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, submissionKey: enquiryAttempt.current.key }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const result = await response.json() as { status?: string };
      if (result.status !== "sent") throw new Error("Der Versand konnte nicht bestätigt werden.");
      setEnquiryReady(true);
    } catch (error) {
      setEnquiryError(error instanceof Error ? error.message : "Der Versand ist momentan nicht möglich. Bitte kontaktieren Sie uns direkt.");
    } finally {
      enquiryInFlight.current = false; setEnquirySending(false);
    }
  }

  return (
    <main className="landingPage">
      <HomeBrandIntro />
      <header className="siteHeader">
        <a
          className="publicBrand"
          href="#top"
          aria-label={`Glanzio Reinigung · ${t("Home")}`}
        >
          <img
            alt="Glanzio Reinigung"
            className="publicBrandLogo"
            height={269}
            src="/glanzio-reinigung-logo.png"
            width={781}
          />
        </a>

        <nav className="publicNav" aria-label={t("Main navigation")}>
          <a
            aria-current={activeSection === "about" ? "location" : undefined}
            className={activeSection === "about" ? "isActive" : undefined}
            href="#about"
            onClick={() => setActiveSection("about")}
          >
            {t("About us")}
          </a>
          <a
            aria-current={activeSection === "services" ? "location" : undefined}
            className={activeSection === "services" ? "isActive" : undefined}
            href="#services"
            onClick={() => setActiveSection("services")}
          >
            {t("Services")}
          </a>
          <a
            aria-current={activeSection === "why-us" ? "location" : undefined}
            className={activeSection === "why-us" ? "isActive" : undefined}
            href="#why-us"
            onClick={() => setActiveSection("why-us")}
          >
            {t("Process")}
          </a>
          <a
            aria-current={activeSection === "contact" ? "location" : undefined}
            className={activeSection === "contact" ? "isActive" : undefined}
            href="#contact"
            onClick={() => setActiveSection("contact")}
          >
            {t("Contact us")}
          </a>
        </nav>

        <div className="headerActions">
          {sessionReady && session ? (
            <>
              <a className="dashboardLink" href="/dashboard">
                {t("Dashboard")}
              </a>
              <button
                className="headerSignOut"
                type="button"
                onClick={handleSignOut}
              >
                {t("Sign out")}
              </button>
            </>
          ) : (
            <a className="headerSignIn" href="/login">
              {sessionReady ? t("Sign in") : t("Checking access...")}
            </a>
          )}
        </div>
      </header>

      <a
        aria-label={`Contact Glanzio Reinigung on WhatsApp at ${whatsappNumber}`}
        className={`floatingWhatsApp${whatsappGeometry?.docked ? " isDocked" : ""}${whatsappGeometry?.hidden ? " isSuppressed" : ""}`}
        aria-hidden={whatsappGeometry?.hidden || undefined}
        tabIndex={whatsappGeometry?.hidden ? -1 : undefined}
        href={whatsappHref}
        rel="noreferrer"
        style={
              whatsappGeometry
            ? {
                bottom: "auto",
                height: whatsappGeometry.height,
                left: whatsappGeometry.left,
                right: "auto",
                top: whatsappGeometry.top,
                width: whatsappGeometry.width,
              }
            : undefined
        }
        target="_blank"
      >
        <span className="floatingWhatsAppIcon" aria-hidden="true">
          <WhatsAppGlyph />
        </span>
        <span className="floatingWhatsAppCopy">
          <small>{t("WhatsApp contact")}</small>
          <strong>WhatsApp</strong>
        </span>
        <span className="floatingWhatsAppArrow" aria-hidden="true">↗</span>
      </a>

      <section className="landingHero cinematicHero" id="top">
        <div className="heroSlide heroSlideOne" aria-hidden="true" />
        <div className="heroSlide heroSlideTwo" aria-hidden="true" />
        <div className="heroSlide heroSlideThree" aria-hidden="true" />
        <div className="heroShade" aria-hidden="true" />

        <div className="heroContent">
          <p className="landingEyebrow">
            {t("Excellence in cleaning")}
          </p>
          <h1>
            {t("Cleanliness.")}
            <span>{t("Trust. Quality.")}</span>
          </h1>
          <p className="heroLead">
            {t("Your reliable partner for professional building cleaning in the Lake Constance region. Luxury standards for every property.")}
          </p>
          <div className="heroActions">
            <a className="landingPrimary" href="#contact">
              {t("Request a free quote")}
            </a>
            <a className="landingSecondary" href="#services">
              {t("Our services")}
            </a>
          </div>
        </div>

      </section>

      <section className="landingSection servicesSection" id="services">
        <div className="sectionIntro">
          <p className="landingEyebrow">{t("Our services")}</p>
          <h2>{t("Services")}</h2>
          <p>
            {t("Comprehensive cleaning services at the highest level—for homes and businesses.")}
          </p>
        </div>

        <div
          className="serviceCarousel"
          aria-label={t("Cleaning services")}
        >
          <div
            aria-label="Leistungen horizontal durchsuchen"
            className="serviceCarouselViewport"
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              event.currentTarget.scrollBy({
                behavior: "smooth",
                left:
                  event.key === "ArrowRight"
                    ? event.currentTarget.clientWidth * 0.72
                    : event.currentTarget.clientWidth * -0.72,
              });
            }}
            ref={serviceCarouselRef}
            tabIndex={0}
          >
            <div className="serviceTrack"
            >
            {[...services, ...services].map((service, index) => {
              const isDuplicate = index < services.length;
              return (
                <article
                  aria-hidden={isDuplicate || undefined}
                  className="serviceCard hasMedia"
                  data-service-copy={isDuplicate ? "true" : undefined}
                  key={`${service.title}-${isDuplicate ? "copy" : "original"}`}
                >
                  <div className="serviceCardMedia">
                    <img
                      alt={service.alt}
                      height={1024}
                      loading="lazy"
                      src={service.image}
                      width={1536}
                    />
                  </div>
                  <div className="serviceCardBody">
                    <h3>{t(service.title)}</h3>
                    <p>{t(service.text)}</p>
                    <button
                      className="serviceDetailsButton"
                      data-service-index={index % services.length}
                      onClick={() => setSelectedService(service)}
                      tabIndex={isDuplicate ? -1 : 0}
                      type="button"
                    >
                      {t("Show details")}
                    </button>
                  </div>
                </article>
              );
            })}
            </div>
          </div>
        </div>
      </section>

      <CompanyBenefits items={[
        {
          title: t("Individual cleaning concepts"),
          description: "Ihr Objekt ist einzigartig. Wir stimmen Reinigungsplan, Verfahren und Rhythmus auf Ihre Räume ab.",
          image: "/quality-planning-v2.webp",
          alt: "Hände tragen einen individuellen Reinigungsplan in ein Notizbuch ein",
          width: 1200, height: 800,
        },
        {
          title: t("Environmentally friendly premium products"),
          description: "Sorgfältig ausgewählte Produkte und materialgerechte Pflege – für gründliche Sauberkeit mit Augenmaß.",
          image: "/quality-equipment-v2.webp",
          alt: "Reinigungsspezialist mit professionellem Reinigungswagen und Bodenreinigungsmaschine in einer Lobby",
          width: 900, height: 1350,
        },
        {
          title: t("Trained and reliable specialists"),
          description: "Ein eingespieltes Team, klare Abläufe und ein Blick fürs Detail. Zuverlässig bei jedem Einsatz.",
          image: "/quality-teamwork-v2.webp",
          alt: "Drei Reinigungskräfte in Glanzio-Arbeitskleidung stimmen ihre Arbeit am professionellen Reinigungswagen ab",
          width: 1200, height: 800,
        },
        {
          title: t("Maximum discretion and security"),
          description: "Wir gehen achtsam mit Ihren Räumen um. Vertraulichkeit und ein verantwortungsvoller Umgang sind selbstverständlich.",
          image: "/quality-privacy-v2.webp",
          alt: "Symbolische Darstellung der Diskretion: Glanzio-Team mit Augenbinden bei der Reinigung in einem Wohnraum",
          width: 1200, height: 800,
        },
      ]} />

      <StandardsNetwork language="de" />

      <section className="operationsSection luminousPromise" id="operations">
        <div className="operationsCopy">
          <p className="landingEyebrow">{t("Our promise")}</p>
          <h2>{t("Precision you can feel.")}</h2>
          <p>
            {t("The Glanzio process guarantees consistent quality through digital checklists, modern cleaning technologies and trained specialists.")}
          </p>
        </div>

        <div className="companyValuesVisual" aria-label={t("The Glanzio process")}>
          <figure>
            <img
              alt="Glanzio team preparing for a professional cleaning service"
              height={1024}
              loading="lazy"
              src="/hero-team-v2.png"
              width={1792}
            />
          </figure>
          <div className="companyValueCards">
            <article>
              <span className="companyValueIcon"><JourneyGlyph kind="consultation" /></span>
              <div>
                <strong>{t("Needs analysis")}</strong>
                <p>{t("Individual coordination tailored to your specific requirements and premises.")}</p>
              </div>
            </article>
            <article>
              <span className="companyValueIcon"><JourneyGlyph kind="cleaning" /></span>
              <div>
                <strong>{t("Professional execution")}</strong>
                <p>{t("Environmentally friendly premium products and state-of-the-art equipment.")}</p>
              </div>
            </article>
            <article>
              <span className="companyValueIcon"><JourneyGlyph kind="acceptance" /></span>
              <div>
                <strong>{t("Quality assurance")}</strong>
                <p>{t("Digital checklists and regular inspections for consistent excellence.")}</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section
        className={`trustCriteriaSection processJourneySection${valuesVisible ? " isVisible" : ""}`}
        id="why-us"
        ref={valuesSectionRef}
      >
        <div className="valuesBackdrop" aria-hidden="true" />
        <div className="valuesGlow" aria-hidden="true" />
        <div className="trustCriteriaIntro">
          <p className="landingEyebrow">{t("Process")}</p>
          <h2>{t("Your path to a brighter result")}</h2>
          <p>
            {t("Transparent, efficient and reliable. Four simple steps to your clean property.")}
          </p>
        </div>
        <ol className="processJourney" aria-label={t("The Glanzio process")}>
          {trustCriteria.map((criterion, index) => (
            <li
              key={criterion.icon}
              style={{ "--step-delay": `${index * 230}ms` } as CSSProperties}
            >
              <span className="processJourneyIcon"><JourneyGlyph kind={criterion.icon} /></span>
              <div>
              <h3>{t(criterion.title)}</h3>
              <p>{t(criterion.text)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <GlassStory
        copy={{
          sectionLabel: "Glas- und Fensterreinigung im Vorher-Nachher-Vergleich",
          eyebrow: "Glas- und Fensterreinigung",
          cleaning: "Mehr Klarheit. Mehr Licht.",
          storyDescription: "Frischer Reinigungsschaum und Tropfen liegen auf einer großen Fensterscheibe über einer Fensterbank mit Zimmerpflanzen. Beim Scrollen zieht ein realistischer Fensterabzieher eine breite diagonale Bahn in der Mitte frei; die Ränder bleiben eingeschäumt. Dahinter liegt eine regennasse deutsche Straße mit Autos und Fußgängern. Eine illustrative Darstellung unserer Glasreinigung, kein Kundenauftrag.",
        }}
      />

      <section
        className={`contactSection${contactVisible ? " isVisible" : ""}`}
        id="contact"
        ref={contactSectionRef}
      >
        <div className="contactCopy">
          <p className="landingEyebrow">{t("Contact")}</p>
          <h2>{t("Ready for a new shine?")}</h2>
          <p>
            {t("Request your no-obligation premium quotation now and experience the difference.")}
          </p>
          <div className="contactNotes">
            <a href={whatsappHref} rel="noreferrer" target="_blank">
              <span
                className={`contactIcon whatsappDockTarget${whatsappGeometry?.docked ? " isReceiving" : ""}`}
                ref={whatsappDockRef}
                aria-hidden="true"
              >
                <WhatsAppGlyph />
              </span>
              <span className="contactNoteCopy">
                <strong>{t("Telephone and WhatsApp")}</strong>
                <span>{companyPhone}</span>
              </span>
            </a>
            <a href={`mailto:${companyEmail}`}>
              <ContactIcon name="email" />
              <span className="contactNoteCopy">
                <strong>{t("Email")}</strong>
                <span>{companyEmail}</span>
              </span>
            </a>
            <div>
              <ContactIcon name="location" />
              <span className="contactNoteCopy">
                <strong>{t("Address")}</strong>
                <span>{companyAddress}</span>
              </span>
            </div>
            <div>
              <ContactIcon name="clock" />
              <span className="contactNoteCopy">
                <strong>{t("Service hours")}</strong>
                <span>{t("Monday–Friday: 08:00–18:00")}</span>
              </span>
            </div>
          </div>
        </div>

        <form className="enquiryForm" onSubmit={handleEnquiry} onChange={() => setEnquiryReady(false)}>
          <div className="formPair">
            <label>
              {t("Full name")}
              <input name="fullName" minLength={2} maxLength={120} autoComplete="name" required />
            </label>
            <label>
              {t("Email address")}
              <input name="email" type="email" maxLength={320} autoComplete="email" required />
            </label>
          </div>
          <label>
            {t("Service interest")}
            <select name="service" defaultValue="">
              <option value="" disabled>
                {t("Select a service")}
              </option>
              {services.map((service) => (
                <option key={service.title}>{t(service.title)}</option>
              ))}
            </select>
          </label>
          <label>
            {t("Property location")}
            <input name="location" placeholder={t("City / postal code")} minLength={2} maxLength={200} required />
          </label>
          <label>
            {t("Your message (optional)")}
            <textarea name="message" rows={4} maxLength={4000} />
          </label>
          <label className="enquiryHoneypot" aria-hidden="true">Website<input name="companyWebsite" tabIndex={-1} autoComplete="off" /></label>
          <p className="formConsent">
            <button onClick={() => setLegalPanel("privacy")} type="button">
              {t("By submitting this form, you agree to our privacy policy.")}
            </button>
          </p>
          <button type="submit" disabled={enquirySending || enquiryReady}>{enquirySending ? "Wird gesendet…" : t("Request a quote")}</button>
          {enquiryError ? <p className="enquiryNotice" role="alert">{enquiryError}</p> : null}
          {enquiryReady ? (
            <p className="enquiryNotice" role="status">
              Ihre Anfrage wurde an unseren E-Mail-Server übergeben. Vielen Dank!
            </p>
          ) : null}
        </form>
      </section>

      <CustomerFeedback onPrivacy={() => setLegalPanel("privacy")} />

      <footer className="siteFooter" ref={siteFooterRef}>
        <a className="publicBrand footerBrand" href="#top" aria-label={`Glanzio Reinigung · ${t("Home")}`}>
          <img
            alt="Glanzio Reinigung"
            className="publicBrandLogo footerBrandLogo"
            height={269}
            loading="lazy"
            src="/glanzio-reinigung-logo.png"
            width={781}
          />
        </a>
        <p>© 2026 Glanzio Reinigung. All rights reserved.</p>
        <nav aria-label="Footer">
          <a href="#services">{t("Services")}</a>
          <a href="/login">{t("Team portal")}</a>
          <a href="#contact">{t("Contact")}</a>
          <a href="#feedback">Feedback</a>
          <button onClick={() => setLegalPanel("impressum")} type="button">
            {t("Legal notice")}
          </button>
          <button onClick={() => setLegalPanel("privacy")} type="button">
            {t("Privacy")}
          </button>
          <button onClick={openCookiePreferences} type="button">Cookie-Einstellungen</button>
        </nav>
      </footer>
      {legalPanel ? (
        <LegalDialog panel={legalPanel} onClose={closeLegalPanel} />
      ) : null}
      {selectedService ? (
        <ServiceDialog
          onClose={closeServiceDialog}
          service={selectedService}
          translate={t}
        />
      ) : null}
    </main>
  );
}
