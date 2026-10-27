export type AccountRole = "ADMIN" | "MANAGER" | "EMPLOYEE";

export function isManagementRole(role: AccountRole) {
  return role === "ADMIN" || role === "MANAGER";
}
