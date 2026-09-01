"use client";

/* eslint-disable @next/next/no-img-element -- Vinext's local image optimizer requires an unavailable ASSETS binding. */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  restoreSession,
  signOut,
  type AuthenticationResult,
} from "./lib/auth-client";
import StandardsNetwork from "./standards-network";

const services = [
  {
    number: "01",
    title: "House cleaning",
    text: "Thoughtful recurring care for comfortable, beautifully maintained homes.",
    image: "/service-home-v2.png",
    alt: "Professional cleaner vacuuming a bright family living room",
  },
  {
    number: "02",
    title: "Company cleaning",
    text: "Reliable after-hours care for headquarters, boardrooms, and shared business spaces.",
    image: "/service-company-v2.png",
    alt: "Cleaner maintaining a modern company boardroom after hours",
  },
  {
    number: "03",
    title: "Office cleaning",
    text: "Healthy desks, meeting areas, kitchens, and touchpoints prepared for every workday.",
    image: "/service-office-v2.png",
    alt: "Professional cleaner sanitizing a computer workstation in a modern office",
  },
  {
    number: "04",
    title: "Window cleaning",
    text: "Streak-free internal glass and accessible façades that bring natural light back in.",
    image: "/service-windows-v2.png",
    alt: "Trained cleaner washing tall interior windows with a squeegee",
  },
  {
    number: "05",
    title: "Government offices",
    text: "Secure, accountable cleaning for civic buildings, reception areas, and public counters.",
    image: "/service-government-v2.png",
    alt: "Cleaning team maintaining a bright civic office reception",
  },
  {
    number: "06",
    title: "Schools & campuses",
    text: "Careful routines for classrooms, staff areas, corridors, and learning environments.",
    image: "/service-education-v2.png",
    alt: "Professional cleaner wiping tables in a sunlit classroom",
  },
  {
    number: "07",
    title: "Healthcare spaces",
    text: "Detail-led hygiene for clinics, waiting rooms, and high-touch shared surfaces.",
    image: "/service-healthcare-v2.png",
    alt: "Cleaner disinfecting furniture in a modern clinic waiting room",
  },
  {
    number: "08",
    title: "Deep restoration",
    text: "Intensive floor and upholstery care for seasonal resets, handovers, and recovery work.",
    image: "/service-deep-v2.png",
    alt: "Professional operating a floor cleaning machine in a commercial lounge",
  },
];

const commitments = [
  "Clear scope before every service",
  "The right team assigned to each site",
  "Schedule conflicts detected early",
  "Visible follow-up for managers and employees",
];

const trustCriteria = [
  {
    number: "01",
    title: "Trusted people",
    text: "Every assignment is connected to a known employee profile and a responsible manager.",
  },
  {
    number: "02",
    title: "Visible standards",
    text: "Clear scopes, repeatable routines, and practical follow-up keep expectations aligned.",
  },
  {
    number: "03",
    title: "Reliable planning",
    text: "Availability and schedule conflicts are checked before the work reaches the team.",
  },
  {
    number: "04",
    title: "Responsible care",
    text: "Time, products, equipment, and working-hour insights are treated with attention.",
  },
];

const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() ?? "";
const whatsappHref = whatsappNumber
  ? `https://wa.me/${whatsappNumber.replace(/\D/g, "")}`
  : "#contact";

type PublicLanguage = "de" | "en";

