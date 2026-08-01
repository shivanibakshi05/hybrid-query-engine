import { useRef, useState } from 'react';

interface Props {
  onLoad: (text: string, fileName: string, fileSize: number) => void;
}

export default function CsvDropzone({ onLoad }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) =>
      onLoad(e.target?.result as string, file.name, file.size);
    reader.readAsText(file);
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors
        ${dragging ? 'border-cyan-400 bg-cyan-950/30' : 'border-gray-600 hover:border-gray-500'}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) readFile(file);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <p className="text-gray-400 text-sm">
        Drop a CSV file here or{' '}
        <span className="text-cyan-400">click to upload</span>
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) readFile(f);
        }}
      />
    </div>
  );
}
