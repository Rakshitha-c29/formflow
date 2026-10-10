// Mirrors server/constants/roles.js. Used only to shape the UI;
// the backend decides what each role is allowed to do.
export const ROLES = {
    EMPLOYEE: "employee",
    MANAGER: "manager",
    HR: "hr",
    ADMIN: "admin",
};

export const ROLE_VALUES = Object.values(ROLES);

export const ROLE_LABELS = {
    employee: "Employee",
    manager: "Manager",
    hr: "HR",
    admin: "Admin",
};

export const roleLabel = (role) => ROLE_LABELS[role] || role;

// Roles that appear as approvers in workflows
export const APPROVER_ROLES = [ROLES.MANAGER, ROLES.HR, ROLES.ADMIN];
