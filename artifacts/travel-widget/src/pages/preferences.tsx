import { useEffect } from "react";
import { Layout } from "@/components/layout";
import {
  useGetPreferences,
  useUpsertPreferences,
  getGetPreferencesQueryKey,
  getGetTravelSummaryQueryKey,
} from "@workspace/api-client-react";
import { useForm, Controller } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { TRAVEL_STYLE_GROUPS } from "@/lib/travel-styles";

// ---------------------------------------------------------------------------
// Budget & Value option lists
// ---------------------------------------------------------------------------
const VALUE_PHILOSOPHIES: Array<{ id: string; label: string; description: string }> = [
  { id: "value_hunter", label: "Value Hunter", description: "Best possible experience for the price" },
  { id: "selective_splurger", label: "Selective Splurger", description: "Budget-conscious but will spend on what matters" },
  { id: "luxury_on_a_budget", label: "Luxury on a Budget", description: "Want premium feel without premium price tags" },
  { id: "considered_spender", label: "Considered Spender", description: "Quality over quantity, fewer but better trips" },
  { id: "special_occasion", label: "Special Occasion", description: "Save up and go all out for milestone trips" },
  { id: "no_budget", label: "No Budget", description: "Price is not a consideration" },
];

const WORTH_SPLURGING_OPTIONS = [
  { id: "the_room", label: "The Room" },
  { id: "the_food", label: "The Food" },
  { id: "the_location", label: "The Location" },
  { id: "the_pool_spa", label: "The Pool & Spa" },
  { id: "the_experience", label: "The Experience" },
  { id: "the_service", label: "The Service" },
  { id: "the_views", label: "The Views" },
  { id: "the_activities", label: "The Activities" },
];

const HAPPY_TO_SAVE_OPTIONS = [
  { id: "room_size", label: "Room Size" },
  { id: "breakfast_included", label: "Breakfast Included" },
  { id: "minibar", label: "Minibar" },
  { id: "gym_access", label: "Gym Access" },
  { id: "airport_transfer", label: "Airport Transfer" },
  { id: "parking", label: "Parking" },
];

