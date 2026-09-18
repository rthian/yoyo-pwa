/**
 * Types for Head Judge Visualiser
 */

export interface VisualiserParticipant {
  id: string
  play_order: number | null
  member: { id: string; full_name: string; nickname: string | null } | null
}

export interface VisualiserJudge {
  id: string
  full_name: string
  judge_type: string
  scores_included_in_leaderboard?: boolean
}

export interface VisualiserScore {
  id: string
  division_member_id: string
  judge_id: string
  judge_name: string
  total_score: number
  technical_score: number
  performance_score: number
  is_submitted: boolean
  ex_clicks?: number
  ex_pv?: number
  ex_ch?: number
  ex_cons?: number
  ex_space?: number
  ex_body?: number
  ex_showman?: number
  ex_music?: number
  ex_construct?: number
  ex_trick_div?: number
  ex_deductions?: number
}

export interface ParticipantPanelStats {
  division_member_id: string
  mean: number
  stdDev: number
  scoreCount: number
}

export interface OutlierInfo {
  judge_id: string
  judge_name: string
  division_member_id: string
  participant_name: string
  score: number
  panel_mean: number
  deviation: number
  is_submitted: boolean
}

export interface JudgeScoreSummary {
  judge_id: string
  judge_name: string
  scoreCount: number
  avgDeviation: number
  outlierCount: number
}
