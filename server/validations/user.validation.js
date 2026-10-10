const { ROLE_VALUES } = require("../constants/roles");

exports.updateRoleSchema = (body) => {
    const errors = [];

    if (typeof body.role !== "string" || !ROLE_VALUES.includes(body.role)) {
        errors.push(`Role must be one of: ${ROLE_VALUES.join(", ")}`);
    }

    return errors;
};
