import { z } from "zod";
import { NormalizedAirQualityReport } from "../aqi/types";

// Household & Family Profile Schema
export const FamilyMemberEnum = z.enum([
  "infants_under_5",
  "school_children",
  "elderly_seniors",
  "pregnant_women",
  "healthy_adults",
]);
export type FamilyMember = z.infer<typeof FamilyMemberEnum>;

export const HouseholdProfileSchema = z.object({
  familyMembers: z.array(FamilyMemberEnum).default(["healthy_adults"]),
  homeType: z.enum(["sealed_apartment", "independent_house", "naturally_ventilated"]).default("sealed_apartment"),
  hasAirPurifier: z.boolean().default(false),
  hasKitchenExhaust: z.boolean().default(true),
  cookingFuel: z.enum(["lpg_gas", "induction_electric", "biomass_wood"]).default("lpg_gas"),
  neighborhoodType: z.enum(["arterial_roadway", "residential_suburb", "industrial_near"]).default("residential_suburb"),
});
export type HouseholdProfile = z.infer<typeof HouseholdProfileSchema>;

export const DEFAULT_HOUSEHOLD_PROFILE: HouseholdProfile = {
  familyMembers: ["healthy_adults"],
  homeType: "sealed_apartment",
  hasAirPurifier: false,
  hasKitchenExhaust: true,
  cookingFuel: "lpg_gas",
  neighborhoodType: "residential_suburb",
};

// User Preferences Schema
export const UserPreferencesSchema = z.object({
  preferredTime: z.enum(["morning", "midday", "evening", "night"]).default("morning"),
  locationType: z.enum(["outdoor_preferred", "indoor_preferred", "balanced"]).default("balanced"),
  commuteMode: z.enum(["walking", "cycling", "public_transit", "two_wheeler", "car_cab"]).default("public_transit"),
  activityType: z.enum(["walking", "studying_deskwork", "outdoor_exercise", "commuting", "general_errands"]).default("walking"),
  sensitivity: z.enum(["standard", "respiratory_sensitivity", "vulnerable_household"]).default("standard"),
  household: HouseholdProfileSchema.optional(),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  preferredTime: "morning",
  locationType: "balanced",
  commuteMode: "public_transit",
  activityType: "walking",
  sensitivity: "standard",
  household: {
    familyMembers: ["healthy_adults"],
    homeType: "sealed_apartment",
    hasAirPurifier: false,
    hasKitchenExhaust: true,
    cookingFuel: "lpg_gas",
    neighborhoodType: "residential_suburb",
  },
};

export type RecommendationCategory =
  | "activity_window"
  | "indoor_alternative"
  | "precaution"
  | "ventilation"
  | "commute"
  | "family_defense"
  | "low_emission_action"
  | "community_collective";

export type RecommendationPriority = "critical" | "high" | "medium" | "low";

export interface DirectImpactExplanation {
  whatToChange: string;
  whyRelevant: string;
  expectedBenefit: string;
  calculationMethodology: string;
  assumptionsAndLimitations: string;
  quantifiedMetrics?: {
    exposureReductionPercent?: number;
    inhaledDoseAvoidedUg?: number;
    emissionsAvoidedGCO2e?: number;
    timeShiftMinutes?: number;
    indoorConcentrationReductionPercent?: number;
  };
}

export interface RecommendationSupportingData {
  aqi?: number | null;
  aqiCategory: string;
  dominantPollutant?: string | null;
  pm25Value?: number;
  pm10Value?: number;
  boundaryLayerMeters?: number;
  windSpeedKmh?: number;
  isInversionActive?: boolean;
}

export interface Recommendation {
  id: string;
  title: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  actionSummary: string;
  explanation: string;
  supportingData: RecommendationSupportingData;
  supportingDataText: string;
  source: string; // Official Traceable Citation
  observedAt: string;
  dataFreshnessMinutes: number;
  dataMode: "live" | "forecast" | "calibrated_baseline" | "demonstration";
  confidenceScore: number | null;
  targetTimeWindow?: string;
  targetAudience?: "all" | "children" | "seniors" | "household_low_emission" | "community";
  directImpact?: DirectImpactExplanation;
  indoorAlternative?: {
    title: string;
    description: string;
    intensity: "low" | "moderate";
  };
  matchedPreferences: string[];
}

export interface DiurnalScheduleSlot {
  timeRange: string;
  label: string;
  status: "optimal" | "acceptable" | "caution" | "hazardous";
  headlineAction: string;
  atmosphericPhysicsNote: string;
  recommendedActivity: string;
  indoorAlternative: string;
  isOptimalWindow: boolean;
  isInversionTrapped: boolean;
}

export interface RoutineEvaluationInput {
  aqiReport: NormalizedAirQualityReport;
  preferences?: Partial<UserPreferences>;
  currentHour?: number; // 0-23 in local IST
  isForecast?: boolean;
}

export interface RoutineEvaluationResult {
  status: "SUCCESS" | "STALE_DATA" | "EXPIRED_DATA" | "INSUFFICIENT_DATA";
  statusMessage: string;
  isDataFresh: boolean;
  dataFreshnessMinutes: number;
  aqiSummary: {
    aqi: number | null;
    category: string;
    dominantPollutant: string | null;
    stationName: string;
    hisi: number;
    boundaryLayerMeters: number;
    isInversionActive: boolean;
    provenanceText: string;
    dataMode: "live" | "forecast" | "calibrated_baseline" | "demonstration";
    observedAt: string;
  };
  recommendations: Recommendation[];
  schedule: DiurnalScheduleSlot[];
  userPreferences: UserPreferences;
  evaluatedAt: string;
}
