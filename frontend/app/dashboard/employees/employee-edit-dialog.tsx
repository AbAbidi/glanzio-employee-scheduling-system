"use client";

import { useState, type FormEvent } from "react";
import { API_BASE_URL, responseMessage } from "../../lib/auth-client";
import type { Employee } from "./types";

type EmployeeEditDialogProps = {
  accessToken: string;
  employee: Employee;
  onClose: () => void;
  onUpdated: (employee: Employee) => void;
};

export default function EmployeeEditDialog({
  accessToken,
  employee,
  onClose,
  onUpdated,
}: EmployeeEditDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const hourlyRate = String(formData.get("hourlyRate") ?? "").trim();
    const newPassword = String(formData.get("newPassword") ?? "");
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/employees/${employee.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: String(formData.get("firstName") ?? "").trim(),
          lastName: String(formData.get("lastName") ?? "").trim(),
          email: String(formData.get("email") ?? "").trim(),
          phone: String(formData.get("phone") ?? "").trim(),
          ...(hourlyRate ? { hourlyRate: Number(hourlyRate) } : {}),
          isStudent: formData.get("isStudent") === "on",
        }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const updated = (await response.json()) as Employee;

      if (newPassword) {
        const passwordResponse = await fetch(
          `${API_BASE_URL}/employees/${employee.id}/reset-password`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ newPassword }),
          },
        );
        if (!passwordResponse.ok) {
          throw new Error(await responseMessage(passwordResponse));
        }
      }

      onUpdated(updated);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The employee profile could not be updated.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="employeeDialog" role="dialog" aria-modal="true" aria-labelledby="employee-edit-title">
      <header>
        <div><p>Employee profile</p><h2 id="employee-edit-title">Edit {employee.firstName} {employee.lastName}</h2></div>
        <button type="button" aria-label="Close employee editor" onClick={onClose}>×</button>
      </header>
      <form onSubmit={handleSubmit}>
        <div className="employeeEditGrid">
          <label>First name<input name="firstName" defaultValue={employee.firstName} maxLength={100} required /></label>
          <label>Last name<input name="lastName" defaultValue={employee.lastName} maxLength={100} required /></label>
          <label>Email<input name="email" type="email" defaultValue={employee.user.email} maxLength={320} required /></label>
          <label>Phone number<input name="phone" type="tel" defaultValue={employee.phone ?? ""} maxLength={30} /></label>
          <label>Hourly rate (€)<input name="hourlyRate" type="number" min="0" step="0.01" defaultValue={employee.hourlyRate ?? ""} /></label>
          <label className="employeeCheckbox"><input name="isStudent" type="checkbox" defaultChecked={employee.isStudent} /><span>Student employee</span></label>
        </div>
        {employee.user.status !== "INVITED" ? (
          <label className="employeePasswordField">Set a temporary password<input name="newPassword" type="password" minLength={12} maxLength={200} autoComplete="new-password" placeholder="Leave empty to keep the current password" /><small>Existing passwords are never visible. Setting a new one signs the employee out everywhere.</small></label>
        ) : null}
        {error ? <p className="formMessage formMessageError" role="alert">{error}</p> : null}
        <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save employee"}</button></footer>
      </form>
    </section>
  );
}
