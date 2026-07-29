'use client';

import { disconnectClientAction } from './actions';
import { Button } from '@/components/ui/button';

export function DisconnectButton({ clientId, name }: { clientId: string; name: string }) {
  return (
    <form
      action={disconnectClientAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Disconnect “${name}”? Its tokens stop working immediately; the app can reconnect by authorizing again.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="clientId" value={clientId} />
      <Button variant="ghost" size="sm" type="submit" className="text-destructive">
        Disconnect
      </Button>
    </form>
  );
}
