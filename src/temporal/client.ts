import { Client, Connection } from '@temporalio/client';
import { env } from '../config/env.js';

let clientPromise: Promise<Client> | undefined;

export function connectionOptions() {
  return {
    address: env.TEMPORAL_ADDRESS,
    ...(env.TEMPORAL_API_KEY && { tls: true, apiKey: env.TEMPORAL_API_KEY }),
  };
}

/** Shared lazily-connected Temporal client, used by the API and by activities that start/signal workflows. */
export function getTemporalClient(): Promise<Client> {
  clientPromise ??= Connection.connect(connectionOptions()).then(
    (connection) => new Client({ connection, namespace: env.TEMPORAL_NAMESPACE }),
  );
  return clientPromise;
}
