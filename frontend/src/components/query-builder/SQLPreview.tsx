import { useState } from 'react';
import { Card } from '@/components/ui/Card';

interface SQLPreviewProps {
  sql: string;
  onSqlChange?: (sql: string) => void;
  editable?: boolean;
}

export function SQLPreview({ sql, onSqlChange, editable = true }: SQLPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSql, setEditedSql] = useState(sql);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy SQL:', err);
    }
  };

  const handleEditToggle = () => {
    if (isEditing && onSqlChange) {
      // Save changes
      onSqlChange(editedSql);
    } else {
      // Start editing
      setEditedSql(sql);
    }
    setIsEditing(!isEditing);
  };

  const handleCancel = () => {
    setEditedSql(sql);
    setIsEditing(false);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-tv-lg font-semibold text-madhive-pink">
          SQL Preview
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1 bg-madhive-purple-dark hover:bg-madhive-purple-medium text-madhive-chalk rounded transition-colors text-tv-sm"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          {editable && onSqlChange && (
            <>
              {isEditing && (
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 bg-madhive-purple-dark hover:bg-madhive-purple-medium text-madhive-chalk rounded transition-colors text-tv-sm"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleEditToggle}
                className="px-3 py-1 bg-madhive-pink text-madhive-purple-deepest rounded hover:bg-madhive-pink/80 transition-colors text-tv-sm font-medium"
              >
                {isEditing ? 'Save' : 'Edit SQL'}
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <textarea
          value={editedSql}
          onChange={(e) => setEditedSql(e.target.value)}
          className="w-full h-64 px-3 py-2 bg-madhive-purple-deepest border border-madhive-purple-medium rounded text-madhive-chalk font-mono text-tv-sm focus:outline-none focus:ring-2 focus:ring-madhive-pink resize-y"
          spellCheck={false}
        />
      ) : (
        <div className="bg-madhive-purple-deepest border border-madhive-purple-medium rounded p-4 overflow-x-auto">
          <pre className="text-tv-sm font-mono text-madhive-chalk whitespace-pre-wrap">
            {sql}
          </pre>
        </div>
      )}

      {!isEditing && (
        <div className="mt-3 text-tv-xs text-madhive-chalk/60">
          This SQL is auto-generated from your visual selections. You can edit it
          manually if needed.
        </div>
      )}
    </Card>
  );
}
