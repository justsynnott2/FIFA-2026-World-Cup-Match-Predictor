/**
 * Prev/Next pagination control used under a paginated fixture list. Shows
 * "Page N of M" between two buttons; disables Prev on the first page and
 * Next once the current page already covers the last item.
 */
export default function PaginationControls({ page, totalItems, pageSize, setPage, prevLabel, nextLabel }) {
    const totalPages = Math.ceil(totalItems / pageSize)
    return (
        <div className="pagination-controls">
            <button
                className="secondary-button"
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
            >
                {prevLabel}
            </button>
            <span className="pagination-controls__label">
                Page {page + 1} of {totalPages}
            </span>
            <button
                className="secondary-button"
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= totalItems}
            >
                {nextLabel}
            </button>
        </div>
    )
}
