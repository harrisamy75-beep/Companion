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
