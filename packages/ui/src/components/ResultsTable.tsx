
interface Props {
  rows: Record<string, unknown>[];
}

export default function ResultsTable({ rows }: Props) {
  if (rows.length === 0) return null;
  const cols = Object.keys(rows[0]);

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-900">
          <tr>
            {cols.map(c => (
              <th key={c} className="px-4 py-2 text-left text-gray-400 font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((row, i) => (
            <tr key={i} className="border-t border-gray-800 hover:bg-gray-900/50">
              {cols.map(c => (
                <td key={c} className="px-4 py-2 text-gray-200">{String(row[c] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
