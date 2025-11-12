import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function FacebookPageSettingsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-52 mb-4" />
      
      <div>
        <Skeleton className="h-9 w-64 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auto-Pipeline Assignment</CardTitle>
          <CardDescription>
            Automatically assign synced contacts to pipeline stages based on AI analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
          
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 mb-2" />
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-96" />
              </div>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-96" />
              </div>
            </div>
          </div>

          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}

