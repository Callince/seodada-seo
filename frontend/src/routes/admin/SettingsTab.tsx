import { useEffect, useState } from "react";

import { apiErrorMessage } from "@/api/client";
import { useUpdateSettings, useWebsiteSettings, type WebsiteSettings } from "@/api/hooks/useAdmin";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/store/toast";
import { Field } from "@/routes/admin/ui";

export function SettingsTab() {
  const { data } = useWebsiteSettings();
  const update = useUpdateSettings();
  const [form, setForm] = useState<WebsiteSettings | null>(null);
  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);
  if (!form) return <Skeleton className="h-64 w-full" />;
  const set = (k: keyof WebsiteSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });
  return (
    <Card>
      <CardHeader><CardTitle>Website settings</CardTitle></CardHeader>
      <CardBody>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(form, { onSuccess: () => toast.success("Settings saved"), onError: (er) => toast.error(apiErrorMessage(er)) });
          }}
        >
          <Field label="Company name"><Input value={form.company_name} onChange={set("company_name")} /></Field>
          <Field label="Support email"><Input value={form.support_email} onChange={set("support_email")} /></Field>
          <Field label="Tagline"><Input value={form.tagline} onChange={set("tagline")} /></Field>
          <Field label="Logo URL"><Input value={form.logo_url} onChange={set("logo_url")} /></Field>
          <Field label="Favicon URL"><Input value={form.favicon_url} onChange={set("favicon_url")} /></Field>
          <Field label="Facebook URL"><Input value={form.facebook_url} onChange={set("facebook_url")} /></Field>
          <Field label="LinkedIn URL"><Input value={form.linkedin_url} onChange={set("linkedin_url")} /></Field>
          <Field label="Instagram URL"><Input value={form.instagram_url} onChange={set("instagram_url")} /></Field>
          <Field label="YouTube URL"><Input value={form.youtube_url} onChange={set("youtube_url")} /></Field>
          <div className="sm:col-span-2">
            <Button type="submit" loading={update.isPending}>
              Save settings
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