const germanCopy: Record<string, string> = {
  "Smart facility care": "Intelligente Gebäudepflege",
  Home: "Startseite",
  Services: "Leistungen",
  Standards: "Standards",
  "Contact us": "Kontakt",
  "Main navigation": "Hauptnavigation",
  "WhatsApp contact": "WhatsApp-Kontakt",
  "Chat with our team": "Mit unserem Team chatten",
  Dashboard: "Dashboard",
  "Sign out": "Abmelden",
  "Sign in": "Anmelden",
  "Checking access...": "Zugriff wird geprüft...",
  "Commercial cleaning · intelligently coordinated": "Gewerbereinigung · intelligent koordiniert",
  "Cleaner spaces.": "Sauberere Räume.",
  "Brighter days.": "Hellere Tage.",
  "Professional facility care with dependable people, transparent planning, and standards you can see in every detail.": "Professionelle Gebäudepflege mit verlässlichen Mitarbeitenden, transparenter Planung und Standards, die in jedem Detail sichtbar sind.",
  "Request a free review": "Kostenlose Beratung anfragen",
  "Discover our services": "Leistungen entdecken",
  "Our promise": "Unser Versprechen",
  "One clear standard across every site.": "Ein klarer Standard an jedem Standort.",
  "Trusted teams": "Verlässliche Teams",
  "Known people, clear responsibility": "Bekannte Ansprechpersonen, klare Verantwortung",
  "Tailored plans": "Passende Einsatzpläne",
  "Care shaped around your space": "Pflege, die zu Ihren Räumen passt",
  "Visible standards": "Sichtbare Standards",
  "Accountable work and follow-up": "Nachvollziehbare Arbeit und Kontrolle",
  "Services built around your space": "Leistungen für Ihre Räume",
  "Care that fits the rhythm of your business.": "Pflege, die zum Rhythmus Ihres Betriebs passt.",
  "Every site starts with a clear scope, practical timing, and the right people for the work—not a one-size-fits-all checklist.": "Jeder Standort beginnt mit einem klaren Leistungsumfang, realistischen Zeiten und dem passenden Team – statt mit einer starren Standardliste.",
  "Cleaning services": "Reinigungsleistungen",
  "Learn more": "Mehr erfahren",
  "House cleaning": "Haushaltsreinigung",
  "Thoughtful recurring care for comfortable, beautifully maintained homes.": "Sorgfältige, regelmäßige Pflege für saubere und angenehm erhaltene Wohnräume.",
  "Company cleaning": "Unternehmensreinigung",
  "Reliable after-hours care for headquarters, boardrooms, and shared business spaces.": "Zuverlässige Reinigung nach Geschäftsschluss für Zentralen, Besprechungsräume und gemeinsam genutzte Flächen.",
  "Office cleaning": "Büroreinigung",
  "Healthy desks, meeting areas, kitchens, and touchpoints prepared for every workday.": "Gepflegte Arbeitsplätze, Besprechungsräume, Küchen und Kontaktflächen für jeden Arbeitstag.",
  "Window cleaning": "Fensterreinigung",
  "Streak-free internal glass and accessible façades that bring natural light back in.": "Streifenfreie Glasflächen und erreichbare Fassaden für mehr natürliches Licht.",
  "Government offices": "Öffentliche Einrichtungen",
  "Secure, accountable cleaning for civic buildings, reception areas, and public counters.": "Sichere und nachvollziehbare Reinigung für Verwaltungsgebäude, Empfangsbereiche und öffentliche Schalter.",
  "Schools & campuses": "Schulen und Bildungseinrichtungen",
  "Careful routines for classrooms, staff areas, corridors, and learning environments.": "Sorgfältige Abläufe für Klassenräume, Personalbereiche, Flure und Lernumgebungen.",
  "Healthcare spaces": "Gesundheitseinrichtungen",
  "Detail-led hygiene for clinics, waiting rooms, and high-touch shared surfaces.": "Detailorientierte Hygiene für Praxen, Wartebereiche und häufig berührte Flächen.",
  "Deep restoration": "Grund- und Spezialreinigung",
  "Intensive floor and upholstery care for seasonal resets, handovers, and recovery work.": "Intensive Boden- und Polsterpflege für Grundreinigungen, Übergaben und Wiederherstellungen.",
  "Clarity Clean promise": "Das Clarity-Clean-Versprechen",
  "Care you can see.": "Pflege, die man sieht.",
  "Standards you can trust.": "Standards, denen Sie vertrauen können.",
  "Let's plan your service": "Gemeinsam planen",
  "One connected standard": "Ein durchgängiger Standard",
  "A truly clean space is not only what you see when the work is finished. It is the confidence that every person, plan, and detail worked together.": "Wirkliche Sauberkeit zeigt sich nicht nur im Ergebnis. Sie entsteht durch das Vertrauen, dass Menschen, Planung und jedes Detail zuverlässig zusammenspielen.",
  "A truly clean space is not only what you see when the work is finished.": "Wirkliche Sauberkeit ist mehr als das sichtbare Ergebnis nach getaner Arbeit.",
  "It is the confidence that every person, plan, and detail worked together.": "Es ist das Vertrauen, dass Menschen, Planung und jedes Detail zuverlässig zusammenspielen.",
  "Thoughtful care, clearly coordinated from arrival to final check.": "Sorgfältige Pflege – klar koordiniert vom Eintreffen bis zur Abschlusskontrolle.",
  "Smarter operations, human standards": "Intelligente Abläufe, menschliche Standards",
  "Technology keeps the promise. People deliver it.": "Technologie schafft Verlässlichkeit. Menschen liefern das Ergebnis.",
  "Our operations portal connects assignments, sites, availability, notifications, and monthly planning in one secure place. It is designed to support future AI-assisted recommendations while every decision remains accountable to a real manager.": "Unser Betriebsportal verbindet Einsätze, Standorte, Verfügbarkeiten, Benachrichtigungen und Monatsplanung an einem sicheren Ort. Künftige KI-gestützte Empfehlungen bleiben dabei immer unter der Verantwortung einer realen Führungskraft.",
  "Open the secure team portal": "Sicheres Teamportal öffnen",
  "Operations overview": "Betriebsübersicht",
  "A calm day starts with a clear plan.": "Ein ruhiger Arbeitstag beginnt mit einem klaren Plan.",
  Schedule: "Planung",
  "Conflict aware": "Konflikte im Blick",
  Employees: "Mitarbeitende",
  "Role protected": "Rollengeschützt",
  Students: "Studierende",
  "80h insight": "80-Stunden-Übersicht",
  "Opening service": "Frühdienst",
  "Weekly client visit": "Wöchentlicher Kundentermin",
  "Evening team": "Abendteam",
  "How Clarity Clean works": "So arbeitet Clarity Clean",
  "Reliable service begins long before arrival.": "Verlässlicher Service beginnt lange vor der Ankunft.",
  "Our values turn every cleaning visit into a dependable routine: time is respected, responsibility is visible, and quality is followed through.": "Unsere Werte machen jeden Reinigungseinsatz zu einem verlässlichen Ablauf: Zeiten werden eingehalten, Verantwortung bleibt sichtbar und Qualität wird konsequent nachverfolgt.",
  "Plan your service with us": "Service gemeinsam planen",
  "Time respected": "Zeit wird respektiert",
  "Clear arrival windows and realistic schedules keep your day uninterrupted.": "Klare Ankunftszeiten und realistische Pläne sorgen für einen ungestörten Tagesablauf.",
  "Named responsibility": "Klare Verantwortung",
  "Every visit has an assigned team and a responsible point of contact.": "Jeder Einsatz hat ein festes Team und eine verantwortliche Ansprechperson.",
  "Quality followed through": "Qualität bis zum Abschluss",
  "Clear standards and practical follow-up keep every result accountable.": "Klare Standards und praktische Nachkontrollen machen jedes Ergebnis nachvollziehbar.",
  "Care in motion": "Pflege in Bewegung",
  "Prepared teams. Calm arrivals. Consistent results.": "Vorbereitete Teams. Ruhige Abläufe. Beständige Ergebnisse.",
  "Why clients can rely on us": "Warum Kunden auf uns zählen",
  "Bright spaces begin with clear values.": "Helle Räume beginnen mit klaren Werten.",
  "A modern cleaning service should feel dependable before, during, and after every visit—not only when the room looks finished.": "Ein moderner Reinigungsservice muss vor, während und nach jedem Einsatz verlässlich sein – nicht nur dann, wenn der Raum fertig aussieht.",
  "Our service values": "Unsere Servicewerte",
  "Trusted people": "Vertrauenswürdige Menschen",
  "Every assignment is connected to a known employee profile and a responsible manager.": "Jeder Einsatz ist einem bekannten Mitarbeiterprofil und einer verantwortlichen Führungskraft zugeordnet.",
  "Clear scopes, repeatable routines, and practical follow-up keep expectations aligned.": "Klare Leistungen, wiederholbare Abläufe und praktische Kontrollen sorgen für gemeinsame Erwartungen.",
  "Reliable planning": "Verlässliche Planung",
  "Availability and schedule conflicts are checked before the work reaches the team.": "Verfügbarkeit und Terminkonflikte werden geprüft, bevor der Einsatz das Team erreicht.",
  "Responsible care": "Verantwortungsvolle Pflege",
  "Time, products, equipment, and working-hour insights are treated with attention.": "Zeit, Produkte, Ausstattung und Arbeitsstunden werden sorgfältig berücksichtigt.",
  Clean: "Sauber",
  Before: "Vorher",
  "Before & after": "Vorher & nachher",
  "Drag to reveal the difference.": "Ziehen Sie, um den Unterschied zu sehen.",
  "Move the handle left to see the worn surface and right to reveal the professionally restored finish. The control also works with your keyboard.": "Bewegen Sie den Regler nach links zur beanspruchten Oberfläche und nach rechts zum professionell gereinigten Ergebnis. Die Steuerung funktioniert auch mit der Tastatur.",
  "Deep, detail-led cleaning": "Gründliche, detailorientierte Reinigung",
  "Fabric-conscious products": "Materialschonende Produkte",
  "Visible, accountable results": "Sichtbare, nachvollziehbare Ergebnisse",
  "Request a restoration review": "Beratung zur Aufbereitung anfragen",
  "A standard you can see": "Ein Standard, den man sieht",
  "Professional care is more than a clean result.": "Professionelle Pflege ist mehr als ein sauberes Ergebnis.",
  Understand: "Verstehen",
  "We review the space, priorities, access, and expected result.": "Wir prüfen Räume, Prioritäten, Zugang und das gewünschte Ergebnis.",
  Plan: "Planen",
  "We define the routine, timing, equipment, and responsible team.": "Wir definieren Ablauf, Zeitfenster, Ausstattung und verantwortliches Team.",
  Deliver: "Ausführen",
  "Employees receive clear assignments through the secure portal.": "Mitarbeitende erhalten klare Einsätze über das sichere Portal.",
  Improve: "Verbessern",
  "Managers use real scheduling insight to refine future service.": "Führungskräfte nutzen reale Planungsdaten, um künftige Leistungen zu verbessern.",
  "Our operating commitments": "Unsere betrieblichen Zusagen",
  "Clear scope before every service": "Klarer Leistungsumfang vor jedem Einsatz",
  "The right team assigned to each site": "Das passende Team für jeden Standort",
  "Schedule conflicts detected early": "Terminkonflikte werden früh erkannt",
  "Visible follow-up for managers and employees": "Nachvollziehbare Kontrolle für Führungskräfte und Mitarbeitende",
  "Start with a clearer service plan": "Starten Sie mit einem klaren Serviceplan",
  "Tell us what your space needs.": "Sagen Sie uns, was Ihre Räume brauchen.",
  "Share the type of site, preferred frequency, and your priorities. We will shape a service review around the information you provide.": "Teilen Sie uns Standortart, gewünschte Häufigkeit und Prioritäten mit. Daraus erstellen wir eine passende Serviceberatung.",
  "Commercial enquiries": "Gewerbliche Anfragen",
  "Recurring and one-time service": "Regelmäßige und einmalige Leistungen",
  "Company contact details added before launch": "Unternehmenskontakt wird vor Veröffentlichung ergänzt",
  Company: "Unternehmen",
  "Work email": "Geschäftliche E-Mail",
  "Service interest": "Gewünschte Leistung",
  "Select a service": "Leistung auswählen",
  "What should we know?": "Was sollten wir wissen?",
  "Prepare my enquiry": "Anfrage vorbereiten",
  "The enquiry interface is ready. Email delivery will be connected when the company contact address is confirmed.": "Die Anfrage ist vorbereitet. Der E-Mail-Versand wird verbunden, sobald die Unternehmensadresse bestätigt ist.",
  "Commercial cleaning with clearer operations.": "Gewerbereinigung mit klareren Abläufen.",
  "Team portal": "Teamportal",
  Contact: "Kontakt",
  "Client reviews": "Kundenstimmen",
  "What clients value in a dependable cleaning partner.": "Was Kunden an einem verlässlichen Reinigungspartner schätzen.",
  "Review layout preview": "Vorschau der Kundenstimmen",
  "Replace these sample texts with verified client feedback before publication.": "Ersetzen Sie diese Beispieltexte vor der Veröffentlichung durch bestätigte Kundenbewertungen.",
  "Office management · Berlin": "Büroleitung · Berlin",
  "Property coordination · Potsdam": "Objektkoordination · Potsdam",
  "Practice team · Berlin": "Praxisteam · Berlin",
  "Education facility · Berlin": "Bildungseinrichtung · Berlin",
  "Public reception · Brandenburg": "Öffentlicher Empfang · Brandenburg",
  "The team arrives reliably, works carefully, and leaves our office ready for the next day.": "Das Team kommt zuverlässig, arbeitet sorgfältig und hinterlässt unser Büro bereit für den nächsten Tag.",
  "Clear communication makes recurring service easy to coordinate across our locations.": "Klare Kommunikation erleichtert die Koordination regelmäßiger Leistungen an unseren Standorten.",
  "We value the respectful team, consistent routines, and attention to frequently used areas.": "Wir schätzen das respektvolle Team, gleichbleibende Abläufe und die Aufmerksamkeit für stark genutzte Bereiche.",
  "Schedules and responsibilities are transparent, so our staff always knows what to expect.": "Termine und Verantwortlichkeiten sind transparent, sodass unser Personal immer weiß, was zu erwarten ist.",
  "A dependable service with visible standards and straightforward follow-up after each visit.": "Ein verlässlicher Service mit sichtbaren Standards und unkomplizierter Nachbereitung nach jedem Einsatz.",
};

