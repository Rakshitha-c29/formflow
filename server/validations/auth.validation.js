// Each validator returns a list of error messages and normalizes req.body in place
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isNonEmptyString = (value) =>
    typeof value === "string" && value.trim().length > 0;

// Applies to new passwords only; login accepts any existing password
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_RULE_MESSAGE =
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include at least one letter and one number`;

const isStrongPassword = (value) =>
    typeof value === "string" &&
    value.length >= PASSWORD_MIN_LENGTH &&
    /[A-Za-z]/.test(value) &&
    /[0-9]/.test(value);

const validateEmail = (body, errors) => {
    if (!isNonEmptyString(body.email)) {
        errors.push("Email is required");
    } else if (!EMAIL_REGEX.test(body.email.trim())) {
        errors.push("Email is invalid");
    } else {
        // Stored emails are lowercase, so lookups must be too
        body.email = body.email.trim().toLowerCase();
    }
};

exports.registerSchema = (body) => {
    const errors = [];

    if (!isNonEmptyString(body.name)) {
        errors.push("Name is required");
    } else if (body.name.trim().length > 50) {
        errors.push("Name must be at most 50 characters");
    } else {
        body.name = body.name.trim();
    }

    validateEmail(body, errors);

    if (!isStrongPassword(body.password)) {
        errors.push(PASSWORD_RULE_MESSAGE);
    }

    return errors;
};

exports.loginSchema = (body) => {
    const errors = [];

    validateEmail(body, errors);

    if (!isNonEmptyString(body.password)) {
        errors.push("Password is required");
    }

    return errors;
};
