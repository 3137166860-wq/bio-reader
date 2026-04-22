import { z } from 'zod'

// ──────────────────────────────────────────────
// Stage 1 — Classifier Schema
// ──────────────────────────────────────────────

export const PaperCategory = z.enum([
  'in_vivo',
  'in_vitro',
  'clinical_trial',
  'omics',
  'methodology',
  'review',
  'other',
])

export type PaperCategory = z.infer<typeof PaperCategory>

export const ClassificationSchema = z.object({
  category: PaperCategory.describe(
    'The paper category based on its experimental approach'
  ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score between 0 and 1'),
  rationale: z
    .string()
    .describe('Brief rationale for why this category was chosen'),
})

export type Classification = z.infer<typeof ClassificationSchema>

// ──────────────────────────────────────────────
// Stage 2 — Base Entity Schema
// ──────────────────────────────────────────────

/**
 * Base entity that all categories share.
 * Each entity represents one extracted bio-med fact.
 */
export const BaseEntitySchema = z.object({
  target: z
    .string()
    .describe(
      'Biological target / molecule / gene / protein (e.g. "PD-L1", "EGFR")'
    ),
  animal_model: z
    .string()
    .describe('Animal model or cell system used (e.g. "C57BL/6 mice")'),
  dose: z
    .string()
    .describe(
      'Dosage / concentration information (e.g. "10 mg/kg", "5 μM")'
    ),
  efficacy: z
    .string()
    .describe(
      'Efficacy / outcome / result (e.g. "Tumor reduction 45%", "IC50 = 0.3 nM")'
    ),
  source_text: z
    .string()
    .describe(
      'Verbatim source sentence from the paper that supports this extraction'
    ),
})

export type BaseEntity = z.infer<typeof BaseEntitySchema>

// ──────────────────────────────────────────────
// Category-specific Enhanced Dimensions
// ──────────────────────────────────────────────

export const InVivoDimensionsSchema = z.object({
  administration_route: z
    .string()
    .describe('Route of administration (e.g. "oral gavage", "i.p.", "i.v.")'),
  treatment_duration: z
    .string()
    .describe('Duration of treatment (e.g. "21 days", "4 weeks")'),
  sample_size: z
    .string()
    .describe('Number of animals per group (e.g. "n=8", "n=10/group")'),
  biomarkers: z
    .array(z.string())
    .describe('Biomarkers measured (e.g. ["CD8+", "IFN-γ", "TNF-α"])'),
})

export const InVitroDimensionsSchema = z.object({
  cell_line: z
    .string()
    .describe('Cell line used (e.g. "MCF-7", "HEK293T", "A549")'),
  assay_type: z
    .string()
    .describe('Type of assay (e.g. "MTT", "western blot", "qPCR")'),
  concentration: z
    .string()
    .describe('Concentration range tested (e.g. "0.1-100 μM")'),
  incubation_time: z
    .string()
    .describe('Incubation time (e.g. "24 h", "72 h")'),
})

export const ClinicalTrialDimensionsSchema = z.object({
  phase: z
    .string()
    .describe('Trial phase (e.g. "Phase I", "Phase II", "Phase III")'),
  patient_count: z
    .string()
    .describe('Number of patients enrolled (e.g. "N=120")'),
  primary_endpoint: z
    .string()
    .describe('Primary endpoint measured (e.g. "OS", "PFS", "ORR")'),
  adverse_events: z
    .array(z.string())
    .describe('Adverse events reported (e.g. ["fatigue", "nausea"])'),
})

export const OmicsDimensionsSchema = z.object({
  platform: z
    .string()
    .describe('Technology platform (e.g. "RNA-seq", "LC-MS/MS", "scRNA-seq")'),
  sample_type: z
    .string()
    .describe('Sample type analyzed (e.g. "tissue", "blood", "FFPE")'),
  key_findings: z
    .array(z.string())
    .describe('Key omics findings (e.g. ["gene A upregulated", "pathway B enriched"])'),
  statistical_method: z
    .string()
    .describe('Statistical method used (e.g. "DESeq2", "limma", "edgeR")'),
})

export const MethodologyDimensionsSchema = z.object({
  technique: z
    .string()
    .describe('Main technique developed or used (e.g. "CRISPR screening", "single-cell ATAC-seq")'),
  key_parameters: z
    .string()
    .describe('Key performance parameters (e.g. "sensitivity 95%", "detection limit 1 fM")'),
  validation: z
    .string()
    .describe('Validation approach (e.g. "compared to gold standard", "cross-validation")'),
  throughput: z
    .string()
    .describe('Throughput or scalability (e.g. "96-well format", "high-throughput")'),
})

export const ReviewDimensionsSchema = z.object({
  scope: z
    .string()
    .describe('Scope of the review (e.g. "immune checkpoint inhibitors", "nanomedicine")'),
  papers_reviewed: z
    .string()
    .describe('Approximate number of papers reviewed (e.g. ">150 papers")'),
  key_conclusions: z
    .array(z.string())
    .describe('Key conclusions drawn from the literature'),
  future_directions: z
    .array(z.string())
    .describe('Future directions suggested'),
})

export const OtherDimensionsSchema = z.object({
  focus_area: z
    .string()
    .describe('Primary focus area of the paper'),
  methodology_used: z
    .string()
    .describe('Main methodology used'),
  key_finding: z
    .string()
    .describe('Key finding or contribution'),
})

// ──────────────────────────────────────────────
// Union of all dimension schemas
// ──────────────────────────────────────────────

export const CategoryDimensionsSchema = z.discriminatedUnion('category', [
  z.object({ category: z.literal('in_vivo'), dimensions: InVivoDimensionsSchema }),
  z.object({ category: z.literal('in_vitro'), dimensions: InVitroDimensionsSchema }),
  z.object({ category: z.literal('clinical_trial'), dimensions: ClinicalTrialDimensionsSchema }),
  z.object({ category: z.literal('omics'), dimensions: OmicsDimensionsSchema }),
  z.object({ category: z.literal('methodology'), dimensions: MethodologyDimensionsSchema }),
  z.object({ category: z.literal('review'), dimensions: ReviewDimensionsSchema }),
  z.object({ category: z.literal('other'), dimensions: OtherDimensionsSchema }),
])

export type CategoryDimensions = z.infer<typeof CategoryDimensionsSchema>

// ──────────────────────────────────────────────
// Full Analysis Result (Stage 2 output)
// ──────────────────────────────────────────────

export const AnalysisResultSchema = z.object({
  paper_title: z
    .string()
    .optional()
    .describe('The title of the paper being analyzed'),
  entities: z
    .array(BaseEntitySchema)
    .describe('List of extracted bio-med entities from the paper'),
  dimensions: CategoryDimensionsSchema.describe(
    'Category-specific enhanced dimensions'
  ),
})

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>

// ──────────────────────────────────────────────
// Persisted Record (Supabase row shape)
// ──────────────────────────────────────────────

export interface AnalysisRecord {
  id: string
  user_id: string
  pdf_name: string
  extracted_text: string
  extracted_json: AnalysisResult
  category: PaperCategory
  client_timestamp: number | null
  created_at: string
  updated_at: string
}

// ──────────────────────────────────────────────
// API Request shape (sent from client to /api/analyze)
// ──────────────────────────────────────────────

export interface AnalyzeRequest {
  text: string
  pdfName: string
  clientTimestamp: number
}

// ──────────────────────────────────────────────
// Helper: resolve the correct dimensions schema
// ──────────────────────────────────────────────

export function getDimensionsSchemaForCategory(
  category: PaperCategory
): z.ZodTypeAny {
  switch (category) {
    case 'in_vivo':
      return InVivoDimensionsSchema
    case 'in_vitro':
      return InVitroDimensionsSchema
    case 'clinical_trial':
      return ClinicalTrialDimensionsSchema
    case 'omics':
      return OmicsDimensionsSchema
    case 'methodology':
      return MethodologyDimensionsSchema
    case 'review':
      return ReviewDimensionsSchema
    case 'other':
      return OtherDimensionsSchema
  }
}
