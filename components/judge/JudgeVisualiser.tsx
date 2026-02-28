'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertTriangle, BarChart3, Users, ListChecks, EyeOff, GraduationCap } from 'lucide-react'
import type {
  VisualiserParticipant,
  VisualiserJudge,
  VisualiserScore,
  OutlierInfo,
  JudgeScoreSummary,
} from '@/lib/types/visualiser'

const CHART_COLORS = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)', 'var(--color-chart-5)']

interface VisualiserData {
  division: { id: string; name: string }
  participants: VisualiserParticipant[]
  judges: VisualiserJudge[]
  scores: VisualiserScore[]
  panelStats: { division_member_id: string; mean: number; stdDev: number; scoreCount: number }[]
  outliers: OutlierInfo[]
  judgeSummaries: JudgeScoreSummary[]
}

interface JudgeVisualiserProps {
  divisionId: string
}

function getParticipantLabel(p: VisualiserParticipant, index: number): string {
  const order = p.play_order ?? index + 1
  const name = p.member?.full_name ?? 'Unknown'
  return `${order}. ${name.split(' ')[0] ?? name}`
}

export default function JudgeVisualiser({ divisionId }: JudgeVisualiserProps) {
  const [data, setData] = useState<VisualiserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/divisions/${divisionId}/visualiser`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || `Failed to load: ${res.status}`)
      }
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load visualiser')
    } finally {
      setLoading(false)
    }
  }, [divisionId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center py-8 gap-2">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const { participants, judges, scores, outliers, judgeSummaries } = data
  const hasDrafts = scores.some((s) => !s.is_submitted)

  if (scores.length === 0) {
    return (
      <div className="space-y-4">
        {hasDrafts && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="flex items-center gap-2 p-3 text-sm text-amber-800 dark:text-amber-200">
              Including draft scores (not yet submitted).
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No scores yet</h3>
            <p className="text-sm text-muted-foreground">
              Scores will appear here once judges start scoring.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const participantComparisonData = participants.map((p, index) => {
    const label = getParticipantLabel(p, index)
    const point: Record<string, string | number | boolean> = { name: label, fullName: p.member?.full_name ?? '' }
    for (const j of judges) {
      const s = scores.find(
        (sc) => sc.division_member_id === p.id && sc.judge_id === j.id
      )
      point[j.id] = s?.total_score ?? 0
      point[`${j.id}_draft`] = !!(s && !s.is_submitted)
    }
    return point
  })

  return (
    <div className="space-y-4">
      {hasDrafts && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-center gap-2 p-3 text-sm text-amber-800 dark:text-amber-200">
            Including draft scores (not yet submitted).
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Excluded from results / Shadow judges (training) */}
      {(() => {
        const excluded = judges.filter((j) => j.judge_type !== 'shadow' && j.scores_included_in_leaderboard === false)
        const shadow = judges.filter((j) => j.judge_type === 'shadow')
        if (excluded.length === 0 && shadow.length === 0) return null
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Panel status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {excluded.length > 0 && (
                <div>
                  <p className="font-medium flex items-center gap-2 text-muted-foreground mb-1">
                    <EyeOff className="h-4 w-4" />
                    Excluded from results (scores not counted)
                  </p>
                  <p className="text-muted-foreground">{excluded.map((j) => j.full_name).join(', ')}</p>
                </div>
              )}
              {shadow.length > 0 && (
                <div>
                  <p className="font-medium flex items-center gap-2 text-muted-foreground mb-1">
                    <GraduationCap className="h-4 w-4" />
                    Shadow judges (training — scores never count)
                  </p>
                  <p className="text-muted-foreground">{shadow.map((j) => j.full_name).join(', ')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })()}

      {/* Participant comparison: grouped bar by participant, one bar per judge */}
      {judges.length > 0 && participants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Scores by participant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full min-w-0 overflow-x-auto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={participantComparisonData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const fullName = payload[0]?.payload?.fullName
                      return (
                        <Card className="p-2 shadow-lg">
                          <p className="font-medium text-sm mb-1">{fullName || label}</p>
                          {payload.map((entry, i) => {
                            const judge = judges.find((j) => j.id === entry.dataKey)
                            const isDraft = entry.payload?.[`${entry.dataKey}_draft`]
                            return (
                              <p key={i} className="text-xs text-muted-foreground">
                                {judge?.full_name}: {Number(entry.value).toFixed(1)}
                                {isDraft && ' (draft)'}
                              </p>
                            )
                          })}
                        </Card>
                      )
                    }}
                  />
                  <Legend />
                  {judges.map((j, i) => (
                    <Bar
                      key={j.id}
                      dataKey={j.id}
                      name={j.full_name}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      radius={[2, 2, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Judge deviation from panel mean */}
      {judgeSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Judge deviation from panel average
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={judgeSummaries.map((j) => ({
                    name: j.judge_name.split(' ')[0] ?? j.judge_name,
                    fullName: j.judge_name,
                    deviation: j.avgDeviation,
                    outlierCount: j.outlierCount,
                  }))}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 60, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={56} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload
                      return (
                        <Card className="p-2 shadow-lg">
                          <p className="font-medium text-sm">{p.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            Avg deviation: {Number(p.deviation).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Outliers: {p.outlierCount}
                          </p>
                        </Card>
                      )
                    }}
                  />
                  <Bar
                    dataKey="deviation"
                    name="Avg deviation"
                    fill="var(--color-chart-2)"
                    radius={[0, 2, 2, 0]}
                  >
                    {judgeSummaries.map((_, index) => (
                      <Cell
                        key={index}
                        fill={
                          Math.abs(judgeSummaries[index].avgDeviation) > 2
                            ? 'var(--color-destructive)'
                            : 'var(--color-chart-2)'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outlier list */}
      {outliers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Score outliers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {outliers.map((o, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded border border-border px-3 py-2"
                >
                  <span className="font-medium">{o.judge_name}</span>
                  <span className="text-muted-foreground">gave</span>
                  <span className="font-medium">{o.participant_name}</span>
                  <span className="text-muted-foreground">
                    {o.score.toFixed(1)} (panel avg {o.panel_mean.toFixed(1)},{' '}
                    {o.deviation >= 0 ? '+' : ''}
                    {o.deviation.toFixed(1)})
                  </span>
                  {!o.is_submitted && (
                    <span className="text-amber-600 dark:text-amber-400 text-xs">draft</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {outliers.length === 0 && scores.length > 0 && judgeSummaries.length > 0 && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No outliers detected. Scores are within the expected range.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