const clientReviews = [
  { initials: "BM", role: "Office management · Berlin", quote: "The team arrives reliably, works carefully, and leaves our office ready for the next day." },
  { initials: "PK", role: "Property coordination · Potsdam", quote: "Clear communication makes recurring service easy to coordinate across our locations." },
  { initials: "PT", role: "Practice team · Berlin", quote: "We value the respectful team, consistent routines, and attention to frequently used areas." },
  { initials: "BE", role: "Education facility · Berlin", quote: "Schedules and responsibilities are transparent, so our staff always knows what to expect." },
  { initials: "ÖE", role: "Public reception · Brandenburg", quote: "A dependable service with visible standards and straightforward follow-up after each visit." },
];

export default function Home() {
  const [language, setLanguage] = useState<PublicLanguage>("de");
  const [session, setSession] = useState<AuthenticationResult | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [enquiryReady, setEnquiryReady] = useState(false);
  const [comparisonPosition, setComparisonPosition] = useState(50);
  const [valuesVisible, setValuesVisible] = useState(false);
  const valuesSectionRef = useRef<HTMLElement>(null);
  const t = (text: string) => (language === "de" ? (germanCopy[text] ?? text) : text);

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem("clarity-public-language");
    if (savedLanguage === "en" || savedLanguage === "de") {
      const restoreLanguage = window.setTimeout(
        () => setLanguage(savedLanguage),
        0,
      );
      return () => window.clearTimeout(restoreLanguage);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function chooseLanguage(nextLanguage: PublicLanguage) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("clarity-public-language", nextLanguage);
  }

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

  function handleEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnquiryReady(true);
  }

  return (
    <main className="landingPage">
      <header className="siteHeader">
        <a className="publicBrand" href="#top" aria-label={`Clarity Clean · ${t("Home")}`}>
          <span className="publicBrandMark" aria-hidden="true">
            CC
          </span>
          <span>
            <strong>Clarity Clean</strong>
            <small>{t("Smart facility care")}</small>
          </span>
        </a>

        <nav className="publicNav" aria-label={t("Main navigation")}>
          <a href="#top">{t("Home")}</a>
          <a href="#services">{t("Services")}</a>
          <a href="#standards">{t("Standards")}</a>
          <a href="#contact">{t("Contact us")}</a>
        </nav>

        <div className="headerActions">
          <div className="languageSwitch" aria-label="Sprache / Language">
            <button className={language === "de" ? "isActive" : ""} type="button" onClick={() => chooseLanguage("de")} aria-pressed={language === "de"}>DE</button>
            <button className={language === "en" ? "isActive" : ""} type="button" onClick={() => chooseLanguage("en")} aria-pressed={language === "en"}>EN</button>
          </div>
          <a
            aria-label={
              whatsappNumber
                ? `Contact Clarity Clean on WhatsApp at ${whatsappNumber}`
                : `${t("WhatsApp contact")} · Clarity Clean`
            }
            className="whatsappContact"
            href={whatsappHref}
            rel={whatsappNumber ? "noreferrer" : undefined}
            target={whatsappNumber ? "_blank" : undefined}
          >
            <span aria-hidden="true">WA</span>
            <small>
              {t("WhatsApp contact")}
              <strong>{whatsappNumber || t("Chat with our team")}</strong>
            </small>
          </a>
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

      <section className="landingHero cinematicHero" id="top">
        <div className="heroSlide heroSlideOne" aria-hidden="true" />
        <div className="heroSlide heroSlideTwo" aria-hidden="true" />
        <div className="heroSlide heroSlideThree" aria-hidden="true" />
        <div className="heroShade" aria-hidden="true" />

        <div className="heroContent">
          <p className="landingEyebrow">
            {t("Commercial cleaning · intelligently coordinated")}
          </p>
          <h1>
            {t("Cleaner spaces.")}
            <span>{t("Brighter days.")}</span>
          </h1>
          <p className="heroLead">
            {t("Professional facility care with dependable people, transparent planning, and standards you can see in every detail.")}
          </p>
          <div className="heroActions">
            <a className="landingPrimary" href="#contact">
              {t("Request a free review")}
            </a>
            <a className="landingSecondary" href="#services">
              {t("Discover our services")}
            </a>
          </div>
        </div>

        <div className="heroCornerNote" aria-label="Clarity Clean approach">
          <span>{t("Our promise")}</span>
          <strong>{t("One clear standard across every site.")}</strong>
        </div>

        <div className="heroTrustRail" aria-label="Service strengths">
          <div>
            <span>01</span>
            <strong>{t("Trusted teams")}</strong>
            <small>{t("Known people, clear responsibility")}</small>
          </div>
          <div>
            <span>02</span>
            <strong>{t("Tailored plans")}</strong>
            <small>{t("Care shaped around your space")}</small>
          </div>
          <div>
            <span>03</span>
            <strong>{t("Visible standards")}</strong>
            <small>{t("Accountable work and follow-up")}</small>
          </div>
        </div>
      </section>

      <section className="landingSection servicesSection" id="services">
        <div className="sectionIntro">
          <p className="landingEyebrow">{t("Services built around your space")}</p>
          <h2>{t("Care that fits the rhythm of your business.")}</h2>
          <p>
            {t("Every site starts with a clear scope, practical timing, and the right people for the work—not a one-size-fits-all checklist.")}
          </p>
        </div>

        <div className="serviceCarousel" aria-label={t("Cleaning services")}>
          <div className="serviceTrack">
            {[...services, ...services].map((service, index) => {
              const isDuplicate = index >= services.length;

              return (
                <article
                  aria-hidden={isDuplicate || undefined}
                  className="serviceCard hasMedia"
                  key={`${service.number}-${isDuplicate ? "copy" : "original"}`}
                >
                  <div className="serviceCardMedia">
                    <img
                      alt={isDuplicate ? "" : service.alt}
                      height={1024}
                      loading="lazy"
                      src={service.image}
                      width={1536}
                    />
                    <span>{service.number}</span>
                  </div>
                  <div className="serviceCardBody">
                    <h3>{t(service.title)}</h3>
                    <p>{t(service.text)}</p>
                    <a href="#contact" tabIndex={isDuplicate ? -1 : undefined}>
                      {t("Learn more")} <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="storyDivider" aria-label={t("Clarity Clean promise")}>
        <div className="storyDividerImage" aria-hidden="true" />
        <div className="storyDividerShade" aria-hidden="true" />
        <div className="storyDividerCopy">
          <p>{t("Clarity Clean promise")}</p>
          <h2>
            {t("Care you can see.")}
            <br />
            {t("Standards you can trust.")}
          </h2>
          <a href="#contact">{t("Let's plan your service")}</a>
        </div>
      </section>

      <section
        className="storyBridge"
        aria-label={t("One connected standard")}
      >
        <p>{t("One connected standard")}</p>
        <blockquote>
          <span>
            {t("A truly clean space is not only what you see when the work is finished.")}
          </span>
          <span>
            {t("It is the confidence that every person, plan, and detail worked together.")}
          </span>
        </blockquote>
        <span>
          {t("Thoughtful care, clearly coordinated from arrival to final check.")}
        </span>
      </section>

      <StandardsNetwork language={language} />

      <section className="operationsSection" id="operations">
        <div className="operationsCopy">
          <p className="landingEyebrow">{t("How Clarity Clean works")}</p>
          <h2>{t("Reliable service begins long before arrival.")}</h2>
          <p>
            {t("Our values turn every cleaning visit into a dependable routine: time is respected, responsibility is visible, and quality is followed through.")}
          </p>
          <a href="#contact">{t("Plan your service with us")}</a>
        </div>

        <div className="companyValuesVisual" aria-label={t("How Clarity Clean works")}>
          <figure>
            <img
              alt="Clarity Clean team preparing for a professional cleaning service"
              height={1024}
              loading="lazy"
              src="/hero-team-v2.png"
              width={1792}
            />
            <figcaption>
              <span>{t("Care in motion")}</span>
              <strong>{t("Prepared teams. Calm arrivals. Consistent results.")}</strong>
            </figcaption>
          </figure>
          <div className="companyValueCards">
            <article>
              <span aria-hidden="true">01</span>
              <div>
                <strong>{t("Time respected")}</strong>
                <p>{t("Clear arrival windows and realistic schedules keep your day uninterrupted.")}</p>
              </div>
            </article>
            <article>
              <span aria-hidden="true">02</span>
              <div>
                <strong>{t("Named responsibility")}</strong>
                <p>{t("Every visit has an assigned team and a responsible point of contact.")}</p>
              </div>
            </article>
            <article>
              <span aria-hidden="true">03</span>
              <div>
                <strong>{t("Quality followed through")}</strong>
                <p>{t("Clear standards and practical follow-up keep every result accountable.")}</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section
        className={`trustCriteriaSection${valuesVisible ? " isVisible" : ""}`}
        id="why-us"
        ref={valuesSectionRef}
      >
        <div className="valuesBackdrop" aria-hidden="true" />
        <div className="valuesGlow" aria-hidden="true" />
        <div className="trustCriteriaIntro">
          <p className="landingEyebrow">{t("Why clients can rely on us")}</p>
          <h2>{t("Bright spaces begin with clear values.")}</h2>
          <p>
            {t("A modern cleaning service should feel dependable before, during, and after every visit—not only when the room looks finished.")}
          </p>
        </div>
        <div className="trustCriteriaGrid" aria-label={t("Our service values")}>
          {trustCriteria.map((criterion, index) => (
            <article
              key={criterion.number}
              style={{ "--value-delay": `${index * 110}ms` } as CSSProperties}
            >
              <span>{criterion.number}</span>
              <h3>{t(criterion.title)}</h3>
              <p>{t(criterion.text)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="beforeAfterSection" id="before-after">
        <div className="beforeAfterVisual">
          <div
            className="comparisonFrame"
            style={
              {
                "--comparison-position": `${comparisonPosition}%`,
              } as CSSProperties
            }
          >
            <img
              alt="A golden-yellow sofa before professional upholstery cleaning"
              className="comparisonDirty"
              height={1024}
              loading="lazy"
              src="/sofa-dirty-v3.png"
              width={1792}
            />
            <div className="comparisonClean" aria-hidden="true">
              <img
                alt=""
                height={1024}
                loading="lazy"
                src="/sofa-clean-v3.png"
                width={1792}
              />
            </div>
            <span className="comparisonLabel comparisonLabelClean">{t("Clean")}</span>
            <span className="comparisonLabel comparisonLabelDirty">{t("Before")}</span>
            <span className="comparisonLine" aria-hidden="true">
              <i />
            </span>
            <input
              aria-label={t("Drag to reveal the difference.")}
              aria-valuetext={`${comparisonPosition}% ${t("Clean").toLowerCase()}`}
              className="comparisonRange"
              max="100"
              min="0"
              onChange={(event) =>
                setComparisonPosition(Number(event.target.value))
              }
              type="range"
              value={comparisonPosition}
            />
          </div>
        </div>

        <div className="beforeAfterCopy">
          <p className="landingEyebrow">{t("Before & after")}</p>
          <h2>{t("Drag to reveal the difference.")}</h2>
          <p>
            {t("Move the handle left to see the worn surface and right to reveal the professionally restored finish. The control also works with your keyboard.")}
          </p>
          <ul>
            <li>
              <span>✓</span> {t("Deep, detail-led cleaning")}
            </li>
            <li>
              <span>✓</span> {t("Fabric-conscious products")}
            </li>
            <li>
              <span>✓</span> {t("Visible, accountable results")}
            </li>
          </ul>
          <a href="#contact">{t("Request a restoration review")}</a>
        </div>
      </section>

      <section className="landingSection standardsSection" id="standards">
        <div className="standardsHeading">
          <p className="landingEyebrow">{t("A standard you can see")}</p>
          <h2>{t("Professional care is more than a clean result.")}</h2>
        </div>

        <div className="standardsContent">
          <ol className="processList">
            <li>
              <span>01</span>
              <div>
                <strong>{t("Understand")}</strong>
                <p>
                  {t("We review the space, priorities, access, and expected result.")}
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>{t("Plan")}</strong>
                <p>
                  {t("We define the routine, timing, equipment, and responsible team.")}
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>{t("Deliver")}</strong>
                <p>
                  {t("Employees receive clear assignments through the secure portal.")}
                </p>
              </div>
            </li>
            <li>
              <span>04</span>
              <div>
                <strong>{t("Improve")}</strong>
                <p>
                  {t("Managers use real scheduling insight to refine future service.")}
                </p>
              </div>
            </li>
          </ol>

          <div className="commitmentCard">
            <p className="landingEyebrow">{t("Our operating commitments")}</p>
            <ul>
              {commitments.map((commitment) => (
                <li key={commitment}>
                  <span aria-hidden="true">+</span>
                  {t(commitment)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="contactSection" id="contact">
        <div className="contactCopy">
          <p className="landingEyebrow">{t("Start with a clearer service plan")}</p>
          <h2>{t("Tell us what your space needs.")}</h2>
          <p>
            {t("Share the type of site, preferred frequency, and your priorities. We will shape a service review around the information you provide.")}
          </p>
          <div className="contactNotes">
            <span>{t("Commercial enquiries")}</span>
            <span>{t("Recurring and one-time service")}</span>
            <span>{t("Company contact details added before launch")}</span>
          </div>
        </div>

        <form className="enquiryForm" onSubmit={handleEnquiry}>
          <div className="formPair">
            <label>
              {t("Company")}
              <input name="company" required />
            </label>
            <label>
              {t("Work email")}
              <input name="email" type="email" required />
            </label>
          </div>
          <label>
            {t("Service interest")}
            <select name="service" defaultValue="">
              <option value="" disabled>
                {t("Select a service")}
              </option>
              {services.map((service) => (
                <option key={service.number}>{t(service.title)}</option>
              ))}
            </select>
          </label>
          <label>
            {t("What should we know?")}
            <textarea name="message" rows={4} required />
          </label>
          <button type="submit">{t("Prepare my enquiry")}</button>
          {enquiryReady ? (
            <p className="enquiryNotice" role="status">
              {t("The enquiry interface is ready. Email delivery will be connected when the company contact address is confirmed.")}
            </p>
          ) : null}
        </form>
      </section>

      <section className="clientReviewsSection" aria-labelledby="client-reviews-title">
        <div className="clientReviewsHeading">
          <p>{t("Client reviews")}</p>
          <h2 id="client-reviews-title">{t("What clients value in a dependable cleaning partner.")}</h2>
          <span><strong>{t("Review layout preview")}</strong> · {t("Replace these sample texts with verified client feedback before publication.")}</span>
        </div>
        <div className="clientReviewsCarousel" aria-label={t("Client reviews")}>
          <div className="clientReviewsTrack">
            {[...clientReviews, ...clientReviews].map((review, index) => {
              const duplicate = index >= clientReviews.length;
              return (
                <article aria-hidden={duplicate || undefined} className="clientReviewCard" key={`${review.initials}-${index}`}>
                  <header><span>{review.initials}</span><div><strong>{t(review.role)}</strong><small>Clarity Clean</small></div></header>
                  <div className="reviewStars" aria-label={language === "de" ? "5 von 5 Sternen" : "5 out of 5 stars"}>★★★★★</div>
                  <blockquote>{t(review.quote)}</blockquote>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="siteFooter">
        <div className="publicBrand footerBrand">
          <span className="publicBrandMark" aria-hidden="true">
            CC
          </span>
          <span>
            <strong>Clarity Clean</strong>
            <small>{t("Smart facility care")}</small>
          </span>
        </div>
        <p>{t("Commercial cleaning with clearer operations.")}</p>
        <div>
          <a href="#services">{t("Services")}</a>
          <a href="/login">{t("Team portal")}</a>
          <a href="#contact">{t("Contact")}</a>
        </div>
      </footer>
    </main>
  );
}
