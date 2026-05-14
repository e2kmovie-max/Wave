import { connectMongo, listRequiredChannels } from "@wave/social";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelsForm } from "./channels-form";

export const dynamic = "force-dynamic";

export default async function AdminChannelsPage() {
  await connectMongo();
  const channels = await listRequiredChannels();

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Required channels</CardTitle>
          <CardDescription>
            Users must be subscribed to all enabled channels before they can create or join
            a watch room. Forward a message from the channel or paste its @username / -100…
            chat-id below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChannelsForm initial={channels} />
        </CardContent>
      </Card>
    </div>
  );
}
