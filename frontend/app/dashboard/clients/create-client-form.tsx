"use client";

import { useState, type FormEvent } from "react";
import {
  API_BASE_URL,
  responseMessage,
} from "../../lib/auth-client";
import type {
  Client,
  CreateClientInput,
} from "./types";

type CreateClientFormProps = {
  accessToken: string;
  onClientCreated: (client: Client) => void;
};

export default function CreateClientForm({
  accessToken,
  onClientCreated,
}: CreateClientFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const companyName = String(
      formData.get("companyName") ?? "",
    ).trim();

    const contactName = String(
      formData.get("contactName") ?? "",
    ).trim();

    const email = String(
      formData.get("email") ?? "",
    ).trim();

    const phone = String(
      formData.get("phone") ?? "",
    ).trim();

    const notes = String(
      formData.get("notes") ?? "",
    ).trim();

    if (!companyName) {
      setError("Company name is required.");
      return;
    }

    const input: CreateClientInput = {
      companyName,
    };

    if (contactName) {
      input.contactName = contactName;
    }

    if (email) {
      input.email = email;
    }

    if (phone) {
      input.phone = phone;
    }

    if (notes) {
      input.notes = notes;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_BASE_URL}/clients`, {
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

      const client = (await response.json()) as Client;

      onClientCreated(client);
      setSuccess(`${client.companyName} was created successfully.`);
      form.reset();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The client could not be created.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="entityFormCard">
      <header className="entityFormHeader">
        <span className="entityFormIcon" aria-hidden="true">◇</span>
        <div>
          <p className="entityFormEyebrow">New relationship</p>
          <h2>Add a client</h2>
          <p>Register the organization that will receive your cleaning services.</p>
        </div>
      </header>

      <form className="entityForm" onSubmit={handleSubmit}>
        <div className="formGrid">
        <div className="formField formFieldWide">
          <label htmlFor="companyName">Company name</label>
          <input
            id="companyName"
            name="companyName"
            type="text"
            autoComplete="organization"
            maxLength={200}
            placeholder="Riverside Offices"
            required
          />
        </div>

        <div className="formField">
          <label htmlFor="contactName">Contact name</label>
          <input
            id="contactName"
            name="contactName"
            type="text"
            autoComplete="name"
            maxLength={200}
            placeholder="Primary contact"
          />
        </div>

        <div className="formField">
          <label htmlFor="clientEmail">Email address</label>
          <input
            id="clientEmail"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={320}
            placeholder="contact@company.fr"
          />
        </div>

        <div className="formField">
          <label htmlFor="clientPhone">Phone number</label>
          <input
            id="clientPhone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={30}
            placeholder="+33 1 23 45 67 89"
          />
        </div>

        <div className="formField formFieldWide">
          <label htmlFor="clientNotes">Notes</label>
          <textarea
            id="clientNotes"
            name="notes"
            rows={4}
            maxLength={5000}
            placeholder="Key contacts, contract context or service preferences…"
          />
        </div>
        </div>

        <footer className="formActions">
          <p>You can attach one or more cleaning sites next.</p>
          <button type="submit" disabled={submitting}>
            {submitting ? "Creating client…" : "Create client"}
            <span aria-hidden="true">→</span>
          </button>
        </footer>
      </form>

      {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}
      {success ? <p className="formMessage formMessageSuccess" role="status">{success}</p> : null}
    </section>
  );
}
