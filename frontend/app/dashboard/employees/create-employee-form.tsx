"use client";

import { useDashboardLanguage } from "../dashboard-language";

import { useState, type FormEvent } from "react";
import {
  API_BASE_URL, authenticatedFetch,
  responseMessage,
} from "../../lib/auth-client";
import type {
  CreateEmployeeInput,
  CreateEmployeeResponse,
  Employee,
  InvitationDelivery,
} from "./types";
import InvitationLinkPanel from "./invitation-link-panel";

type CreateEmployeeFormProps = {
  accessToken: string;
  canCreateManager?: boolean;
  onEmployeeCreated: (employee: Employee) => void;
};

export default function CreateEmployeeForm({
  accessToken,
  canCreateManager = false,
  onEmployeeCreated,
}: CreateEmployeeFormProps) {
  const { t } = useDashboardLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<"EMPLOYEE" | "MANAGER">("EMPLOYEE");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [invitation, setInvitation] =
    useState<InvitationDelivery | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const phone = String(formData.get("phone") ?? "").trim();
    const hourlyRate = String(
      formData.get("hourlyRate") ?? "",
    ).trim();

    const input: CreateEmployeeInput = {
      ...(String(formData.get("email") ?? "").trim() ? { email: String(formData.get("email")).trim() } : {}),
      firstName: String(
        formData.get("firstName") ?? "",
      ).trim(),
      lastName: String(
        formData.get("lastName") ?? "",
      ).trim(),
      isStudent: role === "EMPLOYEE" && formData.get("isStudent") === "on",
      ...(canCreateManager && role === "MANAGER" ? { role } : {}),
    };

    if (phone) {
      input.phone = phone;
    }

    if (hourlyRate) {
      input.hourlyRate = Number(hourlyRate);
    }

    setSubmitting(true);
    setError("");
    setSuccess("");
    setInvitation(null);

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/employees`, {
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

      const result =
        (await response.json()) as CreateEmployeeResponse;

      onEmployeeCreated(result.employee);

      setSuccess(
        `${result.employee.firstName} ${result.employee.lastName} was invited successfully.`,
      );

      setInvitation(result.invitation);

      form.reset();
      setRole("EMPLOYEE");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The employee could not be created.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="entityFormCard">
      <header className="entityFormHeader">
        <span className="entityFormIcon" aria-hidden="true">+</span>
        <div>
          <p className="entityFormEyebrow">{t("Grow your team")}</p>
          <h2>{t("Invite an employee")}</h2>
          <p>{t("Create their profile now. They will choose their password from the secure invitation.")}</p>
        </div>
      </header>

      <form className="entityForm" onSubmit={handleSubmit}>
        {canCreateManager ? <label className="formField">{t("Account access")}<select name="role" value={role} onChange={(event) => setRole(event.target.value as "EMPLOYEE" | "MANAGER")}><option value="EMPLOYEE">{t("Standard employee")}</option><option value="MANAGER">Admin / Gestionnaire</option></select><small>{t("Manager access excludes logs, feedback, archives and account security settings.")}</small></label> : null}
        <div className="formGrid">
        <div className="formField">
          <label htmlFor="firstName">{t("First name")}</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            maxLength={100}
            placeholder={t("First name")}
            required
          />
        </div>

        <div className="formField">
          <label htmlFor="lastName">{t("Last name")}</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            maxLength={100}
            placeholder={t("Last name")}
            required
          />
        </div>

        <div className="formField">
          <label htmlFor="email">{t("Email address")} ({t("Optional")})</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={320}
            placeholder={t("Email address")}
          />
        </div>

        <div className="formField">
          <label htmlFor="phone">{t("Phone number")}</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={30}
            placeholder={t("Phone number")}
          />
        </div>

        <div className="formField">
          <label htmlFor="hourlyRate">{t("Hourly rate")}</label>
          <input
            id="hourlyRate"
            name="hourlyRate"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder={t("Hourly rate (€)")}
          />
        </div>

        <label className="studentToggle">
          <input name="isStudent" type="checkbox" disabled={role === "MANAGER"} />
          <span className="toggleTrack" aria-hidden="true"><i /></span>
          <span>
            <strong>{t("Student employee")}</strong>
            <small>{t("Track 10h/week and 40h/month from October 2026. Warnings do not block assignments.")}</small>
          </span>
        </label>
        </div>

        <footer className="formActions">
          <p>{t("An invitation link is generated after creation.")}</p>
          <button type="submit" disabled={submitting}>
            {submitting ? t("Creating invitation…") : t("Invite employee")}
            <span aria-hidden="true">→</span>
          </button>
        </footer>
      </form>

      {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}

      {success ? <p className="formMessage formMessageSuccess" role="status">{success}</p> : null}

      {invitation?.invitationUrl || invitation?.developmentInvitationUrl ? (
        <InvitationLinkPanel
          url={invitation.invitationUrl ?? invitation.developmentInvitationUrl!}
          expiresAt={invitation.expiresAt}
        />
      ) : null}
    </section>
  );
}
