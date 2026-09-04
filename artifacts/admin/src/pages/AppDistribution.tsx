import { useEffect, useState } from "react";
import { Download, Loader2, PackageCheck, UploadCloud } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminFetch } from "@/hooks/useAdminFetch";
import { useToast } from "@/hooks/use-toast";

type ApkInfo = {
  available: boolean;
  fileName: string;
  size: number;
  updatedAt: string | null;
  downloadUrl: string | null;
};

export function AppDistribution() {
  const adminFetch = useAdminFetch();
  const { toast } = useToast();
  const [info, setInfo] = useState<ApkInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadInfo = () => fetch("/api/app/apk-info").then((response) => response.json()).then(setInfo);
  useEffect(() => { void loadInfo(); }, []);

  const publish = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const prepared = await adminFetch<{ uploadUrl: string; objectPath: string }>("/api/admin/app/apk-upload-url", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          size: file.size,
          contentType: file.type || "application/vnd.android.package-archive",
        }),
      });
      const uploaded = await fetch(prepared.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/vnd.android.package-archive" },
        body: file,
      });
      if (!uploaded.ok) throw new Error("APK upload failed");
      const published = await adminFetch<ApkInfo>("/api/admin/app/apk-publish", {
        method: "POST",
        body: JSON.stringify({ objectPath: prepared.objectPath, fileName: file.name, size: file.size }),
      });
      setInfo(published);
      setFile(null);
      toast({ title: "APK published", description: "The landing page download button is now live." });
    } catch (error) {
      toast({ variant: "destructive", title: "APK upload failed", description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><UploadCloud className="w-6 h-6 text-primary" /> App Distribution</h1>
        <p className="text-muted-foreground mt-1">Publish the Jazment Android APK without changing the admin system.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Landing page APK</CardTitle>
          <CardDescription>Only signed-in admins can replace this file. Visitors can only download it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {info?.available && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 flex items-center gap-3" data-testid="status-current-apk">
              <PackageCheck className="w-5 h-5 text-green-500" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-green-400 truncate">{info.fileName}</p>
                <p className="text-xs text-muted-foreground">{(info.size / 1024 / 1024).toFixed(1)} MB · Published {info.updatedAt ? new Date(info.updatedAt).toLocaleString() : "recently"}</p>
              </div>
              <a href="/api/app/apk" download data-testid="link-download-current-apk"><Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" /> Download</Button></a>
            </div>
          )}
          <input
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={uploading}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:font-semibold file:text-primary-foreground"
            data-testid="input-apk-file"
          />
          <Button onClick={publish} disabled={!file || uploading} data-testid="button-publish-apk">
            {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</> : <><UploadCloud className="w-4 h-4 mr-2" /> Publish APK</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}