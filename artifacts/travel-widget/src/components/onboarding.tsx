import { useState, useEffect } from "react";

/* ─── Types ─── */
interface SuggestedProgram { brand: string; program: string; }
interface TravelerDraft { name: string; isChild: boolean; birthYear: string; }

/* ─── Curated style groups for onboarding (5 per group) ─── */
const ONBOARDING_STYLES: { label: string; items: { id: string; label: string }[] }[] = [
  { label: "LUXURY", items: [
    { id: "ultra-luxury", label: "Ultra Luxury" },
    { id: "boutique-luxury", label: "Boutique Luxury" },
    { id: "safari-expedition", label: "Safari & Expedition" },
    { id: "private-villa", label: "Private Villa" },
    { id: "design-hotels", label: "Design Hotels" },
  ]},
  { label: "FAMILY", items: [
    { id: "luxury-family", label: "Luxury Family" },
    { id: "active-family", label: "Active Family" },
    { id: "beach-family", label: "Beach Family" },
    { id: "disney-family", label: "Disney Family" },
    { id: "multi-gen-travel", label: "Multi-Gen Travel" },
  ]},
  { label: "FOOD & DRINK", items: [
    { id: "foodie", label: "Foodie" },
    { id: "fine-dining", label: "Fine Dining" },
    { id: "local-authentic", label: "Local & Authentic" },
    { id: "wine-country", label: "Wine Country" },
    { id: "omakase-chefs-table", label: "Omakase & Chef's Table" },
  ]},
  { label: "WELLNESS", items: [
    { id: "spa-wellness", label: "Spa & Wellness" },
    { id: "yoga-retreat", label: "Yoga Retreat" },
    { id: "digital-detox", label: "Digital Detox" },
    { id: "thermal-hot-springs", label: "Thermal & Hot Springs" },
    { id: "longevity-biohacking", label: "Longevity & Biohacking" },
  ]},
  { label: "ADVENTURE", items: [
    { id: "hiking-trekking", label: "Hiking & Trekking" },
    { id: "skiing-snow", label: "Skiing & Snow" },
    { id: "surf-travel", label: "Surf Travel" },
    { id: "diving-snorkeling", label: "Diving & Snorkeling" },
    { id: "safari-wildlife", label: "Safari & Wildlife" },
  ]},
  { label: "CULTURE", items: [
    { id: "art-museum", label: "Art & Museum" },
    { id: "architecture", label: "Architecture" },
    { id: "heritage-history", label: "Heritage & History" },
    { id: "slow-travel", label: "Slow Travel" },
    { id: "spiritual-travel", label: "Spiritual Travel" },
  ]},
];

/* ─── Shared chrome styles ─── */
const STEP_TITLE: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontWeight: 700,
  fontSize: "36px",
  color: "#1C1C1C",
  letterSpacing: "-0.01em",
  marginBottom: "10px",
};
const STEP_SUB: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontStyle: "italic",
  fontWeight: 400,
  fontSize: "17px",
  color: "#8C8279",
  marginBottom: "36px",
  lineHeight: 1.5,
};

/* ─── Step 1: Travel party ─── */
function Step1({
  travelers, setTravelers,
}: {
  travelers: TravelerDraft[];
  setTravelers: React.Dispatch<React.SetStateAction<TravelerDraft[]>>;
}) {
  const [name, setName] = useState("");
  const [isChild, setIsChild] = useState(false);
  const [birthYear, setBirthYear] = useState("");

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setTravelers(t => [...t, { name: trimmed, isChild, birthYear }]);
    setName(""); setIsChild(false); setBirthYear("");
  };

  const remove = (i: number) => setTravelers(t => t.filter((_, idx) => idx !== i));

  return (
    <div>
      <h2 style={STEP_TITLE}>Who travels with you?</h2>
      <p style={STEP_SUB}>Add the people you travel with most. You can always update this later.</p>

      {/* Added travelers */}
      {travelers.length > 0 && (
        <div style={{ marginBottom: "24px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {travelers.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #E5E0D8" }}>
              <div>
                <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "15px", color: "#1C1C1C", fontWeight: 500 }}>{t.name}</span>
                {t.isChild && t.birthYear && (
                  <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#8C8279", marginLeft: "10px" }}>
                    b. {t.birthYear}
                  </span>
                )}
                {t.isChild && !t.birthYear && (
                  <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#8C8279", marginLeft: "10px" }}>child</span>
                )}
              </div>
              <button onClick={() => remove(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8C8279", fontSize: "16px", lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#B8963E", display: "block", marginBottom: "6px" }}>Name</span>
          <input
            className="input-underline"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())}
            placeholder="e.g. Emma"
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#B8963E" }}>Is a child?</span>
          {["No", "Yes"].map(v => {
            const active = (v === "Yes") === isChild;
            return (
              <button key={v} type="button" onClick={() => setIsChild(v === "Yes")} style={{ fontFamily: "'Raleway', sans-serif", fontSize: "13px", fontWeight: 500, color: active ? "#6B2737" : "#8C8279", background: "none", border: "none", borderBottom: active ? "2px solid #6B2737" : "2px solid transparent", paddingBottom: "2px", cursor: "pointer" }}>
                {v}
              </button>
            );
          })}
        </div>

        {isChild && (
          <div>
            <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#B8963E", display: "block", marginBottom: "6px" }}>Birth year</span>
            <input
              className="input-underline"
              type="number"
              value={birthYear}
              onChange={e => setBirthYear(e.target.value)}
              placeholder="e.g. 2018"
              min={1990}
              max={new Date().getFullYear()}
              style={{ width: "120px" }}
            />
          </div>
        )}

        <button
          type="button"
          onClick={add}
          disabled={!name.trim()}
          style={{
            alignSelf: "flex-start",
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 600,
            fontSize: "11px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: name.trim() ? "#6B2737" : "#8C8279",
            background: "none",
            border: "none",
            cursor: name.trim() ? "pointer" : "default",
            padding: 0,
          }}
        >
          + Add traveler
        </button>
      </div>

      {travelers.length === 0 && (
        <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: "12px", color: "#8C8279", marginTop: "24px", fontStyle: "italic" }}>
          You can skip this and add travelers on the Travelers page anytime.
        </p>
      )}
    </div>
  );
}

