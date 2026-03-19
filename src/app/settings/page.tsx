"use client";

import { useState, useEffect, useRef } from "react";
import { Settings, CheckCircle2, XCircle, Loader2, ExternalLink, Sparkles, AlertCircle, Camera, Eye, Upload, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { vexaAPI } from "@/lib/api";
import { AdminGuard } from "@/components/admin/admin-guard";
import type { RecordingConfig } from "@/types/vexa";

interface AIConfig {
  enabled: boolean;
  provider: string | null;
  model: string | null;
  hasApiKey?: boolean;
  hasBaseUrl?: boolean;
}

interface RuntimeConfig {
  wsUrl: string;
  apiUrl: string;
}

// [LOCAL-FORK] Pre-generated avatar presets
const AVATAR_PRESETS = [
  { name: "Robot (Purple)", file: "/avatars/robot-purple.png" },
  { name: "Robot (Teal)", file: "/avatars/robot-teal.png" },
  { name: "Owl", file: "/avatars/owl-orange.png" },
  { name: "AI Silhouette", file: "/avatars/silhouette-gold.png" },
  { name: "Microphone", file: "/avatars/mic-green.png" },
  { name: "Brain", file: "/avatars/brain-cyan.png" },
];

function SettingsContent() {
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [aiConfig, setAIConfig] = useState<AIConfig | null>(null);
  const [isLoadingAIConfig, setIsLoadingAIConfig] = useState(true);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);

  // [LOCAL-FORK] Avatar state
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // [LOCAL-FORK] Vision snapshot state
  const [visionConfig, setVisionConfig] = useState<RecordingConfig | null>(null);
  const [isLoadingVisionConfig, setIsLoadingVisionConfig] = useState(true);
  const [isSavingVision, setIsSavingVision] = useState(false);
  const [visionEnabled, setVisionEnabled] = useState(false);
  const [visionInterval, setVisionInterval] = useState(30);
  const [visionModel, setVisionModel] = useState("qwen3-vl:8b");

  // Fetch configurations on mount
  useEffect(() => {
    async function fetchConfigs() {
      // Fetch runtime config (WebSocket URL)
      try {
        const configResponse = await fetch("/api/config");
        const config = await configResponse.json();
        setRuntimeConfig(config);
      } catch (error) {
        console.error("Failed to fetch runtime config:", error);
      }

      // Fetch AI config
      try {
        const response = await fetch("/api/ai/config");
        const config = await response.json();
        setAIConfig(config);
      } catch (error) {
        console.error("Failed to fetch AI config:", error);
        setAIConfig({ enabled: false, provider: null, model: null });
      } finally {
        setIsLoadingAIConfig(false);
      }

      // [LOCAL-FORK] Fetch avatar preview via proxy (MinIO URLs are internal-only)
      try {
        const avatarData = await vexaAPI.getAvatar();
        if (avatarData.avatar_url) {
          setCurrentAvatar("/api/avatar/image");
        }
      } catch {
        // Avatar endpoint may not exist yet
      }

      // [LOCAL-FORK] Fetch vision/recording config
      try {
        const rc = await vexaAPI.getRecordingConfig();
        setVisionConfig(rc);
        setVisionEnabled(rc.vision_snapshots_enabled ?? false);
        setVisionInterval(Math.round((rc.vision_snapshot_interval_ms ?? 30000) / 1000));
        setVisionModel(rc.vision_model ?? "qwen3-vl:8b");
      } catch {
        // Recording config may not exist yet
      } finally {
        setIsLoadingVisionConfig(false);
      }
    }
    fetchConfigs();
  }, []);

  // [LOCAL-FORK] Avatar handlers
  const handleAvatarPresetSelect = async (presetFile: string) => {
    setIsUploadingAvatar(true);
    try {
      const fullUrl = `${window.location.origin}${presetFile}`;
      await vexaAPI.uploadAvatarFromUrl(fullUrl);
      // Use the local preset path for preview (MinIO URL won't resolve in browser)
      setCurrentAvatar(presetFile);
      toast.success("Avatar updated");
    } catch (error) {
      toast.error("Failed to set avatar", { description: (error as Error).message });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large", { description: "Maximum size is 2MB" });
      return;
    }
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Invalid format", { description: "Only PNG and JPG are supported" });
      return;
    }
    setIsUploadingAvatar(true);
    try {
      await vexaAPI.uploadAvatar(file);
      // Create a local blob URL for preview (MinIO URL won't resolve in browser)
      setCurrentAvatar(URL.createObjectURL(file));
      toast.success("Avatar uploaded");
    } catch (error) {
      toast.error("Failed to upload avatar", { description: (error as Error).message });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarDelete = async () => {
    try {
      await vexaAPI.deleteAvatar();
      setCurrentAvatar(null);
      toast.success("Avatar reset to default");
    } catch (error) {
      toast.error("Failed to reset avatar", { description: (error as Error).message });
    }
  };

  // [LOCAL-FORK] Vision config save
  const handleSaveVisionConfig = async () => {
    setIsSavingVision(true);
    try {
      const updated = await vexaAPI.updateRecordingConfig({
        vision_snapshots_enabled: visionEnabled,
        vision_snapshot_interval_ms: visionInterval * 1000,
        vision_model: visionModel,
      });
      setVisionConfig(updated);
      toast.success("Vision settings saved");
    } catch (error) {
      toast.error("Failed to save vision settings", { description: (error as Error).message });
    } finally {
      setIsSavingVision(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus("unknown");
    setConnectionError(null);

    try {
      const result = await vexaAPI.testConnection();
      if (result.success) {
        setConnectionStatus("connected");
        toast.success("Connection successful", {
          description: "Successfully connected to Vexa API",
        });
      } else {
        setConnectionStatus("error");
        setConnectionError(result.error || "Unknown error");
        toast.error("Connection failed", {
          description: result.error,
        });
      }
    } catch (error) {
      setConnectionStatus("error");
      setConnectionError((error as Error).message);
      toast.error("Connection failed", {
        description: (error as Error).message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your Vexa Dashboard connection
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Vexa API Configuration
            </CardTitle>
            <CardDescription>
              Configure the connection to your Vexa instance. These settings are managed via environment variables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* API URL */}
            <div className="space-y-2">
              <Label htmlFor="apiUrl">API URL</Label>
              <Input
                id="apiUrl"
                value={runtimeConfig?.apiUrl || "Loading..."}
                disabled
                className="font-mono bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Set via <code className="bg-muted px-1 rounded">VEXA_API_URL</code> environment variable
              </p>
            </div>

            {/* WebSocket URL */}
            <div className="space-y-2">
              <Label htmlFor="wsUrl">WebSocket URL</Label>
              <Input
                id="wsUrl"
                value={runtimeConfig?.wsUrl || "Loading..."}
                disabled
                className="font-mono bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Auto-derived from <code className="bg-muted px-1 rounded">VEXA_API_URL</code>
              </p>
            </div>

            {/* Admin API Key Status */}
            <div className="space-y-2">
              <Label>Admin API Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  value="••••••••••••••••••••••••••••••••"
                  disabled
                  className="font-mono bg-muted"
                />
                <Badge variant="secondary">Configured</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Set via <code className="bg-muted px-1 rounded">VEXA_ADMIN_API_KEY</code> environment variable
              </p>
            </div>

            <Separator />

            {/* Test Connection */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">Connection Status</p>
                <div className="flex items-center gap-2">
                  {connectionStatus === "connected" && (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600">Connected</span>
                    </>
                  )}
                  {connectionStatus === "error" && (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600">
                        {connectionError || "Connection failed"}
                      </span>
                    </>
                  )}
                  {connectionStatus === "unknown" && (
                    <span className="text-sm text-muted-foreground">Not tested</span>
                  )}
                </div>
              </div>
              <Button onClick={handleTestConnection} disabled={isTesting}>
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AI Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Assistant Configuration
            </CardTitle>
            <CardDescription>
              AI settings for meeting transcript analysis. Configure via environment variables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoadingAIConfig ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking AI configuration...</span>
              </div>
            ) : aiConfig?.enabled ? (
              <>
                {/* Status */}
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-green-600">AI Assistant Enabled</span>
                </div>

                {/* Provider */}
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Input
                    value={aiConfig.provider || "Unknown"}
                    disabled
                    className="font-mono bg-muted capitalize"
                  />
                </div>

                {/* Model */}
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input
                    value={aiConfig.model || "Unknown"}
                    disabled
                    className="font-mono bg-muted"
                  />
                </div>

                {/* API Key Status */}
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value="••••••••••••••••••••••••••••••••"
                      disabled
                      className="font-mono bg-muted"
                    />
                    <Badge variant={aiConfig.hasApiKey ? "secondary" : "destructive"}>
                      {aiConfig.hasApiKey ? "Configured" : "Missing"}
                    </Badge>
                  </div>
                </div>

                {/* Base URL (if set) */}
                {aiConfig.hasBaseUrl && (
                  <div className="space-y-2">
                    <Label>Custom Base URL</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value="Custom endpoint configured"
                        disabled
                        className="bg-muted"
                      />
                      <Badge variant="secondary">Set</Badge>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <AlertCircle className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">AI Not Configured</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Set <code className="bg-muted px-1 rounded">AI_MODEL</code> and{" "}
                  <code className="bg-muted px-1 rounded">AI_API_KEY</code> environment variables to enable AI features.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* [LOCAL-FORK] Bot Avatar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Bot Avatar
            </CardTitle>
            <CardDescription>
              Choose an avatar for the bot&apos;s camera feed in meetings. Select a preset or upload your own.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current avatar */}
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full overflow-hidden bg-muted border-2 border-border flex items-center justify-center">
                {currentAvatar ? (
                  <img src={currentAvatar} alt="Current avatar" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <p className="font-medium">{currentAvatar ? "Custom Avatar" : "Default (Vexa Logo)"}</p>
                <p className="text-xs text-muted-foreground">Applied automatically to all meetings</p>
                {currentAvatar && (
                  <Button variant="ghost" size="sm" onClick={handleAvatarDelete} className="text-destructive h-7 px-2">
                    <Trash2 className="h-3 w-3 mr-1" /> Reset
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {/* Preset grid */}
            <div className="space-y-2">
              <Label>Presets</Label>
              <div className="grid grid-cols-3 gap-3">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.file}
                    onClick={() => handleAvatarPresetSelect(preset.file)}
                    disabled={isUploadingAvatar}
                    className="group relative rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors aspect-square"
                  >
                    <img src={preset.file} alt={preset.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1">
                      <span className="text-[10px] text-white">{preset.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Upload custom */}
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" /> Upload Custom</>
                )}
              </Button>
              <span className="text-xs text-muted-foreground">PNG or JPG, max 2MB</span>
            </div>
          </CardContent>
        </Card>

        {/* [LOCAL-FORK] Vision Snapshots */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Vision Snapshots
            </CardTitle>
            <CardDescription>
              Periodically capture screenshots during meetings and analyze them with a local vision LLM.
              Descriptions appear inline in the transcript.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoadingVisionConfig ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading configuration...</span>
              </div>
            ) : (
              <>
                {/* Enable toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Enable Vision Snapshots</Label>
                    <p className="text-xs text-muted-foreground">Take periodic screenshots and describe them with AI</p>
                  </div>
                  <Button
                    variant={visionEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVisionEnabled(!visionEnabled)}
                  >
                    {visionEnabled ? "Enabled" : "Disabled"}
                  </Button>
                </div>

                {visionEnabled && (
                  <>
                    <Separator />

                    {/* Interval */}
                    <div className="space-y-2">
                      <Label htmlFor="visionInterval">Snapshot Interval (seconds)</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          id="visionInterval"
                          min={10}
                          max={120}
                          step={5}
                          value={visionInterval}
                          onChange={(e) => setVisionInterval(Number(e.target.value))}
                          className="flex-1"
                        />
                        <span className="text-sm font-mono w-12 text-right">{visionInterval}s</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        How often to capture and analyze the screen (10–120 seconds)
                      </p>
                    </div>

                    {/* Vision model */}
                    <div className="space-y-2">
                      <Label htmlFor="visionModel">Vision Model (Ollama)</Label>
                      <Input
                        id="visionModel"
                        value={visionModel}
                        onChange={(e) => setVisionModel(e.target.value)}
                        placeholder="qwen3-vl:8b"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        Ollama model with vision capabilities (e.g. qwen3-vl:8b, qwen3-vl:32b, llava:13b)
                      </p>
                    </div>
                  </>
                )}

                {/* Save button */}
                <Button onClick={handleSaveVisionConfig} disabled={isSavingVision}>
                  {isSavingVision ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    "Save Vision Settings"
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Environment Variables */}
        <Card>
          <CardHeader>
            <CardTitle>Environment Variables</CardTitle>
            <CardDescription>
              To configure the dashboard, create a <code className="bg-muted px-1 rounded">.env.local</code> file with these variables
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`# Vexa API Configuration (required)
VEXA_API_URL=http://localhost:18056
VEXA_ADMIN_API_KEY=your_admin_api_key_here

# AI Assistant Configuration (optional)
# Format: provider/model
AI_MODEL=openai/gpt-4o
AI_API_KEY=your_ai_api_key_here`}
            </pre>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Vexa Dashboard is an open source web interface for Vexa, the self-hosted meeting transcription API.
              </p>
              <div className="flex gap-4">
                <a
                  href="https://github.com/Vexa-ai/vexa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Vexa GitHub
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href="https://vexa.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Vexa Website
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AdminGuard>
      <SettingsContent />
    </AdminGuard>
  );
}
