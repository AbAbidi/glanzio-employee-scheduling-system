"use client";

import { useDashboardLanguage } from "../dashboard-language";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  API_BASE_URL, authenticatedFetch,
  responseMessage,
} from "../../lib/auth-client";
import type {
  ClientListItem,
  ClientListResponse,
} from "../clients/types";
import type {
  CleaningSite,
  CreateSiteInput,
} from "./types";

type CreateSiteFormProps = {
  accessToken: string;
  onSiteCreated: (site: CleaningSite) => void;
};

export default function CreateSiteForm({
  accessToken,
  onSiteCreated,
}: CreateSiteFormProps) {
  const { t } = useDashboardLanguage();
  const [clients, setClients] =
    useState<ClientListItem[]>([]);

  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadClients() {
      try {
        const response = await authenticatedFetch(
          `${API_BASE_URL}/clients?active=true&page=1&pageSize=100`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error(await responseMessage(response));
        }

        const result =
          (await response.json()) as ClientListResponse;

        if (isActive) {
          setClients(result.items);
        }
      } catch (requestError) {
        if (isActive) {
          setClientsError(
            requestError instanceof Error
              ? requestError.message
              : "The client options could not be loaded.",
          );
        }
      } finally {
        if (isActive) {
          setClientsLoading(false);
        }
      }
    }

    void loadClients();

    return () => {
      isActive = false;
    };
  }, [accessToken]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const clientId = String(
      formData.get("clientId") ?? "",
    ).trim();

    const name = String(
      formData.get("name") ?? "",
    ).trim();

    const addressLine1 = String(
      formData.get("addressLine1") ?? "",
    ).trim();

    const addressLine2 = String(
      formData.get("addressLine2") ?? "",
    ).trim();

    const postalCode = String(
      formData.get("postalCode") ?? "",
    ).trim();

    const city = String(
      formData.get("city") ?? "",
    ).trim();

    const countryCode =
      String(formData.get("countryCode") ?? "FR")
        .trim()
        .toUpperCase() || "FR";

    const duration = String(
      formData.get("estimatedDurationMinutes") ?? "",
    ).trim();

    const equipmentText = String(
      formData.get("requiredEquipment") ?? "",
    ).trim();

    const notes = String(
      formData.get("notes") ?? "",
    ).trim();

    if (!clientId || !name || !addressLine1 || !city) {
      setError(
        "Client, site name, address, and city are required.",
      );
      return;
    }

    const input: CreateSiteInput = {
      clientId,
      name,
      addressLine1,
      city,
      countryCode,
      requiredEquipment: equipmentText
        ? equipmentText
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    };

    if (addressLine2) {
      input.addressLine2 = addressLine2;
    }

    if (postalCode) {
      input.postalCode = postalCode;
    }

    if (duration) {
      input.estimatedDurationMinutes = Number(duration);
    }

    if (notes) {
      input.notes = notes;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/sites`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }

      const site = (await response.json()) as CleaningSite;

      onSiteCreated(site);
      setSuccess(`${site.name} was created successfully.`);
      form.reset();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The cleaning site could not be created.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="entityFormCard">
      <header className="entityFormHeader">
        <span className="entityFormIcon" aria-hidden="true">⌖</span>
        <div>
          <p className="entityFormEyebrow">{t("Service location")}</p>
          <h2>{t("Add a cleaning site")}</h2>
          <p>{t("Describe the place once so every future assignment starts with the right context.")}</p>
        </div>
      </header>

      {clientsLoading ? <p className="formNotice">{t("Loading client options…")}</p> : null}

      {clientsError ? (
        <p className="formMessage formMessageError" role="alert">{clientsError}</p>
      ) : null}

      {!clientsLoading &&
      !clientsError &&
      clients.length === 0 ? (
        <p className="formNotice">{t("Create an active client before creating a site.")}</p>
      ) : null}

      <form className="entityForm" onSubmit={handleSubmit}>
        <div className="formGrid">
        <div className="formField formFieldWide">
          <label htmlFor="siteClient">{t("Client")}</label>
          <select
            id="siteClient"
            name="clientId"
            required
            disabled={
              submitting ||
              clientsLoading ||
              clients.length === 0
            }
          >
            <option value="">{t("Select a client")}</option>

            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.companyName}
              </option>
            ))}
          </select>
        </div>

        <div className="formField formFieldWide">
          <label htmlFor="siteName">{t("Site name")}</label>
          <input
            id="siteName"
            name="name"
            type="text"
            maxLength={200}
            placeholder={t("Riverside main office")}
            required
          />
        </div>

        <div className="formField formFieldWide">
          <label htmlFor="addressLine1">{t("Address line 1")}</label>
          <input
            id="addressLine1"
            name="addressLine1"
            type="text"
            autoComplete="address-line1"
            maxLength={250}
            placeholder={t("12 Avenue de la République")}
            required
          />
        </div>

        <div className="formField formFieldWide">
          <label htmlFor="addressLine2">{t("Address line 2")}</label>
          <input
            id="addressLine2"
            name="addressLine2"
            type="text"
            autoComplete="address-line2"
            maxLength={250}
            placeholder={t("Building, floor or access point")}
          />
        </div>

        <div className="formField">
          <label htmlFor="postalCode">{t("Postal code")}</label>
          <input
            id="postalCode"
            name="postalCode"
            type="text"
            autoComplete="postal-code"
            maxLength={30}
            placeholder="75011"
          />
        </div>

        <div className="formField">
          <label htmlFor="city">{t("City")}</label>
          <input
            id="city"
            name="city"
            type="text"
            autoComplete="address-level2"
            maxLength={120}
            placeholder={t("Paris")}
            required
          />
        </div>

        <div className="formField">
          <label htmlFor="countryCode">{t("Country code")}</label>
          <input
            id="countryCode"
            name="countryCode"
            type="text"
            defaultValue="FR"
            minLength={2}
            maxLength={2}
            required
          />
        </div>

        <div className="formField">
          <label htmlFor="estimatedDurationMinutes">{t("Estimated duration")}</label>
          <input
            id="estimatedDurationMinutes"
            name="estimatedDurationMinutes"
            type="number"
            min="1"
            step="1"
            placeholder={t("120 minutes")}
          />
        </div>

        <div className="formField formFieldWide">
          <label htmlFor="requiredEquipment">{t("Required equipment")}</label>
          <input
            id="requiredEquipment"
            name="requiredEquipment"
            type="text"
            placeholder={t("Vacuum, ladder, window-cleaning kit")}
          />
          <small>{t("Separate equipment names with commas.")}</small>
        </div>

        <div className="formField formFieldWide">
          <label htmlFor="siteNotes">{t("Notes")}</label>
          <textarea
            id="siteNotes"
            name="notes"
            rows={4}
            maxLength={5000}
            placeholder={t("Access instructions, security rules or important details…")}
          />
        </div>
        </div>

        <footer className="formActions">
          <p>{t("This location will be available in assignment planning.")}</p>
          <button
            type="submit"
            disabled={
              submitting ||
              clientsLoading ||
              clients.length === 0
            }
          >
            {submitting
              ? t("Creating cleaning site…")
              : t("Create cleaning site")}
            <span aria-hidden="true">→</span>
          </button>
        </footer>
      </form>

      {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}
      {success ? <p className="formMessage formMessageSuccess" role="status">{success}</p> : null}
    </section>
  );
}
