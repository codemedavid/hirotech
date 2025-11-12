import { cookies } from 'next/headers';

export default async function DebugSessionPage() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const simpleSession = cookieStore.get('simple-session');
  
  let sessionData = null;
  if (simpleSession) {
    try {
      sessionData = JSON.parse(simpleSession.value);
    } catch (e) {
      sessionData = { error: 'Failed to parse session' };
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Session Debug Page</h1>
      
      <div className="space-y-4">
        <div className="border p-4 rounded">
          <h2 className="font-bold mb-2">Simple Session Cookie:</h2>
          <p>Exists: {simpleSession ? '✅ YES' : '❌ NO'}</p>
          {simpleSession && (
            <div className="mt-2">
              <p>Size: {simpleSession.value.length} bytes</p>
              <pre className="bg-gray-100 p-2 mt-2 text-xs overflow-auto">
                {JSON.stringify(sessionData, null, 2)}
              </pre>
            </div>
          )}
        </div>
        
        <div className="border p-4 rounded">
          <h2 className="font-bold mb-2">All Cookies ({allCookies.length}):</h2>
          <ul className="space-y-1">
            {allCookies.map((cookie, i) => (
              <li key={i} className="text-sm">
                {cookie.name}: {cookie.value.length} bytes
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

