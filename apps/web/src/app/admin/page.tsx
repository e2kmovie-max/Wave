import Link from "next/link";
import { Types } from "mongoose";
import {
  connectMongo,
  listCookieAccounts,
  listInstances,
} from "@wave/player";
import {
  listRequiredChannels,
  Room,
} from "@wave/social";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await connectMongo();
  const [channels, cookies, instances, roomCount] = await Promise.all([
    listRequiredChannels(),
    listCookieAccounts(),
    listInstances(),
    Room.countDocuments({ isClosed: false }),
  ]);
  // Touch Types to avoid an unused-import warning if Mongoose tree-shakes.
  void Types.ObjectId;

  const healthy = instances.filter((i) => i.enabled && i.isHealthy).length;
  const failing = instances.filter((i) => i.enabled && !i.isHealthy).length;
  const enabledChannels = channels.filter((c) => c.enabled).length;
  const liveCookies = cookies.filter((c) => !c.disabled).length;
  const autoDisabledCookies = cookies.filter((c) => c.autoDisabled).length;
  const totalRotations = cookies.reduce(
    (acc, c) => acc + (c.rotationCount ?? 0),
    0,
  );

  const tiles: Array<{
    title: string;
    href: string;
    value: string;
    description: string;
  }> = [
    {
      title: "Required channels",
      href: "/admin/channels",
      value: `${enabledChannels} / ${channels.length}`,
      description: "Enabled / total. Empty list ⇒ OP gate is disabled.",
    },
    {
      title: "Cookie pool",
      href: "/admin/cookies",
      value: `${liveCookies} / ${cookies.length}`,
      description:
        autoDisabledCookies > 0
          ? `Active / total. ${autoDisabledCookies} auto-disabled · ${totalRotations} rotations.`
          : `Active / total. ${totalRotations} rotations so far.`,
    },
    {
      title: "Streaming instances",
      href: "/admin/instances",
      value: `${healthy} / ${instances.length}`,
      description:
        failing > 0
          ? `Healthy & enabled / total. ${failing} currently failing.`
          : "Healthy & enabled / total.",
    },
    {
      title: "Open rooms",
      href: "/",
      value: String(roomCount),
      description: "Currently active watch rooms.",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {tiles.map((tile) => (
        <Link key={tile.title} href={tile.href} className="block focus:outline-none">
          <Card className="hover:border-white/20">
            <CardHeader>
              <CardTitle>{tile.title}</CardTitle>
              <CardDescription>{tile.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-bold tracking-tight">{tile.value}</CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