/* ─── Step 2: Travel style ─── */
function Step2({ styles, setStyles }: { styles: string[]; setStyles: React.Dispatch<React.SetStateAction<string[]>> }) {
  const toggle = (id: string) =>
    setStyles(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <div>
      <h2 style={STEP_TITLE}>How do you travel?</h2>
      <p style={STEP_SUB}>Select all that feel like you. We'll use this to match reviews to your style.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        {ONBOARDING_STYLES.map(group => (
          <div key={group.label}>
            <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#8C8279", marginBottom: "12px" }}>
              {group.label}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 24px" }}>
              {group.items.map(item => {
                const on = styles.includes(item.id);
                return (
                  <button key={item.id} type="button" onClick={() => toggle(item.id)} style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "15px", color: on ? "#6B2737" : "#8C8279", background: "none", border: "none", borderBottom: on ? "2px solid #6B2737" : "2px solid transparent", paddingBottom: "3px", cursor: "pointer", transition: "color 0.15s, border-color 0.15s", lineHeight: 2 }}>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Step 3: Loyalty programs ─── */
function Step3({
  programs, selected, setSelected,
}: {
  programs: SuggestedProgram[];
  selected: Map<string, string>;
  setSelected: React.Dispatch<React.SetStateAction<Map<string, string>>>;
}) {
  const toggle = (brand: string) => {
    setSelected(m => {
      const next = new Map(m);
      if (next.has(brand)) next.delete(brand);
      else next.set(brand, "");
      return next;
    });
  };
  const setNum = (brand: string, val: string) => {
    setSelected(m => { const next = new Map(m); next.set(brand, val); return next; });
  };

  const selectedBrands = Array.from(selected.keys());

  return (
    <div>
      <h2 style={STEP_TITLE}>Your hotel loyalties</h2>
      <p style={STEP_SUB}>Select programs you're a member of. Membership numbers are optional.</p>

      {/* Program chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px", marginBottom: "32px" }}>
        {programs.map(p => {
          const on = selected.has(p.brand);
          return (
            <button key={p.brand} type="button" onClick={() => toggle(p.brand)} style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "14px", color: on ? "#6B2737" : "#8C8279", background: "none", border: "none", borderBottom: on ? "2px solid #6B2737" : "2px solid transparent", paddingBottom: "3px", cursor: "pointer", transition: "color 0.15s, border-color 0.15s", lineHeight: 2 }}>
              {p.brand}
            </button>
          );
        })}
      </div>

      {/* Membership numbers for selected */}
      {selectedBrands.length > 0 && (
        <div style={{ borderTop: "1px solid #E5E0D8", paddingTop: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#B8963E" }}>
            Membership numbers (optional)
          </p>
          {selectedBrands.map(brand => (
            <div key={brand} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: "13px", color: "#1C1C1C", fontWeight: 500, width: "130px", flexShrink: 0 }}>{brand}</span>
              <input
                className="input-underline"
                value={selected.get(brand) ?? ""}
                onChange={e => setNum(brand, e.target.value)}
                placeholder="Optional"
                style={{ fontFamily: "Menlo, monospace", fontSize: "13px" }}
              />
            </div>
          ))}
        </div>
      )}

      {programs.length === 0 && (
        <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: "13px", color: "#8C8279", fontStyle: "italic" }}>Loading programs…</p>
      )}
    </div>
  );
}

/* ─── Step 4: Flight details ─── */
function Step4({
  seatPref, setSeatPref, mealPref, setMealPref, ffNumbers, setFfNumbers,
}: {
  seatPref: string; setSeatPref: (v: string) => void;
  mealPref: string; setMealPref: (v: string) => void;
  ffNumbers: string; setFfNumbers: (v: string) => void;
}) {
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#B8963E" }}>{label}</span>
      {children}
    </div>
  );

  return (
    <div>
      <h2 style={STEP_TITLE}>Last few details</h2>
      <p style={STEP_SUB}>Saved once, auto-filled everywhere — every booking form, every time.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        <Field label="Seat preferences">
          <input className="input-underline" value={seatPref} onChange={e => setSeatPref(e.target.value)} placeholder="Aisle for adults, window for kids" />
        </Field>
        <Field label="Meal preferences">
          <input className="input-underline" value={mealPref} onChange={e => setMealPref(e.target.value)} placeholder="1 Vegetarian, 2 Child meals" />
        </Field>
        <Field label="Frequent flyer numbers">
          <textarea className="input-underline" value={ffNumbers} onChange={e => setFfNumbers(e.target.value)} placeholder={"Delta SkyMiles: 1234567 (Sarah)\nUnited MileagePlus: 7654321 (John)"} rows={3} style={{ resize: "none" }} />
        </Field>
      </div>
    </div>
  );
}

/* ─── Main Wizard ─── */
interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const TOTAL = 4;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [travelers, setTravelers] = useState<TravelerDraft[]>([]);
  // Step 2
  const [travelStyles, setTravelStyles] = useState<string[]>([]);
  // Step 3
  const [programs, setPrograms] = useState<SuggestedProgram[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<Map<string, string>>(new Map());
  // Step 4
  const [seatPref, setSeatPref] = useState("");
  const [mealPref, setMealPref] = useState("");
  const [ffNumbers, setFfNumbers] = useState("");

  useEffect(() => {
    fetch("/api/loyalty/programs", { credentials: "include" })
      .then(r => r.json())
      .then(setPrograms)
      .catch(() => {});
  }, []);

  const handleSkip = () => {
    localStorage.setItem("onboardingComplete", "true");
    onComplete();
  };

  const handleBack = () => setStep(s => s - 1);

  const handleNext = async () => {
    if (step < TOTAL) {
      setStep(s => s + 1);
      return;
    }

    setSaving(true);
    try {
      const saves: Promise<unknown>[] = [];

      // Save travelers
      travelers.forEach(t => {
        const birthDate = t.isChild && t.birthYear ? `${t.birthYear}-01-01` : undefined;
        saves.push(
          fetch("/api/travelers", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: t.name, isChild: t.isChild, birthDate }),
          })
        );
      });

      // Save loyalty programs
      Array.from(selectedPrograms.entries()).forEach(([brand, membershipNumber]) => {
        const prog = programs.find(p => p.brand === brand);
        saves.push(
          fetch("/api/loyalty", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brand, programName: prog?.program ?? brand, membershipNumber: membershipNumber || null }),
          })
        );
      });

      // Save preferences (styles + flight — combined to avoid overwrite)
      saves.push(
        fetch("/api/preferences", {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            travelStyles,
            seatPreference: seatPref,
            mealPreference: mealPref,
            frequentFlyerNumbers: ffNumbers,
          }),
        })
      );

      await Promise.allSettled(saves);
    } finally {
      setSaving(false);
      localStorage.setItem("onboardingComplete", "true");
      onComplete();
    }
  };

  const wordmarkClick = () => {
    if (step === 1) return;
    if (window.confirm("Start the setup over? Your entries on this step won't be saved.")) {
      setStep(1);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F5F0E6", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes stepFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .step-content { animation: stepFade 0.22s ease both; }
      `}</style>

      {/* Top chrome */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "28px 36px" }}>
        <button
          onClick={wordmarkClick}
          style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: "18px", color: "#1C1C1C", background: "none", border: "none", cursor: step > 1 ? "pointer" : "default", padding: 0 }}
        >
          Companion
        </button>

        {/* Progress dots */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: i + 1 === step ? "#6B2737" : "#DDD8CE", transition: "background 0.25s" }} />
          ))}
        </div>

        <button
          onClick={handleSkip}
          style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 300, fontSize: "11px", color: "#8C8279", background: "none", border: "none", cursor: "pointer", letterSpacing: "0.03em" }}
        >
          Skip setup
        </button>
      </div>

      {/* Step content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 24px 0", overflowY: "auto" }}>
        <div className="step-content" key={step} style={{ width: "100%", maxWidth: "480px", paddingBottom: "48px" }}>
          {step === 1 && <Step1 travelers={travelers} setTravelers={setTravelers} />}
          {step === 2 && <Step2 styles={travelStyles} setStyles={setTravelStyles} />}
          {step === 3 && <Step3 programs={programs} selected={selectedPrograms} setSelected={setSelectedPrograms} />}
          {step === 4 && <Step4 seatPref={seatPref} setSeatPref={setSeatPref} mealPref={mealPref} setMealPref={setMealPref} ffNumbers={ffNumbers} setFfNumbers={setFfNumbers} />}
        </div>
      </div>

      {/* Bottom navigation */}
      <div style={{ padding: "24px 36px 36px", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "552px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {step > 1 ? (
          <button
            onClick={handleBack}
            style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 400, fontSize: "14px", color: "#8C8279", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Back
          </button>
        ) : (
          <div />
        )}
        <button
          onClick={handleNext}
          disabled={saving}
          className="btn-wine"
          style={{ height: "48px", width: "148px" }}
        >
          {saving ? "Saving…" : step === TOTAL ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
