const AppError = require("./AppError");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Accepts only a single string of digits (rejects "1.5", "-1", "abc", and ?page=1&page=2)
const parsePositiveInt = (value, name, max, errors) => {
    if (value === undefined) return undefined;

    if (typeof value !== "string" || !/^\d+$/.test(value) || Number(value) < 1) {
        errors.push(`${name} must be a whole number of at least 1`);
        return undefined;
    }

    const number = Number(value);

    if (max && number > max) {
        errors.push(`${name} must be at most ${max}`);
        return undefined;
    }

    return number;
};

// Reads ?page and ?limit. Throws a 400 AppError listing every invalid parameter.
const parsePagination = (query) => {
    const errors = [];

    const page = parsePositiveInt(query.page, "page", null, errors) ?? 1;
    const limit = parsePositiveInt(query.limit, "limit", MAX_LIMIT, errors) ?? DEFAULT_LIMIT;

    if (errors.length > 0) {
        throw new AppError(errors.join(", "), 400, errors);
    }

    return { page, limit, skip: (page - 1) * limit };
};

// Pagination fields added to every paginated list response
const pageInfo = ({ page, limit }, total) => ({
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
});

module.exports = { parsePagination, pageInfo, DEFAULT_LIMIT, MAX_LIMIT };
