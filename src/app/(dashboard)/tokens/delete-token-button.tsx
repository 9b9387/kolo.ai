'use client';

import { deletePatAction } from './actions';
import { Button } from '@/components/ui/button';

export function DeleteTokenButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deletePatAction}
      onSubmit={(event) => {
        if (!window.confirm(`Delete token “${name}” permanently? This cannot be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button variant="ghost" size="sm" type="submit" className="text-destructive">
        Delete
      </Button>
    </form>
  );
}
