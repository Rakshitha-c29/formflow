// Single source of truth for user roles and workflow approver roles
const ROLES = Object.freeze({
    EMPLOYEE: "employee",
    MANAGER: "manager",
    HR: "hr",
    ADMIN: "admin"
});

const ROLE_VALUES = Object.freeze(Object.values(ROLES));

module.exports = { ROLES, ROLE_VALUES };
