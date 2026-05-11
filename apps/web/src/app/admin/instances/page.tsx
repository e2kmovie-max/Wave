import { connectMongo, listInstances } from "@wave/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InstancesForm } from "./instances-form";

export const dynamic = "force-dynamic";

export default async function AdminInstancesPage() {
  await connectMongo();
  const instances = await listInstances();
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Streaming instances</CardTitle>
          <CardDescription>
            Worker nodes the master forwards stream/info requests to. Records added here are
            never touched by the <code>INSTANCES_JSON</code> env sync. Records loaded from env
            are flagged <code>managedByEnv</code> and can be toggled but not deleted from this UI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InstancesForm initial={instances} />
        </CardContent>
      </Card>
    </div>
  );
}
