const { parsePagination, pageInfo } = require("../../utils/pagination");
const AppError = require("../../utils/AppError");

const parseError = (query) => {
    try {
        parsePagination(query);
    } catch (error) {
        return error;
    }
    throw new Error("expected parsePagination to throw");
};

describe("parsePagination", () => {
    it("defaults to page 1 with 20 per page", () => {
        expect(parsePagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
    });

    it("reads page and limit and computes skip", () => {
        expect(parsePagination({ page: "3", limit: "10" })).toEqual({ page: 3, limit: 10, skip: 20 });
    });

    it("accepts the maximum limit of 100", () => {
        expect(parsePagination({ limit: "100" }).limit).toBe(100);
    });

    it.each([
        ["page", { page: "0" }],
        ["page", { page: "-1" }],
        ["page", { page: "1.5" }],
        ["page", { page: "abc" }],
        ["page", { page: "" }],
        ["page", { page: ["1", "2"] }],
        ["limit", { limit: "0" }],
        ["limit", { limit: "101" }],
        ["limit", { limit: "ten" }]
    ])("rejects an invalid %s (%j) with a 400 naming it", (name, query) => {
        const error = parseError(query);

        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(400);
        expect(error.errors).toHaveLength(1);
        expect(error.errors[0]).toMatch(new RegExp(`^${name} `));
    });

    it("reports both parameters when both are invalid", () => {
        expect(parseError({ page: "x", limit: "500" }).errors).toEqual([
            "page must be a whole number of at least 1",
            "limit must be at most 100"
        ]);
    });
});

describe("pageInfo", () => {
    it.each([
        [0, 0],
        [1, 1],
        [20, 1],
        [21, 2],
        [45, 3]
    ])("with %i items at 20 per page, totalPages is %i", (total, totalPages) => {
        expect(pageInfo({ page: 1, limit: 20 }, total)).toEqual({ total, page: 1, limit: 20, totalPages });
    });
});
