import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { type Draft, type Schedule } from "@/lib/model";
import { resolveLocalTime, localInput, defaultSchedule } from "@/lib/time";
export function ScheduleDialog({
  draft,
  schedule,
  open,
  onOpenChange,
}: {
  draft: Draft;
  schedule?: Schedule;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, planVersion } = useStore();
  const [value, setValue] = useState(
    schedule
      ? localInput(schedule.at, state.preferences.timezone)
      : defaultSchedule(state.preferences.timezone),
  );
  const [chosen, setChosen] = useState("");
  const matches = resolveLocalTime(value, state.preferences.timezone);
  const save = async () => {
    if (!matches.length) {
      toast.error(
        "Diese lokale Uhrzeit existiert nicht. Bitte Datum und Sommerzeitwechsel prüfen.",
      );
      return;
    }
    if (matches.length > 1 && !chosen) {
      toast.error(
        "Diese Uhrzeit kommt zweimal vor. Bitte eine konkrete Instanz wählen.",
      );
      return;
    }
    const at = chosen || matches[0];
    const ok = await planVersion(
      draft,
      at,
      state.preferences.timezone,
      value,
      schedule,
    );
    if (ok) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {schedule ? "Termin verschieben" : "Freigegebene Version planen"}
          </DialogTitle>
          <DialogDescription>
            {state.accounts.find(
              (a) => a.id === (schedule?.accountId ?? draft.accountId),
            )?.handle ?? "Account nicht verfügbar"}{" "}
            · {draft.title} · Version{" "}
            {schedule?.version ?? draft.versions.at(-1)?.number}. Die
            Terminierung ist eine separate Aktion nach der Inhaltsfreigabe.
          </DialogDescription>
        </DialogHeader>
        <label>
          <span className="field-label">Datum und Uhrzeit</span>
          <Input
            type="datetime-local"
            aria-label="Datum und Uhrzeit"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setChosen("");
            }}
          />
        </label>
        <p className="muted text-xs">
          Zeitzone: {state.preferences.timezone}. Profiländerungen verschieben
          bestehende Termine nicht.
        </p>
        {matches.length === 0 && value && (
          <p role="alert" className="text-destructive text-xs">
            Ungültiger oder nicht existierender Zeitpunkt.
          </p>
        )}
        {matches.length > 1 && (
          <label>
            <span className="field-label">
              Uhrzeit ist wegen Zeitumstellung mehrdeutig
            </span>
            <select
              className="native-select"
              value={chosen}
              onChange={(e) => setChosen(e.target.value)}
            >
              <option value="">Instanz wählen</option>
              {matches.map((t) => (
                <option key={t} value={t}>
                  {new Intl.DateTimeFormat("de-DE", {
                    timeZone: state.preferences.timezone,
                    timeZoneName: "shortOffset",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(t))}{" "}
                  · {t}
                </option>
              ))}
            </select>
          </label>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={save}>
            <CalendarDays size={15} />
            {schedule ? "Termin verschieben" : "Version planen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
