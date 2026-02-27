import React from "react";

/**
 * Smart Resource Aggregator page (scaffold).
 */
export default function ResourcesPage() {
  return (
    <div className="flex flex-col min-h-[500px] p-4">
      <h1 className="text-lg font-semibold mb-2">Resources (coming soon)</h1>
      <p className="text-sm text-gray-600 mb-4">
        This page will show suggested external resources and a personal library
        for the current Piazza course.
      </p>
      <div className="border border-dashed border-gray-300 rounded-md p-3 text-xs text-gray-500">
        UI decisions still pending:
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>Where this page is linked from (Dashboard vs Assistant).</li>
          <li>Exact layout for search vs library tabs.</li>
          <li>How to surface provider types and relevance scores.</li>
        </ul>
      </div>
    </div>
  );
}

