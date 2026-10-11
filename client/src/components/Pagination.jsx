// Previous/Next controls for a paginated API response ({ page, totalPages, total })
function Pagination({ page, totalPages, total, loading, onPageChange, itemLabel = "items" }) {
    if (!totalPages || totalPages <= 1) return null;

    return (
        <div className="pagination">
            <button
                className="secondary-btn"
                onClick={() => onPageChange(page - 1)}
                disabled={loading || page <= 1}
            >
                ← Previous
            </button>

            <span className="pagination-info">
                Page {page} of {totalPages} · {total} {itemLabel}
            </span>

            <button
                className="secondary-btn"
                onClick={() => onPageChange(page + 1)}
                disabled={loading || page >= totalPages}
            >
                Next →
            </button>
        </div>
    );
}

export default Pagination;
