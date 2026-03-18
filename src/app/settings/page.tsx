"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { FloatingParticles } from "@/components/floating-particles";
import {
  getAutoOffEnabled,
  setAutoOffEnabled,
} from "@/features/settings/lib/auto-off-setting";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    sound: true,
    visual: true,
    energy: false,
  });
  const [autoOffEnabled, setAutoOffEnabledState] = useState(true);

  useEffect(() => {
    setAutoOffEnabledState(getAutoOffEnabled());
  }, []);

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAutoOff = () => {
    setAutoOffEnabledState((prev) => {
      const next = !prev;
      setAutoOffEnabled(next);
      return next;
    });
  };

  return (
    <main className="relative min-h-svh w-full overflow-hidden bg-background">
      <FloatingParticles />

      <div className="relative z-20 flex flex-col min-h-svh items-center justify-center px-10">
        {/* Simple Back Link */}
        <Link
          href="/home"
          className="absolute top-10 left-10 group flex items-center gap-2 text-gold-dim transition-colors hover:text-gold-bright"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-xs uppercase tracking-widest">Back</span>
        </Link>

        <header className="mb-12 text-center">
          <SettingsIcon className="w-10 h-10 text-gold mx-auto mb-4 opacity-80" />
          <h1 className="text-2xl font-bold tracking-[0.3em] text-gold-bright uppercase">
            Settings
          </h1>
        </header>

        <div className="w-full max-w-md space-y-4">
          <SimpleToggle
            label="Auto OFF (5s)"
            active={autoOffEnabled}
            onClick={toggleAutoOff}
          />
          <SimpleToggle
            label="Sound Effects"
            active={settings.sound}
            onClick={() => toggleSetting("sound")}
          />
          <SimpleToggle
            label="Visual Magic"
            active={settings.visual}
            onClick={() => toggleSetting("visual")}
          />
          <SimpleToggle
            label="Energy Save"
            active={settings.energy}
            onClick={() => toggleSetting("energy")}
          />
        </div>
      </div>
    </main>
  );
}

function SimpleToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between p-5 rounded-xl border border-gold-dim/10 bg-stone/20 backdrop-blur-sm cursor-pointer hover:bg-stone/30 hover:border-gold-dim/30 transition-colors"
    >
      <span className="text-sm tracking-widest text-gold-dim uppercase">
        {label}
      </span>
      <div
        className={`w-10 h-5 rounded-full border border-gold/30 relative transition-colors ${
          active ? "bg-gold/20" : "bg-transparent"
        }`}
      >
        <div
          className={`absolute top-[3px] w-3 h-3 rounded-full bg-gold-bright transition-all ${
            active ? "right-1" : "left-1"
          }`}
        />
      </div>
    </button>
  );
}
