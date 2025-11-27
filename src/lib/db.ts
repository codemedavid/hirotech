import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  // Configure connection pool to handle high concurrency
  // Add connection_limit and pool_timeout to DATABASE_URL if not already present
  let databaseUrl = process.env.DATABASE_URL || '';
  
  // Parse URL to add/update connection pool parameters
  try {
    const url = new URL(databaseUrl);
    
    // Set connection pool parameters
    // connection_limit: Maximum number of connections in the pool (increase from default 5)
    // pool_timeout: Maximum time to wait for a connection (increase from default 10s)
    url.searchParams.set('connection_limit', '10');
    url.searchParams.set('pool_timeout', '20');
    url.searchParams.set('connect_timeout', '10');
    
    databaseUrl = url.toString();
  } catch (error) {
    // If URL parsing fails, append parameters directly
    const separator = databaseUrl.includes('?') ? '&' : '?';
    databaseUrl = `${databaseUrl}${separator}connection_limit=10&pool_timeout=20&connect_timeout=10`;
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
  var prismaConnectionPromise: undefined | Promise<void>;
}

const prismaClient = globalThis.prismaGlobal ?? prismaClientSingleton();

// Ensure Prisma is connected before use (critical for serverless environments)
let connectionPromise: Promise<void> | undefined;

async function ensurePrismaConnected() {
  if (!connectionPromise) {
    connectionPromise = prismaClient.$connect().catch((error) => {
      console.error('[Prisma] Connection error:', error);
      connectionPromise = undefined; // Reset on error
      throw error;
    });
  }
  return connectionPromise;
}

// Wrap Prisma client to ensure connection before operations
export const prisma = new Proxy(prismaClient, {
  get(target, prop) {
    // For methods that need connection, ensure it's connected first
    if (typeof prop === 'string' && !prop.startsWith('$') && typeof target[prop as keyof typeof target] === 'function') {
      return async (...args: unknown[]) => {
        await ensurePrismaConnected();
        const method = target[prop as keyof typeof target] as (...args: unknown[]) => unknown;
        return method.apply(target, args);
      };
    }
    // For $connect, $disconnect, etc., return directly
    return target[prop as keyof typeof target];
  },
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prismaClient;
}

