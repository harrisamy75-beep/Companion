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

const TRAVEL_STYLE_GROUPS: { label: string; styles: { id: string; label: string }[] }[] = [
  {
    label: "LUXURY",
    styles: [
      { id: "luxury-family", label: "Luxury Family" },
      { id: "luxury-chill", label: "Luxury Chill" },
      { id: "luxury-adventure", label: "Luxury Adventure" },
      { id: "ultra-luxury", label: "Ultra Luxury" },
      { id: "luxury-wellness", label: "Luxury Wellness" },
      { id: "boutique-luxury", label: "Boutique Luxury" },
      { id: "safari-expedition", label: "Safari & Expedition" },
      { id: "superyacht-charter", label: "Superyacht & Charter" },
      { id: "private-villa", label: "Private Villa" },
      { id: "design-hotels", label: "Design Hotels" },
    ],
  },
  {
    label: "FAMILY",
    styles: [
      { id: "luxury-family", label: "Luxury Family" },
      { id: "active-family", label: "Active Family" },
      { id: "beach-family", label: "Beach Family" },
      { id: "disney-family", label: "Disney Family" },
      { id: "budget-family", label: "Budget Family" },
      { id: "multi-gen-travel", label: "Multi-Gen Travel" },
      { id: "baby-toddler", label: "Baby & Toddler" },
      { id: "teen-travel", label: "Teen Travel" },
      { id: "educational-travel", label: "Educational Travel" },
      { id: "summer-camp-style", label: "Summer Camp Style" },
    ],
  },
  {
    label: "FOOD & DRINK",
    styles: [
      { id: "foodie", label: "Foodie" },
      { id: "fine-dining", label: "Fine Dining" },
      { id: "local-authentic", label: "Local & Authentic" },
      { id: "street-food-explorer", label: "Street Food Explorer" },
      { id: "farm-to-table", label: "Farm to Table" },
      { id: "wine-country", label: "Wine Country" },
      { id: "culinary-classes", label: "Culinary Classes" },
      { id: "zero-waste-dining", label: "Zero Waste Dining" },
      { id: "vegetarian-vegan", label: "Vegetarian & Vegan" },
      { id: "omakase-chefs-table", label: "Omakase & Chef's Table" },
    ],
  },
  {
    label: "WELLNESS",
    styles: [
      { id: "spa-wellness", label: "Spa & Wellness" },
      { id: "yoga-retreat", label: "Yoga Retreat" },
      { id: "meditation-mindfulness", label: "Meditation & Mindfulness" },
      { id: "fitness-bootcamp", label: "Fitness & Bootcamp" },
      { id: "thermal-hot-springs", label: "Thermal & Hot Springs" },
      { id: "ayurveda", label: "Ayurveda" },
      { id: "digital-detox", label: "Digital Detox" },
      { id: "sleep-tourism", label: "Sleep Tourism" },
      { id: "mental-health-travel", label: "Mental Health Travel" },
      { id: "longevity-biohacking", label: "Longevity & Biohacking" },
    ],
  },
  {
    label: "ADVENTURE & OUTDOORS",
    styles: [
      { id: "hiking-trekking", label: "Hiking & Trekking" },
      { id: "water-sports", label: "Water Sports" },
      { id: "skiing-snow", label: "Skiing & Snow" },
      { id: "surf-travel", label: "Surf Travel" },
      { id: "diving-snorkeling", label: "Diving & Snorkeling" },
      { id: "cycling-tours", label: "Cycling Tours" },
      { id: "safari-wildlife", label: "Safari & Wildlife" },
      { id: "climbing-via-ferrata", label: "Climbing & Via Ferrata" },
      { id: "river-sea-kayaking", label: "River & Sea Kayaking" },
      { id: "fly-fishing", label: "Fly Fishing" },
    ],
  },
  {
    label: "CULTURE & SLOW TRAVEL",
    styles: [
      { id: "art-museum", label: "Art & Museum" },
      { id: "architecture", label: "Architecture" },
      { id: "heritage-history", label: "Heritage & History" },
      { id: "literary-travel", label: "Literary Travel" },
      { id: "language-immersion", label: "Language Immersion" },
      { id: "slow-travel", label: "Slow Travel" },
      { id: "village-life", label: "Village Life" },
      { id: "photography-journeys", label: "Photography Journeys" },
      { id: "spiritual-travel", label: "Spiritual Travel" },
      { id: "craft-artisan", label: "Craft & Artisan" },
    ],
  },
];

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
              <p className="font-playfair" style={{ fontStyle: "italic", fontSize: "17px", color: "#8C8279", marginTop: "6px" }}>
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
              <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: "14px", color: "#8C8279", marginBottom: "28px", lineHeight: 1.7 }}>
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
                          <p className="eyebrow" style={{ color: "#8C8279", marginBottom: "16px", letterSpacing: "0.16em" }}>
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
                                    color: isSelected ? "#6B2737" : "#8C8279",
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
