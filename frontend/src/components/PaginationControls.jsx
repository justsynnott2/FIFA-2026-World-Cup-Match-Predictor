/**
 * First/prev/numbered-window/next/last pagination control used under a
 * paginated list. Shows up to five numbered page buttons — sliding the
 * window back near the end of the list so it always shows five real pages
 * rather than running past the last one — flanked by jump-to-first/last and
 * step prev/next buttons. Disables first/prev on the first page and
 * next/last once the current page already covers the last item.
 */
export default function PaginationControls({ page, totalItems, pageSize, setPage }) {
    const totalPages = Math.ceil(totalItems / pageSize)
    const isFirst = page === 0
    const isLast = totalPages === 0 || page >= totalPages - 1

    const windowSize = 5
    const windowStart = Math.min(page, Math.max(totalPages - windowSize, 0))
    const windowEnd = Math.min(windowStart + windowSize, totalPages)
    const windowPages = []
    for (let i = windowStart; i < windowEnd; i++) windowPages.push(i)

    return (
        <div className="pagination-controls">
            <button
                className="secondary-button pagination-controls__arrow"
                aria-label="first page"
                onClick={() => setPage(0)}
                disabled={isFirst}
            >
                «
            </button>
            <button
                className="secondary-button pagination-controls__arrow"
                aria-label="previous page"
                onClick={() => setPage(page - 1)}
                disabled={isFirst}
            >
                ‹
            </button>

            {windowPages.map((i) => (
                <button
                    key={i}
                    className={`pagination-controls__page${i === page ? ' pagination-controls__page--active' : ' secondary-button'}`}
                    aria-current={i === page ? 'page' : undefined}
                    onClick={() => setPage(i)}
                >
                    {i + 1}
                </button>
            ))}

            <button
                className="secondary-button pagination-controls__arrow"
                aria-label="next page"
                onClick={() => setPage(page + 1)}
                disabled={isLast}
            >
                ›
            </button>
            <button
                className="secondary-button pagination-controls__arrow"
                aria-label="last page"
                onClick={() => setPage(totalPages - 1)}
                disabled={isLast}
            >
                »
            </button>
        </div>
    )
}
