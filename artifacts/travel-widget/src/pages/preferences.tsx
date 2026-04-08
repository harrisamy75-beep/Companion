import { useEffect } from "react";
import { Layout } from "@/components/layout";
import { 
  useGetPreferences, 
  useUpsertPreferences,
  getGetPreferencesQueryKey,
  getGetTravelSummaryQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Save } from "lucide-react";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const formSchema = z.object({
  seatPreference: z.string().optional(),
  mealPreference: z.string().optional(),
  frequentFlyerNumbers: z.string().optional(),
  passportNotes: z.string().optional(),
  accessibilityNeeds: z.string().optional(),
  hotelPreferences: z.string().optional(),
  travelInsuranceNotes: z.string().optional(),
  additionalNotes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function PreferencesPage() {
  const { data: preferences, isLoading } = useGetPreferences();
  const upsertPreferences = useUpsertPreferences();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      seatPreference: "",
      mealPreference: "",
      frequentFlyerNumbers: "",
      passportNotes: "",
      accessibilityNeeds: "",
      hotelPreferences: "",
      travelInsuranceNotes: "",
      additionalNotes: "",
    }
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
      });
    }
  }, [preferences, form]);

  const onSubmit = (data: FormValues) => {
    upsertPreferences.mutate(
      { data },
      {
        onSuccess: (updatedPrefs) => {
          queryClient.setQueryData(getGetPreferencesQueryKey(), updatedPrefs);
          queryClient.invalidateQueries({ queryKey: getGetTravelSummaryQueryKey() });
          toast({ title: "Preferences saved successfully" });
        },
        onError: () => {
          toast({ title: "Failed to save preferences", variant: "destructive" });
        }
      }
    );
  };

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-serif text-foreground tracking-tight">Travel Preferences</h1>
            <p className="text-muted-foreground mt-2">Save all the tedious details here so you don't have to remember them when booking.</p>
          </div>
          <Button 
            onClick={form.handleSubmit(onSubmit)}
            disabled={upsertPreferences.isPending}
            className="w-full sm:w-auto"
          >
            <Save className="w-4 h-4 mr-2" />
            {upsertPreferences.isPending ? "Saving..." : "Save Preferences"}
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-[400px] rounded-xl" />
            <Skeleton className="h-[400px] rounded-xl" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Flight Info */}
                <Card className="border-none shadow-md">
                  <CardContent className="pt-6 space-y-4">
                    <h3 className="font-semibold text-lg text-primary border-b pb-2 mb-4">Flight Information</h3>
                    
                    <FormField control={form.control} name="seatPreference" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seat Preferences</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Aisle for adults, window for kids" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="mealPreference" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meal Preferences</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 1 Vegetarian, 2 Child meals" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="frequentFlyerNumbers" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequent Flyer Numbers</FormLabel>
                        <FormControl>
                          <Textarea placeholder="e.g. Delta: 1234567890 (John)" className="resize-y" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>

                {/* Important Docs & Needs */}
                <Card className="border-none shadow-md">
                  <CardContent className="pt-6 space-y-4">
                    <h3 className="font-semibold text-lg text-accent border-b pb-2 mb-4">Important Details</h3>
                    
                    <FormField control={form.control} name="passportNotes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Passport Notes</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Emma's expires Oct 2025" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="accessibilityNeeds" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accessibility Needs</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Stroller gate check required" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="travelInsuranceNotes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Travel Insurance</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Covered via Chase Sapphire" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>

                {/* Lodging & Extras */}
                <Card className="border-none shadow-md md:col-span-2">
                  <CardContent className="pt-6 space-y-4">
                    <h3 className="font-semibold text-lg text-foreground border-b pb-2 mb-4">Lodging & Notes</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={form.control} name="hotelPreferences" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hotel Preferences</FormLabel>
                          <FormControl>
                            <Textarea placeholder="e.g. Needs crib, high floor, away from elevator" className="h-24" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="additionalNotes" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Notes</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Anything else to remember when booking..." className="h-24" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </CardContent>
                </Card>

              </div>
            </form>
          </Form>
        )}
      </div>
    </Layout>
  );
}
