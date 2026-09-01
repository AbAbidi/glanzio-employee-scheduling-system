"use client";

import { useState, type FormEvent } from "react";
import {
  API_BASE_URL,
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
  onEmployeeCreated: (employee: Employee) => void;
};

export default function CreateEmployeeForm({
  accessToken,
  onEmployeeCreated,
}: CreateEmployeeFormProps) {
  const [submitting, setSubmitting] = useState(false);
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
      email: String(formData.get("email") ?? "").trim(),
      firstName: String(
        formData.get("firstName") ?? "",
      ).trim(),
      lastName: String(
        formData.get("lastName") ?? "",
      ).trim(),
      isStudent: formData.get("isStudent") === "on",
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
      const response = await fetch(`${API_BASE_URL}/employees`, {
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
          <p className="entityFormEyebrow">Grow your team</p>
          <h2>Invite an employee</h2>
          <p>Create their profile now. They will choose their password from the secure invitation.</p>
        </div>
      </header>

      <form className="entityForm" onSubmit={handleSubmit}>
        <div className="formGrid">
        <div className="formField">
          <label htmlFor="firstName">First name</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            maxLength={100}
            placeholder="Amelia"
            required
          />
        </div>

        <div className="formField">
          <label htmlFor="lastName">Last name</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            maxLength={100}
            placeholder="Martin"
            required
          />
        </div>

        <div className="formField">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={320}
            placeholder="amelia@clarityclean.fr"
            required
          />
        </div>

        <div className="formField">
          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={30}
            placeholder="+33 6 12 34 56 78"
          />
        </div>

        <div className="formField">
          <label htmlFor="hourlyRate">Hourly rate</label>
          <input
            id="hourlyRate"
            name="hourlyRate"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="18.50"
          />
        </div>

        <label className="studentToggle">
          <input name="isStudent" type="checkbox" />
          <span className="toggleTrack" aria-hidden="true"><i /></span>
          <span>
            <strong>Student employee</strong>
            <small>Track the monthly 80-hour limit as an insight.</small>
          </span>
        </label>
        </div>

        <footer className="formActions">
          <p>An invitation link is generated after creation.</p>
          <button type="submit" disabled={submitting}>
            {submitting ? "Creating invitation…" : "Invite employee"}
            <span aria-hidden="true">→</span>
          </button>
        </footer>
      </form>

      {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}

      {success ? <p className="formMessage formMessageSuccess" role="status">{success}</p> : null}

      {invitation?.developmentInvitationUrl ? (
        <InvitationLinkPanel
          url={invitation.developmentInvitationUrl}
          expiresAt={invitation.expiresAt}
        />
      ) : null}
    </section>
  );
}
