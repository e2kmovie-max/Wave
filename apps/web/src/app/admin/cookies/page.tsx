import { connectMongo, listCookieAccounts } from "@wave/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CookiesForm } from "./cookies-form";

export const dynamic = "force-dynamic";

export default async function AdminCookiesPage() {
  await connectMongo();
  const cookies = await listCookieAccounts();
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Google cookie pool</CardTitle>
          <CardDescription>
            Paste a Netscape <code>cookies.txt</code> dump or a JSON array of CDP cookies.
            The pool is rotated LRU per stream; disabling a record skips it without
            losing the payload. Plaintext only flows out of the database when the master
            forwards it to an instance in a request body — instances never persist it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CookiesForm initial={cookies} />
        </CardContent>
      </Card>
    </div>
  );
}
