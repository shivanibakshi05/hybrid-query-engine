
interface Props {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  loading: boolean;
}

export default function QueryEditor({ value, onChange, onRun, loading }: Props) {
  return (
    <div className="mt-4">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 font-mono text-sm text-white focus:outline-none focus:border-cyan-500 resize-none"
        placeholder="SELECT * FROM data LIMIT 10"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onRun(); }}
      />
      <button
        onClick={onRun}
        disabled={loading}
        className="mt-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
      >
        {loading ? 'Running...' : 'Run  ⌘↵'}
      </button>
    </div>
  );
}