const BUDGET_MIN = 50;
const BUDGET_MAX = 2000;

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------
const formSchema = z.object({
  seatPreference: z.string().optional(),
  mealPreference: z.string().optional(),
  frequentFlyerNumbers: z.string().optional(),
  passportNotes: z.string().optional(),
  accessibilityNeeds: z.string().optional(),
  hotelPreferences: z.string().optional(),
  travelInsuranceNotes: z.string().optional(),
  additionalNotes: z.string().optional(),
  travelStyles: z.array(z.string()).optional(),
  budgetPerNightMin: z.number().nullable().optional(),
  budgetPerNightMax: z.number().nullable().optional(),
  budgetFlexibility: z.string().optional(),
  valuePhilosophy: z.string().nullable().optional(),
  worthSplurgingOn: z.array(z.string()).optional(),
  happyToSaveOn: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof formSchema>;

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <span className="eyebrow">{label}</span>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Underline-toggle button — same visual treatment as travel styles
// ---------------------------------------------------------------------------
function ToggleButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: selected ? "'Playfair Display', serif" : "'Raleway', sans-serif",
        fontStyle: selected ? "italic" : "normal",
        fontWeight: 400,
        fontSize: "15px",
        color: selected ? "#6B2737" : "#5C5248",
        background: "none",
        border: "none",
        borderBottom: selected ? "2px solid #6B2737" : "2px solid transparent",
        paddingBottom: "4px",
        cursor: "pointer",
        transition: "color 0.15s, border-color 0.15s",
        lineHeight: 2,
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Dual-handle budget slider
// ---------------------------------------------------------------------------
function DualRangeSlider({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: [number, number];
  onChange: (next: [number, number]) => void;
}) {
  const [lo, hi] = value;
  const loPct = ((lo - min) / (max - min)) * 100;
  const hiPct = ((hi - min) / (max - min)) * 100;

  const handleLo = (v: number) => {
    const safe = Math.min(v, hi - 50);
    onChange([Math.max(min, safe), hi]);
  };
  const handleHi = (v: number) => {
    const safe = Math.max(v, lo + 50);
    onChange([lo, Math.min(max, safe)]);
  };

  return (
    <div style={{ position: "relative", height: "44px", marginTop: "8px" }}>
      {/* Track */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "20px",
          height: "2px",
          background: "#E5E0D8",
        }}
      />
      {/* Selected fill */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          height: "2px",
          left: `${loPct}%`,
          right: `${100 - hiPct}%`,
          background: "#6B2737",
        }}
      />
      {/* Two stacked inputs */}
      <input
        type="range"
        min={min}
        max={max}
        step={50}
        value={lo}
        onChange={(e) => handleLo(Number(e.target.value))}
        className="dual-range"
        style={{ position: "absolute", left: 0, right: 0, top: 0, width: "100%", pointerEvents: "auto", zIndex: 2 }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={50}
        value={hi}
        onChange={(e) => handleHi(Number(e.target.value))}
        className="dual-range"
        style={{ position: "absolute", left: 0, right: 0, top: 0, width: "100%", pointerEvents: "auto", zIndex: 3 }}
      />
      <style>{`
        .dual-range { -webkit-appearance: none; appearance: none; background: transparent; height: 44px; outline: none; }
        .dual-range::-webkit-slider-runnable-track { background: transparent; height: 44px; }
        .dual-range::-moz-range-track { background: transparent; height: 44px; }
        .dual-range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 18px; height: 18px; border-radius: 50%;
          background: #FAFAF8; border: 2px solid #6B2737;
          cursor: pointer; margin-top: 12px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.12);
          pointer-events: auto;
        }
        .dual-range::-moz-range-thumb {
          width: 18px; height: 18px; border-radius: 50%;
          background: #FAFAF8; border: 2px solid #6B2737;
          cursor: pointer; pointer-events: auto;
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function PreferencesPage() {
  const { data: preferences, isLoading } = useGetPreferences();
  const upsertPreferences = useUpsertPreferences();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      seatPreference: "", mealPreference: "", frequentFlyerNumbers: "",
      passportNotes: "", accessibilityNeeds: "", hotelPreferences: "",
      travelInsuranceNotes: "", additionalNotes: "", travelStyles: [],
      budgetPerNightMin: 200, budgetPerNightMax: 600,
      budgetFlexibility: "moderate", valuePhilosophy: null,
      worthSplurgingOn: [], happyToSaveOn: [],
    },
  });

  useEffect(() => {
    if (preferences) {
      form.reset({
        seatPreference: preferences.seatPreference || "",
        mealPreference: preferences.mealPreference || "",
        frequentFlyerNumbers: preferences.frequentFlyerNumbers || "",
        passportNotes: preferences.passportNotes || "",
        accessibilityNeeds: preferences.accessibilityNeeds || "",
        hotelPreferences: preferences.hotelPreferences || "",
        travelInsuranceNotes: preferences.travelInsuranceNotes || "",
        additionalNotes: preferences.additionalNotes || "",
        travelStyles: preferences.travelStyles || [],
        budgetPerNightMin: preferences.budgetPerNightMin ?? 200,
        budgetPerNightMax: preferences.budgetPerNightMax ?? 600,
        budgetFlexibility: preferences.budgetFlexibility || "moderate",
        valuePhilosophy: preferences.valuePhilosophy ?? null,
        worthSplurgingOn: preferences.worthSplurgingOn || [],
        happyToSaveOn: preferences.happyToSaveOn || [],
      });
    }
  }, [preferences, form]);

  const onSubmit = (data: FormValues) => {
    upsertPreferences.mutate(
      { data },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetPreferencesQueryKey(), updated);
          queryClient.invalidateQueries({ queryKey: getGetTravelSummaryQueryKey() });
          toast({ title: "Preferences saved" });
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  };

  const formatBudget = (v: number) => (v >= BUDGET_MAX ? `$${BUDGET_MAX}+` : `$${v}`);

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>

        {/* Header */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px" }}>
            <div>
              <h1 className="font-playfair" style={{ fontWeight: 700, fontSize: "48px", color: "#1C1C1C", letterSpacing: "-0.01em" }}>
                Travel Preferences
              </h1>
              <p className="font-playfair" style={{ fontStyle: "italic", fontSize: "17px", color: "#5C5248", marginTop: "6px" }}>
                Save once, auto-fill everywhere.
              </p>
            </div>
            <button
              onClick={form.handleSubmit(onSubmit)}
              disabled={upsertPreferences.isPending}
              className="btn-wine"
              style={{ height: "48px", width: "160px", flexShrink: 0 }}
            >
              {upsertPreferences.isPending ? "Saving…" : "Save"}
            </button>
          </div>
          <span className="section-rule" style={{ marginTop: "24px", display: "block" }} />
        </div>

        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <Skeleton style={{ height: "200px", borderRadius: "2px" }} />
            <Skeleton style={{ height: "300px", borderRadius: "2px" }} />
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "48px" }}>

            {/* Travel Style */}
            <section>
              <p className="eyebrow" style={{ marginBottom: "20px" }}>Travel Style</p>
              <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: "14px", color: "#5C5248", marginBottom: "28px", lineHeight: 1.7 }}>
                Select all that describe how you like to travel.
              </p>
              <Controller
                control={form.control}
                name="travelStyles"
                render={({ field }) => {
                  const selected = field.value || [];
                  const toggle = (id: string) =>
                    field.onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "36px" }}>
                      {TRAVEL_STYLE_GROUPS.map(group => (
                        <div key={group.label}>
                          <p className="eyebrow" style={{ color: "#5C5248", marginBottom: "16px", letterSpacing: "0.16em" }}>
                            {group.label}
                          </p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 28px" }}>
                            {group.styles.map(style => {
                              const isSelected = selected.includes(style.id);
                              return (
                                <button
                                  key={`${group.label}-${style.id}`}
                                  type="button"
                                  onClick={() => toggle(style.id)}
                                  style={{
                                    fontFamily: "'Raleway', sans-serif",
                                    fontWeight: 400,
                                    fontSize: "15px",
                                    color: isSelected ? "#6B2737" : "#5C5248",
                                    background: "none",
                                    border: "none",
                                    borderBottom: isSelected ? "2px solid #6B2737" : "2px solid transparent",
                                    paddingBottom: "4px",
                                    cursor: "pointer",
                                    transition: "color 0.15s, border-color 0.15s",
                                    lineHeight: 2,
                                  }}
                                >
                                  {style.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
            </section>

            <span className="section-rule" />

            {/* Budget & Value */}
            <section>
              <p className="eyebrow" style={{ marginBottom: "10px", color: "#A07840" }}>Budget &amp; Value</p>
              <p
                className="font-playfair"
                style={{
                  fontStyle: "italic",
                  fontSize: "18px",
                  color: "#5C5248",
                  marginBottom: "32px",
                  lineHeight: 1.4,
                }}
              >
                How do you think about value when you travel?
              </p>

              {/* Nightly budget slider */}
              <div style={{ marginBottom: "44px" }}>
                <p className="eyebrow" style={{ marginBottom: "8px", color: "#5C5248", letterSpacing: "0.16em" }}>
                  Typical Nightly Budget (USD)
                </p>
                <Controller
                  control={form.control}
                  name="budgetPerNightMin"
                  render={({ field: minField }) => (
                    <Controller
                      control={form.control}
                      name="budgetPerNightMax"
                      render={({ field: maxField }) => {
                        const lo = minField.value ?? 200;
                        const hi = maxField.value ?? 600;
                        return (
                          <>
                            <p
                              className="font-playfair"
                              style={{
                                fontStyle: "italic",
                                fontSize: "22px",
                                color: "#1C1C1C",
                                marginTop: "6px",
                                marginBottom: "4px",
                              }}
                            >
                              {formatBudget(lo)} <span style={{ color: "#94A39B" }}>—</span> {formatBudget(hi)}
                              <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "13px", color: "#5C5248", fontStyle: "normal", marginLeft: "10px" }}>
                                per night
                              </span>
                            </p>
                            <DualRangeSlider
                              min={BUDGET_MIN}
                              max={BUDGET_MAX}
                              value={[lo, hi]}
                              onChange={([newLo, newHi]) => {
                                minField.onChange(newLo);
                                maxField.onChange(newHi);
                              }}
                            />
                            <p
                              style={{
                                fontFamily: "'Raleway', sans-serif",
                                fontStyle: "italic",
                                fontSize: "12px",
                                color: "#94A39B",
                                marginTop: "6px",
                                lineHeight: 1.5,
                              }}
                            >
                              Used to filter review match scores — properties outside your range score lower.
                            </p>
                          </>
                        );
                      }}
                    />
                  )}
                />
              </div>

              {/* Value philosophy */}
              <div style={{ marginBottom: "44px" }}>
                <p className="eyebrow" style={{ marginBottom: "16px", color: "#5C5248", letterSpacing: "0.16em" }}>
                  Value Philosophy
                </p>
                <Controller
                  control={form.control}
                  name="valuePhilosophy"
                  render={({ field }) => (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {VALUE_PHILOSOPHIES.map((opt) => {
                        const isSelected = field.value === opt.id;
                        return (
                          <div key={opt.id} style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                            <ToggleButton
                              selected={isSelected}
                              onClick={() => field.onChange(isSelected ? null : opt.id)}
                            >
                              {opt.label}
                            </ToggleButton>
                            <span
                              style={{
                                fontFamily: "'Raleway', sans-serif",
                                fontWeight: 300,
                                fontSize: "13px",
                                color: "#94A39B",
                                fontStyle: "italic",
                              }}
                            >
                              — {opt.description}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                />
              </div>

              {/* Worth Splurging On */}
              <div style={{ marginBottom: "32px" }}>
                <p className="eyebrow" style={{ marginBottom: "16px", color: "#5C5248", letterSpacing: "0.16em" }}>
                  Worth Splurging On
                </p>
                <Controller
                  control={form.control}
                  name="worthSplurgingOn"
                  render={({ field }) => {
                    const selected = field.value || [];
                    const toggle = (id: string) =>
                      field.onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
                    return (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 28px" }}>
                        {WORTH_SPLURGING_OPTIONS.map((opt) => (
                          <ToggleButton key={opt.id} selected={selected.includes(opt.id)} onClick={() => toggle(opt.id)}>
                            {opt.label}
                          </ToggleButton>
                        ))}
                      </div>
                    );
                  }}
                />
              </div>

              {/* Happy to Save On */}
              <div>
                <p className="eyebrow" style={{ marginBottom: "16px", color: "#5C5248", letterSpacing: "0.16em" }}>
                  Happy to Save On
                </p>
                <Controller
                  control={form.control}
                  name="happyToSaveOn"
                  render={({ field }) => {
                    const selected = field.value || [];
                    const toggle = (id: string) =>
                      field.onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
                    return (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 28px" }}>
                        {HAPPY_TO_SAVE_OPTIONS.map((opt) => (
                          <ToggleButton key={opt.id} selected={selected.includes(opt.id)} onClick={() => toggle(opt.id)}>
                            {opt.label}
                          </ToggleButton>
                        ))}
                      </div>
                    );
                  }}
                />
              </div>
            </section>

            <span className="section-rule" />

            {/* Flight + Docs grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px" }}>

              {/* Flight */}
              <section>
                <p className="eyebrow" style={{ marginBottom: "24px" }}>Flight Information</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  <FormField label="Seat preferences">
                    <input {...form.register("seatPreference")} className="input-underline" placeholder="Aisle for adults, window for kids" />
                  </FormField>
                  <FormField label="Meal preferences">
                    <input {...form.register("mealPreference")} className="input-underline" placeholder="1 Vegetarian, 2 Child meals" />
                  </FormField>
                  <FormField label="Frequent flyer numbers">
                    <textarea {...form.register("frequentFlyerNumbers")} className="input-underline" placeholder="Delta: 1234567890 (John)" rows={3} style={{ resize: "none" }} />
                  </FormField>
                </div>
              </section>

              {/* Important docs */}
              <section>
                <p className="eyebrow" style={{ marginBottom: "24px" }}>Important Details</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  <FormField label="Passport notes">
                    <input {...form.register("passportNotes")} className="input-underline" placeholder="Emma's expires Oct 2025" />
                  </FormField>
                  <FormField label="Accessibility needs">
                    <input {...form.register("accessibilityNeeds")} className="input-underline" placeholder="Stroller gate check required" />
                  </FormField>
                  <FormField label="Travel insurance">
                    <input {...form.register("travelInsuranceNotes")} className="input-underline" placeholder="Covered via Chase Sapphire" />
                  </FormField>
                </div>
              </section>
            </div>

            <span className="section-rule" />

            {/* Lodging + Notes */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px" }}>
              <section>
                <p className="eyebrow" style={{ marginBottom: "24px" }}>Hotel preferences</p>
                <textarea {...form.register("hotelPreferences")} className="input-underline" placeholder="Needs crib, high floor, away from elevator" rows={4} style={{ resize: "none" }} />
              </section>
              <section>
                <p className="eyebrow" style={{ marginBottom: "24px" }}>Additional notes</p>
                <textarea {...form.register("additionalNotes")} className="input-underline" placeholder="Anything else to remember when booking…" rows={4} style={{ resize: "none" }} />
              </section>
            </div>

            {/* Bottom save */}
            <div style={{ paddingTop: "8px" }}>
              <button
                type="submit"
                disabled={upsertPreferences.isPending}
                className="btn-wine"
                style={{ height: "48px", width: "100%" }}
              >
                {upsertPreferences.isPending ? "Saving…" : "Save preferences"}
              </button>
            </div>

          </form>
        )}
      </div>
    </Layout>
  );
}
