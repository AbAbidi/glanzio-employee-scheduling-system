"use client";

import { useEffect, useRef } from "react";
import FeedbackPrivacyNote from "./feedback-privacy-note";

export type PortalLegalPanel = "impressum" | "privacy";

const companyEmail = "info@glanzio-reinigung.de";

export default function PortalLegalDialog({
  panel,
  onClose,
}: {
  panel: PortalLegalPanel;
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
        aria-labelledby={`portal-legal-${panel}-title`}
        aria-modal="true"
        className="legalModal"
        role="dialog"
      >
        <header className="legalModalHeader">
          <div>
            <span>Glanzio Reinigung</span>
            <h2 id={`portal-legal-${panel}-title`}>{title}</h2>
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
                  Telefon: <a href="tel:+4917683446967">+49 176 83446967</a>
                  <br />
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
                <p>
                  Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend
                  den gesetzlichen Datenschutzvorschriften. Personenbezogene Daten sind alle
                  Daten, mit denen Sie persönlich identifiziert werden können.
                </p>
              </section>

              <section>
                <h3>2. Verantwortliche Stelle</h3>
                <p>
                  Glanzio Reinigung GbR<br />
                  Waldweg 38<br />
                  88960 Uhldigen-Mühlofen
                </p>
                <p>
                  Telefon: <a href="tel:+4917683446967">+49 176 83446967</a>
                  <br />
                  E-Mail: <a href={`mailto:${companyEmail}`}>{companyEmail}</a>
                </p>
              </section>

              <section>
                <h3>3. Datenverarbeitung im Mitarbeiterportal</h3>
                <h4>Einladung und Benutzerkonto</h4>
                <p>
                  Zur Einrichtung Ihres Zugangs verarbeiten wir die vom Arbeitgeber
                  hinterlegten Stamm- und Kontaktdaten sowie technische Daten zur sicheren
                  Aktivierung und Anmeldung. Passwörter werden ausschließlich in geschützter,
                  nicht im Klartext lesbarer Form gespeichert.
                </p>
                <h4>Einsatz- und Arbeitszeitdaten</h4>
                <p>
                  Im Portal werden die für Ihre Beschäftigung erforderlichen Einsatzpläne,
                  Einsatzorte, Statusangaben und Arbeitszeiten verarbeitet. Diese Daten dienen
                  der Einsatzplanung, Durchführung, Abrechnung und Erfüllung gesetzlicher
                  Nachweis- und Aufbewahrungspflichten.
                </p>
                <h4>Sicherheits- und Protokolldaten</h4>
                <p>
                  Sicherheitsrelevante Vorgänge können protokolliert werden, um unbefugte
                  Zugriffe zu verhindern, Fehler nachzuvollziehen und die Integrität des
                  Systems zu gewährleisten.
                </p>
              </section>

              <section>
                <h3>4. Speicherdauer und Empfänger</h3>
                <p>
                  Daten werden nur so lange gespeichert, wie sie für das
                  Beschäftigungsverhältnis, die genannten Zwecke oder gesetzliche
                  Aufbewahrungspflichten erforderlich sind. Eine Weitergabe erfolgt nur,
                  soweit sie gesetzlich vorgeschrieben, zur Vertragserfüllung erforderlich
                  oder durch einen datenschutzkonform eingebundenen Dienstleister gedeckt ist.
                </p>
              </section>

              <section>
                <h3>5. Ihre Rechte</h3>
                <p>
                  Sie haben im Rahmen der gesetzlichen Voraussetzungen das Recht auf Auskunft,
                  Berichtigung, Löschung, Einschränkung der Verarbeitung und
                  Datenübertragbarkeit. Außerdem können Sie einer Verarbeitung widersprechen
                  und sich bei einer zuständigen Datenschutzaufsichtsbehörde beschweren.
                </p>
                <p>
                  Bei Fragen zu Ihren Daten wenden Sie sich bitte an
                  <a href={`mailto:${companyEmail}`}> {companyEmail}</a>.
                </p>
              </section>
            </>
          )}
          {panel === "privacy" ? <FeedbackPrivacyNote /> : null}
        </div>
        <footer className="legalModalFooter">
          <button onClick={onClose} type="button">
            Schließen
          </button>
        </footer>
      </section>
    </div>
  );
}
